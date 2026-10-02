// Cria o acesso de pessoas da EQUIPE que NÃO servem no altar (serve=false), uma a uma.
//
//   node criar-logins/equipe.mjs                     → modo seco (não grava nada)
//   node criar-logins/equipe.mjs --valendo           → cria de verdade
//   node criar-logins/equipe.mjs --valendo --saida entregas/acessos.json   → guarda as senhas
//
// Diferente do gerar.mjs (que dá dono a uma ficha que JÁ existe), aqui a ficha NASCE junto
// com a conta: são pessoas que nunca estiveram no cadastro dos que servem.
//   - ficha: serve=false (fora da escala, do rodízio e das contas de quem serve),
//            eh_equipe=true, com as permissões abaixo, e senha_provisória de pé;
//   - vínculo: pastoral_members com papel membro_equipe;
//   - senha: uma por pessoa (não a da folha das famílias) — o app obriga a trocar no 1º acesso.
// Para na PRIMEIRA falha e desfaz o que ficou pela metade daquela pessoa.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { gerarUsuarios } = require('../projetos/acolitos/usuario-core.js');

const PESSOAS = ['Daiane Silva', 'Leticia Aranda', 'Luana Tank', 'Michelly Keller', 'Sandra Mello', 'Edilaine Nunes'];
// Retiros = a aba nova; Tesouraria = o caixa. Nada de Membros/Escala/Caixa de Aprovações:
// quem organiza retiro não precisa ver os dados das crianças nem aprovar troca de escala.
const PERMISSOES = ['retiros', 'tesouraria'];
const DOMINIO = '@coroinhas.jcbplimeira.com.br';
const VALENDO = process.argv.includes('--valendo');
const SAIDA = process.argv.includes('--saida') ? process.argv[process.argv.indexOf('--saida') + 1] : null;

const env = {};
for (const linha of fs.readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
  const m = /^([A-Z_]+)=(.*)$/.exec(linha.trim());
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const URL_ = env.SUPABASE_URL, SRK = env.SUPABASE_SERVICE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !SRK) { console.error('Faltou SUPABASE_URL ou a chave de serviço no .env'); process.exit(1); }
const h = { apikey: SRK, Authorization: `Bearer ${SRK}`, 'Content-Type': 'application/json' };
const j = async (u, o) => { const r = await fetch(u, o); const t = await r.text(); let d = null; try { d = t ? JSON.parse(t) : null; } catch (e) {} return { ok: r.ok, status: r.status, d }; };

// Senha legível por telefone: sem 0/O/1/l/I. Dois blocos de 4 + um número.
const ALFA = 'abcdefghijkmnpqrstuvwxyz23456789';
const bloco = (n) => Array.from(crypto.randomBytes(n), (b) => ALFA[b % ALFA.length]).join('');
const novaSenha = () => `${bloco(4)}-${bloco(4)}`;

const existentes = [];
for (let pag = 1; pag <= 40; pag++) {
  const r = await j(`${URL_}/auth/v1/admin/users?page=${pag}&per_page=200`, { headers: h });
  const us = (r.d && r.d.users) || [];
  us.forEach((u) => existentes.push(String(u.email || '').split('@')[0].toLowerCase()));
  if (us.length < 200) break;
}
// Ficha com o mesmo nome? Não cria em cima: pode ser alguém que JÁ está no cadastro.
const rf = await j(`${URL_}/rest/v1/acolitos_membros?select=id,nome,user_id&limit=2000`, { headers: h });
if (!rf.ok) { console.error('Não consegui ler o cadastro:', rf.status, rf.d); process.exit(1); }
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const jaTem = (nome) => rf.d.filter((m) => norm(m.nome) === norm(nome));

const rmod = await j(`${URL_}/rest/v1/pastoral_modules?slug=eq.acolitos&select=id`, { headers: h });
const MODULO = rmod.ok && rmod.d && rmod.d[0] ? rmod.d[0].id : null;
if (!MODULO) { console.error('Módulo acólitos não encontrado.'); process.exit(1); }

const usuarios = gerarUsuarios(PESSOAS.map((nome) => ({ nome })), existentes);
const linhas = usuarios.map((u) => ({ nome: u.nome, usuario: u.usuario, senha: novaSenha() }));

console.log(`\n${VALENDO ? '⚠  VALENDO — vai criar contas de verdade' : 'MODO SECO — nada será gravado'}\n`);
let bloqueio = false;
for (const l of linhas) {
  const dup = jaTem(l.nome);
  console.log(l.nome.padEnd(20) + l.usuario.padEnd(18) + (dup.length ? '⚠ JÁ EXISTE ficha com este nome — não vou criar' : 'ficha nova'));
  if (dup.length) bloqueio = true;
}
console.log(`\nPermissões: ${PERMISSOES.join(', ')} · papel: membro_equipe · serve: não`);
if (bloqueio) { console.log('\nParei: confira os nomes marcados acima.'); process.exit(1); }
if (!VALENDO) { console.log('\nNada foi gravado. Para criar de verdade: --valendo\n'); process.exit(0); }

const feitos = [];
for (const l of linhas) {
  const email = l.usuario + DOMINIO;
  let authId = null, fichaId = null;
  try {
    const ru = await j(`${URL_}/auth/v1/admin/users`, { method: 'POST', headers: h,
      body: JSON.stringify({ email, password: l.senha, email_confirm: true, user_metadata: { nome: l.nome } }) });
    if (!ru.ok) throw new Error('conta: ' + JSON.stringify(ru.d));
    authId = ru.d.id;

    const rm = await j(`${URL_}/rest/v1/acolitos_membros`, { method: 'POST', headers: { ...h, Prefer: 'return=representation' },
      body: JSON.stringify({ nome: l.nome, user_id: authId, status: 'ativo', comunidade: 'matriz',
        serve: false, eh_equipe: true, permissoes: PERMISSOES, senha_provisoria: true }) });
    if (!rm.ok) throw new Error('ficha: ' + JSON.stringify(rm.d));
    fichaId = rm.d[0].id;

    const rv = await j(`${URL_}/rest/v1/pastoral_members`, { method: 'POST',
      headers: { ...h, Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ user_id: authId, module_id: MODULO, role: 'membro_equipe' }) });
    if (!rv.ok) throw new Error('vínculo: ' + JSON.stringify(rv.d));
    feitos.push({ ...l, ficha_id: fichaId, user_id: authId });
    console.log('  criada: ' + l.usuario);
  } catch (e) {
    if (fichaId) await j(`${URL_}/rest/v1/acolitos_membros?id=eq.${fichaId}`, { method: 'DELETE', headers: h }).catch(() => {});
    if (authId) await j(`${URL_}/auth/v1/admin/users/${authId}`, { method: 'DELETE', headers: h }).catch(() => {});
    console.error('\nFALHOU em ' + l.nome + ' (desfeito): ' + (e.message || e));
    break;
  }
}
if (SAIDA && feitos.length) fs.writeFileSync(SAIDA, JSON.stringify(feitos, null, 2), 'utf8');
console.log(`\n${feitos.length} de ${linhas.length} criadas.${SAIDA ? ' Senhas em ' + SAIDA : ''}\n`);
if (feitos.length !== linhas.length) process.exit(1);
