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
  assert.deepStrictEqual(ids(r),
    ['home','quests','escalas-membro','agenda','destaques','minha-casa','ausencias']);
});

test('a ordem salva no Config reordena, e quem não está nela vai pro fim', () => {
  const semOrdem = montarItensNav({ ...base, modo:'jornada', perms:[], isAdmin:false });
  const r = montarItensNav({
    ...base, modo:'jornada', perms:[], isAdmin:false,
    ordemCfg: ['agenda','home'],
  });
  assert.deepStrictEqual(ids(r).slice(0, 2), ['agenda','home']);
  // compara com o total real, NÃO com um número fixo: a barra do membro ganha
  // itens ao longo do plano (Conquistas na Task 6) e um 7 cravado aqui quebraria lá.
  assert.strictEqual(ids(r).length, semOrdem.length);
  assert.ok(ids(r).length >= 7);
});

test('cada item tem id, href, label e icon preenchidos', () => {
  const r = montarItensNav({ ...base, modo:'coordenacao', perms:['membros'], isAdmin:false });
  for (const item of r) {
    for (const campo of ['id','href','label','icon']) {
      assert.ok(item[campo], `item ${item.id} sem ${campo}`);
    }
  }
});
