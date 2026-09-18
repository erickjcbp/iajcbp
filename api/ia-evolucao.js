// api/ia-evolucao.js — o farol da Evolução: a IA lê o RETRATO da pastoral e sugere o plano.
//
// PEDIDO DO DONO (18/09/2026): "quando eu bater o olho nessa ferramenta, o pessoal da formação
// consiga enxergar os gargalos e traçar um plano de evolução com ajuda da IA, tipo 'precisamos
// de formação para x, y'".
//
// ⚠️ NENHUM NOME DE CRIANÇA SAI DAQUI. O que vai para o modelo são CONTAGENS:
// "báculo: 5 aptos, 0 em formação, 171 sem treinar". A pastoral é feita de menores de idade,
// e mandar a lista nominal para um serviço de fora não é necessário para responder "onde
// estamos no fio" — quem cruza a sugestão com os nomes é o app, aqui dentro.
// Se um dia for preciso mandar nomes, que seja uma decisão escrita e explícita: por isso o
// corpo desta função monta o retrato a partir de agregados e não aceita lista de pessoas.
//
// SÓ RESPONDE A QUEM JÁ PODE VER ESSES NÚMEROS na tela (coordenação e equipe) — e só quando
// alguém CLICA. Nada aqui roda sozinho: é dinheiro por chamada.
const FUNCOES = ['apoio', 'cruz', 'vela', 'sineta', 'sinao', 'altar', 'turibulo',
  'naveta', 'missal', 'cred_altar', 'cred_credencia', 'mitra', 'baculo'];
const ROTULO = {
  apoio: 'Apoio', cruz: 'Cruz', vela: 'Vela', sineta: 'Sineta', sinao: 'Sinão', altar: 'Altar',
  turibulo: 'Turíbulo', naveta: 'Naveta', missal: 'Missal', cred_altar: 'Cerimoniário do Altar',
  cred_credencia: 'Cerimoniário da Credência', mitra: 'Mitra', baculo: 'Báculo',
};
const PRONTO = ['apto', 'experiente', 'referencia'];
const EQUIPE = ['coord_admin', 'subadmin', 'membro_equipe'];

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const URL = process.env.SUPABASE_URL;
  const ANON = process.env.SUPABASE_ANON_KEY;
  const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  const CHAVE = process.env.ANTHROPIC_API_KEY;
  if (!URL || !ANON || !SRK) return res.status(500).json({ error: 'Supabase não configurado' });
  // Recado honesto em vez de erro técnico: quem lê isso é a coordenação, não um programador.
  if (!CHAVE) {
    return res.status(503).json({
      error: 'A ajuda da IA ainda não foi ligada. Falta a chave do modelo nas variáveis do site (ANTHROPIC_API_KEY).',
      faltaChave: true,
    });
  }

  const h = { apikey: SRK, Authorization: `Bearer ${SRK}` };
  const jget = async (caminho) => {
    try {
      const r = await fetch(`${URL}/rest/v1/${caminho}`, { headers: h });
      if (!r.ok) return null;
      return await r.json();
    } catch (_) { return null; }
  };

  // ── Quem está chamando (o mesmo portão das outras portas) ──────────────────
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Token ausente' });
  const uRes = await fetch(`${URL}/auth/v1/user`, { headers: { apikey: ANON, Authorization: `Bearer ${token}` } });
  if (!uRes.ok) return res.status(401).json({ error: 'Token inválido' });
  const caller = await uRes.json();
  const mod = (await jget('pastoral_modules?slug=eq.acolitos&select=id') || [])[0];
  if (!mod) return res.status(500).json({ error: 'Módulo não encontrado' });
  const vinc = (await jget(`pastoral_members?user_id=eq.${caller.id}&module_id=eq.${mod.id}&select=role`) || [])[0];
  if (!vinc || !EQUIPE.includes(vinc.role)) return res.status(403).json({ error: 'Acesso negado' });

  // ── O RETRATO (só contagens) ───────────────────────────────────────────────
  const membros = await jget('acolitos_membros?status=eq.ativo&select=id,nivel');
  const habs = await jget('acolitos_habilitacoes?select=membro_id,funcao,proficiencia');
  if (!membros || !habs) {
    // Consulta que falhou não pode virar "está tudo coberto": melhor não perguntar nada.
    return res.status(502).json({ error: 'Não consegui ler o retrato da pastoral agora.' });
  }

  const porMembro = {};
  habs.forEach((x) => { (porMembro[x.membro_id] = porMembro[x.membro_id] || {})[x.funcao] = x.proficiencia; });
  const ativos = membros.map((m) => m.id);
  const cobertura = FUNCOES.map((f) => {
    let prontos = 0, formando = 0;
    ativos.forEach((id) => {
      const p = (porMembro[id] || {})[f];
      if (PRONTO.includes(p)) prontos++;
      else if (p === 'em_formacao') formando++;
    });
    return { funcao: ROTULO[f] || f, prontos, em_formacao: formando, sem_treinar: ativos.length - prontos - formando };
  }).sort((a, b) => a.prontos - b.prontos);

  const porNivel = {};
  membros.forEach((m) => { const n = m.nivel || '(sem degrau)'; porNivel[n] = (porNivel[n] || 0) + 1; });

  const retrato = { total_ativos: ativos.length, cobertura, pessoas_por_degrau: porNivel };

  // ── A pergunta ao modelo ───────────────────────────────────────────────────
  const instrucao = [
    'Você ajuda a coordenação de uma pastoral de acólitos e coroinhas (crianças e adolescentes',
    'que servem no altar de uma paróquia católica) a planejar a FORMAÇÃO do grupo.',
    'Recebe apenas CONTAGENS — nunca nomes. Responda em português do Brasil, simples, sem jargão,',
    'falando com quem coordena e não com quem programa.',
    'Devolva SOMENTE um JSON com esta forma, sem texto em volta:',
    '{"gargalos":[{"funcao":"...","porque":"..."}],',
    ' "plano":[{"titulo":"...","porque":"...","como":"..."}]}',
    'Regras: no máximo 3 gargalos e 3 itens de plano; "titulo" é curto e cabe numa tarefa',
    '(ex.: "Formar 6 pessoas em Turíbulo"); "porque" cita o número que justifica;',
    '"como" é um passo concreto para o próximo mês. Uma função com menos de 3 pessoas aptas',
    'é risco real: se duas faltarem, não há quem sirva.',
  ].join(' ');

  let resposta;
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': CHAVE,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5',
        max_tokens: 900,
        system: instrucao,
        messages: [{ role: 'user', content: 'Retrato de hoje:\n' + JSON.stringify(retrato) }],
      }),
    });
    const bruto = await r.json();
    if (!r.ok) {
      console.error('ia-evolucao: o modelo recusou —', r.status, bruto && bruto.error);
      return res.status(502).json({ error: 'O serviço de IA recusou o pedido. Tente de novo em alguns minutos.' });
    }
    const texto = (bruto.content || []).map((c) => c.text || '').join('').trim();
    const ini = texto.indexOf('{'), fim = texto.lastIndexOf('}');
    resposta = (ini >= 0 && fim > ini) ? JSON.parse(texto.slice(ini, fim + 1)) : null;
    if (!resposta || !Array.isArray(resposta.plano)) throw new Error('resposta fora do formato');
  } catch (e) {
    console.error('ia-evolucao: não consegui entender a resposta —', e && e.message);
    return res.status(502).json({ error: 'Não consegui entender a resposta da IA. Tente de novo.' });
  }

  // O retrato volta junto: a tela mostra o número ao lado da sugestão, para a coordenação
  // conferir o que a IA afirmou em vez de acreditar.
  return res.status(200).json({ ok: true, retrato, sugestao: resposta });
}
