# Evolução — lista preenchida de competências

Correção solicitada pelo dono: lista feia e seletores brancos. A etapa anterior conferiu lista vazia e corrigiu apenas o seletor de criação; os seletores de itens existentes ainda não usavam form-input.

Competências agora em cartões de grade fluida, empilhados no celular. Nome destacado, rótulos visíveis para faixa e peso, explicação do peso padrão, campo numérico de 16 px e 44 px, ação Remover competência e seção de criação separada. Todos os seletores recebem form-input. Mantidos handlers e critérios de faixa, peso, adição e remoção, incluindo confirmação antes de excluir.

Conferência: node estudos/jornada-abas-2026-10-30/competencias-visual.mjs, saída 0. Três competências preenchidas, nome longo, peso personalizado e peso herdado. Em 360, 390, 768, 1366 e 2560 px: sem rolagem horizontal ou erros JS; seletores sem fundo branco; menu real troca faixa e envia atualização; peso envia atualização esperada. Somente banco simulado, sem alterar competências reais. Fotografias competencias-*.png na mesma pasta. git diff --check passou.

Publicação dentro da autorização vigente de commit, push e deploy.
