// ── O que se exige de cada tela ───────────────────────────────────────────────
//
// Rodar:  npm run provar-telas
// Uma tela só:  npm run provar-telas -- ausencias.html
//
// Duas camadas, de propósito:
//
//   FUMAÇA — toda tela abre, com sessão de verdade, nos quatro papéis, sem erro de
//   JavaScript e sem vir em branco. É pouco exigente e pega muito: os 6 defeitos
//   críticos de 17/08 eram todos disto.
//
//   PROVAS — perguntas específicas, uma por defeito que já aconteceu. Regra: defeito
//   que o dono encontrou vira prova aqui, para não voltar.

import { iniciarProvas, PAPEIS } from './abrir-tela.mjs';

// Telas com sessão. Ficam de fora as que não têm login (login, pastoral, ausencias-publica,
// novos) — não é esquecimento, é que não há sessão para simular nelas.
const TELAS = [
  'index.html', 'agenda.html', 'ausencias.html', 'caixa.html', 'casas.html', 'chamada.html',
  'config.html', 'conquistas.html', 'crm.html', 'destaques.html', 'escala.html',
  'escalas-membro.html', 'jornada-admin.html', 'membros.html', 'minha-casa.html',
  'missoes.html', 'missoes-lab.html', 'tarefas.html', 'tesouraria.html',
];

// Telas que TRANCAM a porta por conta própria, e para quem elas abrem. Quem não está na
// lista tem de ser mandado embora — a prova exige as duas coisas, senão uma tranca que
// parou de funcionar passaria como "abriu normalmente".
// (As outras telas gateiam por `initModulo`, que a prova substitui; por isso só o Config
// aparece aqui. Está registrado no LEIA-ME como o que esta ferramenta ainda NÃO prova.)
const PORTAS_FECHADAS = {
  'config.html': ['admin'],   // painel do superadmin
};

// ── Placar ───────────────────────────────────────────────────────────────────
const resultados = [];
function registrar(ok, titulo, detalhe) {
  resultados.push({ ok, titulo, detalhe });
  const marca = ok ? '\x1b[32m✔\x1b[0m' : '\x1b[31m✖\x1b[0m';
  console.log('  ' + marca + ' ' + titulo + (detalhe && !ok ? '\n      ' + detalhe : ''));
}
function exigir(cond, titulo, detalhe) { registrar(!!cond, titulo, detalhe); }

// ── As provas ────────────────────────────────────────────────────────────────
async function provaFumaca(provas, filtro) {
  console.log('\n\x1b[1mFUMAÇA — toda tela abre em todos os papéis\x1b[0m');
  const lista = filtro ? TELAS.filter((t) => t === filtro) : TELAS;
  for (const tela of lista) {
    const problemas = [];
    for (const chave of Object.keys(PAPEIS)) {
      const papel = PAPEIS[chave];
      let r;
      try {
        r = await provas.abrir(tela, { papel });
      } catch (e) {
        problemas.push(papel.nome + ': ' + String(e.message).split('\n')[0]);
        continue;
      }
      const podeEntrar = !PORTAS_FECHADAS[tela] || PORTAS_FECHADAS[tela].includes(chave);
      if (r.redirecionou) {
        if (podeEntrar) problemas.push(papel.nome + ': foi mandado para ' + r.redirecionou + ', devia entrar');
        continue;                       // mandado embora, como se espera: nada a medir
      }
      if (!podeEntrar) { problemas.push(papel.nome + ': ENTROU numa tela que devia estar trancada'); continue; }
      if (r.erros.length) problemas.push(papel.nome + ': ' + r.erros.slice(0, 2).join(' | '));
      else if (r.vazia) problemas.push(papel.nome + ': abriu em branco');
    }
    exigir(problemas.length === 0, tela, problemas.join('\n      '));
  }
}

async function provaBarraAcendeSecao(provas) {
  console.log('\n\x1b[1mA barra acende o lugar onde a pessoa está\x1b[0m');
  // Defeito real (18/08/2026): abrir Escala › ⋯ Mais › Ausências mostrava a tela certa e a
  // barra acendia "Caixa" — a Ausências não tem botão próprio e o código emprestava o id da
  // vizinha. Emprestar id é mentir sobre onde a pessoa está.
  const casos = [
    ['ausencias.html', PAPEIS.admin, 'escala', 'Ausências, admin → acende Escala'],
    ['ausencias.html', PAPEIS.cerimonario, 'escalas-membro', 'Ausências, cerimoniário → acende Escalas'],
    ['chamada.html', PAPEIS.admin, 'escala', 'Chamada, admin → acende Escala'],
    ['chamada.html', PAPEIS.cerimonario, 'escalas-membro', 'Chamada, cerimoniário → acende Escalas'],
  ];
  for (const [tela, papel, esperado, titulo] of casos) {
    const r = await provas.abrir(tela, { papel });
    exigir(r.barra.aceso === esperado, titulo, 'acendeu "' + r.barra.aceso + '", esperado "' + esperado + '"');
  }
  // E o caso em que NADA deve acender: quem não tem a Escala na barra. Melhor a barra calada
  // do que apontando o lugar errado.
  const semEscala = await provas.abrir('ausencias.html', { papel: PAPEIS.equipe });
  exigir(semEscala.barra.aceso === null && !semEscala.barra.itens.includes('escala'),
    'quem não tem Escala na barra: nada acende',
    'acendeu "' + semEscala.barra.aceso + '" com a barra [' + semEscala.barra.itens.join(',') + ']');
}

async function provaConfigBateComABarra(provas) {
  console.log('\n\x1b[1mO Config mostra os MESMOS itens que a barra\x1b[0m');
  // Defeito real (18/08/2026): Config › Navegação lia uma quarta cópia da lista, escrita à
  // mão. Faltava a Tarefas (módulo novo) e sobrava "Faltar" (aposentada na véspera).
  const r = await provas.abrir('config.html', { papel: PAPEIS.admin });
  exigir(r.erros.length === 0, 'o Config abre sem erro', r.erros.join(' | '));

  // São DUAS listas em duas abas, e cada defeito estava numa delas: a Tarefas faltava na de
  // Coordenação, o "Faltar" sobrava na de Membro. Olhar uma aba só deixaria metade passar.
  const coord = await provas.abrir('config.html', {
    papel: PAPEIS.admin,
    passos: [{ chamar: 'abrirSecao', args: ['navegacao'] }, { clicar: 'Coordenação' }],
  });
  exigir(coord.passosFalhos.length === 0, 'a aba Coordenação abriu', coord.passosFalhos.join(' | '));
  exigir(/Tarefas/.test(coord.texto), 'a Tarefas aparece na ordenação da coordenação',
    'não achei "Tarefas" na lista');

  const jornada = await provas.abrir('config.html', {
    papel: PAPEIS.admin,
    passos: [{ chamar: 'abrirSecao', args: ['navegacao'] }, { clicar: 'Membro (Jornada)' }],
  });
  exigir(jornada.passosFalhos.length === 0, 'a aba Membro (Jornada) abriu', jornada.passosFalhos.join(' | '));
  exigir(!/\bFaltar\b/.test(jornada.texto), 'o "Faltar" aposentado NÃO aparece para o membro',
    'ainda mostra um item que não existe mais na barra');
}

async function provaModelosAceitaFuncaoPropria(provas) {
  console.log('\n\x1b[1mFunção criada pelo dono entra nos Modelos de escala\x1b[0m');
  // Defeito real (18/08/2026): o editor de Modelos lia só as 13 funções cravadas no código.
  // Dava para criar "Báculo Auxiliar", ela nascia na Escala e na ficha do membro, e ali não
  // havia onde dizer quantas vagas ela tem — e o Salvar gravava só as 13.
  const criada = { tipo: 'funcao', valor: 'baculo_auxiliar', label: 'Báculo Auxiliar' };
  const r = await provas.abrir('config.html', {
    papel: PAPEIS.admin,
    config: { __funcoes: [criada] },
    passos: [
      { chamar: 'abrirSecao', args: ['escala'] },   // seção Escala do Config
      { clicar: 'Modelos de escala' },              // a sub-aba, dentro do conteúdo
      { clicar: 'Salvar modelo' },                  // para ver o que ele MANDARIA gravar
    ],
  });
  exigir(r.passosFalhos.length === 0, 'cheguei até o editor de Modelos', r.passosFalhos.join(' | '));
  exigir(/Báculo Auxiliar/.test(r.texto), 'a função criada aparece como linha na tela',
    'não achei "Báculo Auxiliar" entre as funções do modelo');

  // A tela pode estar certa e o botão de salvar deixar de fora — foi exatamente o caso.
  const salvou = r.gravacoes.filter((g) => g.tabela === 'acolitos_modelos' && g.acao === 'upsert');
  const chaves = salvou.flatMap((g) => [].concat(g.dados || []).map((x) => x.funcao));
  exigir(chaves.includes('baculo_auxiliar'), 'o Salvar grava a função criada',
    'gravaria só: ' + (chaves.join(', ') || '(nada)'));
}

// ── Partida ──────────────────────────────────────────────────────────────────
const filtro = process.argv[2] || null;
const provas = await iniciarProvas();
const comecou = Date.now();
try {
  await provaFumaca(provas, filtro);
  if (!filtro) {
    await provaBarraAcendeSecao(provas);
    await provaConfigBateComABarra(provas);
    await provaModelosAceitaFuncaoPropria(provas);
  }
} finally {
  await provas.encerrar();
}

const falhas = resultados.filter((r) => !r.ok);
const segundos = Math.round((Date.now() - comecou) / 1000);
console.log('\n' + '─'.repeat(60));
console.log(resultados.length + ' provas em ' + segundos + 's — ' +
  (resultados.length - falhas.length) + ' passaram, ' + falhas.length + ' falharam');
if (falhas.length) {
  console.log('\n\x1b[31mO que falhou:\x1b[0m');
  falhas.forEach((f) => console.log('  ✖ ' + f.titulo));
}
process.exit(falhas.length ? 1 : 0);
