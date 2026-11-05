// Testes do tutorial guiado do membro: quais telas, quando abre sozinho, e que não vira maratona.
// Rodar: node --test projetos/acolitos/tutorial-core.test.js
const test = require('node:test');
const assert = require('node:assert');
const { TUTORIAIS, tutorialDa, aplicaA, deveAbrirSozinho, aoCompletar, proximo, anterior } = require('./tutorial-core.js');

const membro = { membro: { id: 'm1', serve: true }, membership: { role: 'aspirante' } };

test('só as seis telas decididas pelo dono têm tutorial', () => {
  assert.deepStrictEqual(Object.keys(TUTORIAIS).sort(), ['agenda', 'conquistas', 'destaques', 'escalas-membro', 'home', 'missoes']);
  assert.strictEqual(tutorialDa('minha-casa'), null);
  assert.strictEqual(tutorialDa('toString'), null);   // herança de Object não conta como tela
});

test('todo passo tem texto curto e título, e o texto cabe num balão de celular', () => {
  for (const [tela, t] of Object.entries(TUTORIAIS)) {
    assert.ok(t.passos.length >= 2 && t.passos.length <= 6, tela + ': de 2 a 6 passos');
    for (const p of t.passos) {
      assert.ok(p.titulo && p.titulo.length <= 40, tela + ': título curto — ' + p.titulo);
      assert.ok(p.texto && p.texto.length <= 170, tela + ': texto curto — ' + p.texto);
    }
  }
});

test('o tutorial da Home aponta para o botão ? e o da Escalas ensina a avisar ausência pelo app', () => {
  assert.ok(TUTORIAIS.home.passos.some((p) => p.seletor === '#tutorial-ajuda'));
  assert.ok(TUTORIAIS['escalas-membro'].passos.some((p) => /pelo app/i.test(p.texto) && /ausência/i.test(p.texto)));
});

test('modo coordenação, equipe que não serve e quem está na integração não recebem', () => {
  assert.strictEqual(aplicaA(membro, 'jornada'), true);
  assert.strictEqual(aplicaA(membro, 'coordenacao'), false);
  assert.strictEqual(aplicaA({ membro: { id: 'm1', serve: false }, membership: { role: 'membro_equipe' } }, 'jornada'), false);
  assert.strictEqual(aplicaA({ membro: { id: 'm1', serve: true }, membership: { role: 'novo' } }, 'jornada'), false);
  assert.strictEqual(aplicaA(null, 'jornada'), false);
  assert.strictEqual(aplicaA({ membro: null }, 'jornada'), false);
});

test('abre sozinho só na primeira vez de CADA tela (sem maratona)', () => {
  assert.strictEqual(deveAbrirSozinho('home', {}, membro, 'jornada'), true);
  assert.strictEqual(deveAbrirSozinho('home', { home: '2026-11-04T20:00:00Z' }, membro, 'jornada'), false);
  // ter visto a Home não consome as outras telas: cada uma abre quando a pessoa chega nela
  assert.strictEqual(deveAbrirSozinho('agenda', { home: '2026-11-04T20:00:00Z' }, membro, 'jornada'), true);
  assert.strictEqual(deveAbrirSozinho('agenda', null, membro, 'jornada'), true);
  assert.strictEqual(deveAbrirSozinho('agenda', undefined, membro, 'jornada'), true);
});

test('tela sem tutorial nunca abre sozinha, nem em modo coordenação', () => {
  assert.strictEqual(deveAbrirSozinho('minha-casa', {}, membro, 'jornada'), false);
  assert.strictEqual(deveAbrirSozinho('home', {}, membro, 'coordenacao'), false);
});

test('aoCompletar marca a tela sem apagar as outras nem regravar a data', () => {
  const antes = { home: 'A' };
  const depois = aoCompletar(antes, 'agenda', 'B');
  assert.deepStrictEqual(depois, { home: 'A', agenda: 'B' });
  assert.deepStrictEqual(antes, { home: 'A' });        // não muta
  assert.strictEqual(aoCompletar(depois, 'agenda', 'C').agenda, 'B');
  assert.deepStrictEqual(aoCompletar(null, 'home', 'X'), { home: 'X' });
});

test('proximo termina no último passo e anterior não passa do primeiro', () => {
  assert.strictEqual(proximo(0, 3), 1);
  assert.strictEqual(proximo(2, 3), null);
  assert.strictEqual(anterior(0), 0);
  assert.strictEqual(anterior(2), 1);
});

test('cada passo tem texto de balão e, quando aponta para algo, a âncora é outra chave (texto não pode servir aos dois)', () => {
  for (const [tela, t] of Object.entries(TUTORIAIS)) {
    for (const p of t.passos) {
      assert.strictEqual(typeof p.texto, 'string', tela + ': todo passo tem o texto do balão');
      if (p.ancora != null) assert.ok(p.ancora.length >= 3 && p.ancora !== p.texto, tela + ': âncora é o rótulo da tela, não o texto do balão');
    }
  }
  const ancoras = Object.values(TUTORIAIS).flatMap((t) => t.passos).filter((p) => p.ancora || p.seletor).length;
  assert.ok(ancoras >= 12, 'a maioria dos passos aponta para algo na tela');
});
