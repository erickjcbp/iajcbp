# Medalhas — filtro por tipo e dez propostas

Filtro Todas as medalhas / Automáticas / Concedidas pela coordenação na coleção e no gestor. A categoria usa validacao da medalha: automatica ou avaliação/reivindicação com decisão da coordenação. Concessão manual de medalha automática não muda a categoria.

Na coleção, combina com busca, status conquistada/pendente e ordenação; contagens de status acompanham o tipo. Ver todas as medalhas limpa tipo, status e busca. No gestor, filtrar preserva seleções já feitas, inclusive de outra categoria. Nenhuma mudança de regra, banco ou concessão.

Verificação: node projetos/acolitos/provas/medalhas-tipo.prova.mjs, saída 0. Coleção e gestor em 360, 390, 768, 1366 e 2560 px, filtros cruzados, restauração, preservação da seleção e ausência de rolagem horizontal. Fixture atual com 31 automáticas e 12 da coordenação. Regressão node projetos/acolitos/provas/medalhas-admin.prova.mjs, saída 0, incluindo galeria, múltiplos membros, concessão simulada e notificação. Fotos em estudos/medalhas/tipos-2026-10-31. git diff --check passou.

## Dez medalhas aprovadas e cadastradas

Todas foram aprovadas pelo dono e recebem arte própria dourada com fundo transparente. Cadastro pela migração 123, com concessão manual registrada, sem XP nem requisito de nível. O catálogo passa de 43 para 53 medalhas: 31 automáticas e 22 da coordenação.

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

As dez artes estão em projetos/acolitos/medalhas-arte. Detalhes da implementação e validação em medalhas-dez-artes-2026-10-31.md.
