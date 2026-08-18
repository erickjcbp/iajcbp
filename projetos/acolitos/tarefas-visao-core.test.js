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
// ATENÇÃO: estes objetos têm de ter A MESMA FORMA do que a RPC `acolitos_responsaveis_de_tarefa`
// devolve — `{id, nome, apelido, setores}`, e MAIS NADA. Foi por não respeitar isso que a tela
// ficou com a lista de responsáveis vazia no ar: a regra exigia `m.eh_equipe`, a RPC nunca
// devolveu esse campo, e os testes passavam porque as amostras aqui o traziam à mão.
const emTime     = { id:'a', nome:'Ana',   apelido:'Ana',   setores:['formacao','escala'] };
const semTime    = { id:'b', nome:'Bruno', apelido:'Bruno', setores:[] };
const outroTime  = { id:'c', nome:'Caio',  apelido:'Caio',  setores:['almoxarifado'] };

test('o objeto que o BANCO realmente devolve passa na regra', () => {
  // regressão: sem eh_equipe nenhum, como vem da RPC
  assert.strictEqual(podeSerResponsavel(emTime), true);
});
test('não está em time nenhum: NÃO pode', () => {
  assert.strictEqual(podeSerResponsavel(semTime), false);
});
test('com time informado, tem de estar NAQUELE time', () => {
  assert.strictEqual(podeSerResponsavel(emTime, 'formacao'), true);
  assert.strictEqual(podeSerResponsavel(emTime, 'almoxarifado'), false);
});
test('setores ausente ou nulo não quebra', () => {
  assert.strictEqual(podeSerResponsavel({ id:'d', nome:'D' }), false);
  assert.strictEqual(podeSerResponsavel({ id:'e', nome:'E', setores:null }), false);
  assert.strictEqual(podeSerResponsavel(null), false);
});
test('eh_equipe, se vier, é IGNORADO — quem manda é estar no time', () => {
  // o campo não vem da RPC; se algum dia vier, não pode voltar a barrar ninguém
  assert.strictEqual(podeSerResponsavel({ id:'f', setores:['formacao'], eh_equipe:false }), true);
});
test('a lista de possíveis filtra por time', () => {
  const r = responsaveisPossiveis([emTime, semTime, outroTime], 'formacao');
  assert.deepStrictEqual(r.map(m => m.id), ['a']);
});
test('sem time informado, entra quem está em QUALQUER time', () => {
  const r = responsaveisPossiveis([emTime, semTime, outroTime], null);
  assert.deepStrictEqual(r.map(m => m.id), ['a','c']);
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
