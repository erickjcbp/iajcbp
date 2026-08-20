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

  const navegador = await pup.launch({ executablePath: chrome, headless: 'new', args: ['--no-sandbox'] });

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
 *   passos     o que fazer depois do init, em ordem. Cada passo é
 *                { chamar:'abrirSecao', args:['navegacao'] }  → chama a função global pelo nome
 *                { clicar:'Modelos de escala' }               → clica pelo texto, só no conteúdo
 * @returns {Promise<object>} { texto, vazia, erros, barra, gravacoes, passosFalhos }
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
  await pagina.setRequestInterception(true);
  pagina.on('request', (r) => {
    if (r.url().split('?')[0] === url) {
      return r.respond({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
    }
    // Nada sai para a internet: a prova não pode depender de rede, nem tocar no banco real.
    if (!r.url().startsWith('http://127.0.0.1:')) return r.abort();
    r.continue();
  });
  await pagina.setViewport({ width: 390, height: 900 });
  await pagina.evaluateOnNewDocument((modo) => {
    try { localStorage.setItem('nav-mode', modo); } catch (e) {}
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
  }, papel.modo);
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
    window.initModulo = async () => ctxFalso;

    // ── O banco de mentira ──────────────────────────────────────────────────
    // Responde POR TABELA e sabe FALHAR. Um harness que devolve sempre a mesma lista e
    // nunca erro não prova o caminho de falha — que é onde este app mais errou: consulta
    // recusada e a tela dizendo "não há nada" em vez de "não consegui perguntar".
    const ok = (d) => ({ data: d, error: null, count: Array.isArray(d) ? d.length : 0 });
    const gravacoes = [];
    const respostaDe = (tabela) => {
      const t = (opcoes.tabelas || {})[tabela];
      if (t && t.error) return { data: null, error: t.error, count: 0 };
      if (t) return ok(t.data || []);
      return ok([]);
    };
    const cadeia = (tabela) => {
      const c = new Proxy({}, { get: (_alvo, chave) => {
        if (chave === 'then') return (f) => Promise.resolve(respostaDe(tabela)).then(f);
        // grava o que a tela MANDARIA para o banco: às vezes a tela está certa e o
        // botão de salvar é que deixa coisa de fora (foi o caso dos Modelos de escala)
        if (chave === 'insert' || chave === 'upsert' || chave === 'update' || chave === 'delete') {
          return (dados) => { gravacoes.push({ tabela, acao: chave, dados }); return c; };
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
    };
  };

  // Tela que TRANCA a porta manda a pessoa embora no meio do init (o config.html devolve
  // quem não é superadmin para a Home). Vista de fora isso é a página navegando, e a
  // medição morre — mas não é defeito: é a tranca funcionando. Aqui vira uma resposta
  // ("foi mandada para X") em vez de um estouro, e quem escreve a prova decide se aquilo
  // era esperado. Tratar tranca como erro ensinaria a ignorar o vermelho.
  let resultado;
  try {
    resultado = await pagina.evaluate(medir, papel, opcoes);
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

  await pagina.close();
  return { redirecionou: null, ...resultado, erros: [...new Set(erros)], arquivo, papel: papel.nome };
}
