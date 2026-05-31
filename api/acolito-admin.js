// Vercel serverless — Gestão de Acessos (admin do módulo Acólitos).
// Ações: create (criar conta+vincular membro), password (resetar), username (trocar).
// Exige que o chamador seja coord_admin/subadmin no módulo acolitos. Usa service key.
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

  // 1. Identifica o chamador
  const uRes = await fetch(`${URL}/auth/v1/user`, { headers: { apikey: ANON, Authorization: `Bearer ${token}` } });
  if (!uRes.ok) return res.status(401).json({ error: 'Token inválido' });
  const caller = await uRes.json();

  // 2. Confirma que é coord_admin/subadmin no módulo acolitos
  const h = { apikey: SRK, Authorization: `Bearer ${SRK}` };
  const modRes = await fetch(`${URL}/rest/v1/pastoral_modules?slug=eq.acolitos&select=id`, { headers: h });
  const mod = (await modRes.json())[0];
  if (!mod) return res.status(500).json({ error: 'Módulo não encontrado' });
  const pmRes = await fetch(`${URL}/rest/v1/pastoral_members?user_id=eq.${caller.id}&module_id=eq.${mod.id}&select=role`, { headers: h });
  const callerRole = (await pmRes.json())[0]?.role;
  if (!['coord_admin', 'subadmin'].includes(callerRole)) return res.status(403).json({ error: 'Acesso negado' });

  // Anti-IDOR / anti-escalonamento: só mexe em alvo do MÓDULO acolitos e com
  // privilégio MENOR que o do chamador (subadmin não mexe em coord_admin, etc.).
  const RANK = { coord_admin: 4, subadmin: 3, membro_equipe: 2, cerimonario: 1, acolito: 1, coroinha: 1, aspirante: 1, novo: 1 };
  async function podeMexer(targetUid) {
    if (!targetUid) return false;
    const tRes = await fetch(`${URL}/rest/v1/pastoral_members?user_id=eq.${targetUid}&module_id=eq.${mod.id}&select=role`, { headers: h });
    const t = (await tRes.json())[0];
    if (!t) return false; // alvo não pertence ao módulo acolitos
    return (RANK[t.role] || 0) < (RANK[callerRole] || 0);
  }

  const { action, user_id, usuario, password, nome, membro_id } = req.body || {};
  const jh = { ...h, 'Content-Type': 'application/json' };

  if (action === 'create') {
    if (!usuario || !password) return res.status(400).json({ error: 'Usuário e senha obrigatórios.' });
    const cr = await fetch(`${URL}/auth/v1/admin/users`, { method: 'POST', headers: jh, body: JSON.stringify({ email: synthEmail(usuario), password, email_confirm: true, user_metadata: { nome: nome || usuario } }) });
    const cd = await cr.json();
    if (!cr.ok) { const ja = /registered|already|exists/i.test(cd.msg || cd.message || ''); return res.status(cr.status).json({ error: ja ? 'Esse usuário já existe.' : (cd.msg || cd.message || 'Erro ao criar.') }); }
    const newUid = cd.id;
    if (membro_id) {
      await fetch(`${URL}/rest/v1/acolitos_membros?id=eq.${membro_id}`, { method: 'PATCH', headers: { ...jh, Prefer: 'return=minimal' }, body: JSON.stringify({ user_id: newUid }) });
    }
    await fetch(`${URL}/rest/v1/pastoral_members`, { method: 'POST', headers: { ...jh, Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ user_id: newUid, module_id: mod.id, role: 'novo' }) });
    return res.status(200).json({ ok: true, user_id: newUid, email: synthEmail(usuario) });
  }

  if (action === 'password') {
    if (!user_id || !password) return res.status(400).json({ error: 'Faltam dados.' });
    if (String(password).length < 6) return res.status(400).json({ error: 'Senha muito curta.' });
    if (!(await podeMexer(user_id))) return res.status(403).json({ error: 'Sem permissão sobre este usuário.' });
    const r = await fetch(`${URL}/auth/v1/admin/users/${user_id}`, { method: 'PUT', headers: jh, body: JSON.stringify({ password }) });
    const d = await r.json(); if (!r.ok) return res.status(r.status).json({ error: d.msg || d.message || 'Erro' });
    return res.status(200).json({ ok: true });
  }

  if (action === 'username') {
    if (!user_id || !usuario) return res.status(400).json({ error: 'Faltam dados.' });
    if (!(await podeMexer(user_id))) return res.status(403).json({ error: 'Sem permissão sobre este usuário.' });
    const r = await fetch(`${URL}/auth/v1/admin/users/${user_id}`, { method: 'PUT', headers: jh, body: JSON.stringify({ email: synthEmail(usuario), email_confirm: true }) });
    const d = await r.json(); if (!r.ok) { const ja = /registered|already|exists/i.test(d.msg || d.message || ''); return res.status(r.status).json({ error: ja ? 'Usuário já em uso.' : (d.msg || d.message || 'Erro') }); }
    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ error: 'Ação inválida' });
}
