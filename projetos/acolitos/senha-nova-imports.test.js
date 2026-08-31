// Guarda de import: toda tela que roda o initModulo tem de carregar a regra da senha.
//
// O portão da senha vive dentro do initModulo, e o initModulo roda em TODAS as telas. Se
// uma delas esquecer o <script>, a parede daquela tela vira uma tela quebrada — e o
// defeito só aparece quando uma família de verdade cair nela. Uma lista escrita à mão
// envelhece; esta prova lê as telas do disco a cada rodada.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

test('toda tela com os *-core carrega também a senha-nova-core.js', () => {
  const dir = __dirname;
  const telas = fs.readdirSync(dir).filter(f => f.endsWith('.html'))
    .filter(f => fs.readFileSync(path.join(dir, f), 'utf8').includes('boas-vindas-core.js'));
  assert.ok(telas.length >= 20, 'esperava 20+ telas, achei ' + telas.length + ' — sumiu arquivo?');
  const faltando = telas.filter(f => !fs.readFileSync(path.join(dir, f), 'utf8').includes('senha-nova-core.js'));
  assert.deepStrictEqual(faltando, [], 'estas telas não carregam a regra da senha: ' + faltando.join(', '));
});
