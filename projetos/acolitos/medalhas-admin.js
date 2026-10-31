(function(root){
'use strict';
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
const button=(text,fn,cls='btn-sm gray')=>{const b=el('button',text,cls);b.type='button';b.onclick=fn;return b;};
const quantidade=(n,um,muitos)=>n+' '+(n===1?um:muitos);
const normalizar=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const permitida=ctx=>['coord_admin','subadmin'].includes(ctx?.membership?.role);
async function abrir({sb,membros,selecionados=[]}){
 const pessoas=[...new Map(membros.map(m=>[m.id,m])).values()];
 if(!pessoas.length){toast('Nenhum membro disponível.','error');return;}
 const pessoasIds=new Set(pessoas.map(m=>m.id)),selectedPeople=new Set([...selecionados].filter(id=>pessoasIds.has(id))),selectedBadges=new Set();
 const origem=document.activeElement,overflow=document.body.style.overflow;document.body.style.overflow='hidden';
 const ov=el('div',null,'modal-overlay open medalhas-admin-overlay'),md=el('div',null,'modal medalhas-admin-modal');md.setAttribute('role','dialog');md.setAttribute('aria-modal','true');md.setAttribute('aria-label','Gestor de medalhas');
 let busy=false,closed=false,step=1,catalogo=[],preview=null,historyToken=0;
 function fechar(){if(busy||closed)return;closed=true;ov.remove();document.body.style.overflow=overflow;if(origem?.isConnected)origem.focus({preventScroll:true});}
 ov._acResolveClose=fechar;ov.onclick=e=>{if(e.target===ov)fechar();};
 const close=button('×',fechar,'modal-close');close.setAttribute('aria-label','Fechar gestor de medalhas');
 const title=el('h2','Escolha as medalhas','modal-title'),heading=el('div',null,'mg-heading');heading.append(title);
 const steps=el('p','1. Medalhas → 2. Pessoas → 3. Confirmar','ma-note');
 const status=el('p','Carregando medalhas…','ma-status');status.setAttribute('role','status');
 const body=el('div',null,'mg-body'),footer=el('footer',null,'mg-footer');
 const back=button('Fechar',()=>{if(step===1)fechar();else mostrar(step-1);});
 const next=button('Escolher pessoas',avancar,'btn-sm gold');next.disabled=true;
 footer.append(back,next);md.append(close,heading,steps,status,body,footer);ov.append(md);document.body.append(ov);
 const badgePage=el('section',null,'mg-page'),peoplePage=el('section',null,'mg-page'),reviewPage=el('section',null,'mg-page');
 const badgeSearch=el('input',null,'form-input');badgeSearch.type='search';badgeSearch.placeholder='Buscar medalha pelo nome';badgeSearch.setAttribute('aria-label','Buscar medalhas');
 const badgeSearchLabel=el('label','Buscar medalha','mg-filter-label');badgeSearchLabel.append(badgeSearch);
 const badgeTypeLabel=el('label','Tipo de medalha','mg-filter-label'),badgeType=el('select',null,'form-input');badgeType.setAttribute('aria-label','Tipo de medalha');
 for(const [value,text] of [['todas','Todas as medalhas'],['automaticas','Automáticas'],['coordenacao','Concedidas pela coordenação']]){const option=el('option',text);option.value=value;badgeType.append(option);}badgeTypeLabel.append(badgeType);
 const badgeFilters=el('div',null,'mg-people-filters');badgeFilters.append(badgeSearchLabel,badgeTypeLabel);
 const badgeCount=el('p','', 'ma-note'),badgeGrid=el('div',null,'mg-badges');
 const history=el('details',null,'ma-details');history.hidden=true;history.append(el('summary','Histórico das medalhas selecionadas'));const historyBody=el('div');history.append(historyBody);
 badgePage.append(badgeFilters,badgeCount,badgeGrid,history);
 const peopleSearch=el('input',null,'form-input');peopleSearch.type='search';peopleSearch.placeholder='Buscar membro';peopleSearch.setAttribute('aria-label','Buscar membros');
 const level=el('select',null,'form-input');level.setAttribute('aria-label','Filtrar membros por nível');const all=el('option','Todos os níveis');all.value='';level.append(all);
 for(const slug of [...new Set(pessoas.map(m=>m.nivel||'aspirante'))]){const op=el('option',nivelInfo(slug).label);op.value=slug;level.append(op);}
 const peopleFilters=el('div',null,'mg-people-filters');peopleFilters.append(peopleSearch,level);
 const peopleCount=el('p','', 'ma-note'),peopleList=el('div',null,'mg-people');
 const markAll=button('Selecionar visíveis',()=>{filtrarPessoas().forEach(m=>selectedPeople.add(m.id));invalidar();desenharPessoas();});
 const clear=button('Limpar seleção',()=>{selectedPeople.clear();invalidar();desenharPessoas();});const peopleActions=el('div',null,'ma-actions');peopleActions.append(markAll,clear);peoplePage.append(peopleFilters,peopleActions,peopleCount,peopleList);
 const motivoLabel=el('label','Motivo (opcional)','mg-reason'),motivo=el('input',null,'form-input');motivo.maxLength=500;motivo.placeholder='Ex.: serviço no encontro da pastoral';motivoLabel.append(motivo);
 const summary=el('div',null,'mg-summary');reviewPage.append(summary,motivoLabel);
 function invalidar(){preview=null;history.open=false;historyToken++;}
 function setBusy(value){busy=value;md.querySelectorAll('input,select,button').forEach(n=>n.disabled=value);if(!value)atualizar();}
 function atualizar(){badgeCount.textContent=quantidade(selectedBadges.size,'medalha selecionada','medalhas selecionadas');peopleCount.textContent=quantidade(selectedPeople.size,'pessoa selecionada','pessoas selecionadas');next.disabled=busy||(step===1?!selectedBadges.size:step===2?!selectedPeople.size:!preview?.novas);history.hidden=!selectedBadges.size;}
 function desenharMedalhas(){
  badgeGrid.replaceChildren();const q=normalizar(badgeSearch.value);
  const found=catalogo.filter(b=>(badgeType.value==='todas'||(badgeType.value==='automaticas'?b.validacao==='automatica':b.validacao!=='automatica'))&&normalizar(b.label+' '+(b.desc||'')).includes(q));
  for(const b of found){const card=button('',()=>{selectedBadges.has(b.id)?selectedBadges.delete(b.id):selectedBadges.add(b.id);invalidar();desenharMedalhas();},'mg-badge');card.dataset.id=b.id;card.setAttribute('aria-pressed',String(selectedBadges.has(b.id)));card.setAttribute('aria-label',b.label);card.title=b.desc||b.label;card.innerHTML=MedalhasArte.html(b.icone,medalhaTier(b),96);card.append(el('span',b.label,'mg-badge-name'),el('span',selectedBadges.has(b.id)?'✓ Selecionada':'Selecionar','mg-badge-state'));badgeGrid.append(card);}
  if(!found.length)badgeGrid.append(el('p','Nenhuma medalha encontrada.','ma-note'));atualizar();
 }
 function filtrarPessoas(){const q=normalizar(peopleSearch.value);return pessoas.filter(m=>(!q||normalizar(m.nome+' '+(m.apelido||'')).includes(q))&&(!level.value||(m.nivel||'aspirante')===level.value));}
 function desenharPessoas(){peopleList.replaceChildren();const found=filtrarPessoas();for(const m of found){const label=el('label',null,'mg-person');const input=el('input');input.type='checkbox';input.value=m.id;input.checked=selectedPeople.has(m.id);input.onchange=()=>{input.checked?selectedPeople.add(m.id):selectedPeople.delete(m.id);invalidar();atualizar();};const info=el('span');info.append(el('strong',m.nome||m.apelido),el('small',nivelInfo(m.nivel||'aspirante').label));label.append(input,info);peopleList.append(label);}if(!found.length)peopleList.append(el('p','Nenhum membro encontrado.','ma-note'));atualizar();}
 function mostrar(n){step=n;title.textContent=['','Escolha as medalhas','Quem vai receber?','Confira e conceda'][n];body.replaceChildren([null,badgePage,peoplePage,reviewPage][n]);back.textContent=n===1?'Fechar':'Voltar';next.textContent=n===1?'Escolher pessoas':n===2?'Conferir envio':'Conceder '+quantidade(preview?.novas||0,'medalha','medalhas');status.textContent=n===1?'Marque uma ou mais medalhas pelas imagens.':n===2?'Marque uma ou mais pessoas.':'Quem já possui a medalha será preservado.';atualizar();body.scrollTop=0;}
 async function avancar(){
  if(step===1){mostrar(2);desenharPessoas();return;}
  if(step===2){if(selectedPeople.size>500){status.textContent='Selecione até 500 pessoas.';return;}setBusy(true);status.textContent='Conferindo as medalhas dos selecionados…';try{const {data,error}=await sb.rpc('acolitos_medalhas_multiplas',{p_medalhas:[...selectedBadges],p_membros:[...selectedPeople],p_motivo:'',p_confirmar:false});if(error)throw error;if(!data?.ok||data.confirmado!==false||data.total_membros!==selectedPeople.size||data.total_medalhas!==selectedBadges.size)throw Error('Não foi possível conferir o lote.');if(closed)return;preview=data;summary.replaceChildren(el('h3',quantidade(selectedBadges.size,'medalha','medalhas')+' para '+quantidade(selectedPeople.size,'pessoa','pessoas')),el('p',data.novas+' novas conquistas · '+data.existentes+' já conquistadas, sem duplicar.'));const thumbs=el('div',null,'mg-selected');for(const b of catalogo.filter(b=>selectedBadges.has(b.id))){const item=el('figure');item.innerHTML=MedalhasArte.html(b.icone,medalhaTier(b),64);item.append(el('figcaption',b.label));thumbs.append(item);}summary.append(thumbs);const names=el('details',null,'ma-details');names.append(el('summary','Ver pessoas selecionadas'));const list=el('ul');pessoas.filter(m=>selectedPeople.has(m.id)).forEach(m=>list.append(el('li',m.nome||m.apelido)));names.append(list);summary.append(names);mostrar(3);if(!data.novas)status.textContent='Todos já possuem as medalhas escolhidas. Nenhuma concessão necessária.';}catch(e){status.textContent='Não foi possível conferir: '+(e.message||'tente novamente.');}finally{setBusy(false);}return;}
  if(!preview||!preview.novas)return;
  setBusy(true);status.textContent='Concedendo medalhas…';try{const {data,error}=await sb.rpc('acolitos_medalhas_multiplas',{p_medalhas:[...selectedBadges],p_membros:[...selectedPeople],p_motivo:motivo.value.trim(),p_confirmar:true});if(error)throw error;if(!data?.ok||data.confirmado!==true)throw Error('Resultado não confirmado.');preview=null;summary.replaceChildren(el('h3','Medalhas concedidas!'),el('p',data.novas+' novas conquistas. '+data.existentes+' já existiam e foram preservadas.'),el('p','As medalhas já aparecem na coleção e nos cartões dos membros.','ma-note'));motivoLabel.hidden=true;next.hidden=true;back.textContent='Conceder outras';back.onclick=()=>{selectedBadges.clear();selectedPeople.clear();motivo.value='';motivoLabel.hidden=false;next.hidden=false;back.onclick=()=>{if(step===1)fechar();else mostrar(step-1);};mostrar(1);desenharMedalhas();};status.textContent='Concessão registrada com autor e data.';}catch(e){preview=null;status.textContent='Não consegui confirmar o resultado: '+(e.message||'tente novamente.')+' Volte para conferir antes de tentar de novo.';}finally{setBusy(false);}
 }
 badgeSearch.oninput=desenharMedalhas;badgeType.onchange=desenharMedalhas;peopleSearch.oninput=desenharPessoas;level.onchange=desenharPessoas;
 history.addEventListener('toggle',async()=>{if(!history.open)return;const token=++historyToken,ids=[...selectedBadges];historyBody.textContent='Carregando…';try{const content=document.createDocumentFragment();for(const id of ids){const {data,error}=await sb.rpc('acolitos_medalhas_historico',{p_medalha:id});if(error)throw error;content.append(el('h3',catalogo.find(b=>b.id===id)?.label));if(!data?.length)content.append(el('p','Nenhuma concessão manual registrada.','ma-note'));for(const row of data||[]){const article=el('article',null,'ma-history-row');article.append(el('strong',row.nome),el('p',new Date(row.concedido_em).toLocaleString('pt-BR')+' · '+row.autor),el('p',row.motivo));content.append(article);}}if(token===historyToken&&!closed)historyBody.replaceChildren(content);}catch(e){if(token===historyToken)historyBody.textContent='Não foi possível carregar o histórico.';}});
 ov.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();fechar();}if(e.key==='Tab'){const nodes=[...md.querySelectorAll('button,input,select,summary')].filter(n=>!n.disabled&&n.offsetParent!==null&&n.tabIndex!==-1),i=nodes.indexOf(document.activeElement);if(e.shiftKey&&i<=0){e.preventDefault();nodes.at(-1)?.focus();}else if(!e.shiftKey&&i===nodes.length-1){e.preventDefault();nodes[0]?.focus();}}});
 mostrar(1);setBusy(true);try{await carregarMedalhasArte();const {data,error}=await sb.rpc('acolitos_medalhas_catalogo');if(error)throw error;if(closed)return;catalogo=data||[];desenharMedalhas();status.textContent='Marque uma ou mais medalhas pelas imagens.';}catch(e){status.textContent='Não foi possível carregar as medalhas. Feche e tente novamente.';}finally{setBusy(false);}badgeSearch.focus();
}
function render(main,{sb,ctx,membros,selecionados}){
 if(!permitida(ctx))return;
 const section=el('section',null,'ma-entry');section.append(el('h2','Gestor de medalhas'),el('p','Escolha as medalhas pelas imagens e depois marque quem vai receber. Uma ou várias, para uma ou várias pessoas.'));
 section.append(button('Escolher medalhas',()=>abrir({sb,membros,selecionados}),'btn-sm gold'));main.append(section);
}
root.MedalhasAdmin={abrir,render,permitida};
})(globalThis);
