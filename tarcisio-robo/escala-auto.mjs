// Escala automática de terça (São Tarcísio | JCBP). Terça, a partir das 18:01 de Brasília, gera a
// escala do fim de semana seguinte com o MESMO gerador da tela (gerador-escala-core.js, injetado
// como `gerarSemana`), grava como rascunho e manda para o dono conferir (Confirmar / Revisar).
// Gerar é rascunho: ninguém é avisado aqui (regra de 18/08/2026). Quem avisa é a confirmação.
// Projeto: docs/superpowers/specs/2026-10-20-escala-automatica-design.md
//
// "Uma vez por semana" mora no banco: a 1ª coisa é gravar a linha da semana em
// tarcisio_escala_auto com estado 'gerando'. Se a linha já existe (outra rodada, robô reiniciado),
// nada é gerado de novo. A linha é a trava.
import { agoraSP, somarDias, diaPorExtenso, rotuloMissa, semanaConfirmada, FUNCOES, JANELA_RECUPERACAO_MIN } from './regras.mjs'

export const HORA_GERAR = '18:01'
export const HORA_AVISO_PERDIDA = '09:00'   // quarta: aviso de que a terça não rodou
// Lembretes ao dono enquanto ele não responde: terça 20:00 e quarta 09:00 (dia relativo ao sábado).
export const LEMBRETES = [{ dia: -4, hm: '20:00' }, { dia: -3, hm: '09:00' }]
// A semana vai no id: um toque numa mensagem velha não mexe na semana que está esperando.
export const botoesDaSemana = (sabado) => [{ id: `escala:confirmar:${sabado}`, texto: 'Confirmar' }, { id: `escala:revisar:${sabado}`, texto: 'Revisar' }]
const PRESA_MIN = 15   // linha em 'gerando' há mais que isso = o robô caiu no meio

const MINUTO = 60_000
const exigir = ({ data, error }, onde) => {
  if (error) throw new Error(`${onde}: ${error.message}`)
  return data
}
const minutos = (hm) => { const [h, m] = String(hm).split(':').map(Number); return h * 60 + m }
const diaDaSemana = (data) => new Date(data + 'T12:00:00Z').getUTCDay()
const ddmm = (data) => `${data.slice(8, 10)}/${data.slice(5, 7)}`
const fimDeSemana = (sabado) => `${ddmm(sabado)} e ${ddmm(somarDias(sabado, 1))}`
const rotuloFuncao = (f) => FUNCOES[f] || f
const ORDEM_FUNCAO = Object.keys(FUNCOES)
const ordemFuncao = (f) => { const i = ORDEM_FUNCAO.indexOf(f); return i < 0 ? 99 : i }

// Terça a partir das 18:01 (Brasília) → o sábado que vem. Fora disso, null.
export function semanaParaGerar(sp) {
  if (diaDaSemana(sp.data) !== 2 || sp.hm < HORA_GERAR) return null
  return somarDias(sp.data, 4)
}

// Qual lembrete (1 ou 2) vale agora para a semana; 30 min de folga se o robô estava parado.
export function lembreteDaVez(sabado, sp) {
  for (let k = LEMBRETES.length; k >= 1; k--) {
    const l = LEMBRETES[k - 1]
    const passou = minutos(sp.hm) - minutos(l.hm)
    if (sp.data === somarDias(sabado, l.dia) && passou >= 0 && passou < JANELA_RECUPERACAO_MIN) return k
  }
  return 0
}

// Texto da conferência. `semana` = { sabado, celebracoes, membros, escalasExistentes }; `resultado`
// = saída do gerador. Campos opcionais (vazias, alemDoMinimo, semVagaFilhoDeMinistro/filhosSemVaga,
// semMinistros, semanalPendentes) podem faltar.
export function montarMensagemConferencia(semana, resultado = {}) {
  const membros = new Map((semana.membros || []).map((m) => [m.id, m]))
  const nome = (id) => { const m = membros.get(id); return m ? (m.apelido || m.nome) : (id || 'alguém') }
  const cels = (semana.celebracoes || []).slice()
    .sort((a, b) => a.data.localeCompare(b.data) || (a.minutos ?? 0) - (b.minutos ?? 0))
  const celPorId = new Map(cels.map((c) => [c.id, c]))
  const existentes = semana.escalasExistentes || {}
  const novas = resultado.novas || []
  const partes = [`Escala do fim de semana ${fimDeSemana(semana.sabado)} (rascunho: ninguém foi avisado ainda).`]

  for (const c of cels) {
    const linhas = [
      ...(existentes[c.id] || []).map((e) => ({ funcao: e.funcao, id: e.status === 'substituido' && e.substituto_id ? e.substituto_id : e.membro_id })),
      ...novas.filter((n) => n.celebracao_id === c.id).map((n) => ({ funcao: n.funcao, id: n.membro_id })),
    ].sort((a, b) => ordemFuncao(a.funcao) - ordemFuncao(b.funcao))
    partes.push([`*${diaPorExtenso(c.data)} · ${rotuloMissa(c)}*`,
      ...(linhas.length ? linhas.map((l) => `${rotuloFuncao(l.funcao)} — ${nome(l.id)}`) : ['(ninguém escalado)'])].join('\n'))
  }

  const vazias = resultado.vazias || []
  if (vazias.length) {
    const porMissa = new Map()
    for (const v of vazias) (porMissa.get(v.celebracao_id) || porMissa.set(v.celebracao_id, []).get(v.celebracao_id)).push(rotuloFuncao(v.funcao))
    partes.push(['Vagas vazias:', ...[...porMissa].map(([cid, fs]) => {
      const c = celPorId.get(cid)
      return `• ${c ? `${diaPorExtenso(c.data)} · ${rotuloMissa(c)}` : 'missa'}: ${fs.join(', ')}`
    })].join('\n'))
  }
  const alem = resultado.alemDoMinimo || []
  if (alem.length) partes.push(['Passou de 2×:', ...alem.map((a) => `• ${nome(a.membro_id)} ${a.vezes}×`)].join('\n'))
  const filhos = resultado.semVagaFilhoDeMinistro || resultado.filhosSemVaga || []
  if (filhos.length) {
    partes.push(['Filho de ministro sem vaga:', ...filhos.map((f) => (typeof f === 'string'
      ? `• ${nome(f)}` : `• ${nome(f.membro_id)}${f.motivo ? ` (${f.motivo})` : ''}`))].join('\n'))
  }
  if (resultado.semMinistros) partes.push('Escala dos ministros não enviada: mande o PDF do mês para este número ou suba no app.')
  const semanal = resultado.semanalPendentes || []
  if (semanal.length) partes.push(['Plano semanal sem vaga:', ...semanal.map((s) => `• ${nome(s)}`)].join('\n'))

  partes.push('Responda "1" para Confirmar ou "2" para Revisar (ou toque no botão).')
  return partes.join('\n\n')
}

// deps: db (chave de serviço), evo, gerarSemana(entrada), carregarEntrada(db, sabado), rnd, log.
// `push` fica reservado para a confirmação (Task 9): gerar não avisa ninguém.
export function criarEscalaAuto({ db, evo, push = null, gerarSemana, carregarEntrada, montarMensagem = montarMensagemConferencia, rnd = Math.random, log = console }) {
  void push
  const numeroDono = (cfg) => String(cfg.numero_conferencia || '').replace(/\D/g, '')

  async function avisarDono(cfg, texto) {
    const numero = numeroDono(cfg)
    if (!numero) { log.warn('escala automática: sem número de conferência; aviso não enviado'); return }
    try { await evo.enviarTexto(numero, texto) } catch (e) { log.warn(`escala automática: avisar o dono falhou: ${e.message}`) }
  }

  // Botões; se a Evolution recusar, o mesmo texto vai sem botão (ele já diz "1"/"2").
  async function enviarConferencia(cfg, texto, sabado) {
    const numero = numeroDono(cfg)
    if (!numero) throw new Error('sem número de conferência na configuração')
    try {
      const r = await evo.enviarBotoes(numero, texto, botoesDaSemana(sabado))
      return r?.key?.id ?? null
    } catch (e) {
      log.warn(`escala automática: botões falharam (${e.message}); indo como texto`)
      const r = await evo.enviarTexto(numero, texto)
      return r?.key?.id ?? null
    }
  }

  async function marcar(sabado, campos) {
    exigir(await db.from('tarcisio_escala_auto').update(campos).eq('semana', sabado), 'gravar estado da semana')
  }

  // Confirmada = alguém já foi avisado nesta semana, ou a arte do domingo já foi pedida.
  async function avisadosNaSemana(sabado) {
    const avisados = exigir(await db.from('acolitos_config').select('valor').eq('chave', 'escala_avisados').maybeSingle(), 'ler avisados')
    return semanaConfirmada(sabado, avisados?.valor)
  }
  async function artePedida(sabado) {
    return !!exigir(await db.from('tarcisio_envios').select('id').eq('chave_unica', `escala:${somarDias(sabado, 1)}`).maybeSingle(), 'ler arte pedida')
  }
  async function jaConfirmada(sabado) {
    return (await avisadosNaSemana(sabado)) || (await artePedida(sabado))
  }

  async function gerar(sabado, agora, cfg) {
    const trava = exigir(await db.from('tarcisio_escala_auto')
      .upsert({ semana: sabado, estado: 'gerando', gerada_em: agora.toISOString() }, { onConflict: 'semana', ignoreDuplicates: true })
      .select('semana'), 'travar semana')
    if (!trava.length) return
    const fds = fimDeSemana(sabado)
    let gravados = []          // ids que ESTA rodada inseriu: na falha, saem todos
    let enviouConferencia = false
    try {
      if (await jaConfirmada(sabado)) {
        await marcar(sabado, { estado: 'ja_confirmada' })
        await avisarDono(cfg, `A escala do fim de semana ${fds} já está confirmada. Não gerei nada.`)
        return
      }
      const entrada = await carregarEntrada(db, sabado)
      if (!entrada?.celebracoes?.length) {
        await marcar(sabado, { estado: 'sem_missas' })
        await avisarDono(cfg, `Não há nenhuma missa cadastrada no fim de semana ${fds}. Não gerei a escala.`)
        return
      }
      // Já tem escala montada (o dono gerou ou editou no app): o robô não gera por cima. Manda a
      // escala como está, só para conferir, com os mesmos botões; nada é gravado.
      if (Object.values(entrada.escalasExistentes || {}).some((l) => l?.length)) {
        const texto = `O fim de semana ${fds} já tinha escala montada no app: não gerei nem gravei nada. Segue como está, só para conferir.\n\n`
          + montarMensagem({ sabado, ...entrada }, { novas: [] })
        const id = await enviarConferencia(cfg, texto, sabado)
        await marcar(sabado, { estado: 'aguardando', gerada_em: agora.toISOString(), resumo: { texto, novas: 0, jaMontada: true }, mensagem_dono_id: id, erro: null })
        log.info(`escala automática ${sabado}: já montada no app, só enviada para conferência`)
        return
      }
      const resultado = { semMinistros: entrada.semMinistros, ...(await gerarSemana({ ...entrada, rnd })) }
      const novas = (resultado.novas || []).map((n) => ({
        celebracao_id: n.celebracao_id, membro_id: n.membro_id, funcao: n.funcao, created_by: cfg.usuario_sistema_id ?? null,
      }))
      if (novas.length) gravados = exigir(await db.from('acolitos_escalas').insert(novas).select('id'), 'gravar escala').map((r) => r.id)
      const texto = montarMensagem({ sabado, ...entrada }, resultado)
      const resumo = { texto, novas: novas.length, vazias: resultado.vazias || [], alemDoMinimo: resultado.alemDoMinimo || [],
        semVagaFilhoDeMinistro: resultado.semVagaFilhoDeMinistro || resultado.filhosSemVaga || [], semMinistros: !!resultado.semMinistros }
      // botões e texto falhando: lança, e a semana NÃO fica 'aguardando' (cai no desfazer abaixo)
      const id = await enviarConferencia(cfg, texto, sabado)
      enviouConferencia = true
      await marcar(sabado, { estado: 'aguardando', gerada_em: agora.toISOString(), resumo, mensagem_dono_id: id, erro: null })
      log.info(`escala automática ${sabado}: ${novas.length} vaga(s) preenchida(s), dono avisado`)
    } catch (e) {
      // "Nada gravado" vale também para falha depois do insert: apaga exatamente o que esta rodada pôs.
      log.error(`escala automática ${sabado}: ${e.message}`)
      let sobrou = false
      if (gravados.length) {
        const r = await db.from('acolitos_escalas').delete().in('id', gravados)
        if (r.error) { sobrou = true; log.error(`desfazer escala ${sabado}: ${r.error.message}`) }
      }
      try { await marcar(sabado, { estado: 'falhou', erro: String(e.message).slice(0, 500) }) } catch (e2) { log.error(e2.message) }
      await avisarDono(cfg, (enviouConferencia ? 'Desconsidere a mensagem anterior da escala. ' : '')
        + `A escala automática do fim de semana ${fds} falhou: ${e.message}. `
        + (sobrou ? 'Não consegui apagar o rascunho gravado; confira e limpe no app.' : 'Nada foi gravado. Monte pelo app.'))
    }
  }

  // Robô caiu entre a trava e o fim: não gera de novo (a regra é uma vez), mas avisa o dono.
  async function destravarPresas(agora, cfg) {
    const limite = new Date(+agora - PRESA_MIN * MINUTO).toISOString()
    const presas = exigir(await db.from('tarcisio_escala_auto').update({ estado: 'falhou', erro: 'A geração parou no meio (robô reiniciou).' })
      .eq('estado', 'gerando').lt('gerada_em', limite).select('semana'), 'destravar semanas')
    for (const p of presas) {
      await avisarDono(cfg, `A escala automática do fim de semana ${fimDeSemana(p.semana)} parou no meio. Confira no app antes de confirmar.`)
    }
    // Caiu no meio do Confirmar: volta a esperar. Confirmar de novo é seguro (só avisa quem falta,
    // a arte tem trava própria).
    // lê antes (barato): a troca só roda quando há alguma presa
    const vistas = exigir(await db.from('tarcisio_escala_auto').select('semana')
      .eq('estado', 'confirmando').lt('confirmando_em', limite), 'ler confirmações presas')
    const confirmando = vistas.length ? exigir(await db.from('tarcisio_escala_auto').update({ estado: 'aguardando' })
      .eq('estado', 'confirmando').lt('confirmando_em', limite).select('semana'), 'destravar confirmações') : []
    for (const p of confirmando) {
      await avisarDono(cfg, `O Confirmar da escala do fim de semana ${fimDeSemana(p.semana)} parou no meio. Toque Confirmar de novo (ninguém é avisado duas vezes) ou confirme pelo app.`)
    }
  }

  // Quarta 09:00 sem linha da semana = a terça não rodou (robô fora). Não gera atrasado: avisa o
  // dono uma vez. A própria linha ('falhou') é a trava do aviso.
  async function avisarTercaPerdida(sp, cfg) {
    if (diaDaSemana(sp.data) !== 3 || sp.hm < HORA_AVISO_PERDIDA) return
    const sabado = somarDias(sp.data, 3)
    const nova = exigir(await db.from('tarcisio_escala_auto')
      .upsert({ semana: sabado, estado: 'falhou', erro: 'A geração automática de terça não rodou.' }, { onConflict: 'semana', ignoreDuplicates: true })
      .select('semana'), 'registrar terça perdida')
    if (!nova.length) return
    await avisarDono(cfg, `A geração automática da escala do fim de semana ${fimDeSemana(sabado)} não rodou na terça. Gere pelo app (Escala → Gerar).`)
  }

  async function lembrar(sp, cfg) {
    const linhas = exigir(await db.from('tarcisio_escala_auto').select('semana,lembretes,resumo')
      .eq('estado', 'aguardando').gte('semana', sp.data), 'ler semanas aguardando')
    for (const l of linhas) {
      const k = lembreteDaVez(l.semana, sp)
      if (!k || l.lembretes >= k) continue
      // confirmada no app depois da geração: encerra sem lembrar — mas só com a arte pedida; avisados
      // sem arte (confirmar parou no meio) é semana pela metade: lembra o dono de tocar Confirmar.
      if (await artePedida(l.semana)) {
        exigir(await db.from('tarcisio_escala_auto').update({ estado: 'confirmada' })
          .eq('semana', l.semana).eq('estado', 'aguardando'), 'encerrar semana confirmada')
        continue
      }
      const semArte = await avisadosNaSemana(l.semana)
      // compara-e-troca: só quem mudar o contador envia (outra rodada/reinício não repete)
      const ok = exigir(await db.from('tarcisio_escala_auto').update({ lembretes: k })
        .eq('semana', l.semana).eq('estado', 'aguardando').eq('lembretes', l.lembretes).select('semana'), 'contar lembrete')
      if (!ok.length) continue
      try {
        await enviarConferencia(cfg, semArte
          ? `Lembrete: a escala do fim de semana ${fimDeSemana(l.semana)} já avisou o pessoal, mas a arte dos grupos não foi pedida. Toque Confirmar para pedir a arte (ninguém é avisado de novo).`
          : `Lembrete: a escala ainda espera sua conferência.\n\n${l.resumo?.texto || ''}`, l.semana)
      } catch (e) { log.warn(`lembrete da escala ${l.semana}: ${e.message}`) }
    }
  }

  async function cuidar(agora, cfg) {
    if (!cfg || cfg.pausado) return
    const sp = agoraSP(agora)
    await destravarPresas(agora, cfg)
    const sabado = semanaParaGerar(sp)
    if (sabado) await gerar(sabado, agora, cfg)
    await avisarTercaPerdida(sp, cfg)
    await lembrar(sp, cfg)
  }

  return { cuidar }
}

// ── Leitura dos dados do gerador, espelho do que escala.html carrega (loadDados,
// carregarAusenciasFresh, carregarPesoRodizio, SemanalCore.carregar, loadModelos, loadConfig).
// Os núcleos puros vêm de projetos/acolitos (mesmo código da tela), injetados por principal.mjs.
const CAMPOS_MEMBRO_GERADOR = 'id,nome,apelido,nivel,comunidade,casa_id,escalar_frequente,servir_toda_semana,suspenso_ate,suspenso_em,'
  + 'pode_outras_comunidades,data_nascimento,foto_url,observacoes,necessidades_especiais,nome_pai,nome_mae,tem_pai_ministro,'
  + 'nome_pai_ministro,tem_mae_ministro,nome_mae_ministro,comunidade_ministro,grupo_irmaos,escalar_com_irmao,escalar_com_pais'
const fimDoMes = (data) => { const [a, m] = data.split('-').map(Number); return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10) }

export function criarCarregarEntrada({ RodizioCore, SemanalCore, lerTudo }) {
  const tudo = async (montar, onde) => exigir(await lerTudo(montar), onde)

  // carregarPesoRodizio (shared.js): vezes no mês da missa × 1000 + escalas na janela.
  async function carga(db, ref, gerador) {
    const dias = Number(gerador.janela_dias) || 42
    const ini = new Date(ref + 'T00:00:00Z'); ini.setUTCDate(ini.getUTCDate() - dias)
    const iniJanela = ini.toISOString().slice(0, 10)
    const mesIni = ref.slice(0, 7) + '-01'
    const mesFim = fimDoMes(ref)
    const de = iniJanela < mesIni ? iniJanela : mesIni
    const ate = ref > mesFim ? ref : mesFim
    const cels = await tudo(() => db.from('acolitos_celebracoes').select('id,data').gte('data', de).lte('data', ate), 'ler missas do rodízio')
    const dataDe = Object.fromEntries(cels.map((c) => [c.id, c.data]))
    const ids = Object.keys(dataDe)
    if (!ids.length) return {}
    const escalas = await tudo(() => db.from('acolitos_escalas').select('membro_id,celebracao_id').in('celebracao_id', ids), 'ler escalas do rodízio')
    let frequentes = []
    const fq = await db.from('acolitos_membros').select('id').eq('escalar_frequente', true)
    if (!fq.error) frequentes = (fq.data || []).map((x) => x.id)   // como na tela: sem a marca, segue sem o favor
    return RodizioCore.contarParaRodizio({
      escalas: escalas.map((e) => ({ membro_id: e.membro_id, data: dataDe[e.celebracao_id] })),
      refData: ref, janelaDias: dias, frequentes,
    })
  }

  // Vezes EXATAS por mês (teto de 2× do gerador): { 'AAAA-MM': { membro_id: n } } para cada mês em que há
  // missa nesta semana — um fim de semana 31/10 + 01/11 conta cada missa no mês dela.
  async function vezesPorMes(db, datas) {
    const saida = {}
    for (const mes of [...new Set(datas.map((d) => d.slice(0, 7)))]) {
      const cels = await tudo(() => db.from('acolitos_celebracoes').select('id').gte('data', mes + '-01').lte('data', fimDoMes(mes + '-01')), 'ler missas do mês')
      const ids = cels.map((c) => c.id)
      const n = {}
      if (ids.length) {
        const escalas = await tudo(() => db.from('acolitos_escalas').select('membro_id,celebracao_id').in('celebracao_id', ids), 'ler escalas do mês')
        for (const e of escalas) n[e.membro_id] = (n[e.membro_id] || 0) + 1
      }
      saida[mes] = n
    }
    return saida
  }

  return async function carregarEntrada(db, sabado) {
    const domingo = somarDias(sabado, 1)
    const appConfig = Object.fromEntries(exigir(await db.from('acolitos_config').select('chave,valor'), 'ler config do app')
      .map((r) => [r.chave, r.valor]))
    const gerador = appConfig.gerador || {}
    const celebracoes = exigir(await db.from('acolitos_celebracoes').select('*').gte('data', sabado).lte('data', domingo)
      .order('data').order('minutos'), 'ler missas')
    if (!celebracoes.length) return { celebracoes, appConfig }
    const ids = celebracoes.map((c) => c.id)
    const datas = [...new Set(celebracoes.map((c) => c.data))].sort()

    const [esc, membros, habs, disps, ausCel, ausData, modelos, ministros, ministrosMes] = await Promise.all([
      db.from('acolitos_escalas').select('*').in('celebracao_id', ids).then((r) => exigir(r, 'ler escalas da semana')),
      db.from('acolitos_membros').select(CAMPOS_MEMBRO_GERADOR).eq('status', 'ativo').eq('serve', true).order('nome').then((r) => exigir(r, 'ler membros')),
      tudo(() => db.from('acolitos_habilitacoes').select('membro_id,funcao,proficiencia'), 'ler habilitações'),
      tudo(() => db.from('acolitos_disponibilidade').select('membro_id,dia,horario,restricao'), 'ler disponibilidade'),
      db.from('acolitos_ausencias').select('membro_id,celebracao_id').in('celebracao_id', ids).then((r) => exigir(r, 'ler ausências')),
      db.from('acolitos_ausencias').select('membro_id,data').is('celebracao_id', null).in('data', datas).then((r) => exigir(r, 'ler ausências por data')),
      db.from('acolitos_modelos').select('*').then((r) => exigir(r, 'ler modelos')),
      db.from('acolitos_escala_ministros').select('data,horario,comunidade,membro_id,pai_ou_mae').gte('data', sabado).lte('data', domingo)
        .then((r) => exigir(r, 'ler escala dos ministros')),
      db.from('acolitos_escala_ministros').select('id').gte('data', sabado.slice(0, 7) + '-01').lte('data', fimDoMes(domingo)).limit(1)
        .then((r) => exigir(r, 'ler escala dos ministros do mês')),
    ])

    const escalasExistentes = {}
    for (const e of esc) (escalasExistentes[e.celebracao_id] ||= []).push(e)
    const habMap = {}
    for (const h of habs) (habMap[h.membro_id] ||= {})[h.funcao] = h.proficiencia
    const dispMap = {}
    for (const d of disps) (dispMap[d.membro_id] ||= []).push(d.dia + '_' + d.horario)
    // ausências: por missa + avulsas por data (valem o dia todo) + suspensos (contam como ausentes)
    const ausencias = {}
    const marcar = (cid, mid) => (ausencias[cid] ||= new Set()).add(mid)
    for (const a of ausCel) marcar(a.celebracao_id, a.membro_id)
    for (const a of ausData) celebracoes.filter((c) => c.data === a.data).forEach((c) => marcar(c.id, a.membro_id))
    for (const c of celebracoes) for (const m of membros) if (RodizioCore.suspensoNaData(m, c.data)) marcar(c.id, m.id)

    const historicoSemanal = membros.some((m) => m.servir_toda_semana)
      ? await SemanalCore.carregar(db, lerTudo, celebracoes.map((c) => c.data)) : []

    // modeloFor (escala.html): modelo do tipo+comunidade; sem ele, missa comum da comunidade, depois da Matriz
    const porChave = {}
    for (const r of modelos) (porChave[r.tipo + '|' + r.comunidade] ||= []).push(r)
    const modeloFor = (tipo, comunidade) => {
      let rows = porChave[tipo + '|' + comunidade]
      if (!rows || !rows.length) rows = porChave['missa_comum|' + comunidade] || porChave['missa_comum|matriz'] || []
      const slots = []
      rows.filter((r) => r.quantidade > 0).sort((a, b) => (a.ordem - b.ordem) || a.funcao.localeCompare(b.funcao)).forEach((r) => {
        const label = rotuloFuncao(r.funcao)
        for (let i = 1; i <= r.quantidade; i++) slots.push({ funcao: r.funcao, label: r.quantidade > 1 ? `${label} ${i}` : label })
      })
      return slots
    }

    const temFilhoDeMinistro = membros.some((m) => m.tem_pai_ministro || m.tem_mae_ministro)
    return {
      celebracoes, membros, habMap, dispMap, escalasExistentes, ausencias, historicoSemanal,
      carga: await carga(db, datas[0], gerador),
      vezesNoMes: await vezesPorMes(db, datas),
      config: { gerador, funcoes_maiores: appConfig.funcoes_maiores ?? null, minimo_mes: gerador.minimo_mes ?? appConfig.minimo_mes },
      appConfig, modeloFor,
      // membro_id = o FILHO; quem marcou "não escalar junto com os pais" (explicitamente false) fica de fora.
      ministros: ministros.filter((r) => membros.find((m) => m.id === r.membro_id)?.escalar_com_pais !== false),
      semMinistros: temFilhoDeMinistro && !ministrosMes.length,
    }
  }
}
