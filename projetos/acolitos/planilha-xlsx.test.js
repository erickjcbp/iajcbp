// Provas do gerador de planilha (planilha-xlsx.js).
//
// Por que estas e não outras: um .xlsx malformado não dá erro nenhum aqui dentro —
// ele só aparece como "o Excel não conseguiu abrir" na mão de quem baixou. Em 26/08
// isso aconteceu de verdade, por dois motivos que estas provas agora vigiam:
// a ORDEM dos elementos dentro da aba, e nome de coluna repetido na tabela.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const fonte = fs.readFileSync(path.join(__dirname, 'planilha-xlsx.js'), 'utf8');
// o arquivo se pendura em window no navegador e em globalThis aqui
new Function(fonte).call(globalThis);
const gerarXLSX = globalThis.gerarXLSX;

// Lê um ZIP "sem compressão" — que é o que o gerador escreve.
async function abrirZip(blob) {
  const buf = Buffer.from(await blob.arrayBuffer());
  const partes = {};
  let i = 0;
  while (i + 4 <= buf.length && buf.readUInt32LE(i) === 0x04034b50) {
    const tam = buf.readUInt32LE(i + 18);
    const tamNome = buf.readUInt16LE(i + 26), extra = buf.readUInt16LE(i + 28);
    const nome = buf.slice(i + 30, i + 30 + tamNome).toString('utf8');
    const ini = i + 30 + tamNome + extra;
    partes[nome] = buf.slice(ini, ini + tam).toString('utf8');
    i = ini + tam;
  }
  return partes;
}

const COLS = [
  { titulo: 'NOME', largura: 30, tipo: 'texto' },
  { titulo: 'INVESTIDO?', largura: 12, tipo: 'centro' },
  { titulo: 'NASCIMENTO', largura: 12, tipo: 'data' },
];

test('gera um arquivo que é mesmo um ZIP com as peças do Excel', async () => {
  const partes = await abrirZip(gerarXLSX(COLS, [['Ana', 'SIM', new Date(2011, 4, 2)]], 'CADASTRO', 1));
  for (const p of ['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/styles.xml',
                   'xl/worksheets/sheet1.xml', 'xl/tables/table1.xml',
                   'xl/_rels/workbook.xml.rels', 'xl/worksheets/_rels/sheet1.xml.rels']) {
    assert.ok(partes[p], 'faltou a peça ' + p);
  }
});

test('a ordem dos elementos da aba é a que o Excel exige', async () => {
  // Foi exatamente isto que fez o Excel recusar o arquivo em 26/08.
  const partes = await abrirZip(gerarXLSX(COLS, [['Ana', 'SIM', null]], 'CADASTRO', 1));
  const aba = partes['xl/worksheets/sheet1.xml'];
  const ORDEM = ['dimension', 'sheetViews', 'sheetFormatPr', 'cols', 'sheetData',
                 'conditionalFormatting', 'dataValidations', 'pageMargins', 'tableParts'];
  const posicoes = ORDEM.map(t => aba.indexOf('<' + t)).filter(p => p >= 0);
  assert.deepStrictEqual(posicoes, [...posicoes].sort((a, b) => a - b),
    'os elementos da aba saíram fora de ordem');
});

test('nome de coluna repetido não derruba a tabela', async () => {
  const cols = [{ titulo: 'NOME' }, { titulo: 'NOME' }, { titulo: 'NOME' }];
  const partes = await abrirZip(gerarXLSX(cols, [['a', 'b', 'c']], 'X', -1));
  const nomes = [...partes['xl/tables/table1.xml'].matchAll(/name="([^"]+)"/g)].map(m => m[1]);
  const daTabela = nomes.filter(n => n.startsWith('NOME'));
  assert.strictEqual(new Set(daTabela).size, daTabela.length, 'a tabela repetiu nome de coluna');
});

test('sinais e acentos não quebram o XML', async () => {
  const partes = await abrirZip(gerarXLSX(COLS, [['A & B <c> "d"', 'NÃO', null]], 'X', 1));
  const aba = partes['xl/worksheets/sheet1.xml'];
  assert.ok(aba.includes('A &amp; B &lt;c&gt; &quot;d&quot;'), 'não escapou os sinais');
  assert.ok(aba.includes('NÃO'), 'perdeu o acento');
});

test('caractere de controle é removido em vez de gerar arquivo ilegível', async () => {
  const sujo = 'Ana' + String.fromCharCode(1) + 'Maria';
  const partes = await abrirZip(gerarXLSX(COLS, [[sujo, 'SIM', null]], 'X', 1));
  const aba = partes['xl/worksheets/sheet1.xml'];
  assert.ok(!new RegExp('[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F]').test(aba),
    'sobrou caractere de controle');
  assert.ok(aba.includes('AnaMaria'), 'devia ter juntado o resto do nome');
});

test('data vira número de data do Excel, não texto', async () => {
  const partes = await abrirZip(gerarXLSX(COLS, [['Ana', 'SIM', new Date(2011, 4, 2)]], 'X', 1));
  assert.ok(/<c r="C2" s="4"><v>40665<\/v><\/c>/.test(partes['xl/worksheets/sheet1.xml']),
    'a data não virou número de data');
});

test('a tabela cobre exatamente as colunas e as linhas que existem', async () => {
  const linhas = [['a', 'SIM', null], ['b', 'NÃO', null], ['c', 'SIM', null]];
  const partes = await abrirZip(gerarXLSX(COLS, linhas, 'X', 1));
  assert.ok(partes['xl/tables/table1.xml'].includes('ref="A1:C4"'), 'o intervalo da tabela não bate');
  assert.ok(partes['xl/worksheets/sheet1.xml'].includes('<dimension ref="A1:C4"/>'), 'a dimensão não bate');
});

test('sem coluna de sim/não, não escreve regra de cor', async () => {
  const partes = await abrirZip(gerarXLSX(COLS, [['a', '', null]], 'X', -1));
  assert.ok(!partes['xl/worksheets/sheet1.xml'].includes('conditionalFormatting'));
});

test('data pura não volta um dia por causa do fuso', () => {
  // "2017-11-21" sozinho, lido do jeito ingênuo, vira 20/11 no Brasil.
  const d = globalThis.dataLocal('2017-11-21');
  assert.strictEqual(d.getFullYear(), 2017);
  assert.strictEqual(d.getMonth() + 1, 11);
  assert.strictEqual(d.getDate(), 21, 'a data voltou um dia');
});

test('texto com hora continua sendo instante de verdade', () => {
  // "entrou no app em" é um instante; aí converter para o fuso de quem olha é o certo.
  const d = globalThis.dataLocal('2026-06-01T01:29:43.000Z');
  assert.ok(d instanceof Date && !isNaN(d.getTime()));
  assert.strictEqual(d.toISOString().slice(0, 10), '2026-06-01');
});

test('texto vazio ou sem sentido vira nada, não vira data doida', () => {
  assert.strictEqual(globalThis.dataLocal(''), null);
  assert.strictEqual(globalThis.dataLocal(null), null);
  assert.strictEqual(globalThis.dataLocal('nem data'), null);
});
