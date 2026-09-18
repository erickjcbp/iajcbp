// A tela da Jornada respondia "quem está chegando lá" — em 18/09/2026, 1 pessoa. Ninguém
// respondia "quem NÃO saiu do lugar": 148 nunca tinham aberto o app e 155 nunca tinham
// progredido. Estas provas guardam a regra que dá nome a cada situação e escreve a mensagem.
const { test } = require('node:test');
const assert = require('node:assert');
const {
  FAIXAS, rotuloDaFaixa, explicacaoDaFaixa, urgenciaDaFaixa, resumo, mensagemWhatsapp,
  linkWhatsapp,
} = require('./formacao-core.js');

test('a ordem das faixas é a da urgência, e quem nunca entrou vem primeiro', () => {
  assert.deepStrictEqual(FAIXAS, ['nunca_entrou', 'travado', 'parou', 'andando']);
  assert.ok(urgenciaDaFaixa('nunca_entrou') < urgenciaDaFaixa('travado'));
  assert.ok(urgenciaDaFaixa('travado') < urgenciaDaFaixa('parou'));
  assert.ok(urgenciaDaFaixa('parou') < urgenciaDaFaixa('andando'));
});

test('faixa desconhecida vai para o FIM, nunca para o topo', () => {
  // Errar para cima poria lixo na frente do que importa.
  assert.ok(urgenciaDaFaixa('coisa_nova') > urgenciaDaFaixa('andando'));
  assert.ok(urgenciaDaFaixa(null) > urgenciaDaFaixa('andando'));
});

test('cada faixa tem rótulo e explicação em português de gente', () => {
  assert.strictEqual(rotuloDaFaixa('nunca_entrou'), 'Nunca entrou no app');
  assert.strictEqual(rotuloDaFaixa('travado'), 'Entrou e não começou');
  assert.strictEqual(rotuloDaFaixa('parou'), 'Parou');
  assert.strictEqual(rotuloDaFaixa('andando'), 'Andando');
  FAIXAS.forEach((f) => assert.ok(explicacaoDaFaixa(f).length > 10, 'sem explicação: ' + f));
});

test('rótulo de faixa que não existe não estoura nem mente', () => {
  assert.strictEqual(rotuloDaFaixa(undefined), '—');
  assert.strictEqual(explicacaoDaFaixa('inventada'), '');
});

test('o resumo conta por faixa e SEMPRE devolve as quatro, mesmo zeradas', () => {
  const r = resumo([
    { faixa: 'nunca_entrou' }, { faixa: 'nunca_entrou' }, { faixa: 'parou' },
  ]);
  assert.strictEqual(r.nunca_entrou, 2);
  assert.strictEqual(r.parou, 1);
  assert.strictEqual(r.travado, 0, 'faixa vazia tem de aparecer como 0, não sumir');
  assert.strictEqual(r.andando, 0);
  assert.strictEqual(r.total, 3);
});

test('o resumo não estoura com lista vazia nem conta faixa que não existe', () => {
  assert.strictEqual(resumo([]).total, 0);
  assert.strictEqual(resumo(null).total, 0);
  assert.strictEqual(resumo([{ faixa: 'inventada' }]).total, 0);
});

test('a mensagem fala com a FAMÍLIA, pelo primeiro nome, e muda conforme a situação', () => {
  const nunca = mensagemWhatsapp({ nome: 'Ana Clara Silva de Lima', faixa: 'nunca_entrou' });
  assert.ok(nunca.includes('Ana'), 'usa o primeiro nome');
  assert.ok(!nunca.includes('Ana Clara Silva'), 'não despeja o nome inteiro');
  assert.ok(/acesso|aplicativo/i.test(nunca), 'quem nunca entrou precisa do acesso');

  const parou = mensagemWhatsapp({ nome: 'Davi Martins Assis', faixa: 'parou' });
  assert.ok(/tudo bem/i.test(parou), 'quem parou merece uma pergunta, não uma cobrança');

  const travado = mensagemWhatsapp({ nome: 'Bento Gomes', faixa: 'travado' });
  assert.ok(/primeiro passo|come[çc]/i.test(travado));
});

test('mensagem sem nome e sem faixa não estoura nem sai quebrada', () => {
  const m = mensagemWhatsapp({});
  assert.ok(m.length > 10);
  assert.ok(!m.includes('undefined') && !m.includes('null'));
});

test('o link do WhatsApp aceita o número do jeito que a ficha guarda', () => {
  // A ficha tem número com máscara, com espaço, com traço — e alguns já com o 55 na frente.
  const esperado = 'https://wa.me/5519999070000';
  assert.ok(linkWhatsapp('(19) 99907-0000', 'oi').startsWith(esperado));
  assert.ok(linkWhatsapp('19999070000', 'oi').startsWith(esperado));
  assert.ok(linkWhatsapp('5519999070000', 'oi').startsWith(esperado), 'não duplica o 55');
  assert.ok(linkWhatsapp('+55 19 99907-0000', 'oi').startsWith(esperado));
});

test('o texto vai codificado, e acento não quebra o link', () => {
  const l = linkWhatsapp('19999070000', 'Olá! Tudo bem?');
  assert.ok(l.includes('?text='));
  assert.ok(!/ /.test(l), 'espaço cru quebraria o link');
  assert.ok(l.includes(encodeURIComponent('Olá! Tudo bem?')));
});

test('sem número não existe link — e isso não pode virar um link quebrado', () => {
  // Devolver um link torto faria a tela abrir o WhatsApp num número inventado.
  assert.strictEqual(linkWhatsapp(null, 'oi'), null);
  assert.strictEqual(linkWhatsapp('', 'oi'), null);
  assert.strictEqual(linkWhatsapp('123', 'oi'), null, 'número curto demais não é telefone');
});
