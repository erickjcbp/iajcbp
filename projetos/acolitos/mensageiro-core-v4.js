/* Rota aberta determinística a60Hz, compartilhada pelo navegador e servidor. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MensageiroCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const VERSION=4,MAX_TICKS=36000,GOAL=1500,ACTIONS=['left','right','jump','slide','stop'];
function create(seed){return {seed:seed>>>0,rng:seed>>>0,tick:0,lane:1,jump:0,slide:0,hits:0,invincible:0,scrolls:0,combo:0,bestCombo:0,score:0,bonus:0,penalty:0,allies:0,stage:0,meters:0,distance:0,travel:0,deliveries:0,lastWater:0,waterCount:0,lastSafe:1,spawnCountdown:150,nextRow:0,nextId:0,lastWarning:-100,done:false,won:false,stopped:false,objects:[],events:[]};}
function random(s){s.rng=(Math.imul(s.rng,1664525)+1013904223)>>>0;return s.rng/4294967296;}
function difficulty(distance){const stage=distance<300?0:distance<700?1:distance<1100?2:distance<1500?3:4+Math.floor((distance-1500)/250),extra=Math.max(0,stage-4);return {stage,speed:stage<4?[.0065,.0076,.0088,.0100][stage]:Math.min(.0135,.0107+extra*.00035),interval:stage<4?[100,86,72,60][stage]:Math.max(44,56-extra*2),double:stage<4?[0,.25,.55,.75][stage]:Math.min(.95,.85+extra*.015),moving:stage<3?0:Math.min(.6,.25+Math.max(0,stage-3)*.04),rest:distance>=300&&(distance-300)%400<45};}
function spawn(s,d){
 const neighbors=[0,1,2].filter(l=>Math.abs(l-s.lastSafe)===1),safe=random(s)<(d.stage? .2:.6)?s.lastSafe:neighbors[Math.floor(random(s)*neighbors.length)];s.lastSafe=safe;
 const blocked=[0,1,2].filter(l=>l!==safe),count=random(s)<d.double?2:1,row=s.nextRow++,start=Math.floor(random(s)*2);let moved=false;
 for(let i=0;i<count;i++){const lane=blocked[(start+i)%2],r=random(s),kind=r<.28?'guard':r<.53?'crate':r<.78?'barrier':'arch',o={id:s.nextId++,row,safeLane:safe,lane,z:0,kind};
  if(kind==='guard'&&!moved&&random(s)<d.moving){const from=[0,1,2].filter(l=>Math.abs(l-lane)===1);o.fromLane=from[Math.floor(random(s)*from.length)];o.targetLane=lane;o.lane=o.fromLane;o.moveAt=.25;o.moveEnd=.45;moved=true;}s.objects.push(o);
 }
 const risky=d.stage>=2&&random(s)<.25?s.objects.find(o=>o.row===row&&['barrier','arch'].includes(o.kind)):null;
 s.objects.push({id:s.nextId++,row,safeLane:safe,lane:risky?risky.lane:safe,z:-.12,kind:'scroll'});
 const gift=random(s),water=s.hits>0&&s.distance-s.lastWater>=600&&s.waterCount<2+Math.floor(s.distance/1500)&&gift<.08;
 if(water){s.lastWater=s.distance;s.waterCount++;}
 s.objects.push({id:s.nextId++,row,safeLane:safe,lane:safe,z:-.30,kind:water?'water':gift<.24?'ally':'scroll'});
}
function step(s,action){
 if(s.done)return s;s.events=[];
 if(action==='stop'){s.tick++;s.done=true;s.stopped=true;s.events.push('end');return s;}
 if(action==='left')s.lane=Math.max(0,s.lane-1);if(action==='right')s.lane=Math.min(2,s.lane+1);
 if(action==='jump'&&!s.jump&&!s.slide){s.jump=48;s.events.push('jump');}if(action==='slide'&&!s.jump&&!s.slide){s.slide=42;s.events.push('slide');}
 const d=difficulty(s.distance);s.tick++;s.jump=Math.max(0,s.jump-1);s.slide=Math.max(0,s.slide-1);s.invincible=Math.max(0,s.invincible-1);
 if(d.stage!==s.stage){s.stage=d.stage;s.events.push('stage');}s.rest=d.rest;s.spawnCountdown--;
 if(d.rest)s.spawnCountdown=Math.max(30,s.spawnCountdown);else if(s.spawnCountdown<=0){spawn(s,d);s.spawnCountdown=d.interval;}
 for(const o of s.objects){const prev=o.z;o.z+=d.speed;
  if(o.fromLane!=null){if(prev<.08&&o.z>=.08&&s.tick-s.lastWarning>=60){s.events.push('warning');s.lastWarning=s.tick;}if(o.z>=o.moveEnd)o.lane=o.targetLane;}
  if(prev<1&&o.z>=1&&o.lane===s.lane){
   if(o.kind==='scroll'){s.scrolls++;s.combo++;s.bestCombo=Math.max(s.bestCombo,s.combo);s.events.push('collect');if(s.combo%5===0)s.events.push('combo');}
   else if(o.kind==='ally'){s.allies++;s.bonus+=50;s.combo++;s.bestCombo=Math.max(s.bestCombo,s.combo);s.events.push('ally');}
   else if(o.kind==='water'){s.hits=Math.max(0,s.hits-1);s.events.push('water');}
   else if(!(o.kind==='barrier'&&s.jump>4)&&!(o.kind==='arch'&&s.slide>3)&&!s.invincible){s.hits++;s.combo=0;s.penalty+=o.kind==='guard'?40:20;s.invincible=72;s.events.push('hit');if(o.kind==='guard')s.events.push('guard');}
  }
 }
 s.objects=s.objects.filter(o=>o.z<1.18);s.meters+=d.speed/.0065/6;s.distance=Math.floor(s.meters);s.travel+=12.6*d.speed;
 const deliveries=s.distance<GOAL?0:1+Math.floor((s.distance-GOAL)/1000);if(deliveries>s.deliveries){s.deliveries=deliveries;s.won=true;s.events.push('delivery');}
 s.score=Math.max(0,s.distance+s.scrolls*10+s.bonus+Math.min(s.bestCombo,20)*5-s.penalty);
 if(s.hits>=3||s.tick>=MAX_TICKS){s.done=true;s.events.push(s.won&&s.hits<3?'win':'end');}return s;
}
function reward(s){if(s.tick<600)return 0;return Math.min(20,Math.floor(s.tick/600)*2+Math.floor(s.scrolls/5)+(s.deliveries?5:0));}
function replay(seed,commands,ticks){
 if(!Number.isInteger(seed)||seed<0||seed>4294967295||!Number.isInteger(ticks)||ticks<1||ticks>MAX_TICKS||!Array.isArray(commands)||commands.length>MAX_TICKS)throw Error('Partida inválida.');
 let prev=-1;for(const c of commands){if(!Array.isArray(c)||c.length!==2||!Number.isInteger(c[0])||c[0]<=prev||c[0]>=ticks||!ACTIONS.includes(c[1]))throw Error('Comandos inválidos.');prev=c[0];}
 const s=create(seed);let j=0;while(s.tick<ticks&&!s.done){const a=commands[j]?.[0]===s.tick?commands[j++][1]:null;step(s,a);}if(s.tick!==ticks)throw Error('Duração inválida.');return {done:s.done,tick:s.tick,score:s.score,scrolls:s.scrolls,hits:s.hits,won:s.won,distance:s.distance,deliveries:s.deliveries,xp:reward(s)};
}
return {VERSION,MAX_TICKS,GOAL,ACTIONS,create,step,difficulty,reward,replay};
});
