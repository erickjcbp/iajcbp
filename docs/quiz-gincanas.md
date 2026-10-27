# Quizzes e gincanas dos coroinhas

Acesso: Coordenação → Dinâmicas, em `/projetos/acolitos/quizzes.html`. Papéis autorizados: coord_admin, subadmin e membro_equipe do módulo paroquial acolitos. O cadastro atual não possui tenancy por comunidade; não concedemos acesso a membros comuns por uma permissão de menu.

## Funcionalidades

Biblioteca com rascunhos/prontos, duplicação e exclusão confirmada; edição e revisão por pergunta; geração integral ou individual; organização, apresentação e impressão separada de perguntas e gabarito. Uma mudança no conteúdo invalida a revisão. Mudanças de perguntas já revisadas são persistidas primeiro como rascunho; a revisão deve ser refeita após salvar.

Gincanas com regras próprias, casas reutilizadas ou manuais e rodadas que congelam as perguntas do quiz. Pontuação parte de zero por gincana. Lançamentos avulsos, resultados, penalidades, estornos e auditoria são persistidos em livro imutável. O banco calcula os pontos de cada resposta. Somente uma resposta ativa por pergunta/rodada. Nova aplicação do quiz exige nova rodada. Configurações novas não recalculam os lançamentos anteriores. Encerrar bloqueia lançamentos; reabrir exige confirmação e justificativa.

Placar compartilhado entre telas autenticadas, atualizado a cada cinco segundos. A página de apresentação do placar não renderiza responsáveis ou controles administrativos. Não há participação por aparelhos dos participantes.

## IA

A API existente `/api/acolito-admin`, ações `quiz_config` e `quiz_gerar`, encaminha ao helper `_quiz.js`, respeitando o limite de funções da hospedagem. São necessárias `ANTHROPIC_API_KEY` e `ANTHROPIC_MODEL` no ambiente do servidor. Configuradas em produção em 22/10/2026: a mesma chave protegida do robô WhatsApp e o modelo `claude-haiku-5-5`, validado no catálogo da Anthropic. Uma pergunta foi gerada pelo provedor real e validada pelo handler em prova isolada, com autenticação simulada e sem salvar conteúdo. Nunca fornecer a chave no navegador.

Máximo de 24 perguntas por geração, dez por dificuldade, 60 por quiz; dez pedidos por hora por responsável e 240 perguntas por 24 horas por módulo. Reservas e idempotência persistidas no PostgreSQL antes de chamar o provedor. Resposta por ferramenta estruturada, validação no servidor e tempo máximo de 45 segundos no provedor. Observações são dados. Nenhum resultado gerado recebe revisão automática.

## Persistência e segurança

Migração: `supabase/migrations/20261022120000_quiz_gincanas.sql`, aplicada ao projeto confirmado `coroinhasjcbp` (`fttjgsotuosjfrasttds`). Tabelas com RLS. Clientes não têm permissão de escrita direta; RPC `quiz_operar` confere sessão e vínculo à equipe. Operações de pontos serializam a linha da gincana, com chave única para pedido e resultado ativo. Exclusão de quiz preserva o conteúdo das rodadas.

`acolitos_quiz_ia_uso` e `acolitos_gincana_resultados` são internos, sem grants de cliente e sem policies: deny-all intencional. O advisor sinaliza essas tabelas e as duas funções SECURITY DEFINER autenticadas; as funções exigem autorização no corpo e search_path vazio. Avisos antigos de outras partes do banco estão fora desta implementação.

## Evidência executada

- `npm run provar-regras`: 505 testes passaram.
- `node projetos/acolitos/provas/quiz-banco.prova.mjs`: 19 verificações no PostgreSQL 17 isolado, incluindo RLS real, concorrência entre dois responsáveis, duplicidade, isolamento entre eventos, estorno e encerramento.
- `node projetos/acolitos/provas/quiz-telas.prova.mjs`: fluxo completo com autenticação simulada e persistência no banco local real; 18 capturas, dois PDFs, nenhum erro de JavaScript e nenhuma rolagem horizontal verificada em 390, 768, 1366 e 2560px.
- Capturas e PDFs em `/Users/erickmartins/arquivos/quiz-catolico-validacao`.
- Produção: conta/projeto Vercel confirmados, migração aplicada, grants conferidos. O fluxo de usuário autenticado em produção não foi executado; a prova funcional usa banco isolado e sessão simulada. A geração real foi comprovada com uma pergunta na Anthropic; o login de produção não foi usado na prova isolada.

As provas locais usam porta 55439 e banco `quiz_validacao`; não leem `.env` e não usam dados ou credenciais de produção. Servidor de prova na porta 5189. Para repetir, iniciar o PostgreSQL isolado, executar a prova de banco, iniciar `quiz-ui-servidor.mjs` e executar a prova de telas. Não rodar o servidor de provas como servidor do aplicativo.


## Dinâmicas por temporada (22/10/2026)

A entrada agora é o placar da temporada, com brasões oficiais, pontuação e movimentos recentes. Cada retiro abre uma única temporada; as casas de membros entram automaticamente com zero pontos. A casa da equipe pode ser adicionada manualmente. Competições antigas sem vínculo continuam disponíveis em "Competições anteriores".

Abas: Placar, Conduzir quiz, Quizzes e Gestão. A condução permite escolher Fácil/Médio/Difícil antes de cada pergunta, mostra a quantidade disponível, seleciona a alternativa e a casa, revela a resposta e a explicação e registra o resultado sem trocar de tela. Resultados ativos saem da lista de perguntas disponíveis. Estorno devolve a pergunta à lista. A atualização da página preserva o resultado e o placar.

O telão abre em outra janela autenticada e acompanha a condução por polling a cada dois segundos. A pergunta/revelação tem versão própria no banco; alterações concorrentes com versão antiga são rejeitadas. O telão não renderiza controles administrativos ou responsáveis. O placar para TV continua separado.

Migração adicional: `20261022170000_dinamicas_temporadas.sql`. Preserva o livro e as permissões da primeira versão; a RPC anterior vira helper privado sem EXECUTE para clientes. A lista de retiros disponível a Dinâmicas contém apenas resumo de retiros, sem conceder escrita ou acesso às equipes/compras do módulo Retiros.

Validação adicional: `dinamicas-telas.prova.mjs` executa seleção do nível, alternativa, casa, revelação sincronizada em outra janela, pontuação, recarregamento, estorno e nova temporada com saldo zero. Capturas atualizadas em `/Users/erickmartins/arquivos/quiz-catolico-validacao/dinamicas-v2`, nas larguras 390, 768, 1366 e 2560px. Banco de prova isolado, autenticação simulada. A suíte geral passou com 506 testes; a prova de banco foi ampliada para 25 verificações.


## Correção de navegação e quantidades (22/10/2026)

O defeito de geração foi reproduzido no Haiku real: o pedido padrão de 6/6/6 retornou 6/7/7. O contrato agora usa strict tool use, com um campo obrigatório por pergunta, dificuldade fixa por campo e alternativas A/B/C ou A/B/C/D. A resposta continua sendo validada no servidor antes de ir ao navegador. A prova real do mesmo pedido passou com 18 perguntas e distribuição 6/6/6; autenticação simulada no teste, sem persistir conteúdo de teste no aplicativo. O esquema segue o subconjunto suportado pela Anthropic: não usa minItems/maxItems arbitrários.

A entrada renderiza sem esperar quiz_config. As abas internas usam os dados já carregados; salvar/duplicar/excluir atualiza a biblioteca local. O polling não recria a tela quando o estado não mudou. A aba e a temporada ficam na URL e na rota de retorno do menu principal. Clicar no item ativo de Dinâmicas não recarrega o documento; links com modificadores continuam funcionando. A condução mantém o menu principal do aplicativo e o cabeçalho interno foi simplificado.

A arquitetura do app continua sendo de páginas HTML: ir para outro módulo usa a navegação normal do projeto. Não foi introduzido outro roteador ou um app embutido. O retorno agora restaura a seção em vez de abrir o placar do zero.

Prova nova: `dinamicas-navegacao.prova.mjs`, com a consulta de configuração de IA artificialmente pendente, contagem de consultas por troca de aba, verificação de DOM preservado no polling, clique no módulo ativo e rota de retorno montada pelo menu de outra seção. Capturas em `/Users/erickmartins/arquivos/quiz-catolico-validacao/navegacao-v3`. A suíte geral passou com 509 testes.


## Recusa do esquema em quizzes de 24 perguntas (22/10/2026)

As falhas 502 observadas na produção correspondiam a pedidos de 24 perguntas. A chamada real reproduziu HTTP 400 da Anthropic por complexidade do esquema estrito; chave e modelo responderam normalmente. A geração agora divide o plano em lotes de até seis perguntas, com no máximo três sequências em paralelo, uma reserva de quota, prazo global de 45 segundos e orçamento total de saída de até 14 mil tokens. Não há repetição automática de pedidos. Cada lote e o resultado completo passam pelas validações de quantidade, dificuldade, alternativas e duplicação. Falhas preservam as edições.

Prova real: 24 perguntas, 8 por dificuldade, todos os dez temas e três alternativas retornaram HTTP 200 e passaram na validação completa. O teste usa autenticação simulada e não salva quizzes na produção. No teste com quatro alternativas, uma tentativa foi rejeitada corretamente por repetição; a nova execução retornou 24 perguntas válidas com distribuição 10/10/4. Os 512 testes automatizados passaram. A mudança não exige migração nem alteração de credenciais.
