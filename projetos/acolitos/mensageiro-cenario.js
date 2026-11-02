/* Piso contínuo projetado na GPU. Um único plano, sem faixas de imagens ou
   barracas que se repetem. O fundo artístico mantém sua composição. */
class MensageiroCenario {
 constructor(){this.canvas=document.createElement('canvas');this.gl=null;this.ready=false;try{this.gl=this.canvas.getContext('webgl',{alpha:true,premultipliedAlpha:false,antialias:false,depth:false,stencil:false,preserveDrawingBuffer:true});}catch(_){}this.canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.ready=false;});this.canvas.addEventListener('webglcontextrestored',()=>this.init(this.image));}
 init(image){this.image=image;const g=this.gl;if(!g||!image)return false;
  try{
   const compile=(type,source)=>{const s=g.createShader(type);g.shaderSource(s,source);g.compileShader(s);if(!g.getShaderParameter(s,g.COMPILE_STATUS))throw Error(g.getShaderInfoLog(s));return s;};
   const vertex=compile(g.VERTEX_SHADER,'attribute vec2 a;varying vec2 uv;void main(){uv=vec2(a.x*.5+.5,.5-a.y*.5);gl_Position=vec4(a,0.,1.);}');
   const fragment=compile(g.FRAGMENT_SHADER,`precision highp float;
    varying vec2 uv;uniform sampler2D stone;uniform vec2 size;uniform vec2 vanish;uniform vec2 ground;uniform float gap;uniform float travel;
    void main(){
     vec2 px=uv*size;float p=(px.y-vanish.y)/(ground.y-vanish.y);
     if(p<=.01){gl_FragColor=vec4(0.);return;}
     float center=vanish.x+(ground.x-vanish.x)*p;
     float worldX=(px.x-center)/(gap*p);
     float edge=1.-smoothstep(1.75,2.3,abs(worldX));
     float alpha=smoothstep(.07,.5,p)*edge;
     vec2 coord=vec2(worldX*.43+.5,1./p*.55+travel);
     vec3 rgb=texture2D(stone,coord).rgb;
     // Luz suave: distância mais clara, primeiro plano com o mesmo tom da cidade.
     rgb*=mix(1.05,.91,clamp(p,0.,1.));
     // Duas juntas discretas, abrindo as três faixas sem tinta na rua.
     float joint=min(abs(worldX-.5),abs(worldX+.5));
     rgb*=1.-(1.-smoothstep(.006,.022,joint))*.16;
     gl_FragColor=vec4(rgb,alpha*.96);
    }`);
   const program=g.createProgram();g.attachShader(program,vertex);g.attachShader(program,fragment);g.linkProgram(program);g.deleteShader(vertex);g.deleteShader(fragment);if(!g.getProgramParameter(program,g.LINK_STATUS))throw Error(g.getProgramInfoLog(program));
   this.program=program;g.useProgram(program);const buffer=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,buffer);g.bufferData(g.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),g.STATIC_DRAW);const a=g.getAttribLocation(program,'a');g.enableVertexAttribArray(a);g.vertexAttribPointer(a,2,g.FLOAT,false,0,0);
   const texture=g.createTexture();g.bindTexture(g.TEXTURE_2D,texture);g.texImage2D(g.TEXTURE_2D,0,g.RGBA,g.RGBA,g.UNSIGNED_BYTE,image);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_S,g.REPEAT);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_T,g.REPEAT);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,g.LINEAR);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,g.LINEAR_MIPMAP_LINEAR);g.generateMipmap(g.TEXTURE_2D);
   this.u={};for(const name of ['size','vanish','ground','gap','travel'])this.u[name]=g.getUniformLocation(program,name);this.ready=true;return true;
  }catch(_){this.ready=false;return false;}
 }
 resize(w,h){if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}}
 draw(ctx,camera,tick,reduced){if(!this.ready)return;const g=this.gl;g.viewport(0,0,this.canvas.width,this.canvas.height);g.useProgram(this.program);g.uniform2f(this.u.size,camera.width,camera.height);g.uniform2f(this.u.vanish,camera.vanish.x,camera.vanish.y);g.uniform2f(this.u.ground,camera.ground.x,camera.ground.y);g.uniform1f(this.u.gap,camera.gap);const t0=Math.min(tick,1800),t1=Math.min(Math.max(tick-1800,0),1800),t2=Math.max(tick-3600,0);g.uniform1f(this.u.travel,reduced?0:(t0*.0065+t1*.008+t2*.0095)*.15);g.drawArrays(g.TRIANGLES,0,6);ctx.drawImage(this.canvas,0,0,camera.width,camera.height);}
}
window.MensageiroCenario=MensageiroCenario;
