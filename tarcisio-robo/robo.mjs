// O robô do São Tarcísio | JCBP. Roda na VPS, ao lado da Evolution (projeto Docker wa-tarcisio).
// A cada 5 s: lê a configuração, cuida da conexão (QR, grupos), transforma as regras em linhas
// da fila (tarcisio_envios) e envia UMA linha vencida, com pausa sorteada entre envios.
// Só envia: não lê resposta de ninguém. Projeto: docs/superpowers/specs/2026-10-20-sao-tarcisio-whatsapp-design.md
import {
  agoraSP, somarDias, hmCurto, dentroDaJanela, montarLembretes, montarAniversarios,
  publicoPrivado, proximaVez, semanaConfirmada, lembreteAusenciaAgora, ausenciaVencida, pausaEntreEnvios, imagemPermitida, cumprimentoValido,
} from './regras.mjs'

import { cuidarPreparacao } from './avisos-programados.mjs'

const CAMPOS_MEMBRO = 'id,nome,apelido,nivel,user_id,data_nascimento,telefone,celular_recado,celular_responsavel,celular_mae,acolitos_logins(usuario)'
const PAPEL_GRUPO = { pais: 'Pais', acolitos: 'Acólitos', cerimoniarios: 'Cerimoniários', equipe: 'Equipe' }
const MINUTO = 60_000
// Dois disparos expressamente autorizados pelo dono, sem liberar os demais automáticos.
const CAMPANHA_RETIRO = 'campanha:retiro-2026-10-24:'
const LIMITE_RETIRO = Date.parse('2026-10-24T12:00:00-03:00')

// Erro do banco nunca passa calado: sem isto, falha de leitura viraria "não há nada a fazer".
const exigir = ({ data, error }, onde) => {
  if (error) throw new Error(`${onde}: ${error.message}`)
  return data
}

// Só vincula os dois avisos já autorizados ao nome informado pelo dono.
export async function vincularGrupoRetiro(db, evo) {
  const normalizar = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
  const chaves = ['sexta', 'sabado'].map((dia) => `${CAMPANHA_RETIRO}${dia}:grupo-cerimoniarios`)
  const pendentes = exigir(await db.from('tarcisio_envios').select('id,chave_unica')
    .in('chave_unica', chaves).eq('estado', 'sem_numero'), 'ler grupo pendente do retiro')
  if (!pendentes?.length) return null
  const candidatos = (await evo.grupos()).filter((g) => normalizar(g.nome) === 'cerimoniariosjcbp')
  if (candidatos.length !== 1) return null
  const grupo = candidatos[0]
  exigir(await db.from('tarcisio_envios').update({ destino_jid: grupo.jid, destino_nome: grupo.nome,
    estado: 'pendente', erro: null }).in('chave_unica', chaves).eq('estado', 'sem_numero'), 'vincular grupo do retiro')
  return grupo
}

export async function prepararApresentacaoGrupos(db, evo) {
  // Dono autorizou a apresentação em todos os grupos em que incluir este número.
  const pai = exigir(await db.from('tarcisio_avisos').select('id,ativo,texto,imagem_url,quando').eq('chave', 'apresentacao-grupos-20261023').maybeSingle(), 'ler apresentação')
  if (pai && !pai.ativo) return 0
  const grupos = await evo.grupos()
  const texto = 'Olá, pessoal! Paz e bem! 🙏\n\nEu sou o Tarcísio, da Pastoral dos Coroinhas e Acólitos da Paróquia Jesus Cristo Bom Pastor.\n\nVou caminhar junto com a equipe para ajudar com avisos, comunicados e dúvidas. Por aqui vocês receberão as informações da pastoral.\n\n📌 Precisa informar uma ausência? Registre pelo link universal de ausências:\nhttps://coroinhas.jcbplimeira.com.br/ausencias\n\nUsem esse link sempre que não puderem servir, para que a ausência fique registrada no sistema.\n\nPara consultar sua escala ou tirar dúvidas, falem comigo no privado. Quando precisar, encaminharei o assunto à coordenação.\n\nContem comigo! 🙏'
  if (!grupos.length) return 0
  const linhas = grupos.map(g => ({ tipo: 'aviso', estado: 'pendente', destino_jid: g.jid, destino_nome: g.nome,
    texto: pai?.texto || texto, aviso_id: pai?.id || null, imagem_url: pai?.imagem_url || null, agendado_para: pai?.quando || '2026-10-23T08:00:00-03:00', chave_unica: `${CAMPANHA_RETIRO}apresentacao:${g.jid}` }))
  const gravadas = exigir(await db.from('tarcisio_envios').upsert(linhas, { onConflict: 'chave_unica', ignoreDuplicates: true }).select('id'), 'agendar apresentação')
  return gravadas.length
}

export function criarRobo({ db, evo, supabaseUrl, ia = null, assistente = null, escalaAuto = null, acolhida = null, relogio = () => new Date(), rnd = Math.random, log = console }) {
  const st = { proximoEnvioEm: 0, lembreteEm: null, anivEm: null, estadoEm: 0, conexao: 'desconhecida', gruposPedidoEm: null, grupoRetiroEm: 0 }

  async function inserirNaFila(linhas) {
    if (!linhas.length) return 0
    // Lotes mistos incluem pendentes e sem_numero: campos ausentes devem usar
    // os defaults do banco, nunca NULL (estado/agendado_para são obrigatórios).
    const r = await db.from('tarcisio_envios').upsert(linhas.map(l => ({ ...l, estado: l.estado ?? 'pendente' })),
      { onConflict: 'chave_unica', ignoreDuplicates: true, defaultToNull: false }).select('id')
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
      if (cfg.ia_disponivel !== !!ia) mudancas.ia_disponivel = !!ia
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
    // Rascunho não chega no celular de ninguém: só lembra a semana CONFIRMADA (a mesma marca do
    // botão Confirmar, em qualquer dia da semana). Sem conseguir ler, não lembra (erro sobe e loga).
    const avisados = exigir(await db.from('acolitos_config').select('valor').eq('chave', 'escala_avisados').maybeSingle(), 'ler semanas confirmadas')
    if (!semanaConfirmada(amanha, avisados?.valor)) {
      if (st.lembretePuladoEm !== sp.data) log.warn(`lembretes de ${amanha}: semana não confirmada, nenhum lembrete enviado`)
      st.lembretePuladoEm = sp.data
      return   // não marca lembreteEm: se confirmarem ainda na janela, o lembrete sai
    }
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
    const avisos = exigir(await db.from('tarcisio_avisos').select('*').eq('ativo', true), 'ler avisos')
    if (!avisos.length) return
    const grupos = exigir(await db.from('tarcisio_grupos').select('jid,nome,papel').not('papel', 'is', null), 'ler grupos')
    const jidDoPapel = new Map(grupos.map((g) => [g.papel, g]))
    let membros = null
    let papelDoUsuario = null
    for (const a of avisos) {
      if (a.configuracao?.tipo === 'fila_existente') continue
      if (a.configuracao?.tipo === 'preparacao_missa') {
        await cuidarPreparacao({ db, evo, aviso: a, agora }); continue
      }
      if (+new Date(a.quando) > +agora) continue
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
        const destinatarios = publicoPrivado(a.privado, membros, { hoje: sp.data, papelDoUsuario })
        const logins = new Map(await Promise.all(destinatarios.map(async ({ membro }) => {
          let login = Array.isArray(membro.acolitos_logins) ? membro.acolitos_logins[0]?.usuario : membro.acolitos_logins?.usuario
          if (!login && membro.user_id) {
            const conta = await db.auth.admin.getUserById(membro.user_id)
            login = conta?.data?.user?.email?.split('@')[0] || ''
          }
          return [membro.id, login || '']
        })))
        for (const { numero, membro } of destinatarios) {
          const login = logins.get(membro.id) || ''
          const textoIndividual = textoPrivado
            .replaceAll('{{nome}}', membro.apelido || membro.nome || '')
            .replaceAll('{{usuario}}', login || 'Fale com a coordenação para conferir seu usuário')
          linhas.push({ ...base, destino_numero: numero, destino_nome: membro.nome, membro_id: membro.id,
            texto: textoIndividual, chave_unica: `aviso:${a.id}:${a.quando}:${numero}` })
        }
      }
      await inserirNaFila(linhas)
      const proxima = proximaVez(a.quando, a.repetir, a.ate)
      exigir(await db.from('tarcisio_avisos').update(proxima ? { quando: proxima } : { ativo: false }).eq('id', a.id), 'avançar aviso')
      log.info(`aviso "${a.titulo}": ${linhas.length} destino(s)${proxima ? `, próximo ${proxima}` : ', encerrado'}`)
    }
  }

  // ── lembrete de ausência: domingo a terça, um por grupo; a chave única impede repetir ──
  async function gerarLembreteAusencia(cfg, agora, sp) {
    if (cfg.pausado) return
    const l = lembreteAusenciaAgora(sp, cfg)
    if (!l) return
    const grupos = exigir(await db.from('tarcisio_grupos').select('jid,nome,papel').not('papel', 'is', null), 'ler grupos')
    const jidDoPapel = new Map(grupos.map((g) => [g.papel, g]))
    const linhas = Object.keys(PAPEL_GRUPO).map((papel) => {
      const g = jidDoPapel.get(papel)
      const chave = `${l.chave}:grupo:${papel}`
      return g
        ? { tipo: 'aviso', destino_jid: g.jid, destino_nome: g.nome, texto: l.texto, chave_unica: chave }
        : { tipo: 'aviso', estado: 'falhou', destino_nome: `Grupo ${PAPEL_GRUPO[papel]}`, erro: 'Grupo não ligado na aba Grupos', chave_unica: chave }
    })
    const n = await inserirNaFila(linhas)
    if (n) log.info(`lembrete de ausência ${sp.data} ${sp.hm}: ${n} destino(s)`)
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
    if (st.conexao !== 'open' || +agora < st.proximoEnvioEm) return
    let consulta = db.from('tarcisio_envios').select('*').eq('estado', 'pendente')
      .lte('agendado_para', agora.toISOString())
    if (cfg.pausado) consulta = consulta.or(`chave_unica.like.${CAMPANHA_RETIRO}%,chave_unica.like.preparacao-missa:%`)
    const item = exigir(await consulta.order('agendado_para').order('created_at').limit(1).maybeSingle(), 'ler fila')
    if (!item) return
    const retiroAutorizado = String(item.chave_unica || '').startsWith(CAMPANHA_RETIRO)
    let pai = null
    if (item.aviso_id) pai = exigir(await db.from('tarcisio_avisos').select('*').eq('id', item.aviso_id).maybeSingle(), 'ler aviso do envio')
    const preparacao = String(item.chave_unica || '').startsWith('preparacao-missa:') && pai?.configuracao?.tipo === 'preparacao_missa'
    if (cfg.pausado && !retiroAutorizado && !preparacao) return
    if (pai?.configuracao?.tipo && !pai.ativo) {
      exigir(await db.from('tarcisio_envios').update({ estado: 'cancelado', erro: 'Aviso encerrado na configuração' }).eq('id', item.id).eq('estado', 'pendente'), 'encerrar envio'); return
    }
    if (preparacao) {
      const data = agoraSP(new Date(item.agendado_para)).data
      const cels = exigir(await db.from('acolitos_celebracoes').select('minutos').eq('data', data), 'ler prazo da preparação')
      const primeira = cels.map(c => c.minutos).filter(Number.isInteger).sort((a,b) => a-b)[0]
      if (sp.data !== data || (!pai.configuracao.horario && (primeira == null || Number(sp.hm.slice(0,2))*60+Number(sp.hm.slice(3)) >= primeira))) {
        exigir(await db.from('tarcisio_envios').update({ estado: 'cancelado', erro: 'Passou do horário da primeira missa' }).eq('id', item.id).eq('estado', 'pendente'), 'cancelar preparação vencida'); return
      }
    }
    if (!preparacao && !dentroDaJanela(sp.hm, cfg.janela_inicio, cfg.janela_fim)) return
    if (pai?.configuracao?.tipo) { item.texto = pai.texto; item.imagem_url = pai.imagem_url }
    if (retiroAutorizado && +agora >= LIMITE_RETIRO) {
      exigir(await db.from('tarcisio_envios').update({ estado: 'cancelado', erro: 'Encerrado o prazo de envio do retiro de 24/10' })
        .eq('id', item.id).eq('estado', 'pendente'), 'cancelar retiro vencido')
      return
    }
    if (retiroAutorizado && item.destino_jid && !String(item.chave_unica).includes(':apresentacao:')) {
      const intro = exigir(await db.from('tarcisio_envios').select('estado')
        .eq('chave_unica', `${CAMPANHA_RETIRO}apresentacao:${item.destino_jid}`).maybeSingle(), 'conferir apresentação')
      if (intro?.estado !== 'enviado') return
    }
    if (item.destino_numero) {
      const { count, error } = await db.from('tarcisio_envios').select('id', { count: 'exact', head: true })
        .eq('estado', 'enviado').not('destino_numero', 'is', null).gte('enviado_em', `${sp.data}T00:00:00-03:00`)
      if (error) throw new Error(`contar envios do dia: ${error.message}`)
      if (count >= cfg.teto_diario) return
    }
    // lembrete de ausência depois do prazo (terça 18h) não sai nunca
    if (String(item.chave_unica || '').startsWith('ausencia:') && ausenciaVencida(sp)) {
      exigir(await db.from('tarcisio_envios').update({ estado: 'cancelado', erro: 'Passou do prazo de ausências: não foi enviado' })
        .eq('id', item.id).eq('estado', 'pendente'), 'cancelar ausência vencida')
      return
    }
    if(acolhida&&!await acolhida.validarEnvio(item)){exigir(await db.from('tarcisio_envios').update({estado:'cancelado',erro:'Acompanhamento pausado, vencido ou destinatário/etapa alterado.'}).eq('id',item.id).eq('estado','pendente'),'cancelar acolhida');return;}
    // reserva a linha: se outra coisa mexeu nela (cancelou), não envia
    const reservada = exigir(await db.from('tarcisio_envios').update({ estado: 'enviando' })
      .eq('id', item.id).eq('estado', 'pendente').select('id'), 'reservar envio')
    if (!reservada.length) return
    const destino = item.destino_jid || item.destino_numero
    // Avisos e comunicados sem arte própria levam a peça oficial ATENÇÃO.
    const avisoGrupoTexto = item.tipo === 'aviso' && String(item.destino_jid || '').endsWith('@g.us')
      && (!item.imagem_url || /\/avisos\/atencao-pastoral-v1\.png(?:\?|$)/.test(item.imagem_url))
    const imagem = avisoGrupoTexto || (String(item.chave_unica || '').startsWith('senha-reset:')||String(item.chave_unica || '').startsWith('acolhida:') && !/\.mp4(?:\?|$)/.test(item.imagem_url || '')) || pai?.configuracao?.sem_arte ? null : item.imagem_url || (item.tipo === 'aviso'
      ? `${String(supabaseUrl).replace(/\/$/, '')}/storage/v1/object/public/tarcisio/avisos/atencao-pastoral-v1.png` : null)
    if (!imagemPermitida(imagem, supabaseUrl)) {
      exigir(await db.from('tarcisio_envios').update({ estado: 'falhou', erro: 'Imagem fora da pasta do São Tarcísio: não enviada' }).eq('id', item.id), 'recusar imagem')
      log.warn(`envio ${item.id}: imagem recusada (${item.imagem_url})`)
      return
    }
    try {
      const texto = await talvezVariar(cfg, item)
      if ((item.tipo === 'aviso' || !imagem) && (typeof texto !== 'string' || !texto.trim()))
        throw new Error('Mensagem vazia: envio bloqueado; revise o texto do aviso.')
      if (imagem && /\.mp4(?:\?|$)/.test(imagem)) await evo.enviarVideo(destino, imagem, texto)
      else if (imagem) await evo.enviarImagem(destino, imagem, texto)
      else await evo.enviarTexto(destino, texto)
      exigir(await db.from('tarcisio_envios').update({ estado: 'enviado', enviado_em: agora.toISOString(), erro: null }).eq('id', item.id), 'marcar enviado')
    } catch (e) {
      const tentativas = item.tentativas + 1
      const desiste = e.semWhatsapp || String(item.chave_unica||'').startsWith('acolhida:') || tentativas >= 3
      exigir(await db.from('tarcisio_envios').update(desiste
        ? { estado: 'falhou', tentativas, erro: e.message }
        : { estado: 'pendente', tentativas, erro: e.message, agendado_para: new Date(+agora + 5 * MINUTO).toISOString() })
        .eq('id', item.id), 'registrar falha')
      log.warn(`envio ${item.id} (${item.tipo}) falhou: ${e.message}`)
    }
    st.proximoEnvioEm = +agora + pausaEntreEnvios(rnd)
  }

  // A IA varia SÓ o cumprimento do lembrete/parabéns (ajuda o chip a não parecer robô). Os fatos
  // (data, hora, local, função) seguem do texto fixo; cumprimento com número ou fora do padrão cai fora.
  async function talvezVariar(cfg, item) {
    if (!ia || !cfg.variar_textos || !['lembrete', 'aniversario'].includes(item.tipo) || !item.texto) return item.texto
    try {
      const c = await ia.texto({ modelo: cfg.ia_modelo, maxTokens: 60,
        sistema: `Você é ${cfg.persona_nome}, da pastoral dos coroinhas. Tom: ${cfg.persona_tom}`,
        pedido: `Escreva UMA saudação curta e diferente (até 80 caracteres, sem números, sem datas, sem horários) para abrir esta mensagem de ${item.tipo === 'lembrete' ? 'lembrete de escala' : 'aniversário'}. Responda só a saudação.` })
      const limpo = String(c || '').trim().replace(/^["“]|["”]$/g, '')
      if (!cumprimentoValido(limpo)) return item.texto
      return limpo + ' ' + item.texto.replace(/^Olá!\s*/, '')
    } catch (e) {
      log.warn(`variar texto: ${e.message}`)
      return item.texto
    }
  }

  // Conversas: responde quem escreveu (depois de 8 s de silêncio, para pegar a ideia inteira).
  // Mensagem com mais de 30 min sem resposta (respostas desligadas, robô fora) não é respondida tarde.
  async function cuidarConversas(cfg, agora) {
    if (!assistente) return
    const velho = new Date(+agora - 30 * MINUTO).toISOString()
    exigir(await db.from('tarcisio_mensagens').update({ respondida: true }).eq('direcao', 'entrada').eq('respondida', false).lt('created_at', velho), 'arquivar velhas')
    if (!cfg.respostas_ligadas || st.conexao !== 'open') return
    const novas = exigir(await db.from('tarcisio_mensagens').select('numero,created_at').eq('direcao', 'entrada').eq('respondida', false)
      .order('created_at', { ascending: false }).limit(200), 'ler conversas')
    const ultimaPorNumero = new Map()
    for (const m of novas) if (!ultimaPorNumero.has(m.numero)) ultimaPorNumero.set(m.numero, m.created_at)
    const prontos = [...ultimaPorNumero].filter(([, t]) => +agora - new Date(t) >= 8_000).map(([n]) => n).slice(0, 3)
    for (const numero of prontos) {
      try { await assistente.responder(cfg, numero, !!ia) } catch (e) { log.error(`[conversa ${numero.slice(-4)}] ${e.message}`) }
    }
  }

  // Rascunho de aviso pedido pela tela: a IA escreve, a coordenação revisa antes de salvar.
  async function cuidarRascunhos(cfg) {
    const pedidos = exigir(await db.from('tarcisio_ia_pedidos').select('id,entrada').eq('estado', 'pedido').order('created_at').limit(3), 'ler rascunhos')
    for (const p of pedidos) {
      if (!ia) { exigir(await db.from('tarcisio_ia_pedidos').update({ estado: 'falhou', erro: 'IA sem chave configurada' }).eq('id', p.id), 'rascunho'); continue }
      try {
        const saida = await ia.texto({ modelo: cfg.ia_modelo, maxTokens: 600,
          sistema: `Você é ${cfg.persona_nome}, o WhatsApp da Pastoral dos Coroinhas e Acólitos da Paróquia Jesus Cristo Bom Pastor (JCBP), Limeira. Tom: ${cfg.persona_tom}\nRegras: ${cfg.persona_regras}`,
          pedido: `Escreva um aviso de WhatsApp para os grupos da pastoral a partir desta ideia da coordenação. Use só as informações dadas, não invente data, hora nem lugar. Texto curto, sem markdown, no máximo dois emojis.\n\nIdeia: ${p.entrada}` })
        exigir(await db.from('tarcisio_ia_pedidos').update({ estado: 'pronto', saida }).eq('id', p.id), 'rascunho pronto')
      } catch (e) {
        exigir(await db.from('tarcisio_ia_pedidos').update({ estado: 'falhou', erro: e.message.slice(0, 300) }).eq('id', p.id), 'rascunho falhou')
      }
    }
  }

  // Mensagem velha não sai: lembrete de missa que passou, parabéns de ontem, arte da semana errada.
  // Acontece quando o número fica desconectado ou pausado por um tempo.
  const VALIDADE_HORAS = { lembrete: 12, aniversario: 12, aviso: 24, escala: 72 }
  async function expirar(agora) {
    for (const [tipo, horas] of Object.entries(VALIDADE_HORAS)) {
      exigir(await db.from('tarcisio_envios').update({ estado: 'cancelado', erro: 'Passou da hora: não foi enviado' })
        .eq('estado', 'pendente').eq('tipo', tipo).lt('created_at', new Date(+agora - horas * 60 * MINUTO).toISOString()), 'expirar')
    }
    // lembrete de ausência vale poucas horas: o texto fala de um prazo que passa
    exigir(await db.from('tarcisio_envios').update({ estado: 'cancelado', erro: 'Passou da hora: não foi enviado' })
      .eq('estado', 'pendente').like('chave_unica', 'ausencia:%').lt('created_at', new Date(+agora - 3 * 60 * MINUTO).toISOString()), 'expirar ausência')
  }

  async function iniciar() {
    // envio interrompido no meio (robô reiniciou) volta para a fila
    exigir(await db.from('tarcisio_envios').update({ estado: 'falhou',erro:'Envio de acolhida interrompido; conferir conversa antes de repetir.' }).eq('estado','enviando').like('chave_unica','acolhida:%'),'isolar acolhida interrompida')
    exigir(await db.from('tarcisio_envios').update({ estado: 'pendente' }).eq('estado', 'enviando'), 'destravar fila')
  }

  // Cada etapa isolada: a falha de uma (ex.: Evolution fora) não para as outras.
  async function rodada() {
    const agora = relogio()
    const sp = agoraSP(agora)
    const cfg = exigir(await db.from('tarcisio_config').select('*').eq('id', 1).single(), 'ler config')
    const etapas = [
      ['conexão', () => cuidarConexao(cfg, agora)],
      ['grupo do retiro', async () => {
        if (+agora >= LIMITE_RETIRO || +agora - st.grupoRetiroEm < MINUTO || st.conexao !== 'open') return
        st.grupoRetiroEm = +agora
        await prepararApresentacaoGrupos(db, evo)
        const grupo = await vincularGrupoRetiro(db, evo)
        if (grupo) log.info('Grupo de cerimoniários vinculado aos dois avisos do retiro')
      }],
      ['lembretes', () => gerarLembretes(cfg, sp)],
      ['aniversários', () => gerarAniversarios(cfg, sp)],
      ['avisos', () => gerarAvisos(cfg, agora, sp)],
      ['ausência', () => gerarLembreteAusencia(cfg, agora, sp)],
      ['escala', () => cuidarEscala(agora)],
      ['escala automática', () => escalaAuto?.cuidar(agora, cfg)],
      ['validade', () => expirar(agora)],
      ['acolhida', () => acolhida?.cuidar(agora,cfg)],
      ['conversas', () => cuidarConversas(cfg, agora)],
      ['rascunhos', () => cuidarRascunhos(cfg)],
      ['envio', () => enviarProximo(cfg, agora, sp)],
    ]
    for (const [nome, fazer] of etapas) {
      try { await fazer() } catch (e) { log.error(`[${nome}] ${e.message}`) }
    }
  }

  return { iniciar, rodada, estado: st }
}
