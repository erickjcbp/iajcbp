// Testes da montagem da barra de navegação.
// Rodar: node --test projetos/acolitos/navegacao-core.test.js
const test = require('node:test');
const assert = require('node:assert');
const { montarItensNav } = require('./navegacao-core.js');

const MODULOS = {
  jornada:    { label:'Jornada',    href:'jornada-admin.html', icon:'star' },
  membros:    { label:'Membros',    href:'membros.html',    icon:'users' },
  escala:     { label:'Escala',     href:'escala.html',     icon:'calendar' },
  crm:        { label:'CRM',        href:'crm.html',        icon:'shuffle' },
  tesouraria: { label:'Tesouraria', href:'tesouraria.html', icon:'dollar' },
  casas:      { label:'Casas',      href:'casas.html',      icon:'shield' },
};
const ORDEM = ['jornada','membros','escala','crm','tesouraria','casas'];
const base = { modulos: MODULOS, ordemModulos: ORDEM, ordemCfg: null, isSuperadmin: false };
const ids = (r) => r.map(x => x.id);

test('coordenação: sem permissão nenhuma, sobram só os itens fixos', () => {
  const r = montarItensNav({ ...base, modo:'coordenacao', perms:[], isAdmin:false });
  assert.deepStrictEqual(ids(r), ['home','agenda']);
});

test('coordenação: cada permissão acrescenta seu módulo, na ordem de ORDEM_MODULOS', () => {
  const r = montarItensNav({ ...base, modo:'coordenacao', perms:['casas','escala'], isAdmin:false });
  assert.deepStrictEqual(ids(r), ['home','agenda','escala','casas']);
});

test('coordenação: Config só aparece para superadmin', () => {
  const sem = montarItensNav({ ...base, modo:'coordenacao', perms:[], isAdmin:true });
  assert.ok(!ids(sem).includes('config'));
  const com = montarItensNav({ ...base, modo:'coordenacao', perms:[], isAdmin:true, isSuperadmin:true });
  assert.ok(ids(com).includes('config'));
});

test('jornada: lista fixa, independente de permissão', () => {
  const r = montarItensNav({ ...base, modo:'jornada', perms:[], isAdmin:false });
  // Lista mudou na Task 6: Conquistas entrou na barra do membro.
  assert.deepStrictEqual(ids(r),
    ['home','quests','escalas-membro','agenda','conquistas','destaques','minha-casa','ausencias']);
});

test('jornada: Conquistas está na barra e Ausência virou Faltar', () => {
  const r = montarItensNav({ ...base, modo:'jornada', perms:[], isAdmin:false });
  const conq = r.find(x => x.id === 'conquistas');
  assert.ok(conq, 'conquistas deveria estar na barra do membro');
  assert.strictEqual(conq.href, 'conquistas.html');
  assert.strictEqual(r.find(x => x.id === 'ausencias').label, 'Faltar');
});

test('jornada: o id ausencias NÃO muda (contrato com nav_ordem_jornada)', () => {
  const r = montarItensNav({ ...base, modo:'jornada', perms:[], isAdmin:false });
  assert.ok(r.some(x => x.id === 'ausencias'));
});

test('a ordem salva no Config manda, e ninguém é perdido no caminho', () => {
  const semOrdem = montarItensNav({ ...base, modo:'jornada', perms:[], isAdmin:false });
  const salva = ['agenda','home'];
  const r = montarItensNav({
    ...base, modo:'jornada', perms:[], isAdmin:false,
    ordemCfg: salva,
  });
  // os ids que o dono ordenou saem na ordem dele, sem exceção
  assert.deepStrictEqual(ids(r).filter(x => salva.includes(x)), salva);
  // nenhum item some: quem a ordem salva não conhece é interpolado, não descartado.
  // (ANTES ia todo mundo pro fim; isso mudou de propósito — ver os dois testes de
  //  "posição padrão" abaixo. A contagem é o que garante que ninguém se perdeu.)
  assert.strictEqual(ids(r).length, semOrdem.length);
  assert.deepStrictEqual([...ids(r)].sort(), [...ids(semOrdem)].sort());
});

test('cada item tem id, href, label e icon preenchidos', () => {
  const r = montarItensNav({ ...base, modo:'coordenacao', perms:['membros'], isAdmin:false });
  for (const item of r) {
    for (const campo of ['id','href','label','icon']) {
      assert.ok(item[campo], `item ${item.id} sem ${campo}`);
    }
  }
});

test('caixa aparece na coordenação só para quem tem a permissão', () => {
  const MOD = Object.assign({}, MODULOS, {
    caixa: { label:'Caixa', href:'caixa.html', icon:'inbox' },
  });
  const ORD = ['jornada','caixa','membros','escala','crm','tesouraria','casas'];
  const sem = montarItensNav({ ...base, modulos:MOD, ordemModulos:ORD, modo:'coordenacao', perms:['escala'], isAdmin:false });
  assert.ok(!ids(sem).includes('caixa'));
  const com = montarItensNav({ ...base, modulos:MOD, ordemModulos:ORD, modo:'coordenacao', perms:['escala','caixa'], isAdmin:false });
  assert.ok(ids(com).includes('caixa'));
  assert.strictEqual(com.find(x => x.id === 'caixa').href, 'caixa.html');
});

// A ordem salva no banco é anterior aos itens novos (Caixa, Conquistas). Antes, id
// desconhecido ia pro índice 999 = fim da barra, atrás da seta ›. Ou seja: a mudança
// que veio pra revelar as telas as entregava escondidas. Agora ele herda a posição
// que tem na ordem padrão do código.
test('item que a ordem salva não conhece entra na posição padrão, não no fim', () => {
  // ordem real gravada em acolitos_config.nav_ordem_jornada (sem 'conquistas')
  const salva = ['home','quests','escalas-membro','ausencias','agenda','destaques','minha-casa'];
  const r = montarItensNav({ ...base, modo:'jornada', perms:[], isAdmin:false, ordemCfg: salva });
  const pos = ids(r).indexOf('conquistas');
  assert.notStrictEqual(pos, -1, 'conquistas sumiu da barra');
  assert.notStrictEqual(pos, ids(r).length - 1, 'conquistas foi jogado pro fim');
  // no código, conquistas vem logo depois de agenda — tem que cair ali
  assert.strictEqual(ids(r)[ids(r).indexOf('agenda') + 1], 'conquistas');
  // e a ordem que o dono salvou tem que ser respeitada no resto
  assert.deepStrictEqual(ids(r).filter(x => salva.includes(x)), salva);
});

test('coordenação: caixa desconhecida pela ordem salva cai logo após jornada', () => {
  const MOD = Object.assign({}, MODULOS, { caixa: { label:'Caixa', href:'caixa.html', icon:'inbox' } });
  const ORD = ['jornada','caixa','membros','escala','crm','tesouraria','casas'];
  const salva = ['home','escala','membros','jornada','crm','agenda','tesouraria','casas','config'];
  const r = montarItensNav({ ...base, modulos:MOD, ordemModulos:ORD, modo:'coordenacao',
    perms:['jornada','caixa','membros','escala','crm','tesouraria','casas'], isAdmin:false, ordemCfg: salva });
  assert.strictEqual(ids(r)[ids(r).indexOf('jornada') + 1], 'caixa');
});
