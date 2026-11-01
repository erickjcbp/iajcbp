import assert from 'node:assert/strict';import fs from 'node:fs';import {iniciarProvas,PAPEIS} from './abrir-tela.mjs';
const dir=new URL('../../../estudos/medalhoes-integracao-2026-11-01/provas-modal-seguro/',import.meta.url).pathname;fs.mkdirSync(dir,{recursive:true});
const p=await iniciarProvas();try{for(const largura of [360,390,768,1366,2560]){
 const r=await p.abrir('index.html',{papel:PAPEIS.membro,largura,altura:900,rpcs:{acolitos_medalhas_catalogo:{data:[{id:'teste',icone:'tempo_veterano',tier:'rubi',label:'Veterano',desc:'Uma história de constância, cuidado e dedicação ao altar.',requisito:'Mais de 5 anos de pastoral e nível Cerimoniário Aspirante ou superior.',manutencao:'Reconhecimento pelo tempo de serviço registrado. Sem renovação periódica.',xp:100}]}},avaliar:`
 document.getElementById('splash')?.remove();document.getElementById('pwa-banner')?.remove();
 await abrirDetalheInsignia('medalha','tempo_veterano',{nivel:'cerimoniario_guardiao',casa:'sanctaris',icone:'tempo_veterano'});
 const ov=document.querySelector('.insignia-detalhe-overlay'),md=ov.querySelector('.insignia-detalhe');
 for(const [lado,valor] of Object.entries({top:28,bottom:22,left:12,right:14}))ov.style.setProperty('--insignia-safe-'+lado,valor+'px');
 const corpo=md.querySelector('.insignia-corpo'),close=md.querySelector('.modal-close'),footer=md.querySelector('footer button');
 const before={close:close.getBoundingClientRect().top,footer:footer.getBoundingClientRect().bottom};
 const emit=(type,props={})=>{const e=type==='wheel'?new WheelEvent(type,{bubbles:true,cancelable:true,...props}):type==='keydown'?new KeyboardEvent(type,{bubbles:true,cancelable:true,...props}):new Event(type,{bubbles:true,cancelable:true});if(props.touches)Object.defineProperty(e,'touches',{value:props.touches});md.dispatchEvent(e);return e.defaultPrevented;};
 const bloqueios={pinch:emit('touchmove',{touches:[{},{}]}),gesto:emit('gesturechange'),duplo:emit('dblclick'),wheelZoom:emit('wheel',{ctrlKey:true,deltaY:40}),atalho:emit('keydown',{ctrlKey:true,key:'+'}),scroll:emit('wheel',{deltaY:40}),toqueSimples:emit('touchmove',{touches:[{}]})};
 const img=md.querySelector('.medalhao-tempo');const arte=img.getBoundingClientRect();const touch=getComputedStyle(img).touchAction;
 const check={top:close.getBoundingClientRect().top,left:md.querySelector('header h2').getBoundingClientRect().left,right:innerWidth-close.getBoundingClientRect().right,bottom:innerHeight-footer.getBoundingClientRect().bottom};
 const stress=document.createElement('p');stress.textContent='Texto de leitura para verificar a rolagem protegida. '.repeat(300);md.querySelector('.insignia-info').append(stress);corpo.scrollTop=corpo.scrollHeight;
 const fixo=Math.abs(before.close-close.getBoundingClientRect().top)<1&&Math.abs(before.footer-footer.getBoundingClientRect().bottom)<1;stress.remove();corpo.scrollTop=0;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
 const bounds=md.getBoundingClientRect();const conteudoSeguro=[...md.querySelectorAll('.insignia-arte,.insignia-info,.medalha-condicao')].every(el=>{const b=el.getBoundingClientRect();return b.left-bounds.left>=28&&bounds.right-b.right>=30;});const semSobreposicao=innerWidth>=640||md.querySelector('.insignia-arte').getBoundingClientRect().bottom+20<=md.querySelector('.insignia-info').getBoundingClientRect().top;
 return {conteudoSeguro,semSobreposicao,bloqueios,touch,check,fixo,viewport:document.querySelector('meta[name=viewport]').content,ratio:Math.abs(arte.width-arte.height)<1,scroll:corpo.scrollHeight>=corpo.clientHeight,overflow:document.documentElement.scrollWidth>innerWidth+1,dialogOverflow:md.scrollWidth>md.clientWidth+1,small:[...md.querySelectorAll('button')].filter(b=>{const r=b.getBoundingClientRect();return r.width>0&&r.height<44}).length};`,foto:{caminho:dir+'veterano-'+largura+'.png',viewport:true}});
 assert.equal(r.erroAvaliar,null);assert.deepEqual(r.erros,[]);const a=r.avaliado;assert.equal(a.conteudoSeguro,true,'Conteúdo deve respeitar a margem segura');assert.equal(a.semSobreposicao,true,'Arte e explicação não podem se sobrepor');assert.equal(a.overflow,false);assert.equal(a.dialogOverflow,false);assert.equal(a.ratio,true);assert.equal(a.fixo,true);assert.equal(a.small,0);assert.equal(a.touch,'pan-y');assert.match(a.viewport,/maximum-scale=1/);
 for(const k of ['pinch','gesto','duplo','wheelZoom','atalho'])assert.equal(a.bloqueios[k],true,k);assert.equal(a.bloqueios.scroll,false);assert.equal(a.bloqueios.toqueSimples,false);
 assert.ok(a.check.top>=44);assert.ok(a.check.left>=28);assert.ok(a.check.right>=28);assert.ok(a.check.bottom>=34);console.log('Área segura, zoom bloqueado, rolagem e controles fixos',largura,'OK');
}
 const rapid=await p.abrir('index.html',{papel:PAPEIS.membro,largura:390,avaliar:`
 document.getElementById('splash')?.remove();const antes=location.href;
 for(let i=0;i<8;i++){await abrirDetalheInsignia('nivel','aspirante');document.querySelector('.insignia-detalhe .modal-close').click();}
 await new Promise(r=>setTimeout(r,350));await abrirDetalheInsignia('nivel','coroinha');return {mesmaPagina:location.href===antes,aberto:!!document.querySelector('.insignia-detalhe')};`});
 assert.equal(rapid.erroAvaliar,null,JSON.stringify(rapid));assert.deepEqual(rapid.avaliado,{mesmaPagina:true,aberto:true});console.log('Trocas rápidas de detalhes preservam a página OK');
}finally{await p.encerrar()}
