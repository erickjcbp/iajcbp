// Provas do reconhecedor de cadastro (api/_nomes.js).
//
// Os casos aqui NÃO são inventados: saíram do cadastro real em 27/08/2026, quando
// medi o que aconteceria se o app juntasse pessoas por semelhança de nome. Foram
// 26 pares parecidos e só UM era a mesma pessoa. Cada armadilha daquelas virou uma
// prova, para ninguém "melhorar" o reconhecedor afrouxando a régua e entregando a
// ficha de uma criança para a família de outra.
const { test } = require('node:test');
const assert = require('node:assert');
const nomes = require('../../api/_nomes.js');

test('NÃO confunde pessoas diferentes que parecem parecidas', () => {
  // 76% de semelhança, duas meninas diferentes
  assert.strictEqual(nomes.ehMesmoNome('Heloísa Costa Oliveira', 'Helena Costa Moreira'), false);
  // 81%, e 16 anos de diferença entre elas
  assert.strictEqual(nomes.ehMesmoNome('Pedro Henrique Lima', 'Davi Henrique Lima'), false);
  // mesmo primeiro nome, sobrenomes de famílias diferentes
  assert.strictEqual(nomes.ehMesmoNome('Maria Eduarda Meirelles Marques', 'Maria Eduarda Carli'), false);
  assert.strictEqual(nomes.ehMesmoNome('Lívia Campagnol', 'Livia de Paula'), false);
  assert.strictEqual(nomes.ehMesmoNome('Isabelly Campagnol', 'Isabelly Santos Ignácio'), false);
});

test('reconhece a mesma pessoa escrita de outro jeito', () => {
  assert.ok(nomes.ehMesmoNome('Maria E. Carli', 'Maria Eduarda Carli'));
  assert.ok(nomes.ehMesmoNome('Carolina R. dos Santos', 'Carolina Rodrigues dos Santos'));
  assert.ok(nomes.ehMesmoNome('Isabeli Sousa Martins', 'Isabeli Sousa Martins'));
  assert.ok(nomes.ehMesmoNome('JOSÉ  da   SILVA', 'jose da silva'));       // caixa, acento, espaço
  assert.ok(nomes.ehMesmoNome('Ana Clara Silva de Lima', 'Ana Clara S. de Lima'));
});

test('primeiro nome diferente nunca é a mesma pessoa', () => {
  assert.strictEqual(nomes.ehMesmoNome('Ana Silva', 'Maria Silva'), false);
  assert.strictEqual(nomes.ehMesmoNome('Ana', 'Anahi'), false);
});

test('nome sozinho não basta para reconhecer', () => {
  // Só o primeiro nome, sem mais nada: não pode casar com ninguém de sobrenome.
  assert.strictEqual(nomes.ehMesmoNome('Maria', 'Maria Eduarda Carli'), false);
});

test('a prova é data de nascimento exata', () => {
  const membro = { data_nascimento: '2011-05-02', nome_mae: 'Rita Simone Lima' };
  assert.ok(nomes.provaBate(membro, { nascimento: '2011-05-02' }));
  assert.strictEqual(nomes.provaBate(membro, { nascimento: '2011-05-03' }), false, 'um dia de diferença não pode passar');
  assert.ok(nomes.provaBate(membro, { nascimento: '2011-05-02T00:00:00Z' }), 'data com hora junto ainda vale');
});

test('a prova também pode ser o nome da mãe', () => {
  const membro = { data_nascimento: null, nome_mae: 'Rita Simone Lima Santos' };
  assert.ok(nomes.provaBate(membro, { nome_mae: 'Rita Simone Lima Santos' }));
  assert.ok(nomes.provaBate(membro, { nome_mae: 'Rita S. Lima Santos' }), 'mãe abreviada ainda é a mãe');
  assert.strictEqual(nomes.provaBate(membro, { nome_mae: 'Maria Lima Santos' }), false);
});

test('sem prova nenhuma, não confirma', () => {
  const membro = { data_nascimento: '2011-05-02', nome_mae: 'Rita' };
  assert.strictEqual(nomes.provaBate(membro, {}), false);
  assert.strictEqual(nomes.provaBate(membro, { nascimento: '', nome_mae: '' }), false);
  assert.strictEqual(nomes.provaBate(null, { nascimento: '2011-05-02' }), false);
});

test('ficha sem data e sem nome da mãe nunca confirma sozinha', () => {
  // São 28 pessoas assim no cadastro: elas TÊM de cair na coordenação.
  const membro = { data_nascimento: null, nome_mae: null };
  assert.strictEqual(nomes.provaBate(membro, { nascimento: '2011-05-02', nome_mae: 'Rita' }), false);
});

test('achar parecidos devolve só quem realmente parece', () => {
  const cadastro = [
    { id: 1, nome: 'Maria Eduarda Carli' },
    { id: 2, nome: 'Maria Eduarda da Silva Oliveira' },
    { id: 3, nome: 'Maria Eduarda M. Araujo' },
    { id: 4, nome: 'João Pedro Alves' },
  ];
  assert.deepStrictEqual(nomes.acharParecidos('Maria E. Carli', cadastro).map(m => m.id), [1]);
  assert.deepStrictEqual(nomes.acharParecidos('Maria Eduarda Meirelles Marques', cadastro).map(m => m.id), []);
  assert.deepStrictEqual(nomes.acharParecidos('Fulano de Tal', cadastro).map(m => m.id), []);
});

test('partícula não conta como sobrenome', () => {
  assert.ok(nomes.ehMesmoNome('Luan Aparecido Xavier de Souza', 'Luan Aparecido X. de Souza'));
  assert.deepStrictEqual(nomes.pedacos('João de Souza e Silva'), ['joao', 'souza', 'silva']);
});

test('o nome do responsável também vale como prova', () => {
  // Medido no cadastro em 31/08/2026: 149 fichas têm nome_mae, mas outras 14 só têm o
  // campo "responsável" preenchido — e é o MESMO dado, o nome de quem responde pela
  // criança. Recusar essas 14 seria pedir o nome duas vezes só para poder aceitá-lo.
  const m = { nome: 'Marina Souza Lima', data_nascimento: null,
              nome_mae: null, responsavel: 'Jucimara Martimiano' };
  assert.ok(nomes.provaBate(m, { nome_mae: 'Jucimara Martimiano' }));
});

test('responsável com pai E mãe no mesmo campo: qualquer um dos dois vale', () => {
  // 8 fichas guardam "Pai / Mãe" numa string só, do jeito que a tela de cadastro monta.
  // Comparando a string inteira, nenhuma delas jamais bateria.
  const m = { nome: 'Rafaella Ferreira Moinhos', data_nascimento: null, nome_mae: null,
              responsavel: 'Caio Henrique Moinhos / Jucimara Martimiano' };
  assert.ok(nomes.provaBate(m, { nome_mae: 'Jucimara Martimiano' }), 'pela mãe');
  assert.ok(nomes.provaBate(m, { nome_mae: 'Caio Henrique Moinhos' }), 'pelo pai');
});

test('o nome do pai guardado no campo dele também vale', () => {
  const m = { nome: 'Marina Souza Lima', data_nascimento: null, nome_mae: null,
              nome_pai: 'Fábio Aparecido Gomes Martins' };
  assert.ok(nomes.provaBate(m, { nome_mae: 'Fábio Aparecido Gomes Martins' }));
});

test('mas continua sendo o NOME de alguém, não qualquer coisa parecida', () => {
  // Afrouxar a prova é o oposto do que ela existe para fazer: um nome diferente no campo
  // do responsável NÃO pode abrir a ficha de outra criança.
  const m = { nome: 'Marina Souza Lima', data_nascimento: null, nome_mae: null,
              responsavel: 'Jucimara Martimiano' };
  assert.strictEqual(nomes.provaBate(m, { nome_mae: 'Juliana Martins' }), false);
  assert.strictEqual(nomes.provaBate(m, { nome_mae: '' }), false);
  assert.strictEqual(nomes.provaBate(m, {}), false);
});
