// Junta a locução (no tempo de tempos.json) com os quadros num MP4 1080x1920. Voz + efeitos nos pontos de virada.
import {execFileSync} from 'node:child_process';import fs from 'node:fs';
const T=JSON.parse(fs.readFileSync('tempos.json')),fr=T.cenas.flatMap(c=>c.frases);
const cues=[];T.cenas.forEach((c,i)=>{if(i>0)cues.push(['sfx/whoosh-curto-1.wav',c.inicio+.42,.45]);cues.push(['sfx/pop-1.wav',c.inicio+.78,.3]);
 if(c.id==='chamado')cues.push(['sfx/sino-2.wav',c.inicio+1.3,.35]);if(c.id==='medalhas'){for(let k=0;k<6;k++)cues.push(['sfx/pop-2.wav',c.frases[0].inicio+1+k*.34,.3]);cues.push(['sfx/sucesso-1.wav',c.frases[0].inicio+2.9,.35]);}if(c.id==='casas')for(let k=0;k<5;k++)cues.push(['sfx/pop-1.wav',c.frases[0].inicio+.4+k*.7,.3]);if(c.id==='entrar')cues.push(['sfx/clique-2.wav',c.frases[1].inicio+3,.45],['sfx/notificacao-1.wav',c.frases[1].inicio+3.4,.35]);if(c.id==='fecho')cues.push(['sfx/sino-1.wav',c.inicio+1.3,.35]);});
const args=[...fr.map(f=>f.arquivo),...cues.map(c=>c[0])].flatMap(a=>['-i',a]);
const n=fr.length+cues.length;
const fil=[...fr.map((f,i)=>{const ms=Math.round(f.inicio*1000);return `[${i}:a]adelay=${ms}|${ms}[a${i}]`;}),...cues.map((c,j)=>{const i=fr.length+j,ms=Math.round(c[1]*1000);return `[${i}:a]volume=${c[2]},adelay=${ms}|${ms}[a${i}]`;})].join(';')+';'+[...Array(n).keys()].map(i=>`[a${i}]`).join('')+`amix=inputs=${n}:normalize=0:dropout_transition=0,loudnorm=I=-14:TP=-1.5,apad=whole_dur=${T.total}[o]`;
execFileSync('ffmpeg',['-y','-loglevel','error',...args,'-filter_complex',fil,'-map','[o]','-t',String(T.total),'locucao.wav']);
execFileSync('ffmpeg',['-y','-loglevel','error','-framerate','30','-i','quadros/q%05d.jpg','-i','locucao.wav','-c:v','libx264','-preset','medium','-crf','20','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-shortest','-movflags','+faststart','sua-jornada-v4.mp4']);
console.log(execFileSync('ffprobe',['-v','error','-show_entries','format=duration,size','-of','default=nw=1','sua-jornada-v4.mp4']).toString());
