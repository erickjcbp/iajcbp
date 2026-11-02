/* Mesmo plano da rua para desenho, escala e ponto de colisão; independente da física. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MensageiroCamera=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 const LANDMARK={x:.5,y:.315},DEPTH={near:7,span:12.6};
 function toScreen(c,x,y){return {x:c.offsetX+x*c.imageWidth*c.zoom,y:c.offsetY+y*c.imageHeight*c.zoom};}
 function create(width,height,imageWidth,imageHeight){
  const zoom=Math.max(width/imageWidth,height/imageHeight)*1.015;
  const offsetY=Math.min(0,Math.max(height-imageHeight*zoom,height*.315-LANDMARK.y*imageHeight*zoom));
  const c={width,height,imageWidth,imageHeight,zoom,offsetX:(width-imageWidth*zoom)/2,offsetY,gap:width*.40};
  c.vanish=toScreen(c,LANDMARK.x,LANDMARK.y);c.ground={x:width*.5,y:height*.86};return c;
 }
 function project(c,z,lane){const depth=Math.max(0,z),scale=depth/(.9+.1*depth);return {x:c.vanish.x+(c.ground.x+(lane-1)*c.gap-c.vanish.x)*scale,y:c.vanish.y+(c.ground.y-c.vanish.y)*scale,scale};}
 // z é progresso do motor. A distância física é linear: sprites acompanham a rua.
 function projectObject(c,z,lane){const scale=DEPTH.near/(DEPTH.near+DEPTH.span*(1-z));return {x:c.vanish.x+(c.ground.x+(lane-1)*c.gap-c.vanish.x)*scale,y:c.vanish.y+(c.ground.y-c.vanish.y)*scale,scale};}
 return {create,project,projectObject,toScreen,LANDMARK,DEPTH};
});
