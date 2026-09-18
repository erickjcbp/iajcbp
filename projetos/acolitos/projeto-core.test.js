// O PROJETO: a tarefa que tem começo, meio e fim.
//
// Espelha as regras do erickIA (src/compartilhado/regras-de-projeto.js), que o dono pediu
// para reproduzir aqui. A ideia que importa: o risco não aparece na barra de progresso, e sim
// na COMPARAÇÃO entre quanto andou e quanto do tempo já correu — 30% feito com 80% do prazo
// consumido é um projeto que não vai fechar, e ninguém percebe olhando só o progresso.
//
// `hoje` entra por parâmetro: regra de data que lê o relógio por dentro não se prova.
const { test } = require('node:test');
const assert = require('node:assert');
const {
  ehProjeto, marcosDe, situacaoDoProjeto, resumoDoProjeto,
} = require('./projeto-core.js');

const projeto = (extra) => Object.assign({
  tipo: 'projeto', titulo: 'Preparar a festa de São Tarcísio',
  inicio: '2026-09-01', prazo: '2026-10-01', passos: [],
}, extra || {});

test('só é projeto quem foi marcado como projeto', () => {
  assert.strictEqual(ehProjeto({ tipo: 'projeto' }), true);
  assert.strictEqual(ehProjeto({ tipo: 'tarefa' }), false);
  assert.strictEqual(ehProjeto(null), false);
  assert.strictEqual(ehProjeto({}), false);
});

test('marco é o passo COM prazo — passo sem prazo não é marco', () => {
  const p = projeto({ passos: [
    { titulo: 'Reservar o salão', prazo: '2026-09-20' },
    { titulo: 'Comprar as velas', prazo: null },
    { titulo: 'Convidar o pároco', prazo: '2026-09-10' },
  ] });
  assert.deepStrictEqual(marcosDe(p).map(m => m.titulo),
    ['Convidar o pároco', 'Reservar o salão'], 'em ordem de prazo, e sem o passo solto');
});

test('a situação compara o que andou com o tempo que correu', () => {
  const p = projeto({ passos: [
    { titulo: 'a', prazo: '2026-09-10', concluido_em: '2026-09-09' },
    { titulo: 'b', prazo: '2026-09-20' },
    { titulo: 'c', prazo: null },
    { titulo: 'd', prazo: null },
  ] });
  const s = situacaoDoProjeto(p, '2026-09-25');
  assert.strictEqual(s.passos, 4);
  assert.strictEqual(s.feitos, 1);
  assert.strictEqual(s.pctFeito, 25);
  // de 01/09 a 01/10 são 30 dias; em 25/09 correram 24
  assert.strictEqual(s.pctTempo, 80);
  assert.strictEqual(s.diasRestantes, 6);
  assert.strictEqual(s.marcos, 2);
});

test('marco vencido e não concluído deixa o projeto ATRASADO, mesmo dentro do prazo', () => {
  const p = projeto({ passos: [{ titulo: 'a', prazo: '2026-09-10' }] });
  const s = situacaoDoProjeto(p, '2026-09-15');
  assert.strictEqual(s.marcosVencidos, 1);
  assert.strictEqual(s.atrasado, true, 'o prazo final é 01/10, mas um marco já passou');
  assert.strictEqual(s.proximoMarco.titulo, 'a');
});

test('sem início não se inventa barra de tempo — devolve nada', () => {
  // Foi exatamente este o defeito no erickIA: a barra lia um campo que ninguém preenchia,
  // e ficava sempre vazia sem ninguém notar. Aqui, "não sei" é uma resposta.
  const s = situacaoDoProjeto(projeto({ inicio: null }), '2026-09-25');
  assert.strictEqual(s.pctTempo, null);
  const s2 = situacaoDoProjeto(projeto({ prazo: null }), '2026-09-25');
  assert.strictEqual(s2.pctTempo, null);
});

test('início e prazo no mesmo dia não estouram a conta', () => {
  const mesmo = projeto({ inicio: '2026-09-20', prazo: '2026-09-20' });
  assert.strictEqual(situacaoDoProjeto(mesmo, '2026-09-19').pctTempo, 0);
  assert.strictEqual(situacaoDoProjeto(mesmo, '2026-09-20').pctTempo, 100);
  assert.strictEqual(situacaoDoProjeto(mesmo, '2026-10-01').pctTempo, 100, 'nunca passa de 100');
});

test('projeto sem passo nenhum não estoura e não mente progresso', () => {
  const s = situacaoDoProjeto(projeto(), '2026-09-25');
  assert.strictEqual(s.passos, 0);
  assert.strictEqual(s.pctFeito, 0);
  assert.strictEqual(s.marcos, 0);
  assert.strictEqual(s.proximoMarco, null);
});

test('o resumo do cartão mostra a JANELA, não só o fim', () => {
  const p = projeto({ passos: [
    { titulo: 'a', prazo: '2026-09-10', concluido_em: '2026-09-09' },
    { titulo: 'b', prazo: '2026-09-28' },
  ] });
  const r = resumoDoProjeto(p, '2026-09-25');
  assert.strictEqual(r.janela, '01/set → 01/out', 'um projeto que começa amanhã é outra coisa de um que já corre há um mês');
  assert.strictEqual(r.marcosFeitos, 1);
  assert.strictEqual(r.marcosTotal, 2);
  assert.strictEqual(r.proximoMarco.titulo, 'b');
});

test('tarefa comum não ganha resumo de projeto', () => {
  assert.strictEqual(resumoDoProjeto({ tipo: 'tarefa', passos: [] }, '2026-09-25'), null);
});
