# Destaques — cartão do membro

Cartão com nome completo, foto/brasão, nível, indicadores ampliados e histórico em blocos separados. Layout ocupa a largura disponível no computador, empilha no tablet e usa modal em tela cheia no celular. Nomes, funções e comunidade podem quebrar linha. Comunidade ausente não é apresentada como Santo Antônio.

Consultas e ordenação do histórico preservadas. Nenhuma alteração de dados ou permissões do banco. Erro de carregamento mantém a ação de fechar; resposta tardia não recria conteúdo após fechar. Modal contém foco, aceita Escape e restaura origem e rolagem do fundo.

Verificação: node projetos/acolitos/provas/destaques-cartao.prova.mjs, saída 0, em 360, 390, 768, 1366 e 2560 px. Nome longo, indicadores, três missas, função extensa, ausência de rolagem horizontal, largura móvel integral, foco, fechamento, erro, vazio e resposta tardia. Regressão das seis categorias e empates: node estudos/jornada-abas-2026-10-30/destaques-visual.mjs, saída 0, mesmos cinco tamanhos. Fotos em estudos/destaques-cartao-2026-10-31. Dados de prova, sem consulta a ficha real. git diff --check passou.

Publicação dentro da autorização vigente de commit, push e deploy.
