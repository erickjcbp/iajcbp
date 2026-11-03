/* Cenário ilustrado com volume e luz da mesma arte; camadas estáticas em cache. */
class DaviScene{
 constructor(){this.layers=[document.createElement('canvas'),document.createElement('canvas')];this.ready=false;this.image=new Image();this.loaded=new Promise(resolve=>{this.image.onload=()=>{this.ready=true;this.paint();resolve(true);};this.image.onerror=()=>resolve(false);});this.image.src='games-art/davi/cenario-elementos-v3.webp';}
 resize(w,h){if(w===this.w&&h===this.h)return;this.w=w;this.h=h;this.paint();}
 prop(c,cell,x,y,width,flip=false){const size=this.image.width/2,unit=Math.min(this.w,this.h)/1000,px=x/1000*this.w,py=y/1000*this.h,ww=width*unit;c.save();if(flip){c.translate(px,0);c.scale(-1,1);c.translate(-px,0);}c.drawImage(this.image,(cell%2)*size,Math.floor(cell/2)*size,size,size,px-ww/2,py-ww,ww,ww);c.restore();}
 paint(){if(!this.ready||!this.w||!this.h)return;for(const layer of this.layers){layer.width=this.w;layer.height=this.h;}
 const back=this.layers[0].getContext('2d'),front=this.layers[1].getContext('2d');
 // A vegetação emoldura entradas pelas laterais e pela linha distante do terreno.
 for(const[cell,x,y,width,flip]of[[2,40,365,210,false],[2,270,342,160,true],[1,735,354,175,false],[2,960,365,220,true],[3,135,435,170,false],[3,860,430,185,true]])this.prop(back,cell,x,y,width,flip);
 // Primeiro plano deixa a área de mira e as cinco ovelhas livres.
 for(const[cell,x,y,width,flip]of[[0,-10,765,460,false],[0,1020,805,440,true],[2,-25,530,270,false],[2,1025,555,270,true],[1,55,970,230,false],[1,955,978,240,true],[2,-55,960,210,false],[2,1050,970,200,true]])this.prop(front,cell,x,y,width,flip);
 }
 draw(c,layer){if(this.ready&&this.w&&this.h)c.drawImage(this.layers[layer],0,0,this.w,this.h);}
}
window.DaviScene=DaviScene;
