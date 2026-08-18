// Testes da regra de entrar e sair de um time.
// Rodar: node --test projetos/acolitos/times-core.test.js
const test = require('node:test');
const assert = require('node:assert');
const { entrarNoTime, sairDoTime } = require('./times-core.js');

// ── ENTRAR ──────────────────────────────────────────────────────────
test('entrar no primeiro time: vira equipe', () => {
  const r = entrarNoTime({ id:'a', setores:[], eh_equipe:false, user_id:'u1' }, 'formacao', 'aspirante');
  assert.deepStrictEqual(r.patch, { setores:['formacao'], eh_equipe:true });
  assert.deepStrictEqual(r.promoverPara, 'membro_equipe');
});
test('entrar num segundo time: acumula, sem promover de novo', () => {
  const r = entrarNoTime({ id:'a', setores:['formacao'], eh_equipe:true, user_id:'u1' }, 'escala', 'membro_equipe');
  assert.deepStrictEqual(r.patch.setores, ['formacao','escala']);
  assert.strictEqual(r.promoverPara, null);
});
test('entrar num time em que já está: não duplica', () => {
  const r = entrarNoTime({ id:'a', setores:['formacao'], eh_equipe:true, user_id:'u1' }, 'formacao', 'membro_equipe');
  assert.deepStrictEqual(r.patch.setores, ['formacao']);
});
test('admin que entra num time NÃO é rebaixado a equipe', () => {
  const r = entrarNoTime({ id:'a', setores:[], eh_equipe:false, user_id:'u1' }, 'formacao', 'coord_admin');
  assert.strictEqual(r.promoverPara, null);
});
test('quem não tem login não tem papel para mexer', () => {
  const r = entrarNoTime({ id:'a', setores:[], eh_equipe:false, user_id:null }, 'formacao', null);
  assert.strictEqual(r.promoverPara, null);
  assert.strictEqual(r.patch.eh_equipe, true);   // a marca de equipe é do cadastro, não do login
});

// ── SAIR ────────────────────────────────────────────────────────────
test('sair de um time entre vários: continua equipe', () => {
  const r = sairDoTime({ id:'a', setores:['formacao','escala'], eh_equipe:true, user_id:'u1', nivel:'acolito' }, 'escala', 'membro_equipe', 'acolito');
  assert.deepStrictEqual(r.patch, { setores:['formacao'] });
  assert.strictEqual(r.ultimo, false);
  assert.strictEqual(r.rebaixarPara, null);
});
// O 4º argumento é o papel-base do nível da pessoa. Fica FORA desta regra de propósito: a
// conta de nível→papel depende da configuração de Níveis do app, que muda, e misturá-la aqui
// obrigaria este módulo a conhecer NIVEIS só para responder sobre times.
test('sair do ÚLTIMO time: deixa de ser equipe e o acesso volta ao do nível', () => {
  const r = sairDoTime({ id:'a', setores:['formacao'], eh_equipe:true, user_id:'u1', nivel:'acolito' }, 'formacao', 'membro_equipe', 'acolito');
  assert.deepStrictEqual(r.patch, { setores:[], eh_equipe:false });
  assert.strictEqual(r.ultimo, true);
  assert.strictEqual(r.rebaixarPara, 'acolito');   // o papel-base do nível
});
test('ADMIN que sai do último time não é rebaixado', () => {
  // rebaixar um coord_admin por causa de um time o tiraria do painel inteiro
  const r = sairDoTime({ id:'a', setores:['formacao'], eh_equipe:true, user_id:'u1', nivel:'acolito' }, 'formacao', 'coord_admin', 'acolito');
  assert.strictEqual(r.ultimo, true);
  assert.strictEqual(r.rebaixarPara, null);
});
test('sair de time em que a pessoa nem estava: nada muda', () => {
  const r = sairDoTime({ id:'a', setores:['formacao'], eh_equipe:true, user_id:'u1', nivel:'acolito' }, 'escala', 'membro_equipe');
  assert.strictEqual(r.semEfeito, true);
});
test('setores nulo não quebra', () => {
  assert.strictEqual(sairDoTime({ id:'a', setores:null, user_id:'u1' }, 'x', null, null).semEfeito, true);
  assert.deepStrictEqual(entrarNoTime({ id:'a', setores:null, user_id:null }, 'x', null).patch.setores, ['x']);
});
