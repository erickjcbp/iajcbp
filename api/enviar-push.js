// api/enviar-push.js — envio de push. Tipos:
//   aviso    (coord)                     → comunicado; membros[] opcional, senão TODOS
//   teste    (coord)                     → titulo/texto livres (preview)
//   escalado (equipe/cerimonario)        → "você foi escalado"; membros[] obrigatório
//   ausencia (equipe/cerimonario)        → "ausência respondida"; membros[] obrigatório
//   troca    (qualquer membro, VALIDADO) → "convite de troca"; alvo_membro_id (o servidor confere o convite real)
import webpush from 'web-push';

const COORD = ['coord_admin', 'subadmin'];
const EQUIPE = ['coord_admin', 'subadmin', 'membro_equipe', 'cerimonario'];
const URLBASE_MEMBRO = '/projetos/acolitos/escalas-membro.html';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const URL = process.env.SUPABASE_URL, ANON = process.env.SUPABASE_ANON_KEY, SRK = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const VPUB = process.env.VAPID_PUBLIC_KEY, VPRIV = process.env.VAPID_PRIVATE_KEY, VSUB = process.env.VAPID_SUBJECT;
  if (!URL || !ANON || !SRK) return res.status(500).json({ error: 'Server misconfigured' });
  if (!VPUB || !VPRIV || !VSUB) return res.status(500).json({ error: 'VAPID não configurado' });

  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Token ausente' });
  const uRes = await fetch(`${URL}/auth/v1/user`, { headers: { apikey: ANON, Authorization: `Bearer ${token}` } });
  if (!uRes.ok) return res.status(401).json({ error: 'Token inválido' });
  const caller = await uRes.json();

  const h = { apikey: SRK, Authorization: `Bearer ${SRK}` };
  const jget = async (path) => { try { return await (await fetch(`${URL}/rest/v1/${path}`, { headers: h })).json(); } catch (_) { return null; } };

  const mod = (await jget('pastoral_modules?slug=eq.acolitos&select=id') || [])[0];
  if (!mod) return res.status(500).json({ error: 'Módulo não encontrado' });
  const role = ((await jget(`pastoral_members?user_id=eq.${caller.id}&module_id=eq.${mod.id}&select=role`) || [])[0] || {}).role;

  const { tipo, texto, titulo, membros, alvo_membro_id } = req.body || {};
  if (!['aviso', 'teste', 'escalado', 'ausencia', 'troca'].includes(tipo)) return res.status(400).json({ error: 'Tipo inválido' });

  // ── Autorização + alvo + conteúdo, por tipo ──
  let alvoMembros = null;        // array de membro_id, ou null = TODOS (só aviso)
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
  }

  // ── Resolve membros → user_ids → inscrições ──
  let subsUrl = `acolitos_push_subs?select=endpoint,p256dh,auth`;
  if (Array.isArray(alvoMembros)) {
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
  const url = (tipo === 'aviso' || tipo === 'teste') ? '/projetos/acolitos/index.html' : URLBASE_MEMBRO;
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
