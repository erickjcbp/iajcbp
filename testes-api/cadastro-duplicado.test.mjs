import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
async function carregar(nome) {
  const dep = new URL('../api/_vinculo.js', import.meta.url).href;
  const dep2 = new URL('../api/_freio.js', import.meta.url).href;
  const src = fs.readFileSync(new URL('../api/' + nome, import.meta.url), 'utf8').replace("'./_vinculo.js'", JSON.stringify(dep)).replace("'./_freio.js'", JSON.stringify(dep2));
  return (await import('data:text/javascript;base64,' + Buffer.from(src).toString('base64'))).default;
}
const reconhecer = await carregar('reconhecer-cadastro.js');
const familia = await carregar('signup-familia.js');
process.env.SUPABASE_URL = 'https://cadastro.test';
process.env.SUPABASE_ANON_KEY = 'anon-ficticia';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-ficticia';
const ficha = { id: 'ativa', nome: 'Luana Prado', data_nascimento: '2011-01-09', user_id: 'conta-antiga', nivel: 'acolito_sentinela' };
const resposta = (data, ok = true) => ({ ok, status: ok ? 200 : 503, json: async () => data });
function resMock() { return { status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; }, end() { return this; } }; }
async function simular(handler, req, responder) {
  const original = globalThis.fetch, chamadas = [];
  globalThis.fetch = async (url, opts = {}) => { const c = { url: String(url), metodo: opts.method || 'GET', body: opts.body && JSON.parse(opts.body) }; chamadas.push(c); return responder(c); };
  const res = resMock();
  try { await handler(req, res); } finally { globalThis.fetch = original; }
  return { res, chamadas };
}
const reqNovo = { method: 'POST', headers: { authorization: 'Bearer token-ficticio' }, body: { nome: ficha.nome, nascimento: ficha.data_nascimento } };
const reqFamilia = { method: 'POST', body: { senha: 'senha-ficticia', pais: {}, filhos: [{ nome: ficha.nome, usuario: 'luana', data_nascimento: ficha.data_nascimento }] } };

test('Novos: três bloqueios de conta existente não liberam a quarta tentativa', async () => {
  const tentativas = [];
  for (let i = 0; i < 6; i++) {
    const { res, chamadas } = await simular(reconhecer, reqNovo, c => {
      if (c.url.endsWith('/auth/v1/user')) return resposta({ id: 'conta-recente' });
      if (c.url.includes('acolitos_vinculo_tentativas')) {
        if (c.metodo === 'POST') { tentativas.push(c.body); return resposta(null); }
        return resposta(c.url.includes('liberado=') ? [] : tentativas.map((_, n) => ({ id: n })));
      }
      if (c.url.includes('acolitos_membros')) return resposta([ficha]);
      throw new Error('Chamada inesperada: ' + c.url);
    });
    assert.equal(res.code, 200);
    assert.equal(res.body.situacao, i < 3 ? 'ja_tem_conta' : 'travado');
    assert.ok(chamadas.every(c => c.metodo === 'GET' || c.url.includes('acolitos_vinculo_tentativas')), 'não escreve ficha, conta ou papel');
    if (i >= 3) assert.ok(!chamadas.some(c => c.url.includes('acolitos_membros')), 'não avalia novas provas após o limite');
  }
});

test('Família: limite não cria conta, ficha ou CRM', async () => {
  const { res, chamadas } = await simular(familia, reqFamilia, c => {
    if (c.url.includes('pastoral_modules')) return resposta([{ id: 'modulo' }]);
    if (c.url.includes('acolitos_membros')) return resposta([ficha]);
    if (c.url.includes('acolitos_vinculo_tentativas')) return resposta(c.metodo === 'GET' ? [{ id: 1 }, { id: 2 }, { id: 3 }] : null);
    throw new Error('Chamada inesperada: ' + c.url);
  });
  assert.equal(res.code, 400);
  assert.match(res.body.error, /limite de tentativas/i);
  assert.ok(chamadas.every(c => c.metodo === 'GET' || c.url.includes('acolitos_vinculo_tentativas')));
});

for (const [nome, handler, req] of [['Novos', reconhecer, reqNovo], ['Família', familia, reqFamilia]]) {
  test(nome + ': falha na leitura de tentativas não autoriza cadastro', async () => {
    const { res, chamadas } = await simular(handler, req, c => {
      if (c.url.endsWith('/auth/v1/user')) return resposta({ id: 'conta-recente' });
      if (c.url.includes('pastoral_modules')) return resposta([{ id: 'modulo' }]);
      if (c.url.includes('acolitos_membros')) return resposta([ficha]);
      if (c.url.includes('acolitos_vinculo_tentativas')) return resposta({}, false);
      throw new Error('Chamada inesperada: ' + c.url);
    });
    assert.ok(res.code >= 400);
    assert.ok(chamadas.every(c => c.metodo === 'GET'));
  });
}

test('Família: falha ao consultar membros não transforma todos em recém-chegados', async () => {
  const { res, chamadas } = await simular(familia, reqFamilia, c => c.url.includes('pastoral_modules') ? resposta([{ id: 'modulo' }]) : resposta({}, false));
  assert.equal(res.code, 503);
  assert.ok(chamadas.every(c => c.metodo === 'GET'));
});
