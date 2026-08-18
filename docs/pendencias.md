# Acólitos — o que está pendente

Atualizado em 18/08/2026. Esta é A LISTA: abrir aqui antes de decidir o que fazer.
Quando algo sair daqui, sai porque foi feito **e conferido**, não porque foi commitado.

---

## 1. Só o dono consegue

- **Abrir a aba Tarefas uma vez.** É o único pedaço da trava de 18/08 que não deu para medir
  daqui: a prova de que quem ESTÁ logado continua carregando. Se abrir — mesmo vazia, sem a
  mensagem "não foi possível carregar as tarefas" — está certo.
- **A conta do Vercel.** O CLI e o acesso automático estão presos em OUTRA conta
  (`vercel whoami` → "Not authorized"). Quando a Vercel não dispara o build sozinha — aconteceu
  uma vez em 18/08 — não dá para disparar daqui; o jeito é um commit vazio para reempurrar o
  gatilho. Apontar para a conta `erickjcbp` resolve, do mesmo jeito que a senha do banco resolveu.
- **F7 "São Tarcísio"** — está na trilha antiga como pendente, mas só existe o NOME. Precisa o
  dono dizer o que é, senão não dá para planejar.

---

## 2. Backlog sem prazo

- **Central do Servo** — aprovar candidatura a vaga não revalida do lado do servidor. É o irmão
  do problema que a 052 fechou, em outro fluxo. Pequeno.

---

## 3. Coisas que NÃO se deve fazer (registro, para não repetir)

**Não refazer os 4 brasões antigos.** Cheguei a propor, porque eles têm franja preta serrilhada no
modo claro. **Tentei, e estava errado: o recorte destrói a arte deles** — no `templaris` a capa
verde e o cabelo sumiram. Os arquivos no ar são melhores. A franja fica.

**A regra do recorte, para todo brasão novo:** limite **6**, suavização de borda **0,5**, e
conferir a saída **composta sobre magenta** antes de subir — foi só assim que apareceu que a faixa
do CONSILIUM tinha ficado transparente com o limite 40.

**Não reabrir o kit do Lucas Bernardo nem do André de Souza Ribeiro** — os dois estão fora por
opção do dono (o André tem menos de 14 mesmo). *Observação:* o André é barrado por
`data_nascimento` em branco, não por idade conhecida; quando ele fizer 14 a trava não vai soltá-lo
sozinha, porque ela não sabe a idade.

---

## Fechados em 18/08/2026

**Banco**
- **Acesso ao banco resolvido** — a senha estava numa pasta vazia em `~/Downloads` cujo NOME era a
  senha. E o `psql` existia o tempo todo em `/opt/homebrew/opt/libpq/bin/`, fora do PATH.
- **A estrutura completa virou arquivo** (`db/estrutura-completa.sql`): 40 tabelas, 92 funções, 75
  regras de acesso, proteção de linha nas 40. **Dá para reconstruir o banco do zero de novo** — era
  o risco mais sério da lista. As 31 migrations perdidas seguem perdidas uma a uma; recuperou-se o
  resultado.
- **Migrations 048 a 056** aplicadas e conferidas rodando, não por leitura.
- **A varredura das 40 tabelas:** proteção de linha em 40 de 40, e **11 tabelas** que devolviam
  lista vazia em vez de recusar (entre elas as chaves de notificação do celular, os nomes de
  usuário e o contato de quem avisa ausência pelo formulário público). Fechadas pelas 055 e 056.
- **Kits e "Leitura B" fechados:** Enrico liberado no Kit processional (de 8 para 9 liberados).

**Telas**
- **Permissão de módulo passou a valer na barra**, não só na URL — valia para todos os módulos.
- **Times viraram uma porta só** (`Config › As pessoas › Times`), com a gente dentro; a regra de
  entrar/sair virou `times-core.js`, compartilhada com as Casas.
- **A seção "Listas" acabou** — cada lista foi para o módulo a que serve; "Os módulos" passou de
  um item para seis. 21 editores conferidos um a um.
- **A Configuração no celular** — lista que abre em tela cheia, com voltar; e o conteúdo parou de
  estourar a borda (a caixinha "Maior" aparecia cortada).
- **Todo ícone do app virava mancha preta** fora da barra de navegação. Uma regra no `shared.css`
  resolveu para todas as telas; botões de ação ganharam NOME junto do ícone.
- **Tarefas:** a lista de responsáveis estava SEMPRE vazia (a tela exigia um campo que a função
  nunca devolve); editar, apagar, e o Reabrir resolvendo a próxima recorrência.
- **Remover um time avisa** quantas tarefas e pessoas ainda dependem dele.
- **Organograma das Casas** lia uma lista paralela; falha ao carregar os times passou a avisar.
- **Brasão da Consilium** no ar — as 5 casas com a mesma arte (subiu com a faixa transparente e
  foi corrigido no mesmo dia).
- **A recusa nas telas de decisão** passou a dizer o MOTIVO, em vez de "não foi possível decidir".
- **Dívida de fuso quitada** — `hojeLocal()` nas 7 telas.
- **Push** testado no aparelho do dono.
- **Missões F2 e F3 já estavam no ar** — minha anotação de "pendentes" estava velha. Conferido no
  banco (as funções existem) e no código (as telas chamam). F1 a F4 completas.
- **Landing** conferida pelo dono.
