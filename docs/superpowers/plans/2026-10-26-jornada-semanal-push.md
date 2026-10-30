# Jornada semanal e push — implementação autorizada

**Objetivo:** preservar capítulos manuais, organizar a tela do membro e a coordenação, renovar bônus semanalmente com apoio da IA e programar convites condicionais para o fim de semana.

- Capítulos existentes e critérios de promoção preservados. Episódios interativos existentes entram como experiências extras no capítulo atual, sem virar novas obrigações.
- Bônus semanais usam modelos aprovados de jogo, fotografia de detalhe e interação com outro grupo. A IA seleciona modelos disponíveis; conteúdo livre novo continua em rascunho para revisão. Jogo validado no servidor e XP único; foto e relato passam pela coordenação.
- Segunda-feira, 08h Brasília: nova seleção semanal. Tarefas iniciadas podem ser enviadas até sete dias após a virada. Histórico preservado.
- Sexta 18h: novidade; sábado 10h: só quem não abriu; domingo 17h: só quem iniciou e ainda não enviou. Máximo dois convites por usuário/semana, sem duplicar contas de família. Resumo da coordenação domingo 19h se houver pendências. Respeitar pausas por usuário e configurações gerais.
- Agendamento independente na VPS, com credencial exclusiva para uma rotina fechada da Jornada; não ampliar o segredo do robô de WhatsApp nem tocar em suas rotinas. Entregas registram aceitação pelo serviço push, não alegam leitura nem entrega garantida ao aparelho.
- Evidências de fotos em bucket privado, sem envio à IA. Acesso somente autor/coordenação autorizada; URL temporária na revisão.
- Coordenação separada em Aprovações, Conteúdo, Programação e Evolução. Acesso protegido pela permissão real Jornada.
- Validar banco isolado, concorrência/XP, autorização, calendário e filtros de push, falhas de provedor, interface e fotografias em 390/768/1440/2560 antes de declarar concluído.

## Execução
- [x] Banco: jogos privados e validação atômica, evidências, fila push idempotente, atividade e configuração.
- [x] API: catálogo aprovado, geração/seleção semanal, rotinas, acesso do membro, envio de evidência e configurações administrativas.
- [x] Interface: mapa de capítulos preservado, aventuras da semana, jogos/fotos e revisão por abas.
- [x] Operação: teste real sem disparar convites de teste a membros, agendamento na VPS e confirmação pública.

Verificado em produção em 26/10/2026. Publicação dpl_3Q6bWUeZtVc4vTkvByAy1WZSNBbb; migração109 aplicada; timer jornada-semanal ativo e primeiro ciclo com0 convites. Prova autenticada: jogo único sob concorrência, foto privada, outro usuário negado, aprovação única. Evidências em /Users/erickmartins/projetos/iajcbp/historico-tarcisio/jornada-semanal-2026-10-26.
