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

## Ajustes solicitados após teste no iPhone — v5

- Bug reproduzido: ligar trilha não retomava contexto WebAudio suspenso. Teste RED/GREEN cobrindo toggle, botão de recuperação, contexto fechado e audioSession playback. WebKit documenta mute switch e playback desde iOS17: https://bugs.webkit.org/show_bug.cgi?id=237322 . Sem iPhone físico para atestar reprodução final.
- Abertura das faixas .30→.36 da largura; personagem .34→.30. Rua com textura IA em plano projetado e 101 bandas animadas, laterais de mercado que passam, sem vídeo pesado. Respeita movimento reduzido.
- Soldado em nova pose de ataque com escudo/espada. Água com probabilidade5% e cooldown900ticks, média2.33 por90s (antes14.7 em30sementes).
- Motor3 separado; replay1/2 preservados. Ranking inclui2/3 e mantém recordes; cap XP continua compartilhado.
- Seção Games é o último append de Quests, após todas as missões.
- Regras/API593 aprovados; banco isolado aprovado; telas/áudio/touch/pausa/reenvio/offline e cinco larguras aprovados. PerfCPU4x/rede50KB/s: artes678408B, ready19303ms, desenhoP95=1.2ms,29.8fps,simulação98%,idle0.
- Revisão independente sem crítico/importante. Limitação: Safari/PWA físico precisa ser confirmado pelo dono.

## Correção visual após rejeição do cenário v5 — v6

- Teste RED/GREEN reproduziu a abertura insuficiente no meio do caminho: projeção z^1.55 mantinha os objetos concentrados no centro. Nova projeção z^.9, gap .40w: separação lateral42.87%no meio e80%na base. Ponto de fuga central elevado31.5%, pés86%.
- Nova cidade IA portrait640x960112KB, rua ampla e livre; piso natural256x2569KB. Saiu toda a composição de barracas replicadas e piso em101bandas.
- Piso único WebGL com textura contínua, projeção correta, mipmaps, juntas discretas e bordas suaves; movimento acelera junto com as etapas. Fallback preserva cenário2D. Respeita movimento reduzido.
- Sem mudanças na física, pontuação, XP, ranking, áudio ou localização em Quests.
- Validações:594regras/API; E2E/touch/pausa/reenvio/áudio; fotos360/390/tablet/notebook/TV. Piso compila e muda325862pixels/1.2Mentrequadros.
- CPU4x/rede50KB/s:pronto17009ms,artes562874bytes,29.8fps,drawP95=1.2ms,simulação98.2%,idle0. Revisão independente sem crítico/importante; prova de contextloss/restauração e faltaWebGL solicitada e executada separadamente.
- Sem iPhone físico nesta validação; confirmação visual no aparelho segue necessária.
- Prova gráfica passou:contexto perdido→fallback2D→contexto restaurado→piso; WebGLnull preserva2D; movimento reduzido produz quadros idênticos. Sem errosGLno desenho.

## Rua tridimensional — v7 (foco confirmado pelo dono: deslocamento e laterais)

- Saiu a composição de apenas fundo fixo+piso. Novo módulo mensageiro-cidade-3d gera uma rua com casas volumétricas, quatro fachadas IA, telhados, calçadas, toldos, bancas e vegetação, em um único buffer WebGL. Aproximadamente5500triângulos/0.86MB locais; sem biblioteca externa. Materiais, profundidade, iluminação e neblina de distância; fundo artístico distante preservado.
- Materiais principais:atlasfachadas512POT57KB,vegetação reutiliza atlas existente; madeira/telha geradas localmente. Câmera adapta altura à proporção da tela mantendo avatar1.6m e três faixas abertas.
- Trechos inteiros se deslocam e são reaproveitados fora da tela:testeRED/GREEN revelou uma planta ainda visível ao reciclar; margemNEAR6→4.5m garante todos os vértices laterais fora da tela antes do retorno ao fundo. Neblina oculta a entrada distante.
- Revisão independente passou11testes câmera/geometria, sem falha crítica/importante noGL. Observação de deslize de sprites foi reclassificada como necessária ao pedido do dono e corrigida no único passe de ajustes.
- CorreçãoRED/GREEN do deslize:projectObject mapeia progresso para distância física linear7+12.6*(1-z). City.advance usa o mesmo12.6m e velocidades exatas dos três estágios; teste em várias distâncias e estágios comprova igual deslocamento por tick. Sprites entram com fade suave; colisão e replay do motor não mudam.
- Provas:598regras/API; geometria mantém zona jogável livre, reciclagem sem pop e velocidades iguais; E2Econtroles/áudio/pausa/reenvio; recuperaçãoWebGL/movimento reduzido/fallback; fotos360/390/768/1366/2560. Captura real da composição8s para inspeção de movimento; prova mede deslocamento das duas laterais, além do piso.
- PerfCPU4x/rede50KB/s:29.96fps,P95draw1.5ms,simulação98.2%,artes687262B,pronto20056ms,idle0. Sem iPhone físico para teste de GPU/Safari. Nenhuma alteração em regras de pontuação, XP, ranking, narração ou localização no fim deQuests.
