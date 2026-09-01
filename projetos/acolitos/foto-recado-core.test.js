// O recado da foto some quando a FOTO SOBE, não quando ele aparece.
//
// Todo aviso deste app some por ter aparecido uma vez. Este é a exceção, e a
// exceção é frágil: basta alguém "padronizar" o recado junto com os outros para
// o convite sumir da tela de quem nunca chegou a pôr a foto. Estas provas são o
// que segura isso.
const { test } = require('node:test');
const assert = require('node:assert');
const {
  TIPO_RECADO_DA_FOTO,
  temFotoDePerfil,
  recadoDaFotoFicaPendente,
  marcarRecadoDaFotoVisto,
  temRecadoDaFotoPendente,
  textoDoRecadoDaFoto,
} = require('./foto-recado-core.js');

const recado = () => ({ tipo: TIPO_RECADO_DA_FOTO, seen: false });

test('sem foto: o recado NÃO pode ser marcado como visto', () => {
  assert.strictEqual(recadoDaFotoFicaPendente(recado(), false), true);
});

test('com foto: o recado se rende — é isso que faz ele sumir', () => {
  assert.strictEqual(recadoDaFotoFicaPendente(recado(), true), false);
});

test('recado já visto não volta a ficar pendente, nem sem foto', () => {
  const visto = { tipo: TIPO_RECADO_DA_FOTO, seen: true };
  assert.strictEqual(recadoDaFotoFicaPendente(visto, false), false);
});

test('os outros avisos seguem a regra normal: nunca ficam pendentes', () => {
  for (const tipo of ['boas_vindas_time', 'medalha', 'xp_ganho', 'campeao', undefined]) {
    assert.strictEqual(recadoDaFotoFicaPendente({ tipo, seen: false }, false), false,
      'aviso "' + tipo + '" não podia ficar pendente');
  }
});

test('foto vazia, só espaço ou nula contam como SEM foto', () => {
  assert.strictEqual(temFotoDePerfil({ foto_url: '' }), false);
  assert.strictEqual(temFotoDePerfil({ foto_url: '   ' }), false);
  assert.strictEqual(temFotoDePerfil({ foto_url: null }), false);
  assert.strictEqual(temFotoDePerfil({}), false);
  assert.strictEqual(temFotoDePerfil(null), false);
  assert.strictEqual(temFotoDePerfil({ foto_url: 'https://x/a.jpg' }), true);
});

test('marcar como visto devolve lista NOVA e não mexe na que veio', () => {
  const antes = [recado()];
  const depois = marcarRecadoDaFotoVisto(antes);
  assert.strictEqual(antes[0].seen, false, 'mexeu na lista da tela');
  assert.strictEqual(depois[0].seen, true);
  assert.notStrictEqual(antes, depois);
});

test('marcar como visto não encosta nos outros avisos', () => {
  const outro = { tipo: 'medalha', seen: false, label: 'x' };
  const depois = marcarRecadoDaFotoVisto([outro, recado()]);
  assert.strictEqual(depois[0], outro, 'o aviso de medalha foi trocado à toa');
  assert.strictEqual(depois[1].seen, true);
});

test('sem avisos nada quebra', () => {
  assert.deepStrictEqual(marcarRecadoDaFotoVisto(null), []);
  assert.strictEqual(temRecadoDaFotoPendente(null, false), false);
  assert.strictEqual(temRecadoDaFotoPendente([], false), false);
});

test('tem recado pendente só enquanto não há foto', () => {
  assert.strictEqual(temRecadoDaFotoPendente([recado()], false), true);
  assert.strictEqual(temRecadoDaFotoPendente([recado()], true), false);
});

test('o texto serve para quem tentou E para quem nunca tentou', () => {
  const t = textoDoRecadoDaFoto();
  const tudo = [t.titulo].concat(t.linhas).join(' ');
  // "se você tentou" — condicional. Afirmar que a pessoa tentou seria mentira
  // para parte de quem recebe, e não há como saber quem é quem.
  assert.ok(/se você tentou/i.test(tudo), 'o texto afirma que a pessoa tentou');
  assert.ok(!/^você não conseguiu/i.test(t.titulo), 'o título acusa a pessoa');
  assert.ok(t.botao && t.depois, 'faltou saída: o pop-up precisa do "agora não"');
});
