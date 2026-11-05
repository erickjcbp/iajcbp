// Gera audio/NN.mp3 (uma por frase) pelo Fish Audio, modelo grátis. Chave no chaveiro: fishaudio-api.
// Uso: node voz-fish.mjs [reference_id]   (padrão: "Jesus - The Chosen" PT, gabrielreron)
import {execFileSync} from 'node:child_process';import fs from 'node:fs';import {CENAS} from './roteiro.mjs';
const REF=process.argv[2]||'89a3ff771f244bd3a93d4f942a4401da';
const K=execFileSync('security',['find-generic-password','-s','fishaudio-api','-w']).toString().trim();
let n=0;for(const c of CENAS)for(const f of c.frases){n++;const id=String(n).padStart(2,'0');
 const r=await fetch('https://api.fish.audio/v1/tts',{method:'POST',headers:{Authorization:'Bearer '+K,'Content-Type':'application/json',model:'s2.1-pro-free'},body:JSON.stringify({text:f.say,reference_id:REF,format:'mp3'})});
 if(!r.ok){console.error(id,'HTTP',r.status,await r.text());process.exit(1);}
 fs.writeFileSync(`audio/${id}.mp3`,Buffer.from(await r.arrayBuffer()));console.log(id,f.say.slice(0,50));}
