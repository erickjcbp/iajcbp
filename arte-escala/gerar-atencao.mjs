// Peça padrão de avisos: usa o brasão e as fontes oficiais, sem modificar o brasão.
import puppeteer from 'puppeteer'
import { readFile, writeFile } from 'node:fs/promises'
const asset = async (f) => (await readFile(new URL(`assets/${f}`, import.meta.url))).toString('base64')
const html = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><style>
@font-face{font-family:Sora;src:url(data:font/woff2;base64,${await asset('sora.woff2')})}*{box-sizing:border-box}body{margin:0;background:#f4e9d8;color:#2b1c0e;font-family:Sora,sans-serif}.arte{width:1080px;height:1080px;padding:55px;position:relative;display:flex;align-items:center;flex-direction:column;border-top:20px solid #9e2a2b;border-bottom:20px solid #9e2a2b}.moldura{position:absolute;inset:32px;border:1px solid #cbb98f;pointer-events:none}.brasao{height:385px;width:auto;object-fit:contain;margin:10px 0 28px}.kicker{font-size:22px;font-weight:650;letter-spacing:5px;text-transform:uppercase;margin-bottom:30px}.headline{font-size:170px;line-height:1.2;font-weight:850;letter-spacing:-9px;color:#9e2a2b;margin:0 0 18px;white-space:nowrap}.linha{width:110px;height:5px;background:#d9a441;margin:20px 0 30px}.sub{font-size:28px;font-weight:600;letter-spacing:1px}.rodape{margin-top:auto;font-size:17px;letter-spacing:2px;text-transform:uppercase;padding-bottom:20px}
</style><div class="arte"><div class="moldura"></div><img class="brasao" src="data:image/png;base64,${await asset('brasao.png')}"><div class="kicker">Pastoral dos Coroinhas e Acólitos</div><h1 class="headline">ATENÇÃO</h1><div class="linha"></div><div class="sub">Leia o comunicado abaixo</div><div class="rodape">Paróquia Jesus Cristo Bom Pastor</div></div></html>`
const browser = await puppeteer.launch({headless:true, executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'})
try {
 const page=await browser.newPage();await page.setViewport({width:1080,height:1080,deviceScaleFactor:1});await page.setContent(html);await page.evaluate(()=>document.fonts.ready)
 await page.screenshot({path:new URL('../tarcisio-robo/assets/atencao-pastoral-v1.png',import.meta.url).pathname})
 await writeFile(new URL('../tarcisio-robo/assets/atencao-pastoral-v1.html',import.meta.url),html)
}finally{await browser.close()}
