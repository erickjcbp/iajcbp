# Medalhas — filtro por tipo e dez propostas

Filtro Todas as medalhas / Automáticas / Concedidas pela coordenação na coleção e no gestor. A categoria usa validacao da medalha: automatica ou avaliação/reivindicação com decisão da coordenação. Concessão manual de medalha automática não muda a categoria.

Na coleção, combina com busca, status conquistada/pendente e ordenação; contagens de status acompanham o tipo. Ver todas as medalhas limpa tipo, status e busca. No gestor, filtrar preserva seleções já feitas, inclusive de outra categoria. Nenhuma mudança de regra, banco ou concessão.

Verificação: node projetos/acolitos/provas/medalhas-tipo.prova.mjs, saída 0. Coleção e gestor em 360, 390, 768, 1366 e 2560 px, filtros cruzados, restauração, preservação da seleção e ausência de rolagem horizontal. Fixture atual com 31 automáticas e 12 da coordenação. Regressão node projetos/acolitos/provas/medalhas-admin.prova.mjs, saída 0, incluindo galeria, múltiplos membros, concessão simulada e notificação. Fotos em estudos/medalhas/tipos-2026-10-31. git diff --check passou.

## Propostas ainda não cadastradas

Todas seriam avaliadas e concedidas pela coordenação; nomes e critérios propostos após conferir as 43 medalhas existentes. Aguardar aprovação antes de criar registros e artes.

| Medalha | Reconhecimento |
|---|---|
| Bom Samaritano | Participar de uma ação solidária e servir quem precisa. |
| Coração Acolhedor | Receber e acompanhar novos membros nos primeiros encontros. |
| Servo dos Bastidores | Ajudar na preparação e organização antes e depois das celebrações. |
| Ponte da Paz | Ajudar a resolver um desentendimento com respeito e diálogo. |
| Guardião da Criação | Cuidar dos recursos da pastoral, promovendo reutilização e evitando desperdícios. |
| Escuta que Transforma | Acolher uma orientação e demonstrar melhora concreta na prática. |
| Coragem de Recomeçar | Retomar o serviço com responsabilidade após uma dificuldade. |
| Semeador da Palavra | Preparar e partilhar uma reflexão do Evangelho na formação. |
| Amigo de Todos | Incluir ativamente quem estava isolado nas atividades. |
| Memória Viva | Organizar e preservar materiais e aprendizados para as próximas equipes. |

Filtro publicado no fluxo autorizado de commit, push e deploy. As propostas não alteram o catálogo.
