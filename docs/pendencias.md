# Acólitos — o que está pendente

Atualizado em 19/08/2026. Esta é A LISTA: abrir aqui antes de decidir o que fazer.
Quando algo sair daqui, sai porque foi feito **e conferido**, não porque foi commitado.

---

## 1. Pendente

**Provar o portão de notificações no app de verdade** (feito em 19/08/2026, ainda **não**
deployado). O portão obriga a ligar o sino para usar o app — mas ele mora dentro do
`initModulo`, e o verificador de telas troca o `initModulo` por um falso. Ou seja: a parede
e a regra estão provadas; **que o boot chama o portão antes de liberar a tela, não**. Isso
só se vê no ar, com conta de verdade. Antes de mandar para as 47 pessoas, abrir com uma
conta real e conferir três coisas: (1) sem o sino, a parede aparece e a tela não carrega
atrás; (2) ativando, o app recarrega e entra; (3) quem já tem o sino ligado **não** vê
parede nenhuma — um falso positivo aqui tranca todo mundo de uma vez.

**O que esperar quando subir:** hoje só **1 aparelho** dos 47 com conta está inscrito. Os
outros 46 vão bater na parede na primeira abertura. Quem tocar em "Não Permitir" na caixinha
do sistema não entra mais até religar nos Ajustes — a parede ensina o caminho, mas vai gerar
ligação para a coordenação. É consequência conhecida e aceita, não surpresa.

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
