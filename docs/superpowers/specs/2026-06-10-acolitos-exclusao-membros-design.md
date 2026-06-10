# Exclusão de Membros — Arquivar + Excluir Definitivo

**Data:** 2026-06-10
**Projeto:** Acólitos (iajcbp) — tela `projetos/acolitos/membros.html`
**Status:** Design aprovado em brainstorming; aguardando revisão do spec.

## Objetivo

Permitir remover membros do sistema com dois modos distintos:

1. **Arquivar** (exclusão lógica, reversível) — ação do dia a dia, para quem saiu/parou de servir.
2. **Excluir definitivamente** (exclusão física, irreversível) — só para duplicados e erros de cadastro.

Hoje a tabela `acolitos_membros` (174 membros) **não tem** infraestrutura de exclusão lógica, e o delete físico cascateia em ~15 tabelas filhas.

## Decisões (do brainstorming)

| Tema | Decisão |
|---|---|
| Modos | Os dois: arquivar (padrão) + excluir definitivo (casos extremos) |
| Quem arquiva | `coord_admin` / `subadmin` (mesmo gate da edição atual) |
| Quem exclui de vez | **Só superadmin** (username na config `superadmins`) |
| Membro arquivado: login | **Não bloqueia** — mantém acesso ao próprio perfil/histórico |
| Membro arquivado: visibilidade | Some do operacional; visível só num filtro "Arquivados" em Membros |
| Membro arquivado: histórico | Preservado em relatórios (passado não some, só o futuro) |
| Delete travado por FK de substituto | Limpar referências (set null) e apagar, numa transação |

## Contexto técnico apurado

- **Tabela:** `acolitos_membros`. Sem coluna `ativo/status/arquivado`.
- **FKs filhas com CASCADE** (apagadas junto no delete físico): `acolitos_ausencias`, `acolitos_ausencias_pendentes`, `acolitos_campeoes`, `acolitos_crm`, `acolitos_crm_historico`, `acolitos_disponibilidade`, `acolitos_escalas` (membro_id), `acolitos_evento_presencas`, `acolitos_hab_pedidos`, `acolitos_habilitacoes`, `acolitos_logins`, `acolitos_missao_progresso`, `acolitos_presencas_avulsas`, `acolitos_xp_temporada`.
- **FKs que TRAVAM o delete físico** (`NO ACTION`): `acolitos_escalas.substituto_id` e `acolitos_chamadas_itens.substituto_id`. Precisam ser zeradas antes.
- **`acolitos_membros.irmao_id`** é `SET NULL` (auto-referência) — ok.
- **Padrão de escrita:** client usa `sbAdmin = sb` (anon + JWT do usuário, via RLS). Operações que furam RLS ficam em **funções serverless Vercel** (`api/*.js`) com a service key, validando JWT + papel do chamador (ver `api/delete-user.js`).
- **Superadmin:** `isSuperadmin(ctx)` em `shared.js:1116`, via `cfg('superadmins', [...])`.
- **Gate admin na tela:** `membros.html:380` → `ehAdmin = ['coord_admin','subadmin'].includes(ctx.membership.role)`.

## Componentes

### 1. Migration de banco

Nova migration em `docs/migrations/` (próximo número da sequência):

- `alter table acolitos_membros add column arquivado_em timestamptz`, `add column arquivado_por uuid`.
- Índice parcial: `create index on acolitos_membros (id) where arquivado_em is null` (mantém listas operacionais leves).
- **RLS UPDATE policy**: `coord_admin`/`subadmin` podem alterar `arquivado_em`/`arquivado_por` (alinhada às policies de edição existentes do módulo).
- **RPC `excluir_membro_definitivo(p_membro_id uuid)`** `SECURITY DEFINER`, transacional:
  1. `update acolitos_escalas set substituto_id = null where substituto_id = p_membro_id`
  2. `update acolitos_chamadas_itens set substituto_id = null where substituto_id = p_membro_id`
  3. `delete from acolitos_membros where id = p_membro_id` (CASCADE limpa as filhas)
  - A autorização (superadmin) é feita na função serverless **antes** de chamar a RPC; a RPC só é exposta via service key, não para o anon. (Se hoje o padrão do projeto expõe RPCs ao anon — ver memória de segurança —, adicionar guarda interna conferindo o chamador.)

### 2. Filtros de leitura (`.is('arquivado_em', null)`)

Auditar os 9 arquivos que leem `acolitos_membros` e filtrar **apenas o operacional**:

- **Filtrar arquivados:** `escala.html` (gerador + pickers de substituto), `index.html`, `casas.html`, `crm.html` (operacional), `shared.js` (seletor de irmãos de família, rankings/ligas), demais listas do dia a dia.
- **NÃO filtrar (mostram arquivados de propósito):** `membros.html` (tem o filtro "Arquivados"), `config.html`, `jornada-admin.html`/`novos.html` conforme cada um seja histórico ou operacional (decidir caso a caso no plano).

> Risco principal de regressão: um local esquecido faz o arquivado reaparecer numa escala. Cada arquivo é tratado explicitamente no plano de implementação.

### 3. UI em `membros.html`

- **Arquivar** (admin): botão no detalhe do membro → confirmação → seta `arquivado_em = now()`, `arquivado_por = ctx`. Se já arquivado, o botão vira **Reativar** (zera os campos).
- **Filtro "Arquivados"**: novo toggle na barra de filtros (linha ~91). Lista os arquivados com visual esmaecido + selo "Arquivado".
- **Excluir definitivamente** (só superadmin, e só num membro **já arquivado**): botão vermelho com confirmação forte — digitar o nome do membro para liberar. Chama `api/delete-membro.js`.

### 4. `api/delete-membro.js` (serverless)

Espelha `api/delete-user.js`:
1. Valida JWT do chamador (`/auth/v1/user`).
2. **Verifica que o chamador é superadmin** — username na config `superadmins` (não `profiles.role`).
3. Impede auto-exclusão.
4. Chama a RPC `excluir_membro_definitivo(p_membro_id)` com a service key.
5. Remove o login no Auth se houver (reusa a lógica de `delete-user.js`).

### 5. Auditoria

Registrar em `audit_log` (já existente) tanto **arquivar/reativar** quanto **excluir definitivo**: ator, timestamp, `membro_id`, ação.

## Fora de escopo (YAGNI)

- Exclusão em massa / seleção múltipla.
- Bloqueio de login do arquivado (decisão explícita: não bloquear).
- "Lixeira" com auto-purga por tempo.

## Critérios de sucesso

- Admin arquiva/reativa um membro; ele some/volta do gerador de escala, pickers e listas operacionais.
- Arquivado continua no filtro "Arquivados" e seu histórico passado permanece em relatórios.
- Superadmin exclui definitivamente um membro arquivado mesmo que ele tenha sido substituto (sem erro de FK); membro e dependências somem.
- Não-superadmin não consegue chamar o excluir definitivo (403).
- Toda exclusão/arquivamento fica registrada no `audit_log`.
