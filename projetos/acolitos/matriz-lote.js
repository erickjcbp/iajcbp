const matrizSelecionados=new Set();
const estadoJornada={busca:'',nivel:'',resumo:false};
function capturarEstadoJornada(){
  const wrap=document.querySelector('.matriz-scroll');
  const busca=document.getElementById('dev-busca'),nivel=document.getElementById('dev-nivel');
  if(busca)estadoJornada.busca=busca.value;if(nivel)estadoJornada.nivel=nivel.value;
  return {y:scrollY,x:scrollX,left:wrap?.scrollLeft||0,top:wrap?.scrollTop||0};
}
function restaurarEstadoJornada(s){
  const wrap=document.querySelector('.matriz-scroll');if(wrap){wrap.scrollLeft=s.left;wrap.scrollTop=s.top;}
  window.scrollTo({left:s.x,top:s.y,behavior:'instant'});
}
function atualizarSelecaoMatriz(){
  const ativos=new Set(_devMembros.map(m=>m.id));for(const id of matrizSelecionados)if(!ativos.has(id))matrizSelecionados.delete(id);
  document.querySelectorAll('.matriz-member-check').forEach(c=>{c.checked=matrizSelecionados.has(c.dataset.id);c.closest('tr')?.classList.toggle('matriz-selected',c.checked)});
  document.querySelectorAll('.matriz-all-check').forEach(c=>{const ids=c.dataset.ids?JSON.parse(c.dataset.ids):_devMembros.map(m=>m.id);const n=ids.filter(id=>matrizSelecionados.has(id)).length;c.checked=ids.length>0&&n===ids.length;c.indeterminate=n>0&&n<ids.length;});
  const count=document.querySelector('.matriz-lote-count');if(count)count.textContent=matrizSelecionados.size+' selecionados';
  document.querySelectorAll('.matriz-lote-action').forEach(b=>b.disabled=!matrizSelecionados.size);
  document.dispatchEvent(new Event('matriz-selecao'));
}
function checkboxMatriz(label,ids){
 const wrap=document.createElement('label');wrap.className='matriz-select';
 const c=document.createElement('input');c.type='checkbox';c.setAttribute('aria-label',label);
 if(Array.isArray(ids)){c.className='matriz-all-check';c.dataset.ids=JSON.stringify(ids);c.onchange=()=>{ids.forEach(id=>c.checked?matrizSelecionados.add(id):matrizSelecionados.delete(id));atualizarSelecaoMatriz()};}
 else{c.className='matriz-member-check';c.dataset.id=ids;c.checked=matrizSelecionados.has(ids);c.onchange=()=>{c.checked?matrizSelecionados.add(ids):matrizSelecionados.delete(ids);atualizarSelecaoMatriz()};}
 wrap.appendChild(c);return wrap;
}
function barraLoteMatriz(){
 const bar=document.createElement('div');bar.className='matriz-lote-bar';const count=document.createElement('span');count.className='matriz-lote-count';bar.appendChild(count);
 for(const [acao,label] of [['nivel','Alterar nível'],['funcoes','Aptidão por função'],['disponibilidade','Disponibilidade']]){const b=document.createElement('button');b.className='btn-sm gray matriz-lote-action';b.textContent=label;b.onclick=()=>abrirEdicaoMatrizLote(acao);bar.appendChild(b)}
 if(globalThis.MedalhasAdmin?.permitida(ctx)){const medalhas=document.createElement('button');medalhas.type='button';medalhas.className='btn-sm gold matriz-lote-action';medalhas.textContent='Dar medalhas';medalhas.onclick=()=>MedalhasAdmin.abrir({sb,membros:_devMembros.filter(m=>matrizSelecionados.has(m.id))});bar.appendChild(medalhas);}
 const limpar=document.createElement('button');limpar.className='btn-sm gray';limpar.textContent='Limpar seleção';limpar.onclick=()=>{matrizSelecionados.clear();atualizarSelecaoMatriz()};bar.appendChild(limpar);return bar;
}
function abrirEdicaoMatrizLote(acao){
 const ids=_devMembros.filter(m=>matrizSelecionados.has(m.id)).map(m=>m.id);if(!ids.length)return;
 const ov=document.createElement('div');ov.className='modal-overlay open';const md=document.createElement('div');md.className='modal matriz-lote-modal';md.style.setProperty('--modal-max','520px');
 const title=document.createElement('h2');title.className='modal-title';title.textContent={nivel:'Alterar nível',funcoes:'Aptidão por função',disponibilidade:'Disponibilidade'}[acao]+' · '+ids.length+' membros';md.appendChild(title);
 const nomes=document.createElement('details');const sum=document.createElement('summary');sum.textContent='Ver membros selecionados';nomes.appendChild(sum);const lista=document.createElement('div');lista.className='matriz-lote-nomes';lista.textContent=_devMembros.filter(m=>ids.includes(m.id)).map(m=>m.apelido||m.nome).join(', ');nomes.appendChild(lista);md.appendChild(nomes);
 const form=document.createElement('div');form.className='matriz-lote-fields';md.appendChild(form);
 const select=(label,options,valor)=>{const l=document.createElement('label');l.className='form-label';l.textContent=label;const s=document.createElement('select');s.className='form-select';s.setAttribute('aria-label',label);options.forEach(([v,t])=>{const o=document.createElement('option');o.value=v;o.textContent=t;s.appendChild(o)});if(valor!==undefined)s.value=valor;form.append(l,s);return s};
 const checks=(opcoes)=>{const el=document.createElement('div');el.className='matriz-lote-checks';opcoes.forEach(([v,label])=>{const l=document.createElement('label');const c=document.createElement('input');c.type='checkbox';c.value=v;const t=document.createElement('span');t.textContent=label;l.append(c,t);el.appendChild(l)});form.appendChild(el);return el};
 let nivel,prof,funcoes,modo,horarios;
 if(acao==='nivel')nivel=select('Novo nível',[['','Escolha o nível'],...NIVEIS.map(n=>[n.slug,n.label])],'');
 if(acao==='funcoes'){prof=select('Proficiência',PROF_NIVEIS.map(p=>[p,PROF_LABEL[p]]),'apto');funcoes=checks([...new Map(_devFuncoes).entries()]);}
 if(acao==='disponibilidade'){modo=select('Como alterar',[['adicionar','Adicionar horários, mantendo os atuais'],['remover','Remover somente estes horários'],['substituir','Substituir todos os horários atuais'],['limpar','Limpar todos os horários']],'adicionar');horarios=checks(HORARIOS.map((h,i)=>[String(i),h.label]));modo.onchange=()=>{horarios.hidden=modo.value==='limpar';atualizaResumo()};}
 const resumo=document.createElement('p');resumo.className='matriz-lote-resumo';md.appendChild(resumo);
 function atualizaResumo(){resumo.textContent=acao==='disponibilidade'?({adicionar:'Mantém os horários atuais e acrescenta os marcados.',remover:'Remove apenas os horários marcados.',substituir:'Troca todos os horários atuais pelos marcados.',limpar:'Remove toda a disponibilidade dos membros selecionados.'}[modo.value]):acao==='nivel'?'Define o mesmo nível para todos os selecionados.':'Aplica a proficiência escolhida somente às funções marcadas.';}
 atualizaResumo();const msg=document.createElement('p');msg.className='msg';msg.setAttribute('role','status');md.appendChild(msg);
 const acts=document.createElement('div');acts.className='modal-actions';const cancel=document.createElement('button');cancel.className='btn-sm gray';cancel.textContent='Cancelar';cancel.onclick=()=>ov.remove();const save=document.createElement('button');save.className='btn-sm gold';save.textContent='Aplicar aos '+ids.length+' membros';acts.append(cancel,save);md.appendChild(acts);
 let salvando=false;ov.onclick=e=>{if(e.target===ov&&!salvando)ov.remove()};
 save.onclick=async()=>{
  const dados={};if(acao==='nivel'){if(!nivel.value){msg.textContent='Escolha o nível.';return;}dados.nivel=nivel.value;}
  if(acao==='funcoes'){dados.funcoes=[...funcoes.querySelectorAll('input:checked')].map(c=>c.value);dados.proficiencia=prof.value;if(!dados.funcoes.length){msg.textContent='Marque ao menos uma função.';return;}}
  if(acao==='disponibilidade'){dados.modo=modo.value;dados.horarios=[...horarios.querySelectorAll('input:checked')].map(c=>{const h=HORARIOS[Number(c.value)];return {dia:h.dia,horario:h.horario}});if(modo.value!=='limpar'&&!dados.horarios.length){msg.textContent='Marque ao menos um horário.';return;}}
  salvando=true;save.disabled=cancel.disabled=true;save.textContent='Aplicando…';
  try{const {data,error}=await sb.rpc('acolitos_jornada_editar_lote',{p_membros:ids,p_acao:acao,p_dados:dados});if(error)throw error;if(!data?.ok||data.total!==ids.length)throw new Error('O lote não foi confirmado.');ov.remove();try{await renderAll();toast('✓ Atualizado para '+data.total+' membros.');}catch(atualizacao){toast('Lote salvo. Não consegui atualizar a matriz; tente atualizar a tela.','error');}}
  catch(e){msg.className='msg error';msg.textContent='Não foi possível aplicar: '+(e.message||'tente novamente.');}
  finally{salvando=false;save.disabled=cancel.disabled=false;save.textContent='Aplicar aos '+ids.length+' membros';}
 };
 ov.appendChild(md);document.body.appendChild(ov);
}
