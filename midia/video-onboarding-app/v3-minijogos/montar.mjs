// Mixa voz + efeitos + música (a música abaixa quando a voz entra) e junta com os quadros.
import {execFileSync} from 'node:child_process';import fs from 'node:fs';
const T=JSON.parse(fs.readFileSync('tempos.json')),fr=T.cenas.flatMap(c=>c.frases),M=157.72,BT=60/71.4; // M: batida forte onde a música entra
const cues=[];T.cenas.forEach((c,i)=>{if(i>0)cues.push(['sfx/whoosh-curto-1.wav',c.inicio+.42,.45]);cues.push(['sfx/pop-1.wav',c.inicio+.78,.3]);
 if(c.id==='gancho')cues.push(['sfx/sucesso-1.wav',Math.round((c.frases[1].inicio+.4)/BT)*BT,.45]);if(c.id==='medalhas')for(let k=0;k<5;k++)cues.push(['sfx/pop-2.wav',c.frases[1].inicio+k*(c.frases[1].dur-.4)/5,.3]);if(c.id==='entrar')cues.push(['sfx/clique-2.wav',Math.round((c.frases[0].inicio+2.3)/BT)*BT,.45]);});
const v=[...fr.map(f=>f.arquivo),...cues.map(c=>c[0])],n=v.length;
const args=[...v.flatMap(a=>['-i',a]),'-ss',String(M),'-t',String(T.total),'-i','musica.mp3'];
const fil=[...fr.map((f,i)=>{const ms=Math.round(f.inicio*1000);return `[${i}:a]adelay=${ms}|${ms}[a${i}]`;}),...cues.map((c,j)=>{const i=fr.length+j,ms=Math.round(c[1]*1000);return `[${i}:a]volume=${c[2]},adelay=${ms}|${ms}[a${i}]`;})].join(';')+';'+[...Array(n).keys()].map(i=>`[a${i}]`).join('')+`amix=inputs=${n}:normalize=0:dropout_transition=0,aformat=channel_layouts=stereo,asplit=2[voz][chave];[${n}:a]aformat=channel_layouts=stereo,volume=0.3,afade=t=out:st=${T.total-2.5}:d=2.5[mus];[mus][chave]sidechaincompress=threshold=0.015:ratio=14:attack=15:release=350[duck];[voz][duck]amix=inputs=2:normalize=0,loudnorm=I=-14:TP=-1.5,apad=whole_dur=${T.total}[o]`;
execFileSync('ffmpeg',['-y','-loglevel','error',...args,'-filter_complex',fil,'-map','[o]','-t',String(T.total),'locucao.wav']);
execFileSync('ffmpeg',['-y','-loglevel','error','-framerate','30','-i','quadros/q%05d.jpg','-i','locucao.wav','-c:v','libx264','-preset','medium','-crf','20','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-shortest','-movflags','+faststart','sua-jornada-v11.mp4']);
console.log(execFileSync('ffprobe',['-v','error','-show_entries','format=duration,size','-of','default=nw=1','sua-jornada-v11.mp4']).toString());
