// Testes do core de solicitações. Rodar: node projetos/acolitos/solicitacoes-core.test.js
const { STATUS_LABEL, estaPendente, TIPO_LABEL } = require('./solicitacoes-core.js');
let falhas = 0;
function eq(nome, got, exp){
  const ok = JSON.stringify(got)===JSON.stringify(exp);
  console.log((ok?'PASS':'FAIL')+' — '+nome+(ok?'':'  got='+JSON.stringify(got)+' exp='+JSON.stringify(exp)));
  if(!ok) falhas++;
}
eq('rótulo aguardando_colega', STATUS_LABEL['aguardando_colega'], 'Aguardando o colega');
eq('rótulo homologado', STATUS_LABEL['homologado'], 'Trocado ✓');
eq('rótulo negado', STATUS_LABEL['negado'], 'Recusado pela coordenação');
eq('aguardando_colega é pendente', estaPendente('aguardando_colega'), true);
eq('recusado_colega é pendente (dá pra reenviar/cobrir)', estaPendente('recusado_colega'), true);
eq('homologado NÃO é pendente', estaPendente('homologado'), false);
eq('cancelado NÃO é pendente', estaPendente('cancelado'), false);
eq('tipo troca', TIPO_LABEL['troca'], 'Troca');
console.log(falhas? ('\n'+falhas+' FALHA(S)') : '\nTODOS OK');
process.exit(falhas?1:0);
