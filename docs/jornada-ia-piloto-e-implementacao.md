# Jornada São Tarcísio — piloto e implementação

Data: 25/10/2026. Etapa: proposta de produto e piloto interativo local. Banco consultado em leitura; conteúdo e regras de produção não alterados.

## Decisão de produto

O jovem deve saber o que pode experimentar agora, escolher um caminho adequado à sua realidade e perceber um aprendizado concreto depois. A identidade visual da pastoral e seus dez níveis permanecem como referência; as missões passam a representar competências demonstráveis.

Cada capítulo tem dois objetivos. Cada objetivo oferece duas maneiras equivalentes de aprender. Basta concluir uma opção por objetivo. O piloto tem três capítulos, seis objetivos e doze opções. Escolher outra opção não concede XP novamente. Os guias de apoio ficam acessíveis desde o início; os selos reconhecem conquistas, sem bloquear material necessário ao aprendizado.

Piloto: Aspirante → Coroinha. O arquivo `jornada-piloto.json` é a fonte do conteúdo; HTML/CSS/JS são a demonstração navegável. Os progressos e pontos do piloto são fictícios, apenas no navegador. As pistas são preparadas editorialmente; não há chamada a IA nem envio à pastoral nesta demonstração.

## Evidência e correções da auditoria

Consulta à tabela `acolitos_missoes` em produção: 391 registros, dos quais 246 têm `nivel_alvo`, sendo 243 ativos. Os outros 145 não têm nível de destino, incluindo missões universais e exclusivas; isso não significa que todos sejam universais para qualquer membro. Três missões recorrentes de ajuda em ensaios estão inativas entre as 246 de nível.

| Nível de destino | Ativas | Obrigatórias ativas |
| --- | ---: | ---: |
| Aspirante | 10 | 8 |
| Coroinha | 15 | 12 |
| Acólito Aspirante | 23 | 20 |
| Acólito Guardião | 28 | 25 |
| Acólito Sentinela | 34 | 30 |
| Aspirante a Cerimoniário | 28 | 24 |
| Cerimoniário Aspirante | 22 | 19 |
| Cerimoniário Guardião | 32 | 24 |
| Cerimoniário Magistral | 29 | 20 |
| Cerimoniário-Mor | 22 | 16 |

O esquema local de `acolitos_missoes_board` consulta missões de `v_prox`, o próximo nível. Portanto, `nivel_alvo` não deve ser tratado automaticamente como nível atual do aluno. Conferir a definição efetiva da função no banco antes de migrar qualquer conteúdo. A trilha cadastrada com alvo `aspirante` pode não aparecer para quem já é Aspirante nesse fluxo; isso é hipótese técnica prioritária, ainda não prova da função atual em produção.

84 missões obrigatórias ativas têm `criterio` nulo. Isso não prova ausência de avaliação: missões reivindicadas e avaliadas usam confirmação humana e evidências. A deficiência editorial é não explicar consistentemente o que observar e aceitar.

Mitra/Báculo já prevê aprendizagem por treino na descrição. Não deve ser classificada como exigência inevitável de presença do bispo. Confirmar que a equipe realmente oferece a prática e registra habilitação. Preservar regras legítimas de aptidão; oferecer meios viáveis de aprendê-las.

Principais problemas confirmados no conteúdo:

- Repetição sem aprofundamento evidente: “Boa ação escondida” em sete níveis; “Santo do dia” duplicado no mesmo nível; nomes de paramentos e preparação repetidos.
- Exigências dependentes de oportunidade: festa anual obrigatória, cobertura de ausência de última hora e ser o primeiro a chegar.
- Objetivos subjetivos ou absolutos: “dedicação plena”, “postura impecável em tudo”, “resolver qualquer tipo de problema”.
- “Contorne um imprevisto sozinho, sem socorro” incentiva uma autonomia inadequada. Saber pedir apoio deve contar como competência.
- Dar apelidos, contar algo pessoal e realizar cumprimentos específicos são obrigatórios em certas trilhas. Torná-los escolhas de convivência respeitosa, com alternativas.
- Há empates de `ordem`. O esquema local ordena apenas obrigatoriedade e ordem; isso não assegura desempate estável e afeta a seleção das próximas missões.

## O que torna a experiência desejável

1. Uma promessa concreta na entrada: descobrir um bastidor, experimentar uma função ou ajudar alguém a aprender.
2. Escolha real: duas opções equivalentes por objetivo, troca livre antes da conclusão e ajuda acessível.
3. Feedback breve que explica a consequência da escolha. Erro abre uma pista e uma nova tentativa, sem retirar XP.
4. Aplicação na vida do grupo: práticas combinadas e observação do mentor. A experiência avança além do celular.
5. Conquistas relacionadas à aprendizagem: selo do capítulo, guia útil e reconhecimento de uma contribuição. Evitar prêmio por exposição pessoal, consumo ou competição de devoção.
6. Um próximo passo claro ao concluir. Mostrar o que a pessoa já sabe fazer e o que poderá experimentar a seguir.

Não usar perda por ausência, sequência diária punitiva, tempo regressivo artificial, sorteio de prêmios, comparação pública de fé ou pressão para compartilhar fotos. Não prometer que o produto já aumentou engajamento: medir no piloto.

## Percurso dos dez níveis

Proposta editorial para validação pastoral. Os nomes atuais e critérios formais de função não são alterados pelo piloto.

| Etapa atual → destino | Experiência central | Missão de conclusão sugerida | Evidência |
| --- | --- | --- | --- |
| Entrada → Aspirante | Acolhimento e acesso | Reconhecer os pontos de apoio | Conversa acompanhada |
| Aspirante → Coroinha | Pertencimento e primeiros cuidados | Participação ou prática acompanhada | Observação do orientador |
| Coroinha → Acólito Aspirante | Compreender uma função | Demonstrar sua sequência com orientação | Critérios da função definidos pela equipe |
| Acólito Aspirante → Guardião | Preparar e cuidar | Preparar uma parte e explicar sua finalidade | Checklist curto e observação |
| Guardião → Sentinela | Antecipar e apoiar | Perceber uma necessidade e combinar a resposta | Cenário + prática acompanhada |
| Sentinela → Aspirante a Cerimoniário | Ler a celebração em conjunto | Planejar uma parte com mentor | Plano simples e conversa |
| Aspirante a Cerimoniário → Cerimoniário Aspirante | Conduzir com acompanhamento | Conduzir uma parte combinada | Observação, retorno e nova tentativa |
| Cerimoniário Aspirante → Guardião | Coordenar e lidar com imprevistos | Resolver um cenário identificando quando chamar apoio | Decisões justificadas + prática |
| Cerimoniário Guardião → Magistral | Ensinar e adaptar | Preparar uma atividade e acompanhar alguém aprendendo | Plano, observação e retorno do mentor |
| Magistral → Mor | Formar e transmitir | Entregar um recurso de formação e acompanhar seu uso | Utilidade real e validação pastoral |
| Mor — continuidade | Serviço e desenvolvimento contínuo | Escolher um projeto de mentoria | Acompanhamento sem exigir um novo título |

Experiência e idade são dimensões distintas. Um adolescente recém-chegado precisa de linguagem apropriada à idade, mesmo começando como Aspirante. A faixa de linguagem, se usada, deve ser ampla; a IA não recebe data de nascimento, nomes, telefone ou dados de responsáveis.

Exemplos de episódios para os níveis seguintes, ainda como proposta editorial:

- **O detalhe antes do sinal:** observar uma preparação simulada, encontrar uma necessidade e explicar com quem confirmar a ação. O cenário deve trazer todos os fatos necessários e uma referência local aprovada.
- **Mudou o plano:** três decisões encadeadas numa situação fictícia de mudança da equipe. As pessoas do cenário têm habilidades conhecidas e as orientações locais são fornecidas. O feedback mostra as consequências para organização, acolhimento e pedido de apoio.
- **Hoje você é o guia:** escolher como explicar uma função a quem está começando — demonstração, sequência visual ou conversa — e adaptar a explicação após o retorno do mentor.
- **E se eu não estiver?:** preparar uma orientação curta, revisada pela coordenação, que outra pessoa consiga usar. O recurso útil passa a compor o guia da equipe, com autoria opcional.
- **O próximo mentor:** acompanhar alguém aprendendo a ensinar, reconhecer uma melhora observável e deixar um recurso para o próximo encontro.

Esses episódios conectam desafio, consequência e contribuição. Novidade semanal pode vir de episódios aprovados, com limite de repetição, escolha de interesse e uma opção de baixo esforço. Um projeto coletivo possível é construir o guia vivo da equipe com contribuições revisadas, sem ranking público individual. A IA pode variar situações dentro desses limites; não inventa improvisos litúrgicos nem incidentes para acontecerem numa celebração real.

## Conteúdo do piloto

Capítulo 1 — Você faz parte:
- Encontrar o ponto de partida: mapa acompanhado ou percurso em dupla.
- Saber a quem recorrer: cenário de chegada ou cenário de dúvida.

Capítulo 2 — O que passa despercebido:
- Perceber antes de agir: objeto fora do lugar ou acolhimento de alguém novo.
- Experimentar um cuidado: tarefa acompanhada ou observação e demonstração adaptada da mesma habilidade.

Capítulo 3 — Sua primeira contribuição:
- Participar com acompanhamento: oportunidade real combinada ou prática orientada.
- Reconhecer o avanço: aprendizado próprio ou dica concreta para quem chegar.

Cada opção contém gancho, tempo/contexto, passos ou cenário, critérios, pergunta de retorno e pistas. Não se exige produção longa de texto; conversa, apontamento e demonstração são formas válidas de expressão quando confirmadas pelo orientador. Uma prática não deve ser contabilizada como presença em missa. Regras pastorais de idade, frequência e habilitação devem aparecer separadamente, sem virarem tarefas fictícias ou serem removidas pela IA.

## Papel da IA

O endpoint atual `_ia-evolucao.js` ajuda a planejar formação com contagens do grupo; não é um gerador de jornadas. Apenas reativá-lo não atende a esta proposta.

A primeira implementação deve gerar rascunhos para a coordenação, em lotes pequenos. A IA recebe nível atual/destino, objetivo, linguagem, formatos permitidos, conteúdo aprovado, práticas locais confirmadas e títulos a evitar. Retorna estrutura obrigatória validável, com duas alternativas equivalentes, critérios, pistas, fontes verificáveis quando houver conteúdo doutrinal e pontos que exigem revisão.

Na experiência do membro, começar com conteúdo e pistas aprovados. Se um tutor conversacional for integrado depois, limitar seu contexto à missão e ao material aprovado. Ele pode explicar, dar pistas e sugerir uma alternativa equivalente; não pode validar aptidão, presença, virtude, promoção ou enviar mensagens a terceiros. Não atribuir virtudes pessoais a partir de um texto.

O prompt deve proibir instruções de manuseio perigoso, comandos fora da função, exposição de colegas e afirmações litúrgicas sem material de referência. Costumes da paróquia são parâmetros confirmados, não fatos que o modelo deve inventar. Uma referência textual gerada não basta: a fonte precisa estar no conjunto curado ou ser conferida antes de publicação.

Para custo: conteúdo versionado e reutilizado; nenhuma geração a cada abertura de tela. Gerar inicialmente um capítulo por pedido, com teto de uso e registro de custo/latência. Configuração de modelo própria para a jornada, independente do São Tarcísio no WhatsApp. Comparar modelos da API com as mesmas tarefas antes de escolher; a troca do modelo desta conversa não modifica o provedor do app.

## Implementação em etapas — instruções para o modelo de código

1. Confirmar funções atuais de board, avaliação, promoção e reivindicação no banco. Conferir o uso de nível de destino. Capturar apenas conteúdo/configuração necessários; nunca exportar cadastros ou segredos para o piloto.
2. Introduzir versões de percurso em rascunho/publicada/arquivada, objetivos e alternativas vinculadas. O contrato deve distinguir objetivo pedagógico, oportunidade prática e requisito formal da pastoral.
3. Implementar aprovação editorial com prévia da experiência do membro. O gerador salva rascunho; publicação é ação explícita da coordenação. Reusar a autorização real do módulo e os limites do gerador de quiz, sem tratar JWT administrativo como autorização universal.
4. Implementar progresso por objetivo no servidor. A primeira alternativa aprovada conclui o objetivo; as demais não duplicam XP. Usar unicidade por membro, versão e objetivo e operação atômica. Tentativas de cenário não valem presença nem aptidão. Não confiar em XP/status/correta enviados pelo cliente.
5. Escolher opções, pedir pista, registrar experiência, pedir ajuda, receber revisão, reenviar e acompanhar confirmação. Preservar aba, posição de rolagem e foco ao voltar. Loading/erro/vazio devem ser estados distintos.
6. Habilitar o piloto para um grupo configurado, com prévia para coordenação. Não colocar objetivos alternativos no fluxo antigo que exige TODAS as missões obrigatórias. Implementar o novo avaliador e ativar a versão como uma única mudança controlada.
7. Migrar apenas após mapa de equivalências: objetivos já demonstrados continuam reconhecidos; XP acumulado e evidências históricas permanecem. Não duplicar XP retroativo nem reabrir promoções já concedidas. Manter rollback para a versão anterior, com novos registros preservados.
8. Publicar somente os arquivos e migrações deste trabalho, preservando o worktree com alterações anteriores. Confirmar projeto Vercel `iajcbp`, conta `erickjcbp-1650s-projects` e domínio `coroinhas.jcbplimeira.com.br`.

## Aceite e aprendizagem do piloto

- Jornada visível no nível correto; alternativas equivalentes aceitas sem obrigar ambas.
- Troca de alternativa, reenvio e duas confirmações simultâneas não duplicam XP.
- Cenário incorreto dá pista e nova tentativa; resposta/XP no servidor não podem ser adulterados pelo cliente.
- Confirmação prática só por pessoa autorizada; a interface nunca confunde “enviado” com “concluído”.
- Aprendizagem e materiais acessíveis enquanto aguarda oportunidade ou confirmação.
- Adequação litúrgica/local revisada; nenhum acesso de IA a cadastros ou contatos.
- Telas em 390, 768, 1440 e 2560 px; modal em tela cheia no celular, controles com 44 px, campos com 16 px, uso por teclado e sem rolagem horizontal.
- Medir: início da primeira missão, retorno em sete dias, conclusão por objetivo, pedidos de ajuda, trocas de opção, demora de confirmação e abandonos por tarefa. Perguntar ao jovem quais missões quis fazer e quais não fizeram sentido. Proporções e contagens agregadas, sem ranking de devoção.
- Rodar inicialmente por dois encontros ou duas semanas, conforme agenda real; comparar com a linha de base antes de expandir. Não definir melhora prometida sem observar dados.

## Estado desta entrega

Conteúdo e demonstração do piloto criados. Validação funcional e visual registrada na pasta de entrega. Integração real com IA, novo avaliador de progresso, migração e publicação de produção continuam como trabalho de implementação. Esta entrega não concede pontos, não muda níveis e não envia avisos.

Prova reproduzível: `node projetos/acolitos/provas/jornada-piloto.prova.cjs`. O comando gera a versão HTML independente em `~/arquivos/sao-tarcisio/jornada-piloto-2026-10-25`, serve apenas esse HTML num servidor temporário local e encerra o navegador de teste e o servidor no fim. Não carrega credenciais do projeto.

Resultado: 12 opções visitadas; seis objetivos, três selos e 50 XP fictícios sem duplicação; erro com pista; espera por confirmação, revisão e reenvio; persistência; guias acessíveis; fechamento por Escape com foco restaurado. Fotografias em 390, 768, 1440 e 2560 px, sem transbordamento horizontal e com alvos de ao menos 44 px. Modal de 390 × 844 px ocupa a tela inteira. Nenhum erro JavaScript observado nesses fluxos. Evidência em `validacao.json` e nas imagens da pasta de entrega.

## Implementação publicada — 25–26/10/2026

A experiência foi integrada a `missoes.html`, com autoria em `jornada-admin.html` e servidor `api/_jornada.js`, encaminhado pela API administrativa existente. Cada episódio usa um único registro de quest, com dois caminhos em `criterio.jornada`; ambos têm o mesmo objetivo e passam pela confirmação existente da coordenação. Cenas dão retorno, sem XP automático.

Primeira entrega: dez episódios opcionais (um por nível atual) e vinte caminhos publicados, usando a chave Anthropic do robô e configuração de modelo própria (`JORNADA_ANTHROPIC_MODEL`). Uma geração real foi conferida e mantida em rascunho. A publicação do catálogo não enviou avisos a terceiros. Quests obrigatórias anteriores não foram substituídas nem promoções recalculadas.

O gerador tem reserva persistida de pedidos, limite de 12 tentativas por usuário por dia, controle de revisão concorrente e publicação idempotente. O painel de reserva usa somente contagens na saída: publicados, rascunhos e membros sem episódio inédito em seu nível. A geração é iniciada pela equipe; não existe reposição agendada nem publicação automática. Recebe foco, referências e resumos editoriais anteriores; não recebe nomes, contatos ou identificadores dos membros.

Conteúdo de reserva: a referência inicial é 3/4/5 episódios conforme o nível, com novidades extras enquanto requisitos formais ainda estão pendentes. Essa referência orienta reposição; não significa que todos esses episódios já foram escritos. A dificuldade deve crescer em decisões e responsabilidade, preservando leitura curta e práticas combinadas.

Provas: `jornada-core.test.js`, `testes-api/jornada.test.mjs`, `provas/jornada-quests.prova.cjs`, `provas/jornada-producao.prova.mjs` e `provas/jornada-visibilidade.prova.mjs`. Relatórios e fotografias em `~/arquivos/sao-tarcisio/jornada-implementacao-2026-10-25`. Publicação isolada baseada nas fontes exatas do deployment anterior, preservando outras alterações locais.
