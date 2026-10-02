// Rodar: node --test projetos/acolitos/retiros-core.test.js
const test = require('node:test');
const assert = require('node:assert');
const R = require('./retiros-core.js');

const HOJE = '2026-10-10';

test('atrasado: prazo vencido e não resolvido', () => {
  assert.strictEqual(R.atrasado({ prazo: '2026-10-09', status: 'a_fazer' }, HOJE), true);
  assert.strictEqual(R.atrasado({ prazo: '2026-10-10', status: 'a_fazer' }, HOJE), false, 'vence hoje não é atraso');
  assert.strictEqual(R.atrasado({ prazo: '2026-10-01', status: 'feito' }, HOJE), false);
  assert.strictEqual(R.atrasado({ prazo: '2026-10-01', status: 'comprada' }, HOJE), false);
  assert.strictEqual(R.atrasado({ prazo: null, status: 'a_fazer' }, HOJE), false, 'sem prazo não atrasa');
});

test('ordenarPlano: data, depois hora; sem data vai para o fim', () => {
  const o = R.ordenarPlano([
    { titulo: 'C', data: null, hora: null },
    { titulo: 'B', data: '2026-11-02', hora: '14:00:00' },
    { titulo: 'A', data: '2026-11-02', hora: '08:00:00' },
    { titulo: 'Z', data: '2026-11-01', hora: '20:00:00' },
  ]).map(x => x.titulo);
  assert.deepStrictEqual(o, ['Z', 'A', 'B', 'C']);
});

test('melhorCotacao: a mais barata; a vencida não entra', () => {
  const c = [
    { id: 1, valor_unitario: 10 },
    { id: 2, valor_unitario: 7, validade: '2026-10-01' },
    { id: 3, valor_unitario: 8.5 },
  ];
  assert.strictEqual(R.melhorCotacao(c, HOJE).id, 3);
  assert.strictEqual(R.melhorCotacao(c).id, 2, 'sem "hoje" não filtra validade');
  assert.strictEqual(R.melhorCotacao([], HOJE), null);
});

test('economia: diferença entre a mais cara e a mais barata; 1 cotação = null', () => {
  assert.strictEqual(R.economia([{ valor_unitario: 10 }, { valor_unitario: 7.5 }], 4), 10);
  assert.strictEqual(R.economia([{ valor_unitario: 10 }], 4), null);
});

test('totalDaCotacao arredonda em centavos', () => {
  assert.strictEqual(R.totalDaCotacao({ valor_unitario: 3.333 }, 3), 10);
  assert.strictEqual(R.totalDaCotacao({ valor_unitario: '2.5' }, '4'), 10);
});

test('valorDaCompra: pago se comprada, senão estimado, senão zero', () => {
  assert.strictEqual(R.valorDaCompra({ status: 'comprada', valor_pago: 18, valor_estimado: 20 }), 18);
  assert.strictEqual(R.valorDaCompra({ status: 'aprovada', valor_estimado: 20 }), 20);
  assert.strictEqual(R.valorDaCompra({ status: 'pendente' }), 0);
});

test('conciliar: compra comprada SEM lançamento é separada, não somada em silêncio', () => {
  const compras = [
    { id: 'a', status: 'comprada', valor_pago: 50 },
    { id: 'b', status: 'comprada', valor_pago: 30 },
    { id: 'c', status: 'comprada', valor_pago: 10 },
    { id: 'd', status: 'pendente' },
  ];
  const lancs = [
    { tipo: 'saida', valor: 50, retiro_compra_id: 'a' },
    { tipo: 'saida', valor: 25, retiro_compra_id: 'b' },       // valor diferente do pago
    { tipo: 'entrada', valor: 100, categoria: 'dizimo' },       // doação
    { tipo: 'entrada', valor: 40, categoria: 'rifa' },          // venda de item
  ];
  const c = R.conciliar(compras, lancs);
  assert.deepStrictEqual(c.semLancamento.map(x => x.id), ['c']);
  assert.deepStrictEqual(c.divergentes.map(x => x.compra.id), ['b']);
  assert.strictEqual(c.bate, false);
  assert.strictEqual(c.entradas, 140);
  assert.strictEqual(c.doacoes, 100);
  assert.strictEqual(c.vendas, 40);
  assert.strictEqual(c.saidas, 75);
  assert.strictEqual(c.saldo, 65);
});

test('conciliar: tudo certo = bate', () => {
  const c = R.conciliar([{ id: 'a', status: 'comprada', valor_pago: 5 }], [{ tipo: 'saida', valor: 5, retiro_compra_id: 'a' }]);
  assert.strictEqual(c.bate, true);
});

test('resumoDaArea: percentual, atrasos e orçamento', () => {
  const r = R.resumoDaArea({
    itens: [
      { status: 'feito' }, { status: 'a_fazer', prazo: '2026-10-01' }, { status: 'andamento' },
    ],
    compras: [
      { id: 'a', status: 'comprada', valor_pago: 40, valor_estimado: 45 },
      { id: 'b', status: 'aprovada', valor_estimado: 60, prazo: '2026-10-05' },
      { id: 'c', status: 'pendente' },
    ],
    lancamentos: [{ tipo: 'saida', valor: 40, retiro_compra_id: 'a' }],
  }, HOJE);
  assert.strictEqual(r.itens, 3);
  assert.strictEqual(r.feitos, 1);
  assert.strictEqual(r.compras, 3);
  assert.strictEqual(r.comprasFeitas, 1);
  assert.strictEqual(r.atrasados, 2);
  assert.strictEqual(r.orcamento, 100, 'pago 40 + estimado 60');
  assert.strictEqual(r.pago, 40);
  assert.strictEqual(r.comprasSemValor, 1);
  assert.strictEqual(r.percentual, 33, '2 resolvidas de 6');
  assert.strictEqual(r.caixa.bate, true);
});

test('resumoDaArea: área vazia não vira 0% — vira "não sei" (null)', () => {
  assert.strictEqual(R.resumoDaArea({}, HOJE).percentual, null);
});
