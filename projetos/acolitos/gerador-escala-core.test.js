const test = require('node:test');
const assert = require('node:assert/strict');
const { gerarSemana, planejarVagas } = require('./gerador-escala-core.js');
const fx = require('./fixtures/gerador-semana.json');
const preferencia = require('./fixtures/gerador-semana-cruz-cerimoniario.json');

// Fixture SINTÉTICA e anonimizada (nenhum dado real). A fixture original guarda o código
// ANTIGO; a expectativa atual fica em gerador-semana-cruz-cerimoniario.json. O gerador original (que morava em escala.html) com o mesmo sorteio semeado.
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

test('semana de referência com preferência de cerimoniário na cruz da Matriz', () => {
  assert.deepEqual(gerarSemana(entrada()).novas, preferencia.esperado);
});

test('referência com cruz preferencial sem informar missas fora da seleção', () => {
  assert.deepEqual(gerarSemana(entrada({ todosDaSemana: undefined })).novas, preferencia.esperadoSemTodosDaSemana);
});

test('referência com cruz preferencial na geração de uma missa (planejarVagas)', () => {
  const p = fx.planejar, e = entrada();
  const ctx = { membros: e.membros, habMap: e.habMap, dispMap: e.dispMap, config: e.config, rnd: mulberry32(p.seed), hoje: e.hoje };
  const res = planejarVagas(ctx, p.vagas, p.horKey, new Set(p.ausentes), new Set(p.usados), Object.assign({}, e.carga),
    new Set(p.usadoFds), p.comunidade, p.data, e.historicoSemanal.slice());
  assert.deepEqual(res, preferencia.planejar);
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

// ---- Task 5: filho de ministro na mesma missa ----
const min = (celeb, id) => ({ data: celeb.data, horario: celeb.horario, comunidade: celeb.comunidade, membro_id: id });
test('filho entra na missa em que a mãe serve', () => {
  const e = mundo(['a', 'b', 'c', 'filho'], { celebs: [SAB, DOM], extra: { ministros: [min(DOM, 'filho')] } });
  const r = gerarSemana(e);
  const n = r.novas.find(x => x.membro_id === 'filho');
  assert.equal(n && n.celebracao_id, 'dom');
  assert.deepEqual(r.semVagaFilhoDeMinistro, []);
});
test('mãe em duas missas do fim de semana: filho na primeira em que cabe, uma só vez', () => {
  const e = mundo(['a', 'b', 'c', 'filho'], { celebs: [SAB, DOM], extra: { ministros: [min(SAB, 'filho'), min(DOM, 'filho')] } });
  const r = gerarSemana(e);
  const meus = r.novas.filter(x => x.membro_id === 'filho');
  assert.equal(meus.length, 1);
  assert.equal(meus[0].celebracao_id, 'sab');
});
test('filho ausente não é escalado e aparece em semVagaFilhoDeMinistro', () => {
  const e = mundo(['a', 'b', 'filho'], { celebs: [DOM], extra: { ministros: [min(DOM, 'filho')], ausencias: { dom: new Set(['filho']) } } });
  const r = gerarSemana(e);
  assert.ok(!ids(r).includes('filho'));
  assert.deepEqual(r.semVagaFilhoDeMinistro, [{ membro_id: 'filho', motivo: 'ausente' }]);
});
test('filho sem habilitação para nenhuma vaga aberta não é forçado', () => {
  const e = mundo(['a', 'b', 'filho'], { celebs: [DOM], semHab: ['filho'], extra: { ministros: [min(DOM, 'filho')] } });
  const r = gerarSemana(e);
  assert.ok(!ids(r).includes('filho'));
  assert.equal(r.semVagaFilhoDeMinistro.length, 1);
  assert.equal(r.semVagaFilhoDeMinistro[0].motivo, 'sem_vaga_compativel');
});
test('sem ministros o resultado é igual ao de antes (e a lista vem vazia)', () => {
  const base = gerarSemana(mundo(['a', 'b', 'c'], { celebs: [SAB, DOM] }));
  const com = gerarSemana(mundo(['a', 'b', 'c'], { celebs: [SAB, DOM], extra: { ministros: [] } }));
  assert.deepEqual(com.novas, base.novas);
  assert.deepEqual(com.semVagaFilhoDeMinistro, []);
});
test('missa fora da geração não força o filho em outra missa', () => {
  const e = mundo(['a', 'b', 'filho'], { celebs: [SAB], extra: { ministros: [min(DOM, 'filho')] } });
  const r = gerarSemana(e);
  assert.deepEqual(r.semVagaFilhoDeMinistro, [{ membro_id: 'filho', motivo: 'missa_fora_da_geracao' }]);
});

// ---- fim de semana que cruza o mês (31/10 e 01/11): cada missa conta no mês dela ----
test('fim de semana que cruza o mês: a missa de novembro não herda as vezes de outubro', () => {
  const S31 = { id: 's31', data: '2026-10-31', horario: '19h', comunidade: 'matriz', tipo: 'missa_comum' };
  const D01 = { id: 'd01', data: '2026-11-01', horario: '9h', comunidade: 'matriz', tipo: 'missa_comum' };
  const e = mundo(['a', 'b'], { celebs: [S31, D01], extra: { vezesNoMes: { '2026-10': { a: 2, b: 2 }, '2026-11': {} } } });
  const r = gerarSemana(e);
  assert.equal(r.novas.length, 2);
  assert.equal(r.alemDoMinimo.length, 1, 'só quem serviu o sábado de outubro passou de 2×');
  assert.equal(r.alemDoMinimo[0].vezes, 3);
  const dom = r.novas.find(n => n.celebracao_id === 'd01').membro_id;
  assert.ok(!r.alemDoMinimo.some(x => x.membro_id === dom));
});
test('vezesNoMes simples (sem meses) continua valendo para todas as missas', () => {
  const e = mundo(['a', 'b'], { celebs: [SAB, DOM], extra: { vezesNoMes: { a: 2, b: 2 } } });
  assert.equal(gerarSemana(e).alemDoMinimo.length, 2);
});


test('Matriz: cerimoniário ganha preferência na cruz antes das outras funções, nos dois geradores',()=>{
 const e=mundo(['jovem','cerimo'],{vagas:['vela','cruz'],campos:{jovem:{data_nascimento:'2008-01-01'},cerimo:{nivel:'cerimoniario_guardiao',data_nascimento:'2000-01-01'}},extra:{carga:{jovem:0,cerimo:100}}});
 const r=gerarSemana(e);assert.equal(r.novas.find(n=>n.funcao==='cruz').membro_id,'cerimo');assert.equal(r.novas.find(n=>n.funcao==='vela').membro_id,'jovem');
 const ctx={membros:e.membros,habMap:e.habMap,dispMap:e.dispMap,config:e.config,rnd:e.rnd,hoje:e.hoje};
 assert.deepEqual(planejarVagas(ctx,['vela','cruz'],'sabado_19h',new Set(),new Set(),{jovem:0,cerimo:100},new Set(),'matriz',SAB.data,[]),['jovem','cerimo']);
});

test('preferência na cruz não ignora ausência, disponibilidade, habilitação, kit ou escolha manual',()=>{
 const criar=()=>mundo(['jovem','cerimo'],{campos:{jovem:{data_nascimento:'2008-01-01'},cerimo:{nivel:'cerimoniario_guardiao',data_nascimento:'2000-01-01'}},extra:{carga:{jovem:0,cerimo:100}}});
 for(const ajuste of [e=>e.ausencias={sab:new Set(['cerimo'])},e=>e.dispMap.cerimo=[],e=>e.habMap.cerimo={},e=>{e.config.gerador.kits=[{id:'proc',ativo:true,modo:'trava',comunidades:['matriz'],funcoes:['cruz'],idade_min:14,liberados:[]}];e.membros.find(m=>m.id==='cerimo').data_nascimento='2015-01-01';}]){const e=criar();ajuste(e);assert.equal(gerarSemana(e).novas.find(n=>n.funcao==='cruz').membro_id,'jovem');}
 const e=criar();e.escalasExistentes={sab:[{membro_id:'jovem',funcao:'cruz'}]};assert.equal(gerarSemana(e).novas.length,0);
 const outra=criar();outra.celebracoes=[{...SAB,comunidade:'santo_antonio'}];outra.membros.forEach(m=>m.comunidade='santo_antonio');assert.equal(gerarSemana(outra).novas[0].membro_id,'jovem');
});

test('reserva da cruz não duplica cerimoniário que serve toda semana',()=>{
 const e=mundo(['jovem','cerimo'],{vagas:['cruz','vela'],campos:{cerimo:{nivel:'cerimoniario_guardiao',servir_toda_semana:true,data_nascimento:'2000-01-01'}}});
 const r=gerarSemana(e);assert.equal(r.novas.filter(n=>n.membro_id==='cerimo').length,1);assert.equal(r.novas.find(n=>n.membro_id==='cerimo').funcao,'cruz');
});


test('preferência da cruz preserva a missa em que o pai/mãe ministro serve',()=>{
 const e=mundo(['jovem','cerimo'],{celebs:[SAB,DOM],campos:{cerimo:{nivel:'cerimoniario_guardiao',data_nascimento:'2000-01-01'}},extra:{ministros:[{membro_id:'cerimo',data:DOM.data,horario:DOM.horario,comunidade:'matriz'}]}});
 const r=gerarSemana(e);assert.equal(r.novas.find(n=>n.membro_id==='cerimo').celebracao_id,'dom');assert.equal(r.novas.find(n=>n.membro_id==='cerimo').funcao,'cruz');
});


test('irmão autorizado herda missa do vínculo importado, mesmo quando o titular não acompanha os pais', () => {
  const e = mundo(['titular','irmao','outro'], {celebs:[SAB,DOM], vagas:['vela','vela'], campos:{
    titular:{grupo_irmaos:'familia',escalar_com_pais:false},irmao:{grupo_irmaos:'familia',escalar_com_pais:true}
  },extra:{ministros:[min(DOM,'titular')]}});
  const r=gerarSemana(e);
  assert.equal(r.novas.find(n=>n.membro_id==='irmao').celebracao_id,'dom');
  assert.equal(r.novas.find(n=>n.membro_id==='titular').celebracao_id,'sab');
});
test('irmãos com opção ativa acompanham juntos a missa dos pais', () => {
  const e=mundo(['titular','irmao','outro'], {celebs:[SAB,DOM],vagas:['vela','vela'],campos:{
    titular:{grupo_irmaos:'familia',escalar_com_pais:true},irmao:{grupo_irmaos:'familia',escalar_com_pais:true}
  },extra:{ministros:[min(DOM,'titular')]}});
  const r=gerarSemana(e);
  for(const id of ['titular','irmao']) assert.equal(r.novas.find(n=>n.membro_id===id).celebracao_id,'dom');
});
