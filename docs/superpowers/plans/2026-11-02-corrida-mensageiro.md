# Corrida do Mensageiro — implementação

Escopo aprovado na conversa: runner 2D, três faixas, salto/deslize, partidas curtas, XP limitado, recorde, personalização e trilha sonora em cada game.

Arquitetura: Canvas 2D sem dependências novas; simulação determinística a 60 Hz compartilhada com servidor; Web Audio com composição instrumental original. Página autenticada integrada ao menu de Jornada. RPCs guardam sessões e concedem XP atomicamente somente pelo servidor após reproduzir os comandos. Ganhos entram em xp_avulso e na temporada existente.

- [x] Motor: controles, colisões, três chances, coleta/combos, dificuldade crescente, entrega aos 90 s. Testar determinismo, limites, salto/deslize e replay inválido.
- [x] Experiência: cenário ilustrado procedural, personagem, animação, tutorial, pausa, áudio separado de efeitos, recorde e três roupas. Teclado, swipe e botões de 44px. Treino disponível se a conexão falhar, sem prometer XP.
- [x] Integração: sessão vinculada ao usuário e perfil autorizado; replay no servidor; máximo 20 XP/partida e 60 XP/dia em São Paulo; conclusão idempotente e concorrência serializada. Sem mudanças em configurações do Claude.
- [x] Verificação: regras Node; testes API; PostgreSQL isolado para grants, propriedade, duplicação e limite diário; fotos 360/390, 768, 1366 e 2560px; verificar som/pausa/retomada e controles.

Pontos de revisão: aba em segundo plano pausa sem consumir simulação; resize não altera física; sessão expirada não anuncia XP; retry reutiliza a partida; storage bloqueado não impede jogar. Não publicar sem conferir projeto/conta e concluir os testes.

Decisões de implementação: cenário fictício inspirado em cidades antigas, sem alegar reconstrução histórica; som sintetizado localmente, sem downloads nem direitos de terceiros; roupas cosméticas desbloqueadas por recorde pessoal. Limite de 90s na primeira rota. CLI Supabase local termina em SIGKILL, inclusive após execução fora da sandbox: migração seguirá convenção de timestamp do repositório caso o CLI permaneça indisponível.


Conclusão: implementação local concluída; evidências em `materiais-paroquia/provas/mensageiro/VALIDACAO.md`. Regras578/578, banco PASS, UI PASS13fotos. Revisão independente e correções registradas no relatório. Publicação e aplicação da migração não executadas. Suíte geral tem21falhas de telas reproduzidas em baseline (com limitação de assets descrita no relatório). Precache novo adiado até publicação conjunta para preservar o trabalho concorrente.


## Evolução visual aprovada: Tíquico

Integração concluída do conceito aprovado com personagem bíblico, abertura narrativa, cenário e atlas IA, seis poses de corrida e duas ações. Fontes e variantes em materiais-paroquia/games/mensageiro; exportações usadas em projetos/acolitos/games-art/mensageiro. Revisão independente e correções do atlas documentadas em materiais-paroquia/provas/mensageiro/VALIDACAO-VISUAL-TIQUICO.md. Passaram13 testes motor/API, UI completa, prova de atlas/fallback e fotos finais360–2560px. Produção não alterada.


## Mobile v3

Concluída otimização solicitada para público90%celular, câmera alinhada à rua e introdução narrada com a voz Fish Audio pedida.585regras, provas de UI/atlas/voz/rede limitada e fotografias360–2560passaram. Rede limitada:37,15s→15,67s para liberar jogo; física preservada. Evidências: materiais-paroquia/provas/mensageiro/VALIDACAO-MOBILE-V3.md. Prévia local atualizada; sem publicação.

## Evolução aprovada em 02/11 — v4

- Remover seleção de manto por pedido explícito; visual azul permanece.
- Abrir faixas laterais (.30 da largura, mesmo ponto de fuga).
- Guardas: perder uma chance e 40 pontos; obstáculos comuns: 20 pontos.
- Aliados: 50 pontos; água recupera uma chance até três, ou 15 pontos com chances completas.
- Três etapas de 30 s: intervalos 90/66/48 ticks e velocidade .0065/.008/.0095.
- Ranking autenticado semanal e geral, melhor partida por membro, desempate por primeiro resultado. Nova versão separa placar anterior e preserva replay v1.
- Efeitos locais para aliado, água, combo, mudança de etapa, guarda e fim. Arte IA transparente única de 77KB.
- Testes: regras unitárias/API, PostgreSQL isolado, interação real com áudio/touch/pausa/reenvio/treino, fotos 360/390/768/1366/2560 e CPU4x + rede50KB/s.
