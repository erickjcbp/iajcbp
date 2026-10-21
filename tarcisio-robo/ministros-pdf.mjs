// Escala dos ministros (MECE) mandada como PDF para o número do São Tarcísio.
// Só o dono (tarcisio_config.numero_conferencia) e os números de tarcisio_config.remetentes_pdf
// podem mandar; qualquer outro é ignorado sem resposta. O robô baixa o arquivo pela Evolution,
// tira o texto (pdfjs-dist), lê e casa os nomes com o MESMO núcleo da tela
// (projetos/acolitos/escala-ministros-core.js, injetado), grava o mês e pergunta as dúvidas,
// uma por vez, com botões Sim / Não. Cada resposta vira memória (acolitos_ministro_apelidos).
// Projeto: docs/superpowers/specs/2026-10-20-escala-automatica-design.md (seção 7)
import { agoraSP, nomeLimpo, normalizarNumero } from './regras.mjs'

export const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
export const FERRAMENTA = 'escala_ministros_pdf'
const LIMITE_BYTES = 10 * 1024 * 1024
const CAMPOS_MEMBRO = 'id,nome,tem_pai_ministro,nome_pai_ministro,tem_mae_ministro,nome_mae_ministro'

const exigir = ({ data, error }, onde) => {
  if (error) throw new Error(`${onde}: ${error.message}`)
  return data
}

// ── texto do PDF ──────────────────────────────────────────────────────────────────────────
// O PDF do Drive é uma tabela: os dias na coluna da esquerda e, à direita, uma linha por horário.
// A ordem crua do pdf.js sai embaralhada (31/out antes de 17/out), então o texto é montado pela
// POSIÇÃO, no formato que o núcleo espera (fixture escala-ministros-outubro.txt): primeiro os
// títulos de cima para baixo; depois um bloco por linha, com as linhas de horário de cada bloco
// juntas (o vão maior entre linhas separa um bloco do outro). "SANTO ANTÔNIO" fica na mesma altura
// da linha das 18:30, mas é marcador de título, não nome.
const RE_HORA = /^\d{1,2}:\d{2}h$/i
const RE_MARCADOR = /^SANTO ANT[ÔO]NIO$/i

// paginas: [[{ str, x, y }]] (y cresce para cima, como no PDF)
export function montarTextoDosItens(paginas) {
  const titulos = []
  const blocos = []
  for (const itens of paginas || []) {
    const vivos = (itens || []).map((i) => ({ s: String(i.str || '').trim(), x: +i.x || 0, y: +i.y || 0 })).filter((i) => i.s)
      .sort((a, b) => b.y - a.y || a.x - b.x)
    const linhas = []
    for (const it of vivos) {
      const ult = linhas.at(-1)
      if (ult && Math.abs(ult.y - it.y) <= 3) ult.itens.push(it)
      else linhas.push({ y: it.y, itens: [it] })
    }
    const horas = []
    for (const l of linhas) {
      l.itens.sort((a, b) => a.x - b.x)
      const hora = l.itens.find((i) => RE_HORA.test(i.s))
      if (!hora) { titulos.push(l.itens.map((i) => i.s).join(' ')); continue }
      const fora = l.itens.filter((i) => i.x < hora.x - 1 || RE_MARCADOR.test(i.s))
      if (fora.length) titulos.push(fora.map((i) => i.s).join(' '))
      horas.push({ y: l.y, t: l.itens.filter((i) => !fora.includes(i)).map((i) => i.s).join(' ') })
    }
    const vaos = horas.slice(1).map((h, i) => horas[i].y - h.y).sort((a, b) => a - b)
    const vaoComum = vaos.length ? vaos[Math.floor(vaos.length / 2)] : 0
    let atual = null
    horas.forEach((h, i) => {
      if (!atual || (vaoComum && horas[i - 1].y - h.y > vaoComum * 1.5)) { atual = []; blocos.push(atual) }
      atual.push(h.t)
    })
  }
  return [...titulos, '', ...blocos.map((b) => b.join(' '))].join('\n')
}

// Extração real (pdfjs-dist, build legacy para Node). Carregada só na hora de usar.
export async function extrairTextoPdf(buffer, carregar = () => import('pdfjs-dist/legacy/build/pdf.mjs')) {
  const pdfjs = await carregar()
  const tarefa = pdfjs.getDocument({ data: new Uint8Array(buffer), isEvalSupported: false, disableFontFace: true, useSystemFonts: false, verbosity: 0 })
  try {
    const doc = await tarefa.promise
    const paginas = []
    for (let p = 1; p <= doc.numPages; p++) {
      const c = await (await doc.getPage(p)).getTextContent()
      paginas.push(c.items.map((i) => ({ str: i.str, x: i.transform?.[4], y: i.transform?.[5] })))
    }
    return montarTextoDosItens(paginas)
  } finally { await tarefa.destroy() }
}

// O ano vem do texto ("Outubro 2026"); sem ele, o ano de agora.
export function anoDoTexto(texto, agora = new Date()) {
  const m = /\b(20\d{2})\b/.exec(String(texto || ''))
  return m ? +m[1] : +agoraSP(agora).data.slice(0, 4)
}
// O mês do PDF é o que mais aparece nas datas lidas (o "1/nov" do fim de outubro não muda o mês).
export function mesDosLidos(lidos) {
  const conta = new Map()
  for (const l of lidos) conta.set(l.data.slice(0, 7), (conta.get(l.data.slice(0, 7)) || 0) + 1)
  return [...conta].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null
}
const nomeDoMes = (mes) => MESES[+mes.slice(5, 7) - 1]

export const numeroLimpo = (n) => normalizarNumero(n) || String(n || '').replace(/\D/g, '')
export function remetentesAutorizados(cfg) {
  return new Set([cfg?.numero_conferencia, ...(Array.isArray(cfg?.remetentes_pdf) ? cfg.remetentes_pdf : [])]
    .map(numeroLimpo).filter(Boolean))
}
export const ehPdf = (doc) => !!doc && (String(doc.mimetype || '').toLowerCase() === 'application/pdf' || /\.pdf$/i.test(String(doc.nome || '')))

// Resposta "sim" / "não" por texto (o aparelho não mostrou os botões).
export function simOuNao(texto) {
  const t = nomeLimpo(texto).replace(/[.!,]+.*$/, '').trim()
  if (['sim', 's'].includes(t)) return 'sim'
  if (['nao', 'n'].includes(t)) return 'nao'
  return null
}

// deps: db (chave de serviço), evo, nucleo() → { lerEscalaMinistros, casarNomes },
// extrairTexto(buffer) → texto, relogio, log.
export function criarMinistrosPdf({ db, evo, nucleo, extrairTexto = extrairTextoPdf, relogio = () => new Date(), log = console }) {
  const lerCfg = async () => exigir(await db.from('tarcisio_config').select('*').eq('id', 1).single(), 'ler config')
  const autorizado = (cfg, numero) => remetentesAutorizados(cfg).has(numeroLimpo(numero))

  const lerMembros = async () => exigir(await db.from('acolitos_membros').select(CAMPOS_MEMBRO).eq('status', 'ativo').eq('serve', true), 'ler membros')
  const lerApelidos = async () => exigir(await db.from('acolitos_ministro_apelidos').select('nome_pdf,membro_id,pai_ou_mae,resposta'), 'ler apelidos')

  // Uma linha por (data, horário, comunidade, membro): é a chave única da tabela.
  function linhasParaGravar(casados, mes, arquivo) {
    const visto = new Set()
    const linhas = []
    for (const c of casados) {
      const chave = [c.data, c.horario, c.comunidade, c.membro_id].join('|')
      if (visto.has(chave)) continue
      visto.add(chave)
      linhas.push({ mes, data: c.data, horario: c.horario, comunidade: c.comunidade, membro_id: c.membro_id, pai_ou_mae: c.pai_ou_mae, arquivo })
    }
    return linhas
  }
  // Grava as novas e só depois tira as velhas: se gravar falhar, o mês anterior continua inteiro.
  async function substituir(linhas, velhas) {
    const novas = linhas.length ? exigir(await db.from('acolitos_escala_ministros')
      .upsert(linhas, { onConflict: 'data,horario,comunidade,membro_id' }).select('id'), 'gravar escala dos ministros').map((r) => r.id) : []
    const sair = velhas.filter((id) => !novas.includes(id))
    if (sair.length) exigir(await db.from('acolitos_escala_ministros').delete().in('id', sair), 'limpar escala dos ministros')
  }
  const contarMes = async (mes) => exigir(await db.from('acolitos_escala_ministros').select('id').eq('mes', mes), 'contar escala dos ministros').length

  function textoDaPergunta(p, membros) {
    const m = membros.find((x) => x.id === p.membro_id)
    const pai = m ? (p.pai_ou_mae === 'pai' ? m.nome_pai_ministro : m.nome_mae_ministro) : null
    const papel = p.pai_ou_mae === 'pai' ? 'pai' : 'mãe'
    return `'${p.nome}' é ${pai || `o(a) ${papel}`}, ${papel} de ${m?.nome || 'um acólito'}?`
  }
  // Uma pergunta por vez. Botão recusado: vai como texto ("sim" / "não" também valem).
  async function perguntar(numero, lote, k, p, membros) {
    const texto = textoDaPergunta(p, membros)
    try {
      await evo.enviarBotoes(numero, texto, [{ id: `apelido:sim:${lote}.${k}`, texto: 'Sim' }, { id: `apelido:nao:${lote}.${k}`, texto: 'Não, outra pessoa' }],
        'Escala dos ministros', 'Responda sim ou não')
    } catch (e) {
      log.warn(`pergunta do apelido: botões falharam (${e.message}); indo como texto`)
      await evo.enviarTexto(numero, `${texto}\n\nResponda SIM ou NÃO.`)
    }
  }
  // Pendente = sem memória para este par e o nome ainda sem nenhum "sim".
  function proximaPendente(perguntas, apelidos) {
    return perguntas.findIndex((p) => {
      const chave = nomeLimpo(p.nome)
      const doNome = apelidos.filter((a) => nomeLimpo(a.nome_pdf) === chave)
      if (doNome.some((a) => a.resposta === 'sim')) return false
      return !doNome.some((a) => a.membro_id === p.membro_id && a.pai_ou_mae === p.pai_ou_mae)
    })
  }
  async function ultimaLeitura(filtro) {
    let q = db.from('tarcisio_mensagens').select('id,numero,ferramentas,created_at').eq('direcao', 'saida')
    if (filtro.numero) q = q.eq('numero', filtro.numero)
    q = q.contains('ferramentas', [{ ferramenta: FERRAMENTA, ...(filtro.mes ? { mes: filtro.mes } : {}) }])
    const r = exigir(await q.order('created_at', { ascending: false }).limit(1), 'ler última escala dos ministros')
    return r[0] || null
  }

  async function receberPdfMinistros({ numero, documento, external_id, cfg = null }) {
    cfg ??= await lerCfg()
    if (!autorizado(cfg, numero) || !ehPdf(documento)) return false
    const num = numeroLimpo(numero)
    const arquivo = documento.nome || null
    let texto = ''
    try {
      const arq = await evo.baixarMidia(external_id)
      const buf = Buffer.from(arq.base64, 'base64')
      if (!buf.length || buf.length > LIMITE_BYTES) throw new Error(`arquivo com ${buf.length} bytes`)
      texto = await extrairTexto(buf)
    } catch (e) { log.warn(`PDF dos ministros: ${e.message}`) }
    const { lerEscalaMinistros, casarNomes } = nucleo()
    const ano = anoDoTexto(texto, relogio())
    const lidos = texto ? lerEscalaMinistros(texto, ano) : []
    if (!lidos.length) {
      await evo.enviarTexto(num, `Não consegui ler a escala dos ministros${arquivo ? ` em "${arquivo}"` : ' neste arquivo'}. Nada foi gravado. `
        + 'Confira se é o PDF do mês (com texto, não foto) ou suba pela tela do app.')
      return true
    }
    const mes = mesDosLidos(lidos) + '-01'
    const [membros, apelidos] = await Promise.all([lerMembros(), lerApelidos()])
    const r = casarNomes(lidos, membros, apelidos)
    const linhas = linhasParaGravar(r.casados, mes, arquivo)
    const velhas = exigir(await db.from('acolitos_escala_ministros').select('id').eq('mes', mes), 'ler escala dos ministros do mês').map((x) => x.id)
    await substituir(linhas, velhas)

    const perguntas = r.duvidas.flatMap((d) => d.opcoes.map((o) => ({ nome: d.nome, membro_id: o.membro_id, pai_ou_mae: o.pai_ou_mae })))
    const resumo = `Li a escala dos ministros de ${nomeDoMes(mes)}: ${linhas.length} casos, ${r.duvidas.length} com dúvida.`
      + (perguntas.length ? ' Vou perguntar as dúvidas, uma por vez.' : ' Já vale para o gerador.')
    await evo.enviarTexto(num, resumo)
    const [linha] = exigir(await db.from('tarcisio_mensagens').insert({
      numero: num, direcao: 'saida', texto: resumo, respondida: true,
      ferramentas: [{ ferramenta: FERRAMENTA, mes, ano, arquivo, lidos, perguntas }],
    }).select('id'), 'gravar leitura dos ministros')
    if (perguntas.length) await perguntar(num, linha.id, 0, perguntas[0], membros)
    log.info(`escala dos ministros ${mes}: ${linhas.length} caso(s), ${r.duvidas.length} dúvida(s)`)
    return true
  }

  // botao = 'apelido:sim:<lote>.<k>' ou 'apelido:nao:<lote>.<k>' (lote = id da mensagem do resumo)
  async function responderApelido({ numero, botao, cfg = null }) {
    const m = /^apelido:(sim|nao):([^.]+)\.(\d+)$/.exec(String(botao || ''))
    if (!m) return false
    cfg ??= await lerCfg()
    if (!autorizado(cfg, numero)) return false
    const num = numeroLimpo(numero)
    const [, resposta, lote, k] = m
    const linha = exigir(await db.from('tarcisio_mensagens').select('id,ferramentas').eq('id', lote).maybeSingle(), 'ler pergunta')
    const info = (Array.isArray(linha?.ferramentas) ? linha.ferramentas : []).find((f) => f?.ferramenta === FERRAMENTA)
    const p = info?.perguntas?.[+k]
    if (!p) return true   // pergunta que não existe mais: nada a fazer
    const nomePdf = nomeLimpo(p.nome)
    const ja = exigir(await db.from('acolitos_ministro_apelidos').select('resposta').eq('nome_pdf', nomePdf)
      .eq('membro_id', p.membro_id).eq('pai_ou_mae', p.pai_ou_mae).maybeSingle(), 'ler apelido')
    const membros = await lerMembros()
    const papel = `${p.pai_ou_mae === 'pai' ? 'pai' : 'mãe'} de ${membros.find((x) => x.id === p.membro_id)?.nome || 'um acólito'}`
    if (ja?.resposta === resposta) {
      await evo.enviarTexto(num, `Já estava anotado: '${p.nome}' ${resposta === 'sim' ? 'é' : 'não é'} ${papel}.`)
      return true
    }
    exigir(await db.from('acolitos_ministro_apelidos').upsert({ nome_pdf: nomePdf, membro_id: p.membro_id, pai_ou_mae: p.pai_ou_mae,
      resposta, respondido_por: num, em: relogio().toISOString() }, { onConflict: 'nome_pdf,membro_id,pai_ou_mae' }), 'gravar apelido')
    const apelidos = await lerApelidos()

    // Refaz o casamento SÓ deste nome, e só se este PDF ainda é o último do mês.
    const ultima = await ultimaLeitura({ mes: info.mes })
    let aviso = ''
    if (ultima && ultima.id !== lote) {
      aviso = ' (Outro PDF deste mês já chegou depois: a resposta fica guardada e vale na próxima leitura.)'
    } else {
      const { casarNomes } = nucleo()
      const doNome = (info.lidos || []).map((l) => ({ ...l, nomes: (l.nomes || []).filter((n) => nomeLimpo(n) === nomePdf) }))
        .filter((l) => l.nomes.length)
      const r = casarNomes(doNome, membros, apelidos)
      const missas = new Set(doNome.map((l) => [l.data, l.horario, l.comunidade].join('|')))
      const pares = new Set(info.perguntas.filter((q) => nomeLimpo(q.nome) === nomePdf).map((q) => q.membro_id + '|' + q.pai_ou_mae))
      const atuais = exigir(await db.from('acolitos_escala_ministros').select('id,data,horario,comunidade,membro_id,pai_ou_mae')
        .eq('mes', info.mes).in('membro_id', [...new Set([...pares].map((x) => x.split('|')[0]))]), 'ler escala dos ministros do nome')
      const velhas = atuais.filter((a) => missas.has([a.data, a.horario, a.comunidade].join('|')) && pares.has(a.membro_id + '|' + a.pai_ou_mae)).map((a) => a.id)
      await substituir(linhasParaGravar(r.casados, info.mes, info.arquivo ?? null), velhas)
    }

    const proxima = proximaPendente(info.perguntas, apelidos)
    const anotado = `Anotado: '${p.nome}' ${resposta === 'sim' ? 'é' : 'não é'} ${papel}.${aviso}`
    if (proxima >= 0 && !aviso) {
      await evo.enviarTexto(num, anotado)
      await perguntar(num, lote, proxima, info.perguntas[proxima], membros)
    } else {
      await evo.enviarTexto(num, aviso ? anotado
        : `${anotado} Pronto: ${await contarMes(info.mes)} casos de ${nomeDoMes(info.mes)} valem para o gerador.`)
    }
    return true
  }

  // "sim" / "não" escrito: responde a pergunta pendente da última leitura deste número.
  async function responderPorTexto({ numero, texto, cfg = null }) {
    const resposta = simOuNao(texto)
    if (!resposta) return false
    cfg ??= await lerCfg()
    if (!autorizado(cfg, numero)) return false
    const ultima = await ultimaLeitura({ numero: numeroLimpo(numero) })
    const info = (ultima?.ferramentas || []).find((f) => f?.ferramenta === FERRAMENTA)
    if (!info?.perguntas?.length) return false
    const k = proximaPendente(info.perguntas, await lerApelidos())
    if (k < 0) return false
    return responderApelido({ numero, botao: `apelido:${resposta}:${ultima.id}.${k}`, cfg })
  }

  return { receberPdfMinistros, responderApelido, responderPorTexto, autorizado, lerCfg }
}
