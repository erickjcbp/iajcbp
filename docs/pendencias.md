# Acólitos — o que está pendente

Atualizado em 18/08/2026. Esta é A LISTA: abrir aqui antes de decidir o que fazer.
Quando algo sair daqui, sai porque foi feito **e conferido**, não porque foi commitado.

---

## 1. Acesso ao banco — ✔ RESOLVIDO em 18/08/2026

A senha estava numa pasta vazia em `~/Downloads`, cujo NOME era a senha. O `.env` foi atualizado.
(O `psql` existia o tempo todo, em `/opt/homebrew/opt/libpq/bin/` — fora do caminho. Minha
checagem anterior dizia "não instalado" e estava errada.)

**O que isso destravou, tudo conferido no banco de verdade:**

- ✔ **A fotografia da estrutura** está em `db/estrutura-completa.sql`. Rodando num banco vazio,
  ela devolve a estrutura inteira: 40 tabelas, 92 funções, 75 regras de acesso, proteção de linha
  nas 40 tabelas. **As 31 mudanças perdidas continuam perdidas uma a uma** — o que se recuperou
  foi o resultado delas, que é o que permite reconstruir. Numeração segue da 055 em diante.
- ✔ **052, 053 e 054 conferidas lendo a estrutura**, não por dedução: `vaga_cheia` e o bloqueio
  contra dois coordenadores simultâneos estão na função; `eh_equipe` sumiu da lista de
  responsáveis; `origem_id` e seu índice existem. E a 051 continua de pé — `anon` sem permissão
  na tabela, `authenticated` com ela.
- ✔ **O kit em modo trava EXISTE** ("Kit processional", ativo, matriz, idade mínima 14), com
  **8 liberados**. A combinação eram 9: falta **Lucas Bernardo** — que está `nao_treinado` em
  cruz e vela, ou seja, fora por duas vias. Pode ter sido decisão do dono; não está registrado.
- ✔ **A "Leitura B" encolheu sozinha.** Eram ~40; hoje são **2**: André de Souza Ribeiro e
  Enrico Pompeu Secherini. E nenhum dos dois por idade — os dois estão **sem data de
  nascimento**, então a regra não consegue dizer se têm 14 anos. É problema de dado, não de regra.

**Sobrou daqui:** decidir o que fazer com o Lucas Bernardo e com as duas datas de nascimento que
faltam. Nenhum dos dois é trabalho meu — são decisões e dados.

## 2. Melhorias já decididas — ✔ TODAS FEITAS em 18/08/2026

- **Uma regra só: estar num time.** Permissão de módulo passou a valer na barra, não só na URL.
- **Tarefas: editar, apagar e desfazer.** O Reabrir resolve a próxima recorrência perguntando na
  hora, com o prazo dela no texto.
- **Times viraram uma porta só** (`Config › As pessoas › Times`), com a gente dentro. A regra de
  entrar/sair virou `times-core.js`, compartilhada com as Casas.

**O candidato seguinte, se quiser continuar por aqui:** as **nove listas** de
`A paróquia › Listas` ainda são um saco de gatos — Tesouraria, Agenda, Jornada e liturgia no mesmo
lugar. O dono escolheu não mexer nisso quando os times saíram de lá; a pergunta continua aberta.

## 3. Brasões — NÃO refazer os 4 antigos

Cheguei a propor refazer os quatro brasões antigos, porque eles têm uma franja preta serrilhada
no modo claro. **Tentei, e estava errado: o recorte novo destrói a arte deles.** No `templaris`
a capa verde e o cabelo sumiram — a inundação vaza para dentro pelas regiões escuras que encostam
no fundo. Os arquivos que estão no ar são melhores. A franja fica; é o preço de um recorte
conservador, e é menos ruim que buraco no meio do bordado.

**A regra que ficou (vale para todo brasão novo):** limite de recorte **6**, suavização de borda
**0,5**, e conferir a saída **composta sobre magenta** antes de subir — foi só assim que apareceu
que a faixa do CONSILIUM tinha ficado transparente com o limite 40. Sobre o fundo escuro do app
o buraco é quase invisível.

---

## 4. Backlog sem prazo

- **Missões F2 e F3** — avaliação automática e temporadas/ranking. F1 e F4 estão no ar.
- **F7 "São Tarcísio"** — está na trilha antiga como pendente, mas só existe o nome. Precisa o
  dono dizer o que é.
- **Landing `/pastoral`** — o WhatsApp já é o número real (conferido em 18/08); falta conferir os
  dias das missas e os textos.

---

## 5. Só o dono consegue

- **Abrir a aba Tarefas uma vez.** É o único pedaço da trava de 18/08 que não deu para medir
  daqui: a prova de que quem ESTÁ logado continua carregando. Se abrir — mesmo vazia, sem a
  mensagem "não foi possível carregar as tarefas" — está certo.

---

## Fechados em 18/08/2026

- Migrations **048, 049, 050 e 051** aplicadas, e a trava **provada rodando**, não por leitura.
- Organograma das Casas lia uma lista paralela; e falha ao carregar os times passou a avisar.
- Brasão da **Consilium** no ar — as 5 casas com a mesma arte.
- A recusa nas telas de decisão passou a **dizer o motivo** em vez de "Não foi possível decidir".
- **Dívida de fuso quitada**: `hojeLocal()` nas 7 telas, nada mais monta "hoje" em UTC.
- **Push** testado no aparelho do dono. Frente fechada.
- **Permissão de módulo passou a valer na barra**, não só na URL: liberar um módulo para quem não
  é da equipe abria a tela e escondia o botão. Vale para todos os módulos, não só Tarefas.
- **Brasão da Consilium** — subiu com a faixa transparente e foi corrigido no mesmo dia.
- **A lista de responsáveis estava SEMPRE vazia** — a tela exigia um campo que a RPC nunca
  devolve. Não era o banco. Junto: lista vazia passou a dizer o motivo.
- **Tarefas: editar, apagar e o Reabrir resolvendo a próxima recorrência.**
- **Remover um time avisa** quantas tarefas e pessoas ainda dependem dele.
- **Migrations 052, 053 e 054** aplicadas pelo dono e conferidas (`docs/CONFERIR-NO-BANCO.sql`
  deu OK nas três; de fora, confirmei `origem_id` e que nada foi aberto sem querer).
