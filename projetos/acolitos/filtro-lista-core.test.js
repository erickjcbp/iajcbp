// Ordenar e filtrar: a regra que as seis listas do app vão dividir.
//
// Nasceu do pedido "na aba Membros não consigo ver quem entrou por último". A regra mora
// fora da tela para poder ser provada sem navegador — e porque seis telas vão usá-la:
// um defeito aqui aparece em todas, então é aqui que ele tem de ser pego.
const { test } = require('node:test');
const assert = require('node:assert');
const F = require('./filtro-lista-core.js');

const pessoas = [
  { id: 1, nome: 'Bruno', criado: '2026-06-01', com: 'matriz', foto: '' },
  { id: 2, nome: 'Ana', criado: '2026-06-01', com: 'matriz', foto: 'a.jpg' },
  { id: 3, nome: 'Carla', criado: '2026-08-27', com: 'santo_antonio', foto: '' },
  { id: 4, nome: 'Érico', criado: null, com: 'matriz', foto: 'e.jpg' },
];

const config = {
  chave: 'prova',
  rotulo: ['pessoa', 'pessoas'],
  ordemPadrao: 'nome',
  ordens: [
    { id: 'nome', nome: 'Nome A–Z', valor: (p) => p.nome },
    { id: 'recentes', nome: 'Mais recentes', desc: true, valor: (p) => p.criado,
      legenda: (p) => (p.criado ? 'cadastro ' + p.criado.slice(8, 10) + '/' + p.criado.slice(5, 7) : '') },
  ],
  filtros: [
    { id: 'com', nome: 'Comunidade', opcoes: [
      { id: 'matriz', nome: 'Matriz', testa: (p) => p.com === 'matriz' },
      { id: 'sa', nome: 'Santo Antônio', testa: (p) => p.com === 'santo_antonio' },
    ] },
    { id: 'foto', nome: 'Foto', opcoes: [
      { id: 'com', nome: 'Com foto', testa: (p) => !!p.foto },
      { id: 'sem', nome: 'Sem foto', testa: (p) => !p.foto },
    ] },
  ],
  busca: { placeholder: 'Buscar', campos: (p) => [p.nome] },
};

const nomes = (l) => l.map((p) => p.nome);

test('abre na ordem padrão, sem filtro e sem busca', () => {
  assert.deepStrictEqual(F.estadoInicial(config), { ordem: 'nome', ligados: [], busca: '' });
});

test('ordem por nome ignora acento e caixa', () => {
  assert.deepStrictEqual(nomes(F.aplicar(pessoas, F.estadoInicial(config), config)),
    ['Ana', 'Bruno', 'Carla', 'Érico']);
});

test('MAIS RECENTES: o mais novo no topo, empate pelo nome, sem data no FIM', () => {
  // É o pedido do dono. 156 dos 177 membros foram cadastrados no mesmo dia (a importação),
  // então o empate é o caso comum, não a exceção — e tem de ser estável.
  const e = F.escolherOrdem(F.estadoInicial(config), config, 'recentes');
  assert.deepStrictEqual(nomes(F.aplicar(pessoas, e, config)), ['Carla', 'Ana', 'Bruno', 'Érico']);
});

test('ordem desconhecida é ignorada — não troca para algo que a tela não oferece', () => {
  const e = F.escolherOrdem(F.estadoInicial(config), config, 'inventada');
  assert.strictEqual(e.ordem, 'nome');
});

test('duas opções do MESMO filtro somam (OU)', () => {
  let e = F.alternar(F.estadoInicial(config), config, 'com', 'matriz');
  e = F.alternar(e, config, 'com', 'sa');
  assert.strictEqual(F.aplicar(pessoas, e, config).length, 4);
});

test('filtros DIFERENTES se combinam (E)', () => {
  let e = F.alternar(F.estadoInicial(config), config, 'com', 'matriz');
  e = F.alternar(e, config, 'foto', 'sem');
  assert.deepStrictEqual(nomes(F.aplicar(pessoas, e, config)), ['Bruno']);
});

test('alternar duas vezes desliga', () => {
  let e = F.alternar(F.estadoInicial(config), config, 'foto', 'com');
  assert.strictEqual(F.estaLigado(e, 'foto', 'com'), true);
  e = F.alternar(e, config, 'foto', 'com');
  assert.strictEqual(F.estaLigado(e, 'foto', 'com'), false);
  assert.strictEqual(F.contar(e), 0);
});

test('opção que não existe não liga nada', () => {
  const e = F.alternar(F.estadoInicial(config), config, 'foto', 'talvez');
  assert.strictEqual(F.contar(e), 0);
});

test('busca sem acento acha com acento, e não conta como filtro', () => {
  const e = F.definirBusca(F.estadoInicial(config), 'eri');
  assert.deepStrictEqual(nomes(F.aplicar(pessoas, e, config)), ['Érico']);
  assert.strictEqual(F.contar(e), 0);
});

test('limpar tira os filtros e mantém ordem e busca', () => {
  let e = F.escolherOrdem(F.estadoInicial(config), config, 'recentes');
  e = F.definirBusca(e, 'a');
  e = F.alternar(e, config, 'foto', 'com');
  const l = F.limpar(e);
  assert.deepStrictEqual(l, { ordem: 'recentes', ligados: [], busca: 'a' });
});

test('as etiquetas saem na ordem em que foram ligadas', () => {
  let e = F.alternar(F.estadoInicial(config), config, 'foto', 'sem');
  e = F.alternar(e, config, 'com', 'sa');
  assert.deepStrictEqual(F.etiquetas(e, config).map((t) => t.texto), ['Sem foto', 'Santo Antônio']);
});

test('nome da ordem e legenda seguem a ordem escolhida', () => {
  const e = F.escolherOrdem(F.estadoInicial(config), config, 'recentes');
  assert.strictEqual(F.nomeDaOrdem(e, config), 'Mais recentes');
  assert.strictEqual(F.legenda(pessoas[2], e, config), 'cadastro 27/08');
  assert.strictEqual(F.legenda(pessoas[2], F.estadoInicial(config), config), '');
});

test('aplicar não mexe na lista que veio', () => {
  const copia = pessoas.map((p) => p.nome);
  F.aplicar(pessoas, F.escolherOrdem(F.estadoInicial(config), config, 'recentes'), config);
  assert.deepStrictEqual(pessoas.map((p) => p.nome), copia);
});

test('guardar e restaurar devolvem o mesmo estado', () => {
  let e = F.escolherOrdem(F.estadoInicial(config), config, 'recentes');
  e = F.alternar(e, config, 'com', 'sa');
  e = F.definirBusca(e, 'car');
  assert.deepStrictEqual(F.restaurar(F.guardar(e), config), e);
});

test('restaurar DESCARTA o que a tela não oferece mais', () => {
  // Sem isto, uma opção removida numa versão futura deixaria a tela presa num filtro que
  // ninguém vê na tela e que esvazia a lista.
  const velho = JSON.stringify({ v: 1, ordem: 'sumiu', busca: 'x',
    ligados: [{ f: 'com', o: 'sa' }, { f: 'sumiu', o: 'a' }, { f: 'com', o: 'sumiu' }, { f: 'com', o: 'sa' }] });
  assert.deepStrictEqual(F.restaurar(velho, config), { ordem: 'nome', ligados: [{ f: 'com', o: 'sa' }], busca: 'x' });
});

test('restaurar com lixo, vazio ou nulo abre no padrão', () => {
  for (const t of [null, '', 'não é json', '42', '[]']) {
    assert.deepStrictEqual(F.restaurar(t, config), F.estadoInicial(config), 'entrada: ' + t);
  }
});
