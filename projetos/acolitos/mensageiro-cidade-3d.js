/* Rua modular em volumes reais. Geometria gerada uma vez, sem biblioteca externa. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./mensageiro-camera.js'):root.MensageiroCamera);if(typeof module==='object'&&module.exports)module.exports=api;else root.MensageiroCidade3D=api;})(typeof globalThis!=='undefined'?globalThis:this,function(Camera){
'use strict';
const RANGE=65,NEAR=4.5,LANE=2.4,COLLISION=Camera.DEPTH.near,SPAN=Camera.DEPTH.span,STRIDE=13;
function build(){const data=[];
 const add=(p,n,uv,c,k,s)=>data.push(...p,...n,...uv,...c,k,s);
 function normal(a,b,c){const u=b.map((x,i)=>x-a[i]),v=c.map((x,i)=>x-a[i]),n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],l=Math.hypot(...n)||1;return n.map(x=>x/l);}
 function tri(a,b,c,col,k,s,uv=[[0,0],[1,0],[1,1]],n=normal(a,b,c)){add(a,n,uv[0],col,k,s);add(b,n,uv[1],col,k,s);add(c,n,uv[2],col,k,s);}
 function quad(p,col,k,s,uv=[[0,0],[1,0],[1,1],[0,1]],n=normal(p[0],p[1],p[2])){if(Math.hypot(...n)<1e-6)n=normal(p[0],p[2],p[3]);tri(p[0],p[1],p[2],col,k,s,[uv[0],uv[1],uv[2]],n);tri(p[0],p[2],p[3],col,k,s,[uv[0],uv[2],uv[3]],n);}
 function box(x,y,z,w,h,d,c,s,k=3){const l=x-w/2,r=x+w/2,b=y-h/2,t=y+h/2,n=z-d/2,f=z+d/2;quad([[l,b,n],[r,b,n],[r,t,n],[l,t,n]],c,k,s,undefined,[0,0,-1]);quad([[r,b,f],[l,b,f],[l,t,f],[r,t,f]],c,k,s,undefined,[0,0,1]);quad([[l,b,f],[l,b,n],[l,t,n],[l,t,f]],c,k,s,undefined,[-1,0,0]);quad([[r,b,n],[r,b,f],[r,t,f],[r,t,n]],c,k,s,undefined,[1,0,0]);quad([[l,t,n],[r,t,n],[r,t,f],[l,t,f]],c,k,s,undefined,[0,1,0]);}
 function lathe(x,y,z,profile,c,s,segments=10){for(let j=0;j<profile.length-1;j++){const [h0,r0]=profile[j],[h1,r1]=profile[j+1];for(let i=0;i<segments;i++){const a=i/segments*Math.PI*2,b=(i+1)/segments*Math.PI*2;quad([[x+Math.cos(a)*r0,y+h0,z+Math.sin(a)*r0],[x+Math.cos(b)*r0,y+h0,z+Math.sin(b)*r0],[x+Math.cos(b)*r1,y+h1,z+Math.sin(b)*r1],[x+Math.cos(a)*r1,y+h1,z+Math.sin(a)*r1]],c,3,s);}}}
 function foliage(x,y,z,rx,ry,rz,c,s){const rings=4,steps=6;for(let j=0;j<rings;j++){const a=-Math.PI/2+j/rings*Math.PI,b=-Math.PI/2+(j+1)/rings*Math.PI;for(let i=0;i<steps;i++){const u=i/steps*Math.PI*2,v=(i+1)/steps*Math.PI*2;const p=(q,t)=>[x+Math.cos(q)*Math.cos(t)*rx,y+Math.sin(q)*ry,z+Math.cos(q)*Math.sin(t)*rz];quad([p(a,u),p(a,v),p(b,v),p(b,u)],c,3,s);}}}
 // Piso e juntas: mapeamento métrico; textura e edifícios avançam na mesma unidade.
 quad([[-85,0,1],[-85,0,135],[85,0,135],[85,0,1]],[1,.99,.94],0,-1,[[-29.75,.35],[-29.75,47.25],[29.75,47.25],[29.75,.35]],[0,1,0]);
 const stone=[[.88,.81,.66],[.84,.77,.64],[.92,.86,.73],[.82,.73,.59]],trim=[.91,.85,.73],wood=[.34,.22,.13];
 for(let i=0;i<10;i++)for(const side of [-1,1]){const s=i*6.5,variant=(i+(side>0?2:0))%4,h=[3.5,4.3,3.8,4.6][variant],cx=side*6.6,face=side*4.79,z0=-3.25,z1=3.25,c=stone[variant];
  box(side*4.35,.08,0,1.05,.16,6.5,[.76,.71,.61],s,0);
  box(cx,h/2+.16,0,3.6,h,6.5,c,s,6);
  const u=(variant%2)*.5+.004,v=Math.floor(variant/2)*.5+.004;
  quad([[face,.16,z0],[face,.16,z1],[face,h+.16,z1],[face,h+.16,z0]],[1,1,1],1,s,[[u,v],[u+.492,v],[u+.492,v+.492],[u,v+.492]],[-side,0,0]);
  for(const zz of [-2.94,2.94])box(side*4.69,h/2+.16,zz,.14,h,.17,trim,s,6);
  box(side*4.67,.30,0,.20,.18,6.32,[.79,.72,.60],s,6);box(side*4.69,h+.13,0,.22,.09,6.3,trim,s,6);
  const a=[side*4.43,h+.24,-3.32],b=[side*8.77,h+.24,-3.32],p=[cx,h+1.32,-3.32],af=[a[0],a[1],3.32],bf=[b[0],b[1],3.32],pf=[p[0],p[1],3.32];
  const slope=(points,color)=>{let n=normal(points[0],points[1],points[2]);if(n[1]<0)n=n.map(v=>-v);quad(points,color,2,s,[[0,0],[0,3.5],[2.3,3.5],[2.3,0]],n);};slope([a,af,pf,p],[1.08,.98,.90]);slope([p,pf,bf,b],[1.02,.95,.89]);tri(a,p,b,c,3,s);tri(af,bf,pf,c,3,s);
  // Sombra de contato entre calçada e parede, acompanha a casa.
  quad([[side*3.85,.012,-3.2],[side*4.85,.012,-3.2],[side*4.85,.012,3.2],[side*3.85,.012,3.2]],[.19,.16,.11],4,s,undefined,[0,1,0]);
  if((i+(side>0?1:0))%3!==0){const cloth=i%2?[.18,.45,.44]:[.69,.32,.15];
   for(let stripe=0;stripe<8;stripe++){const a=-1.5+stripe*.375,b=a+.375,color=cloth.map(v=>v*(stripe%2?.82:1.06));quad([[side*4.7,3.0,a],[side*3.5,2.68,a],[side*3.5,2.68,b],[side*4.7,3.0,b]],color,3,s);quad([[side*3.5,2.68,a],[side*3.5,2.44,a],[side*3.5,2.44,b],[side*3.5,2.68,b]],color,3,s,undefined,[-side,0,0]);}
   for(const zz of [-1.5,1.5])box(side*3.53,1.45,zz,.065,2.6,.065,wood,s,7);
   box(side*4.05,.65,0,.68,1.0,2.6,[.45,.31,.17],s,7);box(side*4.05,1.18,0,.82,.10,2.75,[.59,.43,.25],s,7);
   for(let fruit=0;fruit<5;fruit++)foliage(side*4.02,1.30,-1+fruit*.48,.18,.14,.17,fruit%2?[.83,.53,.14]:[.65,.31,.12],s);
  }
  const potZ=(i%2?1:-1)*2.22,potX=side*4.02,plantHeight=[2.15,2.55,2.35,2.75][variant],plantWidth=plantHeight*163/225;
  const u0=400/768,u1=561/768,v0=20/256,v1=244/256;
  quad([[potX-plantWidth/2,.16,potZ],[potX+plantWidth/2,.16,potZ],[potX+plantWidth/2,.16+plantHeight,potZ],[potX-plantWidth/2,.16+plantHeight,potZ]],[1,1,1],5,s,[[u0,v0],[u1,v0],[u1,v1],[u0,v1]],[0,0,-1]);
 }
 return {data:new Float32Array(data),vertices:data.length/STRIDE,stride:STRIDE,range:RANGE,near:NEAR,laneWidth:LANE,collisionDepth:COLLISION};
}
function advance(tick){return SPAN*(Math.min(tick,1799)*.0065+Math.min(Math.max(tick-1799,0),1800)*.008+Math.max(tick-3599,0)*.0095);}
return {build,advance,RANGE,NEAR,LANE,COLLISION,STRIDE};
});
