const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('nova versão do app não recarrega a tela durante o uso', () => {
  const source = fs.readFileSync(__dirname + '/shared.js', 'utf8');
  const pwa = source.slice(source.indexOf('(function setupPWA()'), source.indexOf('// ── UTILS'));
  const handlers = {};
  let reloads = 0;
  const context = {
    document: { head: { appendChild() {} }, querySelector: () => ({}), addEventListener() {} },
    navigator: { serviceWorker: { controller: {}, addEventListener: (name, fn) => { handlers[name] = fn; } } },
    window: { addEventListener() {}, matchMedia: () => ({ matches: true }), navigator: {}, location: { reload() { reloads++; } } },
  };
  vm.runInNewContext(pwa, context);
  handlers.controllerchange?.();
  handlers.controllerchange?.();
  assert.equal(reloads, 0, 'uma atualização não pode descartar o modal e seus campos');
});

test('atualização do app preserva caches de outros apps da mesma origem', async () => {
  const handlers = {};
  const apagados = [];
  let completion;
  const context = {
    self: { addEventListener: (name, fn) => { handlers[name] = fn; }, clients: { claim: async () => {} } },
    caches: { keys: async () => ['acolitos-antigo', 'central-v1', 'outro-app-v2'], delete: async (key) => { apagados.push(key); } },
  };
  vm.runInNewContext(fs.readFileSync(__dirname + '/sw.js', 'utf8'), context);
  handlers.activate({ waitUntil: (p) => { completion = p; } });
  await completion;
  assert.deepEqual(apagados, ['acolitos-antigo']);
});

function workerFetch({cached={},response,error=new Error('offline')}={}){
 const handlers={},puts=[];const context={URL,Response,self:{location:{origin:'https://app.test',href:'https://app.test/projetos/acolitos/sw.js'},addEventListener:(name,fn)=>handlers[name]=fn},fetch:async()=>{if(response)return response;throw error;},caches:{match:async(req,options)=>{const key=typeof req==='string'?new URL(req,'https://app.test/projetos/acolitos/').href:req.url;return cached[options?.ignoreSearch?key.split('?')[0]:key];},open:async()=>({put:async(req,r)=>puts.push([req,r])})}};
 vm.runInNewContext(fs.readFileSync(__dirname+'/sw.js','utf8'),context);
 return {async run(url){let result;handlers.fetch({request:{method:'GET',mode:'navigate',url},respondWith:p=>result=p,waitUntil(){}});return result;},puts};
}
test('queda de rede ao abrir jogo nunca troca o conteúdo pela Home',async()=>{const w=workerFetch({cached:{'https://app.test/projetos/acolitos/index.html':new Response('HOME')}});const r=await w.run('https://app.test/projetos/acolitos/davi.html?expandido=1');assert.ok(r instanceof Response);const body=await r.text();assert.notEqual(body,'HOME');assert.match(body,/Tentar novamente/);});
test('jogo já visitado abre pelo cache mesmo com parâmetro expandido',async()=>{const w=workerFetch({cached:{'https://app.test/projetos/acolitos/davi.html':new Response('DAVI')}});const r=await w.run('https://app.test/projetos/acolitos/davi.html?expandido=1');assert.equal(await r.text(),'DAVI');});
test('503 não substitui cache bom por página de erro',async()=>{const w=workerFetch({cached:{'https://app.test/projetos/acolitos/games.html':new Response('TIQUICO')},response:new Response('indisponível',{status:503})});const r=await w.run('https://app.test/projetos/acolitos/games.html');assert.equal(await r.text(),'TIQUICO');assert.equal(w.puts.length,0);});
