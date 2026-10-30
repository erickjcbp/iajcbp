# Conquistas — coleção e troféus em 30/10/2026

Continuação autorizada pelo dono: “pode seguir”.

## Implementado localmente
- Busca por nome, descrição ou requisito, sem diferenciar maiúsculas e acentos.
- Filtros Todas, Conquistadas e Para conquistar, com contagens vindas das medalhas do membro.
- Estado sem resultados, limpeza da busca e retorno à coleção completa.
- Em Para conquistar, requisitos visíveis nos cartões; duas colunas no celular para manter a leitura.
- Regras, critérios e atribuição das medalhas preservados; a interface usa a RPC existente.
- Nenhuma ordenação “mais recentes” nem percentual inventado: a RPC não informa data de ganho confiável para toda a coleção.
- Troféus com arte própria por liga: Iniciantes (azul/cruz), Acólitos (verde/cálice), Cerimoniários (rubi/turíbulo).
- Galeria responsiva dos troféus e ilustração do estado sem troféus.
- Fallback SVG mantido para liga desconhecida.

## Artes
Ferramenta nativa image_gen, com a medalha aprovada como referência de materiais e o primeiro troféu como referência das outras ligas.
Originais: estudos/trofeus-2026-10-30/{iniciantes,acolitos,cerimoniarios}.png
WebPs transparentes de 384 × 384: projetos/acolitos/trofeus-arte/
Total das três artes para o app: 108 KB.
Prompts: estudos/trofeus-2026-10-30/prompts.json
Galeria: estudos/trofeus-2026-10-30/index.html

## Conferência
node estudos/medalhas/colecao-2026-10-30/verificar.cjs — saída 0.
360, 390, 768, 1366 e 2560 px: sem rolagem horizontal e sem imagem quebrada.
43 medalhas e três troféus demonstrativos carregados; filtros e contagens conferidos.
Busca CORACAO SOLICITO encontra Coração Solícito; campos de busca com 16 px.
Casos sem conquistadas, todas conquistadas, nenhum catálogo e nenhuma correspondência conferidos.
Modal, teclado, Esc, foco e textos longos preservados.
As três WebPs têm transparência real e cantos vazios.
Fotos e resultados: estudos/medalhas/colecao-2026-10-30/.
A prévia usa progresso e temporadas demonstrativos, identificados no topo, com nomes e requisitos reais do catálogo.
Critérios consultados em modo somente leitura; nenhum dado de membro consultado ou alterado.

## Publicação
Troféus aprovados pelo dono em 30/10/2026: “aprovado os trofeus”. Etapa publicada no commit 90daff8, enviado ao GitHub. Deploy dpl_7SHS69pJivVpMXJdzXctM5vkYnDd READY e domínio público conferido: 33 arquivos HTTP 200, idênticos à versão aprovada. Evidências em estudos/medalhas/colecao-2026-10-30/publicacao.json.
A etapa anterior do commit 6bec9a7 foi preservada, acrescentando busca, filtros, requisitos e os três troféus.
As três artes foram acrescentadas ao cache do sw.js, com BUILD atualizado para publicação.
Publicar só a etapa aprovada a partir de uma base remota limpa; o main local preserva trabalho do Tarcísio que não deve ser enviado junto.
