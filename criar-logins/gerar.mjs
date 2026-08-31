// Cria o login de quem está no cadastro da pastoral e ainda não tem conta nenhuma.
//
// POR PADRÃO NÃO GRAVA NADA. Sem `--valendo` ele só imprime o que faria — é assim que a
// folha é conferida ANTES de existir uma única conta. Rodar de novo não duplica: quem já
// tem user_id é pulado.
//
//   node criar-logins/gerar.mjs                 → modo seco (não toca em nada)
//   node criar-logins/gerar.mjs --valendo       → cria de verdade
//   node criar-logins/gerar.mjs --csv arquivo   → grava a folha em CSV
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { gerarUsuarios } = require('../projetos/acolitos/usuario-core.js');
const { papelDoNivel } = require('../api/_vinculo.js');

const SENHA = 'coroinha2026';
const DOMINIO = '@coroinhas.jcbplimeira.com.br';
const VALENDO = process.argv.includes('--valendo');
const CSV = process.argv.includes('--csv') ? process.argv[process.argv.indexOf('--csv') + 1] : null;
// --marcados: em vez de "quem não tem conta", lista quem JÁ tem conta e ainda está com a
// senha da folha. É como se reimprime a folha depois — para a coordenação cobrar quem
// ficou para trás, ou quando a folha se perder. Neste modo o usuário é LIDO do login de
// verdade, nunca gerado de novo: regerar poderia dar um nome diferente do que a pessoa usa.
const MARCADOS = process.argv.includes('--marcados');

// .env do repositório — a mesma fonte que o app usa.
const env = {};
for (const linha of fs.readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
  const m = /^([A-Z_]+)=(.*)$/.exec(linha.trim());
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const URL_ = env.SUPABASE_URL;
const SRK = env.SUPABASE_SERVICE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !SRK) { console.error('Faltou SUPABASE_URL ou a chave de serviço no .env'); process.exit(1); }
const h = { apikey: SRK, Authorization: `Bearer ${SRK}`, 'Content-Type': 'application/json' };

const idade = (nasc) => {
  if (!nasc) return null;
  const d = new Date(nasc), hoje = new Date();
  let a = hoje.getFullYear() - d.getFullYear();
  const m = hoje.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < d.getDate())) a--;
  return a;
};
const COMUNIDADE = { matriz: 'Matriz', santo_antonio: 'Santo Antônio', outra: 'Outra' };
// Rótulos como a pastoral fala (os mesmos do NIVEIS no shared.js).
const NIVEL = {
  aspirante: 'Aspirante', coroinha: 'Coroinha',
  acolito_aspirante: 'Acólito Aspirante', acolito_guardiao: 'Acólito Guardião',
  acolito_sentinela: 'Acólito Sentinela', aspirante_cerimoniario: 'Aspirante a Cerimoniário',
  cerimoniario: 'Cerimoniário', cerimoniario_mor: 'Cerimoniário-Mor',
};

// O dado que faz a família bater o olho e reconhecer a linha. Responsável primeiro (é o que
// resolve as 14 "Maria" e os 8 "Miguel").
//
// Sem responsável guardado, NADA de escrever só a comunidade: quase toda a pastoral é
// "Matriz", então aquilo ocupava a coluna sem ajudar ninguém. Em 30/08/2026 eram 25 pessoas
// nessa situação — fichas que vieram da planilha só com nome e nível. Para elas vale o
// NÍVEL, que a família conhece ("meu filho é coroinha"), com a idade na frente quando a
// data de nascimento existe.
function comoReconhecer(p) {
  const resp = (p.responsavel || p.nome_mae || p.nome_pai || '').trim();
  if (resp) return resp;
  const i = idade(p.data_nascimento);
  return [i ? i + ' anos' : null, NIVEL[p.nivel] || COMUNIDADE[p.comunidade] || null]
    .filter(Boolean).join(' · ') || '—';
}

const j = async (u, o) => { const r = await fetch(u, o); const t = await r.text();
  let d = null; try { d = t ? JSON.parse(t) : null; } catch (e) {}
  return { ok: r.ok, status: r.status, d }; };

// ── quem já tem login (para não roubar um usuário de ninguém) ──
const usuariosExistentes = [];
for (let pag = 1; pag <= 40; pag++) {
  const r = await j(`${URL_}/auth/v1/admin/users?page=${pag}&per_page=200`, { headers: h });
  const lista = (r.d && r.d.users) || [];
  lista.forEach(u => usuariosExistentes.push(String(u.email || '').split('@')[0].toLowerCase()));
  if (lista.length < 200) break;
}

// ── quem está no cadastro sem conta ──
// módulo acólitos — o vínculo de cada pessoa pendura nele
const rmod = await j(`${URL_}/rest/v1/pastoral_modules?slug=eq.acolitos&select=id`, { headers: h });
const MODULO = rmod.ok && rmod.d && rmod.d[0] ? rmod.d[0].id : null;
if (!MODULO) { console.error('Módulo acólitos não encontrado.'); process.exit(1); }

const filtro = MARCADOS ? 'senha_provisoria=is.true' : 'user_id=is.null';
const rm = await j(`${URL_}/rest/v1/acolitos_membros?select=id,nome,nivel,status,comunidade,` +
  `data_nascimento,responsavel,nome_mae,nome_pai,user_id&${filtro}&status=neq.desligado&limit=2000`, { headers: h });
if (!rm.ok) { console.error('Não consegui ler o cadastro:', rm.status, rm.d); process.exit(1); }

// Ordem estável (o mesmo resultado a cada rodada) — e é a ordem da folha impressa.
const lista = rm.d.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
let comUsuario;
if (MARCADOS) {
  // o usuário sai do login que a pessoa realmente tem
  const porId = {};
  for (let pag = 1; pag <= 40; pag++) {
    const r = await j(`${URL_}/auth/v1/admin/users?page=${pag}&per_page=200`, { headers: h });
    const us = (r.d && r.d.users) || [];
    us.forEach(u => { porId[u.id] = String(u.email || '').split('@')[0]; });
    if (us.length < 200) break;
  }
  comUsuario = lista.map(p => Object.assign({}, p, { usuario: porId[p.user_id] || '(login não encontrado)' }));
} else {
  comUsuario = gerarUsuarios(lista, usuariosExistentes);
}
const semConta = lista;

console.log(`\n\x1b[1m${VALENDO ? '⚠  VALENDO — vai criar contas de verdade' : 'MODO SECO — nada será gravado'}\x1b[0m`);
console.log(MARCADOS
  ? `Contas que já existem: ${usuariosExistentes.length} · Ainda com a senha da folha: ${semConta.length}\n`
  : `Contas que já existem: ${usuariosExistentes.length} · Pessoas sem conta: ${semConta.length}\n`);
console.log('NOME'.padEnd(38) + 'QUEM RESPONDE POR ELA'.padEnd(40) + 'USUÁRIO'.padEnd(24) + 'PAPEL');
console.log('─'.repeat(112));
const linhas = [];
for (const p of comUsuario) {
  const papel = papelDoNivel(p.nivel);
  const rec = comoReconhecer(p);
  linhas.push({ nome: p.nome, reconhecer: rec, usuario: p.usuario, senha: SENHA, papel, id: p.id });
  console.log(p.nome.slice(0, 36).padEnd(38) + rec.slice(0, 38).padEnd(40) + p.usuario.padEnd(24) + papel);
}

// ── o que merece o olho de gente ──
const semUsuario = linhas.filter(l => !l.usuario);
const numerados = linhas.filter(l => /\d$/.test(l.usuario));
const semReconhecer = linhas.filter(l => l.reconhecer === '—');
const semResponsavel = comUsuario.filter(p => !(p.responsavel || p.nome_mae || p.nome_pai || '').trim());
const porPapel = linhas.reduce((a, l) => (a[l.papel] = (a[l.papel] || 0) + 1, a), {});
console.log('\n\x1b[1mO que conferir antes de valer:\x1b[0m');
console.log('  papéis que serão dados:      ', Object.entries(porPapel).map(([k, v]) => `${k}=${v}`).join(' · '));
console.log('  usuários que ganharam número:', numerados.length ? numerados.map(l => l.usuario).join(', ') : 'nenhum');
console.log('  SEM usuário gerado:          ', semUsuario.length ? semUsuario.map(l => l.nome).join(', ') : 'nenhum');
console.log('  SEM nada para reconhecer:    ', semReconhecer.length);
console.log('  sem RESPONSÁVEL guardado:    ', semResponsavel.length + ' (na folha entram pelo nível; é a mesma gente que a conferência de duplicata não consegue provar)');
console.log('  usuários repetidos entre si: ', new Set(linhas.map(l => l.usuario)).size === linhas.length ? 'nenhum ✔' : '⚠ TEM REPETIDO');

// ── A FOLHA para imprimir ─────────────────────────────────────────────────────
// Uma linha por criança, ordenada por nome, com letra separando os blocos: numa folha de
// 138 nomes, achar o seu é o trabalho de verdade. A cara é a do app — vinho e ouro, Sora
// e Lora —, e o corpo é claro porque isto se imprime.
const FOLHA = process.argv.includes('--folha') ? process.argv[process.argv.indexOf('--folha') + 1] : null;
if (FOLHA) {
  const esc = (v) => String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const hoje = new Date().toLocaleDateString('pt-BR');
  const inicial = (n) => {
    const c = String(n || '').trim().normalize('NFD').replace(/[̀-ͯ]/g, '')[0];
    return (c || '#').toUpperCase();
  };
  let letra = null;
  const corpo = linhas.map((l) => {
    const ini = inicial(l.nome);
    let sep = '';
    if (ini !== letra) { letra = ini; sep = `<tr class="letra"><td colspan="4">${esc(ini)}</td></tr>`; }
    return sep + '<tr>' +
      `<td class="nome">${esc(l.nome)}</td>` +
      `<td class="resp">${esc(l.reconhecer)}</td>` +
      `<td class="user">${esc(l.usuario)}</td>` +
      `<td class="senha">${esc(l.senha)}</td></tr>`;
  }).join('\n');

  fs.writeFileSync(FOLHA, `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>Acesso ao aplicativo — Pastoral dos Acólitos e Coroinhas</title>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=Lora:ital,wght@0,400;1,400&display=swap" rel="stylesheet">
<style>
  :root { --wine:#1a0a0e; --gold:#8a6a24; --gold-lit:#ffd97a; --gold-deep:#6b5106;
          --texto:#241f1c; --suave:#6f665c; --creme:#faf7f0; --linha:#e6e0d2; }
  @page { size: A4 portrait; margin: 16mm 13mm 15mm; }
  * { box-sizing: border-box; }
  body { margin:0; color:var(--texto); font-size:10.6px; line-height:1.5;
         font-family: Sora, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }

  /* A faixa sangra só PARA OS LADOS. Sangrando para CIMA ela passava da margem da folha
     e a impressão cortava a primeira linha — foi assim que "Pastoral dos Acólitos e
     Coroinhas" sumiu do topo. */
  .capa-band { background: radial-gradient(120% 160% at 18% 0%, #3a1520 0%, var(--wine) 70%);
    color:#fff; margin:0 -13mm 7mm; padding: 8mm 13mm 7mm; border-bottom:2px solid var(--gold); }
  .capa-band .selo { font-size:10px; letter-spacing:.2em; color:var(--gold-lit);
                     text-transform:uppercase; font-weight:600; }
  .capa-band h1 { font-size:25px; margin:4px 0 2px; font-weight:800; line-height:1.15; }
  .capa-band h1 em { font-style:normal; color:var(--gold-lit); }
  .capa-band .sub { font-family:Lora,Georgia,serif; font-style:italic; font-size:12.5px;
                    color:#dcc3b8; }

  .comoentrar { border:1.5px solid var(--gold); background:var(--creme);
                border-radius:8px; padding:10px 13px; margin-bottom:8mm; font-size:11px; line-height:1.6; }
  .comoentrar .tit { font-weight:800; color:var(--gold-deep); font-size:12.5px; margin-bottom:3px; }
  .comoentrar b { color:var(--gold-deep); }
  .comoentrar .destaque { display:inline-block; font-family:ui-monospace,Menlo,Consolas,monospace;
    background:var(--wine); color:var(--gold-lit); padding:2px 8px; border-radius:5px; font-weight:700; }

  table { width:100%; border-collapse:collapse; }
  thead { display: table-header-group; }
  th { text-align:left; background:var(--wine); color:var(--gold-lit); padding:6px 8px;
       font-size:9.4px; text-transform:uppercase; letter-spacing:.07em; font-weight:600; }
  td { padding:5px 8px; border-bottom:1px solid var(--linha); vertical-align:middle; }
  tr { break-inside: avoid; }
  tr:nth-child(even) td { background:#fbf9f4; }
  tr.letra td { background:none; border-bottom:1.5px solid var(--gold);
    color:var(--gold-deep); font-weight:800; font-size:12px; letter-spacing:.1em;
    padding:9px 8px 3px; }
  .nome { font-weight:700; width:31%; }
  .resp { color:var(--suave); width:30%; font-size:10.2px; }
  .user { font-family:ui-monospace,Menlo,Consolas,monospace; font-weight:700;
          color:var(--gold-deep); width:21%; font-size:11px; }
  .senha { font-family:ui-monospace,Menlo,Consolas,monospace; color:var(--suave); width:18%; }
</style></head><body>

<div class="capa-band">
  <div class="selo">Pastoral dos Acólitos e Coroinhas</div>
  <h1>Acesso ao <em>aplicativo</em></h1>
  <div class="sub">Paróquia Jesus Cristo Bom Pastor &middot; Limeira/SP</div>
</div>

<div class="comoentrar">
  <div class="tit">Como entrar, em quatro passos</div>
  <b>1.</b> Abra <b>coroinhas.jcbplimeira.com.br</b> no celular. &nbsp;
  <b>2.</b> Procure abaixo o <b>nome completo</b> do seu filho ou da sua filha. &nbsp;
  <b>3.</b> Digite o <b>usuário</b> da linha dele e a senha <span class="destaque">${SENHA}</span> &nbsp;
  <b>4.</b> O aplicativo vai pedir para <b>criar uma senha nova</b> — e a senha desta folha
  para de funcionar nesse momento.<br>
  <span style="color:var(--suave);">A coluna do meio diz quem responde pela criança: ela existe
  porque há nomes que se repetem. Perdeu a senha ou não conseguiu entrar? Fale com a
  coordenação no WhatsApp <b>(19) 99907-1702</b>.</span>
</div>

<table>
  <thead><tr><th>Nome</th><th>Quem responde por ela</th><th>Usuário</th><th>Senha</th></tr></thead>
  <tbody>
${corpo}
  </tbody>
</table>
</body></html>`, 'utf8');
  console.log('  folha para imprimir:', path.resolve(FOLHA));
}

if (CSV) {
  const esc = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  fs.writeFileSync(CSV, '﻿' + ['Nome,Quem responde por ela,Usuário,Senha,Papel']
    .concat(linhas.map(l => [l.nome, l.reconhecer, l.usuario, l.senha, l.papel].map(esc).join(','))).join('\n'), 'utf8');
  console.log('\n  folha em CSV:', path.resolve(CSV));
}

if (MARCADOS) { console.log('\n(modo --marcados: só leitura, nada é criado)\n'); process.exit(0); }
if (!VALENDO) { console.log('\nNada foi gravado. Para criar de verdade: --valendo\n'); process.exit(0); }

// ── VALENDO ──────────────────────────────────────────────────────────────────
// Uma pessoa por vez, e cada uma é um passo completo ou nada: se qualquer parte falhar,
// o que já foi criado PARA ELA é desfeito e o script para. Assim uma queda no meio não
// deixa meia conta de pé — e rodar de novo continua de onde parou, porque quem já tem
// user_id nem entra nesta lista.
console.log('\n\x1b[1mCriando as contas...\x1b[0m');
const feitos = [], falhas = [];
for (const l of linhas) {
  const email = l.usuario + DOMINIO;
  let authId = null;
  try {
    const ru = await j(`${URL_}/auth/v1/admin/users`, { method: 'POST', headers: h,
      body: JSON.stringify({ email, password: SENHA, email_confirm: true, user_metadata: { nome: l.nome } }) });
    if (!ru.ok) throw new Error('conta: ' + JSON.stringify(ru.d));
    authId = ru.d.id;

    // A ficha JÁ EXISTE — só ganha dono. E nasce com a marca da senha da folha de pé:
    // sem ela, 138 contas ficariam com a mesma senha e ninguém obrigado a trocar.
    const rl = await j(`${URL_}/rest/v1/acolitos_membros?id=eq.${l.id}`, { method: 'PATCH', headers: h,
      body: JSON.stringify({ user_id: authId, senha_provisoria: true }) });
    if (!rl.ok) throw new Error('ficha: ' + JSON.stringify(rl.d));

    // O papel vem do NÍVEL dela (mesma regra do _vinculo.js). Sem isto, 71 acólitas e 45
    // coroinhas entrariam como novatas, presas na tela de integração.
    const rv = await j(`${URL_}/rest/v1/pastoral_members`, { method: 'POST',
      headers: { ...h, Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ user_id: authId, module_id: MODULO, role: l.papel }) });
    if (!rv.ok) throw new Error('vínculo: ' + JSON.stringify(rv.d));

    feitos.push(l.usuario);
    process.stdout.write(`\r  ${feitos.length}/${linhas.length}  ${l.usuario.padEnd(26)}`);
  } catch (e) {
    // desfaz o que ficou pela metade PARA ESTA PESSOA (a ficha dela é antiga: só perde o dono)
    if (authId) {
      await j(`${URL_}/rest/v1/acolitos_membros?id=eq.${l.id}`, { method: 'PATCH', headers: h,
        body: JSON.stringify({ user_id: null, senha_provisoria: false }) }).catch(() => {});
      await j(`${URL_}/auth/v1/admin/users/${authId}`, { method: 'DELETE', headers: h }).catch(() => {});
    }
    falhas.push({ nome: l.nome, usuario: l.usuario, porque: String(e.message || e) });
    break;   // para na primeira falha: 137 contas certas e 1 errada é pior que parar e olhar
  }
}
console.log(`\n\n  criadas: ${feitos.length} de ${linhas.length}`);
if (falhas.length) {
  console.log('\n\x1b[31m  PAROU NA PRIMEIRA FALHA (o que ficou pela metade foi desfeito):\x1b[0m');
  falhas.forEach(f => console.log(`    ${f.nome} (${f.usuario}) — ${f.porque}`));
  console.log('\n  Conserte a causa e rode de novo: quem já foi criado não entra na lista outra vez.');
  process.exit(1);
}
console.log('  Todas com a marca de senha provisória: o app vai exigir a troca no primeiro acesso.\n');
