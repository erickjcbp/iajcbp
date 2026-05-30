// Vercel serverless function — remove usuário do Supabase Auth
// Service key fica SOMENTE aqui (variável de ambiente no Vercel), nunca no browser.

export default async function handler(req, res) {
  if (req.method !== 'DELETE') return res.status(405).end();

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  // 1. Valida o JWT do chamador
  const callerToken = (req.headers.authorization || '').replace('Bearer ', '');
  if (!callerToken) return res.status(401).json({ error: 'Token ausente' });

  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${callerToken}`
    }
  });
  if (!userRes.ok) return res.status(401).json({ error: 'Token inválido' });
  const callerUser = await userRes.json();

  // 2. Verifica que o chamador tem role 'admin'
  const profileRes = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${callerUser.id}&select=role`,
    {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${callerToken}`
      }
    }
  );
  const profiles = await profileRes.json();
  if (!profiles?.[0] || profiles[0].role !== 'admin') {
    return res.status(403).json({ error: 'Acesso negado' });
  }

  // 3. Impede que o admin se auto-exclua
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId obrigatório' });
  if (userId === callerUser.id) {
    return res.status(400).json({ error: 'Não é possível excluir o próprio usuário' });
  }

  // 4. Exclui com service key (server-side)
  const deleteRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    method: 'DELETE',
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
    }
  });

  if (!deleteRes.ok) {
    const result = await deleteRes.json().catch(() => ({}));
    return res.status(deleteRes.status).json({ error: result.msg || 'Erro ao excluir usuário' });
  }

  return res.status(200).json({ ok: true });
}
