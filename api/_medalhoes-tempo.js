// Usa o cron diário existente; não cria uma função pública/agendamento adicional.
export async function garantirMarcosTempo({url,serviceKey}) {
 const r=await fetch(`${url}/rest/v1/rpc/acolitos_tempo_processar`,{method:'POST',headers:{apikey:serviceKey,Authorization:`Bearer ${serviceKey}`,'Content-Type':'application/json'},body:'{}'});
 if(!r.ok)throw new Error('Processamento de medalhões recusado: '+r.status);
 return r.json();
}
