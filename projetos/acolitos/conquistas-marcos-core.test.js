const test=require('node:test'),assert=require('node:assert/strict');
const {separar,esMarco}=require('./conquistas-marcos-core.js');
test('separa os cinco marcos sem duplicar medalhas ou alterar a ordem original',()=>{
 const a=[{icone:'pomba',label:'Medalha',ganho:true},...['tempo_veterano','tempo_altar','tempo_raiz','tempo_pilar','tempo_chama'].map((icone,i)=>({icone,ganho:i>=2}))];
 const before=a.slice(),r=separar(a);assert.deepEqual(a,before);assert.equal(r.medalhas.length,1);assert.equal(r.marcos.length,5);assert.equal(r.ultimo.icone,'tempo_raiz');assert.equal(r.proximo.icone,'tempo_altar');assert.equal(new Set([...r.marcos,...r.medalhas]).size,a.length);
});
test('o reconhecimento do servidor prevalece sobre o tempo e preserva o requisito do Veterano',()=>{
 const a=[{icone:'tempo_altar',ganho:true},{icone:'tempo_veterano',ganho:false,requisito:'5 anos e Acólito Sentinela'}];const r=separar(a);assert.equal(r.ultimo,a[0]);assert.equal(r.proximo,a[1]);assert.equal(r.proximo.requisito,'5 anos e Acólito Sentinela');assert.equal(separar(a.map(b=>({...b,ganho:false}))).ultimo,null);assert.equal(separar(a.map(b=>({...b,ganho:true}))).proximo,null);
});
test('catálogo vazio e novos critérios de tempo não classificam medalhas normais por nome',()=>{
 assert.deepEqual(separar([]),{marcos:[],medalhas:[],ultimo:null,proximo:null});assert.equal(esMarco({icone:'relogio',label:'Tempo de servir'}),false);assert.equal(esMarco({icone:'novo',criterio:{fonte:'tenure',meses:120}}),true);
});
