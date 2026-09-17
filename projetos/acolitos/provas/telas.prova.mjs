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

async function provaPortaoNotificacoes(provas) {
  console.log('\n\x1b[1mSem o sino ligado, o app não abre\x1b[0m');

  // A REGRA de quem entra é testada em node (portao-notificacoes-core.test.js). O que só o
  // navegador prova é o resto: que o core CHEGOU na tela, que o portão roda de verdade e
  // que a parede desenha e não fecha. Nada disto passa pela FUMAÇA: lá o initModulo é
  // substituído por um falso, então o portão nunca roda.
  const r = await provas.abrir('index.html', {
    papel: PAPEIS.admin,
    avaliar: `
      const saida = {};
      saida.coreCarregou = typeof decidirPortaoNotificacoes === 'function';

      // O portão REAL, com os fatos reais deste navegador: sem inscrição nenhuma.
      const decisao = await portaoNotificacoes('u1', { _crmEtapa: null });
      saida.entra = decisao.entra;
      saida.parede = decisao.parede;

      // A isenção combinada: quem ainda espera aprovação do cadastro passa.
      saida.aguardandoEntra = (await portaoNotificacoes('u1', { _crmEtapa: 'aprovacao_cadastro' })).entra;

      // E a parede: desenha, cobre tudo, e não vai embora de jeito nenhum.
      mostrarParedeNotificacoes(decisao.parede, 'u1');
      const p = document.getElementById('parede-notif');
      saida.desenhou = !!p;
      if (p) {
        const e = getComputedStyle(p);
        saida.cobreTudo = e.position === 'fixed' && parseInt(e.zIndex, 10) >= 1000;
        p.click();                                                   // clicar fora
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        saida.continuaDepoisDeInsistir = !!document.getElementById('parede-notif');
        // innerText devolve o texto COMO ELE APARECE, e os botões do app são uppercase por
        // CSS: procurar "Sair da conta" aqui dá falso defeito. Medir sem caixa.
        saida.textoPedir = (p.innerText || '').toLowerCase();
        saida.temSaidaDaConta = saida.textoPedir.includes('sair da conta');
      }

      // Cada beco com a receita certa. Mandar pela saída errada é pior que não mandar.
      const textoDe = (qual) => {
        const velha = document.getElementById('parede-notif');
        if (velha) velha.remove();
        mostrarParedeNotificacoes(qual, 'u1');
        return (document.getElementById('parede-notif').innerText || '');
      };
      saida.textoNegado = textoDe('negado').toLowerCase();
      saida.textoInstalar = textoDe('instalar-ios').toLowerCase();
      return saida;
    `,
  });

  const a = r.avaliado || {};
  exigir(!r.erroAvaliar, 'o portão roda sem estourar', r.erroAvaliar);
  exigir(a.coreCarregou === true, 'portao-notificacoes-core.js chegou na tela',
    'a função decidirPortaoNotificacoes não existe — <script> faltando no HTML');
  exigir(a.entra === false, 'sem inscrição, NÃO entra', 'o portão deixou passar');
  exigir(a.parede === 'pedir', 'e a parede é a que pede o sino', 'veio "' + a.parede + '"');
  exigir(a.aguardandoEntra === true, 'quem aguarda aprovação do cadastro entra');
  exigir(a.desenhou === true, 'a parede desenha');
  exigir(a.cobreTudo === true, 'a parede cobre a tela inteira');
  // O ponto do pedido: não tem "agora não", nem clicar fora, nem ESC. Só ativando.
  exigir(a.continuaDepoisDeInsistir === true, 'a parede NÃO fecha ao clicar fora nem no ESC',
    'a parede sumiu — vira pop-up de novo, e o portão deixa de existir');
  exigir(a.temSaidaDaConta === true, 'tem "Sair da conta" — ninguém fica preso sem botão');
  exigir(/ajustes/.test(a.textoNegado || ''), 'quem negou recebe a receita dos Ajustes');
  exigir(/tela de início/.test(a.textoInstalar || ''), 'iPhone no navegador recebe a receita de instalar');
  // A receita errada no beco errado é o defeito que a ordem das perguntas evita. O "e tem
  // texto" não é enfeite: sem ele, uma parede VAZIA passaria neste exame.
  exigir((a.textoPedir || '').length > 40 && !/tela de início/.test(a.textoPedir || ''),
    'a parede que só pede o sino não fala em instalar');
}

async function provaBoasVindasAoTime(provas) {
  console.log('\n\x1b[1mA festa de boas-vindas ao time\x1b[0m');

  // O texto é testado em node (boas-vindas-core.test.js). O que só o navegador prova é o
  // desenho: que a animação monta, que o ícone é TRAÇADO (sem a classe `ico` vira mancha
  // preta — já aconteceu no app) e que o recado escrito aparece de verdade.
  const r = await provas.abrir('index.html', {
    papel: PAPEIS.membro,
    avaliar: `
      const saida = {};
      saida.coreCarregou = typeof montarBoasVindas === 'function';

      const aviso = { tipo:'boas_vindas_time', time:'escala', time_label:'Escala',
                      recado:'Ana, conto com você nas escalas do mês.', seen:false };
      showAvisoUnico(aviso, { nome:'Ana Clara' }, null);   // pela porta REAL da fila
      await new Promise(function (s) { setTimeout(s, 120); });

      const ov = document.querySelector('.celeb-overlay');
      saida.desenhou = !!ov;
      if (ov) {
        saida.texto = (ov.innerText || '').toLowerCase();
        const svg = ov.querySelector('.celeb-icon svg');
        saida.temIcone = !!svg;
        // Quem diz se o ícone é traçado é o fill CALCULADO, não o CSS lido a olho.
        saida.iconeTracado = svg ? getComputedStyle(svg).fill === 'none' : false;
        // Medir com getBoundingClientRect aqui MENTE: o ícone entra com transform:scale(0)
        // e, no meio da animação, o retângulo dele é zero mesmo estando tudo certo. O
        // tamanho declarado (1.15em do .ico) não sofre transform — é o critério honesto.
        saida.iconeLargura = svg ? parseFloat(getComputedStyle(svg).width) || 0 : 0;
        saida.iconeTemTamanho = saida.iconeLargura > 8;
        saida.temRecado = !!ov.querySelector('.celeb-recado');
        // O recado tem de vir ANTES dos botões: é a parte que ela precisa ler.
        const card = ov.querySelector('.celeb-card');
        const filhos = [].slice.call(card.children).map(function (e) { return e.className; });
        saida.recadoAntesDosBotoes =
          filhos.indexOf('celeb-recado') > -1 &&
          filhos.indexOf('celeb-recado') < filhos.indexOf('celeb-actions');
      }

      // E sem recado nenhum: a caixa não pode aparecer vazia.
      if (ov) ov.remove();
      showAvisoUnico({ tipo:'boas_vindas_time', time:'midia', time_label:'Mídia', recado:null, seen:false },
                     { nome:'Pedro' }, null);
      await new Promise(function (s) { setTimeout(s, 120); });
      const ov2 = document.querySelector('.celeb-overlay');
      saida.semRecadoNaoTemCaixa = ov2 ? !ov2.querySelector('.celeb-recado') : false;
      saida.textoSemRecado = ov2 ? (ov2.innerText || '').toLowerCase() : '';
      return saida;
    `,
  });

  const a = r.avaliado || {};
  exigir(!r.erroAvaliar, 'a festa roda sem estourar', r.erroAvaliar);
  exigir(a.coreCarregou === true, 'boas-vindas-core.js chegou na tela',
    'montarBoasVindas não existe — <script> faltando no HTML');
  exigir(a.desenhou === true, 'a animação desenha');
  exigir(/escala/.test(a.texto || ''), 'diz em que time a pessoa entrou');
  exigir(/ana/.test(a.texto || ''), 'chama a pessoa pelo primeiro nome');
  exigir(a.temIcone === true, 'o time tem ícone próprio (SVG, não emoji)');
  exigir(a.iconeTracado === true, 'o ícone é TRAÇADO, não mancha preta',
    'fill calculado não é "none" — falta a classe ico');
  exigir(a.iconeTemTamanho === true, 'o ícone tem tamanho na tela',
    'largura ' + (a.iconeLargura || 0) + 'px — recipiente sem medida definida');
  exigir(a.temRecado === true, 'o recado escrito aparece');
  exigir(/conto com você/.test(a.texto || ''), 'e aparece com o texto que foi escrito');
  exigir(a.recadoAntesDosBotoes === true, 'o recado vem antes dos botões, não como rodapé');
  exigir(a.semRecadoNaoTemCaixa === true, 'sem recado, não sobra caixa vazia na tela');
  exigir((a.textoSemRecado || '').length > 40 && /mídia/.test(a.textoSemRecado || ''),
    'sem recado, o texto padrão entra e cita o time');
}

async function provaTarefasSoDoMeuTime(provas) {
  console.log('\n\x1b[1mCada time só enxerga as tarefas dele\x1b[0m');

  // Quem TRANCA é o banco (migration 057, provada por docs/provas/provar-057-tarefas-por-time.sql).
  // O que se prova aqui é o espelho na tela: que ela não OFERECE um time que o banco vai
  // recusar. Oferecer e ser recusado na hora de salvar é erro sem explicação na cara de quem
  // só queria criar uma tarefa.
  const CATALOGO = [
    { valor: 'secretaria', label: 'Secretaria' },
    { valor: 'formacao',   label: 'Formação' },
    { valor: 'midia',      label: 'Mídia' },
  ];
  const medir = (papel, setores) => provas.abrir('tarefas.html', {
    papel,
    tabelas: { acolitos_listas: { data: CATALOGO } },
    avaliar: `
      // O membro da prova não traz \`setores\` — aqui ele ganha os do caso em teste, e a
      // tela é mandada carregar DE NOVO pelo caminho real (carregarTudo), não por atalho.
      ctx.membro.setores = ${JSON.stringify(setores)};
      await carregarTudo();
      return { times: TIMES.map(function (t) { return t.valor; }),
               rotulos: Object.keys(LABEL_TIME).sort() };
    `,
  });

  const admin = await medir(PAPEIS.admin, []);
  exigir(!admin.erroAvaliar, 'a tela de tarefas carrega sem estourar', admin.erroAvaliar);
  exigir(JSON.stringify((admin.avaliado || {}).times) === JSON.stringify(['secretaria', 'formacao', 'midia']),
    'coordenação continua vendo todos os times', 'viu: ' + JSON.stringify((admin.avaliado || {}).times));

  const equipe = await medir(PAPEIS.equipe, ['formacao']);
  exigir(JSON.stringify((equipe.avaliado || {}).times) === JSON.stringify(['formacao']),
    'quem é da Formação só vê a Formação', 'viu: ' + JSON.stringify((equipe.avaliado || {}).times));

  const dois = await medir(PAPEIS.equipe, ['midia', 'secretaria']);
  exigir(JSON.stringify((dois.avaliado || {}).times) === JSON.stringify(['secretaria', 'midia']),
    'quem é de dois times vê os dois', 'viu: ' + JSON.stringify((dois.avaliado || {}).times));

  const nenhum = await medir(PAPEIS.equipe, []);
  exigir(JSON.stringify((nenhum.avaliado || {}).times) === JSON.stringify([]),
    'quem não está em time nenhum não vê time nenhum',
    'viu: ' + JSON.stringify((nenhum.avaliado || {}).times));

  // Os RÓTULOS vêm do catálogo inteiro, mesmo para quem vê um time só: uma tarefa antiga de
  // outro time ainda precisa aparecer com nome de gente, não com o código do banco.
  exigir(((equipe.avaliado || {}).rotulos || []).length === 3,
    'os nomes dos times continuam completos, para não sobrar código na tela',
    'rótulos: ' + JSON.stringify((equipe.avaliado || {}).rotulos));
}

async function provaBrasaoNoAvatar(provas) {
  console.log('\n\x1b[1mO brasão da casa aparece no avatar\x1b[0m');

  // O dono entrou na Sanctaris e estranhou que o avatar não mostrava nada. Não era defeito:
  // o emblema do canto sempre foi o do NÍVEL, e a casa não aparecia em avatar nenhum.
  const r = await provas.abrir('index.html', {
    papel: PAPEIS.membro,
    tabelas: { acolitos_casas: { data: [{ id: 'c1', slug: 'sanctaris' }] } },
    avaliar: `
      await loadCasas();
      const saida = { slugAchado: casaSlugDe({ casa_id: 'c1' }),
                      slugSemCasa: casaSlugDe({ casa_id: null }),
                      slugCasaDesconhecida: casaSlugDe({ casa_id: 'nao-existe' }) };

      const caixa = document.createElement('div');
      caixa.id = 'prova-avatar';
      document.body.appendChild(caixa);
      caixa.appendChild(buildAvatarEl(null, 'membro', 76, {
        nivelSlug: 'aspirante',
        casaSlug: casaSlugDe({ casa_id: 'c1' }),
        editable: true, membro: { id: 'm1' },
      }));
      await new Promise(function (s) { setTimeout(s, 80); });

      var circulo = caixa.querySelector('div');                 // o avatar em si
      var brasao  = caixa.querySelector('img[src*="brasoes"], picture');
      var nivel = caixa.querySelector('svg');
      saida.temBrasao = !!brasao;
      saida.temNivelAinda = !!nivel;
      if (brasao) {
        var im = brasao.tagName === 'IMG' ? brasao : brasao.querySelector('img');
        saida.altura = Math.round(parseFloat(getComputedStyle(im).height) || 0);
      }
      // Casa à ESQUERDA, nível à direita. Se os dois caírem do mesmo lado, um esconde o
      // outro e o código continua parecendo certo.
      //
      // MEDIR POR getComputedStyle().right === 'auto' NAO FUNCIONA: para elemento
      // posicionado o navegador devolve a distância JÁ RESOLVIDA (ex.: "53.17px"), nunca
      // "auto" — a prova acusava defeito num layout perfeito. O critério honesto é comparar
      // os dois emblemas ENTRE SI, que é o que a pessoa vê.
      if (brasao && nivel) {
        var rBras = brasao.getBoundingClientRect();
        var rNiv  = nivel.getBoundingClientRect();
        saida.ladoEsquerdo = rBras.left < rNiv.left;
        saida.distancia = Math.round(rNiv.left - rBras.left);
      }

      // O botão de foto tem de estar FORA do círculo, com a palavra junto.
      var botao = Array.from(caixa.querySelectorAll('button'))
        .find(function (b) { return /trocar foto/i.test(b.innerText || ''); });
      saida.temBotao = !!botao;
      if (botao) {
        saida.botaoTemPalavra = /trocar foto/i.test(botao.innerText || '');
        saida.botaoTemIcone = !!botao.querySelector('svg.ico');
        saida.botaoSolto = getComputedStyle(botao).position !== 'absolute';
        // Abaixo de verdade: o topo do botão vem depois da base do avatar.
        var rb = botao.getBoundingClientRect(), rc = circulo.getBoundingClientRect();
        saida.botaoAbaixo = rb.top >= rc.top;
      }

      // E sem casa nenhuma: nada de brasão — nunca o de outra casa.
      var caixa2 = document.createElement('div');
      document.body.appendChild(caixa2);
      caixa2.appendChild(buildAvatarEl(null, 'membro', 76, { nivelSlug: 'aspirante', casaSlug: null }));
      saida.semCasaSemBrasao = !caixa2.querySelector('img[src*="brasoes"], picture');
      return saida;
    `,
  });

  const a = r.avaliado || {};
  exigir(!r.erroAvaliar, 'o avatar monta sem estourar', r.erroAvaliar);
  exigir(a.slugAchado === 'sanctaris', 'o de-para acha a casa da pessoa', 'veio: ' + a.slugAchado);
  // Sem saber a casa, o avatar sai SEM brasão — jamais com o de outra casa.
  exigir(a.slugSemCasa === null && a.slugCasaDesconhecida === null,
    'sem casa (ou casa desconhecida) não inventa brasão');
  exigir(a.temBrasao === true, 'o brasão da casa aparece no avatar');
  exigir(a.ladoEsquerdo === true, 'a casa fica à esquerda, o nível à direita',
    'os dois emblemas caíram do mesmo lado (distância: ' + a.distancia + 'px) — um esconde o outro');
  exigir(a.temNivelAinda === true, 'o emblema de nível continua lá');
  exigir(a.altura >= 24, 'o brasão usa a altura toda do canto',
    'altura ' + a.altura + 'px — a arte está sendo espremida pela caixa quadrada');
  exigir(a.temBotao === true, 'o botão de trocar foto existe');
  exigir(a.botaoSolto === true && a.botaoAbaixo === true, 'o botão saiu do canto e foi para baixo');
  exigir(a.botaoTemPalavra === true, 'o botão leva a palavra junto, não só o desenho');
  exigir(a.botaoTemIcone === true, 'e o desenho é ícone de traço, não o caractere de lápis');
  exigir(a.semCasaSemBrasao === true, 'quem não tem casa continua sem brasão');
}

async function provaCasaChegaPelasFuncoesDoBanco(provas) {
  console.log('\n\x1b[1mO brasão chega nas telas que pegam a gente por FUNÇÃO do banco\x1b[0m');

  // O brasão no avatar subiu em 20/08 e funcionava só nas telas que leem a tabela de
  // membros direto. Sete telas pegam a gente por FUNÇÃO do banco, e nenhuma dessas
  // funções mandava a casa — então ali o avatar saía sempre sem brasão, calado. A 058
  // acrescentou o campo nas sete.
  //
  // A resposta de mentira abaixo tem os campos EXATOS que a função devolve hoje
  // (conferidos no banco em 20/08: casa_id, foto_url, id, nivel, nome, total). Campo a
  // mais ou a menos na amostra já deixou uma lista SEMPRE vazia no ar com a suíte verde
  // — por isso a forma é copiada do banco, não inventada.
  const r = await provas.abrir('destaques.html', {
    papel: PAPEIS.membro,
    tabelas: { acolitos_casas: { data: [{ id: 'c1', slug: 'sanctaris' }] } },
    rpcs: {
      acolitos_destaques: { data: {
        servos: [
          { id: 'm1', nome: 'Quem tem casa',  foto_url: null, nivel: 'aspirante', casa_id: 'c1',  total: 9 },
          { id: 'm2', nome: 'Quem não tem',   foto_url: null, nivel: 'aspirante', casa_id: null,  total: 4 },
        ],
        versateis: [], prontos: [],
      } },
    },
    avaliar: `
      var linhas = Array.from(document.querySelectorAll('#dest-corpo .rank-row'));
      var saida = { linhas: linhas.length };
      // A lista tem de continuar com as DUAS pessoas. Se o brasão custou uma linha,
      // o conserto é pior que o defeito.
      var comCasa = linhas.find(function (l) { return /tem casa/i.test(l.innerText || ''); });
      var semCasa = linhas.find(function (l) { return /não tem|nao tem/i.test(l.innerText || ''); });
      saida.achouAsDuas = !!comCasa && !!semCasa;
      var sel = 'img[src*="brasoes"], picture';
      saida.comCasaTemBrasao = !!(comCasa && comCasa.querySelector(sel));
      saida.semCasaSemBrasao = !!(semCasa && !semCasa.querySelector(sel));
      // O emblema de nível não pode ter sido substituído pelo da casa: são os dois.
      saida.nivelContinua = !!(comCasa && comCasa.querySelector('svg'));
      return saida;
    `,
  });

  const a = r.avaliado || {};
  exigir(!r.erroAvaliar, 'a tela de Destaques abre e desenha a lista', r.erroAvaliar);
  exigir(a.linhas === 2 && a.achouAsDuas === true, 'as duas pessoas continuam na lista',
    'vieram ' + a.linhas + ' linha(s) — acrescentar a casa não pode sumir com ninguém');
  exigir(a.comCasaTemBrasao === true, 'quem tem casa ganha o brasão pela função do banco',
    'o campo casa_id chegou na tela mas o avatar não desenhou — olhar loadCasas/casaSlugDe');
  exigir(a.semCasaSemBrasao === true, 'e quem não tem casa continua sem brasão, nunca com o de outra');
  exigir(a.nivelContinua === true, 'o emblema de nível continua junto');
}

async function provaSairDoWhatsappMarcaAFicha(provas) {
  console.log('\n\x1b[1mCRM: sair da etapa do WhatsApp marca a ficha\x1b[0m');

  // A etapa "WhatsApp" só termina quando a pessoa é posta no grupo — mas a ficha dela
  // continuava dizendo "não está no grupo". Em 27/08/2026 eram 19 pessoas que passaram
  // pela etapa e 13 com a ficha negando. Duas verdades sobre a mesma coisa.
  const pessoa = { id: 'mm2', nome: 'Servo de Teste', data_nascimento: '2012-02-02',
                   no_grupo_whatsapp: false, status: 'em_integracao', comunidade: 'matriz' };
  const r = await provas.abrir('crm.html', {
    papel: PAPEIS.admin,
    tabelas: {
      acolitos_crm: { data: [{ id: 'c2', membro_id: 'mm2', etapa: 'whatsapp',
                               etapa_iniciada_em: '2026-08-20T12:00:00Z', acolitos_membros: pessoa }] },
      acolitos_crm_comentarios: { data: [] },
      acolitos_crm_historico: { data: [] },
    },
    avaliar: `
      abrirModal({ id: 'c2', membro_id: 'mm2', etapa: 'whatsapp',
                   etapa_iniciada_em: '2026-08-20T12:00:00Z', acolitos_membros: { nome: 'Servo de Teste' } });
      var aviso = document.getElementById('modal-aviso-zap');
      var saida = { avisaAntes: !!aviso && aviso.style.display !== 'none' };
      document.getElementById('modal-obs').value = 'entrou no grupo hoje';
      await confirmarAvancar();
      await new Promise(function (s) { setTimeout(s, 300); });
      return saida;
    `,
  });
  const a = r.avaliado || {};
  const marcou = (r.gravacoes || []).some(g => g.tabela === 'acolitos_membros'
    && g.dados && g.dados.no_grupo_whatsapp === true);
  exigir(a.avisaAntes === true, 'o modal avisa que a ficha será marcada',
    'automação que ninguém vê é automação que ninguém confere');
  exigir(marcou === true, 'sair da etapa do WhatsApp marca "está no grupo" na ficha',
    'gravou: ' + JSON.stringify((r.gravacoes || []).filter(g => g.tabela === 'acolitos_membros')));
}

async function provaCartaoDoCrmEComentarioObrigatorio(provas) {
  console.log('\n\x1b[1mCRM: o cartão mostra a pessoa inteira, e mudar de etapa exige comentário\x1b[0m');

  // A tela mostrava cinco colunas de tabela: nome, idade, etapa, dias, data. Quem decide
  // se alguém entra na pastoral não via sacramentos, família, endereço nem o que falta na
  // ficha. E a "observação" era um campo único, sobrescrito a cada etapa — estava vazia
  // nas 18 linhas do CRM em 27/08/2026, porque se apagava sozinha.
  const pessoa = {
    id: 'mm1', nome: 'Fulana de Teste', data_nascimento: '2013-04-10', comunidade: 'matriz',
    status: 'em_integracao', batismo: true, primeira_eucaristia: false, crisma: false,
    investido: null, tem_tunica: true, nome_pai: 'Pai Teste', nome_mae: 'Mãe Teste',
    responsavel: 'Mãe Teste', tem_pai_ministro: false, tem_mae_ministro: false, grupo_irmaos: null,
    // De propósito: o número mora SÓ em celular_responsavel, que é onde o cadastro de
    // família grava. Era assim com 6 das 7 pessoas do CRM, e a tela mostrava '—'.
    telefone: null, telefone_whatsapp: false, celular_mae: null, celular_recado: null,
    celular_responsavel: '(19) 98321-3119',
    no_grupo_whatsapp: false, endereco: 'Rua de Teste, 10', necessidades_especiais: null,
    observacoes: null, user_id: 'u9', created_at: '2026-08-01T12:00:00Z', apelido: null, foto_url: null,
  };
  const r = await provas.abrir('crm.html', {
    papel: PAPEIS.admin,
    tabelas: {
      acolitos_crm: { data: [{ id: 'c1', membro_id: 'mm1', etapa: 'integracao',
                               etapa_iniciada_em: '2026-08-20T12:00:00Z', acolitos_membros: pessoa }] },
      acolitos_crm_comentarios: { data: [] },
      acolitos_crm_historico: { data: [] },
    },
    avaliar: `
      var naFila = Array.from(document.querySelectorAll('.crm-card')).find(function (d) {
        return /Fulana de Teste/.test(d.textContent || '');
      });
      var saida = { achou: !!naFila };
      if (naFila) naFila.click();
      await new Promise(function (s) { setTimeout(s, 400); });
      var gaveta = document.getElementById('cartao');
      var txt = gaveta ? (gaveta.innerText || '') : '';
      saida.abriu       = !!gaveta && gaveta.classList.contains('aberto');
      saida.temIdade    = /13 anos/.test(txt);
      saida.temSacramentos = /Batizado/.test(txt) && /Crisma/.test(txt);
      saida.temFamilia  = /Mãe Teste/.test(txt);
      saida.temEndereco = /Rua de Teste/.test(txt);
      saida.temFalta    = /Falta nesta ficha/.test(txt);
      // data COM hora não pode virar "Invalid Date"
      saida.dataBoa     = /01.08.2026/.test(txt) && !/Invalid/i.test(txt);
      saida.temLinha    = /Linha do tempo/.test(txt);
      // o recado tem de aparecer mesmo morando no outro campo, e com botão de conversa
      saida.mostraRecado = /98321-3119/.test(txt);
      saida.temBotaoZap  = gaveta.querySelectorAll('a[href^="https://wa.me/"]').length > 0;
      // e a conta do que falta não pode acusar ausência do que está ali
      saida.naoMenteSobreTelefone = !/nenhum telefone/i.test(txt);
      // no celular, o dedo tem de rolar o CARTÃO, não a lista atrás dele
      saida.travouOFundo = document.body.style.overflow === 'hidden';
      saida.seguraARolagem = Array.from(document.querySelectorAll('style')).some(function (e) {
        var css = e.textContent || '';
        return css.indexOf('#cartao') >= 0 && css.indexOf('overscroll-behavior') >= 0;
      });
      saida.respeitaOEntalhe = /safe-area-inset-top/.test(gaveta.innerHTML || '');
      fecharCartao();
      saida.destravouAoFechar = document.body.style.overflow !== 'hidden';

      // mudar de etapa sem escrever nada não pode mexer em nada
      abrirModal({ id: 'c1', membro_id: 'mm1', etapa: 'integracao',
                   etapa_iniciada_em: '2026-08-20T12:00:00Z', acolitos_membros: { nome: 'Fulana de Teste' } });
      document.getElementById('modal-obs').value = '';
      confirmarAvancar();
      await new Promise(function (s) { setTimeout(s, 300); });
      saida.pedeObrigatorio = /obrigat/i.test(document.body.innerText || '');
      return saida;
    `,
  });
  const a = r.avaliado || {};
  const escritas = (r.gravacoes || []).filter(g => g.tabela === 'acolitos_crm' || g.tabela === 'acolitos_crm_historico');
  exigir(a.achou === true && a.abriu === true, 'clicar na pessoa abre o cartão dela');
  exigir(a.temIdade === true && a.temSacramentos === true, 'o cartão traz idade e sacramentos');
  exigir(a.temFamilia === true && a.temEndereco === true, 'traz família e endereço');
  exigir(a.temFalta === true, 'diz o que falta na ficha', 'é a lista do que perguntar na próxima conversa');
  exigir(a.dataBoa === true, 'data com hora não vira "Invalid Date"');
  exigir(a.temLinha === true, 'o cartão tem a linha do tempo');
  exigir(a.mostraRecado === true, 'o telefone aparece mesmo morando no campo do outro cadastro',
    'são dois campos para a mesma coisa: celular_recado e celular_responsavel');
  exigir(a.temBotaoZap === true, 'tem botão para falar no WhatsApp direto do cartão');
  exigir(a.travouOFundo === true, 'com o cartão aberto, a página de trás para de rolar',
    'era o defeito no celular: o dedo pegava a lista de baixo');
  exigir(a.seguraARolagem === true, 'a rolagem não escapa do cartão (overscroll-behavior)');
  exigir(a.respeitaOEntalhe === true, 'o topo do cartão conta o entalhe/ilha do celular');
  exigir(a.destravouAoFechar === true, 'fechar o cartão devolve a rolagem da página',
    'travar e não destravar deixaria a tela inteira presa');
  exigir(a.naoMenteSobreTelefone === true, 'não diz "nenhum telefone" para quem tem telefone',
    'a conta do que falta tem de olhar os mesmos campos que a tela mostra');
  exigir(a.pedeObrigatorio === true, 'o comentário é apresentado como obrigatório');
  exigir(escritas.length === 0, 'avançar sem comentário não muda etapa nenhuma',
    'gravou: ' + JSON.stringify(escritas));
}

async function provaLoginsMostraQuemEstaEmIntegracao(provas) {
  console.log('\n\x1b[1mConfig › Logins: quem está em integração continua na lista\x1b[0m');

  // POR QUE ESTA PROVA: a lista filtrava status='ativo' e quem está no CRM (situação
  // "em integração") sumia dela. Como o app NÃO manda e-mail de recuperação — as contas
  // usam usuário, e o domínio não recebe mensagem —, esta tela é o único caminho para
  // recuperar acesso. Quem sumia daqui ficava sem saída nenhuma. Eram 6 pessoas.
  const r = await provas.abrir('config.html', {
    papel: PAPEIS.admin,
    rpcs: {
      acolitos_logins_listar: { data: { membros: [
        { id: 'm1', nome: 'Ativa Um',      nivel: 'coroinha',  user_id: 'u1', status: 'ativo',         tem_conta: true,  usuario: 'ativa.um' },
        { id: 'm2', nome: 'Integrando Um', nivel: 'aspirante', user_id: 'u2', status: 'em_integracao', tem_conta: true,  usuario: 'integrando.um' },
        { id: 'm3', nome: 'Afastada Um',   nivel: 'coroinha',  user_id: null, status: 'afastado',      tem_conta: false, usuario: null },
      ] } },
    },
    passos: [{ chamar: 'render' }],
    avaliar: `
      secaoAtual = 'logins';
      render();
      await new Promise(function (s) { setTimeout(s, 250); });
      var raiz = document.getElementById('main-content') || document.body;
      var txt = raiz.innerText || '';
      var saida = {};
      saida.temAtiva      = /Ativa Um/.test(txt);
      saida.temIntegrando = /Integrando Um/.test(txt);
      saida.temAfastada   = /Afastada Um/.test(txt);
      // a situação aparece ao lado de quem não está ativo, senão a coordenação não
      // entende por que aquela pessoa está ali
      saida.dizIntegracao = /em integra/i.test(txt);
      // e existe um jeito de separar
      var botoes = Array.from(document.querySelectorAll('button')).map(function (b) { return b.textContent || ''; });
      saida.temFiltro = botoes.some(function (t) { return /Em integra/i.test(t); })
                     && botoes.some(function (t) { return /Ativos/i.test(t); });
      return saida;
    `,
  });
  const a = r.avaliado || {};
  exigir(a.temAtiva === true, 'quem está ativo continua aparecendo');
  exigir(a.temIntegrando === true, 'quem está EM INTEGRAÇÃO aparece na lista',
    'era o buraco: essa pessoa não tinha como recuperar o acesso');
  exigir(a.temAfastada === true, 'quem está afastado também aparece');
  exigir(a.dizIntegracao === true, 'a situação aparece na linha de quem não está ativo');
  exigir(a.temFiltro === true, 'dá para separar por situação');
}

async function provaAtividadeDeUsuario(provas) {
  console.log('\n\x1b[1mConfig › Atividade: último uso e sino, com a frase certa em cada beco\x1b[0m');

  // A resposta de mentira tem os campos EXATOS que a `acolitos_atividade_listar`
  // devolve (copiados do banco em 20/08). As quatro pessoas cobrem os quatro
  // estados possíveis, que é o ponto da tela: "nunca entrou" e "a sessão expirou"
  // são coisas diferentes, e um traço no lugar das duas faria a coordenação
  // tratar igual quem nunca abriu o app e quem sumiu depois de usar.
  // A amostra é ancorada na MEIA-NOITE DE HOJE, do relógio da máquina — nunca numa
  // data escrita à mão. A tela também trunca para a meia-noite antes de subtrair,
  // então o `dias` daqui é EXATAMENTE o número que ela vai calcular: cada pessoa
  // cai sempre no mesmo beco, rode a prova no dia que rodar. (O `Math.min` só
  // impede que a pessoa de hoje fique com hora no futuro se a prova rodar de
  // madrugada; o beco continua o mesmo.)
  //
  // CICATRIZ, de 21/08 a 30/08/2026: a primeira versão cravava
  // `new Date('2026-08-20T18:00:00-03:00')` e comparava com o relógio de verdade.
  // No dia em que foi escrita passava; no dia SEGUINTE já mentia. Em 27/08 acusava
  // "Usou há 1 semana · 20/08" numa tela CERTA, e em 30/08 escorregava 10 dias.
  //
  // E as distâncias não são número solto: cada uma tem de cair no MEIO do beco, não
  // na beirada. Os becos da tela são n=0 hoje · n=1 ontem · n<7 dias · n<30 semanas
  // · n>=30 meses, com o mês saindo de floor(n/30). Por isso 0 e 75 — 75 é o meio de
  // 60..89, a faixa inteira que sai como "2 meses". Com a data congelada isso também
  // estava escorregando: em 04/09 os 75 dias viravam 90 e a prova de "há 2 meses"
  // cairia igual, cinco dias depois desta.
  const agora = Date.now();
  const meiaNoite = new Date(); meiaNoite.setHours(0, 0, 0, 0);
  const iso = (dias) => new Date(Math.min(
    meiaNoite.getTime() - dias * 86400000 + 10 * 3600000, agora)).toISOString();
  const base = { apelido: null, foto_url: null, nivel: 'aspirante', casa_id: null, aparelhos: 0, sino_desde: null };

  const r = await provas.abrir('config.html', {
    papel: PAPEIS.admin,
    tabelas: { acolitos_casas: { data: [{ id: 'c1', slug: 'sanctaris' }] } },
    rpcs: {
      acolitos_atividade_listar: { data: {
        ativos: 10,
        sem_conta: [{ id: 'x1', nome: 'Sem Login Um', nivel: 'aspirante' },
                    { id: 'x2', nome: 'Sem Login Dois', nivel: 'aspirante' }],
        contas: [
          { ...base, id: 'a', nome: 'Pessoa Aa',      usuario: 'hoje',
            ultimo_uso: iso(0), entrou_em: iso(60), criada_em: iso(90),
            sino: true, sino_desde: iso(1), aparelhos: 2, casa_id: 'c1' },
          { ...base, id: 'b', nome: 'Pessoa Bb', usuario: 'sumiu',
            ultimo_uso: iso(75), entrou_em: iso(80), criada_em: iso(90), sino: false },
          { ...base, id: 'c', nome: 'Pessoa Cc',  usuario: 'expirou',
            ultimo_uso: null, entrou_em: iso(70), criada_em: iso(90), sino: false },
          { ...base, id: 'd', nome: 'Pessoa Dd',    usuario: 'nunca',
            ultimo_uso: null, entrou_em: null, criada_em: iso(30), sino: false },
        ],
      } },
    },
    passos: [{ chamar: 'render' }],
    avaliar: `
      // A seção existe no menu e abre.
      secaoAtual = 'atividade';
      render();
      await new Promise(function (s) { setTimeout(s, 250); });

      var raiz = document.getElementById('main-content') || document.body;
      var txt = raiz.innerText || '';
      var saida = { texto: txt.length };

      // MEDIR DENTRO DA LINHA DA PESSOA, não no texto solto da tela. Na primeira
      // versão desta prova as pessoas de teste se chamavam "Sumiu Faz Tempo" e
      // "Nunca Entrou", e a busca no texto inteiro achava o NOME em vez do estado:
      // a prova passava pelo motivo errado e continuou verde quando sabotei os
      // becos de propósito. Nome de amostra nunca pode ser a coisa medida.
      // Pela ESTRUTURA, não caçando texto: a linha é (nome, estado, usuário), então o
      // estado é o irmão seguinte do pedaço cujo texto é exatamente o nome. Caçar texto
      // solto na tela foi o que deixou a primeira versão desta prova verde por engano.
      // E textContent, nao innerText (SEM crase: aqui dentro crase fecha a template
      // string e derruba o arquivo inteiro) — o innerText vem mexido pelo CSS.
      // SEM CONTRABARRA TAMBÉM: este bloco é uma template string, então \s, \S e \/
      // perdem a barra antes de virar código. Uma expressão com [\s\S] chega aqui como
      // [sS] e não casa nada; /01\/08/ chega como /01/08/ e estoura "flags inválidas".
      // Em 27/08/2026 isso acusou 12 defeitos falsos num app correto. Para buscar texto
      // com caractere especial, use indexOf em vez de expressão regular.
      function estadoDe(nome) {
        var alvo = Array.from(raiz.querySelectorAll('div')).find(function (d) {
          return (d.textContent || '').trim() === nome;
        });
        if (!alvo) return '(nao achei a linha de ' + nome + ')';
        var irmao = alvo.nextElementSibling;
        return irmao ? (irmao.textContent || '').trim() : '(a linha de ' + nome + ' nao tem estado)';
      }
      saida.estadoA = estadoDe('Pessoa Aa');
      saida.estadoB = estadoDe('Pessoa Bb');
      saida.estadoC = estadoDe('Pessoa Cc');
      saida.estadoD = estadoDe('Pessoa Dd');

      // Cada beco com a SUA frase — é a decisão do dono, e o que a tela existe para dizer.
      saida.dizUsouHoje    = /Usou hoje/i.test(saida.estadoA);
      saida.dizSumiu       = /Usou h[áa] 2 meses/i.test(saida.estadoB);
      saida.dizExpirou     = /Sumiu faz tempo/i.test(saida.estadoC);
      saida.dizNuncaEntrou = /Nunca entrou/i.test(saida.estadoD);
      // "nunca entrou" e "a sessão expirou" não podem sair com a MESMA frase.
      saida.becosDiferentes = saida.dizExpirou && saida.dizNuncaEntrou
                              && saida.estadoC !== saida.estadoD;

      // O sino, ligado e desligado.
      saida.sinoLigado    = /ligado/i.test(txt);
      saida.sinoDesligado = /desligado/i.test(txt);

      // Quem nem conta tem: o número aparece, e a lista começa ESCONDIDA.
      saida.avisaSemConta = /2 das 10 pessoas ativas ainda n[ãa]o t[êe]m login/i.test(txt);
      var btVer = Array.from(document.querySelectorAll('button')).find(function (x) {
        return /ver quem s[ãa]o/i.test(x.textContent || ''); });
      saida.temBotaoVer = !!btVer;
      saida.listaComecaEscondida = !/Sem Login Um/.test(txt);
      if (btVer) {
        btVer.click();
        await new Promise(function (s) { setTimeout(s, 60); });
        saida.abreAoClicar = /Sem Login Um/.test((document.getElementById('main-content')||document.body).innerText || '');
      }

      // Quem preocupa vem primeiro: "Nunca Entrou" antes de "Usou Hoje".
      var linhas = txt.split('\\n');
      var iNunca = linhas.findIndex(function (l) { return /Pessoa Dd/.test(l); });
      var iHoje  = linhas.findIndex(function (l) { return /Pessoa Aa/.test(l); });
      saida.ordemPreocupanteAntes = iNunca >= 0 && iHoje >= 0 && iNunca < iHoje;

      // O brasão da casa aparece aqui também (058).
      saida.temBrasao = !!document.querySelector('#main-content img[src*="brasoes"], #main-content picture');
      return saida;
    `,
  });

  const a = r.avaliado || {};
  exigir(!r.erroAvaliar, 'a aba Atividade abre e desenha', r.erroAvaliar);
  exigir(a.dizUsouHoje === true, 'quem usou hoje aparece como "Usou hoje"', 'a linha diz: ' + a.estadoA);
  exigir(a.dizSumiu === true, 'quem sumiu aparece com há quantos meses', 'a linha diz: ' + a.estadoB);
  exigir(a.dizExpirou === true, 'quem entrou uma vez e a sessão expirou tem a frase dela',
    'a linha diz: ' + a.estadoC);
  exigir(a.dizNuncaEntrou === true, 'quem nunca entrou tem a frase dela', 'a linha diz: ' + a.estadoD);
  exigir(a.becosDiferentes === true,
    '"nunca entrou" e "a sessão expirou" saem com frases DIFERENTES',
    'os dois becos viraram a mesma coisa — sessão expirou: "' + a.estadoC + '" / nunca entrou: "' + a.estadoD + '"');
  exigir(a.sinoLigado === true && a.sinoDesligado === true, 'o sino aparece ligado e desligado');
  exigir(a.avisaSemConta === true, 'avisa quantas pessoas ativas ainda não têm login',
    'sem isso a tela parece dizer que só 4 pessoas existem');
  exigir(a.temBotaoVer === true && a.listaComecaEscondida === true && a.abreAoClicar === true,
    'a lista de quem não tem conta começa escondida e abre no clique');
  exigir(a.ordemPreocupanteAntes === true, 'quem preocupa vem primeiro na lista',
    'a ordem se perdeu — quem nunca entrou ficou embaixo de quem usou hoje');
  exigir(a.temBrasao === true, 'o avatar traz o brasão da casa, como no resto do app');
}

async function provaAtividadeNaoTransformaErroEmZero(provas) {
  console.log('\n\x1b[1mConfig › Atividade: falha do banco não vira "ninguém usou"\x1b[0m');

  // Cicatriz do projeto: um 500 virou R$ 0,00 na tela por 17 horas. Uma tela de
  // atividade que engole o erro diria que o grupo inteiro sumiu — e alguém iria
  // cobrar 41 pessoas por causa de uma consulta que não foi.
  const r = await provas.abrir('config.html', {
    papel: PAPEIS.admin,
    rpcs: { acolitos_atividade_listar: { error: { message: 'boom' } } },
    avaliar: `
      secaoAtual = 'atividade';
      render();
      await new Promise(function (s) { setTimeout(s, 250); });
      var txt = (document.getElementById('main-content') || document.body).innerText || '';
      return { avisaFalha: /n[ãa]o consegui perguntar/i.test(txt),
               naoInventaZero: !/Nunca entraram\\s*0/i.test(txt) };
    `,
  });
  const a = r.avaliado || {};
  exigir(!r.erroAvaliar, 'a aba aguenta o banco recusar', r.erroAvaliar);
  exigir(a.avisaFalha === true, 'diz que não conseguiu perguntar, em vez de mostrar lista vazia',
    'a tela engoliu o erro — é assim que uma falha vira número e alguém decide por ele');
}

async function provaPessoasETimesFundidas(provas) {
  console.log('\n\x1b[1mPessoas & Times: uma seção só, e a ficha lê os times do BANCO\x1b[0m');

  // "Equipe & Permissões" e "Times" eram duas seções que se pisavam. Além da redundância, a
  // ficha de equipe era um TERCEIRO caminho para pôr gente em time: gravava `setores` na mão,
  // lia a lista FIXA do shared.js e não disparava a boas-vinda.
  //
  // O time desta prova (`comunicacao`) NÃO existe na const SETORES do código. Se ele aparecer
  // na ficha, é porque ela passou a ler o banco — que é o defeito que isto guarda.
  const PESSOA = {
    id: 'm1', nome: 'Ana Clara', eh_equipe: true, setores: [], permissoes: [],
    serve: true, nivel: 'aspirante', user_id: 'u9',
  };
  const r = await provas.abrir('config.html', {
    papel: PAPEIS.admin,
    tabelas: {
      acolitos_membros: { data: [PESSOA] },
      acolitos_listas: { data: [{ valor: 'comunicacao', label: 'Comunicação' }] },
    },
    passos: [
      { chamar: 'abrirSecao', args: ['pessoas'] },
      { clicar: 'Editar' },
    ],
    avaliar: `
      const saida = { passos: [] };
      var modal = document.querySelector('.modal-overlay.open .modal');
      saida.abriuFicha = !!modal;
      if (modal) {
        var t = (modal.innerText || '');
        saida.temEquipe = /equipe\\/coordena/i.test(t);
        saida.temEscalas = /escalas/i.test(t);
        saida.temTimes = /times/i.test(t);
        saida.temPermissoes = /permiss/i.test(t);
        // O time do BANCO, que não existe na lista fixa do código:
        saida.temTimeDoBanco = /Comunica/i.test(t);
        saida.usaListaFixa = /Almoxarifado|Tesouraria e Compras/i.test(t);
      }
      return saida;
    `,
  });

  // O MENU se mede com a seção FECHADA: abrir uma seção troca o menu pelo conteúdo dela, e
  // procurar o nome do item ali dava tanto o defeito falso quanto o verde falso do vizinho
  // ("não achei o item antigo" porque não havia menu nenhum na tela).
  const menu = await provas.abrir('config.html', { papel: PAPEIS.admin });
  const a = r.avaliado || {};
  exigir(r.passosFalhos.length === 0, 'a seção abre e a ficha da pessoa também', r.passosFalhos.join(' | '));
  exigir(/Pessoas & Times/.test(menu.texto), 'o menu mostra "Pessoas & Times"',
    'não achei o item novo no menu do Config');
  exigir(!/Equipe & Permiss/.test(menu.texto), 'e não mostra mais "Equipe & Permissões" separada',
    'sobrou o item antigo no menu — viraram três seções em vez de uma');
  exigir(a.abriuFicha === true, 'o botão Editar abre a ficha');
  // As quatro coisas na MESMA ficha: era isso que estava espalhado em dois modais.
  exigir(a.temEquipe && a.temEscalas && a.temTimes && a.temPermissoes,
    'a ficha traz equipe, escalas, times e permissões juntos',
    JSON.stringify({ equipe: a.temEquipe, escalas: a.temEscalas, times: a.temTimes, permissoes: a.temPermissoes }));
  exigir(a.temTimeDoBanco === true, 'os times da ficha vêm do BANCO',
    'o time "Comunicação" (que só existe no banco) não apareceu — a ficha ainda lê a lista fixa');
  exigir(a.usaListaFixa === false, 'e não da lista cravada no código',
    'apareceram times que só existem na const SETORES — a ficha está lendo as duas fontes');
}

async function provaEntrarNoTimeLiberaTarefas(provas) {
  console.log('\n\x1b[1mEntrar no time abre a aba Tarefas\x1b[0m');

  // A permissão `tarefas` nasce desmarcada e é ELA que abre a tela. Sem isto a pessoa recebia
  // a festa, tocava em "Ver as tarefas do time" e era mandada de volta para o Início sem uma
  // linha de explicação — time e permissão são coisas diferentes, e ninguém adivinha isso.
  //
  // Quem registra o que SERIA gravado é o próprio motor (`r.gravacoes`). Espionar `sb.from` na
  // mão não funciona: a cadeia do banco de mentira é um Proxy, e atribuir por cima dela não
  // pega — a prova ficava vermelha sem defeito nenhum no código.
  const r = await provas.abrir('index.html', {
    papel: PAPEIS.admin,
    avaliar: `
      await liberarAbaTarefas({ id: 'm1', permissoes: ['escala'] }, sb);
      await liberarAbaTarefas({ id: 'm2', permissoes: ['escala', 'tarefas'] }, sb);
      await liberarAbaTarefas({ id: 'm3', permissoes: null }, sb);
      return true;
    `,
  });

  exigir(!r.erroAvaliar, 'a liberação roda sem estourar', r.erroAvaliar);
  const perms = (r.gravacoes || [])
    .filter((g) => g.tabela === 'acolitos_membros' && g.acao === 'update')
    .map((g) => g.dados && g.dados.permissoes)
    .filter(Boolean);

  // Duas gravações, não três: quem JÁ tinha a permissão não pode ser tocado de novo.
  exigir(perms.length === 2, 'só grava para quem ainda não tinha a permissão',
    'gravou ' + perms.length + ' vez(es): ' + JSON.stringify(perms));
  // O ponto que mais dói se errar: acrescentar não pode APAGAR o que já estava lá.
  exigir(JSON.stringify(perms[0]) === JSON.stringify(['escala', 'tarefas']),
    'acrescenta sem apagar as permissões que a pessoa já tinha',
    'gravaria: ' + JSON.stringify(perms[0]));
  exigir(JSON.stringify(perms[1]) === JSON.stringify(['tarefas']),
    'quem não tinha permissão nenhuma ganha só a de Tarefas',
    'gravaria: ' + JSON.stringify(perms[1]));
}

async function provaNomeDaMaeTemOndeSerDigitado(provas) {
  console.log('\n\x1b[1mFicha da pessoa: o nome da mãe e do pai têm onde ser digitados\x1b[0m');

  // Até 31/08/2026 a aba Família começava em "Pai é ministro?" — perguntava se o pai é
  // ministro sem nunca ter perguntado QUEM é o pai. `nome_mae` e `nome_pai` não tinham
  // campo em NENHUMA tela: só eram gravados quando a própria família se cadastrava pela
  // tela de entrada, e para as 170 pessoas vindas da planilha ficavam vazios para sempre.
  // Não é campo decorativo: o nome da mãe é uma das DUAS provas que o app aceita para
  // reconhecer quem já existe no cadastro, e o cartão do CRM avisa "falta nome de
  // responsável" sem oferecer onde preencher.
  const PESSOA = {
    id: 'p1', nome: 'Pessoa de Teste', nivel: 'coroinha', status: 'ativo', serve: true,
    comunidade: 'matriz', permissoes: [], nome_mae: null, nome_pai: null, foto_url: null,
  };
  const r = await provas.abrir('membros.html', {
    papel: PAPEIS.admin,
    tabelas: { acolitos_membros: { data: [PESSOA] } },
    avaliar: `
      // abre a ficha e vai para a aba Família
      await abrirFicha(${JSON.stringify(PESSOA)});
      await new Promise(function (s) { setTimeout(s, 250); });
      await renderTab('Família');
      await new Promise(function (s) { setTimeout(s, 250); });

      // Procura pelo RÓTULO, não por posição: campo novo entra no meio e desloca índice.
      // E exige o rótulo EXATO — "Nome da mãe ministra" já existia e não é a mesma coisa;
      // medir por "contém nome da mãe" daria verde com o campo errado.
      function campoDe(rotulo) {
        var alvo = Array.from(document.querySelectorAll('label,div'))
          .filter(function (e) { return (e.textContent || '').trim() === rotulo; })
          .pop();
        if (!alvo) return null;
        var caixa = alvo.parentElement;
        return caixa ? caixa.querySelector('input') : null;
      }
      var mae = campoDe('Nome da mãe');
      var pai = campoDe('Nome do pai');
      var saida = { temMae: !!mae, temPai: !!pai };

      // E o nome NÃO pode ser pedido duas vezes. A aba tinha "Nome da mãe ministra" e
      // "Nome do pai ministro", que guardavam o MESMO nome — medido no cadastro em
      // 31/08/2026: 10 iguais na mãe, 9 no pai, zero divergindo. Ficaram só as marcas
      // de SER ministro; o nome mora num lugar só.
      var txt = (document.getElementById('main-content') || document.body).innerText || '';
      // SEM caixa fixa: innerText devolve o texto COMO O CSS MOSTRA, e estes rótulos saem
      // em maiúsculas. Regex sensível a caixa aqui acusa defeito num app correto.
      saida.pedeNomeDuasVezes = /nome da m[ãa]e ministra|nome do pai ministro/i.test(txt);
      saida.aindaPerguntaSeEhMinistro = /m[ãa]e [ée] ministra/i.test(txt) && /pai [ée] ministro/i.test(txt);

      // E o que interessa de verdade: digitar e mandar salvar tem de MANDAR para o banco.
      if (mae) {
        mae.value = 'Joana Ferreira dos Santos';
        mae.dispatchEvent(new Event('input', { bubbles: true }));
        await salvarFicha();
        await new Promise(function (s) { setTimeout(s, 250); });
      }
      return saida;
    `,
  });

  const a = r.avaliado || {};
  const escritas = (r.gravacoes || []).filter(g => g.tabela === 'acolitos_membros' && g.acao === 'update');
  const mandouMae = escritas.some(g => g.dados && 'nome_mae' in g.dados
                                    && g.dados.nome_mae === 'Joana Ferreira dos Santos');
  exigir(!r.erroAvaliar, 'a ficha abre e a aba Família desenha', r.erroAvaliar);
  exigir(a.temMae === true, 'existe um campo "Nome da mãe"',
    'sem ele, ninguém consegue preencher o dado que o próprio CRM cobra');
  exigir(a.temPai === true, 'existe um campo "Nome do pai"');
  exigir(a.pedeNomeDuasVezes === false,
    'o nome do pai e da mãe NÃO é pedido duas vezes',
    'voltaram os campos "Nome da mãe ministra"/"Nome do pai ministro", que guardavam o mesmo nome');
  exigir(a.aindaPerguntaSeEhMinistro === true,
    'mas continua perguntando SE o pai e a mãe são ministros',
    'essa é outra informação, e a Escala precisa dela');
  exigir(mandouMae === true, 'digitar o nome da mãe e salvar MANDA nome_mae para o banco',
    'o campo aparecer não basta: o Salvar tem de levar. Mandou: ' +
    JSON.stringify(escritas.map(e => Object.keys(e.dados || {}))));
}

async function provaTelefonePedidoQuandoAIdadeEDesconhecida(provas) {
  console.log('\n\x1b[1mComplete seu cadastro: idade desconhecida NÃO dispensa o telefone\x1b[0m');

  // O celular é obrigatório a partir dos 13. A regra antiga escrevia isso como
  // `!(idade > 12)`, e com a data de nascimento vazia a conta dá NULO — que não é maior
  // que 12, então o telefone era pulado. Em 31/08/2026 eram 28 fichas exatamente assim:
  // sem data, sem telefone nenhum, e o app não pedia justamente delas.
  const r = await provas.abrir('index.html', {
    papel: PAPEIS.membro,
    avaliar: `
      function chaves(m) { return camposIncompletos(m).map(function (c) { return c.key; }); }
      return {
        semData: chaves({ id:'x', data_nascimento: null,         telefone: null }),
        crianca: chaves({ id:'x', data_nascimento: '2020-01-01', telefone: null }),
        adolesc: chaves({ id:'x', data_nascimento: '2008-01-01', telefone: null }),
        jaTem:   chaves({ id:'x', data_nascimento: null,         telefone: '(19) 99999-0000' }),
      };
    `,
  });

  const a = r.avaliado || {};
  exigir(!r.erroAvaliar, 'a regra do cadastro incompleto roda', r.erroAvaliar);
  exigir((a.semData || []).includes('telefone') === true,
    'sem data de nascimento, o telefone É pedido',
    'idade desconhecida não é "menor de 13" — e são essas as fichas que menos têm telefone');
  exigir((a.crianca || []).includes('telefone') === false,
    'de quem tem 6 anos, o telefone NÃO é pedido',
    'a regra dos 13 anos continua valendo para quem se sabe a idade');
  exigir((a.adolesc || []).includes('telefone') === true,
    'de quem tem 18, o telefone é pedido');
  exigir((a.jaTem || []).includes('telefone') === false,
    'quem já tem telefone não é perguntado de novo');
}

async function provaAvisoDaCoordenacaoFicaNoApp(provas) {
  console.log('\n\x1b[1mAviso da coordenação: fica DENTRO do app, e o push é só o extra\x1b[0m');

  // O defeito: "Enviar aviso" mandava SÓ push. Push é tarja de celular — some quando a
  // pessoa dispensa, e só chega a quem ligou notificação. Nada era gravado, então o
  // sininho ficava vazio e o pop-up nunca abria. O leitor já existia (prioridade 0 da
  // fila, "avisos da coordenação"); só faltava alguém escrever.
  //
  // A ORDEM é o conserto, e é ela que esta prova defende: grava no app PRIMEIRO, manda o
  // push DEPOIS. Se inverterem, um push que falha volta a levar o aviso embora junto.
  //
  // Nada sai daqui para a rede: sb.rpc e apiPost são trocados por gravadores de chamada.
  // (sb é const — troca-se o MÉTODO, nunca a variável.)
  const r = await provas.abrir('caixa.html', {
    papel: PAPEIS.admin,
    avaliar: `
      const chamadas = [];
      sb.rpc = async function (nome, args) {
        chamadas.push({ quem: 'app', nome: nome, texto: args && args.p_texto, membros: args && args.p_membros });
        return { data: { ok: true, notificados: 177 }, error: null };
      };
      // O push FALHA de propósito: é o cenário que importa. O aviso já está no app.
      window.apiPost = async function (url, body) {
        chamadas.push({ quem: 'push', url: url });
        return { ok: false, data: { error: 'push fora do ar' } };
      };
      let ultimoToast = null;
      window.toast = function (msg, tipo) { ultimoToast = { msg: msg, tipo: tipo }; };

      avisarTodos();
      const modal = document.querySelector('.modal-overlay.open .modal');
      modal.querySelector('#av-msg').value = 'Reunião no sábado às 9h';
      modal.querySelector('#av-enviar').click();
      for (let i = 0; i < 60 && chamadas.length < 2; i++) await new Promise(function (f) { setTimeout(f, 25); });
      // Guardar AGORA: o 2º cenário escreve por cima de ultimoToast, e a prova passaria a
      // medir o toast errado — verde ou vermelho pelo motivo errado, que é pior que vermelho.
      const toast1 = ultimoToast;

      // 2º cenário: o app RECUSA a gravação. O push não pode sair.
      const chamadas2 = [];
      sb.rpc = async function () { chamadas2.push('app'); return { data: { erro: 'sem_permissao' }, error: null }; };
      window.apiPost = async function () { chamadas2.push('push'); return { ok: true, data: { enviados: 9 } }; };
      avisarTodos();
      const m2 = document.querySelector('.modal-overlay.open .modal');
      m2.querySelector('#av-msg').value = 'não pode passar';
      m2.querySelector('#av-enviar').click();
      for (let i = 0; i < 40 && !chamadas2.length; i++) await new Promise(function (f) { setTimeout(f, 25); });
      await new Promise(function (f) { setTimeout(f, 200); });

      return {
        ordem: chamadas.map(function (c) { return c.quem; }),
        texto: (chamadas[0] || {}).texto,
        membros: (chamadas[0] || {}).membros,
        nome: (chamadas[0] || {}).nome,
        toast: toast1,
        recusado: chamadas2,
        aviso: (modal.innerText || ''),
      };
    `,
  });

  const a = r.avaliado || {};
  exigir(!r.erroAvaliar, 'o envio de aviso roda sem estourar', r.erroAvaliar);
  exigir(a.nome === 'acolitos_avisar_todos',
    'o aviso é gravado no app (a função do banco é chamada)',
    'chamou: ' + JSON.stringify(a.nome));
  exigir(JSON.stringify(a.ordem) === JSON.stringify(['app', 'push']),
    'grava no app ANTES de mandar o push — nesta ordem',
    'ordem observada: ' + JSON.stringify(a.ordem));
  exigir(a.texto === 'Reunião no sábado às 9h',
    'o texto digitado chega inteiro ao banco',
    'chegou: ' + JSON.stringify(a.texto));
  exigir(a.membros === null || a.membros === undefined,
    '"Todos os membros" manda alvo vazio, que no banco significa todos');
  exigir(!!(a.toast && a.toast.tipo === 'success'),
    'push fora do ar NÃO vira erro: o aviso já está no app',
    'toast: ' + JSON.stringify(a.toast));
  exigir(/no app/i.test((a.toast && a.toast.msg) || ''),
    'e a mensagem diz à coordenação que foi entregue no app',
    'toast: ' + JSON.stringify(a.toast && a.toast.msg));
  exigir(JSON.stringify(a.recusado) === JSON.stringify(['app']),
    'se o app RECUSA a gravação, o push não sai',
    'chamadas: ' + JSON.stringify(a.recusado));
  exigir(/dentro do app/i.test(a.aviso || ''),
    'a tela não promete mais que só quem tem notificação recebe',
    'texto do modal: ' + JSON.stringify((a.aviso || '').slice(0, 160)));
}

async function provaBarraDeFiltroFunciona(provas) {
  console.log('\n\x1b[1mBarra de ordenar e filtrar: abre, filtra, conta e lembra\x1b[0m');

  // A barra é a mesma nas seis listas. Aqui ela é provada SOZINHA, numa lista de mentira
  // montada dentro da Caixa (que já carrega o shared.js), para que um defeito nela não se
  // confunda com um defeito de Membros.
  const r = await provas.abrir('caixa.html', {
    papel: PAPEIS.admin,
    avaliar: `
      try { localStorage.removeItem('filtro-lista:prova-barra'); } catch (e) {}
      const itens = [
        { nome: 'Ana', com: 'matriz' }, { nome: 'Bia', com: 'sa' }, { nome: 'Caio', com: 'matriz' },
      ];
      let erroNaContagem = false;
      const cfg = {
        chave: 'prova-barra', rotulo: ['pessoa', 'pessoas'], ordemPadrao: 'nome',
        ordens: [
          { id: 'nome', nome: 'Nome A–Z', valor: i => i.nome },
          { id: 'inverso', nome: 'Nome Z–A', desc: true, valor: i => i.nome },
        ],
        filtros: [{ id: 'com', nome: 'Comunidade', opcoes: [
          { id: 'matriz', nome: 'Matriz', testa: i => i.com === 'matriz' },
          { id: 'sa', nome: 'Santo Antônio', testa: i => i.com === 'sa' },
        ] }],
        busca: { placeholder: 'Buscar nome...', campos: i => [i.nome] },
        contar: e => { if (erroNaContagem) throw new Error('fora do ar'); return FiltroLista.aplicar(itens, e, cfg).length; },
      };
      const alvo = document.createElement('div'); document.body.appendChild(alvo);
      let mudancas = 0;
      const ctl = montarFiltroLista(alvo, cfg, () => { mudancas++; });
      const esperar = (ms) => new Promise(f => setTimeout(f, ms));
      const painel = () => document.querySelector('.modal-overlay.open .filtro-painel');
      const botaoNoPainel = (txt) => [...painel().querySelectorAll('button')].find(b => b.textContent.trim() === txt);

      const temBusca = !!alvo.querySelector('.filtro-barra .search-input');
      const contagemAntes = alvo.querySelector('.filtro-contagem').textContent;

      alvo.querySelector('.filtro-btn').click();
      const abriu = !!painel();
      botaoNoPainel('Matriz').click(); await esperar(30);
      const verComMatriz = painel().querySelector('.filtro-ver').textContent.trim();
      botaoNoPainel('Nome Z–A').click(); await esperar(30);
      // 120 ms depois de FECHAR, não 30: fechar a janela chama history.back(), que o navegador
      // roda depois. Abrir outra janela antes disso tira a página do lugar e o resultado da
      // prova volta vazio sem erro nenhum — foi isso que deu 21 falhas de uma vez em 17/09/2026.
      painel().querySelector('.filtro-ver').click(); await esperar(120);
      const fechou = !painel();
      const depois = ctl.aplicar(itens).map(i => i.nome);
      const contagemDepois = alvo.querySelector('.filtro-contagem').textContent;
      const etiquetas = [...alvo.querySelectorAll('.filtro-etiqueta')].map(b => b.textContent.trim());
      const ordemEscrita = (alvo.querySelector('.filtro-linha') || {}).textContent || '';
      const guardado = (() => { try { return localStorage.getItem('filtro-lista:prova-barra'); } catch (e) { return null; } })();

      // Remontar = reabrir a tela: a escolha tem de voltar.
      const ctl2 = montarFiltroLista(alvo, cfg, () => {});
      const lembrou = ctl2.aplicar(itens).map(i => i.nome);

      // Tirar pela etiqueta.
      alvo.querySelector('.filtro-etiqueta').click(); await esperar(30);
      const semEtiqueta = ctl2.aplicar(itens).length;

      // Limpar: liga o filtro de novo (para ter pelo menos um aceso) e tira todos de uma
      // vez, sem mexer na ordem escolhida (Z–A continua valendo desde lá em cima).
      alvo.querySelector('.filtro-btn').click(); await esperar(30);
      botaoNoPainel('Matriz').click(); await esperar(30);
      painel().querySelector('.filtro-ver').click(); await esperar(120);
      const etiquetasAntesDeLimpar = [...alvo.querySelectorAll('.filtro-etiqueta')].map(b => b.textContent.trim());
      const temLimparAntes = !!alvo.querySelector('.filtro-limpar');
      alvo.querySelector('.filtro-limpar').click(); await esperar(30);
      const etiquetasAposLimpar = [...alvo.querySelectorAll('.filtro-etiqueta')].map(b => b.textContent.trim());
      const contagemAposLimpar = alvo.querySelector('.filtro-contagem').textContent;
      const temLimparApos = !!alvo.querySelector('.filtro-limpar');
      const ordemAposLimpar = (alvo.querySelector('.filtro-linha') || {}).textContent || '';
      const semFiltroAposLimpar = ctl2.aplicar(itens).map(i => i.nome);

      // Contagem com erro: "Ver resultado", nunca "Ver 0".
      erroNaContagem = true;
      alvo.querySelector('.filtro-btn').click(); await esperar(50);
      const verComErro = painel().querySelector('.filtro-ver').textContent.trim();
      document.querySelector('.modal-overlay.open').click(); await esperar(120);
      const fechouSemAplicar = !painel();

      try { localStorage.removeItem('filtro-lista:prova-barra'); } catch (e) {}
      alvo.remove();
      return { temBusca, contagemAntes, abriu, verComMatriz, fechou, depois, contagemDepois,
               etiquetas, ordemEscrita, guardado: !!guardado, lembrou, semEtiqueta, verComErro,
               fechouSemAplicar, mudancas, etiquetasAntesDeLimpar, temLimparAntes,
               etiquetasAposLimpar, contagemAposLimpar, temLimparApos, ordemAposLimpar,
               semFiltroAposLimpar };
    `,
  });

  const a = r.avaliado || {};
  exigir(!r.erroAvaliar, 'a barra monta e o painel roda sem estourar', r.erroAvaliar);
  exigir(r.avaliado && typeof r.avaliado === 'object', 'a prova da barra chegou ao fim (a página não saiu do lugar)',
    'avaliado: ' + JSON.stringify(r.avaliado));
  exigir(a.temBusca === true, 'com busca declarada, o campo aparece na barra');
  exigir(a.contagemAntes === '', 'sem filtro, o botão não mostra número', 'mostrou: ' + JSON.stringify(a.contagemAntes));
  exigir(a.abriu === true, 'o botão Filtrar abre o painel');
  exigir(a.verComMatriz === 'Ver 2 pessoas', 'o painel conta ANTES de aplicar', 'mostrou: ' + JSON.stringify(a.verComMatriz));
  exigir(a.fechou === true, '"Ver" fecha o painel');
  exigir(JSON.stringify(a.depois) === JSON.stringify(['Caio', 'Ana']), 'aplica filtro E ordem juntos', 'saiu: ' + JSON.stringify(a.depois));
  exigir(a.contagemDepois === '1', 'o botão mostra quantos filtros estão ligados', 'mostrou: ' + JSON.stringify(a.contagemDepois));
  exigir(JSON.stringify(a.etiquetas) === JSON.stringify(['Matriz']), 'o filtro ligado vira etiqueta', 'saiu: ' + JSON.stringify(a.etiquetas));
  exigir(/Nome Z–A/.test(a.ordemEscrita || ''), 'a ordem escolhida fica escrita na tela', 'linha: ' + JSON.stringify(a.ordemEscrita));
  exigir(a.guardado === true, 'a escolha é guardada no aparelho');
  exigir(JSON.stringify(a.lembrou) === JSON.stringify(['Caio', 'Ana']), 'reabrir traz a escolha de volta', 'saiu: ' + JSON.stringify(a.lembrou));
  exigir(a.semEtiqueta === 3, 'o X da etiqueta tira o filtro', 'sobraram: ' + a.semEtiqueta);
  exigir(JSON.stringify(a.etiquetasAntesDeLimpar) === JSON.stringify(['Matriz']),
    'antes de tocar Limpar, a etiqueta do filtro está na tela (senão a prova não testa nada)',
    'saiu: ' + JSON.stringify(a.etiquetasAntesDeLimpar));
  exigir(a.temLimparAntes === true, 'com um filtro ligado, o botão Limpar aparece');
  exigir(JSON.stringify(a.etiquetasAposLimpar) === JSON.stringify([]),
    'Limpar tira TODAS as etiquetas de filtro de uma vez', 'saiu: ' + JSON.stringify(a.etiquetasAposLimpar));
  exigir(a.contagemAposLimpar === '', 'Limpar zera o número do botão Filtrar', 'mostrou: ' + JSON.stringify(a.contagemAposLimpar));
  exigir(a.temLimparApos === false, 'sem filtro ligado, o próprio botão Limpar some');
  exigir(/Nome Z–A/.test(a.ordemAposLimpar || ''),
    'Limpar não mexe na ordem escolhida — só tira os filtros', 'linha: ' + JSON.stringify(a.ordemAposLimpar));
  exigir(JSON.stringify(a.semFiltroAposLimpar) === JSON.stringify(['Caio', 'Bia', 'Ana']),
    'depois do Limpar, aplicar devolve a lista INTEIRA (sem os filtros), na ordem que ficou escolhida',
    'saiu: ' + JSON.stringify(a.semFiltroAposLimpar));
  exigir(a.verComErro === 'Ver resultado', 'contagem com erro NÃO vira "Ver 0"', 'mostrou: ' + JSON.stringify(a.verComErro));
  exigir(a.fechouSemAplicar === true, 'tocar fora fecha o painel');
  exigir(a.mudancas >= 1, 'a tela é avisada quando a escolha muda');
}

async function provaMembrosMostraQuemEntrouPorUltimo(provas) {
  console.log('\n\x1b[1mMembros: "mais recentes" mostra quem entrou por último\x1b[0m');

  // Os níveis são os slugs REAIS (acolito_guardiao, não "acolito" — "acolito" é só a
  // base, e um slug inexistente cai no primeiro nível da lista sem avisar).
  //
  // O pedido do dono, com a forma real do banco: a maioria cadastrada no MESMO instante (a
  // importação de 31/05 às 22:29 em Brasília — 01/06 em UTC), e poucos depois. O empate é o caso comum e tem de sair em ordem
  // alfabética, não embaralhado.
  const membros = [
    { id: 'm-bruno', nome: 'Bruno Lote', created_at: '2026-06-01T10:00:00+00:00', comunidade: 'matriz', foto_url: null, nivel: 'acolito_guardiao', status: 'ativo', data_nascimento: '2012-03-05' },
    { id: 'm-ana', nome: 'Ana Lote', created_at: '2026-06-01T10:00:00+00:00', comunidade: 'matriz', foto_url: 'https://x/a.jpg', nivel: 'acolito_aspirante', status: 'ativo', data_nascimento: null },
    { id: 'm-carla', nome: 'Carla Nova', created_at: '2026-08-27T12:00:00+00:00', comunidade: 'santo_antonio', foto_url: null, nivel: 'cerimoniario_aspirante', status: 'ativo', data_nascimento: null },
    { id: 'm-davi', nome: 'Davi Recente', created_at: '2026-08-10T12:00:00+00:00', comunidade: 'matriz', foto_url: null, nivel: 'coroinha', status: 'ativo', data_nascimento: null },
    // Instante real do lote de 01/06: 01:29:43 UTC, que em Brasília ainda é noite de 31/05
    // (22:29). É o mais antigo do lote — some no fim de "Mais recentes" — e serve para
    // provar que a legenda usa a data LOCAL, não a fatiada direto do UTC. Nome sem "lote"
    // e nível fora de "acolito" para não entrar na lista migrada (filtro nivel=acolito +
    // busca="lote") lá embaixo.
    { id: 'm-elisa', nome: 'Elisa Madrugada', created_at: '2026-06-01T01:29:43.956873+00:00', comunidade: 'matriz', foto_url: null, nivel: 'coroinha', status: 'ativo', data_nascimento: null },
  ];
  const cenario = (rpc) => `
    const esperar = (ms) => new Promise(f => setTimeout(f, ms));
    // Só o primeiro span: o bloco do nome carrega a estrela junto, que chega depois.
    const nomes = () => [...document.querySelectorAll('#grid .member-card-name')].map(e => ((e.querySelector('span') || e).textContent || '').trim());
    const painel = () => document.querySelector('.modal-overlay.open .filtro-painel');
    const tocar = (txt) => { const b = [...painel().querySelectorAll('button')].find(x => x.textContent.trim() === txt); if (!b) throw new Error('sem botão ' + txt); b.click(); };
    try { localStorage.removeItem('filtro-lista:membros'); localStorage.removeItem('estado-membros'); localStorage.setItem('membros-vista', 'cards'); } catch (e) {}
    vista = 'cards';
    await loadMembros(); await esperar(50);
    const r = { padrao: nomes() };
    r.temBarra = !!document.querySelector('#filtro-membros .filtro-barra .search-input');
    r.botoesVelhos = document.querySelectorAll('#filtros .form-toggle').length;
    document.querySelector('#filtro-membros .filtro-btn').click();
    // Largura de celular: o painel não pode dividir a linha em partes iguais e cortar o
    // nome da opção mais comprida ("Cerimoniários", "Próximos aniversários"...).
    painel().style.width = '358px'; painel().style.maxWidth = '358px';
    await new Promise(res => requestAnimationFrame(res));
    r.rotulosCortados = [...painel().querySelectorAll('.form-toggle')]
      .filter(b => b.scrollWidth > b.clientWidth + 1)
      .map(b => b.textContent.trim());
    r.filtrosNoPainel = [...painel().querySelectorAll('.filtro-painel-titulo')].map(e => e.textContent.trim());
    tocar('Mais recentes');
    ${rpc ? `tocar('Já entrou no app'); await esperar(30); r.ver = painel().querySelector('.filtro-ver').textContent.trim(); tocar('Já entrou no app'); await esperar(30);` : ''}
    painel().querySelector('.filtro-ver').click(); await esperar(50);
    r.recentes = nomes();
    r.legendas = [...document.querySelectorAll('#grid .filtro-legenda')].map(e => e.textContent.trim());
    // A prova não pode CRAVAR "31/05": o navegador que roda isto pode estar em qualquer
    // fuso. Em vez disso ela calcula, DENTRO da própria tela, o que a regra local e a
    // fatia ingênua de UTC dariam para o mesmo instante — e compara contra a legenda de
    // verdade. Se o fuso daqui não separar os dois (não vira dia anterior), a prova avisa
    // em vez de fingir que provou algo.
    const isoElisa = '2026-06-01T01:29:43.956873+00:00';
    r.dataUtcElisa = isoElisa.slice(8, 10) + '/' + isoElisa.slice(5, 7);
    r.dataLocalEsperadaElisa = new Date(isoElisa).toLocaleDateString('pt-BR').slice(0, 5);
    // estado antigo (antes da barra): nível "acolito" e busca "lote" têm de sobreviver
    try { localStorage.removeItem('filtro-lista:membros'); localStorage.setItem('estado-membros', JSON.stringify({ filtro: 'acolito', busca: 'lote', y: 0 })); } catch (e) {}
    await loadMembros(); await esperar(50);
    r.migrado = nomes();
    r.buscaMigrada = (document.querySelector('#filtro-membros .search-input') || {}).value;
    try { localStorage.removeItem('filtro-lista:membros'); localStorage.removeItem('estado-membros'); } catch (e) {}
    return r;
  `;

  const r = await provas.abrir('membros.html', {
    papel: PAPEIS.admin,
    tabelas: { acolitos_membros: { data: membros } },
    rpcs: { acolitos_membros_ja_entraram: { data: [{ membro_id: 'm-carla' }] } },
    avaliar: cenario(true),
  });
  const a = r.avaliado || {};
  exigir(!r.erroAvaliar, 'Membros abre com a barra sem estourar', r.erroAvaliar);
  exigir((r.erros || []).length === 0, 'nenhum erro de JavaScript na tela', (r.erros || []).join(' | '));
  exigir(a.temBarra === true, 'a busca mora na barra nova');
  exigir(a.botoesVelhos === 0, 'os botões de nível antigos saíram (viraram filtro no painel)');
  exigir(JSON.stringify(a.padrao) === JSON.stringify(['Ana Lote', 'Bruno Lote', 'Carla Nova', 'Davi Recente', 'Elisa Madrugada']),
    'abre em ordem alfabética, como antes', 'saiu: ' + JSON.stringify(a.padrao));
  exigir(JSON.stringify(a.filtrosNoPainel) === JSON.stringify(['Ordenar por', 'Nível', 'Comunidade', 'App', 'Foto']),
    'o painel oferece nível, comunidade, app e foto', 'saiu: ' + JSON.stringify(a.filtrosNoPainel));
  exigir((a.rotulosCortados || []).length === 0,
    'nenhuma opção do painel corta o texto em largura de celular', 'cortadas: ' + JSON.stringify(a.rotulosCortados));
  exigir(a.ver === 'Ver 1 membro', '"já entrou no app" conta pelo banco', 'mostrou: ' + JSON.stringify(a.ver));
  exigir(JSON.stringify(a.recentes) === JSON.stringify(['Carla Nova', 'Davi Recente', 'Ana Lote', 'Bruno Lote', 'Elisa Madrugada']),
    'MAIS RECENTES: quem entrou por último no topo, o lote em ordem alfabética, e o instante mais antigo do lote (madrugada) por último',
    'saiu: ' + JSON.stringify(a.recentes));
  exigir((a.legendas || [])[0] === 'cadastro 27/08',
    'a data do cadastro aparece embaixo do nome', 'saiu: ' + JSON.stringify(a.legendas));
  exigir(a.dataLocalEsperadaElisa !== a.dataUtcElisa,
    'esta prova precisa rodar num fuso onde 01:29 UTC ainda é o dia anterior (Brasília serve) — sem essa diferença o teste não tem como pegar o defeito',
    'UTC deu ' + a.dataUtcElisa + ' e a data local também deu ' + a.dataLocalEsperadaElisa + ' — rode com o relógio do sistema em America/Sao_Paulo');
  exigir((a.legendas || [])[4] === 'cadastro ' + a.dataLocalEsperadaElisa,
    'a legenda de "cadastro" usa a data LOCAL do created_at, não a fatia crua do UTC (01:29 UTC de 01/06 é 22:29 de 31/05 em Brasília)',
    'saiu: ' + JSON.stringify(a.legendas) + ' — esperava terminar em "cadastro ' + a.dataLocalEsperadaElisa + '"');
  exigir(JSON.stringify(a.migrado) === JSON.stringify(['Ana Lote', 'Bruno Lote']),
    'o filtro guardado antes da barra (nível + busca) não se perde', 'saiu: ' + JSON.stringify(a.migrado));
  exigir(a.buscaMigrada === 'lote', 'e a busca guardada volta para o campo', 'campo: ' + JSON.stringify(a.buscaMigrada));

  // Banco fora do ar para "quem já entrou": o filtro App SOME. Mostrar todo mundo como
  // "nunca entrou" seria falha virando número.
  const r2 = await provas.abrir('membros.html', {
    papel: PAPEIS.admin,
    tabelas: { acolitos_membros: { data: membros } },
    rpcs: { acolitos_membros_ja_entraram: { error: { message: 'sem_permissao', code: '42501' } } },
    avaliar: cenario(false),
  });
  const b = r2.avaliado || {};
  exigir(!r2.erroAvaliar, 'com a função recusando, Membros abre mesmo assim', r2.erroAvaliar);
  exigir(JSON.stringify(b.filtrosNoPainel) === JSON.stringify(['Ordenar por', 'Nível', 'Comunidade', 'Foto']),
    'sem resposta do banco, o filtro App não aparece (em vez de mentir)', 'saiu: ' + JSON.stringify(b.filtrosNoPainel));
  exigir((b.rotulosCortados || []).length === 0,
    'sem o filtro App, as opções restantes também não cortam o texto', 'cortadas: ' + JSON.stringify(b.rotulosCortados));
}

async function provaBarraMostraSoOQueATelaOferece(provas) {
  console.log('\n\x1b[1mBarra de filtro: mostra só o que a tela oferece\x1b[0m');

  // A Agenda só ordena por data; o CRM não tem filtro. Uma seção "Ordenar por" com uma
  // opção só, ou um botão "Filtrar" que abre só ordens, são enfeite que confunde.
  const r = await provas.abrir('caixa.html', {
    papel: PAPEIS.admin,
    avaliar: `
      const esperar = (ms) => new Promise(f => setTimeout(f, ms));
      const painel = () => document.querySelector('.modal-overlay.open .filtro-painel');
      const titulos = () => [...painel().querySelectorAll('.filtro-painel-titulo')].map(e => e.textContent.trim());
      const fechar = () => { const ov = document.querySelector('.modal-overlay.open'); if (ov) ov.remove(); };
      const itens = [{ nome: 'Ana', t: 'a' }, { nome: 'Bia', t: 'b' }];
      const out = {};
      try { ['prova-uma-ordem', 'prova-sem-filtro', 'prova-nada'].forEach(k => localStorage.removeItem('filtro-lista:' + k)); } catch (e) {}

      // 1) uma ordem só + um filtro
      const a1 = document.createElement('div'); document.body.appendChild(a1);
      const c1 = { chave: 'prova-uma-ordem', rotulo: ['item', 'itens'], ordemPadrao: 'data',
        ordens: [{ id: 'data', nome: 'Data', valor: i => i.nome }],
        filtros: [{ id: 't', nome: 'Tipo', opcoes: [{ id: 'a', nome: 'Tipo A', testa: i => i.t === 'a' }] }],
        contar: e => FiltroLista.aplicar(itens, e, c1).length };
      montarFiltroLista(a1, c1, () => {});
      out.botao1 = a1.querySelector('.filtro-btn').textContent.trim();
      out.linha1 = (a1.querySelector('.filtro-linha') || {}).textContent || '';
      a1.querySelector('.filtro-btn').click(); await esperar(30);
      out.titulos1 = titulos();
      fechar(); a1.remove();
      // O app fecha modal via history.back() (Voltar do navegador fecha o modal — Spec D).
      // Isso é assíncrono: abrir o próximo modal antes desse popstate assentar atropela o
      // histórico e navega para trás de verdade. 80ms dá folga de sobra.
      await esperar(80);

      // 2) duas ordens, nenhum filtro
      const a2 = document.createElement('div'); document.body.appendChild(a2);
      const c2 = { chave: 'prova-sem-filtro', rotulo: ['item', 'itens'], ordemPadrao: 'az',
        ordens: [{ id: 'az', nome: 'Nome A–Z', valor: i => i.nome }, { id: 'za', nome: 'Nome Z–A', desc: true, valor: i => i.nome }],
        filtros: [],
        busca: { placeholder: 'Buscar...', campos: i => [i.nome] },
        contar: e => FiltroLista.aplicar(itens, e, c2).length };
      montarFiltroLista(a2, c2, () => {});
      out.botao2 = a2.querySelector('.filtro-btn').textContent.trim();
      out.linha2 = (a2.querySelector('.filtro-linha') || {}).textContent || '';
      a2.querySelector('.filtro-btn').click(); await esperar(30);
      out.titulos2 = titulos();
      fechar(); a2.remove();

      // 3) uma ordem só, nenhum filtro, com busca: não há o que escolher no painel
      const a3 = document.createElement('div'); document.body.appendChild(a3);
      const c3 = { chave: 'prova-nada', rotulo: ['item', 'itens'], ordemPadrao: 'data',
        ordens: [{ id: 'data', nome: 'Data', valor: i => i.nome }],
        filtros: [],
        busca: { placeholder: 'Buscar...', campos: i => [i.nome] },
        contar: e => FiltroLista.aplicar(itens, e, c3).length };
      montarFiltroLista(a3, c3, () => {});
      const b3 = a3.querySelector('.filtro-btn');
      out.botao3Visivel = !!b3 && b3.style.display !== 'none';
      out.busca3 = !!a3.querySelector('.search-input');
      a3.remove();

      try { ['prova-uma-ordem', 'prova-sem-filtro', 'prova-nada'].forEach(k => localStorage.removeItem('filtro-lista:' + k)); } catch (e) {}
      return out;
    `,
  });
  const a = r.avaliado || {};
  exigir(!r.erroAvaliar, 'as três formas da barra montam sem estourar', r.erroAvaliar);
  exigir(/^Filtrar/.test(a.botao1 || ''), 'com filtro, o botão continua "Filtrar"', 'botão: ' + JSON.stringify(a.botao1));
  exigir(JSON.stringify(a.titulos1) === JSON.stringify(['Tipo']), 'com UMA ordem, o painel não tem "Ordenar por"', 'seções: ' + JSON.stringify(a.titulos1));
  exigir(!/Data/.test(a.linha1 || ''), 'com UMA ordem, o nome da ordem não aparece solto na tela', 'linha: ' + JSON.stringify(a.linha1));
  exigir(/^Ordenar/.test(a.botao2 || ''), 'sem filtro, o botão se chama "Ordenar"', 'botão: ' + JSON.stringify(a.botao2));
  exigir(JSON.stringify(a.titulos2) === JSON.stringify(['Ordenar por']), 'sem filtro, o painel só tem "Ordenar por"', 'seções: ' + JSON.stringify(a.titulos2));
  exigir(/Nome A–Z/.test(a.linha2 || ''), 'com duas ordens, a ordem escolhida continua escrita', 'linha: ' + JSON.stringify(a.linha2));
  exigir(a.botao3Visivel === false, 'sem nada a escolher, o botão some', 'visível: ' + a.botao3Visivel);
  exigir(a.busca3 === true, 'e a busca continua lá');
}

async function provaAgendaFiltra(provas) {
  console.log('\n\x1b[1mAgenda: a barra filtra a linha do tempo e o calendário\x1b[0m');

  // Datas relativas a HOJE, calculadas agora: a linha do tempo só mostra o que está por vir,
  // e uma data cravada envelheceria até a prova mentir.
  const dia = (n) => { const d = new Date(); d.setDate(d.getDate() + n);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const celebracoes = [
    { id: 'c1', data: dia(1), horario: '19:00', comunidade: 'matriz', tipo: 'missa_comum', observacoes: null },
    { id: 'c2', data: dia(2), horario: '08:00', comunidade: 'santo_antonio', tipo: 'missa_comum', observacoes: null },
  ];
  const eventos = [
    { id: 'e1', titulo: 'Ensaio geral', tipo: 'ensaio', data: dia(1), hora: '15:00:00', hora_fim: null, local: null },
    { id: 'e2', titulo: 'Retiro', tipo: 'retiro', data: dia(3), hora: null, hora_fim: null, local: null },
  ];
  const r = await provas.abrir('agenda.html', {
    papel: PAPEIS.admin,
    tabelas: { acolitos_celebracoes: { data: celebracoes }, acolitos_eventos: { data: eventos }, acolitos_listas: { data: [] } },
    avaliar: `
      const esperar = (ms) => new Promise(f => setTimeout(f, ms));
      const titulos = () => [...document.querySelectorAll('#main-content .ag-tit')].map(e => e.textContent.trim());
      const painel = () => document.querySelector('.modal-overlay.open .filtro-painel');
      const abrir = async () => { document.querySelector('#main-content .filtro-btn').click(); await esperar(30); };
      const tocar = (txt) => { const b = [...painel().querySelectorAll('button')].find(x => x.textContent.trim() === txt); if (!b) throw new Error('sem botão ' + txt); b.click(); };
      const ver = async () => { painel().querySelector('.filtro-ver').click(); await esperar(120); };
      const limpar = async () => { const l = document.querySelector('#main-content .filtro-limpar'); if (l) { l.click(); await esperar(120); } };
      const guarda = (k) => { try { localStorage.removeItem(k); } catch (e) {} };
      guarda('filtro-lista:agenda'); guarda('agenda-tl-filtro');
      const out = {};

      viewMode = 'linha'; await reload(); await esperar(60);
      out.botoesVelhos = document.querySelectorAll('.tl-filtros').length;
      out.temBusca = !!document.querySelector('#main-content .filtro-barra .search-input');
      out.padrao = titulos();
      await abrir();
      out.secoes = [...painel().querySelectorAll('.filtro-painel-titulo')].map(e => e.textContent.trim());
      out.tiposOferecidos = [...painel().querySelectorAll('.filtro-painel-secao')][1]
        ? [...[...painel().querySelectorAll('.filtro-painel-secao')][1].querySelectorAll('.form-toggle')].map(b => b.textContent.trim()) : [];
      tocar('Eventos'); await esperar(30);
      out.verEventos = painel().querySelector('.filtro-ver').textContent.trim();
      await ver();
      out.soEventos = titulos();
      await limpar();

      await abrir(); tocar('Ensaio'); await ver();
      out.soEnsaio = titulos();
      await limpar();

      await abrir(); tocar('Santo Antônio'); await ver();
      out.comunidadeSA = titulos();
      await limpar();

      // o calendário usa o mesmo filtro, no painel do dia
      await abrir(); tocar('Celebrações'); await ver();
      viewMode = 'cal'; selDate = celebs.length ? '${dia(1)}' : selDate; render(); await esperar(60);
      out.diaSoCelebracao = titulos();
      // dia(3) só tem o Retiro (evento) — com "Mostrar: Celebrações" ligado, o filtro
      // é quem esvazia o dia, e o aviso tem de dizer isso (não "nada marcado" seco).
      selDate = '${dia(3)}'; render(); await esperar(60);
      out.diaVazioComFiltro = (document.querySelector('#main-content .ag-empty') || {}).textContent || '';
      await limpar();
      viewMode = 'linha'; await reload(); await esperar(60);

      // a escolha guardada nos botões antigos (Tudo/Celebrações/Eventos) não se perde
      guarda('filtro-lista:agenda');
      try { localStorage.setItem('agenda-tl-filtro', 'celeb'); } catch (e) {}
      await reload(); await esperar(60);
      out.migrado = titulos();
      out.etiquetaMigrada = [...document.querySelectorAll('#main-content .filtro-etiqueta')].map(e => e.textContent.trim());
      out.chaveVelhaSumiu = (() => { try { return localStorage.getItem('agenda-tl-filtro') === null; } catch (e) { return null; } })();

      guarda('filtro-lista:agenda'); guarda('agenda-tl-filtro');
      return out;
    `,
  });
  const a = r.avaliado || {};
  exigir(!r.erroAvaliar, 'a Agenda filtra sem estourar', r.erroAvaliar);
  exigir(r.avaliado && typeof r.avaliado === 'object', 'a prova da Agenda chegou ao fim (a página não saiu do lugar)', 'avaliado: ' + JSON.stringify(r.avaliado));
  exigir((r.erros || []).length === 0, 'nenhum erro de JavaScript na Agenda', (r.erros || []).join(' | '));
  exigir(a.botoesVelhos === 0, 'os botões Tudo/Celebrações/Eventos viraram filtro no painel');
  exigir(a.temBusca === false, 'a Agenda não ganhou busca (não foi pedida)');
  exigir(JSON.stringify(a.padrao) === JSON.stringify(['Ensaio geral', 'Missa', 'Missa', 'Retiro']),
    'sem filtro, a linha do tempo segue na ordem de data e hora', 'saiu: ' + JSON.stringify(a.padrao));
  exigir(JSON.stringify(a.secoes) === JSON.stringify(['Mostrar', 'Tipo de evento', 'Comunidade (missas)']),
    'o painel oferece Mostrar, Tipo de evento e Comunidade — e não "Ordenar por"', 'saiu: ' + JSON.stringify(a.secoes));
  exigir((a.tiposOferecidos || []).includes('Ensaio') && (a.tiposOferecidos || []).includes('Retiro'),
    'os tipos de evento vêm da lista configurável', 'saiu: ' + JSON.stringify(a.tiposOferecidos));
  exigir(a.verEventos === 'Ver 2 itens', 'o painel conta antes de aplicar', 'mostrou: ' + JSON.stringify(a.verEventos));
  exigir(JSON.stringify(a.soEventos) === JSON.stringify(['Ensaio geral', 'Retiro']), '"Eventos" esconde as celebrações', 'saiu: ' + JSON.stringify(a.soEventos));
  exigir(JSON.stringify(a.soEnsaio) === JSON.stringify(['Ensaio geral']), 'um tipo de evento mostra só ele', 'saiu: ' + JSON.stringify(a.soEnsaio));
  exigir(JSON.stringify(a.comunidadeSA) === JSON.stringify(['Ensaio geral', 'Missa', 'Retiro']),
    'comunidade filtra as missas e mantém os eventos', 'saiu: ' + JSON.stringify(a.comunidadeSA));
  exigir(JSON.stringify(a.diaSoCelebracao) === JSON.stringify(['Missa']), 'no calendário, o dia também obedece ao filtro', 'saiu: ' + JSON.stringify(a.diaSoCelebracao));
  exigir(/com esses filtros/.test(a.diaVazioComFiltro || ''), 'o dia vazio pelo FILTRO diz isso no painel do dia', 'saiu: ' + JSON.stringify(a.diaVazioComFiltro));
  exigir(JSON.stringify(a.migrado) === JSON.stringify(['Missa', 'Missa']), 'a escolha antiga "Celebrações" continua valendo', 'saiu: ' + JSON.stringify(a.migrado));
  exigir(JSON.stringify(a.etiquetaMigrada) === JSON.stringify(['Celebrações']), 'e aparece como etiqueta', 'saiu: ' + JSON.stringify(a.etiquetaMigrada));
  exigir(a.chaveVelhaSumiu === true, 'a chave antiga é convertida uma vez só');
}

async function provaCrmOrdenaEBusca(provas) {
  console.log('\n\x1b[1mCRM: ordenar e buscar no quadro e na lista\x1b[0m');

  // O CRM já abria com quem está parado há mais tempo (a pergunta da coordenação ali é
  // "quem está esquecido?"). A barra mantém isso como padrão e acrescenta as outras ordens.
  const pessoa = (id, nome, criado) => ({ id, nome, apelido: null, data_nascimento: '2012-01-01',
    comunidade: 'matriz', status: 'em_integracao', created_at: criado });
  // Três pessoas em "integracao". A ficha chega na ordem Ana, Zeca, Bia — que não é nem o
  // padrão (Zeca, Bia, Ana), nem Nome A–Z (Ana, Bia, Zeca), nem Mais recentes (Bia, Zeca,
  // Ana). Só assim a prova pega qualquer uma das três ordens presa na ordem de chegada —
  // com só duas pessoas (versão anterior), ou com a ficha já em ordem alfabética (rodada
  // 1 do conserto), um defeito nessas ordens passaria sem ser notado.
  const crm = [
    { id: 'k1', membro_id: 'p1', etapa: 'integracao', etapa_iniciada_em: '2026-09-05T12:00:00+00:00', acolitos_membros: pessoa('p1', 'Ana Velha', '2026-05-10T12:00:00+00:00') },
    { id: 'k3', membro_id: 'p3', etapa: 'integracao', etapa_iniciada_em: '2026-07-01T12:00:00+00:00', acolitos_membros: pessoa('p3', 'Zeca Antigo', '2026-06-20T12:00:00+00:00') },
    { id: 'k2', membro_id: 'p2', etapa: 'integracao', etapa_iniciada_em: '2026-08-01T12:00:00+00:00', acolitos_membros: pessoa('p2', 'Bia Nova', '2026-09-01T01:30:00+00:00') },
    { id: 'k4', membro_id: 'p4', etapa: 'tunica', etapa_iniciada_em: '2026-08-10T12:00:00+00:00', acolitos_membros: pessoa('p4', 'Caio Meio', '2026-08-01T12:00:00+00:00') },
  ];
  const r = await provas.abrir('crm.html', {
    papel: PAPEIS.admin,
    tabelas: { acolitos_crm: { data: crm }, acolitos_crm_comentarios: { data: [] }, acolitos_crm_historico: { data: [] } },
    avaliar: `
      const esperar = (ms) => new Promise(f => setTimeout(f, ms));
      const guarda = () => { try { localStorage.removeItem('filtro-lista:crm'); } catch (e) {} };
      const coluna = (i) => [...document.querySelectorAll('#view-pipeline .crm-col')[i].querySelectorAll('.crm-card-name')].map(e => e.textContent.trim());
      const painel = () => document.querySelector('.modal-overlay.open .filtro-painel');
      const tocar = (txt) => { const b = [...painel().querySelectorAll('button')].find(x => x.textContent.trim() === txt); if (!b) throw new Error('sem botão ' + txt); b.click(); };
      const escolher = async (txt) => { document.querySelector('#filtro-crm .filtro-btn').click(); await esperar(30); tocar(txt); await esperar(30); painel().querySelector('.filtro-ver').click(); await esperar(120); };
      guarda();
      currentView = 'pipeline'; montarFiltroCrm(); await loadCrm(); await esperar(60);
      const out = {};
      out.botao = document.querySelector('#filtro-crm .filtro-btn').textContent.trim();
      out.temBusca = !!document.querySelector('#filtro-crm .search-input');
      out.colIntegracaoPadrao = coluna(ETAPAS.indexOf('integracao'));
      document.querySelector('#filtro-crm .filtro-btn').click(); await esperar(30);
      out.secoes = [...painel().querySelectorAll('.filtro-painel-titulo')].map(e => e.textContent.trim());
      document.querySelector('.modal-overlay.open').remove();
      await esperar(120);

      await escolher('Nome A–Z');
      out.colIntegracaoNome = coluna(ETAPAS.indexOf('integracao'));

      await escolher('Mais recentes');
      out.colIntegracaoRecentes = coluna(ETAPAS.indexOf('integracao'));
      const leg = document.querySelector('#view-pipeline .filtro-legenda');
      out.legenda = leg ? leg.textContent.trim() : null;
      out.legendaEsperada = 'cadastro ' + new Date('2026-09-01T01:30:00+00:00').toLocaleDateString('pt-BR').slice(0, 5);

      const inp = document.querySelector('#filtro-crm .search-input');
      inp.value = 'bia'; inp.dispatchEvent(new Event('input')); await esperar(60);
      out.cartoesComBusca = [...document.querySelectorAll('#view-pipeline .crm-card-name')].map(e => e.textContent.trim());
      out.kpiTotal = [...document.querySelectorAll('#crm-kpis .kpi-card')].map(c => c.querySelector('.kpi-value').textContent.trim())[1];

      setView('lista'); await esperar(60);
      out.linhasComBusca = [...document.querySelectorAll('#crm-tbody tr td:first-child')].map(e => e.textContent.trim());
      inp.value = 'ninguem-assim'; inp.dispatchEvent(new Event('input')); await esperar(60);
      out.listaVazia = (document.querySelector('#crm-tbody') || {}).textContent || '';
      setView('pipeline');

      guarda();
      return out;
    `,
  });
  const a = r.avaliado || {};
  exigir(!r.erroAvaliar, 'o CRM ordena e busca sem estourar', r.erroAvaliar);
  exigir(r.avaliado && typeof r.avaliado === 'object', 'a prova do CRM chegou ao fim (a página não saiu do lugar)', 'avaliado: ' + JSON.stringify(r.avaliado));
  exigir((r.erros || []).length === 0, 'nenhum erro de JavaScript no CRM', (r.erros || []).join(' | '));
  exigir(/^Ordenar/.test(a.botao || ''), 'sem filtro, o botão do CRM se chama "Ordenar"', 'botão: ' + JSON.stringify(a.botao));
  exigir(a.temBusca === true, 'o CRM tem busca por nome');
  exigir(JSON.stringify(a.secoes) === JSON.stringify(['Ordenar por']), 'o painel do CRM só oferece ordens', 'saiu: ' + JSON.stringify(a.secoes));
  exigir(JSON.stringify(a.colIntegracaoPadrao) === JSON.stringify(['Zeca Antigo', 'Bia Nova', 'Ana Velha']),
    'o padrão continua: quem está parado há mais tempo primeiro', 'saiu: ' + JSON.stringify(a.colIntegracaoPadrao));
  exigir(JSON.stringify(a.colIntegracaoNome) === JSON.stringify(['Ana Velha', 'Bia Nova', 'Zeca Antigo']), 'Nome A–Z ordena dentro da coluna', 'saiu: ' + JSON.stringify(a.colIntegracaoNome));
  exigir(JSON.stringify(a.colIntegracaoRecentes) === JSON.stringify(['Bia Nova', 'Zeca Antigo', 'Ana Velha']), 'Mais recentes põe o cadastro mais novo primeiro', 'saiu: ' + JSON.stringify(a.colIntegracaoRecentes));
  exigir(a.legenda === a.legendaEsperada, 'a data do cadastro aparece no cartão, no horário local', 'saiu: ' + JSON.stringify(a.legenda) + ' esperado ' + JSON.stringify(a.legendaEsperada));
  exigir(JSON.stringify(a.cartoesComBusca) === JSON.stringify(['Bia Nova']), 'a busca vale no quadro', 'saiu: ' + JSON.stringify(a.cartoesComBusca));
  exigir(a.kpiTotal === '4', 'os números do topo não mudam com a busca (são do funil inteiro)', 'saiu: ' + JSON.stringify(a.kpiTotal));
  exigir(JSON.stringify(a.linhasComBusca) === JSON.stringify(['Bia Nova']), 'e a busca vale na lista', 'saiu: ' + JSON.stringify(a.linhasComBusca));
  exigir(/Ninguém com essa busca/.test(a.listaVazia || ''), 'busca sem resultado diz isso, e não "nenhum membro em onboarding"', 'saiu: ' + JSON.stringify(a.listaVazia));
}

async function provaChamadaFiltra(provas) {
  console.log('\n\x1b[1mChamada: filtra a missa e a situação, sem mexer no que já foi marcado\x1b[0m');

  // A Chamada é usada NA HORA. O filtro esconde linhas, não redesenha a tela — redesenhar
  // apagaria o substituto escolhido. E marcar alguém não esconde a linha na frente de quem
  // marca: o seletor de substituto do "ausente" mora embaixo dela.
  const dia = (n) => { const d = new Date(); d.setDate(d.getDate() + n);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const missas = [
    { id: 'ce1', data: dia(1), horario: '19:00', comunidade: 'matriz', tipo: 'missa_comum', acolitos_escalas: [{ id: 'x1' }, { id: 'x2' }, { id: 'x3' }] },
    { id: 'ce2', data: dia(2), horario: '08:00', comunidade: 'santo_antonio', tipo: 'missa_comum', acolitos_escalas: [{ id: 'x4' }] },
  ];
  const escalas = [
    { id: 'es1', funcao: 'altar', status: 'escalado', membro_id: 'm1', acolitos_membros: { nome: 'Ana Altar', foto_url: null, nivel: 'acolito_guardiao' } },
    { id: 'es2', funcao: 'cruz', status: 'presente', membro_id: 'm2', acolitos_membros: { nome: 'Bruno Cruz', foto_url: null, nivel: 'acolito_guardiao' } },
    { id: 'es3', funcao: 'vela', status: 'escalado', membro_id: 'm3', acolitos_membros: { nome: 'Caio Vela', foto_url: null, nivel: 'coroinha' } },
  ];
  // m4 não está escalado nesta missa (eligiveis() descarta quem já está) — só ele pode
  // aparecer como substituto de 'altar', e só porque tem a habilitação abaixo.
  const roster = { membros: [
    { id: 'm1', nome: 'Ana Altar' }, { id: 'm2', nome: 'Bruno Cruz' }, { id: 'm3', nome: 'Caio Vela' },
    { id: 'm4', nome: 'Duda Reserva' },
  ], habs: [ { membro_id: 'm4', funcao: 'altar', proficiencia: 'apto' } ] };
  const r = await provas.abrir('chamada.html', {
    papel: PAPEIS.admin,
    tabelas: { acolitos_celebracoes: { data: missas }, acolitos_escalas: { data: escalas }, acolitos_chamadas_itens: { data: [] } },
    rpcs: { acolitos_roster_substituicao: { data: roster }, acolitos_avulsos_celebracao: { data: [] }, acolitos_chamada_responsavel: { data: null } },
    avaliar: `
      const esperar = (ms) => new Promise(f => setTimeout(f, ms));
      const guarda = () => { try { localStorage.removeItem('filtro-lista:chamada-missas'); localStorage.removeItem('filtro-lista:chamada-lista'); } catch (e) {} };
      const painel = () => document.querySelector('.modal-overlay.open .filtro-painel');
      const escolher = async (alvo, txt) => { document.querySelector(alvo + ' .filtro-btn').click(); await esperar(30);
        const b = [...painel().querySelectorAll('button')].find(x => x.textContent.trim() === txt); if (!b) throw new Error('sem botão ' + txt);
        b.click(); await esperar(30); painel().querySelector('.filtro-ver').click(); await esperar(120); };
      const tirar = async (alvo) => { const l = document.querySelector(alvo + ' .filtro-limpar'); if (l) { l.click(); await esperar(120); } };
      const visiveis = () => [...document.querySelectorAll('[data-escala-id]')].filter(b => b.style.display !== 'none')
        .map(b => b.querySelector('.chamada-nome-el').textContent.trim());
      const catsVisiveis = () => [...document.querySelectorAll('[data-cat]')].filter(h => h.style.display !== 'none').map(h => h.textContent.trim());
      guarda();
      const out = {};

      await renderSelecao(); await esperar(60);
      out.missas = document.querySelectorAll('.celeb-opt').length;
      out.botaoMissas = (document.querySelector('#filtro-missas .filtro-btn') || {}).textContent;
      await escolher('#filtro-missas', 'Santo Antônio');
      out.missasSA = document.querySelectorAll('.celeb-opt').length;
      await tirar('#filtro-missas');

      await abrirChamada(missas_[0]); await esperar(80);
      out.todos = visiveis();
      await escolher('#filtro-chamada', 'Ainda sem marcar');
      out.semMarcar = visiveis();
      out.catsSemMarcar = catsVisiveis();
      setRes('es1', 'ausente'); await esperar(30);
      out.depoisDeMarcar = visiveis();
      const subRow = document.querySelector('[data-escala-id="es1"] .sub-row');
      out.substitutoAparece = !!subRow && subRow.style.display !== 'none';
      await tirar('#filtro-chamada');

      // Fix3: o substituto escolhido tem de sobreviver a uma troca de filtro — é a razão
      // dada para o filtro ESCONDER linhas em vez de redesenhar a tela.
      const subSel = document.querySelector('[data-escala-id="es1"] .sub-sel');
      subSel.value = 'm4'; subSel.dispatchEvent(new Event('change')); await esperar(30);
      out.substitutoEscolhido = substitutos['es1'];
      await escolher('#filtro-chamada', 'Presentes');
      out.presentes = visiveis();
      out.catsPresentes = catsVisiveis();
      out.resultadoGuardado = resultados['es1'];
      out.botoesVisiveisComFiltro = [...document.querySelectorAll('[data-escala-id]')]
        .filter(b => b.style.display !== 'none')
        .reduce((n, b) => n + b.querySelectorAll('.r-btn').length, 0);
      out.substitutoSelectDepoisDoFiltro = document.querySelector('[data-escala-id="es1"] .sub-sel').value;
      await tirar('#filtro-chamada');
      out.substitutoSelectDepoisDeLimpar = document.querySelector('[data-escala-id="es1"] .sub-sel').value;
      out.substitutoObjetoDepoisDeLimpar = substitutos['es1'];

      // Fix1: a "Situação" descreve UMA missa, não uma preferência. Deixamos o filtro
      // "Presentes" LIGADO de propósito (sem tirar) e reabrimos a MESMA missa — é o que
      // acontece de verdade quando a próxima missa abre, ou quando "Limpar chamada" chama
      // abrirChamada de novo.
      await escolher('#filtro-chamada', 'Presentes');
      await abrirChamada(missas_[0]); await esperar(80);
      out.todosDepoisDeReabrir = visiveis();
      out.etiquetaChamadaReaberta = [...document.querySelectorAll('#filtro-chamada .filtro-etiqueta')].map(e => e.textContent.trim());
      out.vazioEscondidoReaberta = (document.getElementById('chamada-filtro-vazio') || {}).style.display;

      // Já a escolha da MISSA (comunidade) é preferência normal — continua valendo entre
      // aberturas da tela de seleção.
      await renderSelecao(); await esperar(60);
      await escolher('#filtro-missas', 'Santo Antônio');
      await renderSelecao(); await esperar(60);
      out.missasSADepoisDeReabrirSelecao = document.querySelectorAll('.celeb-opt').length;
      await tirar('#filtro-missas');

      guarda();
      return out;
    `.replace(/missas_\[0\]/g, JSON.stringify(missas[0])),
  });
  const a = r.avaliado || {};
  exigir(!r.erroAvaliar, 'a Chamada filtra sem estourar', r.erroAvaliar);
  exigir(r.avaliado && typeof r.avaliado === 'object', 'a prova da Chamada chegou ao fim (a página não saiu do lugar)', 'avaliado: ' + JSON.stringify(r.avaliado));
  exigir((r.erros || []).length === 0, 'nenhum erro de JavaScript na Chamada', (r.erros || []).join(' | '));
  exigir(a.missas === 2, 'sem filtro, aparecem as duas missas', 'saiu: ' + a.missas);
  exigir(/^Filtrar/.test(a.botaoMissas || ''), 'a escolha da missa tem o botão Filtrar', 'botão: ' + JSON.stringify(a.botaoMissas));
  exigir(a.missasSA === 1, 'comunidade filtra as missas', 'saiu: ' + a.missasSA);
  exigir(JSON.stringify(a.todos) === JSON.stringify(['Ana Altar', 'Bruno Cruz', 'Caio Vela']), 'sem filtro, a chamada mostra todo mundo na ordem de sempre', 'saiu: ' + JSON.stringify(a.todos));
  exigir(JSON.stringify(a.semMarcar) === JSON.stringify(['Ana Altar', 'Caio Vela']), '"Ainda sem marcar" esconde quem já foi marcado', 'saiu: ' + JSON.stringify(a.semMarcar));
  exigir(JSON.stringify(a.catsSemMarcar) === JSON.stringify(['Altares', 'Litúrgicos']), 'os títulos de grupo com gente visível continuam', 'saiu: ' + JSON.stringify(a.catsSemMarcar));
  exigir(JSON.stringify(a.depoisDeMarcar) === JSON.stringify(['Ana Altar', 'Caio Vela']), 'marcar alguém NÃO esconde a linha na frente de quem marca', 'saiu: ' + JSON.stringify(a.depoisDeMarcar));
  exigir(a.substitutoAparece === true, 'e o seletor de substituto do ausente fica à vista');
  exigir(a.substitutoEscolhido === 'm4', 'dá para escolher um substituto elegível', 'saiu: ' + JSON.stringify(a.substitutoEscolhido));
  exigir(JSON.stringify(a.presentes) === JSON.stringify(['Bruno Cruz']), '"Presentes" mostra só os presentes', 'saiu: ' + JSON.stringify(a.presentes));
  exigir(JSON.stringify(a.catsPresentes) === JSON.stringify(['Litúrgicos']), 'grupo sem ninguém visível some junto', 'saiu: ' + JSON.stringify(a.catsPresentes));
  exigir(a.resultadoGuardado === 'ausente', 'filtrar não apaga o que foi marcado', 'saiu: ' + JSON.stringify(a.resultadoGuardado));
  exigir(a.botoesVisiveisComFiltro === 3, 'os botões de marcar visíveis batem com quem está à vista sob o filtro (3, só o Bruno)', 'saiu: ' + a.botoesVisiveisComFiltro);
  exigir(a.substitutoSelectDepoisDoFiltro === 'm4', 'o substituto escolhido continua no seletor com o filtro ligado (a linha só ficou escondida, não sumiu)', 'saiu: ' + JSON.stringify(a.substitutoSelectDepoisDoFiltro));
  exigir(a.substitutoSelectDepoisDeLimpar === 'm4', 'e continua depois de limpar o filtro', 'saiu: ' + JSON.stringify(a.substitutoSelectDepoisDeLimpar));
  exigir(a.substitutoObjetoDepoisDeLimpar === 'm4', 'o objeto substitutos também não perdeu a escolha', 'saiu: ' + JSON.stringify(a.substitutoObjetoDepoisDeLimpar));
  exigir(JSON.stringify(a.todosDepoisDeReabrir) === JSON.stringify(['Ana Altar', 'Bruno Cruz', 'Caio Vela']),
    'o filtro de Situação NÃO passa de uma missa para a outra — a próxima missa abre com todo mundo à vista', 'saiu: ' + JSON.stringify(a.todosDepoisDeReabrir));
  exigir(JSON.stringify(a.etiquetaChamadaReaberta) === JSON.stringify([]), 'e sem etiqueta de filtro na barra da chamada', 'saiu: ' + JSON.stringify(a.etiquetaChamadaReaberta));
  exigir(a.vazioEscondidoReaberta === 'none', 'o aviso "Ninguém nesta situação" fica escondido ao reabrir', 'saiu: ' + JSON.stringify(a.vazioEscondidoReaberta));
  exigir(a.missasSADepoisDeReabrirSelecao === 1, 'já a comunidade da escolha de missa é preferência normal e continua valendo', 'saiu: ' + a.missasSADepoisDeReabrirSelecao);
}

async function provaBarraBuscaNoPainelEEscolhaUnica(provas) {
  console.log('\n\x1b[1mBarra de filtro: busca dentro do painel e escolha única\x1b[0m');

  // Ausências filtra por pessoa: são 177, não cabem em botões. O painel mostra as escolhidas
  // e só as que batem com o que se digita. Período é de escolha única.
  const r = await provas.abrir('caixa.html', {
    papel: PAPEIS.admin,
    avaliar: `
      const esperar = (ms) => new Promise(f => setTimeout(f, ms));
      try { localStorage.removeItem('filtro-lista:prova-busca'); } catch (e) {}
      const nomes = ['Ana Clara', 'Ana Lúcia'];
      for (let i = 1; i <= 30; i++) nomes.push('Pessoa ' + String(i).padStart(2, '0'));
      const cfg = {
        chave: 'prova-busca', rotulo: ['item', 'itens'], ordemPadrao: 'x',
        ordens: [{ id: 'x', nome: 'X', valor: () => '' }],
        filtros: [
          { id: 'pessoa', nome: 'Pessoa', busca: { placeholder: 'Buscar pessoa...', max: 8 },
            opcoes: nomes.map((n, i) => ({ id: 'p' + i, nome: n, testa: () => true })) },
          { id: 'periodo', nome: 'Período', unico: true, opcoes: [
            { id: 'este_mes', nome: 'Este mês', testa: () => true },
            { id: 'mes_passado', nome: 'Mês passado', testa: () => true },
          ] },
        ],
        contar: () => 0,
      };
      const alvo = document.createElement('div'); document.body.appendChild(alvo);
      montarFiltroLista(alvo, cfg, () => {});
      const painel = () => document.querySelector('.modal-overlay.open .filtro-painel');
      const secao = (i) => painel().querySelectorAll('.filtro-painel-secao')[i];
      const botoes = (i) => [...secao(i).querySelectorAll('.form-toggle')].map(b => b.textContent.trim());
      const dica = (i) => ((secao(i).querySelector('.filtro-painel-dica') || {}).textContent || '').trim();
      const digitar = async (txt) => { const inp = secao(0).querySelector('.filtro-painel-busca'); inp.value = txt; inp.dispatchEvent(new Event('input')); await esperar(20); };
      const out = {};

      alvo.querySelector('.filtro-btn').click(); await esperar(30);
      out.temCampo = !!secao(0).querySelector('.filtro-painel-busca');
      out.semTermo = botoes(0);
      out.dicaSemTermo = dica(0);
      await digitar('ana');
      out.comAna = botoes(0);
      await digitar('pessoa');
      out.quantasPessoa = botoes(0).length;
      await digitar('zzz');
      out.dicaSemAchar = dica(0);
      await digitar('ana');
      [...secao(0).querySelectorAll('.form-toggle')].find(b => b.textContent.trim() === 'Ana Lúcia').click(); await esperar(30);
      out.termoDepoisDeTocar = secao(0).querySelector('.filtro-painel-busca').value;
      out.depoisDeTocar = botoes(0);
      await digitar('');
      out.soEscolhida = botoes(0);

      const tocarPeriodo = async (txt) => { [...secao(1).querySelectorAll('.form-toggle')].find(b => b.textContent.trim() === txt).click(); await esperar(30); };
      await tocarPeriodo('Este mês');
      await tocarPeriodo('Mês passado');
      out.periodoLigados = [...secao(1).querySelectorAll('.form-toggle')].filter(b => b.getAttribute('aria-checked') === 'true').map(b => b.textContent.trim());
      out.papelPeriodo = secao(1).querySelector('.form-toggle').getAttribute('role');
      out.papelPessoa = secao(0).querySelector('.form-toggle').getAttribute('role');

      painel().querySelector('.filtro-ver').click(); await esperar(120);
      out.etiquetas = [...alvo.querySelectorAll('.filtro-etiqueta')].map(b => b.textContent.trim());
      try { localStorage.removeItem('filtro-lista:prova-busca'); } catch (e) {}
      alvo.remove();
      return out;
    `,
  });
  const a = r.avaliado || {};
  exigir(!r.erroAvaliar, 'a busca no painel roda sem estourar', r.erroAvaliar);
  exigir(r.avaliado && typeof r.avaliado === 'object', 'a prova da busca chegou ao fim (a página não saiu do lugar)', 'avaliado: ' + JSON.stringify(r.avaliado));
  exigir(a.temCampo === true, 'filtro com lista longa ganha campo de busca no painel');
  exigir(JSON.stringify(a.semTermo) === '[]' && a.dicaSemTermo === 'Digite para buscar.', 'sem digitar, não despeja a lista inteira', 'botões: ' + JSON.stringify(a.semTermo) + ' dica: ' + JSON.stringify(a.dicaSemTermo));
  exigir(JSON.stringify(a.comAna) === JSON.stringify(['Ana Clara', 'Ana Lúcia']), 'a busca acha pelo nome, com ou sem acento', 'saiu: ' + JSON.stringify(a.comAna));
  exigir(a.quantasPessoa === 8, 'a busca mostra no máximo o limite (8)', 'saiu: ' + a.quantasPessoa);
  exigir(a.dicaSemAchar === 'Ninguém com esse nome.', 'busca sem resultado diz isso', 'saiu: ' + JSON.stringify(a.dicaSemAchar));
  exigir(a.termoDepoisDeTocar === 'ana', 'tocar numa pessoa não apaga o que foi digitado', 'campo: ' + JSON.stringify(a.termoDepoisDeTocar));
  exigir(JSON.stringify(a.depoisDeTocar) === JSON.stringify(['Ana Lúcia', 'Ana Clara']), 'a escolhida vem primeiro', 'saiu: ' + JSON.stringify(a.depoisDeTocar));
  exigir(JSON.stringify(a.soEscolhida) === JSON.stringify(['Ana Lúcia']), 'com o campo vazio, a escolhida continua à vista', 'saiu: ' + JSON.stringify(a.soEscolhida));
  exigir(JSON.stringify(a.periodoLigados) === JSON.stringify(['Mês passado']), 'período é de escolha única', 'saiu: ' + JSON.stringify(a.periodoLigados));
  exigir(a.papelPeriodo === 'radio' && a.papelPessoa === 'checkbox', 'escolha única é anunciada como opção única', 'papéis: ' + a.papelPeriodo + '/' + a.papelPessoa);
  exigir(JSON.stringify(a.etiquetas) === JSON.stringify(['Ana Lúcia', 'Mês passado']), 'as escolhas viram etiquetas', 'saiu: ' + JSON.stringify(a.etiquetas));
}

async function provaAvisosDeAusenciaFiltramNaConsulta(provas) {
  console.log('\n\x1b[1mAusências › Avisos: o filtro vai para a CONSULTA, e erro é erro\x1b[0m');

  // O banco falso do harness ignora filtros. Então esta prova olha a PERGUNTA que a tela faz
  // ao banco — é ela que garante que a pessoa com 30 ausências não aparece com 2.
  const roster = { membros: [
    { id: 'u-ana', nome: 'Ana Souza', apelido: null }, { id: 'u-bia', nome: 'Beatriz Lima', apelido: 'Bia' },
  ], habs: [] };
  const r = await provas.abrir('ausencias.html', {
    papel: PAPEIS.admin,
    rpcs: { acolitos_roster_substituicao: { data: roster } },
    avaliar: `
      const esperar = (ms) => new Promise(f => setTimeout(f, ms));
      const guarda = () => { try { localStorage.removeItem('filtro-lista:ausencias-avisos'); } catch (e) {} };
      guarda();
      const consultas = [];
      let modo = 'ok';
      const linhas = Array.from({ length: 60 }, (_, i) => ({ id: 'a' + i, membro_id: i % 2 ? 'u-bia' : 'u-ana',
        celebracao_id: 'c' + i, motivo: 'viagem', observacao: null, created_at: '2026-09-0' + (1 + i % 9) + 'T12:00:00+00:00',
        missa_data: '2026-09-1' + (i % 9), missa_horario: '19:00', missa_comunidade: 'matriz' }));
      const orig = sb.from.bind(sb);
      sb.from = (t) => {
        if (t !== 'acolitos_ausencias_v') return orig(t);
        const reg = { chamadas: [] }; consultas.push(reg);
        const resp = () => {
          const soContar = reg.chamadas.some(c => c[0] === 'select' && c[2] && c[2].head);
          if (modo === 'erro') return { data: null, count: null, error: { message: 'fora do ar' } };
          if (soContar) return { data: null, count: 1202, error: null };
          return { data: modo === 'vazio' ? [] : linhas, count: modo === 'vazio' ? 0 : 1202, error: null };
        };
        const p = new Proxy({}, { get: (_, k) => k === 'then'
          ? (ok, ko) => Promise.resolve(resp()).then(ok, ko)
          : (...args) => { reg.chamadas.push([k, ...args]); return p; } });
        return p;
      };
      const ultimaLista = () => [...consultas].reverse().find(c => !c.chamadas.some(x => x[0] === 'select' && x[2] && x[2].head));
      const tem = (c, ...alvo) => !!c && c.chamadas.some(x => JSON.stringify(x.slice(0, alvo.length)) === JSON.stringify(alvo));
      const painel = () => document.querySelector('.modal-overlay.open .filtro-painel');
      const abrir = async () => { document.querySelector('#filtro-avisos .filtro-btn').click(); await esperar(40); };
      const ver = async () => { painel().querySelector('.filtro-ver').click(); await esperar(150); };
      const tocar = (txt) => { const b = [...painel().querySelectorAll('.form-toggle')].find(x => x.textContent.trim() === txt); if (!b) throw new Error('sem opção ' + txt); b.click(); };
      const limpar = async () => { const l = document.querySelector('#filtro-avisos .filtro-limpar'); if (l) { l.click(); await esperar(150); } };
      const texto = () => (document.getElementById('lista-avisos') || {}).textContent || '';
      const out = {};

      abaAusencias = 'avisos'; await renderViewEquipe(); await esperar(80);
      const primeira = ultimaLista();
      // Sem período, a aba abre com "próximas primeiro" (Fix 1 da revisão de 17/09) — ISSO
      // sempre acrescenta um gte(missa_data), que não é filtro escolhido pela pessoa. O que
      // continua valendo é: sem pessoa/comunidade/motivo escolhidos, nenhum IN entra na consulta.
      out.semFiltroSemIn = !!primeira && !primeira.chamadas.some(x => x[0] === 'in');
      out.ordemPadrao = tem(primeira, 'order', 'missa_data');
      out.limite = tem(primeira, 'limit', 60);
      out.mostrando = /Mostrando 60 de 1202/.test(texto());
      out.nomeDoRoster = /Ana Souza/.test(texto()) && /Bia/.test(texto());

      await abrir();
      out.secoes = [...painel().querySelectorAll('.filtro-painel-titulo')].map(e => e.textContent.trim());
      const campo = painel().querySelector('.filtro-painel-busca');
      campo.value = 'bia'; campo.dispatchEvent(new Event('input')); await esperar(20);
      tocar('Bia · Beatriz Lima'); await esperar(60);
      out.verComPessoa = painel().querySelector('.filtro-ver').textContent.trim();
      const contagem = [...consultas].reverse().find(c => c.chamadas.some(x => x[0] === 'select' && x[2] && x[2].head));
      out.contagemComPessoa = tem(contagem, 'in', 'membro_id', ['u-bia']);
      await ver();
      out.listaComPessoa = tem(ultimaLista(), 'in', 'membro_id', ['u-bia']);
      await limpar();

      await abrir(); tocar('Este mês'); await ver();
      const iv = FiltroLista.intervaloDoPeriodo('este_mes', hojeLocal());
      out.periodo = tem(ultimaLista(), 'gte', 'missa_data', iv.desde) && tem(ultimaLista(), 'lte', 'missa_data', iv.ate);
      await limpar();

      await abrir(); tocar('Santo Antônio'); tocar('Viagem'); await ver();
      out.comunidadeEMotivo = tem(ultimaLista(), 'in', 'missa_comunidade', ['santo_antonio']) && tem(ultimaLista(), 'in', 'motivo', ['viagem']);
      out.motivoSemEmoji = [...document.querySelectorAll('#filtro-avisos .filtro-etiqueta')].map(e => e.textContent.trim());
      await limpar();

      await abrir(); tocar('Quando avisou'); await ver();
      out.ordemAviso = tem(ultimaLista(), 'order', 'created_at');

      modo = 'vazio'; await abrir(); tocar('Santo Antônio'); await ver();
      out.vazioComFiltro = texto();
      await limpar();
      modo = 'erro'; await recarregarAvisos(); await esperar(60);
      out.comErro = texto();

      guarda(); sb.from = orig;
      return out;
    `,
  });
  const a = r.avaliado || {};
  exigir(!r.erroAvaliar, 'a aba Avisos filtra sem estourar', r.erroAvaliar);
  exigir(r.avaliado && typeof r.avaliado === 'object', 'a prova dos Avisos chegou ao fim (a página não saiu do lugar)', 'avaliado: ' + JSON.stringify(r.avaliado));
  // No fim, a prova FORÇA uma consulta que falha (modo = 'erro') para provar que a tela
  // mostra erro — e a tela registra isso com console.error, como o resto do app (mesmo
  // padrão de 'Faltas: consulta falhou', 5 linhas abaixo, e de caixa.html). Esse ÚNICO
  // console.error é esperado; qualquer OUTRO continua reprovando a prova.
  const errosInesperados = (r.erros || []).filter(e => !/Avisos: consulta falhou/.test(e));
  exigir(errosInesperados.length === 0, 'nenhum erro de JavaScript inesperado em Ausências', errosInesperados.join(' | '));
  exigir(a.semFiltroSemIn === true, 'sem filtro, a consulta não filtra nada');
  exigir(a.ordemPadrao === true, 'a ordem padrão é pela data da missa');
  exigir(a.limite === true, 'a lista continua vindo em pedaços de 60');
  exigir(a.mostrando === true, 'a tela diz que mostra 60 de 1202 — não finge que é tudo');
  exigir(a.nomeDoRoster === true, 'os nomes vêm do cadastro seguro (vale para o cerimoniário)');
  exigir(JSON.stringify(a.secoes) === JSON.stringify(['Ordenar por', 'Pessoa', 'Período (data da missa)', 'Comunidade', 'Motivo']),
    'o painel oferece ordem, pessoa, período, comunidade e motivo', 'saiu: ' + JSON.stringify(a.secoes));
  exigir(a.contagemComPessoa === true, 'o "Ver N" pergunta ao BANCO com a pessoa escolhida');
  exigir(a.verComPessoa === 'Ver 1202 avisos', 'o "Ver N" mostra o número que o banco deu', 'mostrou: ' + JSON.stringify(a.verComPessoa));
  exigir(a.listaComPessoa === true, 'escolher a pessoa MUDA A CONSULTA (não filtra os 60 que vieram)');
  exigir(a.periodo === true, 'o período vira intervalo de datas na consulta');
  exigir(a.comunidadeEMotivo === true, 'comunidade e motivo também vão para a consulta');
  exigir(JSON.stringify(a.motivoSemEmoji) === JSON.stringify(['Santo Antônio', 'Viagem']), 'as etiquetas de motivo saem sem emoji', 'saiu: ' + JSON.stringify(a.motivoSemEmoji));
  exigir(a.ordemAviso === true, '"Quando avisou" ordena pela data do aviso');
  exigir(/Nenhum aviso com esses filtros/.test(a.vazioComFiltro || ''), 'filtro sem resultado diz isso', 'saiu: ' + JSON.stringify(a.vazioComFiltro));
  exigir(/Não foi possível carregar os avisos/.test(a.comErro || '') && !/Nenhum/.test(a.comErro || ''),
    'consulta com erro mostra ERRO, nunca "nenhum"', 'saiu: ' + JSON.stringify(a.comErro));
}

async function provaFaltasFiltramNaConsulta(provas) {
  console.log('\n\x1b[1mAusências › Faltas: o filtro vai para a função do banco, e "sem acesso" é dito\x1b[0m');
  const roster = { membros: [{ id: 'u-ana', nome: 'Ana Souza', apelido: null }], habs: [] };
  const faltas = Array.from({ length: 80 }, (_, i) => ({ membro_id: 'u-ana', membro: 'Ana Souza', funcao: 'vela',
    data: '2026-08-' + String(1 + i % 28).padStart(2, '0'), horario: '19:00', comunidade: 'matriz', substituto: null }));
  const abrirFaltas = (rpcs, avaliar) => provas.abrir('ausencias.html', { papel: PAPEIS.admin, rpcs, avaliar });
  const cenario = `
    const esperar = (ms) => new Promise(f => setTimeout(f, ms));
    try { localStorage.removeItem('filtro-lista:ausencias-faltas'); } catch (e) {}
    const chamadas = [];
    const origRpc = sb.rpc.bind(sb);
    sb.rpc = async (nome, args) => { chamadas.push([nome, args || null]); return origRpc(nome, args); };
    abaAusencias = 'faltas'; await renderViewEquipe(); await esperar(80);
    const out = { texto: (document.getElementById('lista-faltas') || document.getElementById('main-content')).textContent,
                  temBarra: !!document.querySelector('#filtro-faltas .filtro-btn') };
    out.usouAntiga = chamadas.some(c => c[0] === 'acolitos_faltas_recentes');
    out.primeira = chamadas.filter(c => c[0] === 'acolitos_faltas_filtradas')[0] || null;
    if (out.temBarra) {
      const painel = () => document.querySelector('.modal-overlay.open .filtro-painel');
      document.querySelector('#filtro-faltas .filtro-btn').click(); await esperar(40);
      out.secoes = [...painel().querySelectorAll('.filtro-painel-titulo')].map(e => e.textContent.trim());
      const campo = painel().querySelector('.filtro-painel-busca');
      campo.value = 'ana'; campo.dispatchEvent(new Event('input')); await esperar(20);
      [...painel().querySelectorAll('.form-toggle')].find(b => b.textContent.trim() === 'Ana Souza').click(); await esperar(30);
      [...painel().querySelectorAll('.form-toggle')].find(b => b.textContent.trim() === 'Mês passado').click(); await esperar(60);
      out.contar = chamadas.filter(c => c[0] === 'acolitos_faltas_contar').pop() || null;
      out.ver = painel().querySelector('.filtro-ver').textContent.trim();
      painel().querySelector('.filtro-ver').click(); await esperar(150);
      out.lista = chamadas.filter(c => c[0] === 'acolitos_faltas_filtradas').pop() || null;
      out.iv = FiltroLista.intervaloDoPeriodo('mes_passado', hojeLocal());
      out.mostrando = (document.getElementById('lista-faltas') || {}).textContent || '';
    }
    try { localStorage.removeItem('filtro-lista:ausencias-faltas'); } catch (e) {}
    sb.rpc = origRpc;
    return out;
  `;

  const r = await abrirFaltas({ acolitos_roster_substituicao: { data: roster }, acolitos_faltas_filtradas: { data: faltas }, acolitos_faltas_contar: { data: 357 } }, cenario);
  const a = r.avaliado || {};
  exigir(!r.erroAvaliar, 'a aba Faltas filtra sem estourar', r.erroAvaliar);
  exigir(r.avaliado && typeof r.avaliado === 'object', 'a prova das Faltas chegou ao fim (a página não saiu do lugar)', 'avaliado: ' + JSON.stringify(r.avaliado));
  exigir(a.usouAntiga === false && !!a.primeira, 'a aba usa a função NOVA, com filtros', 'antiga: ' + a.usouAntiga);
  exigir(JSON.stringify(a.secoes) === JSON.stringify(['Pessoa', 'Período (data da missa)', 'Comunidade']),
    'o painel das faltas oferece pessoa, período e comunidade — sem "Ordenar por"', 'saiu: ' + JSON.stringify(a.secoes));
  exigir(!!a.contar && JSON.stringify(a.contar[1] && a.contar[1].p_membros) === JSON.stringify(['u-ana']),
    'o "Ver N" pergunta ao banco com a pessoa escolhida', 'args: ' + JSON.stringify(a.contar));
  exigir(a.ver === 'Ver 357 faltas', 'o "Ver N" mostra o número do banco', 'mostrou: ' + JSON.stringify(a.ver));
  exigir(!!a.lista && JSON.stringify(a.lista[1].p_membros) === JSON.stringify(['u-ana'])
    && a.lista[1].p_desde === a.iv.desde && a.lista[1].p_ate === a.iv.ate,
    'escolher pessoa e período MUDA A CONSULTA', 'args: ' + JSON.stringify(a.lista) + ' esperado ' + JSON.stringify(a.iv));
  exigir(/Mostrando 80 de 357/.test(a.mostrando || ''), 'a aba diz que mostra 80 de 357', 'saiu: ' + JSON.stringify((a.mostrando || '').slice(0, 80)));

  const r2 = await abrirFaltas({ acolitos_roster_substituicao: { data: roster }, acolitos_faltas_filtradas: { error: { message: 'sem_permissao', code: '42501' } }, acolitos_faltas_contar: { error: { message: 'sem_permissao', code: '42501' } } }, cenario);
  const b = r2.avaliado || {};
  exigir(/Você não tem acesso às faltas/.test(b.texto || '') && !/Nenhuma/.test(b.texto || ''),
    'sem permissão, a aba diz isso — e não "nenhuma falta"', 'saiu: ' + JSON.stringify(b.texto));
  exigir(b.temBarra === false, 'sem permissão, a barra de filtro não aparece');

  const r3 = await abrirFaltas({ acolitos_roster_substituicao: { data: roster }, acolitos_faltas_filtradas: { error: { message: 'fora do ar' } }, acolitos_faltas_contar: { data: 0 } }, cenario);
  const c = r3.avaliado || {};
  exigir(/Não foi possível carregar as faltas/.test(c.texto || '') && !/Nenhuma/.test(c.texto || ''),
    'erro de consulta mostra erro, não "nenhuma"', 'saiu: ' + JSON.stringify(c.texto));
  exigir(c.temBarra === true, 'erro genérico não é falta de acesso — a barra continua ali', 'temBarra: ' + c.temBarra);

  // "Fix round 1", achado 1: a primeira carga tem de usar o filtro GUARDADO, não o padrão —
  // senão quem já tinha escolhido uma pessoa vê "Mostrando 80 de 357" SEM filtro por um
  // instante, antes da lista filtrada substituir (o "flash" sem filtro).
  const cenarioSalvo = `
    const esperar = (ms) => new Promise(f => setTimeout(f, ms));
    try { localStorage.removeItem('filtro-lista:ausencias-faltas'); } catch (e) {}
    await carregarRosterAus();
    const cfg = configFiltroFaltas(rosterMembrosAus);
    const estadoSalvo = FiltroLista.alternar(FiltroLista.estadoInicial(cfg), cfg, 'pessoa', 'u-ana');
    try { localStorage.setItem('filtro-lista:ausencias-faltas', FiltroLista.guardar(estadoSalvo)); } catch (e) {}
    const chamadas = [];
    const origRpc = sb.rpc.bind(sb);
    sb.rpc = async (nome, args) => { chamadas.push([nome, args || null]); return origRpc(nome, args); };
    abaAusencias = 'faltas'; await renderViewEquipe(); await esperar(80);
    const listas = chamadas.filter(c => c[0] === 'acolitos_faltas_filtradas');
    const out = {
      primeiraTemPessoa: !!listas[0] && JSON.stringify(listas[0][1] && listas[0][1].p_membros) === JSON.stringify(['u-ana']),
      quantasListas: listas.length,
    };
    try { localStorage.removeItem('filtro-lista:ausencias-faltas'); } catch (e) {}
    sb.rpc = origRpc;
    return out;
  `;
  const r4 = await abrirFaltas({ acolitos_roster_substituicao: { data: roster }, acolitos_faltas_filtradas: { data: faltas }, acolitos_faltas_contar: { data: 357 } }, cenarioSalvo);
  const d = r4.avaliado || {};
  exigir(!r4.erroAvaliar, 'a prova do filtro guardado roda sem estourar', r4.erroAvaliar);
  exigir(d.primeiraTemPessoa === true, 'a PRIMEIRA carga já sai com o filtro guardado — sem flash sem filtro', 'saiu: ' + JSON.stringify(d));
  exigir(d.quantasListas === 1, 'só UMA consulta na primeira carga — nada de recarregar em seguida', 'chamadas: ' + d.quantasListas);

  // "Fix round 1", achado 2: a contagem pode falhar sem que a LISTA falhe. Calar isso faz
  // exatamente 80 linhas (o limite da página) parecerem "são todas", quando pode haver mais.
  const r5 = await abrirFaltas({ acolitos_roster_substituicao: { data: roster }, acolitos_faltas_filtradas: { data: faltas }, acolitos_faltas_contar: { error: { message: 'fora do ar' } } }, cenario);
  const e = r5.avaliado || {};
  exigir(!r5.erroAvaliar, 'a prova da contagem que falha roda sem estourar', r5.erroAvaliar);
  exigir(/Não foi possível contar o total/.test(e.texto || ''), 'contagem que falha AVISA, não cala', 'saiu: ' + JSON.stringify(e.texto));
  exigir(/Ana Souza/.test(e.texto || '') && /faltou/.test(e.texto || ''), 'mesmo sem o total, a lista continua aparecendo', 'saiu: ' + JSON.stringify((e.texto || '').slice(0, 200)));
}

// "Fix wave final" da revisão de 17/09/2026, achado 1 (Crítico, decisão do dono): em
// produção, 1.202 avisos, 141 deles de missas FUTURAS (28 no dia 19, 31 no 20...). Ordenar
// só por "mais recente" (created_at ou missa_data decrescente) enterrava o fim de semana que
// vem atrás de mais de mil avisos de missas que já aconteceram. O dono escolheu: abrir
// mostrando quem vai faltar nas PRÓXIMAS missas primeiro; as passadas completam depois.
async function provaAvisosAbreComAsProximasMissas(provas) {
  console.log('\n\x1b[1mAusências › Avisos: abre com as PRÓXIMAS missas, as passadas completam depois\x1b[0m');

  const roster = { membros: [{ id: 'u-ana', nome: 'Ana Souza', apelido: null }], habs: [] };
  const r = await provas.abrir('ausencias.html', {
    papel: PAPEIS.admin,
    rpcs: { acolitos_roster_substituicao: { data: roster } },
    avaliar: `
      const esperar = (ms) => new Promise(f => setTimeout(f, ms));
      try { localStorage.removeItem('filtro-lista:ausencias-avisos'); } catch (e) {}
      const linha = (id, data, com) => ({ id, membro_id: 'u-ana', celebracao_id: 'c' + id, motivo: 'viagem',
        observacao: null, created_at: '2026-09-01T12:00:00+00:00', missa_data: data,
        missa_horario: '19:00', missa_comunidade: com });
      // Menos de 60 na 1ª consulta — força a 2ª (passadas) a acontecer, como no dia a dia
      // (60 é o pedaço da tela; a produção tem só 141 avisos futuros no total).
      const proximas = [linha('p1', '2026-09-19', 'matriz')];
      const passadas = [linha('a1', '2026-09-01', 'santo_antonio')];
      const periodo = [linha('m1', '2026-09-10', 'matriz')];
      const total = 2;
      let consultas = [];
      const orig = sb.from.bind(sb);
      sb.from = (t) => {
        if (t !== 'acolitos_ausencias_v') return orig(t);
        const reg = { chamadas: [] }; consultas.push(reg);
        const resp = () => {
          const cs = reg.chamadas;
          const head = cs.some(c => c[0] === 'select' && c[2] && c[2].head);
          const temGte = cs.some(c => c[0] === 'gte' && c[1] === 'missa_data');
          const temLte = cs.some(c => c[0] === 'lte' && c[1] === 'missa_data');
          const temLt = cs.some(c => c[0] === 'lt' && c[1] === 'missa_data');
          if (head) return { data: null, count: total, error: null };
          if (temGte && temLte) return { data: periodo, count: total, error: null };
          if (temGte) return { data: proximas, count: null, error: null };
          if (temLt) return { data: passadas, count: null, error: null };
          return { data: [], count: total, error: null };
        };
        const p = new Proxy({}, { get: (_, k) => k === 'then'
          ? (ok, ko) => Promise.resolve(resp()).then(ok, ko)
          : (...args) => { reg.chamadas.push([k, ...args]); return p; } });
        return p;
      };
      const naoHead = (c) => !c.chamadas.some(x => x[0] === 'select' && x[2] && x[2].head);
      const tem = (c, ...alvo) => !!c && c.chamadas.some(x => JSON.stringify(x.slice(0, alvo.length)) === JSON.stringify(alvo));
      const ordemAsc = (c, campo, valor) => !!c && c.chamadas.some(x => x[0] === 'order' && x[1] === campo && x[2] && x[2].ascending === valor);
      const painel = () => document.querySelector('.modal-overlay.open .filtro-painel');
      const abrir = async () => { document.querySelector('#filtro-avisos .filtro-btn').click(); await esperar(40); };
      const ver = async () => { painel().querySelector('.filtro-ver').click(); await esperar(150); };
      const tocar = (txt) => { const b = [...painel().querySelectorAll('.form-toggle')].find(x => x.textContent.trim() === txt); if (!b) throw new Error('sem opção ' + txt); b.click(); };
      const limpar = async () => { const l = document.querySelector('#filtro-avisos .filtro-limpar'); if (l) { l.click(); await esperar(150); } };
      const texto = () => (document.getElementById('lista-avisos') || {}).textContent || '';
      const out = {};

      // (a) e (b): sem período, DUAS consultas — próximas (gte, crescente) e, como a 1ª não
      // enche 60, passadas (lt, decrescente) — e a lista mostra as duas.
      abaAusencias = 'avisos'; await renderViewEquipe(); await esperar(100);
      const listasAbertura = consultas.filter(naoHead);
      out.duasConsultasSemPeriodo = listasAbertura.length === 2;
      out.primeiraGteAsc = tem(listasAbertura[0], 'gte', 'missa_data', hojeLocal()) && ordemAsc(listasAbertura[0], 'missa_data', true);
      out.segundaLtDesc = listasAbertura.length > 1 && tem(listasAbertura[1], 'lt', 'missa_data', hojeLocal()) && ordemAsc(listasAbertura[1], 'missa_data', false);
      out.rendeuAsDuas = /Matriz/.test(texto()) && /Sto\\. Antônio/.test(texto());
      consultas = [];

      // (c): com período escolhido, UMA consulta só, crescente, com o gte/lte do período.
      await abrir(); tocar('Este mês'); await ver();
      const listasPeriodo = consultas.filter(naoHead);
      out.periodoUmaConsulta = listasPeriodo.length === 1;
      const iv = FiltroLista.intervaloDoPeriodo('este_mes', hojeLocal());
      out.periodoAsc = tem(listasPeriodo[0], 'gte', 'missa_data', iv.desde) && tem(listasPeriodo[0], 'lte', 'missa_data', iv.ate) && ordemAsc(listasPeriodo[0], 'missa_data', true);
      await limpar();
      consultas = [];

      // (d): "Quando avisou" continua como sempre foi — uma consulta, created_at decrescente.
      await abrir(); tocar('Quando avisou'); await ver();
      const listasAviso = consultas.filter(naoHead);
      out.avisoUmaConsulta = listasAviso.length === 1;
      out.avisoOrdenaCreated = tem(listasAviso[0], 'order', 'created_at');

      sb.from = orig;
      return out;
    `,
  });
  const a = r.avaliado || {};
  exigir(!r.erroAvaliar, 'a prova das próximas missas roda sem estourar', r.erroAvaliar);
  exigir(r.avaliado && typeof r.avaliado === 'object', 'a prova das próximas missas chegou ao fim', 'avaliado: ' + JSON.stringify(r.avaliado));
  exigir(a.duasConsultasSemPeriodo === true, 'sem período, a lista faz DUAS consultas (próximas + passadas)', 'saiu: ' + JSON.stringify(a));
  exigir(a.primeiraGteAsc === true, 'a 1ª consulta pega missa_data >= hoje, crescente (mais perto primeiro)');
  exigir(a.segundaLtDesc === true, 'a 2ª consulta pega missa_data < hoje, decrescente, quando a 1ª não enche 60');
  exigir(a.rendeuAsDuas === true, 'a lista mostra linhas das DUAS consultas juntas');
  exigir(a.periodoUmaConsulta === true, 'com período escolhido, é UMA consulta só');
  exigir(a.periodoAsc === true, 'dentro do período, a ordem é crescente (mais perto do início primeiro)');
  exigir(a.avisoUmaConsulta === true, '"Quando avisou" continua sendo uma consulta só');
  exigir(a.avisoOrdenaCreated === true, '"Quando avisou" continua ordenando por created_at');
}

// "Fix wave final" da revisão de 17/09/2026, achado 2 (Importante): o roster
// (security-definer) só traz membros com status='ativo'. Produção tem 23 avisos de gente
// afastada — hoje eles viram "—" e o "Remover" pergunta "esta pessoa?" em vez do nome. A
// tela busca esses nomes que faltam direto em acolitos_membros; se essa consulta também for
// negada (RLS), mantém "—" em vez de travar.
async function provaAvisosMostraNomeDeQuemEstaAfastado(provas) {
  console.log('\n\x1b[1mAusências › Avisos: quem está afastado continua com nome (não "—")\x1b[0m');

  const roster = { membros: [{ id: 'u-ana', nome: 'Ana Souza', apelido: null }], habs: [] };
  const r = await provas.abrir('ausencias.html', {
    papel: PAPEIS.admin,
    rpcs: { acolitos_roster_substituicao: { data: roster } },
    avaliar: `
      const esperar = (ms) => new Promise(f => setTimeout(f, ms));
      try { localStorage.removeItem('filtro-lista:ausencias-avisos'); } catch (e) {}
      const linhaAfastada = { id: 'a1', membro_id: 'u-afastado', celebracao_id: 'c1', motivo: 'viagem',
        observacao: null, created_at: '2026-09-01T12:00:00+00:00', missa_data: '2026-09-19',
        missa_horario: '19:00', missa_comunidade: 'matriz' };
      const chamadasMembros = [];
      const orig = sb.from.bind(sb);
      sb.from = (t) => {
        if (t === 'acolitos_membros') {
          chamadasMembros.push(true);
          const p = new Proxy({}, { get: (_, k) => k === 'then'
            ? (ok, ko) => Promise.resolve({ data: [{ id: 'u-afastado', nome: 'Beatriz Afastada', apelido: null }], error: null }).then(ok, ko)
            : (...args) => p });
          return p;
        }
        if (t !== 'acolitos_ausencias_v') return orig(t);
        const p = new Proxy({}, { get: (_, k) => k === 'then'
          ? (ok, ko) => Promise.resolve({ data: [linhaAfastada], count: 1, error: null }).then(ok, ko)
          : (...args) => p });
        return p;
      };
      abaAusencias = 'avisos'; await renderViewEquipe(); await esperar(120);
      const texto = document.getElementById('lista-avisos').textContent;
      sb.from = orig;
      return { temNome: /Beatriz Afastada/.test(texto), semTraco: !/—/.test(texto), buscouMembros: chamadasMembros.length > 0 };
    `,
  });
  const a = r.avaliado || {};
  exigir(!r.erroAvaliar, 'a prova do nome de quem está afastado roda sem estourar', r.erroAvaliar);
  exigir(a.buscouMembros === true, 'quando falta gente no roster, a tela busca em acolitos_membros');
  exigir(a.temNome === true, 'quem não está no roster (afastado) ainda aparece pelo nome', 'saiu: ' + JSON.stringify(a));
  exigir(a.semTraco === true, 'a linha não vira "—" quando o nome vem da tabela de membros', 'saiu: ' + JSON.stringify(a));
}

// "Fix wave final" da revisão de 17/09/2026, achado 3 (Importante): carregarRosterAus()
// engolia o erro e cacheava [], que é verdadeiro — nunca mais tentava de novo. Com a lista
// de pessoas vazia, FiltroLista.restaurar descarta a pessoa que estava salva, e a PRÓXIMA
// troca de filtro grava o estado sem ela.
async function provaRosterFalhoNaoApagaFiltroDePessoa(provas) {
  console.log('\n\x1b[1mAusências › Avisos: roster fora do ar não apaga a pessoa filtrada\x1b[0m');

  const r = await provas.abrir('ausencias.html', {
    papel: PAPEIS.admin,
    rpcs: { acolitos_roster_substituicao: { error: { message: 'fora do ar' } } },
    avaliar: `
      const esperar = (ms) => new Promise(f => setTimeout(f, ms));
      const chave = 'filtro-lista:ausencias-avisos';
      const salvoAntes = JSON.stringify({ v: 1, ordem: 'missa', ligados: [{ f: 'pessoa', o: 'u-ana' }], busca: '' });
      try { localStorage.setItem(chave, salvoAntes); } catch (e) {}
      const linha = { id: 'a1', membro_id: 'u-ana', celebracao_id: 'c1', motivo: 'viagem',
        observacao: null, created_at: '2026-09-01T12:00:00+00:00', missa_data: '2026-09-19',
        missa_horario: '19:00', missa_comunidade: 'matriz' };
      const orig = sb.from.bind(sb);
      sb.from = (t) => {
        if (t !== 'acolitos_ausencias_v') return orig(t);
        const p = new Proxy({}, { get: (_, k) => k === 'then'
          ? (ok, ko) => Promise.resolve({ data: [linha], count: 1, error: null }).then(ok, ko)
          : (...args) => p });
        return p;
      };
      abaAusencias = 'avisos'; await renderViewEquipe(); await esperar(120);
      const out = {
        listou: /Viagem/.test((document.getElementById('lista-avisos') || {}).textContent || ''),
        avisou: /Não foi possível carregar a lista de pessoas/.test(document.getElementById('main-content').textContent),
        guardadoDepois: localStorage.getItem(chave),
        salvoAntes,
      };
      sb.from = orig;
      return out;
    `,
  });
  const a = r.avaliado || {};
  exigir(!r.erroAvaliar, 'a prova do roster fora do ar roda sem estourar', r.erroAvaliar);
  exigir(a.listou === true, 'mesmo sem o roster, a aba Avisos continua listando');
  exigir(a.avisou === true, 'a tela avisa que o filtro por pessoa está indisponível', 'saiu: ' + JSON.stringify(a));
  exigir(a.guardadoDepois === a.salvoAntes, 'o filtro salvo NÃO é sobrescrito só de renderizar a tela', 'antes: ' + a.salvoAntes + ' depois: ' + a.guardadoDepois);
}

async function provaRecadoDaFotoAparece(provas) {
  console.log('\n\x1b[1mRecado da foto: o convite desenha, e só some quando a foto sobe\x1b[0m');

  // De 09/06 a 01/09/2026 nenhuma foto subia no app (migration 065). O recado é o
  // convite de volta, e ele quebra a regra de toda a fila: os outros avisos somem por
  // terem APARECIDO, este some por a foto ter SUBIDO. É uma exceção — e exceção é o
  // que alguém "padroniza" sem querer. Aqui ela fica desenhada na tela, não só no teste.
  const r = await provas.abrir('index.html', {
    papel: PAPEIS.membro,
    avaliar: `
      const recado = { tipo: 'foto_conserto', seen: false };
      const membro = { id: 'prova-065', foto_url: null, avisos: [recado] };
      showFotoConsertoPop(membro, function () {});
      const modal = document.querySelector('.modal-overlay.open .modal');
      const botoes = modal ? [...modal.querySelectorAll('button')].map(function (b) { return b.textContent.trim(); }) : [];
      return {
        texto: modal ? (modal.innerText || '').trim() : '',
        botoes: botoes,
        temSeletorDeFoto: !!(modal && modal.querySelector('input[type=file]')),
        // A regra, medida na própria tela que a usa:
        pendenteSemFoto: recadoDaFotoFicaPendente(recado, false),
        renderSeTemFoto:  recadoDaFotoFicaPendente(recado, true),
        outroAviso: recadoDaFotoFicaPendente({ tipo: 'medalha', seen: false }, false),
      };
    `,
  });

  const a = r.avaliado || {};
  exigir(!r.erroAvaliar, 'o pop-up do recado abre sem estourar', r.erroAvaliar);
  // Comparação sem caixa de propósito: o `.modal-title` do app tem text-transform
  // uppercase, então o innerText volta gritado. Medir a caixa aqui acusaria a tela
  // certa de estar errada.
  exigir(/sua foto pode subir agora/i.test(a.texto || ''),
    'o convite desenha na tela, com o título',
    'saiu: ' + JSON.stringify((a.texto || '').slice(0, 120)));
  exigir(/se você tentou/i.test(a.texto || ''),
    'o texto NÃO acusa a pessoa de ter tentado',
    'parte de quem recebe nunca tentou — não dá para saber quem é quem');
  exigir((a.botoes || []).some((b) => /colocar minha foto/i.test(b)),
    'tem o botão que abre a foto');
  exigir((a.botoes || []).some((b) => /agora não/i.test(b)),
    'tem saída — o convite não vira parede');
  exigir(a.temSeletorDeFoto === true,
    'o seletor de arquivo está montado no pop-up',
    'sem ele o botão dourado não abre nada');
  exigir(a.pendenteSemFoto === true,
    'SEM foto o recado fica pendente (não some por ter aparecido)');
  exigir(a.renderSeTemFoto === false,
    'COM foto o recado se rende — é isto que faz ele sumir');
  exigir(a.outroAviso === false,
    'os outros avisos seguem a regra normal da fila');
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
    await provaPortaoNotificacoes(provas);
    await provaBoasVindasAoTime(provas);
    await provaTarefasSoDoMeuTime(provas);
    await provaBrasaoNoAvatar(provas);
    await provaCasaChegaPelasFuncoesDoBanco(provas);
    await provaCartaoDoCrmEComentarioObrigatorio(provas);
    await provaSairDoWhatsappMarcaAFicha(provas);
    await provaLoginsMostraQuemEstaEmIntegracao(provas);
    await provaAtividadeDeUsuario(provas);
    await provaAtividadeNaoTransformaErroEmZero(provas);
    await provaPessoasETimesFundidas(provas);
    await provaEntrarNoTimeLiberaTarefas(provas);
    await provaNomeDaMaeTemOndeSerDigitado(provas);
    await provaTelefonePedidoQuandoAIdadeEDesconhecida(provas);
    await provaRecadoDaFotoAparece(provas);
    await provaAvisoDaCoordenacaoFicaNoApp(provas);
    await provaBarraDeFiltroFunciona(provas);
    await provaMembrosMostraQuemEntrouPorUltimo(provas);
    await provaBarraMostraSoOQueATelaOferece(provas);
    await provaAgendaFiltra(provas);
    await provaCrmOrdenaEBusca(provas);
    await provaChamadaFiltra(provas);
    await provaBarraBuscaNoPainelEEscolhaUnica(provas);
    await provaAvisosDeAusenciaFiltramNaConsulta(provas);
    await provaFaltasFiltramNaConsulta(provas);
    await provaAvisosAbreComAsProximasMissas(provas);
    await provaAvisosMostraNomeDeQuemEstaAfastado(provas);
    await provaRosterFalhoNaoApagaFiltroDePessoa(provas);
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
