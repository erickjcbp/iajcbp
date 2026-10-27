const test=require('node:test'),assert=require('node:assert/strict'),C=require('./quiz-core.js');
function config(){const c=C.novoQuiz().config;c.titulo='Gincana';c.quantidades={facil:1,medio:0,dificil:0};return c;}
function pergunta(){return {...C.novaPergunta(config()),enunciado:'Qual é o primeiro sacramento?',alternativas:['Batismo','Ordem','Matrimônio'],correta:0,explicacao:'O Batismo é a porta dos sacramentos.',referencia:'Catecismo da Igreja Católica, 1213'};}
test('defaults e limites de geração',()=>{assert.deepEqual(C.novoQuiz().config.quantidades,{facil:6,medio:6,dificil:6});for(const q of [-1,1.5,11])assert.throws(()=>C.configurar({...config(),quantidades:{facil:q,medio:0,dificil:0}}));assert.throws(()=>C.configurar({...config(),quantidades:{facil:10,medio:10,dificil:10}}));assert.throws(()=>C.configurar({...config(),temas:[]}));});
test('IA: quantidade, dificuldade, tema, alternativas e índice validados',()=>{const c=config(),q=pergunta();assert.equal(C.geradas({perguntas:[q]},c)[0].revisada,false);for(const invalida of [{...q,correta:3},{...q,correta:'0'},{...q,dificuldade:'medio'},{...q,alternativas:['a','a','b']},{...q,tema:'Santos'},{...q,referencia:null},{...q,explicacao:''}])assert.throws(()=>C.geradas({perguntas:[invalida]},c));assert.throws(()=>C.geradas({perguntas:[q,q]},c));});
test('IA: duplicata interna e de pergunta preservada',()=>{const q=pergunta();assert.throws(()=>C.geradas({perguntas:[q]},config(),[q]));const c=config();c.quantidades.facil=2;assert.throws(()=>C.geradas({perguntas:[q,{...q,enunciado:'  '+q.enunciado.toUpperCase()+'  '}]},c));});
test('rascunho aceita pergunta incompleta; pronto exige conteúdo e revisão',()=>{const quiz={config:config(),perguntas:[C.novaPergunta(config())]};C.validarQuiz(quiz);assert.throws(()=>C.validarQuiz(quiz,true));quiz.perguntas=[pergunta()];assert.throws(()=>C.validarQuiz(quiz,true));quiz.perguntas[0].revisada=true;C.validarQuiz(quiz,true);});
test('classificação: saldos negativos, estornos e empate compartilham posição',()=>{const casas=[{id:'a',nome:'A'},{id:'b',nome:'B'},{id:'c',nome:'C'}];let r=C.classificar(casas,[{casa_id:'a',valor:10},{casa_id:'b',valor:10},{casa_id:'c',valor:-3}]);assert.deepEqual(r.map(c=>[c.total,c.posicao,c.empate]),[[10,1,true],[10,1,true],[-3,3,false]]);r=C.classificar(casas,[{casa_id:'a',valor:10},{casa_id:'a',valor:-10}]);assert.ok(r.every(c=>c.total===0&&c.posicao===1));});

test('condução escolhe por nível e respeita resultados ativos, estornos e rodadas',()=>{
 const qs=[{id:'a',dificuldade:'facil'},{id:'b',dificuldade:'medio'},{id:'c',dificuldade:'dificil'}];
 const ls=[{id:'l1',rodada_id:'r1',pergunta_id:'a'},{id:'l2',rodada_id:'r1',pergunta_id:'b'},{id:'l3',estorno_de:'l2',rodada_id:'r1',pergunta_id:'b'}];
 assert.deepEqual(C.disponiveis(qs,ls,'r1','facil'),[]);
 assert.deepEqual(C.disponiveis(qs,ls,'r1','medio').map(q=>q.id),['b']);
 assert.equal(C.disponiveis(qs,ls,'r2').length,3);
 assert.equal(C.resultadosAtivos(ls,'r1').length,1);
});
