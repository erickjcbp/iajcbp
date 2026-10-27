/* Regras compartilhadas pelo navegador, servidor e provas. */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.QuizCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  const temas = ['Bíblia','Vida de Jesus','Nossa Senhora','Santos','Sacramentos','Liturgia e Santa Missa','Objetos, vestes e espaços litúrgicos','Serviço dos coroinhas','Calendário e tempos litúrgicos','Conhecimentos gerais da fé católica'];
  const dificuldades = ['facil','medio','dificil'];
  const rotulos = {facil:'Fácil',medio:'Médio',dificil:'Difícil'};
  const pontos = {facil:10,medio:20,dificil:30};
  const id = () => globalThis.crypto.randomUUID();
  function texto(v, max, obrigatorio = false) { return typeof v === 'string' && v.length <= max && (!obrigatorio || !!v.trim()); }
  function configurar(c) {
    if (!c || !texto(c.titulo,120,true) || !['criancas','adolescentes','misto'].includes(c.faixa) || ![3,4].includes(c.alternativas) || !texto(c.observacoes,1500)) throw Error('Preencha título, faixa etária e alternativas. Observações: até 1.500 caracteres.');
    if (!Array.isArray(c.temas) || !c.temas.length || c.temas.length > 10 || new Set(c.temas).size !== c.temas.length || c.temas.some(t=>!temas.includes(t))) throw Error('Selecione ao menos um tema válido.');
    if (!c.quantidades || dificuldades.some(d=>!Number.isInteger(c.quantidades[d]) || c.quantidades[d]<0 || c.quantidades[d]>10)) throw Error('Use de zero a dez perguntas por dificuldade.');
    const total = dificuldades.reduce((s,d)=>s+c.quantidades[d],0);
    if (total<1 || total>24) throw Error('Gere de uma a 24 perguntas por vez.');
    return c;
  }
  function errosPergunta(q, alternativas) {
    const erros=[];
    if (!q || !texto(q.enunciado,1000,true)) erros.push('enunciado');
    if (!q || !dificuldades.includes(q.dificuldade)) erros.push('dificuldade');
    if (!q || !temas.includes(q.tema)) erros.push('tema');
    if (!q || !Array.isArray(q.alternativas) || q.alternativas.length!==alternativas || q.alternativas.some(a=>!texto(a,400,true)) || new Set(q.alternativas.map(a=>String(a).trim().toLocaleLowerCase('pt-BR'))).size!==alternativas) erros.push('alternativas diferentes e preenchidas');
    if (!q || !Number.isInteger(q.correta) || q.correta<0 || q.correta>=alternativas) erros.push('resposta correta');
    if (!q || !texto(q.explicacao,1500,true)) erros.push('explicação');
    if (!q || !texto(q.referencia,500)) erros.push('referência');
    return erros;
  }
  function validarQuiz(quiz, pronto=false) {
    configurar(quiz.config);
    if (!Array.isArray(quiz.perguntas) || quiz.perguntas.length>60) throw Error('Limite de 60 perguntas por quiz.');
    if (pronto && !quiz.perguntas.length) throw Error('Adicione pelo menos uma pergunta.');
    const ids = new Set(), enunciados = new Set();
    quiz.perguntas.forEach((q,i)=>{
      if (!q || typeof q.id!=='string' || ids.has(q.id) || typeof q.revisada!=='boolean' || !texto(q.enunciado,1000) || !texto(q.explicacao,1500) || !texto(q.referencia,500) || !Array.isArray(q.alternativas) || q.alternativas.length!==quiz.config.alternativas || q.alternativas.some(a=>!texto(a,400)) || !dificuldades.includes(q.dificuldade) || !temas.includes(q.tema) || !Number.isInteger(q.correta) || q.correta<0 || q.correta>=q.alternativas.length) throw Error('Estrutura inválida na pergunta '+(i+1));
      ids.add(q.id);
      const n=q.enunciado.trim().toLocaleLowerCase('pt-BR').replace(/\s+/g,' ');
      if (n && enunciados.has(n)) throw Error('Há perguntas repetidas.');
      enunciados.add(n);
      const e=errosPergunta(q,quiz.config.alternativas);
      if ((pronto || q.revisada) && (e.length || !q.revisada)) throw Error('Pergunta '+(i+1)+': '+(e.join(', ') || 'aguarda revisão'));
    });
    return quiz;
  }
  function geradas(resposta,c,existentes=[]) {
    configurar(c);
    if (!resposta || !Array.isArray(resposta.perguntas)) throw Error('Resposta da IA fora do formato.');
    const qs=resposta.perguntas;
    if (qs.length!==dificuldades.reduce((s,d)=>s+c.quantidades[d],0) || dificuldades.some(d=>qs.filter(q=>q.dificuldade===d).length!==c.quantidades[d])) throw Error('A IA devolveu quantidades incorretas.');
    const vistas=new Set(existentes.map(q=>q.enunciado.trim().toLocaleLowerCase('pt-BR').replace(/\s+/g,' ')));
    return qs.map(q=>{
      if (errosPergunta(q,c.alternativas).length || !c.temas.includes(q.tema)) throw Error('A IA devolveu uma pergunta inválida.');
      const n=q.enunciado.trim().toLocaleLowerCase('pt-BR').replace(/\s+/g,' ');
      if (vistas.has(n)) throw Error('A IA repetiu uma pergunta. Tente novamente.');
      vistas.add(n);
      return {id:id(),enunciado:q.enunciado,dificuldade:q.dificuldade,tema:q.tema,alternativas:q.alternativas,correta:q.correta,explicacao:q.explicacao,referencia:q.referencia,revisada:false,alerta:typeof q.alerta==='string'?q.alerta.slice(0,500):'Conferir doutrina e referências antes de usar.'};
    });
  }
  function novaPergunta(c,d='facil') {return {id:id(),enunciado:'',dificuldade:d,tema:c.temas[0],alternativas:Array(c.alternativas).fill(''),correta:0,explicacao:'',referencia:'',revisada:false};}
  function novoQuiz(){return {config:{titulo:'',faixa:'criancas',temas:[temas[0]],quantidades:{facil:6,medio:6,dificil:6},alternativas:3,observacoes:''},perguntas:[],status:'rascunho'};}
  function classificar(casas,lancamentos){
    const linhas=casas.map(c=>({...c,total:lancamentos.filter(l=>l.casa_id===c.id).reduce((s,l)=>s+l.valor,0)})).sort((a,b)=>b.total-a.total || a.nome.localeCompare(b.nome,'pt-BR'));
    return linhas.map((c,i)=>({...c,posicao:linhas.findIndex(x=>x.total===c.total)+1,empate:linhas.filter(x=>x.total===c.total).length>1}));
  }
  function resultadosAtivos(lancamentos,rodadaId){
    const estornados=new Set(lancamentos.filter(l=>l.estorno_de).map(l=>l.estorno_de));
    return lancamentos.filter(l=>l.rodada_id===rodadaId&&l.pergunta_id&&!l.estorno_de&&!estornados.has(l.id));
  }
  function disponiveis(perguntas,lancamentos,rodadaId,dificuldade){
    const usadas=new Set(resultadosAtivos(lancamentos,rodadaId).map(l=>l.pergunta_id));
    return perguntas.filter(q=>(!dificuldade||q.dificuldade===dificuldade)&&!usadas.has(q.id));
  }
  return {resultadosAtivos,disponiveis,temas,dificuldades,rotulos,pontos,configurar,errosPergunta,validarQuiz,geradas,novaPergunta,novoQuiz,classificar};
});
