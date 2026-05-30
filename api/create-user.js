// Vercel serverless function — cria usuário no Supabase Auth
// Service key fica SOMENTE aqui (variável de ambiente no Vercel), nunca no browser.
// Verifica que o chamador é admin antes de criar.

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

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

  // 2. Verifica que o chamador tem role 'admin' na tabela profiles
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

  // 3. Cria o usuário com service key (server-side)
  const { email, password, nome } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email e password obrigatórios' });

  const createRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { nome: nome || email.split('@')[0] }
    })
  });

  const result = await createRes.json();
  if (!createRes.ok) {
    return res.status(createRes.status).json({ error: result.msg || result.message || 'Erro ao criar usuário' });
  }

  return res.status(200).json({ user: result });
}
