# Acólitos — o que está pendente

Atualizado em 16/09/2026. Esta é A LISTA: abrir aqui antes de decidir o que fazer.
Quando algo sair daqui, sai porque foi feito **e conferido**, não porque foi commitado.

---

## 1. Pendente

**Ordenar e filtrar — passos 2 a 5 da spec**
(`docs/superpowers/specs/2026-09-16-acolitos-ordenar-e-filtrar-design.md`). O passo 1 (a barra
+ Membros) está feito em 16/09/2026. Faltam: Agenda e CRM; Chamada; migration 069 +
Ausências (Avisos e Faltas — a parte que filtra NA CONSULTA, porque as listas vêm em pedaços);
Tarefas.

**O aviso "Instale o app" cobre o fim de TODA janela do app no celular.** Achado em 16/09 ao
fotografar o painel de filtros: o botão "Ver N membros" fica meio escondido atrás dele. Não é
do filtro — o aviso (`#pwa-banner`) fica numa camada acima (400) de toda janela (200). Só
aparece no navegador, até a pessoa tocar no X. Conserto provável: esconder o aviso enquanto
houver janela aberta — e provar em várias telas.

**As provas de tela falharam uma vez sem motivo conhecido (17/09/2026).** Logo depois de
juntar o passo 1 na `main`, uma rodada de `npm test` deu **22 falhas em 195**. O código era o
mesmo que tinha passado 195/195 minutos antes, e as três rodadas seguintes passaram inteiras.
Só o total foi guardado, não quais provas falharam — então a causa é desconhecida. Suspeita não
confirmada: o harness espera tempos fixos (350 ms) e a máquina podia estar ocupada por outra
janela. **Da próxima vez, guardar a saída inteira** (`npm run provar-telas > arquivo 2>&1`)
antes de rodar de novo.

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
