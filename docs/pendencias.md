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
| **Aplicar 052, 053 e 054** | **052**: aprovar candidatura insere na escala sem conferir nada (dá para superlotar uma função e escalar a mesma pessoa duas vezes na mesma missa). **053**: ser responsável por tarefa larga o `eh_equipe` e passa a exigir só estar num time — sem ela a lista fica nos 4 da equipe. **054**: liga a tarefa recorrente à conclusão que a gerou, que é o que deixa o Reabrir oferecer apagar a próxima. As três estão escritas em `docs/APLICAR-NO-BANCO.sql`, é colar. |
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

### 2.2 Tarefas: desfazer, editar e apagar — ✔ FEITO em 18/08/2026
Editar e apagar existem, nas duas visões. O Reabrir (que já era o "desfazer") passou a resolver a
próxima recorrência: **a pergunta é feita na hora**, com o prazo da próxima no texto, em vez de
virar uma regra global escolhida de véspera. E remover um time no Config passou a avisar quantas
tarefas e pessoas ainda dependem dele.

**Depende da 054 para ficar completo.** Sem ela o Reabrir volta a só AVISAR que a próxima talvez
exista — não consegue dizer qual é nem oferecer apagá-la, porque não há o elo entre as duas. A
tela funciona sem a migration; só perde essa parte.

---

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
