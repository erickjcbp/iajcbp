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

// Número que recebe pelo membro. Menor (ou sem data de nascimento) → só o responsável;
// maior → o próprio. Decisão do dono: menor recebe SÓ no número do responsável.
export function numeroDoMembro(m, hoje) {
  const id = idade(m.data_nascimento, hoje)
  const menor = id == null || id < 18
  // mesma ordem do telefoneDeRecado() do app (telefones-core.js): recado, responsável, mãe
  const doResponsavel = normalizarNumero(m.celular_recado) || normalizarNumero(m.celular_responsavel) || normalizarNumero(m.celular_mae)
  if (menor) return doResponsavel
  return normalizarNumero(m.telefone) || doResponsavel
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
      erro: 'Sem WhatsApp do responsável no cadastro', chave_unica: `lembrete:${amanha}:sem:${m.id}`,
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
    // equipe recebe no próprio número; os demais pela regra do responsável
    const numero = (quer.has('equipe') && PAPEIS_EQUIPE.includes(papel) && normalizarNumero(m.telefone)) || numeroDoMembro(m, hoje)
    if (numero && !numeros.has(numero)) numeros.set(numero, m)
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
