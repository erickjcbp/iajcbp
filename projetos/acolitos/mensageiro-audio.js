/* Composição original: Caminho da Carta. Ré dórico, 108 BPM, 4 compassos.
   Instrumentos sintetizados localmente. Sem gravações ou bibliotecas externas. */
class MensageiroAudio {
 constructor(){this.ctx=null;this.timer=null;this.musicOn=true;this.fxOn=true;this.nodes=new Set();}
 async unlock(){
  // Safari/iPhone: sessão de mídia evita o silenciamento do Web Audio pela chave lateral.
  try{if(navigator.audioSession)navigator.audioSession.type='playback';}catch(_){}
  if(!this.ctx||this.ctx.state==='closed'){const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return false;this.ctx=new AC();this.music=this.ctx.createGain();this.fx=this.ctx.createGain();this.music.gain.value=this.musicOn?.45:0;this.fx.gain.value=this.fxOn?.55:0;this.music.connect(this.ctx.destination);this.fx.connect(this.ctx.destination);this.ctx.onstatechange=()=>this.onState?.(this.ctx.state);}
  // Buffer mínimo acionado no mesmo toque que criou/retomou o contexto.
  const buffer=this.ctx.createBufferSource();buffer.buffer=this.ctx.createBuffer(1,1,this.ctx.sampleRate);buffer.connect(this.ctx.destination);buffer.start();buffer.onended=()=>buffer.disconnect();
  await this.ctx.resume();this.onState?.(this.ctx.state);return this.ctx.state==='running';
 }
 tone(midi,time,duration,volume=.15,type='triangle',bus=this.music){
  if(!this.ctx)return;const o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type=type;o.frequency.value=440*Math.pow(2,(midi-69)/12);g.gain.setValueAtTime(.0001,time);g.gain.exponentialRampToValueAtTime(volume,time+.012);g.gain.exponentialRampToValueAtTime(.0001,time+duration);o.connect(g);g.connect(bus);o.start(time);o.stop(time+duration+.02);this.nodes.add(o);o.onended=()=>{this.nodes.delete(o);o.disconnect();g.disconnect();};
 }
 start(){
  if(!this.ctx)return;this.stopNotes();this.ctx.resume().catch(()=>{});this.index=0;this.next=this.ctx.currentTime+.06;
  const melody=[74,0,77,81,79,77,76,0,74,0,69,72,74,76,77,0,79,0,81,84,81,79,77,76,74,77,76,72,74,0,69,0];
  const chords=[[50,57,65],[48,55,64],[55,62,69],[50,57,65]];const dt=60/108/2;
  const schedule=()=>{while(this.next<this.ctx.currentTime+.2){const n=this.index,m=melody[n%32],ch=chords[Math.floor(n/8)%4];if(m)this.tone(m,this.next,dt*.83,.12);if(n%8===0)ch.forEach(x=>this.tone(x,this.next,dt*7,.055,'sine'));if(n%4===0)this.tone(ch[0]-12,this.next,.25,.2,'sine');if(n%2===1)this.tone(93,this.next,.035,.025,'triangle');this.next+=dt;this.index++;}};
  schedule();this.timer=setInterval(schedule,80);
 }
 stopNotes(){clearInterval(this.timer);this.timer=null;for(const o of this.nodes){try{o.stop();}catch(_){} }this.nodes.clear();}
 pause(){this.stopNotes();if(this.ctx)this.ctx.suspend().catch(()=>{});}
 setMusic(on){this.musicOn=on;if(this.ctx)this.music.gain.setTargetAtTime(on?.45:0,this.ctx.currentTime,.025);}
 setFx(on){this.fxOn=on;if(this.ctx)this.fx.gain.setTargetAtTime(on?.55:0,this.ctx.currentTime,.025);}
 effect(kind){if(!this.ctx||!this.fxOn)return;const t=this.ctx.currentTime;
  if(kind==='collect'){this.tone(86,t,.09,.22,'sine',this.fx);this.tone(93,t+.055,.12,.15,'sine',this.fx);}
  if(kind==='jump')this.tone(67,t,.13,.1,'triangle',this.fx);
  if(kind==='slide')this.tone(46,t,.16,.13,'triangle',this.fx);
  if(kind==='hit'){this.tone(35,t,.2,.2,'sawtooth',this.fx);this.tone(36,t+.06,.14,.1,'triangle',this.fx);}
  if(kind==='ally')[74,78,81].forEach((n,i)=>this.tone(n,t+i*.07,.23,.14,'triangle',this.fx));
  if(kind==='water')[81,86,93,98].forEach((n,i)=>this.tone(n,t+i*.045,.14,.14,'sine',this.fx));
  if(kind==='combo')[86,93,98].forEach((n,i)=>this.tone(n,t+i*.06,.2,.12,'sine',this.fx));
  if(kind==='warning')[65,65].forEach((n,i)=>this.tone(n,t+i*.15,.09,.10,'triangle',this.fx));
  if(kind==='delivery')[74,77,81,86].forEach((n,i)=>this.tone(n,t+i*.13,.42,.16,'triangle',this.fx));
  if(kind==='stage')[62,69,74].forEach((n,i)=>this.tone(n,t+i*.16,.32,.17,'triangle',this.fx));
  if(kind==='guard')this.tone(29,t+.16,.28,.15,'triangle',this.fx);
  if(kind==='end')[57,53,50].forEach((n,i)=>this.tone(n,t+i*.13,.27,.12,'triangle',this.fx));
  if(kind==='win')[74,77,81,86].forEach((n,i)=>this.tone(n,t+i*.13,.5,.18,'triangle',this.fx));
 }
}
window.MensageiroAudio=MensageiroAudio;
