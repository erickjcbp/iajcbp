import { test } from 'node:test'
import assert from 'node:assert/strict'
import { criarRobo, vincularGrupoRetiro, prepararApresentacaoGrupos } from './robo.mjs'
import { ErroGateway } from './evolution.mjs'

// Banco falso: cada consulta encadeada (from().select().eq()…) termina chamando `responder`,
// que recebe a tabela e a lista de operações e devolve { data, error, count }.
function bancoFalso(responder) {
  const chamadas = []
  const from = (tabela) => {
    const ops = []
    const q = new Proxy({}, {
      get(_, nome) {
        if (nome === 'then') {
          const r = responder(tabela, ops)
          chamadas.push({ tabela, ops })
          return (ok, erro) => Promise.resolve(r ?? { data: null, error: null }).then(ok, erro)
        }
        return (...args) => { ops.push([nome, ...args]); return q }
      },
    })
    return q
  }
  return { from, chamadas }
}
const op = (ops, nome) => ops.find((o) => o[0] === nome)
const silencioso = { info() {}, warn() {}, error() {} }

const CFG = {
  id: 1, pausado: false, teto_diario: 2, janela_inicio: '08:00:00', janela_fim: '21:00:00',
  hora_lembrete: '19:00:00', hora_aniversario: '08:00:00', lembrete_ligado: false, aniversario_ligado: false,
  escala_ligada: true, rodape: '', numero_conectado: '5519900000000', qr_code: null, pedir_qr_em: null, pedir_grupos_em: null,
}

function cenario({ item, enviadosHoje = 0, cfg = {}, falha = null, aviso = null, celebracoes = [], hora = '2026-10-20T15:00:00Z' }) {
  const enviados = []
  const updates = []
  const db = bancoFalso((tabela, ops) => {
    if (tabela === 'tarcisio_config') return op(ops, 'single') ? { data: { ...CFG, ...cfg } } : { data: null }
    if (tabela === 'tarcisio_avisos') return { data: op(ops, 'maybeSingle') ? aviso : [] }
    if (tabela === 'acolitos_celebracoes') return { data: celebracoes }
    if (tabela !== 'tarcisio_envios') return { data: [] }
    if (op(ops, 'update')) { updates.push(op(ops, 'update')[1]); return { data: [{ id: 'x' }] } }
    if (op(ops, 'maybeSingle')) return { data: item }
    if (op(ops, 'select')?.[2]?.head) return { count: enviadosHoje }
    return { data: [] }
  })
  const evo = {
    estado: async () => 'open', numeroConectado: async () => '5519900000000',
    enviarTexto: async (d, t) => { if (falha) throw falha; enviados.push({ d, t }) },
    enviarImagem: async (d, u) => { if (falha) throw falha; enviados.push({ d, u }) },
    enviarVideo: async (d, v, t) => { if (falha) throw falha; enviados.push({ d, v, t }) },
  }
  const robo = criarRobo({ db, evo, supabaseUrl: 'https://p.supabase.co', relogio: () => new Date(hora), rnd: () => 0, log: silencioso })
  return { robo, enviados, updates }
}

const ITEM = { id: 'e1', tipo: 'lembrete', destino_numero: '5519998765432', texto: 'Olá', tentativas: 0 }

test('envia o item vencido e marca enviado', async () => {
  const { robo, enviados, updates } = cenario({ item: ITEM })
  await robo.rodada()
  assert.deepEqual(enviados, [{ d: '5519998765432', t: 'Olá' }])
  assert.equal(updates.at(-1).estado, 'enviado')
})

test('fora da janela (22h de Brasília) nada sai', async () => {
  const { robo, enviados } = cenario({ item: ITEM, hora: '2026-10-21T01:00:00Z' })
  await robo.rodada()
  assert.equal(enviados.length, 0)
})

test('pausado nada sai', async () => {
  const { robo, enviados } = cenario({ item: ITEM, cfg: { pausado: true } })
  await robo.rodada()
  assert.equal(enviados.length, 0)
})

test('teto do dia segura o privado, mas grupo não conta', async () => {
  const privado = cenario({ item: ITEM, enviadosHoje: 2 })
  await privado.robo.rodada()
  assert.equal(privado.enviados.length, 0)
  const grupo = cenario({ item: { ...ITEM, destino_numero: null, destino_jid: '123@g.us', imagem_url: 'https://p.supabase.co/storage/v1/object/public/artes-escala/a.png' }, enviadosHoje: 2 })
  await grupo.robo.rodada()
  assert.deepEqual(grupo.enviados, [{ d: '123@g.us', u: 'https://p.supabase.co/storage/v1/object/public/artes-escala/a.png' }])
})

test('erro passageiro volta para a fila em 5 min; na 3ª tentativa desiste', async () => {
  const um = cenario({ item: ITEM, falha: new ErroGateway(500, 'caiu') })
  await um.robo.rodada()
  assert.equal(um.updates.at(-1).estado, 'pendente')
  assert.equal(um.updates.at(-1).agendado_para, '2026-10-20T15:05:00.000Z')
  const tres = cenario({ item: { ...ITEM, tentativas: 2 }, falha: new ErroGateway(500, 'caiu') })
  await tres.robo.rodada()
  assert.equal(tres.updates.at(-1).estado, 'falhou')
})

test('número sem WhatsApp falha na hora, sem nova tentativa', async () => {
  const { robo, updates } = cenario({ item: ITEM, falha: new ErroGateway(400, 'Número sem WhatsApp', true) })
  await robo.rodada()
  assert.equal(updates.at(-1).estado, 'falhou')
  assert.equal(updates.at(-1).erro, 'Número sem WhatsApp')
})

test('depois de enviar, espera a pausa antes do próximo', async () => {
  const { robo, enviados } = cenario({ item: ITEM })
  await robo.rodada()
  await robo.rodada()
  assert.equal(enviados.length, 1)
})

test('imagem de fora da pasta do projeto não é enviada (a Evolution não busca endereço interno)', async () => {
  const { robo, enviados, updates } = cenario({ item: { ...ITEM, imagem_url: 'http://127.0.0.1:8101/instance/fetchInstances' } })
  await robo.rodada()
  assert.equal(enviados.length, 0)
  assert.equal(updates.at(-1).estado, 'falhou')
})

// ── lembrete de ausência ──
// Banco com memória: a fila respeita chave_unica (ignora duplicata), como o upsert real.
function cenarioAusencia({ cfg = {}, grupos, hora = '2026-10-18T12:00:00Z', fila = new Map() }) {
  const db = {
    from(tabela) {
      let upserted = null
      let opcoes = null
      const q = new Proxy({}, {
        get(_, nome) {
          if (nome === 'then') {
            let r = { data: [], error: null }
            if (tabela === 'tarcisio_config') r = { data: { ...CFG, ausencia_horas: ['09:00'], ausencia_ultimo: '15:00', ausencia_texto: null, ...cfg }, error: null }
            if (tabela === 'tarcisio_grupos') r = { data: grupos, error: null }
            if (tabela === 'tarcisio_envios' && upserted) {
              assert.deepEqual(opcoes, { onConflict: 'chave_unica', ignoreDuplicates: true, defaultToNull: false })
              const novas = upserted.filter((l) => !fila.has(l.chave_unica))
              novas.forEach((l) => fila.set(l.chave_unica, l))
              r = { data: novas.map((l, i) => ({ id: i })), error: null }
            }
            return (ok, erro) => Promise.resolve(r).then(ok, erro)
          }
          return (...args) => { if (nome === 'upsert') { upserted = args[0]; opcoes = args[1] }; return q }
        },
      })
      return q
    },
  }
  const evo = { estado: async () => 'close', numeroConectado: async () => null }
  const robo = criarRobo({ db, evo, supabaseUrl: 'https://p.supabase.co', relogio: () => new Date(hora), rnd: () => 0, log: silencioso })
  return { robo, fila }
}
const GRUPOS = ['pais', 'acolitos', 'cerimoniarios', 'equipe'].map((p) => ({ jid: `${p}@g.us`, nome: `G ${p}`, papel: p }))

test('pausa geral suprime o lembrete de ausência', async () => {
  const { robo, fila } = cenarioAusencia({ cfg: { pausado: true }, grupos: GRUPOS })
  await robo.rodada()
  assert.equal(fila.size, 0)
})

test('a mesma hora não repete na mesma rodada nem após reinício', async () => {
  const fila = new Map()
  const a = cenarioAusencia({ grupos: GRUPOS, fila })
  await a.robo.rodada()
  assert.equal(fila.size, 4)
  assert.deepEqual([...fila.keys()].sort(), ['pais', 'acolitos', 'cerimoniarios', 'equipe'].map((p) => `ausencia:2026-10-18:09:00:grupo:${p}`).sort())
  assert.ok([...fila.values()].every((l) => l.tipo === 'aviso' && /ausencias/.test(l.texto)))
  await a.robo.rodada() // próxima rodada de 5 s
  const reiniciado = cenarioAusencia({ grupos: GRUPOS, fila }) // robô novo, mesma fila no banco
  await reiniciado.robo.rodada()
  assert.equal(fila.size, 4)
})

test('um grupo não ligado vira linha falhou e os outros recebem', async () => {
  const { robo, fila } = cenarioAusencia({ grupos: GRUPOS.filter((g) => g.papel !== 'pais') })
  await robo.rodada()
  assert.equal(fila.size, 4)
  const falhou = fila.get('ausencia:2026-10-18:09:00:grupo:pais')
  assert.equal(falhou.estado, 'falhou')
  assert.equal(falhou.erro, 'Grupo não ligado na aba Grupos')
  assert.equal(fila.get('ausencia:2026-10-18:09:00:grupo:equipe').destino_jid, 'equipe@g.us')
})

test('rodada às 9h10 com o robô parado às 9h00 enfileira uma vez e a seguinte nada acrescenta', async () => {
  const fila = new Map()
  const a = cenarioAusencia({ grupos: GRUPOS, fila, hora: '2026-10-18T12:10:00Z' })
  await a.robo.rodada()
  assert.equal(fila.size, 4)
  assert.ok([...fila.keys()].every((k) => k.startsWith('ausencia:2026-10-18:09:00:grupo:')))
  await a.robo.rodada()
  assert.equal(fila.size, 4)
})

test('linha de ausência pendente há mais de 3 horas é expirada', async () => {
  const chamadas = []
  const db = bancoFalso((tabela, ops) => {
    if (tabela === 'tarcisio_config') return op(ops, 'single') ? { data: { ...CFG, lembrete_ligado: false } } : { data: null }
    if (tabela === 'tarcisio_envios' && op(ops, 'like')) chamadas.push(ops)
    return { data: [] }
  })
  const evo = { estado: async () => 'close', numeroConectado: async () => null }
  const agora = new Date('2026-10-20T20:00:00Z')
  await criarRobo({ db, evo, supabaseUrl: 'https://p.supabase.co', relogio: () => agora, rnd: () => 0, log: silencioso }).rodada()
  assert.equal(chamadas.length, 1)
  assert.equal(op(chamadas[0], 'like')[2], 'ausencia:%')
  assert.equal(op(chamadas[0], 'update')[1].estado, 'cancelado')
  assert.equal(op(chamadas[0], 'lt')[2], new Date(+agora - 3 * 3600_000).toISOString())
})

test('tentativa de enviar lembrete de ausência na terça 18h01 cancela a linha', async () => {
  const AUS = { ...ITEM, tipo: 'aviso', chave_unica: 'ausencia:2026-10-20:15:00:grupo:pais', destino_jid: 'p@g.us' }
  const { robo, enviados, updates } = cenario({ item: AUS, hora: '2026-10-20T21:01:00Z' })
  await robo.rodada()
  assert.equal(enviados.length, 0)
  assert.equal(updates.at(-1).estado, 'cancelado')
})

test('lembrete de ausência dentro do prazo (terça 17h) é enviado normalmente', async () => {
  const AUS = { ...ITEM, tipo: 'aviso', chave_unica: 'ausencia:2026-10-20:15:00:grupo:pais', destino_jid: 'p@g.us' }
  const { robo, enviados } = cenario({ item: AUS, hora: '2026-10-20T20:00:00Z' })
  await robo.rodada()
  assert.equal(enviados.length, 1)
})

// ── lembrete da véspera só para semana CONFIRMADA (rascunho do robô não chega no celular de ninguém) ──
function cenarioLembrete({ avisados, falhaAvisados = false, incluirSemNumero = false }) {
  const filas = []
  const db = bancoFalso((tabela, ops) => {
    if (tabela === 'tarcisio_config') return op(ops, 'single') ? { data: { ...CFG, lembrete_ligado: true, texto_lembrete: 'Amanhã ({dia}) {itens}.' } } : { data: null }
    if (tabela === 'acolitos_config') return falhaAvisados ? { data: null, error: { message: 'caiu' } } : { data: avisados === undefined ? null : { valor: avisados } }
    if (tabela === 'acolitos_celebracoes') return { data: [{ id: 'c1', data: '2026-10-31', horario: '19h', comunidade: 'matriz', minutos: 1140 }] }
    if (tabela === 'acolitos_escalas') return { data: [{ funcao: 'vela', celebracao_id: 'c1', membro: { id: 'm1', nome: 'Ana', telefone: '19998765432', nivel: 'aspirante' } }, ...(incluirSemNumero ? [{ funcao: 'vela', celebracao_id: 'c1', membro: { id: 'm2', nome: 'Sem telefone', nivel: 'aspirante' } }] : [])] }
    if (tabela === 'tarcisio_envios' && op(ops, 'upsert')) { assert.equal(op(ops, 'upsert')[2].defaultToNull, false); if(op(ops, 'upsert')[1].some(l=>!l.estado))return {error:{message:'estado nulo no lote misto'}}; filas.push(...op(ops, 'upsert')[1]); return { data: op(ops, 'upsert')[1].map((_, i) => ({ id: i })) } }
    return { data: [] }
  })
  const evo = { estado: async () => 'close', numeroConectado: async () => null, enviarTexto: async () => {}, enviarImagem: async () => {} }
  const avisos = []
  const log = { info() {}, error() {}, warn: (m) => avisos.push(m) }
  // sexta 30/10/2026 19:30 de Brasília
  const robo = criarRobo({ db, evo, supabaseUrl: 'https://p.supabase.co', relogio: () => new Date('2026-10-30T22:30:00Z'), rnd: () => 0, log })
  return { robo, filas, avisos }
}

test('véspera de semana NÃO confirmada: nenhum lembrete vai para a fila', async () => {
  const { robo, filas, avisos } = cenarioLembrete({ avisados: {} })
  await robo.rodada()
  assert.equal(filas.filter((l) => l.tipo === 'lembrete').length, 0)
  assert.ok(avisos.some((m) => /não confirmada/.test(m)), avisos.join('|'))
})
test('véspera de semana confirmada (chave em qualquer dia da semana): lembrete vai', async () => {
  const { robo, filas } = cenarioLembrete({ avisados: { '2026-10-26': ['m1'] } })
  await robo.rodada()
  assert.equal(filas.filter((l) => l.tipo === 'lembrete').length, 1)
  assert.equal(filas.find(l => l.tipo === 'lembrete').destino_numero, '5519998765432')
})
test('confirmação de OUTRA semana não libera o lembrete', async () => {
  const { robo, filas } = cenarioLembrete({ avisados: { '2026-10-24': ['m1'], '2026-11-02': ['m1'] } })
  await robo.rodada()
  assert.equal(filas.filter((l) => l.tipo === 'lembrete').length, 0)
})
test('sem conseguir ler os avisados: não lembra ninguém (não arrisca rascunho)', async () => {
  const { robo, filas } = cenarioLembrete({ falhaAvisados: true })
  await robo.rodada()
  assert.equal(filas.filter((l) => l.tipo === 'lembrete').length, 0)
})

test('aviso de grupo usa texto completo; privado e arte própria são preservados', async () => {
  for (const destino of [{ destino_jid: 'grupo@g.us', destino_numero: null }, { destino_numero: ITEM.destino_numero }]) {
    const c = cenario({ item: { ...ITEM, ...destino, tipo: 'aviso' } })
    await c.robo.rodada()
    assert.deepEqual(c.enviados, [destino.destino_jid ? { d: destino.destino_jid, t: ITEM.texto } : { d: destino.destino_numero, u: 'https://p.supabase.co/storage/v1/object/public/tarcisio/avisos/atencao-pastoral-v1.png' }])
    assert.equal(c.updates.at(-1).estado, 'enviado')
  }
  const imagem_url = 'https://p.supabase.co/storage/v1/object/public/tarcisio/avisos/propria.png'
  const c = cenario({ item: { ...ITEM, tipo: 'aviso', imagem_url } })
  await c.robo.rodada()
  assert.equal(c.enviados[0].u, imagem_url)
})

test('pausa permite somente a campanha autorizada do retiro; demais envios continuam bloqueados', async () => {
  const c = cenario({ item: { ...ITEM, tipo: 'aviso', chave_unica: 'campanha:retiro-2026-10-24:sexta:numero' },
    cfg: { pausado: true }, hora: '2026-10-23T21:00:00Z' })
  await c.robo.rodada()
  assert.equal(c.enviados.length, 1)
  const outro = cenario({ item: { ...ITEM, tipo: 'aviso', chave_unica: 'aviso:outro' }, cfg: { pausado: true } })
  await outro.robo.rodada()
  assert.equal(outro.enviados.length, 0)
})
test('campanha do retiro vencida é cancelada, sem envio atrasado', async () => {
  const c = cenario({ item: { ...ITEM, chave_unica: 'campanha:retiro-2026-10-24:sabado:numero' },
    cfg: { pausado: true }, hora: '2026-10-24T15:00:00Z' })
  await c.robo.rodada()
  assert.equal(c.enviados.length, 0)
  assert.equal(c.updates.at(-1).estado, 'cancelado')
})

test('grupo do retiro: nome exato tolera emoji, acento e espaços; ausente/ambíguo não vincula', async () => {
  for (const [grupos, esperado] of [
    [[{ nome: 'Cerimoniários🙏 -JCBP', jid: 'c@g.us' }], true],
    [[{ nome: 'Escala - Coroinhas | JCBP', jid: 'e@g.us' }], false],
    [[{ nome: 'Cerimoniários - Outra Paróquia', jid: 'o@g.us' }], false],
    [[{ nome: 'Cerimoniários🙏 -JCBP', jid: 'a@g.us' }, { nome: 'Cerimoniários -JCBP', jid: 'b@g.us' }], false],
  ]) {
    const updates = []
    const db = bancoFalso((t, ops) => {
      assert.equal(t, 'tarcisio_envios')
      assert.ok(op(ops, 'in')[2].every(k => k.endsWith(':grupo-cerimoniarios')))
      if (op(ops, 'update')) { updates.push(op(ops, 'update')[1]); return { data: [] } }
      return { data: [{ id: 'grupo' }] }
    })
    const resultado = await vincularGrupoRetiro(db, { grupos: async () => grupos })
    assert.equal(!!resultado, esperado)
    assert.equal(updates.length, esperado ? 1 : 0)
    if (esperado) { assert.equal(updates[0].estado, 'pendente'); assert.equal(updates[0].destino_jid, 'c@g.us') }
  }
})

test('apresentação agenda uma vez em todos os grupos adicionados às 08h; orienta dúvidas no privado', async () => {
  const linhas = []
  const db = bancoFalso((t, ops) => {
    if (t === 'tarcisio_grupos') return { data: [] }
    if (t === 'tarcisio_avisos') return { data: null }
    const up = op(ops, 'upsert')
    assert.equal(up[2].ignoreDuplicates, true)
    linhas.push(...up[1]); return { data: up[1].map((_, i) => ({ id: i })) }
  })
  await prepararApresentacaoGrupos(db, { grupos: async () => [
    { jid: 'e@g.us', nome: 'Escala - Coroinhas | JCBP' },
    { jid: 'c@g.us', nome: 'Cerimoniários🙏 -JCBP' },
    { jid: 'x@g.us', nome: 'Outro grupo' },
  ] })
  assert.equal(linhas.length, 3)
  for (const l of linhas) {
    assert.equal(l.agendado_para, '2026-10-23T08:00:00-03:00')
    assert.match(l.chave_unica, /:apresentacao:/)
    assert.match(l.texto, /Jesus Cristo Bom Pastor/)
    assert.doesNotMatch(l.texto, /assistente virtual/)
    assert.ok(l.texto.includes("https://coroinhas.jcbplimeira.com.br/ausencias"))
    assert.match(l.texto, /no privado/)
  }
})
test('aviso do retiro no grupo não sai antes da apresentação confirmada', async () => {
  const c = cenario({ item: { ...ITEM, tipo: 'aviso', destino_numero: null, destino_jid: 'c@g.us',
    chave_unica: 'campanha:retiro-2026-10-24:sexta:grupo-cerimoniarios' },
    cfg: { pausado: true }, hora: '2026-10-23T21:00:00Z' })
  await c.robo.rodada()
  assert.equal(c.enviados.length, 0)
})

test('preparação autorizada sai domingo às 06h mesmo na pausa; encerrada ou atrasada não sai', async () => {
  const item = { ...ITEM, tipo: 'aviso', destino_jid: 'pais@g.us', destino_numero: null, aviso_id: 'prep1',
    agendado_para: '2026-10-25T06:00:00-03:00', chave_unica: 'preparacao-missa:prep1:2026-10-25:pais@g.us' }
  const aviso = { ativo: true, texto: 'Prepare-se para a Missa.', configuracao: { tipo: 'preparacao_missa' } }
  for (const [ativo, hora, deveEnviar] of [[true, '06:00', true], [false, '06:00', false], [true, '07:00', false]]) {
    const c = cenario({ item: { ...item }, aviso: { ...aviso, ativo }, celebracoes: [{ minutos: 420 }], cfg: { pausado: true }, hora: `2026-10-25T${hora}:00-03:00` })
    await c.robo.rodada()
    assert.equal(c.enviados.length, deveEnviar ? 1 : 0)
    if (!deveEnviar) assert.equal(c.updates.at(-1).estado, 'cancelado')
  }
})

test('lote de lembretes com e sem telefone preserva estados e defaults do banco', async()=>{
 const {robo,filas}=cenarioLembrete({avisados:{'2026-10-26':['m1','m2']},incluirSemNumero:true});
 await robo.rodada();
 assert.equal(filas.length,2);
 assert.equal(filas.find(l=>l.membro_id==='m1').estado,'pendente');
 assert.equal(filas.find(l=>l.membro_id==='m2').estado,'sem_numero');
});

test('ATENÇÃO explícita no grupo vira texto; aviso vazio nunca chama o gateway',async()=>{
 const base={...ITEM,tipo:'aviso',destino_numero:null,destino_jid:'pais@g.us',imagem_url:'https://p.supabase.co/storage/v1/object/public/tarcisio/avisos/atencao-pastoral-v1.png?v=1'};
 const ok=cenario({item:base});await ok.robo.rodada();assert.deepEqual(ok.enviados,[{d:'pais@g.us',t:ITEM.texto}]);
 for(const texto of [null,'','   ']){const c=cenario({item:{...base,texto}});await c.robo.rodada();assert.equal(c.enviados.length,0);assert.match(c.updates.at(-1).erro,/Mensagem vazia/);assert.notEqual(c.updates.at(-1).estado,'enviado');}
});

test('acolhida com vídeo da integração sai como vídeo, com a legenda; sem vídeo continua só texto', async () => {
  const url = 'https://p.supabase.co/storage/v1/object/public/tarcisio/integracao/apresentacao-pastoral-v1.mp4'
  const { robo, enviados } = cenario({ item: { ...ITEM, tipo: 'aviso', chave_unica: 'acolhida:5519998765432:2026-10-28', imagem_url: url, texto: 'Apresentação 1 de 4' } })
  await robo.rodada()
  assert.equal(enviados.filter((e) => e.v === url && e.t === 'Apresentação 1 de 4').length, 1)
})
