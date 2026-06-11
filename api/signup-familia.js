// Vercel serverless — cadastro de FAMÍLIA (responsável cadastra 1+ filhos).
// Público (a aprovação no CRM é a trava). Cria contas Auth + membros + entradas CRM
// server-side com a service role: cada filho tem user_id próprio, então a RLS
// (user_id = auth.uid()) não deixaria o responsável inserir os irmãos pelo client.
const DOMINIO = '@coroinhas.jcbplimeira.com.br';
const COMUNIDADES = ['matriz', 'santo_antonio', 'outra'];

function userBase(u) {
  return String(u || '').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const URL = process.env.SUPABASE_URL;
  const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL || !SRK) return res.status(500).json({ error: 'Server misconfigured' });

  const { senha, pais, filhos } = req.body || {};
  if (!senha || String(senha).length < 6) return res.status(400).json({ error: 'A senha deve ter ao menos 6 caracteres.' });
  if (!Array.isArray(filhos) || filhos.length < 1) return res.status(400).json({ error: 'Inclua ao menos um filho.' });
  for (const f of filhos) {
    if (!f || !String(f.nome || '').trim()) return res.status(400).json({ error: 'Cada filho precisa de um nome.' });
    if (!userBase(f.usuario)) return res.status(400).json({ error: 'Cada filho precisa de um usuário válido.' });
    if (f.comunidade && !COMUNIDADES.includes(f.comunidade)) return res.status(400).json({ error: 'Comunidade inválida.' });
  }

  const p = pais || {};
  const auth = { apikey: SRK, Authorization: `Bearer ${SRK}`, 'Content-Type': 'application/json' };
  const rest = { ...auth, Prefer: 'return=representation' };
  const grupo = crypto.randomUUID();

  const nomeMae = String(p.nome_mae || '').trim() || null;
  const nomePai = String(p.nome_pai || '').trim() || null;
  const contatoPrincipal = p.contato_principal === 'pai' ? 'pai' : (p.contato_principal === 'mae' ? 'mae' : null);
  const responsavelNome = contatoPrincipal === 'pai' ? nomePai : nomeMae;
  const paisBase = {
    nome_mae: nomeMae,
    nome_pai: nomePai,
    contato_principal: contatoPrincipal,
    celular_responsavel: String(p.celular || '').trim() || null,
    responsavel_whatsapp: !!p.whatsapp,
    responsavel: responsavelNome,
    tem_mae_ministro: !!p.mae_ministra,
    nome_mae_ministro: p.mae_ministra ? nomeMae : null,
    tem_pai_ministro: !!p.pai_ministro,
    nome_pai_ministro: p.pai_ministro ? nomePai : null,
    comunidade_ministro: (p.mae_ministra || p.pai_ministro) ? (String(p.comunidade_ministro || '').trim() || null) : null,
    grupo_irmaos: grupo,
    escalar_com_irmao: true,
    status: 'em_integracao'
  };

  // módulo acólitos (para o vínculo pastoral_members de cada filho)
  let moduleId = null;
  {
    const rmod = await fetch(`${URL}/rest/v1/pastoral_modules?slug=eq.acolitos&select=id`, { headers: auth });
    const dmod = await rmod.json().catch(() => []);
    moduleId = Array.isArray(dmod) && dmod[0] ? dmod[0].id : null;
  }
  if (!moduleId) return res.status(500).json({ error: 'Módulo acólitos não encontrado.' });

  const criados = []; // { authId, membroId, usuario }

  async function rollback() {
    for (const c of criados.slice().reverse()) {
      if (c.authId) await fetch(`${URL}/rest/v1/pastoral_members?user_id=eq.${c.authId}&module_id=eq.${moduleId}`, { method: 'DELETE', headers: auth }).catch(() => {});
      if (c.membroId) await fetch(`${URL}/rest/v1/acolitos_membros?id=eq.${c.membroId}`, { method: 'DELETE', headers: auth }).catch(() => {});
      if (c.authId) await fetch(`${URL}/auth/v1/admin/users/${c.authId}`, { method: 'DELETE', headers: auth }).catch(() => {});
    }
  }

  try {
    for (const f of filhos) {
      const nome = String(f.nome).trim();
      const base = userBase(f.usuario);

      // 1) cria a conta Auth resolvendo colisão de usuário com sufixo (base, base2, base3...)
      let usuario = base, authId = null;
      for (let n = 1; n <= 30; n++) {
        const tentativa = n === 1 ? base : base + n;
        const r = await fetch(`${URL}/auth/v1/admin/users`, {
          method: 'POST', headers: auth,
          body: JSON.stringify({ email: tentativa + DOMINIO, password: senha, email_confirm: true, user_metadata: { nome } })
        });
        const d = await r.json();
        if (r.ok) { authId = d.id; usuario = tentativa; break; }
        const existe = /registered|already|exists/i.test(d.msg || d.message || d.error_code || '');
        if (!existe) throw new Error(d.msg || d.message || ('Erro ao criar conta de ' + nome));
      }
      if (!authId) throw new Error('Não foi possível gerar um usuário para ' + nome);
      criados.push({ authId, membroId: null, usuario });

      // 2) cria o membro (denormaliza dados dos pais)
      const membro = { ...paisBase, user_id: authId, nome, data_nascimento: f.data_nascimento || null, comunidade: f.comunidade || null };
      const rm = await fetch(`${URL}/rest/v1/acolitos_membros`, { method: 'POST', headers: rest, body: JSON.stringify(membro) });
      const dm = await rm.json();
      if (!rm.ok || !dm[0]) throw new Error((dm && (dm.message || dm.error)) || ('Erro ao cadastrar ' + nome));
      criados[criados.length - 1].membroId = dm[0].id;

      // 3) entrada no CRM para aprovação da coordenação
      const rc = await fetch(`${URL}/rest/v1/acolitos_crm`, { method: 'POST', headers: auth, body: JSON.stringify({ membro_id: dm[0].id, etapa: 'aprovacao_cadastro' }) });
      if (!rc.ok) { const dc = await rc.json().catch(() => ({})); throw new Error(dc.message || ('Erro ao registrar aprovação de ' + nome)); }

      // 4) vínculo do módulo — sem ele o app jogaria o filho pro novos.html
      const rv = await fetch(`${URL}/rest/v1/pastoral_members`, {
        method: 'POST',
        headers: { ...auth, Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify({ user_id: authId, module_id: moduleId, role: 'novo' })
      });
      if (!rv.ok) { const dv = await rv.json().catch(() => ({})); throw new Error(dv.message || ('Erro ao vincular ' + nome)); }
    }
  } catch (e) {
    await rollback();
    return res.status(400).json({ error: e.message || 'Não foi possível concluir o cadastro.' });
  }

  return res.status(200).json({ ok: true, usuarios: criados.map(c => c.usuario) });
}
