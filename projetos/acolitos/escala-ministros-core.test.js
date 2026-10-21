// Rodar: node --test projetos/acolitos/escala-ministros-core.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { lerEscalaMinistros, casarNomes } = require('./escala-ministros-core.js');

const TEXTO = fs.readFileSync(path.join(__dirname, 'fixtures', 'escala-ministros-outubro.txt'), 'utf8');
const LIDOS = lerEscalaMinistros(TEXTO, 2026);
const missa = (data, horario) => LIDOS.find((l) => l.data === data && l.horario === horario);

test("lê 'SÁBADO 24/out' 17h Matriz com os nomes certos", () => {
  const m = missa('2026-10-24', '17h');
  assert.ok(m, 'sábado 24 17h existe');
  assert.strictEqual(m.comunidade, 'matriz');
  assert.deepStrictEqual(m.nomes, ['Rita E.', 'Eder', 'Sônia', 'Fabiana', 'Tatiana', 'Paulo M.', 'Valquíria', 'Geraldo']);
});

test('Santo Antônio 18h30 do sábado 24', () => {
  const m = missa('2026-10-24', '18h30');
  assert.ok(m);
  assert.strictEqual(m.comunidade, 'santo_antonio');
  assert.deepStrictEqual(m.nomes, ['Ceilma', 'Roseval']);
});

test('dom 25/10 7h, 9h e 19h', () => {
  assert.deepStrictEqual(LIDOS.filter((l) => l.data === '2026-10-25').map((l) => l.horario), ['7h', '9h', '19h']);
  assert.deepStrictEqual(missa('2026-10-25', '7h').nomes.slice(0, 2), ['Vani', 'Magno']);
  assert.deepStrictEqual(missa('2026-10-25', '9h').nomes.slice(0, 2), ['Marli', 'Marcos']);
  assert.deepStrictEqual(missa('2026-10-25', '19h').nomes.slice(0, 2), ['Gisele', 'Ivan']);
  LIDOS.filter((l) => l.data === '2026-10-25').forEach((l) => assert.strictEqual(l.comunidade, 'matriz'));
});

test('data especial 12/out entra', () => {
  const dia = LIDOS.filter((l) => l.data === '2026-10-12');
  assert.deepStrictEqual(dia.map((l) => [l.horario, l.comunidade]), [['7h', 'matriz'], ['8h30', 'outra'], ['11h', 'matriz']]);
  assert.deepStrictEqual(dia[1].nomes, ['Rafaela', 'Adriano', 'Fernanda B.', 'Lucimara', 'Tatiana', 'Paulo M.']);
});

test('adoração não vira missa', () => {
  ['14h', '15h', '16h'].forEach((h) => assert.strictEqual(LIDOS.filter((l) => l.horario === h).length, 0));
  LIDOS.forEach((l) => {
    assert.ok(!l.nomes.includes('Jo') && !l.nomes.includes('Osmarina'));
    l.nomes.forEach((n) => assert.ok(!/SANT[IÍ]SSIMO|EXPOR|RETIRAR/.test(n), n));
  });
  // o domingo 4/out tem missa às 7h, 9h e 19h, mas nada da adoração (14h–17h) entra nele
  assert.deepStrictEqual(LIDOS.filter((l) => l.data === '2026-10-04').map((l) => l.horario), ['7h', '9h', '19h']);
});

test('11 de novembro... 1/nov vira 2026-11-01', () => {
  const dia = LIDOS.filter((l) => l.data === '2026-11-01');
  assert.deepStrictEqual(dia.map((l) => l.horario), ['7h', '9h', '19h']);
  assert.deepStrictEqual(dia[0].nomes.slice(0, 2), ['Claudia S.', 'Janaina']);
  assert.ok(!LIDOS.some((l) => l.data === '2026-01-01'));
});

test("casal 'Adriana Acisio' vira duas pessoas", () => {
  const m = missa('2026-10-03', '17h');
  assert.deepStrictEqual(m.nomes, ['Adriana', 'Acisio', 'Cristiana M.', 'Claudio S.', 'Luís', 'Luzia', 'Angela', 'Gilberto']);
});

test("'João Bot.' e 'Ivan S.R' mantêm a inicial", () => {
  const m = missa('2026-10-12', '11h');
  assert.deepStrictEqual(m.nomes, ['Sebastiana', 'José M.', 'Neusa', 'Alex', 'João Bot.', 'Ivan S.R', 'Karina', 'Tony']);
});

test('outubro inteiro: 11 dias, sábado 24 e domingo 25 certos', () => {
  const dias = [...new Set(LIDOS.map((l) => l.data))];
  assert.deepStrictEqual(dias, ['2026-10-03', '2026-10-04', '2026-10-10', '2026-10-11', '2026-10-12',
    '2026-10-17', '2026-10-18', '2026-10-24', '2026-10-25', '2026-10-31', '2026-11-01']);
  assert.strictEqual(LIDOS.length, 28);
  const s17 = missa('2026-10-24', '17h'), s1830 = missa('2026-10-24', '18h30');
  assert.strictEqual(s17.comunidade, 'matriz');
  assert.ok(s17.nomes.includes('Rita E.') && s17.nomes.includes('Eder'));
  assert.strictEqual(s1830.comunidade, 'santo_antonio');
  assert.ok(s1830.nomes.includes('Ceilma') && s1830.nomes.includes('Roseval'));
  assert.ok(missa('2026-10-25', '7h').nomes.includes('Vani'));
  assert.ok(missa('2026-10-25', '9h').nomes.includes('Marli'));
  assert.ok(missa('2026-10-25', '19h').nomes.includes('Gisele'));
  // sábado 10 + domingo 11 vêm no mesmo bloco: o domingo começa onde a hora volta (18h30 → 7h)
  assert.deepStrictEqual(LIDOS.filter((l) => l.data === '2026-10-10').map((l) => l.horario), ['17h', '18h30']);
  assert.deepStrictEqual(LIDOS.filter((l) => l.data === '2026-10-11').map((l) => l.horario), ['7h', '9h', '19h']);
});

test('texto vazio ou de outro layout devolve [] sem lançar', () => {
  assert.deepStrictEqual(lerEscalaMinistros('', 2026), []);
  assert.deepStrictEqual(lerEscalaMinistros(null, 2026), []);
  assert.deepStrictEqual(lerEscalaMinistros(undefined), []);
  assert.deepStrictEqual(lerEscalaMinistros('Relatório financeiro\nTotal: 10:00 reais\nfim', 2026), []);
  assert.deepStrictEqual(lerEscalaMinistros('SÁBADO 3/out\n\nnada de horário aqui', 2026), []);
  assert.deepStrictEqual(lerEscalaMinistros({ x: 1 }, 2026), []);
  assert.doesNotThrow(() => casarNomes(null, null, null));
  assert.deepStrictEqual(casarNomes(null, null, null), { casados: [], duvidas: [], ignorados: [] });
});

// ---------- casarNomes ----------
const membros = [
  { id: 'm1', nome: 'Maria Clara', nome_pai_ministro: 'Luís Eduardo Prado', nome_mae_ministro: 'Rita Esteves', tem_pai_ministro: true, tem_mae_ministro: true },
  { id: 'm2', nome: 'João Pedro', nome_pai_ministro: 'Luis Carlos', nome_mae_ministro: 'Rita Almeida', tem_pai_ministro: true, tem_mae_ministro: true },
  { id: 'm3', nome: 'Ana', nome_pai_ministro: 'Eder', nome_mae_ministro: 'Fabiana Souza', tem_pai_ministro: true, tem_mae_ministro: false },
];
const lido = (nomes) => [{ data: '2026-10-24', horario: '17h', comunidade: 'matriz', nomes }];

test('nome com inicial casa só quem tem a inicial', () => {
  const r = casarNomes(lido(['Rita E.']), membros, []);
  assert.deepStrictEqual(r.casados, [{ data: '2026-10-24', horario: '17h', comunidade: 'matriz', membro_id: 'm1', pai_ou_mae: 'mae', nome: 'Rita E.' }]);
  assert.deepStrictEqual(r.duvidas, []);
  // pai sem segundo nome aceita inicial; mãe com flag falsa não entra
  const r2 = casarNomes(lido(['Eder X.', 'Fabiana', 'Marcos']), membros, []);
  assert.deepStrictEqual(r2.casados.map((c) => [c.membro_id, c.pai_ou_mae, c.nome]), [['m3', 'pai', 'Eder X.']]);
  assert.deepStrictEqual(r2.ignorados, ['Fabiana', 'Marcos']);
});

test("dois 'Luís' viram dúvida com as duas opções", () => {
  const r = casarNomes(lido(['Luís']), membros, []);
  assert.deepStrictEqual(r.casados, []);
  assert.deepStrictEqual(r.duvidas, [{ nome: 'Luís', opcoes: [
    { membro_id: 'm1', pai_ou_mae: 'pai', rotulo: 'pai de Maria Clara' },
    { membro_id: 'm2', pai_ou_mae: 'pai', rotulo: 'pai de João Pedro' },
  ] }]);
  // o mesmo nome em duas missas é UMA dúvida
  const r2 = casarNomes([...lido(['Luís']), { data: '2026-10-25', horario: '9h', comunidade: 'matriz', nomes: ['Luís'] }], membros, []);
  assert.strictEqual(r2.duvidas.length, 1);
});

test('sim lembrado casa sozinho', () => {
  const ap = [{ nome_pdf: 'luis', membro_id: 'm2', pai_ou_mae: 'pai', resposta: 'sim' }];
  const r = casarNomes(lido(['Luís']), membros, ap);
  assert.deepStrictEqual(r.duvidas, []);
  assert.deepStrictEqual(r.casados.map((c) => [c.membro_id, c.pai_ou_mae, c.nome]), [['m2', 'pai', 'Luís']]);
});

test('não lembrado não volta como dúvida', () => {
  const ap = [{ nome_pdf: 'luis', membro_id: 'm1', pai_ou_mae: 'pai', resposta: 'nao' }];
  const r = casarNomes(lido(['Luís']), membros, ap);
  assert.deepStrictEqual(r.duvidas, []);
  assert.deepStrictEqual(r.casados.map((c) => [c.membro_id, c.pai_ou_mae]), [['m2', 'pai']]);
  // os dois "não": sobra nada → ignorado, não dúvida
  const ap2 = ap.concat([{ nome_pdf: 'luis', membro_id: 'm2', pai_ou_mae: 'pai', resposta: 'nao' }]);
  const r2 = casarNomes(lido(['Luís']), membros, ap2);
  assert.deepStrictEqual([r2.casados, r2.duvidas, r2.ignorados], [[], [], ['Luís']]);
});

test('memória de pai que mudou de nome é ignorada', () => {
  // lembrou "Eder = pai de Ana"; o pai da Ana agora se chama Roberto → a memória não vale
  const mudou = membros.map((m) => (m.id === 'm3' ? { ...m, nome_pai_ministro: 'Roberto Lima' } : m));
  const ap = [{ nome_pdf: 'eder', membro_id: 'm3', pai_ou_mae: 'pai', resposta: 'sim' }];
  const r = casarNomes(lido(['Eder']), mudou, ap);
  assert.deepStrictEqual([r.casados, r.duvidas, r.ignorados], [[], [], ['Eder']]);
  // e se a flag de pai ministro foi desligada, também não vale
  const semFlag = membros.map((m) => (m.id === 'm3' ? { ...m, tem_pai_ministro: false } : m));
  const r2 = casarNomes(lido(['Eder']), semFlag, ap);
  assert.deepStrictEqual(r2.casados, []);
  // a memória de "sim" vencida cai para a regra normal (Luís → dúvida volta)
  const ap3 = [{ nome_pdf: 'luis', membro_id: 'm1', pai_ou_mae: 'pai', resposta: 'sim' }];
  const trocou = membros.map((m) => (m.id === 'm1' ? { ...m, nome_pai_ministro: 'Paulo Prado' } : m));
  const r3 = casarNomes(lido(['Luís']), trocou, ap3);
  assert.deepStrictEqual(r3.casados.map((c) => [c.membro_id, c.pai_ou_mae]), [['m2', 'pai']]);
});
