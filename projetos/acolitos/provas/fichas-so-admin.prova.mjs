import assert from 'node:assert/strict';
import {iniciarProvas,PAPEIS} from './abrir-tela.mjs';
// Equipe consulta a ficha; só administração vê os botões que gravam.
const membro={id:'m1',nome:'Maria Clara de Oliveira Santos',apelido:'Maria Clara',nivel:'coroinha',status:'ativo',serve:true,user_id:'u1',permissoes:[],setores:[],avisos:[]};
const tabelas={acolitos_membros:{data:[membro]}};
const avaliar=`document.getElementById('splash')?.remove();
 await abrirFicha(membroAlvo());
 const salvar=document.getElementById('btn-salvar');
 const r={novo:document.getElementById('btn-novo-membro').style.display,salvar:salvar.style.display,nivel:!!document.querySelector('.nivel-btn'),pode:podeEditarFicha(ctx),larga:document.documentElement.scrollWidth>innerWidth+1};
 return r;`.replace('membroAlvo()',JSON.stringify(membro));
const env=await iniciarProvas();
try{
 for(const largura of [360,390,768,1366,2560]){
  const equipe=await env.abrir('membros.html',{papel:{...PAPEIS.equipe,permissoes:['membros']},largura,tabelas,avaliar});
  assert.equal(equipe.erroAvaliar,null);
  assert.deepEqual(equipe.avaliado,{novo:'none',salvar:'none',nivel:false,pode:false,larga:false});
  const admin=await env.abrir('membros.html',{papel:PAPEIS.admin,largura,tabelas,avaliar});
  assert.equal(admin.erroAvaliar,null);
  assert.deepEqual(admin.avaliado,{novo:'',salvar:'',nivel:true,pode:true,larga:false});
 }
 console.log('fichas-so-admin: equipe consulta e admin edita em 5 larguras');
}finally{await env.encerrar();}
