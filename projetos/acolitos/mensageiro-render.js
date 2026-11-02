const ENCONTROS_FRAMES=[{"x": 65, "y": 0, "w": 174, "h": 370}, {"x": 297, "y": 34, "w": 169, "h": 335}, {"x": 552, "y": 26, "w": 207, "h": 344}, {"x": 814, "y": 65, "w": 170, "h": 292}];
const MENSAGEIRO_ATLAS={"frames":[{"x":54,"y":92,"w":179,"h":288},{"x":327,"y":92,"w":187,"h":280},{"x":625,"y":91,"w":167,"h":288},{"x":895,"y":92,"w":194,"h":282},{"x":43,"y":440,"w":185,"h":283},{"x":328,"y":439,"w":191,"h":270},{"x":595,"y":452,"w":244,"h":234},{"x":865,"y":507,"w":252,"h":191}],"propFrames":[{"x":20,"y":141,"w":214,"h":187},{"x":265,"y":201,"w":283,"h":127},{"x":564,"y":12,"w":324,"h":317},{"x":927,"y":132,"w":145,"h":195}],"runnerWidth":1152,"runnerHeight":768};
/* Tíquico — arte original gerada a partir da direção visual aprovada.
   Atlas, animação e câmera são visuais; a física e o replay permanecem no Core. */
class MensageiroRenderer {
 constructor(canvas){
  this.canvas=canvas;this.ctx=canvas.getContext('2d');this.w=1;this.h=1;this.lane=1;this.assets={};this.failed=[];this.needsRedraw=true;this.scene=new MensageiroCenario();
  this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;this.frames=MENSAGEIRO_ATLAS.frames;this.propFrames=MENSAGEIRO_ATLAS.propFrames;this.runnerHeight=Math.max(...this.frames.slice(0,6).map(f=>f.h));
  this.resize();this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(canvas);
  const base='games-art/mensageiro/';
  this.ready=Promise.all(Object.entries({background:'cidade-ampla-v6.webp',runner:'poses-leve-v3.webp',props:'objetos-leve-v3.webp',encounters:'encontros-v4.webp',guard:'soldado-ataque-v5.webp',road:'piso-natural-v6.webp'}).map(async([key,file])=>{const image=await this.load(base+file);if(image)this.assets[key]=image;else this.failed.push(file);})).then(()=>{this.scene.init(this.assets.road);this.resize();return this.failed.length===0;});
 }
 load(src){return new Promise(resolve=>{const image=new Image();image.decoding='async';const timeout=setTimeout(()=>resolve(null),30000);image.onload=()=>{clearTimeout(timeout);resolve(image);};image.onerror=()=>{clearTimeout(timeout);resolve(null);};image.src=src;});}
 resize(){const r=this.canvas.getBoundingClientRect();this.w=Math.max(1,r.width);this.h=Math.max(1,r.height);this.ratio=Math.min(devicePixelRatio||1,1.5,Math.sqrt(1200000/(this.w*this.h)));this.canvas.width=Math.round(this.w*this.ratio);this.canvas.height=Math.round(this.h*this.ratio);this.ctx.setTransform(this.ratio,0,0,this.ratio,0,0);this.camera=MensageiroCamera.create(this.w,this.h,this.assets.background?.width||1024,this.assets.background?.height||683);this.backgroundCache=null;this.scene.resize(this.canvas.width,this.canvas.height);this.needsRedraw=true;}
 ellipse(x,y,rx,ry,color){const c=this.ctx;c.fillStyle=color;c.beginPath();c.ellipse(x,y,Math.max(0,rx),Math.max(0,ry),0,0,Math.PI*2);c.fill();}
 project(z,lane){return MensageiroCamera.project(this.camera,z,lane);}
 heroSize(){return Math.min(this.w*.26,this.h*.265);}
 background(s){
  const c=this.ctx,w=this.w,h=this.h;
  if(!this.backgroundCache){const buffer=document.createElement('canvas');buffer.width=this.canvas.width;buffer.height=this.canvas.height;const x=buffer.getContext('2d');x.setTransform(this.ratio,0,0,this.ratio,0,0);const im=this.assets.background;
   if(im){const cam=this.camera;x.drawImage(im,cam.offsetX,cam.offsetY,im.width*cam.zoom,im.height*cam.zoom);}else{const g=x.createLinearGradient(0,0,0,h);g.addColorStop(0,'#75a7b2');g.addColorStop(.5,'#e9c99b');g.addColorStop(1,'#9d7757');x.fillStyle=g;x.fillRect(0,0,w,h);}
   const shade=x.createLinearGradient(0,0,0,h);shade.addColorStop(0,'#1027390a');shade.addColorStop(.6,'#3c2d1710');shade.addColorStop(1,'#231b222e');x.fillStyle=shade;x.fillRect(0,0,w,h);this.backgroundCache=buffer;
  }
  c.drawImage(this.backgroundCache,0,0,w,h);
  this.scene.draw(c,this.camera,s.tick,this.reduced);
 }
 draw(s,time,outfit=0,delta=1/30,events=s.events){
  const c=this.ctx,w=this.w,h=this.h;c.clearRect(0,0,w,h);this.lane+=(s.lane-this.lane)*(1-Math.exp(-18*delta));this.background(s);
  const visible=s.objects.filter(o=>o.z>0&&o.z<1.16).slice().sort((a,b)=>a.z-b.z);
  for(const o of visible.filter(o=>o.z<=1))this.object(o,time,s.tick);
  const pos=this.project(1,this.lane),unit=this.heroSize(),lift=s.jump?Math.sin(Math.PI*(48-s.jump)/48)*unit*.65:0;
  this.ellipse(pos.x,pos.y+unit*.025,unit*(s.jump?.18:.23),unit*.045,'#37281e40');
  c.save();if(s.invincible&&Math.floor(s.tick/6)%2)c.globalAlpha=.45;
  if(this.assets.runner){
   const index=s.slide?7:s.jump?6:(!s.tick||s.done||this.reduced)?0:Math.floor(s.tick/6)%6,frame=this.frames[index],scale=unit/this.runnerHeight;
   const dw=frame.w*scale,dh=frame.h*scale;c.drawImage(this.assets.runner,frame.x,frame.y,frame.w,frame.h,pos.x-dw/2,pos.y-dh-lift,dw,dh);
  }else{c.fillStyle='#2f7984';c.fillRect(pos.x-unit*.15,pos.y-unit*.7-lift,unit*.3,unit*.55);this.ellipse(pos.x,pos.y-unit*.8-lift,unit*.12,unit*.13,'#59463c');}
  c.restore();
  for(const o of visible.filter(o=>o.z>1))if(!(o.kind==='scroll'&&o.lane===s.lane))this.object(o,time,s.tick);
  if(!this.reduced&&s.tick&&!s.done)for(let i=0;i<5;i++){const v=((s.tick+i*13)%50)/50;this.ellipse(pos.x+(i%2?1:-1)*unit*v*.35,pos.y+unit*v*.15,unit*.025*(1-v),unit*.015*(1-v),'#ffe6b37a');}
  if(events.includes('hit')){c.fillStyle='#b9344228';c.fillRect(0,0,w,h);}
  if(events.includes('collect')){c.fillStyle='#ffecc70b';c.fillRect(0,0,w,h);}
  this.needsRedraw=false;
 }
 object(o,time,tick){
  const c=this.ctx,p=this.project(o.z,o.lane),size=this.heroSize()*p.scale,lane=this.camera.gap*p.scale;
  if(['guard','ally','water'].includes(o.kind)){
   const index=o.kind==='guard'?0:o.kind==='water'?3:1+o.id%2,f=ENCONTROS_FRAMES[index],height=size*(o.kind==='water'?.55:1.05),width=height*(o.kind==='guard'&&this.assets.guard?this.assets.guard.width/this.assets.guard.height:f.w/f.h);
   c.save();c.globalAlpha=o.z>1?Math.max(0,1-(o.z-1)*7):1;this.ellipse(p.x,p.y,width*.43,size*.035,'#362b2540');
   if(o.kind==='guard'&&this.assets.guard)c.drawImage(this.assets.guard,p.x-width/2,p.y-height,width,height);
   else if(this.assets.encounters)c.drawImage(this.assets.encounters,f.x,f.y,f.w,f.h,p.x-width/2,p.y-height,width,height);
   else{c.fillStyle=o.kind==='guard'?'#ae3b35':o.kind==='water'?'#6bb8dc':'#7ebd74';c.fillRect(p.x-width/2,p.y-height,width,height);}
   if(o.z>.48&&o.z<1){const label=o.kind==='guard'?'−40':o.kind==='ally'?'+50':'♥',r=Math.max(9,13*p.scale);c.font='bold '+Math.round(r*1.1)+'px sans-serif';c.textAlign='center';c.fillStyle=o.kind==='guard'?'#ffcdc1':o.kind==='ally'?'#d7ffc2':'#bdeeff';c.strokeStyle='#1c273a';c.lineWidth=3;c.strokeText(label,p.x,p.y-height-r);c.fillText(label,p.x,p.y-height-r);}
   c.restore();return;
  }
  const types={crate:{i:0,w:.75,h:.63},barrier:{i:1,w:.9,h:.42},arch:{i:2,w:.96,h:1.07},scroll:{i:3,w:.35,h:.38}},type=types[o.kind];if(!type)return;
  const dw=Math.min(lane*type.w,size*(o.kind==='scroll'?.4:1.15)),dh=size*type.h;
  const float=!this.reduced&&o.kind==='scroll'?Math.sin(time/250+o.id)*3*p.scale:0;
  c.save();c.globalAlpha=o.z>1?Math.max(.12,1-(o.z-1)*5):1;
  this.ellipse(p.x,p.y+2,dw*.42,size*.035,'#3c2d2540');
  if(o.kind==='scroll'){this.ellipse(p.x,p.y-dh*.55,dw*.85,dh*.7,'#ffe5a22b');}
  if(this.assets.props){const f=this.propFrames[type.i];c.drawImage(this.assets.props,f.x,f.y,f.w,f.h,p.x-dw/2,p.y-dh+float,dw,dh);}
  else{c.fillStyle=o.kind==='scroll'?'#ffe8af':o.kind==='arch'?'#367f83':'#9b6845';c.fillRect(p.x-dw/2,p.y-dh,dw,dh);}
  if((o.kind==='arch'||o.kind==='barrier')&&o.z>.6&&o.z<1){
   const label=o.kind==='arch'?'↓':'↑',r=Math.max(9,14*p.scale);this.ellipse(p.x,p.y-dh-r-5,r,r,'#122c3dcc');c.font='bold '+Math.round(r*1.25)+'px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillStyle='#fff0c4';c.fillText(label,p.x,p.y-dh-r-5);
  }
  c.restore();
 }
}
window.MensageiroRenderer=MensageiroRenderer;
