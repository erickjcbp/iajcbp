// A aba Rodízio responde três perguntas que pareciam a mesma e não são:
// "faz quanto tempo que ninguém ESCALA essa pessoa", "faz quanto tempo que ela não APARECE",
// e "quantas vezes ela foi chamada e não veio". Estas provas guardam as três contas.
const { test } = require('node:test');
const assert = require('node:assert');
const { semanasSem } = require('./rodizio-core.js');

test('o relógio conta semanas INTEIRAS — 6 dias ainda é zero', () => {
  // Arredondar para cima poria "1 semana sem servir" em quem serviu ontem.
  assert.strictEqual(semanasSem('2026-09-17', '2026-09-23'), 0);
  assert.strictEqual(semanasSem('2026-09-16', '2026-09-23'), 1);
  assert.strictEqual(semanasSem('2026-09-02', '2026-09-23'), 3);
});

test('sem data o relógio devolve null, nunca zero', () => {
  // Zero diria "serviu esta semana" de quem nunca serviu — falha virando número.
  assert.strictEqual(semanasSem(null, '2026-09-23'), null);
  assert.strictEqual(semanasSem('', '2026-09-23'), null);
  assert.strictEqual(semanasSem(undefined, '2026-09-23'), null);
});

test('data no futuro não vira semana negativa', () => {
  // Escala da semana que vem não pode dizer "-1 semana sem servir".
  assert.strictEqual(semanasSem('2026-09-27', '2026-09-23'), 0);
});

// ── montarRodizio: uma linha por membro ─────────────────────────────────────
const { montarRodizio } = require('./rodizio-core.js');

const HOJE = '2026-09-23';
const PEDRO = { id: 'm1', nome: 'Pedro' };

test('o calendário do Pedro dá TRÊS números diferentes', () => {
  // Domingos: 19/08 escalado e foi · 09/09 escalado e NÃO foi · nos outros nem entrou na escala.
  // Sem escalar conta do 09/09 (2 sem). Sem servir conta do 19/08 (5 sem). Falta é 1 vez.
  const linhas = montarRodizio({
    membros: [PEDRO],
    escalas: [
      { membro_id: 'm1', status: 'presente', data: '2026-08-19' },
      { membro_id: 'm1', status: 'ausente',  data: '2026-09-09' },
    ],
    hoje: HOJE,
  });
  assert.strictEqual(linhas.length, 1);
  assert.strictEqual(linhas[0].semEscalar, 2);
  assert.strictEqual(linhas[0].semServir, 5);
  assert.strictEqual(linhas[0].faltas, 1);
});

test('quem nunca foi escalado mostra "nunca" nos dois relógios, não zero', () => {
  const [l] = montarRodizio({ membros: [PEDRO], escalas: [], hoje: HOJE });
  assert.strictEqual(l.semEscalar, null);
  assert.strictEqual(l.semServir, null);
  assert.strictEqual(l.faltas, 0);
});

test('a linha carrega o membro inteiro, para a tela mostrar nome e nível', () => {
  const [l] = montarRodizio({ membros: [PEDRO], escalas: [], hoje: HOJE });
  assert.strictEqual(l.membro, PEDRO);
});

test('atrasado é presença: zera o relógio de servir e não é falta', () => {
  const [l] = montarRodizio({
    membros: [PEDRO],
    escalas: [{ membro_id: 'm1', status: 'atrasado', data: '2026-09-16' }],
    hoje: HOJE,
  });
  assert.strictEqual(l.semServir, 1);
  assert.strictEqual(l.faltas, 0);
});

test('falta justificada conta como falta — avisar não é servir', () => {
  const [l] = montarRodizio({
    membros: [PEDRO],
    escalas: [{ membro_id: 'm1', status: 'ausente_justificado', data: '2026-09-16' }],
    hoje: HOJE,
  });
  assert.strictEqual(l.faltas, 1);
  assert.strictEqual(l.semEscalar, 1);
  assert.strictEqual(l.semServir, null);
});

test('escala de quem não está na lista de membros não vira linha fantasma', () => {
  const linhas = montarRodizio({
    membros: [PEDRO],
    escalas: [{ membro_id: 'ex-membro', status: 'presente', data: '2026-09-16' }],
    hoje: HOJE,
  });
  assert.strictEqual(linhas.length, 1);
  assert.strictEqual(linhas[0].membro.id, 'm1');
});

// ── substituto, chamada pendente e escala futura ────────────────────────────
const MARIA = { id: 'm2', nome: 'Maria' };

test('quem entrou de substituto SERVIU — os dois relógios dele zeram', () => {
  // O relatório de hoje não credita substituto por período, e quem mais quebra galho
  // acaba aparecendo como o mais sumido. Aqui credita.
  const [pedro, maria] = montarRodizio({
    membros: [PEDRO, MARIA],
    escalas: [{ membro_id: 'm1', substituto_id: 'm2', status: 'substituido', data: '2026-09-16' }],
    hoje: HOJE,
  });
  assert.strictEqual(maria.semServir, 1);
  assert.strictEqual(maria.semEscalar, 1);
  // E quem foi substituído: foi escalado, não serviu — e não levou falta.
  assert.strictEqual(pedro.semEscalar, 1);
  assert.strictEqual(pedro.semServir, null);
  assert.strictEqual(pedro.faltas, 0);
});

test('celebração no futuro não mexe nos relógios — só acende "já na próxima"', () => {
  const [l] = montarRodizio({
    membros: [PEDRO],
    escalas: [
      { membro_id: 'm1', status: 'presente', data: '2026-08-19' },
      { membro_id: 'm1', status: 'escalado', data: '2026-09-27' },   // domingo que vem
    ],
    hoje: HOJE,
  });
  assert.strictEqual(l.semEscalar, 5, 'escala futura não pode zerar o relógio do passado');
  assert.strictEqual(l.semServir, 5);
  assert.strictEqual(l.jaNaProxima, true);
});

test('sem escala futura, "já na próxima" fica falso — não indefinido', () => {
  const [l] = montarRodizio({ membros: [PEDRO], escalas: [], hoje: HOJE });
  assert.strictEqual(l.jaNaProxima, false);
});

test('escala passada que ficou "escalado" acende CHAMADA PENDENTE', () => {
  // Serviu domingo passado e ninguém fechou a chamada: sem escalar 1, sem servir 5.
  // A diferença não é defeito da lista — é a lista avisando que faltou a chamada.
  const [l] = montarRodizio({
    membros: [PEDRO],
    escalas: [
      { membro_id: 'm1', status: 'presente', data: '2026-08-19' },
      { membro_id: 'm1', status: 'escalado', data: '2026-09-16' },
    ],
    hoje: HOJE,
  });
  assert.strictEqual(l.semEscalar, 1);
  assert.strictEqual(l.semServir, 5);
  assert.strictEqual(l.chamadaPendente, true);
});

test('chamada pendente MAIS VELHA que a última presença não acende', () => {
  // Ficou escalado em agosto, mas depois disso ele serviu de novo e a chamada foi feita.
  // Acender aqui seria alarme falso.
  const [l] = montarRodizio({
    membros: [PEDRO],
    escalas: [
      { membro_id: 'm1', status: 'escalado', data: '2026-08-19' },
      { membro_id: 'm1', status: 'presente', data: '2026-09-16' },
    ],
    hoje: HOJE,
  });
  assert.strictEqual(l.chamadaPendente, false);
});

// ── o piso do grupo e o "por quê" ───────────────────────────────────────────
const { pisoDoGrupo, motivoDe, rotuloDoMotivo } = require('./rodizio-core.js');

test('o piso sai da divisão vagas por pessoas — 177 para 76 dá 2,3', () => {
  // Medido em 23/09/2026: 76 vagas por fim de semana (25 sábado + 51 domingo), 177 ativos.
  // Com rodízio perfeito ninguém serve mais que uma vez a cada 2,3 fins de semana.
  const p = pisoDoGrupo({ vagasPorFimDeSemana: 76, ativos: 177 });
  assert.strictEqual(p.semanas, 2.3);
  assert.strictEqual(p.teto, 3, 'até 3 semanas é o normal do tamanho do grupo');
});

test('sem vagas medidas o piso é null — não inventa régua', () => {
  assert.strictEqual(pisoDoGrupo({ vagasPorFimDeSemana: 0, ativos: 177 }), null);
  assert.strictEqual(pisoDoGrupo({ vagasPorFimDeSemana: 76, ativos: 0 }), null);
});

const TETO = 3;
const CHEIO = { habilitacoes: 5, faixas: 4 };
const linha = (extra) => Object.assign(
  { semEscalar: 0, jaNaProxima: false, chamadaPendente: false }, extra);

test('quem está dentro do piso não ganha motivo — não há o que explicar', () => {
  assert.strictEqual(motivoDe(linha({ semEscalar: 3 }), CHEIO, TETO), 'no_piso');
  assert.strictEqual(rotuloDoMotivo('no_piso'), '—');
});

test('quem já está na escala da semana que vem não é caso de socorro', () => {
  assert.strictEqual(motivoDe(linha({ semEscalar: 6, jaNaProxima: true }), CHEIO, TETO), 'ja_na_proxima');
});

test('as quatro aspirantes: uma habilitação só fecha quase todas as portas', () => {
  // Heloísa, Rayssa, Maria Eduarda e Augusto — medido em 23/09/2026.
  assert.strictEqual(motivoDe(linha({ semEscalar: null }), { habilitacoes: 1, faixas: 5 }, TETO), 'poucas_portas');
  assert.strictEqual(motivoDe(linha({ semEscalar: null }), { habilitacoes: 3, faixas: 1 }, TETO), 'poucas_portas');
});

test('sem cadastro nenhum o motivo é o cadastro, não o gerador', () => {
  assert.strictEqual(motivoDe(linha({ semEscalar: 8 }), { habilitacoes: 3, faixas: 0 }, TETO), 'sem_disponibilidade');
  assert.strictEqual(motivoDe(linha({ semEscalar: 8 }), { habilitacoes: 0, faixas: 3 }, TETO), 'sem_habilitacao');
});

test('chamada não fechada é explicação, e vem antes de culpar o gerador', () => {
  assert.strictEqual(motivoDe(linha({ semEscalar: 5, chamadaPendente: true }), CHEIO, TETO), 'chamada_pendente');
});

test('com tudo em ordem e parado assim mesmo, a culpa é do gerador — e a tela diz isso', () => {
  // 44 dos 45 parados estão neste caso (medido em 23/09/2026). Esconder isso atrás de um
  // "sem motivo" faria a tela parecer quebrada em vez de acusar o rodízio.
  assert.strictEqual(motivoDe(linha({ semEscalar: 5 }), CHEIO, TETO), 'gerador_nao_pegou');
  assert.ok(rotuloDoMotivo('gerador_nao_pegou').length > 5);
});

test('motivo que não existe não estoura nem inventa texto', () => {
  assert.strictEqual(rotuloDoMotivo('inventado'), '—');
  assert.strictEqual(rotuloDoMotivo(null), '—');
});

// ── quantas vagas cabem num fim de semana ───────────────────────────────────
const { vagasPorFimDeSemana } = require('./rodizio-core.js');

const nEscalas = (data, n) => Array.from({ length: n }, () => ({ data }));

test('sábado e domingo são O MESMO fim de semana, não dois', () => {
  // 19/09 é sábado e 20/09 é domingo. Contar como dois fins de semana daria 38 vagas
  // por fim de semana em vez de 76 — e o piso do grupo sairia pelo DOBRO.
  const v = vagasPorFimDeSemana([...nEscalas('2026-09-19', 25), ...nEscalas('2026-09-20', 51)]);
  assert.strictEqual(v, 76);
});

test('a média é por fim de semana COM celebração — semana vazia não dilui', () => {
  // Feriado sem missa com escala não pode fazer parecer que cabem menos pessoas por semana.
  const v = vagasPorFimDeSemana([
    ...nEscalas('2026-09-19', 25), ...nEscalas('2026-09-20', 51),
    ...nEscalas('2026-09-12', 25), ...nEscalas('2026-09-13', 51),
  ]);
  assert.strictEqual(v, 76);
});

test('sem escala nenhuma devolve null — sem medida não há piso', () => {
  assert.strictEqual(vagasPorFimDeSemana([]), null);
  assert.strictEqual(vagasPorFimDeSemana(null), null);
});

test('missa no meio da semana conta no fim de semana dela, sem virar um a mais', () => {
  // Corpus Christi numa quinta não é um "fim de semana" próprio.
  const v = vagasPorFimDeSemana([...nEscalas('2026-09-19', 10), ...nEscalas('2026-09-17', 10)]);
  assert.strictEqual(v, 20);
});

// ── A REGRA da pastoral: servir 2x por mês ──────────────────────────────────
// Dita pelo dono em 23/09/2026: "a princípio é para todos os membros, servirem 2x por mês, é
// regra". A régua da aba deixou de ser a minha conta de capacidade e passou a ser esta.
const { fimDeSemanaRestantes, resumoDaRegra } = require('./rodizio-core.js');

test('o mês corrente conta ESCALA FUTURA dele — quem já está no dia 27 está em dia', () => {
  // A pergunta da coordenação é "dá tempo de arrumar?". Escondendo a escala já montada,
  // a lista mandaria encaixar de novo quem já estava encaixada.
  const [l] = montarRodizio({
    membros: [PEDRO],
    escalas: [
      { membro_id: 'm1', status: 'presente', data: '2026-09-06' },
      { membro_id: 'm1', status: 'escalado', data: '2026-09-27' },
    ],
    hoje: HOJE,
  });
  assert.strictEqual(l.vezesNoMes, 2);
  assert.strictEqual(l.abaixoDaRegra, false);
});

test('escala do mês passado não conta para o mês corrente', () => {
  const [l] = montarRodizio({
    membros: [PEDRO],
    escalas: [
      { membro_id: 'm1', status: 'presente', data: '2026-08-30' },
      { membro_id: 'm1', status: 'presente', data: '2026-09-06' },
    ],
    hoje: HOJE,
  });
  assert.strictEqual(l.vezesNoMes, 1);
  assert.strictEqual(l.abaixoDaRegra, true, 'uma vez no mês é metade da regra');
});

test('quem não entrou em nada no mês fica em zero, e zero aqui é verdade', () => {
  // Diferente dos relógios: ali null quer dizer "nunca"; aqui 0 é um fato do mês.
  const [l] = montarRodizio({ membros: [PEDRO], escalas: [], hoje: HOJE });
  assert.strictEqual(l.vezesNoMes, 0);
  assert.strictEqual(l.abaixoDaRegra, true);
});

test('a meta é ajustável — 2 é o padrão, não um número cravado', () => {
  const um = montarRodizio({
    membros: [PEDRO], hoje: HOJE, meta: 1,
    escalas: [{ membro_id: 'm1', status: 'presente', data: '2026-09-06' }],
  });
  assert.strictEqual(um[0].abaixoDaRegra, false, 'com meta 1, uma vez já cumpre');
});

test('quantos fins de semana ainda cabem no mês — 23/09 tem só o do dia 27', () => {
  // Setembro de 2026 tem domingos em 6, 13, 20 e 27.
  assert.strictEqual(fimDeSemanaRestantes('2026-09-23'), 1);
  assert.strictEqual(fimDeSemanaRestantes('2026-09-01'), 4);
});

test('no próprio domingo já não "resta" aquele fim de semana', () => {
  // A missa é hoje: mandar a coordenação encaixar alguém nela seria tarde.
  assert.strictEqual(fimDeSemanaRestantes('2026-09-27'), 0);
  assert.strictEqual(fimDeSemanaRestantes('2026-09-28'), 0);
});

test('o resumo da régua conta quem cumpriu, de quantos, sem arredondar para bonito', () => {
  const r = resumoDaRegra([
    { vezesNoMes: 2, abaixoDaRegra: false }, { vezesNoMes: 3, abaixoDaRegra: false },
    { vezesNoMes: 1, abaixoDaRegra: true },  { vezesNoMes: 0, abaixoDaRegra: true },
  ]);
  assert.deepStrictEqual(r, { cumpriram: 2, total: 4, emZero: 1 });
});

// ── O gerador perseguindo a regra ───────────────────────────────────────────
// O rodízio inteiro compara UM número (`carga[id]`) em cinco lugares: bloco de irmãos,
// funções maiores, funções menores, gerador da semana e motor de troca. A regra do mês entra
// DENTRO desse número, não como critério novo em cada um deles — regra escrita em cinco
// lugares é regra que um dia falta em um, e esse gerador já tem essa cicatriz (o
// "cerimoniário nunca no apoio" escapava pelos blocos de irmãos).
const { pesoRodizio, PESO_MES } = require('./rodizio-core.js');

test('A INVERSÃO: quem está em 0 no mês vence quem já cumpriu, mesmo servindo mais nas 6 semanas', () => {
  // É o coração da mudança. Sem ela, os 50 que servem 3-4x continuam na frente dos 20 que
  // ficam em zero, e a regra de 2x por mês nunca sai do papel.
  assert.ok(pesoRodizio(0, 5) < pesoRodizio(2, 0));
  assert.ok(pesoRodizio(1, 9) < pesoRodizio(2, 0));
});

test('empatados no mês, quem desempata é o rodízio de 6 semanas que já existia', () => {
  // No PRIMEIRO fim de semana do mês todo mundo está em 0: o gerador tem de se comportar
  // exatamente como antes, senão a mudança vira reviravolta.
  assert.ok(pesoRodizio(0, 1) < pesoRodizio(0, 3));
  assert.strictEqual(pesoRodizio(0, 3) - pesoRodizio(0, 1), 2);
});

test('quem passou da regra vai para o fim, e quanto mais passou, mais para o fim', () => {
  assert.ok(pesoRodizio(2, 0) < pesoRodizio(3, 0));
  assert.ok(pesoRodizio(3, 0) < pesoRodizio(4, 0));
});

test('a carga das 6 semanas NUNCA transborda para dentro da conta do mês', () => {
  // Se um número grande na parte de baixo virasse "mais um mês", alguém em 0/2 seria
  // tratado como se já tivesse cumprido — e o defeito seria invisível.
  assert.ok(pesoRodizio(0, 999999) < pesoRodizio(1, 0));
  assert.ok(pesoRodizio(0, PESO_MES) < pesoRodizio(1, 0));
});

test('sem número nenhum o peso é zero, não NaN', () => {
  // O `freqMap` antigo deste gerador dava NaN, e NaN em comparação não ordena nada:
  // a fila saía na ordem de chegada, sem rodízio, e ninguém via.
  assert.strictEqual(pesoRodizio(), 0);
  assert.strictEqual(pesoRodizio(null, undefined), 0);
  assert.ok(Number.isFinite(pesoRodizio('x', 'y')));
});

test('um turno a mais na geração sobe o mês E a janela de uma vez só', () => {
  // Dentro de uma geração o gerador incrementa a carga de quem acabou de escalar. Subir só
  // a janela deixaria a pessoa em "0 no mês" depois de já ter sido escalada neste mês.
  assert.strictEqual(pesoRodizio(0, 0) + PESO_MES + 1, pesoRodizio(1, 1));
});

// ── contarParaRodizio: QUAL data conta para o mês e qual conta para a janela ─
const { contarParaRodizio } = require('./rodizio-core.js');

const REF = '2026-09-23';   // quarta; janela de 42 dias começa em 12/08
const pesoDe = (escalas, ref) => contarParaRodizio({ escalas, refData: ref || REF, janelaDias: 42 });

test('escala do MÊS QUE VEM não conta em nada — o mês é o da celebração sendo montada', () => {
  const p = pesoDe([{ membro_id: 'm1', data: '2026-10-04' }]);
  assert.strictEqual(p.m1, undefined);
});

test('o resto do mês que ainda vem conta no MÊS, e não na janela', () => {
  // Gerar o dia 6 tem de pesar no dia 20: sem isso o gerador monta o mês inteiro achando
  // que todo mundo está em zero, e a regra não sai do papel.
  const p = pesoDe([{ membro_id: 'm1', data: '2026-09-27' }]);
  assert.strictEqual(p.m1, pesoRodizio(1, 0));
});

test('escala dentro da janela e do mês conta nos DOIS', () => {
  const p = pesoDe([{ membro_id: 'm1', data: '2026-09-06' }]);
  assert.strictEqual(p.m1, pesoRodizio(1, 1));
});

test('escala do mês passado, ainda dentro da janela, conta SÓ na janela', () => {
  // 20/08 está a 34 dias de 23/09 (dentro dos 42) mas é agosto: pesa no rodízio, não na regra.
  const p = pesoDe([{ membro_id: 'm1', data: '2026-08-20' }]);
  assert.strictEqual(p.m1, pesoRodizio(0, 1));
});

test('escala velha demais não conta em lugar nenhum', () => {
  const p = pesoDe([{ membro_id: 'm1', data: '2026-07-05' }]);
  assert.strictEqual(p.m1, undefined);
});

test('quem nunca apareceu fica FORA do mapa — e `carga[id]||0` resolve, sem NaN', () => {
  const p = pesoDe([{ membro_id: 'm1', data: '2026-09-06' }]);
  assert.strictEqual(p.m2, undefined);
  assert.strictEqual((p.m2 || 0), 0);
});

test('A INVERSÃO de ponta a ponta: quem está em 0 no mês vence quem cumpriu', () => {
  // m1: duas vezes em setembro (cumpriu) e nada mais. m2: três vezes em agosto, dentro da
  // janela, e NENHUMA em setembro. Pelo rodízio velho m1 (2) iria antes de m2 (3); pela
  // regra, m2 tem de ir primeiro.
  const p = pesoDe([
    { membro_id: 'm1', data: '2026-09-06' }, { membro_id: 'm1', data: '2026-09-13' },
    { membro_id: 'm2', data: '2026-08-16' }, { membro_id: 'm2', data: '2026-08-23' },
    { membro_id: 'm2', data: '2026-08-30' },
  ]);
  assert.ok(p.m2 < p.m1, 'quem está em 0/2 tem de ser escalado antes de quem já fez 2');
});

// ── FREQUENTE: meia vez a menos no mês ──────────────────────────────────────
// Pedido do dono em 23/09/2026, com as três decisões dele: fura a fila mas continua na fila ·
// cerca de 1 vez a mais por mês e meio · avisa ao passar de 10 marcados (não trava).
const META = 2;

test('o frequente passa na frente de quem também já cumpriu', () => {
  assert.ok(pesoRodizio(2, 0, true) < pesoRodizio(2, 0, false));
});

test('mas NUNCA na frente de quem ainda está devendo — a regra vence o favor', () => {
  // É a trava que faz o favor não roubar da regra. Sem ela, marcar frequentes atrasaria
  // justamente as 20 pessoas que a aba Rodízio existe para resgatar.
  assert.ok(pesoRodizio(1, 0, false) < pesoRodizio(2, 0, true), 'quem fez 1 vai antes do frequente que fez 2');
  assert.ok(pesoRodizio(0, 9, false) < pesoRodizio(2, 0, true), 'quem fez 0 vai antes, mesmo com carga alta');
});

test('o bônus SE ESGOTA: ganho o turno extra, o frequente cai atrás de quem está em 2', () => {
  // 2 → 2,5 → 3. Depois do turno extra ele volta para o fim da fila sozinho, sem teto
  // escrito no código e sem caso especial.
  assert.ok(pesoRodizio(2, 0, false) < pesoRodizio(3, 0, true));
});

test('entre dois frequentes, desempata o rodízio de 6 semanas, como sempre', () => {
  assert.ok(pesoRodizio(2, 1, true) < pesoRodizio(2, 4, true));
});

test('um turno a mais na geração continua sendo PESO_MES+1, inclusive no frequente', () => {
  // O gerador soma isso a quem acabou de escalar. Se a conta do frequente não fechasse com
  // a mesma soma, ele ganharia o bônus DUAS vezes na mesma geração.
  assert.strictEqual(pesoRodizio(2, 0, true) + PESO_MES + 1, pesoRodizio(3, 1, true));
});

test('sem a marca, nada muda — o peso é idêntico ao de antes', () => {
  assert.strictEqual(pesoRodizio(2, 3, false), pesoRodizio(2, 3));
  assert.strictEqual(pesoRodizio(0, 0, false), 0);
});

test('contarParaRodizio aplica a marca a partir da lista de frequentes', () => {
  const p = contarParaRodizio({
    refData: REF, janelaDias: 42, frequentes: ['m2'],
    escalas: [
      { membro_id: 'm1', data: '2026-09-06' }, { membro_id: 'm1', data: '2026-09-13' },
      { membro_id: 'm2', data: '2026-09-06' }, { membro_id: 'm2', data: '2026-09-13' },
    ],
  });
  assert.ok(p.m2 < p.m1, 'os dois fizeram 2; o frequente vai primeiro');
  assert.strictEqual(p.m1 - p.m2, PESO_MES / 2);
});
