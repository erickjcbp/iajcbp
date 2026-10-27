/* global QuizCore, sb, initModulo, renderHeader, freshToken */
(() => {
'use strict';
const C=QuizCore, app=document.getElementById('quiz-app'), msg=document.getElementById('quiz-mensagem');
let retiros=[], abaTemporada='placar', casaSelecionada='', respostaSelecionada=null, justificativaAtiva='', ultimaPergunta='', pollEmCurso=false;
let ctx, quiz=null, estado=null, quizzes=[], eventos=[], cadastroCasas=[], ocupado=false, sujo=false, ia=null, tela='biblioteca', indice=0, revelar=0, apresentadas=[], rodada=null, filtroCasa='';
const faixa={criancas:'Crianças',adolescentes:'Adolescentes',misto:'Grupo misto'};
const status={preparacao:'Preparação',em_andamento:'Em andamento',encerrada:'Encerrada'};
function el(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
function append(p,...filhos){filhos.filter(Boolean).forEach(f=>p.append(f));return p;}
function aviso(texto,erro=false){msg.textContent=texto;msg.className=erro?'erro':'';if(erro)msg.setAttribute('role','alert');else msg.setAttribute('role','status');}
function botao(texto,acao,cls=''){const b=el('button',texto,cls);b.type='button';b.addEventListener('click',()=>executar(acao));return b;}
function acoes(...b){return append(el('div',undefined,'quiz-acoes'),...b);}
function card(...f){return append(el('section',undefined,'quiz-card'),...f);}
function campo(nome,valor,change,tipo='text',opcoes){const label=el('label',undefined,'quiz-campo');append(label,el('span',nome));let input;if(opcoes){input=el('select');opcoes.forEach(([v,t])=>{const o=el('option',t);o.value=v;input.append(o);});}else input=el(tipo==='textarea'?'textarea':'input');if(input.tagName==='INPUT')input.type=tipo;input.value=valor??'';input.addEventListener(opcoes?'change':'input',()=>change(tipo==='number'?Number(input.value):input.value));label.append(input);return label;}
function checkbox(texto,checked,change){const l=el('label',undefined,'quiz-check'), i=el('input');i.type='checkbox';i.checked=checked;i.addEventListener('change',()=>change(i.checked));append(l,i,el('span',texto));return l;}
function topo(t,sub,...buttons){const box=el('div',undefined,'quiz-top');append(box,append(el('div'),el('h1',t),sub?el('p',sub):null),acoes(...buttons));app.append(box);}
function limpar(){document.body.classList.remove('din-conduzindo');app.className='';app.replaceChildren();app.setAttribute('aria-busy','false');}
function mudar(){sujo=true;if(quiz)quiz.status='rascunho';}
async function executar(fn){if(ocupado)return;ocupado=true;app.setAttribute('aria-busy','true');const controls=[...app.querySelectorAll('button,input,textarea,select')].map(n=>[n,n.disabled]);controls.forEach(([n])=>n.disabled=true);try{await fn();}catch(e){aviso(e.message||'Não foi possível concluir. Suas edições foram preservadas.',true);}finally{ocupado=false;app.setAttribute('aria-busy','false');controls.forEach(([n,d])=>n.disabled=d);}}
async function rpc(acao,dados={}){const r=await sb.rpc('quiz_operar',{p_acao:acao,p_dados:dados});if(r.error)throw Error(r.error.code==='23505'?'Resultado já registrado ou lançamento já estornado. Atualize o histórico.':r.error.message||'Não foi possível salvar.');return r.data;}
async function api(action,dados={}){const r=await fetch('/api/acolito-admin',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+await freshToken()},body:JSON.stringify({action,...dados})});const d=await r.json();if(!r.ok)throw Error(d.error||'Serviço indisponível.');return d;}
async function carregar(){
 const [qs,gs,cs,rs]=await Promise.all([
  sb.from('acolitos_quizzes').select('*').order('atualizado_em',{ascending:false}),
  sb.from('acolitos_gincanas').select('*').order('criado_em',{ascending:false}),
  sb.from('acolitos_casas').select('id,nome,cor,slug,tipo').order('ordem'),
  sb.rpc('quiz_operar',{p_acao:'listar_retiros',p_dados:{}})
 ]);
 if(qs.error||gs.error||cs.error||rs.error)throw Error('Não foi possível carregar Dinâmicas. Confira sua conexão e tente novamente.');
 quizzes=qs.data||[];eventos=(gs.data||[]).filter(g=>!g.conducao?.excluida_em);cadastroCasas=cs.data||[];retiros=(rs.data||[]).filter(r=>r.tipo==='retiro');
}
function podeSair(){return !sujo||confirm('Há alterações não salvas. Deseja sair e descartá-las?');}
async function biblioteca(){
 if(!podeSair())return;
 quiz=null;rodada=null;sujo=false;abaTemporada='biblioteca';document.body.classList.remove('quiz-publico');desenharBiblioteca();
}
function desenharBiblioteca(){
 tela='biblioteca';limpar();lembrarAba();cabecalhoArea();
 const head=el('div',undefined,'din-section-head');append(head,append(el('div'),el('h2','Biblioteca de quizzes'),el('p','Prepare as perguntas. Na hora de jogar, você escolhe o nível de cada rodada.','quiz-meta')),botao('Criar quiz',()=>{quiz=C.novoQuiz();sujo=false;editor();},'primario'));app.append(head);
 if(!quizzes.length){app.append(vazio('book','O primeiro quiz começa aqui','Crie perguntas com o Haiku ou monte o seu quiz manualmente.',botao('Criar primeiro quiz',()=>{quiz=C.novoQuiz();editor();},'primario')));return;}
 const grid=el('div',undefined,'din-library');
 quizzes.forEach(q=>{
  const revisadas=q.perguntas.filter(p=>p.revisada).length;
  const c=card(), cover=el('div',undefined,'din-book-cover');append(cover,icone('book'),el('span',q.status==='pronto'?'Pronto para jogar':'Em preparação','din-pill '+(q.status==='pronto'?'success':'')));
  append(c,cover,el('h3',q.config.titulo),el('p',`${q.perguntas.length} perguntas · ${faixa[q.config.faixa]}`,'quiz-meta'));
  const levels=el('div',undefined,'din-level-counts');C.dificuldades.forEach(d=>levels.append(el('span',`${C.rotulos[d]} ${q.perguntas.filter(p=>p.dificuldade===d).length}`,'din-level '+d)));c.append(levels);
  const meter=el('progress');meter.max=Math.max(1,q.perguntas.length);meter.value=revisadas;meter.setAttribute('aria-label',`${revisadas} perguntas revisadas`);append(c,meter,el('p',`${revisadas} de ${q.perguntas.length} revisadas`,'quiz-meta'));
  append(c,acoes(botao('Editar quiz',()=>{quiz=structuredClone(q);sujo=false;editor();},'primario'),botao('Duplicar',async()=>{const copia=await rpc('duplicar_quiz',{id:q.id});guardarQuiz(copia);await biblioteca();aviso('Cópia criada como rascunho.');}),botao('Excluir',async()=>{if(confirm('Excluir este quiz? As rodadas realizadas serão preservadas.')){await rpc('excluir_quiz',{id:q.id});quizzes=quizzes.filter(x=>x.id!==q.id);await biblioteca();aviso('Quiz excluído.');}},'perigo')));grid.append(c);
 });app.append(grid);
}
async function salvarQuiz(pronto=false){const payload=structuredClone(quiz);payload.status=pronto?'pronto':'rascunho';C.validarQuiz(payload,pronto);quiz=await rpc('salvar_quiz',payload);guardarQuiz(quiz);sujo=false;editor();aviso(pronto?'Quiz pronto para usar.':'Rascunho salvo. Perguntas alteradas podem precisar de nova revisão.');}
function editor(){tela='editor';limpar();app.className='din-editor';topo(quiz.config.titulo||'Novo quiz','Todo conteúdo gerado é rascunho até a revisão humana.',botao('Biblioteca',biblioteca),botao('Salvar rascunho',()=>salvarQuiz(false),'primario'),botao('Marcar como pronto',()=>salvarQuiz(true),'primario'));
const c=quiz.config, box=card(), grid=el('div',undefined,'quiz-grid');
grid.append(campo('Título',c.titulo,v=>{c.titulo=v;mudar();}),campo('Faixa etária',c.faixa,v=>{c.faixa=v;mudar();},'text',Object.entries(faixa)),campo('Alternativas por pergunta',c.alternativas,v=>{const n=Number(v);if(quiz.perguntas.length&&!confirm('Alterar as alternativas de todas as perguntas e exigir nova revisão?')){editor();return;}c.alternativas=n;quiz.perguntas.forEach(q=>{q.alternativas=Array.from({length:n},(_,i)=>q.alternativas[i]||'');q.correta=Math.min(q.correta,n-1);q.revisada=false;});mudar();editor();},'text',[[3,'Três'],[4,'Quatro']]));
const temas=el('fieldset'), lista=el('div',undefined,'quiz-temas');temas.append(el('legend','Temas para geração'));C.temas.forEach(t=>lista.append(checkbox(t,c.temas.includes(t),ok=>{c.temas=ok?[...c.temas,t]:c.temas.filter(x=>x!==t);mudar();})));temas.append(lista);
const quant=el('div',undefined,'quiz-grid');C.dificuldades.forEach(d=>{const field=campo('Perguntas '+C.rotulos[d].toLowerCase()+'s',c.quantidades[d],v=>{c.quantidades[d]=v;mudar();},'number');Object.assign(field.querySelector('input'),{min:0,max:10,step:1});quant.append(field);});
append(box,grid,temas,quant,campo('Observações para geração (opcional)',c.observacoes,v=>{c.observacoes=v;mudar();},'textarea'),mensagemIA(),acoes(botao('Gerar perguntas com IA',()=>gerar(),'primario'),botao('Adicionar pergunta manual',()=>{if(quiz.perguntas.length>=60)throw Error('Limite de 60 perguntas.');quiz.perguntas.push(C.novaPergunta(c));mudar();editor();})));const configDetails=el('details');configDetails.open=!quiz.perguntas.length;configDetails.append(el('summary','Configuração do quiz e geração com IA'),box);app.append(configDetails);
app.append(acoes(botao('Modo organização',()=>organizar(quiz.perguntas)),botao('Apresentar quiz',()=>apresentar(quiz.perguntas)),botao('Imprimir perguntas',()=>imprimir(false,quiz.perguntas,quiz.config.titulo)),botao('Imprimir gabarito',()=>imprimir(true,quiz.perguntas,quiz.config.titulo))));
if(!quiz.perguntas.length)app.append(card(el('p','Adicione perguntas ou gere uma primeira versão para revisar.')));
C.dificuldades.forEach(d=>{const qs=quiz.perguntas.filter(q=>q.dificuldade===d);app.append(el('h2',C.rotulos[d]+' · '+qs.length));qs.forEach(q=>perguntaEditor(q));});}
function perguntaEditor(q){const i=quiz.perguntas.indexOf(q), s=card();if(q.revisada)s.classList.add('revisada');const det=el('details');det.open=!q.revisada;const titulo=el('summary',`${i+1}. ${q.enunciado||'Nova pergunta'} · ${q.revisada?'Revisada':'A revisar'}`);det.append(titulo);
function alterar(k,v){q[k]=v;q.revisada=false;mudar();titulo.textContent=`${i+1}. ${q.enunciado||'Nova pergunta'} · A revisar`;s.classList.remove('revisada');rev.querySelector('input').checked=false;}
const rev=checkbox('Revisada pela organização',q.revisada,ok=>{if(ok){const erros=C.errosPergunta(q,quiz.config.alternativas);if(erros.length){rev.querySelector('input').checked=false;aviso('Complete: '+erros.join(', '),true);return;}}q.revisada=ok;mudar();titulo.textContent=`${i+1}. ${q.enunciado||'Nova pergunta'} · ${ok?'Revisada':'A revisar'}`;s.classList.toggle('revisada',ok);});
append(det,campo('Enunciado',q.enunciado,v=>alterar('enunciado',v),'textarea'),append(el('div',undefined,'quiz-grid'),campo('Dificuldade',q.dificuldade,v=>{alterar('dificuldade',v);editor();},'text',C.dificuldades.map(d=>[d,C.rotulos[d]])),campo('Tema',q.tema,v=>alterar('tema',v),'text',C.temas.map(t=>[t,t]))));
q.alternativas.forEach((a,j)=>det.append(campo('Alternativa '+String.fromCharCode(65+j),a,v=>{const alternativas=q.alternativas.slice();alternativas[j]=v;alterar('alternativas',alternativas);})));append(det,campo('Resposta correta',q.correta,v=>alterar('correta',Number(v)),'text',q.alternativas.map((_,j)=>[j,'Alternativa '+String.fromCharCode(65+j)])),campo('Explicação curta',q.explicacao,v=>alterar('explicacao',v),'textarea'),campo('Referência verificável (opcional)',q.referencia,v=>alterar('referencia',v)),q.alerta?el('p','Revisão necessária: '+q.alerta,'quiz-meta'):null,rev,acoes(botao('Subir',()=>mover(q,-1)),botao('Descer',()=>mover(q,1)),botao('Gerar novamente esta pergunta',()=>gerar(q)),botao('Excluir pergunta',()=>{if(confirm('Excluir esta pergunta?')){quiz.perguntas.splice(i,1);mudar();editor();}},'perigo')));s.append(det);app.append(s);}
function mover(q,delta){const i=quiz.perguntas.indexOf(q),indices=quiz.perguntas.map((p,j)=>p.dificuldade===q.dificuldade?j:-1).filter(j=>j>=0),dest=indices[indices.indexOf(i)+delta];if(dest===undefined)return;[quiz.perguntas[i],quiz.perguntas[dest]]=[quiz.perguntas[dest],quiz.perguntas[i]];mudar();editor();}
async function gerar(alvo){const c=structuredClone(quiz.config);if(alvo){c.quantidades={facil:0,medio:0,dificil:0};c.quantidades[alvo.dificuldade]=1;c.temas=[alvo.tema];}C.configurar(c);const total=Object.values(c.quantidades).reduce((s,n)=>s+n,0);if(!alvo&&quiz.perguntas.length+total>60)throw Error('O quiz pode ter até 60 perguntas.');aviso('Gerando rascunho. Suas perguntas atuais serão preservadas…');const existentes=quiz.perguntas.filter(q=>q!==alvo);const resposta=await api('quiz_gerar',{config:c,existentes:existentes.map(q=>({enunciado:q.enunciado})),pedido_id:crypto.randomUUID()});const novas=C.geradas({perguntas:resposta.perguntas},c,existentes);if(alvo)quiz.perguntas.splice(quiz.perguntas.indexOf(alvo),1,...novas);else quiz.perguntas.push(...novas);mudar();editor();aviso('Perguntas recebidas como rascunho. Confira respostas, doutrina e referências.');}
function organizar(qs){tela='organizacao';limpar();topo('Modo organização','Respostas e referências para a equipe.',botao('Voltar',()=>estado?renderGincana():editor()),botao('Apresentar',()=>apresentar(qs)));qs.forEach((q,i)=>{const s=card(el('h2',`${i+1}. ${q.enunciado}`),el('p',`${C.rotulos[q.dificuldade]} · ${q.tema}`,'quiz-badge'));q.alternativas.forEach((a,j)=>s.append(el('p',`${String.fromCharCode(65+j)}. ${a}${j===q.correta?' — correta':''}`)));append(s,el('p',q.explicacao),el('p',q.referencia||'Sem referência: conferir com a organização.','quiz-meta'));if(estado&&rodada)s.append(pontuar(q));app.append(s);});}
function apresentar(qs){if(!qs.length)throw Error('Adicione perguntas primeiro.');apresentadas=qs;indice=0;revelar=0;tela='apresentacao';desenharApresentacao();}
function desenharApresentacao(){limpar();const q=apresentadas[indice];topo(rodada?.titulo||quiz?.config.titulo||'Quiz',`${indice+1} de ${apresentadas.length} · ${C.rotulos[q.dificuldade]} · ${estado?estado.gincana.regras[q.dificuldade]:C.pontos[q.dificuldade]} pontos`,botao('Voltar à organização',()=>organizar(apresentadas)));
const s=card();s.classList.add('quiz-apresentacao');s.append(el('h2',q.enunciado));q.alternativas.forEach((a,j)=>s.append(el('div',`${String.fromCharCode(65+j)}. ${a}${revelar&&j===q.correta?' ✓':''}`,'quiz-alternativa'+(revelar&&j===q.correta?' correta':''))));if(revelar>=2)append(s,el('p',q.explicacao,'quiz-explicacao'),el('p',q.referencia||'Referência a conferir com a organização.','quiz-meta'));app.append(s,acoes(botao('Anterior',()=>{if(indice>0){indice--;revelar=0;desenharApresentacao();}}),botao(revelar===0?'Revelar resposta':revelar===1?'Mostrar explicação':'Resposta revelada',()=>{revelar=Math.min(2,revelar+1);desenharApresentacao();},'primario'),botao('Próxima',()=>{if(indice<apresentadas.length-1){indice++;revelar=0;desenharApresentacao();}})));
if(estado&&rodada){const det=el('details');det.append(el('summary','Organização · registrar resultado'),pontuar(q));app.append(det);}}
function imprimir(gabarito,qs,titulo){if(!qs.length)throw Error('Não há perguntas para imprimir.');const area=document.getElementById('quiz-impressao');area.replaceChildren(el('h1',titulo),el('p',gabarito?'Gabarito da organização':'Perguntas para os participantes'));if(!qs.every(q=>q.revisada))area.append(el('p','RASCUNHO — conteúdo ainda não revisado','rascunho'));qs.forEach((q,i)=>{const s=el('section');append(s,el('h2',`${i+1}. ${q.enunciado}`),el('p',C.rotulos[q.dificuldade]));const ol=el('ol');ol.type='A';q.alternativas.forEach(a=>ol.append(el('li',a)));s.append(ol);if(gabarito)append(s,el('p','Resposta: '+String.fromCharCode(65+q.correta)),el('p',q.explicacao),el('p',q.referencia));area.append(s);});window.print();}
function formGincana(g){
 if(!g){seletorTemporadas();return;}
 limpar();tela='formgincana';const v=structuredClone(g);
 topo('Regras da temporada',g.nome,botao('Voltar à temporada',renderGincana));
 const f=card(el('h2','Pontuação'),el('p','Os novos valores valem para os próximos resultados. O histórico permanece igual.','quiz-meta'));
 const grid=el('div',undefined,'quiz-grid');[...C.dificuldades,'erro'].forEach(d=>grid.append(campo(d==='erro'?'Erro (zero ou desconto negativo)':C.rotulos[d],v.regras[d],x=>v.regras[d]=x,'number')));
 append(f,grid,campo('Nome da temporada',v.nome,x=>v.nome=x),campo('Descrição',v.descricao,x=>v.descricao=x,'textarea'),campo('Data',v.data,x=>v.data=x,'date'),botao('Salvar regras',async()=>{await rpc('salvar_gincana',v);await atualizar();abaTemporada='gestao';renderGincana();aviso('Regras atualizadas. Pontos anteriores preservados.');},'primario'));app.append(f);
}
async function abrirGincana(id,aba='placar'){
 if(!podeSair())return;sujo=false;quiz=null;rodada=null;
 estado=await rpc('estado',{gincana_id:id});if(estado.gincana.conducao?.excluida_em){estado=null;seletorTemporadas();aviso('Esta temporada foi excluída.');return;}abaTemporada=['placar','quiz','biblioteca','gestao'].includes(aba)?aba:'placar';
 try{localStorage.setItem('dinamicas-temporada-'+ctx.user.id,id);}catch(e){}
 const u=new URL(location.href);u.searchParams.set('gincana',id);u.searchParams.delete('retiro');history.replaceState(null,'',u);
 if(abaTemporada==='biblioteca')desenharBiblioteca();else renderGincana();
}
async function atualizar(){
 if(!estado)return;const id=estado.gincana.id,antes=JSON.stringify(estado.gincana.conducao),statusAntes=estado.gincana.status;
 const novo=await rpc('estado',{gincana_id:id});if(!estado||estado.gincana.id!==id)return;if(JSON.stringify(novo)===JSON.stringify(estado))return;estado=novo;
 if(tela==='placar')placar();else if(tela==='telao')renderTelao();
 else if(tela==='conducao'){
  if(antes!==JSON.stringify(novo.gincana.conducao)||statusAntes!==novo.gincana.status)renderConducao();
  else{const mini=document.getElementById('din-mini');if(mini)mini.replaceChildren(miniPlacar());}
 }else if(tela==='gincana')atualizarPaineis();
}
function renderGincana(){
 tela='gincana';limpar();lembrarAba();cabecalhoArea();
 if(abaTemporada==='quiz'){renderRodadas();return;}
 if(abaTemporada==='gestao'){renderGestao();return;}
 const head=el('div',undefined,'din-section-head');append(head,append(el('div'),el('h2','Placar das casas'),el('p','Pontos deste retiro, atualizados após cada resultado.','quiz-meta')),append(el('span',undefined,'din-live'),el('i'),el('span','Atualizando ao vivo')));app.append(head);
 const score=el('div');score.id='quiz-score';score.append(scoreNode());app.append(score);
 const bottom=el('div',undefined,'din-dashboard-bottom');
 const recentes=card(el('h2','Movimentos da temporada'));const h=el('div');h.id='din-recentes';recentes.append(h);
 const jogar=card(icone('spark'),el('h2','Hora do quiz'),el('p','Escolha o nível, revele a resposta e pontue a casa que acertou.','quiz-meta'),botao('Conduzir quiz',()=>{abaTemporada='quiz';renderGincana();},'primario'),botao('Adicionar pontos',()=>abrirLancamento(),'secundario'),botao('Tirar pontos',()=>abrirLancamento(true),'perigo'));
 jogar.classList.add('din-play-callout');bottom.append(recentes,jogar);app.append(bottom);atualizarPaineis();
}
function brasao(c,size=88){
 const wrap=el('div',undefined,'din-brasao');
 if(c.imagem){const im=el('img');im.src=c.imagem;im.alt='Brasão de '+c.nome;im.referrerPolicy='no-referrer';im.width=size;im.height=size;wrap.append(im);}
 else{const origem=cadastroCasas.find(x=>x.id===(c.origem_id||c.id));if(typeof getCasaBrasao==='function')wrap.innerHTML=getCasaBrasao(origem?.slug||'',size);else wrap.append(icone('shield'));}
 return wrap;
}
function scoreNode(){
 const grid=el('div',undefined,'quiz-placar');const ranking=C.classificar(estado.casas,estado.lancamentos);
 if(!ranking.length){grid.append(vazio('shield','As casas ainda não entraram','Adicione as casas na gestão para começar o placar.',botao('Escolher casas',()=>{abaTemporada='gestao';renderGincana();},'primario')));return grid;}
 ranking.forEach(c=>{
  const n=el('article',undefined,'din-house'+(c.posicao===1&&!c.empate?' leader':''));n.style.setProperty('--casa',c.cor);
  const rank=el('div',undefined,'din-house-rank');append(rank,el('span',String(c.posicao).padStart(2,'0')),el('span',c.empate?'Empate':c.posicao===1?'Na liderança':'Na disputa'));
  append(n,rank,brasao(c,108),el('h3',c.nome),append(el('div',undefined,'din-house-score'),el('strong',String(c.total)),el('span','pontos')));
  const movimentos=estado.lancamentos.filter(l=>l.casa_id===c.id);const ultimo=movimentos.at(-1);n.append(el('p',ultimo?`Último lançamento: ${ultimo.valor>0?'+':''}${ultimo.valor}`:'A temporada começa em zero','din-house-foot'));grid.append(n);
 });return grid;
}
function atualizarPaineis(){
 const recent=document.getElementById('din-recentes');if(recent){recent.replaceChildren();const ls=estado.lancamentos.slice(-4).reverse();if(!ls.length)recent.append(el('p','Ainda sem lançamentos. Prepare a primeira dinâmica ou comece um quiz.','quiz-meta'));ls.forEach(l=>{const c=estado.casas.find(c=>c.id===l.casa_id);const row=el('div',undefined,'din-activity');append(row,el('strong',`${l.valor>0?'+':''}${l.valor}`,l.valor<0?'negative':'positive'),append(el('div'),el('b',c?.nome||'Pergunta sem pontos'),el('p',l.justificativa,'quiz-meta')),el('time',new Date(l.criado_em).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})));recent.append(row);});}
const score=document.getElementById('quiz-score');if(score)score.replaceChildren(scoreNode());const hist=document.getElementById('quiz-history');if(hist){hist.replaceChildren();const ls=estado.lancamentos.filter(l=>!filtroCasa||l.casa_id===filtroCasa).slice().reverse();if(!ls.length)hist.append(el('p','Nenhum lançamento neste filtro.'));ls.forEach(l=>{const casa=estado.casas.find(c=>c.id===l.casa_id);const r=estado.rodadas.find(r=>r.id===l.rodada_id);const q=r?.perguntas.find(q=>q.id===l.pergunta_id);const estornado=estado.lancamentos.some(x=>x.estorno_de===l.id);const s=card(el('h3',`${casa?.nome||'Pergunta anulada/sem pontos'} · ${l.valor>0?'+':''}${l.valor} pontos${estornado?' · Estornado':''}${l.estorno_de?' · Estorno':''}`),el('p',l.justificativa),el('p',`${l.resultado||'Atividade avulsa'}${q?' · '+q.enunciado:''}`,'quiz-meta'),el('p',`${new Date(l.criado_em).toLocaleString('pt-BR')} · Responsável: ${l.responsavel}`,'quiz-meta'));if(!estornado&&!l.estorno_de&&estado.gincana.status==='em_andamento')s.append(botao('Estornar',async()=>{const motivo=prompt('Justificativa obrigatória para o estorno:');if(!motivo?.trim())return;await rpc('estornar',{gincana_id:estado.gincana.id,lancamento_id:l.id,justificativa:motivo,pedido_id:crypto.randomUUID()});await atualizar();aviso('Estorno registrado. O original foi mantido.');},'perigo'));hist.append(s);});}const audit=document.getElementById('quiz-audit');if(audit){audit.replaceChildren(el('h3','Auditoria da gincana'));estado.auditoria.forEach(a=>audit.append(el('p',`${new Date(a.criado_em).toLocaleString('pt-BR')} · ${a.acao} · ${a.justificativa} · ${a.responsavel}`,'quiz-meta')));}}
function lancamentoAvulso(desconto=false){let casa=estado.casas[0]?.id||'',valor=0,motivo='';return card(el('h2',desconto?'Tirar pontos':'Adicionar pontos ou penalidade'),campo('Casa',casa,v=>casa=v,'text',estado.casas.map(c=>[c.id,c.nome])),campo(desconto?'Quantos pontos tirar?':'Pontos inteiros (negativo para penalidade)',valor,v=>valor=v,'number'),campo('Atividade e justificativa obrigatória',motivo,v=>motivo=v),botao(desconto?'Tirar pontos':'Registrar lançamento',async()=>{if(desconto&&valor<=0)throw Error('Informe uma quantidade maior que zero.');if(!Number.isInteger(valor)||!motivo.trim())throw Error('Informe pontos inteiros e uma justificativa.');await rpc('lancar',{gincana_id:estado.gincana.id,casa_id:casa,valor:desconto?-Math.abs(valor):valor,justificativa:motivo,pedido_id:crypto.randomUUID()});await atualizar();document.querySelector('.din-dialog')?.close();renderGincana();aviso('Lançamento registrado. Placar atualizado.');},'primario'));}
function pontuar(q){let casa=estado.casas[0]?.id||'',resultado='acerto',motivo='Resposta da pergunta: '+q.enunciado.slice(0,300);const s=card(el('h3','Registrar resultado'));append(s,campo('Casa que respondeu',casa,v=>casa=v,'text',[['','Sem casa (anulada/sem pontos)'],...estado.casas.map(c=>[c.id,c.nome])]),campo('Resultado',resultado,v=>resultado=v,'text',[['acerto','Acerto · '+estado.gincana.regras[q.dificuldade]+' pontos'],['erro','Erro · '+estado.gincana.regras.erro+' pontos'],['anulada','Pergunta anulada · zero'],['sem_pontos','Sem pontuação · zero']]),campo('Justificativa obrigatória',motivo,v=>motivo=v),botao('Confirmar resultado',async()=>{if(!motivo.trim())throw Error('Informe uma justificativa.');await rpc('lancar',{gincana_id:estado.gincana.id,casa_id:casa,rodada_id:rodada.id,pergunta_id:q.id,resultado,justificativa:motivo,pedido_id:crypto.randomUUID()});await atualizar();aviso('Resultado registrado. Placar atualizado.');},'primario'));return s;}
async function alterarStatus(novo){const titulo=novo==='encerrada'?'Encerrar a gincana e bloquear lançamentos?':'Iniciar ou reabrir esta gincana?';if(!confirm(titulo))return;const motivo=prompt('Justificativa obrigatória para registrar na auditoria:');if(!motivo?.trim())return;await rpc('status',{gincana_id:estado.gincana.id,status:novo,justificativa:motivo});await atualizar();renderGincana();aviso('Status atualizado e ação registrada na auditoria.');}
function placar(){
 tela='placar';document.body.classList.add('quiz-publico');limpar();
 const h=el('div',undefined,'din-public-head');append(h,append(el('div'),el('p','Dinâmicas · Placar das casas','quiz-meta'),el('h1',estado.gincana.nome)),el('span',status[estado.gincana.status],'din-pill'));app.append(h,scoreNode());
}
// Dinâmicas: entrada por temporada, placar e mesa de condução.
function icone(nome){
 const paths={shield:'M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6z',book:'M12 5c-3-2-7-2-10 0v15c3-2 7-2 10 0 3-2 7-2 10 0V5c-3-2-7-2-10 0ZM12 5v15',spark:'m12 3 2.8 6.2L21 12l-6.2 2.8L12 21l-2.8-6.2L3 12l6.2-2.8z',tv:'M3 5h18v13H3zM8 22h8M12 18v4',cup:'M8 3h8v6a4 4 0 0 1-8 0ZM8 5H4v2a4 4 0 0 0 4 4M16 5h4v2a4 4 0 0 1-4 4M12 13v7M8 21h8',check:'m5 12 4 4 10-10',plus:'M12 5v14M5 12h14',arrow:'M5 12h14m-5-5 5 5-5 5',clock:'M12 8v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0'};
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');svg.classList.add('din-icon');const p=document.createElementNS(svg.namespaceURI,'path');p.setAttribute('d',paths[nome]||paths.spark);svg.append(p);return svg;
}
function vazio(icon,titulo,texto,acao){const n=el('section',undefined,'din-empty');append(n,icone(icon),el('h2',titulo),el('p',texto,'quiz-meta'),acao);return n;}
function guardarQuiz(q){quizzes=[q,...quizzes.filter(x=>x.id!==q.id)];}
function textoIA(){return ia===null?'Você pode montar as perguntas manualmente ou gerar com IA.':ia?'Gere até 24 perguntas por vez com o Haiku. Todo conteúdo precisa de revisão.':'A IA está indisponível. A criação manual continua disponível.';}
function mensagemIA(){const p=el('p',textoIA(),'quiz-meta');p.id='quiz-ia-status';return p;}
function lembrarAba(){
 if(new URLSearchParams(location.search).has('placar')||new URLSearchParams(location.search).has('apresentar'))return;
 const u=new URL(location.href);u.search='';if(estado)u.searchParams.set('gincana',estado.gincana.id);u.searchParams.set('aba',abaTemporada);
 history.replaceState(null,'',u);const atual=document.querySelector('#app-nav [data-id=quizzes]');if(atual)atual.href=u.href;try{sessionStorage.setItem('dinamicas-rota-'+ctx.user.id,'quizzes.html'+u.search);}catch(e){}
}
function cabecalhoArea(){
 const head=el('div',undefined,'din-area-head din-integrada');
 const title=el('h1','Dinâmicas','page-title');const acts=acoes();
 if(estado){
  acts.append(campo('Temporada',estado.gincana.id,v=>executar(()=>abrirGincana(v)),'text',eventos.map(g=>[g.id,g.nome])));
 }
 acts.append(botao('Trocar temporada',()=>{if(podeSair())seletorTemporadas();}));
 if(estado)acts.append(botao('Placar na TV',()=>abrirTelaPublica('placar')));
 append(head,title,acts);app.append(head);
 if(estado)app.append(el('p',`${status[estado.gincana.status]} · ${estado.gincana.data.split('-').reverse().join('/')}`,'quiz-meta din-season-info'));
 const nav=el('nav',undefined,'din-tabs din-tabs-integradas');nav.setAttribute('aria-label','Seções de Dinâmicas');
 [['placar','Placar'],['quiz','Conduzir quiz'],['biblioteca','Quizzes'],['gestao','Gestão']].forEach(([key,label])=>{
  const b=botao(label,()=>{if(!podeSair())return;sujo=false;quiz=null;abaTemporada=key;if(key==='biblioteca')desenharBiblioteca();else if(estado)renderGincana();else seletorTemporadas();});
  b.setAttribute('aria-current',abaTemporada===key?'page':'false');nav.append(b);
 });app.append(nav);
}
function seletorTemporadas(preferido){
 tela='temporadas';sujo=false;quiz=null;document.body.classList.remove('quiz-publico');limpar();
 topo('Dinâmicas','Um retiro, uma temporada. As casas começam uma nova disputa em cada encontro.',botao('Biblioteca de quizzes',biblioteca));
 const recentes=eventos.filter(g=>!g.retiro_id);const grid=el('div',undefined,'din-season-grid');
 retiros.filter(r=>r.status!=='arquivada'||eventos.some(g=>g.retiro_id===r.id)).forEach(r=>{
  const g=eventos.find(g=>g.retiro_id===r.id);const n=card(icone('cup'),el('h2',r.nome),el('p',r.descricao||'Quiz, dinâmicas e pontuação das casas neste retiro.','quiz-meta'),el('p',[r.data_inicio?.split('-').reverse().join('/'),r.local].filter(Boolean).join(' · '),'quiz-meta'));
  n.dataset.retiroId=r.id;
  if(r.id===preferido)n.classList.add('din-highlight');
  n.append(botao(g?'Abrir temporada':'Preparar temporada',async()=>{if(g)await abrirGincana(g.id);else{estado=await rpc('iniciar_temporada',{retiro_id:r.id});await carregar();await abrirGincana(estado.gincana.id);aviso('Temporada preparada com as casas do aplicativo. Todos começam com zero pontos.');}},'primario'));grid.append(n);
 });app.append(grid);
 if(!retiros.length)app.append(vazio('cup','Qual será o próximo retiro?','Cadastre o retiro e depois prepare a temporada de dinâmicas.',botao('Abrir retiros',()=>location.href='retiros.html','primario')));
 if(recentes.length){app.append(el('h2','Competições anteriores'));const old=el('div',undefined,'din-season-grid');recentes.forEach(g=>old.append(card(el('h3',g.nome),el('p','Histórico preservado','quiz-meta'),botao('Abrir placar',()=>abrirGincana(g.id)))));app.append(old);}
}
function abrirTelaPublica(modo){const u=new URL('quizzes.html',location.href);u.searchParams.set('gincana',estado.gincana.id);u.searchParams.set(modo,'1');window.open(u.href,'_blank','noopener');}
function renderRodadas(){
 const h=el('div',undefined,'din-section-head');append(h,append(el('div'),el('h2','Prepare a rodada'),el('p','Use um quiz revisado. Durante o jogo, escolha a dificuldade de cada pergunta.','quiz-meta')),botao('Criar quiz',()=>{quiz=C.novoQuiz();editor();},'primario'));app.append(h);
 const prontas=quizzes.filter(q=>q.status==='pronto');
 if(!prontas.length&&!estado.rodadas.length){app.append(vazio('book','Vamos preparar as perguntas?','Você precisa de um quiz revisado para começar uma rodada.',botao('Abrir quizzes',biblioteca,'primario')));return;}
 if(prontas.length){let escolhido=prontas[0].id;const f=card(), row=el('div',undefined,'din-inline-form');append(row,campo('Quiz revisado',escolhido,v=>escolhido=v,'text',prontas.map(q=>[q.id,q.config.titulo])),botao('Preparar nova rodada',async()=>{const r=await rpc('criar_rodada',{gincana_id:estado.gincana.id,quiz_id:escolhido});await atualizar();rodada=estado.rodadas.find(x=>x.id===r.id);renderConducao();},'primario'));f.append(row);app.append(f);}
 const grid=el('div',undefined,'din-round-grid');estado.rodadas.slice().reverse().forEach(r=>{
  const n=card();const usadas=C.resultadosAtivos(estado.lancamentos,r.id).length;append(n,el('span',`Rodada ${estado.rodadas.findIndex(x=>x.id===r.id)+1}`,'din-pill'),el('h3',r.titulo),el('p',`${usadas} de ${r.perguntas.length} perguntas respondidas`,'quiz-meta'));
  const levels=el('div',undefined,'din-level-counts');C.dificuldades.forEach(d=>levels.append(el('span',`${C.rotulos[d]} · ${C.disponiveis(r.perguntas,estado.lancamentos,r.id,d).length}`,'din-level '+d)));n.append(levels,acoes(botao('Conduzir rodada',()=>{rodada=r;respostaSelecionada=null;casaSelecionada='';renderConducao();},'primario'),botao('Imprimir perguntas',()=>imprimir(false,r.perguntas,r.titulo)),botao('Gabarito',()=>imprimir(true,r.perguntas,r.titulo))));grid.append(n);
 });app.append(grid);
}
async function excluirTemporada(){
 const g=estado.gincana;
 if(!confirm('Excluir a temporada “'+g.nome+'”? Ela sairá da lista e o retiro poderá começar uma nova temporada. Os quizzes serão mantidos.'))return;
 await api('quiz_excluir_temporada',{gincana_id:g.id,versao:g.versao});
 estado=null;rodada=null;sessionStorage.removeItem('dinamicas-rota-'+ctx.user.id);history.replaceState(null,'','quizzes.html');
 await carregar();seletorTemporadas();aviso('Temporada excluída. Os quizzes foram mantidos.');
}
function renderGestao(){
 app.append(append(el('div',undefined,'din-section-head'),el('h2','Gestão da temporada'),acoes(botao('Ajustar regras',()=>formGincana(estado.gincana)),botao('Excluir temporada',excluirTemporada,'perigo'))));
 const g=estado.gincana, state=card(el('h3','Andamento'),el('p','O encerramento preserva o placar e bloqueia novos lançamentos.','quiz-meta'));
 state.append(acoes(...(g.status==='preparacao'?[botao('Iniciar temporada',()=>alterarStatus('em_andamento'),'primario')]:[]),botao(g.status==='encerrada'?'Reabrir temporada':'Encerrar temporada',()=>alterarStatus(g.status==='encerrada'?'em_andamento':'encerrada'),'perigo')));
 const houses=card(el('h3','Casas participantes'));const row=el('div',undefined,'din-members');estado.casas.forEach(c=>{const item=append(el('div',undefined,'din-member'),brasao(c,40),el('span',c.nome));item.style.setProperty('--casa',c.cor);row.append(item);});houses.append(row);
 const d=el('details');d.append(el('summary','Adicionar outra casa'));let origem='',nome='',cor='#cfa34a',imagem='';append(d,campo('Casa cadastrada',origem,v=>origem=v,'text',[['','Casa avulsa desta temporada'],...cadastroCasas.filter(c=>!estado.casas.some(x=>x.origem_id===c.id)).map(c=>[c.id,c.nome])]),campo('Nome da casa avulsa',nome,v=>nome=v),campo('Cor',cor,v=>cor=v,'color'),campo('Imagem HTTPS (opcional)',imagem,v=>imagem=v),botao('Adicionar casa',async()=>{await rpc('adicionar_casa',{gincana_id:g.id,origem_id:origem,nome,cor,imagem});await atualizar();renderGincana();aviso('Casa adicionada.');}));houses.append(d);
 const grid=el('div',undefined,'din-manage-grid');grid.append(state,houses);app.append(grid);
 if(g.status==='em_andamento')app.append(lancamentoAvulso());
 const hist=card(el('h3','Histórico de pontos'));hist.append(campo('Filtrar por casa',filtroCasa,v=>{filtroCasa=v;atualizarPaineis();},'text',[['','Todas as casas'],...estado.casas.map(c=>[c.id,c.nome])]));const list=el('div');list.id='quiz-history';hist.append(list);const audit=el('details');audit.append(el('summary','Auditoria da temporada'));const aud=el('div');aud.id='quiz-audit';audit.append(aud);hist.append(audit);app.append(hist);atualizarPaineis();
}
function abrirLancamento(desconto=false){
 if(estado.gincana.status!=='em_andamento'){abaTemporada='gestao';renderGincana();aviso('Inicie a temporada para lançar pontos.');return;}
 const dialog=el('dialog',undefined,'din-dialog');const inner=el('div',undefined,'din-dialog-inner');append(inner,append(el('div',undefined,'din-section-head'),el('h2',desconto?'Tirar pontos':'Pontos da dinâmica'),botao('Fechar',()=>dialog.close())),lancamentoAvulso(desconto));dialog.append(inner);document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove());dialog.showModal();
}
function miniPlacar(){const box=el('div',undefined,'din-mini-score');C.classificar(estado.casas,estado.lancamentos).forEach(c=>{const row=el('div');row.style.setProperty('--casa',c.cor);append(row,el('span',String(c.posicao),'din-mini-rank'),brasao(c,36),el('span',c.nome),el('strong',String(c.total)));box.append(row);});return box;}
function perguntaDaConducao(){const c=estado.gincana.conducao||{};const r=estado.rodadas.find(r=>r.id===c.rodada_id);return {c,r,q:r?.perguntas.find(q=>q.id===c.pergunta_id)};}
async function conduzir(q,revelacao=0){const c=estado.gincana.conducao||{};await rpc('conduzir',{gincana_id:estado.gincana.id,rodada_id:rodada.id,pergunta_id:q?.id||null,revelacao,versao:c.versao||0});await atualizar();renderConducao();}
async function escolherNivel(d){const qs=C.disponiveis(rodada.perguntas,estado.lancamentos,rodada.id,d);if(!qs.length)return;respostaSelecionada=null;casaSelecionada='';justificativaAtiva='';await conduzir(qs[0]);}
function renderConducao(){
 tela='conducao';limpar();document.body.classList.remove('quiz-publico');document.body.classList.add('din-conduzindo');
 if(!rodada){rodada=estado.rodadas.find(r=>r.id===estado.gincana.conducao?.rodada_id)||estado.rodadas.at(-1);}
 if(!rodada){abaTemporada='quiz';renderGincana();return;}
 const {c,q:ativa}=perguntaDaConducao();const q=c.rodada_id===rodada.id?ativa:null;
 if(q?.id!==ultimaPergunta){ultimaPergunta=q?.id||'';respostaSelecionada=null;justificativaAtiva='';}
 const head=el('header',undefined,'din-host-head');append(head,append(el('div'),el('p',estado.gincana.nome,'quiz-meta'),el('h1',rodada.titulo)),acoes(botao('Sair da condução',()=>{abaTemporada='quiz';renderGincana();}),botao('Abrir telão',()=>abrirTelaPublica('apresentar'),'primario')));app.append(head);
 const layout=el('div',undefined,'din-host-layout'),stage=el('section',undefined,'din-stage'),aside=el('aside',undefined,'din-host-aside');
 const respondidas=C.resultadosAtivos(estado.lancamentos,rodada.id).length;
 append(stage,append(el('div',undefined,'din-stage-meta'),el('span',q?C.rotulos[q.dificuldade]:'Você conduz','din-pill '+(q?.dificuldade||'')),el('span',`${respondidas} / ${rodada.perguntas.length} respondidas`,'quiz-meta')));
 if(!q){
  append(stage,icone('spark'),el('h2',respondidas===rodada.perguntas.length?'Rodada concluída!':'Qual é o nível da próxima pergunta?'),el('p',respondidas===rodada.perguntas.length?'Todos os resultados estão no placar da temporada.':'Escolha a dificuldade. A pergunta aparece no telão com a resposta escondida.','quiz-meta'));
  const levels=el('div',undefined,'din-difficulties');C.dificuldades.forEach(d=>{const disponiveis=C.disponiveis(rodada.perguntas,estado.lancamentos,rodada.id,d).length;const b=botao('',()=>escolherNivel(d),'din-difficulty '+d);b.disabled=!disponiveis||estado.gincana.status==='encerrada';append(b,el('span',C.rotulos[d]),append(el('strong'),String(estado.gincana.regras[d])),el('span','pontos'),el('small',`${disponiveis} disponíveis`));levels.append(b);});stage.append(levels);
 }else{
  stage.classList.add('question');append(stage,el('p',q.tema,'din-question-theme'),el('h2',q.enunciado));
  const alternatives=el('div',undefined,'din-answers');q.alternativas.forEach((a,j)=>{const isCorrect=c.revelacao>0&&j===q.correta;const b=botao('',()=>{respostaSelecionada=j;renderConducao();},'din-answer'+(respostaSelecionada===j?' selected':'')+(isCorrect?' correct':'')+(c.revelacao>0&&respostaSelecionada===j&&!isCorrect?' incorrect':''));b.disabled=c.revelacao>0;append(b,el('span',String.fromCharCode(65+j),'din-letter'),el('span',a));if(isCorrect)b.append(icone('check'));b.setAttribute('aria-pressed',String(respostaSelecionada===j));alternatives.append(b);});stage.append(alternatives);
  if(c.revelacao>=2)stage.append(append(el('div',undefined,'din-explanation'),el('h3','Por que essa resposta?'),el('p',q.explicacao),el('p',q.referencia||'Referência a conferir com a organização.','quiz-meta')));
  const controls=acoes();if(!c.revelacao)controls.append(botao('Revelar resposta',()=>conduzir(q,1),'primario'));else if(c.revelacao===1)controls.append(botao('Mostrar explicação',()=>conduzir(q,2),'primario'));else controls.append(el('span','Resposta e explicação no telão','quiz-meta'));
  controls.append(botao('Trocar nível',()=>conduzir(null)));stage.append(controls);
 }
 if(q)aside.append(painelResultado(q,c.revelacao));else aside.append(card(el('h3','O ritmo é seu'),el('p','Fácil para aquecer, médio para desafiar, difícil para ir além. A pontuação acompanha a escolha.','quiz-meta')));
 const score=card(el('h3','Placar da temporada'));const mini=el('div');mini.id='din-mini';mini.append(miniPlacar());score.append(mini);aside.append(score);layout.append(stage,aside);app.append(layout);
}
function painelResultado(q,revelacao){
 const panel=card(el('h3','Quem respondeu?'));const houses=el('div',undefined,'din-house-picks');
 estado.casas.forEach(c=>{const b=botao('',()=>{casaSelecionada=c.id;renderConducao();},'din-house-pick'+(casaSelecionada===c.id?' selected':''));b.style.setProperty('--casa',c.cor);append(b,brasao(c,36),el('span',c.nome));b.setAttribute('aria-pressed',String(casaSelecionada===c.id));houses.append(b);});panel.append(houses);
 if(!revelacao)panel.append(el('p','Selecione a alternativa respondida e revele a resposta para pontuar.','quiz-meta'));
 const points=estado.gincana.regras[q.dificuldade];const buttons=el('div',undefined,'din-result-buttons');
 [['acerto',`Acerto +${points}`,'success'],['erro',`Erro ${estado.gincana.regras.erro}`,'error'],['anulada','Anular pergunta','quiet'],['sem_pontos','Sem pontuação','quiet']].forEach(([resultado,label,cls])=>{
  const b=botao(label,()=>registrarResultado(q,resultado),'din-result '+cls);b.disabled=estado.gincana.status!=='em_andamento'||(!revelacao&&['acerto','erro'].includes(resultado))||(!casaSelecionada&&['acerto','erro'].includes(resultado));buttons.append(b);
 });panel.append(buttons);const d=el('details');d.append(el('summary','Observação do resultado'));d.append(campo('Justificativa',justificativaAtiva,v=>justificativaAtiva=v,'textarea'));panel.append(d);if(estado.gincana.status==='preparacao')panel.append(botao('Iniciar temporada para pontuar',()=>alterarStatus('em_andamento'),'primario'));return panel;
}
async function registrarResultado(q,resultado){
 const casa=estado.casas.find(c=>c.id===casaSelecionada);const motivo=justificativaAtiva.trim()||`${({acerto:'Acerto',erro:'Erro',anulada:'Pergunta anulada',sem_pontos:'Sem pontuação'})[resultado]}: ${q.enunciado}`;
 await rpc('lancar',{gincana_id:estado.gincana.id,casa_id:casaSelecionada||null,rodada_id:rodada.id,pergunta_id:q.id,resultado,justificativa:motivo,pedido_id:crypto.randomUUID()});
 respostaSelecionada=null;casaSelecionada='';justificativaAtiva='';await atualizar();renderConducao();aviso(`${casa?.nome||'Pergunta'}: resultado registrado. Escolha o nível da próxima pergunta.`);
}
function renderTelao(){
 tela='telao';document.body.classList.add('quiz-publico');limpar();const {c,r,q}=perguntaDaConducao();
 append(app,append(el('header',undefined,'din-public-head'),append(el('div'),el('p',estado.gincana.nome,'quiz-meta'),el('h1',r?.titulo||'Quiz das casas')),el('span',q?`${C.rotulos[q.dificuldade]} · ${estado.gincana.regras[q.dificuldade]} pontos`:'Preparando a próxima','din-pill')));
 if(!q){const wait=el('section',undefined,'din-stage din-wait');append(wait,icone('spark'),el('h2',estado.gincana.status==='encerrada'?'Temporada encerrada':'Qual será o próximo desafio?'),el('p','A organização está escolhendo a pergunta.','quiz-meta'));app.append(wait,miniPlacar());return;}
 const stage=el('section',undefined,'din-stage question');append(stage,el('p',q.tema,'din-question-theme'),el('h2',q.enunciado));const answers=el('div',undefined,'din-answers');q.alternativas.forEach((a,j)=>{const n=append(el('div',undefined,'din-answer'+(c.revelacao>0&&j===q.correta?' correct':'')),el('span',String.fromCharCode(65+j),'din-letter'),el('span',a));if(c.revelacao>0&&j===q.correta)n.append(icone('check'));answers.append(n);});stage.append(answers);if(c.revelacao>=2)stage.append(append(el('div',undefined,'din-explanation'),el('p',q.explicacao),el('p',q.referencia,'quiz-meta')));app.append(stage);
}
function configurarVoltar(){
 const b=document.querySelector('.header-back');if(!b)return;const voltar=b.onclick;
 b.onclick=()=>{
  if(['editor','organizacao','apresentacao','conducao','formgincana'].includes(tela)){
   if(!podeSair())return;sujo=false;
   if(tela==='editor'||(tela==='organizacao'&&!estado)){biblioteca();return;}
   abaTemporada=tela==='formgincana'?'gestao':'quiz';if(estado)renderGincana();else biblioteca();return;
  }
  voltar?.();
 };
}
async function verificarIA(){try{ia=(await api('quiz_config')).operacional;}catch(e){ia=false;}const p=document.getElementById('quiz-ia-status');if(p)p.textContent=textoIA();}
window.addEventListener('beforeunload',e=>{if(sujo){e.preventDefault();e.returnValue='';}});
async function init(){
 try{
  ctx=await initModulo(['coord_admin','subadmin','membro_equipe']);if(!ctx?.membership)return;
  renderHeader(ctx,'quizzes');renderBottomNav(ctx,'quizzes');configurarVoltar();await carregar();
  const params=new URLSearchParams(location.search);
  if(params.get('gincana')){await abrirGincana(params.get('gincana'),params.get('aba'));if(params.has('placar'))placar();else if(params.has('apresentar'))renderTelao();}
  else if(params.get('retiro')){
   const existente=eventos.find(g=>g.retiro_id===params.get('retiro'));
   if(existente)await abrirGincana(existente.id);else seletorTemporadas(params.get('retiro'));
  }else{
   let salva;try{salva=localStorage.getItem('dinamicas-temporada-'+ctx.user.id);}catch(e){}
   const ativa=eventos.find(g=>g.id===salva)||eventos.find(g=>g.status==='em_andamento')||eventos.find(g=>g.status==='preparacao')||eventos[0];
   if(ativa){let aba=params.get('aba');if(!aba){try{const salva=new URL(sessionStorage.getItem('dinamicas-rota-'+ctx.user.id)||'quizzes.html',location.href);if(salva.searchParams.get('gincana')===ativa.id)aba=salva.searchParams.get('aba');}catch(e){}}await abrirGincana(ativa.id,aba);}else if(params.get('aba')==='biblioteca'){abaTemporada='biblioteca';desenharBiblioteca();}else seletorTemporadas();
  }
  verificarIA();
  setInterval(async()=>{if(!estado||ocupado||pollEmCurso||document.hidden||!['gincana','placar','conducao','telao'].includes(tela))return;pollEmCurso=true;try{await atualizar();}catch(e){aviso('A atualização pausou. Confira sua conexão.',true);}finally{pollEmCurso=false;}},2000);
 }catch(e){limpar();aviso(e.message,true);app.append(botao('Tentar novamente',init));}
}
init();
})();
