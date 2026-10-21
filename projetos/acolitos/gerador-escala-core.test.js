const test = require('node:test');
const assert = require('node:assert/strict');
const { gerarSemana, planejarVagas } = require('./gerador-escala-core.js');
const fx = require('./fixtures/gerador-semana.json');

// Fixture SINTÉTICA e anonimizada (nenhum dado real). `esperado` foi gravado rodando o código
// ANTIGO do gerador (que morava em escala.html) com o mesmo sorteio semeado.
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const modeloFor = (tipo, com) => (fx.modelos[tipo + '|' + com] || fx.modelos['missa_comum|' + com] || []).map(f => ({ funcao: f }));
function toSets(o) { const r = {}; for (const k in o) r[k] = new Set(o[k]); return r; }
function entrada(extra) {
  const e = JSON.parse(JSON.stringify(fx.entrada));
  return Object.assign({
    celebracoes: e.celebracoes, todosDaSemana: e.todosDaSemana, membros: e.membros, habMap: e.habMap, dispMap: e.dispMap,
    escalasExistentes: e.escalasExistentes, ausencias: toSets(e.ausencias), historicoSemanal: e.historicoSemanal,
    carga: e.carga, config: e.config, modeloFor, rnd: mulberry32(fx.seed), hoje: new Date(fx.hoje),
  }, extra || {});
}

test('mesmo resultado do código antigo na semana de referência', () => {
  assert.deepEqual(gerarSemana(entrada()).novas, fx.esperado);
});

test('mesmo resultado do código antigo sem informar as missas fora da seleção', () => {
  assert.deepEqual(gerarSemana(entrada({ todosDaSemana: undefined })).novas, fx.esperadoSemTodosDaSemana);
});

test('mesmo resultado do código antigo na geração de uma missa (planejarVagas)', () => {
  const p = fx.planejar, e = entrada();
  const ctx = { membros: e.membros, habMap: e.habMap, dispMap: e.dispMap, config: e.config, rnd: mulberry32(p.seed), hoje: e.hoje };
  const res = planejarVagas(ctx, p.vagas, p.horKey, new Set(p.ausentes), new Set(p.usados), Object.assign({}, e.carga),
    new Set(p.usadoFds), p.comunidade, p.data, e.historicoSemanal.slice());
  assert.deepEqual(res, p.esperado);
});

test('ninguém repete no fim de semana nem na mesma missa, e ausente fica de fora', () => {
  const e = entrada(), r = gerarSemana(e);
  const ids = r.novas.map(n => n.membro_id);
  assert.equal(new Set(ids).size, ids.length);
  r.novas.forEach(n => { assert.ok(!(e.ausencias[n.celebracao_id] || new Set()).has(n.membro_id)); });
  Object.values(e.escalasExistentes).flat().forEach(x => assert.ok(!ids.includes(x.membro_id)));
});

test('não altera os dados de entrada (carga e histórico são copiados)', () => {
  const e = entrada(), carga0 = JSON.stringify(e.carga), hist0 = JSON.stringify(e.historicoSemanal);
  gerarSemana(e);
  assert.equal(JSON.stringify(e.carga), carga0);
  assert.equal(JSON.stringify(e.historicoSemanal), hist0);
});

// ── Mínimo do mês (Task 2) — mundo pequeno e sintético ──────────────────────────────────────
// Sábado 24/10/2026 19h e domingo 25/10 9h, matriz. Cada pessoa: habilitada em cruz e vela,
// disponível nos dois horários. vezesNoMes = as vezes EXATAS do mês (liga o teto do mínimo).
const SAB = { id: 'sab', data: '2026-10-24', horario: '19h', comunidade: 'matriz', tipo: 'missa_comum' };
const DOM = { id: 'dom', data: '2026-10-25', horario: '9h', comunidade: 'matriz', tipo: 'missa_comum' };
function mundo(ids, opts) {
  opts = opts || {};
  const membros = ids.map(id => Object.assign({ id, nome: id, nivel: 'coroinha', comunidade: 'matriz' }, (opts.campos || {})[id] || {}));
  const habMap = {}, dispMap = {};
  ids.forEach(id => { habMap[id] = { cruz: 'apto', vela: 'apto' }; dispMap[id] = ['sabado_19h', 'domingo_9h']; });
  (opts.semHab || []).forEach(id => { habMap[id] = {}; });
  const vagas = opts.vagas || ['cruz'];
  return Object.assign({
    celebracoes: opts.celebs || [SAB], membros, habMap, dispMap, escalasExistentes: {}, ausencias: {},
    historicoSemanal: [], carga: {}, config: { gerador: {} }, modeloFor: () => vagas.map(f => ({ funcao: f })),
    rnd: mulberry32(7), hoje: new Date('2026-10-21T12:00:00Z'),
  }, opts.extra || {});
}
const ids = r => r.novas.map(n => n.membro_id);

test('vaga sem ninguém abaixo de 2× é preenchida por quem já serviu 2×, o menos servido primeiro', () => {
  const r = gerarSemana(mundo(['tres', 'dois', 'quatro'], { extra: { vezesNoMes: { tres: 3, dois: 2, quatro: 4 } } }));
  assert.deepEqual(ids(r), ['dois']);
  assert.deepEqual(r.vazias, []);
  // quem está abaixo do mínimo continua na frente
  const r2 = gerarSemana(mundo(['dois', 'um'], { extra: { vezesNoMes: { dois: 2, um: 1 } } }));
  assert.deepEqual(ids(r2), ['um']);
});

test('quem ainda está abaixo de 2× passa na frente de quem já cumpriu, mesmo com peso de rodízio menor', () => {
  // "freq" já serviu 2× mas é frequente (peso 2×1000 − 500 = 1500); "deve" serviu 1× e tem a
  // janela cheia (1000 + 900 = 1900). Só pelo peso, "freq" ganharia a vaga.
  const e = mundo(['deve', 'freq'], { extra: { vezesNoMes: { deve: 1, freq: 2 }, carga: { deve: 1900, freq: 1500 } } });
  const r = gerarSemana(e);
  assert.deepEqual(ids(r), ['deve']);
  assert.deepEqual(r.alemDoMinimo, []);
  // sem as vezes exatas do mês a geração é a de sempre (peso de rodízio): paridade com o antigo
  const r2 = gerarSemana(mundo(['deve', 'freq'], { extra: { carga: { deve: 1900, freq: 1500 } } }));
  assert.deepEqual(ids(r2), ['freq']);
});

test('nunca escala quem está ausente, sem habilitação ou já na missa, mesmo faltando gente', () => {
  const e = mundo(['aus', 'semhab', 'ja', 'ok'], {
    vagas: ['cruz', 'cruz', 'vela'], semHab: ['semhab'],
    extra: { vezesNoMes: { aus: 2, semhab: 2, ja: 2, ok: 3 }, escalasExistentes: { sab: [{ membro_id: 'ja', funcao: 'vela' }] }, ausencias: { sab: new Set(['aus']) } },
  });
  const r = gerarSemana(e);
  assert.deepEqual(ids(r), ['ok']);
  assert.deepEqual(r.vazias, [{ celebracao_id: 'sab', funcao: 'cruz' }]);
});

test('alemDoMinimo lista fulano com 3 vezes', () => {
  const r = gerarSemana(mundo(['fulano', 'beltrano'], { vagas: ['cruz', 'vela'], extra: { vezesNoMes: { fulano: 2, beltrano: 0 } } }));
  assert.deepEqual(ids(r).sort(), ['beltrano', 'fulano']);
  assert.deepEqual(r.alemDoMinimo, [{ membro_id: 'fulano', vezes: 3 }]);
});

test('o mínimo vem da configuração (minimo_mes) e o padrão é 2', () => {
  const r = gerarSemana(mundo(['fulano'], { extra: { vezesNoMes: { fulano: 2 }, config: { gerador: { minimo_mes: 3 } } } }));
  assert.deepEqual(ids(r), ['fulano']);
  assert.deepEqual(r.alemDoMinimo, []);
  const r2 = gerarSemana(mundo(['fulano'], { extra: { vezesNoMes: { fulano: 2 }, config: {} } }));
  assert.deepEqual(r2.alemDoMinimo, [{ membro_id: 'fulano', vezes: 3 }]);
});

test('quem serve toda semana segue a regra dele (4×) e não esbarra no mínimo de 2×', () => {
  const e = mundo(['semanal', 'outro'], { campos: { semanal: { servir_toda_semana: true } }, extra: { vezesNoMes: { semanal: 3, outro: 2 } } });
  const r = gerarSemana(e);
  assert.deepEqual(ids(r), ['semanal']);
  assert.deepEqual(r.alemDoMinimo, []);
});

test('com todos acima do mínimo e vaga cheia nada muda', () => {
  const e = mundo(['a', 'b'], { extra: { vezesNoMes: { a: 3, b: 4 }, escalasExistentes: { sab: [{ membro_id: 'a', funcao: 'cruz' }] } } });
  const r = gerarSemana(e);
  assert.deepEqual(r.novas, []);
  assert.deepEqual(r.vazias, []);
  assert.deepEqual(r.alemDoMinimo, []);
});
