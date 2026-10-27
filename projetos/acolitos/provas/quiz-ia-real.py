# Prova explícita com o provedor real. Chave apenas em memória; autenticação simulada, sem gravar quiz.
import subprocess,os,sys
ssh=['ssh','-i','/Users/erickmartins/.ssh/sator_whatsapp_gateway_ed25519','-o','BatchMode=yes','-o','ConnectTimeout=10','root@179.198.107.71']
remote="python3 -c \"from pathlib import Path; d=dict(l.split('=',1) for l in Path('/opt/whatsapp/tarcisio/robo.env').read_text().splitlines() if '=' in l and not l.lstrip().startswith('#')); print(d.get('ANTHROPIC_API_KEY','').strip().strip(chr(34)).strip(chr(39)))\""
r=subprocess.run(ssh+[remote],capture_output=True,text=True,timeout=20)
if r.returncode or not r.stdout.strip():print('Configuração indisponível.');sys.exit(1)
env=os.environ.copy();env.update(ANTHROPIC_API_KEY=r.stdout.strip(),ANTHROPIC_MODEL='claude-haiku-5-5',SUPABASE_URL='https://sessao-prova.invalid',SUPABASE_ANON_KEY='prova-local')
code=r"""import fs from 'node:fs';const base=new URL('file:///Users/erickmartins/projetos/iajcbp/');const source=fs.readFileSync(new URL('api/_quiz.js',base),'utf8').replace("'../projetos/acolitos/quiz-core.js'",JSON.stringify(new URL('projetos/acolitos/quiz-core.js',base).href));const {default:handler}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const {default:C}=await import(new URL('projetos/acolitos/quiz-core.js',base));const real=globalThis.fetch;let contagens;
globalThis.fetch=async(url,opts)=>{if(!String(url).startsWith('https://sessao-prova.invalid')){const r=await real(url,opts);const d=await r.clone().json();const raw=d.content?.find(c=>c.type==='tool_use')?.input?.perguntas||[];const qs=Array.isArray(raw)?raw:Object.values(raw);contagens={status:r.status,total:qs.length,dificuldades:qs.reduce((a,q)=>(a[q.dificuldade]=(a[q.dificuldade]||0)+1,a),{}),fim:d.stop_reason,tipoErro:d.error?.type,motivo:d.error?.message?.replaceAll(process.env.ANTHROPIC_API_KEY,'[redigido]').slice(0,700)};return r;}const data=String(url).includes('/auth/')?{id:'11111111-1111-4111-8111-111111111111'}:String(url).includes('pastoral_modules')?[{id:'11111111-1111-4111-8111-111111111111'}]:String(url).includes('quiz_pode_gerir')?true:{ok:true};return {ok:true,json:async()=>data};};
const res={setHeader(){},status(n){this.code=n;return this;},json(d){this.body=d;return this;}};
const config={titulo:'Quiz católico',faixa:'criancas',temas:C.temas,alternativas:3,quantidades:{facil:8,medio:8,dificil:8},observacoes:''};
if(process.env.PROVA_MODO==='individual')config.quantidades={facil:0,medio:1,dificil:0};if(process.env.PROVA_MODO==='quatro'){config.alternativas=4;config.quantidades={facil:10,medio:10,dificil:4};}
await handler({method:'POST',headers:{authorization:'Bearer sessao-isolada'},body:{action:'quiz_gerar',pedido_id:crypto.randomUUID(),config,existentes:[]}},res);
console.log(JSON.stringify({status:res.code,contagens,mensagem:res.body.error,recebidas:res.body.perguntas?.length,distribuicao:res.body.perguntas?.reduce((a,q)=>(a[q.dificuldade]=(a[q.dificuldade]||0)+1,a),{}),validas:res.body.perguntas?.every(q=>C.errosPergunta(q,config.alternativas).length===0)}));if(res.code!==200)process.exitCode=1;"""
p=subprocess.run(['node','--input-type=module','-e',code],env=env,capture_output=True,text=True,timeout=75)
print(p.stdout.strip() or 'Prova não concluiu. Nenhuma credencial exibida.')
sys.exit(p.returncode)
