// Portão do segredo do robô em api/regenerar-arte.js: o robô do WhatsApp (VPS) pede a arte da escala
// depois do Confirmar do dono. A chave dele (ROBO_PUSH_SECRET) vale SÓ para isto; o CRON_SECRET não entra.
// Roda com: node --test testes-api/regenerar-arte.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'

process.env.SUPABASE_URL = 'https://fake.supabase.test'
process.env.SUPABASE_ANON_KEY = 'anon'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'srk'
process.env.GH_PAT = 'gh-pat-falso'
process.env.GH_REPO = 'dono/repo'
process.env.CRON_SECRET = 'segredo-de-teste'
process.env.ROBO_PUSH_SECRET = 'segredo-do-robo'

// O pacote é "commonjs" e o handler é ESM: importa cópias .mjs (o _github.js junto, pelo import relativo).
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
const aqui = fileURLToPath(new URL('.', import.meta.url))
const copia = aqui + '_regenerar-arte.copia.mjs'
fs.writeFileSync(copia, fs.readFileSync(aqui + '../api/regenerar-arte.js', 'utf8').replace("'./_github.js'", "'./_github.copia.mjs'"))
fs.copyFileSync(aqui + '../api/_github.js', aqui + '_github.copia.mjs')
let handler
try { ({ default: handler } = await import('./_regenerar-arte.copia.mjs')) } finally {
  fs.rmSync(copia, { force: true }); fs.rmSync(aqui + '_github.copia.mjs', { force: true })
}

function res() {
  const r = { code: null, body: null }
  r.status = (c) => { r.code = c; return r }
  r.json = (b) => { r.body = b; return r }
  r.end = () => r
  return r
}
let chamadas = []
const fetchFalso = () => {
  chamadas = []
  globalThis.fetch = async (u, o = {}) => {
    chamadas.push({ url: String(u), corpo: o.body })
    if (String(u).includes('api.github.com')) return { ok: true, status: 204, text: async () => '' }
    return { ok: false, status: 401, json: async () => ({}) }   // sem JWT válido
  }
}
const chama = async (body, headers = {}) => { const r = res(); await handler({ method: 'POST', body, headers }, r); return r }
const disparou = () => chamadas.some((c) => c.url.includes('api.github.com'))

test('segredo do robô dispara a arte (202) e o pedido vai como automático', async () => {
  fetchFalso()
  const r = await chama({}, { 'x-cron-secret': 'segredo-do-robo' })
  assert.equal(r.code, 202, JSON.stringify(r.body))
  assert.ok(disparou())
  const gh = JSON.parse(chamadas.find((c) => c.url.includes('api.github.com')).corpo)
  assert.equal(gh.inputs.formato, 'automatico')
})
test('pelo segredo do robô o formato pedido no corpo é ignorado (sempre automático)', async () => {
  fetchFalso()
  await chama({ formato: 'unica' }, { 'x-cron-secret': 'segredo-do-robo' })
  assert.equal(JSON.parse(chamadas.find((c) => c.url.includes('api.github.com')).corpo).inputs.formato, 'automatico')
})
test('segredo errado: 403 e nada disparado', async () => {
  fetchFalso()
  const r = await chama({}, { 'x-cron-secret': 'errado' })
  assert.equal(r.code, 403)
  assert.ok(!disparou())
})
test('o CRON_SECRET não vale aqui: 403 e nada disparado', async () => {
  fetchFalso()
  const r = await chama({}, { 'x-cron-secret': 'segredo-de-teste' })
  assert.equal(r.code, 403)
  assert.ok(!disparou())
})
test('o segredo do robô no Authorization não passa (vira token inválido)', async () => {
  fetchFalso()
  const r = await chama({}, { authorization: 'Bearer segredo-do-robo' })
  assert.equal(r.code, 401)
  assert.ok(!disparou())
})
test('sem ROBO_PUSH_SECRET configurado, nenhum x-cron-secret entra: 403', async () => {
  fetchFalso()
  const antes = process.env.ROBO_PUSH_SECRET
  delete process.env.ROBO_PUSH_SECRET
  try {
    assert.equal((await chama({}, { 'x-cron-secret': 'segredo-do-robo' })).code, 403)
    assert.equal((await chama({}, { 'x-cron-secret': '' })).code, 401)   // cabeçalho vazio = sem segredo = caminho do login
  } finally { process.env.ROBO_PUSH_SECRET = antes }
  assert.ok(!disparou())
})
test('sem nada: 401 (caminho do login da coordenação continua igual)', async () => {
  fetchFalso()
  assert.equal((await chama({}, {})).code, 401)
  assert.ok(!disparou())
})
