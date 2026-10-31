import fs from 'node:fs';
import assert from 'node:assert/strict';
import {iniciarProvas,PAPEIS} from './abrir-tela.mjs';
const catalogo=JSON.parse(fs.readFileSync(new URL('./fixtures/medalhas-catalogo.json',import.meta.url)));
const icones=['samaritano','acolhedor','bastidores','ponte_paz','criacao','escuta','recomecar','palavra_semeada','amigo_todos','memoria'];
const novas=catalogo.filter(b=>icones.includes(b.icone));assert.equal(novas.length,10);assert.ok(novas.every(b=>b.validacao==='avaliada'));
const out=new URL('../../../estudos/medalhas/novas-2026-10-31/',import.meta.url).pathname;
const env=await iniciarProvas();
try {
for(const largura of [390,768,1366,2560]){
const r=await env.abrir('jornada-admin.html',{papel:PAPEIS.admin,largura,rpcs:{acolitos_medalhas_catalogo:{data:novas}},foto:{caminho:out+'artes-'+largura+'.png',seletor:'.medalhas-admin-modal'},avaliar:`document.getElementById('splash')?.remove();await MedalhasAdmin.abrir({sb,membros:[{id:"m1",nome:"Membro de teste",nivel:"coroinha"}]});const imgs=[...document.querySelectorAll('.mg-badge img')];if(imgs.length!==10)throw Error('Sem dez artes');for(const img of imgs){await img.decode();if(img.naturalWidth!==384||img.naturalHeight!==384)throw Error('Dimensões inesperadas');const c=document.createElement('canvas');c.width=384;c.height=384;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);for(const [x,y] of [[0,0],[383,0],[0,383],[383,383]])if(ctx.getImageData(x,y,1,1).data[3]!==0)throw Error('Fundo não transparente');}return imgs.length;`});assert.equal(r.erroAvaliar,null);assert.equal(r.avaliado,10);assert.deepEqual(r.erros,[]);console.log('dez artes e alpha',largura);
}
for(const b of novas){
const r=await env.abrir('conquistas.html',{papel:PAPEIS.membro,largura:390,rpcs:{acolitos_medalhas_catalogo:{data:catalogo}},foto:{caminho:out+'aviso-'+b.icone+'.png',seletor:'.medalha-celeb'},avaliar:`document.getElementById('splash')?.remove();await showMedalha({medalha_id:${JSON.stringify(b.id)},label:${JSON.stringify(b.label)}});const img=document.querySelector('.medalha-celeb img');if(!img||!img.src.endsWith(${JSON.stringify(b.icone+'-ouro.webp')}))throw Error('Aviso sem arte correta');await img.decode();await new Promise(r=>setTimeout(r,1200));return img.naturalWidth;`});assert.equal(r.erroAvaliar,null);assert.equal(r.avaliado,384);assert.deepEqual(r.erros,[]);console.log('aviso',b.label);
}
}finally{await env.encerrar();}
