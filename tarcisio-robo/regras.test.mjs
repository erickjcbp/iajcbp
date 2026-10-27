import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  agoraSP, dentroDaJanela, normalizarNumero, numeroDoMembro, numeroDoParticipante, montarLembretes,
  montarAniversarios, fazAnosHoje, publicoPrivado, proximaVez, pausaEntreEnvios, idade,
} from './regras.mjs'

const HOJE = '2026-10-20'
const menor = { id: 'm1', nome: 'João Pedro', data_nascimento: '2014-05-01', celular_responsavel: '(19) 99876-5432', celular_mae: '19 98888-7777', telefone: '19 97777-6666' }
const irmao = { id: 'm2', nome: 'Maria Clara', apelido: 'Clarinha', data_nascimento: '2016-01-01', celular_responsavel: '19998765432' }
const adulto = { id: 'a1', nome: 'Carlos Lima', data_nascimento: '2000-03-03', telefone: '+55 (19) 97777-1234', celular_responsavel: '19911112222' }
const semNada = { id: 's1', nome: 'Sem Número', data_nascimento: '2015-02-02', telefone: '' }

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

test('menor prioriza responsável, mas também usa telefone próprio; maior prioriza próprio', () => {
  assert.equal(numeroDoMembro(menor, HOJE), '5519998765432')
  assert.equal(numeroDoMembro({ ...menor, celular_responsavel: '' }, HOJE), '5519988887777')   // cai para a mãe
  assert.equal(numeroDoMembro({ ...menor, celular_recado: '19 96666-5555' }, HOJE), '5519966665555')   // recado vem primeiro
  assert.equal(numeroDoMembro({ ...semNada, telefone: '19 97777-0000' }, HOJE), '5519977770000')
  assert.equal(numeroDoMembro({ ...menor, celular_recado: '123', celular_responsavel: '', celular_mae: '' }, HOJE), '5519977776666')
  assert.equal(numeroDoMembro(semNada, HOJE), null)                                           // nenhum telefone cadastrado
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

import { semanaDe, semanaConfirmada, membrosDoNumero, comIrmaosJuntos, candidatosPorNome, cumprimentoValido } from './regras.mjs'

test('semana vai de segunda a domingo', () => {
  assert.deepEqual(semanaDe('2026-10-25'), { inicio: '2026-10-19', fim: '2026-10-25' })   // domingo
  assert.deepEqual(semanaDe('2026-10-19'), { inicio: '2026-10-19', fim: '2026-10-25' })   // segunda
})

test('semana confirmada pela chave que o botão grava (menor data das missas)', () => {
  const mapa = { '2026-10-24': ['m1'] }   // sábado
  assert.equal(semanaConfirmada('2026-10-25', mapa), true)
  assert.equal(semanaConfirmada('2026-11-01', mapa), false)
  assert.equal(semanaConfirmada('2026-10-25', null), false)
})

test('número liga o próprio servo e os filhos de quem é responsável', () => {
  const ms = [
    { id: 'a', telefone: '19 97777-1234' },
    { id: 'b', celular_recado: '(19) 99876-5432' },
    { id: 'c', celular_mae: '19998765432' },
    { id: 'd', telefone: '19 90000-0000' },
  ]
  assert.deepEqual(membrosDoNumero('5519998765432', ms).map((m) => m.id), ['b', 'c'])
  assert.deepEqual(membrosDoNumero('5519977771234', ms).map((m) => m.id), ['a'])
  assert.deepEqual(membrosDoNumero('5511911112222', ms), [])
})

test('ausência puxa o irmão que serve junto', () => {
  const ms = [{ id: 'a', grupo_irmaos: 'g', escalar_com_irmao: true }, { id: 'b', grupo_irmaos: 'g', escalar_com_irmao: true },
    { id: 'c', grupo_irmaos: 'g', escalar_com_irmao: false }]
  assert.deepEqual(comIrmaosJuntos(ms[0], ms).map((m) => m.id), ['a', 'b'])
  assert.deepEqual(comIrmaosJuntos(ms[2], ms).map((m) => m.id), ['c'])
})

test('candidatos: todas as palavras do nome, sem acento; data de nascimento desempata', () => {
  const ms = [{ id: 'a', nome: 'João Pedro Albuquerque', data_nascimento: '2014-05-01' },
    { id: 'b', nome: 'João Pedro Silva', data_nascimento: '2013-01-01' }]
  assert.deepEqual(candidatosPorNome('joao pedro', null, ms).map((m) => m.id), ['a', 'b'])
  assert.deepEqual(candidatosPorNome('Joao Pedro Albuquerque', null, ms).map((m) => m.id), ['a'])
  assert.deepEqual(candidatosPorNome('João Pedro', '2013-01-01', ms).map((m) => m.id), ['b'])
  assert.deepEqual(candidatosPorNome('João', null, ms), [])   // só o primeiro nome não basta
})

test('cumprimento da IA sem número nem quebra de linha', () => {
  assert.equal(cumprimentoValido('Paz e bem, família!'), true)
  assert.equal(cumprimentoValido('Amanhã às 9h'), false)
  assert.equal(cumprimentoValido('Oi\nvocê'), false)
  assert.equal(cumprimentoValido(''), false)
})

// ── lembrete de ausência (domingo a terça) ──
import { lembreteAusenciaAgora } from './regras.mjs'
const CFG_AUS = { ausencia_horas: ['09:00'], ausencia_ultimo: '15:00', ausencia_texto: null }
// 2026-10-18 é domingo; 19 segunda; 20 terça; 21 quarta; 24 sábado. SP = UTC-3.
const sp = (iso) => agoraSP(new Date(iso))

test('domingo 9h devolve texto com o link e o prazo', () => {
  const r = lembreteAusenciaAgora(sp('2026-10-18T12:00:00Z'), CFG_AUS)
  assert.ok(r)
  assert.match(r.texto, /https:\/\/coroinhas\.jcbplimeira\.com\.br\/ausencias/)
  assert.match(r.texto, /app/i)
  assert.match(r.texto, /até terça-feira, 18h/)
  assert.doesNotMatch(r.texto, /último/i)
  assert.equal(r.chave, 'ausencia:2026-10-18:09:00')
})
test('segunda 9h devolve texto', () => {
  assert.equal(lembreteAusenciaAgora(sp('2026-10-19T12:00:00Z'), CFG_AUS).chave, 'ausencia:2026-10-19:09:00')
})
test('quarta 9h devolve null', () => {
  assert.equal(lembreteAusenciaAgora(sp('2026-10-21T12:00:00Z'), CFG_AUS), null)
})
test('sábado 9h devolve null', () => {
  assert.equal(lembreteAusenciaAgora(sp('2026-10-24T12:00:00Z'), CFG_AUS), null)
})
test('terça 15h devolve o último lembrete', () => {
  // 18:00 UTC = 15:00 em Brasília
  const r = lembreteAusenciaAgora(sp('2026-10-20T18:00:00Z'), CFG_AUS)
  assert.ok(r)
  assert.match(r.texto, /último/i)
  assert.equal(r.chave, 'ausencia:2026-10-20:15:00')
})
test('terça 18h01 devolve null', () => {
  // 21:01 UTC = 18:01 em Brasília; mesmo com o horário configurado na lista, passou do prazo
  assert.equal(lembreteAusenciaAgora(sp('2026-10-20T21:01:00Z'), CFG_AUS), null)
  assert.equal(lembreteAusenciaAgora(sp('2026-10-20T21:30:00Z'), { ...CFG_AUS, ausencia_horas: ['09:00', '18:30'] }), null)
})
test('texto personalizado da config substitui o padrão', () => {
  const r = lembreteAusenciaAgora(sp('2026-10-18T12:00:00Z'), { ...CFG_AUS, ausencia_texto: 'Mande suas ausências!' })
  assert.ok(r.texto.startsWith('Mande suas ausências!'))
  assert.ok(r.texto.includes('https://coroinhas.jcbplimeira.com.br/ausencias'))
})
test('horário que não está na lista devolve null', () => {
  assert.equal(lembreteAusenciaAgora(sp('2026-10-18T11:59:00Z'), CFG_AUS), null) // 8h59, antes do slot
  assert.equal(lembreteAusenciaAgora(sp('2026-10-19T18:00:00Z'), CFG_AUS), null) // 15h só vale na terça
})

test('domingo 9h20 ainda dispara, com a chave do horário 09:00', () => {
  assert.equal(lembreteAusenciaAgora(sp('2026-10-18T12:20:00Z'), CFG_AUS).chave, 'ausencia:2026-10-18:09:00')
})
test('domingo 9h30 devolve null', () => {
  assert.equal(lembreteAusenciaAgora(sp('2026-10-18T12:30:00Z'), CFG_AUS), null)
})
test('terça 15h10 dispara como o último lembrete', () => {
  const r = lembreteAusenciaAgora(sp('2026-10-20T18:10:00Z'), CFG_AUS)
  assert.equal(r.chave, 'ausencia:2026-10-20:15:00')
  assert.match(r.texto, /último/i)
})
test('terça 17h59 com slot às 15h está fora da janela de 30 min', () => {
  assert.equal(lembreteAusenciaAgora(sp('2026-10-20T20:59:00Z'), CFG_AUS), null)
})
test('o texto padrão cumprimenta sem hora, fala dos pais e põe o último lembrete antes do obrigado', () => {
  const t = lembreteAusenciaAgora(sp('2026-10-20T18:00:00Z'), CFG_AUS).texto
  assert.match(t, /^Paz e bem, pessoal!/)
  assert.doesNotMatch(t, /Bom dia/)
  assert.match(t, /você ou seu filho\(a\)/)
  assert.ok(t.indexOf('18h') < t.indexOf('último lembrete') && t.indexOf('último lembrete') < t.indexOf('Obrigado'))
})

test('domingo, segunda e terça sempre incluem link de ausências sem duplicar', () => {
  const link = 'https://coroinhas.jcbplimeira.com.br/ausencias'
  for (const dia of ['2026-10-25', '2026-10-26', '2026-10-27']) {
    for (const texto of [null, 'Avise sua ausência!', `Registre aqui: ${link}`]) {
      const r = lembreteAusenciaAgora({ data: dia, hm: '09:00' }, { ...CFG_AUS, ausencia_texto: texto })
      assert.equal(r.texto.split(link).length - 1, 1)
    }
  }
})

test('retiro prioriza telefone do participante, usa responsável como fallback e ignora sem contato', () => {
  assert.equal(numeroDoParticipante(menor), '5519977776666')
  assert.equal(numeroDoParticipante({...menor, telefone:''}), '5519998765432')
  assert.equal(numeroDoParticipante({...menor, telefone:'123', celular_recado:'19966665555'}), '5519966665555')
  assert.equal(numeroDoParticipante(semNada), null)
})

test('cerimoniário menor recebe no próprio; avisos aos pais continuam no responsável',()=>{
 const m={...menor,nivel:'cerimoniario_guardiao'};
 assert.equal(numeroDoMembro(m,HOJE),normalizarNumero(m.telefone));
 const optar=p=>publicoPrivado(p,[m],{hoje:HOJE,papelDoUsuario:new Map()}).map(x=>x.numero);
 assert.deepEqual(optar(['cerimoniarios']),[normalizarNumero(m.telefone)]);
 assert.deepEqual(optar(['pais']),[normalizarNumero(m.celular_responsavel)]);
 assert.deepEqual(new Set(optar(['pais','cerimoniarios'])),new Set([normalizarNumero(m.telefone),normalizarNumero(m.celular_responsavel)]));
 assert.equal(numeroDoMembro({...m,telefone:null},HOJE),normalizarNumero(m.celular_responsavel));
});
