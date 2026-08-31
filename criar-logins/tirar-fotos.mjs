// Fotografa as telas REAIS do app para o guia das famílias.
//
// A tela da foto é a de verdade: mesmo HTML, mesmo CSS, mesmas fontes. Só a resposta do
// banco é inventada. NADA sai para a produção — o navegador só alcança o servidor local
// e as fontes do Google (que não são dado de ninguém).
//
// É irmão de projetos/acolitos/provas/abrir-tela.mjs, com três diferenças:
//   1. deixa as FONTES passarem (a prova bloqueia tudo, e a foto sairia sem a cara do app);
//   2. tira foto em tamanho de celular;
//   3. RECUSA foto de tela vazia — guia com print em branco é pior que guia sem print.
//
//   node criar-logins/tirar-fotos.mjs <pasta-de-saida>
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire('/Users/erickmartins/iajcbp/package.json');
const pup = require('puppeteer-core');
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PASTA_APP = path.join(RAIZ, 'projetos', 'acolitos');
const SAIDA = process.argv[2] || path.join(RAIZ, 'criar-logins', 'fotos');
fs.mkdirSync(SAIDA, { recursive: true });

const CHROME = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium'].find((c) => fs.existsSync(c));
if (!CHROME) { console.error('Sem Chrome.'); process.exit(1); }

// ── servidor local, só leitura, preso à raiz do repositório ──────────────────
const servidor = http.createServer((req, res) => {
  const rel = decodeURIComponent((req.url || '/').split('?')[0]);
  const arq = path.join(RAIZ, rel);
  if (!arq.startsWith(RAIZ)) { res.writeHead(403); return res.end(); }
  fs.readFile(arq, (e, corpo) => {
    if (e) { res.writeHead(404); return res.end(); }
    const ext = path.extname(arq);
    res.writeHead(200, { 'Content-Type':
      ext === '.html' ? 'text/html; charset=utf-8'
      : ext === '.js' || ext === '.mjs' ? 'text/javascript; charset=utf-8'
      : ext === '.css' ? 'text/css; charset=utf-8'
      : ext === '.json' ? 'application/json; charset=utf-8'
      : ext === '.svg' ? 'image/svg+xml'
      : ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp'
      : ext === '.wav' ? 'audio/wav' : 'application/octet-stream' });
    res.end(corpo);
  });
});
await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
const PORTA = servidor.address().port;
const nav = await pup.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });

// Tudo que foi barrado, para o fim provar que a produção não foi tocada.
const barrados = [];

/**
 * Abre uma tela com sessão de mentira e fotografa.
 *   arquivo   'index.html'
 *   nome      nome do arquivo da foto
 *   papel     { role, nivel, eh_equipe, permissoes, modo }
 *   membro    a ficha da pessoa (o que o app mostra como "eu")
 *   tabelas   resposta por tabela
 *   rpcs      resposta por função do banco
 *   passos    o que fazer antes da foto, em ordem — como no motor de provas:
 *               { chamar:'abrirSecao', args:['x'] }  chama uma função global pelo NOME
 *               { clicar:'Próximas' }                clica pelo texto, dentro do conteúdo
 *             NUNCA "rode este código": nada de new Function com texto de fora.
 *   altura    recorte (padrão: a tela inteira do celular)
 */
async function foto(o) {
  const url = `http://127.0.0.1:${PORTA}/projetos/acolitos/${o.arquivo}`;
  const original = fs.readFileSync(path.join(PASTA_APP, o.arquivo), 'utf8');
  // desliga a partida automática: quem chama init() somos nós, depois de simular a sessão
  const html = original.replace(/\ninit\(\)[^\n]*;/, '\n/* partida desligada: quem chama init() é a foto */');
  const desligou = html !== original;

  const pg = await nav.newPage();
  await pg.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await pg.setRequestInterception(true);
  pg.on('request', (r) => {
    const u = r.url();
    if (u.split('?')[0] === url) {
      return r.respond({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
    }
    if (u.startsWith('http://127.0.0.1:')) return r.continue();
    // As FONTES passam: sem elas a foto não tem a cara do app. Não são dado de ninguém.
    if (/^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(u)) return r.continue();
    barrados.push(r.method() + ' ' + u.slice(0, 60));
    return r.abort();
  });

  await pg.evaluateOnNewDocument((modo) => {
    try { localStorage.setItem('nav-mode', modo); } catch (e) {}
    const reg = { pushManager: { getSubscription: async () => null, subscribe: async () => null },
                  showNotification() {}, unregister: async () => true };
    try {
      Object.defineProperty(navigator, 'serviceWorker', { configurable: true,
        value: { controller: null, ready: Promise.resolve(reg), register: async () => reg,
                 addEventListener() {}, removeEventListener() {} } });
    } catch (e) {}
  }, o.papel.modo || 'jornada');

  await pg.goto(url, { waitUntil: 'networkidle0', timeout: 40000 });

  const resultado = await pg.evaluate(async (papel, membro, tabelas, rpcs, passos, fecharBanner, ficarNaAbertura) => {
    const ctx = { membership: { role: papel.role }, membro, conta: membro,
                  user: { id: membro.user_id, email: papel.email || 'foto@teste' } };
    // hideSplash() mora no initModulo DE VERDADE. Sem chamar aqui, a tela de abertura
    // ("SOMOS DO ALTAR") fica por cima e TODA foto sai igual — foi o que aconteceu na
    // primeira rodada, e passou pela conferência porque ela media TEXTO, não o que se vê.
    // A exceção é quando a abertura É o assunto da foto (a arte do turíbulo, para a capa).
    window.initModulo = async () => {
      try { await loadCasas(); } catch (e) {}
      if (!ficarNaAbertura) { try { hideSplash(); } catch (e) {} }
      return ctx;
    };

    const ok = (d) => ({ data: d, error: null, count: Array.isArray(d) ? d.length : 0 });
    const respostaDe = (t) => (tabelas[t] ? ok(tabelas[t]) : ok([]));
    const cadeia = (t) => { const c = new Proxy({}, { get: (_a, k) => {
      if (k === 'then') return (f) => Promise.resolve(respostaDe(t)).then(f);
      return () => c; } }); return c; };
    window.sb = window.sb || {};
    sb.from = (t) => cadeia(t);
    sb.rpc = async (n) => ok(rpcs[n] !== undefined ? rpcs[n] : []);
    sb.auth = sb.auth || {};
    sb.auth.getSession = async () => ({ data: { session: { user: ctx.user } } });

    try { await init(); } catch (e) { return { estourou: String(e).slice(0, 120) }; }
    await new Promise((s) => setTimeout(s, 700));

    // Passos NOMEADOS, como no motor de provas. Nada de executar texto: o que chega aqui
    // é o nome de uma função global ou o texto de um botão, nunca código.
    const falhos = [];
    for (const passo of passos || []) {
      if (passo.chamar) {
        const fn = window[passo.chamar];
        if (typeof fn !== 'function') { falhos.push('não existe ' + passo.chamar); continue; }
        try { await fn.apply(null, passo.args || []); } catch (e) { falhos.push(passo.chamar + ' estourou'); }
      } else if (passo.clicar) {
        const dentro = document.getElementById('main-content') || document.body;
        const cands = [...dentro.querySelectorAll('button,a')];
        const b = cands.find((x) => x.textContent.trim() === passo.clicar)
               || cands.find((x) => x.textContent.includes(passo.clicar));
        if (!b) { falhos.push('não achei "' + passo.clicar + '"'); continue; }
        b.click();
      }
      await new Promise((s) => setTimeout(s, 400));
    }
    await new Promise((s) => setTimeout(s, 500));

    // hideSplash respeita um tempo mínimo de exibição e ainda leva 700ms sumindo.
    // Medir antes disso fotografaria a abertura de novo.
    if (!ficarNaAbertura) { try { hideSplash(); } catch (e) {} }
    // O convite de instalar é um balão flutuante que tapa o rodapé. Ele tem a sua própria
    // página no guia; nas outras fotos ele só atrapalha.
    if (fecharBanner) { const b = document.getElementById('pwa-banner'); if (b) b.remove(); }
    await new Promise((s) => setTimeout(s, 2600));
    const raiz = document.getElementById('main-content') || document.body;
    // A conferência olha o que está NA FRENTE, não só o texto do documento. Medir texto
    // deu "✔" para nove fotos que eram todas a mesma tela de abertura.
    const naFrente = (id) => {
      const el = document.getElementById(id);
      if (!el) return false;
      const e = getComputedStyle(el);
      return e.display !== 'none' && e.visibility !== 'hidden' && Number(e.opacity) > 0.05;
    };
    const tapando = ficarNaAbertura ? [] : ['splash', 'splash-screen', 'loading'].filter(naFrente);
    return { estourou: null, falhos, tapando, texto: (raiz.innerText || '').trim().length,
             amostra: (raiz.innerText || '').trim().slice(0, 70).replace(/\n/g, ' · ') };
  }, o.papel, o.membro, o.tabelas || {}, o.rpcs || {}, o.passos || [], o.fecharBanner !== false, !!o.ficarNaAbertura);

  const destino = path.join(SAIDA, o.nome + '.png');
  await pg.screenshot({ path: destino, clip: { x: 0, y: 0, width: 390, height: o.altura || 844 } });
  await pg.close();

  // Foto de tela vazia não entra no guia. Melhor faltar uma foto do que ensinar
  // uma tela em branco a cem famílias.
  const tapada = (resultado.tapando || []).length > 0;
  const vazia = !resultado.estourou && !o.ficarNaAbertura && resultado.texto < 60;
  const marca = resultado.estourou ? '✖ estourou'
    : tapada ? '✖ TAPADA por #' + resultado.tapando.join(', #')
    : vazia ? '✖ VAZIA' : '✔';
  const passoRuim = (resultado.falhos || []).length ? '  ⚠ passo: ' + resultado.falhos.join('; ') : '';
  console.log(`  ${marca}  ${o.nome.padEnd(22)} ${!desligou ? '(partida não desligada!) ' : ''}${resultado.estourou || resultado.amostra}${passoRuim}`);
  return { nome: o.nome, ok: !resultado.estourou && !vazia && !tapada };
}

export { foto, nav, servidor, barrados, SAIDA };
