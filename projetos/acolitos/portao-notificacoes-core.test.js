// Testes do portão de notificações: quem entra no app e quem para na parede.
// Rodar: node --test projetos/acolitos/portao-notificacoes-core.test.js
const test = require('node:test');
const assert = require('node:assert');
const { decidirPortaoNotificacoes } = require('./portao-notificacoes-core.js');

// Situação de um celular normal, com o sino ligado. Cada teste muda só o que interessa.
const sit = (o) => Object.assign({
  suporte: 'ok', permissao: 'granted', iosSemInstalar: false, inscrito: true, etapaCrm: null,
}, o);

test('quem tem o sino ligado entra', () => {
  const r = decidirPortaoNotificacoes(sit({}));
  assert.strictEqual(r.entra, true);
  assert.strictEqual(r.parede, null);
});

test('quem ainda pode ser perguntado para na parede que pede', () => {
  const r = decidirPortaoNotificacoes(sit({ permissao: 'default', inscrito: false }));
  assert.strictEqual(r.entra, false);
  assert.strictEqual(r.parede, 'pedir');
});

test('quem tocou em "Não permitir" para na parede da receita — não entra', () => {
  const r = decidirPortaoNotificacoes(sit({ permissao: 'denied', inscrito: false }));
  assert.strictEqual(r.entra, false);
  assert.strictEqual(r.parede, 'negado');
});

// O caso que mais vai acontecer: a pessoa desativou em Minha Conta, ou a linha do banco
// sumiu. A permissão continua dada, mas ela NÃO recebe nada — então não pode entrar.
test('permissão dada mas sem inscrição no banco = parede', () => {
  const r = decidirPortaoNotificacoes(sit({ permissao: 'granted', inscrito: false }));
  assert.strictEqual(r.entra, false);
  assert.strictEqual(r.parede, 'pedir');
});

test('iPhone aberto no navegador manda instalar na Tela de Início', () => {
  const r = decidirPortaoNotificacoes(sit({ iosSemInstalar: true, permissao: 'default', inscrito: false }));
  assert.strictEqual(r.parede, 'instalar-ios');
});

// A ARMADILHA: no iPhone fora do app instalado, o próprio Safari diz "não suportado" e às
// vezes "negado". Se a ordem das perguntas estiver errada, a parede manda a pessoa abrir no
// celular (ela JÁ está no celular) ou mexer no Ajustes (não é lá que resolve). Instalar é a
// única saída, e por isso essa pergunta vem antes das outras duas.
test('iPhone no navegador vence "não suportado"', () => {
  const r = decidirPortaoNotificacoes(sit({ iosSemInstalar: true, suporte: 'nao-suportado', inscrito: false }));
  assert.strictEqual(r.parede, 'instalar-ios');
});

test('iPhone no navegador vence "negado"', () => {
  const r = decidirPortaoNotificacoes(sit({ iosSemInstalar: true, permissao: 'denied', inscrito: false }));
  assert.strictEqual(r.parede, 'instalar-ios');
});

test('navegador sem suporte manda abrir pelo celular', () => {
  const r = decidirPortaoNotificacoes(sit({ suporte: 'nao-suportado', permissao: 'default', inscrito: false }));
  assert.strictEqual(r.parede, 'sem-suporte');
});

// A ÚNICA isenção combinada: quem ainda espera aprovação do cadastro não é membro, não é
// escalado e não tem o que receber. Travar essa pessoa seria trancá-la antes de ela entrar.
test('quem aguarda aprovação do cadastro entra sem o sino', () => {
  const r = decidirPortaoNotificacoes(sit({ etapaCrm: 'aprovacao_cadastro', permissao: 'denied', inscrito: false }));
  assert.strictEqual(r.entra, true);
  assert.strictEqual(r.parede, null);
});

test('a isenção do cadastro vale até no navegador sem suporte', () => {
  const r = decidirPortaoNotificacoes(sit({ etapaCrm: 'aprovacao_cadastro', suporte: 'nao-suportado', inscrito: false }));
  assert.strictEqual(r.entra, true);
});

// Ninguém mais escapa: nem coordenação, nem superadmin. O portão nem pergunta o papel.
test('quem já passou da aprovação não tem isenção nenhuma', () => {
  const r = decidirPortaoNotificacoes(sit({ etapaCrm: 'formacao', permissao: 'default', inscrito: false }));
  assert.strictEqual(r.entra, false);
});

// Sem situação nenhuma o portão não pode LIBERAR por engano: na dúvida, ele fecha.
test('sem informação o portão fecha', () => {
  assert.strictEqual(decidirPortaoNotificacoes().entra, false);
  assert.strictEqual(decidirPortaoNotificacoes({}).entra, false);
});
