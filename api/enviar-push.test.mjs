// Portão do tipo escalado_robo (e do segredo do robô) em api/enviar-push.js.
// Roda com: node --test api/enviar-push.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'

process.env.SUPABASE_URL = 'https://fake.supabase.test'
process.env.SUPABASE_ANON_KEY = 'anon'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'srk'
process.env.VAPID_PUBLIC_KEY = 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM'
process.env.VAPID_PRIVATE_KEY = 'UUxI4O8-FbRouAevSmBQ6o18hgE4nSG3qwvJTfKc-ls'
process.env.VAPID_SUBJECT = 'mailto:teste@example.com'
process.env.CRON_SECRET = 'segredo-de-teste'

// O pacote é "commonjs" e o handler é ESM (a Vercel entende; o Node não): importa uma cópia .mjs.
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
const aqui = fileURLToPath(new URL('.', import.meta.url))
const copia = aqui + '_enviar-push.copia.mjs'
fs.copyFileSync(aqui + 'enviar-push.js', copia)
let handler
try { ({ default: handler } = await import('./_enviar-push.copia.mjs')) } finally { fs.rmSync(copia, { force: true }) }

const UUID = '123e4567-e89b-42d3-a456-426614174000'
function res() {
  const r = { code: null, body: null }
  r.status = (c) => { r.code = c; return r }
  r.json = (b) => { r.body = b; return r }
  r.end = () => r
  return r
}
async function chama(body, headers = {}) {
  const r = res()
  await handler({ method: 'POST', body, headers }, r)
  return r
}
const fetchFalso = () => { globalThis.fetch = async (u) => ({ ok: true, json: async () => (String(u).includes('pastoral_modules') ? [{ id: 'mod' }] : []) }) }

test('escalado_robo sem segredo: 403', async () => {
  fetchFalso()
  assert.equal((await chama({ tipo: 'escalado_robo', membros: [UUID] })).code, 403)
})
test('escalado_robo com segredo errado: 403', async () => {
  fetchFalso()
  assert.equal((await chama({ tipo: 'escalado_robo', membros: [UUID] }, { 'x-cron-secret': 'errado' })).code, 403)
})
test('escalado_robo com segredo certo mas sem membros: 400', async () => {
  fetchFalso()
  assert.equal((await chama({ tipo: 'escalado_robo' }, { 'x-cron-secret': 'segredo-de-teste' })).code, 400)
  assert.equal((await chama({ tipo: 'escalado_robo', membros: [] }, { 'x-cron-secret': 'segredo-de-teste' })).code, 400)
})
test('escalado_robo com destinatário que não é uuid: 400', async () => {
  fetchFalso()
  assert.equal((await chama({ tipo: 'escalado_robo', membros: ['x; drop'] }, { 'x-cron-secret': 'segredo-de-teste' })).code, 400)
})
test('o segredo do robô não vale para o tipo escalado da tela: 403', async () => {
  fetchFalso()
  assert.equal((await chama({ tipo: 'escalado', membros: [UUID] }, { 'x-cron-secret': 'segredo-de-teste' })).code, 403)
})
test('escalado_robo com segredo certo e uuid válido passa pelos portões (não é 400/403)', async () => {
  globalThis.fetch = async (u) => ({ ok: true, json: async () => (String(u).includes('pastoral_modules') ? [{ id: 'mod' }] : []) })
  const r = await chama({ tipo: 'escalado_robo', membros: [UUID] }, { 'x-cron-secret': 'segredo-de-teste' })
  assert.ok(![400, 401, 403].includes(r.code), 'código ' + r.code + ' ' + JSON.stringify(r.body))
})
