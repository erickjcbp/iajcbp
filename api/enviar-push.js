// api/enviar-push.js — envia push (F1: tipo 'aviso' p/ todos). Só coordenação.
import webpush from 'web-push';

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
  const mod = (await (await fetch(`${URL}/rest/v1/pastoral_modules?slug=eq.acolitos&select=id`, { headers: h })).json())[0];
  if (!mod) return res.status(500).json({ error: 'Módulo não encontrado' });
  const role = (await (await fetch(`${URL}/rest/v1/pastoral_members?user_id=eq.${caller.id}&module_id=eq.${mod.id}&select=role`, { headers: h })).json())[0]?.role;

  const { tipo, texto, titulo, membros } = req.body || {};
  // 'aviso' = comunicado da coordenação; 'teste' = título/texto livres (preview dos gatilhos da F2)
  if (!['aviso', 'teste'].includes(tipo)) return res.status(400).json({ error: 'Tipo inválido' });
  if (!['coord_admin', 'subadmin'].includes(role)) return res.status(403).json({ error: 'Acesso negado' });
  const msg = String(texto || '').trim();
  if (!msg) return res.status(400).json({ error: 'Texto vazio' });
  const title = tipo === 'teste' ? (String(titulo || '').trim() || 'Notificação') : 'Aviso da coordenação';

  // Alvo: se vier `membros` (lista de membro_id), manda só p/ eles; senão, TODOS os inscritos.
  let subsUrl = `${URL}/rest/v1/acolitos_push_subs?select=endpoint,p256dh,auth`;
  if (Array.isArray(membros) && membros.length) {
    const ids = membros.filter((x) => typeof x === 'string').slice(0, 500).map(encodeURIComponent).join(',');
    const mrows = await (await fetch(`${URL}/rest/v1/acolitos_membros?id=in.(${ids})&select=user_id`, { headers: h })).json();
    const uids = [...new Set((Array.isArray(mrows) ? mrows : []).map((r) => r.user_id).filter(Boolean))];
    if (!uids.length) return res.status(200).json({ ok: true, enviados: 0, removidos: 0, semInscritos: true });
    subsUrl += `&user_id=in.(${uids.map(encodeURIComponent).join(',')})`;
  }
  const subs = await (await fetch(subsUrl, { headers: h })).json();
  webpush.setVapidDetails(VSUB, VPUB, VPRIV);
  // tag única por envio → cada notificação aparece separada e RE-ALERTA (som), sem colapsar numa só
  const tag = tipo + '-' + Date.now() + '-' + Math.round(Math.random() * 1e6);
  const payload = JSON.stringify({ title, body: msg.slice(0, 180), url: '/projetos/acolitos/index.html', tag, renotify: true });

  let enviados = 0, removidos = 0;
  await Promise.all((subs || []).map(async (s) => {
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
