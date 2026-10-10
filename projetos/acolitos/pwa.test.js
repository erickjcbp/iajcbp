const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('nova versão do app não recarrega a tela durante o uso', () => {
  const source = fs.readFileSync(__dirname + '/shared.js', 'utf8');
  const pwa = source.slice(source.indexOf('(function setupPWA()'), source.indexOf('// ── UTILS'));
  const handlers = {};
  let reloads = 0;
  const context = {
    document: { head: { appendChild() {} }, querySelector: () => ({}), addEventListener() {} },
    navigator: { serviceWorker: { controller: {}, addEventListener: (name, fn) => { handlers[name] = fn; } } },
    window: { addEventListener() {}, matchMedia: () => ({ matches: true }), navigator: {}, location: { reload() { reloads++; } } },
  };
  vm.runInNewContext(pwa, context);
  handlers.controllerchange?.();
  handlers.controllerchange?.();
  assert.equal(reloads, 0, 'uma atualização não pode descartar o modal e seus campos');
});

test('atualização do app preserva caches de outros apps da mesma origem', async () => {
  const handlers = {};
  const apagados = [];
  let completion;
  const context = {
    self: { addEventListener: (name, fn) => { handlers[name] = fn; }, clients: { claim: async () => {} } },
    caches: { keys: async () => ['acolitos-antigo', 'central-v1', 'outro-app-v2'], delete: async (key) => { apagados.push(key); } },
  };
  vm.runInNewContext(fs.readFileSync(__dirname + '/sw.js', 'utf8'), context);
  handlers.activate({ waitUntil: (p) => { completion = p; } });
  await completion;
  assert.deepEqual(apagados, ['acolitos-antigo']);
});
