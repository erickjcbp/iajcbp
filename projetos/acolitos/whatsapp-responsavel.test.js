const { test } = require('node:test');
const assert = require('node:assert/strict');
const { faltando, normalizarCelular } = require('./whatsapp-responsavel.js');

const HOJE = '2026-10-20';
const base = { status: 'ativo', serve: true, data_nascimento: '2014-01-01' };

test('pede o número só do menor que serve e não tem nenhum celular de responsável', () => {
  const perfis = [
    { ...base, id: 'a' },                                              // falta
    { ...base, id: 'b', celular_recado: '(19) 99876-5432' },           // tem recado
    { ...base, id: 'c', celular_mae: '19988887777' },                  // tem mãe
    { ...base, id: 'd', celular_responsavel: '19 3451-2233' },         // fixo não vale → falta
    { ...base, id: 'e', data_nascimento: '2000-01-01' },               // adulto: não pede
    { ...base, id: 'f', serve: false },                                // não serve: não pede
    { ...base, id: 'g', status: 'inativo' },                           // inativo: não pede
    { ...base, id: 'a' },                                              // repetido na lista
  ];
  assert.deepEqual(faltando(perfis, HOJE).map((m) => m.id), ['a', 'd']);
});

test('sem data de nascimento conta como menor', () => {
  assert.deepEqual(faltando([{ ...base, id: 'x', data_nascimento: null }], HOJE).map((m) => m.id), ['x']);
});

test('valida celular igual ao robô', () => {
  assert.equal(normalizarCelular('(19) 99876-5432'), '5519998765432');
  assert.equal(normalizarCelular('19 3451-2233'), null);
  assert.equal(normalizarCelular(''), null);
});
