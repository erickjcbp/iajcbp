# Acólitos — o que está pendente

Atualizado em 30/08/2026. Esta é A LISTA: abrir aqui antes de decidir o que fazer.
Quando algo sair daqui, sai porque foi feito **e conferido**, não porque foi commitado.

---

## 1. Pendente

**Dois campos para o mesmo telefone.** O número do responsável mora em
`celular_responsavel` OU em `celular_recado`, dependendo de por onde a pessoa se
cadastrou: o cadastro de família (tela de entrada, `api/signup-familia.js`) grava o
primeiro; o formulário de novos (`novos.html`) grava o segundo. Hoje são 11 pessoas num
campo e 111 no outro.

Isso já mordeu em 27/08: o cartão do CRM lia só um dos dois e mostrava "—" para **6 das 7
pessoas do funil**, com o número ali do lado. Foi remendado — quem lê agora olha os dois —
mas o remendo tem de ser repetido em toda tela nova que mostrar telefone, e alguém vai
esquecer.

O conserto de verdade é escolher um campo, migrar o outro e fazer os dois cadastros
gravarem no mesmo lugar. Não é grande: é uma migration de cópia, um `coalesce` nas telas e
uma linha em cada cadastro. Mas mexe em dado de contato de 122 pessoas, então merece uma
sessão própria e prova de que ninguém ficou sem telefone.

**Distribuir as pessoas pelas casas.** Medido no banco em **30/08: ZERO das 172 pessoas
ativas** tem casa preenchida. **Este parágrafo dizia "1 das 176 (o dono, na Sanctaris)" e
estava errado** — a `casa_id` do dono está vazia; ou foi limpa depois de 20/08, ou nunca foi
gravada. Contado com `select count(*) filter (where casa_id is not null) from
acolitos_membros where status='ativo'`, e não de cabeça: número escrito à mão envelhece.

As 5 casas existem, os 5 brasões estão no ar e o encanamento está pronto — e em **30/08 foi
provado numa CONTA REAL**, não só na prova de tela: pus o dono na Sanctaris pelo banco, ele
abriu o app e o brasão apareceu no avatar dele; depois a ficha foi devolvida idêntica ao que
estava (casa vazia, os 3 times, os 9 acessos), conferida campo a campo. O que falta é só gente
dentro das casas. Enquanto isso, **o brasão não aparece no avatar de ninguém em todo o app**.

Não é trabalho de código: quem distribui é a coordenação, em **Casas › organograma**, uma
pessoa por vez.

**Não faço isso por SQL** — é dado de gente real, e o dono não pediu. Se o
volume incomodar (são 172), o que dá para fazer é uma tela de distribuir vários de uma vez;
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

## Fechados em 30/08/2026

**A prova de tela que mentia desde 21/08 parou de mentir (Config › Atividade)**
- **O que era:** a prova "quem usou hoje aparece como Usou hoje" montava as quatro pessoas de
  amostra a partir de uma data escrita à mão (`2026-08-20T18:00`), mas a **tela** conta os dias
  a partir do relógio de verdade da máquina. Cada distância da amostra escorregava um dia por
  dia. Em 27/08 a prova acusava "Usou há 1 semana · 20/08"; em 30/08, dez dias de escorregão.
  **Nunca foi defeito do app.**
- **Tinha uma segunda bomba armada, que ninguém tinha visto:** a "Pessoa Bb" usava 75 dias e a
  prova exigia "há 2 meses". A tela faz `floor(n/30)`, então em **04/09** os 75 dias virariam 90,
  sairia "há 3 meses" e essa prova cairia também — cinco dias depois da outra.
- **O conserto:** a amostra passou a ser ancorada na **meia-noite de hoje**, do relógio da
  máquina. A tela também trunca para a meia-noite antes de subtrair, então o número de dias
  escrito na prova é exatamente o número que a tela vai calcular. Não é "trocar a data fixa por
  `new Date()`": a escolha das distâncias faz parte do conserto — **cada uma tem de cair no meio
  do beco, não na beirada** (os becos são n=0 hoje · n=1 ontem · n<7 dias · n<30 semanas ·
  n>=30 meses). 75 ficou porque é o meio de 60..89, a faixa inteira que sai como "2 meses".
- **Provado em três relógios**, dois deles a 26 horas de distância um do outro — ou seja, em
  dias de calendário diferentes: São Paulo, `Pacific/Kiritimati` (UTC+14) e `Etc/GMT+12`. As 11
  provas da Atividade passam nos três. Antes do conserto, 125 de 126; agora 126 de 126.
- **Achado de brinde, NÃO consertado:** rodando em UTC+14, uma prova *diferente* cai — "data com
  hora não vira Invalid Date", do cartão do CRM. Ela compara com `01/08` escrito à mão, e em
  UTC+14 aquela data cai no dia 02. É fragilidade da prova em fuso extremo, não defeito do app
  para quem está no Brasil. Fica registrado aqui para não assustar quem rodar as provas viajando.

## Fechados em 27/08/2026

**Passar da etapa do WhatsApp passa a marcar a ficha (e 13 fichas foram corrigidas)**
- **O que era:** a etapa "WhatsApp" do CRM só termina quando a pessoa é posta no grupo — mas
  a ficha dela continuava com "não está no grupo do WhatsApp". Duas verdades sobre a mesma
  coisa, no mesmo banco. **19 pessoas passaram pela etapa e só 6 tinham a ficha marcada.**
- **As 13 foram corrigidas** pelo histórico do CRM (`etapa_de = 'whatsapp'`), que é o registro
  de quem de fato passou. Conferido depois: nenhuma sobrou, e ninguém foi marcado sem ter
  passado pela etapa.
- **Agora é automático:** confirmar a saída dessa etapa marca a ficha.
- **E o modal avisa ANTES**, com a frase escrita — automação que ninguém vê é automação que
  ninguém confere, e era exatamente disso que a divergência tinha nascido.
- **Voltar a etapa NÃO desmarca.** Ninguém sai de um grupo de WhatsApp porque a coordenação
  corrigiu o funil.
- **Ponto de atenção:** o gatilho olha o slug `whatsapp`. Se alguém renomear o slug dessa
  etapa no Config (o rótulo pode mudar à vontade, o slug não), a marcação para de acontecer
  em silêncio.

**O CRM ganhou o cartão da pessoa, e mudar de etapa passou a exigir comentário (migration 063)**
- **O pedido:** "torne obrigatório o preenchimento da observação; e transforma numa coluna
  lateral de comentário, tipo quando abre uma task no ClickUp; e explore mais os dados
  cadastrados". Ao esclarecer: **panorama = abrir o cartão da pessoa e ver tudo dela**, não
  um painel de contagens.
- **A observação de antes não era desusada: ela se apagava sozinha.** Era um campo único na
  linha do CRM, SOBRESCRITO a cada avanço de etapa — quem escrevesse na integração perdia o
  texto na túnica. Estava vazia em **0 de 18 linhas**. Agora são comentários: muitos, com
  autor e data, só inserção (não se edita nem se apaga — histórico reescrevível não explica
  decisão nenhuma).
- **O cartão mostra a pessoa inteira**: idade, nascimento, comunidade, situação, sacramentos,
  investidura, túnica, pai, mãe, responsável, pais ministros, irmãos na pastoral (buscando
  quem mais está no grupo), telefones, grupo do WhatsApp, endereço, necessidades especiais —
  e **o que falta na ficha**, que é a lista do que perguntar na próxima conversa. Antes a
  tela dava cinco colunas: nome, idade, etapa, dias e data.
- **A linha do tempo mistura comentários e mudanças de etapa** na ordem em que aconteceram, e
  quando o comentário explica uma mudança os dois aparecem juntos, numa linha só.
- **Obrigatório em avançar, voltar e tirar do funil.** Em "Recusar" NÃO se exige: essa ação
  apaga a pessoa, o histórico e a conta — o comentário morreria no mesmo segundo.
- **Um defeito antigo apareceu no caminho:** `formatDate` grudava 'T00:00:00' em tudo, então
  qualquer data COM hora virava "Invalid Date" — e a coluna "Data" da lista do CRM já
  mostrava isso para todo mundo, porque `etapa_iniciada_em` tem hora. Consertado na raiz, em
  shared.js, com prova própria.
- **A prova nova acusou os dois defeitos antes de eu subir**: "Invalid Date" e a situação
  aparecendo como `em_integracao` em vez de "Em integração".
- **E a prova mentiu duas vezes antes de funcionar**: uma barra dentro do texto que o motor
  avalia (`\/` vira `/` e quebra a expressão) e uma função `render` que o CRM não tem.
  Sete acusações num app correto.
- **O campo `observacoes` da tabela `acolitos_crm` ficou morto** — ninguém escreve mais nele.
  Está vazio; não foi removido para não mexer em tabela viva sem necessidade.

**Quem esquece a senha volta a ter saída (migration 062)**
- **A pergunta que abriu isto:** "quem está no CRM esquece login e senha, como faz?".
  Fui medir: **não fazia**. Os dois caminhos estavam quebrados.
- **O "Esqueci minha senha" nunca entregou nada a ninguém.** As 52 contas do app usam
  e-mail inventado (`usuario@coroinhas.jcbplimeira.com.br`) e o domínio aponta para a
  hospedagem do site, que **não recebe e-mail**. A tela dizia "Link enviado. Verifique seu
  e-mail" e a pessoa ficava esperando em vez de pedir ajuda. Agora ela diz a verdade —
  aqui o acesso é por usuário e senha — e oferece o WhatsApp da coordenação. Uma tela que
  promete o impossível é pior que uma tela que não promete nada.
- **A tela de Logins não mostrava quem está em integração.** Ela filtrava `status='ativo'`,
  e quem está no CRM na etapa da túnica fica como "em integração". Eram **6 pessoas**
  (mais 2 afastadas) sem NENHUM caminho para recuperar acesso, já que esta tela é o único
  que existe. Agora mostra todo mundo, com filtro por situação e a situação escrita na
  linha de quem não está ativo.
- **Prova nova** que trava o buraco: uma pessoa "em integração" na resposta de mentira tem
  de aparecer na lista. Sem ela, um filtro por status volta calado.
- **A primeira versão da prova acusou o app errado**: ela lia a resposta na chave
  `avaliacao`, e o motor devolve `avaliado`. Cinco falhas vermelhas num app correto. Só
  apareceu porque fui olhar a tela de verdade em vez de acreditar na prova.
- **Fica para depois (item "c" do dono):** deixar cada pessoa cadastrar um e-mail de
  verdade só para recuperação. Aí o link volta a existir e funciona.

**O app reconhece quem já está no cadastro na hora de se cadastrar (migration 061)**
- **O problema, com nome e sobrenome:** vieram 170 pessoas de uma planilha e **134 ainda
  não têm login**. Quem já é da pastoral cria conta, preenche o formulário e vira uma
  SEGUNDA pessoa no cadastro. Aconteceu com a Isabeli Sousa Martins em 23/07/2026.
- **NÃO reconhece por "porcentagem de semelhança".** Medido no cadastro real: comparar
  nomes por semelhança acusou **26 pares parecidos e só UM era a mesma pessoa**.
  "Heloísa Costa Oliveira" x "Helena Costa Moreira" dá 76% e são duas meninas; "Pedro
  Henrique Lima" x "Davi Henrique Lima" dá 81% e têm **16 anos de diferença**. Juntar por
  semelhança entregaria a ficha de uma criança para a família de outra.
- **Reconhece por alinhamento de palavras** — primeiro nome igual e cada palavra achando
  a sua, na ordem, com inicial valendo por palavra ("Maria E. Carli" = "Maria Eduarda
  Carli"). É o mesmo alinhamento que casou 189 fichas de 189 sem um falso positivo.
- **Mínimo de DUAS palavras.** Só o primeiro nome não reconhece ninguém: são 20 "Maria" no
  cadastro. Ninguém está cadastrado com uma palavra só, então a régua não exclui ninguém.
- **A prova é a que o dono escolheu:** data de nascimento exata OU nome da mãe — e o
  formulário **já pede as duas coisas**, então não houve tela nova nem pergunta a mais.
- **Simulado no cadastro inteiro antes de escrever a tela:** se as 170 da planilha se
  cadastrassem hoje, **142 seriam reconhecidas na hora** e 28 cairiam na coordenação (são
  as que não têm nem data nem nome de mãe). Dos 21 que já entraram pelo app, **20 passam
  direto e 1 encosta** — a Isabeli, a duplicata de verdade. Zero inocente barrado.
- **Trava quando a prova não bate** (decisão do dono). E travar tem preço: quem é barrado
  sumiria na porta. Por isso a tabela `acolitos_vinculo_tentativas` e a tela **Config ›
  Cadastros barrados**, com três saídas: *ligar* (junta a conta à ficha existente, ação
  nova `vincular` na API de administração), *não é a mesma pessoa* (libera a pessoa para
  se cadastrar normalmente — sem isso ela bateria na mesma parede para sempre) e
  *arquivar*.
- **Freio contra chute:** três erros em 24 horas e a conta para de tentar. Sem isso,
  alguém com o nome de uma criança na mão chutaria datas de nascimento até acertar.
- **A resposta do servidor nunca devolve nome, ficha ou data de ninguém** — só um
  veredito. Quem está se cadastrando ainda não é ninguém no sistema e não pode virar uma
  máquina de descobrir quem existe na pastoral.
- **10 provas próprias**, e cada armadilha da medição virou uma delas.
- **O que NÃO foi feito ainda:** a Parte 2 — gerar em lote os logins das 134 pessoas com
  senha padrão e obrigar a troca no primeiro acesso. O botão "Criar conta" de uma pessoa
  já existe e é o mesmo caminho; falta o lote e a troca obrigatória.

**"Já foi investido?" saiu da planilha e virou campo do app (migration 060)**
- **O que era:** a resposta existia só numa coluna INVESTIDURA de uma planilha de Excel
  que o app não sabia que existia. Ninguém no app conseguia ver, marcar ou contar.
- **A decisão do dono:** só sim/não (sem data), e **o app passa a ser o dono** — a
  planilha vira uma foto tirada dele.
- **A coluna NÃO tem valor padrão, de propósito.** Se nascesse "não", quem nunca
  respondeu ficaria idêntico a quem respondeu que não — e o "Complete seu cadastro" só
  pergunta o que está REALMENTE em branco, então nunca perguntaria isso a ninguém. Em
  branco = "ainda não perguntamos". Foi a mesma armadilha que fez a crisma de 10 pessoas
  parecer respondida quando não era.
- **Permissões medidas ANTES:** a tabela é liberada no nível da tabela (`relacl`), com
  **zero** colunas de permissão própria (`attacl`) — então a coluna nova herda o acesso e
  não derruba linha nenhuma. Provado nos dois lados: um deslogado recebe exatamente o
  mesmo erro de antes, pedindo ou não a coluna nova.
- **Quatro telas, todas no padrão que já existia:** ficha da pessoa (Membros), cadastro
  novo (a própria pessoa responde), "Complete seu cadastro" e Minha Conta — estas duas de
  graça, porque o app tem uma lista central de campos e bastou entrar nela. De brinde, o
  Config passa a poder exigir (ou não) o campo.
- **Conferido que o Salvar realmente grava**, nos dois caminhos: a ficha usa um pacote
  genérico (`fichaEdits`), e o cadastro novo insere o objeto inteiro. Nenhum dos dois tem
  lista de campos escrita à mão — que é o jeito clássico de o campo aparecer na tela e
  não ser salvo.
- **Carga inicial:** 126 investidas, conferidas contra a planilha uma a uma, zero
  divergência. As 19 pessoas que só existem na planilha ficaram de fora, por decisão do
  dono.

**A planilha do cadastro passou a sair do app, formatada (planilha-xlsx.js)**
- Botão novo em Membros › Relatório: **"Planilha do cadastro (Excel)"**, gerada no
  instante do clique a partir do banco. Nunca fica guardada, então nunca está velha.
- **Fechada pela porta que já existia:** a tela de Membros exige a permissão `membros`.
- **Sem biblioteca nova.** A conhecida não escreve cor na versão livre e a que escreve
  pesa 1 MB num app que as pessoas abrem no celular. São 226 linhas que montam o ZIP e os
  XML na mão — cabeçalho grafite, filtro, primeira coluna e cabeçalho congelados, SIM
  verde e NÃO vermelho, datas de verdade.
- **Busca todo mundo, não a lista da tela.** A tela carrega só ativos OU só arquivados; a
  planilha traz também quem está em integração, que de outro jeito sumiria.
- **8 provas próprias**, e elas vigiam exatamente os dois erros que fizeram o Excel
  recusar um arquivo em 26/08: a ORDEM dos elementos dentro da aba e nome de coluna
  repetido na tabela. Um .xlsx malformado não dá erro nenhum em Python nem em JavaScript —
  só aparece como "não foi possível abrir" na mão de quem baixou.

**A ficha de papel entrou no cadastro (853 campos em 138 pessoas)**
- Nome do pai (133), da mãe (137), endereço (133), nascimento (119), batismo (113),
  celular (109), recado (73), primeira eucaristia (29) e crisma (7).
- **Regra do dono para os 53 conflitos:** app vence em nascimento, celular e recado;
  planilha vence no endereço; crisma foi decidida nome a nome. Nada foi sobrescrito fora
  disso.
- Cópia de segurança do cadastro inteiro, como estava antes, em
  `Documentos/iajcbp-entregas/backup-membros-antes-da-carga_*.json`.
- **A primeira conferência acusou 455 alterações fora do plano e era MENTIRA DELA**: a
  segunda leitura do banco não pediu as mesmas colunas da primeira, então quatro campos
  apareciam como apagados para todo mundo. Comparando só as colunas presentes nas duas
  leituras: zero. Amostra tem de ter a forma real da resposta.

---

## Fechados em 20/08/2026

**Config › Atividade: quem está usando o app e quem tem o sino (migration 059)**
- **O pedido do dono:** "uma aba nas config de atividade de usuário, com o último uso de cada
  e se já está com notificação ativada."
- **O caminho óbvio MENTIRIA.** `auth.users.last_sign_in_at` marca a última vez que a pessoa
  DIGITOU A SENHA. Como o app fica logado, quem entrou uma vez em junho e usa todo dia
  continua marcada como junho. Medido antes de escrever a spec: isso valia para **32 das 41
  contas** — a tela teria mentido sobre **78% do grupo**. A Franciele aparecia com "03/06"
  numa tarde em que estava com o app aberto.
- **A fonte certa é `auth.sessions.updated_at`**, que sobe toda vez que o app renova a
  sessão. Conferido nas 6 pessoas que ligaram o sino em 20/08: bate **no minuto** com a hora
  em que cada uma abriu o app. E o histórico já existia — não foi preciso criar coluna nem
  esperar o dado nascer.
- **NÃO usar `auth.sessions.refreshed_at`:** é `timestamp WITHOUT time zone`. Convertê-lo
  para o fuso devolve lixo — deu 6 horas de diferença em todo mundo, igual para todos, que é
  a cara de um erro de fuso e não de um dado estranho.
- **Quatro becos, quatro frases.** "Usou hoje às 15h28" / "Usou há 2 meses · 03/06" / "Sumiu
  faz tempo — entrou pela última vez…" / "Nunca entrou — a conta foi criada… e nunca foi
  usada". Decisão do dono: um traço para todos faria a coordenação tratar igual quem nunca
  abriu o app e quem sumiu depois de usar.
- **135 das 176 pessoas ativas não têm login nenhum**, e isso ganhou destaque no topo em vez
  de rodapé: essas pessoas não é que não usam, é que **não podem** abrir o app. A lista de
  nomes começa fechada, para não empurrar a tela para baixo.
- **O recorte por hoje/semana/mês é feito na TELA, não no banco**, porque depende do fuso de
  quem olha — dívida que este projeto já quitou uma vez.
- **Só superadmin**, pelo mesmo portão da aba Logins (`acolitos_is_superadmin()`). O grant
  não é o portão: **provado rodando** como anônimo (não executa), como cerimoniário (executa
  e recebe `sem_permissao`, sem dado nenhum) e como superadmin (recebe, e os 4 números batem
  com a contagem direta do banco).
- **Falha do banco não vira "ninguém usou"** — tem prova própria. É a cicatriz do 500 que
  virou R$ 0,00 por 17 horas; aqui viraria "o grupo inteiro sumiu", e alguém cobraria 41
  pessoas por causa de uma consulta que não foi.
- **A primeira versão da prova estava ERRADA e passava.** As pessoas de mentira se chamavam
  "Sumiu Faz Tempo" e "Nunca Entrou", e a prova procurava essas frases no texto da tela:
  achava o **nome**, não o estado. Só apareceu porque sabotei os becos de propósito e ela
  continuou verde. Agora mede pela estrutura da linha, e a armadilha está registrada no
  LEIA-ME das provas.
- **Cabe no celular, medido em navegador de verdade com o CSS do app:** a 375px não rola de
  lado, os 6 cartões viram 3+3 e nenhuma linha estoura com o nome mais longo do grupo; no
  desktop os 6 ficam lado a lado. (O Config é só de superadmin e eu não copio a sessão do
  dono — a medição foi num HTML temporário com o mesmo CSS.)
- **Provas:** 104 de tela + 168 de regra + 7 do banco, todas verdes.
- **O retrato de 20/08:** 8 usaram hoje, 13 nesta semana, 8 neste mês, 7 sumiram, 5 nunca
  entraram, 6 com o sino.


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
