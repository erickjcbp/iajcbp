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

  // O mesmo vale para a regra dos TELEFONES: se uma tela esquecer o <script>, ela cai na
  // reserva de dentro da função e volta a mostrar um telefone diferente das outras.
  const semTel = telas.filter(f => !fs.readFileSync(path.join(dir, f), 'utf8').includes('telefones-core.js'));
  assert.deepStrictEqual(semTel, [], 'estas telas não carregam a regra dos telefones: ' + semTel.join(', '));

  // E para a regra do RECADO DA FOTO: sem o <script>, a tela quebra no primeiro aviso
  // da fila — `temFotoDePerfil` não existiria e o pop-up de QUALQUER aviso morreria
  // junto. Não é só o convite da foto que se perde: é a fila inteira daquela tela.
  const semFoto = telas.filter(f => !fs.readFileSync(path.join(dir, f), 'utf8').includes('foto-recado-core.js'));
  assert.deepStrictEqual(semFoto, [], 'estas telas não carregam a regra do recado da foto: ' + semFoto.join(', '));
});
