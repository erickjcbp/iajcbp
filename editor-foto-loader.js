/* Mesmo editor nos apps, carregado somente ao escolher uma foto. */
(() => {
  let carregando;
  window.recortarFoto = async function(file,options={}){
    if(!carregando)carregando=Promise.all([
      new Promise((ok,no)=>{const l=document.createElement('link');l.rel='stylesheet';l.href='/editor-foto.css';l.onload=ok;l.onerror=no;document.head.append(l);}),
      new Promise((ok,no)=>{const s=document.createElement('script');s.src='/editor-foto.js';s.onload=ok;s.onerror=no;document.head.append(s);})
    ]).catch(e=>{carregando=null;throw e;});
    await carregando;return window.EditorFoto.abrir(file,options);
  };
  // Campos normais mantêm seu fluxo de upload. O evento só prossegue com a
  // seleção confirmada. Arquivos PDF/Word/planilhas não entram no editor.
  const confirmados=new WeakSet();
  document.addEventListener('change',async e=>{
    const input=e.target;if(!(input instanceof HTMLInputElement)||input.type!=='file'||input.dataset.photoSkip==='true')return;
    if(confirmados.has(input)){confirmados.delete(input);return;}
    const files=[...(input.files||[])];if(!files.some(f=>f.type.startsWith('image/')))return;
    e.stopImmediatePropagation();e.preventDefault();
    try{const aprovados=[];for(const f of files){if(!f.type.startsWith('image/')){aprovados.push(f);continue;}const novo=await window.recortarFoto(f,{aspect:Number(input.dataset.photoAspect)||undefined,fixo:input.dataset.photoFixed==='true'});if(novo)aprovados.push(novo);}const dt=new DataTransfer();aprovados.forEach(f=>dt.items.add(f));input.files=dt.files;if(!aprovados.length){input.value='';return;}confirmados.add(input);input.dispatchEvent(new Event('change',{bubbles:true}));}
    catch(err){input.value='';if(window.PASCOM?.avisar)window.PASCOM.avisar(err.message||'Não foi possível abrir a foto.');else{let msg=document.getElementById('editorFotoErro');if(!msg){msg=document.createElement('p');msg.id='editorFotoErro';msg.setAttribute('role','alert');input.parentElement.append(msg);}msg.textContent=err.message||'Não foi possível abrir a foto.';}}
  },true);
})();
