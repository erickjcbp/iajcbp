// Junta a locução (no tempo de tempos.json) com os quadros num MP4 1080x1920. Piloto: só voz, sem efeitos.
import {execFileSync} from 'node:child_process';import fs from 'node:fs';
const T=JSON.parse(fs.readFileSync('tempos.json')),fr=T.cenas.flatMap(c=>c.frases);
const args=fr.flatMap(f=>['-i',f.arquivo]);
const fil=fr.map((f,i)=>{const ms=Math.round(f.inicio*1000);return `[${i}:a]adelay=${ms}|${ms}[a${i}]`;}).join(';')+';'+fr.map((_,i)=>`[a${i}]`).join('')+`amix=inputs=${fr.length}:normalize=0:dropout_transition=0,loudnorm=I=-14:TP=-1.5,apad=whole_dur=${T.total}[o]`;
execFileSync('ffmpeg',['-y','-loglevel','error',...args,'-filter_complex',fil,'-map','[o]','-t',String(T.total),'locucao.wav']);
execFileSync('ffmpeg',['-y','-loglevel','error','-framerate','30','-i','quadros/q%05d.jpg','-i','locucao.wav','-c:v','libx264','-preset','medium','-crf','20','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-shortest','-movflags','+faststart','onboarding-app-piloto.mp4']);
console.log(execFileSync('ffprobe',['-v','error','-show_entries','format=duration,size','-of','default=nw=1','onboarding-app-piloto.mp4']).toString());
