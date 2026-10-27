import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {preparar,rpc,rpcAsync,sql,como,ids,quote} from './quiz-db.mjs';
const require=createRequire(import.meta.url),C=require('../quiz-core.js');
preparar();let verificacoes=0;
function prova(t,f){f();verificacoes++;console.log('✔ '+t);}
function falha(f){assert.throws(f);}
const config={...C.novoQuiz().config,titulo:'Quiz de prova',quantidades:{facil:1,medio:0,dificil:0}};
const pergunta={...C.novaPergunta(config),enunciado:'Qual é o primeiro sacramento?',alternativas:['Batismo','Ordem','Matrimônio'],explicacao:'O Batismo é a porta dos sacramentos.',referencia:'Catecismo 1213',revisada:true};
let quiz=rpc('salvar_quiz',{config,perguntas:[pergunta],status:'pronto'});
prova('quiz pronto persistido e protegido por versão',()=>{assert.equal(quiz.status,'pronto');falha(()=>rpc('salvar_quiz',{...quiz,versao:0}));});
prova('edição de conteúdo revisado exige nova revisão no banco',()=>{const edit={...quiz,perguntas:[{...pergunta,enunciado:'Qual sacramento é a porta dos demais?'}]};falha(()=>rpc('salvar_quiz',edit));quiz=rpc('salvar_quiz',{...edit,status:'rascunho'});assert.equal(quiz.perguntas[0].revisada,false);quiz.perguntas[0].revisada=true;quiz=rpc('salvar_quiz',{...quiz,status:'pronto'});});
prova('banco rejeita pergunta incompleta, índice inválido e duplicatas',()=>{for(const perguntas of [[{...pergunta,correta:8}],[{...pergunta,explicacao:''}],[pergunta,{...pergunta,id:randomUUID()}]])falha(()=>rpc('salvar_quiz',{config,perguntas,status:'pronto'}));});
prova('duplicação é um novo rascunho e preserva original',()=>{const copy=rpc('duplicar_quiz',{id:quiz.id});assert.notEqual(copy.id,quiz.id);assert.equal(copy.status,'rascunho');assert.equal(copy.perguntas[0].revisada,false);});
const regras={facil:10,medio:20,dificil:30,erro:0};
let g=rpc('salvar_gincana',{nome:'Gincana de prova',descricao:'Prova isolada',data:'2026-10-22',regras});
const g2=rpc('salvar_gincana',{nome:'Outra gincana',data:'2026-10-22',regras});
const casa=rpc('adicionar_casa',{gincana_id:g.id,origem_id:ids.casa}).id;
const casa2=rpc('adicionar_casa',{gincana_id:g.id,nome:'São Domingos',cor:'#2162b8'}).id;
const outraCasa=rpc('adicionar_casa',{gincana_id:g2.id,nome:'Outra casa',cor:'#123456'}).id;
const rodada=rpc('criar_rodada',{gincana_id:g.id,quiz_id:quiz.id}).id;
const lance=(extra={})=>({gincana_id:g.id,casa_id:casa,valor:10,justificativa:'Atividade de prova',pedido_id:randomUUID(),...extra});
prova('casas existentes e manuais, sem duplicar casa cadastrada',()=>{assert.equal(rpc('estado',{gincana_id:g.id}).casas.length,2);falha(()=>rpc('adicionar_casa',{gincana_id:g.id,origem_id:ids.casa}));});
prova('preparação bloqueia lançamento',()=>falha(()=>rpc('lancar',lance())));
rpc('status',{gincana_id:g.id,status:'em_andamento',justificativa:'Começou'});
prova('pontos positivos, penalidades e idempotência do pedido',()=>{const p=lance();const a=rpc('lancar',p),b=rpc('lancar',p);assert.equal(a.id,b.id);assert.equal(b.repetido,true);rpc('lancar',lance({valor:-15}));const e=rpc('estado',{gincana_id:g.id});assert.equal(C.classificar(e.casas,e.lancamentos).find(c=>c.id===casa).total,-5);});
prova('isolamento entre casas, gincanas e rodadas',()=>{falha(()=>rpc('lancar',lance({casa_id:outraCasa})));falha(()=>rpc('lancar',lance({gincana_id:g2.id,rodada_id:rodada,pergunta_id:pergunta.id,resultado:'acerto'})));falha(()=>rpc('lancar',lance({rodada_id:rodada,pergunta_id:randomUUID(),resultado:'acerto'})));});
const resultado=lance({rodada_id:rodada,pergunta_id:quiz.perguntas[0].id,resultado:'acerto',valor:9999});
const acerto=rpc('lancar',resultado);
prova('acerto calculado no banco e resultado duplicado bloqueado',()=>{const l=rpc('estado',{gincana_id:g.id}).lancamentos.find(l=>l.id===acerto.id);assert.equal(l.valor,10);falha(()=>rpc('lancar',{...resultado,pedido_id:randomUUID()}));});
prova('estorno imutável, sem estorno duplicado e novo resultado permitido',()=>{rpc('estornar',{gincana_id:g.id,lancamento_id:acerto.id,justificativa:'Correção',pedido_id:randomUUID()});falha(()=>rpc('estornar',{gincana_id:g.id,lancamento_id:acerto.id,justificativa:'Repetido',pedido_id:randomUUID()}));rpc('lancar',{...resultado,resultado:'erro',pedido_id:randomUUID()});const e=rpc('estado',{gincana_id:g.id});assert.ok(e.lancamentos.some(l=>l.id===acerto.id));assert.equal(e.lancamentos.at(-1).valor,0);});
const rodada2=rpc('criar_rodada',{gincana_id:g.id,quiz_id:quiz.id}).id;
prova('nova rodada permite anulação sem casa e bloqueia a mesma pergunta',()=>{rpc('lancar',{...resultado,rodada_id:rodada2,casa_id:null,resultado:'anulada',pedido_id:randomUUID()});falha(()=>rpc('lancar',{...resultado,rodada_id:rodada2,pedido_id:randomUUID()}));});
prova('regras novas não recalculam histórico; erro usa desconto configurado',()=>{const antes=rpc('estado',{gincana_id:g.id});g=rpc('salvar_gincana',{...antes.gincana,regras:{...regras,facil:50,erro:-3}});const r=rpc('criar_rodada',{gincana_id:g.id,quiz_id:quiz.id}).id;rpc('lancar',{...resultado,rodada_id:r,resultado:'erro',pedido_id:randomUUID()});const depois=rpc('estado',{gincana_id:g.id});assert.equal(depois.lancamentos.at(-1).valor,-3);assert.deepEqual(depois.lancamentos.slice(0,-1),antes.lancamentos);});
prova('sem pontos aceita pergunta sem casa',()=>{const r=rpc('criar_rodada',{gincana_id:g.id,quiz_id:quiz.id}).id;rpc('lancar',{...resultado,rodada_id:r,casa_id:null,resultado:'sem_pontos',pedido_id:randomUUID()});});
prova('permissões reais no banco: membro comum e outra pastoral sem acesso',()=>{for(const u of [ids.coroinha,ids.outro]){falha(()=>rpc('estado',{gincana_id:g.id},u));falha(()=>rpc('salvar_quiz',{config,perguntas:[],status:'rascunho'},u));assert.equal(sql(como(u,'select count(*) from public.acolitos_quizzes')).split('\n').at(-1),'0');falha(()=>sql(como(u,"insert into public.acolitos_quizzes(module_id,config,criado_por) values('"+ids.mod+"','{}','"+u+"')")));}falha(()=>sql(como('',"select public.quiz_operar('estado','{}')",'anon')));});
prova('histórico não permite update/delete direto nem à coordenação',()=>{for(const op of ['update public.acolitos_gincana_lancamentos set valor=999','delete from public.acolitos_gincana_lancamentos'])falha(()=>sql(como(ids.admin,op)));});
const rc=rpc('criar_rodada',{gincana_id:g.id,quiz_id:quiz.id}).id;
const concorrentes=await Promise.allSettled([rpcAsync('lancar',{...resultado,rodada_id:rc,pedido_id:randomUUID()},ids.admin),rpcAsync('lancar',{...resultado,rodada_id:rc,pedido_id:randomUUID()},ids.equipe)]);
assert.equal(concorrentes.filter(r=>r.status==='fulfilled').length,1);verificacoes++;console.log('✔ dois responsáveis concorrentes: exatamente um resultado ativo');
await Promise.all([rpcAsync('lancar',lance({valor:7}),ids.admin),rpcAsync('lancar',lance({valor:9}),ids.equipe)]);verificacoes++;console.log('✔ lançamentos avulsos concorrentes preservam ambos os valores');
prova('encerramento bloqueia lançamentos e exige motivo para reabertura',()=>{rpc('status',{gincana_id:g.id,status:'encerrada',justificativa:'Fim da prova'});falha(()=>rpc('lancar',lance()));falha(()=>rpc('estornar',{gincana_id:g.id,lancamento_id:acerto.id,justificativa:'Correção',pedido_id:randomUUID()}));falha(()=>rpc('status',{gincana_id:g.id,status:'em_andamento',justificativa:''}));rpc('status',{gincana_id:g.id,status:'em_andamento',justificativa:'Correção autorizada'});assert.ok(rpc('estado',{gincana_id:g.id}).auditoria.some(a=>a.justificativa==='Correção autorizada'));});
prova('limite de IA e pedido repetido são atômicos',()=>{const pedido=randomUUID();rpc('reservar_ia',{pedido_id:pedido,quantidade:24});falha(()=>rpc('reservar_ia',{pedido_id:pedido,quantidade:24}));falha(()=>rpc('reservar_ia',{pedido_id:randomUUID(),quantidade:25}));});

prova('resumo dos retiros exige equipe e não concede gestão de retiros',()=>{assert.ok(Array.isArray(rpc('listar_retiros')));falha(()=>rpc('listar_retiros',{},ids.coroinha));});
const retiro=sql("insert into public.acolitos_retiro_areas(nome,tipo,data_inicio) values('Retiro de prova','retiro','2026-11-29') returning id");
let temporada=rpc('iniciar_temporada',{retiro_id:retiro});
prova('temporada reutiliza retiro e casas oficiais, com saldo inicial zero',()=>{
 assert.equal(temporada.gincana.retiro_id,retiro);assert.ok(temporada.casas.length>=5);assert.equal(temporada.lancamentos.length,0);
 assert.equal(rpc('iniciar_temporada',{retiro_id:retiro}).gincana.id,temporada.gincana.id);
 falha(()=>rpc('iniciar_temporada',{retiro_id:retiro},ids.coroinha));
});
const rid=rpc('criar_rodada',{gincana_id:temporada.gincana.id,quiz_id:quiz.id}).id;
prova('condução valida pergunta, rodada e versão concorrente',()=>{
 falha(()=>rpc('conduzir',{gincana_id:temporada.gincana.id,rodada_id:rodada,pergunta_id:quiz.perguntas[0].id,versao:0}));
 const c=rpc('conduzir',{gincana_id:temporada.gincana.id,rodada_id:rid,pergunta_id:quiz.perguntas[0].id,revelacao:0,versao:0});assert.equal(c.versao,1);
 falha(()=>rpc('conduzir',{gincana_id:temporada.gincana.id,rodada_id:rid,pergunta_id:quiz.perguntas[0].id,revelacao:1,versao:0}));
});
prova('telão recebe pergunta, revelação e explicação persistidas',()=>{
 const c=rpc('conduzir',{gincana_id:temporada.gincana.id,rodada_id:rid,pergunta_id:quiz.perguntas[0].id,revelacao:2,versao:1});
 const atual=rpc('estado',{gincana_id:temporada.gincana.id});assert.equal(atual.gincana.conducao.revelacao,2);assert.equal(c.versao,2);
});
rpc('status',{gincana_id:temporada.gincana.id,status:'em_andamento',justificativa:'Início da temporada'});
prova('registrar resultado libera a próxima escolha e impede reapresentar resultado ativo',()=>{
 rpc('lancar',{gincana_id:temporada.gincana.id,casa_id:temporada.casas[0].id,rodada_id:rid,pergunta_id:quiz.perguntas[0].id,resultado:'acerto',justificativa:'Acerto',pedido_id:randomUUID()});
 const e=rpc('estado',{gincana_id:temporada.gincana.id});assert.equal(e.gincana.conducao.pergunta_id,null);assert.equal(e.gincana.conducao.versao,3);
 falha(()=>rpc('conduzir',{gincana_id:temporada.gincana.id,rodada_id:rid,pergunta_id:quiz.perguntas[0].id,revelacao:0,versao:3}));
});
prova('base privada não pode ser chamada pelo navegador',()=>falha(()=>sql(como(ids.admin,"select public.quiz_operar_base('estado','{}')"))));
console.log(JSON.stringify({verificacoes,gincana_id:g.id,quiz_id:quiz.id}));
