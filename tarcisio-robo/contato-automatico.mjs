// Detecta número que é robô de empresa (chatbot, resposta automática, SAC) para o Tarcísio parar de
// responder. Dois robôs conversando entre si gastam chave de IA sem fim. Regras PURAS, sem banco nem rede.

const sem = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// Frases típicas de atendimento automático. Uma basta para número desconhecido.
const PADROES_ROBO = [
  /mensagem automatica/, /resposta automatica/, /atendimento automatico/, /atendimento virtual/,
  /assistente virtual/, /\bchatbot\b/, /nao responda (a |esta |essa )?mensagem/,
  /digite (o numero|a opcao|\d)/, /(escolha|selecione|informe) (uma|a) (das )?opc/, /\bpara (continuar|prosseguir),? (digite|escolha|selecione)/,
  /horario de atendimento/, /fora do horario (de atendimento|comercial)/, /estamos (fechados|ausentes|fora do expediente)/,
  /retornaremos (o mais breve|em breve|assim que)/, /\bprotocolo\b.{0,40}\d{6,}/, /\bsac\b/, /\bcnpj\b/,
  /em que (posso|podemos) (te |lhe )?ajudar.{0,80}(digite|opcao|menu)/, /(menu|opcoes) (abaixo|a seguir|disponiveis)/,
  /esta e uma mensagem/, /sua mensagem foi recebida/, /agradecemos (o seu |seu )?contato/,
]
// Menu numerado: duas ou mais linhas começando com "1 -", "2)", "3."…
const MENU = /(^|\n)\s*[1-9]\s*[-–).:]\s*\S[^\n]*\n\s*[1-9]\s*[-–).:]\s*\S/

export const LIMITES = {
  janelaMin: 10, saidasNaJanela: 5,            // 5 respostas nossas em 10 min = conversa em ritmo de máquina
  saidasPorDia: 12, saidasPorDiaConhecido: 30, // teto duro em 24 h
  latenciaRoboMs: 6000, parRapidos: 3,         // 3 respostas em até 6 s depois de nós = máquina
  repetidas: 3,                                // mesma frase 3 vezes
}

const ehPadraoRobo = (texto) => {
  const t = sem(texto)
  return PADROES_ROBO.some((r) => r.test(t)) || MENU.test(String(texto || '').replace(/\r/g, ''))
}

// historico: [{direcao:'entrada'|'saida', texto, created_at}] das últimas 24 h, qualquer ordem.
// novas: mensagens de entrada ainda sem resposta. conhecido: número ligado a um servo.
// Devolve { automatico: boolean, motivo }.
export function avaliarContato({ historico = [], novas = [], conhecido = false, agora = new Date() }) {
  const linhas = [...historico].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  const entradas = [...linhas.filter((l) => l.direcao === 'entrada'), ...novas.filter((n) => !linhas.some((l) => l.id && l.id === n.id))]
  const saidas = linhas.filter((l) => l.direcao === 'saida')

  const roboNoTexto = novas.filter((n) => ehPadraoRobo(n.texto)).length
  // Conhecido (pai, servo) pode citar "horário de atendimento" numa frase normal: exige 2 mensagens com sinal.
  if (roboNoTexto >= (conhecido ? 2 : 1)) return { automatico: true, motivo: 'texto de atendimento automático (menu, protocolo ou aviso de horário)' }

  const desde = (min) => saidas.filter((s) => +agora - new Date(s.created_at) <= min * 60000).length
  if (desde(LIMITES.janelaMin) >= LIMITES.saidasNaJanela) return { automatico: true, motivo: `${LIMITES.saidasNaJanela} respostas nossas em ${LIMITES.janelaMin} min: conversa em ritmo de máquina` }
  const teto = conhecido ? LIMITES.saidasPorDiaConhecido : LIMITES.saidasPorDia
  if (saidas.length >= teto) return { automatico: true, motivo: `${saidas.length} respostas nossas em 24 h (teto ${teto})` }

  // Latência: quanto tempo a entrada seguinte demora depois de uma saída nossa.
  let rapidos = 0
  for (let i = 1; i < linhas.length; i++) {
    if (linhas[i].direcao === 'entrada' && linhas[i - 1].direcao === 'saida'
      && new Date(linhas[i].created_at) - new Date(linhas[i - 1].created_at) <= LIMITES.latenciaRoboMs) rapidos++
  }
  if (rapidos >= LIMITES.parRapidos) return { automatico: true, motivo: `${rapidos} respostas do contato em menos de ${LIMITES.latenciaRoboMs / 1000} s depois das nossas` }

  const contagem = new Map()
  for (const e of entradas) {
    const t = sem(e.texto).replace(/\s+/g, ' ').trim()
    if (t.length >= 12) contagem.set(t, (contagem.get(t) || 0) + 1)
  }
  if ([...contagem.values()].some((c) => c >= LIMITES.repetidas)) return { automatico: true, motivo: 'o contato repete a mesma mensagem' }

  return { automatico: false }
}
