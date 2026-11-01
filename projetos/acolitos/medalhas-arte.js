// Artes das medalhas: catálogo ampliado em 31/10/2026.
(function () {
  'use strict';
  const keys = new Set(["calice-bronze", "calice-prata", "calice_sagrado-ouro", "coracao-bronze", "coracao-prata", "coroa-ouro", "coroa-prata", "crucifixo-ouro", "crucifixo-prata", "espadas-ouro", "estrela-bronze", "estrela-ouro", "estrela-prata", "hostia-ouro", "livro-bronze", "livro-ouro", "livro-prata", "pomba-ouro", "pomba-prata", "rosario-ouro", "rosario-prata", "sino-prata", "sino2-prata", "trigo-bronze", "trigo-prata", "turibulo-ouro", "vela-bronze", "samaritano-ouro", "acolhedor-ouro", "bastidores-ouro", "ponte_paz-ouro", "criacao-ouro", "escuta-ouro", "recomecar-ouro", "palavra_semeada-ouro", "amigo_todos-ouro", "memoria-ouro"]);
  const tempo={
    tempo_chama:{marco:'1',tier:'bronze',label:'Primeira Chama',crop:[0,155,395],cor:'#d6a174',glow:0,orbit:0,rays:0,pulse:6,speed:30,shine:14,sparks:0},
    tempo_pilar:{marco:'2',tier:'prata',label:'Pilar do Tempo',crop:[382,148,415],cor:'#d9e1ec',glow:.18,orbit:.25,rays:0,pulse:5.5,speed:28,shine:11,sparks:2},
    tempo_raiz:{marco:'3',tier:'ouro',label:'Raiz da Pastoral',crop:[800,140,435],cor:'#f0c357',glow:.36,orbit:.5,rays:.25,pulse:4.8,speed:23,shine:9,sparks:5},
    tempo_altar:{marco:'5',tier:'onix',label:'Coluna do Altar',crop:[1228,117,485],cor:'#b8bec8',glow:.28,orbit:.52,rays:0,pulse:4.2,speed:26,shine:7,sparks:0},
    tempo_veterano:{marco:'V',tier:'rubi',label:'Veterano',crop:[1692,112,480],cor:'#b43b4d',glow:.4,orbit:.62,rays:0,pulse:3.5,speed:26,shine:6,sparks:0}
  };
  let tempoN=0;
  function medalhao(simbolo,size){
    const m=tempo[simbolo],n=Number(size),width=Number.isFinite(n)&&n>0?Math.min(n,1024):64;
    const [x,y,d]=m.crop,id='tempo-clip-'+(++tempoN),atlas=['onix','rubi'].includes(m.tier)?'tempo-onix-rubi.webp':'tempo-bronze-prata-ouro.webp';
    let html='<span class="medalhao-tempo" data-marco="'+m.marco+'" data-tier="'+m.tier+'" role="img" aria-label="Medalhão '+m.label+'" style="--medalhao-size:'+width+'px;--mt-color:'+m.cor+';--mt-glow:'+m.glow+';--mt-orbit:'+m.orbit+';--mt-rays:'+m.rays+';--mt-pulse:'+m.pulse+'s;--mt-speed:'+m.speed+'s;--mt-shine:'+m.shine+'s">';
    html+='<span class="mt-aura"></span><span class="mt-rays"></span><span class="mt-orbit"></span>';
    if(['3','5','V'].includes(m.marco))html+='<span class="mt-orbit mt-orbit-2"></span>';
    if(m.marco==='V')html+='<span class="mt-orbit mt-orbit-3"></span>';
    html+='<span class="mt-core"><svg viewBox="'+[x,y,d,d].join(' ')+'" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><defs><clipPath id="'+id+'"><circle cx="'+(x+d/2)+'" cy="'+(y+d/2)+'" r="'+(d/2)+'"/></clipPath></defs><image href="/projetos/acolitos/identidade-oficial/medalhoes/'+atlas+'" width="2172" height="724" clip-path="url(#'+id+')"/></svg></span>';
    for(let k=0;k<m.sparks;k++){const a=k*2.399;html+='<span class="mt-spark" style="left:'+(50+Math.cos(a)*40).toFixed(2)+'%;top:'+(50+Math.sin(a)*40).toFixed(2)+'%;--mt-t:'+(2.5+k*.25)+'s;--mt-delay:'+(-k*.7)+'s"></span>';}
    return html+'</span>';
  }
  window.MedalhasArte = Object.freeze({
    html(simbolo, tier, size) {
      if(Object.hasOwn(tempo,simbolo))return medalhao(simbolo,size);
      const key = simbolo + '-' + tier;
      if (!keys.has(key)) return '';
      const n = Number(size);
      const width = Number.isFinite(n) && n > 0 ? Math.min(n, 1024) : 64;
      const height = Math.round(width * 88 / 72);
      return '<img src="/projetos/acolitos/medalhas-arte/' + key + '.webp" width="' + width + '" height="' + height + '" alt="" decoding="async" style="object-fit:contain;flex:none">';
    }
  });
})();
