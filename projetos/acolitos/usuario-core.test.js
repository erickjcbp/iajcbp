// Provas do gerador de usuário de acesso.
//
// 138 pessoas do cadastro não têm login. O usuário delas é criado por esta regra e vira
// o nome com que a criança entra no app pelos próximos anos — não dá para "arrumar
// depois". Os casos daqui saíram do cadastro REAL de 30/08/2026, incluindo as duas
// únicas colisões que existem entre as 138.
const { test } = require('node:test');
const assert = require('node:assert');
const { usuarioDe, gerarUsuarios } = require('./usuario-core.js');

test('primeiro nome + último sobrenome, colado e sem acento', () => {
  assert.strictEqual(usuarioDe('Maysa Gasperi da Silva'), 'maysasilva');
  assert.strictEqual(usuarioDe('Kauan Oliveira Ramos'), 'kauanramos');
  assert.strictEqual(usuarioDe('Clériston Policarpo'), 'cleristonpolicarpo');
  assert.strictEqual(usuarioDe('Katarina Leão'), 'katarinaleao');
});

test('"de", "da", "dos" não viram sobrenome', () => {
  // "Livia de Paula" não pode virar "liviade".
  assert.strictEqual(usuarioDe('Livia de Paula'), 'liviapaula');
  assert.strictEqual(usuarioDe('Carolina Rodrigues dos Santos'), 'carolinasantos');
  assert.strictEqual(usuarioDe('Dandara de Freitas da Rocha'), 'dandararocha');
});

test('inicial solta NÃO vira o sobrenome', () => {
  // "Maria Eduarda M. Araujo" tem de virar mariaaraujo, nunca "mariam".
  assert.strictEqual(usuarioDe('Maria Eduarda M. Araujo'), 'mariaaraujo');
  // e quando a inicial está no FIM, o sobrenome é a última palavra de verdade
  assert.strictEqual(usuarioDe('Ana Paula Souza S.'), 'anasouza');
});

test('nome de uma palavra só não quebra', () => {
  assert.strictEqual(usuarioDe('Cleriston'), 'cleriston');
  assert.strictEqual(usuarioDe('   '), '');
});

test('as DUAS colisões reais das 138 ganham número, e a primeira fica sem', () => {
  // Manuela Marcondes de Souza e Manuela Bragatini Souza; Maria Eduarda M. Araujo e
  // Maria Clara Antunes de Araújo. Ordem estável: rodar de novo dá o mesmo resultado.
  const r = gerarUsuarios([
    { nome: 'Manuela Marcondes de Souza' },
    { nome: 'Manuela Bragatini Souza' },
    { nome: 'Maria Eduarda M. Araujo' },
    { nome: 'Maria Clara Antunes de Araújo' },
  ], []);
  assert.deepStrictEqual(r.map(x => x.usuario),
    ['manuelasouza', 'manuelasouza2', 'mariaaraujo', 'mariaaraujo2']);
});

test('não rouba um usuário que JÁ existe no app', () => {
  // As 55 contas de hoje têm dono. Se o gerador repetisse uma, a pessoa nova entraria
  // na conta de outra criança — ou o cadastro falharia no meio da carga.
  const r = gerarUsuarios([{ nome: 'Carolina Rodrigues dos Santos' }], ['carolinasantos']);
  assert.strictEqual(r[0].usuario, 'carolinasantos2');
});

test('roda duas vezes e dá o MESMO resultado', () => {
  const gente = [{ nome: 'Manuela Bragatini Souza' }, { nome: 'Manuela Marcondes de Souza' }];
  const a = gerarUsuarios(gente, []).map(x => x.usuario);
  const b = gerarUsuarios(gente, []).map(x => x.usuario);
  assert.deepStrictEqual(a, b);
});

test('devolve a pessoa junto, para a folha não trocar linha com usuário', () => {
  const r = gerarUsuarios([{ nome: 'Katarina Leão', id: 'k1' }], []);
  assert.strictEqual(r[0].id, 'k1');
  assert.strictEqual(r[0].nome, 'Katarina Leão');
});
