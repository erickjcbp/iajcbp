(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ConquistasMarcos=api;})(globalThis,function(){
 'use strict';
 const ordem=Object.freeze({tempo_chama:12,tempo_pilar:24,tempo_raiz:36,tempo_altar:60,tempo_veterano:61});
 function esMarco(b){return !!b&&(Object.hasOwn(ordem,b.icone)||['tenure','tenure_nivel'].includes(b.criterio?.fonte));}
 function separar(badges){
  const marcos=[],medalhas=[];
  for(const b of badges||[])(esMarco(b)?marcos:medalhas).push(b);
  marcos.sort((a,b)=>(ordem[a.icone]??Number(a.criterio?.meses??Infinity))-(ordem[b.icone]??Number(b.criterio?.meses??Infinity)));
  return {marcos,medalhas,ultimo:marcos.filter(b=>b.ganho).at(-1)||null,proximo:marcos.find(b=>!b.ganho)||null};
 }
 return Object.freeze({esMarco,separar});
});
