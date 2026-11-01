import fs from 'node:fs';
import assert from 'node:assert/strict';
import {iniciarProvas,PAPEIS} from './abrir-tela.mjs';
const destino='/Users/erickmartins/projetos/iajcbp/historico-tarcisio/conversas-2026-10-27';
fs.mkdirSync(destino,{recursive:true});
const agora=new Date().toISOString(),antes=new Date(Date.now()-3600000).toISOString();
const tabelas={
 tarcisio_config:{data:[{id:1,conexao:'open',pausado:false,respostas_ligadas:true}]},
 tarcisio_mensagens:{data:[
  {id:'a',numero:'5519999990001',direcao:'entrada',texto:'Boa tarde! A túnica do João já chegou. Ele pode servir domingo?',created_at:antes,membro_ids:['m1'],respondida:true,oculta:false},
  {id:'b',numero:'5519999990001',direcao:'saida',texto:'Registrei o recebimento da túnica. O João pode servir no domingo às 9h, junto de vocês. 🙏',created_at:agora,membro_ids:['m1'],respondida:true,oculta:false,external_id:'WA-B',ferramentas:[{ferramenta:'registrar_acolhida',saida:{ok:true}}]},
  {id:'c',numero:'5519999990002',direcao:'entrada',texto:'Podem conferir o horário da próxima missa?',created_at:agora,membro_ids:['m2'],respondida:false,oculta:false}
 ]},
 tarcisio_envios:{data:[{id:'e',destino_numero:'5519999990001',membro_id:'m1',texto:'Confira a catequese desta semana: servir é cuidar de cada detalhe.',tipo:'catequese',estado:'enviado',enviado_em:agora,created_at:agora,oculta:false,external_id:'WA-E'}]},
 tarcisio_pendencias:{data:[{numero:'5519999990001',resumo:'Conferir os dados da família',estado:'aberta'}]},
 acolitos_membros:{data:[{id:'m1',nome:'João Pedro Almeida',nome_mae:'Mariana Almeida',celular_mae:'19999990001',nivel:'coroinha',tem_tunica:true},{id:'m2',nome:'Ana Clara Santos',nome_mae:'Camila Santos',celular_mae:'19999990002',nivel:'aspirante',tem_tunica:false}]},
 acolitos_crm:{data:[{membro_id:'m1',etapa:'integrado'}]}
};
const provas=await iniciarProvas();
try{
for(const [largura,altura] of [[360,800],[390,844],[768,1024],[1440,1000],[2560,1440]]){
 for(const modo of ['lista','chat']){
 const r=await provas.abrir('config.html',{papel:PAPEIS.admin,tabelas,bancoVivo:true,largura,altura,passos:[{chamar:'abrirSecao',args:['tarcisio_conversas']}],avaliar:`
 await document.fonts.ready;document.getElementById('splash')?.remove();
 const itens=[...document.querySelectorAll('.zp-item')];
 if(itens.length!==2)throw new Error('esperava dois contatos: '+itens.length);
 const busca=document.querySelector('.zp-busca');
 if(busca){busca.value='túnica';busca.dispatchEvent(new Event('input'));if(document.querySelectorAll('.zp-item').length!==1)throw new Error('busca não filtrou');busca.value='';busca.dispatchEvent(new Event('input'));}
 if(${JSON.stringify(modo)}==='chat'){
 [...document.querySelectorAll('.zp-item')].find(e=>e.textContent.includes('João')).click();
 const campo=document.querySelector('.zp-busca-chat');campo.value='túnica';campo.dispatchEvent(new Event('input'));
 if(!document.querySelector('mark'))throw new Error('busca no histórico não destacou');campo.value='';campo.dispatchEvent(new Event('input'));
 }
 await new Promise(r=>setTimeout(r,400));
 const visivel=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(e).visibility!=='hidden'};
 const alvos=[...document.querySelectorAll('.zp button,.zp a,.zp input')].filter(visivel);
 return {overflow:document.documentElement.scrollWidth>innerWidth+1,pequenos:innerWidth<640?alvos.filter(e=>e.getBoundingClientRect().height<43.5).map(e=>e.textContent||e.ariaLabel):[],letra:alvos.filter(e=>e.tagName==='INPUT'&&parseFloat(getComputedStyle(e).fontSize)<16).length,chat:document.querySelector('.zp-chat').getBoundingClientRect().toJSON(),main:document.querySelector('.main').getBoundingClientRect().width,contatos:document.querySelectorAll('.zp-item').length};
 `,foto:{caminho:destino+'/'+modo+'-'+largura+'.png',viewport:true}});
 assert.deepEqual(r.erros,[]);assert.ok(!r.erroAvaliar,r.erroAvaliar);assert.ok(r.avaliado,JSON.stringify(r));assert.equal(r.avaliado.overflow,false);assert.deepEqual(r.avaliado.pequenos,[]);assert.equal(r.avaliado.letra,0);
 if(modo==='chat'&&largura<=820){assert.equal(r.avaliado.chat.width,largura);assert.equal(r.avaliado.chat.height,altura);}
 if(largura>=1440)assert.equal(r.avaliado.main,largura);
 console.log(modo,largura,JSON.stringify(r.avaliado));
 }
}
}finally{await provas.encerrar();}

// ── enviar, apagar e ocultar (a tela grava o que o robô executa) ──
const p2=await iniciarProvas();
try{
for(const [largura,altura] of [[390,844],[1440,1000]]){
 const r=await p2.abrir('config.html',{papel:PAPEIS.admin,tabelas,bancoVivo:true,largura,altura,passos:[{chamar:'abrirSecao',args:['tarcisio_conversas']}],avaliar:`
 await document.fonts.ready;document.getElementById('splash')?.remove();
 const espera=ms=>new Promise(r=>setTimeout(r,ms));
 [...document.querySelectorAll('.zp-item')].find(e=>e.textContent.includes('João')).click();await espera(200);
 // enviar
 const campo=document.querySelector('.zp-campo-msg');campo.value='Olá! Tudo certo para domingo.';campo.dispatchEvent(new Event('input'));
 document.querySelector('.zp-compor').requestSubmit();await espera(400);
 const enviou=[...document.querySelectorAll('.zp-bolha')].some(b=>b.textContent.includes('Tudo certo para domingo')&&b.textContent.includes('Enviando'));
 // apagar para todos: menu da resposta com external_id, dois toques
 const resp=[...document.querySelectorAll('.zp-bolha.zp-saida')].find(b=>b.textContent.includes('Registrei o recebimento'));
 resp.querySelector('.zp-mais').click();await espera(100);
 const itens=[...resp.querySelectorAll('.zp-menu-item')].map(b=>b.textContent.trim());
 const apagar=[...resp.querySelectorAll('.zp-menu-item')].find(b=>b.textContent.includes('Apagar para todos'));
 apagar.click();await espera(50);const pediuConfirmacao=apagar.textContent.includes('de novo');
 apagar.click();await espera(300);
 const apagando=[...document.querySelectorAll('.zp-bolha')].find(b=>b.textContent.includes('Registrei o recebimento')).textContent.includes('Apagando');
 // ocultar a mensagem do contato
 const entrada=[...document.querySelectorAll('.zp-bolha.zp-entrada')].find(b=>b.textContent.includes('túnica do João'));
 entrada.querySelector('.zp-mais').click();await espera(100);
 [...entrada.querySelectorAll('.zp-menu-item')].find(b=>b.textContent.includes('Ocultar')).click();await espera(300);
 const sumiu=![...document.querySelectorAll('.zp-bolha')].some(b=>b.textContent.includes('túnica do João já chegou'));
 // nova conversa por número
 document.querySelector('.zp-novo').click();await espera(100);
 const num=document.querySelector('.zp-novo-form input');num.value='(19) 99999-0123';
 document.querySelector('.zp-novo-form').requestSubmit();await espera(300);
 const novoAberto=document.querySelector('.zp-chat-info .zp-nome')?.textContent;
 await espera(200);
 return {enviou,itens,pediuConfirmacao,apagando,sumiu,novoAberto,overflow:document.documentElement.scrollWidth>innerWidth+1};
 `,foto:{caminho:destino+'/acoes-'+largura+'.png',viewport:true}});
 assert.deepEqual(r.erros,[]);assert.ok(!r.erroAvaliar,r.erroAvaliar);assert.ok(r.avaliado,JSON.stringify(r));
 const a=r.avaliado;
 assert.equal(a.enviou,true,'bolha enviada com estado Enviando');
 assert.deepEqual(a.itens,['Copiar texto','Apagar para todos','Ocultar do painel']);
 assert.equal(a.pediuConfirmacao,true,'apagar pede segundo toque');
 assert.equal(a.apagando,true);assert.equal(a.sumiu,true);assert.match(a.novoAberto,/99999-0123/);assert.equal(a.overflow,false);
 const ins=r.gravacoes.find(g=>g.tabela==='tarcisio_envios'&&g.acao==='insert');
 assert.ok(ins&&ins.dados.tipo==='manual'&&ins.dados.destino_numero==='5519999990001'&&ins.dados.estado==='pendente'&&/^manual:/.test(ins.dados.chave_unica),'insert manual: '+JSON.stringify(ins));
 const apg=r.gravacoes.find(g=>g.tabela==='tarcisio_mensagens'&&g.acao==='update'&&g.dados.apagar_pedido_em);
 assert.ok(apg,'pedido de apagar gravado');
 const oc=r.gravacoes.find(g=>g.tabela==='tarcisio_mensagens'&&g.acao==='update'&&g.dados.oculta===true);
 assert.ok(oc,'ocultar gravado');
 console.log('acoes',largura,JSON.stringify(a));
}
}finally{await p2.encerrar();}
