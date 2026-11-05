import test from 'node:test'
import assert from 'node:assert/strict'
import { interpretar, acharFicha, lerResposta, lerNumero, lerFilhos, lerCelulares, mesmoNumero, decidir, idadeEm, criarValidacaoContato, RESPOSTAS, PERGUNTA } from './validacao-contato.mjs'

const hoje = '2026-11-02'
const membros = [
  { id: 'a', nome: 'João Pedro da Silva', data_nascimento: '2012-03-10', telefone: null, celular_mae: '19 91111-2222', celular_recado: null },
  { id: 'b', nome: 'Ana Souza', data_nascimento: '2010-12-01', telefone: '19 99999-1111' },
  { id: 'e', nome: 'Maria de Souza Lima', data_nascimento: '2013-01-01', telefone: null, celular_mae: '19 91111-2222', celular_recado: null },
  { id: 'c', nome: 'Luiz Costa', data_nascimento: '2011-01-01', telefone: null },
  { id: 'd', nome: 'Luiz Costa', data_nascimento: '2011-02-01', telefone: null },
]

test('lê nome e idade em jeitos comuns de responder', () => {
  assert.deepEqual(lerResposta('João Pedro da Silva, 14 anos'), { nome: 'joao pedro da silva', idade: 14 })
  assert.deepEqual(lerResposta('Meu nome é João Pedro da Silva e tenho 14 anos'), { nome: 'joao pedro da silva', idade: 14 })
  assert.deepEqual(lerResposta('João Pedro da Silva\n14'), { nome: 'joao pedro da silva', idade: 14 })
})
test('reconhece quem não serve', () => {
  for (const t of ['Não sirvo no altar', 'Sou o coordenador']) assert.equal(lerResposta(t).naoServe, true)
})
test('idade respeita o aniversário', () => {
  assert.equal(idadeEm('2012-11-03', hoje), 13)
  assert.equal(idadeEm('2012-11-02', hoje), 14)
})
test('só grava com nome e idade batendo em uma ficha de telefone vazio', () => {
  const r = decidir({ nome: 'joao pedro da silva', idade: 14, numero: '5519988887777', membros, hoje })
  assert.equal(r.situacao, 'gravado'); assert.equal(r.gravar, true); assert.equal(r.ficha.id, 'a')
})
test('qualquer dúvida vai para revisão', () => {
  assert.equal(decidir({ nome: 'ninguem aqui', idade: 14, numero: '5519', membros, hoje }).motivo, 'nome não encontrado no cadastro')
  assert.equal(decidir({ nome: 'luiz costa', idade: 20, numero: '5519', membros, hoje }).motivo, 'mais de uma ficha possível')
  assert.equal(decidir({ nome: 'ana souza', idade: 15, numero: '5519988887777', membros, hoje }).motivo, 'ficha já tem outro número')
  assert.equal(decidir({ nome: 'luiz costa', idade: 15, numero: '5519', membros, hoje }).motivo, 'mais de uma ficha possível')
})
test('mesmo número da ficha confirma sem regravar', () => {
  const r = decidir({ nome: 'ana souza', idade: 15, numero: '5519999991111', membros, hoje })
  assert.equal(r.situacao, 'gravado'); assert.equal(r.gravar, false)
})

function falso(linha, ficha = membros[0]) {
  const escritas = [], enviadas = [], grupos = []
  const fim = (data) => { const p = Promise.resolve({ data, error: null }); return Object.assign(p, { eq: () => fim(data), or: () => fim(data), select: () => fim(data), maybeSingle: () => fim(Array.isArray(data) ? ficha : data) }) }
  const db = { from: (t) => ({
    select: () => fim(t === 'tarcisio_validacao_contato' ? linha : t === 'tarcisio_grupos' ? { jid: 'g@g.us' } : membros),
    update: (v) => { escritas.push([t, v]); return fim([{ id: 'a' }]) },
    insert: (v) => { escritas.push([t, v]); return fim(null) },
  }) }
  const evo = { enviarTexto: async (_n, x) => { enviadas.push(x); return {} }, adicionarAoGrupo: async (j, n) => { if (ficha?.semGrupo) throw new Error('sem permissão'); grupos.push([j, n]) } }
  return { evo, v: criarValidacaoContato({ db, evo, relogio: () => new Date('2026-11-02T15:00:00Z'), log: { info() {}, warn() {} } }), escritas, enviadas, grupos }
}
test('modo teste responde, mas nunca escreve na ficha', async () => {
  const { v, escritas, enviadas } = falso({ numero: '5519', situacao: 'perguntado', tentativas: 0, teste: true })
  assert.equal(await v.receber({ numero: '5519', texto: 'João Pedro da Silva, 14 anos' }), true)
  assert.equal(escritas.some(([t]) => t === 'acolitos_membros'), false)
  assert.equal(enviadas[0], RESPOSTAS.gravado('João'))
})
test('fora do modo teste, grava o telefone', async () => {
  const { v, escritas } = falso({ numero: '5519988887777', situacao: 'perguntado', tentativas: 0, teste: false })
  await v.receber({ numero: '5519988887777', texto: 'João Pedro da Silva, 14 anos' })
  assert.deepEqual(escritas.find(([t]) => t === 'acolitos_membros')[1], { telefone: '19988887777' })
})
test('quem não está na validação segue para a conversa normal', async () => {
  const { v, enviadas } = falso(null)
  assert.equal(await v.receber({ numero: '5519', texto: 'oi' }), false)
  assert.equal(enviadas.length, 0)
})
test('resposta incompleta pede de novo uma vez, depois vai para revisão', async () => {
  const a = falso({ numero: '5519', situacao: 'perguntado', tentativas: 0, teste: false })
  await a.v.receber({ numero: '5519', texto: 'oi' })
  assert.equal(a.enviadas[0], RESPOSTAS.repetir)
  const b = falso({ numero: '5519', situacao: 'perguntado', tentativas: 2, teste: false })
  await b.v.receber({ numero: '5519', texto: 'oi' })
  assert.equal(b.enviadas[0], RESPOSTAS.revisar)
})

const dados = (situacao, extra = {}) => ({ numero: '5519911112222', situacao, tentativas: 0, teste: false, membro_id: 'a', ...extra })
const FRASE_PAI = 'Eu não sirvo mais, meu filho serve, é o Pedro'
test('pai ou mãe que diz que o filho serve abre a conversa, em vez de encerrar', async () => {
  assert.equal(lerResposta(FRASE_PAI).filho, true)
  assert.equal(lerResposta('sou mãe do Pedro').filho, true)
  const { v, escritas, enviadas } = falso(dados('perguntado'))
  await v.receber({ numero: '5519911112222', texto: FRASE_PAI })
  assert.equal(enviadas[0], RESPOSTAS.filho_dados)
  assert.equal(escritas.find(([t]) => t === 'tarcisio_validacao_contato')[1].situacao, 'filho_dados')
})
test('com a ficha do filho achada, pede o número e diz que o grupo é só de comunicados', async () => {
  const { v, escritas, enviadas } = falso(dados('filho_dados'))
  await v.receber({ numero: '5519911112222', texto: 'João Pedro da Silva, 14 anos' })
  assert.match(enviadas[0], /somente para comunicados/)
  assert.equal(escritas.find(([t]) => t === 'tarcisio_validacao_contato')[1].situacao, 'filho_numero')
})
test('filho não localizado vai para revisão e nada entra no grupo', async () => {
  const { v, enviadas, grupos } = falso(dados('filho_dados'))
  await v.receber({ numero: '5519911112222', texto: 'Fulano de Tal, 12 anos' })
  assert.equal(enviadas[0], RESPOSTAS.revisar); assert.equal(grupos.length, 0)
})
test('número do filho entra na ficha vazia e no grupo, com o reforço de comunicados', async () => {
  const { v, escritas, enviadas, grupos } = falso(dados('filho_numero'))
  await v.receber({ numero: '5519911112222', texto: '19 98888-7777' })
  assert.deepEqual(escritas.find(([t]) => t === 'acolitos_membros')[1], { telefone: '19988887777' })
  assert.deepEqual(grupos, [['g@g.us', ['5519988887777']]])
  assert.match(enviadas[0], /somente para comunicados/)
})
test('modo teste simula a inclusão sem gravar nem mexer no grupo', async () => {
  const { v, escritas, grupos } = falso(dados('filho_numero', { teste: true }))
  await v.receber({ numero: '5519911112222', texto: '19 98888-7777' })
  assert.equal(escritas.some(([t]) => t === 'acolitos_membros'), false); assert.equal(grupos.length, 0)
})
test('ficha com outro número, ou filho no número da família, não entra no grupo', async () => {
  const a = falso(dados('filho_numero'), membros[1])
  await a.v.receber({ numero: '5519911112222', texto: '19 98888-7777' })
  assert.equal(a.grupos.length, 0); assert.equal(a.enviadas[0], RESPOSTAS.revisar)
  const b = falso(dados('filho_numero'))
  await b.v.receber({ numero: '5519911112222', texto: '19 91111-2222' })
  assert.equal(b.grupos.length, 0); assert.equal(b.enviadas[0], RESPOSTAS.revisar)
})
test('falha ao incluir no grupo vai para revisão, sem dizer que deu certo', async () => {
  const { v, enviadas } = falso(dados('filho_numero'), { ...membros[0], semGrupo: true })
  await v.receber({ numero: '5519911112222', texto: '19 98888-7777' })
  assert.equal(enviadas[0], RESPOSTAS.revisar)
})
test('lê número em formatos comuns', () => {
  assert.equal(lerNumero('(19) 98888-7777'), '5519988887777')
  assert.equal(lerNumero('+55 19 98888 7777'), '5519988887777')
  assert.equal(lerNumero('não tem'), null)
  assert.equal(lerNumero('usa o meu, 19 91111-2222'), null)
})
test('quem fala pelo filho precisa estar com o número da família na ficha', async () => {
  const { v, enviadas, escritas } = falso(dados('filho_dados', { numero: '5519977776666' }))
  await v.receber({ numero: '5519977776666', texto: 'João Pedro da Silva, 14 anos' })
  assert.equal(enviadas[0], RESPOSTAS.revisar)
  assert.equal(escritas.find(([t]) => t === 'tarcisio_validacao_contato')[1].motivo, 'número não é o da família na ficha')
})
test('número da família escrito em outro formato também não entra como número do filho', async () => {
  const { v, grupos, enviadas } = falso(dados('filho_numero', { numero: '5519933334444' }))
  await v.receber({ numero: '5519933334444', texto: '(19) 91111-2222' })
  assert.equal(grupos.length, 0); assert.equal(enviadas[0], RESPOSTAS.revisar)
})
test('número sem WhatsApp confirmado vai para revisão e não entra no grupo', async () => {
  const f = falso(dados('filho_numero'))
  f.evo.numerosComWhatsapp = async () => [{ existe: false }]
  await f.v.receber({ numero: '5519911112222', texto: '19 98888-7777' })
  assert.equal(f.grupos.length, 0); assert.equal(f.enviadas[0], RESPOSTAS.revisar)
})
test('compara número pelo DDD, tolerando 55 e nono dígito', () => {
  assert.equal(mesmoNumero('5519988887777', '19 8888-7777'), true)
  assert.equal(mesmoNumero('5519988887777', '11 98888-7777'), false)
  assert.equal(mesmoNumero('5519988887777', '98888-7777'), false)
  assert.equal(mesmoNumero('', ''), false)
})
test('nome e idade em mensagens separadas se juntam, em qualquer ordem', async () => {
  const a = falso({ numero: '5519988887777', situacao: 'perguntado', tentativas: 0, teste: false })
  await a.v.receber({ numero: '5519988887777', texto: 'João Pedro da Silva' })
  assert.match(a.enviadas[0], /só falta a idade/)
  assert.equal(a.escritas[0][1].nome_informado, 'joao pedro da silva')
  const b = falso({ numero: '5519988887777', situacao: 'perguntado', tentativas: 1, teste: false, nome_informado: 'joao pedro da silva' })
  await b.v.receber({ numero: '5519988887777', texto: '14 anos' })
  assert.equal(b.enviadas[0], RESPOSTAS.gravado('João'))
  const c = falso({ numero: '5519988887777', situacao: 'perguntado', tentativas: 0, teste: false })
  await c.v.receber({ numero: '5519988887777', texto: '14 anos' })
  assert.match(c.enviadas[0], /só falta o nome completo/)
  const d = falso({ numero: '5519988887777', situacao: 'perguntado', tentativas: 1, teste: false, idade_informada: 14 })
  await d.v.receber({ numero: '5519988887777', texto: 'João Pedro da Silva' })
  assert.equal(d.enviadas[0], RESPOSTAS.gravado('João'))
})
test('também junta os dados do filho vindos separados', async () => {
  const a = falso(dados('filho_dados'))
  await a.v.receber({ numero: '5519911112222', texto: 'João Pedro da Silva' })
  assert.match(a.enviadas[0], /só falta a idade de quem serve/)
  const b = falso(dados('filho_dados', { tentativas: 1, nome_informado: 'joao pedro da silva' }))
  await b.v.receber({ numero: '5519911112222', texto: '14' })
  assert.match(b.enviadas[0], /somente para comunicados/)
})
const FAM = '5519911112222'
test('lê irmãos em formatos comuns e ignora partículas do nome', () => {
  assert.deepEqual(lerFilhos('João Pedro da Silva, 14\nMaria Souza Lima 13 anos').map((f) => f.idade), [14, 13])
  assert.equal(lerFilhos('João Pedro da Silva 14 e Maria Souza Lima 13').length, 2)
  assert.equal(decidir({ nome: 'maria souza lima', idade: 13, numero: FAM, membros, hoje }).ficha.id, 'e')
  assert.deepEqual(lerCelulares('Pedro 19 98888-7777'), [{ nome: 'pedro', numero: '5519988887777' }])
})
test('irmãos: "meus filhos" pede nome e idade de cada um', async () => {
  const { v, enviadas } = falso(dados('perguntado'))
  await v.receber({ numero: FAM, texto: 'meus filhos servem' })
  assert.equal(enviadas[0], RESPOSTAS.filhos_dados)
})
test('irmãos localizados: pergunta se têm celular próprio', async () => {
  const { v, enviadas, escritas } = falso(dados('filhos_dados'))
  await v.receber({ numero: FAM, texto: 'João Pedro da Silva, 14\nMaria de Souza Lima, 13' })
  assert.match(enviadas[0], /WhatsApp próprio/)
  assert.equal(escritas.find(([t]) => t === 'tarcisio_validacao_contato')[1].filhos.length, 2)
})
test('irmãos sem celular: mantém o contato da família e não mexe nas fichas', async () => {
  const { v, enviadas, escritas, grupos } = falso(dados('filhos_celular', { filhos: [{ id: 'a', nome: 'João' }, { id: 'e', nome: 'Maria' }] }))
  await v.receber({ numero: FAM, texto: 'não' })
  assert.equal(enviadas[0], RESPOSTAS.filhos_sem_celular)
  assert.equal(escritas.some(([t]) => t === 'acolitos_membros'), false); assert.equal(grupos.length, 0)
})
test('irmão com celular entra no grupo; o outro segue com o contato da família', async () => {
  const { v, grupos, enviadas } = falso(dados('filhos_celular', { filhos: [{ id: 'a', nome: 'João' }, { id: 'e', nome: 'Maria' }] }))
  await v.receber({ numero: FAM, texto: 'João 19 98888-7777' })
  assert.equal(grupos.length, 1); assert.match(enviadas[0], /somente para comunicados/)
})
test('número sem nome reconhecível vai para revisão', async () => {
  const { v, grupos, enviadas } = falso(dados('filhos_celular', { filhos: [{ id: 'a', nome: 'João' }, { id: 'e', nome: 'Maria' }] }))
  await v.receber({ numero: FAM, texto: 'Carlos 19 98888-7777' })
  assert.equal(grupos.length, 0); assert.equal(enviadas[0], RESPOSTAS.revisar)
})
test('irmãos: número fora da ficha vai para revisão', async () => {
  const { v, enviadas } = falso(dados('filhos_dados', { numero: '5519977776666' }))
  await v.receber({ numero: '5519977776666', texto: 'João Pedro da Silva, 14\nMaria de Souza Lima, 13' })
  assert.equal(enviadas[0], RESPOSTAS.revisar)
})
test('idade diferente não barra: vale a resposta e a divergência fica anotada', async () => {
  const { v, escritas, enviadas } = falso({ numero: '5519988887777', situacao: 'perguntado', tentativas: 0, teste: false })
  await v.receber({ numero: '5519988887777', texto: 'João Pedro da Silva, 15 anos' })
  assert.equal(enviadas[0], RESPOSTAS.gravado('João'))
  assert.equal(escritas.findLast(([t]) => t === 'tarcisio_validacao_contato')[1].motivo, 'idade informada difere da ficha')
})
test('nome incompleto recebe sugestão; sim segue, não vai para revisão', async () => {
  const a = falso({ numero: '5519988887777', situacao: 'perguntado', tentativas: 0, teste: false })
  await a.v.receber({ numero: '5519988887777', texto: 'João Silva, 14' })
  assert.equal(a.enviadas[0], RESPOSTAS.confirmar_nome('João Pedro da Silva'))
  assert.equal(a.escritas.some(([t]) => t === 'acolitos_membros'), false)
  const pendente = { origem: 'proprio', fichas: [{ id: 'a', nome: 'João Pedro da Silva' }] }
  const b = falso({ numero: '5519988887777', situacao: 'confirmar_nome', tentativas: 0, teste: false, pendente })
  await b.v.receber({ numero: '5519988887777', texto: 'Sim' })
  assert.deepEqual(b.escritas.find(([t]) => t === 'acolitos_membros')[1], { telefone: '19988887777' })
  const c = falso({ numero: '5519988887777', situacao: 'confirmar_nome', tentativas: 0, teste: false, pendente })
  await c.v.receber({ numero: '5519988887777', texto: 'não' })
  assert.equal(c.enviadas[0], RESPOSTAS.revisar)
})
test('nome de filho só é sugerido a quem já tem o número da família na ficha', async () => {
  const a = falso(dados('filho_dados', { numero: '5519977776666' }))
  await a.v.receber({ numero: '5519977776666', texto: 'João Silva, 14' })
  assert.equal(a.enviadas[0], RESPOSTAS.revisar)
  const b = falso(dados('filhos_dados'))
  await b.v.receber({ numero: FAM, texto: 'João Silva 14 e Maria Lima 13' })
  assert.equal(b.enviadas[0], RESPOSTAS.confirmar_nome('João Pedro da Silva e Maria de Souza Lima'))
})
test('irmãos confirmados seguem para a pergunta do celular', async () => {
  const pendente = { origem: 'irmaos', fichas: [{ id: 'a', nome: 'João Pedro da Silva' }, { id: 'e', nome: 'Maria de Souza Lima' }] }
  const { v, enviadas } = falso(dados('confirmar_nome', { pendente }))
  await v.receber({ numero: FAM, texto: 'sim' })
  assert.match(enviadas[0], /WhatsApp próprio/)
})
test('sem número da família, nome incompleto com idade errada não revela a ficha', async () => {
  const { v, enviadas } = falso({ numero: '5519988887777', situacao: 'perguntado', tentativas: 0, teste: false })
  await v.receber({ numero: '5519988887777', texto: 'João Silva, 30' })
  assert.equal(enviadas[0], RESPOSTAS.revisar)
})
test('celulares: nome e número em linhas separadas, com "sim" antes', () => {
  assert.deepEqual(lerCelulares('Sim\n\nMatheus\n19 98888-7777\n\nLucas\n19 97777-6666').map((c) => [c.nome, c.numero]), [['matheus', '5519988887777'], ['lucas', '5519977776666']])
})
test('o mesmo número para dois filhos vai para revisão', async () => {
  const { v, grupos, enviadas } = falso(dados('filhos_celular', { filhos: [{ id: 'a', nome: 'João' }, { id: 'e', nome: 'Maria' }] }))
  await v.receber({ numero: FAM, texto: 'João\n19 98888-7777\nMaria\n19 98888-7777' })
  assert.equal(grupos.length, 0); assert.equal(enviadas[0], RESPOSTAS.revisar)
})
test('ignora rótulos e a frase de quem confirma que serve', () => {
  assert.deepEqual(lerResposta('Davi Martins Assis 11 anos e sirvo sim para o altar'), { nome: 'davi martins assis', idade: 11 })
  assert.deepEqual(lerResposta('Nome: Maria Souza\nIdade: 21\nSirvo no altar'), { nome: 'maria souza', idade: 21 })
  assert.deepEqual(lerResposta('Nome: Primo\nIdade: 21\nSirvo no altar'), { nome: 'primo', idade: 21 })
})
const iaFalsa = (r) => ({ texto: async () => (typeof r === 'string' ? r : JSON.stringify(r)) })
test('a leitura pela IA entrega nome e idade limpos', async () => {
  const r = await interpretar({ ia: iaFalsa({ intencao: 'dados', nome: 'Yasmin da Silva Oliveira', idade: 11, filhos: [] }), modelo: 'm', texto: 'x', etapa: 'perguntado', log: { warn() {} } })
  assert.equal(r.nome, 'yasmin da silva oliveira'); assert.equal(r.idade, 11)
})
test('intenções da IA viram os mesmos caminhos da conversa', async () => {
  const ler = (intencao) => interpretar({ ia: iaFalsa({ intencao, nome: '', idade: null, filhos: [] }), modelo: 'm', texto: 'x', etapa: 'perguntado' })
  assert.equal((await ler('nao_serve')).naoServe, true)
  assert.equal((await ler('filho')).filho, true)
  assert.equal((await ler('varios_filhos')).variosFilhos, true)
  assert.equal((await ler('outro')).nome, '')
})
test('idade inválida da IA vira nula, e JSON ruim cai nas regras', async () => {
  const a = await interpretar({ ia: iaFalsa({ intencao: 'dados', nome: 'Ana Souza', idade: 300, filhos: [] }), modelo: 'm', texto: 'x', etapa: 'perguntado' })
  assert.equal(a.idade, null)
  const b = await interpretar({ ia: iaFalsa('nao sei'), modelo: 'm', texto: 'João Pedro da Silva, 14', etapa: 'perguntado', log: { warn() {} } })
  assert.equal(b.nome, 'joao pedro da silva')
})
test('sem IA, a conversa segue pelas regras', async () => {
  const r = await interpretar({ ia: null, texto: 'João Pedro da Silva, 14', etapa: 'perguntado' })
  assert.equal(r.idade, 14)
})
test('mensagens seguidas do mesmo número são tratadas uma de cada vez', async () => {
  const ordem = []
  const linha = { numero: '5519', situacao: 'perguntado', tentativas: 0, teste: false }
  const { v } = falso(linha)
  await Promise.all([v.receber({ numero: '5519', texto: 'oi' }).then(() => ordem.push(1)), v.receber({ numero: '5519', texto: 'oi' }).then(() => ordem.push(2))])
  assert.deepEqual(ordem, [1, 2])
})
test('dois filhos já na primeira resposta seguem direto, sem pedir de novo', async () => {
  const { v, enviadas } = falso(dados('perguntado'))
  await v.receber({ numero: FAM, texto: 'João Pedro da Silva, 14\nMaria de Souza Lima, 13' })
  assert.match(enviadas[0], /WhatsApp próprio/)
})
test('a IA preserva os filhos quando a intenção é vários filhos', async () => {
  const r = await interpretar({ ia: iaFalsa({ intencao: 'varios_filhos', nome: '', idade: null, filhos: [{ nome: 'João Silva', idade: 14 }, { nome: 'Ana Souza', idade: 12 }] }), modelo: 'm', texto: 'x', etapa: 'perguntado' })
  assert.equal(r.filhos.length, 2)
})
test('pediu irmãos e veio um só: segue com esse, sem travar', async () => {
  const { v, enviadas } = falso(dados('filhos_dados'))
  await v.receber({ numero: FAM, texto: 'João Pedro da Silva, 14' })
  assert.match(enviadas[0], /somente para comunicados/)
})
test('número do filho chegando como cartão de contato', async () => {
  const { v, grupos } = falso(dados('filho_numero'))
  await v.receber({ numero: '5519911112222', texto: 'Jheniffer 5519988887777', contatos: [{ nome: 'Jheniffer', numero: '5519988887777' }] })
  assert.deepEqual(grupos, [['g@g.us', ['5519988887777']]])
})
test('celulares de irmãos chegando como cartões', async () => {
  const { v, grupos } = falso(dados('filhos_celular', { filhos: [{ id: 'a', nome: 'João' }, { id: 'e', nome: 'Maria' }] }))
  await v.receber({ numero: FAM, texto: 'João 5519988887777', contatos: [{ nome: 'João', numero: '5519988887777' }] })
  assert.equal(grupos.length, 1)
})
test('ficha com sobrenome abreviado vira sugestão do nome da ficha', () => {
  const lista = [{ id: 'g', nome: 'Ana Luísa C. Guerra', data_nascimento: '2012-06-15', telefone: null }]
  const r = acharFicha({ nome: 'ana luisa campos guerra', idade: 14, membros: lista, hoje })
  assert.equal(r.sugestao?.id, 'g')
  assert.equal(acharFicha({ nome: 'ana luisa souza guerra', idade: 14, membros: lista, hoje }).sugestao, undefined)
})
test('inicial só vale palavra por palavra: nome extra ou ficha sem inicial não casam', () => {
  const lista = [{ id: 'g', nome: 'Ana Luísa C. Guerra', data_nascimento: '2012-06-15', telefone: null }, { id: 'h', nome: 'Ana Luísa', data_nascimento: '2012-06-15', telefone: null }]
  assert.equal(acharFicha({ nome: 'ana luisa campos guerra', idade: 14, membros: lista, hoje }).sugestao?.id, 'g')
  assert.equal(acharFicha({ nome: 'ana luisa campos guerra silva', idade: 14, membros: [lista[0]], hoje }).sugestao, undefined)
  assert.equal(acharFicha({ nome: 'ana luisa pereira', idade: 14, membros: [lista[1]], hoje }).sugestao, undefined)
})

test('revisão de identidade fica na Caixa sem resposta de encaminhamento', async () => {
  const f=falso(dados('filho_dados'));
  await f.v.receber({numero:'5519911112222',texto:'Fulano de Tal, 12 anos'});
  assert.equal(f.enviadas.length,0);
  const p=f.escritas.find(([t])=>t==='tarcisio_pendencias');
  assert.equal(p[1].dados.aguardando_revisao,true);
  assert.equal(p[1].tipo,'coordenacao');
});

test('mãe que responde com o nome da filha no número da família: pede o número do servo, não grava', async () => {
  const { v, escritas, enviadas } = falso({ numero: FAM, situacao: 'perguntado', tentativas: 0, teste: false })
  await v.receber({ numero: FAM, texto: 'João Pedro da Silva, 14 anos' })
  assert.equal(enviadas[0], RESPOSTAS.familia_numero('João'))
  assert.equal(escritas.some(([t]) => t === 'acolitos_membros'), false)
  assert.equal(escritas.findLast(([t]) => t === 'tarcisio_validacao_contato')[1].situacao, 'filho_numero')
})
test('"é da minha filha", "sou mãe" e "responsável" são lidos como família', () => {
  for (const t of ['Oi e da me filha', 'Oi, é da minha filha', 'sou mãe', 'Mãe', 'responsável', 'sou o pai']) assert.equal(lerResposta(t).filho, true, t)
  assert.equal(lerResposta('João Pedro da Silva, 14').filho, undefined)
})
test('servo sem celular: responder "não tem" mantém o contato da família', async () => {
  const { v, enviadas } = falso(dados('filho_numero', { membro_id: 'a' }))
  await v.receber({ numero: FAM, texto: 'não tem' })
  assert.equal(enviadas[0], RESPOSTAS.filhos_sem_celular)
})
test('a pergunta inicial diz de quem é o número e pede o servo quando é de mãe, pai ou responsável', () => {
  assert.match(PERGUNTA, /este número é do próprio servo/i)
  assert.match(PERGUNTA, /mãe, pai ou responsável/)
})
