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

// 7b) APOIO: cerimoniário nunca entra na substituição automática (só manual)
eq('apoio: só cerimoniário disponível → não escala (null)',
  escolherSubstituto({ funcao:'apoio', comunidade:'matriz', horKey:'dom_08:00',
    membroAusenteId:'q', roster:[M('cer',{nivel:'cerimoniario_guardiao'})],
    habMap:{cer:hab('apoio')}, dispMap:{cer:['dom_08:00']}, cargaMap:{cer:0},
    usadosNaMissa:new Set(), usadoFds:new Set(), config:{}, rnd:rnd0 }).membroId, null);
eq('apoio: coroinha (não-cerimoniário) entra normalmente',
  escolherSubstituto({ funcao:'apoio', comunidade:'matriz', horKey:'dom_08:00',
    membroAusenteId:'q', roster:[M('cor',{nivel:'coroinha'})],
    habMap:{cor:hab('apoio')}, dispMap:{cor:['dom_08:00']}, cargaMap:{cor:0},
    usadosNaMissa:new Set(), usadoFds:new Set(), config:{}, rnd:rnd0 }).membroId, 'cor');

// 8) sem candidato → null
eq('sem candidato válido → null',
  escolherSubstituto({ funcao:'altar', comunidade:'matriz', horKey:'dom_08:00',
    membroAusenteId:'q', roster:[M('x')], habMap:{}, dispMap:{x:['dom_08:00']},
    cargaMap:{}, usadosNaMissa:new Set(), usadoFds:new Set(), config:{}, rnd:rnd0 }).membroId, null);

// 9) MENOR tier 2 vs tier 3: !cerimo (tier 2) bate !usadoFds (tier 3)
eq('menor: tier 2 (!cerimo) sobre tier 3 (!usadoFds)',
  escolherSubstituto({ funcao:'altar', comunidade:'matriz', horKey:'dom_08:00',
    membroAusenteId:'q',
    roster:[M('cer',{nivel:'cerimoniario_guardiao'}), M('cor',{nivel:'coroinha'})],
    habMap:{cer:hab('altar'),cor:hab('altar')},
    dispMap:{cer:['dom_08:00'],cor:['dom_08:00']},
    cargaMap:{cer:0,cor:0},
    usadosNaMissa:new Set(),
    usadoFds:new Set(['cor']),
    config:{}, rnd:rnd0 }).membroId, 'cor');

// 10) MAIOR: !usadoFds (tier 1) sobre any (tier 2)
eq('maior (turibulo): !usadoFds (tier 1) sobre qualquer (tier 2)',
  escolherSubstituto({ funcao:'turibulo', comunidade:'matriz', horKey:'dom_08:00',
    membroAusenteId:'q',
    roster:[M('a'), M('b')],
    habMap:{a:hab('turibulo'),b:hab('turibulo')},
    dispMap:{a:['dom_08:00'],b:['dom_08:00']},
    cargaMap:{a:0,b:0},
    usadosNaMissa:new Set(),
    usadoFds:new Set(['a']),
    config:{}, rnd:rnd0 }).membroId, 'b');

// 11) config.funcoes_maiores override: altar como MAIOR, cerimoniário com menor carga ganha
eq('override funcoes_maiores: altar MAIOR, cerimoniário menor carga ganha',
  escolherSubstituto({ funcao:'altar', comunidade:'matriz', horKey:'dom_08:00',
    membroAusenteId:'q',
    roster:[M('cer',{nivel:'cerimoniario_guardiao'}), M('cor',{nivel:'coroinha'})],
    habMap:{cer:hab('altar'),cor:hab('altar')},
    dispMap:{cer:['dom_08:00'],cor:['dom_08:00']},
    cargaMap:{cer:1,cor:9},
    usadosNaMissa:new Set(),
    usadoFds:new Set(),
    config:{funcoes_maiores:['altar']},
    rnd:rnd0 }).membroId, 'cer');

// 12) kit Santo Antônio: age boundary (idade_min 7)
eq('kit santo_antonio: cruz data_nascimento 2000-01-01 (7+) elegível',
  elegivelFuncao(M('a',{data_nascimento:'2000-01-01'}), 'cruz', 'santo_antonio', {}, {}), true);

var threeYearsAgo = ((new Date().getFullYear())-3)+'-01-01';
eq('kit santo_antonio: cruz data_nascimento 3 anos atrás (<7) inelegível',
  elegivelFuncao(M('b',{data_nascimento:threeYearsAgo}), 'cruz', 'santo_antonio', {}, {}), false);

console.log(falhas? ('\n'+falhas+' FALHA(S)') : '\nTODOS OK');
process.exit(falhas?1:0);
