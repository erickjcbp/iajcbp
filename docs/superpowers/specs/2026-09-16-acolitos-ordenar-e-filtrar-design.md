# Ordenar e filtrar — uma barra só para as listas do app

**Data:** 2026-09-16
**Projeto:** Acólitos (iajcbp)
**Escopo:** Dar a seis telas com lista um jeito de escolher a ordem e filtrar, com a mesma
barra em todas. Pedido do dono: *"preciso que crie classificadores e filtros melhores nas abas,
por exemplo, na aba membros não consigo ver quem entrou por último."*

Decisões do dono, tomadas no brainstorming de 16/09:

1. **As telas são Membros, CRM, Ausências, Chamada, Tarefas e Agenda.** *(o dono marcou as
   quatro famílias oferecidas; "Novos" saiu porque `novos.html` é formulário, não lista)*
2. **Barra fixa com busca + botão "Filtrar (n)", que abre um painel de baixo para cima.** Os
   filtros ligados aparecem como etiquetas com X. *(descartado: tudo aberto no topo da tela, que
   ocupa meio celular; só um menu de ordem, que não cria filtros novos)*
3. **As opções de cada tela** da seção "O que cada tela oferece" — aprovadas com a tabela
   original, e corrigidas depois (ver "Correções depois da aprovação").
4. **A escolha fica lembrada por tela, neste aparelho** — padrão que Membros já usa.

---

## Contexto verificado (16/09/2026)

Números de produção:

- **Membros ativos: 177.** Datas que existem: `created_at` (177 preenchidas), `data_nascimento`,
  `nivel_desde`. **156 dos 177 têm `created_at` = 01/06/2026** — a importação em lote. "Mais
  recentes" mostra bem os ~21 que vieram depois; os 156 empatam.
- **Só 39 dos 177 já entraram no app** (`auth.users.last_sign_in_at` preenchido).
- **Comunidade:** Matriz 166, Santo Antônio 10, outra 1.
- **CRM: 21 linhas** — integrado 17, túnica 3, integração 1. O quadro (`crm.html`) desenha uma
  coluna por etapa e **esconde a última** (`ETAPAS.slice(0,-1)`, linha 246). Hoje há 4 cartões
  no quadro.
- **Ausências avisadas: 1.201.** Motivo: outro **1.037 (86%)**, viagem 130, família 18, doença 16.
- **Marcações de chamada: 985** — presente 603, ausente 357, atrasado 25.
- **Tarefas: 0.** **Eventos: 7** (ensaio 4, outro 2, evento 1).

### Duas listas já escondem resultado hoje

| Lista | Onde | O que carrega |
|---|---|---|
| Avisos de ausência | `ausencias.html:548` | `.order('created_at', desc).limit(60)` — **60 de 1.201** |
| Faltas | RPC `acolitos_faltas_recentes()`, chamada em `ausencias.html:446` | `limit 80`, **sem parâmetro nenhum** |

Um filtro "por pessoa" aplicado na memória só enxergaria essas 60 ou 80. A pessoa com 30
ausências apareceria com 2, e a tela não diria que faltou coisa. É o furo registrado na memória
do projeto como *filtrar depois de paginar*.

### Como cada tela ordena hoje

Nenhuma deixa escolher. Membros está sempre em ordem alfabética (`membros.html:242`), com busca
por nome e botões por nível (linhas 81–96). Membros já guarda busca, filtro e rolagem em
`localStorage['estado-membros']` (linhas 185–205), com `try/catch`.

---

## O desenho

### Três pedaços

**1. `projetos/acolitos/filtro-lista-core.js` — a regra, sem tela.**
Funções puras, testadas por `node --test` como os outros `*-core.js`:

- `estadoInicial(config)` — a ordem padrão da tela, nenhum filtro, busca vazia.
- `aplicar(lista, estado, config)` — filtra e ordena **na memória**. Desempate sempre pelo nome,
  para a ordem não pular entre aberturas.
- `contarLigados(estado)` — o número do botão "Filtrar (n)". A busca não conta: ela já está à
  vista.
- `etiquetas(estado, config)` — o texto das etiquetas com X, na ordem em que foram ligadas.
- `guardar(estado)` / `restaurar(texto, config)` — `restaurar` **descarta** ordem ou opção que
  a tela não oferece mais. Sem isso, uma opção removida numa versão futura deixaria a tela presa
  num filtro invisível que esvazia a lista.

**2. A barra e o painel, no `shared.js`.**
`montarFiltroLista(alvo, config, aoMudar)` desenha:

- a linha fixa: campo de busca (classe `search-input`, a da casa) + botão **Filtrar (n)**;
- embaixo dela, a ordem atual em texto e as etiquetas com X, mais "Limpar" quando houver filtro;
- o painel, no molde dos modais do app (`modal-overlay` + `modal` + `modal-handle`), com
  **Ordenar por** em opções de marcar uma e cada filtro em botões `form-toggle`;
- o botão do fim do painel: **"Ver N itens"**, com N atualizado a cada toque.

Ícones em SVG, não emoji — regra do projeto para a moldura da tela.

**3. O contrato de cada tela.** A tela só descreve:

```js
{
  chave: 'membros',                       // onde guardar a escolha
  rotulo: 'membros',                      // "Ver 37 membros"
  ordens: [ { id: 'recentes', nome: 'Mais recentes', campo: 'created_at', desc: true, mostra: 'cadastro' }, ... ],
  ordemPadrao: 'nome',
  filtros: [ { id: 'nivel', nome: 'Nível', opcoes: [ { id: 'acolito', nome: 'Acólito', testa: m => ... } ] }, ... ],
  busca: { placeholder: 'Buscar nome...', campos: m => [m.nome, m.apelido] },  // opcional
  onde: 'memoria' | 'consulta',
}
```

O campo de busca só aparece quando a tela declara `busca`. As listas `consulta` **não
declaram**: a tabela de ausências guarda `membro_id`, não o nome, e uma busca livre ali exigiria
juntar tabelas na consulta. O filtro **Pessoa** faz esse papel.

### Onde o filtro age — a regra que evita o furo

A barra **não decide sozinha**. Cada tela declara `onde`:

- **`memoria`** — a tela já carregou a lista inteira (Membros, CRM, Chamada, Tarefas, Agenda).
  `aplicar()` filtra e ordena; "Ver N" é o tamanho do resultado.
- **`consulta`** — a lista vem do banco em pedaços (Avisos de ausência, Faltas). `aoMudar`
  recebe o estado e **a tela refaz a consulta** com o filtro dentro dela. O "Ver N" vem do banco:
  `select(..., { count: 'exact', head: true })` com os mesmos filtros.

**Falha nunca vira zero.** Se a consulta ou a contagem der erro, a tela mostra o estado de erro
no mesmo molde do `renderErroCarga` da Caixa (`caixa.html:409`, que é local àquela tela — a
barra ganha o seu, no `shared.js`), nunca "nenhum resultado" nem "Ver 0". Memória do
projeto: *falha que vira número*.

### A Faltas precisa aprender a receber filtro

`acolitos_faltas_recentes()` não tem parâmetro. Migration **069** cria
`acolitos_faltas_recentes(p_membro uuid default null, p_desde date default null, p_ate date default null, p_limite int default 80)`
como **nova assinatura**, mantendo a de hoje funcionando até a tela trocar. A trava, o
`security definer`, o `search_path` e os `grant` são copiados da função atual — conferidos contra
ela antes de aplicar, não escritos de memória. Prova em `docs/provas/provar-069-faltas-filtram.sql`,
com a mesma forma da 067.

A contagem da aba Faltas vem de `acolitos_faltas_contar(p_membro, p_desde, p_ate)`, na mesma
migration.

### Membros, o exemplo do dono

- **"Mais recentes"** ordena por `created_at` decrescente e **mostra a data embaixo do nome**
  ("cadastro 27/08"). Os 156 de 01/06 desempatam por nome.
- Quando a ordem é por aniversário, mostra o dia ("faz 14 anos em 22/09").
- O filtro **App** usa `last_sign_in_at`, que mora em `auth.users` e **não chega pela tabela**.
  Ele vem por uma função do banco que devolve só `membro_id` + "já entrou" (sem e-mail, sem data
  exata), restrita à coordenação. É a migration **068**, que sai **junto com o passo 1** — o
  filtro App não pode chegar antes da função que o alimenta. Prova em
  `docs/provas/provar-068-quem-ja-entrou.sql`.
- Os botões de nível que existem hoje (linhas 91–96) **passam para dentro do painel** como o
  filtro "Nível". O que estava guardado em `estado-membros.filtro` é lido uma vez e convertido,
  para ninguém abrir a tela e perder o filtro que tinha.

---

## O que cada tela oferece

| Tela | `onde` | Ordenar por (**padrão** em negrito) | Filtrar por |
|---|---|---|---|
| **Membros** | memória | Mais recentes · **Nome A–Z** · Aniversário do mês · Nível | Nível · Comunidade · App (já entrou / nunca entrou) · Foto (com / sem) |
| **CRM** | memória | **Há mais tempo parado na etapa** · Mais recentes · Nome | — *(só busca e ordem; ver correções)* |
| **Ausências › Avisos** | consulta | **Data da missa** · Quando avisou | Pessoa · Período · Comunidade · Motivo *(por último)* |
| **Ausências › Faltas** | consulta | **Data da missa** | Pessoa · Período |
| **Chamada** | memória | Escolher a missa: **Data**. Na missa: **Função** · Nome | Escolher a missa: Comunidade. Na missa: Ainda sem marcar |
| **Tarefas** | memória | **Prazo mais perto** · Mais recentes | Time · Responsável · Situação (aberta / em andamento / concluída) |
| **Agenda** | memória | **Data** | Tipo (Ensaio · Evento · Outro · Missa) · Comunidade |

**Período** oferece: este mês · mês passado · últimos 90 dias · tudo.

**Pessoa** é um campo com busca dentro do painel (a lista de 177 nomes não cabe em botões).
Segue o molde do seletor com busca do "Enviar aviso" (`avisarTodos`, no `shared.js`). Hoje
aquele seletor está escrito dentro da função e não é reaproveitável; ele sai para uma função
própria, e o "Enviar aviso" passa a usá-la — sem mudar o que ele faz, com a prova 067 de tela
conferindo.

### Correções depois da aprovação

A tabela aprovada tinha dois erros meus, achados ao conferir cada tela no código:

1. **CRM sem filtro por etapa.** O quadro já separa por etapa em colunas; filtrar por etapa
   repetiria as colunas. A ordem vale **dentro de cada coluna**.
2. **Chamada não tem histórico.** A tela escolhe uma missa (de 2 dias atrás a 7 dias à frente,
   `chamada.html:124-130`) e marca presença. As 985 marcações não aparecem nela. O filtro por
   resultado e por pessoa **foi para a aba Faltas**, que é onde o histórico mora.

---

## Testes

- **`filtro-lista-core.test.js`** — ordem com desempate, cada tipo de filtro, filtros combinados,
  busca sem acento, contagem, etiquetas, e `restaurar` com opção que deixou de existir.
- **Prova de tela por tela**, no `telas.prova.mjs`: a barra aparece, o painel abre, ligar um
  filtro muda a lista e o número do botão, "Limpar" volta ao padrão, e a escolha sobrevive a
  reabrir a tela.
- **Prova contra o furo**, uma para cada lista `consulta`: com as chamadas ao banco trocadas por
  gravadores, ligar "Pessoa" tem de **mudar a consulta** (não filtrar o que já veio), e erro na
  contagem tem de mostrar erro, não "Ver 0".
- **Prova do Membros com o dado real**: "Mais recentes" põe no topo os cadastrados depois de
  01/06, e os 156 do lote em ordem alfabética.
- **`provar-068`** — a função "já entrou no app" devolve 39 hoje e **não expõe e-mail nem
  data**; quem não é coordenação é recusado; `anon` não executa.
- **`provar-069`** — a Faltas filtrada por pessoa devolve todas as dela, não só as que caberiam
  nas 80; a contagem bate com a lista; a assinatura antiga continua respondendo igual; quem não é
  coordenação é recusado nas duas funções; `anon` não executa; nada fica gravado.

A suíte tem de subir de tamanho, não só ficar verde: memória do projeto registra uma suíte que
encolheu em silêncio.

---

## Ordem de entrega

1. **Core + barra + migration 068 + Membros** — é o pedido do dono e prova a peça numa lista
   pequena.
2. **Agenda** e **CRM** — listas pequenas, cada uma com uma particularidade (missa e evento
   misturados; ordem dentro de coluna).
3. **Chamada** — duas listas na mesma tela.
4. **Migration 069 + Ausências** (Avisos e Faltas) — a parte com consulta ao banco, e a de maior
   risco. Vem depois de a peça estar provada nas telas simples.
5. **Tarefas** — por último, porque hoje tem 0 tarefas: a prova usa dado de mentira.

Cada passo é publicável sozinho.

---

## Fora do escopo

- Filtros nas telas não pedidas (Escala, Config, Casas, Missões, Destaques).
- Guardar a escolha na conta da pessoa, para seguir entre aparelhos.
- Exportar a lista filtrada.
- Mudar o que cada cartão mostra, além da data na ordem por data.
