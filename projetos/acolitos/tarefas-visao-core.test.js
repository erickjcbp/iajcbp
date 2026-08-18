// Rodar: node --test projetos/acolitos/tarefas-visao-core.test.js
const test = require('node:test');
const assert = require('node:assert');
const { estadoDaTarefa, podeSerResponsavel, responsaveisPossiveis,
        filtrar, ordenar, agruparPorTime } = require('./tarefas-visao-core.js');

// ── estado ──────────────────────────────────────────────────────────
test('sem data nenhuma: a fazer', () => {
  assert.strictEqual(estadoDaTarefa({ titulo:'x' }), 'afazer');
});
test('com andamento_em: em andamento', () => {
  assert.strictEqual(estadoDaTarefa({ andamento_em:'2026-08-18T10:00:00Z' }), 'andamento');
});
test('concluída vence andamento — as duas datas juntas não geram contradição', () => {
  assert.strictEqual(estadoDaTarefa({ andamento_em:'2026-08-18T10:00:00Z', concluida_em:'2026-08-19T10:00:00Z' }), 'feita');
});
test('tarefa inexistente não quebra', () => {
  assert.strictEqual(estadoDaTarefa(null), 'afazer');
  assert.strictEqual(estadoDaTarefa(), 'afazer');
});

// ── quem pode ser responsável ───────────────────────────────────────
const naEquipeEmTime  = { id:'a', eh_equipe:true,  setores:['formacao','escala'] };
const naEquipeSemTime = { id:'b', eh_equipe:true,  setores:[] };
const emTimeSemEquipe = { id:'c', eh_equipe:false, setores:['formacao'] };

test('está num time E é da equipe: pode', () => {
  assert.strictEqual(podeSerResponsavel(naEquipeEmTime), true);
});
test('é da equipe mas não está em time nenhum: NÃO pode', () => {
  assert.strictEqual(podeSerResponsavel(naEquipeSemTime), false);
});
test('está num time mas não é da equipe: NÃO pode', () => {
  assert.strictEqual(podeSerResponsavel(emTimeSemEquipe), false);
});
test('com time informado, tem de estar NAQUELE time', () => {
  assert.strictEqual(podeSerResponsavel(naEquipeEmTime, 'formacao'), true);
  assert.strictEqual(podeSerResponsavel(naEquipeEmTime, 'almoxarifado'), false);
});
test('setores ausente ou nulo não quebra', () => {
  assert.strictEqual(podeSerResponsavel({ id:'d', eh_equipe:true }), false);
  assert.strictEqual(podeSerResponsavel({ id:'e', eh_equipe:true, setores:null }), false);
  assert.strictEqual(podeSerResponsavel(null), false);
});
test('a lista de possíveis filtra os três casos de uma vez', () => {
  const r = responsaveisPossiveis([naEquipeEmTime, naEquipeSemTime, emTimeSemEquipe], 'formacao');
  assert.deepStrictEqual(r.map(m => m.id), ['a']);
});

// ── filtro ──────────────────────────────────────────────────────────
const T = [
  { id:'1', titulo:'repor incenso',   time_slug:'almoxarifado', prazo:'2026-08-20', responsavel_id:'a' },
  { id:'2', titulo:'ensaio de julho', time_slug:'formacao',     prazo:null,         responsavel_id:null, observacao:'levar o turíbulo' },
  { id:'3', titulo:'conferir velas',  time_slug:'almoxarifado', prazo:'2026-08-10', responsavel_id:null, concluida_em:'2026-08-11T00:00:00Z' },
  { id:'4', titulo:'montar escala',   time_slug:'escala',       prazo:'2026-09-01', responsavel_id:'b', andamento_em:'2026-08-18T00:00:00Z' },
];

test('filtro vazio devolve tudo — filtro que some com tudo faz a tela parecer sem dado', () => {
  assert.strictEqual(filtrar(T, {}).length, 4);
  assert.strictEqual(filtrar(T).length, 4);
});
test('filtra por time', () => {
  assert.deepStrictEqual(filtrar(T, { time:'almoxarifado' }).map(t=>t.id), ['1','3']);
});
test('filtra por estado', () => {
  assert.deepStrictEqual(filtrar(T, { estado:'feita' }).map(t=>t.id), ['3']);
  assert.deepStrictEqual(filtrar(T, { estado:'andamento' }).map(t=>t.id), ['4']);
  assert.deepStrictEqual(filtrar(T, { estado:'afazer' }).map(t=>t.id), ['1','2']);
});
test('filtra por responsável, e "sem responsável" é um filtro próprio', () => {
  assert.deepStrictEqual(filtrar(T, { responsavel:'a' }).map(t=>t.id), ['1']);
  assert.deepStrictEqual(filtrar(T, { responsavel:'__sem__' }).map(t=>t.id), ['2','3']);
});
test('busca por texto olha título E observação, sem diferenciar maiúscula', () => {
  assert.deepStrictEqual(filtrar(T, { texto:'INCENSO' }).map(t=>t.id), ['1']);
  assert.deepStrictEqual(filtrar(T, { texto:'turíbulo' }).map(t=>t.id), ['2']);
});
test('filtros se somam', () => {
  assert.deepStrictEqual(filtrar(T, { time:'almoxarifado', estado:'afazer' }).map(t=>t.id), ['1']);
});

// ── ordenação ───────────────────────────────────────────────────────
test('por prazo, e sem prazo vai para o FIM', () => {
  assert.deepStrictEqual(ordenar(T,'prazo').map(t=>t.id), ['3','1','4','2']);
});
test('sem prazo continua no fim ao inverter — não é "a mais urgente" nem "a menos"', () => {
  assert.deepStrictEqual(ordenar(T,'prazo',true).map(t=>t.id), ['4','1','3','2']);
});
test('por título', () => {
  assert.deepStrictEqual(ordenar(T,'titulo').map(t=>t.id), ['3','2','4','1']);
});
test('por responsável usa o apelido e joga sem responsável para o fim', () => {
  const comNome = [
    { id:'x', responsavel:{ nome:'Bruno Silva', apelido:'Bruno' } },
    { id:'y', responsavel:null },
    { id:'z', responsavel:{ nome:'Ana Paula' } },
  ];
  assert.deepStrictEqual(ordenar(comNome,'responsavel').map(t=>t.id), ['z','x','y']);
});
test('ordenar não mexe na lista original', () => {
  const antes = T.map(t=>t.id);
  ordenar(T,'titulo');
  assert.deepStrictEqual(T.map(t=>t.id), antes);
});

// ── agrupar por time ────────────────────────────────────────────────
const TIMES = [{valor:'almoxarifado',label:'Almoxarifado'},{valor:'formacao',label:'Formação'},{valor:'midia',label:'Mídia'}];
test('todo time aparece, mesmo sem tarefa — time vazio é informação', () => {
  const g = agruparPorTime(T, TIMES);
  const midia = g.find(x=>x.time.valor==='midia');
  assert.ok(midia, 'a Mídia sumiu');
  assert.strictEqual(midia.tarefas.length, 0);
});
test('tarefa de time que saiu do catálogo não some: aparece com o apelido cru', () => {
  const g = agruparPorTime(T, TIMES);
  const escala = g.find(x=>x.time.valor==='escala');
  assert.ok(escala, 'a tarefa do time apagado sumiu da tela');
  assert.strictEqual(escala.tarefas.length, 1);
});
test('sem time nenhum cadastrado ainda não quebra', () => {
  assert.deepStrictEqual(agruparPorTime([], []), []);
  assert.deepStrictEqual(agruparPorTime(), []);
});
