import { test } from 'node:test'
import assert from 'node:assert/strict'
import { avaliarContato } from './contato-automatico.mjs'

const agora = new Date('2026-10-30T15:00:00Z')
const t = (s) => new Date(+agora - s * 1000).toISOString()
const e = (texto, s, id) => ({ id, direcao: 'entrada', texto, created_at: t(s) })
const o = (texto, s) => ({ direcao: 'saida', texto, created_at: t(s) })

test('menu e aviso de atendimento automático são robô', () => {
  for (const texto of [
    'Olá! Sou a assistente virtual da Loja X. Como posso ajudar?',
    'Digite 1 para vendas\n2 - Suporte\n3 - Financeiro',
    '1) Segunda via\n2) Falar com atendente',
    'Nosso horário de atendimento é de seg a sex, 8h às 18h.',
    'Mensagem automática: não responda esta mensagem.',
    'Seu protocolo é 20261030123456.',
  ]) assert.equal(avaliarContato({ novas: [e(texto, 5, 'n1')], agora }).automatico, true, texto)
})

test('pai normal não é robô', () => {
  for (const texto of ['Bom dia, o João vai faltar domingo', 'Obrigada!', 'Pode ser às 9h?'])
    assert.equal(avaliarContato({ novas: [e(texto, 5, 'n1')], agora }).automatico, false, texto)
})

test('conhecido precisa de 2 mensagens com sinal de robô', () => {
  const uma = [e('Esse é o horário de atendimento do padre?', 5, 'n1')]
  assert.equal(avaliarContato({ novas: uma, conhecido: true, agora }).automatico, false)
  assert.equal(avaliarContato({ novas: [...uma, e('fora do horário de atendimento', 4, 'n2')], conhecido: true, agora }).automatico, true)
})

test('laço: 5 respostas nossas em 10 min', () => {
  const historico = [1, 2, 3, 4, 5].flatMap((i) => [o('Oi!', 500 - i * 60), e('Como posso ajudar?', 495 - i * 60, 'x' + i)])
  const r = avaliarContato({ historico, novas: [], agora })
  assert.equal(r.automatico, true)
})

test('laço: contato responde em segundos, 3 vezes', () => {
  const historico = [o('a', 900), e('b1', 897, 'a'), o('c', 800), e('d1', 797, 'b'), o('f', 700), e('g1', 698, 'c')]
  assert.match(avaliarContato({ historico, agora }).motivo, /menos de 6 s/)
})

test('mesma frase 3 vezes', () => {
  const historico = [e('Digite sua dúvida novamente', 3000, 'a'), e('digite sua duvida novamente', 2000, 'b')]
  assert.equal(avaliarContato({ historico, novas: [e('Digite sua dúvida novamente.', 10, 'c')], agora }).automatico, false) // ponto final muda o texto
  assert.equal(avaliarContato({ historico, novas: [e('Digite sua dúvida novamente', 10, 'c')], agora }).automatico, true)
})

test('teto diário: 12 para desconhecido, 30 para conhecido', () => {
  const historico = Array.from({ length: 12 }, (_, i) => o('r', 3600 * 2 + i * 3600))
  assert.equal(avaliarContato({ historico, agora }).automatico, true)
  assert.equal(avaliarContato({ historico, conhecido: true, agora }).automatico, false)
})
