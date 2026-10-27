// Servidor EXCLUSIVO das provas: autenticação simulada; persistência e RPCs no PostgreSQL isolado.
import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {preparar,rpc,ler,ids} from './quiz-db.mjs';
const raiz=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');preparar();
const stub=`
// Ambiente de prova local, sem credenciais de produção.
initModulo=async function(roles){hideSplash();return {user:{id:'${ids.admin}',email:'prova@local.test'},membership:{role:'coord_admin',module_id:'${ids.mod}'},membro:null,conta:null};};
freshToken=async function(){return 'sessao-de-prova-local';};
localStorage.setItem('nav-mode','coordenacao');
sb.from=function(table){const query={select(){return this;},order(){return this;},then(ok,fail){return fetch('/__quiz_test/table?name='+table).then(r=>r.json()).then(ok,fail);}};return query;};
sb.rpc=async function(acao,params){return fetch('/__quiz_test/rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(params)}).then(r=>r.json());};
`;
const server=http.createServer(async(req,res)=>{const u=new URL(req.url,'http://localhost');try{
 if(u.pathname==='/__quiz_test/table'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({data:ler(u.searchParams.get('name')),error:null}));}
 if(u.pathname==='/__quiz_test/rpc'){let body='';for await(const chunk of req)body+=chunk;const p=JSON.parse(body);let result;try{result={data:rpc(p.p_acao,p.p_dados),error:null};}catch(e){result={data:null,error:{message:e.stderr?.match(/ERROR:  ([^\n]+)/)?.[1]||'Falha na operação de prova'}};}res.setHeader('Content-Type','application/json');return res.end(JSON.stringify(result));}
 if(u.pathname==='/api/acolito-admin'){let body='';for await(const chunk of req)body+=chunk;const p=JSON.parse(body);res.setHeader('Content-Type','application/json');if(p.action==='quiz_config')return res.end(JSON.stringify({operacional:false}));res.statusCode=503;return res.end(JSON.stringify({error:'IA não configurada neste ambiente de prova. Suas edições foram preservadas.'}));}
 const arquivo=path.resolve(raiz,'.'+decodeURIComponent(u.pathname));if(!arquivo.startsWith(raiz+path.sep)||!fs.statSync(arquivo).isFile()){res.statusCode=404;return res.end();}
 const ext=path.extname(arquivo);res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml'})[ext]||'application/octet-stream');
 if(arquivo.endsWith('/shared.js'))return res.end(fs.readFileSync(arquivo,'utf8')+stub);
 if(arquivo.endsWith('/sw.js'))return res.end('// service worker desativado somente nas provas');
 res.end(fs.readFileSync(arquivo));
 }catch(e){res.statusCode=500;res.end('Erro no servidor local de provas.');}});
server.listen(5189,'127.0.0.1',()=>console.log('Provas de quiz: http://127.0.0.1:5189/projetos/acolitos/quizzes.html'));
