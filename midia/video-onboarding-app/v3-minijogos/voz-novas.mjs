// Gera só as frases indicadas (ex.: node voz-novas.mjs 12 13), com a mesma voz do vídeo aprovado.
import {execFileSync} from 'node:child_process';import fs from 'node:fs';import {CENAS} from './roteiro.mjs';
const REF='89a3ff771f244bd3a93d4f942a4401da',quero=process.argv.slice(2).map(Number);
const K=execFileSync('security',['find-generic-password','-s','fishaudio-api','-w']).toString().trim();
let n=0;for(const c of CENAS)for(const f of c.frases){n++;if(!quero.includes(n))continue;const id=String(n).padStart(2,'0');
 const r=await fetch('https://api.fish.audio/v1/tts',{method:'POST',headers:{Authorization:'Bearer '+K,'Content-Type':'application/json',model:'s2.1-pro-free'},body:JSON.stringify({text:f.say,reference_id:REF,format:'mp3'})});
 if(!r.ok){console.error(id,'HTTP',r.status,await r.text());process.exit(1);}
 fs.writeFileSync(`audio/${id}.mp3`,Buffer.from(await r.arrayBuffer()));console.log(id,f.say.slice(0,60));}
