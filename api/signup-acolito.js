// Vercel serverless — auto-cadastro do Acólito por USUÁRIO (conta já confirmada).
// Público (a aprovação do admin no CRM é a trava). Usa a service role key.
import { podeCadastrar } from './_limite-cadastro.js';

const DOMINIO = '@coroinhas.jcbplimeira.com.br';

// Cadastro público: o e-mail é SEMPRE o sintético. Aceitar um '@' digitado deixava qualquer
// um criar conta já confirmada com o e-mail de outra pessoa, sem provar que é dono dele.
function synthEmail(u) {
  const c = String(u || '').trim().toLowerCase().split('@')[0];
  return c.replace(/[^a-z0-9._-]/g, '').slice(0, 60) + DOMINIO;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const URL = process.env.SUPABASE_URL;
  const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL || !SRK) return res.status(500).json({ error: 'Server misconfigured' });

  if (!(await podeCadastrar({ URL, SRK, req }))) return res.status(429).json({ error: 'Muitos cadastros deste endereço. Tente novamente em uma hora ou fale com a coordenação.' });

  const { usuario, password, nome } = req.body || {};
  if (!usuario || !password) return res.status(400).json({ error: 'Usuário e senha são obrigatórios.' });
  if (String(password).length < 6) return res.status(400).json({ error: 'A senha deve ter ao menos 6 caracteres.' });

  const email = synthEmail(usuario);
  if (email === DOMINIO) return res.status(400).json({ error: 'Usuário inválido.' });
  const r = await fetch(`${URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { nome: nome || usuario } })
  });
  const data = await r.json();
  if (!r.ok) {
    const ja = /registered|already|exists/i.test(data.msg || data.message || data.error_code || '');
    return res.status(r.status).json({ error: ja ? 'Esse usuário já existe.' : (data.msg || data.message || 'Erro ao criar conta.') });
  }
  return res.status(200).json({ ok: true, email });
}
