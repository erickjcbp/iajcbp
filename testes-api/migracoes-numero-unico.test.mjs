import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';

// 086 e 087 repetem desde antes desta regra e já foram aplicadas; renomear só apagaria o rastro.
const HISTORICOS = new Set(['086', '087']);

test('cada migração tem número próprio', () => {
  const numeros = readdirSync(new URL('../docs/migrations/', import.meta.url))
    .filter((nome) => nome.endsWith('.sql'))
    .map((nome) => nome.match(/^(\d+[a-z]?)_/)?.[1])
    .filter(Boolean);
  const repetidos = numeros.filter((n, i) => numeros.indexOf(n) !== i && !HISTORICOS.has(n));
  assert.deepEqual(repetidos, []);
});
