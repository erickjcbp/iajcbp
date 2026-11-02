/* Física a 60 Hz: o mesmo código roda no navegador e na validação do servidor. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MensageiroCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const VERSION=1,MAX_TICKS=5400,ACTIONS=['left','right','jump','slide'];
function create(seed){return {seed:seed>>>0,rng:seed>>>0,tick:0,lane:1,jump:0,slide:0,hits:0,invincible:0,scrolls:0,combo:0,bestCombo:0,score:0,distance:0,done:false,won:false,objects:[],nextId:0,events:[]};}
function random(s){s.rng=(Math.imul(s.rng,1664525)+1013904223)>>>0;return s.rng/4294967296;}
function step(s,action){
 if(s.done)return s;s.events=[];
 if(action==='left')s.lane=Math.max(0,s.lane-1);
 if(action==='right')s.lane=Math.min(2,s.lane+1);
 if(action==='jump'&&!s.jump&&!s.slide){s.jump=48;s.events.push('jump');}
 if(action==='slide'&&!s.jump&&!s.slide){s.slide=42;s.events.push('slide');}
 s.tick++;s.jump=Math.max(0,s.jump-1);s.slide=Math.max(0,s.slide-1);s.invincible=Math.max(0,s.invincible-1);
 const interval=Math.max(44,90-Math.floor(s.tick/180));
 if(s.tick>120&&s.tick%interval===0){
  const lane=Math.floor(random(s)*3),roll=random(s),kind=roll<.35?'crate':roll<.68?'barrier':'arch';
  s.objects.push({id:s.nextId++,lane,z:0,kind});
  const safe=(lane+1+Math.floor(random(s)*2))%3;
  s.objects.push({id:s.nextId++,lane:safe,z:-.12,kind:'scroll'});
  s.objects.push({id:s.nextId++,lane:safe,z:-.28,kind:'scroll'});
 }
 for(const o of s.objects){
  const prev=o.z;o.z+=.006+s.tick*.00000065;
  if(prev<1&&o.z>=1&&o.lane===s.lane){
   if(o.kind==='scroll'){s.scrolls++;s.combo++;s.bestCombo=Math.max(s.bestCombo,s.combo);s.events.push('collect');}
   else if(!(o.kind==='barrier'&&s.jump>4)&&!(o.kind==='arch'&&s.slide>3)&&!s.invincible){s.hits++;s.combo=0;s.invincible=72;s.events.push('hit');}
  }
 }
 s.objects=s.objects.filter(o=>o.z<1.18);s.distance=Math.floor(s.tick/6);s.score=s.distance+s.scrolls*10+Math.min(s.bestCombo,20)*5;
 if(s.hits>=3||s.tick>=MAX_TICKS){s.done=true;s.won=s.hits<3&&s.tick>=MAX_TICKS;s.events.push(s.won?'win':'end');}
 return s;
}
function reward(s){if(s.tick<600)return 0;return Math.min(20,Math.floor(s.tick/600)*2+Math.floor(s.scrolls/5)+(s.won?5:0));}
function replay(seed,commands,ticks){
 if(!Number.isInteger(seed)||seed<0||seed>4294967295||!Number.isInteger(ticks)||ticks<1||ticks>MAX_TICKS||!Array.isArray(commands)||commands.length>MAX_TICKS)throw Error('Partida inválida.');
 let prev=-1;for(const c of commands){if(!Array.isArray(c)||c.length!==2||!Number.isInteger(c[0])||c[0]<=prev||c[0]>=ticks||!ACTIONS.includes(c[1]))throw Error('Comandos inválidos.');prev=c[0];}
 const s=create(seed);let j=0;while(s.tick<ticks&&!s.done){const a=commands[j]?.[0]===s.tick?commands[j++][1]:null;step(s,a);}
 if(s.tick!==ticks)throw Error('Duração inválida.');return {done:s.done,tick:s.tick,score:s.score,scrolls:s.scrolls,hits:s.hits,won:s.won,xp:reward(s)};
}
return {VERSION,MAX_TICKS,ACTIONS,create,step,reward,replay};
});
