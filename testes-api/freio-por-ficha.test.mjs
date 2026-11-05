import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// O freio por nome digitado (Família) e por conta (Novos) se contorna: trocar a grafia do
// nome ou abrir outra conta zera a contagem. O freio por FICHA-ALVO (api/_freio.js) não.
async function carregar(nome) {
  const href = (f) => JSON.stringify(new URL('../api/' + f, import.meta.url).href);
  const src = fs.readFileSync(new URL('../api/' + nome, import.meta.url), 'utf8')
    .replace("'./_vinculo.js'", href('_vinculo.js')).replace("'./_freio.js'", href('_freio.js'));
  return (await import('data:text/javascript;base64,' + Buffer.from(src).toString('base64'))).default;
}
const familia = await carregar('signup-familia.js');
const reconhecer = await carregar('reconhecer-cadastro.js');
const signupAcolito = await carregar('signup-acolito.js');
process.env.SUPABASE_URL = 'https://freio.test';
process.env.SUPABASE_ANON_KEY = 'anon-ficticia';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-ficticia';

const ficha = { id: 'alvo', nome: 'Luana Prado', data_nascimento: '2011-01-09', nome_mae: 'Marta Prado', user_id: null, nivel: 'acolito_sentinela' };
const ERROS = ['prova_nao_bateu', 'travado'];
const resposta = (data, ok = true) => ({ ok, status: ok ? 200 : 503, json: async () => data });
function resMock() { return { status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; }, end() { return this; } }; }

// Banco de mentira que FILTRA as tentativas como o PostgREST: por nome exato, por ficha ou por conta.
function bancoDeMentira() {
  const tentativas = [];
  let n = 0;
  const responder = (c) => {
    const u = decodeURIComponent(c.url);
    if (c.url.endsWith('/auth/v1/user')) return resposta({ id: 'conta-' + (++n) });
    if (u.includes('acolitos_vinculo_tentativas')) {
      if (c.metodo === 'POST') { tentativas.push(c.body); return resposta(null); }
      if (u.includes('liberado=')) return resposta([]);
      const q = (nome) => (u.match(new RegExp(nome + '=(?:eq\\.|in\\.\\()([^&)]+)')) || [])[1];
      const nome = q('nome_digitado'), ids = (q('membro_id') || '').split(','), conta = q('user_id');
      return resposta(tentativas.filter((t) => ERROS.includes(t.resultado)
        && (nome === undefined || t.nome_digitado === nome)
        && (q('membro_id') === undefined || ids.includes(t.membro_id))
        && (conta === undefined || t.user_id === conta)));
    }
    if (u.includes('pastoral_modules')) return resposta([{ id: 'modulo' }]);
    if (u.includes('/auth/v1/admin/users') && c.metodo === 'POST') return resposta({ id: 'novo-' + (++n) });
    if (u.includes('acolitos_membros') && c.metodo === 'POST') return resposta([{ id: 'm-' + (++n) }]);
    if (u.includes('acolitos_membros') && c.metodo === 'GET') return resposta([ficha]);
    return resposta(null);
  };
  return { tentativas, responder };
}
async function chamar(handler, req, responder) {
  const original = globalThis.fetch, chamadas = [];
  globalThis.fetch = async (url, opts = {}) => { const c = { url: String(url), metodo: opts.method || 'GET', body: opts.body && JSON.parse(opts.body) }; chamadas.push(c); return responder(c); };
  const res = resMock();
  try { await handler(req, res); } finally { globalThis.fetch = original; }
  return { res, chamadas };
}

test('Família: trocar a grafia do nome NÃO zera o freio da ficha-alvo', async () => {
  const { tentativas, responder } = bancoDeMentira();
  const grafias = ['Luana Prado', 'LUANA PRADO', 'luana prado', 'Luána Prado', 'Luana PRADO', 'LUANA prado', 'Luana Prádo', 'lUANA Prado'];
  const codigos = [];
  for (let i = 0; i < grafias.length; i++) {
    const req = { method: 'POST', body: { senha: 'senha-ficticia', pais: { nome_mae: 'Outra Pessoa' },
      filhos: [{ nome: grafias[i], usuario: 'chute' + i, data_nascimento: '2011-02-0' + (i + 1) }] } };
    const { res } = await chamar(familia, req, responder);
    codigos.push(res.code);
  }
  assert.deepEqual(codigos, [200, 200, 200, 200, 200, 200, 400, 400], 'seis chutes passam, do sétimo em diante trava');
  assert.ok(tentativas.every((t) => t.membro_id === 'alvo'), 'toda tentativa é registrada na ficha-alvo');
});

test('Novos: abrir outra conta NÃO zera o freio da ficha-alvo', async () => {
  const { responder } = bancoDeMentira();
  const situacoes = [];
  for (let i = 0; i < 8; i++) {
    const req = { method: 'POST', headers: { authorization: 'Bearer t' }, body: { nome: 'Luana Prado', nascimento: '2011-03-0' + (i + 1), nome_mae: 'Outra Pessoa' } };
    const { res } = await chamar(reconhecer, req, responder);   // cada chamada é uma conta nova (conta-N)
    situacoes.push(res.body.situacao);
  }
  assert.deepEqual(situacoes, ['seguir', 'seguir', 'seguir', 'seguir', 'seguir', 'seguir', 'travado', 'travado']);
});

test('Cadastro público não aceita e-mail digitado: sempre o sintético', async () => {
  const { responder } = bancoDeMentira();
  const { res, chamadas } = await chamar(signupAcolito, { method: 'POST', body: { usuario: 'vitima@gmail.com', password: 'senha-ficticia' } }, (c) => resposta({ id: 'x' }));
  assert.equal(res.code, 200);
  assert.equal(res.body.email, 'vitima@coroinhas.jcbplimeira.com.br');
  assert.equal(chamadas[0].body.email, 'vitima@coroinhas.jcbplimeira.com.br');
  const vazio = await chamar(signupAcolito, { method: 'POST', body: { usuario: '@gmail.com', password: 'senha-ficticia' } }, responder);
  assert.equal(vazio.res.code, 400);
});
