// Fotografa as telas REAIS do app (mesmo HTML/CSS) com banco de mentira: dados fictícios, nada vai à produção.
// Roda da raiz do repositório. O motor é copiado para um arquivo temporário só para fotografar em 2x; a cópia é apagada no fim.
import fs from 'node:fs';import path from 'node:path';
const M='projetos/acolitos/provas/abrir-tela.mjs',TMP='projetos/acolitos/provas/_video2x.tmp.mjs';
fs.writeFileSync(TMP,fs.readFileSync(M,'utf8').replace('height: opcoes.altura || 900 }','height: opcoes.altura || 900, deviceScaleFactor: 2 }'));
const {iniciarProvas,PAPEIS}=await import(path.resolve(TMP));
const out=path.resolve('midia/video-onboarding-app/v1-membros/telas');fs.mkdirSync(out,{recursive:true});
const medalhas=JSON.parse(fs.readFileSync('projetos/acolitos/provas/fixtures/medalhas-catalogo.json'));
const user={id:'u1',email:'teste@example.invalid'},membro={id:'m1',user_id:'u1',nome:'João Silva',nivel:'coroinha',avisos:[]};
const limpa=`document.getElementById('splash')?.remove();document.getElementById('pwa-banner')?.remove();document.getAnimations().forEach(a=>{try{a.finish();}catch{a.pause();}});
const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let n;while(n=w.nextNode()){n.nodeValue=n.nodeValue.replace('Pessoa de Teste','João Silva').replace(/^Teste$/,'João');}
document.querySelectorAll('.casa-lema,.casa-lema-pt').forEach(e=>e.remove());
const achar=t=>{const e=[...document.querySelectorAll('h1,h2,h3,div,span,button')].find(x=>x.children.length===0&&x.textContent.trim()===t);return e?Math.round(e.getBoundingClientRect().top+scrollY):null;};
return {h:document.documentElement.scrollHeight,medalhas:Math.round((document.querySelector('.cq-medal')?.getBoundingClientRect().top||0)+scrollY),aventura:achar('Escolha sua aventura'),t:[...document.querySelectorAll('h2')].map(e=>e.textContent).slice(0,8)};`;
const missao={xp:10,status:'pendente',validacao:'reivindicada'},caps=[{capitulo:1,completo:true,desbloqueado:true,missoes:[{...missao,id:'c1',titulo:'Conheça a sacristia',descricao:'Primeiro passo da jornada.',status:'concluida'}]},{capitulo:2,completo:false,desbloqueado:true,missoes:[{...missao,id:'c2',titulo:'Sirva em uma missa',descricao:'Coloque em prática.'}]},{capitulo:3,completo:false,desbloqueado:false,missoes:[]}];
const q=(id,titulo,tipo,xp)=>({id,titulo,descricao:'Uma aventura desta semana.',xp,status:'pendente',expira_em:'2026-11-08',criterio:{bonus_semanal:{tipo,modelo:'exemplo',passos:['Leia o desafio.','Cumpra com a sua equipe.']}}});
const jogo=q('j1','Tem algo fora do lugar','jogo',10),foto=q('f1','Caça ao detalhe','foto',25),grupo=q('g1','Troca de bastidores','grupo',20);
const base={sessao:{access_token:'fixture',user},papel:PAPEIS.membro,largura:390,altura:844,fontesReais:true,tabelas:{acolitos_membros:{data:[membro]},acolitos_casas:{data:['sanctaris','seraphim','templaris','veritatis','consilium'].map((slug,i)=>({id:'c'+i,slug,nome:slug[0].toUpperCase()+slug.slice(1),lema:'',lema_pt:'',tagline:'',caracteristicas:[],cor:'#a01020',ordem:i}))}},
 apis:{'/api/acolito-admin':{__acoes:{bonus_listar:{missoes:[jogo,foto,grupo],semana:'2026-11-02'}}}},
 rpcs:{acolitos_missoes_board:{data:{nivel:'coroinha',proximo_nivel:'acolito_aspirante',xp_total:140,capitulos:caps,pendencias:[],bonus:[]}},acolitos_quests_exclusivas:{data:[jogo,foto,grupo]},acolitos_jornada_atividade:{data:{push_pausado:false}},
 acolitos_ranking_temporada:{data:{temporada:{nome:'Temporada do Altar'},eu_id:'r1',ligas:[{liga:'iniciantes',membros:[{id:'r1',nome:'João Silva',nivel:'coroinha',xp:140},{id:'r2',nome:'Ana Souza',nivel:'coroinha',xp:120},{id:'r3',nome:'Pedro Lima',nivel:'aspirante',xp:95}]},{liga:'acolitos',membros:[{id:'r4',nome:'Maria Costa',nivel:'acolito_guardiao',xp:210},{id:'r5',nome:'Lucas Alves',nivel:'acolito_aspirante',xp:175}]},{liga:'cerimoniarios',membros:[{id:'r6',nome:'Clara Dias',nivel:'cerimoniario_aspirante',xp:260}]}]}},acolitos_medalhas_catalogo:{data:medalhas},acolitos_badges_membro:{data:medalhas.slice(0,14).map(b=>({...b,ganho:true}))},acolitos_estrelas:{data:{estrelas:2,xp_prox:60}}}};
const env=await iniciarProvas();
const nav=`document.querySelectorAll('.app-nav,.nav-arrow').forEach(e=>e.style.display='none');`;
try{for(const t of ['index','missoes','conquistas','destaques','minha-casa']){
 const passos=t==='destaques'?[{clicar:'Temporada'}]:[];
 await env.abrir(t+'.html',{...base,passos,avaliar:limpa,foto:{caminho:`${out}/${t}-tela.png`,viewport:true}});
 const r=await env.abrir(t+'.html',{...base,passos,avaliar:nav+limpa,foto:{caminho:`${out}/${t}.png`,viewport:false}});
 console.log(t,JSON.stringify(r.avaliado),r.passosFalhos||'',r.erroAvaliar||'');}
}finally{await env.encerrar();fs.rmSync(TMP,{force:true});}
