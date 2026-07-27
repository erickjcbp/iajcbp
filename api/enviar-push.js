// api/enviar-push.js — envio de push. Tipos:
//   aviso    (coord)                     → comunicado; membros[] opcional, senão TODOS
//   teste    (coord)                     → titulo/texto livres (preview)
//   escalado (equipe/cerimonario)        → "você foi escalado"; membros[] obrigatório
//   ausencia (equipe/cerimonario)        → "ausência respondida"; membros[] obrigatório
//   troca    (qualquer membro, VALIDADO) → "convite de troca"; alvo_membro_id (o servidor confere o convite real)
//   arte     (SÓ o robô do cron)         → "arte da escala pronta"; vai pra coordenação; texto montado aqui
import webpush from 'web-push';
import crypto from 'node:crypto';

const COORD = ['coord_admin', 'subadmin'];
const EQUIPE = ['coord_admin', 'subadmin', 'membro_equipe', 'cerimonario'];
const URLBASE_MEMBRO = '/projetos/acolitos/escalas-membro.html';
const URLBASE_ESCALA = '/projetos/acolitos/escala.html';

// Compara segredos sem vazar tempo. Falso se qualquer um estiver vazio.
function segredoConfere(recebido, esperado) {
  if (!recebido || !esperado) return false;
  const a = Buffer.from(String(recebido)), b = Buffer.from(String(esperado));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// '2026-08-02' → '2 de agosto'
function dataPorExtenso(iso) {
  const MES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  if (!m) return null;
  return `${Number(m[3])} de ${MES[Number(m[2]) - 1]}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const URL = process.env.SUPABASE_URL, ANON = process.env.SUPABASE_ANON_KEY, SRK = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const VPUB = process.env.VAPID_PUBLIC_KEY, VPRIV = process.env.VAPID_PRIVATE_KEY, VSUB = process.env.VAPID_SUBJECT;
  if (!URL || !ANON || !SRK) return res.status(500).json({ error: 'Server misconfigured' });
  if (!VPUB || !VPRIV || !VSUB) return res.status(500).json({ error: 'VAPID não configurado' });

  const { tipo, texto, titulo, membros, alvo_membro_id, domingo } = req.body || {};
  if (!['aviso', 'teste', 'escalado', 'ausencia', 'troca', 'arte'].includes(tipo)) return res.status(400).json({ error: 'Tipo inválido' });

  // O robô do cron não tem login: entra pelo segredo compartilhado, e SÓ para 'arte'.
  const viaCron = segredoConfere(req.headers['x-cron-secret'], process.env.CRON_SECRET);
  if (viaCron && tipo !== 'arte') return res.status(403).json({ error: 'Segredo do cron só vale para arte' });
  if (tipo === 'arte' && !viaCron) return res.status(403).json({ error: 'Acesso negado' });

  const h = { apikey: SRK, Authorization: `Bearer ${SRK}` };
  const jget = async (path) => { try { return await (await fetch(`${URL}/rest/v1/${path}`, { headers: h })).json(); } catch (_) { return null; } };

  const mod = (await jget('pastoral_modules?slug=eq.acolitos&select=id') || [])[0];
  if (!mod) return res.status(500).json({ error: 'Módulo não encontrado' });

  let role = null, caller = null;
  if (!viaCron) {
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Token ausente' });
    const uRes = await fetch(`${URL}/auth/v1/user`, { headers: { apikey: ANON, Authorization: `Bearer ${token}` } });
    if (!uRes.ok) return res.status(401).json({ error: 'Token inválido' });
    caller = await uRes.json();
    role = ((await jget(`pastoral_members?user_id=eq.${caller.id}&module_id=eq.${mod.id}&select=role`) || [])[0] || {}).role;
  }

  // ── Autorização + alvo + conteúdo, por tipo ──
  let alvoMembros = null;        // array de membro_id, ou null = TODOS (só aviso)
  let alvoUserIds = null;        // atalho: quando o alvo já é conhecido por user_id (arte)
  let title, body, tag;

  if (tipo === 'aviso' || tipo === 'teste') {
    if (!COORD.includes(role)) return res.status(403).json({ error: 'Acesso negado' });
    const msg = String(texto || '').trim();
    if (!msg) return res.status(400).json({ error: 'Texto vazio' });
    title = tipo === 'teste' ? (String(titulo || '').trim() || 'Notificação') : 'Aviso da coordenação';
    body = msg.slice(0, 180);
    alvoMembros = (Array.isArray(membros) && membros.length) ? membros : null;

  } else if (tipo === 'escalado' || tipo === 'ausencia') {
    if (!EQUIPE.includes(role)) return res.status(403).json({ error: 'Acesso negado' });
    if (!Array.isArray(membros) || !membros.length) return res.status(400).json({ error: 'Sem destinatários' });
    const msg = String(texto || '').trim();
    if (!msg) return res.status(400).json({ error: 'Texto vazio' });
    title = String(titulo || '').trim() || (tipo === 'escalado' ? 'Você foi escalado ⛪' : 'Ausência respondida');
    body = msg.slice(0, 180);
    alvoMembros = membros;

  } else if (tipo === 'troca') {
    // Chamador é um MEMBRO comum → o servidor confere que ele REALMENTE convidou o alvo
    const me = (await jget(`acolitos_membros?user_id=eq.${caller.id}&select=id,nome,apelido`) || [])[0];
    if (!me) return res.status(403).json({ error: 'Sem perfil de membro' });
    if (!alvo_membro_id) return res.status(400).json({ error: 'Alvo ausente' });
    const sol = await jget(`acolitos_solicitacoes?membro_id=eq.${me.id}&alvo_membro_id=eq.${encodeURIComponent(alvo_membro_id)}&tipo=eq.troca&status=eq.aguardando_colega&select=id&limit=1`);
    if (!Array.isArray(sol) || !sol.length) return res.status(403).json({ error: 'Convite não encontrado' });
    title = 'Convite de troca 🔁';
    body = ((me.apelido || me.nome || 'Um colega') + ' quer trocar de missa com você. Veja no app.').slice(0, 180);
    alvoMembros = [alvo_membro_id];

  } else if (tipo === 'arte') {
    // Só o cron chega aqui (checado lá em cima). Nada de texto livre: a mensagem é montada
    // no servidor a partir da data, então o segredo não vira um megafone.
    const quando = dataPorExtenso(domingo);
    title = 'Arte da escala pronta 🎨';
    body = quando
      ? `A arte do fim de semana de ${quando} já está no app. Abra a Escala pra baixar e compartilhar.`
      : 'A arte do próximo fim de semana já está no app. Abra a Escala pra baixar e compartilhar.';
    const coords = await jget(`pastoral_members?module_id=eq.${mod.id}&role=in.(${COORD.join(',')})&select=user_id`) || [];
    alvoUserIds = [...new Set(coords.map((r) => r.user_id).filter(Boolean))];
    if (!alvoUserIds.length) return res.status(200).json({ ok: true, enviados: 0, removidos: 0, semInscritos: true });
  }

  // ── Resolve membros → user_ids → inscrições ──
  let subsUrl = `acolitos_push_subs?select=endpoint,p256dh,auth`;
  if (Array.isArray(alvoUserIds)) {
    subsUrl += `&user_id=in.(${alvoUserIds.map(encodeURIComponent).join(',')})`;
  } else if (Array.isArray(alvoMembros)) {
    const ids = alvoMembros.filter((x) => typeof x === 'string').slice(0, 500).map(encodeURIComponent).join(',');
    if (!ids) return res.status(400).json({ error: 'Sem destinatários' });
    const mrows = await jget(`acolitos_membros?id=in.(${ids})&select=user_id`) || [];
    const uids = [...new Set(mrows.map((r) => r.user_id).filter(Boolean))];
    if (!uids.length) return res.status(200).json({ ok: true, enviados: 0, removidos: 0, semInscritos: true });
    subsUrl += `&user_id=in.(${uids.map(encodeURIComponent).join(',')})`;
  }
  const subs = await jget(subsUrl) || [];

  webpush.setVapidDetails(VSUB, VPUB, VPRIV);
  tag = tipo + '-' + Date.now() + '-' + Math.round(Math.random() * 1e6); // única → não colapsa, re-alerta
  const url = tipo === 'arte' ? URLBASE_ESCALA
    : (tipo === 'aviso' || tipo === 'teste') ? '/projetos/acolitos/index.html'
    : URLBASE_MEMBRO;
  const payload = JSON.stringify({ title, body, url, tag, renotify: true });

  let enviados = 0, removidos = 0;
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
      enviados++;
    } catch (err) {
      if (err && (err.statusCode === 404 || err.statusCode === 410)) {
        removidos++;
        await fetch(`${URL}/rest/v1/acolitos_push_subs?endpoint=eq.${encodeURIComponent(s.endpoint)}`, { method: 'DELETE', headers: h });
      }
    }
  }));
  return res.status(200).json({ ok: true, enviados, removidos });
}
