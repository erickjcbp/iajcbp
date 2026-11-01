(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TempoPastoral=api;})(globalThis,function(){
 'use strict';
 function data(v){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(v||''))return null;
  const d=new Date(v+'T12:00:00Z');return !isNaN(d)&&d.toISOString().slice(0,10)===v?d:null;
 }
 function hojeLocal(){const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');}
 function dados(m,hoje=hojeLocal()){
  const inicio=data(m?.servindo_desde),fim=data(hoje);
  if(!inicio||!fim||inicio>fim)return {meses:null,dias:null,texto:'Não informado',titulo:'Data de início na pastoral não informada'};
  let meses=(fim.getUTCFullYear()-inicio.getUTCFullYear())*12+fim.getUTCMonth()-inicio.getUTCMonth();
  const diaMarco=Math.min(inicio.getUTCDate(),new Date(Date.UTC(fim.getUTCFullYear(),fim.getUTCMonth()+1,0)).getUTCDate());
  if(fim.getUTCDate()<diaMarco)meses--;
  const anos=Math.floor(meses/12),resto=meses%12,dias=Math.round((fim-inicio)/86400000);
  let texto=[anos?anos+(anos===1?' ano':' anos'):'',resto?resto+(resto===1?' mês':' meses'):''].filter(Boolean).join(' e ')||dias+(dias===1?' dia':' dias');
  if(m.servindo_desde_ou_antes)texto+=' ou mais';
  const titulo='Desde '+m.servindo_desde.split('-').reverse().join('/')+(m.servindo_desde_ou_antes?' ou antes':'')+(m.servindo_desde_fonte==='planilhas'?' · histórico de escalas':m.servindo_desde_fonte==='manual'?' · data informada pela coordenação':'');
  return {meses,dias,texto,titulo};
 }
 function elemento(m){const d=dados(m),n=document.createElement('span');n.className='tempo-pastoral';n.textContent='Tempo de pastoral: '+d.texto;n.title=d.titulo;return n;}
 return {dados,elemento};
});
