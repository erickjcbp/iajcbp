// Usa a locução gravada (audio/01.mp3 … 19.mp3, uma por frase), apara o silêncio das pontas, mede e escreve tempos.json.
import {execFileSync} from 'node:child_process';import fs from 'node:fs';import {CENAS} from './roteiro.mjs';
const GAP_CENA=1.1,GAP_FRASE=0.35,INICIO=0.6;let t=INICIO,n=0;const cenas=[];
for(const [ci,c] of CENAS.entries()){const frases=[];const cenaIni=t;t+=GAP_CENA;
 for(const f of c.frases){n++;const id=String(n).padStart(2,'0'),src=`audio/${id}.mp3`,dst=`audio/${id}.wav`;
  execFileSync('ffmpeg',['-y','-loglevel','error','-i',src,'-af','silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.08,areverse,loudnorm=I=-16:TP=-1.5','-ar','44100','-ac','1',dst]);
  const dur=Number(execFileSync('ffprobe',['-v','error','-show_entries','format=duration','-of','csv=p=0',dst]).toString());
  frases.push({show:f.show,arquivo:dst,inicio:+t.toFixed(3),dur:+dur.toFixed(3)});t+=dur+GAP_FRASE;}
 cenas.push({id:c.id,chave:c.chave,inicio:+cenaIni.toFixed(3),frases,fim:+(t+0.4).toFixed(3)});t+=0.4;}
const total=+(t+0.8).toFixed(3);fs.writeFileSync('tempos.json',JSON.stringify({total,cenas},null,1));
fs.writeFileSync('tempos.js','const T='+JSON.stringify({total,cenas})+';');console.log('frases',n,'total',total,'s');
