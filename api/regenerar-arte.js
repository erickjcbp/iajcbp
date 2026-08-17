// Vercel serverless — dispara o workflow "Arte da Escala" (GitHub Actions).
// Só coordenação (coord_admin/subadmin no módulo acolitos). Espelha a auth de acolito-admin.js.

import { dispararArte } from './_github.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const URL = process.env.SUPABASE_URL;
  const ANON = process.env.SUPABASE_ANON_KEY;
  const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const GH_PAT = process.env.GH_PAT;
  const GH_REPO = process.env.GH_REPO; // ex.: erickjcbp/iajcbp
  if (!URL || !ANON || !SRK) return res.status(500).json({ error: 'Server misconfigured' });
  if (!GH_PAT || !GH_REPO) return res.status(500).json({ error: 'GitHub não configurado' });

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

  // 3. Manda o robô trabalhar. A tela mostra o MOTIVO da recusa, não só "falhou":
  // em 17/08/2026 o crachá venceu e a mensagem inútil custou horas de investigação.
  const gh = await dispararArte({ GH_PAT, GH_REPO, origem: 'manual' });
  if (!gh.ok) return res.status(502).json({ error: gh.motivo, detalhe: gh.detalhe });
  return res.status(202).json({ ok: true });
}
