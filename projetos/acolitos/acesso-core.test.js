// Testes da regra de acesso às telas de Caixa e Ausências.
// Rodar: node --test projetos/acolitos/acesso-core.test.js
const test = require('node:test');
const assert = require('node:assert');
const { podeVerTela } = require('./acesso-core.js');

const caps = (o) => Object.assign({ isAdmin:false, ehEquipe:false, isCerimo:false, perms:[] }, o);

test('coordenador com a permissão caixa vê a Caixa', () => {
  assert.strictEqual(podeVerTela({ tela:'caixa', role:'coord_admin', caps:caps({ isAdmin:true }) }), true);
});

test('quem tem a permissão caixa sem ser admin também vê a Caixa', () => {
  assert.strictEqual(podeVerTela({ tela:'caixa', role:'membro_equipe', caps:caps({ ehEquipe:true, perms:['caixa'] }) }), true);
});

test('membro comum NÃO vê a Caixa', () => {
  assert.strictEqual(podeVerTela({ tela:'caixa', role:'membro', caps:caps({}) }), false);
});

test('cerimoniário NÃO vê a Caixa — ele não aprova', () => {
  assert.strictEqual(podeVerTela({ tela:'caixa', role:'cerimonario', caps:caps({ isCerimo:true }) }), false);
});

// O RISCO DECLARADO NA SPEC: o cerimoniário registra ausência de outro (a RLS já
// libera, ausencias.html:307). Se a tela de Ausências for trancada por 'caixa',
// ele perde a função e ninguém é avisado — a tela só não abre.
test('cerimoniário VÊ a tela de Ausências', () => {
  assert.strictEqual(podeVerTela({ tela:'ausencias', role:'cerimonario', caps:caps({ isCerimo:true }) }), true);
});

test('equipe vê a tela de Ausências', () => {
  assert.strictEqual(podeVerTela({ tela:'ausencias', role:'membro_equipe', caps:caps({ ehEquipe:true }) }), true);
});

test('membro comum NÃO vê a tela de Ausências', () => {
  assert.strictEqual(podeVerTela({ tela:'ausencias', role:'membro', caps:caps({}) }), false);
});

test('tela desconhecida não libera nada', () => {
  assert.strictEqual(podeVerTela({ tela:'qualquer', role:'coord_admin', caps:caps({ isAdmin:true }) }), false);
});
