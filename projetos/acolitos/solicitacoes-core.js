// Core de solicitações (troca/candidatura) — rótulos e estado. PURO (sem I/O).
// Usado por escalas-membro.html, index.html e ausencias.html; testável em node.
(function(global){
  'use strict';
  var STATUS_LABEL = {
    aguardando_colega:      'Aguardando o colega',
    aguardando_coordenacao: 'Aguardando a coordenação',
    aguardando_cobertura:   'Aguardando cobertura',
    recusado_colega:        'O colega recusou',
    homologado:             'Trocado ✓',
    coberto:                'Coberto ✓',
    aprovado:               'Aprovado ✓',
    negado:                 'Recusado pela coordenação',
    cancelado:              'Cancelado'
  };
  var STATUS_PENDENTE = ['aguardando_colega','aguardando_coordenacao','aguardando_cobertura','recusado_colega'];
  function estaPendente(s){ return STATUS_PENDENTE.indexOf(s) >= 0; }
  var TIPO_LABEL = { troca:'Troca', candidatura:'Candidatura' };
  var API = { STATUS_LABEL:STATUS_LABEL, STATUS_PENDENTE:STATUS_PENDENTE, estaPendente:estaPendente, TIPO_LABEL:TIPO_LABEL };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  global.SolicitacoesCore = API;
})(typeof window !== 'undefined' ? window : globalThis);
