// Mixa locução + efeitos sonoros (no tempo dos eventos visuais) e junta com os quadros num MP4.
import {execFileSync} from 'node:child_process';import fs from 'node:fs';
const T=JSON.parse(fs.readFileSync('tempos.json')),fr=T.cenas.flatMap(c=>c.frases);
// pico (ms) de cada efeito, do catálogo do pack: o pico cai no instante do evento visual
const PICO={'whoosh-curto-1':69,'whoosh-longo-2':612,'sino-1':14,'sino-2':42,'pop-1':15,'pop-2':14,'notificacao-1':37,'sucesso-1':19,'relogio-tique-1':24,'relogio-tiquetaque-1':0,'impacto-1':32,'clique-2':17,'papel-virar-2':84,'riser-curto-1':1204};
const cues=[];const sfx=(nome,evento,vol)=>cues.push({arq:`sfx/${nome}.wav`,at:Math.max(0,evento-PICO[nome]/1000),vol});
T.cenas.forEach((c,i)=>{const t0=c.inicio,f0=c.frases[0];
 if(i>0){sfx('whoosh-curto-1',t0+.5,.5);sfx('papel-virar-2',t0+.62,.3);}   // câmera atravessa a transição
 sfx('pop-1',t0+.78,.35);                                                // a ilustração chega
 if(i===0){sfx('riser-curto-1',t0+1.3,.3);sfx('sino-2',t0+1.3,.3);}
 if(c.id==='missas'){sfx('sino-2',t0+1.5,.4);}
 if(c.id==='escala'){sfx('notificacao-1',t0+1.6,.4);sfx('clique-2',t0+4.0,.35);sfx('clique-2',t0+4.35,.35);}
 if(c.id==='veste'){sfx('papel-virar-2',t0+1.55,.3);}
 if(c.id==='chegada'){cues.push({arq:'sfx/relogio-tiquetaque-1.wav',at:t0+1.3,vol:.3,dur:6});sfx('clique-2',t0+1.85,.35);}
 if(c.id==='fecho'){sfx('pop-2',f0.inicio+f0.dur-.2+.25,.4);sfx('sucesso-1',f0.inicio+f0.dur+.78,.4);sfx('sino-1',c.frases[1].inicio+c.frases[1].dur-.2,.4);}
});
const ins=[...fr.map(f=>f.arquivo),...cues.map(c=>c.arq)],args=ins.flatMap(a=>['-i',a]);
const filtros=[...fr.map((f,i)=>`[${i}:a]adelay=${Math.round(f.inicio*1000)}|${Math.round(f.inicio*1000)}[a${i}]`),
 ...cues.map((c,j)=>{const i=fr.length+j,ms=Math.round(c.at*1000),fade=c.dur?`,afade=t=out:st=${c.dur-1.2}:d=1.2,atrim=0:${c.dur}`:'';return `[${i}:a]volume=${c.vol}${fade},adelay=${ms}|${ms}[a${i}]`;})];
const n=ins.length;
execFileSync('ffmpeg',['-y','-loglevel','error',...args,'-filter_complex',filtros.join(';')+';'+ins.map((_,i)=>`[a${i}]`).join('')+`amix=inputs=${n}:normalize=0:dropout_transition=0,loudnorm=I=-14:TP=-1.5[out]`,'-map','[out]','-t',String(T.total),'locucao.wav']);
execFileSync('ffmpeg',['-y','-loglevel','error','-framerate','30','-i','quadros/q%05d.jpg','-i','locucao.wav','-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p','-colorspace','bt709','-color_primaries','bt709','-color_trc','bt709','-c:a','aac','-b:a','192k','-shortest','-movflags','+faststart','integracao-pastoral.mp4']);
console.log(cues.length,'efeitos',execFileSync('ffprobe',['-v','error','-show_entries','format=duration,size','-of','default=nw=1','integracao-pastoral.mp4']).toString());
