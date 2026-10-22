// O robô fala com o site (Vercel) por duas rotas, com a MESMA chave só dele (ROBO_PUSH_SECRET):
// /api/enviar-push (tipo escalado_robo) e /api/regenerar-arte (a arte dos grupos depois do Confirmar).
import test from 'node:test'
import assert from 'node:assert/strict'
import { criarSite, urlIrma } from './site.mjs'

test('urlIrma troca só o último pedaço do caminho do PUSH_URL', () => {
  assert.equal(urlIrma('https://x.vercel.app/api/enviar-push', 'regenerar-arte'), 'https://x.vercel.app/api/regenerar-arte')
  assert.equal(urlIrma('https://x.vercel.app/api/enviar-push?v=1', 'regenerar-arte'), 'https://x.vercel.app/api/regenerar-arte')
})

function fetchFalso(status = 202) {
  const chamadas = []
  const f = async (url, o) => { chamadas.push({ url, ...o }); return { ok: status < 300, status } }
  f.chamadas = chamadas
  return f
}

test('regenerarArte: POST na rota irmã com o segredo do robô no x-cron-secret', async () => {
  const f = fetchFalso()
  const site = criarSite({ pushUrl: 'https://x.vercel.app/api/enviar-push', segredo: 's', fetch: f })
  await site.regenerarArte()
  assert.equal(f.chamadas.length, 1)
  assert.equal(f.chamadas[0].url, 'https://x.vercel.app/api/regenerar-arte')
  assert.equal(f.chamadas[0].method, 'POST')
  assert.equal(f.chamadas[0].headers['x-cron-secret'], 's')
  assert.equal(f.chamadas[0].headers.authorization, undefined)
})
test('regenerarArte: recusa do site vira erro (o confirm relata erroRegenerar)', async () => {
  const site = criarSite({ pushUrl: 'https://x/api/enviar-push', segredo: 's', fetch: fetchFalso(403) })
  await assert.rejects(site.regenerarArte(), /403/)
})
test('REGENERAR_ARTE_URL, se existir, ganha da derivada', async () => {
  const f = fetchFalso()
  await criarSite({ pushUrl: 'https://x/api/enviar-push', arteUrl: 'https://y/api/regenerar-arte', segredo: 's', fetch: f }).regenerarArte()
  assert.equal(f.chamadas[0].url, 'https://y/api/regenerar-arte')
})
test('enviarPushEscalado: tipo escalado_robo, só ids', async () => {
  const f = fetchFalso(200)
  const r = await criarSite({ pushUrl: 'https://x/api/enviar-push', segredo: 's', fetch: f }).enviarPushEscalado(['a'])
  assert.deepEqual(r, { ok: true })
  assert.deepEqual(JSON.parse(f.chamadas[0].body), { tipo: 'escalado_robo', membros: ['a'] })
})
test('sem PUSH_URL ou segredo: as duas lançam com o motivo', async () => {
  const site = criarSite({ pushUrl: '', segredo: '', fetch: fetchFalso() })
  await assert.rejects(site.enviarPushEscalado(['a']), /PUSH_URL/)
  await assert.rejects(site.regenerarArte(), /PUSH_URL/)
})
