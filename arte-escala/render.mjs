// arte-escala/render.mjs
// Injeta assets (base64) + dados no template, monta o HTML das missas em 2 colunas
// (+ espinha de rosário) e faz screenshot de #arte (2160×4800). Se o fim de semana
// inteiro não cabe no quadro, sai uma arte para o sábado e outra para o domingo.
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import puppeteer from 'puppeteer'
import { distribuirColunas } from './colunas.mjs'

const DIR = dirname(fileURLToPath(import.meta.url))
const b64 = async p => (await readFile(join(DIR, p))).toString('base64')

// cor litúrgica → estilo do pill (fundo/borda) + se o texto vai escuro
const COR = {
  verde:    { style: '--cor:var(--verde);--cor-esc:var(--verde-esc)',       claro: false },
  vermelho: { style: '--cor:var(--vermelho);--cor-esc:var(--vermelho-esc)', claro: false },
  branco:   { style: '--cor:var(--branco);--cor-esc:var(--branco-esc)',     claro: true  },
  rosa:     { style: '--cor:var(--rosa);--cor-esc:var(--rosa-esc)',         claro: true  },
  roxo:     { style: '--cor:var(--roxo);--cor-esc:var(--roxo-esc)',         claro: false },
}

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const CRUZ = `<div class="cruz"><svg width="72" height="126" viewBox="0 0 72 126">
  <g fill="#2B1C0E"><rect x="31" y="0" width="10" height="126" rx="3"/>
  <rect x="6" y="30" width="60" height="10" rx="3"/></g></svg></div>`

function pillHTML(m, cor) {
  const c = COR[cor] || COR.verde
  return `<div class="pill-wrap">
    <div class="pill-topo">${esc(m.comunidadeLabel)}</div>
    <div class="pill ${c.claro ? 'claro' : ''}" style="${c.style}">
      <span class="dia">${esc(m.dia)}</span>
      <span class="hora">
        <span class="hnum"><b>${esc(m.horaHH)}</b><b>${esc(m.horaMM)}</b></span>
        <span class="hbig">H</span>
      </span>
    </div>
  </div>`
}

function listaHTML(m) {
  if (!m.itens.length) return `<ul class="lista"><li class="vazia">(escala não montada)</li></ul>`
  const lis = m.itens.map(i =>
    `<li><span class="bead"></span><span class="nm">${esc(i.nome)} <span class="fn">- ${esc(i.funcao)}</span></span></li>`
  ).join('')
  return `<ul class="lista">${lis}</ul>`
}

function missaHTML(m, cor, lado) {
  if (!m) return `<div class="missa ${lado}"></div>`
  return `<div class="missa ${lado}">${pillHTML(m, cor)}${listaHTML(m)}</div>`
}

// as missas do dia em 2 colunas (ver colunas.mjs) com a espinha de rosário no meio
function linhasHTML(missas, cor) {
  const c = distribuirColunas(missas)
  const col = lado => `<div class="col ${lado}">${c[lado].map(m => missaHTML(m, cor, lado)).join('')}</div>`
  return `<div class="linha">
      ${col('esq')}
      <div class="espinha"><div class="rosario"></div>${CRUZ}</div>
      ${col('dir')}
    </div>`
}

const ALTURA = 4800

// O template tem as duas seções marcadas; `dias` diz quais ficam.
function soDias(html, dias) {
  for (const d of ['SABADO', 'DOMINGO']) {
    if (dias.includes(d.toLowerCase())) continue
    html = html.replace(new RegExp(`<!--SECAO_${d}-->[\\s\\S]*?<!--/SECAO_${d}-->`), '')
  }
  return html
}

// Devolve [{ parte, png }]: parte 'unica' quando o fim de semana cabe numa arte só;
// senão 'sabado' e 'domingo'. Encolher a letra para caber foi descartado pelo dono
// (28/09/2026): "somente quando precisar, duas artes".
export async function renderArtes(dados) {
  let html = await readFile(join(DIR, 'template.html'), 'utf8')
  const subs = {
    __SORA__: await b64('assets/sora.woff2'),
    __INTER__: await b64('assets/inter.woff2'),
    __BRASAO__: await b64('assets/brasao.png'),
    __BANDEIRA__: await b64(`assets/bandeira-${dados.cor}.png`),
    __TEMPO__: esc(dados.tempo),
    __MES_ANO__: esc(dados.mesAno),
    __DESCRICAO__: esc(dados.descricao),
    __SABADO_LABEL__: esc(dados.sabadoLabel),
    __DOMINGO_LABEL__: esc(dados.domingoLabel),
  }
  for (const [k, v] of Object.entries(subs)) html = html.replaceAll(k, v)
  html = html
    .replace('<!--MISSAS_SABADO-->', linhasHTML(dados.missasSabado, dados.cor))
    .replace('<!--MISSAS_DOMINGO-->', linhasHTML(dados.missasDomingo, dados.cor))

  const browser = await puppeteer.launch({ args: ['--no-sandbox'] })
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 2160, height: ALTURA, deviceScaleFactor: 1 })

    // abre, mede a altura que o conteúdo PEDE e fotografa se couber. A medida é com
    // `height:auto` e sem `overflow:hidden` — com o recorte ligado, o scrollHeight
    // mente que cabe.
    const tentar = async (h, forcar) => {
      await page.setContent(h, { waitUntil: 'networkidle0' })
      await page.evaluateHandle('document.fonts.ready')
      const precisa = await page.evaluate(() => {
        const a = document.querySelector('#arte')
        a.style.height = 'auto'; a.style.overflow = 'visible'
        const alt = a.getBoundingClientRect().height
        a.style.height = ''; a.style.overflow = ''
        return alt
      })
      if (precisa > ALTURA && !forcar) return null
      if (precisa > ALTURA) console.warn(`Arte pede ${Math.ceil(precisa)} px mesmo sozinha — vai cortar.`)
      return await (await page.$('#arte')).screenshot({ type: 'png' })
    }

    const unica = await tentar(html, false)
    if (unica) return [{ parte: 'unica', png: unica }]
    console.log('O fim de semana não cabe numa arte — saem duas (sábado e domingo).')
    return [
      { parte: 'sabado', png: await tentar(soDias(html, ['sabado']), true) },
      { parte: 'domingo', png: await tentar(soDias(html, ['domingo']), true) },
    ]
  } finally {
    await browser.close()
  }
}
