// Testes da montagem da barra de navegação.
// Rodar: node --test projetos/acolitos/navegacao-core.test.js
const test = require('node:test');
const assert = require('node:assert');
const { montarItensNav, modoDaBarra } = require('./navegacao-core.js');

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
  // 'Faltar' saiu em 17/08: avisar ausência virou botão dentro das Escalas.
  assert.deepStrictEqual(ids(r),
    ['home','quests','escalas-membro','agenda','conquistas','destaques','minha-casa']);
});

test('jornada: Conquistas está na barra', () => {
  const r = montarItensNav({ ...base, modo:'jornada', perms:[], isAdmin:false });
  const conq = r.find(x => x.id === 'conquistas');
  assert.ok(conq, 'conquistas deveria estar na barra do membro');
  assert.strictEqual(conq.href, 'conquistas.html');
  assert.strictEqual(r.find(x => x.id === 'ausencias'), undefined, 'o item Faltar foi retirado');
});

// O id 'ausencias' foi APOSENTADO da barra do membro. A ordem salva no banco ainda o cita
// em quem já usava o app — e não pode quebrar a barra por causa de um id que sumiu. Este é
// o risco real agora; era isso que o teste antigo deveria estar protegendo.
test('jornada: ordem salva citando o id aposentado não quebra a barra', () => {
  const salva = ['home','ausencias','quests','escalas-membro','agenda','conquistas','destaques','minha-casa'];
  const r = montarItensNav({ ...base, modo:'jornada', perms:[], isAdmin:false, ordemCfg: salva });
  assert.strictEqual(r.find(x => x.id === 'ausencias'), undefined);
  assert.strictEqual(ids(r)[0], 'home');
  assert.strictEqual(ids(r).length, 7);
});

test('a ordem salva no Config manda, e ninguém é perdido no caminho', () => {
  const semOrdem = montarItensNav({ ...base, modo:'jornada', perms:[], isAdmin:false });
  const salva = ['agenda','home'];
  const r = montarItensNav({
    ...base, modo:'jornada', perms:[], isAdmin:false,
    ordemCfg: salva,
  });
  // os ids que o dono ordenou saem na ordem dele, sem exceção
  // descontando 'ausencias', aposentado da barra mas ainda gravado no banco de quem já
  // usava o app — é de propósito que a ordem salva aqui ainda o cite.
  const salvaViva = salva.filter(x => x !== 'ausencias');
  assert.deepStrictEqual(ids(r).filter(x => salvaViva.includes(x)), salvaViva);
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
  // e a ordem que o dono salvou tem que ser respeitada no resto — descontando 'ausencias',
  // aposentado da barra mas ainda gravado no banco de quem já usava o app. É de propósito
  // que a ordem salva deste teste ainda o cite: é a ordem real de produção.
  const salvaViva = salva.filter(x => x !== 'ausencias');
  assert.deepStrictEqual(ids(r).filter(x => salvaViva.includes(x)), salvaViva);
});

test('coordenação: caixa desconhecida pela ordem salva cai logo após jornada', () => {
  const MOD = Object.assign({}, MODULOS, { caixa: { label:'Caixa', href:'caixa.html', icon:'inbox' } });
  const ORD = ['jornada','caixa','membros','escala','crm','tesouraria','casas'];
  const salva = ['home','escala','membros','jornada','crm','agenda','tesouraria','casas','config'];
  const r = montarItensNav({ ...base, modulos:MOD, ordemModulos:ORD, modo:'coordenacao',
    perms:['jornada','caixa','membros','escala','crm','tesouraria','casas'], isAdmin:false, ordemCfg: salva });
  assert.strictEqual(ids(r)[ids(r).indexOf('jornada') + 1], 'caixa');
});

// ── O MAPA REAL, não o fabricado por este arquivo ────────────────────────────
// Os testes acima montam o próprio `MODULOS` e verificam que montarItensNav repassa
// o que recebeu. Isso NÃO prova que o destino gravado no shared.js está certo — e em
// 17/08 a Caixa mudou de arquivo sem que nenhum teste pudesse notar se a troca falhasse.
// Este teste lê o shared.js como TEXTO, que é a única forma de alcançar um mapa que
// vive dentro de um arquivo de navegador, cheio de DOM, impossível de importar aqui.
const fs = require('node:fs');
const path = require('node:path');
const SHARED = fs.readFileSync(path.join(__dirname, 'shared.js'), 'utf8');

// Destino de cada módulo da barra da coordenação, como está gravado hoje.
// Mudou um destino de propósito? Atualize aqui junto — é este o lembrete.
const DESTINOS_ESPERADOS = {
  jornada: 'jornada-admin.html',
  caixa: 'caixa.html',
  escala: 'escala.html',
  membros: 'membros.html',
  crm: 'crm.html',
  tesouraria: 'tesouraria.html',
  casas: 'casas.html',
  tarefas: 'tarefas.html',
};

test('o mapa REAL do shared.js aponta cada módulo para o arquivo certo', () => {
  Object.entries(DESTINOS_ESPERADOS).forEach(([chave, destino]) => {
    const linha = SHARED.split('\n').find(l => new RegExp('^\\s*' + chave + ':\\s*\\{').test(l));
    assert.ok(linha, 'não achei a entrada "' + chave + '" no mapa de módulos do shared.js');
    const href = (linha.match(/href:\s*'([^']+)'/) || [])[1];
    assert.strictEqual(href, destino, 'o módulo "' + chave + '" aponta para ' + href);
  });
});

test('a barra do membro não tem mais o item Faltar — a função vive nas Escalas', () => {
  const r = montarItensNav({ ...base, modo: 'jornada' });
  assert.strictEqual(r.find(x => x.id === 'ausencias'), undefined);
  assert.ok(ids(r).includes('escalas-membro'), 'o caminho do membro é pelas Escalas');
});

// ── Quem alcança o modo Coordenação ─────────────────────────────────────────
// Antes disto, o modo Coordenação exigia `eh_equipe`, que só 4 dos 176 têm. A permissão de
// módulo era marcável e INERTE: o initModulo (shared.js:264) já libera a PÁGINA só pela
// permissão, então a pessoa entrava digitando o endereço e não achava o botão na barra.
const BASE_MOD = ['jornada','caixa','membros','escala','crm','tesouraria','casas','tarefas'];

test('equipe que serve escolhe o modo, e o padrão é jornada', () => {
  assert.strictEqual(modoDaBarra({ ehEquipe:true, serve:true, perms:[], ordemModulos:BASE_MOD }), 'jornada');
  assert.strictEqual(modoDaBarra({ ehEquipe:true, serve:true, perms:[], ordemModulos:BASE_MOD, salvo:'coordenacao' }), 'coordenacao');
});

test('equipe que NÃO serve vai direto para coordenação', () => {
  assert.strictEqual(modoDaBarra({ ehEquipe:true, serve:false, perms:[], ordemModulos:BASE_MOD }), 'coordenacao');
});

test('sem equipe e sem permissão nenhuma NUNCA alcança coordenação', () => {
  assert.strictEqual(modoDaBarra({ ehEquipe:false, serve:true, perms:[], ordemModulos:BASE_MOD }), 'jornada');
  assert.strictEqual(modoDaBarra({ ehEquipe:false, serve:true, perms:[], ordemModulos:BASE_MOD, salvo:'coordenacao' }), 'jornada');
});

test('permissão de módulo já dá acesso ao modo coordenação, sem eh_equipe', () => {
  // o caso que estava quebrado: liberar "Tarefas dos times" não fazia nada
  assert.strictEqual(modoDaBarra({ ehEquipe:false, serve:true, perms:['tarefas'], ordemModulos:BASE_MOD, salvo:'coordenacao' }), 'coordenacao');
  // e quem não serve, com permissão, cai direto na coordenação
  assert.strictEqual(modoDaBarra({ ehEquipe:false, serve:false, perms:['tarefas'], ordemModulos:BASE_MOD }), 'coordenacao');
});

test('quem serve continua começando na jornada, mesmo com permissão', () => {
  // a permissão ABRE a porta; não empurra ninguém para dentro
  assert.strictEqual(modoDaBarra({ ehEquipe:false, serve:true, perms:['tarefas'], ordemModulos:BASE_MOD }), 'jornada');
});

test('permissão que não é de módulo não vale como passe', () => {
  // permissões antigas/lixo no cadastro não podem virar acesso à coordenação
  assert.strictEqual(modoDaBarra({ ehEquipe:false, serve:true, perms:['coisa_que_nao_existe'], ordemModulos:BASE_MOD, salvo:'coordenacao' }), 'jornada');
});

test('lista de permissões ausente ou torta não quebra', () => {
  assert.strictEqual(modoDaBarra({ ehEquipe:false, serve:true, ordemModulos:BASE_MOD }), 'jornada');
  assert.strictEqual(modoDaBarra({ ehEquipe:false, serve:true, perms:null, ordemModulos:BASE_MOD }), 'jornada');
});

// ── Qual botão da barra acende numa tela que NÃO tem botão próprio ────────────
// A Ausências acendia o botão da Caixa: você abria as Ausências e a barra dizia
// que você estava na Caixa. A barra passa a acender a SEÇÃO de onde a tela sai.
const { idNaBarra } = require('./navegacao-core.js');

test('Ausências acende a Escala na coordenação — nunca a Caixa', () => {
  assert.strictEqual(idNaBarra('ausencias', 'coordenacao'), 'escala');
  assert.notStrictEqual(idNaBarra('ausencias', 'coordenacao'), 'caixa');
});

test('Ausências acende as Escalas do membro no modo jornada', () => {
  assert.strictEqual(idNaBarra('ausencias', 'jornada'), 'escalas-membro');
});

test('Chamada segue a mesma regra: ela mora dentro da Escala', () => {
  assert.strictEqual(idNaBarra('chamada', 'coordenacao'), 'escala');
  assert.strictEqual(idNaBarra('chamada', 'jornada'), 'escalas-membro');
});

test('tela que TEM botão próprio acende ela mesma', () => {
  assert.strictEqual(idNaBarra('escala', 'coordenacao'), 'escala');
  assert.strictEqual(idNaBarra('caixa', 'coordenacao'), 'caixa');
  assert.strictEqual(idNaBarra('membros', 'coordenacao'), 'membros');
});

test('modo ausente ou torto não acende a barra da coordenação por engano', () => {
  assert.strictEqual(idNaBarra('ausencias', undefined), 'escalas-membro');
  assert.strictEqual(idNaBarra('ausencias', 'coisa-torta'), 'escalas-membro');
});
