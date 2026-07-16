// arte-escala/gerar.mjs
// Orquestra: fim de semana alvo → override → dados (Supabase) → render → Storage + tabela.
// Roda no GitHub Actions (cron dom 21h BRT) e sob demanda (workflow_dispatch / api).
import { createClient } from '@supabase/supabase-js'
import { alvoFimDeSemana } from './fim-de-semana.mjs'
import { carregarDados } from './dados.mjs'
import { renderPNG } from './render.mjs'

const URL = process.env.SUPABASE_URL
// aceita os dois nomes (o .env do repo usa SUPABASE_SERVICE_KEY; o CI usa SUPABASE_SERVICE_ROLE_KEY)
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
if (!URL || !KEY) {
  console.error('Faltam SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (ou SUPABASE_SERVICE_KEY).')
  process.exit(1)
}

const sb = createClient(URL, KEY, { auth: { persistSession: false } })

async function main() {
  const { sabado, domingo } = alvoFimDeSemana(new Date())
  console.log('Fim de semana alvo:', sabado, domingo)

  const { data: ov } = await sb.from('acolitos_liturgia_override')
    .select('*').eq('domingo_data', domingo).maybeSingle()
  if (ov) console.log('Override litúrgico manual encontrado para', domingo)

  const dados = await carregarDados(sb, { sabado, domingo }, ov || null)
  const todas = [...dados.missasSabado, ...dados.missasDomingo]
  const totalEscalados = todas.reduce((n, m) => n + m.itens.length, 0)

  if (!todas.length) {
    console.error('Sem celebrações para o fim de semana — nada a gerar.'); process.exit(1)
  }
  if (totalEscalados === 0) {
    // Celebrações existem, mas a escala ainda não foi montada → não publica arte vazia.
    console.error('Escala ainda não gerada para o fim de semana — nada a publicar.'); process.exit(1)
  }
  console.log(`Missas: ${todas.length} | escalados: ${totalEscalados} | ${dados.tempo} / ${dados.cor}`)

  const png = await renderPNG(dados)
  console.log('PNG gerado:', png.length, 'bytes')

  const path = `${domingo}.png`
  const up = await sb.storage.from('artes-escala').upload(path, png, {
    contentType: 'image/png', upsert: true,
  })
  if (up.error) throw up.error
  const { data: pub } = sb.storage.from('artes-escala').getPublicUrl(path)

  const gerado_por = process.env.GERADO_POR || 'cron'
  const { error: te } = await sb.from('acolitos_escala_artes').upsert({
    domingo_data: domingo, png_url: pub.publicUrl,
    tempo: dados.tempo, descricao: dados.descricao, cor: dados.cor,
    gerado_em: new Date().toISOString(), gerado_por,
  })
  if (te) throw te
  console.log('Arte publicada:', pub.publicUrl)
}

main().catch(e => { console.error(e); process.exit(1) })
