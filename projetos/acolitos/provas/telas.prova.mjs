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
