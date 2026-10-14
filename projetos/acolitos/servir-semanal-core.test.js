const {test}=require('node:test');
const assert=require('node:assert/strict');
const S=require('./servir-semanal-core.js');
const G=require('./gerador-substituto.js');
const R=require('./rodizio-core.js');
const m={id:'m1',servir_toda_semana:true,nivel:'coroinha',comunidade:'matriz'};
const hab={m1:{vela:'apto',apoio:'apto'}};
test('quatro semanas ficam em duas funções e dois apoios; quinta não repete',()=>{
 const historico=[];
 for(const data of ['2026-11-01','2026-11-08','2026-11-15','2026-11-22','2026-11-29']){
  const slots=[{funcao:'vela',data},{funcao:'apoio',data}];
  S.reservar([m],slots,(p,s)=>S.pode(p,s.funcao,s.data,historico,hab)).forEach(({slot})=>historico.push({...slot,membro_id:m.id}));
 }
 assert.equal(historico.length,4);assert.equal(historico.filter(e=>e.funcao==='apoio').length,2);
 assert.equal(new Set(historico.map(e=>S.semana(e.data))).size,4);
});
test('escala futura montada conta, e não cabe outra missa na mesma semana',()=>{
 const h=[{membro_id:m.id,data:'2026-10-18',funcao:'vela'}];
 assert.equal(S.pode(m,'apoio','2026-10-17',h,hab),false);
 assert.equal(S.situacao(m.id,'2026-10-03',h).funcao,1);
});
test('semana atravessando dois meses não permite duplicação; cotas reiniciam no mês',()=>{
 const h=[{membro_id:m.id,data:'2026-10-31',funcao:'vela'}];
 assert.equal(S.pode(m,'apoio','2026-11-01',h,hab),false);
 assert.equal(S.pode(m,'vela','2026-11-08',h,hab),true);
});
test('duas funções já montadas deixam apenas apoio, sem exceção por kit leve',()=>{
 const h=[{membro_id:m.id,data:'2026-10-04',funcao:'vela'},{membro_id:m.id,data:'2026-10-11',funcao:'cruz'}];
 assert.equal(S.pode(m,'vela','2026-10-18',h,hab),false);
 assert.equal(S.pode(m,'apoio','2026-10-18',h,hab),true);
 assert.equal(S.pode(m,'cruz','2026-10-18',[],hab),false);
});
test('duas vagas de apoio deixam apenas função apta',()=>{
 const h=['2026-10-04','2026-10-11'].map(data=>({membro_id:m.id,data,funcao:'apoio'}));
 assert.equal(S.pode(m,'apoio','2026-10-18',h,hab),false);
 assert.equal(S.pode(m,'vela','2026-10-18',h,hab),true);
});
test('plano incompatível já montado requer revisão, sem acrescentar outra escala',()=>{
 const h=['2026-10-04','2026-10-11','2026-10-18'].map(data=>({membro_id:m.id,data,funcao:'vela'}));
 assert.equal(S.pode(m,'apoio','2026-10-25',h,hab),false);
});
test('escala substituída conta para quem entrou, não para quem saiu',()=>{
 const h=[{membro_id:m.id,substituto_id:'m2',status:'substituido',data:'2026-10-18',funcao:'vela'}];
 assert.equal(S.situacao(m.id,'2026-10-18',h).total,0);assert.equal(S.situacao('m2','2026-10-18',h).total,1);
});
test('reserva remaneja a pessoa versátil para preservar a única opção da outra',()=>{
 const a={...m,id:'a'},b={...m,id:'b'},slots=['vela','apoio'];
 const out=S.reservar([a,b],slots,(p,s)=>p.id==='a'||s==='vela');
 assert.equal(out.length,2);assert.equal(out.find(x=>x.membro.id==='b').slot,'vela');
});
test('o plano não cria vaga quando todas as opções são indisponíveis',()=>{
 assert.deepEqual(S.reservar([m],['vela'],()=>false),[]);
 assert.equal(S.pode(m,'vela','2026-10-18',null,hab),false);
});
test('rodízio mostra a meta individual de quatro e preserva a de dois',()=>{
 assert.equal(R.metaDoMembro(m),4);assert.equal(R.metaDoMembro({}),2);
 const e=['2026-10-04','2026-10-11'].map(data=>({membro_id:m.id,data}));
 assert.equal(R.montarRodizio({membros:[m],escalas:e,hoje:'2026-10-14'})[0].abaixoDaRegra,true);
});
test('substituição preserva o plano semanal, aptidão, suspensão e disponibilidade',()=>{
 const ctx={funcao:'vela',data:'2026-10-18',historicoSemanal:[],roster:[m],habMap:hab,dispMap:{m1:['domingo_9h']},horKey:'domingo_9h'};
 assert.equal(G.escolherSubstituto(ctx).membroId,m.id);
 assert.equal(G.escolherSubstituto({...ctx,historicoSemanal:[{membro_id:m.id,data:'2026-10-17',funcao:'apoio'}]}).membroId,null);
 assert.equal(G.escolherSubstituto({...ctx,dispMap:{}}).membroId,null);
 assert.equal(G.escolherSubstituto({...ctx,roster:[{...m,suspenso_ate:'2026-11-01'}]}).membroId,null);
});
test('cerimoniário só pode ter apoio automático quando opta pelo plano semanal',()=>{
 const ctx={funcao:'apoio',data:'2026-10-18',historicoSemanal:[],roster:[{...m,nivel:'cerimoniario_guardiao'}],habMap:hab};
 assert.equal(G.escolherSubstituto(ctx).membroId,m.id);
 assert.equal(G.escolherSubstituto({...ctx,roster:[{...m,servir_toda_semana:false,nivel:'cerimoniario_guardiao'}]}).membroId,null);
});
