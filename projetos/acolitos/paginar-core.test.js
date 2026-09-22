// Testes do leitor paginado. Rodar: node --test projetos/acolitos/paginar-core.test.js
const test = require('node:test');
const assert = require('node:assert');
const { lerTudo } = require('./paginar-core.js');

// Um banco de mentira que se comporta como o Supabase: NUNCA devolve mais que `teto`
// linhas, mesmo que peçam mais, e responde HTTP 200 com a lista cortada.
function bancoFake(linhas, opcoes) {
  opcoes = opcoes || {};
  const teto = opcoes.teto || 1000;
  const chamadas = [];
  const montar = () => ({
    range(de, ate) {
      chamadas.push([de, ate]);
      if (opcoes.erroNaChamada === chamadas.length) return Promise.resolve({ data: null, error: { message: 'caiu' } });
      const pedido = Math.min(ate - de + 1, teto);
      return Promise.resolve({ data: linhas.slice(de, de + pedido), error: null });
    },
  });
  return { montar, chamadas };
}
const listaDe = (n) => Array.from({ length: n }, (_, i) => ({ i }));

test('lista menor que a página vem inteira, numa pergunta só', async () => {
  const b = bancoFake(listaDe(42));
  const r = await lerTudo(b.montar, { pagina: 1000 });
  assert.strictEqual(r.error, null);
  assert.strictEqual(r.data.length, 42);
  assert.strictEqual(b.chamadas.length, 1);
});

test('lista MAIOR que o teto vem inteira — é o defeito que isto existe para tapar', async () => {
  const b = bancoFake(listaDe(1321));
  const r = await lerTudo(b.montar, { pagina: 1000 });
  assert.strictEqual(r.data.length, 1321);
  assert.strictEqual(b.chamadas.length, 2);
});

test('não perde nem repete linha nenhuma na emenda entre páginas', async () => {
  const b = bancoFake(listaDe(2500));
  const r = await lerTudo(b.montar, { pagina: 1000 });
  assert.deepStrictEqual(r.data.map(x => x.i), listaDe(2500).map(x => x.i));
});

test('lista com o tamanho EXATO de uma página não engana (pede mais uma e para)', async () => {
  const b = bancoFake(listaDe(1000));
  const r = await lerTudo(b.montar, { pagina: 1000 });
  assert.strictEqual(r.data.length, 1000);
  assert.strictEqual(b.chamadas.length, 2, 'precisa perguntar de novo para saber que acabou');
});

test('lista vazia devolve vazia, sem erro', async () => {
  const b = bancoFake([]);
  const r = await lerTudo(b.montar, { pagina: 1000 });
  assert.deepStrictEqual(r.data, []);
  assert.strictEqual(r.error, null);
});

// A parte que mais importa: uma falha no meio NÃO pode virar "lista curta que parece
// completa" — seria trocar o corte silencioso de hoje por outro corte silencioso.
test('erro na PRIMEIRA página devolve erro e data nulo, nunca lista vazia', async () => {
  const b = bancoFake(listaDe(50), { erroNaChamada: 1 });
  const r = await lerTudo(b.montar, { pagina: 1000 });
  assert.strictEqual(r.data, null);
  assert.ok(r.error, 'tem de devolver o erro');
});

test('erro na SEGUNDA página joga fora a primeira — meia lista mentindo é pior que erro', async () => {
  const b = bancoFake(listaDe(1500), { erroNaChamada: 2 });
  const r = await lerTudo(b.montar, { pagina: 1000 });
  assert.strictEqual(r.data, null);
  assert.ok(r.error);
});

test('um teto de segurança impede laço infinito se o banco responder torto', async () => {
  // banco que devolve sempre uma página cheia, para sempre
  const montar = () => ({ range: (de, ate) => Promise.resolve({ data: listaDe(ate - de + 1), error: null }) });
  const r = await lerTudo(montar, { pagina: 1000, maximo: 3000 });
  assert.strictEqual(r.data.length, 3000);
  assert.ok(r.truncado, 'precisa AVISAR que parou no teto, em vez de fingir que acabou');
});

test('o tamanho da página é respeitado (dá para pedir páginas menores)', async () => {
  const b = bancoFake(listaDe(250));
  await lerTudo(b.montar, { pagina: 100 });
  assert.deepStrictEqual(b.chamadas, [[0, 99], [100, 199], [200, 299]]);
});

// ── Contagem que não mente ────────────────────────────────────────────────────────────
// Os três primeiros cartões do Início faziam `resposta.count || 0`. Provado com o provador
// de telas em 22/09/2026: banco respondendo → 42/9/7; banco RECUSANDO → 0/0/0, sem aviso
// nenhum. "Membros Ativos: 0" numa pastoral de 193 pessoas passa por lentidão do celular.
const { contagemHonesta } = require('./paginar-core.js');

test('contagem: banco respondeu, devolve o número', () => {
  assert.deepStrictEqual(contagemHonesta({ count: 42, error: null }), { valor: 42, falhou: false });
});

test('contagem: ZERO de verdade continua sendo zero — não é falha', () => {
  assert.deepStrictEqual(contagemHonesta({ count: 0, error: null }), { valor: 0, falhou: false });
});

test('contagem: banco recusou NÃO vira zero', () => {
  const r = contagemHonesta({ count: null, error: { code: '42501' } });
  assert.strictEqual(r.falhou, true);
  assert.strictEqual(r.valor, null, 'devolver 0 aqui é o defeito inteiro');
});

test('contagem: resposta sem count e sem erro também é falha, não zero', () => {
  // acontece quando a consulta nem chega a rodar (rede caiu, promessa rejeitada tratada)
  assert.deepStrictEqual(contagemHonesta({}), { valor: null, falhou: true });
  assert.deepStrictEqual(contagemHonesta(null), { valor: null, falhou: true });
  assert.deepStrictEqual(contagemHonesta(undefined), { valor: null, falhou: true });
});
