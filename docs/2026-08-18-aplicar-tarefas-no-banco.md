# O que falta fazer no banco

**Só você consegue fazer este passo.** Eu não tenho como aplicar: a senha do banco no `.env` está
velha (a conexão chega no projeto certo e é recusada com `password authentication failed`), o MCP
do Supabase está logado na conta do iamundi e não enxerga o projeto dos acólitos, e o Docker está
parado. Testei os três.

## O que fazer

1. Abra o painel do Supabase no projeto dos acólitos, em **SQL Editor**.
2. Cole o conteúdo inteiro de **`docs/migrations/048_tarefas.sql`** e rode.
   O arquivo é fechado em si mesmo e **idempotente** — rodar duas vezes não quebra nada.
3. Cole o conteúdo inteiro de **`docs/migrations/049_convocar_por_time.sql`** e rode.

## O que cada uma faz

**048 — a tabela das Tarefas dos times.** Sem ela, a aba Tarefas mostra "Não foi possível
carregar as tarefas" (que é a mensagem certa para uma tabela que não existe, mas não é a
estreia que você quer). **Esta é a urgente: a aba já está no ar.**

**049 — convocar um evento por time da pastoral.** Cria uma função nova e **não toca em
nenhuma existente**: se der errado, é só não usar. Sem ela, convocar por nível continua
funcionando normalmente e os times aparecem como "não foi possível carregar" — nunca somem
calados.

## A conferência que ficou pendente

A trava da tabela (quem não está logado não pode ler nem escrever) foi conferida **por leitura**,
comparada linha a linha com as migrations 003 e 046 — mesmos papéis, mesmo `acolitos_get_role`,
leitura e escrita separadas, nada alcançando quem não fez login. Mas **não foi provada rodando**,
porque a tabela ainda não existe.

Depois de aplicar, a prova é rápida: tentar ler `acolitos_tarefas` com a chave anônima (sem login)
e confirmar que é recusado. A 049 também: a função foi revogada de `public` e de `anon`, então
quem não fez login não pode executá-la. Se voltar lista vazia em vez de recusa, me chame — lista vazia e recusa
se parecem, e a diferença importa.

## O que vem junto

A permissão nova chama-se **Tarefas dos times** e nasce **desmarcada** para todo mundo, como toda
permissão nova aqui. Você libera pessoa a pessoa em Config. Os administradores já a têm por serem
administradores.
