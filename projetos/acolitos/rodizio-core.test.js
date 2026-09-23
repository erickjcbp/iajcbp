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
