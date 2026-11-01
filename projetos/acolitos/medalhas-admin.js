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
 const steps=el('p','Medalhas → Pessoas → Conferência','ma-note');
 const recipients=el('div',null,'ma-actions mg-recipients'),recipientDetails=el('details',null,'ma-note'),recipientTitle=el('summary'),recipientNames=el('p');
 recipientDetails.append(recipientTitle,recipientNames);const editRecipients=button('Alterar destinatários',()=>{mostrar(2);desenharPessoas();});recipients.append(recipientDetails,editRecipients);heading.append(recipients);
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
 function selectFiltro(label,aria,opcoes,fn){const wrap=el('label',label,'mg-filter-label'),input=el('select',null,'form-input');input.setAttribute('aria-label',aria);for(const [value,text] of opcoes){const op=el('option',text);op.value=value;input.append(op);}input.onchange=fn;wrap.append(input);return {wrap,input};}
 const badgeTier=selectFiltro('Cor da medalha','Cor da medalha',[['todas','Todas as cores']],desenharMedalhas);
 const badgeOrder=selectFiltro('Ordenar medalhas','Ordenar medalhas',[['nome','Nome A–Z'],['nome_desc','Nome Z–A'],['tier','Cor / tier']],desenharMedalhas);
 const badgeFilters=el('div',null,'mg-people-filters');badgeFilters.append(badgeSearchLabel,badgeTypeLabel,badgeTier.wrap,badgeOrder.wrap);
 const badgeCount=el('p','', 'ma-note'),badgeGrid=el('div',null,'mg-badges');
 const history=el('details',null,'ma-details');history.hidden=true;history.append(el('summary','Histórico das medalhas selecionadas'));const historyBody=el('div');history.append(historyBody);
 badgePage.append(badgeFilters,badgeCount,badgeGrid,history);
 const peopleSearch=el('input',null,'form-input');peopleSearch.type='search';peopleSearch.placeholder='Buscar membro';peopleSearch.setAttribute('aria-label','Buscar membros');
 const peopleSearchLabel=el('label','Buscar membro','mg-filter-label');peopleSearchLabel.append(peopleSearch);
 const selectedLevels=new Set(),levelButtons=new Map();
 const levelFilters=el('div',null,'mg-levels');levelFilters.setAttribute('role','group');levelFilters.setAttribute('aria-label','Filtrar membros por níveis');
 const allLevels=button('Todos os níveis',()=>{selectedLevels.clear();desenharPessoas();},'mg-level');levelFilters.append(allLevels);
 const counts=new Map();pessoas.forEach(m=>{const slug=m.nivel||'aspirante';counts.set(slug,(counts.get(slug)||0)+1);});
 const levels=typeof NIVEIS!=='undefined'?NIVEIS.map(n=>n.slug):[];
 const ordered=[...counts.keys()].sort((a,b)=>{const ai=levels.indexOf(a),bi=levels.indexOf(b);return (ai<0?999:ai)-(bi<0?999:bi)||nivelInfo(a).label.localeCompare(nivelInfo(b).label,'pt-BR');});
 for(const slug of ordered){const item=button(nivelInfo(slug).label+' ('+counts.get(slug)+')',()=>{selectedLevels.has(slug)?selectedLevels.delete(slug):selectedLevels.add(slug);desenharPessoas();},'mg-level');item.dataset.nivel=slug;levelButtons.set(slug,item);levelFilters.append(item);}
 const peopleFilters=el('div',null,'mg-member-filters');const levelLabel=el('p','Filtrar por nível','mg-filter-title'),levelHint=el('p','Escolha um ou mais níveis. As pessoas já selecionadas continuam marcadas.','ma-note');peopleFilters.append(peopleSearchLabel);
 const time=selectFiltro('Tempo de pastoral','Tempo de pastoral',[['todos','Todos os tempos'],['menos1','Menos de 1 ano'],['1','1 ano ou mais'],['2','2 anos ou mais'],['3','3 anos ou mais'],['5','5 anos ou mais'],['com_data','Com data informada'],['sem_data','Sem data informada']],desenharPessoas);
 const communityName=v=>({matriz:'Matriz',santo_antonio:'Sto. Antônio'})[v]||v||'Não informada';
 const community=selectFiltro('Comunidade','Comunidade dos membros',[['todas','Todas as comunidades'],...[...new Set(pessoas.map(m=>m.comunidade||'sem_comunidade'))].sort().map(v=>[v,v==='sem_comunidade'?'Não informada':communityName(v)])],desenharPessoas);
 const selection=selectFiltro('Seleção','Seleção dos membros',[['todos','Todos os membros'],['selecionados','Somente selecionados'],['nao_selecionados','Ainda não selecionados']],desenharPessoas);
 const peopleOrder=selectFiltro('Ordenar por','Ordenar membros',[['nome','Nome A–Z'],['nome_desc','Nome Z–A'],['tempo_desc','Mais tempo de pastoral'],['tempo_asc','Menos tempo de pastoral'],['nivel_desc','Nível mais alto'],['nivel_asc','Nível mais baixo'],['idade_desc','Maior idade'],['idade_asc','Menor idade'],['comunidade','Comunidade']],desenharPessoas);
 const ranges=el('div',null,'mg-people-filters');
 const rangeInput=(label,aria)=>{const wrap=el('label',label,'mg-filter-label'),input=el('input',null,'form-input');input.type='number';input.min='0';input.step='1';input.placeholder='Sem limite';input.setAttribute('aria-label',aria);input.oninput=desenharPessoas;wrap.append(input);ranges.append(wrap);return input;};
 const minTime=rangeInput('Tempo mínimo (meses completos)','Tempo mínimo em meses'),maxTime=rangeInput('Tempo máximo (meses completos)','Tempo máximo em meses');
 const minAge=rangeInput('Idade mínima (anos)','Idade mínima'),maxAge=rangeInput('Idade máxima (anos)','Idade máxima');
 const extra=el('div',null,'mg-people-filters mg-primary-filters');extra.append(time.wrap,peopleOrder.wrap);
 const advanced=el('details',null,'mg-advanced-filters'),advancedTitle=el('summary','Níveis e mais filtros'),advancedBody=el('div',null,'mg-advanced-body'),extraAdvanced=el('div',null,'mg-people-filters');extraAdvanced.append(community.wrap,selection.wrap);advancedBody.append(levelLabel,levelFilters,levelHint,extraAdvanced,ranges);advanced.append(advancedTitle,advancedBody);
 const note=el('p','Tempo “ou mais” é o mínimo conhecido. Quem está sem data fica no final da ordenação por tempo. Filtros não desmarcam pessoas.','ma-note');
 const resetFilters=button('Limpar filtros de pessoas',()=>{peopleSearch.value='';selectedLevels.clear();for(const x of [time,community,selection]){x.input.selectedIndex=0;x.input.dispatchEvent(new Event('change'));}for(const n of [minTime,maxTime,minAge,maxAge])n.value='';desenharPessoas();});
 peopleFilters.append(extra,advanced,note,resetFilters);
 const peopleCount=el('p','', 'ma-note'),peopleList=el('div',null,'mg-people');
 const markAll=button('Marcar todos do filtro',()=>{filtrarPessoas().forEach(m=>selectedPeople.add(m.id));invalidar();desenharPessoas();});
 const unmarkAll=button('Desmarcar todos do filtro',()=>{filtrarPessoas().forEach(m=>selectedPeople.delete(m.id));invalidar();desenharPessoas();});
 const clear=button('Limpar toda a seleção',()=>{selectedPeople.clear();invalidar();desenharPessoas();});const peopleActions=el('div',null,'ma-actions');peopleActions.append(markAll,unmarkAll,clear);peoplePage.append(peopleFilters,peopleActions,peopleCount,peopleList);
 const motivoLabel=el('label','Motivo (opcional)','mg-reason'),motivo=el('input',null,'form-input');motivo.maxLength=500;motivo.placeholder='Ex.: serviço no encontro da pastoral';motivoLabel.append(motivo);
 const summary=el('div',null,'mg-summary');reviewPage.append(summary,motivoLabel);
 function invalidar(){preview=null;history.open=false;historyToken++;}
 function setBusy(value){busy=value;for(const area of [md,badgePage,peoplePage,reviewPage])area.querySelectorAll('input,select,button').forEach(n=>n.disabled=value);if(!value)atualizar();}
 function atualizar(){recipients.style.display=step===1&&selectedPeople.size?'flex':'none';recipientTitle.textContent=quantidade(selectedPeople.size,'membro já selecionado','membros já selecionados');recipientNames.textContent=pessoas.filter(m=>selectedPeople.has(m.id)).map(m=>m.nome||m.apelido).join(', ');steps.textContent=selectedPeople.size?'Medalhas → Conferência → Concessão':'Medalhas → Pessoas → Conferência';if(step===1)next.textContent=selectedPeople.size?'Conferir envio':'Escolher pessoas';if(step===2)next.textContent=selectedBadges.size?'Conferir envio':'Escolher medalhas';advancedTitle.textContent='Níveis e mais filtros'+(selectedLevels.size?' · '+selectedLevels.size+' nível(is)':'')+((community.input.value!=='todas'||selection.input.value!=='todos'||[minTime,maxTime,minAge,maxAge].some(n=>n.value!==''))?' · filtros ativos':'');badgeCount.textContent=quantidade(selectedBadges.size,'medalha selecionada','medalhas selecionadas');const visible=filtrarPessoas(),hiddenSelected=[...selectedPeople].filter(id=>!visible.some(m=>m.id===id)).length;peopleCount.textContent=quantidade(visible.length,'pessoa encontrada','pessoas encontradas')+' · '+quantidade(selectedPeople.size,'pessoa selecionada','pessoas selecionadas')+(hiddenSelected?' · '+hiddenSelected+' fora do filtro':'');allLevels.setAttribute('aria-pressed',String(!selectedLevels.size));levelButtons.forEach((b,slug)=>b.setAttribute('aria-pressed',String(selectedLevels.has(slug))));next.disabled=busy||(step===1?!selectedBadges.size:step===2?!selectedPeople.size:!preview?.novas);history.hidden=!selectedBadges.size;}
 function desenharMedalhas(){
  badgeGrid.replaceChildren();const q=normalizar(badgeSearch.value);
  const found=catalogo.filter(b=>(badgeType.value==='todas'||(badgeType.value==='automaticas'?b.validacao==='automatica':b.validacao!=='automatica'))&&(badgeTier.input.value==='todas'||medalhaTier(b)===badgeTier.input.value)&&normalizar([b.label,b.desc,b.requisito,b.manutencao].join(' ')).includes(q)).sort((a,b)=>{const byName=String(a.label).localeCompare(String(b.label),'pt-BR');return badgeOrder.input.value==='nome_desc'?-byName:badgeOrder.input.value==='tier'?String(medalhaTier(a)).localeCompare(String(medalhaTier(b)),'pt-BR')||byName:byName;});
  for(const b of found){const card=button('',()=>{selectedBadges.has(b.id)?selectedBadges.delete(b.id):selectedBadges.add(b.id);invalidar();desenharMedalhas();},'mg-badge');card.dataset.id=b.id;card.setAttribute('aria-pressed',String(selectedBadges.has(b.id)));card.setAttribute('aria-label',b.label);card.title=b.desc||b.label;card.innerHTML=MedalhasArte.html(b.icone,medalhaTier(b),96);card.append(el('span',b.label,'mg-badge-name'),medalhaDetalhes(b),el('span',selectedBadges.has(b.id)?'✓ Selecionada':'Selecionar','mg-badge-state'));card.setAttribute('aria-describedby',card.querySelector('.medalha-detalhes').id);badgeGrid.append(card);}
  if(!found.length)badgeGrid.append(el('p','Nenhuma medalha encontrada.','ma-note'));atualizar();
 }
 function idade(m){if(!m.data_nascimento)return null;const d=new Date(m.data_nascimento+'T12:00:00'),h=new Date();if(isNaN(d)||d>h)return null;return h.getFullYear()-d.getFullYear()-(h.getMonth()<d.getMonth()||h.getMonth()===d.getMonth()&&h.getDate()<d.getDate()?1:0);}
 function intervalo(v,min,max){return (min.value===''&&max.value==='')||(v!=null&&(min.value===''||v>=Number(min.value))&&(max.value===''||v<=Number(max.value)));}
 function filtrarPessoas(){
  const q=normalizar(peopleSearch.value),tempo=new Map(pessoas.map(m=>[m.id,TempoPastoral.dados(m)]));
  const found=pessoas.filter(m=>{
   const meses=tempo.get(m.id).meses,t=time.input.value;
   return (!q||normalizar(m.nome+' '+(m.apelido||'')).includes(q))&&(!selectedLevels.size||selectedLevels.has(m.nivel||'aspirante'))
    &&(t==='todos'||t==='sem_data'&&meses==null||t==='com_data'&&meses!=null||t==='menos1'&&meses!=null&&meses<12||/^\d+$/.test(t)&&meses!=null&&meses>=Number(t)*12)
    &&intervalo(meses,minTime,maxTime)&&intervalo(idade(m),minAge,maxAge)
    &&(community.input.value==='todas'||(m.comunidade||'sem_comunidade')===community.input.value)
    &&(selection.input.value==='todos'||(selection.input.value==='selecionados'?selectedPeople.has(m.id):!selectedPeople.has(m.id)));
  });
  const o=peopleOrder.input.value;
  const valor=m=>o.startsWith('tempo_')?tempo.get(m.id).meses:o.startsWith('nivel_')?nivelInfo(m.nivel||'aspirante').int:o.startsWith('idade_')?idade(m):o==='comunidade'?communityName(m.comunidade):(m.nome||m.apelido);
  return found.sort((a,b)=>{const x=valor(a),y=valor(b);if((x==null)!==(y==null))return x==null?1:-1;const cmp=typeof x==='number'&&typeof y==='number'?x-y:String(x??'').localeCompare(String(y??''),'pt-BR',{sensitivity:'base'});return (o.endsWith('_desc')?-cmp:cmp)||String(a.nome||'').localeCompare(String(b.nome||''),'pt-BR');});
 }
 function desenharPessoas(){peopleList.replaceChildren();const found=filtrarPessoas();for(const m of found){const label=el('label',null,'mg-person');const input=el('input');input.type='checkbox';input.value=m.id;input.checked=selectedPeople.has(m.id);input.onchange=()=>{input.checked?selectedPeople.add(m.id):selectedPeople.delete(m.id);invalidar();if(selection.input.value==='todos')atualizar();else desenharPessoas();};const info=el('span');info.append(el('strong',m.nome||m.apelido),el('small',nivelInfo(m.nivel||'aspirante').label),TempoPastoral.elemento(m),el('small',communityName(m.comunidade)));label.append(input,info);peopleList.append(label);}if(!found.length)peopleList.append(el('p','Nenhum membro encontrado.','ma-note'));atualizar();}
 function mostrar(n){step=n;title.textContent=['','Escolha as medalhas','Quem vai receber?','Confira e conceda'][n];body.replaceChildren([null,badgePage,peoplePage,reviewPage][n]);back.textContent=n===1?'Fechar':'Voltar';next.textContent=n===1?'Escolher pessoas':n===2?'Conferir envio':'Conceder '+quantidade(preview?.novas||0,'medalha','medalhas');status.textContent=n===1?'Marque uma ou mais medalhas pelas imagens.':n===2?'Marque uma ou mais pessoas.':'Quem já possui a medalha será preservado.';atualizar();body.scrollTop=0;}
 async function avancar(){
  if(step===1&&!selectedPeople.size){mostrar(2);desenharPessoas();return;}
  if(step===2&&!selectedBadges.size){mostrar(1);return;}
  if(step===2||(step===1&&selectedPeople.size)){if(selectedPeople.size>500){status.textContent='Selecione até 500 pessoas.';return;}setBusy(true);status.textContent='Conferindo as medalhas dos selecionados…';try{const {data,error}=await sb.rpc('acolitos_medalhas_multiplas',{p_medalhas:[...selectedBadges],p_membros:[...selectedPeople],p_motivo:'',p_confirmar:false});if(error)throw error;if(!data?.ok||data.confirmado!==false||data.total_membros!==selectedPeople.size||data.total_medalhas!==selectedBadges.size)throw Error('Não foi possível conferir o lote.');if(closed)return;preview=data;summary.replaceChildren(el('h3',quantidade(selectedBadges.size,'medalha','medalhas')+' para '+quantidade(selectedPeople.size,'pessoa','pessoas')),el('p',data.novas+' novas conquistas · '+data.existentes+' já conquistadas, sem duplicar.'));const thumbs=el('div',null,'mg-selected');for(const b of catalogo.filter(b=>selectedBadges.has(b.id))){const item=el('figure');item.innerHTML=MedalhasArte.html(b.icone,medalhaTier(b),64);const caption=el('figcaption');caption.append(el('strong',b.label),medalhaDetalhes(b));item.append(caption);thumbs.append(item);}summary.append(thumbs);const hidden=[...selectedPeople].filter(id=>!filtrarPessoas().some(m=>m.id===id)).length;if(hidden)summary.append(el('p','Atenção: '+hidden+' pessoa(s) selecionada(s) fora do filtro também receberão as medalhas.','ma-status'));const names=el('details',null,'ma-details');names.append(el('summary','Ver pessoas selecionadas'));const list=el('ul');pessoas.filter(m=>selectedPeople.has(m.id)).forEach(m=>list.append(el('li',m.nome||m.apelido)));names.append(list);summary.append(names);mostrar(3);if(!data.novas)status.textContent='Todos já possuem as medalhas escolhidas. Nenhuma concessão necessária.';}catch(e){status.textContent='Não foi possível conferir: '+(e.message||'tente novamente.');}finally{setBusy(false);}return;}
  if(!preview||!preview.novas)return;
  setBusy(true);status.textContent='Concedendo medalhas…';try{const {data,error}=await sb.rpc('acolitos_medalhas_multiplas',{p_medalhas:[...selectedBadges],p_membros:[...selectedPeople],p_motivo:motivo.value.trim(),p_confirmar:true});if(error)throw error;if(!data?.ok||data.confirmado!==true)throw Error('Resultado não confirmado.');if(typeof atualizarMarcosTempo==='function')atualizarMarcosTempo([...selectedPeople]);preview=null;summary.replaceChildren(el('h3','Medalhas concedidas!'),el('p',data.novas+' novas conquistas. '+data.existentes+' já existiam e foram preservadas.'),el('p','As medalhas já aparecem na coleção e nos cartões dos membros.','ma-note'));motivoLabel.hidden=true;next.hidden=true;back.textContent='Conceder outras';back.onclick=()=>{selectedBadges.clear();selectedPeople.clear();motivo.value='';motivoLabel.hidden=false;next.hidden=false;back.onclick=()=>{if(step===1)fechar();else mostrar(step-1);};mostrar(1);desenharMedalhas();};status.textContent='Concessão registrada com autor e data.';}catch(e){preview=null;status.textContent='Não consegui confirmar o resultado: '+(e.message||'tente novamente.')+' Volte para conferir antes de tentar de novo.';}finally{setBusy(false);}
 }
 badgeSearch.oninput=desenharMedalhas;badgeType.onchange=desenharMedalhas;peopleSearch.oninput=desenharPessoas;
 history.addEventListener('toggle',async()=>{if(!history.open)return;const token=++historyToken,ids=[...selectedBadges];historyBody.textContent='Carregando…';try{const content=document.createDocumentFragment();for(const id of ids){const {data,error}=await sb.rpc('acolitos_medalhas_historico',{p_medalha:id});if(error)throw error;content.append(el('h3',catalogo.find(b=>b.id===id)?.label));if(!data?.length)content.append(el('p','Nenhuma concessão manual registrada.','ma-note'));for(const row of data||[]){const article=el('article',null,'ma-history-row');article.append(el('strong',row.nome),el('p',new Date(row.concedido_em).toLocaleString('pt-BR')+' · '+row.autor),el('p',row.motivo));content.append(article);}}if(token===historyToken&&!closed)historyBody.replaceChildren(content);}catch(e){if(token===historyToken)historyBody.textContent='Não foi possível carregar o histórico.';}});
 ov.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();fechar();}if(e.key==='Tab'){const nodes=[...md.querySelectorAll('button,input,select,summary')].filter(n=>!n.disabled&&n.offsetParent!==null&&n.tabIndex!==-1),i=nodes.indexOf(document.activeElement);if(e.shiftKey&&i<=0){e.preventDefault();nodes.at(-1)?.focus();}else if(!e.shiftKey&&i===nodes.length-1){e.preventDefault();nodes[0]?.focus();}}});
 mostrar(1);setBusy(true);try{await carregarMedalhasArte();const {data,error}=await sb.rpc('acolitos_medalhas_catalogo');if(error)throw error;if(closed)return;catalogo=data||[];for(const tier of [...new Set(catalogo.map(medalhaTier))].sort()){const op=el('option',tier.charAt(0).toUpperCase()+tier.slice(1));op.value=tier;badgeTier.input.append(op);}desenharMedalhas();status.textContent='Marque uma ou mais medalhas pelas imagens.';}catch(e){status.textContent='Não foi possível carregar as medalhas. Feche e tente novamente.';}finally{setBusy(false);}badgeSearch.focus();
}
function render(main,{sb,ctx,membros,selecionados}){
 if(!permitida(ctx))return;
 const section=el('section',null,'ma-entry');section.append(el('h2','Gestor de medalhas'),el('p','Escolha as medalhas pelas imagens e depois marque quem vai receber. Uma ou várias, para uma ou várias pessoas.'));
 section.append(button('Escolher medalhas',()=>abrir({sb,membros,selecionados}),'btn-sm gold'));main.append(section);
}
root.MedalhasAdmin={abrir,render,permitida};
})(globalThis);
