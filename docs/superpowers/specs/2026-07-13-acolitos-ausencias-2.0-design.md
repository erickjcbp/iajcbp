# Spec A — Ausências 2.0 (página pública /ausencias)

**Data:** 2026-07-13
**Projeto:** Acólitos (iajcbp)
**Escopo:** Melhorar a página pública de informar ausências: consertar a seleção de nome (dor principal), adicionar tutorial guiado, e permitir selecionar celebrações em massa (semana/mês inteiro) dentro da janela de 90 dias.

Faz parte de um fatiamento maior (3 specs): **A — Ausências 2.0** (esta), **B — Auto-troca no gerador**, **C — "Escala eu" + Central do Servo + Caixa de aprovações unificada**.

---

## Contexto atual

Página pública `coroinhas.jcbplimeira.com/ausencias` → arquivo `projetos/acolitos/ausencias-publica.html` (standalone, anon key, SEM shared.js). Fluxo num formulário único de uma tela:

1. Busca nome (input) → dropdown de resultados → clicar vira chip (multi-seleção).
2. Lista de celebrações (checkboxes) — janela `current_date .. +3 meses`.
3. informante / motivo / contato (obrigatórios).
4. Botão "Enviar aviso".

Back-end (RPCs `security definer`, migration `db/seguranca/006_ausencias_publica_celebracoes.sql`):
- `acolitos_ausencia_publica_buscar(p_q)` — só id+nome, ≥2 letras.
- `acolitos_ausencia_publica_celebracoes()` — celebrações futuras até +3 meses (id/data/horario/comunidade).
- `acolitos_ausencia_publica_enviar(p_membros, p_celebracoes, p_motivo, p_informante, p_contato)` — grava na fila `acolitos_ausencias_pendentes`. **Cap atual: 20 membros × 30 celebrações.**

**Problema relatado:** a seleção de nome confunde ("não fica claro onde/como selecionar o nome"); falta orientação passo-a-passo até o Enviar; não dá pra marcar semanas/meses inteiros de uma vez.

---

## Design

### 1. Conserto da seleção de nome (prioridade)

Sintoma: o usuário não entende que precisa **tocar num nome da lista** de resultados, nem que dá pra adicionar **vários**.

Mudanças no `ausencias-publica.html`:

- **Indicador visual apontando pro campo de busca.** Um coach-mark (balão "👆 Comece aqui: digite o nome do coroinha") ancorado ao input `#busca`, que **permanece visível até a 1ª pessoa ser adicionada** (`selMembros.size === 0`). Some assim que houver ≥1 chip. Garante que ninguém se perca no começo.
- **Lista de resultados com afordância clara de toque.** Cada item de `#results` passa a mostrar: inicial/avatar do nome + nome + um ícone `+` à direita. Um cabeçalho de ajuda dentro do dropdown: *"toque no nome para adicionar"*.
- **Feedback ao adicionar.** Após o 1º toque, mensagem curta e temporária: *"Adicionou! Pode buscar e adicionar mais de um."* (some sozinha após alguns segundos ou ao próximo input). Deixa explícita a multi-seleção.
- **Chips mais evidentes.** Chip do selecionado com inicial/avatar + nome + × (já existe o ×; reforçar o visual). Mantém o comportamento de remover ao tocar no ×.

Sem mudança de back-end aqui (só front).

### 2. Tutorial guiado (coach-marks)

- Overlay de balões numerados na 1ª visita, em sequência:
  **① nome → ② celebrações (destaca "marcar mês") → ③ seus dados → ④ Enviar.**
- Botão discreto **"❔ Ver tutorial"** no topo do card, reabre o tour a qualquer momento.
- Persiste em `localStorage` (chave ex.: `aus_tutorial_visto`) que já foi visto → não repete automaticamente, mas continua reabrível pelo botão.
- Implementação self-contained (sem libs externas — a página não pode depender de CDN; regra do projeto). Balões posicionados via JS relativo aos elementos-alvo, com backdrop escurecido e "Próximo/Pular".
- Responsivo/mobile-first (é o uso real). Não estourar a tela no celular.

### 3. Celebrações: 90 dias + seleção em massa

- **Janela de 90 dias já existe** no back-end (`+3 months`). Se a lista parece curta, é por falta de celebrações **cadastradas** tão à frente (dado, não código). Não muda a janela.
- **Agrupamento por mês/semana** na renderização (`carregarCelebracoes` reescrita):
  - Cabeçalho por **mês** ("Agosto 2026") com botão **"✓ marcar mês"** (marca/desmarca todas as celebrações do mês).
  - Sub-blocos por **semana** ("Semana 3–9") com botão **"✓ marcar semana"**.
  - Itens individuais continuam com checkbox (comportamento atual do toque).
  - Agrupamento calculado no front a partir do array de celebrações já retornado (ordenado por data/horario). Semana = agrupamento por semana ISO (segunda a domingo) ou por semana do calendário local — usar semana começando no domingo, consistente com o resto do app (DIAS array começa em Dom).
  - "Marcar mês/semana" é toggle: se todas do grupo já estão marcadas, o botão desmarca todas.
  - Contador `#cels-meta` ("N celebração(ões) selecionada(s)") mantido.

- **Back-end — subir o cap de celebrações no envio.** Marcar "mês inteiro" pode passar de 30. Alterar `acolitos_ausencia_publica_enviar` para permitir mais celebrações por envio (ex.: **120**). Nova migration em `db/seguranca/` (ex.: `008_ausencias_publica_cap.sql`), mantendo toda a validação de segurança existente (ativos, data >= current_date, dedupe, membros ≤ 20). Regravar o grant.

### 4. Fora de escopo (não muda nesta spec)

- Continua público, sem login, mesma RPC de segurança e mesma fila de aprovação interna (`ausencias.html`).
- informante/motivo/contato continuam obrigatórios (front + servidor).
- Nenhum módulo novo (isso é a Spec C).
- Auto-troca no gerador ao aprovar ausência (isso é a Spec B).

---

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `projetos/acolitos/ausencias-publica.html` | Conserto da seleção de nome; coach-marks/tutorial; agrupamento por mês/semana com "marcar mês/semana"; botão "Ver tutorial". |
| `db/seguranca/008_ausencias_publica_cap.sql` (novo) | Subir cap de celebrações por envio (30 → 120) em `acolitos_ausencia_publica_enviar`, mantendo validações e grant. |

## Critérios de aceite

1. Ao abrir /ausencias pela 1ª vez, um indicador aponta claramente para o campo de nome e só some após adicionar a 1ª pessoa.
2. A lista de resultados deixa óbvio que se toca num nome para adicionar, e que dá pra adicionar vários.
3. Existe um tutorial guiado reabrível pelo botão "Ver tutorial", cobrindo do nome até o Enviar.
4. As celebrações aparecem agrupadas por mês (e semana), com botões "marcar mês" e "marcar semana" que marcam/desmarcam o grupo inteiro.
5. É possível enviar uma ausência marcando um mês inteiro (>30 celebrações) sem erro de "muitos_itens" até o novo limite.
6. Toda a UI é responsiva e não estoura a tela no celular.
7. Segurança inalterada: sem login, mesmas RPCs, obrigatoriedade de informante/motivo/contato, dedupe na fila.

## Notas de implementação

- Página é **standalone** (sem shared.js, padrão login.html). Todo CSS/JS inline, sem dependência de CDN externo (redes de operadora bloqueiam — já houve tela travada por isso).
- Deploy: **só local por enquanto** (dono pediu). Migration nova aplicada via MCP Supabase quando for a hora; não fazer push/deploy sem pedido.
- Ao aplicar migration: `get`/inspecionar antes; token do MCP Supabase pode expirar e derrubar WRITES (reautorizar via /mcp).
