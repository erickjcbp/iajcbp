// O robô do São Tarcísio | JCBP. Roda na VPS, ao lado da Evolution (projeto Docker wa-tarcisio).
// A cada 5 s: lê a configuração, cuida da conexão (QR, grupos), transforma as regras em linhas
// da fila (tarcisio_envios) e envia UMA linha vencida, com pausa sorteada entre envios.
// Só envia: não lê resposta de ninguém. Projeto: docs/superpowers/specs/2026-10-20-sao-tarcisio-whatsapp-design.md
import {
  agoraSP, somarDias, hmCurto, dentroDaJanela, montarLembretes, montarAniversarios,
  publicoPrivado, proximaVez, pausaEntreEnvios,
} from './regras.mjs'

const CAMPOS_MEMBRO = 'id,nome,apelido,nivel,user_id,data_nascimento,telefone,celular_recado,celular_responsavel,celular_mae'
const PAPEL_GRUPO = { pais: 'Pais', acolitos: 'Acólitos', cerimoniarios: 'Cerimoniários', equipe: 'Equipe' }
const MINUTO = 60_000

// Erro do banco nunca passa calado: sem isto, falha de leitura viraria "não há nada a fazer".
const exigir = ({ data, error }, onde) => {
  if (error) throw new Error(`${onde}: ${error.message}`)
  return data
}

export function criarRobo({ db, evo, relogio = () => new Date(), rnd = Math.random, log = console }) {
  const st = { proximoEnvioEm: 0, lembreteEm: null, anivEm: null, estadoEm: 0, conexao: 'desconhecida', gruposPedidoEm: null }

  async function inserirNaFila(linhas) {
    if (!linhas.length) return 0
    const r = await db.from('tarcisio_envios').upsert(linhas, { onConflict: 'chave_unica', ignoreDuplicates: true }).select('id')
    return exigir(r, 'gravar fila').length
  }

  async function membrosQueServem() {
    return exigir(await db.from('acolitos_membros').select(CAMPOS_MEMBRO).eq('status', 'ativo').eq('serve', true), 'ler membros')
  }

  // ── conexão: estado a cada 30 s, QR quando a tela pede, grupos quando a tela pede ──
  async function cuidarConexao(cfg, agora) {
    const mudancas = {}
    if (agora - st.estadoEm >= 30_000) {
      st.estadoEm = +agora
      st.conexao = await evo.estado()
      mudancas.conexao = st.conexao
      mudancas.robo_visto_em = agora.toISOString()
      if (st.conexao === 'open') {
        if (cfg.qr_code) mudancas.qr_code = null
        if (!cfg.numero_conectado) mudancas.numero_conectado = await evo.numeroConectado()
      }
    }
    const pediuQr = cfg.pedir_qr_em && agora - new Date(cfg.pedir_qr_em) < 3 * MINUTO
    const qrVelho = !cfg.qr_em || agora - new Date(cfg.qr_em) > 20_000
    if (pediuQr && st.conexao !== 'open' && qrVelho) {
      const r = await evo.conectar()
      if (r?.base64) { mudancas.qr_code = r.base64; mudancas.qr_em = agora.toISOString() }
      st.estadoEm = 0   // confere o estado logo depois de mostrar o QR
    }
    if (cfg.pedir_grupos_em && cfg.pedir_grupos_em !== st.gruposPedidoEm && st.conexao === 'open') {
      st.gruposPedidoEm = cfg.pedir_grupos_em
      const grupos = await evo.grupos()
      if (grupos.length) {
        exigir(await db.from('tarcisio_grupos').upsert(
          grupos.map((g) => ({ jid: g.jid, nome: g.nome, visto_em: agora.toISOString() })), { onConflict: 'jid' }), 'gravar grupos')
      }
    }
    if (Object.keys(mudancas).length) {
      exigir(await db.from('tarcisio_config').update({ ...mudancas, updated_at: agora.toISOString() }).eq('id', 1), 'gravar estado')
    }
  }

  // ── lembrete da véspera (19h): só quem ainda está 'escalado' ──
  async function gerarLembretes(cfg, sp) {
    if (!cfg.lembrete_ligado || st.lembreteEm === sp.data) return
    if (sp.hm < hmCurto(cfg.hora_lembrete) || sp.hm >= hmCurto(cfg.janela_fim)) return   // depois das 21h "amanhã" chegaria no dia
    const amanha = somarDias(sp.data, 1)
    const cels = exigir(await db.from('acolitos_celebracoes').select('id,data,horario,comunidade,minutos').eq('data', amanha), 'ler missas')
    let escalas = []
    if (cels.length) {
      escalas = exigir(await db.from('acolitos_escalas')
        .select(`funcao,celebracao_id,membro:acolitos_membros!acolitos_escalas_membro_id_fkey(${CAMPOS_MEMBRO})`)
        .in('celebracao_id', cels.map((c) => c.id)).eq('status', 'escalado'), 'ler escalas')
    }
    const porId = new Map(cels.map((c) => [c.id, c]))
    const { envios, semNumero } = montarLembretes(
      escalas.filter((e) => e.membro).map((e) => ({ membro: e.membro, celebracao: porId.get(e.celebracao_id), funcao: e.funcao })),
      { amanha, hoje: sp.data, modelo: cfg.texto_lembrete, rodape: cfg.rodape })
    const n = await inserirNaFila([...envios, ...semNumero])
    st.lembreteEm = sp.data
    log.info(`lembretes de ${amanha}: ${envios.length} número(s), ${semNumero.length} sem número, ${n} novo(s) na fila`)
  }

  // ── aniversário (8h): parabéns no privado ──
  async function gerarAniversarios(cfg, sp) {
    if (!cfg.aniversario_ligado || st.anivEm === sp.data) return
    if (sp.hm < hmCurto(cfg.hora_aniversario) || sp.hm >= hmCurto(cfg.janela_fim)) return
    const linhas = montarAniversarios(await membrosQueServem(), { hoje: sp.data, modelo: cfg.texto_aniversario, rodape: cfg.rodape })
    await inserirNaFila(linhas)
    st.anivEm = sp.data
    if (linhas.length) log.info(`aniversários de ${sp.data}: ${linhas.length}`)
  }

  // ── avisos agendados vencidos: viram linhas e andam para a próxima vez (ou desligam) ──
  async function gerarAvisos(cfg, agora, sp) {
    const avisos = exigir(await db.from('tarcisio_avisos').select('*').eq('ativo', true).lte('quando', agora.toISOString()), 'ler avisos')
    if (!avisos.length) return
    const grupos = exigir(await db.from('tarcisio_grupos').select('jid,nome,papel').not('papel', 'is', null), 'ler grupos')
    const jidDoPapel = new Map(grupos.map((g) => [g.papel, g]))
    let membros = null
    let papelDoUsuario = null
    for (const a of avisos) {
      const base = { tipo: 'aviso', aviso_id: a.id, imagem_url: a.imagem_url }
      const textoGrupo = a.texto || ''
      const linhas = []
      for (const papel of a.grupos) {
        const g = jidDoPapel.get(papel)
        const chave = `aviso:${a.id}:${a.quando}:grupo:${papel}`
        linhas.push(g
          ? { ...base, destino_jid: g.jid, destino_nome: g.nome, texto: textoGrupo, chave_unica: chave }
          : { ...base, estado: 'falhou', destino_nome: `Grupo ${PAPEL_GRUPO[papel] || papel}`, erro: 'Grupo não ligado na aba Grupos', chave_unica: chave })
      }
      if (a.privado.length) {
        membros ??= await membrosQueServem()
        papelDoUsuario ??= new Map(exigir(await db.from('pastoral_members')
          .select('user_id,role,pastoral_modules!inner(slug)').eq('pastoral_modules.slug', 'acolitos'), 'ler papéis')
          .map((p) => [p.user_id, p.role]))
        const textoPrivado = [a.texto, cfg.rodape].filter(Boolean).join('\n\n')
        for (const { numero, membro } of publicoPrivado(a.privado, membros, { hoje: sp.data, papelDoUsuario })) {
          linhas.push({ ...base, destino_numero: numero, destino_nome: membro.nome, membro_id: membro.id,
            texto: textoPrivado, chave_unica: `aviso:${a.id}:${a.quando}:${numero}` })
        }
      }
      await inserirNaFila(linhas)
      const proxima = proximaVez(a.quando, a.repetir, a.ate)
      exigir(await db.from('tarcisio_avisos').update(proxima ? { quando: proxima } : { ativo: false }).eq('id', a.id), 'avançar aviso')
      log.info(`aviso "${a.titulo}": ${linhas.length} destino(s)${proxima ? `, próximo ${proxima}` : ', encerrado'}`)
    }
  }

  // ── escala confirmada: espera a arte nova do fim de semana e põe uma imagem por grupo ──
  async function cuidarEscala(agora) {
    const pedidos = exigir(await db.from('tarcisio_envios').select('id,domingo_data,created_at').eq('estado', 'aguardando_arte'), 'ler escalas pedidas')
    for (const p of pedidos) {
      const arte = exigir(await db.from('acolitos_escala_artes').select('png_url,png_url_domingo,gerado_em')
        .eq('domingo_data', p.domingo_data).maybeSingle(), 'ler arte')
      const pronta = arte?.png_url && new Date(arte.gerado_em) > new Date(p.created_at)
      if (!pronta) {
        if (agora - new Date(p.created_at) > 30 * MINUTO) {
          exigir(await db.from('tarcisio_envios').update({ estado: 'falhou', erro: 'A arte não ficou pronta em 30 min. Gere a arte na Escala e confirme de novo.' }).eq('id', p.id), 'falhar escala')
        }
        continue
      }
      const grupos = exigir(await db.from('tarcisio_grupos').select('jid,nome').not('papel', 'is', null), 'ler grupos')
      if (!grupos.length) {
        exigir(await db.from('tarcisio_envios').update({ estado: 'falhou', erro: 'Nenhum grupo ligado na aba Grupos' }).eq('id', p.id), 'falhar escala')
        continue
      }
      const partes = [arte.png_url, arte.png_url_domingo].filter(Boolean)
      const linhas = grupos.flatMap((g) => partes.map((url, i) => ({
        tipo: 'escala', destino_jid: g.jid, destino_nome: g.nome, imagem_url: url, texto: '',
        domingo_data: p.domingo_data, chave_unica: `escala:${p.domingo_data}:${g.jid}:${i}`,
      })))
      await inserirNaFila(linhas)
      exigir(await db.from('tarcisio_envios').update({ estado: 'enviado', enviado_em: agora.toISOString(),
        texto: `Arte pronta: ${linhas.length} envio(s) na fila` }).eq('id', p.id), 'fechar escala')
      log.info(`escala de ${p.domingo_data}: ${linhas.length} imagem(ns) na fila`)
    }
  }

  // ── envio: um por vez, na janela, abaixo do teto do dia, com pausa sorteada ──
  async function enviarProximo(cfg, agora, sp) {
    if (cfg.pausado || st.conexao !== 'open' || +agora < st.proximoEnvioEm) return
    if (!dentroDaJanela(sp.hm, cfg.janela_inicio, cfg.janela_fim)) return
    const item = exigir(await db.from('tarcisio_envios').select('*').eq('estado', 'pendente')
      .lte('agendado_para', agora.toISOString()).order('agendado_para').order('created_at').limit(1).maybeSingle(), 'ler fila')
    if (!item) return
    if (item.destino_numero) {
      const { count, error } = await db.from('tarcisio_envios').select('id', { count: 'exact', head: true })
        .eq('estado', 'enviado').not('destino_numero', 'is', null).gte('enviado_em', `${sp.data}T00:00:00-03:00`)
      if (error) throw new Error(`contar envios do dia: ${error.message}`)
      if (count >= cfg.teto_diario) return
    }
    // reserva a linha: se outra coisa mexeu nela (cancelou), não envia
    const reservada = exigir(await db.from('tarcisio_envios').update({ estado: 'enviando' })
      .eq('id', item.id).eq('estado', 'pendente').select('id'), 'reservar envio')
    if (!reservada.length) return
    const destino = item.destino_jid || item.destino_numero
    try {
      if (item.imagem_url) await evo.enviarImagem(destino, item.imagem_url, item.texto)
      else await evo.enviarTexto(destino, item.texto)
      exigir(await db.from('tarcisio_envios').update({ estado: 'enviado', enviado_em: agora.toISOString(), erro: null }).eq('id', item.id), 'marcar enviado')
    } catch (e) {
      const tentativas = item.tentativas + 1
      const desiste = e.semWhatsapp || tentativas >= 3
      exigir(await db.from('tarcisio_envios').update(desiste
        ? { estado: 'falhou', tentativas, erro: e.message }
        : { estado: 'pendente', tentativas, erro: e.message, agendado_para: new Date(+agora + 5 * MINUTO).toISOString() })
        .eq('id', item.id), 'registrar falha')
      log.warn(`envio ${item.id} (${item.tipo}) falhou: ${e.message}`)
    }
    st.proximoEnvioEm = +agora + pausaEntreEnvios(rnd)
  }

  // Mensagem velha não sai: lembrete de missa que passou, parabéns de ontem, arte da semana errada.
  // Acontece quando o número fica desconectado ou pausado por um tempo.
  const VALIDADE_HORAS = { lembrete: 12, aniversario: 12, aviso: 24, escala: 72 }
  async function expirar(agora) {
    for (const [tipo, horas] of Object.entries(VALIDADE_HORAS)) {
      exigir(await db.from('tarcisio_envios').update({ estado: 'cancelado', erro: 'Passou da hora: não foi enviado' })
        .eq('estado', 'pendente').eq('tipo', tipo).lt('created_at', new Date(+agora - horas * 60 * MINUTO).toISOString()), 'expirar')
    }
  }

  async function iniciar() {
    // envio interrompido no meio (robô reiniciou) volta para a fila
    exigir(await db.from('tarcisio_envios').update({ estado: 'pendente' }).eq('estado', 'enviando'), 'destravar fila')
  }

  // Cada etapa isolada: a falha de uma (ex.: Evolution fora) não para as outras.
  async function rodada() {
    const agora = relogio()
    const sp = agoraSP(agora)
    const cfg = exigir(await db.from('tarcisio_config').select('*').eq('id', 1).single(), 'ler config')
    const etapas = [
      ['conexão', () => cuidarConexao(cfg, agora)],
      ['lembretes', () => gerarLembretes(cfg, sp)],
      ['aniversários', () => gerarAniversarios(cfg, sp)],
      ['avisos', () => gerarAvisos(cfg, agora, sp)],
      ['escala', () => cuidarEscala(agora)],
      ['validade', () => expirar(agora)],
      ['envio', () => enviarProximo(cfg, agora, sp)],
    ]
    for (const [nome, fazer] of etapas) {
      try { await fazer() } catch (e) { log.error(`[${nome}] ${e.message}`) }
    }
  }

  return { iniciar, rodada, estado: st }
}
