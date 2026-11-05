// Tela cheia dos jogos: o "voltar" do celular (gesto da borda ou botão do sistema) primeiro SAI
// da tela cheia; só o segundo "voltar" sai da página. Sem isso, um deslize perto da borda, no meio
// da partida, jogava a pessoa de volta para a tela anterior — o "às vezes volta a página".
const test = require('node:test');
const assert = require('node:assert/strict');
const { criar } = require('./jogo-tela-cheia-core.js');

function ambiente() {
  const pilha = [{ jogo: false }];            // histórico de mentira
  const ouvintes = [];
  const historico = {
    pushState(estado) { pilha.push(estado || {}); },
    back() { pilha.pop(); ouvintes.forEach((f) => f({ state: pilha.at(-1) })); },   // back dispara popstate
  };
  const janela = { addEventListener: (_, f) => ouvintes.push(f) };
  const eventos = [];
  const c = criar({ entrar: () => eventos.push('entrou'), sair: () => eventos.push('saiu'), historico, janela });
  return { c, pilha, eventos, historico, ouvintes };
}

test('abrir entra na tela cheia e empilha um estado no histórico', () => {
  const { c, pilha, eventos } = ambiente();
  c.abrir();
  assert.deepEqual(eventos, ['entrou']);
  assert.equal(pilha.length, 2);
  assert.equal(c.ativo, true);
});

test('abrir duas vezes não empilha duas vezes', () => {
  const { c, pilha, eventos } = ambiente();
  c.abrir(); c.abrir();
  assert.deepEqual(eventos, ['entrou']);
  assert.equal(pilha.length, 2);
});

test('"voltar" do sistema com a tela cheia sai da tela cheia e NÃO sai da página', () => {
  const { c, pilha, eventos, historico } = ambiente();
  c.abrir();
  historico.back();                           // o gesto de voltar
  assert.deepEqual(eventos, ['entrou', 'saiu']);
  assert.equal(c.ativo, false);
  assert.equal(pilha.length, 1, 'o estado empilhado foi consumido; a página anterior continua sendo a de baixo');
});

test('fechar pelo botão sai da tela cheia, devolve o histórico e o popstate dele não sai duas vezes', () => {
  const { c, pilha, eventos } = ambiente();
  c.abrir();
  c.fechar();
  assert.deepEqual(eventos, ['entrou', 'saiu']);
  assert.equal(pilha.length, 1);
  assert.equal(c.ativo, false);
});

test('depois de sair, abrir de novo funciona e o segundo "voltar" é o do navegador (não é engolido)', () => {
  const { c, pilha, eventos, historico } = ambiente();
  c.abrir(); historico.back();
  c.abrir();
  assert.equal(c.ativo, true);
  historico.back();
  assert.equal(c.ativo, false);
  assert.deepEqual(eventos, ['entrou', 'saiu', 'entrou', 'saiu']);
  assert.equal(pilha.length, 1);
  historico.back();                           // com a tela cheia fechada, voltar não faz nada por aqui
  assert.deepEqual(eventos, ['entrou', 'saiu', 'entrou', 'saiu']);
});

test('sem history.pushState (navegador estranho) a tela cheia ainda abre e fecha', () => {
  const eventos = [];
  const c = criar({ entrar: () => eventos.push('entrou'), sair: () => eventos.push('saiu'),
    historico: { pushState() { throw new Error('bloqueado'); }, back() { throw new Error('bloqueado'); } }, janela: { addEventListener() {} } });
  c.abrir(); c.fechar();
  assert.deepEqual(eventos, ['entrou', 'saiu']);
});
