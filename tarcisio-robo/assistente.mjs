// O assistente do São Tarcísio: responde quem escreve, com os dados do app e ferramentas travadas.
// A IA decide o QUE fazer; o código decide o que é PERMITIDO (servo ligado ao número, data futura,
// semana não confirmada). A IA nunca liga número a cadastro: isso é da coordenação, pela Caixa.
import {
  agoraSP, normalizarNumero, somarDias, membrosDoNumero, comIrmaosJuntos, semanaConfirmada, candidatosPorNome,
  diaPorExtenso, rotuloMissa, FUNCOES, primeiroNome,
} from './regras.mjs'
import { avaliarContato } from './contato-automatico.mjs'

const CAMPOS = 'id,nome,apelido,nivel,user_id,data_nascimento,telefone,celular_recado,celular_responsavel,celular_mae,grupo_irmaos,escalar_com_irmao'
const MOTIVOS = ['doenca', 'viagem', 'familia', 'outro']

const exigir = ({ data, error }, onde) => {
  if (error) throw new Error(`${onde}: ${error.message}`)
  return data
}

const FERRAMENTAS_CONHECIDO = [
  { name: 'escala_dos_meus', description: 'Escala dos próximos 45 dias dos servos ligados a este número: data, horário, local, função e se a semana já está confirmada.', input_schema: { type: 'object', properties: {} } },
  { name: 'registrar_ausencia', description: 'Registra ausência de UM servo ligado a este número em uma ou mais datas futuras. Datas de semana já confirmada NÃO são registradas e voltam na lista "confirmadas".',
    input_schema: { type: 'object', required: ['membro_id', 'datas'], properties: {
      membro_id: { type: 'string', description: 'id do servo, da lista de servos ligados' },
      datas: { type: 'array', items: { type: 'string', description: 'AAAA-MM-DD' }, minItems: 1, maxItems: 12 },
      motivo: { type: 'string', enum: MOTIVOS }, observacao: { type: 'string', maxLength: 200 } } } },
  { name: 'chamar_coordenacao', description: 'Passa o assunto para a coordenação (aparece na Caixa do app). Use quando não souber responder ou o pedido não couber nas outras ferramentas.',
    input_schema: { type: 'object', required: ['resumo'], properties: { resumo: { type: 'string', maxLength: 500 } } } },
]
const FERRAMENTAS_DESCONHECIDO = [
  { name: 'identificar', description: 'Use SÓ depois de ter o nome COMPLETO do servo, a data de nascimento (ou idade) e quem está falando. Abre o pedido para a coordenação ligar este número ao cadastro. Não devolve dados do cadastro.',
    input_schema: { type: 'object', required: ['nome_completo', 'relacao'], properties: {
      nome_completo: { type: 'string' }, data_nascimento: { type: 'string', description: 'AAAA-MM-DD, se souber' },
      idade: { type: 'integer' }, relacao: { type: 'string', enum: ['proprio', 'pai', 'mae', 'responsavel'] },
      nome_de_quem_fala: { type: 'string' } } } },
  FERRAMENTAS_CONHECIDO[2],
]

export function criarAssistente({ db, evo, ia, relogio = () => new Date(), log = console, acolhida = null }) {
  async function membrosQueServem() {
    return exigir(await db.from('acolitos_membros').select(CAMPOS).eq('status', 'ativo').eq('serve', true), 'ler membros')
  }
  async function mapaAvisados() {
    const r = exigir(await db.from('acolitos_config').select('valor').eq('chave', 'escala_avisados').maybeSingle(), 'ler semanas confirmadas')
    return (r && typeof r.valor === 'object' && r.valor) || {}
  }
  async function pendencia(tipo, numero, resumo, dados = {}) {
    exigir(await db.from('tarcisio_pendencias').insert({ tipo, numero, resumo, dados }), 'abrir pendência')
  }

  function executorPara(numero, ligados, todos) {
    const ids = new Set(ligados.map((m) => m.id))
    return async (nome, e) => {
      const hoje = agoraSP(relogio()).data
      if (nome === 'escala_dos_meus') {
        if (!ligados.length) return { erro: 'número não ligado a nenhum servo' }
        const ate = somarDias(hoje, 45)
        const linhas = exigir(await db.from('acolitos_escalas')
          .select('funcao,membro_id,acolitos_celebracoes!inner(data,horario,comunidade,minutos)')
          .in('membro_id', [...ids]).eq('status', 'escalado')
          .gte('acolitos_celebracoes.data', hoje).lte('acolitos_celebracoes.data', ate), 'ler escala')
        const mapa = await mapaAvisados()
        const nomeDe = new Map(ligados.map((m) => [m.id, primeiroNome(m)]))
        return { hoje, escala: linhas.map((l) => ({ servo: nomeDe.get(l.membro_id), data: l.acolitos_celebracoes.data,
          dia: diaPorExtenso(l.acolitos_celebracoes.data), missa: rotuloMissa(l.acolitos_celebracoes), funcao: FUNCOES[l.funcao] || l.funcao,
          semana_confirmada: semanaConfirmada(l.acolitos_celebracoes.data, mapa) }))
          .sort((a, b) => a.data.localeCompare(b.data)) }
      }
      if (nome === 'registrar_ausencia') {
        const alvo = ligados.find((m) => m.id === e.membro_id)
        if (!alvo) return { erro: 'este servo não está ligado a este número' }
        const datas = [...new Set((e.datas || []).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)))]
        const passadas = datas.filter((d) => d < hoje)
        const mapa = await mapaAvisados()
        const confirmadas = datas.filter((d) => d >= hoje && semanaConfirmada(d, mapa))
        const livres = datas.filter((d) => d >= hoje && !semanaConfirmada(d, mapa))
        const servos = comIrmaosJuntos(alvo, todos)
        if (livres.length) {
          const quem = servos.map((m) => m.id)
          exigir(await db.from('acolitos_ausencias').delete().in('membro_id', quem).in('data', livres).is('celebracao_id', null), 'limpar ausência')
          const motivo = MOTIVOS.includes(e.motivo) ? e.motivo : 'outro'
          const obs = ['Pelo WhatsApp do São Tarcísio', e.observacao].filter(Boolean).join(': ').slice(0, 240)
          exigir(await db.from('acolitos_ausencias').insert(livres.flatMap((d) => quem.map((id) => ({ membro_id: id, data: d, celebracao_id: null, motivo, observacao: obs })))), 'registrar ausência')
        }
        return { registradas: livres, confirmadas_nao_mudam: confirmadas, passadas_ignoradas: passadas,
          tambem_para: servos.filter((m) => m.id !== alvo.id).map(primeiroNome) }
      }
      if (nome === 'chamar_coordenacao') {
        const resumo = String(e.resumo || '').slice(0, 500)
        // Mesmo número com pendência aberta nas últimas 24 h: atualiza em vez de abrir outra (a Lívia gerou 4 iguais).
        const desde = new Date(relogio().getTime() - 24 * 3600 * 1000).toISOString()
        const abertas = exigir(await db.from('tarcisio_pendencias').select('id').eq('tipo', 'coordenacao').eq('numero', numero)
          .eq('estado', 'aberta').gte('created_at', desde).order('created_at', { ascending: false }).limit(1), 'ler pendência aberta')
        if (abertas?.length) exigir(await db.from('tarcisio_pendencias').update({ resumo }).eq('id', abertas[0].id), 'atualizar pendência')
        else await pendencia('coordenacao', numero, resumo, { servos: ligados.map((m) => ({ id: m.id, nome: m.nome })) })
        return { ok: true }
      }
      if (nome === 'identificar') {
        if (ligados.length) return { erro: 'número já ligado' }
        const nasc = /^\d{4}-\d{2}-\d{2}$/.test(e.data_nascimento || '') ? e.data_nascimento : null
        const candidatos = candidatosPorNome(e.nome_completo, nasc, todos)
        await pendencia('vincular_numero', numero, `Ligar número ao servo "${e.nome_completo}" (${e.relacao})`, {
          nome_completo: e.nome_completo, data_nascimento: nasc, idade: e.idade ?? null, relacao: e.relacao,
          quem_fala: e.nome_de_quem_fala || null, candidatos: candidatos.slice(0, 5).map((m) => ({ id: m.id, nome: m.nome, data_nascimento: m.data_nascimento })) })
        return { ok: true, encaminhado_para_coordenacao: true }   // nada do cadastro volta para a conversa
      }
      return { erro: 'ferramenta desconhecida' }
    }
  }

  function sistema(cfg, ligados, hoje) {
    const quem = ligados.length
      ? 'Este número está ligado a: ' + ligados.map((m) => `${m.nome} (id ${m.id})`).join('; ') + '. Fale só destes servos.'
      : 'Este número NÃO está ligado a nenhum cadastro. Não fale de escala nem registre nada. Peça, com gentileza e uma coisa por vez: o nome COMPLETO do servo, a data de nascimento (ou a idade) e quem está falando (o próprio servo, pai, mãe ou outro responsável). Só com isso use a ferramenta identificar e diga que a coordenação vai confirmar o cadastro.'
    return [
      `Você é ${cfg.persona_nome}, o WhatsApp da Pastoral dos Coroinhas e Acólitos da Paróquia Jesus Cristo Bom Pastor (JCBP), em Limeira.`,
      `Tom: ${cfg.persona_tom}`,
      `Regras: ${cfg.persona_regras}`,
      `Hoje é ${diaPorExtenso(hoje)} (${hoje}), horário de Brasília.`,
      quem,
      'Ausência: a ferramenta não altera automaticamente semanas já confirmadas; informe as datas registradas e encaminhe pedidos de alteração. Isso não significa que a coordenação não possa corrigir um erro.',
      'Se a família contestar uma informação ou correção nossa, leve a contestação a sério. Consulte os dados atuais e encaminhe a divergência com chamar_coordenacao, preservando o relato da família. Não reafirme como verdade o que nós mesmos acabamos de alterar, não diga que a escala não muda nem peça à pessoa para procurar alguém na igreja. Não declare horários dos pais ministros sem fonte confirmada.',
      'Quando faltar informação suficiente ou houver vínculo de ministro incerto, use chamar_coordenacao para deixar a validação na Caixa do dono. Não deduza identidade por primeiro nome, não altere escala e não envie uma correção à família antes da validação. A presença do outro pai/mãe na mesma missa é pista de conferência, não prova isolada.',
      'Mensagens de ajuste devem ser naturais e breves, com o primeiro nome e apenas data, horário e local necessários. Evite nome completo de cadastro, linguagem administrativa como Ficou registrado, explicações longas e justificativas defensivas. Se houve erro nosso, reconheça-o diretamente e só confirme a correção após resultado da ferramenta.',
      'Só diga que fez algo (registrou, encaminhou, consultou) se chamou a ferramenta NESTA resposta e ela devolveu ok. Nunca prometa antes de chamar.',
      'Para dizer se uma semana está confirmada, chame escala_dos_meus de novo: o estado muda ao longo do dia. Nunca repita de memória.',
      'Se a pessoa diz que já registrou ausência pelo link ou já avisou antes, isso NÃO é pedido de ausência: agradeça, não registre e, se houver dúvida a resolver, chame chamar_coordenacao UMA vez para o assunto.',
      'Responda só ao que a pessoa perguntou: uma saudação recebe uma saudação curta; não consulte escala nem traga assunto antigo da conversa se ninguém perguntou.',
      'Leia o histórico para dar continuidade natural. Se já houve conversa, não se reapresente nem repita Oi/Olá ou Aqui é o Tarcísio em cada resposta. Vá direto ao assunto com o contexto do que a pessoa acabou de dizer. Apresente-se apenas no primeiro contato ou se perguntarem quem está falando; uma saudação nova da pessoa pode receber saudação curta, sem reapresentação.',
      'Responda em português do Brasil, em mensagem curta de WhatsApp, sem markdown.',
    ].join('\n')
  }

  // Número que é robô de empresa: encerra a conversa SEM responder (qualquer despedida alimentaria o laço
  // e gastaria chave de IA). Fica uma pendência aberta na Caixa; descartá-la libera o número.
  async function contatoAutomatico(cfg, numero, pendentes, conhecido) {
    if (cfg?.numero_conferencia && normalizarNumero(cfg.numero_conferencia) === numero) return false
    const marca = { contato_automatico: true }
    const bloqueio = exigir(await db.from('tarcisio_pendencias').select('id').eq('tipo', 'coordenacao').eq('numero', numero)
      .eq('estado', 'aberta').contains('dados', marca).limit(1), 'ler bloqueio de robô')
    if (bloqueio?.length) return true
    const agora = relogio()
    const historico = exigir(await db.from('tarcisio_mensagens').select('id,direcao,texto,created_at').eq('numero', numero)
      .gte('created_at', new Date(+agora - 24 * 3600 * 1000).toISOString()).order('created_at', { ascending: false }).limit(80), 'ler histórico do robô') || []
    const r = avaliarContato({ historico, novas: pendentes.map((p) => ({ ...p, created_at: p.created_at })), conhecido, agora })
    if (!r.automatico) return false
    await pendencia('coordenacao', numero, `Parece atendimento automático (robô de empresa): parei de responder. ${r.motivo}. Se for pessoa, descarte esta pendência para liberar o número.`, { ...marca, motivo: r.motivo })
    log.warn(`robô de empresa ${numero.slice(0, 4)}…${numero.slice(-2)}: conversa encerrada (${r.motivo})`)
    return true
  }

  // Responde um número: junta o histórico recente, conversa com a IA e envia a resposta.
  async function responder(cfg, numero, chaveIA) {
    const pendentes = exigir(await db.from('tarcisio_mensagens').select('id,texto,midia,created_at').eq('numero', numero)
      .eq('direcao', 'entrada').eq('respondida', false).order('created_at'), 'ler mensagens novas')
    if (!pendentes.length) return
    const marcar = async (extra = {}) => exigir(await db.from('tarcisio_mensagens').update({ respondida: true, ...extra })
      .in('id', pendentes.map((p) => p.id)), 'marcar respondida')
    const todos = await membrosQueServem()
    const acolhimento=await acolhida?.contexto(numero);
    const ligados = membrosDoNumero(numero, todos);for(const a of acolhimento||[])if(!ligados.some(m=>m.id===a.membro.id))ligados.push(a.membro)
    if (await contatoAutomatico(cfg, numero, pendentes, ligados.length > 0)) return marcar()
    let texto
    let usadas = []
    const comandoAcolhida=acolhimento?.length?await acolhida.comando(numero,pendentes):null;
    if(comandoAcolhida){texto=comandoAcolhida;} else if (pendentes.every((p) => !p.texto)) {
      texto = 'Por aqui eu só consigo ler mensagens de texto. Pode escrever o que precisa? 🙏'
    } else if (!chaveIA) {
      return   // sem chave da IA: fica guardado, sem resposta (Configurações mostra o aviso)
    } else {
      const hist = exigir(await db.from('tarcisio_mensagens').select('direcao,texto,midia').eq('numero', numero)
        .order('created_at', { ascending: false }).limit(20), 'ler histórico').reverse()
      const mensagens = []
      for (const h of hist) {
        const role = h.direcao === 'entrada' ? 'user' : 'assistant'
        const conteudo = h.texto || `[${h.midia || 'mídia'} sem texto]`
        if (mensagens.length && mensagens.at(-1).role === role) mensagens.at(-1).content += '\n' + conteudo
        else mensagens.push({ role, content: conteudo })
      }
      while (mensagens.length && mensagens[0].role !== 'user') mensagens.shift()
      if (!mensagens.length) return marcar()
      const hoje = agoraSP(relogio()).data
      const ferramentas=ligados.length?[...FERRAMENTAS_CONHECIDO]:[...FERRAMENTAS_DESCONHECIDO];const executarPadrao=executorPara(numero,ligados,todos);let contextoAcolhida='';if(acolhimento?.length){ferramentas.push({name:'registrar_acolhida',description:'Registra UM fato explícito da mensagem atual ou pausa/retomada pedida. Não inferir por silêncio, previsão ou prazo. Envio de catequese não é aprendizado comprovado.',input_schema:{type:'object',required:['membro_id','mensagem_id','marco'],properties:{membro_id:{type:'string'},mensagem_id:{type:'string'},marco:{type:'string',enum:['contato_raquel','pedido_confirmado','confeccao_iniciada','tunica_recebida','respondeu_tunica','integracao_realizada','grupo_confirmado','pausar','retomar','interacao']}}}});contextoAcolhida='\nVocê também acompanha a acolhida. Dados atuais: '+JSON.stringify(acolhimento.map(a=>({id:a.membro.id,nome:a.membro.nome,canal:a.canal,etapa:a.etapa,marcos:a.estado.marcos,ultimo_encontro:a.estado.ultimo_encontro,pausado:a.estado.pausado})))+'\nMensagem(ns) atual(is), com IDs para comprovar fatos: '+JSON.stringify(pendentes.map(p=>({id:p.id,texto:p.texto})))+'\nRegras da acolhida: (1) Os números ligados acima SÃO os membros em questão; se só há um membro ligado, os fatos são dele, sem pedir o nome. Apelidos valem (ex.: Bia = Beatriz). Se há vários, confirme de qual se trata. (2) Os encontros de formação NÃO são presenciais (são 14 textos curtos, 2 por semana, terça e quinta, por volta de 7 semanas; cada um é uma leitura rápida; se perguntarem quanto duram, responda isso, sem encaminhar à coordenação):  são textos curtos que você envia por este WhatsApp às terças e quintas, para ler a qualquer hora, sem comparecer e sem avisar ausência. NUNCA registre ausência por causa dos encontros e nunca fale em horário de comparecimento. Se a pessoa entender que é presencial, corrija com gentileza. Só explique os encontros depois que a família responder sobre a túnica; o primeiro texto de formação já traz a explicação. (2b) registrar_acolhida só vale para os membros listados em "Dados atuais" da acolhida. Outros cadastros ligados ao mesmo número não estão em acompanhamento: se só há um membro em "Dados atuais", os fatos sobre túnica são dele; NÃO pergunte de qual cadastro se trata nem cite os outros. (3) Sempre que a pessoa falar da túnica, registre com registrar_acolhida: tunica_recebida se disse que já tem, recebeu, buscou, está usando ou já serviu com ela (comemore com a pessoa; diga que a coordenação confirma a conclusão no CRM e que, confirmada, ela passa a aspirante, apta em apoio; não diga que já saiu do CRM); respondeu_tunica para qualquer outra resposta sobre a túnica (medidas marcadas, ainda não pediu, vai buscar, pronta mas não retirada). Se a túnica está pronta mas ainda não foi retirada, não é recebida. Responda de acordo com o que registrou e só afirme o que a ferramenta confirmou. (4) Quem está na etapa integracao recebe de você um vídeo curto apresentando a pastoral (o que é, missas, escala e ausências, vestes e roupas, chegada e conduta). Responda dúvidas com o que o vídeo e as ferramentas trazem; não invente regra. Quando a família disser que assistiu e entendeu (ex.: \"li e entendi\"), registre integracao_realizada: a coordenação segue com o grupo de WhatsApp. Para mães/responsáveis, proponha leitura para conversar com o filho; para o jovem, fale com ele. A família trata diretamente com a Raquel, +55 19 99195-8657, medidas, valor, pagamento e prazo; 30-45 dias é só referência. Nunca prometa data, preço, admissão ou aptidão além do que o sistema registrou. Se estiver pausado, respeite; só retome por pedido explícito. Para dizer que atualizou o CRM, execute registrar_acolhida com sucesso. O executor interpreta semanticamente a mensagem, sem exigir palavras-chave. Se retornar confirmacao_necessaria, faça uma pergunta curta à própria pessoa para esclarecer o que falta; não chame a coordenação apenas por ambiguidade e não diga que registrou. Só encaminhe se for uma questão real da coordenação ou se a pessoa pedir. Não use interacao como substituto para um fato recusado.';}
      if(acolhida?.trocarResponsavel&&ligados.length){ferramentas.push({name:'trocar_responsavel',description:'A pedido do contato responsável atual, troca o contato responsável da criança e adiciona o novo ao grupo de Pais; se pedido, retira o solicitante apenas após confirmar a entrada do novo. Não é pausa nem desistência da criança. Autorizado pela coordenação, sem nova aprovação.',input_schema:{type:'object',required:['membro_id','mensagem_id','novo_numero','retirar_solicitante'],properties:{membro_id:{type:'string'},mensagem_id:{type:'string'},novo_numero:{type:'string'},retirar_solicitante:{type:'boolean'}}}});contextoAcolhida+='\nTroca de responsável: o dono autorizou executar pedidos claros do responsável atual sem encaminhar para aprovação. Se pediu para o pai/mãe/outro responsável assumir e para sair do grupo, use trocar_responsavel com o número informado e retirar_solicitante=true. NUNCA confunda sair do grupo de Pais com pausar ou desligar a criança. Se faltar número ou o pedido for ambíguo, pergunte à pessoa. Só confirme mudança e saída do grupo conforme o resultado da ferramenta; se a entrada do novo não for confirmada, explique a pendência sem dizer que retirou o antigo.';}
      const r = await ia.conversar({ modelo: cfg.ia_modelo, sistema: sistema(cfg, ligados, hoje)+contextoAcolhida, mensagens,ferramentas,executar:(nome,e)=>nome==='registrar_acolhida'?acolhida.executar(numero,e,pendentes,hist):nome==='trocar_responsavel'?acolhida.trocarResponsavel(numero,e,pendentes):executarPadrao(nome,e) })
      texto = r.texto
      usadas = r.usadas
    }
    if (!texto) texto = 'Recebi sua mensagem e passei para a coordenação. Logo alguém responde. 🙏'
    await evo.enviarTexto(numero, texto)
    exigir(await db.from('tarcisio_mensagens').insert({ numero, direcao: 'saida', texto, membro_ids: ligados.map((m) => m.id), ferramentas: usadas.length ? usadas : null, respondida: true }), 'gravar resposta')
    await marcar({ membro_ids: ligados.map((m) => m.id) })
    log.info(`respondeu ${numero.slice(0, 4)}…${numero.slice(-2)} (${ligados.length} servo(s), ${usadas.length} ferramenta(s))`)
  }

  return { responder, executorPara }
}
