// ── O motor das provas de tela ────────────────────────────────────────────────
//
// POR QUE ISTO EXISTE: `node --test` não abre tela nenhuma. Ele prova as regras que
// moram nos arquivos `*-core.js`, e prova bem — mas a maior parte deste app vive dentro
// de arquivos .html com o código junto, onde teste de unidade não chega. Em 17/08/2026
// uma revisão achou 6 defeitos CRÍTICOS que a suíte inteira não via: todos eram erro de
// execução (função apagada por engano) em código sintaticamente válido.
//
// E o mais importante: eles não apareceram nem quando abri a tela no navegador, porque
// eu abria SEM SESSÃO — e sem sessão o `init()` sai na primeira linha (`if (!ctx) return`)
// antes de encostar no código quebrado. "Zero erro de JavaScript" foi reportado duas vezes,
// e as duas estavam erradas.
//
// Por isso este motor faz UMA coisa que o navegador comum não faz: simula a sessão e
// chama o `init()` de verdade. Quem responde o que a tela mostra é o DOM depois disso.
//
// Não roda junto com `node --test` de propósito: precisa de Chrome, e a suíte rápida
// tem de continuar rápida. Roda por `npm run provar-telas`.

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const PASTA_ACOLITOS = path.resolve(AQUI, '..');
const RAIZ_REPO = path.resolve(PASTA_ACOLITOS, '..', '..');

// ── Chrome ───────────────────────────────────────────────────────────────────
// Usa o Chrome que a pessoa já tem: baixar um navegador só para isto seria 200 MB de
// download por máquina. Se não achar, a mensagem diz o que fazer — nada de erro obscuro.
const CAMINHOS_CHROME = [
  process.env.CHROME_PARA_PROVAS,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);

function acharChrome() {
  for (const c of CAMINHOS_CHROME) { try { if (fs.existsSync(c)) return c; } catch (e) {} }
  throw new Error(
    'Não achei o Chrome para abrir as telas.\n' +
    'Instale o Google Chrome, ou aponte o caminho:\n' +
    '  CHROME_PARA_PROVAS="/caminho/do/chrome" npm run provar-telas'
  );
}

async function carregarPuppeteer() {
  try {
    return (await import('puppeteer-core')).default;
  } catch (e) {
    throw new Error(
      'Falta a biblioteca que dirige o navegador.\n' +
      'Rode uma vez, na raiz do repositório:\n' +
      '  npm install\n' +
      '(ela é só de desenvolvimento — não vai para o site publicado)'
    );
  }
}

// ── Os papéis ────────────────────────────────────────────────────────────────
// As telas mudam de cara conforme quem entra. Provar só com admin esconde justamente o
// que costuma quebrar: a pessoa comum vendo o que não devia, ou não vendo o que devia.
export const PAPEIS = {
  membro: {
    nome: 'membro comum',
    role: 'membro', eh_equipe: false, permissoes: [], nivel: 'acolito',
    modo: 'jornada', email: 'membro@teste',
  },
  cerimonario: {
    nome: 'cerimoniário',
    role: 'cerimonario', eh_equipe: false, permissoes: [], nivel: 'cerimonario',
    modo: 'jornada', email: 'cerimo@teste',
  },
  equipe: {
    nome: 'equipe',
    role: 'membro_equipe', eh_equipe: true, permissoes: ['caixa'], nivel: 'acolito',
    modo: 'coordenacao', email: 'equipe@teste',
  },
  admin: {
    nome: 'admin',
    role: 'coord_admin', eh_equipe: true, permissoes: [], nivel: 'cerimonario',
    // e-mail de superadmin: o config.html volta para a Home sem ele (isSuperadmin lê o
    // pedaço antes do @, e a lista padrão tem 'erickmartins')
    modo: 'coordenacao', email: 'erickmartins@teste',
  },
};

// ── A sessão de provas ───────────────────────────────────────────────────────
// Um servidor e um navegador para TODAS as provas. Abrir um navegador por prova levava
// mais de um minuto no conjunto — ferramenta lenta é ferramenta que ninguém roda.
export async function iniciarProvas() {
  const pup = await carregarPuppeteer();
  const chrome = acharChrome();

  // Porta 0 = o sistema escolhe uma livre. Nunca uma porta fixa: outra janela de trabalho
  // pode estar usando a mesma, e derrubar processo alheio não é opção.
  const servidor = http.createServer((req, res) => {
    const rel = decodeURIComponent((req.url || '/').split('?')[0]);
    const arquivo = path.join(RAIZ_REPO, rel);
    if (!arquivo.startsWith(RAIZ_REPO)) { res.writeHead(403); return res.end('fora do repo'); }
    fs.readFile(arquivo, (erro, corpo) => {
      if (erro) { res.writeHead(404); return res.end('não achei'); }
      const ext = path.extname(arquivo);
      const tipo = ext === '.html' ? 'text/html; charset=utf-8'
        : ext === '.js' || ext === '.mjs' ? 'text/javascript; charset=utf-8'
        : ext === '.css' ? 'text/css; charset=utf-8'
        : ext === '.json' ? 'application/json; charset=utf-8'
        : 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': tipo });
      res.end(corpo);
    });
  });
  await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
  const porta = servidor.address().port;

  // 2 min para o Chrome subir: com a máquina carregada (outra janela fotografando telas) os 30 s
  // padrão estouravam antes de a prova começar.
  const navegador = await pup.launch({ executablePath: chrome, headless: 'new', args: ['--no-sandbox'], timeout: 120_000 });

  return {
    porta,
    abrir: (arquivo, opcoes) => abrirTela({ navegador, porta }, arquivo, opcoes),
    async encerrar() {
      await navegador.close();
      await new Promise((ok) => servidor.close(ok));
    },
  };
}

/**
 * Abre uma tela com sessão simulada e devolve o que ela MOSTRA.
 *
 * @param {string} arquivo   nome do arquivo, ex.: 'ausencias.html'
 * @param {object} opcoes
 *   papel      um item de PAPEIS (padrão: admin)
 *   config     o que cfg() deve devolver, ex.: { __funcoes:[...] }
 *   tabelas    resposta por tabela, ex.: { acolitos_membros:{ data:[...] } } ou { ...:{ error:{...} } }
 *   rpcs       resposta por função do banco, mesmo formato
 *   foto       caminho de um .png, ou { caminho, seletor }, para retratar a tela ao final
 *   largura    largura da janela em px (padrão 390; use 375 para a medida do padrão da casa)
 *   passos     o que fazer depois do init, em ordem. Cada passo é
 *                { chamar:'abrirSecao', args:['navegacao'] }  → chama a função global pelo nome
 *                { clicar:'Modelos de escala' }               → clica pelo texto, só no conteúdo
 *                { responder:'Confirmar' }                    → clica no botão do diálogo aberto
 *                { preencher:'Rótulo do campo', valor:'x' }   → escreve no campo daquele rótulo
 *                { marcar:'Texto da opção' }                  → marca o radio/checkbox do rótulo
 *                { anexar:'#seletor', arquivo:'/caminho' }    → põe o arquivo no <input type=file>
 *                { esperarTexto:'…', ate:8000 }               → espera o texto aparecer
 *                { esperarDito:'toast:Salvo', ate:8000 }      → espera a tela dizer (ver `ditos`)
 *   bancoVivo  true: as tabelas viram memória (filtros filtram, gravações mudam as linhas)
 *   falhar     { 'tabela:acao': { message } } → aquela operação responde erro
 *   dialogos   'aceitar' | 'recusar': uiConfirm/uiAlert respondem sozinhos
 *   apis       { '/api/rota': resposta } (resposta.__status simula falha)
 * @returns {Promise<object>} { texto, vazia, erros, barra, gravacoes, passosFalhos, ditos,
 *   estadoFinal (só com bancoVivo), chamadasApi }
 *   passosFalhos vem preenchido quando um passo não achou o alvo — trate como falha da
 *   prova, senão você conclui sobre uma tela que nunca chegou a abrir.
 */
async function abrirTela({ navegador, porta }, arquivo, opcoes = {}) {
  const papel = opcoes.papel || PAPEIS.admin;
  const url = 'http://127.0.0.1:' + porta + '/projetos/acolitos/' + arquivo;

  // Desliga a partida automática: quem chama o init() somos nós, DEPOIS de simular a
  // sessão. Sem isto o init roda com o banco de verdade e sem sessão — e sai na primeira
  // linha, que é justamente o buraco que este motor existe para tapar.
  // Duas formas de partida no projeto: `init();` e `init().catch(...)` (a Home).
  const original = fs.readFileSync(path.join(PASTA_ACOLITOS, arquivo), 'utf8');
  const html = original.replace(/\ninit\(\)[^\n]*;/, '\n/* partida desligada: quem chama init() é a prova */');
  if (html === original) {
    // Sem isto a tela partiria sozinha contra o banco de verdade e a prova mediria outra
    // coisa. Falhar alto é melhor do que um verde que não quer dizer nada.
    throw new Error(
      'Não consegui desligar a partida automática de ' + arquivo + '.\n' +
      'A prova espera uma linha começando em `init()` no fim do arquivo. Se a tela passou a ' +
      'partir de outro jeito, ajuste esta regra em provas/abrir-tela.mjs.'
    );
  }

  const pagina = await navegador.newPage();
  const erros = [];
  pagina.on('pageerror', (e) => erros.push(String(e).split('\n')[0]));
  pagina.on('console', (m) => {
    if (m.type() !== 'error') return;
    const texto = m.text();
    // net::ERR_FAILED é a MINHA trava cortando o que é de fora (fontes do Google, por
    // exemplo), não defeito da tela. Contar isso seria inventar defeito — e harness que
    // inventa defeito é pior do que harness nenhum: ninguém acredita mais nele.
    // Recurso local que falta continua aparecendo, porque vira 404 do servidor da prova.
    if (texto.includes('net::ERR_FAILED')) return;
    erros.push('console: ' + texto.slice(0, 140));
  });
  // Cada chamada a uma API de mentira (opcoes.apis) fica anotada com o corpo enviado, para a
  // prova contar quem foi avisado. A resposta pode ter `__status` (ex.: 500) para simular falha.
  const chamadasApi = [];
  await pagina.setRequestInterception(true);
  pagina.on('request', (r) => {
    const rota = new URL(r.url()).pathname;
    const api = opcoes.apis && opcoes.apis[rota];
    if (api) {
      let corpo = null; try { corpo = JSON.parse(r.postData() || 'null'); } catch (e) { corpo = r.postData() || null; }
      chamadasApi.push({ rota, corpo });
      const { __status, ...resposta } = api;
      return r.respond({ status: __status || 200, contentType: 'application/json', body: JSON.stringify(resposta) });
    }
    if (r.url().split('?')[0] === url) {
      return r.respond({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
    }
    // Nada sai para a internet: a prova não pode depender de rede, nem tocar no banco real.
    // A revisão visual pode carregar só as fontes originais; APIs continuam bloqueadas.
    if (opcoes.fontesReais && /^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(r.url())) return r.continue();
    if (!r.url().startsWith('http://127.0.0.1:')) return r.abort();
    r.continue();
  });
  // 390 é o padrão; `largura` existe para medir no 375 que o padrão da casa exige.
  await pagina.setViewport({ width: opcoes.largura || 390, height: opcoes.altura || 900 });
  await pagina.evaluateOnNewDocument((modo, semConvite) => {
    try { localStorage.setItem('nav-mode', modo); } catch (e) {}
    // Retrato da tela: o convite "Instale o app" cobriria o conteúdo da foto.
    if (semConvite) { try { localStorage.setItem('pwa-dismiss', '1'); } catch (e) {} }
    // Desliga o service worker DENTRO da prova. Não é frescura: o shared.js recarrega a
    // página sozinho quando um service worker novo assume (`controllerchange`), e a partir
    // da segunda tela isso derrubava a prova no meio da medição. Aqui ele não tem serventia
    // — a prova serve os arquivos do disco, sempre frescos.
    const registroFalso = {
      pushManager: { getSubscription: async () => null, subscribe: async () => null },
      showNotification() {}, unregister: async () => true,
    };
    try {
      Object.defineProperty(navigator, 'serviceWorker', {
        configurable: true,
        value: {
          controller: null,
          ready: Promise.resolve(registroFalso),
          register: async () => registroFalso,
          addEventListener() {}, removeEventListener() {},
        },
      });
    } catch (e) {}
  }, papel.modo, !!opcoes.foto);
  await pagina.goto(url, { waitUntil: 'domcontentloaded' });

  const medir = async (papel, opcoes) => {
    const membro = {
      id: 'm1', nome: 'Pessoa de Teste', apelido: 'Teste', nivel: papel.nivel,
      eh_equipe: papel.eh_equipe, permissoes: papel.permissoes, serve: true,
      user_id: 'u1', comunidade: 'matriz',
    };
    const ctxFalso = {
      membership: { role: papel.role }, membro, conta: membro,
      user: { id: 'u1', email: papel.email },
    };
    // O initModulo de VERDADE carrega o de-para casa_id → slug antes de liberar a tela
    // (é dele que o avatar tira o brasão da casa). O falso devolvia só o contexto — com
    // isso o mapa ficava vazio, `casaSlugDe` respondia null para todo mundo e NENHUMA
    // prova de tela conseguia ver um brasão: acusaria defeito num app perfeito. Falhar
    // aqui não derruba a prova, exatamente como no de verdade.
    window.initModulo = async () => { try { await loadCasas(); } catch (e) {} return ctxFalso; };

    // ── O banco de mentira ──────────────────────────────────────────────────
    // Responde POR TABELA e sabe FALHAR. Um harness que devolve sempre a mesma lista e
    // nunca erro não prova o caminho de falha — que é onde este app mais errou: consulta
    // recusada e a tela dizendo "não há nada" em vez de "não consegui perguntar".
    const ok = (d) => ({ data: d, error: null, count: Array.isArray(d) ? d.length : 0 });
    const gravacoes = [];
    // `.range(de, ate)` RECORTA de verdade. Sem isto o banco de mentira devolvia a lista
    // inteira a cada página, e o leitor paginado (paginar-core.js) pedia a página seguinte
    // para sempre — a prova travava, e pior: passaria a medir uma leitura que não pagina.
    const respostaDe = (tabela, recorte) => {
      const t = (opcoes.tabelas || {})[tabela];
      if (t && t.error) return { data: null, error: t.error, count: 0 };
      const todas = t ? (t.data || []) : [];
      // TETO DE MIL, como o PostgREST de verdade: sem paginar, uma lista maior vem CORTADA
      // e a resposta continua sendo "deu certo". Sem isto aqui, uma prova de paginação
      // passaria com a leitura não paginada — que é o defeito que ela deveria pegar.
      const TETO = 1000;
      const fatia = recorte
        ? todas.slice(recorte[0], Math.min(recorte[1] + 1, recorte[0] + TETO))
        : todas.slice(0, TETO);
      // `count` é o TOTAL, como o Supabase responde com count exato — não o da fatia.
      return { data: fatia, error: null, count: Array.isArray(todas) ? todas.length : 0 };
    };
    // ── Banco VIVO (opcoes.bancoVivo) ─────────────────────────────────────────
    // O banco acima responde sempre a mesma lista: serve para provar o que a tela MOSTRA,
    // mas não um fluxo que grava e depois lê o que gravou (subir o PDF → guardar as respostas
    // → ler de novo → gravar o mês → tirar as linhas velhas). Com bancoVivo as tabelas viram
    // memória: os filtros (eq/neq/in/gte/lte/gt/lt/is) filtram, insert/upsert/update/delete
    // mudam as linhas, e `estadoFinal` devolve as tabelas no fim. Desligado por padrão: as
    // provas antigas continuam medindo exatamente o que mediam.
    // opcoes.falhar: { 'tabela:acao': { message } } faz essa operação responder erro (acao =
    // select/insert/upsert/update/delete) — para provar o caminho de falha de cada passo.
    const vivo = opcoes.bancoVivo ? {} : null;
    if (vivo) for (const [t, v] of Object.entries(opcoes.tabelas || {})) vivo[t] = JSON.parse(JSON.stringify(v.data || []));
    let seqVivo = 0;
    const passaFiltro = (r, [f, col, v]) => f === 'eq' ? r[col] === v : f === 'neq' ? r[col] !== v
      : f === 'in' ? (v || []).includes(r[col]) : f === 'gte' ? r[col] >= v : f === 'lte' ? r[col] <= v
      : f === 'gt' ? r[col] > v : f === 'lt' ? r[col] < v : f === 'is' ? (r[col] ?? null) === v : true;
    const executarVivo = (tabela, q) => {
      const linhas = (vivo[tabela] ||= []);
      const casa = (r) => q.filtros.every((f) => passaFiltro(r, f));
      const copia = (x) => JSON.parse(JSON.stringify(x));
      if (q.mut && q.mut.acao === 'delete') {
        const fora = linhas.filter(casa); vivo[tabela] = linhas.filter((r) => !fora.includes(r));
        return { data: copia(fora), error: null, count: fora.length };
      }
      if (q.mut && q.mut.acao === 'insert') {
        const novos = [].concat(q.mut.dados).map((x) => ({ id: 'novo-' + (++seqVivo), ...x }));
        linhas.push(...novos); return { data: copia(novos), error: null, count: novos.length };
      }
      if (q.mut && q.mut.acao === 'upsert') {
        const chaves = String((q.mut.op && q.mut.op.onConflict) || 'id').split(',').map((s) => s.trim());
        const saida = [];
        for (const n of [].concat(q.mut.dados)) {
          const ja = linhas.find((r) => chaves.every((k) => r[k] === n[k]));
          if (ja) { if (!(q.mut.op && q.mut.op.ignoreDuplicates)) { Object.assign(ja, n); saida.push(ja); } }
          else { const x = { id: 'novo-' + (++seqVivo), ...n }; linhas.push(x); saida.push(x); }
        }
        return { data: copia(saida), error: null, count: saida.length };
      }
      if (q.mut && q.mut.acao === 'update') {
        const alvo = linhas.filter(casa); alvo.forEach((r) => Object.assign(r, q.mut.dados));
        return { data: copia(alvo), error: null, count: alvo.length };
      }
      let achados = linhas.filter(casa);
      for (const [col, o] of q.ordem.slice().reverse()) {
        const desc = o && o.ascending === false;
        achados = achados.slice().sort((a, b) => (a[col] < b[col] ? -1 : a[col] > b[col] ? 1 : 0) * (desc ? -1 : 1));
      }
      const total = achados.length;
      if (q.recorte) achados = achados.slice(q.recorte[0], q.recorte[1] + 1);
      if (q.limite != null) achados = achados.slice(0, q.limite);
      return { data: copia(achados), error: null, count: total };
    };
    const cadeia = (tabela) => {
      let recorte = null, umSo = false;
      const q = { filtros: [], ordem: [], limite: null, recorte: null, mut: null };
      const responder = () => {
        const acao = q.mut ? q.mut.acao : 'select';
        const erro = (opcoes.falhar || {})[tabela + ':' + acao];
        if (erro) return { data: null, error: erro, count: 0 };
        return vivo ? executarVivo(tabela, q) : respostaDe(tabela, recorte);
      };
      const c = new Proxy({}, { get: (_alvo, chave) => {
        if (chave === 'then') return (f, rej) => Promise.resolve(responder()).then((r) =>
          // `.maybeSingle()`/`.single()` devolvem a LINHA, não a lista: sem isto a tela
          // recebia um array e lia `arte.png_url` como undefined.
          umSo && !r.error ? { ...r, data: (r.data || [])[0] || null } : r).then(f, rej);
        if (chave === 'range') return (de, ate) => { recorte = [de, ate]; q.recorte = [de, ate]; return c; };
        if (chave === 'maybeSingle' || chave === 'single') return () => { umSo = true; return c; };
        if (chave === 'order') return (col, o) => { q.ordem.push([col, o]); return c; };
        if (chave === 'limit') return (n) => { q.limite = n; return c; };
        if (['eq', 'neq', 'in', 'gte', 'lte', 'gt', 'lt', 'is'].includes(chave)) {
          return (col, v) => { q.filtros.push([chave, col, v]); return c; };
        }
        // grava o que a tela MANDARIA para o banco: às vezes a tela está certa e o
        // botão de salvar é que deixa coisa de fora (foi o caso dos Modelos de escala).
        // `filtros` (o .eq/.in que veio depois) e `op` (o onConflict do upsert) vão junto:
        // "apagou" sem dizer O QUÊ não prova nada.
        if (chave === 'insert' || chave === 'upsert' || chave === 'update' || chave === 'delete') {
          return (dados, op) => {
            q.mut = { acao: chave, dados, op };
            gravacoes.push({ tabela, acao: chave, dados, op: op || null, filtros: q.filtros });
            return c;
          };
        }
        return () => c;
      } });
      return c;
    };
    window.sb = window.sb || {};
    sb.from = (tabela) => cadeia(tabela);
    sb.rpc = async (nome, args) => {
      gravacoes.push({ tabela: 'rpc:' + nome, acao: 'rpc', dados: args || null });
      const r = (opcoes.rpcs || {})[nome];
      if (r && r.error) return { data: null, error: r.error, count: 0 };
      return ok(r ? (r.data !== undefined ? r.data : []) : []);
    };

    if (opcoes.config) _APP_CONFIG = opcoes.config;
    if (opcoes.sessao) sb.auth.getSession = async () => ({ data: { session: opcoes.sessao }, error: null });

    // ── O que a tela DISSE ──────────────────────────────────────────────────
    // toast/uiAlert/uiConfirm continuam os de verdade (o modal abre e espera o clique); só
    // ficam anotados em `ditos`, como 'toast:…', 'alert:…', 'confirm:…'. Com
    // opcoes.dialogos = 'aceitar' | 'recusar' o uiConfirm responde sozinho e o uiAlert fecha
    // sozinho — para fluxos que esperam a resposta dentro de um `chamar` (ali não há como
    // clicar no meio). Sem a opção, responda com o passo { responder: 'Confirmar' }.
    const ditos = [];
    const embrulhar = (nome, marca, auto) => {
      const original = window[nome];
      if (typeof original !== 'function') return;
      window[nome] = function (msg, ...resto) {
        ditos.push(marca + ':' + msg);
        if (auto) return auto();
        return original.call(this, msg, ...resto);
      };
    };
    const modo = opcoes.dialogos;
    embrulhar('toast', 'toast');
    embrulhar('uiAlert', 'alert', modo ? () => Promise.resolve() : null);
    embrulhar('uiConfirm', 'confirm', modo ? () => Promise.resolve(modo === 'aceitar') : null);

    await init();
    await new Promise((s) => setTimeout(s, 350));

    // ── Os passos ───────────────────────────────────────────────────────────
    // Duas formas, e nenhuma delas é "rode este código": `{ chamar }` chama uma função
    // global pelo NOME, e `{ clicar }` procura um botão pelo texto DENTRO do conteúdo.
    //
    // O clique é limitado ao #main-content de propósito: procurando no documento inteiro,
    // um passo "Escala" achava o botão ESCALA da barra de navegação e saía da página no
    // meio da prova. Barra e cabeçalho não são o que a prova quer tocar.
    const passosFalhos = [];
    const dentro = () => document.getElementById('main-content') || document.body;
    for (const passo of [].concat(opcoes.passos || [])) {
      if (passo.chamar) {
        const fn = window[passo.chamar];
        if (typeof fn !== 'function') { passosFalhos.push('não existe a função ' + passo.chamar); continue; }
        try { await fn.apply(null, passo.args || []); }
        catch (e) { passosFalhos.push(passo.chamar + ' estourou: ' + String(e.message || e).slice(0, 90)); }
      } else if (passo.clicar) {
        const alvo = passo.clicar;
        const candidatos = [...dentro().querySelectorAll('button,a')];
        const botao = candidatos.find((x) => x.textContent.trim() === alvo)
          || candidatos.find((x) => x.textContent.includes(alvo));
        // Passo que não acha o alvo tem de APARECER. Passo silencioso é como nasce o verde
        // que não quer dizer nada: a prova segue e conclui sobre uma tela que nunca abriu.
        if (!botao) { passosFalhos.push('não achei o botão "' + alvo + '"'); continue; }
        botao.click();
      } else if (passo.responder) {
        // Clica num botão do diálogo aberto (uiConfirm/uiAlert): o modal mora fora do conteúdo.
        const caixa = [...document.querySelectorAll('.modal-overlay.open')].pop();
        const botao = caixa && [...caixa.querySelectorAll('button')].find((x) => x.textContent.trim() === passo.responder);
        if (!botao) { passosFalhos.push('não achei "' + passo.responder + '" num diálogo aberto'); continue; }
        botao.click();
      } else if (passo.preencher) {
        // Pelo RÓTULO que a pessoa lê: o controle é o do htmlFor, o de dentro do rótulo ou o
        // logo depois dele. Dispara input e change, como o teclado.
        const rotulo = [...dentro().querySelectorAll('label')].find((l) => l.textContent.includes(passo.preencher));
        let campo = rotulo && (rotulo.htmlFor ? document.getElementById(rotulo.htmlFor) : rotulo.querySelector('input,textarea,select'));
        if (rotulo && !campo && rotulo.nextElementSibling && /^(INPUT|TEXTAREA|SELECT)$/.test(rotulo.nextElementSibling.tagName)) campo = rotulo.nextElementSibling;
        if (!campo) { passosFalhos.push('não achei o campo "' + passo.preencher + '"'); continue; }
        campo.value = passo.valor;
        campo.dispatchEvent(new Event('input', { bubbles: true }));
        campo.dispatchEvent(new Event('change', { bubbles: true }));
      } else if (passo.marcar) {
        // Marca a opção (radio/checkbox) cujo rótulo tem este texto.
        const rotulo = [...dentro().querySelectorAll('label')].find((l) => l.textContent.trim() === passo.marcar)
          || [...dentro().querySelectorAll('label')].find((l) => l.textContent.includes(passo.marcar));
        const opcao = rotulo && (rotulo.htmlFor ? document.getElementById(rotulo.htmlFor) : rotulo.querySelector('input'));
        if (!opcao) { passosFalhos.push('não achei a opção "' + passo.marcar + '"'); continue; }
        opcao.click();
      } else if (passo.anexar) {
        // Põe um arquivo no <input type=file> (o conteúdo vem do disco, lido pela prova em
        // base64) e dispara o change — o mesmo que escolher o arquivo na janela do sistema.
        const campo = document.querySelector(passo.anexar);
        if (!campo) { passosFalhos.push('não achei o campo de arquivo ' + passo.anexar); continue; }
        const bytes = Uint8Array.from(atob(passo.base64), (ch) => ch.charCodeAt(0));
        const dt = new DataTransfer();
        dt.items.add(new File([bytes], passo.nome || 'arquivo', { type: passo.tipo || 'application/octet-stream' }));
        campo.files = dt.files;
        campo.dispatchEvent(new Event('change', { bubbles: true }));
      } else if (passo.esperarDito) {
        // Espera a tela DIZER algo (toast/alert/confirm que começa com este texto): o fim de
        // um salvamento assíncrono. Na máquina carregada, 400 ms não bastam.
        const tem = () => ditos.some((d) => d.startsWith(passo.esperarDito));
        const fim = Date.now() + (passo.ate || 8000);
        while (!tem() && Date.now() < fim) await new Promise((s) => setTimeout(s, 100));
        if (!tem()) passosFalhos.push('a tela não disse "' + passo.esperarDito + '"');
      } else if (passo.esperarTexto) {
        // Espera (até `ate` ms) o texto aparecer na tela: leitura de PDF, chamada lenta.
        const fim = Date.now() + (passo.ate || 8000);
        while (!(document.body.innerText || '').includes(passo.esperarTexto) && Date.now() < fim) await new Promise((s) => setTimeout(s, 100));
        if (!(document.body.innerText || '').includes(passo.esperarTexto)) passosFalhos.push('o texto "' + passo.esperarTexto + '" não apareceu');
      }
      await new Promise((s) => setTimeout(s, 400));
    }
    await new Promise((s) => setTimeout(s, 200));

    // opcoes.avaliar: corpo de função (TEXTO) rodado DENTRO da tela, depois dos passos, e o
    // que ele devolver volta em `avaliado`. Existe para provar código do shared.js que a
    // medição normal nunca alcança — o portão de notificações, por exemplo, mora no
    // initModulo, e aqui o initModulo é substituído. Sem isto, aquele código não teria prova
    // nenhuma e o verde diria menos do que parece.
    // O texto vem SEMPRE do arquivo de provas do repositório — nunca de entrada de fora, nem
    // do banco. Se algum dia vier de fora, isto vira execução de código alheio: não faça.
    let avaliado = null, erroAvaliar = null;
    if (opcoes.avaliar) {
      try { avaliado = await (new Function('return (async () => {' + opcoes.avaliar + '})()'))(); }
      catch (e) { erroAvaliar = String((e && e.message) || e); }
    }

    const principal = document.getElementById('main-content') || document.getElementById('main') || document.body;
    const barraEl = document.getElementById('app-nav');
    const aceso = barraEl ? barraEl.querySelector('.nav-item.active') : null;
    // Quem diz o que a tela mostra é o DOM. Dado em memória não é tela.
    const texto = (document.body.innerText || '').trim();
    return {
      texto: texto.slice(0, 2000),
      // "veio em branco" olha a área principal, não o corpo: cabeçalho e barra sempre
      // desenham, e contá-los faria uma tela vazia parecer cheia
      vazia: ((principal.innerText || '').trim().length < 10),
      barra: {
        aceso: aceso ? aceso.dataset.id : null,
        itens: barraEl ? [...barraEl.querySelectorAll('.nav-item')].map((a) => a.dataset.id) : [],
      },
      gravacoes,
      passosFalhos,
      avaliado,
      erroAvaliar,
      ditos,
      estadoFinal: vivo,
    };
  };

  // Tela que TRANCA a porta manda a pessoa embora no meio do init (o config.html devolve
  // quem não é superadmin para a Home). Vista de fora isso é a página navegando, e a
  // medição morre — mas não é defeito: é a tranca funcionando. Aqui vira uma resposta
  // ("foi mandada para X") em vez de um estouro, e quem escreve a prova decide se aquilo
  // era esperado. Tratar tranca como erro ensinaria a ignorar o vermelho.
  // Passo { anexar, arquivo: caminho } → o conteúdo vai em base64 para dentro da tela.
  const opcoesTela = { ...opcoes, passos: [].concat(opcoes.passos || []).map((p) => (p && p.anexar && p.arquivo && !p.base64)
    ? { ...p, base64: fs.readFileSync(p.arquivo).toString('base64'), nome: p.nome || path.basename(p.arquivo) } : p) };
  let resultado;
  try {
    resultado = await pagina.evaluate(medir, papel, opcoesTela);
  } catch (e) {
    // O endereço só muda quando a navegação assenta: perguntar no instante do estouro
    // devolvia a página velha, e a tranca aparecia como erro em vez de tranca.
    await new Promise((s) => setTimeout(s, 400));
    const destino = pagina.url();
    const saiuDaTela = destino.split('?')[0] !== url;
    if (!String(e.message || '').includes('Execution context was destroyed') || !saiuDaTela) {
      await pagina.close();
      throw e;
    }
    resultado = {
      redirecionou: destino.split('/').pop(),
      texto: '', vazia: true, barra: { aceso: null, itens: [] }, gravacoes: [], passosFalhos: [],
    };
  }

  // opcoes.foto: caminho onde gravar um retrato da tela ANTES de fechá-la. Existe para o
  // dono poder olhar um desenho novo sem precisar publicar — prova verde não é tela vista.
  // Aceita um caminho (página inteira) ou { caminho, seletor } para recortar um pedaço —
  // modal é `position:fixed` e some do retrato de página inteira, que rola até o topo.
  // Aceita também uma LISTA de fotos (ex.: a janela do celular + a página inteira).
  for (const foto of [].concat(opcoes.foto || [])) {
    const alvo = typeof foto === 'string' ? { caminho: foto } : foto;
    try {
      const el = alvo.seletor ? await pagina.$(alvo.seletor) : null;
      if (alvo.seletor && !el) throw new Error('não achei ' + alvo.seletor + ' para fotografar');
      await (el || pagina).screenshot({ path: alvo.caminho, fullPage: el ? undefined : !alvo.viewport });
    } catch (e) { erros.push('foto: ' + e.message); }
  }
  await pagina.close();
  return { redirecionou: null, ...resultado, chamadasApi, erros: [...new Set(erros)], arquivo, papel: papel.nome };
}
