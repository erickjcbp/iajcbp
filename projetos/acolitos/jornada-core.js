/* Um episódio = uma quest. Os caminhos não têm ids de conclusão próprios. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.JornadaCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const niveis=['aspirante','coroinha','acolito_aspirante','acolito_guardiao','acolito_sentinela','aspirante_cerimoniario','cerimoniario_aspirante','cerimoniario_guardiao','cerimoniario_magistral','cerimoniario_mor'];
  const desafios=['Descobrir','Experimentar','Preparar','Perceber e agir','Conectar as partes','Conduzir com apoio','Decidir em equipe','Ensinar e adaptar','Criar e testar','Formar quem ensina'];
  const focos={descoberta:'Descobertas e bastidores',formacao:'Formação e compreensão',aptidao:'Treino acompanhado de uma habilidade',equipe:'Colaboração e decisões em equipe',mentoria:'Ensinar, criar e acompanhar'};
  const metaBase=nivel=>{const i=niveis.indexOf(nivel);if(i<0)throw Error('Nível inválido.');return i<2?3:i<5?4:5;};
  function texto(v,max=800){return typeof v==='string'&&v.trim().length>0&&v.length<=max;}
  function lista(v,min,max,len){return Array.isArray(v)&&v.length>=min&&v.length<=max&&v.every(x=>texto(x,len));}
  function validar(v){
    if(!v||v.versao!==1||!niveis.includes(v.nivel)||!texto(v.titulo,90)||!texto(v.gancho,350)||!texto(v.objetivo,350)||!texto(v.tempo,90)||!lista(v.criterios,2,4,350)||!lista(v.pistas,2,3,350)||!texto(v.fecho,250))throw Error('Episódio incompleto: confira título, objetivo, critérios e pistas.');
    if(!Array.isArray(v.caminhos)||v.caminhos.length!==2||v.caminhos.some(c=>!c||!texto(c.titulo,70)||!lista(c.passos,2,4,450)))throw Error('Crie dois caminhos, com dois a quatro passos cada.');
    if(v.caminhos[0].titulo===v.caminhos[1].titulo)throw Error('Os caminhos precisam oferecer maneiras diferentes de chegar ao mesmo objetivo.');
    if(!v.cena||!texto(v.cena.texto,800)||!Array.isArray(v.cena.escolhas)||v.cena.escolhas.length!==3||v.cena.escolhas.some(e=>!texto(e.texto,220)||!texto(e.retorno,500)))throw Error('A cena precisa de três escolhas com retornos claros.');
    // Lista explícita impede campos extras, como xp/status/ids, de atravessarem o contrato.
    return JSON.parse(JSON.stringify({versao:1,nivel:v.nivel,titulo:v.titulo,gancho:v.gancho,objetivo:v.objetivo,tempo:v.tempo,criterios:v.criterios,pistas:v.pistas,fecho:v.fecho,caminhos:v.caminhos.map(c=>({titulo:c.titulo,passos:c.passos})),cena:{texto:v.cena.texto,escolhas:v.cena.escolhas.map(e=>({texto:e.texto,retorno:e.retorno}))}}));
  }
  function evidencia(v,caminho,escolha,relato){v=validar(v);if(![0,1].includes(caminho)||![0,1,2].includes(escolha)||!texto(relato,3000))throw Error('Escolha um caminho e conte como foi.');return ['Quest: '+v.titulo,'Caminho: '+v.caminhos[caminho].titulo,'Na cena: '+v.cena.escolhas[escolha].texto,'Minha experiência: '+relato.trim()].join('\n');}
  return {niveis,desafios,focos,metaBase,validar,evidencia};
});
