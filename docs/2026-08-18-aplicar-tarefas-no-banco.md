# O que falta fazer no banco

**Só você consegue fazer este passo.** Eu não tenho como aplicar: a senha do banco no `.env` está
velha (a conexão chega no projeto certo e é recusada com `password authentication failed`), o MCP
do Supabase está logado na conta do iamundi e não enxerga o projeto dos acólitos, e o Docker está
parado. Testei os três.

## Estado

- ✅ **048**, **049** e **050** — aplicadas por você em 18/08/2026 e **conferidas rodando**, não
  por leitura (veja abaixo).
- ⏳ **051** — pendente. Uma linha só, e é a diferença entre "recusado" e "não há nada".

## O que fazer

1. Abra o painel do Supabase no projeto dos acólitos, em **SQL Editor**.
2. Cole o conteúdo inteiro de **`docs/APLICAR-NO-BANCO.sql`** e clique em Run.
   Esse arquivo sempre contém **só o que ainda falta** — hoje, a migration 051.
   É idempotente: rodar duas vezes não quebra nada.
3. Me avise que eu confiro de novo, do mesmo jeito.

## A conferência que estava pendente — feita em 18/08/2026

Feita de fora, pela chave pública do site, **sem sessão nenhuma** — que é exatamente a situação
que a trava precisa recusar. Resultado literal:

| o que foi tentado sem login | resposta | veredito |
|---|---|---|
| ler `acolitos_tarefas` | `[]` com HTTP 200 | ⚠️ **não recusa** — é a 051 |
| gravar em `acolitos_tarefas` | `42501` — *new row violates row-level security policy* | ✅ recusa |
| executar `acolitos_membros_por_setor` (049) | `42501` — *permission denied for function* | ✅ recusa |
| executar `acolitos_responsaveis_de_tarefa` (050) | `42501` — *permission denied for function* | ✅ recusa |

As colunas da 050 (`andamento_em`, `andamento_por`) existem: a consulta a elas passa, e o
controle com uma coluna inventada reclama com `42703`. Ou seja, o teste é capaz de acusar
ausência — não é um "passou" vazio.

**Nada foi gravado nesta conferência.** A tentativa de escrita levou um `responsavel_id` que não
existe justamente para que, se a trava estivesse aberta, a linha ainda assim não entrasse.

## O que a 051 conserta

As quatro tabelas irmãs (`acolitos_membros`, `acolitos_escalas`, `acolitos_ausencias`,
`acolitos_listas`) **recusam** quem não fez login, com `42501`. A `acolitos_tarefas` devolvia
lista vazia com sucesso — o mesmo que uma tabela vazia de verdade.

Não é vazamento: nenhuma linha sai por ali. O problema é a resposta se parecer com "não há nada",
porque é essa diferença que decide o que a tela escreve: *"não foi possível carregar as tarefas"*
ou *"nenhuma tarefa por aqui"*. Dizer "está tudo em dia" quando não se conseguiu perguntar é o
defeito que mais se repete neste projeto.

A causa é pequena: as políticas da 048 são `to authenticated`, então para quem não fez login não
existe política nenhuma, o banco não chega a consultar o `acolitos_get_role` — que é justamente
quem recusa nas irmãs — e devolve zero linha calado. A 051 tira a permissão da tabela de quem não
fez login, e aí a recusa acontece na porta.

Quem fez login não muda nada.

## O que vem junto

A permissão nova chama-se **Tarefas dos times** e nasce **desmarcada** para todo mundo, como toda
permissão nova aqui. Você libera pessoa a pessoa em Config. Os administradores já a têm por serem
administradores.
