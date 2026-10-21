import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  agoraSP, dentroDaJanela, normalizarNumero, numeroDoMembro, montarLembretes,
  montarAniversarios, fazAnosHoje, publicoPrivado, proximaVez, pausaEntreEnvios, idade,
} from './regras.mjs'

const HOJE = '2026-10-20'
const menor = { id: 'm1', nome: 'João Pedro', data_nascimento: '2014-05-01', celular_responsavel: '(19) 99876-5432', celular_mae: '19 98888-7777', telefone: '19 97777-6666' }
const irmao = { id: 'm2', nome: 'Maria Clara', apelido: 'Clarinha', data_nascimento: '2016-01-01', celular_responsavel: '19998765432' }
const adulto = { id: 'a1', nome: 'Carlos Lima', data_nascimento: '2000-03-03', telefone: '+55 (19) 97777-1234', celular_responsavel: '19911112222' }
const semNada = { id: 's1', nome: 'Sem Número', data_nascimento: '2015-02-02', telefone: '19 97777-0000' }

test('agoraSP usa o horário de Brasília, não o da máquina', () => {
  assert.deepEqual(agoraSP(new Date('2026-10-20T22:30:00Z')), { data: '2026-10-20', hm: '19:30' })
  assert.deepEqual(agoraSP(new Date('2026-10-21T02:10:00Z')), { data: '2026-10-20', hm: '23:10' })
})

test('janela: nada sai de madrugada nem depois das 21h', () => {
  assert.equal(dentroDaJanela('07:59', '08:00:00', '21:00:00'), false)
  assert.equal(dentroDaJanela('08:00', '08:00:00', '21:00:00'), true)
  assert.equal(dentroDaJanela('20:59', '08:00', '21:00'), true)
  assert.equal(dentroDaJanela('21:00', '08:00', '21:00'), false)
})

test('normaliza celular brasileiro e recusa fixo ou lixo', () => {
  assert.equal(normalizarNumero('(19) 99876-5432'), '5519998765432')
  assert.equal(normalizarNumero('+55 19 99876-5432'), '5519998765432')
  assert.equal(normalizarNumero('551998765432'), '5519998765432')   // sem o 9 → põe o 9
  assert.equal(normalizarNumero('19 3451-2233'), null)               // fixo
  assert.equal(normalizarNumero('123'), null)
  assert.equal(normalizarNumero(null), null)
})

test('menor recebe SÓ pelo responsável; maior pelo próprio número', () => {
  assert.equal(numeroDoMembro(menor, HOJE), '5519998765432')
  assert.equal(numeroDoMembro({ ...menor, celular_responsavel: '' }, HOJE), '5519988887777')   // cai para a mãe
  assert.equal(numeroDoMembro({ ...menor, celular_recado: '19 96666-5555' }, HOJE), '5519966665555')   // recado vem primeiro
  assert.equal(numeroDoMembro(semNada, HOJE), null)                                           // telefone do menor NÃO conta
  assert.equal(numeroDoMembro(adulto, HOJE), '5519977771234')
  assert.equal(numeroDoMembro({ ...adulto, data_nascimento: null }, HOJE), '5519911112222')   // sem nascimento = trata como menor
})

test('idade conta o aniversário que ainda não chegou', () => {
  assert.equal(idade('2008-10-21', '2026-10-20'), 17)
  assert.equal(idade('2008-10-20', '2026-10-20'), 18)
})

test('lembrete junta irmãos do mesmo responsável numa mensagem só e separa quem não tem número', () => {
  const celA = { horario: '9h', comunidade: 'matriz', minutos: 540 }
  const celB = { horario: '7h', comunidade: 'santo_antonio', minutos: 420 }
  const { envios, semNumero } = montarLembretes([
    { membro: menor, celebracao: celA, funcao: 'missal' },
    { membro: irmao, celebracao: celB, funcao: 'vela' },
    { membro: semNada, celebracao: celA, funcao: 'cruz' },
    { membro: semNada, celebracao: celB, funcao: 'cruz' },
  ], { amanha: '2026-10-21', hoje: HOJE, modelo: 'Amanhã ({dia}) {itens}.', rodape: 'Só avisos.' })
  assert.equal(envios.length, 1)
  assert.equal(envios[0].destino_numero, '5519998765432')
  assert.equal(envios[0].chave_unica, 'lembrete:2026-10-21:5519998765432')
  assert.match(envios[0].texto, /^Amanhã \(quarta-feira, 21\/10\) Clarinha serve na missa das 7h — Santo Antônio, função Velas; João serve na missa das 9h — Matriz, função Missal\.\n\nSó avisos\.$/)
  assert.equal(semNumero.length, 1)
  assert.equal(semNumero[0].estado, 'sem_numero')
})

test('aniversário: hoje, e 29/02 cai em 28/02 no ano comum', () => {
  assert.equal(fazAnosHoje({ data_nascimento: '2012-10-20' }, HOJE), true)
  assert.equal(fazAnosHoje({ data_nascimento: '2012-10-21' }, HOJE), false)
  assert.equal(fazAnosHoje({ data_nascimento: '2012-02-29' }, '2027-02-28'), true)
  assert.equal(fazAnosHoje({ data_nascimento: '2012-02-29' }, '2028-02-28'), false)
  const r = montarAniversarios([{ ...menor, data_nascimento: '2014-10-20' }, { ...semNada, data_nascimento: '2015-10-20' }],
    { hoje: HOJE, modelo: 'Parabéns, {nome}!', rodape: '' })
  assert.equal(r[0].texto, 'Parabéns, João!')
  assert.equal(r[0].chave_unica, 'aniv:m1:2026')
  assert.equal(r[1].estado, 'sem_numero')
})

test('aviso no privado: público por papel, sem número repetido', () => {
  const cer = { id: 'c1', nome: 'Ana', nivel: 'cerimoniario_guardiao', data_nascimento: '2001-01-01', telefone: '19955554444', user_id: 'u1' }
  const ac = { id: 'c2', nome: 'Beto', nivel: 'acolito_guardiao', data_nascimento: '2013-01-01', celular_responsavel: '19998765432' }
  const papelDoUsuario = new Map([['u1', 'membro_equipe']])
  const so = (p) => publicoPrivado(p, [cer, ac, menor], { hoje: HOJE, papelDoUsuario }).map((x) => x.membro.id)
  assert.deepEqual(so(['cerimoniarios']), ['c1'])
  assert.deepEqual(so(['acolitos']), ['c2'])            // menor tem o MESMO responsável que Beto → 1 mensagem
  assert.deepEqual(so(['equipe']), ['c1'])
  assert.deepEqual(so(['pais']), ['c1', 'c2'])
})

test('repetição: diária, semanal, mensal no fim do mês e fim pela data final', () => {
  assert.equal(proximaVez('2026-10-20T21:00:00.000Z', 'nao', null), null)
  assert.equal(proximaVez('2026-10-20T21:00:00.000Z', 'diario', null), '2026-10-21T21:00:00.000Z')
  assert.equal(proximaVez('2026-10-20T21:00:00.000Z', 'semanal', null), '2026-10-27T21:00:00.000Z')
  assert.equal(proximaVez('2026-01-31T12:00:00.000Z', 'mensal', null), '2026-02-28T12:00:00.000Z')
  assert.equal(proximaVez('2026-10-20T21:00:00.000Z', 'semanal', '2026-10-26'), null)
})

test('pausa entre envios fica entre 20 e 40 segundos', () => {
  assert.equal(pausaEntreEnvios(() => 0), 20_000)
  assert.equal(pausaEntreEnvios(() => 0.999), 39_980)
})
