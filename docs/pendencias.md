# Acólitos — o que está pendente

Atualizado em 20/08/2026. Esta é A LISTA: abrir aqui antes de decidir o que fazer.
Quando algo sair daqui, sai porque foi feito **e conferido**, não porque foi commitado.

---

## 1. Pendente

**Distribuir as pessoas pelas casas.** Em 20/08 **1 das 176 pessoas ativas** tem casa
preenchida (o dono, na Sanctaris). As 5 casas existem, os 5 brasões estão no ar e o
encanamento inteiro está pronto e provado (ver "O brasão chega às telas de RPC", abaixo) —
o que falta é gente dentro das casas. Enquanto isso, o brasão só aparece no avatar de uma
pessoa em todo o app.

Não é trabalho de código: quem distribui é a coordenação, em **Casas › organograma**, uma
pessoa por vez. **Não faço isso por SQL** — é dado de gente real, e o dono não pediu. Se o
volume incomodar (são 175), o que dá para fazer é uma tela de distribuir vários de uma vez;
é feature nova, precisa ser pedida.


**Abrir o app com conta real e conferir DUAS coisas que subiram sem prova no ar** (portão de
notificações no ar em 19/08, boas-vindas ao time no ar em 20/08). As duas moram em lugares
que o verificador de telas não alcança, e as duas quebram feio se estiverem erradas.

*Do portão:* ele vive dentro do `initModulo`, e o verificador **substitui o `initModulo`**
por um falso. A parede e a regra estão provadas; que o boot chame o portão antes de liberar a
tela, não.

> **✔ CONFERIDO NOS DOIS LADOS, em 20/08/2026 — o portão está fechado.**
>
> *Quem já tem o sino:* o dono abriu com a conta dele (sino ligado desde 16/07) e **não viu
> parede nenhuma**. Era o risco que trancaria as 41 contas de uma vez; descartado.
>
> *Quem não tinha:* **Maria Eduarda Meirelles Marques ativou às 05h23 de 20/08, num Android** —
> depois de o portão subir. A inscrição dela só existe porque o caminho inteiro funcionou:
> permissão concedida, assinatura criada e linha gravada no banco. Primeira pessoa a esbarrar
> no portão, primeira a ligar o sino. **De 1 aparelho para 2.**
>
> Se algo der errado com o resto do grupo, o desfazer rápido é o Instant Rollback da Vercel.

**Medido em 20/08, no fim do dia: 7 inscrições, de 6 pessoas.** O portão funcionou — era
**1 aparelho parado desde 16/07**, um mês inteiro com o pop-up antigo, e entraram 6 num dia
só. (Uma das 7 é o mesmo celular contado duas vezes: o navegador de uma pessoa descartou a
inscrição e fez outra 90 segundos depois. O endereço velho morre sozinho — o `enviar-push`
apaga quando o Google responde que não existe mais. Na prática são 6 aparelhos.)

Faltam **41 das 47 contas**. Elas esbarram no portão sozinhas, na primeira abertura — não há
nada a fazer aqui além de acompanhar o número subir. Para medir de novo:
`select count(*), count(distinct user_id) from acolitos_push_subs;`

*Da boas-vinda:* a animação e o texto estão provados no navegador, mas **o caminho inteiro
não** — incluir alguém de verdade no Config › Times, ver o toque chegar no celular dela e a
festa aparecer na abertura seguinte. O tipo `boas_vindas` do `api/enviar-push` só se prova
mandando um de verdade: pelo ar não dá, a função recusa antes de olhar o tipo.

**O que esperar:** os que ainda não ligaram o sino batem na parede na primeira abertura. Quem tocar em "Não Permitir" na caixinha do sistema não entra até
religar nos Ajustes — a parede ensina o caminho, mas vai gerar ligação para a coordenação. É
consequência conhecida e aceita, não surpresa.

O dono dispensou dois itens que estavam aqui: a **conta do Vercel** (o CLI e o acesso automático
seguem presos em outra conta — quando a Vercel não dispara o build sozinha, o jeito é um commit
vazio para reempurrar o gatilho) e o **F7 "São Tarcísio"** (só existe o nome). Não são esquecimento:
são decisão. Só voltam se ele pedir.

---

## 3. Coisas que NÃO se deve fazer (registro, para não repetir)

**Não refazer os 4 brasões antigos.** Cheguei a propor, porque eles têm franja preta serrilhada no
modo claro. **Tentei, e estava errado: o recorte destrói a arte deles** — no `templaris` a capa
verde e o cabelo sumiram. Os arquivos no ar são melhores. A franja fica.

**A regra do recorte, para todo brasão novo:** limite **6**, suavização de borda **0,5**, e
conferir a saída **composta sobre magenta** antes de subir — foi só assim que apareceu que a faixa
do CONSILIUM tinha ficado transparente com o limite 40.

**Não reabrir o kit do Lucas Bernardo nem do André de Souza Ribeiro** — os dois estão fora por
opção do dono (o André tem menos de 14 mesmo).

*Sobre o André, para quando o assunto voltar:* ele **serve normalmente em Santo Antônio** — o Kit
leve é modo `libera`, e modo `libera` nunca impede: quem já tem habilitação passa direto. Fica
barrado só na **Matriz**, pelo Kit processional. O dono decidiu que **quando ele fizer 14 pode
liberar** — mas isso **não acontece sozinho** com a `data_nascimento` em branco, porque a regra
recusa por não saber a idade, não por compará-la. Preencher a data faz o sistema liberá-lo no dia
certo; sem ela, alguém tem de lembrar.

---

## Fechados em 20/08/2026

**O brasão chega às telas que pegam a gente por FUNÇÃO do banco (migration 058)**
- **O que era:** o brasão da casa subiu no avatar em 20/08 e funcionava só nas telas que
  leem `acolitos_membros` direto. As que pegam a gente por **função do banco** ficavam sem
  brasão, caladas, porque nenhuma dessas funções devolvia `casa_id`.
- **Eram 7 funções, não 6.** A anotação anterior esqueceu a `acolitos_membro_card` — é ela
  que monta o cartão que abre ao tocar num nome. Sem ela o brasão apareceria na lista e
  sumiria ao abrir a pessoa.
- **A Jornada já pedia o brasão desde 20/08 e nunca recebia nada.** Estava quebrado no ar,
  em silêncio; ninguém ia descobrir olhando o código de uma tela só.
- **Dois lugares não precisavam de SQL nenhum** (o chip de irmãos e "quem você vai
  administrar"), e mais dois apareceram na varredura (**Minha Conta** e "Complete seu
  cadastro"): o membro ali vem de `select('*')`, a casa já estava na mão, faltava pedir.
- **Varridos os 22 avatares do app**, não os 3 da anotação. Sobram dois de fora e os dois
  estão certos: `minha-casa` (ali todo mundo é da mesma casa — brasão em todo rosto é ruído)
  e a definição da própria função.
- **De brinde, a aba Campeões ganhou FOTO.** Ela montava cada pessoa só com id, nome e liga:
  ninguém tinha foto ali. Mesma função, mesmo risco.
- **O medo da anotação antiga estava mal calibrado.** Ela temia "tela vazia sem erro
  nenhum". Fui medir por quê: as 7 funções montam a resposta **campo a campo**, então
  acrescentar um campo não muda quantas linhas saem, e onde há agrupamento o Postgres
  **recusa na criação**, alto e claro. O que dá tela vazia é mexer em junção ou filtro — e
  não precisou.
- **Provado nos dois lados.** `docs/provar-058-casa-nas-rpcs.sql` roda antes e depois, mede
  o que está valendo e não escreve nada: a coluna `itens` deu **exatamente o mesmo número**
  nas duas rodadas (470, 30, 30, 71, 176, 33) — nenhuma tela esvaziou — e o campo passou de
  0 para 100% em todas. Uma segunda parte prova que o **valor** chega, não só o campo
  (sanctaris chegando na Agenda, no cartão e na Chamada). As permissões das 7 foram
  fotografadas antes e depois: **idênticas**, e nenhuma executa para o anônimo.
- **A prova achou a função vazia sumindo do relatório.** A `acolitos_campeoes` (ainda não há
  campeões) simplesmente não aparecia na lista — que é a cara do "está tudo bem" falso deste
  projeto. Agora as 7 são listadas sempre, e a vazia diz que está vazia.
- **A ferramenta de provas de tela tinha um buraco que impedia provar isto.** O `initModulo`
  falso devolvia o contexto e nada mais — nunca carregava o de-para das casas, que o de
  verdade carrega. Com isso **nenhuma** prova de tela conseguiria ver um brasão: a prova nova
  nasceu vermelha acusando um app correto. Corrigido no verificador.
- **Provado que fica vermelha quando o app quebra:** tirei o pedido do brasão da lista de
  Destaques, a prova acusou, e o arquivo voltou sem diferença nenhuma.
- **91 provas de tela + 168 de regra, todas verdes.**
- **O que isto NÃO resolve:** com 1 pessoa de 176 em alguma casa, o campo chega em todas as
  telas mas vem vazio para 175 — e vazio faz o avatar sair **sem** brasão, nunca com o de
  outra casa. Ver o pendente lá em cima.

**Cada time vê só as tarefas dele (migration 057 APLICADA e PROVADA RODANDO)**
- **O que era:** a trava das tarefas olhava só o PAPEL. Quem fosse `coord_admin`, `subadmin`
  ou `membro_equipe` lia **e escrevia** todas as tarefas dos onze times. E entrar em qualquer
  time promove a `membro_equipe` — ou seja, quem entrasse no Almoxarifado podia **apagar**
  tarefa da Coordenação. O que segurava era a aba exigir a permissão `tarefas`, que nasce
  desmarcada: portão na TELA, não no dado.
- **O que é agora:** coordenação vê e mexe em tudo; quem é de time, só no time dela. A
  função nova `acolitos_meus_times(uid)` é `SECURITY DEFINER` (a política precisa ler a
  tabela de membros, que tem trava própria) e **não executa para o anônimo**.
- **O `with check` é metade da trava**, não enfeite: sem ele a pessoa editaria uma tarefa do
  time dela trocando o `time_slug` — a separação vazaria pela EDIÇÃO, não pela leitura, que
  é o buraco que ninguém procura.
- **Feito com a tabela VAZIA** (zero tarefas), de propósito: errar isso depois, com o quadro
  cheio, esconderia trabalho real de gente real.
- **PROVADA RODANDO, não por leitura:** `docs/provar-057-tarefas-por-time.sql` cria tarefas
  de mentira, consulta fingindo ser a coordenação e duas pessoas de times diferentes, tenta
  apagar de outro time, tenta mover para outro time, tenta criar em outro time, e desfaz tudo
  com `rollback`. **8 verificações, todas passaram** — antes de aplicar e de novo depois. Vale
  rodar de novo a qualquer momento: ele mede o que está valendo, não reaplica nada.
- **A tela acompanha em UM lugar só** (`timesVisiveis`, 7 testes): o recorte é feito ao
  carregar e no formulário, que relê o catálogo por conta própria. Não é segurança — é para
  a tela não oferecer um time que o banco vai recusar, o que daria erro sem explicação.
- **Quem for `membro_equipe` sem nenhum time não vê tarefa alguma.** É o correto, mas se
  alguém reclamar de quadro vazio, é a primeira coisa a olhar.

**Boas-vindas ao time (NO AR)**
- **Incluir alguém num time avisa a pessoa.** Antes produzia só um `toast` que quem clicou
  via; a pessoa incluída não ficava sabendo de nada. Agora abre uma caixa para escrever um
  **recado só para ela**, ela recebe o toque no celular na hora e vê a festa na abertura
  seguinte, uma vez, com o recado em destaque e o ícone do time.
- **Reusa o que já existia:** o motor de celebração (`showCeleb`, o mesmo de estrela, medalha
  e campeão) e a fila de avisos (`membro.avisos`). Tipo novo `boas_vindas_time`. **Nenhuma
  tabela nova, nenhuma migration.**
- **O recado é opcional** — exigir texto para cada pessoa viraria trabalho chato e acabaria
  pulado. Sem recado, entra o texto padrão.
- **As DUAS portas** (Config › Times e o organograma das Casas) chamam a mesma função do
  `shared.js`. Duas cópias divergiriam no primeiro conserto.
- **11 ícones de time** no catálogo `_svgIcon`, traçados, sem emoji — com a classe `ico`, sem
  a qual o navegador preenche o caminho e o ícone vira mancha preta.
- **Push:** tipo `boas_vindas`, no portão da **COORDENAÇÃO** (não o da equipe: incluir alguém
  num time é ato de coordenação), e cai na **home**, não nas escalas do membro.
- **Antes de gravar, relê os avisos do banco** — escrever por cima da lista da tela apagaria
  avisos que chegaram no meio, inclusive de outra coordenação mexendo ao mesmo tempo.
- **Um erro de português pego na revisão:** o aviso dizia "você entrou **do** time Escala".
  Os testes passavam porque conferiam só se o nome e o time apareciam; agora conferem a frase
  **inteira**.
- **Provas:** 14 de regra + 13 de tela. Duas armadilhas de medição ficaram registradas no
  código do verificador: `innerText` devolve o texto **em maiúsculas** (é o CSS dos botões), e
  `getBoundingClientRect` **mente** enquanto o `transform` da animação está em curso — foi
  assim que um ícone perfeito apareceu com largura 0.

---

## Fechados em 19/08/2026

**Notificações viraram obrigatórias**
- **O pedido virou portão.** Era um pop-up insistente, só na home, que **desistia de quem
  tinha negado**. Em um mês rendeu **1 aparelho inscrito, de 47 contas**. Agora roda no
  `initModulo` (as 19 telas) e sem o sino ligado o app não abre.
- **A parede não fecha:** sem X, sem clicar fora, sem ESC, sem "agora não". Tem só "Sair da
  conta", para ninguém ficar preso numa tela sem botão — e sair não dá acesso a nada.
- **Quatro becos, quatro receitas.** Quem ainda pode ser perguntado vê o botão; quem negou
  vê o passo a passo dos Ajustes; **iPhone aberto no navegador** vê como instalar na Tela de
  Início; navegador sem suporte é mandado para o celular. A ordem das perguntas é a regra:
  no iPhone fora do app instalado o Safari responde "não suportado" **e** "negado", e as
  duas receitas estão erradas ali — só instalar resolve.
- **Só passa quem está inscrito no banco**, não quem só deu permissão. Se a assinatura
  existe no aparelho mas a linha sumiu, o app **regrava calado** em vez de barrar.
- **A única isenção** é quem aguarda aprovação do cadastro: não é membro, não é escalado,
  não tem o que receber. Coordenação e superadmin não têm isenção.
- **Sumiu o botão de desligar** em Minha Conta: desligar ali só levava a pessoa a bater na
  parede na tela seguinte sem entender por quê.
- **Se o `<script>` do portão faltar numa tela, o portão ABRE** (com aviso no console). Um
  arquivo esquecido não pode trancar 47 pessoas fora do app.
- **Provas:** 12 testes de regra (`portao-notificacoes-core.test.js`) + 12 provas de tela
  que rodam o portão e a parede no navegador. O motor das provas ganhou `avaliar:` para
  alcançar código do shared.js que a medição normal não vê.

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

**Ferramenta**
- **As provas de tela viraram parte do projeto** (`projetos/acolitos/provas/`). O verificador
  que simula a sessão e dá a partida na tela existia solto, refeito a cada sessão; agora é
  `npm run provar-telas`: 19 telas em 4 papéis, mais as provas dos defeitos que já aconteceram
  — 32 provas em ~1 minuto. **Provado que ele fica vermelho quando o app quebra**: sabotei a
  Escala com uma função inexistente e desfiz a correção da barra; ele acusou as duas, e os
  arquivos voltaram sem diferença. O LEIA-ME da pasta diz também o que ele NÃO prova (banco
  de verdade, permissão de módulo, aparência) — para ninguém confiar demais no verde.

**Telas**
- **A barra dizia o lugar errado.** Abrir Escala › ⋯ Mais › Ausências levava à tela certa, mas
  a barra de baixo acendia **Caixa**: a Ausências não tem botão próprio e o código emprestava o
  id da vizinha. A Chamada tinha o contrário (barra apagada, pelo id que sumiu quando ela foi
  fundida na Escala). As duas passam a acender a **seção de onde saem**, por `idNaBarra()` no
  navegacao-core. Provado executando o `init()` das telas em 3 papéis e lendo o `.active` no DOM.
- **Coisa nova não entrava no Config.** Em Config › Navegação faltava a **Tarefas** e sobrava
  **"Faltar"** (aposentada em 17/08): a lista era uma **quarta cópia à mão** dos itens da barra.
  Agora vem de `montarItensNav`, a mesma função que monta a barra. Guarda nova
  (`modulos-sincronia.test.js`) exige que as três listas de módulo do shared.js falem do mesmo
  conjunto — buraco que estava declarado e sem teste.
- **Modelos de escala ignorava função criada pelo dono.** Dava para criar "Báculo Auxiliar" em
  Funções litúrgicas, ela nascia na Escala e na ficha do membro, e o editor de Modelos lia só as
  13 do sistema — não havia onde dizer quantas vagas ela tem, e o Salvar gravava só as 13.
  Passa a mesclar as próprias, sem repetir chave. Provado em 3 cenários (nenhuma, uma, e uma com
  chave repetida), lendo a tela E o que o Salvar mandaria pro banco.
- **A aba Tarefas confirmada pelo dono** — carrega normal para quem está logado. Era o último
  pedaço da trava de 18/08 que não dava para medir daqui.
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
- **Central do Servo** — a anotação de "aprovar candidatura não revalida a vaga" também estava
  velha: a **052** fechou isso. Conferido o fluxo inteiro: a lista de Vagas já mostrava só as
  realmente abertas (compara o modelo com quem está escalado e esconde missa onde a pessoa já
  serve), aprovar recusa quando encheu, e a tela diz o motivo. Sobra só a fresta de a vaga encher
  ENTRE ver a lista e se candidatar — o pedido é recusado com motivo certo. Desconforto, não
  defeito.
