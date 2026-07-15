# Spec C — Central do Servo + "Escala eu" + Caixa de Aprovações unificada

**Data:** 2026-07-15
**Projeto:** Acólitos (iajcbp)
**Escopo:** Fechar o autoatendimento do membro na escala (pedir troca / candidatar-se a vaga), transformar a home do membro numa Central do Servo que sinaliza o que precisa de resposta, e unificar todas as pendências da coordenação numa Caixa de Aprovações reestruturada.

Terceira e última fatia do trio de Ausências: **A — Ausências 2.0** (no ar), **B — Auto-troca no gerador** (no ar), **C — esta**. Decisão do dono: as três partes da Spec C vão **numa spec só**, mas com módulos internos bem separados.

---

## Contexto atual

- **Home do membro** (`index.html` → `renderDashboardMembro`): saudação (avatar/nome/nível/comunidade), **jornada/nível animado** + trilha de 10 níveis, KPIs (frequência % / missas servidas / última missa), **Minhas Próximas Escalas** (3 próximas, com um botão "Ausência" que só linka a página pública) e Agenda da Pastoral.
- **Escala do membro** (`escalas-membro.html`): tela "Escalas", lista **todas** as celebrações futuras/históricas com quem está escalado (read-only). Cerimoniário ganha botão de Chamada. Não é personalizada por "mim" e não tem ações.
- **Aprovações hoje, espalhadas:**
  - `ausencias.html` — fila de ausências pendentes (`acolitos_ausencia_pendente_listar` / `acolitos_ausencia_pendente_decidir`), com "Aprovar todas" e **auto-troca ao aprovar** (motor `GeradorSubstituto` da Spec B).
  - `crm.html` — novos cadastros aguardando aprovação (etapa `aprovacao_cadastro`), vindos de `novos.html`.
- **Não existe** hoje o membro logado pedir troca, dizer que não pode, ou se candidatar a vaga de dentro do app. A única via de "não posso" é a página pública anônima `/ausencias`.
- **Peças reutilizáveis já no repo:**
  - `acolitos_modelos` — vagas por função por tipo+comunidade (fonte de "vaga aberta").
  - RPCs atômicas `acolitos_aplicar_troca_escala` / `acolitos_desfazer_troca_escala` (migration `009`) — cobrem cerimoniário; usadas para efetivar a troca de vaga.
  - `acolitos_ausencia_pendente_listar` / `_decidir` — listagem/decisão de ausências.
  - Fila de notificações in-app do `shared.js`.

---

## Princípio de arquitetura da informação

Cada informação tem **um único lar**. Nada de status/ação repetido em duas telas.

- **Home (Central do Servo) = relance + sinalização.** Mostra o estado (jornada/nível/KPIs) e **avisa** o que precisa da minha resposta, mas **não age** em nada — todo botão de ação leva pra Escala eu.
- **Escala eu = o único lugar onde o membro age e acompanha.** Minhas missas (com ação), vagas, meus pedidos, convites recebidos — tudo aqui, uma vez só.
- **Caixa de Aprovações = o único lugar onde a coordenação decide.** Agrega todas as pendências. A home da coordenação só sinaliza e leva pra lá.

---

## Design

### Módulo 1 — Membro: "Escala eu" (evolui `escalas-membro.html`)

A tela "Escalas" ganha um seletor no topo:

- **[ Minhas ]** — nova visão pessoal, com ações.
- **[ Todas ]** — exatamente a tela read-only de hoje, **intacta** (browse de todas as celebrações).

Dentro de **Minhas**, três sub-abas:

**1. Minhas missas** — todas as minhas escalas futuras (não só 3), agrupadas por semana + histórico. Cada card mostra data/horário/comunidade + minha função. Ação única por card:

- **`[ ⚠ Pedir troca ]`** — botão com peso visual de alerta (vermelho/âmbar). Ao tocar, abre confirmação obrigatória:
  > ⚠ Tem certeza que não poderá cumprir esta escala?
  > Servir é um compromisso. Só peça troca se realmente não puder.
  > `[ Voltar ]` `[ Sim, pedir troca ]`

  Confirmando, escolho **com quem** trocar:
  - **um colega** da lista (habilitado na função) → convite direcionado; ou
  - **"não sei quem chamar"** → vai direto pra coordenação cobrir (auto-troca).

  Não existe botão "Não posso" solto: sair da vaga **exige** um caminho de troca com guarda (decisão do dono — evita furar a escala num toque).

**2. Vagas** — celebrações futuras com **vaga aberta na minha função** (calculado: `acolitos_modelos` esperado − escalas preenchidas, filtrado pelas minhas habilitações). Cada uma com **`[ Me candidatar ]`** → cria candidatura para a coordenação decidir.

**3. Meus pedidos** — lista completa das minhas solicitações (troca / candidatura) com **status** e histórico; **`[ Cancelar ]`** enquanto pendente. Aqui também vivem os **convites de troca recebidos** de colegas: **`[ Recusar ]` `[ Aceitar ]`** (accept/reject mora **só aqui**).

### Módulo 2 — Membro: Central do Servo (evolui `renderDashboardMembro`)

Mantém tudo que já existe (jornada/nível, KPIs, agenda). Muda pouco, de propósito:

- **Aviso clicável** — quando há algo que exige minha resposta (convite de troca pendente), um bloco de destaque: *"⚡ Você tem N convite(s) de troca pra responder"* com **`[ Ver na escala → ]`** que abre Escala eu › Meus pedidos. Some quando não há nada.
- **Minhas Próximas Escalas (3)** — continua como relance, **sem botões de ação**; tocar leva à Escala eu. (O antigo botão "Ausência" que linkava a página pública é removido.)

A home não contém accept/reject nem status detalhado — isso é da Escala eu.

### Módulo 3 — Coordenação: Caixa de Aprovações (reestrutura `ausencias.html`)

`ausencias.html` é **reestruturado** (layout e hierarquia, não só empilhar) numa **Caixa de Aprovações** unificada. É um **agregador de fontes**: cada tipo de pendência é uma fonte que entrega *(contagem, lista, ação de decidir)*, e a Caixa soma todas, agrupadas com contador e ação em lote quando fizer sentido. Novos tipos plugam sem reescrever a Caixa.

Fontes na v1 (as 5 confirmadas):

| Grupo | Origem | Ação |
|---|---|---|
| ✋ **Ausências** | `acolitos_ausencias_pendentes` (existente) | Aprovar/Rejeitar (+ auto-troca ao aprovar, comportamento atual) |
| 🔄 **Trocas aguardando homologação** | `acolitos_solicitacoes` tipo=troca, status=aguardando_coordenacao (colega já aceitou) | Homologar (efetiva a troca) / Negar |
| 🙋 **Candidaturas a vaga** | `acolitos_solicitacoes` tipo=candidatura, status=aguardando_coordenacao | Aprovar (escala o membro) / Negar |
| 🛟 **Cobrir / auto-troca** | `acolitos_solicitacoes` tipo=troca, status=aguardando_cobertura | Rodar auto-troca → Confirmar sugestão / trocar sugestão / Negar |
| 🆕 **Novos cadastros** | CRM etapa=`aprovacao_cadastro` (existente) | Aprovar (avança etapa) / Rejeitar |

Na home da coordenação (`renderDashboardEquipe`), um **badge/aviso** no topo: *"⚡ N pendências aguardando você"* com atalho pra Caixa. A home sinaliza; a Caixa decide.

---

## Fluxos (máquina de estados)

**Solicitação de troca** (`tipo=troca`):

```
Pedir troca → confirmação → escolhe alvo
  ├─ colega escolhido ....... status=aguardando_colega, alvo_membro_id=colega
  │     ├─ colega Aceita ..... status=aguardando_coordenacao → Caixa(Trocas)
  │     │      ├─ Homologa .... status=homologado  (colega assume a vaga via acolitos_aplicar_troca_escala)
  │     │      └─ Nega ........ status=negado
  │     └─ colega Recusa ...... status=recusado_colega
  │            membro escolhe:  (a) reenvia p/ outro colega (nova solicitação)
  │                              (b) escala p/ cobertura → status=aguardando_cobertura
  └─ "não sei quem" ......... status=aguardando_cobertura → Caixa(Cobrir)
         coordenação roda auto-troca (motor Spec B) → sugestão
              ├─ Confirma ..... status=coberto (substituto assume a vaga)
              └─ Nega ......... status=negado
```

**Candidatura a vaga** (`tipo=candidatura`):
```
Me candidatar → status=aguardando_coordenacao → Caixa(Candidaturas)
   ├─ Aprova → status=aprovado (membro entra na escala daquela função/celebração)
   └─ Nega   → status=negado
```

**Cancelamento:** o membro pode cancelar a própria solicitação enquanto `status` estiver em qualquer estado pendente (`aguardando_colega` / `aguardando_coordenacao` / `aguardando_cobertura` / `recusado_colega`) → `status=cancelado`.

**Ausências** e **novos cadastros** mantêm a máquina de estados existente; a Caixa só agrega e chama as RPCs/lógicas que já existem.

---

## Modelo de dados

**Nova tabela `acolitos_solicitacoes`:**

| Coluna | Tipo | Nota |
|---|---|---|
| `id` | uuid pk | |
| `membro_id` | uuid → acolitos_membros | quem solicitou |
| `celebracao_id` | uuid → acolitos_celebracoes | |
| `escala_id` | uuid → acolitos_escalas (nulo em candidatura, se a vaga ainda não é uma linha) | vaga de origem |
| `funcao` | text | função da vaga |
| `tipo` | text | `troca` \| `candidatura` |
| `alvo_membro_id` | uuid → acolitos_membros (nulo) | colega convidado (só troca com colega) |
| `status` | text | máquina de estados acima |
| `motivo` | text (nulo) | |
| `criado_em` / `atualizado_em` | timestamptz | |
| `decidido_por` | uuid (nulo) | quem homologou/negou |
| `resultado_escala_id` | uuid (nulo) | linha de escala resultante (troca/candidatura efetivada) — permite desfazer |

- **RLS**: membro lê/escreve as **próprias** solicitações e as **direcionadas a ele** (`alvo_membro_id = meu membro`). Coordenação (EQUIPE_ROLES/cerimonário, como no `ausencias.html`) lê todas as pendentes e decide. Acesso via RPCs security-definer (padrão do módulo — cerimoniário não lê membros direto por RLS; ver migration 042 do roster).

**Reuso sem duplicar:** ausências continuam em `acolitos_ausencias_pendentes`; novos cadastros continuam no CRM. A Caixa lê essas fontes como estão.

**RPCs novas (security definer, `revoke from public` + `grant to authenticated`):**

- `acolitos_solicitar_troca(p_escala_id, p_alvo_membro_id, p_motivo)` — membro, self-gated. Cria troca (`aguardando_colega` se alvo; `aguardando_cobertura` se nulo).
- `acolitos_candidatar_vaga(p_celebracao_id, p_funcao, p_motivo)` — membro, self-gated; valida habilitação e que a vaga está aberta.
- `acolitos_troca_responder(p_solicitacao_id, p_aceita bool)` — só o `alvo_membro_id`; aceita → `aguardando_coordenacao`; recusa → `recusado_colega`.
- `acolitos_solicitacao_cancelar(p_solicitacao_id)` — só o dono, se pendente → `cancelado`.
- `acolitos_solicitacao_reenviar(p_solicitacao_id, p_novo_alvo | null)` — dono reenvia a outro colega ou manda pra cobertura.
- `acolitos_solicitacoes_membro()` — lista meus pedidos + convites direcionados a mim (alimenta Escala eu › Meus pedidos e o badge da home).
- `acolitos_vagas_abertas_membro()` — vagas nas minhas funções (modelos − preenchidas), janela futura.
- `acolitos_solicitacoes_pendentes()` — agrega pendências p/ a Caixa (todas as fontes ou por tipo), gate coordenação.
- `acolitos_solicitacao_decidir(p_solicitacao_id, p_acao, p_substituto_id | null)` — coordenação homologa/nega/confirma-cobertura/aprova-candidatura; grava `resultado_escala_id`. A mutação de escala depende do tipo: **troca/cobrir** reusam `acolitos_aplicar_troca_escala` (troca a vaga, cobre cerimoniário); **candidatura** faz *insert* de novo escalado (o membro entra numa vaga aberta, sem substituir ninguém).

---

## Notificações (leve, in-app)

Reusa a fila do `shared.js` (sem push). Eventos que geram aviso in-app:
- Recebi um **convite de troca** (para o `alvo_membro_id`).
- Meu pedido foi **aprovado/homologado** ou **negado/recusado**.
- Um colega **aceitou** minha troca (aguardando coordenação).

Sem notificação por WhatsApp/e-mail nesta spec.

---

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `projetos/acolitos/escalas-membro.html` | Seletor Minhas/Todas; sub-abas Minhas missas / Vagas / Meus pedidos; ações Pedir troca (alerta + confirmação), Me candidatar, Aceitar/Recusar convite, Cancelar. "Todas" preservada. |
| `projetos/acolitos/index.html` | `renderDashboardMembro`: aviso clicável de convites + remover botão "Ausência" das próximas escalas (vira relance sem ação). `renderDashboardEquipe`: badge "N pendências" → Caixa. |
| `projetos/acolitos/ausencias.html` | Reestruturado em **Caixa de Aprovações** (agregador de 5 fontes, hierarquia/layout novos); mantém ausências + auto-troca; soma trocas, candidaturas, cobrir, novos cadastros. |
| `projetos/acolitos/shared.js` | Helpers de solicitação (chamadas RPC), avisos in-app dos novos eventos, rótulos de status/função reusados. |
| `db/seguranca/011_solicitacoes.sql` (novo) | Tabela `acolitos_solicitacoes` + RLS + RPCs security-definer + grants. |

---

## Critérios de aceite

1. Na Escala eu › Minhas missas, cada missa minha tem **Pedir troca** (visual de alerta) que **exige** uma confirmação "tem certeza que não poderá cumprir?" antes de prosseguir; não existe atalho "Não posso" que me tire da vaga sem troca.
2. Ao pedir troca posso escolher um colega habilitado **ou** "não sei quem"; escolhendo colega, ele precisa **Aceitar** e só então a coordenação **Homologa** para a troca valer.
3. Se o colega **Recusa**, sou avisado e posso **reenviar a outro colega** ou **mandar pra coordenação cobrir** (auto-troca da Spec B).
4. Em Vagas vejo missas com vaga aberta **na minha função** e consigo **me candidatar**; a candidatura aparece pra coordenação decidir.
5. Em Meus pedidos vejo status de tudo que pedi, **cancelo** pendências, e **aceito/recuso** convites recebidos — e isso não se repete em nenhuma outra tela.
6. A Home do membro **mantém** jornada/nível/KPIs/agenda, **avisa** quando há convite pra responder (levando à Escala eu) e **não tem** botões de ação nas próximas escalas.
7. A Caixa de Aprovações mostra, agrupadas com contador, as **5 fontes** (ausências, trocas, candidaturas, cobrir, novos cadastros), cada uma com sua decisão; ausências mantêm o comportamento atual (Aprovar todas + auto-troca).
8. Homologar/aprovar/confirmar **efetiva a mutação da escala** de forma atômica: troca/cobrir via `acolitos_aplicar_troca_escala` (cobre cerimoniário); candidatura via *insert* do novo escalado na vaga aberta.
9. Segurança: membro só mexe nas próprias solicitações e nos convites direcionados a ele (RLS + RPCs self-gated); coordenação decide via gate existente; render XSS-safe (textContent).
10. Toda a UI é responsiva (mobile-first) e não estoura no celular.

---

## Fora de escopo (YAGNI)

- Push/WhatsApp/e-mail (só aviso in-app).
- Trocas recorrentes ou em lote (uma missa por pedido).
- Candidatura fora das minhas habilitações.
- Mudar o CRM ou a Tesouraria além de a Caixa *ler* a fonte de novos cadastros.
- Aposentar o `escalas-membro.html` "Todas" ou a página pública `/ausencias` — ambas continuam.

---

## Notas de implementação

- Fatiar internamente: (i) tabela + RPCs (`011`), (ii) Escala eu, (iii) Central do Servo (home), (iv) Caixa. Cada uma testável com login coord de teste (ver conta bot-teste) usando celebração/membro **descartável**.
- **Reusar** o motor `GeradorSubstituto` da Spec B na cobertura; não reescrever lógica de auto-troca.
- **Vagas abertas** dependem de `acolitos_modelos` estar preenchido pro tipo/comunidade; onde não há modelo, não inventar vaga.
- Deploy: **só quando o dono pedir**; migration aplicada via MCP Supabase (inspecionar antes; token do MCP pode expirar e derrubar writes — reautorizar via /mcp).
- Sem dependência de CDN externo nas telas (regra do projeto).
- Todo submódulo/ação nova nasce respeitando o gate existente (Escala eu = base/self; Caixa = coordenação), sem abrir permissão a mais sem querer.
