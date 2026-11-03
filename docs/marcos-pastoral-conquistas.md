# Marcos de Pastoral em Conquistas

Os cinco medalhões por tempo de serviço aparecem em seção própria, com destaque para o último marco reconhecido, o próximo requisito e contagem independente. A coleção e seus filtros passam a considerar somente as medalhas comuns. Os medalhões mantêm artes, requisitos, concessões, datas e posse existentes. Veterano conserva o requisito de nível; o cliente não deduz conquistas a partir do tempo.

Classificação e ordenação em `conquistas-marcos-core.js`, com compatibilidade para os cinco ícones oficiais e critérios explícitos de tempo quando presentes. A seção usa os dados já retornados pela página, sem nova consulta ao banco. Datas ausentes ou aproximadas não são transformadas em aniversário exato.

Validação: oito testes focados passaram, incluindo a separação, ordenação, catálogo vazio, Veterano e regras já existentes de tempo e arte. Prova da tela com sessão e RPCs simulados em 360, 390, 768, 1366 e 2560 px: cinco marcos, duas medalhas comuns, resumo separado, modal e foco preservados, sem rolagem horizontal. A prova existente de tipos/filtros e gestor passou nas mesmas larguras.

Na suíte geral, 612 testes passaram e três falharam em `xp-servico-notificacoes.test.js`: `ReferenceError: navigator is not defined`. O teste e `shared.js` estão idênticos à base anterior à mudança; falhas preexistentes do ambiente de teste, fora deste ajuste. Evidências e capturas em `materiais-paroquia/provas/marcos-pastoral` do checkout principal.

Mudança desenvolvida em worktree isolado; alterações de jogos em andamento no checkout principal não fazem parte desta entrega.
