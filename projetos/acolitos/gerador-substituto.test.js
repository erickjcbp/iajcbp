// Testes do motor de substituição. Rodar: node projetos/acolitos/gerador-substituto.test.js
const { escolherSubstituto, elegivelFuncao, nivelInt } = require('./gerador-substituto.js');
let falhas = 0;
function eq(nome, got, exp){
  const ok = JSON.stringify(got)===JSON.stringify(exp);
  console.log((ok?'PASS':'FAIL')+' — '+nome+(ok?'':'  got='+JSON.stringify(got)+' exp='+JSON.stringify(exp)));
  if(!ok) falhas++;
}
const rnd0 = ()=>0; // determinístico: empate escolhe o 1º após sort estável

// roster base
const M = (id, over={}) => Object.assign({id, nome:id, apelido:id, nivel:'coroinha', comunidade:'matriz', pode_outras_comunidades:true, data_nascimento:null}, over);
const hab = (fn, prof='apto') => ({[fn]:prof});

// 1) elegibilidade por habilitação
eq('elegível se apto na função',
  elegivelFuncao(M('a'), 'altar', 'matriz', {a:hab('altar')}, {}), true);
eq('não elegível se só em_formacao',
  elegivelFuncao(M('a'), 'altar', 'matriz', {a:{altar:'em_formacao'}}, {}), false);

// 2) kit Santo Antônio: cruz liberado p/ coroinha 7+ (sem data_nascimento → nível coroinha basta)
eq('kit sto antonio: coroinha sem hab pode cruz em santo_antonio',
  elegivelFuncao(M('a',{nivel:'coroinha'}), 'cruz', 'santo_antonio', {}, {}), true);
eq('kit não vale na matriz',
  elegivelFuncao(M('a',{nivel:'coroinha'}), 'cruz', 'matriz', {}, {}), false);
eq('kit não vale p/ aspirante (int 0)',
  elegivelFuncao(M('a',{nivel:'aspirante'}), 'cruz', 'santo_antonio', {}, {}), false);

// 3) escolha básica: rodízio pega menor carga
const roster3 = [M('x'), M('y'), M('z')];
eq('rodízio: menor carga primeiro',
  escolherSubstituto({ funcao:'altar', comunidade:'matriz', horKey:'dom_08:00',
    membroAusenteId:'q', roster:roster3, habMap:{x:hab('altar'),y:hab('altar'),z:hab('altar')},
    dispMap:{x:['dom_08:00'],y:['dom_08:00'],z:['dom_08:00']}, cargaMap:{x:5,y:1,z:9},
    usadosNaMissa:new Set(), usadoFds:new Set(), config:{}, rnd:rnd0 }).membroId, 'y');

// 4) filtro duro: exclui indisponível, ausente-alvo, já-usado-na-missa, inelegível
eq('exclui quem não está disponível no horário',
  escolherSubstituto({ funcao:'altar', comunidade:'matriz', horKey:'dom_08:00',
    membroAusenteId:'q', roster:[M('x'),M('y')], habMap:{x:hab('altar'),y:hab('altar')},
    dispMap:{x:['seg_19:00'], y:['dom_08:00']}, cargaMap:{x:0,y:9},
    usadosNaMissa:new Set(), usadoFds:new Set(), config:{}, rnd:rnd0 }).membroId, 'y');

eq('exclui quem já está na missa',
  escolherSubstituto({ funcao:'altar', comunidade:'matriz', horKey:'dom_08:00',
    membroAusenteId:'q', roster:[M('x'),M('y')], habMap:{x:hab('altar'),y:hab('altar')},
    dispMap:{x:['dom_08:00'],y:['dom_08:00']}, cargaMap:{x:0,y:9},
    usadosNaMissa:new Set(['x']), usadoFds:new Set(), config:{}, rnd:rnd0 }).membroId, 'y');

// 5) comunidade: prioriza mesma comunidade; cruza só se pode_outras_comunidades
eq('prioriza mesma comunidade',
  escolherSubstituto({ funcao:'altar', comunidade:'santo_antonio', horKey:'dom_08:00',
    membroAusenteId:'q',
    roster:[M('x',{comunidade:'matriz'}), M('y',{comunidade:'santo_antonio'})],
    habMap:{x:hab('altar'),y:hab('altar')}, dispMap:{x:['dom_08:00'],y:['dom_08:00']},
    cargaMap:{x:0,y:9}, usadosNaMissa:new Set(), usadoFds:new Set(), config:{}, rnd:rnd0 }).membroId, 'y');

eq('cruza comunidade só quem pode_outras_comunidades',
  escolherSubstituto({ funcao:'altar', comunidade:'santo_antonio', horKey:'dom_08:00',
    membroAusenteId:'q',
    roster:[M('x',{comunidade:'matriz',pode_outras_comunidades:false}), M('y',{comunidade:'matriz',pode_outras_comunidades:true})],
    habMap:{x:hab('altar'),y:hab('altar')}, dispMap:{x:['dom_08:00'],y:['dom_08:00']},
    cargaMap:{x:0,y:9}, usadosNaMissa:new Set(), usadoFds:new Set(), config:{}, rnd:rnd0 }).membroId, 'y');

// 6) cerimoniário reservado: em função MENOR, evita cerimoniário (int>=6) se houver não-cerimoniário
eq('menor: evita cerimoniário quando há coroinha',
  escolherSubstituto({ funcao:'altar', comunidade:'matriz', horKey:'dom_08:00',
    membroAusenteId:'q',
    roster:[M('cer',{nivel:'cerimoniario_guardiao'}), M('cor',{nivel:'coroinha'})],
    habMap:{cer:hab('altar'),cor:hab('altar')}, dispMap:{cer:['dom_08:00'],cor:['dom_08:00']},
    cargaMap:{cer:0,cor:9}, usadosNaMissa:new Set(), usadoFds:new Set(), config:{}, rnd:rnd0 }).membroId, 'cor');

eq('menor: usa cerimoniário se é o único',
  escolherSubstituto({ funcao:'altar', comunidade:'matriz', horKey:'dom_08:00',
    membroAusenteId:'q', roster:[M('cer',{nivel:'cerimoniario_guardiao'})],
    habMap:{cer:hab('altar')}, dispMap:{cer:['dom_08:00']}, cargaMap:{cer:0},
    usadosNaMissa:new Set(), usadoFds:new Set(), config:{}, rnd:rnd0 }).membroId, 'cer');

// 7) MAIOR: cerimoniário é elegível normalmente
eq('maior (turibulo): cerimoniário entra',
  escolherSubstituto({ funcao:'turibulo', comunidade:'matriz', horKey:'dom_08:00',
    membroAusenteId:'q', roster:[M('cer',{nivel:'cerimoniario_guardiao'})],
    habMap:{cer:hab('turibulo')}, dispMap:{cer:['dom_08:00']}, cargaMap:{cer:0},
    usadosNaMissa:new Set(), usadoFds:new Set(), config:{}, rnd:rnd0 }).membroId, 'cer');

// 8) sem candidato → null
eq('sem candidato válido → null',
  escolherSubstituto({ funcao:'altar', comunidade:'matriz', horKey:'dom_08:00',
    membroAusenteId:'q', roster:[M('x')], habMap:{}, dispMap:{x:['dom_08:00']},
    cargaMap:{}, usadosNaMissa:new Set(), usadoFds:new Set(), config:{}, rnd:rnd0 }).membroId, null);

console.log(falhas? ('\n'+falhas+' FALHA(S)') : '\nTODOS OK');
process.exit(falhas?1:0);
