// Vercel serverless — autosserviço da própria conta (usuário/senha).
// Opera SEMPRE sobre o uid do próprio chamador (sem IDOR possível). Usa service key
// para trocar o e-mail sintético com email_confirm (evita fluxo de confirmação).
const DOMINIO = '@coroinhas.jcbplimeira.com.br';

function synthEmail(u) {
  const c = String(u || '').trim().toLowerCase();
  if (c.includes('@')) return c;
  return c.replace(/[^a-z0-9._-]/g, '') + DOMINIO;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const URL = process.env.SUPABASE_URL;
  const ANON = process.env.SUPABASE_ANON_KEY;
  const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL || !ANON || !SRK) return res.status(500).json({ error: 'Server misconfigured' });

  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Token ausente' });

  const uRes = await fetch(`${URL}/auth/v1/user`, { headers: { apikey: ANON, Authorization: `Bearer ${token}` } });
  if (!uRes.ok) return res.status(401).json({ error: 'Token inválido' });
  const caller = await uRes.json();

  const jh = { apikey: SRK, Authorization: `Bearer ${SRK}`, 'Content-Type': 'application/json' };
  const { action, usuario, password } = req.body || {};

  if (action === 'password') {
    if (!password || String(password).length < 6) return res.status(400).json({ error: 'Senha muito curta.' });
    const r = await fetch(`${URL}/auth/v1/admin/users/${caller.id}`, { method: 'PUT', headers: jh, body: JSON.stringify({ password }) });
    const d = await r.json(); if (!r.ok) return res.status(r.status).json({ error: d.msg || d.message || 'Erro' });
    return res.status(200).json({ ok: true });
  }

  if (action === 'username') {
    if (!usuario) return res.status(400).json({ error: 'Informe o usuário.' });
    const r = await fetch(`${URL}/auth/v1/admin/users/${caller.id}`, { method: 'PUT', headers: jh, body: JSON.stringify({ email: synthEmail(usuario), email_confirm: true }) });
    const d = await r.json();
    if (!r.ok) { const ja = /registered|already|exists/i.test(d.msg || d.message || ''); return res.status(r.status).json({ error: ja ? 'Usuário já em uso.' : (d.msg || d.message || 'Erro') }); }
    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ error: 'Ação inválida' });
}
