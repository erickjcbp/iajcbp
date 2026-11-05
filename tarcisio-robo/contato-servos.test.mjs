import test from 'node:test'
import assert from 'node:assert/strict'
import {montarHistorico,conferirEvidencias,criarContatoServos} from './contato-servos.mjs'
const data='2026-11-04T12:12:00Z',campanha={id:'camp1',membro_id:'m1',enviado_em:data,destino_numero:'5519998313180',chave_unica:'contato-13-mais:2026-11-04:m1',texto:'Miguel continua servindo? Escreva o WhatsApp próprio.'}
const msgs=[{id:'v',direcao:'entrada',texto:'Sim.\nA mãe',created_at:'2026-11-04T12:21:10Z'},{id:'n',direcao:'entrada',texto:'Continua sim.\n19 97133 5528',created_at:'2026-11-04T12:21:53Z'}]
const entrada={numero:'19971335528',relacao:'mae',mensagem_vinculo_id:'v',mensagem_servico_id:'n',mensagem_numero_id:'n'}
const prova=(e=entrada,m=msgs,atuais=[msgs[1]],acao='registrar_whatsapp_servo')=>conferirEvidencias({campanha,mensagens:m,atuais,entrada:e,acao})
test('preserva a pergunta proativa e o histórico sem apagar a primeira saída',()=>{
 const r=montarHistorico([{direcao:'saida',texto:'Ainda serve? Qual o número próprio?'},{direcao:'entrada',texto:'Bom dia, sou a mãe'}])
 assert.equal(r[0].role,'user');assert.equal(r[1].role,'assistant');assert.match(r[1].content,/Ainda serve/);assert.match(r[2].content,/sou a mãe/)
})
test('replay da Gisele resolve vínculo em mensagem separada e telefone escrito',()=>assert.deepEqual(prova(),{ok:true,numero:'5519971335528'}))
test('número inventado, id de saída, mensagem antiga e replay sem entrada atual são recusados',()=>{
 assert.ok(prova({...entrada,numero:'19999991111'}).erro)
 assert.ok(prova(entrada,msgs.map(m=>({...m,direcao:'saida'}))).erro)
 assert.ok(prova(entrada,msgs.map(m=>({...m,created_at:'2026-11-01T12:00:00Z'}))).erro)
 assert.ok(prova(entrada,msgs,[]).erro)
})
test('não aceita vínculo ou continuidade inventados pelo modelo',()=>{
 assert.ok(prova({...entrada,relacao:'proprio'}).confirmacao_necessaria)
 assert.ok(prova(entrada,[msgs[0],{...msgs[1],texto:'Não tem celular 19 97133 5528'}]).confirmacao_necessaria)
})
test('não confunde mãe que não serve com filho que continua; não arquiva por falta de celular',()=>{
 const e={relacao:'mae',mensagem_vinculo_id:'v',mensagem_saida_id:'n'}
 for(const texto of ['Não sirvo, mas meu filho continua servindo','Não tem celular','Talvez ele saiu da pastoral','Não serve mais, mas a irmã serve'])assert.ok(prova(e,[msgs[0],{...msgs[1],texto}],[msgs[1]],'encerrar_servico').confirmacao_necessaria)
 assert.equal(prova(e,[msgs[0],{...msgs[1],texto:'Ele não serve mais'}],[msgs[1]],'encerrar_servico').ok,true)
})
function montar({duplicado=false,whatsapp=true,grupoConfirma=true,telefone='(19) 99831-3180'}={}){
 const membro={id:'m1',nome:'Miguel dos Santos Ribeiro',data_nascimento:'2013-10-12',status:'ativo',serve:true,telefone,celular_responsavel:null,celular_mae:null,celular_recado:'19988382696'}
 const escritas=[],adicionados=[],removidos=[],ps=[]
 const db={from(t){const ops=[];const q=new Proxy({},{get(_,k){if(k==='then')return(resolve,reject)=>{let data=[];const u=ops.find(o=>o[0]==='update');if(t==='tarcisio_envios')data=[campanha];if(t==='acolitos_membros'){
 if(ops.some(o=>o[0]==='single'||o[0]==='maybeSingle'))data={...membro};else if(u){escritas.push(u[1]);Object.assign(membro,u[1]);data=[{id:'m1'}]}else data=[membro,...(duplicado?[{id:'outra',telefone:'19971335528'}]:[])];}
 if(t==='tarcisio_grupos')data=[{jid:'ac@g.us',papel:'acolitos'},{jid:'ce@g.us',papel:'cerimoniarios'}];return Promise.resolve({data,error:null}).then(resolve,reject)};return(...args)=>{ops.push([k,...args]);return q}}});return q}}
 const evo={numerosComWhatsapp:async()=>[{existe:whatsapp}],participantes:async()=>[...ps],adicionarAoGrupo:async(j,ns)=>{adicionados.push([j,ns]);if(grupoConfirma)ps.push(...ns)},removerDoGrupo:async(j,ns)=>removidos.push([j,ns])}
 return{membro,escritas,adicionados,removidos,c:criarContatoServos({db,evo}),alvo:{campanha,membro:{...membro}}}
}
test('atualiza telefone, preserva a mãe e só confirma grupo após consultar participantes',async()=>{
 const f=montar();const r=await f.c.executar(f.alvo,'registrar_whatsapp_servo',entrada,msgs,[msgs[1]])
 assert.equal(r.ok,true);assert.equal(f.membro.telefone,'19971335528');assert.equal(f.membro.celular_responsavel,'19998313180');assert.equal(f.membro.no_grupo_whatsapp,true);assert.equal(f.adicionados.length,1)
})
test('recusa número sem WhatsApp ou usado em outra ficha antes de alterar cadastro',async()=>{
 for(const op of [{whatsapp:false},{duplicado:true}]){const f=montar(op);assert.ok((await f.c.executar(f.alvo,'registrar_whatsapp_servo',entrada,msgs,[msgs[1]])).erro);assert.equal(f.escritas.length,0);assert.equal(f.adicionados.length,0)}
})
test('entrada não confirmada no grupo não vira sucesso; telefone fica salvo para revisão',async()=>{
 const f=montar({grupoConfirma:false});assert.ok((await f.c.executar(f.alvo,'registrar_whatsapp_servo',entrada,msgs,[msgs[1]])).erro);assert.equal(f.membro.telefone,'19971335528');assert.notEqual(f.membro.no_grupo_whatsapp,true)
})
test('arquiva saída explícita sem retirar o telefone da mãe dos grupos',async()=>{
 const f=montar(),e={relacao:'mae',mensagem_vinculo_id:'v',mensagem_saida_id:'n'},m=[msgs[0],{...msgs[1],texto:'Ele não serve mais'}]
 const r=await f.c.executar(f.alvo,'encerrar_servico',e,m,[m[1]]);assert.equal(r.arquivado,true);assert.equal(f.membro.status,'afastado');assert.equal(f.removidos.length,0)
})

test('sim só confirma serviço quando responde a uma pergunta única sobre continuar servindo',()=>{
 const confirma={id:'s',direcao:'entrada',texto:'Sim',created_at:'2026-11-04T12:21:20Z'}
 const pergunta={id:'p',direcao:'saida',texto:'Ele continua servindo na pastoral?',created_at:'2026-11-04T12:21:15Z'}
 const historico=[msgs[0],pergunta,confirma,msgs[1]],e={...entrada,mensagem_servico_id:'s'}
 assert.equal(prova(e,historico).ok,true)
 assert.ok(prova(e,[msgs[0],{...pergunta,texto:'É a mãe? Ele serve?'},confirma,msgs[1]]).confirmacao_necessaria)
})

test('caso Daniela: número + observação sobre escala gera só pergunta ao destinatário',async()=>{
 const f=montar(),h=[{...msgs[0],texto:'Sou mãe'},{id:'e',direcao:'entrada',texto:'Ela faz tempo que não é escalada',created_at:'2026-11-04T12:22:00Z'},{...msgs[1],texto:'Minha gatinha 5519996071815'}];
 const r=await f.c.continuar(f.alvo,h,h.slice(1));assert.equal(r.resposta_direta,'Entendi. Miguel ainda deseja continuar servindo na pastoral?');assert.equal(f.escritas.length,0);assert.doesNotMatch(r.resposta_direta,/A mãe informou|Pergunto|foi respondida/)
})
test('caso Larissa: telefone já informado não é perguntado novamente',async()=>{
 const f=montar(),m={...msgs[1],texto:'Bom dia. Esse número é meu Larissa, mãe da Evelyn. O número dela é 19 99851-1069'};f.alvo.membro.nome='Evelyn Gabrieli Bonfiglio Ferreira';
 const r=await f.c.continuar(f.alvo,[m],[m]);assert.equal(r.resposta_direta,'Obrigado pelo número! Evelyn continua servindo na pastoral?');assert.equal(f.escritas.length,0)
})
test('caso Gisele completo usa executor e devolve só texto montado no código',async()=>{
 const f=montar(),r=await f.c.continuar(f.alvo,msgs,[msgs[1]]);assert.equal(r.ok,true);assert.match(r.resposta_direta,/entrada no grupo.*confirmada/);assert.equal(f.adicionados.length,1)
})
test('continuidade respondida não volta a ser perguntada, e pergunta sem resposta não é repetida',async()=>{
 const f=montar(),h=[msgs[0],{...msgs[1],texto:'Continua sim'}],r=await f.c.continuar(f.alvo,h,[h[1]]);assert.match(r.resposta_direta,/Pode escrever o WhatsApp/);assert.doesNotMatch(r.resposta_direta,/continua servindo/);
 const antes={direcao:'saida',texto:r.resposta_direta},atual={id:'a',direcao:'entrada',texto:'não entendi',created_at:'2026-11-04T12:23:00Z'};assert.ok((await f.c.continuar(f.alvo,[...h,antes,atual],[atual])).erro)
})

test('responsável já vinculado não precisa dizer novamente quem é; não confunde telefone da mãe com o do filho',async()=>{
 const f=montar({telefone:null});f.membro.celular_responsavel='19998313180';f.alvo.membro={...f.membro};
 const h=[{id:'s',direcao:'entrada',texto:'Sim ela está servindo sim',created_at:'2026-11-04T12:20:00Z'},{id:'mae',direcao:'entrada',texto:'Meu telefone é 19 99831-3180',created_at:'2026-11-04T12:21:00Z'},{id:'filha',direcao:'entrada',texto:'O número dela é 19 97133-5528',created_at:'2026-11-04T12:22:00Z'}];
 const r=await f.c.continuar(f.alvo,h,[h[2]]);assert.equal(r.ok,true);assert.equal(f.membro.telefone,'19971335528');assert.equal(f.membro.celular_responsavel,'19998313180');assert.equal(f.adicionados.length,1)
})

test('encerramento ignora cumprimento e agradecimento, mas preserva uma pergunta real',async()=>{
 const {soEncerramento}=await import('./contato-servos.mjs');
 for(const t of ['Boa tarde','Ah ótimo','Obrigada 🙏🏻','Bom dia, muito obrigada!','👍'])assert.equal(soEncerramento(t),true,t)
 for(const t of ['Boa tarde, qual a próxima escala?','Obrigada, mas o número está errado','Pode mudar para as 19h?'])assert.equal(soEncerramento(t),false,t)
})
test('resultado manual concluído é persistido e não reabre após reiniciar o fluxo',async()=>{
 const {bancoMemoria}=await import('./banco-memoria.mjs');
 const m={id:'m1',nome:'Miguel dos Santos Ribeiro',status:'ativo',serve:true,data_nascimento:'2013-10-12',telefone:'19971335528',celular_responsavel:'19998313180',no_grupo_whatsapp:true};
 const db=bancoMemoria({acolitos_membros:[m],tarcisio_envios:[{...campanha,estado:'enviado'}],tarcisio_grupos:[{jid:'ac@g.us',papel:'acolitos'}]});
 const a=criarContatoServos({db,evo:{}});assert.equal((await a.carregar(campanha.destino_numero,'2026-11-04')).encerrada,true);assert.equal(db.t.tarcisio_validacao_contato[0].pendente.coleta_concluida,true);
 db.t.acolitos_membros[0].no_grupo_whatsapp=false;
 assert.equal((await criarContatoServos({db,evo:{}}).carregar(campanha.destino_numero,'2026-11-04')).encerrada,true,'marcador persistido prevalece mesmo quando o indicador do grupo muda');
})
