/* Editor local: nenhum arquivo é enviado antes da confirmação. */
(() => {
  let ocupado=false;
  const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text)e.textContent=text;return e;};
  async function abrir(file,options={}){
    if(ocupado)throw new Error('Conclua a edição da outra foto.');
    if(!file?.type?.startsWith('image/'))throw new Error('Escolha uma imagem.');
    if(file.size>20*1024*1024)throw new Error('Escolha uma foto de até 20 MB.');
    ocupado=true;let img;
    try{img=await createImageBitmap(file,{imageOrientation:'from-image'});}catch(e){ocupado=false;throw new Error('Não foi possível abrir esta imagem. Use JPG, PNG ou WebP.');}
    return new Promise(resolve=>{
      const d=el('dialog','ef-dialog');d.id='editorFoto';d.setAttribute('aria-labelledby','efTitulo');
      const head=el('header','ef-head'),title=el('h2','','Ajustar foto');title.id='efTitulo';const close=el('button','ef-close','×');close.type='button';close.setAttribute('aria-label','Cancelar edição da foto');head.append(title,close);
      const main=el('div','ef-main'),help=el('p','ef-help','Arraste a foto para escolher a melhor parte. Use o zoom para aproximar ou afastar.');
      const stage=el('div','ef-stage'),cv=el('canvas'),grid=el('div','ef-grid');grid.setAttribute('aria-hidden','true');stage.append(cv,grid);stage.tabIndex=0;stage.setAttribute('aria-label','Recorte da foto. Arraste ou use as setas para reposicionar.');
      const controls=el('div','ef-controls'),format=el('label','ef-format','Formato'),select=el('select');select.setAttribute('aria-label','Formato do recorte');
      const original=img.width/img.height;for(const [value,label] of [['original','Original'],['1','Quadrado'],['1.7777777778','Paisagem'],['0.8','Retrato']]){const op=el('option','',label);op.value=value;select.append(op);}select.value=options.aspect===1?'1':options.aspect===16/9?'1.7777777778':'original';select.disabled=!!options.fixo;format.append(select);
      const zoomBox=el('div','ef-zoom'),minus=el('button','','−'),plus=el('button','','+'),range=el('input');minus.type=plus.type='button';minus.setAttribute('aria-label','Afastar foto');plus.setAttribute('aria-label','Aproximar foto');range.type='range';range.min='1';range.max='4';range.step='.01';range.value='1';range.setAttribute('aria-label','Zoom da foto');const value=el('output','ef-value','1,0×');zoomBox.append(minus,range,plus,value);controls.append(format,zoomBox);
      const reset=el('button','ef-reset','Centralizar foto');reset.type='button';const footer=el('footer','ef-footer'),cancel=el('button','ef-cancel','Cancelar'),save=el('button','ef-save','Usar esta foto');cancel.type=save.type='button';footer.append(cancel,save);main.append(help,stage,controls,reset);d.append(head,main,footer);document.body.append(d);
      let ratio=options.aspect||original,w=1,h=1,scale=1,x=0,y=0,z=1,finished=false;const pointers=new Map();let pinch=null;
      function clamp(){const maxX=Math.max(0,(img.width*scale-w)/2),maxY=Math.max(0,(img.height*scale-h)/2);x=Math.max(-maxX,Math.min(maxX,x));y=Math.max(-maxY,Math.min(maxY,y));}
      function paint(){scale=Math.max(w/img.width,h/img.height)*z;clamp();const ctx=cv.getContext('2d');ctx.clearRect(0,0,w,h);ctx.imageSmoothingQuality='high';ctx.drawImage(img,(w-img.width*scale)/2+x,(h-img.height*scale)/2+y,img.width*scale,img.height*scale);value.value=z.toFixed(1).replace('.',',')+'×';range.value=String(z);}
      function size(){const maxW=Math.max(180,main.clientWidth-40),maxH=Math.max(170,Math.min(420,innerHeight*.43));w=Math.round(Math.min(maxW,maxH*ratio));h=Math.round(w/ratio);cv.width=w;cv.height=h;stage.style.width=w+'px';stage.style.height=h+'px';paint();}
      const zoom=next=>{z=Math.max(1,Math.min(4,next));paint();};range.oninput=()=>zoom(Number(range.value));minus.onclick=()=>zoom(z-.15);plus.onclick=()=>zoom(z+.15);reset.onclick=()=>{z=1;x=y=0;paint();};select.onchange=()=>{ratio=select.value==='original'?original:Number(select.value);z=1;x=y=0;size();};
      stage.onpointerdown=e=>{e.preventDefault();stage.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2){const [a,b]=[...pointers.values()];pinch={distance:Math.hypot(a.x-b.x,a.y-b.y),zoom:z};}};
      stage.onpointermove=e=>{const old=pointers.get(e.pointerId);if(!old)return;e.preventDefault();pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2&&pinch){const [a,b]=[...pointers.values()];zoom(pinch.zoom*Math.hypot(a.x-b.x,a.y-b.y)/Math.max(1,pinch.distance));}else{x+=e.clientX-old.x;y+=e.clientY-old.y;paint();}};
      stage.onpointerup=stage.onpointercancel=e=>{pointers.delete(e.pointerId);pinch=null;};stage.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();x+=e.key==='ArrowLeft'?-12:e.key==='ArrowRight'?12:0;y+=e.key==='ArrowUp'?-12:e.key==='ArrowDown'?12:0;paint();};
      function finish(result){if(finished)return;finished=true;observer.disconnect();img.close?.();d.close();d.remove();ocupado=false;resolve(result);}
      const observer=new ResizeObserver(()=>size());close.onclick=cancel.onclick=()=>finish(null);d.oncancel=e=>{e.preventDefault();finish(null);};
      save.onclick=()=>{save.disabled=true;const sw=w/scale,sh=h/scale,sx=(img.width-sw)/2-x/scale,sy=(img.height-sh)/2-y/scale;const factor=Math.min(1,(options.max||1600)/Math.max(sw,sh));const out=document.createElement('canvas');out.width=Math.max(1,Math.round(sw*factor));out.height=Math.max(1,Math.round(sh*factor));const ctx=out.getContext('2d');ctx.imageSmoothingQuality='high';ctx.drawImage(img,sx,sy,sw,sh,0,0,out.width,out.height);const mime=options.tipo||(file.type==='image/png'?'image/png':'image/jpeg');out.toBlob(blob=>{if(!blob){save.disabled=false;return;}const ext=mime==='image/png'?'png':'jpg';finish(new File([blob],file.name.replace(/\.[^.]+$/,'')+'.'+ext,{type:mime}));},mime,.9);};
      d.showModal();size();observer.observe(main);save.focus({preventScroll:true});
    });
  }
  window.EditorFoto={abrir};
})();
