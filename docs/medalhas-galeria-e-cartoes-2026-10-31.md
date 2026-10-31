# Medalhas — galeria múltipla e cartões em Destaques

Correção pedida pelo dono: cartões de Destaques mostram as medalhas já conquistadas; gestor deve permitir selecionar visualmente uma ou várias medalhas e depois um ou vários membros.

## Fluxo atual

Jornada → Evolução → Gestor de medalhas → Escolher medalhas. Não exige seleção na matriz.
1. Marque medalhas pelas imagens; busca preserva as seleções.
2. Escolha as pessoas no próprio gestor, com busca, filtro por nível e Selecionar visíveis.
3. Confira medalhas, pessoas e quantas conquistas novas serão concedidas. Motivo é opcional. Confirme.

O atalho Dar medalhas na matriz continua disponível e apenas pré-seleciona as pessoas marcadas. Permite até 50 medalhas e 500 pessoas por lote. A confirmação é uma transação única; quem já possui é preservado. Registro de autor/data/motivo e histórico continuam disponíveis. Sem motivo, registra Reconhecimento da coordenação. Mantém ausência de alterações de XP, missões, níveis e aptidões.

## Cartões

Todos os rankings de Destaques usam abrirCard. A galeria de medalhas conquistadas aparece nesse cartão, com arte e nome; no celular e tablet vem antes das últimas missas. Quem usa o app pode ver essas medalhas de outros membros ativos. Não exibe medalhas bloqueadas, critérios privados, motivo ou autor da concessão. Falha ao carregar as medalhas mantém o perfil visível e apresenta erro, sem fingir coleção vazia.

## Banco e verificação

Migration 122 adiciona RPCs de cartão e lote múltiplo, preservando a RPC singular da 121 para versões anteriores do app. A RPC múltipla exige coord_admin/subadmin e utiliza a concessão auditada existente. Os locks dos pares são adquiridos antes das escritas.

- docs/migrations/provas/122_medalhas_galeria_multiplas.prova.sql: ensaio com BEGIN/ROLLBACK. Produto 2 medalhas × 2 membros, prévia, concessão, motivo opcional/curto, repetição sem duplicar, limite e rejeição de lote inválido sem gravação parcial. Membro comum vê somente medalhas conquistadas de outro ativo; não recebe campos privados e não consegue conceder. Anônimo sem EXECUTE.
- node projetos/acolitos/provas/medalhas-admin.prova.mjs: galeria de 43 medalhas, seleção múltipla preservada na busca, escolha de pessoas sem matriz, resumo, envio múltiplo, resultado, erro bloqueando avanço, histórico, permissões visuais e regressão da notificação. Galeria, pessoas e resumo fotografados em 360, 390, 768, 1366 e 2560 px. Saída 0.
- node projetos/acolitos/provas/destaques-cartao.prova.mjs: cartões com duas artes aprovadas de medalhas, erro de medalhas sem ocultar perfil, leitura por membro comum, foco, carregamento tardio e responsividade nos mesmos cinco tamanhos. Saída 0.
- npm run provar-regras: 548/548. git diff --check passou.

Fotos e logs ficam em estudos/medalhas/admin-2026-10-30 e estudos/destaques-cartao-2026-10-31. Dados das telas são fictícios; os ensaios de concessão no banco são revertidos. Publicação no fluxo autorizado de commit, push e deploy.

Migration 122 aplicada em transação após ensaio revertido. EXECUTE conferido: funções acessíveis a authenticated (com checagens internas de papel), inacessíveis a anon.
