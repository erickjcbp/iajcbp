// Rodar: node --test projetos/acolitos/identidade-core.test.js
const test = require('node:test');
const assert = require('node:assert');
const I = require('./identidade-core.js');

test('há 4 escolhas: a padrão e 3 fontes novas', () => {
  assert.strictEqual(I.FONTES.length, 4);
  assert.strictEqual(I.FONTES.filter(f => !f.familia).length, 1);
  assert.strictEqual(I.FONTES[0].chave, 'sora');
});

test('chave desconhecida cai na padrão, sem quebrar', () => {
  assert.strictEqual(I.fontePorChave('xyz').chave, 'sora');
  assert.strictEqual(I.fontePorChave(undefined).chave, 'sora');
  assert.strictEqual(I.ehPadrao('xyz'), true);
  assert.strictEqual(I.ehPadrao('nunito'), false);
});

test('urlGoogle: padrão não baixa nada; as outras pedem só os pesos que existem', () => {
  assert.strictEqual(I.urlGoogle('sora'), null);
  assert.strictEqual(I.urlGoogle('nunito'), 'https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800&display=swap');
  assert.ok(I.urlGoogle('merriweather').includes('wght@400;700&'), 'Merriweather só tem 400 e 700');
});

test('reescreverFamilia troca só o nome da família dentro do @font-face', () => {
  const css = "/* latin */\n@font-face {\n  font-family: 'Nunito';\n  font-style: normal;\n  font-weight: 400;\n  src: url(https://fonts.gstatic.com/x.woff2) format('woff2');\n}\n";
  const out = I.reescreverFamilia(css, 'nunito');
  assert.ok(out.includes("font-family: 'Sora';"));
  assert.ok(!out.includes('Nunito'));
  assert.ok(out.includes('fonts.gstatic.com/x.woff2'), 'o endereço do arquivo não pode mudar');
  assert.strictEqual(I.reescreverFamilia(css, 'sora'), '', 'a padrão não injeta nada');
});

test('validarLogo: tipo, tamanho e vazio', () => {
  assert.deepStrictEqual(I.validarLogo({ type: 'image/png', size: 1000 }), { ok: true, ext: 'png' });
  assert.strictEqual(I.validarLogo({ type: 'image/jpeg', size: 1000 }).ext, 'jpg');
  assert.strictEqual(I.validarLogo({ type: 'image/svg+xml', size: 1000 }).ok, false, 'SVG pode levar script');
  assert.strictEqual(I.validarLogo({ type: 'application/pdf', size: 1000 }).ok, false);
  assert.strictEqual(I.validarLogo({ type: 'image/png', size: 3 * 1024 * 1024 }).ok, false);
  assert.strictEqual(I.validarLogo({ type: 'image/png', size: 0 }).ok, false);
  assert.strictEqual(I.validarLogo(null).ok, false);
});

test('caminhoLogo muda a cada envio (cache do navegador)', () => {
  assert.notStrictEqual(I.caminhoLogo(1, 'png'), I.caminhoLogo(2, 'png'));
  assert.strictEqual(I.caminhoLogo(5, 'webp'), 'logo_5.webp');
});
