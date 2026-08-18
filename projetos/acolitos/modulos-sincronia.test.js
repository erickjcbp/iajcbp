// As TRÊS listas de módulo do shared.js têm de falar do mesmo conjunto. Nada garantia isso:
// o navegacao-core.test.js testa com módulos de mentira, e o de verdade só se via no app.
// Quando uma delas fica para trás, o módulo novo some de um lugar só — foi o que aconteceu
// com a Tarefas na ordenação da barra, dentro do Config.
//
//   MODULOS_LIBERAVEIS → as caixinhas de permissão (Config › Equipe & Permissões)
//   NAV_COORD_MODULOS  → o botão na barra (rótulo, ícone e para onde vai)
//   ORDEM_MODULOS      → a ordem padrão e quem alcança a Coordenação
//
// Rodar: node --test projetos/acolitos/modulos-sincronia.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const SHARED = fs.readFileSync(path.join(__dirname, 'shared.js'), 'utf8');

function trecho(nome, abre, fecha) {
  const i = SHARED.indexOf('const ' + nome + ' = ' + abre);
  assert.ok(i >= 0, nome + ' não foi encontrada no shared.js — foi renomeada?');
  const j = SHARED.indexOf('\n' + fecha, i);
  assert.ok(j > i, 'não achei o fim de ' + nome);
  return SHARED.slice(i, j);
}

// ['chave','rótulo','arquivo.html'] → primeira aspas de cada linha
const liberaveis = [...trecho('MODULOS_LIBERAVEIS', '[', '];').matchAll(/\['([a-z_]+)'/g)].map(m => m[1]);
// chave: { label:... } → chave no início da linha
const navCoord = [...trecho('NAV_COORD_MODULOS', '{', '};').matchAll(/\n\s{2}([a-z_]+):\s*\{/g)].map(m => m[1]);
const ordem = (SHARED.match(/const ORDEM_MODULOS = \[([^\]]+)\]/) || [,''])[1]
  .split(',').map(s => s.trim().replace(/'/g, '')).filter(Boolean);

const conjunto = a => [...a].sort().join(',');

test('as três listas de módulo falam do mesmo conjunto', () => {
  assert.ok(ordem.length >= 8, 'ORDEM_MODULOS veio vazia: a leitura do shared.js quebrou');
  assert.strictEqual(conjunto(navCoord), conjunto(ordem),
    'NAV_COORD_MODULOS e ORDEM_MODULOS divergem — módulo sem botão na barra, ou botão sem ordem');
  assert.strictEqual(conjunto(liberaveis), conjunto(ordem),
    'MODULOS_LIBERAVEIS e ORDEM_MODULOS divergem — módulo sem caixinha de permissão, ou permissão que não abre nada');
});

test('nenhuma lista tem chave repetida', () => {
  for (const [nome, lista] of [['MODULOS_LIBERAVEIS', liberaveis], ['NAV_COORD_MODULOS', navCoord], ['ORDEM_MODULOS', ordem]]) {
    assert.strictEqual(new Set(lista).size, lista.length, nome + ' tem chave repetida');
  }
});

test('a Tarefas está nas três — o módulo que faltou na ordenação da barra', () => {
  for (const [nome, lista] of [['MODULOS_LIBERAVEIS', liberaveis], ['NAV_COORD_MODULOS', navCoord], ['ORDEM_MODULOS', ordem]]) {
    assert.ok(lista.includes('tarefas'), 'tarefas fora de ' + nome);
  }
});
