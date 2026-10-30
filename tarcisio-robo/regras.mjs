// Regras PURAS do São Tarcísio (sem banco, sem rede): quem recebe, em que número, com que texto
// e quando. O robo.mjs só busca os dados, chama estas funções e grava o resultado na fila.

export const FUSO = 'America/Sao_Paulo'

export const FUNCOES = {
  cred_altar: 'Cerimoniário de Altar', cred_credencia: 'Cerimoniário de Credência', missal: 'Missal',
  altar: 'Altar', turibulo: 'Turíbulo', naveta: 'Naveta', mitra: 'Mitra', baculo: 'Báculo',
  cruz: 'Cruz', vela: 'Velas', sineta: 'Sineta', sinao: 'Sinão', apoio: 'Apoio',
}
export const COMUNIDADES = { matriz: 'Matriz', santo_antonio: 'Santo Antônio' }
const DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']

// Espelho de NIVEL_INT (gerador-substituto.js): cerimoniário é nível >= 6.
const NIVEL_INT = {
  aspirante: 0, coroinha: 1, acolito_aspirante: 2, acolito_guardiao: 3, acolito_sentinela: 4,
  aspirante_cerimoniario: 5, cerimoniario_aspirante: 6, cerimoniario_guardiao: 7,
  cerimoniario_magistral: 8, cerimoniario_mor: 9,
}
export const ehCerimoniario = (m) => (NIVEL_INT[m.nivel] ?? 0) >= 6
export const PAPEIS_EQUIPE = ['coord_admin', 'subadmin', 'membro_equipe']

// Data e hora de Brasília, independente do fuso da máquina.
export function agoraSP(agora = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(agora).map((x) => [x.type, x.value]))
  return { data: `${p.year}-${p.month}-${p.day}`, hm: `${p.hour}:${p.minute}` }
}

export function somarDias(data, n) {
  const d = new Date(data + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export function diaPorExtenso(data) {
  const d = new Date(data + 'T12:00:00Z')
  return `${DIAS[d.getUTCDay()]}, ${d.getUTCDate()}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

// "08:00" <= hm < "21:00". Fora da janela nada sai: o item espera.
export const hmCurto = (t) => String(t || '').slice(0, 5)
export function dentroDaJanela(hm, inicio, fim) {
  return hm >= hmCurto(inicio) && hm < hmCurto(fim)
}

export function idade(dataNascimento, hoje) {
  if (!dataNascimento) return null
  const [a, m, d] = dataNascimento.split('-').map(Number)
  const [ha, hm, hd] = hoje.split('-').map(Number)
  return ha - a - ((hm < m || (hm === m && hd < d)) ? 1 : 0)
}

// Celular brasileiro → "55DDD9XXXXXXXX". Fixo, curto ou estranho → null (não manda).
export function normalizarNumero(bruto) {
  let n = String(bruto || '').replace(/\D/g, '').replace(/^0+/, '')
  if (n.length === 10 || n.length === 11) n = '55' + n
  // celular antigo sem o 9 (começa com 6–9); fixo começa com 2–5 e fica de fora
  if (n.length === 12 && n.startsWith('55') && /[6-9]/.test(n[4])) n = n.slice(0, 4) + '9' + n.slice(4)
  return /^55\d{2}9\d{8}$/.test(n) ? n : null
}

// Cerimoniários recebem no próprio número, inclusive menores (orientação de 25/10).
// Para os demais menores, mantém a prioridade do responsável.
export function numeroDoMembro(m, hoje) {
  if (ehCerimoniario(m) && normalizarNumero(m.telefone)) return normalizarNumero(m.telefone)
  const id = idade(m.data_nascimento, hoje)
  const menor = id == null || id < 18
  // mesma ordem do telefoneDeRecado() do app (telefones-core.js): recado, responsável, mãe
  const doResponsavel = normalizarNumero(m.celular_recado) || normalizarNumero(m.celular_responsavel) || normalizarNumero(m.celular_mae)
  if (menor) return doResponsavel || normalizarNumero(m.telefone)
  return normalizarNumero(m.telefone) || doResponsavel
}

// Avisos do retiro: o participante é o destinatário prioritário, independentemente da idade.
export function numeroDoParticipante(m) {
  return normalizarNumero(m.telefone) || normalizarNumero(m.celular_recado) || normalizarNumero(m.celular_responsavel) || normalizarNumero(m.celular_mae)
}

export const primeiroNome = (m) => (m.apelido || String(m.nome || '').trim().split(/\s+/)[0] || 'Servo')

export function rotuloMissa(c) {
  return `${c.horario} — ${COMUNIDADES[c.comunidade] || c.comunidade || 'local a confirmar'}`
}

const preencher = (modelo, vars) => modelo.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? `{${k}}`))
const comRodape = (texto, rodape) => (rodape ? `${texto}\n\n${rodape}` : texto)

// Lembrete da véspera: UMA mensagem por número, juntando irmãos e várias missas do dia.
// escalas: [{membro, celebracao, funcao}] de amanhã (só status 'escalado').
export function montarLembretes(escalas, { amanha, hoje, modelo, rodape }) {
  const porNumero = new Map()
  const semNumero = []
  for (const e of escalas) {
    const numero = numeroDoMembro(e.membro, hoje)
    if (!numero) { semNumero.push(e.membro); continue }
    if (!porNumero.has(numero)) porNumero.set(numero, [])
    porNumero.get(numero).push(e)
  }
  const envios = [...porNumero].map(([numero, lista]) => {
    lista.sort((a, b) => (a.celebracao.minutos ?? 0) - (b.celebracao.minutos ?? 0))
    const itens = lista.map((e) => `${primeiroNome(e.membro)} serve na missa das ${rotuloMissa(e.celebracao)}, função ${FUNCOES[e.funcao] || e.funcao}`).join('; ')
    return {
      tipo: 'lembrete', destino_numero: numero,
      destino_nome: [...new Set(lista.map((e) => primeiroNome(e.membro)))].join(', '),
      membro_id: lista[0].membro.id,
      texto: comRodape(preencher(modelo, { dia: diaPorExtenso(amanha), itens }), rodape),
      chave_unica: `lembrete:${amanha}:${numero}`,
    }
  })
  const semNumeroUnico = [...new Map(semNumero.map((m) => [m.id, m])).values()]
  return {
    envios,
    semNumero: semNumeroUnico.map((m) => ({
      tipo: 'lembrete', estado: 'sem_numero', membro_id: m.id, destino_nome: m.nome,
      erro: 'Sem telefone válido do servo ou responsável no cadastro', chave_unica: `lembrete:${amanha}:sem:${m.id}`,
    })),
  }
}

// Aniversário de hoje (29/02 cai em 28/02 nos anos comuns).
export function fazAnosHoje(m, hoje) {
  if (!m.data_nascimento) return false
  const [ano, mes, dia] = hoje.split('-').map(Number)
  const [, mm, dd] = m.data_nascimento.split('-').map(Number)
  const bissexto = (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0
  if (mm === 2 && dd === 29 && !bissexto) return mes === 2 && dia === 28
  return mm === mes && dd === dia
}

export function montarAniversarios(membros, { hoje, modelo, rodape }) {
  const ano = hoje.slice(0, 4)
  return membros.filter((m) => fazAnosHoje(m, hoje)).map((m) => {
    const numero = numeroDoMembro(m, hoje)
    const chave = `aniv:${m.id}:${ano}`
    if (!numero) return { tipo: 'aniversario', estado: 'sem_numero', membro_id: m.id, destino_nome: m.nome, erro: 'Sem WhatsApp no cadastro', chave_unica: chave }
    return {
      tipo: 'aniversario', destino_numero: numero, destino_nome: m.nome, membro_id: m.id,
      texto: comRodape(preencher(modelo, { nome: primeiroNome(m) }), rodape), chave_unica: chave,
    }
  })
}

// Público do aviso no privado → números sem repetição.
export function publicoPrivado(papeis, membros, { hoje, papelDoUsuario }) {
  const quer = new Set(papeis)
  const numeros = new Map()
  for (const m of membros) {
    const papel = m.user_id ? papelDoUsuario.get(m.user_id) : null
    const entra = quer.has('pais')
      || (quer.has('acolitos') && !ehCerimoniario(m))
      || (quer.has('cerimoniarios') && ehCerimoniario(m))
      || (quer.has('equipe') && PAPEIS_EQUIPE.includes(papel))
    if (!entra) continue
    const destinos = []
    // Pais são um público explícito: não redirecionar o aviso deles para o filho.
    if (quer.has('pais')) destinos.push(normalizarNumero(m.celular_recado) || normalizarNumero(m.celular_responsavel)
      || normalizarNumero(m.celular_mae) || normalizarNumero(m.telefone))
    if ((quer.has('acolitos') && !ehCerimoniario(m)) || (quer.has('cerimoniarios') && ehCerimoniario(m)))
      destinos.push(numeroDoMembro(m, hoje))
    if (quer.has('equipe') && PAPEIS_EQUIPE.includes(papel)) destinos.push(normalizarNumero(m.telefone) || numeroDoMembro(m, hoje))
    for (const numero of destinos) if (numero && !numeros.has(numero)) numeros.set(numero, m)
  }
  return [...numeros].map(([numero, m]) => ({ numero, membro: m }))
}

// Próxima saída de um aviso que se repete; null = acabou (desliga o aviso).
export function proximaVez(quandoIso, repetir, ate) {
  if (repetir === 'nao') return null
  const d = new Date(quandoIso)
  if (repetir === 'diario') d.setUTCDate(d.getUTCDate() + 1)
  else if (repetir === 'semanal') d.setUTCDate(d.getUTCDate() + 7)
  else if (repetir === 'mensal') {
    const dia = d.getUTCDate()
    d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + 1)
    const ultimo = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
    d.setUTCDate(Math.min(dia, ultimo))
  } else return null
  if (ate && agoraSP(d).data > ate) return null
  return d.toISOString()
}

// Pausa entre envios: 20–40 s, sorteada, para o número não parecer robô em rajada.
export const pausaEntreEnvios = (rnd = Math.random) => 20_000 + Math.floor(rnd() * 20_000)

// Imagem só das pastas do próprio projeto (avisos e artes da escala). A Evolution baixa o link de
// DENTRO da VPS: um link livre a faria buscar endereços internos (a Evolution da SATOR ou da Pink).
// O banco tem a mesma trava (migration 100); esta é a segunda.
export function imagemPermitida(url, supabaseUrl) {
  if (!url) return true
  const base = String(supabaseUrl || '').replace(/\/$/, '') + '/storage/v1/object/public/'
  return ['tarcisio/', 'artes-escala/'].some((pasta) => String(url).startsWith(base + pasta))
}

// ── Fase 2: o assistente ─────────────────────────────────────────────────────────────

// Segunda a domingo da semana de `data` (texto AAAA-MM-DD).
export function semanaDe(data) {
  const d = new Date(data + 'T12:00:00Z')
  const seg = new Date(d); seg.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
  const dom = new Date(seg); dom.setUTCDate(seg.getUTCDate() + 6)
  return { inicio: seg.toISOString().slice(0, 10), fim: dom.toISOString().slice(0, 10) }
}

// A semana está confirmada quando "Confirmar escala da semana" gravou a chave dela em
// acolitos_config.escala_avisados (a chave é a menor data das missas daquela semana).
export function semanaConfirmada(data, mapaAvisados) {
  const { inicio, fim } = semanaDe(data)
  return Object.keys(mapaAvisados || {}).some((k) => k >= inicio && k <= fim)
}

// Servos ligados a um número: o próprio (telefone) ou de quem ele é responsável.
export function membrosDoNumero(numero, membros) {
  return membros.filter((m) => [m.telefone, m.celular_recado, m.celular_responsavel, m.celular_mae]
    .some((t) => normalizarNumero(t) === numero))
}

// Irmãos que servem JUNTO entram na mesma ausência — mesma regra das telas do app.
export function comIrmaosJuntos(membro, membros) {
  if (!membro.grupo_irmaos || !membro.escalar_com_irmao) return [membro]
  return membros.filter((m) => m.id === membro.id || (m.grupo_irmaos === membro.grupo_irmaos && m.escalar_com_irmao))
}

// Comparação de nome sem acento, caixa ou espaço duplo.
export const nomeLimpo = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

// Candidatos para um número desconhecido: todas as palavras do nome batem; data confere se veio.
export function candidatosPorNome(nomeCompleto, nascimento, membros) {
  const partes = nomeLimpo(nomeCompleto).split(' ').filter((p) => p.length > 1)
  if (partes.length < 2) return []
  return membros.filter((m) => {
    const nome = nomeLimpo(m.nome)
    if (!partes.every((p) => nome.includes(p))) return false
    return !nascimento || !m.data_nascimento || m.data_nascimento === nascimento
  })
}

// Cumprimento variado da IA: curto, sem número nenhum (data, hora e função vêm do texto fixo).
// Qualquer coisa fora disso é descartada e o texto sai só com o modelo.
export function cumprimentoValido(t) {
  const s = String(t || '').trim()
  return s.length >= 3 && s.length <= 90 && !/\d/.test(s) && !/[\n{}]/.test(s)
}

// ── lembrete de ausência: domingo, segunda e terça (prazo: terça 18h, Brasília) ──
export const LINK_AUSENCIAS = 'https://coroinhas.jcbplimeira.com.br/ausencias'
export const PRAZO_AUSENCIA = '18:00'

export function textoPadraoAusencia(ultimo) {
  const linhas = [
    'Paz e bem, pessoal! Se você ou seu filho(a) não puder servir no próximo fim de semana, por favor avise as ausências.',
    `Pode ser pelo link ${LINK_AUSENCIAS} ou direto no app dos Acólitos.`,
    'O prazo é até terça-feira, 18h.',
  ]
  if (ultimo) linhas.push('Este é o último lembrete.')
  linhas.push('Obrigado!')
  return linhas.join('\n')
}

const minutos = (hm) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5))
export const JANELA_RECUPERACAO_MIN = 30

// Depois da terça 18h o prazo acabou: nada de ausência sai.
export function ausenciaVencida(sp) {
  const dia = new Date(sp.data + 'T12:00:00Z').getUTCDay()
  return dia > 2 || (dia === 2 && sp.hm > PRAZO_AUSENCIA)
}

// sp = agoraSP(...). Dispara no horário configurado ou até 30 min depois (robô reiniciado,
// pausa que acabou). A chave usa o horário do SLOT, então cada slot sai uma única vez.
export function lembreteAusenciaAgora(sp, cfg) {
  if (ausenciaVencida(sp)) return null
  const dia = new Date(sp.data + 'T12:00:00Z').getUTCDay()
  const slots = (cfg.ausencia_horas || []).map(hmCurto).map((hm) => ({ hm, ultimo: false }))
  if (dia === 2 && cfg.ausencia_ultimo) slots.push({ hm: hmCurto(cfg.ausencia_ultimo), ultimo: true })
  const agora = minutos(sp.hm)
  const vale = slots.filter((x) => minutos(x.hm) <= agora && agora - minutos(x.hm) < JANELA_RECUPERACAO_MIN)
    .sort((a, b) => minutos(b.hm) - minutos(a.hm))
  const slot = vale.find((x) => x.ultimo) || vale[0]
  if (!slot) return null
  const base = cfg.ausencia_texto || textoPadraoAusencia(slot.ultimo)
  return {
    texto: base.includes(LINK_AUSENCIAS) ? base : `${base}\n\n📌 Registre sua ausência pelo link universal:\n${LINK_AUSENCIAS}`,
    chave: `ausencia:${sp.data}:${slot.hm}`,
  }
}

// Mensagem que só encerra a conversa ("obrigado", "ok", "amém", 👍): quem manda isso não quer resposta.
// Responder vira o "em que posso ajudar hoje?" que a IA inventa. Pergunta nunca é despedida.
const PALAVRAS_FORTES = new Set(['obrigado', 'obrigada', 'obg', 'obgd', 'valeu', 'vlw', 'ok', 'okay', 'okk', 'blz', 'beleza', 'certo', 'combinado',
  'show', 'perfeito', 'amem', 'tchau', 'ate', 'fechado', 'entendi', 'entendido', 'otimo', 'maravilha', 'disponha', 'deus', 'gracas', 'abencoe', 'tranquilo'])
const PALAVRAS_LIGACAO = new Set(['muito', 'demais', 'a', 'de', 'nada', 'ta', 'bom', 'tudo', 'logo', 'mais', 'proxima', 'domingo', 'sabado', 'e', 'o', 'vcs', 'voces', 'pra', 'para', 'todos', 'vos', 'te', 'lhe', 'abencoar', 'bem', 'abencoa', 'obrigadinho', 'tarcisio'])
export function ehDespedida(texto) {
  const t = String(texto ?? '').trim()
  if (!t || t.includes('?')) return false
  const limpo = t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
  if (!limpo) return !/[a-z0-9]/i.test(t.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))   // só emoji e pontuação
  const palavras = limpo.split(' ')
  if (palavras.length > 7) return false
  return palavras.every((w) => PALAVRAS_FORTES.has(w) || PALAVRAS_LIGACAO.has(w)) && palavras.some((w) => PALAVRAS_FORTES.has(w))
}
