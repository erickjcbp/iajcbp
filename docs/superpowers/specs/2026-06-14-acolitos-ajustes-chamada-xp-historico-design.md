# Ajustes Acólitos — Substituto/XP, Chamada, Histórico, Habilitação, Notificação

Data: 2026-06-14
Status: aprovado (brainstorming)

## Contexto
Pacote de 7 ajustes no app `projetos/acolitos/`. Parte mexe no motor de
XP/missões, que vive em RPCs/views SECURITY DEFINER no Supabase
(ref `fttjgsotuosjfrasttds`), não versionado no repo. Toda alteração de
banco será aplicada via Supabase MCP e versionada numa migration nova
(`docs/migrations/`, próximo número após 011 local — confirmar nº real no
banco via `acolitos_*` / schema_migrations; F1 das missões já reservava 043).

Decisões do usuário:
- Substituto: conta missa servida **E** ganha +10 XP ("os dois").
- Chamada desmarcada: **bloqueia** o registro até todos marcados.
- Notificação diária de XP: **só se o membro não ganhou XP no dia**.
- Executar tudo nesta sessão.

## Itens

### 1. Substituto ganha XP + conta missa servida (+ retroativo)
Hoje (chamada.html `confirmarChamada`, ~l.350-385): ao marcar ausente com
substituto, só a linha do ausente vira `status='substituido'` + `substituto_id`.
O substituto não recebe escala → não conta em `acolitos_frequencia.servidas`
(`status in ('presente','atrasado')`) nem ganha XP.

Solução:
- **Coluna** `origem text default 'escala'` em `acolitos_escalas` (marca
  linhas criadas por substituição: `'substituicao'`).
- **RPC** `acolitos_substituto_creditar(p_celebracao uuid, p_funcao text,
  p_substituto uuid, p_ausente_escala uuid)` SECURITY DEFINER:
  1. upsert linha de escala do substituto (celebracao, membro=substituto,
     funcao, `status='presente'`, `origem='substituicao'`), idempotente por
     `(celebracao_id, membro_id, funcao)`;
  2. concede +10 XP reusando o mesmo motor interno do `acolitos_avulso_add`
     (inspecionar o corpo real antes), com aviso `xp_ganho`;
  3. não credita XP 2x (guarda por existência da linha/origem).
  Permissão: mesma trava do roster (cerimoniário/coord do módulo).
- **chamada.html:** em `confirmarChamada`, para cada `substitutos[escalaId]`,
  chamar a RPC após gravar o status `substituido`.
- **Retroativo (backfill):** SQL idempotente sobre todas as
  `acolitos_escalas` com `status='substituido'` e `substituto_id not null`
  → aplica o mesmo crédito; depois reavaliar missões automáticas dos
  membros afetados (`acolitos_avaliar_missoes`).

### 2. Histórico de escalas
- **Membro (escalas-membro.html, mount ~l.66):** botão/toggle "Histórico".
  Nova RPC `acolitos_escalas_passadas` (espelho de `acolitos_escalas_futuras`,
  datas < hoje, ordem desc, limite p.ex. 60). Reaproveita render l.76-106.
- **Admin (escala.html, query ~l.433-436):** botão "Histórico" que carrega
  celebrações passadas (somente leitura), sem afetar o gerador.

### 3. "Em formação" → só manual
- `em_formacao` já existe em `PROF_NIVEIS` (membros.html:140). O gerador
  `elegivelFuncao` (escala.html:712) só aceita `apto|experiente|referencia`
  e **continua assim** (auto nunca usa em_formacao).
- Mudança: o `<select>` manual de vaga (escala.html ~l.630) passa a **incluir**
  membros `em_formacao`, com etiqueta "(em formação)". A lista "Membros Aptos"
  (l.675) pode opcionalmente listá-los à parte; mínimo: liberar no select.

### 4. Chamada começa desmarcada + bloqueia
- chamada.html init (l.182-188): para status `escalado`, **não** pré-marcar
  `presente`; deixar `resultados[e.id]` indefinido (mantém valores salvos).
- Botões: nenhum `sel-` inicial.
- `confirmarChamada`: se algum membro escalado renderizado estiver sem
  marcação, **bloquear** com toast listando os pendentes.

### 5. Mostrar quem fez a chamada
- `acolitos_chamadas.realizada_por`/`realizada_em` já existem (003) mas não
  são exibidos. RLS impede ler nome direto.
- **RPC** `acolitos_chamada_responsavel(p_celebracao uuid)` → `{ nome, realizada_em }`.
- chamada.html: banner no topo "Chamada registrada por <nome> em dd/mm hh:mm"
  (ao carregar uma chamada existente e logo após registrar).

### 6. Notificação diária de XP
- shared.js `queueNotificacoes` (l.271-304): novo card (prio ~40), só se:
  - membro **não ganhou XP hoje** (checar `acolitos_missao_progresso`
    `concluida_em::date = today` para o membro — via RPC enxuta
    `acolitos_xp_hoje(p_membro)` retornando count, ou consulta direta);
  - guarda 1x/dia por `localStorage` (`xp-daily-<id>-<yyyy-mm-dd>`).
- Texto: "Você ainda não ganhou XP hoje 👀 Complete uma missão bônus pra
  manter o engajamento!" + botão → missoes.html.

## Riscos / cuidados
- Não tocar dados reais de forma destrutiva; backfill é aditivo e idempotente
  (autorizado pelo usuário).
- Deploy sempre da raiz do repo.
- Validar comportamento antes de deployar; conferir constraints reais de
  `acolitos_escalas` (unique) e corpo real das RPCs antes de criar as novas.

## Ordem de implementação (mais simples → complexo)
4 (chamada desmarcada) → 3 (em formação manual) → 6 (notif diária) →
5 (quem fez chamada) → 2 (histórico) → 1 (substituto XP + retroativo).
