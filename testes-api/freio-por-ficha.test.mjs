import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// O freio por nome digitado (Família) e por conta (Novos) se contorna: trocar a grafia do
// nome ou abrir outra conta zera a contagem. O freio por FICHA-ALVO (api/_freio.js) não.
async function carregar(nome) {
  const href = (f) => JSON.stringify(new URL('../api/' + f, import.meta.url).href);
  const src = fs.readFileSync(new URL('../api/' + nome, import.meta.url), 'utf8')
    .replace("'./_vinculo.js'", href('_vinculo.js')).replace("'./_freio.js'", href('_freio.js')).replace("'./_limite-cadastro.js'", href('_limite-cadastro.js'));
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

test('Cadastro público: o 21º pedido do mesmo IP na hora leva 429; falha da tabela não derruba o cadastro', async () => {
  const guardados = [];
  const responder = (c) => {
    const u = decodeURIComponent(c.url);
    if (u.includes('acolitos_signup_tentativas')) {
      if (c.metodo === 'POST') { guardados.push(c.body.ip_hash); return resposta(null); }
      const ip = (u.match(/ip_hash=eq\.([0-9a-f]+)/) || [])[1];
      return resposta(guardados.filter((g) => g === ip).map((_, i) => ({ id: i })));
    }
    return resposta({ id: 'novo' });
  };
  const codigos = [];
  for (let i = 0; i < 22; i++) {
    const { res } = await chamar(signupAcolito, { method: 'POST', headers: { 'x-forwarded-for': '203.0.113.9, 10.0.0.1' }, body: { usuario: 'crianca' + i, password: 'senha-ficticia' } }, responder);
    codigos.push(res.code);
  }
  assert.equal(codigos.filter((c) => c === 200).length, 20);
  assert.deepEqual(codigos.slice(20), [429, 429]);
  assert.equal(new Set(guardados).size, 1, 'o IP vira hash: nada de IP em claro no banco');
  // outro IP não é afetado
  const outro = await chamar(signupAcolito, { method: 'POST', headers: { 'x-forwarded-for': '198.51.100.7' }, body: { usuario: 'outra', password: 'senha-ficticia' } }, responder);
  assert.equal(outro.res.code, 200);
  // tabela fora do ar (migration ainda não aplicada): cadastro segue
  const falha = await chamar(signupAcolito, { method: 'POST', headers: { 'x-forwarded-for': '192.0.2.1' }, body: { usuario: 'ok', password: 'senha-ficticia' } },
    (c) => decodeURIComponent(c.url).includes('acolitos_signup_tentativas') ? resposta({}, false) : resposta({ id: 'novo' }));
  assert.equal(falha.res.code, 200);
});
