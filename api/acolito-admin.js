import bonusHandler from './_bonus.js';
import {rotina as rotinaJornada} from './_bonus-rotina.js';
import jornadaHandler from './_jornada.js';
import quizHandler from './_quiz.js';
import { createHash, randomBytes } from 'node:crypto';
// Vercel serverless — Gestão de Acessos (admin do módulo Acólitos).
// Ações: create (criar conta+vincular membro), password (resetar), username (trocar).
// Exige que o chamador seja coord_admin/subadmin no módulo acolitos. Usa service key.
const DOMINIO = '@coroinhas.jcbplimeira.com.br';
const hash = (value) => createHash('sha256').update(value).digest('hex');

async function resetRest(URL, key, path, options = {}) {
  const response = await fetch(`${URL}/rest/v1/${path}`, {
    ...options,
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${text.slice(0, 240)}`);
  return text ? JSON.parse(text) : null;
}

function resetNumero(value) {
  let n = String(value || '').replace(/\D/g, '').replace(/^0+/, '');
  if (n.length === 10 || n.length === 11) n = '55' + n;
  if (n.length === 12 && n.startsWith('55') && /[6-9]/.test(n[4])) n = n.slice(0, 4) + '9' + n.slice(4);
  return /^55\d{2}9\d{8}$/.test(n) ? n : null;
}

function resetNumeroMembro(m) {
  const pessoal = resetNumero(m.telefone);
  const responsavel = resetNumero(m.celular_recado) || resetNumero(m.celular_responsavel) || resetNumero(m.celular_mae);
  const cerimonario = ['cerimoniario_aspirante', 'cerimoniario_guardiao', 'cerimoniario_magistral', 'cerimoniario_mor'].includes(m.nivel);
  const nascimento = m.data_nascimento && new Date(m.data_nascimento + 'T12:00:00-03:00');
  const idade = nascimento ? Math.floor((Date.now() - nascimento.getTime()) / 31_556_952_000) : null;
  if (cerimonario && pessoal) return pessoal;
  return idade == null || idade < 18 ? responsavel || pessoal : pessoal || responsavel;
}

async function pedirRedefinicao(req, res, URL, KEY) {
  const usuario = String(req.body?.usuario || '').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 60);
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
  const ipHash = hash(`${KEY}:${ip}`);
  const agora = new Date();
  const umaHora = new Date(agora.getTime() - 60 * 60 * 1000).toISOString();
  const resposta = { ok: true, mensagem: 'Se a conta estiver ativa e tiver um WhatsApp cadastrado, enviaremos um link seguro em instantes.' };
  try {
    const porIp = await resetRest(URL, KEY, `acolitos_password_resets?select=id&ip_hash=eq.${ipHash}&created_at=gte.${encodeURIComponent(umaHora)}&limit=4`);
    if (porIp.length >= 3) return res.status(200).setHeader('Cache-Control', 'no-store').json(resposta);
    const trilha = { ip_hash: ipHash, user_id: null };
    let membro = null;
    if (usuario) {
      const logins = await resetRest(URL, KEY, `acolitos_logins?select=membro_id&usuario=eq.${encodeURIComponent(usuario)}&limit=1`);
      const authMap = logins?.[0]?.membro_id ? null : await resetRest(URL, KEY, 'rpc/acolitos_membro_por_usuario', {
        method: 'POST', body: JSON.stringify({ p_usuario: usuario }),
      });
      const membroId = logins?.[0]?.membro_id || authMap?.[0]?.membro_id;
      if (membroId) {
        const membros = await resetRest(URL, KEY, `acolitos_membros?select=id,user_id,nome,apelido,nivel,status,data_nascimento,telefone,celular_recado,celular_responsavel,celular_mae&id=eq.${membroId}&limit=1`);
        membro = membros?.[0] || null;
      }
    }
    if (!membro?.user_id || membro.status !== 'ativo') {
      await resetRest(URL, KEY, 'acolitos_password_resets', { method: 'POST', body: JSON.stringify(trilha), headers: { Prefer: 'return=minimal' } });
      return res.status(200).setHeader('Cache-Control', 'no-store').json(resposta);
    }
    trilha.user_id = membro.user_id;
    const porUsuario = await resetRest(URL, KEY, `acolitos_password_resets?select=id&user_id=eq.${membro.user_id}&created_at=gte.${encodeURIComponent(umaHora)}&limit=3`);
    if (porUsuario.length >= 2) {
      await resetRest(URL, KEY, 'acolitos_password_resets', { method: 'POST', body: JSON.stringify(trilha), headers: { Prefer: 'return=minimal' } });
      return res.status(200).setHeader('Cache-Control', 'no-store').json(resposta);
    }
    const numero = resetNumeroMembro(membro);
    if (!numero) {
      await resetRest(URL, KEY, 'acolitos_password_resets', { method: 'POST', body: JSON.stringify(trilha), headers: { Prefer: 'return=minimal' } });
      return res.status(200).setHeader('Cache-Control', 'no-store').json(resposta);
    }
    const token = randomBytes(32).toString('base64url');
    const tokenHash = hash(token);
    await resetRest(URL, KEY, `acolitos_password_resets?user_id=eq.${membro.user_id}&consumed_at=is.null&revoked_at=is.null`, {
      method: 'PATCH', body: JSON.stringify({ revoked_at: agora.toISOString() }), headers: { Prefer: 'return=minimal' },
    });
    await resetRest(URL, KEY, 'acolitos_password_resets', {
      method: 'POST', body: JSON.stringify({ ...trilha, token_hash: tokenHash, expires_at: new Date(agora.getTime() + 15 * 60 * 1000).toISOString() }),
      headers: { Prefer: 'return=minimal' },
    });
    const primeiroNome = membro.apelido || membro.nome.split(/\s+/)[0];
    await resetRest(URL, KEY, 'tarcisio_envios', {
      method: 'POST', body: JSON.stringify({ tipo: 'aviso', estado: 'pendente', destino_numero: numero, destino_nome: membro.nome,
        membro_id: membro.id, agendado_para: agora.toISOString(), chave_unica: `senha-reset:${tokenHash}`,
        texto: `Oi, ${primeiroNome}! Este é seu link seguro para redefinir a senha do app São Tarcísio: https://coroinhas.jcbplimeira.com.br/projetos/acolitos/login.html?redefinir=${token}\n\nO link vale por 15 minutos e só pode ser usado uma vez. Não encaminhe esta mensagem.` }),
      headers: { Prefer: 'return=minimal' },
    });
  } catch (error) {
    console.error('Falha ao solicitar redefinição de senha:', error?.message || 'erro desconhecido');
  }
  return res.status(200).setHeader('Cache-Control', 'no-store').json(resposta);
}

async function confirmarRedefinicao(req, res, URL, KEY) {
  const token = String(req.body?.token || '');
  const password = String(req.body?.password || '');
  if (!/^[A-Za-z0-9_-]{40,50}$/.test(token)) return res.status(400).setHeader('Cache-Control', 'no-store').json({ error: 'Este link expirou ou já foi usado. Solicite outro.' });
  if (password.length < 10 || password.length > 128 || !password.trim()) return res.status(400).setHeader('Cache-Control', 'no-store').json({ error: 'Crie uma senha com pelo menos 10 caracteres.' });
  const tokenHash = hash(token);
  const agora = new Date().toISOString();
  try {
    const rows = await resetRest(URL, KEY, `acolitos_password_resets?select=id,user_id&token_hash=eq.${tokenHash}&expires_at=gt.${encodeURIComponent(agora)}&consumed_at=is.null&revoked_at=is.null&limit=1`);
    const reset = rows?.[0];
    if (!reset?.user_id) return res.status(400).setHeader('Cache-Control', 'no-store').json({ error: 'Este link expirou ou já foi usado. Solicite outro.' });
    const claimed = await resetRest(URL, KEY, `acolitos_password_resets?id=eq.${reset.id}&consumed_at=is.null&revoked_at=is.null&expires_at=gt.${encodeURIComponent(agora)}`, {
      method: 'PATCH', body: JSON.stringify({ consumed_at: agora }), headers: { Prefer: 'return=representation' },
    });
    if (!claimed?.length) return res.status(400).setHeader('Cache-Control', 'no-store').json({ error: 'Este link expirou ou já foi usado. Solicite outro.' });
    const update = await fetch(`${URL}/auth/v1/admin/users/${reset.user_id}`, {
      method: 'PUT', headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (!update.ok) {
      await resetRest(URL, KEY, `acolitos_password_resets?id=eq.${reset.id}&token_hash=eq.${tokenHash}`, {
        method: 'PATCH', body: JSON.stringify({ consumed_at: null }), headers: { Prefer: 'return=minimal' },
      }).catch(() => {});
      return res.status(502).setHeader('Cache-Control', 'no-store').json({ error: 'Não foi possível trocar a senha. Tente novamente ou fale com a coordenação.' });
    }
    return res.status(200).setHeader('Cache-Control', 'no-store').json({ ok: true, mensagem: 'Senha atualizada. Agora entre no app com seu usuário e a senha nova.' });
  } catch (error) {
    console.error('Falha ao confirmar redefinição de senha:', error?.message || 'erro desconhecido');
    return res.status(500).setHeader('Cache-Control', 'no-store').json({ error: 'Não foi possível trocar a senha agora. Tente novamente.' });
  }
}

function synthEmail(u) {
  const c = String(u || '').trim().toLowerCase();
  if (c.includes('@')) return c;
  return c.replace(/[^a-z0-9._-]/g, '') + DOMINIO;
}

export default async function handler(req, res) {
  if (req.method==='GET' && req.query?.action==='jornada_rotina') return rotinaJornada(req,res);
  if (typeof req.body?.action==='string' && req.body.action.startsWith('bonus_')) return bonusHandler(req,res);
  if (typeof req.body?.action === 'string' && req.body.action.startsWith('jornada_')) return jornadaHandler(req, res);
  if (typeof req.body?.action === 'string' && req.body.action.startsWith('quiz_')) return quizHandler(req, res);
  if (req.method !== 'POST') return res.status(405).end();
  const URL = process.env.SUPABASE_URL;
  const ANON = process.env.SUPABASE_ANON_KEY;
  const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL || !ANON || !SRK) return res.status(500).json({ error: 'Server misconfigured' });

  if (req.body?.action === 'password_reset_request') return pedirRedefinicao(req, res, URL, SRK);
  if (req.body?.action === 'password_reset_confirm') return confirmarRedefinicao(req, res, URL, SRK);

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

  // Anexa um aviso (mostrado ao membro no próximo acesso) ao membro do user alvo
  async function addAviso(targetUid, aviso) {
    try {
      const r = await fetch(`${URL}/rest/v1/acolitos_membros?user_id=eq.${targetUid}&select=id,avisos`, { headers: h });
      const m = (await r.json())[0]; if (!m) return;
      const novos = Array.isArray(m.avisos) ? m.avisos : [];
      novos.push(aviso);
      await fetch(`${URL}/rest/v1/acolitos_membros?id=eq.${m.id}`, { method: 'PATCH', headers: { ...jh, Prefer: 'return=minimal' }, body: JSON.stringify({ avisos: novos }) });
    } catch (e) { /* aviso é best-effort */ }
  }
  const SESSAO_MSG = ' Guarde esses dados, pois sua sessão será encerrada e você voltará à tela de login para usar os dados corretos. Após acessar novamente você pode alterar qualquer informação.';

  const { action, user_id, usuario, password, nome, membro_id, role } = req.body || {};
  const jh = { ...h, 'Content-Type': 'application/json' };

  if (action === 'create') {
    if (!usuario || !password) return res.status(400).json({ error: 'Usuário e senha obrigatórios.' });
    const cr = await fetch(`${URL}/auth/v1/admin/users`, { method: 'POST', headers: jh, body: JSON.stringify({ email: synthEmail(usuario), password, email_confirm: true, user_metadata: { nome: nome || usuario } }) });
    const cd = await cr.json();
    if (!cr.ok) { const ja = /registered|already|exists/i.test(cd.msg || cd.message || ''); return res.status(cr.status).json({ error: ja ? 'Esse usuário já existe.' : (cd.msg || cd.message || 'Erro ao criar.') }); }
    const newUid = cd.id;
    let role = 'novo';
    if (membro_id) {
      await fetch(`${URL}/rest/v1/acolitos_membros?id=eq.${membro_id}`, { method: 'PATCH', headers: { ...jh, Prefer: 'return=minimal' }, body: JSON.stringify({ user_id: newUid }) });
      // Membro já existente (com nível) recebe o PAPEL REAL — senão fica preso na tela de integração (role 'novo')
      const mr = await fetch(`${URL}/rest/v1/acolitos_membros?id=eq.${membro_id}&select=nivel`, { headers: h });
      const nivel = ((await mr.json())[0] || {}).nivel || '';
      if (nivel) role = nivel.startsWith('cerimoniario') ? 'cerimonario'
                       : (nivel.startsWith('acolito') || nivel === 'aspirante_cerimoniario') ? 'acolito'
                       : nivel === 'coroinha' ? 'coroinha' : 'aspirante';
    }
    await fetch(`${URL}/rest/v1/pastoral_members`, { method: 'POST', headers: { ...jh, Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ user_id: newUid, module_id: mod.id, role }) });
    return res.status(200).json({ ok: true, user_id: newUid, email: synthEmail(usuario) });
  }

  // Ligar uma conta que JÁ existe a uma ficha que JÁ existe. É o desfecho da fila de
  // "cadastros barrados": a pessoa criou conta, o app reconheceu o nome mas a prova não
  // bateu (data de nascimento errada na ficha, mãe com outro nome), e a coordenação
  // confirmou por fora que é a mesma pessoa. Sem esta ação, o único jeito seria criar
  // uma conta nova para quem já tem uma.
  if (action === 'vincular') {
    if (!membro_id || !user_id) return res.status(400).json({ error: 'Faltam dados.' });
    const mr = await fetch(`${URL}/rest/v1/acolitos_membros?id=eq.${membro_id}&select=id,nome,nivel,user_id`, { headers: h });
    const alvo = (await mr.json())[0];
    if (!alvo) return res.status(404).json({ error: 'Ficha não encontrada.' });
    if (alvo.user_id && alvo.user_id !== user_id) return res.status(409).json({ error: 'Essa ficha já está ligada a outra conta.' });
    const outro = await fetch(`${URL}/rest/v1/acolitos_membros?user_id=eq.${user_id}&select=id&id=neq.${membro_id}`, { headers: h });
    if ((await outro.json()).length) return res.status(409).json({ error: 'Essa conta já está ligada a outra pessoa.' });
    await fetch(`${URL}/rest/v1/acolitos_membros?id=eq.${membro_id}`, { method: 'PATCH', headers: { ...jh, Prefer: 'return=minimal' }, body: JSON.stringify({ user_id }) });
    const nv = alvo.nivel || '';
    const papel = nv.startsWith('cerimoniario') ? 'cerimonario'
      : (nv.startsWith('acolito') || nv === 'aspirante_cerimoniario') ? 'acolito'
      : nv === 'coroinha' ? 'coroinha' : nv === 'aspirante' ? 'aspirante' : 'novo';
    await fetch(`${URL}/rest/v1/pastoral_members`, { method: 'POST', headers: { ...jh, Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ user_id, module_id: mod.id, role: papel }) });
    return res.status(200).json({ ok: true, nome: alvo.nome, papel });
  }

  if (action === 'get') {
    if (!user_id) return res.status(400).json({ error: 'Faltam dados.' });
    const r = await fetch(`${URL}/auth/v1/admin/users/${user_id}`, { headers: h });
    const d = await r.json(); if (!r.ok) return res.status(r.status).json({ error: 'Erro ao consultar.' });
    const email = d.email || '';
    const usuario = email.includes('@coroinhas.') ? email.split('@')[0] : email;
    return res.status(200).json({ ok: true, email, usuario });
  }

  if (action === 'sync_role') {
    const ALLOWED = ['membro_equipe', 'cerimonario', 'acolito', 'coroinha', 'aspirante'];
    if (!user_id || !ALLOWED.includes(role)) return res.status(400).json({ error: 'Dados inválidos.' });
    if (!(await podeMexer(user_id))) return res.status(403).json({ error: 'Sem permissão sobre este usuário.' });
    await fetch(`${URL}/rest/v1/pastoral_members?user_id=eq.${user_id}&module_id=eq.${mod.id}`, { method: 'PATCH', headers: { ...jh, Prefer: 'return=minimal' }, body: JSON.stringify({ role }) });
    return res.status(200).json({ ok: true });
  }

  if (action === 'password') {
    if (!user_id || !password) return res.status(400).json({ error: 'Faltam dados.' });
    if (String(password).length < 6) return res.status(400).json({ error: 'Senha muito curta.' });
    if (!(await podeMexer(user_id))) return res.status(403).json({ error: 'Sem permissão sobre este usuário.' });
    const r = await fetch(`${URL}/auth/v1/admin/users/${user_id}`, { method: 'PUT', headers: jh, body: JSON.stringify({ password }) });
    const d = await r.json(); if (!r.ok) return res.status(r.status).json({ error: d.msg || d.message || 'Erro' });
    await addAviso(user_id, { msg: 'Sua senha foi redefinida pela coordenação. Por segurança, ela não é exibida neste aviso. Se você não recebeu a orientação em particular, peça ajuda à coordenação.', logout: true, seen: false, ts: Date.now() });
    return res.status(200).json({ ok: true });
  }

  if (action === 'username') {
    if (!user_id || !usuario) return res.status(400).json({ error: 'Faltam dados.' });
    if (!(await podeMexer(user_id))) return res.status(403).json({ error: 'Sem permissão sobre este usuário.' });
    const novoUser = synthEmail(usuario).includes('@coroinhas.') ? synthEmail(usuario).split('@')[0] : usuario;
    const r = await fetch(`${URL}/auth/v1/admin/users/${user_id}`, { method: 'PUT', headers: jh, body: JSON.stringify({ email: synthEmail(usuario), email_confirm: true }) });
    const d = await r.json(); if (!r.ok) { const ja = /registered|already|exists/i.test(d.msg || d.message || ''); return res.status(r.status).json({ error: ja ? 'Usuário já em uso.' : (d.msg || d.message || 'Erro') }); }
    await addAviso(user_id, { msg: 'Seu usuário (login) foi alterado para: ' + novoUser + '.' + SESSAO_MSG, logout: true, seen: false, ts: Date.now() });
    return res.status(200).json({ ok: true });
  }

  if (action === 'reject') {
    if (!membro_id) return res.status(400).json({ error: 'Faltam dados.' });
    const mr = await fetch(`${URL}/rest/v1/acolitos_membros?id=eq.${membro_id}&select=user_id`, { headers: h });
    const mrow = (await mr.json())[0];
    if (!mrow) return res.status(404).json({ error: 'Cadastro não encontrado.' });
    const targetUid = mrow.user_id || null;
    if (targetUid && !(await podeMexer(targetUid))) return res.status(403).json({ error: 'Sem permissão sobre este usuário.' });
    if (targetUid) await fetch(`${URL}/rest/v1/pastoral_members?user_id=eq.${targetUid}&module_id=eq.${mod.id}`, { method: 'DELETE', headers: h }).catch(() => {});
    const dm = await fetch(`${URL}/rest/v1/acolitos_membros?id=eq.${membro_id}`, { method: 'DELETE', headers: h });
    if (!dm.ok) { const dd = await dm.json().catch(() => ({})); return res.status(400).json({ error: dd.message || 'Não foi possível apagar (pode estar vinculado em escalas).' }); }
    if (targetUid) await fetch(`${URL}/auth/v1/admin/users/${targetUid}`, { method: 'DELETE', headers: h }).catch(() => {});
    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ error: 'Ação inválida' });
}
