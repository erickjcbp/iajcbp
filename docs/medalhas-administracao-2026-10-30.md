# Medalhas — notificação e concessão em massa

Pedido do dono: notificação deve mostrar a medalha real; conceder qualquer medalha do catálogo em massa, inclusive sem cumprir critérios automáticos, com concessão manual registrada.

## Como usar

Jornada → Evolução: filtre os membros e marque as caixas da matriz (inclusive selecionar todos os visíveis). Use Dar medalhas na barra ou Conceder medalhas na seção Medalhas em massa. A seleção pode abranger níveis diferentes e permanece visível na contagem. Até 500 membros ativos que servem por lote.

Busque a medalha pelo nome ou descrição; veja sua arte; informe motivo de 3 a 500 caracteres. Revisar concessão mostra a lista nominal, quantos receberão e quantos já possuem. Confirmar concede somente aos que ainda não possuem. Histórico manual da medalha mostra os últimos 100 registros com membro, autor, data e motivo. Concessão disponível apenas a coord_admin/subadmin, validada também no banco.

A medalha manual aparece no mural com data e é independente de XP, conclusão de missão, aptidões e critérios automáticos. Não promove nível. O registro não concede novamente a quem já possui. Um lote inválido é inteiramente rejeitado; a confirmação reavalia o estado atual, mesmo que a prévia tenha envelhecido. Uma resposta de rede incerta exige nova revisão; repetir não duplica a concessão manual ou seu aviso.

## Notificação

showAvisoUnico encaminha o aviso inteiro. A celebração usa a mesma WebP de Conquistas e exibe nome, descrição e acesso à coleção. Avisos antigos com apenas label são resolvidos pelo catálogo autenticado. Avisos manuais já carregam ID, ícone, nível e tier. Catálogo sem dados/rede ou arte desconhecida usa SVG de reserva. Modal móvel de tela inteira, foco contido, Escape e retorno à origem; rolagem do fundo restaurada ao fechar. Os outros tipos de celebração mantêm seu motor.

## Banco

Migration 121: acolitos_medalhas_manuais, RLS sem acesso direto de anon/authenticated; catálogo visual autenticado; RPC transacional de prévia/concessão; RPC de histórico restrita à coordenação; helper privado sem EXECUTE para público/anon/authenticated. Concessão grava ator, motivo e data; registra ganho_em e um aviso interno. Não envia WhatsApp nem push de sistema operacional. acolitos_badges_membro incorpora a concessão manual sem alterar o cálculo automático.

## Verificação

- npm run provar-regras: 548/548.
- node projetos/acolitos/provas/medalhas-admin.prova.mjs: interface e notificação em 360, 390, 768, 1366 e 2560 px; 43 artes resolvidas, lista preenchida, seleção da matriz, motivo obrigatório, revisão e invalidação, payload confirmado, erro de prévia bloqueando confirmação, histórico, restrição visual da equipe; aviso antigo resolve arte, foco contido, texto longo em 390×640, fechamento restaura fila/rolagem. Dados simulados.
- docs/migrations/provas/121_medalhas_concessao_manual.prova.sql: roda da raiz com psql -X -v ON_ERROR_STOP=1 -f; inclui BEGIN e ROLLBACK. Ensaiada antes de aplicar. Verifica autorização, ACL de tabela/helper, anônimo, membro comum, catálogo, limites, motivo obrigatório, lote inválido, ganho no mural, auditoria, repetição idempotente, aviso com ícone e preservação de XP/progresso. Nenhuma concessão de teste é persistida.
- Fotos e evidências em estudos/medalhas/admin-2026-10-30, ignoradas pelo Git. Fixture versionado contém apenas o catálogo público das medalhas e nomes fictícios.
- Publicação autorizada no fluxo vigente de commit, push e deploy. Nenhuma medalha real foi concedida para validar esta entrega.

## Aplicação

Migration 121 aplicada em transação única após os ensaios revertidos. Conferência persistida: RLS ativa, authenticated sem SELECT/INSERT direto, catálogo autenticado com 43 medalhas e zero concessões manuais reais.
