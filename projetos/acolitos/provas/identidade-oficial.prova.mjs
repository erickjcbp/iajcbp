import assert from 'node:assert/strict';
import fs from 'node:fs';
import {iniciarProvas,PAPEIS} from './abrir-tela.mjs';
const dir=new URL('../../../estudos/medalhoes-integracao-2026-11-01/provas-hero-compacto/',import.meta.url).pathname;fs.mkdirSync(dir,{recursive:true});
const p=await iniciarProvas();
try{for(const largura of [360,390,768,1366,2560]){
 const r=await p.abrir('index.html',{papel:{...PAPEIS.membro,nivel:'acolito_sentinela'},largura,altura:1000,tabelas:{acolitos_casas:{data:[{id:'c1',slug:'sanctaris'}]}},rpcs:{acolitos_tempo_marcos_lote:{data:{m1:{label:'Raiz da Pastoral',icone:'tempo_raiz',tier:'ouro',marco:'3'}}}},avaliar:`
 await renderDashboardMembro({membership:{role:'membro'},user:{email:'teste'},membro:{id:'m1',nome:'Pessoa de Teste',nivel:'acolito_sentinela',serve:true,casa_id:'c1',servindo_desde:'2023-01-01'}});
 const avatar=document.querySelector('.jornada-hero .avatar-oficial');
 if(!avatar)return {hero:false};
 await new Promise(r=>setTimeout(r,300));document.getElementById('splash')?.remove();document.getElementById('pwa-banner')?.remove();
 const slots=[...avatar.querySelectorAll('.avatar-nivel,.avatar-casa,.avatar-tempo')].map(e=>{const b=e.getBoundingClientRect();return [Math.round(b.width),Math.round(b.height)]});
 const slugs=['aspirante','coroinha','acolito_aspirante','acolito_guardiao','acolito_sentinela','aspirante_cerimoniario','cerimoniario_aspirante','cerimoniario_guardiao','cerimoniario_magistral','cerimoniario_mor'];
 const artes=slugs.map(s=>getNivelSvg(s,80));
 const anim=getComputedStyle(avatar.querySelector('.av-energy')).animationName;
 const feixe=getComputedStyle(avatar.querySelector('.avatar-nivel'),'::before');const heroRect=document.querySelector('.jornada-hero').getBoundingClientRect();const rect=avatar.getBoundingClientRect();return {altura:heroRect.height,feixe:feixe.animationName,orbita:Number(getComputedStyle(avatar.querySelector('.mt-orbit')).opacity),hero:true,size:rect.width,slots,artes,anim,overflow:document.documentElement.scrollWidth>innerWidth+1,mainWidth:document.querySelector('.jornada-hero').getBoundingClientRect().width};`,foto:{caminho:dir+'jornada-'+largura+'.png'}});
 assert.deepEqual(r.erros,[]);assert.equal(r.erroAvaliar,null);assert.equal(r.avaliado.hero,true,'Minha Jornada precisa do avatar hero');
 assert.equal(r.avaliado.size,largura<640?112:largura<1000?140:largura<1900?160:180);assert.ok(r.avaliado.altura<310,'Hero ocupa altura excessiva');assert.equal(r.avaliado.feixe,'nivelRays');assert.ok(r.avaliado.orbita<.3);assert.equal(r.avaliado.slots.length,3);assert.ok(r.avaliado.slots.every(([w,h])=>w===h&&w===r.avaliado.slots[0][0]));
 assert.ok(r.avaliado.artes.every(a=>a.includes('/identidade-oficial/brasoes/')&&a.includes('rank-art')));assert.notEqual(r.avaliado.anim,'none');assert.equal(r.avaliado.overflow,false);
 if(largura===2560)assert.ok(r.avaliado.mainWidth>2000);console.log('Identidade oficial / hero / slots / movimento / largura',largura,'OK');
 }
 for(const largura of [390,2560]){
 const pop=await p.abrir('index.html',{papel:PAPEIS.membro,largura,altura:900,rpcs:{acolitos_medalhas_catalogo:{data:[{id:'tempo',label:'Coluna do Altar',icone:'tempo_altar',tier:'onix',desc:'Cinco anos de serviço',requisito:'Complete 5 anos de pastoral',manutencao:'Reconhecimento permanente'}]}},avaliar:`
 document.getElementById('splash')?.remove();await showMedalha({medalha_id:'tempo',icone:'tempo_altar',tier:'onix',label:'Coluna do Altar',xp:70});
 await new Promise(r=>setTimeout(r,800));const popup=document.querySelector('.medalha-celeb');const orbit=popup.querySelector('.mt-orbit');const rect=orbit.getBoundingClientRect();return {texto:popup.innerText,clip:popup.querySelector('image').getAttribute('href'),circle:Math.abs(rect.width-rect.height)<1,overflow:document.documentElement.scrollWidth>innerWidth+1};`,foto:{caminho:dir+'conquista-'+largura+'.png'}});
 assert.equal(pop.erroAvaliar,null);assert.deepEqual(pop.erros,[]);assert.match(pop.avaliado.texto,/70 XP/);assert.match(pop.avaliado.clip,/identidade-oficial/);assert.equal(pop.avaliado.circle,true);assert.equal(pop.avaliado.overflow,false);console.log('Celebração de tempo / XP / atlas / círculo',largura,'OK');
 }
 const r=await p.abrir('index.html',{papel:PAPEIS.membro,avaliar:`
 tempoMarcosCache.clear();let resolver,calls=0;
 sb.rpc=async(nome,args)=>{if(nome!=='acolitos_tempo_marcos_lote')return {data:null};calls++;if(calls===1)return new Promise(r=>resolver=r);return {data:{race:{label:'Veterano',icone:'tempo_veterano',tier:'rubi'}}};};
 const lista=document.createElement('div');document.body.append(lista);
 for(let i=0;i<12;i++)lista.append(buildAvatarEl(null,'membro',44,{nivelSlug:'coroinha',tempoMembroId:'race'}));
 await new Promise(r=>setTimeout(r,0));const primeiro=calls;
 atualizarMarcosTempo(['race']);resolver({data:{race:{label:'Primeira Chama',icone:'tempo_chama',tier:'bronze'}}});
 await new Promise(r=>setTimeout(r,300));
 const marcos=[...lista.querySelectorAll('.medalhao-tempo')].map(e=>e.dataset.marco);
 const total=calls;let erros=0;sb.rpc=async()=>{erros++;return {error:{message:'offline'}}};
 const a=buildAvatarEl(null,'membro',44,{tempoMembroId:'falha'});lista.append(a);await new Promise(r=>setTimeout(r,0));
 const b=buildAvatarEl(null,'membro',44,{tempoMembroId:'falha'});lista.append(b);await new Promise(r=>setTimeout(r,0));
 lista.remove();return {primeiro,total,marcos,erros};`});
 assert.equal(r.erroAvaliar,null);assert.equal(r.avaliado.primeiro,1,'Doze avatares fazem uma consulta');assert.equal(r.avaliado.total,2);assert.deepEqual(r.avaliado.marcos,Array(12).fill('V'),'Resposta antiga sobrescreveu concessão manual');assert.equal(r.avaliado.erros,2,'Falha precisa permitir nova tentativa');console.log('Lote, corrida de concessão manual e recuperação offline OK');
}finally{await p.encerrar()}
