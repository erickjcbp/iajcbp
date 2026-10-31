# Seleção de membros por níveis no gestor de medalhas

A etapa Quem vai receber mostra filtros visíveis por nível, com contagem de membros e seleção de um ou vários níveis. Os níveis presentes seguem a ordem da jornada; membro sem nível é tratado como Aspirante. Todos os níveis limpa o filtro de nível e a busca por nome continua combinada ao filtro.

Marcar todos do filtro e Desmarcar todos do filtro atuam somente nos membros exibidos. Limpar toda a seleção também remove os selecionados que ficaram fora do filtro. O contador informa quantos membros foram encontrados, quantos estão selecionados no total e quantos selecionados estão ocultos pelo filtro. As seleções são preservadas ao buscar, trocar níveis e voltar da conferência.

O bloqueio de controles durante requisições agora abrange também as etapas temporariamente fora do DOM. Isso corrige controles que permaneciam desativados ao voltar do resumo para escolher membros. Nenhuma alteração na concessão ou no banco.

Verificação: medalhas-niveis.prova.mjs cobre níveis múltiplos, busca combinada, marcação/desmarcação restritas ao filtro, preservação dos selecionados ocultos, resultado vazio, limpeza global, nível ausente, retorno da conferência, payload de prévia e bloqueio sem seleção. Fotos em 360, 390, 768, 1366 e 2560 px, sem rolagem horizontal e com alvos de toque de pelo menos 44 px. Regressão medalhas-admin.prova.mjs cobre os três passos, prévia/concessão simuladas, erros, permissões e notificações. Logs e fotos em estudos/medalhas/niveis-2026-10-31. Nenhuma medalha real concedida nos testes.
