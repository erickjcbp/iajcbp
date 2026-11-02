// Validação dos números dos grupos: quem o cadastro não identificou responde nome completo e idade.
// Só grava o telefone quando nome e idade batem com UMA ficha e o telefone dela está vazio.
// Número já cadastrado nunca é trocado aqui: qualquer dúvida vai para revisão da coordenação.
import { agoraSP } from './regras.mjs'

const exigir = ({ data, error }, onde) => {
  if (error) throw new Error(`${onde}: ${error.message}`)
  return data
}

export const PERGUNTA = 'Paz e bem! Aqui é o Tarcísio, da Pastoral dos Coroinhas e Acólitos. Estou atualizando os cadastros do grupo. Pode me dizer seu nome completo e sua idade? Se você não serve no altar, é só me avisar. Obrigado!'
export const RESPOSTAS = {
  gravado: (nome) => `Obrigado, ${nome}! Seu cadastro foi atualizado. 🙏`,
  revisar: 'Obrigado! Vou conferir com a coordenação. 🙏',
  nao_serve: 'Obrigado pelo retorno! Paz e bem. 🙏',
  repetir: 'Para eu localizar seu cadastro, pode me mandar seu nome completo e sua idade?',
  filho_dados: 'Que bom saber! Para eu localizar o cadastro, pode me passar o nome completo e a idade de quem serve?',
  filho_repetir: 'Pode me mandar o nome completo e a idade de quem serve, por favor?',
  filho_numero: (nome) => `Encontrei o cadastro de ${nome}! Qual é o WhatsApp próprio de ${nome}? Vou incluir no grupo de Acólitos e Coroinhas. Esse grupo é somente para comunicados.`,
  filho_numero_repetir: 'Não consegui ler o número. Pode mandar com DDD, por exemplo 19 99999-9999?',
  filho_incluido: (nome) => `Prontinho! ${nome} já está no grupo de Acólitos e Coroinhas. Lembrando que ele é somente para comunicados. Paz e bem! 🙏`,
}

const semAcento = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim()
const VARIOS_FILHOS = /\b(?:meus|minhas)\s+(?:filhos|filhas|meninos|meninas|netos|netas)\b/
const FILHO = /\b(?:meu|minha)\s+(?:filho|filha|menino|menina|enteado|enteada|neto|neta)\b|\bsou\s+(?:o\s+|a\s+)?(?:mae|pai|responsavel|avo)\s+d[oa]\b/
const NAO_SERVE = /\bn(?:ao|o)\s+(?:sirvo|servo|sou\s+(?:servo|coroinha|acolito)|faco\s+parte)\b|\bsou\s+(?:o\s+|a\s+)?(?:pai|mae|responsavel|coordenador|coordenadora|padre|ministro|ministra)\b/
const SOBRA = /\b(?:meu|minha|nome|completo|e|eh|sou|o|a|me|chamo|tenho|anos|ano|idade|de|paz|bem|ola|oi|bom|boa|dia|tarde|noite)\b/g

export function lerResposta(texto) {
  const limpo = semAcento(texto)
  if (VARIOS_FILHOS.test(limpo)) return { variosFilhos: true }
  if (FILHO.test(limpo)) return { filho: true }
  if (NAO_SERVE.test(limpo)) return { naoServe: true }
  const idade = /\b(\d{1,2})\b/.exec(String(texto || ''))?.[1]
  const original = String(texto || '').replace(/\d+/g, ' ')
  const nome = original.split(/[\n,.;:]+/).map((p) => {
    const palavras = p.trim().split(/\s+/).filter(Boolean)
    return palavras.filter((w, i) => !(i === 0 && SOBRA.test(semAcento(w)))).join(' ')
  }).sort((a, b) => b.length - a.length)[0] || ''
  SOBRA.lastIndex = 0
  const util = semAcento(nome).replace(SOBRA, ' ').replace(/\s+/g, ' ').trim()
  SOBRA.lastIndex = 0
  return { nome: util, idade: idade ? Number(idade) : null }
}

// "19 99999-8888" ou "+55 19 99999-8888" → "5519999998888". Sem número válido: null.
export function lerNumero(texto) {
  const limpo = String(texto || '').trim()
  if (!/^[+\d\s().-]+$/.test(limpo)) return null
  let n = limpo.replace(/\D/g, '')
  if (n.startsWith('55') && n.length >= 12) n = n.slice(2)
  return n.length === 10 || n.length === 11 ? '55' + n : null
}

// Compara DDD + 8 últimos dígitos: o 55 e o 9º dígito variam entre cadastro e WhatsApp, o DDD não.
// Número sem DDD não confirma ninguém: cai em revisão.
const canonico = (n) => {
  let d = String(n || '').replace(/\D/g, '')
  if (d.startsWith('55') && d.length >= 12) d = d.slice(2)
  return d.length === 10 || d.length === 11 ? d.slice(0, 2) + d.slice(-8) : ''
}
export const mesmoNumero = (a, b) => {
  const x = canonico(a)
  return !!x && x === canonico(b)
}

export const idadeEm = (nascimento, hoje) => {
  if (!nascimento) return null
  const [a, m, d] = String(nascimento).slice(0, 10).split('-').map(Number)
  const [ah, mh, dh] = String(hoje).slice(0, 10).split('-').map(Number)
  return ah - a - ((mh < m || (mh === m && dh < d)) ? 1 : 0)
}

// Acha a ficha de quem serve pelo nome e pela idade que a família informou.
export function acharFicha({ nome, idade, membros, hoje }) {
  if (nome.split(' ').length < 2 || idade == null) return { motivo: 'resposta incompleta' }
  const iguais = membros.filter((m) => semAcento(m.nome) === nome)
  if (!iguais.length) return { motivo: 'nome não encontrado no cadastro' }
  const certos = iguais.filter((m) => idadeEm(m.data_nascimento, hoje) === idade)
  if (certos.length !== 1) return { motivo: certos.length ? 'mais de uma ficha possível' : 'idade não confere com a ficha' }
  return { ficha: certos[0] }
}

// membros: fichas do cadastro. Decide o que fazer, sem tocar no banco.
export function decidir({ nome, idade, numero, membros, hoje }) {
  const { ficha, motivo } = acharFicha({ nome, idade, membros, hoje })
  if (!ficha) return { situacao: 'revisar', motivo }
  const digitos = String(ficha.telefone || '').replace(/\D/g, '')
  if (digitos && !mesmoNumero(digitos, numero)) return { situacao: 'revisar', motivo: 'ficha já tem outro número', ficha }
  return { situacao: 'gravado', ficha, gravar: !digitos }
}

const ABERTAS = ['perguntado', 'filho_dados', 'filho_numero']

export function criarValidacaoContato({ db, evo, relogio = () => new Date(), log = console }) {
  const ler = async (numero) => exigir(await db.from('tarcisio_validacao_contato').select('*').eq('numero', numero).maybeSingle(), 'ler validação')
  async function aguardando(numero) {
    const linha = await ler(numero)
    return ABERTAS.includes(linha?.situacao)
  }
  const lerFichas = async () => exigir(await db.from('acolitos_membros').select('id,nome,data_nascimento,telefone').eq('status', 'ativo').eq('serve', true), 'ler fichas')
  async function responder(numero, texto) {
    const enviada = await evo.enviarTexto(numero, texto)
    exigir(await db.from('tarcisio_mensagens').insert({ numero, direcao: 'saida', texto, external_id: enviada?.key?.id || null, respondida: true }), 'guardar resposta')
  }
  // O número do filho só entra na ficha se ela estiver sem telefone, e só então vai para o grupo.
  async function receberNumeroDoFilho({ msg, linha, salvar, revisar }) {
    const novo = lerNumero(msg.texto)
    if (!novo) {
      if (linha.tentativas >= 1) return revisar('número do filho não informado')
      exigir(await salvar({ tentativas: linha.tentativas + 1 }), 'contar tentativa')
      await responder(msg.numero, RESPOSTAS.filho_numero_repetir)
      return true
    }
    if (mesmoNumero(novo, msg.numero)) return revisar('filho usa o número da família')
    const ficha = exigir(await db.from('acolitos_membros').select('id,nome,telefone,celular_mae,celular_recado,celular_responsavel').eq('id', linha.membro_id).maybeSingle(), 'ler ficha do filho')
    if (!ficha) return revisar('ficha do filho não encontrada')
    if ([ficha.celular_mae, ficha.celular_recado, ficha.celular_responsavel].some((c) => mesmoNumero(c, novo))) return revisar('filho usa o número da família')
    const digitos = String(ficha.telefone || '').replace(/\D/g, '')
    if (digitos && !mesmoNumero(digitos, novo)) return revisar('ficha já tem outro número')
    if (evo.numerosComWhatsapp) {
      let existe = false
      try { existe = (await evo.numerosComWhatsapp([novo])).some((r) => r.existe) } catch (e) { log.warn(`validação de contato: não conferi o WhatsApp: ${e.message}`) }
      if (!existe) return revisar('número sem WhatsApp confirmado')
    }
    const nome = ficha.nome.split(' ')[0]
    if (linha.teste) {
      exigir(await salvar({ situacao: 'gravado' }), 'concluir teste')
      await responder(msg.numero, RESPOSTAS.filho_incluido(nome))
      return true
    }
    if (!digitos) {
      const feitas = exigir(await db.from('acolitos_membros').update({ telefone: novo.replace(/^55/, '') }).eq('id', ficha.id).or('telefone.is.null,telefone.eq.').select('id'), 'gravar telefone do filho')
      if (!feitas.length) return revisar('ficha ganhou telefone durante a validação')
    }
    const grupo = exigir(await db.from('tarcisio_grupos').select('jid').eq('papel', 'acolitos').maybeSingle(), 'ler grupo')
    if (!grupo) return revisar('grupo de acólitos não vinculado')
    try { await evo.adicionarAoGrupo(grupo.jid, [novo]) } catch (e) {
      log.warn(`validação de contato: não incluí no grupo: ${e.message}`)
      return revisar('número salvo, mas não consegui incluir no grupo')
    }
    exigir(await salvar({ situacao: 'gravado' }), 'concluir inclusão')
    await responder(msg.numero, RESPOSTAS.filho_incluido(nome))
    return true
  }

  // Devolve true quando a mensagem era resposta da validação: aí ela não vai para a IA.
  async function receber(msg) {
    const linha = await ler(msg.numero)
    if (!ABERTAS.includes(linha?.situacao)) return false
    const salvar = (extra) => db.from('tarcisio_validacao_contato').update({ ...extra, resposta: msg.texto, atualizado_em: relogio().toISOString() }).eq('numero', msg.numero)
    const revisar = async (motivo, extra = {}) => {
      exigir(await salvar({ ...extra, situacao: 'revisar', motivo }), 'marcar revisão')
      await responder(msg.numero, RESPOSTAS.revisar)
      return true
    }
    if (!msg.texto) {
      await responder(msg.numero, linha.situacao === 'perguntado' ? RESPOSTAS.repetir : linha.situacao === 'filho_dados' ? RESPOSTAS.filho_repetir : RESPOSTAS.filho_numero_repetir)
      return true
    }
    if (linha.situacao === 'filho_numero') return receberNumeroDoFilho({ msg, linha, salvar, revisar })
    const lido = lerResposta(msg.texto)
    if (linha.situacao === 'filho_dados') {
      if (lido.variosFilhos) return revisar('família com mais de um filho')
      if ((lido.nome || '').split(' ').length < 2 || lido.idade == null) {
        if (linha.tentativas >= 2) return revisar('dados do filho incompletos')
        exigir(await salvar({ tentativas: linha.tentativas + 1 }), 'contar tentativa')
        await responder(msg.numero, RESPOSTAS.filho_repetir)
        return true
      }
      const membros = await lerFichas()
      const achado = acharFicha({ ...lido, membros, hoje: agoraSP(relogio()).data })
      const base = { nome_informado: lido.nome, idade_informada: lido.idade }
      if (!achado.ficha) return revisar(achado.motivo, base)
      const contatos = exigir(await db.from('acolitos_membros').select('celular_mae,celular_recado,celular_responsavel').eq('id', achado.ficha.id).maybeSingle(), 'ler contatos da ficha')
      if (!linha.teste && ![contatos?.celular_mae, contatos?.celular_recado, contatos?.celular_responsavel].some((c) => mesmoNumero(c, msg.numero)))
        return revisar('número não é o da família na ficha', { ...base, membro_id: achado.ficha.id })
      exigir(await salvar({ ...base, situacao: 'filho_numero', tentativas: 0, membro_id: achado.ficha.id }), 'guardar ficha do filho')
      await responder(msg.numero, RESPOSTAS.filho_numero(achado.ficha.nome.split(' ')[0]))
      return true
    }
    if (lido.variosFilhos) return revisar('família com mais de um filho')
    if (lido.filho) {
      exigir(await salvar({ situacao: 'filho_dados', tentativas: 0 }), 'passar para os dados do filho')
      await responder(msg.numero, RESPOSTAS.filho_dados)
      return true
    }
    if (lido.naoServe) {
      exigir(await salvar({ situacao: 'nao_serve' }), 'marcar quem não serve')
      await responder(msg.numero, RESPOSTAS.nao_serve)
      return true
    }
    if ((lido.nome.split(' ').length < 2 || lido.idade == null) && linha.tentativas < 1) {
      exigir(await salvar({ tentativas: linha.tentativas + 1 }), 'contar tentativa')
      await responder(msg.numero, RESPOSTAS.repetir)
      return true
    }
    const membros = await lerFichas()
    const r = decidir({ ...lido, numero: msg.numero, membros, hoje: agoraSP(relogio()).data })
    const base = { nome_informado: lido.nome, idade_informada: lido.idade, membro_id: r.ficha?.id || null, motivo: r.motivo || null }
    if (r.situacao === 'gravado' && r.gravar && !linha.teste) {
      const nacional = String(msg.numero).replace(/^55/, '')
      // o filtro repete a condição: se a ficha ganhou telefone neste meio-tempo, nada é sobrescrito
      const feitas = exigir(await db.from('acolitos_membros').update({ telefone: nacional }).eq('id', r.ficha.id).or('telefone.is.null,telefone.eq.').select('id'), 'gravar telefone')
      if (!feitas.length) {
        exigir(await salvar({ ...base, situacao: 'revisar', motivo: 'ficha ganhou telefone durante a validação' }), 'marcar revisão')
        await responder(msg.numero, RESPOSTAS.revisar)
        return true
      }
    }
    exigir(await salvar({ ...base, situacao: r.situacao }), 'concluir validação')
    await responder(msg.numero, r.situacao === 'gravado' ? RESPOSTAS.gravado(r.ficha.nome.split(' ')[0]) : RESPOSTAS.revisar)
    log.info(`validação de contato: ${r.situacao}`)
    return true
  }
  return { aguardando, receber }
}
