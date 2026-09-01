// Vercel serverless — cadastro de FAMÍLIA (responsável cadastra 1+ filhos).
// Público (a aprovação no CRM é a trava). Cria contas Auth + membros + entradas CRM
// server-side com a service role: cada filho tem user_id próprio, então a RLS
// (user_id = auth.uid()) não deixaria o responsável inserir os irmãos pelo client.
//
// CONFERE SE A CRIANÇA JÁ ESTÁ NA PASTORAL — desde 30/08/2026. Até essa data esta
// porta criava a pessoa direto, sem perguntar nada, enquanto a porta "Novos" perguntava.
// Das 4 fichas criadas desde que a conferência subiu (27/08), TRÊS entraram por aqui, e
// foi assim que a Beatriz Dutra Correia virou duas fichas com o nome IDÊNTICO. A regra
// é a mesma dos dois lados agora, e mora num arquivo só: api/_vinculo.js.
import { decidirVinculo } from './_vinculo.js';

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
    // GRAVA NO CAMPO QUE O APP MANTÉM. Esta porta escrevia em `celular_responsavel` e a
    // outra em `celular_recado`, então o mesmo dado morava em dois lugares conforme a
    // porta — e cada tela juntava os dois numa ordem diferente. O `celular_responsavel`
    // continua sendo lido como reserva, para as fichas gravadas antes de 31/08/2026.
    celular_recado: String(p.celular || '').trim() || null,
    responsavel_whatsapp: !!p.whatsapp,
    responsavel: responsavelNome,
    // Só a MARCA de ser ministro. O nome já está em nome_mae/nome_pai logo acima —
    // gravar de novo em nome_*_ministro era o mesmo dado em dois lugares, e dois lugares
    // para a mesma verdade é como nascem as divergências.
    tem_mae_ministro: !!p.mae_ministra,
    tem_pai_ministro: !!p.pai_ministro,
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

  const criados = []; // { authId, membroId, ligadoId, usuario }

  async function rollback() {
    for (const c of criados.slice().reverse()) {
      if (c.authId) await fetch(`${URL}/rest/v1/pastoral_members?user_id=eq.${c.authId}&module_id=eq.${moduleId}`, { method: 'DELETE', headers: auth }).catch(() => {});
      // ARMADILHA: `membroId` é ficha que ESTE cadastro criou e pode ser apagada.
      // `ligadoId` é ficha de uma criança que JÁ EXISTIA — nela só se devolve o
      // user_id para nulo. Apagar por id aqui destruiria escalas, habilitações e XP
      // de alguém que serve há anos, por causa de uma falha no meio do cadastro.
      if (c.membroId) await fetch(`${URL}/rest/v1/acolitos_membros?id=eq.${c.membroId}`, { method: 'DELETE', headers: auth }).catch(() => {});
      if (c.ligadoId) await fetch(`${URL}/rest/v1/acolitos_membros?id=eq.${c.ligadoId}`, { method: 'PATCH', headers: auth, body: JSON.stringify({ user_id: null }) }).catch(() => {});
      if (c.authId) await fetch(`${URL}/auth/v1/admin/users/${c.authId}`, { method: 'DELETE', headers: auth }).catch(() => {});
    }
  }

  // O cadastro inteiro, para saber quem já está na pastoral. Lido UMA vez: a família
  // pode estar cadastrando três filhos, e três leituras do cadastro seriam três vezes
  // o mesmo trabalho.
  let membros = [];
  {
    const r = await fetch(`${URL}/rest/v1/acolitos_membros?select=id,nome,data_nascimento,nome_mae,user_id,nivel,status&limit=2000`, { headers: auth });
    membros = r.ok ? (await r.json().catch(() => [])) : [];
  }

  // A fila da coordenação (Config › Cadastros barrados). Nunca pode derrubar o cadastro.
  async function registrar(resultado, nomeDigitado, nasc, membro_id) {
    try {
      await fetch(`${URL}/rest/v1/acolitos_vinculo_tentativas`, {
        method: 'POST', headers: { ...auth, Prefer: 'return=minimal' },
        body: JSON.stringify({
          user_id: null, nome_digitado: nomeDigitado, nascimento_informado: nasc || null,
          nome_mae_informado: nomeMae, resultado, membro_id: membro_id || null,
        })
      });
    } catch (e) { /* registro é para gente ler; não é parte do cadastro */ }
  }

  // FREIO contra chutar data de nascimento. Aqui NÃO há conta logada para contar por
  // ela — cada tentativa cria contas novas —, então a contagem é pelo NOME digitado,
  // que é justamente o que se repete quando alguém insiste numa criança só. Três erros
  // com o mesmo nome em 24h e o app para de TENTAR LIGAR; o cadastro conclui igual.
  async function errosDe(nomeDigitado) {
    try {
      const desde = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const r = await fetch(`${URL}/rest/v1/acolitos_vinculo_tentativas?select=id` +
        `&nome_digitado=eq.${encodeURIComponent(nomeDigitado)}` +
        `&resultado=in.(prova_nao_bateu,travado)&quando=gte.${desde}`, { headers: auth });
      return r.ok ? (await r.json()).length : 0;
    } catch (e) { return 0; }
  }

  try {
    for (const f of filhos) {
      const nome = String(f.nome).trim();
      const base = userBase(f.usuario);

      // 0) ESSA CRIANÇA JÁ ESTÁ NA PASTORAL? Mesma regra da porta "Novos" — a decisão
      // mora no _vinculo.js, e é decidida ANTES de criar qualquer conta.
      const v = decidirVinculo({
        nome, nascimento: f.data_nascimento, nome_mae: nomeMae,
        membros, userId: null, errosRecentes: await errosDe(nome),
      });
      // Única parada que sobrou: a prova BATEU e a ficha já é de outra conta. Aí a
      // criança já tem login, e o certo é recuperar a senha — nunca uma segunda ficha
      // por cima da que já existe.
      if (v.acao === 'ja_tem_conta') {
        // REGISTRA ANTES DE RECUSAR. Lançando o erro direto, a coordenação nunca ficava
        // sabendo: na porta "Novos" este caso aparece em Config › Cadastros barrados, e aqui
        // não aparecia — as duas portas voltavam a divergir, que é a doença que o
        // _vinculo.js existe para curar. Descoberto testando a porta de verdade em 31/08.
        if (v.registrar) await registrar(v.registrar, nome, f.data_nascimento, v.membro_id);
        throw new Error('Já existe um cadastro de ' + nome + ' ligado a outra conta. Se a conta '
          + 'é sua, use "Esqueci minha senha" na tela de entrada. Se não for, fale com a coordenação.');
      }

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
      criados.push({ authId, membroId: null, ligadoId: null, usuario });

      let papel = 'novo';
      if (v.acao === 'ligar') {
        // 2a) RECONHECIDA: a conta passa a ser da ficha que JÁ EXISTE. Não nasce uma
        // segunda pessoa, não se sobrescreve nada do que já está lá (o que faltar ela
        // completa depois em "Complete seu cadastro"), e não se abre ficha no CRM —
        // ela já é daqui. Era isto que faltava aqui e produziu duplicata de gente real.
        const rl = await fetch(`${URL}/rest/v1/acolitos_membros?id=eq.${v.membro_id}`, {
          method: 'PATCH', headers: auth, body: JSON.stringify({ user_id: authId })
        });
        if (!rl.ok) { const dl = await rl.json().catch(() => ({})); throw new Error(dl.message || ('Erro ao ligar o cadastro de ' + nome)); }
        criados[criados.length - 1].ligadoId = v.membro_id;
        papel = v.papel || 'novo';   // vem do NÍVEL dela: quem serve há anos não entra como novata
      } else {
        // 2b) Pessoa nova mesmo: cria a ficha (denormaliza dados dos pais)
        const membro = { ...paisBase, user_id: authId, nome, data_nascimento: f.data_nascimento || null, comunidade: f.comunidade || null };
        const rm = await fetch(`${URL}/rest/v1/acolitos_membros`, { method: 'POST', headers: rest, body: JSON.stringify(membro) });
        const dm = await rm.json();
        if (!rm.ok || !dm[0]) throw new Error((dm && (dm.message || dm.error)) || ('Erro ao cadastrar ' + nome));
        criados[criados.length - 1].membroId = dm[0].id;

        // 3) entrada no CRM para aprovação da coordenação
        const rc = await fetch(`${URL}/rest/v1/acolitos_crm`, { method: 'POST', headers: auth, body: JSON.stringify({ membro_id: dm[0].id, etapa: 'aprovacao_cadastro' }) });
        if (!rc.ok) { const dc = await rc.json().catch(() => ({})); throw new Error(dc.message || ('Erro ao registrar aprovação de ' + nome)); }
      }

      // 4) vínculo do módulo — sem ele o app jogaria o filho pro novos.html
      const rv = await fetch(`${URL}/rest/v1/pastoral_members`, {
        method: 'POST',
        headers: { ...auth, Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify({ user_id: authId, module_id: moduleId, role: papel })
      });
      if (!rv.ok) { const dv = await rv.json().catch(() => ({})); throw new Error(dv.message || ('Erro ao vincular ' + nome)); }

      // 5) O que a coordenação precisa ver. Fica por ÚLTIMO de propósito: se o cadastro
      // falhar no meio, o rollback desfaz tudo e este registro não deve ter existido.
      if (v.registrar) await registrar(v.registrar, nome, f.data_nascimento, v.membro_id || v.parecido_id);
    }
  } catch (e) {
    await rollback();
    return res.status(400).json({ error: e.message || 'Não foi possível concluir o cadastro.' });
  }

  return res.status(200).json({ ok: true, usuarios: criados.map(c => c.usuario) });
}
