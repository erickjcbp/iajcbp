# O que falta fazer no banco

**Nada.** As quatro migrations das Tarefas dos times estão aplicadas e conferidas rodando.

## Estado

- ✅ **048**, **049**, **050** e **051** — aplicadas por você em 18/08/2026.
- ✅ A trava foi **provada rodando**, não conferida por leitura.

## Como foi conferido

De fora, pela chave pública do site, **sem sessão nenhuma** — que é exatamente a situação que a
trava tem de recusar. Resultado literal, depois da 051:

| o que foi tentado sem login | resposta |
|---|---|
| ler `acolitos_tarefas` | `42501` — *permission denied for table acolitos_tarefas* |
| ler as colunas novas da 050 | `42501` — *permission denied for table acolitos_tarefas* |
| gravar em `acolitos_tarefas` | `42501` — *permission denied for table acolitos_tarefas* |
| executar `acolitos_membros_por_setor` (049) | `42501` — *permission denied for function* |
| executar `acolitos_responsaveis_de_tarefa` (050) | `42501` — *permission denied for function* |

Antes da 051 a leitura devolvia `[]` com HTTP 200 — sucesso com lista vazia, indistinguível de
uma tabela vazia de verdade. Agora recusa, no mesmo padrão das quatro tabelas irmãs
(`acolitos_membros`, `acolitos_escalas`, `acolitos_ausencias`, `acolitos_listas`), que foram
consultadas no mesmo teste e continuam recusando como sempre.

**Nada foi gravado em nenhuma das conferências.** A tentativa de escrita levou de propósito um
`responsavel_id` que não existe, para que — se a trava estivesse aberta — a linha ainda assim não
entrasse.

**A tela pública não foi afetada.** As Ausências Públicas são a única tela que roda sem login;
a função dela (`acolitos_ausencia_publica_celebracoes`) foi chamada sem sessão e continua
devolvendo as celebrações normalmente.

## O que NÃO foi provado daqui

O caminho de **quem está logado**. Eu não entro na sua conta para medir, então a prova de que a
aba Tarefas continua abrindo é sua: basta abrir a aba uma vez. Se ela carregar (mesmo que vazia,
sem a mensagem "não foi possível carregar as tarefas"), está tudo certo.

## O que vem junto

A permissão chama-se **Tarefas dos times** e nasce **desmarcada** para todo mundo, como toda
permissão nova aqui. Você libera pessoa a pessoa em Config. Os administradores já a têm por serem
administradores.
