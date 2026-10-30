# Conquistas — apresentação visual em 30/10/2026

O dono autorizou iniciar as melhorias após a revisão visual. Esta primeira etapa cobre medalhas maiores, grade fluida e modal de detalhes.

## Implementado
- Quatro colunas mantidas no celular, com artes de 60 px e nomes de 12 px.
- Grade automática em toda a largura: 4 colunas em 768 px, 8 em 1366 px e 15 em 2560 px.
- Artes de 96 px no computador e 112 px em TV.
- Medalhas bloqueadas reconhecíveis, com menos escurecimento.
- Cartões de medalha são botões nativos, com nome acessível e foco visível.
- Modal com arte de 176 px no celular e até 320 px no computador; descrição e requisito agrupados.
- Modal em tela cheia no celular e sem limite lateral fixo no computador.
- Navegação por teclado, foco contido no diálogo e retorno ao cartão ao fechar.
- Fundo sem listras nesta tela; bordas das medalhas mais discretas.
- Aviso de instalação oculto somente em Conquistas, sem alterar a preferência do usuário nas outras telas.
- Artes aprovadas, regras de conquista, dados dos membros e configuração dos escudos preservados.

## Conferência local
Comando: node estudos/medalhas/layout-2026-10-30/verificar.cjs
Saída 0, nenhuma exceção de JavaScript.
43 medalhas, nenhuma imagem quebrada e nenhuma rolagem horizontal em 360, 390, 768, 1366 e 2560 px.
Abrir por Enter, navegar por Tab, fechar, Esc e retorno do foco conferidos.
Descrição e requisito longos testados em 360 × 640 e 844 × 390; conteúdo rola e o fechamento segue acessível.
Fotos e resultados: estudos/medalhas/layout-2026-10-30/.
A configuração de níveis foi lida de acolitos_config (niveis_full e niveis) apenas para reproduzir os escudos atuais na prévia.
A prévia substitui autenticação e RPCs por conquistas demonstrativas; não altera dados reais.

## Arquivo do app
projetos/acolitos/conquistas.html

## Próximas etapas sugeridas
- Organização por conquistas recentes e próximas, conforme os dados disponíveis.
- Novas artes dos troféus de temporada, com revisão visual antes da publicação.

## Publicação
Etapa aprovada pelo dono e publicada em 30/10/2026. Commit 6bec9a7 enviado ao GitHub e deploy dpl_BMhypPZzyQhRNLV9jqqxAoYifoPP em estado READY. Domínio público conferido: 30 arquivos HTTP 200 e idênticos à versão aprovada, incluindo as 27 artes. Evidências em estudos/medalhas/layout-2026-10-30/publicacao.json. A publicação foi isolada do commit e das alterações locais do Tarcísio.
As 43 medalhas aprovadas permanecem preservadas na apresentação renovada.
