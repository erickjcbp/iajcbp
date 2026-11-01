# Gestão da Jornada, planilha da Escala e medalhas — 01/11/2026

## Entrega

- Cards da Jornada (início, lista por nível, aprovações, funções reivindicadas, promoções, quase lá, evolução, acompanhamento e detalhes) apresentam tempo de pastoral.
- O tempo usa `servindo_desde`, e não a importação/cadastro no aplicativo. Datas marcadas como “ou antes” apresentam o tempo mínimo com “ou mais”. Datas ausentes, inválidas ou futuras não geram tempo estimado.
- Matriz, calendário, relatórios PDF e CSV seguem a mesma base real. O tempo continua visível na matriz do celular.
- A planilha da Escala permite ordenar pelos cabeçalhos e combinar filtros em todas as colunas, inclusive nas celebrações. Idade, frequência e tempo têm intervalos numéricos (tempo em meses completos). Nível ordena pela hierarquia. Valores ausentes ficam no fim nos dois sentidos. Mantém o foco ao digitar e a rolagem do quadro. Trocar as celebrações descarta filtros de colunas que saíram da tabela.
- O gestor de medalhas combina nome, múltiplos níveis, tempo mínimo/máximo, marcos de tempo, ausência de data, comunidade, idade e seleção. Ordena por nome, tempo, nível, idade ou comunidade. A galeria também filtra por cor e ordena por nome ou cor.
- Filtros preservam as pessoas selecionadas fora do resultado; a confirmação informa se há destinatários fora do filtro. Marcar/desmarcar todos atua apenas nos resultados atuais. Filtros avançados ficam recolhíveis, mantendo a lista utilizável no celular.
- Cache offline atualizado para carregar os novos módulos.

## Validação

- `npm run provar-regras`: 553 passaram, 0 falharam.
- `npm run provar-estabilidade`: passou em 390, 768, 1366 e 2560 px.
- `npm run provar-fluxos`: 93 passaram, 0 falharam.
- `node projetos/acolitos/provas/gestao-tempo-colunas.prova.mjs`: início, Jornada, Escala e medalhas em 360, 390, 768, 1366 e 2560 px; 20 cenários passaram. Verifica intervalos, ordenação numérica, foco ao digitar, tempo real, ausência de data, filtros combinados e seleção preservada.
- `medalhas-niveis.prova.mjs`, `matriz-servico.prova.mjs` e `matriz-acoes.prova.mjs`: passaram. Matriz e relatórios também conferidos com a data real de serviço.
- Fotos com dados fictícios em `estudos/gestao-tempo-2026-11-01/` (pasta ignorada pelo Git), incluindo celular, tablet, notebook e TV. Inspeção visual das fotos do celular e TV.
- A suíte geral inicialmente parou na prova de regeneração da arte: o teste copiava o handler sem a dependência de liturgia. Corrigido somente o empacotamento da prova; as 7 verificações dessa API passaram.
- `npm run provar-telas`: 474/495 passaram. As 21 falhas restantes são anteriores a esta entrega: 5 no teste do acompanhamento da Formação (busca título antigo “Quem não está andando” e formato antigo das contagens) e 16 nos testes de retiros (cronograma, compras e equipes). As mesmas 5 falhas da Formação foram reproduzidas com o HTML do HEAD anterior, sem substituir os arquivos de produção; evidência local em `estudos/gestao-tempo-2026-11-01/baseline-formacao.prova.mjs`. Retiros não foi alterado. A suíte ampla não está totalmente verde.

## Continuidade das medalhas de tempo

O plano da seção 6 de `CHECKPOINT-2026-11-01.md` permanece pendente de implementação. A simulação de 01/11 confirmou 274 medalhas para 127 membros ativos, total de 10.280 XP, sem promoção automática de nível. A função de elegibilidade efetiva é `acolitos_badge_cumpre`, além de `_badge_data_ganho`; o checkpoint cita incorretamente `acolitos_progresso_criterio` para esse ramo.

Esta entrega de gestão não concede medalhas e não altera saldos de XP ou datas dos membros.
