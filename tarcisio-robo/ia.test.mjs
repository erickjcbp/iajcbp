import test from 'node:test';import assert from 'node:assert/strict';import {criarIA} from './ia.mjs';
test('resposta vazia sem ferramenta é repetida uma vez com reforço; texto da segunda vale',async()=>{
 const corpos=[];const respostas=[{content:[],stop_reason:'end_turn'},{content:[{type:'text',text:'São 14 textos curtos.'}],stop_reason:'end_turn'}];
 const ia=criarIA({chave:'k',fetchFn:async(_u,o)=>{corpos.push(JSON.parse(o.body));return {ok:true,json:async()=>respostas.shift()};}});
 const r=await ia.conversar({modelo:'m',sistema:'S',mensagens:[{role:'user',content:'oi'}],ferramentas:[],executar:async()=>({}),log:{warn(){}}});
 assert.equal(r.texto,'São 14 textos curtos.');assert.equal(corpos.length,2);assert.doesNotMatch(corpos[0].system,/SEMPRE em texto/);assert.match(corpos[1].system,/SEMPRE em texto/);
});
test('duas respostas vazias seguidas devolvem texto vazio (o robô usa o aviso padrão) sem laço infinito',async()=>{
 let n=0;const ia=criarIA({chave:'k',fetchFn:async()=>{n++;return {ok:true,json:async()=>({content:[],stop_reason:'end_turn'})};}});
 const r=await ia.conversar({modelo:'m',sistema:'S',mensagens:[{role:'user',content:'oi'}],ferramentas:[],executar:async()=>({}),log:{warn(){}}});
 assert.equal(r.texto,'');assert.equal(n,2);
});
