// Prova do protótipo local. Não acessa Supabase nem qualquer API de IA.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http');
const puppeteer=require('puppeteer-core');
const base=path.resolve(__dirname,'..');
const saida=process.env.JORNADA_PILOTO_SAIDA||path.join(os.homedir(),'arquivos/sao-tarcisio/jornada-piloto-2026-10-25');
const ler=f=>fs.readFileSync(path.join(base,f),'utf8');
const conteudo=JSON.parse(ler('jornada-piloto.json'));
const js=ler('jornada-piloto.js').replace("fetch('jornada-piloto.json').then(r=>{if(!r.ok)throw Error('Não foi possível carregar o piloto.');return r.json();})",'Promise.resolve('+JSON.stringify(conteudo)+')').replace(/<\/script/gi,'<\\/script');
const html=ler('jornada-piloto.html').replace('<link rel="stylesheet" href="jornada-piloto.css">','<style>'+ler('jornada-piloto.css')+'</style>').replace('<script src="jornada-piloto.js"></script>','<script>'+js+'</script>');
const assert=(ok,msg)=>{if(!ok)throw Error(msg);};
(async()=>{
  fs.mkdirSync(saida,{recursive:true});fs.writeFileSync(path.join(saida,'Jornada-Piloto.html'),html);
  fs.copyFileSync(path.resolve(base,'../../docs/jornada-ia-piloto-e-implementacao.md'),path.join(saida,'Plano-de-implementacao.md'));
  const server=http.createServer((req,res)=>{if(req.url!=='/'){res.writeHead(404);res.end();return;}res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
  try{
    browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
    const page=await browser.newPage(),errors=[],report={telas:[],fluxos:[],escopo:'Protótipo local. Não valida banco, IA, autenticação ou promoção em produção.'};
    page.on('pageerror',e=>errors.push(e.message));await page.setViewport({width:390,height:844});
    await page.goto('http://127.0.0.1:'+server.address().port+'/');await page.waitForSelector('.objetivo');
    const clickText=t=>page.evaluate(t=>[...document.querySelectorAll('button')].find(e=>e.textContent===t).click(),t);
    const fechar=async()=>{await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('dialog').open);};
    const objetivos=conteudo.capitulos.flatMap(c=>c.objetivos);
    assert(objetivos.length===6&&new Set(objetivos.flatMap(o=>o.opcoes.map(q=>q.id))).size===12,'Contrato dos seis objetivos e 12 opções');
    let visitadas=0;
    for(let c=0;c<conteudo.capitulos.length;c++){
      await page.click('.capitulo:nth-child('+(c+1)+')');
      for(const o of conteudo.capitulos[c].objetivos)for(let i=0;i<o.opcoes.length;i++){
        const q=o.opcoes[i];await page.click('[data-missao="'+q.id+'"]');await page.waitForSelector('dialog[open]');
        const titulo=await page.$eval('#titulo-missao',e=>e.textContent);assert(titulo===q.titulo,'Missão '+q.id+': '+titulo);
        await clickText('Preciso de uma pista');assert(await page.$('.pista'),'Pista '+q.id);
        if(q.formato==='cenario'){
          if(i===0){await page.click('.alternativa:nth-child('+((q.correta+1)%q.alternativas.length+1)+')');assert((await page.$eval('.feedback',e=>e.textContent)).includes('Vamos pensar'),'Pista após erro');}
          await page.click('.alternativa:nth-child('+(q.correta+1)+')');
          if(i===0)await clickText('Concluir descoberta');else{assert(!await page.evaluate(()=>[...document.querySelectorAll('#conteudo button')].some(e=>e.textContent==='Concluir descoberta')),'XP duplicado em cenário');await fechar();}
        }else if(i===0){
          const antes=await page.$eval('#xp',e=>e.textContent);await page.type('#resposta','Experiência de demonstração com o orientador.');await clickText('Registrar para confirmação');
          assert(await page.$eval('#xp',e=>e.textContent)===antes,'Prática pontuou antes de confirmação');
          if(visitadas===0){await clickText('Simular pedido de revisão');await page.click('[data-missao="'+q.id+'"]');await clickText('Registrar para confirmação');}
          await page.click('.pendencia .aprovar');
        }else{assert(await page.evaluate(()=>[...document.querySelectorAll('#conteudo button')].find(e=>e.textContent==='Registrar para confirmação').disabled),'Alternativa repetiu progresso');await fechar();}
        visitadas++;
      }
    }
    assert(await page.$eval('#xp',e=>e.textContent)==='50 XP de demonstração','Total de XP');assert(await page.$$eval('.selo.ganho',e=>e.length)===3,'Três selos');
    await page.reload();await page.waitForSelector('.objetivo');assert(await page.$eval('#xp',e=>e.textContent)==='50 XP de demonstração','Persistência');
    await page.click('.selo button');assert((await page.$eval('#conteudo',e=>e.textContent)).includes('Seu mapa de chegada'),'Guia');await fechar();
    report.fluxos.push('12 opções; 6 objetivos; 3 selos; 50 XP sem duplicação entre alternativas','Erro oferece pista e nova tentativa','Prática aguarda confirmação; revisão e reenvio funcionam','Progresso persiste; guias acessíveis; capítulos exploráveis');
    await page.evaluate(()=>localStorage.removeItem('jcbp-jornada-piloto-1'));await page.reload();await page.waitForSelector('.objetivo');
    for(const [w,h]of[[390,844],[768,1024],[1440,900],[2560,1440]]){
      await page.setViewport({width:w,height:h});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(saida,'tela-'+w+'.png'),fullPage:true});
      const t=await page.evaluate(()=>({viewport:innerWidth,conteudo:document.documentElement.scrollWidth,alvosPequenos:[...document.querySelectorAll('button,a')].filter(e=>e.getClientRects().length&&e.getBoundingClientRect().height<44).length}));
      assert(t.conteudo<=w&&!t.alvosPequenos,'Responsividade '+w);report.telas.push(t);
    }
    await page.setViewport({width:390,height:844});await page.click('[data-missao="e_agora"]');await page.waitForSelector('dialog[open]');
    const m=await page.$eval('dialog',e=>({w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height}));assert(m.w===390&&m.h===844,'Modal em tela cheia');
    await page.screenshot({path:path.join(saida,'missao-390.png')});await fechar();assert(await page.evaluate(()=>document.activeElement?.dataset.missao)==='e_agora','Restauração do foco');
    report.fluxos.push('Modal ocupa celular; Escape fecha e devolve foco à missão');assert(!errors.length,errors.join(';'));
    report.opcoesVisitadas=visitadas;report.erros=errors;fs.writeFileSync(path.join(saida,'validacao.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
  }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
