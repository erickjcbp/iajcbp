# Acólitos — o que está pendente

Atualizado em 23/09/2026. Esta é A LISTA: abrir aqui antes de decidir o que fazer.
Quando algo sair daqui, sai porque foi feito **e conferido**, não porque foi commitado.

---

## 1. Pendente

**Rodízio — o que a medição de 23/09/2026 deixou pendente.** A aba Rodízio está na Escala
(terceira aba, junto de Operacional e Planilha). A régua dela é **A REGRA DA PASTORAL: todo
membro serve 2× por mês**, dita pelo dono em 23/09. Mostra "este mês" (X/2, destacado quem
está abaixo), as duas contas separadas — "sem escalar" e "sem servir" — faltas e o motivo.

⚠️ **NÃO é falta de vaga, é distribuição.** Medido em agosto (mês fechado): o calendário
entregou **344** turnos e a regra pede **354** — faltam **10 no mês inteiro**. Faltam 76
turnos para quem ficou abaixo de 2×, e **sobram 66** em 50 pessoas que serviram 3 ou 4 vezes.
Redistribuindo o que já existe, cobre-se 66 dos 76. (Uma conta anterior minha dizia "faltam 13
vagas por fim de semana" — aquilo respondia "ninguém passar de 2 semanas", que é mais exigente
que a regra. Não usar aquele número para pedir mais posto no altar.)

O que ainda NÃO foi feito:

- **O gerador já persegue os 2× — FALTA CONFERIR NO USO (23/09/2026).** O `carga[id]` deixou
  de ser "escalas nas últimas 6 semanas" e passou a ser `vezes no mês × 1000 + janela de 6
  semanas` (`RodizioCore.pesoRodizio`), então quem está em 0/2 passa na frente de quem já fez
  2, e no primeiro fim de semana do mês nada muda (todos em 0, desempata o rodízio antigo).
  A conta vive num número só porque o gerador o compara em CINCO lugares — regra escrita em
  cinco lugares é regra que um dia falta em um. **Só sai desta lista quando outubro fechar e a
  aba Rodízio mostrar mais gente em 2/2 do que em agosto (121 de 177).** Lembrar que "Gerar
  escala da semana" só preenche vaga VAZIA: semana já montada não se rebalanceia sozinha.
- **`carregarPesoRodizio` agora é UM só, no `shared.js`.** Vivia copiado em escala, caixa e
  ausências; as duas cópias alimentavam o motor de troca, e teriam ficado com a regra velha —
  aprovar uma ausência escolheria substituto ignorando os 2× por mês.

- **"Frequente" na disponibilidade do membro (pedido do dono, 23/09).** Marcar poucas pessoas
  (5-10) para o gerador escalar com mais frequência. Medido: com 10 frequentes servindo todo
  fim de semana, o resto passa de uma vez a cada 2,3 para 2,5 fins de semana — cabe. Com 20+
  NÃO cabe (vira 2,8 e piora o buraco que a aba existe para mostrar). **Precisa de desenho
  próprio**: mexe no gerador em três lugares (`planejarVagas`, `gerarEscalaSemana` e
  `gerador-substituto.js`) e de coluna nova no banco. O `.env` está preenchido e o pooler
  responde, então a migration é possível. **Exigir um TETO no número de marcados**, senão
  marcam 40 e ninguém percebe que o resto parou de servir.
- **As 20 pessoas acima do piso.** 16 com 4+ semanas sem serem escaladas e 4 que nunca
  entraram em escala nenhuma (Heloísa, Rayssa, Maria Eduarda e Augusto — todas aspirantes,
  **uma única habilitação cada**, e é isso que fecha as portas do gerador para elas).
- **O piso do grupo é o limite de verdade: faltam 13 vagas por fim de semana.** 76 vagas
  (25 sábado + 51 domingo) para 177 ativos, e o gerador não repete ninguém no mesmo fim de
  semana → 177/76 = **uma vez a cada 2,3 fins de semana, no melhor caso possível**. Para
  ninguém passar de 2 semanas seriam necessárias 89 vagas. Isso não é software: é mais posto
  por missa ou mais celebração com escala. **Decisão do dono/coordenação.**

**Rotinas — o que ficou para depois (18/09).** O cardápio está no ar. Falta: as rotinas que
nascem da **agenda das missas** (véspera de celebração gera "separar as vestes"), a **IA
sugerindo rotinas** para cada setor (o dono aprova antes de virar rotina), e — se o dono quiser
— uma **fila de pedidos de alteração**, para o setor pedir mudança numa rotina em vez de
depender de falar com a coordenação. Hoje o setor cria e usa; alterar e desligar é da
coordenação.

**⚠️ A ARTE DA ESCALA NÃO SAI MAIS SOZINHA (18/09).** O plano gratuito da Vercel dá 2 robôs
agendados, e os dois eram da arte (um gerava, outro vigiava). O dono decidiu trocar os dois
pelo lembrete diário da CRM. Então, **toda semana alguém precisa abrir a tela de Escala e usar
"Arte da semana → Gerar/Atualizar"** — e, se ela não sair, ninguém é avisado. Para voltar ao
automático: plano pago da Vercel (libera robôs à vontade) ou um robô diário que acumule as duas
funções (gerar/vigiar a arte às segundas + CRM todo dia).

**Formação — o que vem depois da trilha ter entrada (18/09).** A trilha foi preenchida embaixo
(Aspirante e Coroinha) e o ensaio parou de travar capítulo. Falta, em ordem:
- **a tela de acompanhamento do setor Formação** — quem está parado, quem evoluiu, quem sumiu.
  Ela lê o que a trilha produz, então só faz sentido com a trilha rodando;
- **o gerador de tarefas por setor** — a rotina semanal da Formação nascendo sozinha em cima
  dessa tela. O motor de recorrência já existe (`tarefas-core.js`), mas só cria a próxima
  quando alguém conclui a anterior, e a partida teria de ser ao abrir a tela: o plano da
  Vercel é o gratuito e os 2 robôs agendados já estão em uso;
- **os 4 que ainda estão no CRM** (Cecília e Mayara na túnica, Gabriela na aprovação do
  cadastro, Maria Clara na integração) viram Aspirante sozinhos quando chegarem em "integrado".

**Acesso: 148 pessoas nunca abriram o app** (medido em 18/09), de 193. Todas têm conta ligada
à ficha — o que falta é entrar. A folha foi reimpressa para os 129 ativos que ainda estão com
a senha provisória, e cabe à coordenação mandar no grupo. **9 pessoas ativas nunca entraram e
NÃO estão com a senha da folha** (conta criada por outro caminho): para elas é Config → Logins
→ Redefinir senha, uma a uma.

**Ordenar e filtrar — passo 5 da spec**
(`docs/superpowers/specs/2026-09-16-acolitos-ordenar-e-filtrar-design.md`). Membros (16/09),
Agenda, CRM, Chamada e Ausências (17/09) estão feitos. Falta **Tarefas** — e ela hoje tem
ZERO tarefas cadastradas, então o filtro lá não terá o que mostrar até alguém criar a primeira.

**A função antiga de faltas (`acolitos_faltas_recentes`) ficou sem uso.** A tela nova usa a
`acolitos_faltas_filtradas`. Apagar a antiga numa migration futura, só depois de confirmar que
nenhum celular ficou com a versão velha do app aberta.

**Limpeza no banco:** a vista `acolitos_ausencias_v` nasceu com permissão ampla para quem está
logado (padrão do Supabase ao criar; o `revoke` só tirou anônimo e público). É inofensivo hoje
— a vista junta duas tabelas e não aceita escrita — mas o certo é uma migration que deixe só
leitura.

**Detalhes pequenos das Ausências** (nenhum aparece no uso normal):
- Quando a lista de pessoas não carrega, o recado diz "o filtro por pessoa está indisponível",
  mas a pessoa que já estava filtrada continua valendo; só não dá para buscar outra.
- Na abertura padrão dos Avisos, o app pede a contagem duas vezes ao banco (uma delas é
  descartada). Sem efeito visível.
- Apagar uma ausência não atualiza o "Mostrando X de N" nem os números do topo até recarregar.
- Trocar de aba no meio do carregamento pode misturar conteúdo por um instante (defeito
  antigo da tela, não do filtro).
- A prova SQL das faltas compara 80 com 80 em um dos pontos, o que passa fácil demais; e dois
  trechos dependem de leitura humana em vez de falhar sozinhos.

**O "Voltar fecha o modal" pode tirar a página do lugar — sobram dois consertos maiores.** O
app faz "Voltar" ao fechar qualquer janela (`shared.js`, perto da linha 3416): fechar chama
`history.back()`, que o navegador executa DEPOIS. Se outra janela abre antes disso, a página
pode sair do lugar, e o harness devolve o resultado da prova vazio SEM acusar erro. É a
explicação mais forte (não provada) para as **22 falhas misteriosas** de 17/09 — evidência:
uma rodada com 21 falhas de uma prova só, todas com resultado vazio. **Todas as provas de barra já se protegem** (esperam
120 ms depois de fechar uma janela e conferem que o resultado não veio vazio; a antiga ganhou
isso em 17/09 e passou 3 rodadas seguidas). Faltam: (1) o harness acusar sozinho quando a
página sai do lugar; (2) no app, só registrar a janela nova no histórico quando não houver um
"voltar" pendente — o risco para gente de verdade é baixo (o toque é mais lento que essa
janela), mas existe.

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
