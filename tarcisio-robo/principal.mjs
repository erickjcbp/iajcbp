// Ponto de entrada do container: liga banco + Evolution e roda o robô a cada 5 s, sem sobrepor rodadas.
import { createClient } from '@supabase/supabase-js'
import { criarEvolution } from './evolution.mjs'
import { criarRobo } from './robo.mjs'

const precisa = (nome) => {
  const v = process.env[nome]
  if (!v) { console.error(`falta a variável ${nome}`); process.exit(1) }
  return v
}

const db = createClient(precisa('SUPABASE_URL'), precisa('SUPABASE_SERVICE_KEY'), { auth: { persistSession: false } })
const evo = criarEvolution({ url: precisa('EVOLUTION_URL'), chave: precisa('EVOLUTION_API_KEY'), instancia: process.env.EVOLUTION_INSTANCIA || 'SaoTarcisio' })
const robo = criarRobo({ db, evo })

await robo.iniciar()
console.info('São Tarcísio no ar')
for (;;) {
  await robo.rodada()
  await new Promise((r) => setTimeout(r, 5_000))
}
