# Acólitos — o que está pendente

Atualizado em 16/09/2026. Esta é A LISTA: abrir aqui antes de decidir o que fazer.
Quando algo sair daqui, sai porque foi feito **e conferido**, não porque foi commitado.

---

## 1. Pendente

**Ordenar e filtrar — passos 4 e 5 da spec**
(`docs/superpowers/specs/2026-09-16-acolitos-ordenar-e-filtrar-design.md`). Membros (16/09),
Agenda, CRM e Chamada (17/09) estão feitos. Faltam: migration 069 + Ausências (Avisos e
Faltas — a parte que filtra NA CONSULTA, porque as listas vêm em pedaços); Tarefas.

**A prova antiga da barra (`provaBarraDeFiltroFunciona`) ainda falha às vezes — e agora se sabe
por quê.** O app tem um mecanismo que faz "Voltar" ao fechar qualquer janela (`shared.js`,
perto da linha 3416): fechar chama `history.back()`, que o navegador executa DEPOIS. Se outra
janela abre antes disso, a página pode sair do lugar no meio da prova, e o harness devolve o
resultado vazio SEM acusar erro. Evidência, 17/09: uma rodada com 31 falhas foi 9 esperadas +
**21 dessa prova só, todas com resultado vazio** (`/tmp/claude-501/fix3_teeth2.txt`). É a
explicação mais forte para as **22 falhas misteriosas** logo depois de juntar o passo 1
(mesmo tamanho). As provas novas (Agenda, CRM, Chamada e a da barra do passo 2) já esperam
120 ms depois de fechar uma janela e conferem que o resultado não veio vazio; **a antiga
ainda não**. Conserto: aplicar o mesmo à prova antiga. Depois, dois consertos maiores:
(1) o harness acusar quando a página sai do lugar; (2) no app, só registrar a janela nova no
histórico quando não houver um "voltar" pendente — o risco para gente de verdade é baixo
(o toque é mais lento que essa janela), mas existe.

**Agenda — textos para o dono decidir.** No painel, "Mostrar: Eventos" fica ao lado de "Tipo
de evento: Evento", e escolher um tipo de evento esconde as celebrações (a contagem mostra).
No calendário, "Ver N itens" conta o mês inteiro. E quem tinha escolhido "Celebrações" nos
botões antigos da linha do tempo agora vê o calendário também sem eventos (a etiqueta diz por
quê).

**Pontos pequenos dos passos 2 e 3** (nenhum aparece para quem usa hoje):
- A Agenda remonta a barra a cada redesenho; funciona porque a escolha é guardada no aparelho —
  com o armazenamento cheio, um toque no filtro pareceria não pegar.
- A prova do CRM, como a de Membros, assume o computador no fuso de Brasília. Conserto de
  ambas: fixar o fuso no harness.
- A Chamada ganhou "Presentes / Atrasados / Ausentes" além do "Ainda sem marcar" que a spec
  pedia — ficou assim de propósito.
- Na escolha da missa, as missas entram juntas na animação de entrada (antes entravam uma a uma).

**O aviso "Instale o app" cobre o fim de TODA janela do app no celular.** Achado em 16/09 ao
fotografar o painel de filtros: o botão "Ver N membros" fica meio escondido atrás dele. Não é
do filtro — o aviso (`#pwa-banner`) fica numa camada acima (400) de toda janela (200). Só
aparece no navegador, até a pessoa tocar no X. Conserto provável: esconder o aviso enquanto
houver janela aberta — e provar em várias telas.

**Pontos pequenos do passo 1 que ficaram para depois** (nenhum aparece para quem usa hoje):
- Membros: "Próximos aniversários" e a ordem por "Nível" não têm prova de tela própria.
- A barra escreve a ordem escolhida sozinha embaixo da busca ("Nome A–Z"). Se parecer texto
  solto, trocar por "Ordem: Nome A–Z" — é decisão de texto do dono.
- Aniversário em 29/02 conta a partir de 01/03 em ano que não é bissexto (hoje ninguém nasceu
  nesse dia).
- A prova da data do cadastro assume o computador no fuso de Brasília; em outro fuso ela
  falha com mensagem clara.

Em 31/08/2026 a lista tinha sido zerada por decisão do dono: consertar o que fosse
possível e **tirar daqui o que não depende de código**.

O que foi consertado está em "Fechados em 31/08" logo abaixo. O que foi **tirado** não
desapareceu — está descrito nos fechados, e é isto, para quem vier depois não achar que
foi esquecido:

- **As 138 contas ainda não foram usadas.** Zero das 138 entrou até 31/08. Tudo depende
  disso e não depende de nós: a folha está impressa, a parede da senha está no ar e
  provada, e o "Complete seu cadastro" já pergunta quase tudo que falta nas fichas vazias.
- **Nenhuma família nova passou pelas portas.** As portas foram provadas em 31/08 na
  produção, com uma família de mentira apagada em seguida. O mundo real ainda não passou.
- **As 28 fichas sem dados** se resolvem quando essas pessoas entrarem. Sobram só o nome
  da mãe e do pai (que têm campo na ficha, mas não entram no "Complete seu cadastro") e os
  3 cerimoniários, que pela patente devem ser os mais velhos e provavelmente precisam de
  telefone próprio, não de responsável.
- **As casas continuam vazias** — zero de 191 pessoas tem casa, então o brasão não aparece
  no avatar de ninguém. Quem distribui é a coordenação, uma pessoa por vez, e o dono pediu
  para desconsiderar.
- **O convite da foto ainda não foi visto por ninguém de verdade.** O recado está na ficha
  de 26 pessoas e o código está no ar (conferido nas 20 telas da produção em 01/09), mas
  como zero das 138 contas entrou, o pop-up nunca abriu para uma pessoa real. Sai daqui
  quando a primeira abrir — ou quando a primeira foto nova aparecer no bucket.

Quando alguma dessas coisas acontecer no mundo, ela volta para cá com data.

---

## 2. Coisas que NÃO se deve fazer (registro, para não repetir)

**Não refazer os 4 brasões antigos.** Cheguei a propor, porque eles têm franja preta serrilhada no
modo claro. **Tentei, e estava errado: o recorte destrói a arte deles** — no `templaris` a capa
verde e o cabelo sumiram. Os arquivos no ar são melhores. A franja fica.

**A regra do recorte, para todo brasão novo:** limite **6**, suavização de borda **0,5**, e
conferir a saída **composta sobre magenta** antes de subir — foi só assim que apareceu que a faixa
do CONSILIUM tinha ficado transparente com o limite 40.

**Não tirar a policy de SELECT do bucket `avatars` sem pôr outra no lugar.** Já derrubou o
envio de foto DUAS vezes (a 009 consertou em 2025, a 002_p1 refez em 09/06/2026 e ficou 84
dias assim). Quem grava precisa LER a linha que gravou — `upsert` vira `on conflict do
update` e o storage-api devolve a linha com `returning`; os dois exigem SELECT. O erro que
aparece é *"new row violates row-level security policy"*, que fala de **gravar** quando o
que falta é **ler** — e é por isso que se procura no lugar errado. O recorte certo está na
065 (cada um lê a própria pasta, a equipe lê `membro/`) e `docs/provas/provar-065-foto-sobe.sql` fica
vermelho se alguém afrouxar **ou** apertar demais de novo.

**Não reabrir o kit do Lucas Bernardo nem do André de Souza Ribeiro** — os dois estão fora por
opção do dono (o André tem menos de 14 mesmo).

*Sobre o André, para quando o assunto voltar:* ele **serve normalmente em Santo Antônio** — o Kit
leve é modo `libera`, e modo `libera` nunca impede: quem já tem habilitação passa direto. Fica
barrado só na **Matriz**, pelo Kit processional. O dono decidiu que **quando ele fizer 14 pode
liberar** — mas isso **não acontece sozinho** com a `data_nascimento` em branco, porque a regra
recusa por não saber a idade, não por compará-la. Preencher a data faz o sistema liberá-lo no dia
certo; sem ela, alguém tem de lembrar.


---

## 3. O que já foi feito

O histórico completo — 8 dias de consertos, de 18/08 a 01/09/2026, cada um com o que era, a
causa e como foi provado — está em **[`pendencias-fechados.md`](pendencias-fechados.md)**.

Saiu daqui em 16/09/2026 para esta lista voltar a caber numa tela. Nada foi apagado.
