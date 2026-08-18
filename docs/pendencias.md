# Acólitos — o que está pendente

Atualizado em 18/08/2026. Esta é A LISTA: abrir aqui antes de decidir o que fazer.
Quando algo sair daqui, sai porque foi feito **e conferido**, não porque foi commitado.

---

## 1. Travado no acesso ao banco

**Quatro coisas param no mesmo lugar.** Eu não alcanço o banco dos acólitos: a senha no `.env`
está velha, o `psql` não está instalado nesta máquina, o Docker está parado, e o acesso do
Supabase enxerga só o projeto do iamundi (`dashboard-instagram`). Retestado em 18/08.

**Destrava com uma coisa só:** a senha do banco atualizada no `.env`, **ou** o acesso do Supabase
apontado para a conta `erickjcbp`.

| o que | por que importa |
|---|---|
| **Aplicar a 052** | Aprovar candidatura insere na escala sem conferir nada: dá para superlotar uma função e para escalar a mesma pessoa duas vezes na mesma missa. Já está escrita, é colar. |
| **Conferir os kits** | Saber se o kit em modo *trava* já existe no Config. Enquanto não existir, o código está inerte e as **9 liberações acordadas** não estão gravadas em lugar nenhum. |
| **Conferir a "Leitura B"** | 40 pessoas ainda constam aptas em cruz e vela mas são barradas pela regra. Saber se já foram marcadas. |
| **As 31 migrations que faltam** | `docs/migrations/` vai de 001 a 011 e pula para 043: as **012 a 042 não existem em arquivo**. Não dá para reconstruir o banco do zero. **É o risco mais sério da lista.** |

**Isto custa caro no dia a dia, não só no papel:** para escrever a 052 eu precisei das colunas de
`acolitos_modelos`, que vieram na migration **022** — bem no meio das que faltam. Tive de descobrir
lendo o `config.html`. Acontece toda vez.

---

## 2. Melhorias já decididas — prontas para começar

### 2.1 Uma regra só: estar num time
**Pequena, e é por onde eu começaria.** Hoje você pode marcar a permissão "Tarefas dos times"
para alguém e **não acontece nada**: a barra exige `eh_equipe`, que só 4 dos 176 têm. A permissão
existe, é marcável, e é inerte. A mesma incoerência está na lista de responsáveis, que exige
`eh_equipe` **e** estar num time — ou seja, só dá para responsabilizar essas 4 pessoas, num
recurso feito para 11 times.

**Proposta:** a aba passa a ser gateada só pela permissão (padrão de toda a casa — liberar
realmente libera), e a lista de responsáveis larga o `eh_equipe`, ficando com o critério que o
dono já escolheu: quem está de fato num time. O `eh_equipe` volta a significar só coordenação.

### 2.2 Tarefas: desfazer, editar e apagar
**O maior pedaço.** Hoje não dá para desfazer um "Concluir", nem editar, nem apagar tarefa. E
apagar um time deixa as tarefas dele órfãs.

**⚠️ Falta UMA decisão do dono:** desfazer um "Concluir" numa tarefa que se repete — a próxima já
nasceu no momento em que você concluiu. Desfazer deve **apagar a próxima também**, ou **deixar as
duas**? Sem essa resposta a implementação não fecha.

---

## 3. Achado meu, não pedido

**Os 4 brasões antigos têm franja preta no modo claro.** Apareceu quando comparei o recorte novo
da Consilium com o `templaris` lado a lado nos dois fundos: o novo sai limpo, os antigos têm
sujeira serrilhada em toda a silhueta. Os originais continuam guardados em
`midia/brasoes/originais/`, então é só refazer com o mesmo processamento. Meia hora.

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
