/* Física a 60 Hz: o mesmo código roda no navegador e na validação do servidor. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MensageiroCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const VERSION=3,MAX_TICKS=5400,ACTIONS=['left','right','jump','slide'];
function create(seed){return {seed:seed>>>0,rng:seed>>>0,tick:0,lane:1,jump:0,slide:0,hits:0,invincible:0,scrolls:0,combo:0,bestCombo:0,score:0,bonus:0,penalty:0,allies:0,stage:0,lastWater:0,distance:0,done:false,won:false,objects:[],nextId:0,events:[]};}
function random(s){s.rng=(Math.imul(s.rng,1664525)+1013904223)>>>0;return s.rng/4294967296;}
function difficulty(tick){const stage=Math.min(2,Math.floor(tick/1800));return {stage,interval:[90,66,48][stage],speed:[.0065,.008,.0095][stage]};}
function step(s,action){
 if(s.done)return s;s.events=[];
 if(action==='left')s.lane=Math.max(0,s.lane-1);
 if(action==='right')s.lane=Math.min(2,s.lane+1);
 if(action==='jump'&&!s.jump&&!s.slide){s.jump=48;s.events.push('jump');}
 if(action==='slide'&&!s.jump&&!s.slide){s.slide=42;s.events.push('slide');}
 s.tick++;s.jump=Math.max(0,s.jump-1);s.slide=Math.max(0,s.slide-1);s.invincible=Math.max(0,s.invincible-1);
 const d=difficulty(s.tick),interval=d.interval;if(d.stage!==s.stage){s.stage=d.stage;s.events.push('stage');}
 if(s.tick>120&&s.tick%interval===0){
  const lane=Math.floor(random(s)*3),roll=random(s),kind=roll<.28?'guard':roll<.53?'crate':roll<.77?'barrier':'arch';
  s.objects.push({id:s.nextId++,lane,z:0,kind});
  const safe=(lane+1+Math.floor(random(s)*2))%3;
  s.objects.push({id:s.nextId++,lane:safe,z:-.12,kind:'scroll'});
  const gift=random(s),water=gift<.05&&s.tick-s.lastWater>=900;if(water)s.lastWater=s.tick;s.objects.push({id:s.nextId++,lane:safe,z:-.36,kind:water?'water':gift<.36?'ally':'scroll'});
 }
 for(const o of s.objects){
  const prev=o.z;o.z+=d.speed;
  if(prev<1&&o.z>=1&&o.lane===s.lane){
   if(o.kind==='scroll'){s.scrolls++;s.combo++;s.bestCombo=Math.max(s.bestCombo,s.combo);s.events.push('collect');if(s.combo%5===0)s.events.push('combo');}
   else if(o.kind==='ally'){s.allies++;s.bonus+=50;s.combo++;s.bestCombo=Math.max(s.bestCombo,s.combo);s.events.push('ally');}
   else if(o.kind==='water'){const hurt=s.hits>0;s.hits=Math.max(0,s.hits-1);s.bonus+=hurt?0:15;s.events.push('water');}
   else if(!(o.kind==='barrier'&&s.jump>4)&&!(o.kind==='arch'&&s.slide>3)&&!s.invincible){s.hits++;s.combo=0;s.penalty+=o.kind==='guard'?40:20;s.invincible=72;s.events.push('hit');if(o.kind==='guard')s.events.push('guard');}
  }
 }
 s.objects=s.objects.filter(o=>o.z<1.18);s.distance=Math.floor(s.tick/6);s.score=Math.max(0,s.distance+s.scrolls*10+s.bonus+Math.min(s.bestCombo,20)*5-s.penalty);
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
return {VERSION,MAX_TICKS,ACTIONS,difficulty,create,step,reward,replay};
});
