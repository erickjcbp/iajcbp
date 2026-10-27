// Diagnóstico de implantação: não imprime valores, credenciais nem respostas geradas.
const keepAlive=setInterval(()=>{},1000);
(async()=>{
 const chave=process.env.ANTHROPIC_API_KEY||'',modelo=process.env.ANTHROPIC_MODEL||'';
 console.log('quiz_ambiente',JSON.stringify({chavePresente:!!chave,chaveComEspacos:chave!==chave.trim(),modeloPresente:!!modelo,modeloComEspacos:modelo!==modelo.trim(),modelo:modelo.trim()}));
 async function conferir(k,m,etapa){
  try{
   const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',signal:AbortSignal.timeout(20000),headers:{'content-type':'application/json','x-api-key':k,'anthropic-version':'2023-06-01'},body:JSON.stringify({model:m,max_tokens:8,messages:[{role:'user',content:'Responda apenas OK.'}]})});
   const d=await r.json().catch(()=>null);const tipo=/^[a-z_]{1,50}$/.test(d?.error?.type||'')?d.error.type:null;
   console.log('quiz_provedor',JSON.stringify({etapa,status:r.status,tipo}));return r.ok;
  }catch(e){console.log('quiz_provedor',JSON.stringify({etapa,erro:'transporte'}));return false;}
 }
 if(!chave||!modelo)throw Error('Configuração da IA ausente no ambiente da implantação.');
 if(chave!==chave.trim()||modelo!==modelo.trim())await conferir(chave,modelo,'configuracao_original');
 if(!await conferir(chave.trim(),modelo.trim(),'configuracao_normalizada'))throw Error('O provedor recusou a configuração normalizada da implantação.');
})().finally(()=>clearInterval(keepAlive)).catch(e=>{console.error('quiz_verificacao_falhou',e.message);process.exitCode=1;});
