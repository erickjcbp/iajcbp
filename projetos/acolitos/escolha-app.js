// Seletores com menu do app; o select original mantém valor, eventos e formulários.
(() => {
  if(window.__escolhaAppAtiva)return;window.__escolhaAppAtiva=true;
  const css=document.createElement('link');css.rel='stylesheet';css.href='/projetos/acolitos/escolha-app.css';document.head.appendChild(css);
  let fecharAtual=null;
  function preparar(s){
    if(s.multiple||s.size>1||s.dataset.appSelect)return;
    s.dataset.appSelect='1';
    const wrap=document.createElement('span');wrap.className='app-select';wrap.style.cssText=s.style.cssText;wrap.style.display='inline-flex';if(!wrap.style.minWidth)wrap.style.minWidth='0';if(!wrap.style.width&&!wrap.style.flex)wrap.style.width='100%';
    const b=document.createElement('button');b.type='button';b.setAttribute('aria-haspopup','listbox');b.setAttribute('aria-expanded','false');
    s.before(wrap);wrap.append(b);wrap._appSelect=s;s.classList.add('app-select-native');s.tabIndex=-1;
    function sync(){b.className=s.className.replace('app-select-native','')+' app-select-trigger';b.disabled=s.disabled;b.textContent=(s.selectedOptions[0]?.textContent||'Selecionar')+' ▾';b.setAttribute('aria-label',s.getAttribute('aria-label')||s.title||s.closest('label')?.childNodes[0]?.textContent?.trim()||'Selecionar opção');}
    function abrir(){
      if(s.disabled)return;fecharAtual?.();
      const menu=document.createElement('div');menu.className='app-select-menu';menu.setAttribute('role','listbox');menu.setAttribute('aria-label',b.getAttribute('aria-label'));
      const itens=[];
      [...s.options].filter(o=>!o.hidden).forEach(o=>{const item=document.createElement('button');item.type='button';item.className='app-select-option';item.textContent=o.textContent;item.disabled=o.disabled||o.parentElement.disabled;item.setAttribute('role','option');item.setAttribute('aria-selected',String(o.selected));item.onclick=()=>{s.value=o.value;sync();fechar();s.dispatchEvent(new Event('change',{bubbles:true}));};menu.appendChild(item);if(!item.disabled)itens.push(item)});
      document.body.appendChild(menu);b.setAttribute('aria-expanded','true');
      const rect=b.getBoundingClientRect();menu.style.width=Math.max(180,Math.min(rect.width,innerWidth-16))+'px';menu.style.left=Math.max(8,Math.min(rect.left,innerWidth-menu.offsetWidth-8))+'px';menu.style.maxHeight=Math.max(120,Math.min(320,innerHeight-32))+'px';menu.style.top=Math.max(8,Math.min(rect.bottom+4,innerHeight-menu.offsetHeight-8))+'px';
      const outside=e=>{if(!menu.contains(e.target)&&e.target!==b)fechar(false)};
      const teclado=e=>{if(e.key==='Escape'){e.preventDefault();fechar();}else if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();const index=itens.indexOf(document.activeElement);itens[(index+(e.key==='ArrowDown'?1:-1)+itens.length)%itens.length]?.focus();}else if(e.key==='Tab')fechar(false)};
      function fechar(foco=true){menu.remove();b.setAttribute('aria-expanded','false');document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',teclado);window.removeEventListener('resize',redimensionar);if(fecharAtual===fechar)fecharAtual=null;if(!foco&&s.classList.contains('hab-sel'))s.onblur?.();if(foco&&b.isConnected)b.focus();}
      const redimensionar=()=>fechar(false);fecharAtual=fechar;document.addEventListener('pointerdown',outside);document.addEventListener('keydown',teclado);window.addEventListener('resize',redimensionar);(itens.find(i=>i.getAttribute('aria-selected')==='true')||itens[0])?.focus();
    }
    b.onclick=abrir;b.onkeydown=e=>{if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();abrir()}};s.addEventListener('change',sync);
    new MutationObserver(sync).observe(s,{subtree:true,childList:true,attributes:true,characterData:true});sync();if(s.classList.contains('hab-sel'))queueMicrotask(abrir);
  }
  const scan=()=>{document.querySelectorAll('.app-select').forEach(w=>{if(!w._appSelect?.isConnected)w.remove()});document.querySelectorAll('select:not([data-app-select])').forEach(preparar);if(fecharAtual&&!document.querySelector('.app-select-trigger[aria-expanded="true"]'))fecharAtual(false)};
  scan();new MutationObserver(scan).observe(document.body,{subtree:true,childList:true});
})();
