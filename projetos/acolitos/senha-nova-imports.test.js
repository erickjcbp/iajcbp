// Guarda de import: toda tela que roda o initModulo tem de carregar a regra da senha.
//
// O portão da senha vive dentro do initModulo, e o initModulo roda em TODAS as telas. Se
// uma delas esquecer o <script>, a parede daquela tela vira uma tela quebrada — e o
// defeito só aparece quando uma família de verdade cair nela. Uma lista escrita à mão
// envelhece; esta prova lê as telas do disco a cada rodada.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

test('toda tela com os *-core carrega também a senha-nova-core.js', () => {
  const dir = __dirname;
  const telas = fs.readdirSync(dir).filter(f => f.endsWith('.html'))
    .filter(f => fs.readFileSync(path.join(dir, f), 'utf8').includes('boas-vindas-core.js'));
  assert.ok(telas.length >= 20, 'esperava 20+ telas, achei ' + telas.length + ' — sumiu arquivo?');
  const faltando = telas.filter(f => !fs.readFileSync(path.join(dir, f), 'utf8').includes('senha-nova-core.js'));
  assert.deepStrictEqual(faltando, [], 'estas telas não carregam a regra da senha: ' + faltando.join(', '));

  // O mesmo vale para a regra dos TELEFONES: se uma tela esquecer o <script>, ela cai na
  // reserva de dentro da função e volta a mostrar um telefone diferente das outras.
  const semTel = telas.filter(f => !fs.readFileSync(path.join(dir, f), 'utf8').includes('telefones-core.js'));
  assert.deepStrictEqual(semTel, [], 'estas telas não carregam a regra dos telefones: ' + semTel.join(', '));

  // E para a regra do RECADO DA FOTO: sem o <script>, a tela quebra no primeiro aviso
  // da fila — `temFotoDePerfil` não existiria e o pop-up de QUALQUER aviso morreria
  // junto. Não é só o convite da foto que se perde: é a fila inteira daquela tela.
  const semFoto = telas.filter(f => !fs.readFileSync(path.join(dir, f), 'utf8').includes('foto-recado-core.js'));
  assert.deepStrictEqual(semFoto, [], 'estas telas não carregam a regra do recado da foto: ' + semFoto.join(', '));

  // E para a regra de ORDENAR E FILTRAR: a barra mora no shared.js e usa o FiltroLista.
  // Tela que esquecer o <script> fica sem a barra — e a lista some junto com ela.
  const semFiltro = telas.filter(f => !fs.readFileSync(path.join(dir, f), 'utf8').includes('filtro-lista-core.js'));
  assert.deepStrictEqual(semFiltro, [], 'estas telas não carregam a regra de ordenar e filtrar: ' + semFiltro.join(', '));

  // E para a regra do HORÁRIO: tela que esquecer o <script> volta a ordenar as missas pelo
  // texto ('9h' depois de '19h') — e isso não estoura, só mostra errado, que é pior.
  const semHorario = telas.filter(f => !fs.readFileSync(path.join(dir, f), 'utf8').includes('horario-core.js'));
  assert.deepStrictEqual(semHorario, [], 'estas telas não carregam a regra do horário: ' + semHorario.join(', '));
});

// O leitor paginado é diferente dos de cima: nem toda tela precisa dele, só as que leem
// tabela grande. Por isso a pergunta não é "todas carregam?", e sim "quem USA, carrega?".
// Uma lista escrita à mão aqui envelheceria na primeira tela nova.
//
// Esquecer este <script> não quebra nada visível: `lerTudo` seria `undefined`, a chamada
// estouraria dentro de um `await` e a tela mostraria lista vazia ou um pedaço dela — que é
// exatamente o defeito que o leitor existe para tapar, de volta com outra roupa.
test('toda tela que USA o leitor paginado carrega a paginar-core.js', () => {
  const dir = __dirname;
  const telas = fs.readdirSync(dir).filter(f => f.endsWith('.html'));
  const usam = telas.filter(f => /\blerTudo\s*\(/.test(fs.readFileSync(path.join(dir, f), 'utf8')));
  assert.ok(usam.length >= 5, 'esperava 5+ telas usando o leitor, achei ' + usam.length + ' — sumiu arquivo?');
  const faltando = usam.filter(f => !fs.readFileSync(path.join(dir, f), 'utf8').includes('paginar-core.js'));
  assert.deepStrictEqual(faltando, [], 'estas telas usam lerTudo() sem carregar a regra: ' + faltando.join(', '));
});

// Aba fantasma: `renderTab('X')` com um X que o `renderTab` não conhece.
//
// Não estoura, não avisa: o `renderTab` começa LIMPANDO o conteúdo da ficha e, se nenhum
// `if` casar, simplesmente não desenha nada — a aba fica em branco. Foi o que sobrou em
// membros.html quando a aba "Evolução" mudou de tela: quatro chamadas apontando para o
// vazio, e a grade de funções inteira virou código que ninguém alcança.
test('nenhuma tela chama renderTab com uma aba que não existe', () => {
  const dir = __dirname;
  const telas = fs.readdirSync(dir).filter((f) => f.endsWith('.html'))
    .filter((f) => /function\s+renderTab\b/.test(fs.readFileSync(path.join(dir, f), 'utf8')));
  assert.ok(telas.length >= 1, 'esperava ao menos uma tela com renderTab, achei ' + telas.length);
  const fantasmas = [];
  telas.forEach((f) => {
    const txt = fs.readFileSync(path.join(dir, f), 'utf8');
    const conhecidas = new Set([...txt.matchAll(/if \(tab === '([^']+)'\)/g)].map((m) => m[1]));
    [...txt.matchAll(/renderTab\('([^']+)'\)/g)].forEach((m) => {
      if (!conhecidas.has(m[1])) fantasmas.push(f + " → renderTab('" + m[1] + "')");
    });
  });
  assert.deepStrictEqual(fantasmas, [], 'estas chamadas abrem uma aba que ninguém desenha: ' + fantasmas.join(', '));
});
