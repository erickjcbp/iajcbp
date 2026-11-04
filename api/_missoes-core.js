// Contrato privado do motor. Campos públicos são construídos por allowlist.
export const NIVEIS=['aspirante','coroinha','acolito_aspirante','acolito_guardiao','acolito_sentinela','aspirante_cerimoniario','cerimoniario_aspirante','cerimoniario_guardiao','cerimoniario_magistral','cerimoniario_mor'];
export const SLOTS=['simples','simples','simples','investigacao','investigacao','interacao','desafio','desafio'];
export const classificarEsforco=tipo=>{const xp={simples:10,investigacao:20,interacao:40,desafio:10}[tipo];if(!xp)throw Error('Tipo inválido.');return {faixa:tipo,xp};};
const text=(s,max=450)=>typeof s==='string'&&s.trim().length>0&&s.length<=max;
const list=(v,min,max,len=450)=>Array.isArray(v)&&v.length>=min&&v.length<=max&&v.every(s=>text(s,len));
const only=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).every(k=>keys.includes(k));
export function validarProposta(p,{fontes,niveis=NIVEIS}){
 const keys=['versao','titulo','gancho','objetivo','tipo','niveis','tempo_min','passos','pistas','fontes','alvo_local','objetivo_chave','mecanica','avaliacao'];
 if(!only(p,keys))throw Error('Campo não permitido (XP e estado pertencem ao sistema).');
 if(p.versao!==1||!text(p.titulo,90)||!text(p.gancho,240)||!text(p.objetivo,350)||!list(p.passos,2,4)||!list(p.pistas,1,3)||!Array.isArray(p.niveis)||!p.niveis.length||new Set(p.niveis).size!==p.niveis.length||p.niveis.some(n=>!niveis.includes(n))||!Number.isInteger(p.tempo_min)||p.tempo_min<1||p.tempo_min>60||!text(p.alvo_local,100)||!text(p.objetivo_chave,100)||!text(p.mecanica,100))throw Error('Proposta incompleta: confira campos, nível e passos.');
 const {xp}=classificarEsforco(p.tipo);
 if(!Array.isArray(p.fontes)||!p.fontes.length||p.fontes.length>6)throw Error('Informe fontes confirmadas.');
 for(const ref of p.fontes){const f=fontes.find(f=>f.id===ref.id&&f.versao===ref.versao&&f.estado==='ativa');if(!only(ref,['id','versao','trecho'])||!f||!text(ref.trecho,1500)||!f.conteudo.includes(ref.trecho))throw Error('Fonte, versão ou trecho não confirmado.');}
 const a=p.avaliacao;if(!only(a,['criterio','gabarito','itens'])||!text(a.criterio,800)||!text(a.gabarito,1500)||!Array.isArray(a.itens))throw Error('Critério e gabarito são obrigatórios.');
 if(p.tipo!=='desafio'&&a.itens.length)throw Error('Itens digitais somente em desafios.');
 if(p.tipo==='desafio'){
  if(a.itens.length<1||a.itens.length>4||p.niveis.length!==1)throw Error('Desafio exige nível específico e até quatro itens.');
  for(const i of a.itens){if(!only(i,['texto','formato','opcoes','correta','explicacao'])||!text(i.texto,800)||!text(i.explicacao,600)||!['alternativas','associacao','ordenacao'].includes(i.formato)||!Array.isArray(i.opcoes)||i.opcoes.length<3||i.opcoes.length>6||!Array.isArray(i.correta))throw Error('Item digital inválido.');
   const ids=i.opcoes.map(o=>o.id);if(i.opcoes.some(o=>!only(o,['id','texto'])||!text(o.id,30)||!text(o.texto,220))||new Set(ids).size!==ids.length||i.correta.some(id=>!ids.includes(id))||new Set(i.correta).size!==i.correta.length||i.correta.length!==(i.formato==='alternativas'?1:ids.length))throw Error('Gabarito digital inconsistente.');
  }
 }
 return {...JSON.parse(JSON.stringify(p)),xp,foto_obrigatoria:p.tipo!=='desafio'};
}
export function publicarSeguro(p){return {versao:1,titulo:p.titulo,gancho:p.gancho,tipo:p.tipo,niveis:p.niveis,tempo_min:p.tempo_min,passos:p.passos,pistas:p.pistas,xp:classificarEsforco(p.tipo).xp,foto_obrigatoria:p.tipo!=='desafio',...(p.tipo==='desafio'?{itens:p.avaliacao.itens.map(i=>({texto:i.texto,formato:i.formato,opcoes:i.opcoes.map(o=>({id:o.id,texto:o.texto}))}))}:{})};}
export function semDerivados(p){const {xp,foto_obrigatoria,...clean}=p;return clean;}
