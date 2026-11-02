/* Mesmo plano da rua para desenho, escala e ponto de colisão; independente da física. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MensageiroCamera=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 const LANDMARK={x:.536,y:.535};
 function toScreen(c,x,y){return {x:c.offsetX+x*c.imageWidth*c.zoom,y:c.offsetY+y*c.imageHeight*c.zoom};}
 function create(width,height,imageWidth,imageHeight){
  const zoom=Math.max(width/imageWidth,height/imageHeight)*1.025;
  const c={width,height,imageWidth,imageHeight,zoom,offsetX:(width-imageWidth*zoom)/2,offsetY:(height-imageHeight*zoom)/2,gap:width*.225};
  c.vanish=toScreen(c,LANDMARK.x,LANDMARK.y);const y=height*.84,bottom=toScreen(c,.5,1),t=(y-c.vanish.y)/(bottom.y-c.vanish.y);
  c.ground={x:c.vanish.x+(bottom.x-c.vanish.x)*t,y};return c;
 }
 function project(c,z,lane){const scale=Math.pow(Math.max(0,z),1.55);return {x:c.vanish.x+(c.ground.x+(lane-1)*c.gap-c.vanish.x)*scale,y:c.vanish.y+(c.ground.y-c.vanish.y)*scale,scale};}
 return {create,project,toScreen,LANDMARK};
});
