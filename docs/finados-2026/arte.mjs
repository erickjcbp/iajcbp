import { createRequire } from 'node:module'
import { writeFileSync, mkdirSync } from 'node:fs'
const require = createRequire('/Users/erickmartins/projetos/iajcbp/arte-escala/')
const puppeteer = require('puppeteer')
const A='/Users/erickmartins/projetos/iajcbp/'
const brasao='file://'+A+'midia/logos/brasao-pastoral.png'
const sora='file://'+A+'arte-escala/assets/sora.woff2'
const inter='file://'+A+'arte-escala/assets/inter.woff2'
const cor='#4B2E6F', esc='#2E1B47'
const html=`<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:Sora;src:url(${sora});font-weight:100 900}
@font-face{font-family:Inter;src:url(${inter});font-weight:100 900}
*{box-sizing:border-box;margin:0}
body{width:1080px;height:1350px;background:#F4E9D8;font-family:Inter,sans-serif;color:#2B1C0E;position:relative;overflow:hidden}
.frame{position:absolute;inset:36px;border:4px solid ${cor};border-radius:36px}
.frame2{position:absolute;inset:52px;border:1.5px solid ${cor}88;border-radius:24px}
.brasao{position:absolute;top:64px;left:50%;transform:translateX(-50%);width:300px;height:300px}
.kicker{position:absolute;top:372px;width:100%;text-align:center;font:700 28px Sora;letter-spacing:.34em;color:${esc}}
.t1{position:absolute;top:424px;width:100%;text-align:center;font:600 44px Sora;letter-spacing:.3em;color:${esc}}
.t2{position:absolute;top:500px;width:100%;text-align:center;font:800 132px/1 Sora;color:${cor};letter-spacing:-.02em}
.card{position:absolute;left:100px;right:100px;border-radius:28px;background:${cor};border:5px solid ${esc};box-shadow:0 10px 0 ${esc};color:#FBF7EC;padding:20px 40px}
.c1{top:650px}.c2{top:900px}
.dia{font:700 30px Sora;letter-spacing:.2em}
.data{font:800 54px/1.05 Sora;margin-top:2px}
.hs{font:800 40px/1.1 Sora;margin-top:4px}
.fn{font:600 28px Inter;opacity:.92;margin-top:10px;letter-spacing:.02em}
.msg{position:absolute;top:1200px;width:100%;text-align:center;font:600 32px Inter;color:#2B1C0E}
.rod{position:absolute;top:1252px;width:100%;text-align:center;font:500 22px Inter;letter-spacing:.18em;color:#2B1C0Eb0}
.faixa{position:absolute;left:36px;right:36px;bottom:36px;height:20px;border-radius:0 0 32px 32px;overflow:hidden;display:flex}
.faixa i{flex:1}
</style><body>
<div class="frame"></div><div class="frame2"></div>
<img class="brasao" src="${brasao}">
<div class="kicker">CERIMONIÁRIOS</div>
<div class="t1">LITURGIA DE</div><div class="t2">FINADOS</div>
<div class="card c1"><div class="dia">DOMINGO</div><div class="data">01/11</div><div class="hs">7h · 9h · 19h</div><div class="fn">Turíbulo e Naveta</div></div>
<div class="card c2"><div class="dia">SEGUNDA</div><div class="data">02/11</div><div class="hs">8h</div><div class="fn">Cerimoniários, Cruz, Velas, Turíbulo e Naveta</div></div>
<div class="msg">Marque sua função no link!</div>
<div class="rod">PASTORAL DOS ACÓLITOS · JCBP LIMEIRA</div>
<div class="faixa"><i style="background:#FBF7EC"></i><i style="background:#D0101A"></i><i style="background:#0F1214"></i></div>
</body>`
mkdirSync('html',{recursive:true}); writeFileSync('html/arte-finados.html',html)
const b=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--no-sandbox','--allow-file-access-from-files']})
const p=await b.newPage(); await p.setViewport({width:1080,height:1350,deviceScaleFactor:1})
await p.goto('file://'+process.cwd()+'/html/arte-finados.html',{waitUntil:'networkidle0'}); await p.evaluate(()=>document.fonts.ready)
await p.screenshot({path:'arte-finados-cerimoniarios-v1.png'}); await b.close(); console.log('ok')
