// Testes do recado de boas-vindas ao time: o que fica guardado e o que chega no celular.
// Rodar: node --test projetos/acolitos/boas-vindas-core.test.js
const test = require('node:test');
const assert = require('node:assert');
const { montarBoasVindas } = require('./boas-vindas-core.js');

const base = { nome: 'Ana Clara Souza', slug: 'escala', label: 'Escala', recado: '' };
const com = (o) => montarBoasVindas(Object.assign({}, base, o));

test('o aviso guarda o time e o nome que a pessoa lê', () => {
  const r = com({});
  assert.strictEqual(r.aviso.tipo, 'boas_vindas_time');
  assert.strictEqual(r.aviso.time, 'escala');
  assert.strictEqual(r.aviso.time_label, 'Escala');
});

test('o aviso nasce NÃO visto — senão a pessoa nunca veria a animação', () => {
  assert.strictEqual(com({}).aviso.seen, false);
});

test('o recado é guardado inteiro, sem corte', () => {
  const longo = 'Ana, te chamei pra Escala porque você tem olho pra detalhe e nunca deixa ' +
    'ninguém na mão. Conto com você nas escalas do mês, e qualquer dúvida me chama.';
  assert.strictEqual(com({ recado: longo }).aviso.recado, longo);
});

// Recado só de espaço tem de virar NADA, não uma caixa vazia com filete dourado na tela.
test('recado só com espaços vira nenhum recado', () => {
  assert.strictEqual(com({ recado: '   \n  ' }).aviso.recado, null);
  assert.strictEqual(com({ recado: '' }).aviso.recado, null);
  assert.strictEqual(com({ recado: undefined }).aviso.recado, null);
});

test('espaço sobrando nas pontas do recado é aparado', () => {
  assert.strictEqual(com({ recado: '  Bem-vinda!  ' }).aviso.recado, 'Bem-vinda!');
});

// A pessoa é chamada pelo primeiro nome: "Ana Clara Souza, você agora é do time..." soa
// como carta de cartório, e isto é uma festa.
test('trata a pessoa pelo primeiro nome', () => {
  assert.strictEqual(com({}).primeiroNome, 'Ana');
  assert.strictEqual(com({ nome: 'Pedro' }).primeiroNome, 'Pedro');
  assert.strictEqual(com({ nome: '  João  Vitor ' }).primeiroNome, 'João');
});

test('sem nome, fala com a pessoa sem citar nome nenhum', () => {
  assert.strictEqual(com({ nome: '' }).primeiroNome, 'Você');
  assert.strictEqual(com({ nome: null }).primeiroNome, 'Você');
});

test('o título da animação diz o time em que a pessoa entrou', () => {
  const r = com({});
  assert.match(r.hero, /Ana/);
  assert.match(r.hero, /Escala/);
});

// O texto padrão existe para quando o dono pula o recado: melhor um texto pronto e bem
// escrito do que a pessoa receber uma festa sem uma linha sequer dirigida a ela.
test('sem recado, o app escreve o texto padrão sozinho', () => {
  const r = com({ recado: '' });
  assert.ok(r.sub.length > 20, 'o texto padrão veio vazio');
  assert.match(r.sub, /Escala/);
});

// As frases são conferidas INTEIRAS. Conferir só se "Ana" e "Escala" aparecem deixou
// passar um "você entrou DO time Escala" para 46 pessoas lerem no celular.
test('o toque no celular diz o time, em português', () => {
  const r = com({});
  assert.strictEqual(r.push.texto, 'Ana, você entrou no time Escala.');
  assert.ok(r.push.titulo.length > 0);
});

test('a frase da animação também sai inteira', () => {
  assert.strictEqual(com({}).hero, 'Ana, você agora é do time Escala');
});

test('sem rótulo de time, as duas frases continuam corretas', () => {
  const r = montarBoasVindas({ nome: 'Ana', slug: 'time_novo_do_banco', label: '', recado: '' });
  assert.strictEqual(r.hero, 'Ana, você agora é da equipe');
  assert.strictEqual(r.push.texto, 'Ana, você entrou na equipe.');
});

// Time sem rótulo conhecido não pode vazar o nome técnico ("ordem_disciplina") para a
// tela de um adolescente. Na dúvida, fala "sua equipe".
test('time sem rótulo não mostra o nome técnico', () => {
  const r = montarBoasVindas({ nome: 'Ana', slug: 'time_novo_do_banco', label: '', recado: '' });
  assert.ok(!/time_novo_do_banco/.test(r.hero + r.sub + r.push.texto),
    'o nome técnico do time apareceu na tela');
  assert.strictEqual(r.aviso.time, 'time_novo_do_banco');   // guardado, mas não exibido
});

test('sem time nenhum não monta aviso', () => {
  assert.strictEqual(montarBoasVindas({ nome: 'Ana' }), null);
  assert.strictEqual(montarBoasVindas(), null);
});
