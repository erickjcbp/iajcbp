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
}

const semAcento = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim()
const NAO_SERVE = /\bn(?:ao|o)\s+(?:sirvo|servo|sou\s+(?:servo|coroinha|acolito)|faco\s+parte)\b|\bsou\s+(?:o\s+|a\s+)?(?:pai|mae|responsavel|coordenador|coordenadora|padre|ministro|ministra)\b/
const SOBRA = /\b(?:meu|minha|nome|completo|e|eh|sou|o|a|me|chamo|tenho|anos|ano|idade|de|paz|bem|ola|oi|bom|boa|dia|tarde|noite)\b/g

export function lerResposta(texto) {
  const limpo = semAcento(texto)
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

export const idadeEm = (nascimento, hoje) => {
  if (!nascimento) return null
  const [a, m, d] = String(nascimento).slice(0, 10).split('-').map(Number)
  const [ah, mh, dh] = String(hoje).slice(0, 10).split('-').map(Number)
  return ah - a - ((mh < m || (mh === m && dh < d)) ? 1 : 0)
}

// membros: fichas do cadastro. Decide o que fazer, sem tocar no banco.
export function decidir({ nome, idade, numero, membros, hoje }) {
  if (nome.split(' ').length < 2 || idade == null) return { situacao: 'revisar', motivo: 'resposta incompleta' }
  const iguais = membros.filter((m) => semAcento(m.nome) === nome)
  if (!iguais.length) return { situacao: 'revisar', motivo: 'nome não encontrado no cadastro' }
  const certos = iguais.filter((m) => idadeEm(m.data_nascimento, hoje) === idade)
  if (certos.length !== 1) return { situacao: 'revisar', motivo: certos.length ? 'mais de uma ficha possível' : 'idade não confere com a ficha' }
  const ficha = certos[0], digitos = String(ficha.telefone || '').replace(/\D/g, '')
  if (digitos && !String(numero).endsWith(digitos.slice(-8))) return { situacao: 'revisar', motivo: 'ficha já tem outro número', ficha }
  return { situacao: 'gravado', ficha, gravar: !digitos }
}

export function criarValidacaoContato({ db, evo, relogio = () => new Date(), log = console }) {
  const ler = async (numero) => exigir(await db.from('tarcisio_validacao_contato').select('*').eq('numero', numero).maybeSingle(), 'ler validação')
  async function aguardando(numero) {
    const linha = await ler(numero)
    return linha?.situacao === 'perguntado'
  }
  async function responder(numero, texto) {
    const enviada = await evo.enviarTexto(numero, texto)
    exigir(await db.from('tarcisio_mensagens').insert({ numero, direcao: 'saida', texto, external_id: enviada?.key?.id || null, respondida: true }), 'guardar resposta')
  }
  // Devolve true quando a mensagem era resposta da validação: aí ela não vai para a IA.
  async function receber(msg) {
    const linha = await ler(msg.numero)
    if (linha?.situacao !== 'perguntado') return false
    const salvar = (extra) => db.from('tarcisio_validacao_contato').update({ ...extra, resposta: msg.texto, atualizado_em: relogio().toISOString() }).eq('numero', msg.numero)
    if (!msg.texto) {
      await responder(msg.numero, RESPOSTAS.repetir)
      return true
    }
    const lido = lerResposta(msg.texto)
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
    const membros = exigir(await db.from('acolitos_membros').select('id,nome,data_nascimento,telefone'), 'ler fichas')
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
