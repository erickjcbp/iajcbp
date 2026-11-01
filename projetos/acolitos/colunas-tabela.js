// Filtros por coluna combinam entre si; campos sem informação ficam por último.
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ColunasTabela=api;})(globalThis,function(){
 'use strict';
 const normalizar=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 const vazio=v=>v==null||v==='';
 function aplicar(lista,colunas,estado={}){
  const filtrada=lista.filter(m=>colunas.every(c=>{
   const f=estado.filtros?.[c.id],v=c.valor(m);
   if(c.tipo==='numero'){
    if(!f||vazio(f.min)&&vazio(f.max))return true;
    return !vazio(v)&&(vazio(f.min)||Number(v)>=Number(f.min))&&(vazio(f.max)||Number(v)<=Number(f.max));
   }
   return !f||normalizar(v).includes(normalizar(f));
  }));
  const coluna=colunas.find(c=>c.id===estado.ordem);if(!coluna)return filtrada;
  return filtrada.sort((a,b)=>{
   const x=coluna.valor(a),y=coluna.valor(b);if(vazio(x)!==vazio(y))return vazio(x)?1:-1;
   const cmp=coluna.tipo==='numero'?Number(x)-Number(y):String(x??'').localeCompare(String(y??''),'pt-BR',{numeric:true,sensitivity:'base'});
   return (estado.desc?-cmp:cmp)||String(a.apelido||a.nome||'').localeCompare(String(b.apelido||b.nome||''),'pt-BR');
  });
 }
 function cabecalho(colunas,estado,aoMudar){
  const head=document.createElement('thead'),linha=document.createElement('tr'),filtros=document.createElement('tr');filtros.className='colunas-filtros';
  for(const c of colunas){
   const th=document.createElement('th'),tf=document.createElement('th');th.scope='col';if(c.fixa){th.className=tf.className='sticky-left';}
   th.setAttribute('aria-sort',estado.ordem===c.id?(estado.desc?'descending':'ascending'):'none');
   const b=document.createElement('button');b.type='button';b.className='coluna-ordenar';b.textContent=c.label+(estado.ordem===c.id?(estado.desc?' ↓':' ↑'):' ↕');b.title='Ordenar por '+c.label;b.dataset.coluna=c.id;
   b.onclick=()=>{estado.desc=estado.ordem===c.id?!estado.desc:false;estado.ordem=c.id;aoMudar({focoColuna:c.id});};th.append(b);linha.append(th);
   const box=document.createElement('div');box.className='coluna-filtro';
   const campos=c.tipo==='numero'?['min','max']:['texto'];
   for(const campo of campos){
    const input=document.createElement('input');input.className='form-input';input.type=c.tipo==='numero'?'number':'search';
    if(c.tipo==='numero'){input.min='0';input.step=c.step||'any';}
    input.placeholder=campo==='texto'?'Filtrar':campo==='min'?'De':'Até';input.setAttribute('aria-label','Filtrar '+c.label+(campo==='texto'?'':campo==='min'?' mínimo':' máximo'));
    input.value=campo==='texto'?(estado.filtros[c.id]||''):(estado.filtros[c.id]?.[campo]??'');
    input.oninput=()=>{if(campo==='texto')estado.filtros[c.id]=input.value;else{estado.filtros[c.id]??={};estado.filtros[c.id][campo]=input.value;}aoMudar({somenteCorpo:true});};box.append(input);
   }
   tf.append(box);filtros.append(tf);
  }
  head.append(linha,filtros);return head;
 }
 return {aplicar,cabecalho};
});
