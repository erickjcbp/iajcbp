import fs from 'node:fs';
import { iniciarProvas, PAPEIS } from './abrir-tela.mjs';
const destino=process.env.FOTOS_VISUAL || '/Users/erickmartins/arquivos/auditoria-visual-coroinhas-2026-10-10/depois';
fs.mkdirSync(destino,{recursive:true});
const membro={id:'m1',nome:'Maria Clara de Oliveira Santos',apelido:'Maria Clara',nivel:'coroinha',comunidade:'matriz',status:'ativo',serve:true,role:'membro',user_id:'u1',data_nascimento:'2012-05-11',email:'maria@teste',eh_equipe:false};
const celeb={id:'c1',data:'2026-10-11',horario:'10:00',minutos:600,comunidade:'matriz',tipo:'missa_comum',observacoes:'Missa das crianças e acolhida das famílias'};
const area={id:'a1',nome:'Retiro de Advento da comunidade',tipo:'retiro',status:'planejando',data_inicio:'2026-11-22',data_fim:'2026-11-23'};
const tabelas={
 acolitos_membros:{data:[membro,{...membro,id:'m2',nome:'João Pedro Albuquerque',apelido:'João Pedro',nivel:'acolito',user_id:'u2'}]},
 acolitos_celebracoes:{data:[celeb]},
 acolitos_escalas:{data:[{id:'e1',celebracao_id:'c1',membro_id:'m1',funcao:'apoio',status:'escalado',acolitos_membros:membro,acolitos_celebracoes:celeb}]},
 acolitos_habilitacoes:{data:[{membro_id:'m1',funcao:'apoio',proficiencia:'apto'}]},
 acolitos_disponibilidades:{data:[{membro_id:'m1',dia:'domingo',horario:'10:00'}]},
 acolitos_modelos:{data:[{tipo:'missa_comum',comunidade:'matriz',funcao:'apoio',quantidade:2,ordem:1}]},
 acolitos_retiro_areas:{data:[area]},
 acolitos_crm:{data:[{id:'crm1',membro_id:'m1',etapa:'integracao',acolitos_membros:membro}]},
 acolitos_tarefas:{data:[{id:'t1',titulo:'Preparar a acolhida das famílias para a missa de domingo',status:'afazer',time_slug:'secretaria',prazo:'2026-10-11',responsavel_id:'m1',created_by:'u1'}]},
 acolitos_casas:{data:[{id:'casa1',slug:'sanctaris',nome:'Sanctaris'}]},
 acolitos_financeiro:{data:[{id:'f1',tipo:'entrada',categoria:'doacao',descricao:'Doação das famílias para o retiro',valor:145.70,data:'2026-10-10',status:'pago'}]},
};
const pages=['novos','index','agenda','ausencias','caixa','casas','chamada','config','conquistas','crm','destaques','escala','escalas-membro','jornada-admin','membros','minha-casa','missoes','missoes-lab','retiros','tarefas','tesouraria'];
const scenarios=pages.map(p=>({id:p,page:p,steps:[]}));
function scenario(page,id,fn,args=[]){scenarios.push({page,id:page+'-'+id,steps:[{chamar:fn,args}]});}
for(const tab of ['planilha','rodizio'])scenario('escala',tab,'setAba',[tab]);
for(const [id,fn,args] of [['montagem','abrirMontagem',[celeb]],['celebracao','abrirNovaCeleb',[]],['modelos','abrirModelos',[]],['frequencia','abrirRelatorioFrequencia',[]]])scenario('escala',id,fn,args);
scenario('agenda','evento','abrirFormEvento',[null]);
scenario('ausencias','registro','abrirRegistroAusencia');
scenario('escalas-membro','ausencia','abrirInformarAusencia');
scenario('escalas-membro','detalhe','abrirEscala',[celeb]);
scenario('membros','novo','abrirNovoMembro');
scenario('membros','relatorio','abrirRelatorioMembros');
scenario('membros','ficha','abrirFicha',[membro]);
for(const tab of ['Acessos','Disponibilidade','Família','Frequência','Mensagem'])scenarios.push({page:'membros',id:'membros-ficha-'+tab,steps:[{chamar:'abrirFicha',args:[membro]},{chamar:'renderTab',args:[tab]}]});
scenario('tesouraria','lancamento','abrirLancamento',[null]);
scenario('retiros','area','abrirArea',['a1']);
scenario('retiros','nova','editarArea',[null]);
scenario('tarefas','nova','abrirFormTarefa',[null]);
scenario('tarefas','rotina','abrirFormRotina',['secretaria']);
for(const sec of ['identidade','comunidades','pessoas','admins','logins','barrados','atividade','cadastro','escala','agenda','tesouraria','ausencias','jornada','crm','navegacao','gerador','missoes'])scenario('config',sec,'abrirSecao',[sec]);
for(const [sec,labels] of Object.entries({pessoas:['Times'],escala:['Tipos de celebração','Modelos de escala'],tesouraria:['Saídas'],jornada:['Habilidades','Níveis']}))for(const label of labels)scenarios.push({page:'config',id:'config-'+sec+'-'+label,steps:[{chamar:'abrirSecao',args:[sec]},{clicar:label}]});
for(const label of ['Pregações','Dinâmicas','Gincanas','Refeições','Equipes','Compras','Caixa'])scenarios.push({page:'retiros',id:'retiros-'+label,steps:[{chamar:'abrirArea',args:['a1']},{clicar:label}]});
for(const [id,fn,args] of [['equipe','editarEquipe',[null]],['pessoa','editarPessoa',[{id:'eq1',nome:'Liturgia'},null]],['compra','editarCompra',[null]],['item','editarItem',['cronograma',null]]])scenarios.push({page:'retiros',id:'retiros-'+id,steps:[{chamar:'abrirArea',args:['a1']},{chamar:fn,args}]});
scenario('casas','editar','abrirEditarCasa',[{id:'casa1',slug:'sanctaris',nome:'Sanctaris'}]);
scenario('casas','adicionar','abrirAddMembro',[{id:'casa1',slug:'sanctaris',nome:'Sanctaris'}]);
scenario('casas','setor','abrirAddSetor',['liturgia','Liturgia']);
scenario('conquistas','medalha','abrirMedalha',[{nome:'Presença constante',descricao:'Participou das celebrações ao longo do mês.',icone:'estrela'}]);
scenario('crm','ficha','abrirCartao',[{id:'crm1',membro_id:'m1',etapa:'integracao',acolitos_membros:membro}]);
scenarios.push({page:'crm',id:'crm-lista',steps:[{clicar:'Lista'}]});
scenarios.push({page:'jornada-admin',id:'jornada-evolucao',steps:[{clicar:'Evolução'}]});
scenarios.push({page:'ausencias',id:'ausencias-faltas',steps:[{clicar:'Faltas'}]});
scenarios.push({page:'agenda',id:'agenda-linha',steps:[{clicar:'Linha do tempo'}]});
scenarios.push({page:'index',id:'index-jornada',role:PAPEIS.membro,steps:[]});
const contexto={user:{id:'u1',email:'maria@teste'},membership:{role:'coord_admin'},membro};
scenario('index','conta','openContaModal',[contexto]);
scenario('index','notificacoes','openNotificacoes',[{...membro,avisos:[{msg:'Confira sua escala de domingo.',texto:'Confira sua escala de domingo.',seen:false}]}]);
for(const page of ['agenda','ausencias','crm','membros','tarefas'])scenarios.push({page,id:page+'-filtro',steps:page==='tarefas'?[{clicar:'Lista'},{clicar:'Filtrar'}]:[{clicar:page==='crm'?'Ordenar':'Filtrar'}]});

scenario('destaques','cartao','abrirCard',['m1']);
scenario('missoes','reivindicar','abrirClaimModal',[{id:'q1',titulo:'Acolher as famílias',descricao:'Ajude na acolhida antes da missa.',validacao:'reivindicada',status:'pendente',xp:15}]);
for(const [id,fn,args] of [['panorama','abrirPanorama',[membro]],['funcoes','abrirFuncoesEditor',[membro]],['competencias','abrirCompetenciasEditor',[membro]],['cobertura','abrirCoberturaFuncao',['apoio','Apoio']]])scenarios.push({page:'jornada-admin',id:'jornada-'+id,steps:[{clicar:'Evolução'},{chamar:fn,args}]});
for(const label of ['Lista','Áreas'])scenarios.push({page:'tarefas',id:'tarefas-'+label,steps:[{clicar:label}]});
const avaliar=`
 await document.fonts.ready;
 document.getElementById('splash')?.remove();
 document.getElementById('pwa-banner')?.remove();
 const visible=e=>{const r=e.getBoundingClientRect();const s=getComputedStyle(e);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none'};
 const nome=e=>((e.textContent||e.getAttribute('aria-label')||e.placeholder||e.tagName).trim()).slice(0,70);
 const safe=e=>{let p=e.parentElement;while(p&&p!==document.body){const s=getComputedStyle(p);if(/auto|scroll/.test(s.overflowX))return true;p=p.parentElement;}return false};
 const els=[...document.querySelectorAll('button,a,input,select,textarea')].filter(visible);
 const small=innerWidth<640?els.filter(e=>{const r=e.getBoundingClientRect();return !['checkbox','radio','hidden'].includes(e.type)&&(r.height<43.5||r.width<43.5)}).map(e=>({name:nome(e),tag:e.tagName,cls:e.className,w:Math.round(e.getBoundingClientRect().width),h:Math.round(e.getBoundingClientRect().height)})):[];
 const fonts=innerWidth<640?els.filter(e=>['INPUT','SELECT','TEXTAREA'].includes(e.tagName)&&!['checkbox','radio','hidden','range','file'].includes(e.type)&&parseFloat(getComputedStyle(e).fontSize)<16).map(e=>({name:nome(e),cls:e.className,size:getComputedStyle(e).fontSize})):[];
 const outside=els.filter(e=>{const r=e.getBoundingClientRect();return (r.right>innerWidth+1||r.left< -1)&&!safe(e)}).map(e=>nome(e));
 const modals=[...document.querySelectorAll('.modal-overlay.open .modal')].filter(visible).map(e=>({width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height}));
 const main=document.querySelector('.main');
 return {overflow:document.documentElement.scrollWidth>innerWidth+1,small,fonts,outside,modals,mainWidth:main?.getBoundingClientRect().width, title:document.title};
`;
const filtro=process.argv[2];const selected=filtro==='--pages'?scenarios.filter(s=>!s.steps.length):filtro==='--states'?scenarios.filter(s=>s.steps.length||s.theme):scenarios;
const targets=process.env.PREFIXO_VISUAL?selected.filter(s=>s.id.startsWith(process.env.PREFIXO_VISUAL)):process.env.CENARIOS_VISUAL?selected.filter(s=>process.env.CENARIOS_VISUAL.split(',').includes(s.id)):selected;
const provas=await iniciarProvas();const resultados=[];
try{
 for(const s of targets)for(const [width,height] of (process.env.LARGURA_VISUAL?[[Number(process.env.LARGURA_VISUAL),844]]:[[390,844],[768,1024],[1366,900],[2560,1440]])){
  const result=await provas.abrir(s.page+'.html',{papel:s.role||PAPEIS.admin,fontesReais:true,sessao:{user:{id:'u1',email:'maria@teste'}},apis:{'/api/acolito-admin':{usuario:'maria.clara'}},tabelas,rpcs:{acolitos_roster_substituicao:{data:[membro]},acolitos_membro_card:{data:{...membro,xp_total:35,funcoes:[],conquistas:[]}},acolitos_missoes_board:{data:{xp_total:35,proximo_nivel:'acolito_aspirante',capitulos:[],bonus:[]}}},largura:width,altura:height,passos:s.steps,avaliar:(s.theme?"document.documentElement.dataset.theme='light';":'')+avaliar,foto:{caminho:destino+'/'+s.id+'-'+width+'.png',viewport:s.page==='config'}});
  const row={id:s.id,width,...result.avaliado,errors:result.erros,stepErrors:result.passosFalhos,evalError:result.erroAvaliar};resultados.push(row);
  console.log(s.id,width,JSON.stringify({overflow:row.overflow,small:row.small?.length,fonts:row.fonts?.length,errors:[...row.errors,...row.stepErrors,row.evalError].filter(Boolean)}));
  fs.writeFileSync(destino+'/metricas'+(process.env.PREFIXO_VISUAL?'-prefixo-'+process.env.PREFIXO_VISUAL:process.env.CENARIOS_VISUAL?'-extras'+(process.env.LARGURA_VISUAL||''):(filtro||''))+'.json',JSON.stringify(resultados,null,2));
 }
}finally{await provas.encerrar();}
if(process.env.EXIGIR_VISUAL==='1'&&resultados.some(r=>r.overflow||r.errors.length||r.stepErrors.length||r.evalError||r.small?.length||r.fonts?.length||(r.width>=1366&&r.mainWidth&&Math.abs(r.mainWidth-r.width)>1)||r.modals?.some(m=>r.width<640&&Math.abs(m.width-r.width)>1)))process.exitCode=1;
