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

  // A escala é montada à mão pela coordenação. Se ela ainda não foi feita (ou foi
  // pela metade), publicar a arte é pior que não publicar: sai um cartaz furado E
  // todo mundo é avisado dele. Antes o corte era "zero escalados", frouxo demais —
  // 2 pessoas em 5 missas passavam. Agora: se a MAIORIA das missas está vazia, a
  // escala não está pronta. Em vez de falhar calado, avisa a coordenação.
  const missasVazias = todas.filter((m) => m.itens.length === 0).length
  if (totalEscalados === 0 || missasVazias * 2 >= todas.length) {
    const detalhe = `${missasVazias} de ${todas.length} missas sem ninguém escalado`
    console.error(`Escala do fim de semana ainda não montada (${detalhe}) — nada a publicar.`)
    await avisarEscalaPendente(domingo, missasVazias, todas.length)
    process.exit(1)
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

  await avisarCoordenacao(domingo)
}

// Avisa a coordenação por push que a arte da semana ficou pronta.
// NUNCA derruba o job: se o aviso falhar, a arte já está publicada e é isso que importa.
async function avisarCoordenacao(domingo) {
  return enviarAviso({ tipo: 'arte', domingo })
}

// Avisa que a arte NÃO saiu porque a escala do fim de semana ainda não foi montada.
// É o aviso mais útil dos dois: transforma uma falha silenciosa em algo acionável.
async function avisarEscalaPendente(domingo, vazias, total) {
  return enviarAviso({ tipo: 'escala_pendente', domingo, vazias, total })
}

async function enviarAviso(corpo) {
  const site = (process.env.SITE_URL || '').replace(/\/+$/, '')
  const segredo = process.env.CRON_SECRET
  if (!site || !segredo) {
    console.log('Aviso por push não configurado (falta SITE_URL/CRON_SECRET) — pulando.')
    return
  }
  try {
    const r = await fetch(`${site}/api/enviar-push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-cron-secret': segredo },
      body: JSON.stringify(corpo),
    })
    const txt = await r.text()
    console.log(r.ok ? `Aviso enviado: ${txt}` : `Aviso falhou (${r.status}): ${txt}`)
  } catch (e) {
    console.log('Aviso falhou:', e.message)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
