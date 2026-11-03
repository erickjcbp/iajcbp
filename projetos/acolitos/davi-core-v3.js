/* Motor fixo a60Hz: navegador e servidor reproduzem os mesmos comandos. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.DaviCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const VERSION=8,MAX_TICKS=36000,HERO={x:500,y:880};
const SHEEP=[[380,600],[490,575],[610,610],[440,695],[565,700]];
function create(seed){return {seed:seed>>>0,rng:seed>>>0,tick:0,wave:0,cleared:0,alive:5,sheep:SHEEP.map(([x,y],id)=>({id,x,y,homeX:x,homeY:y,alive:true,captor:null,safe:0,returning:false})),enemies:[],stones:[],effects:[],charge:-1,cooldown:0,spawnIn:90,remaining:0,rest:90,nextId:0,score:0,repelled:0,rescues:0,shots:0,hits:0,combo:0,bestCombo:0,lastHit:-999,lions:0,events:[],done:false,stopped:false};}
function random(s){s.rng=(Math.imul(s.rng,1664525)+1013904223)>>>0;return s.rng/4294967296;}
function difficulty(wave){return {count:Math.min(22,3+wave),speed:Math.min(3.7,.6+wave*.12),interval:Math.max(38,150-wave*8),max:Math.min(7,2+Math.floor(wave/3))};}
function spawn(s){const d=difficulty(s.wave),first=s.remaining===d.count,bear=first&&s.wave%10===0,lion=!bear&&s.lions<2&&(first&&s.wave%3===0||s.wave>=5&&random(s)<Math.min(.18,.06+s.wave*.008)),kind=bear?'bear':lion?'lion':random(s)<Math.min(.7,.1+s.wave*.07)?'wolf':'fox',hp={fox:1,wolf:2,lion:6,bear:8}[kind];if(lion)s.lions++;const edge=Math.floor(random(s)*3),e={id:s.nextId++,kind,x:edge===0?-70:edge===1?1070:100+random(s)*800,y:edge===2?-70:60+random(s)*300,hp,maxHp:hp,speed:d.speed*(bear||lion?.68:kind==='fox'?1.2:1),vx:0,vy:0,target:-1,carry:-1,phase:'hunt',edge,flash:0,stun:0,walk:0};s.enemies.push(e);s.remaining--;s.events.push(bear||lion?'boss':'spawn');}
function release(s,e){if(e.carry<0)return;const a=s.sheep[e.carry];if(a?.alive&&a.captor===e.id){a.captor=null;a.returning=true;a.safe=150;s.rescues++;s.events.push('rescue');s.effects.push({x:a.x,y:a.y,life:35,kind:'rescue'});if(!e.rescueRewarded){s.score+=75;e.rescueRewarded=true;}}e.carry=-1;e.target=-1;e.phase='hunt';e.stun=18;}
function moveSheep(s){for(const a of s.sheep){a.safe=Math.max(0,a.safe-1);if(!a.alive||a.captor!=null||!a.returning)continue;const dx=a.homeX-a.x,dy=a.homeY-a.y,len=Math.hypot(dx,dy);if(len<4){a.x=a.homeX;a.y=a.homeY;a.returning=false;}else{a.x+=dx/len*4;a.y+=dy/len*4;}}}
function moveEnemy(s,e){e.flash=Math.max(0,e.flash-1);if(e.stun>0){e.stun--;e.vx=0;e.vy=0;return;}
 let dx,dy,speed=e.speed;
 if(e.carry>=0){dx=e.escapeX-e.x;dy=e.escapeY-e.y;speed*=({fox:1.75,wolf:1.7,lion:1.6,bear:1.5}[e.kind]);}
 else{const candidates=s.sheep.filter(a=>a.alive&&a.captor==null&&!a.safe);if(!candidates.length){e.vx=0;e.vy=0;return;}let a=s.sheep[e.target];if(!a?.alive||a.captor!=null||a.safe){a=candidates.reduce((a,b)=>Math.hypot(a.x-e.x,a.y-e.y)<Math.hypot(b.x-e.x,b.y-e.y)?a:b);e.target=a.id;}dx=a.x-e.x;dy=a.y-e.y;}
 const len=Math.hypot(dx,dy);e.vx=dx/Math.max(1,len)*speed;e.vy=dy/Math.max(1,len)*speed;e.x+=e.vx;e.y+=e.vy;e.walk+=speed;
 if(e.carry>=0){const a=s.sheep[e.carry];a.x=e.x-e.vx/speed*40;a.y=e.y-e.vy/speed*40+6;if(e.x<-85||e.x>1085||e.y<-85){a.alive=false;a.captor=null;s.alive--;e.gone=true;s.combo=0;s.events.push('lost');s.effects.push({x:Math.max(20,Math.min(980,e.x)),y:Math.max(20,e.y),life:30,kind:'lost'});}}
 else if(len<35){const a=s.sheep[e.target];a.captor=e.id;a.returning=false;e.carry=a.id;e.phase='flee';e.escapeX=e.edge===0?-120:e.edge===1?1120:Math.max(80,Math.min(920,e.x));e.escapeY=e.edge===2?-120:e.y;e.stun=6;s.events.push('capture');}
}
function shot(s,x,y){if(s.charge<0||s.cooldown)return;s.charge=-1;const dx=x-HERO.x,dy=y-(HERO.y-25),len=Math.hypot(dx,dy);if(len<60)return;const duration=Math.max(12,Math.ceil(len/18)),power=1+Math.min(2,Math.floor(len/300));s.stones.push({id:s.nextId++,x:HERO.x,y:HERO.y-25,vx:dx/duration,vy:dy/duration,power,life:duration,duration,targetX:x,targetY:y});s.cooldown=16;s.shots++;s.events.push('shoot');}
function step(s,action){if(s.done)return s;s.events=[];
 if(action?.[0]==='stop'){s.tick++;s.done=true;s.stopped=true;s.events.push('end');return s;}
 if(action?.[0]==='cancel')s.charge=-1;
 if(action?.[0]==='draw'&&s.cooldown===0&&s.charge<0)s.charge=0;
 if(action?.[0]==='shoot')shot(s,action[1],action[2]);
 s.tick++;s.cooldown=Math.max(0,s.cooldown-1);if(s.charge>=0)s.charge=Math.min(48,s.charge+1);
 if(s.rest>0){s.rest--;if(!s.rest){s.wave++;s.lions=0;s.remaining=difficulty(s.wave).count;s.spawnIn=35;s.events.push('wave');}}
 else{const d=difficulty(s.wave);s.spawnIn--;if(s.remaining&&s.spawnIn<=0&&s.enemies.length<d.max){spawn(s);s.spawnIn=d.interval;}if(!s.remaining&&!s.enemies.length){s.cleared=s.wave;s.score+=50+s.wave*10;s.rest=150;s.events.push('clear');if(s.wave===5)s.events.push('milestone');}}
 moveSheep(s);for(const e of s.enemies)moveEnemy(s,e);
 for(const p of s.stones){const px=p.x,py=p.y;p.x+=p.vx;p.y+=p.vy;p.life--;if(p.life>0)continue;s.effects.push({x:p.targetX,y:p.targetY,life:20,kind:'land'});for(const e of s.enemies){if(e.gone)continue;const dx=p.x-px,dy=p.y-py,t=Math.max(0,Math.min(1,((e.x-px)*dx+(e.y-py)*dy)/(dx*dx+dy*dy))),distance=Math.hypot(e.x-(px+dx*t),e.y-(py+dy*t));if(distance>62+(e.kind==='bear'?12:0))continue;e.hp-=p.power;e.flash=8;p.life=0;s.hits++;s.events.push('hit');s.effects.push({x:e.x,y:e.y,life:20,kind:'hit'});e.x-=e.vx*18;e.y-=e.vy*18;release(s,e);if(e.hp<=0){e.gone=true;s.repelled++;s.combo=s.tick-s.lastHit<180?s.combo+1:1;s.lastHit=s.tick;s.bestCombo=Math.max(s.bestCombo,s.combo);s.score+=({fox:30,wolf:50,lion:180,bear:250}[e.kind])+Math.min(10,s.combo)*5;s.events.push('repel');if(s.combo%5===0)s.events.push('combo');}break;}}
 s.stones=s.stones.filter(p=>p.life>0&&p.x>-100&&p.x<1100&&p.y>-150&&p.y<1150);s.enemies=s.enemies.filter(e=>!e.gone);s.effects=s.effects.filter(p=>--p.life>0);
 if(!s.alive||s.tick>=MAX_TICKS){s.done=true;s.charge=-1;s.events.push('end');}return s;}
function reward(s){return s.tick<600?0:Math.min(20,Math.floor(s.tick/600)*2+Math.floor(s.repelled/4)+(s.cleared>=5?5:0));}
function replay(seed,commands,ticks){if(!Number.isInteger(seed)||seed<0||seed>4294967295||!Number.isInteger(ticks)||ticks<1||ticks>MAX_TICKS||!Array.isArray(commands)||commands.length>MAX_TICKS)throw Error('Partida inválida.');let previous=-1;for(const c of commands){if(!Array.isArray(c)||!Number.isInteger(c[0])||c[0]<=previous||c[0]>=ticks||!['draw','shoot','cancel','stop'].includes(c[1])||c.length!==(c[1]==='shoot'?4:2)||c[1]==='shoot'&&(!Number.isInteger(c[2])||!Number.isInteger(c[3])||c[2]<0||c[2]>1000||c[3]<0||c[3]>1000))throw Error('Comandos inválidos.');previous=c[0];}const s=create(seed);let j=0;while(s.tick<ticks&&!s.done){const a=commands[j]?.[0]===s.tick?commands[j++].slice(1):null;step(s,a);}if(s.tick!==ticks)throw Error('Duração inválida.');return {done:s.done,tick:s.tick,score:s.score,cleared:s.cleared,repelled:s.repelled,rescues:s.rescues,alive:s.alive,xp:reward(s)};}
return {VERSION,MAX_TICKS,HERO,create,step,difficulty,reward,replay};});
