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


test('verificação semântica exige JSON válido e evidência literal da mensagem atual',async()=>{
 const entrada={modelo:'m',marco:'tunica_recebida',membro_id:'m1',membros:[{id:'m1',nome:'João Silva'}],mensagem:{id:'x',texto:'Já estou com ela'},historico:[{direcao:'saida',texto:'Você já recebeu a túnica?'}]};
 for(const resposta of [
  {confirmado:true,membro_id:'m1',marco:'tunica_recebida',evidencia:'Já estou com ela',motivo:'recebimento confirmado'},
  {confirmado:true,membro_id:'m2',marco:'tunica_recebida',evidencia:'Já estou com ela'},
  {confirmado:true,membro_id:'m1',marco:'tunica_recebida',evidencia:'recebi a túnica'},
  {confirmado:'true',membro_id:'m1',marco:'tunica_recebida',evidencia:'Já estou com ela'},
  {confirmado:true,membro_id:'m1',marco:'grupo_confirmado',evidencia:'Já estou com ela'},
  'JSON inválido'
 ]){
  const ia=criarIA({chave:'teste',fetchFn:async()=>({ok:true,json:async()=>({stop_reason:'end_turn',content:[{type:'text',text:typeof resposta==='string'?resposta:JSON.stringify(resposta)}]})})});
  const r=await ia.avaliarAcolhida(entrada);assert.equal(r.confirmado,resposta===undefined?false:typeof resposta==='object'&&resposta.membro_id==='m1'&&resposta.evidencia==='Já estou com ela'&&resposta.confirmado===true&&resposta.marco==='tunica_recebida');
 }
});

test('pendência silenciosa termina sem segunda chamada paga e sem exigir texto',async()=>{
 let n=0;const ia=criarIA({chave:'k',fetchFn:async()=>{n++;return{ok:true,json:async()=>({content:[{type:'tool_use',id:'t1',name:'chamar_coordenacao',input:{resumo:'dúvida'}}],stop_reason:'tool_use'})}}});
 const r=await ia.conversar({modelo:'claude-haiku-5-5',sistema:'S',mensagens:[{role:'user',content:'oi'}],ferramentas:[],executar:async()=>({ok:true,silencioso:true})});assert.equal(n,1);assert.equal(r.texto,'');assert.equal(r.usadas.length,1)
});
test('registra tokens de uso sem mensagem ou chave e não troca o modelo',async()=>{
 const logs=[],corpos=[];const ia=criarIA({chave:'segredo',logConsumo:{info:l=>logs.push(l)},fetchFn:async(_u,o)=>{corpos.push(JSON.parse(o.body));return{ok:true,json:async()=>({model:'claude-haiku-5-5',content:[{type:'text',text:'Certo'}],usage:{input_tokens:100,output_tokens:5}})}}});await ia.texto({modelo:'claude-haiku-5-5',sistema:'S',pedido:'mensagem privada'});assert.equal(corpos[0].model,'claude-haiku-5-5');assert.equal(logs.length,1);assert.match(logs[0],/input_tokens/);assert.doesNotMatch(logs[0],/segredo|mensagem privada/)
});

test('coleta estrita rejeita comentário interno e resposta livre, sem retentar nem enviar',async()=>{
 let n=0,corpo;const ia=criarIA({chave:'k',fetchFn:async(_u,o)=>{n++;corpo=JSON.parse(o.body);return{ok:true,json:async()=>({content:[{type:'text',text:'A mãe informou. Pergunto apenas isso. Continua servindo?'}],stop_reason:'end_turn'})}}});
 const r=await ia.conversar({modelo:'claude-haiku-5-5',sistema:'S',mensagens:[{role:'user',content:'Sou mãe'}],ferramentas:[{name:'continuar_coleta',input_schema:{type:'object',properties:{}}}],executar:async()=>({}),somenteFerramentas:true});assert.equal(r.texto,'');assert.equal(r.semAcaoSegura,true);assert.equal(n,1);assert.deepEqual(corpo.tool_choice,{type:'any'})
});
test('coleta usa só a frase do executor e ignora comentário do modelo mesmo junto à ferramenta',async()=>{
 let n=0;const ia=criarIA({chave:'k',fetchFn:async()=>{n++;return{ok:true,json:async()=>({content:[{type:'text',text:'A mãe informou um número; devo perguntar.'},{type:'tool_use',id:'t',name:'continuar_coleta',input:{}}],stop_reason:'tool_use'})}}});
 const r=await ia.conversar({modelo:'claude-haiku-5-5',sistema:'S',mensagens:[{role:'user',content:'Sou mãe'}],ferramentas:[{name:'continuar_coleta',input_schema:{type:'object',properties:{}}}],executar:async()=>({resposta_direta:'Aylla continua servindo na pastoral?'}),somenteFerramentas:true});assert.equal(r.texto,'Aylla continua servindo na pastoral?');assert.equal(r.origemTexto,'executor');assert.equal(n,1)
});
