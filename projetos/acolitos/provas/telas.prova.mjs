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

  // Quem TRANCA é o banco (migration 057, provada por docs/provar-057-tarefas-por-time.sql).
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
    await provaPessoasETimesFundidas(provas);
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
