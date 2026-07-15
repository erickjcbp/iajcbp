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

// ── agruparVagasPorMissa ──
const { agruparVagasPorMissa } = require('./solicitacoes-core.js');
eq('vazio → []', agruparVagasPorMissa([]), []);
eq('null → []', agruparVagasPorMissa(null), []);
eq('2 funções da mesma missa → 1 missa com 2 funções',
  agruparVagasPorMissa([
    { celebracao_id:'c1', data:'2026-07-19', horario:'19:00', comunidade:'matriz', tipo:'missa_comum', funcao:'cruz' },
    { celebracao_id:'c1', data:'2026-07-19', horario:'19:00', comunidade:'matriz', tipo:'missa_comum', funcao:'vela' }
  ]),
  [{ celebracao_id:'c1', data:'2026-07-19', horario:'19:00', comunidade:'matriz', tipo:'missa_comum', funcoes:['cruz','vela'] }]);
eq('2 missas → preserva ordem de entrada',
  agruparVagasPorMissa([
    { celebracao_id:'c1', data:'2026-07-19', horario:'19:00', comunidade:'matriz', tipo:'missa_comum', funcao:'cruz' },
    { celebracao_id:'c2', data:'2026-07-20', horario:'08:00', comunidade:'santo_antonio', tipo:'missa_comum', funcao:'vela' }
  ]).map(m=>m.celebracao_id),
  ['c1','c2']);
eq('função duplicada é deduplicada',
  agruparVagasPorMissa([
    { celebracao_id:'c1', data:'2026-07-19', horario:'19:00', comunidade:'matriz', tipo:'missa_comum', funcao:'cruz' },
    { celebracao_id:'c1', data:'2026-07-19', horario:'19:00', comunidade:'matriz', tipo:'missa_comum', funcao:'cruz' }
  ])[0].funcoes,
  ['cruz']);

console.log(falhas? ('\n'+falhas+' FALHA(S)') : '\nTODOS OK');
process.exit(falhas?1:0);
