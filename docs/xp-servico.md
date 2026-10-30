# XP por missa e chamada — 26/10/2026

Pedido aprovado: 20 XP por missa servida e 10 XP por chamada finalizada.

`acolitos_chamada_finalizar` recebe celebração e marcações completas. Confere papel/escopo, bloqueia celebrações futuras e grava chamada, itens e status numa transação. Falhas preservam as marcações no navegador. Chamadas novas precisam ser finalizadas pelo novo botão; eventos anteriores à ativação não são bonificados retroativamente.

O ledger `acolitos_xp_servico` tem unicidade por celebração, membro e origem; um índice adicional permite um único crédito de chamada por celebração. Quem está presente ou atrasado, substitui alguém ou consta como presença avulsa recebe o crédito de serviço. Múltiplas funções não multiplicam os 20 XP. Só o primeiro responsável pelo fechamento recebe os 10 XP de chamada. Correção/remoção de presença reconcilia saldo e lançamentos da temporada; refazer não cria um novo evento.

Os bônus de ajuda extra já existentes para substitutos/avulsos continuam separados do crédito base de 20 XP. Eles não foram removidos por esta mudança. XP de serviço entra em `xp_avulso` e na temporada, seguindo o modelo existente de XP extra; não concede promoção ou habilitação. O popup não anuncia estrela de formação por esse crédito extra.

`acolitos_xp_servico_meus` só retorna eventos da própria conta ou perfil familiar permitido. A leitura é confirmada por `acolitos_xp_servico_visto` depois que o popup fecha. Falha de leitura não inventa crédito; falha de confirmação não trava a fila e permite reapresentação futura. Na finalização mostra os 10 XP; os 20 XP de missa aparecem no próximo acesso ao perfil após a chamada finalizada.

Migração: `docs/migrations/108_xp_missas_chamadas.sql`, aplicada ao projeto fttjgsotuosjfrasttds. Sem backfill de presenças antigas. SQL de teste local: `provas/xp-servico-banco.prova.cjs`, banco descartável em 127.0.0.1:55440. Prova no esquema real: `provas/xp-servico-producao.prova.cjs --producao`, com dados de celebração/XP em transação revertida e conta Auth temporária removida. Fotografias e relatórios: `~/projetos/iajcbp/historico-tarcisio/xp-missas-2026-10-26`.

Aceite conferido: autorização, uma transação, repetição e concorrência sem duplicar, estorno, substituição/atraso, leitura e confirmação de popup, preservação das marcações após falha, 390/768/1440/2560 px e regressões da Jornada. Publicação isolada: somente shared.js e chamada.html alterados sobre o pacote anteriormente publicado.

Push: a proposta de dois convites de quests por fim de semana é regra de frequência ajustável, não teto técnico do app. A agenda de engajamento sugerida na conversa ainda não foi implementada nesta entrega.
