# Mapa de Cobertura — módulo Desenvolvimento (Acólitos)

Data: 2026-06-16
Status: aprovado (brainstorming)

## Contexto
Feature nova no app `projetos/acolitos/`, dentro da aba **Desenvolvimento**
(`jornada-admin.html`, função `renderDesenvolvimento(main)`). Hoje o módulo só
mostra cards por liga (Panorama / Funções / Competências), tudo **um membro por
vez** — não existe visão de grupo. Falta responder "onde estamos fracos": quais
funções têm poucos membros prontos, quem está abaixo de Apto, etc. Essa visão
alimenta indiretamente o Gerador de Escala (rodízio "vaga mais escassa primeiro").

A fonte de verdade é a grade de proficiência por função: tabela
`acolitos_habilitacoes (membro_id, funcao, proficiencia)`. Os 5 níveis e suas
cores já existem em `jornada-admin.html`:

- `nao_treinado` — cinza (`var(--border)`) — "Não Treinado"
- `em_formacao` — âmbar `#d4a060` — "Em Formação"
- `apto` — verde (`var(--success)`) — "Apto"
- `experiente` — azul `#4a90c4` — "Experiente"
- `referencia` — roxo `#9b59d4` — "Referência"

`jornada-admin.html` roda como coordenação e já lê `acolitos_membros` e
`acolitos_habilitacoes` direto (sem RPC). Reaproveitamos esse acesso.

Decisões do usuário (brainstorming):
- Formato: **resumo por função (topo) + matriz completa (embaixo, colapsável)**.
- Interação: **edição rápida** — clicar salva direto, mapa é ferramenta de
  trabalho, não só leitura.

## Escopo

### Sem banco novo
Nenhuma migration. A feature só **lê** `acolitos_habilitacoes`/`acolitos_membros`
e **escreve** via `upsert` em `acolitos_habilitacoes` (mesmo
`onConflict: 'membro_id,funcao'` que `abrirFuncoesEditor` já usa hoje em
`jornada-admin.html`). Sem RPC nova.

### Fora de escopo (não fazer agora)
- Notificar o membro (regra do módulo: desenvolvimento não notifica).
- Separar por comunidade (Matriz × Sto. Antônio). Proficiência é global — a
  tabela `acolitos_habilitacoes` não tem coluna de comunidade. Mapa é único.
- Mexer no plano de competências / campo órfão `desenvolvimento_competencias`
  (item "#1" — fica pra outra sessão).
- Export/relatório imprimível (item "#4").

## Dados

Em `carregarDev()` (ou numa carga dedicada chamada por `renderDesenvolvimento`),
adicionar **uma** query que traz todas as habilitações de uma vez:

```js
sb.from('acolitos_habilitacoes').select('membro_id,funcao,proficiencia')
```

Montar em memória, restrito aos membros ativos já em `_devMembros`:

```js
// habAll[membro_id][funcao] = proficiencia
```

Funções consideradas = `_devFuncoes` (já existe: `FUNCOES_DEFAULT_DEV` +
customizadas de `acolitos_listas` tipo `funcao`).

Buckets de proficiência (helper único, reusado por resumo e contagens):
- **prontos** = `apto` | `experiente` | `referencia`
- **formação** = `em_formacao`
- **zero** = `nao_treinado` **ou sem registro** (calculado como
  `total_membros − prontos − formação`, usando `_devMembros.length`).

## Componente 1 — Resumo por função

Uma seção no topo de `renderDesenvolvimento`, **antes** dos cards por liga,
aberta por padrão. Uma linha por função de `_devFuncoes`:

- Label da função.
- Barra empilhada (prontos / formação / zero) usando as cores de proficiência.
- Contagens numéricas: prontos · formação · zero.
- ⚠ de alerta quando `prontos < 3` (limiar fixo nesta versão).
- Ordenação por **escassez**: menos prontos primeiro (funções críticas sobem).

**Clique numa linha** → abre modal `abrirCoberturaFuncao(funcao, label)`:
- Lista os membros separados em "A desenvolver" (`nao_treinado`/`em_formacao`/
  sem registro) e "Prontos" (`apto`+).
- Cada membro tem um `<select>` inline com os 5 níveis; `onchange` faz o
  `upsert` direto e atualiza `habAll` em memória.
- Ao fechar o modal, redesenhar o resumo + a matriz (se aberta) pra refletir
  as contagens novas.

## Componente 2 — Matriz completa

Seção colapsável (fechada por padrão) logo abaixo do resumo. Cabeçalho clicável
"▸/▾ Matriz completa".

- Linhas = membros agrupados por liga (🟢 Iniciantes / 🔵 Acólitos /
  🟣 Cerimoniários) — reusar o agrupamento `LIGAS` já definido em
  `renderDesenvolvimento`.
- Colunas = funções (`_devFuncoes`), rótulo abreviado com `title` (nome
  completo no hover).
- Célula colorida pela proficiência (mesmas cores). Vazio/`nao_treinado` =
  célula neutra.
- Primeira coluna (nome do membro) **fixa** (sticky) + scroll horizontal no
  container da tabela.

**Clique numa célula** → vira um `<select>` inline com os 5 níveis. Ao mudar:
1. `upsert` direto em `acolitos_habilitacoes`.
2. Atualiza `habAll[membro][funcao]` em memória.
3. Recolore a célula e atualiza os números do resumo — **sem recarregar a
   página**.

## Edição rápida (compartilhada)

Helper único `salvarProficiencia(membroId, funcao, nivel)`:
- `upsert({ membro_id, funcao, proficiencia: nivel, updated_at })` com
  `onConflict: 'membro_id,funcao'`.
- Em erro → `toast(...,'error')` e não altera o estado em memória.
- Em sucesso → atualiza `habAll`, dispara recomputo do resumo e (se visível)
  da célula/matriz. `toast('✓ Salvo')`.

Usado tanto pelo modal do resumo quanto pela edição inline da matriz, pra não
duplicar lógica de gravação.

## Fluxo de dados / redesenho

- Carga única no `renderDesenvolvimento` (membros + funções + todas as
  habilitações). Nada de query por célula.
- Estado em memória (`habAll`) é a fonte do desenho; toda edição grava no banco
  **e** atualiza `habAll`, então o recomputo do resumo/matriz é local e
  instantâneo.
- Funções de render isoladas: `renderCobertura(container)` (resumo),
  `renderMatriz(container)` (matriz), `abrirCoberturaFuncao(...)` (modal),
  `salvarProficiencia(...)` (gravação). Cada uma tem propósito único e pode ser
  relida/recolorida sem refazer as outras.

## Erros / bordas
- Sem habilitações no banco → resumo mostra tudo em "zero", matriz toda neutra
  (sem quebrar).
- Membro ativo sem nenhuma linha em `acolitos_habilitacoes` → conta como "zero"
  em todas as funções.
- Função customizada criada depois (em `acolitos_listas`) → aparece
  automaticamente porque vem de `_devFuncoes`.
- Falha de gravação → estado em memória **não** muda (evita mostrar valor que
  não persistiu).

## Validação
Conforme regra do projeto (validar em staging antes do app principal): protótipo
da carga + render numa página temporária `mapa-cobertura-lab.html` em
`projetos/acolitos/`, validar resumo/matriz/edição com dados reais (somente
leitura + edição numa linha descartável), e só então integrar em
`jornada-admin.html`. Remover o lab ao final. Conferir sintaxe dos blocos
`<script>` antes de concluir.
