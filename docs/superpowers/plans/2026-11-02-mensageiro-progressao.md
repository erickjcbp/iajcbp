# Mensageiro — progressão aprovada

Escopo: primeira entrega1500m; continuar para recorde; desafios0/300/700/1100/1500 e+250m; velocidade/distância crescentes; duas faixas ocupadas; guardas móveis com aviso; água só ferido e rara; intervalos de respiro; ranking pontos+distância.

Implementação inline: core4 separado preservando replays1/2/3; todo resultado validado no servidor. Sessão ativa até10min para caber no TTL20min com pausas. Fim por3colisões,encerrar voluntário oulimite técnico. Primeira entrega pausa e oferece continuar/encerrar; próximas entregas a cada1000m.

1. Core4 determinístico: dificuldade, spawn por contagem regressiva, rota livre garantida/adja à anterior, água por distância e orçamento, guardas com aviso e mudança concluída antes da colisão, stop,replay,XP20.
2. UIHUD/distância/etapas/entregas/encerrar, sinais visuais/sonoros, viagem3D segue travel acumulado do motor. Preservar assets/movimentoHDaprovados.
3. DBmigração nova:versão4,distância/entregas;RPCinício4,crédito4serviceonly comidempotência/limites,ranking4autenticado. Placar desta rota separado, registros anteriores preservados. APIescolhe versão persistida.
4. Provas: unitcore/Piloto seguro centenas rotas/replay/API; bancoisolado+rollbackprodução; e2efluxo1500continuar/encerrar/reenvio;5tamanhos/touch/áudio/perf;revisão independente final;publicaçãoisolada aprovada na sessão.
