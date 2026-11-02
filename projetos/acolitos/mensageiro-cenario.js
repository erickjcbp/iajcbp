/* Rua 3D: chão, fachadas, telhados e elementos laterais compartilham a câmera
   e a velocidade. O fundo distante permanece na composição artística. */
class MensageiroCenario {
 constructor(){this.canvas=document.createElement('canvas');this.gl=null;this.ready=false;try{this.gl=this.canvas.getContext('webgl',{alpha:true,premultipliedAlpha:true,antialias:true,depth:true,stencil:false,preserveDrawingBuffer:true});}catch(_){}this.canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.ready=false;});this.canvas.addEventListener('webglcontextrestored',()=>this.init(this.image,this.facadeImage,this.plantImage));}
 roofTexture(){const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');x.fillStyle='#a95f3e';x.fillRect(0,0,128,128);for(let row=0;row<8;row++)for(let col=-1;col<9;col++){const px=col*16+(row%2?8:0),py=row*16;x.fillStyle=(row+col)%3?'#bb734d':'#ae623e';x.fillRect(px,py,16,16);x.fillStyle='#da986c';x.fillRect(px+2,py+1,3,13);x.fillStyle='#733e2c';x.fillRect(px+13,py,3,16);x.fillRect(px,py+14,16,2);}return c;}
 woodTexture(){const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');x.fillStyle='#886043';x.fillRect(0,0,128,128);for(let i=0;i<128;i+=2){const n=Math.round(92+Math.sin(i*1.7)*14);x.strokeStyle='rgba('+n+','+Math.round(n*.67)+','+Math.round(n*.42)+',.5)';x.beginPath();x.moveTo(i,0);x.bezierCurveTo(i+3,36,i-4,80,i+1,128);x.stroke();}x.strokeStyle='#65462e';for(let i=0;i<4;i++)x.strokeRect(i*32,0,32,128);return c;}
 fallbackFacade(){const c=document.createElement('canvas');c.width=c.height=512;const x=c.getContext('2d');for(let i=0;i<4;i++){const a=i%2*256,b=Math.floor(i/2)*256;x.fillStyle=['#d8c299','#cfb98f','#e2d1ac','#d2b386'][i];x.fillRect(a,b,256,256);x.strokeStyle='#b7a27f';for(let y=0;y<256;y+=32){x.beginPath();x.moveTo(a,b+y);x.lineTo(a+256,b+y);x.stroke();}x.fillStyle='#65462f';x.fillRect(a+88,b+144,80,112);x.beginPath();x.arc(a+128,b+144,40,Math.PI,0);x.fill();x.fillRect(a+32,b+48,40,56);x.fillRect(a+184,b+48,40,56);}return c;}
 init(image,facade,plants){this.image=image;this.facadeImage=facade;this.plantImage=plants;const g=this.gl;if(!g||!image||!window.MensageiroCidade3D)return false;
  try{
   const compile=(type,source)=>{const s=g.createShader(type);g.shaderSource(s,source);g.compileShader(s);if(!g.getShaderParameter(s,g.COMPILE_STATUS))throw Error(g.getShaderInfoLog(s));return s;};
   const vertex=compile(g.VERTEX_SHADER,`attribute vec3 pos;attribute vec3 normal;attribute vec2 tex;attribute vec3 color;attribute float kind;attribute float station;
    uniform vec2 size;uniform vec2 vanish;uniform float focal;uniform float eye;uniform float travel;uniform float stretch;uniform float roadRange;uniform float roadNear;
    varying vec2 uv;varying vec3 tint;varying vec3 norm;varying float mat;varying float depth;varying float floorPart;varying float worldX;
    void main(){vec3 p=pos;floorPart=station<0.?1.:0.;if(station>=0.)p.z+=mod(station-mod(travel,roadRange)+roadRange,roadRange)+roadNear;
     uv=tex;if(station<0.)uv.y+=travel*.35;tint=color;norm=vec3(normal.x/stretch,normal.y,normal.z);mat=kind;depth=p.z;worldX=p.x;p.x*=stretch;if(station<0.)uv.x*=stretch;
     float x=2.*focal*p.x/size.x+(2.*vanish.x/size.x-1.)*p.z;
     float y=(1.-2.*vanish.y/size.y)*p.z-2.*focal*(eye-p.y)/size.y;
     gl_Position=vec4(x,y,(151./149.)*p.z-300./149.,p.z);
    }`);
   const fragment=compile(g.FRAGMENT_SHADER,`precision highp float;
    uniform sampler2D stone;uniform sampler2D facade;uniform sampler2D roof;uniform sampler2D plants;uniform sampler2D wood;
    varying vec2 uv;varying vec3 tint;varying vec3 norm;varying float mat;varying float depth;varying float floorPart;varying float worldX;
    void main(){vec3 rgb=tint;float alpha=1.;
     if(mat<.5){rgb*=texture2D(stone,uv).rgb*vec3(1.09,1.02,.94);if(floorPart>.5){float seam=min(abs(worldX-1.2),abs(worldX+1.2));rgb*=1.-(1.-smoothstep(.012,.03,seam))*.12;}}
     else if(mat<1.5)rgb*=texture2D(facade,uv).rgb;
     else if(mat<2.5)rgb*=texture2D(roof,uv).rgb;
     else if(mat>6.5)rgb=texture2D(wood,uv).rgb*mix(vec3(.9),tint,.1);
     else if(mat>5.5)rgb*=mix(vec3(1.),texture2D(stone,uv*vec2(3.,2.)).rgb*1.25,.35);
     else if(mat>4.5){vec4 leaf=texture2D(plants,uv);if(leaf.a<.2)discard;rgb*=leaf.rgb;alpha=leaf.a;}
     else if(mat>3.5)alpha=.17;
     if(mat<3.5||mat>5.5){vec3 n=normalize(norm);float light=.72+.28*max(0.,dot(n,normalize(vec3(-.55,.82,-.35))));rgb=pow(pow(max(rgb,vec3(0.)),vec3(2.2))*light,vec3(.454545));}
     float fog=smoothstep(42.,64.,depth);rgb=mix(rgb,vec3(.84,.81,.73),fog*.3);alpha*=1.-fog;
     gl_FragColor=vec4(rgb*alpha,alpha);
    }`);
   const program=g.createProgram();g.attachShader(program,vertex);g.attachShader(program,fragment);g.linkProgram(program);g.deleteShader(vertex);g.deleteShader(fragment);if(!g.getProgramParameter(program,g.LINK_STATUS))throw Error(g.getProgramInfoLog(program));this.program=program;g.useProgram(program);
   this.mesh=MensageiroCidade3D.build();g.uniform1f(g.getUniformLocation(program,'roadRange'),this.mesh.range);g.uniform1f(g.getUniformLocation(program,'roadNear'),this.mesh.near);const buffer=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,buffer);g.bufferData(g.ARRAY_BUFFER,this.mesh.data,g.STATIC_DRAW);
   let offset=0;for(const [name,count] of [['pos',3],['normal',3],['tex',2],['color',3],['kind',1],['station',1]]){const a=g.getAttribLocation(program,name);g.enableVertexAttribArray(a);g.vertexAttribPointer(a,count,g.FLOAT,false,this.mesh.stride*4,offset*4);offset+=count;}
   this.textures={};this.aniso=g.getExtension('EXT_texture_filter_anisotropic')||g.getExtension('WEBKIT_EXT_texture_filter_anisotropic');
   for(const [unit,name,source,repeat] of [[0,'stone',image,true],[1,'facade',facade||this.fallbackFacade(),false],[2,'roof',this.roofTexture(),true],[3,'plants',plants||document.createElement('canvas'),false],[4,'wood',this.woodTexture(),true]])this.uploadMaterial(unit,name,source,repeat);
   this.u={};for(const name of ['size','vanish','focal','eye','travel','stretch'])this.u[name]=g.getUniformLocation(program,name);g.enable(g.DEPTH_TEST);g.depthFunc(g.LEQUAL);g.enable(g.BLEND);g.blendFunc(g.ONE,g.ONE_MINUS_SRC_ALPHA);g.clearColor(0,0,0,0);this.ready=true;this.error=null;return true;
  }catch(e){this.error=e.message;this.ready=false;return false;}
 }
 uploadMaterial(unit,name,source,repeat,texture=null){
  const g=this.gl;g.useProgram(this.program);g.activeTexture(g.TEXTURE0+unit);texture=texture||g.createTexture();let upload=source;const pot=n=>n>0&&(n&(n-1))===0;
  if(!pot(source.width)||!pot(source.height)){const tile=document.createElement('canvas');tile.width=2**Math.ceil(Math.log2(source.width));tile.height=2**Math.ceil(Math.log2(source.height));tile.getContext('2d').drawImage(source,0,0,tile.width,tile.height);upload=tile;}
  g.bindTexture(g.TEXTURE_2D,texture);g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL,true);g.texImage2D(g.TEXTURE_2D,0,g.RGBA,g.RGBA,g.UNSIGNED_BYTE,upload);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_S,repeat?g.REPEAT:g.CLAMP_TO_EDGE);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_T,repeat?g.REPEAT:g.CLAMP_TO_EDGE);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,g.LINEAR);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,g.LINEAR_MIPMAP_LINEAR);g.generateMipmap(g.TEXTURE_2D);
  if(this.aniso)g.texParameterf(g.TEXTURE_2D,this.aniso.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(4,g.getParameter(this.aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));g.uniform1i(g.getUniformLocation(this.program,name),unit);this.textures[name]={texture,unit,repeat,width:source.width,height:source.height};
 }
 updateMaterial(name,image){if(name==='stone')this.image=image;if(name==='facade')this.facadeImage=image;if(name==='plants')this.plantImage=image;const record=this.textures?.[name];if(!this.ready||!record||this.gl.isContextLost())return false;this.uploadMaterial(record.unit,name,image,record.repeat,record.texture);return true;}
 resize(w,h){if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}}
 draw(ctx,camera,tick,reduced,worldTravel){if(!this.ready)return;const g=this.gl;g.viewport(0,0,this.canvas.width,this.canvas.height);g.clear(g.COLOR_BUFFER_BIT|g.DEPTH_BUFFER_BIT);g.useProgram(this.program);const unit=Math.min(camera.width*.26,camera.height*.265),focal=unit*MensageiroCidade3D.COLLISION/1.6,stretch=camera.gap*MensageiroCidade3D.COLLISION/(focal*MensageiroCidade3D.LANE),eye=(camera.ground.y-camera.vanish.y)*MensageiroCidade3D.COLLISION/focal;g.uniform2f(this.u.size,camera.width,camera.height);g.uniform2f(this.u.vanish,camera.vanish.x,camera.vanish.y);g.uniform1f(this.u.focal,focal);g.uniform1f(this.u.eye,eye);g.uniform1f(this.u.stretch,stretch);g.uniform1f(this.u.travel,reduced?0:(Number.isFinite(worldTravel)?worldTravel:MensageiroCidade3D.advance(tick)));g.drawArrays(g.TRIANGLES,0,this.mesh.vertices);ctx.drawImage(this.canvas,0,0,camera.width,camera.height);}
}
window.MensageiroCenario=MensageiroCenario;
