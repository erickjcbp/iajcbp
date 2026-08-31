// Provas da DECISÃO de vincular (api/_vinculo.js).
//
// Por que este arquivo existe: até 30/08/2026 a regra de "essa pessoa já existe?"
// morava dentro de UMA das duas portas de cadastro. A porta Família criava a pessoa
// direto, sem perguntar nada, e foi por ali que a Beatriz Dutra Correia virou duas
// fichas com o nome IDÊNTICO. Agora a decisão é um arquivo puro, sem banco e sem
// tela, que as duas portas chamam — uma regra só, impossível de sair de sincronia.
//
// A regra mudou em 30/08, por decisão do dono: quando o nome bate mas a prova não,
// o cadastro NÃO trava mais. Ele segue, e o caso aparece em Config › Cadastros
// barrados. Parede em porta pública deixa família sumindo sem ninguém saber; ficha
// duplicada VISÍVEL a coordenação junta em minutos.
const { test } = require('node:test');
const assert = require('node:assert');
const { decidirVinculo } = require('../../api/_vinculo.js');

// O cadastro de mentira tem a forma REAL do que o servidor lê do banco.
const CADASTRO = [
  { id: 'rafa', nome: 'Rafaela Ferreira',      data_nascimento: '2013-05-02', nome_mae: 'Jucimara Martimiano', user_id: null, nivel: 'acolito_sentinela' },
  { id: 'bia',  nome: 'Beatriz Dutra Correia', data_nascimento: null,         nome_mae: null,                  user_id: null, nivel: 'aspirante' },
  { id: 'lu',   nome: 'Luana Prado',           data_nascimento: '2011-01-09', nome_mae: 'Rita Prado',          user_id: 'conta-da-luana', nivel: 'coroinha' },
];
const base = { membros: CADASTRO, userId: null, errosRecentes: 0 };

test('ninguém parecido: o cadastro segue e nada é registrado', () => {
  const v = decidirVinculo({ ...base, nome: 'Tiago Nunes Vilela', nascimento: '2014-03-03' });
  assert.strictEqual(v.acao, 'seguir');
  assert.strictEqual(v.registrar, null);
});

test('o caso REAL da Rafaella: uma letra a mais no primeiro nome não pode derrubar', () => {
  // "Rafaella" x "Rafaela" — em 30/08/2026 isto criou uma segunda ficha para uma
  // acólita com 7 habilitações, que passou a aparecer no app como novata.
  const v = decidirVinculo({ ...base, nome: 'Rafaella Ferreira Moinhos', nascimento: '2013-05-02' });
  assert.strictEqual(v.acao, 'ligar');
  assert.strictEqual(v.membro_id, 'rafa');
  assert.strictEqual(v.registrar, 'confirmado');
});

test('o nome da mãe também prova, sozinho', () => {
  const v = decidirVinculo({ ...base, nome: 'Rafaella Ferreira Moinhos', nascimento: null, nome_mae: 'Jucimara Martimiano' });
  assert.strictEqual(v.acao, 'ligar');
  assert.strictEqual(v.membro_id, 'rafa');
});

test('nome bate e a prova NÃO: SEGUE o cadastro, e a coordenação fica sabendo', () => {
  // O caso da Beatriz: ficha antiga veio da planilha sem nascimento e sem nome da
  // mãe, então a prova não tinha como bater. Antes isto travava.
  const v = decidirVinculo({ ...base, nome: 'Beatriz Dutra Correia', nascimento: '2017-03-26' });
  assert.strictEqual(v.acao, 'seguir', 'porta pública não pode ter parede');
  assert.strictEqual(v.registrar, 'prova_nao_bateu');
  assert.strictEqual(v.parecido_id, 'bia', 'a coordenação precisa ver COM QUEM pareceu');
});

test('a ficha já tem dono: não liga e não cria segunda ficha em cima da dela', () => {
  const v = decidirVinculo({ ...base, nome: 'Luana Prado', nascimento: '2011-01-09' });
  assert.strictEqual(v.acao, 'ja_tem_conta');
  assert.strictEqual(v.membro_id, 'lu');
});

test('mas se a conta que pede JÁ É a dona da ficha, ligar é o certo', () => {
  const v = decidirVinculo({ ...base, userId: 'conta-da-luana', nome: 'Luana Prado', nascimento: '2011-01-09' });
  assert.strictEqual(v.acao, 'ligar');
  assert.strictEqual(v.membro_id, 'lu');
});

test('FREIO: três erros em 24h param a LIGAÇÃO, nunca o cadastro', () => {
  // Sem parede, chutar data de nascimento não custa nada a quem chuta — e um acerto
  // entrega a ficha de uma criança. O freio ficou MAIS necessário, não menos.
  const v = decidirVinculo({ ...base, errosRecentes: 3, nome: 'Rafaella Ferreira Moinhos', nascimento: '2013-05-02' });
  assert.strictEqual(v.acao, 'seguir', 'o cadastro conclui');
  assert.strictEqual(v.registrar, 'travado');
  assert.ok(!v.membro_id, 'e NÃO liga, mesmo com a prova batendo');
});

test('não junta as gêmeas: mesmo sobrenome e mesma data não bastam', () => {
  // Isabelly e Lívia Campagnol nasceram em 15/02/2015 e cada uma tem o seu login.
  const gemeas = [{ id: 'g1', nome: 'Isabelly Campagnol', data_nascimento: '2015-02-15', nome_mae: 'Sonia Campagnol', user_id: null }];
  const v = decidirVinculo({ ...base, membros: gemeas, nome: 'Lívia Campagnol', nascimento: '2015-02-15', nome_mae: 'Sonia Campagnol' });
  assert.strictEqual(v.acao, 'seguir');
  assert.strictEqual(v.registrar, null, 'nem parecida ela é — primeiro nome diferente');
});

test('sem nome não decide nada', () => {
  assert.strictEqual(decidirVinculo({ ...base, nome: '   ' }).acao, 'seguir');
});
