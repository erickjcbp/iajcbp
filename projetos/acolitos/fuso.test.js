// Guarda contra a dívida de fuso voltar. Rodar: node --test projetos/acolitos/fuso.test.js
//
// Em 18/08/2026, ONZE lugares em SEIS arquivos calculavam "hoje" com
// `new Date().toISOString().slice(0,10)`, que devolve a data em UTC. Como o Brasil é UTC-3,
// das 21h à meia-noite o app achava que já era o dia seguinte — e dois desses lugares
// PRÉ-PREENCHIAM campo de data, sugerindo amanhã bem no horário em que o pessoal usa o app,
// saindo da missa.
//
// Este teste lê os arquivos como TEXTO, porque `node --test` não executa HTML: é o mesmo
// jeito do teste que confere o mapa de módulos do shared.js. Sem ele, a próxima tela nova
// copiaria o padrão errado de uma antiga e ninguém veria.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const DIR = __dirname;
const ARQUIVOS = fs.readdirSync(DIR).filter(f => f.endsWith('.html') || (f.endsWith('.js') && !f.endsWith('.test.js')));
const UTC_COMO_HOJE = /new Date\(\)\.toISOString\(\)\.slice\( *0 *, *10 *\)/;

test('nenhuma tela calcula "hoje" em UTC — use hojeLocal() do shared.js', () => {
  const culpados = [];
  for (const f of ARQUIVOS) {
    const txt = fs.readFileSync(path.join(DIR, f), 'utf8');
    txt.split('\n').forEach((linha, i) => {
      // A linha do comentário que EXPLICA o problema pode citar o padrão; código, não.
      if (UTC_COMO_HOJE.test(linha) && !linha.trimStart().startsWith('//')) {
        culpados.push(`${f}:${i + 1}`);
      }
    });
  }
  assert.deepStrictEqual(culpados, [],
    'Estes lugares voltaram a calcular "hoje" em UTC e ficam um dia à frente das 21h à meia-noite:\n  ' + culpados.join('\n  '));
});

test('hojeLocal existe no shared.js e monta a data pelo fuso de quem usa', () => {
  const txt = fs.readFileSync(path.join(DIR, 'shared.js'), 'utf8');
  assert.match(txt, /function hojeLocal\(\)/, 'hojeLocal() sumiu do shared.js');
  const corpo = txt.slice(txt.indexOf('function hojeLocal()'), txt.indexOf('function hojeLocal()') + 320);
  assert.match(corpo, /getFullYear\(\)/,  'hojeLocal precisa usar getFullYear (fuso local)');
  assert.match(corpo, /getMonth\(\)/,     'hojeLocal precisa usar getMonth (fuso local)');
  assert.match(corpo, /getDate\(\)/,      'hojeLocal precisa usar getDate (fuso local)');
  assert.doesNotMatch(corpo, /toISOString/, 'hojeLocal NÃO pode usar toISOString: é UTC');
});

test('hojeLocal devolve a data no formato AAAA-MM-DD e é a de hoje aqui', () => {
  // Carrega só a função, sem o resto do shared.js (que precisa de navegador).
  const txt = fs.readFileSync(path.join(DIR, 'shared.js'), 'utf8');
  const i = txt.indexOf('function hojeLocal()');
  const corpo = txt.slice(i, txt.indexOf('\n}', i) + 2);
  const hojeLocal = new Function(corpo + '; return hojeLocal;')();
  const r = hojeLocal();
  assert.match(r, /^\d{4}-\d{2}-\d{2}$/);
  const d = new Date();
  const esperado = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
                                   + '-' + String(d.getDate()).padStart(2, '0');
  assert.strictEqual(r, esperado);
});
