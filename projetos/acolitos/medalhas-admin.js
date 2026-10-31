(function(root){
'use strict';
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
const button=(text,fn,cls='btn-sm gray')=>{const b=el('button',text,cls);b.type='button';b.onclick=fn;return b;};
let onSelection=null;document.addEventListener('matriz-selecao',()=>onSelection?.());
const permitida=ctx=>['coord_admin','subadmin'].includes(ctx?.membership?.role);
async function abrir({sb,membros}){
 if(!membros.length){toast('Selecione os membros na matriz primeiro.','error');return;}
 const ids=[...new Set(membros.map(m=>m.id))];if(ids.length>500){toast('Selecione até 500 membros.','error');return;}
 const overflowAnterior=document.body.style.overflow;document.body.style.overflow='hidden';
 const origem=document.activeElement,ov=el('div',null,'modal-overlay open medalhas-admin-overlay'),md=el('div',null,'modal medalhas-admin-modal');
 md.setAttribute('role','dialog');md.setAttribute('aria-modal','true');md.setAttribute('aria-label','Conceder medalhas em massa');
 const status=el('p','Carregando medalhas…','ma-status');status.setAttribute('role','status');
 let busy=false,closed=false,preview=null,catalogo=[];
 function fechar(){if(busy||closed)return;closed=true;ov.remove();document.body.style.overflow=overflowAnterior;if(origem?.isConnected)origem.focus({preventScroll:true});}
 ov._acResolveClose=fechar;ov.onclick=e=>{if(e.target===ov)fechar();};
 const top=el('div',null,'ma-top');top.append(el('h2','Conceder medalhas','modal-title'));const closeButton=button('×',fechar,'modal-close');closeButton.setAttribute('aria-label','Fechar concessão de medalhas');md.append(closeButton,top,el('p',ids.length+' membro(s) selecionado(s). A concessão fica registrada com seu nome, data e motivo. Não altera XP nem aptidões.','ma-note'),status);ov.append(md);document.body.append(ov);
 const form=el('div',null,'ma-form'),art=el('div',null,'ma-art'),fields=el('div',null,'ma-fields');
 const buscaLabel=el('label','Buscar medalha'),busca=el('input',null,'form-input');busca.type='search';busca.placeholder='Nome ou descrição';buscaLabel.append(busca);
 const selectLabel=el('label','Medalha'),select=el('select',null,'form-input');selectLabel.append(select);
 const desc=el('p','', 'ma-note');
 const motivoLabel=el('label','Motivo da concessão'),motivo=el('textarea',null,'form-input');motivo.rows=3;motivo.maxLength=500;motivo.placeholder='Ex.: reconhecimento pelo serviço no encontro de formação.';motivoLabel.append(motivo);
 fields.append(buscaLabel,selectLabel,desc,motivoLabel);form.append(art,fields);md.append(form);
 const recipients=el('details',null,'ma-details');recipients.append(el('summary','Ver '+ids.length+' membros selecionados'));const names=el('ul');membros.forEach(m=>names.append(el('li',m.nome||m.apelido||m.id)));recipients.append(names);md.append(recipients);
 const reviewBox=el('div',null,'ma-review');reviewBox.hidden=true;md.append(reviewBox);
 const acts=el('div',null,'ma-actions'),review=button('Revisar concessão',revisar,'btn-sm gold'),confirm=button('Confirmar concessão',conceder,'btn-sm gold');confirm.hidden=true;review.disabled=true;acts.append(review,confirm);md.append(acts);
 const history=el('details',null,'ma-details');history.append(el('summary','Histórico manual desta medalha · últimos 100'));const historyBody=el('div');history.append(historyBody);md.append(history);
 let historyToken=0;
 history.addEventListener('toggle',async()=>{if(!history.open)return;const id=select.value,token=++historyToken;historyBody.textContent='Carregando…';try{const {data,error}=await sb.rpc('acolitos_medalhas_historico',{p_medalha:id});if(error)throw error;if(token!==historyToken||id!==select.value)return;historyBody.replaceChildren();if(!data?.length)historyBody.textContent='Nenhuma concessão manual registrada para esta medalha.';for(const item of data||[]){const row=el('article',null,'ma-history-row');row.append(el('strong',item.nome),el('p',new Date(item.concedido_em).toLocaleString('pt-BR')+' · '+item.autor),el('p',item.motivo));historyBody.append(row);}}catch(e){if(token===historyToken)historyBody.textContent='Não foi possível carregar o histórico. Feche e abra para tentar novamente.';}});
 function invalidar(){preview=null;reviewBox.hidden=true;confirm.hidden=true;}
 function mostrarMedalha(){invalidar();history.open=false;historyToken++;const b=catalogo.find(b=>b.id===select.value);art.replaceChildren();if(b){art.innerHTML=window.MedalhasArte?.html(b.icone,medalhaTier(b),240)||'';const img=art.querySelector('img');if(img)img.alt=b.label;art.append(el('h3',b.label));desc.textContent=b.desc||'Medalha da coleção da pastoral.';}else desc.textContent='Nenhuma medalha corresponde à busca.';review.disabled=!b;}
 function filtrar(){const selected=select.value,q=busca.value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();select.replaceChildren();catalogo.filter(b=>(b.label+' '+(b.desc||'')).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(q)).forEach(b=>{const o=el('option',b.label);o.value=b.id;select.append(o);});if([...select.options].some(o=>o.value===selected))select.value=selected;select.dispatchEvent(new Event('change',{bubbles:true}));}
 busca.oninput=filtrar;select.onchange=mostrarMedalha;motivo.oninput=invalidar;
 function setBusy(value){busy=value;md.querySelectorAll('input,textarea,select,button').forEach(n=>n.disabled=value);if(!value)review.disabled=!select.value;}
 async function revisar(){if(motivo.value.trim().length<3){status.textContent='Informe um motivo com pelo menos 3 caracteres.';motivo.focus();return;}setBusy(true);invalidar();status.textContent='Conferindo quem já possui esta medalha…';try{const {data,error}=await sb.rpc('acolitos_medalhas_lote',{p_medalha:select.value,p_membros:ids,p_motivo:motivo.value.trim(),p_confirmar:false});if(error)throw error;if(!data?.ok||data.confirmado!==false||data.total!==ids.length)throw Error('Prévia incompleta.');preview={data,medalha:select.value,motivo:motivo.value.trim()};reviewBox.replaceChildren(el('h3','Revisão da concessão'),el('p',data.novas+' receberão a medalha · '+data.existentes+' já possuem e serão preservados.'));const list=el('ul');(data.membros||[]).forEach(m=>list.append(el('li',m.nome+' — '+(m.ja_possui?'já possui':'vai receber'))));reviewBox.append(list);reviewBox.hidden=false;confirm.textContent='Confirmar '+data.novas+' medalha(s)';confirm.hidden=!data.novas;status.textContent=data.novas?'Confira a lista e confirme para conceder.':'Todos os selecionados já possuem esta medalha. Nenhuma alteração necessária.';}catch(e){status.textContent='Não foi possível revisar: '+(e.message||'tente novamente.');}finally{setBusy(false);}}
 async function conceder(){if(!preview||preview.medalha!==select.value||preview.motivo!==motivo.value.trim())return;setBusy(true);status.textContent='Concedendo medalhas…';const lote=preview;try{const {data,error}=await sb.rpc('acolitos_medalhas_lote',{p_medalha:lote.medalha,p_membros:ids,p_motivo:lote.motivo,p_confirmar:true});if(error)throw error;if(!data?.ok||data.confirmado!==true)throw Error('Concessão não confirmada.');invalidar();status.textContent=data.novas+' medalha(s) concedida(s). '+data.existentes+' membro(s) já possuíam. Histórico registrado; o aviso aparecerá no app de cada membro.';history.open=false;}catch(e){invalidar();status.textContent='Não consegui confirmar o resultado: '+(e.message||'revise novamente antes de tentar.');}finally{setBusy(false);}}
 ov.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();fechar();}if(e.key==='Tab'){const focusables=[...md.querySelectorAll('button,input,textarea,select,summary')].filter(n=>!n.disabled&&n.offsetParent!==null&&n.tabIndex!==-1);const i=focusables.indexOf(document.activeElement);if(e.shiftKey&&i<=0){e.preventDefault();focusables.at(-1)?.focus();}else if(!e.shiftKey&&i===focusables.length-1){e.preventDefault();focusables[0]?.focus();}}});
 try{await carregarMedalhasArte();const {data,error}=await sb.rpc('acolitos_medalhas_catalogo');if(error)throw error;catalogo=data||[];filtrar();status.textContent=catalogo.length+' medalhas disponíveis. Escolha uma e informe o motivo.';}catch(e){status.textContent='Não foi possível carregar as medalhas. Feche e tente novamente.';}
 busca.focus();
}
function render(main,{sb,ctx,membros,selecionados}){
 if(!permitida(ctx))return;
 const section=el('section',null,'ma-entry');section.append(el('h2','Medalhas em massa'),el('p','Marque os membros na matriz acima. Escolha qualquer medalha, confira a prévia e registre o motivo antes de conceder.'));
 const open=button('Conceder medalhas',()=>abrir({sb,membros:membros.filter(m=>selecionados.has(m.id))}),'btn-sm gold');
 const count=el('span','', 'ma-note');const atualizar=()=>{open.disabled=!selecionados.size;count.textContent=selecionados.size+' membro(s) selecionado(s)';};atualizar();section.append(count,open);main.append(section);
 onSelection=atualizar;
}
root.MedalhasAdmin={abrir,render,permitida};
})(globalThis);
