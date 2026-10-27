// Ilustrações vetoriais da integração (SVG desenhado à mão, paleta do app). Partes animadas levam data-v="tipo:fase".
const PELES=['#f2c6a0','#c98f68','#8a5a3c','#e0a97c'],CABELOS=['#2b1a14','#4a2c1d','#15100e','#7a4a24'];
const defs=`<svg width="0" height="0" style="position:absolute"><defs>
<linearGradient id="gOuro" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff0b0"/><stop offset=".45" stop-color="#e8b94a"/><stop offset="1" stop-color="#a9842a"/></linearGradient>
<linearGradient id="gOuroV" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd97a"/><stop offset="1" stop-color="#b8892c"/></linearGradient>
<linearGradient id="gVinho" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e01228"/><stop offset="1" stop-color="#7a0f1a"/></linearGradient>
<linearGradient id="gCreme" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffaf4"/><stop offset="1" stop-color="#e6d3cb"/></linearGradient>
<linearGradient id="gPedra" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f3e3d6"/><stop offset="1" stop-color="#bfa497"/></linearGradient>
<linearGradient id="gPedraEsc" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#a98d82"/><stop offset="1" stop-color="#d9c2b6"/></linearGradient>
<linearGradient id="gPorta" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff2b8"/><stop offset="1" stop-color="#f0a53a"/></linearGradient>
<linearGradient id="gTela" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a0d15"/><stop offset="1" stop-color="#12060a"/></linearGradient>
<radialGradient id="rLuz"><stop offset="0" stop-color="#ffd97a" stop-opacity=".75"/><stop offset="1" stop-color="#ffd97a" stop-opacity="0"/></radialGradient>
<radialGradient id="rChao"><stop offset="0" stop-color="#000" stop-opacity=".5"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
<linearGradient id="gMadeira" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b8814f"/><stop offset="1" stop-color="#7a4a24"/></linearGradient>
</defs></svg>`;
const fx=(n,d=0)=>+n.toFixed(2);
const brilho=(x,y,r,fase)=>`<path data-v="brilho:${fase}" transform="translate(${x} ${y})" d="M0 ${-r}Q${r*.18} ${-r*.18} ${r} 0Q${r*.18} ${r*.18} 0 ${r}Q${-r*.18} ${r*.18} ${-r} 0Q${-r*.18} ${-r*.18} 0 ${-r}Z" fill="#fff3c4"/>`;
const chama=(x,y,s,fase)=>`<g transform="translate(${x} ${y}) scale(${s})"><g data-v="chama:${fase}"><ellipse cx="0" cy="-6" rx="30" ry="40" fill="url(#rLuz)"/><path d="M0 -34Q14 -14 10 0Q6 10 0 10Q-6 10 -10 0Q-14 -14 0 -34Z" fill="#ffb02e"/><path d="M0 -20Q7 -8 5 0Q3 5 0 5Q-3 5 -5 0Q-7 -8 0 -20Z" fill="#fff6c8"/></g></g>`;
const vela=(x,y,h,fase)=>`<g><rect x="${x-9}" y="${y}" width="18" height="${h}" rx="3" fill="url(#gCreme)"/><rect x="${x-9}" y="${y}" width="6" height="${h}" rx="3" fill="#fff" opacity=".5"/>${chama(x,y-6,.55,fase)}</g>`;
const cruzOuro=(x,y,h)=>{const w=h*.55;return `<g><rect x="${x-7}" y="${y}" width="14" height="${h}" rx="5" fill="url(#gOuroV)"/><rect x="${x-w/2}" y="${y+h*.18}" width="${w}" height="14" rx="5" fill="url(#gOuroV)"/><circle cx="${x}" cy="${y+h*.18+7}" r="11" fill="#ffd97a" stroke="#a9842a" stroke-width="3"/></g>`;};
// pessoa em coordenadas locais (pés em y=400, cabeça ~y=75); pose: {esq:[x,y], dir:[x,y]} = posição das mãos
function pessoa({x,y,s=1,pele=0,cab=0,pose,item='',acen=false,olhar=0}){const P=PELES[pele%4],C=CABELOS[cab%4],[ex,ey]=pose.esq,[dx,dy]=pose.dir;
 return `<g transform="translate(${x} ${y}) scale(${s})"><ellipse cx="0" cy="404" rx="92" ry="16" fill="url(#rChao)"/>
 <ellipse cx="-30" cy="396" rx="26" ry="12" fill="#1c0f0f"/><ellipse cx="30" cy="396" rx="26" ry="12" fill="#1c0f0f"/>
 <path d="M-56 128Q-72 262 -82 396L82 396Q72 262 56 128Q0 104 -56 128Z" fill="url(#gCreme)"/>
 <path d="M-30 190Q-34 290 -40 396M0 170V396M30 190Q34 290 40 396" stroke="#d6c0b6" stroke-width="3" fill="none" opacity=".8" stroke-linecap="round"/>
 <path d="M-60 258Q0 282 60 258L56 276Q0 300 -56 276Z" fill="url(#gVinho)"/><path d="M44 272Q58 330 40 372" stroke="#b30f21" stroke-width="9" stroke-linecap="round" fill="none"/>
 <path d="M-50 134L${ex} ${ey}" stroke="url(#gCreme)" stroke-width="38" stroke-linecap="round" fill="none"/><path d="M50 134L${dx} ${dy}" stroke="url(#gCreme)" stroke-width="38" stroke-linecap="round" fill="none"/>
 <path d="M-50 134L${ex} ${ey}M50 134L${dx} ${dy}" stroke="#d6c0b6" stroke-width="3" opacity=".7" fill="none" stroke-linecap="round" transform="translate(0 4)"/>
 ${item}
 <circle cx="${ex}" cy="${ey}" r="15" fill="${P}"/><circle cx="${dx}" cy="${dy}" r="15" fill="${P}"/>
 <rect x="-14" y="98" width="28" height="30" rx="10" fill="${P}"/><path d="M-30 124Q0 146 30 124L24 112Q0 126 -24 112Z" fill="url(#gVinho)"/>
 <circle cx="0" cy="68" r="48" fill="${P}"/><ellipse cx="-47" cy="72" rx="8" ry="12" fill="${P}"/><ellipse cx="47" cy="72" rx="8" ry="12" fill="${P}"/>
 <path d="M-50 62Q-48 16 0 14Q48 16 50 62Q40 36 8 38Q-20 40 -50 62Z" fill="${C}"/>
 <circle cx="${-17+olhar}" cy="72" r="5.5" fill="#2a1612"/><circle cx="${17+olhar}" cy="72" r="5.5" fill="#2a1612"/><circle cx="${-15+olhar}" cy="70" r="1.8" fill="#fff"/><circle cx="${19+olhar}" cy="70" r="1.8" fill="#fff"/>
 <path d="M-14 90Q0 ${acen?106:100} 14 90" stroke="#7a2e22" stroke-width="5" stroke-linecap="round" fill="none"/><circle cx="-30" cy="86" r="8" fill="#ff8a7a" opacity=".35"/><circle cx="30" cy="86" r="8" fill="#ff8a7a" opacity=".35"/></g>`;}
const fundo=(extra='')=>`<circle cx="400" cy="400" r="330" fill="url(#rLuz)" opacity=".55"/>${extra}`;
const ARTE={};
ARTE.abertura=`<svg viewBox="0 0 800 800">${fundo()}
 <g data-v="raios:0" data-c="400 330" opacity=".35">${[...Array(12)].map((_,i)=>`<path d="M0 0L${fx(-26)} -330L${fx(26)} -330Z" fill="url(#rLuz)" transform="rotate(${i*30})"/>`).join('')}</g>
 <ellipse cx="400" cy="716" rx="320" ry="26" fill="url(#rChao)"/>
 <rect x="150" y="410" width="140" height="300" fill="url(#gPedraEsc)"/><path d="M130 410L220 350L310 410Z" fill="url(#gVinho)"/>
 <rect x="200" y="140" width="110" height="272" fill="url(#gPedra)"/><path d="M188 142L255 70L322 142Z" fill="url(#gVinho)"/><rect x="249" y="24" width="12" height="52" rx="4" fill="url(#gOuroV)"/><rect x="234" y="38" width="42" height="11" rx="4" fill="url(#gOuroV)"/>
 <path d="M226 270V210Q255 176 284 210V270Z" fill="#2a0d15"/><path d="M236 266V214Q255 190 274 214V266Z" fill="url(#gPorta)"/>
 <rect x="290" y="330" width="360" height="380" fill="url(#gPedra)"/><path d="M270 332L470 214L670 332Z" fill="url(#gVinho)"/><path d="M270 332L470 214L670 332" stroke="#ffd97a" stroke-width="5" fill="none" opacity=".6"/>
 <circle cx="470" cy="300" r="42" fill="#2a0d15"/><circle cx="470" cy="300" r="34" fill="url(#gPorta)"/><path d="M470 266V334M436 300H504M446 276L494 324M494 276L446 324" stroke="#7a0f1a" stroke-width="5"/>
 <path d="M410 710V500Q470 420 530 500V710Z" fill="#2a0d15"/><path d="M420 710V504Q470 436 520 504V710Z" fill="url(#gPorta)"/><path d="M470 440V710" stroke="#a9842a" stroke-width="4"/>
 <rect x="380" y="690" width="180" height="22" rx="4" fill="#d9c2b6"/><rect x="362" y="708" width="216" height="20" rx="4" fill="#bfa497"/>
 <rect x="560" y="410" width="70" height="300" fill="url(#gPedraEsc)" opacity=".7"/>
 <ellipse cx="470" cy="700" rx="120" ry="18" fill="#ffd97a" opacity=".35"/>
 ${brilho(120,170,22,0)}${brilho(690,120,16,1.7)}${brilho(610,210,12,3.1)}${brilho(80,420,14,2.2)}${brilho(730,400,18,.9)}</svg>`;
ARTE.pastoral=`<svg viewBox="0 0 800 800">${fundo()}
 ${pessoa({x:135,y:250,s:.88,pele:1,cab:2,pose:{esq:[-70,230],dir:[-52,200]},item:vela(-52,70,140,0)})}
 ${pessoa({x:665,y:250,s:.88,pele:2,cab:1,acen:true,pose:{esq:[52,200],dir:[70,230]},item:vela(52,70,140,2.1)})}
 ${pessoa({x:400,y:200,s:1.02,pele:0,cab:3,acen:true,pose:{esq:[-30,210],dir:[30,210]},item:cruzOuro(0,-165,370)})}
 ${brilho(400,60,24,0)}${brilho(140,90,14,1.3)}${brilho(690,80,16,2.7)}</svg>`;
ARTE.missas=`<svg viewBox="0 0 800 800">${fundo()}
 <g data-v="raios:1" data-c="400 380" opacity=".4">${[...Array(16)].map((_,i)=>`<path d="M0 0L-18 -350L18 -350Z" fill="url(#rLuz)" transform="rotate(${i*22.5})"/>`).join('')}</g>
 <circle cx="400" cy="380" r="170" fill="#ffd97a" opacity=".16"/>
 <path d="M130 740V330Q130 120 400 120Q670 120 670 330V740Z" fill="url(#gPedraEsc)"/><path d="M170 740V332Q170 160 400 160Q630 160 630 332V740Z" fill="#1a0a10"/>
 <rect x="150" y="130" width="500" height="34" rx="12" fill="url(#gMadeira)" transform="translate(0 70)"/>
 <g transform="translate(400 206)"><g data-v="sino:0"><rect x="-14" y="-22" width="28" height="36" rx="8" fill="url(#gMadeira)"/>
 <path d="M-96 250Q-94 120 -52 60Q-34 30 0 22Q34 30 52 60Q94 120 96 250Q112 262 112 286H-112Q-112 262 -96 250Z" fill="url(#gOuro)"/>
 <path d="M-70 250Q-70 140 -36 86" stroke="#fff3c4" stroke-width="12" stroke-linecap="round" fill="none" opacity=".65"/><path d="M-112 286H112" stroke="#a9842a" stroke-width="8"/><path d="M-100 250H100" stroke="#a9842a" stroke-width="5" opacity=".7"/>
 <circle cx="0" cy="318" r="24" fill="#a9842a"/><circle cx="-6" cy="312" r="8" fill="#ffd97a"/></g></g>
 <ellipse cx="400" cy="745" rx="270" ry="20" fill="url(#rChao)"/>
 <rect x="372" y="20" width="14" height="70" rx="5" fill="url(#gOuroV)" transform="translate(14 0)"/><rect x="352" y="42" width="56" height="13" rx="5" fill="url(#gOuroV)" transform="translate(32 0)"/>
 ${brilho(130,150,20,0.6)}${brilho(690,300,16,2)}${brilho(620,110,12,1.4)}${brilho(90,520,13,3)}</svg>`;
ARTE.escala=`<svg viewBox="0 0 800 800">${fundo()}
 <g transform="translate(270 70)"><rect x="0" y="0" width="300" height="600" rx="46" fill="#0b0508" stroke="url(#gOuro)" stroke-width="6"/><rect x="14" y="14" width="272" height="572" rx="34" fill="url(#gTela)"/><rect x="110" y="26" width="80" height="18" rx="9" fill="#0b0508"/>
 <rect x="34" y="70" width="232" height="46" rx="12" fill="url(#gVinho)"/><circle cx="62" cy="93" r="13" fill="#ffd97a"/><rect x="86" y="84" width="120" height="10" rx="5" fill="#fff" opacity=".85"/><rect x="86" y="101" width="80" height="8" rx="4" fill="#fff" opacity=".5"/>
 ${[0,1,2,3,4].map(i=>`<g data-v="linha:${i}"><rect x="34" y="${138+i*84}" width="232" height="68" rx="14" fill="${i==1||i==3?'#3a1520':'#241018'}" stroke="${i==1||i==3?'#e8b94a':'#3a1d28'}" stroke-width="${i==1||i==3?3:1.5}"/><circle cx="68" cy="${172+i*84}" r="20" fill="${['#c98f68','#f2c6a0','#8a5a3c','#e0a97c','#c98f68'][i]}"/><rect x="104" y="${158+i*84}" width="${[110,90,120,84,100][i]}" height="11" rx="5" fill="#f7ebe7" opacity=".85"/><rect x="104" y="${178+i*84}" width="${[70,100,60,90,50][i]}" height="9" rx="4" fill="#b99a96" opacity=".6"/>${i==1||i==3?`<circle cx="244" cy="${172+i*84}" r="9" fill="#e8b94a"/>`:''}</g>`).join('')}</g>
 <g data-v="bolha:0" transform="translate(540 190)"><path d="M0 0H230Q258 0 258 28V92Q258 120 230 120H70L26 156V120H0Q-28 120 -28 92V28Q-28 0 0 0Z" fill="#0b5f4a"/><path data-v="check:0" d="M62 62L98 96L168 24" transform="translate(30 6)" stroke="#eafff6" stroke-width="16" stroke-linecap="round" stroke-linejoin="round" fill="none"/><rect x="150" y="48" width="82" height="12" rx="6" fill="#eafff6" opacity=".55"/><rect x="150" y="70" width="52" height="10" rx="5" fill="#eafff6" opacity=".35"/></g>
 <g transform="translate(70 470)"><rect x="0" y="40" width="190" height="200" rx="26" fill="url(#gCreme)"/><path d="M0 66Q0 40 26 40H164Q190 40 190 66V92H0Z" fill="url(#gVinho)"/><rect x="40" y="14" width="16" height="44" rx="8" fill="url(#gOuroV)"/><rect x="134" y="14" width="16" height="44" rx="8" fill="url(#gOuroV)"/>${[0,1,2,3,4,5,6,7,8,9,10,11,12,13].map(i=>{const c=i%7,r=Math.floor(i/7),on=(i==9||i==2);return `<circle cx="${28+c*22}" cy="${128+r*52}" r="${on?11:6}" fill="${on?'#e8b94a':'#d6c0b6'}" ${on?`data-v="marca:${i}"`:''}/>`}).join('')}</g>
 ${brilho(120,150,20,.5)}${brilho(720,520,16,2.2)}${brilho(660,720,12,1.1)}</svg>`;
ARTE.veste=`<svg viewBox="0 0 800 800">${fundo()}
 <g data-v="balanco:0" transform="translate(400 60)"><path d="M0 0V40" stroke="#a9842a" stroke-width="10" stroke-linecap="round"/><path d="M-6 36Q-40 36 -40 62" stroke="#a9842a" stroke-width="10" stroke-linecap="round" fill="none"/>
 <path d="M-250 120L0 62L250 120Q256 128 250 136L0 100L-250 136Q-256 128 -250 120Z" fill="url(#gMadeira)"/>
 <path d="M-86 108Q0 150 86 108L170 128Q250 150 296 330L240 360L196 250Q200 520 220 640Q0 690 -220 640Q-200 520 -196 250L-240 360L-296 330Q-250 150 -170 128Z" fill="url(#gCreme)"/>
 <path d="M-86 108Q0 150 86 108L70 130Q0 176 -70 130Z" fill="url(#gVinho)"/>
 <path d="M-120 250Q-130 450 -150 640M-50 190Q-56 430 -64 656M50 190Q56 430 64 656M120 250Q130 450 150 640" stroke="#d6c0b6" stroke-width="4" fill="none" stroke-linecap="round" opacity=".85"/>
 <path d="M-206 396Q0 444 206 396L202 424Q0 474 -202 424Z" fill="url(#gVinho)"/><path d="M150 430Q178 520 150 600" stroke="#b30f21" stroke-width="12" stroke-linecap="round" fill="none"/></g>
 <ellipse cx="400" cy="744" rx="300" ry="20" fill="url(#rChao)"/>
 <g transform="translate(400 706)"><path d="M-170 -4Q-170 -38 -120 -40H-70Q-40 -40 -30 -4V8H-170Z" fill="#1c0f0f"/><path d="M170 -4Q170 -38 120 -40H70Q40 -40 30 -4V8H170Z" fill="#1c0f0f"/><path d="M-160 -22Q-120 -34 -80 -30" stroke="#4a2c2c" stroke-width="5" stroke-linecap="round" fill="none"/><path d="M160 -22Q120 -34 80 -30" stroke="#4a2c2c" stroke-width="5" stroke-linecap="round" fill="none"/></g>
 ${brilho(190,230,26,0)}${brilho(640,200,20,1.4)}${brilho(600,420,16,2.6)}${brilho(160,430,18,3.4)}${brilho(560,620,14,.7)}</svg>`;
const ticks=[...Array(12)].map((_,i)=>`<rect x="-4" y="-210" width="8" height="${i%3==0?28:16}" rx="3" fill="#7a0f1a" transform="rotate(${i*30})"/>`).join('');
ARTE.chegada=`<svg viewBox="0 0 800 800">${fundo()}
 <g transform="translate(470 330)"><circle r="236" fill="url(#gMadeira)"/><circle r="216" fill="url(#gCreme)"/><circle r="216" fill="none" stroke="url(#gOuro)" stroke-width="10"/>${ticks}
 <path data-v="arco:0" d="M0 0V-190A190 190 0 0 1 164.5 -95Z" fill="#e8b94a" opacity=".55"/>
 <g data-v="ponteiro:0"><rect x="-5" y="-172" width="10" height="190" rx="5" fill="#7a0f1a"/></g><rect x="-8" y="-118" width="16" height="130" rx="8" fill="#2a0d15" transform="rotate(-60)"/><circle r="16" fill="url(#gOuroV)"/></g>
 ${pessoa({x:190,y:300,s:.7,pele:2,cab:0,acen:true,pose:{esq:[-70,250],dir:[78,170]}})}
 <g transform="translate(560 640) rotate(-6)"><rect x="0" y="0" width="150" height="86" rx="18" fill="#0b0508" stroke="url(#gOuro)" stroke-width="4"/><rect x="8" y="8" width="134" height="70" rx="12" fill="url(#gTela)"/><path d="M92 22A22 22 0 1 0 108 56A17 17 0 1 1 92 22Z" fill="#ffd97a" transform="translate(-18 4)"/><path d="M20 18l-7 7M20 48l-7-7" stroke="#f7ebe7" stroke-width="3" opacity="0"/></g>
 <g transform="translate(120 700)"><circle r="30" cy="-10" fill="#e01228"/><path d="M0 -40Q10 -56 24 -52" stroke="#4a8a3a" stroke-width="7" stroke-linecap="round" fill="none"/><ellipse cx="22" cy="-52" rx="14" ry="7" fill="#4a8a3a" transform="rotate(-20 22 -52)"/><circle cx="-10" cy="-18" r="5" fill="#fff" opacity=".4"/></g>
 ${brilho(120,120,22,0)}${brilho(700,160,16,1.7)}${brilho(740,540,14,2.5)}</svg>`;
ARTE.fecho=`<svg viewBox="0 0 800 800">${fundo()}
 <g data-v="raios:2" data-c="400 380" opacity=".4">${[...Array(14)].map((_,i)=>`<path d="M0 0L-22 -380L22 -380Z" fill="url(#rLuz)" transform="rotate(${i*25.7})"/>`).join('')}</g>
 ${pessoa({x:95,y:395,s:.62,pele:1,cab:1,pose:{esq:[-44,230],dir:[44,226]},acen:true})}
 ${pessoa({x:705,y:395,s:.62,pele:3,cab:3,pose:{esq:[-44,226],dir:[44,230]},acen:true})}
 ${pessoa({x:250,y:350,s:.72,pele:0,cab:2,pose:{esq:[-44,230],dir:[56,180]},acen:true})}
 ${pessoa({x:550,y:350,s:.72,pele:2,cab:0,pose:{esq:[-56,180],dir:[44,230]},acen:true})}
 ${pessoa({x:400,y:300,s:.84,pele:1,cab:0,pose:{esq:[-50,226],dir:[70,120]},acen:true})}
 <g data-v="pomba:0" transform="translate(400 120)"><path d="M-70 10Q-30 -40 10 -10Q40 -50 90 -20Q50 -2 30 18Q60 50 10 52Q-20 52 -50 30Z" fill="url(#gCreme)"/><path d="M-4 -6Q-60 -70 -120 -52Q-76 -18 -32 22Z" fill="#e6d3cb"/><circle cx="60" cy="-6" r="4" fill="#2a1612"/><path d="M92 -16L116 -10L94 -2Z" fill="#e8b94a"/></g>
 ${brilho(80,120,22,0)}${brilho(720,110,18,1.6)}${brilho(200,40,12,2.2)}${brilho(620,50,14,.8)}</svg>`;
// animação por tempo (determinística): chama pisca, brilho pulsa, raios giram, sino balança, ponteiro anda, pomba bate asa
function viva(t){document.querySelectorAll('[data-v]').forEach(el=>{const [k,f]=el.dataset.v.split(':'),p=+f;
 if(k==='chama'){const s=1+.1*Math.sin(t*14+p)+.05*Math.sin(t*23+p*2);el.setAttribute('transform',`scale(${(1/s).toFixed(3)} ${s.toFixed(3)}) rotate(${(Math.sin(t*9+p)*4).toFixed(2)})`);}
 else if(k==='brilho'){const a=(Math.sin(t*2.4+p)+1)/2;el.style.opacity=(.15+.85*a).toFixed(3);const b=el.getAttribute('transform').replace(/ scale\([^)]*\)/,'');el.setAttribute('transform',b+` scale(${(.6+.5*a).toFixed(3)})`);}
 else if(k==='raios'){el.setAttribute('transform',`translate(${el.dataset.c}) rotate(${(t*5*(1+p*.2)).toFixed(2)})`);}
 else if(k==='sino'){el.setAttribute('transform',`rotate(${(Math.sin(t*2.1)*7).toFixed(2)})`);}
 else if(k==='ponteiro'){el.setAttribute('transform',`rotate(${(t*18).toFixed(2)})`);}
 else if(k==='balanco'){}
 else if(k==='pomba'){const w=Math.sin(t*5);el.setAttribute('transform',`translate(400 ${(120+Math.sin(t*1.3)*10).toFixed(1)}) rotate(${(w*2).toFixed(2)})`);}
});}
window.ARTE=ARTE;window.viva=viva;window.ARTE_DEFS=defs;
