# Central do Servo + Escala eu + Caixa de Aprovações — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar ao membro autoatendimento na escala (pedir troca / candidatar-se a vaga) e à coordenação uma Caixa de Aprovações única que agrega todas as pendências.

**Architecture:** Uma tabela nova `acolitos_solicitacoes` (troca/candidatura + máquina de estados) com RPCs SECURITY DEFINER self-gated para o membro e gate de coordenação para decidir. As telas de front (HTML standalone + `shared.js`) consomem essas RPCs. A mutação real da escala reusa `acolitos_aplicar_troca_escala` (migration 009) e o motor `GeradorSubstituto` (Spec B). Nada de tabela nova para ausências (fila existente) nem para novos cadastros (CRM) — a Caixa só agrega.

**Tech Stack:** Postgres/PLpgSQL (Supabase), HTML/CSS/JS vanilla (sem framework, sem CDN externo), supabase-js v2 (vendored), testes node puros (script + `eq()`).

## Global Constraints

- **Conta git/Supabase:** `erickjcbp` (já ativa). Migration aplicada via **MCP Supabase**, ref `fttjgsotuosjfrasttds` — inspecionar antes; o token do MCP pode expirar e derrubar writes (reautorizar via `/mcp`).
- **Deploy:** só quando o dono pedir. Trabalhar em `main` local; não fazer push/deploy sem pedido.
- **Sem CDN externo** em nenhuma tela (regras de rede de operadora derrubam CDNs).
- **Render XSS-safe:** montar DOM via `textContent`/`createElement`, nunca `innerHTML` com dado de usuário.
- **Responsivo mobile-first:** não estourar a tela no celular.
- **Reuso obrigatório:** motor `GeradorSubstituto` (`gerador-substituto.js`) na cobertura; RPC `acolitos_aplicar_troca_escala(uuid,uuid,uuid)` para efetivar troca. Não reescrever essas lógicas.
- **Gate:** ações do membro = self-gated na RPC (membro = `auth.uid()`); Caixa = coordenação (`acolitos_get_role` in `('coord_admin','subadmin','membro_equipe','cerimonario')`).
- **RPCs internas:** sempre `revoke execute ... from public;` + `grant execute ... to authenticated;`.
- **Testar telas gated** com a conta coord de teste (`bot-teste@jcbplimeira.com`) usando celebração/membro **descartável**.

**Máquina de estados (referência, vale para todas as tasks):**
`aguardando_colega` → (colega aceita) `aguardando_coordenacao` → (homologa) `homologado` | (nega) `negado`
`aguardando_colega` → (colega recusa) `recusado_colega` → (reenvia) `aguardando_colega` | (cobrir) `aguardando_cobertura`
`aguardando_cobertura` → (confirma) `coberto` | (nega) `negado`
candidatura: `aguardando_coordenacao` → (aprova) `aprovado` | (nega) `negado`
qualquer pendente → (dono cancela) `cancelado`
Pendentes = {aguardando_colega, aguardando_coordenacao, aguardando_cobertura, recusado_colega}.

---

## File Structure

- `projetos/acolitos/solicitacoes-core.js` (**novo**) — módulo puro UMD: rótulos de status + helper de estado pendente. Testável em node.
- `projetos/acolitos/solicitacoes-core.test.js` (**novo**) — testes node do módulo puro.
- `db/seguranca/011_solicitacoes.sql` (**novo**) — tabela `acolitos_solicitacoes` + RLS + 9 RPCs + grants. Construído incrementalmente pelas Tasks 2–4; `create or replace` é idempotente (reaplicável via MCP a cada task).
- `projetos/acolitos/escalas-membro.html` (**modificar**) — seletor Minhas/Todas + sub-abas + ações (Escala eu).
- `projetos/acolitos/index.html` (**modificar**) — aviso de convites na home do membro; badge de pendências na home da coordenação; remover botão "Ausência" das próximas escalas.
- `projetos/acolitos/ausencias.html` (**modificar**) — reestruturar em Caixa de Aprovações (agregador de 5 fontes).
- `projetos/acolitos/shared.js` (**modificar**) — incluir `solicitacoes-core.js` no `<script>` das telas (via tag em cada HTML) e um helper de aviso de convites (`enqueueNotif`).

---

## Phase 0 — Fundações (dados + módulo puro)

### Task 1: Módulo puro `solicitacoes-core.js` (rótulos + estado)

**Files:**
- Create: `projetos/acolitos/solicitacoes-core.js`
- Test: `projetos/acolitos/solicitacoes-core.test.js`

**Interfaces:**
- Produces (global `SolicitacoesCore` no browser; `module.exports` no node):
  - `STATUS_LABEL: { [status]: string }`
  - `STATUS_PENDENTE: Set<string>` e `estaPendente(status: string): boolean`
  - `TIPO_LABEL: { troca: string, candidatura: string }`

- [ ] **Step 1: Escrever o teste que falha**

Create `projetos/acolitos/solicitacoes-core.test.js`:
```js
// Testes do core de solicitações. Rodar: node projetos/acolitos/solicitacoes-core.test.js
const { STATUS_LABEL, estaPendente, TIPO_LABEL } = require('./solicitacoes-core.js');
let falhas = 0;
function eq(nome, got, exp){
  const ok = JSON.stringify(got)===JSON.stringify(exp);
  console.log((ok?'PASS':'FAIL')+' — '+nome+(ok?'':'  got='+JSON.stringify(got)+' exp='+JSON.stringify(exp)));
  if(!ok) falhas++;
}
eq('rótulo aguardando_colega', STATUS_LABEL['aguardando_colega'], 'Aguardando o colega');
eq('rótulo homologado', STATUS_LABEL['homologado'], 'Trocado ✓');
eq('rótulo negado', STATUS_LABEL['negado'], 'Recusado pela coordenação');
eq('aguardando_colega é pendente', estaPendente('aguardando_colega'), true);
eq('recusado_colega é pendente (dá pra reenviar/cobrir)', estaPendente('recusado_colega'), true);
eq('homologado NÃO é pendente', estaPendente('homologado'), false);
eq('cancelado NÃO é pendente', estaPendente('cancelado'), false);
eq('tipo troca', TIPO_LABEL['troca'], 'Troca');
console.log(falhas? ('\n'+falhas+' FALHA(S)') : '\nTODOS OK');
process.exit(falhas?1:0);
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `node projetos/acolitos/solicitacoes-core.test.js`
Expected: FAIL — `Cannot find module './solicitacoes-core.js'`.

- [ ] **Step 3: Implementar o módulo mínimo**

Create `projetos/acolitos/solicitacoes-core.js`:
```js
// Core de solicitações (troca/candidatura) — rótulos e estado. PURO (sem I/O).
// Usado por escalas-membro.html, index.html e ausencias.html; testável em node.
(function(global){
  'use strict';
  var STATUS_LABEL = {
    aguardando_colega:      'Aguardando o colega',
    aguardando_coordenacao: 'Aguardando a coordenação',
    aguardando_cobertura:   'Aguardando cobertura',
    recusado_colega:        'O colega recusou',
    homologado:             'Trocado ✓',
    coberto:                'Coberto ✓',
    aprovado:               'Aprovado ✓',
    negado:                 'Recusado pela coordenação',
    cancelado:              'Cancelado'
  };
  var STATUS_PENDENTE = ['aguardando_colega','aguardando_coordenacao','aguardando_cobertura','recusado_colega'];
  function estaPendente(s){ return STATUS_PENDENTE.indexOf(s) >= 0; }
  var TIPO_LABEL = { troca:'Troca', candidatura:'Candidatura' };
  var API = { STATUS_LABEL:STATUS_LABEL, STATUS_PENDENTE:STATUS_PENDENTE, estaPendente:estaPendente, TIPO_LABEL:TIPO_LABEL };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  global.SolicitacoesCore = API;
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `node projetos/acolitos/solicitacoes-core.test.js`
Expected: PASS em todas + `TODOS OK`.

- [ ] **Step 5: Commit**

```bash
git add projetos/acolitos/solicitacoes-core.js projetos/acolitos/solicitacoes-core.test.js
git commit -m "feat(acolitos): core puro de solicitações (rótulos de status + estado pendente)"
```

---

### Task 2: Migration 011 — tabela `acolitos_solicitacoes` + RLS

**Files:**
- Create: `db/seguranca/011_solicitacoes.sql`

**Interfaces:**
- Produces: tabela `public.acolitos_solicitacoes` com as colunas do spec; RLS: dono lê/escreve as suas + as direcionadas a ele; coordenação lê todas.

- [ ] **Step 1: Escrever a migration (tabela + índices + RLS)**

Create `db/seguranca/011_solicitacoes.sql`:
```sql
-- 011 — Solicitações do membro (troca / candidatura) + Caixa de Aprovações (2026-07-15)
-- Autoatendimento: o membro pede troca (colega aceita → coordenação homologa) ou se candidata a vaga.
-- A mutação real da escala reusa acolitos_aplicar_troca_escala (009). Ausências (fila) e novos
-- cadastros (CRM) NÃO entram aqui — a Caixa só os agrega.

create table if not exists public.acolitos_solicitacoes (
  id                  uuid primary key default gen_random_uuid(),
  membro_id           uuid not null references public.acolitos_membros(id) on delete cascade,
  celebracao_id       uuid not null references public.acolitos_celebracoes(id) on delete cascade,
  escala_id           uuid references public.acolitos_escalas(id) on delete set null,
  funcao              text not null,
  tipo                text not null check (tipo in ('troca','candidatura')),
  alvo_membro_id      uuid references public.acolitos_membros(id) on delete set null,
  status              text not null default 'aguardando_coordenacao',
  motivo              text,
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now(),
  decidido_por        uuid,
  resultado_escala_id uuid
);
create index if not exists idx_solic_status   on public.acolitos_solicitacoes(status);
create index if not exists idx_solic_membro   on public.acolitos_solicitacoes(membro_id);
create index if not exists idx_solic_alvo     on public.acolitos_solicitacoes(alvo_membro_id);
create index if not exists idx_solic_celebra  on public.acolitos_solicitacoes(celebracao_id);

alter table public.acolitos_solicitacoes enable row level security;

-- Dono OU alvo (colega convidado) lê. Coordenação lê tudo.
drop policy if exists solic_select on public.acolitos_solicitacoes;
create policy solic_select on public.acolitos_solicitacoes for select using (
  membro_id     in (select id from public.acolitos_membros where user_id = auth.uid())
  or alvo_membro_id in (select id from public.acolitos_membros where user_id = auth.uid())
  or public.acolitos_get_role(auth.uid()) in ('coord_admin','subadmin','membro_equipe','cerimonario')
);
-- Sem policies de INSERT/UPDATE/DELETE diretas: todo write é via RPC SECURITY DEFINER (abaixo).
```

- [ ] **Step 2: Aplicar via MCP e verificar a tabela**

Aplicar o SQL via MCP Supabase (`apply_migration` ou `execute_sql`). Depois verificar:
```sql
select column_name, data_type from information_schema.columns
where table_name = 'acolitos_solicitacoes' order by ordinal_position;
```
Expected: 14 colunas na ordem do spec; `rowsecurity = true` em `pg_tables` para essa tabela.

- [ ] **Step 3: Commit**

```bash
git add db/seguranca/011_solicitacoes.sql
git commit -m "feat(acolitos): tabela acolitos_solicitacoes + RLS (dono/alvo/coordenação)"
```

---

### Task 3: RPCs do membro (criar / responder / cancelar / listar / vagas)

**Files:**
- Modify: `db/seguranca/011_solicitacoes.sql` (append)

**Interfaces:**
- Consumes: `acolitos_get_role(uuid)`; tabelas `acolitos_membros(user_id,id,status)`, `acolitos_escalas(id,celebracao_id,membro_id,funcao,status)`, `acolitos_celebracoes(id,data,horario,comunidade,tipo)`, `acolitos_habilitacoes(membro_id,funcao)`, `acolitos_modelos`.
- Produces (todas `returns jsonb`, grant `authenticated`):
  - `acolitos_solicitar_troca(p_escala_id uuid, p_alvo_membro_id uuid, p_motivo text)` → `{ok, id, status}`
  - `acolitos_candidatar_vaga(p_celebracao_id uuid, p_funcao text, p_motivo text)` → `{ok, id}`
  - `acolitos_troca_responder(p_solicitacao_id uuid, p_aceita boolean)` → `{ok, status}`
  - `acolitos_solicitacao_cancelar(p_solicitacao_id uuid)` → `{ok}`
  - `acolitos_solicitacao_reenviar(p_solicitacao_id uuid, p_novo_alvo uuid)` → `{ok, status}`
  - `acolitos_solicitacoes_membro()` → `{meus:[...], convites:[...]}`
  - `acolitos_vagas_abertas_membro()` → `{vagas:[{celebracao_id,data,horario,comunidade,tipo,funcao}]}`

- [ ] **Step 1: Escrever as RPCs do membro (append na migration)**

Append em `db/seguranca/011_solicitacoes.sql`:
```sql
-- ── Helper interno: id do meu membro ativo ──────────────────────────────
create or replace function public.acolitos_meu_membro_id()
returns uuid language sql stable security definer set search_path to 'public' as $$
  select id from public.acolitos_membros where user_id = auth.uid() and status = 'ativo' limit 1;
$$;

-- ── Pedir troca ─────────────────────────────────────────────────────────
create or replace function public.acolitos_solicitar_troca(
  p_escala_id uuid, p_alvo_membro_id uuid, p_motivo text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_me uuid; v_cel uuid; v_funcao text; v_status text; v_id uuid;
begin
  v_me := acolitos_meu_membro_id();
  if v_me is null then return jsonb_build_object('erro','sem_membro'); end if;
  select celebracao_id, funcao into v_cel, v_funcao
  from public.acolitos_escalas
  where id = p_escala_id and membro_id = v_me and status = 'escalado';
  if v_cel is null then return jsonb_build_object('erro','nao_escalado'); end if;
  -- não permite pedido duplicado pendente para a mesma escala
  if exists (select 1 from public.acolitos_solicitacoes
             where escala_id = p_escala_id and membro_id = v_me
               and status in ('aguardando_colega','aguardando_coordenacao','aguardando_cobertura','recusado_colega')) then
    return jsonb_build_object('erro','ja_existe');
  end if;
  v_status := case when p_alvo_membro_id is null then 'aguardando_cobertura' else 'aguardando_colega' end;
  insert into public.acolitos_solicitacoes(membro_id, celebracao_id, escala_id, funcao, tipo, alvo_membro_id, status, motivo)
  values (v_me, v_cel, p_escala_id, v_funcao, 'troca', p_alvo_membro_id, v_status, p_motivo)
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id, 'status', v_status);
end; $$;

-- ── Candidatar-se a vaga ────────────────────────────────────────────────
create or replace function public.acolitos_candidatar_vaga(
  p_celebracao_id uuid, p_funcao text, p_motivo text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_me uuid; v_id uuid;
begin
  v_me := acolitos_meu_membro_id();
  if v_me is null then return jsonb_build_object('erro','sem_membro'); end if;
  if not exists (select 1 from public.acolitos_habilitacoes where membro_id = v_me and funcao = p_funcao) then
    return jsonb_build_object('erro','sem_habilitacao');
  end if;
  if exists (select 1 from public.acolitos_escalas
             where celebracao_id = p_celebracao_id and membro_id = v_me and status = 'escalado') then
    return jsonb_build_object('erro','ja_escalado');
  end if;
  if exists (select 1 from public.acolitos_solicitacoes
             where celebracao_id = p_celebracao_id and membro_id = v_me and tipo='candidatura'
               and status in ('aguardando_coordenacao')) then
    return jsonb_build_object('erro','ja_candidatou');
  end if;
  insert into public.acolitos_solicitacoes(membro_id, celebracao_id, funcao, tipo, status, motivo)
  values (v_me, p_celebracao_id, p_funcao, 'candidatura', 'aguardando_coordenacao', p_motivo)
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end; $$;

-- ── Colega responde ao convite ──────────────────────────────────────────
create or replace function public.acolitos_troca_responder(
  p_solicitacao_id uuid, p_aceita boolean)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_me uuid; v_novo text;
begin
  v_me := acolitos_meu_membro_id();
  if v_me is null then return jsonb_build_object('erro','sem_membro'); end if;
  v_novo := case when p_aceita then 'aguardando_coordenacao' else 'recusado_colega' end;
  update public.acolitos_solicitacoes
    set status = v_novo, atualizado_em = now()
    where id = p_solicitacao_id and alvo_membro_id = v_me and status = 'aguardando_colega';
  if not found then return jsonb_build_object('erro','nao_pendente'); end if;
  return jsonb_build_object('ok', true, 'status', v_novo);
end; $$;

-- ── Dono cancela ────────────────────────────────────────────────────────
create or replace function public.acolitos_solicitacao_cancelar(p_solicitacao_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_me uuid;
begin
  v_me := acolitos_meu_membro_id();
  update public.acolitos_solicitacoes
    set status = 'cancelado', atualizado_em = now()
    where id = p_solicitacao_id and membro_id = v_me
      and status in ('aguardando_colega','aguardando_coordenacao','aguardando_cobertura','recusado_colega');
  if not found then return jsonb_build_object('erro','nao_pendente'); end if;
  return jsonb_build_object('ok', true);
end; $$;

-- ── Dono reenvia (outro colega, ou null = cobertura) ───────────────────
create or replace function public.acolitos_solicitacao_reenviar(
  p_solicitacao_id uuid, p_novo_alvo uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_me uuid; v_status text;
begin
  v_me := acolitos_meu_membro_id();
  v_status := case when p_novo_alvo is null then 'aguardando_cobertura' else 'aguardando_colega' end;
  update public.acolitos_solicitacoes
    set alvo_membro_id = p_novo_alvo, status = v_status, atualizado_em = now()
    where id = p_solicitacao_id and membro_id = v_me and tipo = 'troca'
      and status = 'recusado_colega';
  if not found then return jsonb_build_object('erro','nao_recusado'); end if;
  return jsonb_build_object('ok', true, 'status', v_status);
end; $$;

-- ── Meus pedidos + convites direcionados a mim ─────────────────────────
create or replace function public.acolitos_solicitacoes_membro()
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare v_me uuid; v_meus jsonb; v_conv jsonb;
begin
  v_me := acolitos_meu_membro_id();
  if v_me is null then return jsonb_build_object('meus','[]'::jsonb,'convites','[]'::jsonb); end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', s.id, 'tipo', s.tipo, 'status', s.status, 'funcao', s.funcao,
           'motivo', s.motivo, 'alvo_nome', ma.nome,
           'data', c.data, 'horario', c.horario, 'comunidade', c.comunidade
         ) order by s.criado_em desc), '[]'::jsonb) into v_meus
  from public.acolitos_solicitacoes s
  join public.acolitos_celebracoes c on c.id = s.celebracao_id
  left join public.acolitos_membros ma on ma.id = s.alvo_membro_id
  where s.membro_id = v_me;
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', s.id, 'status', s.status, 'funcao', s.funcao,
           'de_nome', mp.nome, 'data', c.data, 'horario', c.horario, 'comunidade', c.comunidade
         ) order by s.criado_em desc), '[]'::jsonb) into v_conv
  from public.acolitos_solicitacoes s
  join public.acolitos_celebracoes c on c.id = s.celebracao_id
  join public.acolitos_membros mp on mp.id = s.membro_id
  where s.alvo_membro_id = v_me and s.status = 'aguardando_colega';
  return jsonb_build_object('meus', v_meus, 'convites', v_conv);
end; $$;

-- ── Vagas abertas na minha função (modelos − preenchidas) ──────────────
create or replace function public.acolitos_vagas_abertas_membro()
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare v_me uuid; v_out jsonb;
begin
  v_me := acolitos_meu_membro_id();
  if v_me is null then return jsonb_build_object('vagas','[]'::jsonb); end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'celebracao_id', c.id, 'data', c.data, 'horario', c.horario,
           'comunidade', c.comunidade, 'tipo', c.tipo, 'funcao', mo.funcao
         ) order by c.data, c.horario), '[]'::jsonb) into v_out
  from public.acolitos_celebracoes c
  join public.acolitos_modelos mo
    on mo.tipo = c.tipo and mo.comunidade = c.comunidade
  join public.acolitos_habilitacoes h
    on h.membro_id = v_me and h.funcao = mo.funcao
  where c.data >= current_date
    and mo.vagas > (
      select count(*) from public.acolitos_escalas e
      where e.celebracao_id = c.id and e.funcao = mo.funcao and e.status = 'escalado'
    )
    and not exists (
      select 1 from public.acolitos_escalas e2
      where e2.celebracao_id = c.id and e2.membro_id = v_me and e2.status = 'escalado'
    );
  return jsonb_build_object('vagas', v_out);
end; $$;

-- grants
revoke execute on function public.acolitos_meu_membro_id() from public;
revoke execute on function public.acolitos_solicitar_troca(uuid,uuid,text) from public;
revoke execute on function public.acolitos_candidatar_vaga(uuid,text,text) from public;
revoke execute on function public.acolitos_troca_responder(uuid,boolean) from public;
revoke execute on function public.acolitos_solicitacao_cancelar(uuid) from public;
revoke execute on function public.acolitos_solicitacao_reenviar(uuid,uuid) from public;
revoke execute on function public.acolitos_solicitacoes_membro() from public;
revoke execute on function public.acolitos_vagas_abertas_membro() from public;
grant execute on function public.acolitos_meu_membro_id() to authenticated;
grant execute on function public.acolitos_solicitar_troca(uuid,uuid,text) to authenticated;
grant execute on function public.acolitos_candidatar_vaga(uuid,text,text) to authenticated;
grant execute on function public.acolitos_troca_responder(uuid,boolean) to authenticated;
grant execute on function public.acolitos_solicitacao_cancelar(uuid) to authenticated;
grant execute on function public.acolitos_solicitacao_reenviar(uuid,uuid) to authenticated;
grant execute on function public.acolitos_solicitacoes_membro() to authenticated;
grant execute on function public.acolitos_vagas_abertas_membro() to authenticated;
```

- [ ] **Step 2: Aplicar via MCP e verificar assinaturas**

Aplicar via MCP. Verificar que as 8 funções existem:
```sql
select proname from pg_proc where proname like 'acolitos_solicit%' or proname in
 ('acolitos_meu_membro_id','acolitos_candidatar_vaga','acolitos_troca_responder','acolitos_vagas_abertas_membro')
 order by proname;
```
Expected: as 8 funções listadas.

- [ ] **Step 3: Verificar o caminho feliz com dados descartáveis (via MCP)**

Usando um membro/escala **descartável** já existente na base de teste, chamar (como o próprio usuário exige auth; no MCP validar via SQL direto o INSERT que a RPC faria) — verificação mínima:
```sql
-- confere que a coluna check aceita os tipos e a default:
insert into public.acolitos_solicitacoes(membro_id, celebracao_id, escala_id, funcao, tipo, alvo_membro_id, status)
select m.id, e.celebracao_id, e.id, e.funcao, 'troca', null, 'aguardando_cobertura'
from public.acolitos_escalas e join public.acolitos_membros m on m.id = e.membro_id
where e.status='escalado' limit 1
returning id, status;
-- limpar:
delete from public.acolitos_solicitacoes where status='aguardando_cobertura' and alvo_membro_id is null;
```
Expected: insere e retorna 1 linha; delete remove. (Dado descartável — não mexer em solicitações reais.)

- [ ] **Step 4: Commit**

```bash
git add db/seguranca/011_solicitacoes.sql
git commit -m "feat(acolitos): RPCs do membro (pedir troca, candidatar, responder, cancelar, reenviar, listar, vagas)"
```

---

### Task 4: RPCs da coordenação (listar pendentes + decidir)

**Files:**
- Modify: `db/seguranca/011_solicitacoes.sql` (append)

**Interfaces:**
- Consumes: `acolitos_aplicar_troca_escala(uuid,uuid,uuid)` (009); `acolitos_get_role(uuid)`.
- Produces (grant `authenticated`, gate coordenação):
  - `acolitos_solicitacoes_pendentes()` → `{trocas:[...], candidaturas:[...], cobrir:[...]}`
  - `acolitos_solicitacao_decidir(p_solicitacao_id uuid, p_acao text, p_substituto_id uuid)` → `{ok, status}`; `p_acao` ∈ `('homologar','confirmar_cobertura','aprovar_candidatura','negar')`.

- [ ] **Step 1: Escrever as RPCs da coordenação (append)**

Append em `db/seguranca/011_solicitacoes.sql`:
```sql
-- ── Pendências para a Caixa (gate coordenação) ─────────────────────────
create or replace function public.acolitos_solicitacoes_pendentes()
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare v_role text; v_trocas jsonb; v_cand jsonb; v_cobrir jsonb;
begin
  v_role := acolitos_get_role(auth.uid());
  if v_role is null or v_role not in ('coord_admin','subadmin','membro_equipe','cerimonario') then
    return jsonb_build_object('trocas','[]'::jsonb,'candidaturas','[]'::jsonb,'cobrir','[]'::jsonb);
  end if;
  select coalesce(jsonb_agg(x order by (x->>'data')), '[]'::jsonb) into v_trocas from (
    select jsonb_build_object('id',s.id,'funcao',s.funcao,'de_nome',mp.nome,'alvo_nome',ma.nome,
             'data',c.data,'horario',c.horario,'comunidade',c.comunidade) as x
    from public.acolitos_solicitacoes s
    join public.acolitos_celebracoes c on c.id=s.celebracao_id
    join public.acolitos_membros mp on mp.id=s.membro_id
    left join public.acolitos_membros ma on ma.id=s.alvo_membro_id
    where s.tipo='troca' and s.status='aguardando_coordenacao') t;
  select coalesce(jsonb_agg(x order by (x->>'data')), '[]'::jsonb) into v_cand from (
    select jsonb_build_object('id',s.id,'funcao',s.funcao,'de_nome',mp.nome,
             'data',c.data,'horario',c.horario,'comunidade',c.comunidade) as x
    from public.acolitos_solicitacoes s
    join public.acolitos_celebracoes c on c.id=s.celebracao_id
    join public.acolitos_membros mp on mp.id=s.membro_id
    where s.tipo='candidatura' and s.status='aguardando_coordenacao') t;
  select coalesce(jsonb_agg(x order by (x->>'data')), '[]'::jsonb) into v_cobrir from (
    select jsonb_build_object('id',s.id,'funcao',s.funcao,'de_nome',mp.nome,'celebracao_id',s.celebracao_id,
             'membro_id',s.membro_id,'data',c.data,'horario',c.horario,'comunidade',c.comunidade) as x
    from public.acolitos_solicitacoes s
    join public.acolitos_celebracoes c on c.id=s.celebracao_id
    join public.acolitos_membros mp on mp.id=s.membro_id
    where s.tipo='troca' and s.status='aguardando_cobertura') t;
  return jsonb_build_object('trocas',v_trocas,'candidaturas',v_cand,'cobrir',v_cobrir);
end; $$;

-- ── Decidir (homologar troca / confirmar cobertura / aprovar candidatura / negar) ──
create or replace function public.acolitos_solicitacao_decidir(
  p_solicitacao_id uuid, p_acao text, p_substituto_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_role text; s public.acolitos_solicitacoes%rowtype; v_troca jsonb; v_novo_esc uuid; v_final text;
begin
  v_role := acolitos_get_role(auth.uid());
  if v_role is null or v_role not in ('coord_admin','subadmin','membro_equipe','cerimonario') then
    return jsonb_build_object('erro','sem_permissao');
  end if;
  select * into s from public.acolitos_solicitacoes where id = p_solicitacao_id;
  if s.id is null then return jsonb_build_object('erro','nao_encontrada'); end if;

  if p_acao = 'negar' then
    update public.acolitos_solicitacoes set status='negado', decidido_por=auth.uid(), atualizado_em=now()
      where id = s.id;
    return jsonb_build_object('ok',true,'status','negado');

  elsif p_acao = 'homologar' and s.tipo='troca' and s.status='aguardando_coordenacao' then
    -- membro sai, colega (alvo) entra
    v_troca := public.acolitos_aplicar_troca_escala(s.celebracao_id, s.membro_id, s.alvo_membro_id);
    v_novo_esc := nullif(v_troca->>'novo_escala_id','')::uuid;
    update public.acolitos_solicitacoes set status='homologado', decidido_por=auth.uid(),
      resultado_escala_id=v_novo_esc, atualizado_em=now() where id=s.id;
    return jsonb_build_object('ok',true,'status','homologado');

  elsif p_acao = 'confirmar_cobertura' and s.tipo='troca' and s.status='aguardando_cobertura' then
    -- membro sai, substituto escolhido pela coordenação entra (p_substituto_id pode ser null = vaga vazia)
    v_troca := public.acolitos_aplicar_troca_escala(s.celebracao_id, s.membro_id, p_substituto_id);
    v_novo_esc := nullif(v_troca->>'novo_escala_id','')::uuid;
    update public.acolitos_solicitacoes set status='coberto', decidido_por=auth.uid(),
      resultado_escala_id=v_novo_esc, atualizado_em=now() where id=s.id;
    return jsonb_build_object('ok',true,'status','coberto');

  elsif p_acao = 'aprovar_candidatura' and s.tipo='candidatura' and s.status='aguardando_coordenacao' then
    insert into public.acolitos_escalas(celebracao_id, membro_id, funcao, status, created_by)
    values (s.celebracao_id, s.membro_id, s.funcao, 'escalado', auth.uid())
    returning id into v_novo_esc;
    update public.acolitos_solicitacoes set status='aprovado', decidido_por=auth.uid(),
      resultado_escala_id=v_novo_esc, atualizado_em=now() where id=s.id;
    return jsonb_build_object('ok',true,'status','aprovado');
  end if;

  return jsonb_build_object('erro','acao_invalida','tipo',s.tipo,'status',s.status);
end; $$;

revoke execute on function public.acolitos_solicitacoes_pendentes() from public;
revoke execute on function public.acolitos_solicitacao_decidir(uuid,text,uuid) from public;
grant execute on function public.acolitos_solicitacoes_pendentes() to authenticated;
grant execute on function public.acolitos_solicitacao_decidir(uuid,text,uuid) to authenticated;
```

- [ ] **Step 2: Aplicar via MCP e verificar**

Aplicar via MCP. Verificar existência:
```sql
select proname from pg_proc where proname in
 ('acolitos_solicitacoes_pendentes','acolitos_solicitacao_decidir');
```
Expected: as 2 funções.

- [ ] **Step 3: Verificar decidir end-to-end (dado descartável, via MCP)**

Numa celebração descartável com um escalado descartável, inserir uma solicitação de cobertura e chamar decidir; conferir que a escala mudou; depois limpar. (Executar como SQL de serviço no MCP.)
```sql
-- 1. cria solicitação de cobertura para um escalado descartável (ajuste os ids da base de teste)
-- 2. select public.acolitos_solicitacao_decidir('<id>','confirmar_cobertura', null);
-- 3. select status, resultado_escala_id from acolitos_solicitacoes where id='<id>';  -> 'coberto'
-- 4. limpar a solicitação e reverter a escala de teste
```
Expected: status vira `coberto`; a linha do ausente fica `substituido`. Reverter tudo depois.

- [ ] **Step 4: Commit**

```bash
git add db/seguranca/011_solicitacoes.sql
git commit -m "feat(acolitos): RPCs da coordenação (listar pendentes + decidir troca/cobertura/candidatura)"
```

---

## Phase 1 — Escala eu (evolui `escalas-membro.html`)

### Task 5: Seletor Minhas/Todas + carregar minhas solicitações

**Files:**
- Modify: `projetos/acolitos/escalas-membro.html`

**Interfaces:**
- Consumes: `acolitos_solicitacoes_membro()`, `acolitos_vagas_abertas_membro()`, `SolicitacoesCore`, helpers `initModulo/navCaps/renderHeader/renderBottomNav/toast/sb`.
- Produces (funções no `<script>` da página): `renderMinhas(main, ctx)`, `carregarMeusPedidos()`, `carregarVagas()`.

- [ ] **Step 1: Incluir o core puro na página**

Em `escalas-membro.html`, dentro do `<head>` logo após o `<script src=".../vendor/supabase-js-...">`, adicionar:
```html
  <script src="/projetos/acolitos/solicitacoes-core.js"></script>
```
(Mesma pasta/base das outras tags de script da página.)

- [ ] **Step 2: Adicionar o seletor Minhas/Todas acima das abas Próximas/Histórico**

Em `escalas-membro.html`, dentro de `init()`, logo após criar o `title`/`hint` e ANTES do bloco "Abas Próximas / Histórico", inserir o seletor de visão e um container próprio para a visão "Minhas":
```js
  // Seletor de visão: Minhas (pessoal, com ações) | Todas (browse read-only, comportamento atual)
  const visSel = document.createElement('div'); visSel.style.cssText='display:flex;gap:8px;margin:4px 0 12px;';
  const bMinhas = document.createElement('button'); bMinhas.textContent='Minhas';
  const bTodas  = document.createElement('button'); bTodas.textContent='Todas';
  visSel.append(bMinhas, bTodas); main.appendChild(visSel);
  const areaMinhas = document.createElement('div'); main.appendChild(areaMinhas);
  const areaTodas  = document.createElement('div'); main.appendChild(areaTodas);
  function estiloSel(btn, on){
    btn.style.cssText = on
      ? 'flex:1;cursor:pointer;border-radius:8px;padding:9px;background:var(--gold);color:#1a0e10;border:1px solid var(--gold);font-weight:800;font-family:Sora,sans-serif;'
      : 'flex:1;cursor:pointer;border-radius:8px;padding:9px;background:transparent;color:var(--text-muted);border:1px solid var(--border);font-family:Sora,sans-serif;';
  }
  function setVisao(v){
    estiloSel(bMinhas, v==='minhas'); estiloSel(bTodas, v==='todas');
    areaMinhas.style.display = v==='minhas' ? 'block' : 'none';
    areaTodas.style.display  = v==='todas'  ? 'block' : 'none';
    if (v==='minhas' && !areaMinhas.dataset.loaded) { renderMinhas(areaMinhas, ctx); areaMinhas.dataset.loaded='1'; }
  }
  bMinhas.onclick=()=>setVisao('minhas');
  bTodas.onclick=()=>setVisao('todas');
```

Depois: mover o conteúdo atual (as abas Próximas/Histórico + `wrap` + `carregar('futuras')`) para dentro de `areaTodas` em vez de `main` — trocar `main.appendChild(tabs)` por `areaTodas.appendChild(tabs)` e `main.appendChild(wrap)` por `areaTodas.appendChild(wrap)`. No fim do `init`, trocar a chamada final `carregar('futuras')` por `setVisao('minhas')` (default abre em Minhas) e garantir que `carregar('futuras')` roda ao montar `areaTodas` (chamar `carregar('futuras')` imediatamente, já que a área existe mas fica `display:none`).

- [ ] **Step 3: Implementar `renderMinhas` com as 3 sub-abas (esqueleto)**

No `<script>` da página (nível de função, junto às outras), adicionar:
```js
function subTab(label){ const b=document.createElement('button'); b.textContent=label;
  b.style.cssText='flex:1;cursor:pointer;border-radius:8px;padding:8px;font-size:13px;font-family:Sora,sans-serif;';
  return b; }
function estiloSub(b,on){ b.style.background=on?'var(--surface2)':'transparent'; b.style.color=on?'var(--gold-light)':'var(--text-muted)';
  b.style.border='1px solid '+(on?'var(--gold-dim)':'var(--border)'); b.style.fontWeight=on?'700':'400'; }

function renderMinhas(area, ctx){
  area.textContent='';
  const nav=document.createElement('div'); nav.style.cssText='display:flex;gap:6px;margin-bottom:10px;';
  const tMissas=subTab('Minhas missas'), tVagas=subTab('Vagas'), tPed=subTab('Meus pedidos');
  nav.append(tMissas,tVagas,tPed); area.appendChild(nav);
  const body=document.createElement('div'); area.appendChild(body);
  function sel(qual){
    estiloSub(tMissas,qual==='missas'); estiloSub(tVagas,qual==='vagas'); estiloSub(tPed,qual==='pedidos');
    body.textContent=''; const ld=document.createElement('span'); ld.className='loading'; ld.textContent='Carregando...'; body.appendChild(ld);
    if (qual==='missas') carregarMinhasMissas(body, ctx);
    else if (qual==='vagas') carregarVagas(body, ctx);
    else carregarMeusPedidos(body, ctx);
  }
  tMissas.onclick=()=>sel('missas'); tVagas.onclick=()=>sel('vagas'); tPed.onclick=()=>sel('pedidos');
  sel('missas');
}
```

- [ ] **Step 4: Verificar no navegador com login coord de teste**

Servir a branch em localhost. Login com `bot-teste@jcbplimeira.com`. Abrir Escalas → deve mostrar seletor **Minhas | Todas**, com Minhas ativo por padrão e 3 sub-abas (Minhas missas / Vagas / Meus pedidos); **Todas** deve mostrar exatamente a tela antiga. Sem erro no console.
Expected: navegação entre visões/sub-abas funciona; nenhuma ação ainda (próximas tasks).

- [ ] **Step 5: Commit**

```bash
git add projetos/acolitos/escalas-membro.html
git commit -m "feat(acolitos): Escala eu — seletor Minhas/Todas + sub-abas (esqueleto)"
```

---

### Task 6: Minhas missas + ação "Pedir troca" (alerta + confirmação + escolher colega)

**Files:**
- Modify: `projetos/acolitos/escalas-membro.html`

**Interfaces:**
- Consumes: `sb`, `FUNCAO_LABEL`, `dataLabel`, `comLabel`, `uiConfirm`, `uiAlert`, `toast`, RPC `acolitos_solicitar_troca`, roster via `acolitos_roster_substituicao` (para escolher colega habilitado).
- Produces: `carregarMinhasMissas(body, ctx)`, `abrirPedirTroca(escala, ctx)`.

- [ ] **Step 1: Implementar `carregarMinhasMissas`**

Adicionar no `<script>`:
```js
async function carregarMinhasMissas(body, ctx){
  const m = ctx.membro;
  if(!m){ body.textContent=''; const e=document.createElement('span'); e.className='empty'; e.textContent='Perfil não encontrado.'; body.appendChild(e); return; }
  const { data, error } = await sb.from('acolitos_escalas')
    .select('id,funcao, acolitos_celebracoes!inner(id,data,horario,comunidade,tipo)')
    .eq('membro_id', m.id).eq('status','escalado')
    .gte('acolitos_celebracoes.data', hojeStr());
  body.textContent='';
  if(error){ const e=document.createElement('span'); e.className='empty'; e.textContent='Não foi possível carregar.'; body.appendChild(e); return; }
  const linhas = (data||[]).filter(e=>e.acolitos_celebracoes)
    .sort((a,b)=> (a.acolitos_celebracoes.data+a.acolitos_celebracoes.horario).localeCompare(b.acolitos_celebracoes.data+b.acolitos_celebracoes.horario));
  if(!linhas.length){ const e=document.createElement('span'); e.className='empty'; e.textContent='Você não está escalado em nenhuma missa futura.'; body.appendChild(e); return; }
  linhas.forEach(e=>{
    const c=e.acolitos_celebracoes;
    const card=document.createElement('div'); card.className='esc-card'; card.style.cursor='default';
    const dt=document.createElement('div'); dt.className='esc-data'; dt.textContent=dataLabel(c.data)+' · '+c.horario;
    const sub=document.createElement('div'); sub.className='esc-sub'; sub.textContent=comLabel(c.comunidade)+' · '+(FUNCAO_LABEL[e.funcao]||e.funcao);
    const bTroca=document.createElement('button');
    bTroca.textContent='⚠ Pedir troca';
    bTroca.style.cssText='margin-top:10px;width:100%;padding:9px;border-radius:8px;border:1px solid #7a2a34;background:linear-gradient(165deg,rgba(224,96,122,.16),var(--surface2));color:#ff9db0;font-family:Sora,sans-serif;font-weight:700;font-size:12px;cursor:pointer;';
    bTroca.onclick=()=>abrirPedirTroca(e, ctx);
    card.append(dt,sub,bTroca); body.appendChild(card);
  });
}
```

- [ ] **Step 2: Implementar `abrirPedirTroca` (confirmação obrigatória + escolher colega)**

Adicionar no `<script>`:
```js
async function abrirPedirTroca(escala, ctx){
  const ok = await uiConfirm(
    'Tem certeza que não poderá cumprir esta escala?\n\nServir é um compromisso. Só peça troca se realmente não puder.',
    { okText:'Sim, pedir troca', cancelText:'Voltar', danger:true });
  if(!ok) return;
  // roster habilitado na função (via RPC de roster, que já traz habs)
  const { data: r } = await sb.rpc('acolitos_roster_substituicao');
  const membros = (r && r.membros) || []; const habs = (r && r.habs) || [];
  const habSet = new Set(habs.filter(h=>h.funcao===escala.funcao).map(h=>h.membro_id));
  const meId = ctx.membro && ctx.membro.id;
  const elegiveis = membros.filter(mm=> mm.id!==meId && habSet.has(mm.id));

  const ov=document.createElement('div'); ov.className='modal-overlay open';
  ov.onclick=(ev)=>{ if(ev.target===ov) ov.remove(); };
  const modal=document.createElement('div'); modal.className='modal';
  const h=document.createElement('div'); h.className='modal-handle';
  const tt=document.createElement('div'); tt.className='modal-title'; tt.textContent='Com quem trocar?';
  modal.append(h,tt);
  const hint=document.createElement('p'); hint.style.cssText='font-size:12px;color:var(--text-muted);margin:-6px 0 10px;';
  hint.textContent='Escolha um colega habilitado. Ele precisa aceitar e a coordenação homologa. Ou peça pra coordenação cobrir.';
  modal.appendChild(hint);

  async function enviar(alvoId){
    const { data: res } = await sb.rpc('acolitos_solicitar_troca',
      { p_escala_id: escala.id, p_alvo_membro_id: alvoId||null, p_motivo: null });
    ov.remove();
    if(res && res.ok){ toast(alvoId?'Convite enviado ao colega.':'Pedido enviado à coordenação.','success'); }
    else if(res && res.erro==='ja_existe'){ toast('Você já tem um pedido pendente para esta missa.','error'); }
    else { toast('Não foi possível enviar o pedido.','error'); }
  }

  const lista=document.createElement('div'); lista.style.cssText='max-height:46vh;overflow:auto;';
  if(!elegiveis.length){ const e=document.createElement('div'); e.style.cssText='color:var(--text-muted);font-style:italic;padding:8px 0;'; e.textContent='Nenhum colega habilitado nesta função.'; lista.appendChild(e); }
  elegiveis.forEach(mm=>{
    const row=document.createElement('button'); row.style.cssText='display:block;width:100%;text-align:left;padding:10px;margin-bottom:6px;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text);cursor:pointer;';
    row.textContent=(mm.apelido||mm.nome);
    row.onclick=()=>enviar(mm.id);
    lista.appendChild(row);
  });
  modal.appendChild(lista);

  const bCob=document.createElement('button'); bCob.className='btn-sm'; bCob.style.cssText='margin-top:10px;width:100%;';
  bCob.textContent='Não sei quem chamar — pedir à coordenação';
  bCob.onclick=()=>enviar(null);
  const bX=document.createElement('button'); bX.className='btn-sm gray'; bX.style.marginTop='8px'; bX.textContent='Cancelar'; bX.onclick=()=>ov.remove();
  modal.append(bCob,bX);
  ov.appendChild(modal); document.body.appendChild(ov);
}
```

- [ ] **Step 3: Verificar `uiConfirm` suporta `danger`/`okText`/`cancelText`**

Run: `grep -n "function uiConfirm" -A 15 projetos/acolitos/shared.js`
Expected: confirmar os nomes das opções aceitas. **Se os nomes diferirem** (ex.: `confirmText`), ajustar a chamada no Step 2 para os nomes reais antes de prosseguir. (Não inventar opção que não existe.)

- [ ] **Step 4: Verificar no navegador (login coord de teste)**

Servir localhost, login `bot-teste@jcbplimeira.com`. Precisa de uma **escala descartável** onde o usuário de teste esteja escalado. Escala eu → Minhas missas → **⚠ Pedir troca** → confirmação aparece → escolher colega → toast "Convite enviado". Conferir no banco (MCP): 1 linha em `acolitos_solicitacoes` com `status='aguardando_colega'`. Testar também "pedir à coordenação" → `aguardando_cobertura`. Limpar as linhas de teste depois.
Expected: pedidos gravam com o status certo; duplicado dá "já tem pedido pendente".

- [ ] **Step 5: Commit**

```bash
git add projetos/acolitos/escalas-membro.html
git commit -m "feat(acolitos): Escala eu — Minhas missas + Pedir troca (alerta+confirmação+colega/cobertura)"
```

---

### Task 7: Vagas (candidatar) + Meus pedidos (status/cancelar/reenviar + responder convite)

**Files:**
- Modify: `projetos/acolitos/escalas-membro.html`

**Interfaces:**
- Consumes: RPCs `acolitos_vagas_abertas_membro`, `acolitos_candidatar_vaga`, `acolitos_solicitacoes_membro`, `acolitos_solicitacao_cancelar`, `acolitos_solicitacao_reenviar`, `acolitos_troca_responder`; `SolicitacoesCore.STATUS_LABEL/estaPendente`, `FUNCAO_LABEL`, `dataLabel`, `comLabel`, `uiConfirm`, `toast`.
- Produces: `carregarVagas(body, ctx)`, `carregarMeusPedidos(body, ctx)`.

- [ ] **Step 1: Implementar `carregarVagas`**

Adicionar no `<script>`:
```js
async function carregarVagas(body, ctx){
  const { data } = await sb.rpc('acolitos_vagas_abertas_membro');
  const vagas = (data && data.vagas) || [];
  body.textContent='';
  if(!vagas.length){ const e=document.createElement('span'); e.className='empty'; e.textContent='Nenhuma vaga aberta na sua função no momento.'; body.appendChild(e); return; }
  vagas.forEach(v=>{
    const card=document.createElement('div'); card.className='esc-card'; card.style.cursor='default';
    const dt=document.createElement('div'); dt.className='esc-data'; dt.textContent=dataLabel(v.data)+' · '+v.horario;
    const sub=document.createElement('div'); sub.className='esc-sub'; sub.textContent=comLabel(v.comunidade)+' · '+(FUNCAO_LABEL[v.funcao]||v.funcao)+' — vaga em aberto';
    const b=document.createElement('button'); b.className='esc-chamada-btn'; b.textContent='Me candidatar';
    b.onclick=async()=>{ b.disabled=true; b.textContent='...';
      const { data: res } = await sb.rpc('acolitos_candidatar_vaga', { p_celebracao_id:v.celebracao_id, p_funcao:v.funcao, p_motivo:null });
      if(res && res.ok){ toast('Candidatura enviada.','success'); b.textContent='✓ Enviada'; }
      else if(res && res.erro==='ja_candidatou'){ toast('Você já se candidatou.','error'); b.textContent='Já candidatou'; }
      else { toast('Não foi possível candidatar.','error'); b.disabled=false; b.textContent='Me candidatar'; }
    };
    card.append(dt,sub,b); body.appendChild(card);
  });
}
```

- [ ] **Step 2: Implementar `carregarMeusPedidos` (meus pedidos + convites recebidos)**

Adicionar no `<script>`:
```js
async function carregarMeusPedidos(body, ctx){
  const { data } = await sb.rpc('acolitos_solicitacoes_membro');
  const meus=(data&&data.meus)||[]; const convites=(data&&data.convites)||[];
  body.textContent='';
  const SC = window.SolicitacoesCore;

  // Convites recebidos (aceitar/recusar) — accept/reject SÓ aqui
  const hCon=document.createElement('div'); hCon.className='esc-cat'; hCon.textContent='Convites recebidos'; body.appendChild(hCon);
  if(!convites.length){ const e=document.createElement('div'); e.style.cssText='color:var(--text-muted);font-style:italic;font-size:12px;padding:4px 0 8px;'; e.textContent='Nenhum convite.'; body.appendChild(e); }
  convites.forEach(cv=>{
    const row=document.createElement('div'); row.className='esc-card'; row.style.cursor='default';
    const t=document.createElement('div'); t.className='esc-data'; t.textContent=(cv.de_nome||'Colega')+' quer trocar com você';
    const s=document.createElement('div'); s.className='esc-sub'; s.textContent=dataLabel(cv.data)+' · '+cv.horario+' · '+(FUNCAO_LABEL[cv.funcao]||cv.funcao);
    const acts=document.createElement('div'); acts.style.cssText='display:flex;gap:8px;margin-top:10px;';
    const bNo=document.createElement('button'); bNo.className='btn-sm gray'; bNo.style.flex='1'; bNo.textContent='Recusar';
    const bYes=document.createElement('button'); bYes.className='esc-chamada-btn'; bYes.style.flex='1'; bYes.style.marginTop='0'; bYes.textContent='Aceitar';
    async function responder(aceita){ bYes.disabled=bNo.disabled=true;
      const { data: res } = await sb.rpc('acolitos_troca_responder', { p_solicitacao_id:cv.id, p_aceita:aceita });
      if(res && res.ok){ toast(aceita?'Você aceitou. Vai pra coordenação homologar.':'Convite recusado.','success'); carregarMeusPedidos(body,ctx); }
      else { toast('Não foi possível responder.','error'); bYes.disabled=bNo.disabled=false; }
    }
    bNo.onclick=()=>responder(false); bYes.onclick=()=>responder(true);
    acts.append(bNo,bYes); row.append(t,s,acts); body.appendChild(row);
  });

  // Meus pedidos
  const hMy=document.createElement('div'); hMy.className='esc-cat'; hMy.textContent='Meus pedidos'; body.appendChild(hMy);
  if(!meus.length){ const e=document.createElement('div'); e.style.cssText='color:var(--text-muted);font-style:italic;font-size:12px;padding:4px 0;'; e.textContent='Você ainda não fez pedidos.'; body.appendChild(e); }
  meus.forEach(p=>{
    const row=document.createElement('div'); row.className='esc-card'; row.style.cursor='default';
    const t=document.createElement('div'); t.className='esc-data'; t.textContent=(SC.TIPO_LABEL[p.tipo]||p.tipo)+' · '+dataLabel(p.data)+' · '+p.horario;
    const s=document.createElement('div'); s.className='esc-sub'; s.textContent=(FUNCAO_LABEL[p.funcao]||p.funcao)+' — '+(SC.STATUS_LABEL[p.status]||p.status);
    row.append(t,s);
    const acts=document.createElement('div'); acts.style.cssText='display:flex;gap:8px;margin-top:10px;';
    if(p.status==='recusado_colega'){
      const bCob=document.createElement('button'); bCob.className='btn-sm'; bCob.style.flex='1'; bCob.textContent='Pedir à coordenação';
      bCob.onclick=async()=>{ const { data:res }=await sb.rpc('acolitos_solicitacao_reenviar',{p_solicitacao_id:p.id,p_novo_alvo:null});
        if(res&&res.ok){ toast('Enviado à coordenação.','success'); carregarMeusPedidos(body,ctx);} else toast('Falhou.','error'); };
      acts.appendChild(bCob);
    }
    if(SC.estaPendente(p.status)){
      const bCancel=document.createElement('button'); bCancel.className='btn-sm gray'; bCancel.style.flex='1'; bCancel.textContent='Cancelar';
      bCancel.onclick=async()=>{ const ok=await uiConfirm('Cancelar este pedido?'); if(!ok) return;
        const { data:res }=await sb.rpc('acolitos_solicitacao_cancelar',{p_solicitacao_id:p.id});
        if(res&&res.ok){ toast('Cancelado.','success'); carregarMeusPedidos(body,ctx);} else toast('Falhou.','error'); };
      acts.appendChild(bCancel);
    }
    if(acts.children.length) row.appendChild(acts);
    body.appendChild(row);
  });
}
```

- [ ] **Step 3: Verificar no navegador (login coord de teste)**

Servir localhost, login de teste. Escala eu → **Vagas**: aparecem missas com vaga na função habilitada; "Me candidatar" grava candidatura (checar MCP). **Meus pedidos**: mostra os pedidos com rótulo em português; convite recebido mostra Aceitar/Recusar; cancelar remove da lista de pendentes; `recusado_colega` mostra "Pedir à coordenação". Usar dados descartáveis; limpar depois.
Expected: cada ação chama a RPC certa e a lista recarrega com o status novo.

- [ ] **Step 4: Commit**

```bash
git add projetos/acolitos/escalas-membro.html
git commit -m "feat(acolitos): Escala eu — Vagas (candidatar) + Meus pedidos (cancelar/reenviar/responder convite)"
```

---

## Phase 2 — Central do Servo (home do membro)

### Task 8: Aviso de convites na home + relance sem ação

**Files:**
- Modify: `projetos/acolitos/index.html`

**Interfaces:**
- Consumes: `acolitos_solicitacoes_membro()`, `sb`.
- Produces: bloco de aviso em `renderDashboardMembro`; remoção do botão "Ausência".

- [ ] **Step 1: Incluir o core puro em index.html**

No `<head>` de `index.html`, após a tag de script do supabase vendored, adicionar:
```html
  <script src="/projetos/acolitos/solicitacoes-core.js"></script>
```

- [ ] **Step 2: Adicionar o aviso de convites no topo do dashboard do membro**

Em `renderDashboardMembro(ctx)`, logo após `main.appendChild(greet);` e ANTES de `renderRankProgress(main, nivel, m)`, inserir:
```js
  // Aviso: convites de troca que exigem minha resposta (leva à Escala eu; não age aqui)
  if (m) {
    try {
      const { data: sol } = await sb.rpc('acolitos_solicitacoes_membro');
      const nConv = ((sol && sol.convites) || []).length;
      if (nConv > 0) {
        const av = document.createElement('a'); av.href = 'escalas-membro.html';
        av.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:10px;text-decoration:none;background:linear-gradient(165deg,rgba(232,185,74,.16),var(--surface2));border:1px solid var(--gold-dim);border-radius:10px;padding:12px 14px;margin-bottom:16px;';
        const tx = document.createElement('div'); tx.style.cssText='color:var(--gold-light);font-weight:700;font-size:13px;';
        tx.textContent = '⚡ Você tem ' + nConv + (nConv>1?' convites de troca pra responder':' convite de troca pra responder');
        const go = document.createElement('span'); go.style.cssText='color:var(--gold);font-size:12px;white-space:nowrap;'; go.textContent='Ver na escala →';
        av.append(tx, go); main.appendChild(av);
      }
    } catch (e) {}
  }
```

- [ ] **Step 3: Remover o botão "Ausência" das próximas escalas (vira relance)**

Em `renderDashboardMembro`, no bloco "Próximas escalas do membro", remover as duas linhas que criam e anexam o botão de ausência:
```js
        const btn=document.createElement('a'); btn.className='btn-sm gray'; btn.href='ausencias.html'; btn.textContent='Ausência';
        item.append(dt,body,btn); main.appendChild(item);
```
Trocar por (o card inteiro vira link pra Escala eu, sem botão de ação):
```js
        item.append(dt,body);
        item.style.cursor='pointer';
        item.onclick=()=>{ window.location.href='escalas-membro.html'; };
        main.appendChild(item);
```

- [ ] **Step 4: Verificar no navegador (login coord de teste)**

Servir localhost, login de teste que tenha um convite pendente (criar um via Escala eu de outro membro descartável, ou inserir via MCP). Home do membro: mostra o aviso "⚡ Você tem N convite(s)…" clicável → leva à Escala eu; as próximas escalas não têm mais botão "Ausência" e o card leva à Escala eu. Sem aviso quando não há convite.
Expected: aviso condicional aparece/some certo; relance sem botão de ação.

- [ ] **Step 5: Commit**

```bash
git add projetos/acolitos/index.html
git commit -m "feat(acolitos): Central do Servo — aviso de convites na home + relance sem ação"
```

---

## Phase 3 — Caixa de Aprovações (coordenação)

### Task 9: Badge de pendências na home da coordenação

**Files:**
- Modify: `projetos/acolitos/index.html`

**Interfaces:**
- Consumes: `acolitos_solicitacoes_pendentes()`, `acolitos_ausencia_pendente_listar()`, `sb`, `navCaps`.
- Produces: badge no topo de `renderDashboardEquipe`.

- [ ] **Step 1: Adicionar o badge no topo do Painel Operacional**

Em `renderDashboardEquipe(ctx)`, logo após `main.appendChild(title);`, inserir:
```js
  // Badge de pendências → Caixa de Aprovações
  try {
    const [{ data: sol }, { data: aus }] = await Promise.all([
      sb.rpc('acolitos_solicitacoes_pendentes'),
      sb.rpc('acolitos_ausencia_pendente_listar')
    ]);
    const nSol = sol ? (((sol.trocas||[]).length)+((sol.candidaturas||[]).length)+((sol.cobrir||[]).length)) : 0;
    const nAus = aus ? ((aus.pendentes||[]).length) : 0;
    const total = nSol + nAus;
    if (total > 0) {
      const a = document.createElement('a'); a.href='ausencias.html';
      a.style.cssText='display:flex;align-items:center;justify-content:space-between;gap:10px;text-decoration:none;background:linear-gradient(165deg,rgba(224,96,122,.14),var(--surface2));border:1px solid #7a3a44;border-radius:10px;padding:12px 14px;margin-bottom:16px;';
      const t=document.createElement('div'); t.style.cssText='color:#ff9db0;font-weight:800;font-size:14px;'; t.textContent='⚡ '+total+' pendência'+(total>1?'s':'')+' aguardando você';
      const g=document.createElement('span'); g.style.cssText='color:var(--gold);font-size:12px;white-space:nowrap;'; g.textContent='Abrir Caixa →';
      a.append(t,g); main.appendChild(a);
    }
  } catch(e){}
```

- [ ] **Step 2: Verificar no navegador (login coord de teste)**

Servir localhost, login de teste (coord). Com ≥1 pendência (ausência OU solicitação) na base descartável, a home mostra "⚡ N pendências aguardando você" → abre `ausencias.html`. Sem pendências, o badge não aparece.
Expected: contagem soma solicitações + ausências; link abre a Caixa.

- [ ] **Step 3: Commit**

```bash
git add projetos/acolitos/index.html
git commit -m "feat(acolitos): badge de pendências na home da coordenação → Caixa"
```

---

### Task 10: Caixa — grupos Trocas / Candidaturas + decidir

**Files:**
- Modify: `projetos/acolitos/ausencias.html`

**Interfaces:**
- Consumes: `acolitos_solicitacoes_pendentes()`, `acolitos_solicitacao_decidir(id, acao, substituto)`, `SolicitacoesCore`, `FUNCAO_LABEL`/`sb`/`toast` já presentes na página.
- Produces: `renderCaixaSolicitacoes(container)`, chamada a partir do fluxo de render da equipe.

- [ ] **Step 1: Incluir o core puro em ausencias.html**

No `<head>` de `ausencias.html`, após a tag do supabase vendored, adicionar:
```html
  <script src="/projetos/acolitos/solicitacoes-core.js"></script>
```

- [ ] **Step 2: Reestruturar o topo da Caixa e montar grupos Trocas/Candidaturas**

Em `ausencias.html`, no ponto onde a equipe é renderizada (após `renderViewEquipe()` / `renderPendentesPublicas()` no fluxo de `EQUIPE_ROLES.includes(_r) || _r === 'cerimonario'`), adicionar a chamada `renderCaixaSolicitacoes(<container do topo>)` e implementar:
```js
async function renderCaixaSolicitacoes(container){
  const SC = window.SolicitacoesCore;
  const { data } = await sb.rpc('acolitos_solicitacoes_pendentes');
  const trocas=(data&&data.trocas)||[]; const cand=(data&&data.candidaturas)||[]; const cobrir=(data&&data.cobrir)||[];

  function grupo(titulo, itens, montarItem){
    if(!itens.length) return;
    const h=document.createElement('div'); h.style.cssText='font-family:Sora,sans-serif;font-weight:800;font-size:13px;color:var(--gold-light);margin:16px 0 8px;';
    h.textContent=titulo+' ('+itens.length+')'; container.appendChild(h);
    itens.forEach(it=>container.appendChild(montarItem(it)));
  }
  function fmt(it){ return dataLabel(it.data)+' · '+it.horario+' · '+comLabel(it.comunidade); }
  function card(){ const c=document.createElement('div'); c.style.cssText='background:var(--surface);border:1px solid var(--border-wine);border-radius:10px;padding:12px;margin-bottom:8px;'; return c; }
  function acoes(){ const a=document.createElement('div'); a.style.cssText='display:flex;gap:8px;margin-top:10px;'; return a; }

  async function decidir(id, acao, substituto, onOk){
    const { data:res } = await sb.rpc('acolitos_solicitacao_decidir', { p_solicitacao_id:id, p_acao:acao, p_substituto_id:substituto||null });
    if(res && res.ok){ toast('Feito.','success'); onOk(); } else { toast('Não foi possível decidir.','error'); }
  }

  // 🔄 Trocas aguardando homologação (colega já aceitou)
  grupo('🔄 Trocas aguardando você', trocas, (it)=>{
    const c=card();
    const t=document.createElement('div'); t.style.fontWeight='700'; t.textContent=(it.de_nome||'?')+' → '+(it.alvo_nome||'?');
    const s=document.createElement('div'); s.style.cssText='font-size:12px;color:var(--gold);'; s.textContent=fmt(it)+' · '+(FUNCAO_LABEL[it.funcao]||it.funcao);
    const a=acoes();
    const ok=document.createElement('button'); ok.className='btn-sm'; ok.style.flex='1'; ok.textContent='Homologar';
    const no=document.createElement('button'); no.className='btn-sm gray'; no.style.flex='1'; no.textContent='Negar';
    ok.onclick=()=>decidir(it.id,'homologar',null,()=>c.remove());
    no.onclick=()=>decidir(it.id,'negar',null,()=>c.remove());
    a.append(ok,no); c.append(t,s,a); return c;
  });

  // 🙋 Candidaturas a vaga
  grupo('🙋 Candidaturas a vaga', cand, (it)=>{
    const c=card();
    const t=document.createElement('div'); t.style.fontWeight='700'; t.textContent=(it.de_nome||'?')+' quer '+(FUNCAO_LABEL[it.funcao]||it.funcao);
    const s=document.createElement('div'); s.style.cssText='font-size:12px;color:var(--gold);'; s.textContent=fmt(it);
    const a=acoes();
    const ok=document.createElement('button'); ok.className='btn-sm'; ok.style.flex='1'; ok.textContent='Aprovar';
    const no=document.createElement('button'); no.className='btn-sm gray'; no.style.flex='1'; no.textContent='Negar';
    ok.onclick=()=>decidir(it.id,'aprovar_candidatura',null,()=>c.remove());
    no.onclick=()=>decidir(it.id,'negar',null,()=>c.remove());
    a.append(ok,no); c.append(t,s,a); return c;
  });

  // 🛟 Cobrir — tratado na Task 11 (auto-troca)
  renderCaixaCobrir(container, cobrir);
}
function renderCaixaCobrir(container, cobrir){ /* implementado na Task 11 */ }
```

**Nota:** confirmar que `dataLabel`/`comLabel` existem em `ausencias.html`; se não, copiá-las do padrão de `escalas-membro.html` (linhas 52–53). `FUNCAO_LABEL` idem.

- [ ] **Step 3: Verificar no navegador (login coord de teste)**

Servir localhost, login coord. Com uma troca `aguardando_coordenacao` e uma candidatura `aguardando_coordenacao` na base descartável, a Caixa mostra os grupos 🔄 e 🙋. Homologar a troca → checar MCP: escala do ausente vira `substituido`, colega inserido; solicitação `homologado`. Aprovar candidatura → nova linha `escalado`; solicitação `aprovado`. Negar → `negado`. Limpar dados de teste.
Expected: cada botão efetiva a mutação certa e some da lista.

- [ ] **Step 4: Commit**

```bash
git add projetos/acolitos/ausencias.html
git commit -m "feat(acolitos): Caixa — grupos Trocas e Candidaturas com decidir (homologar/aprovar/negar)"
```

---

### Task 11: Caixa — grupo Cobrir com auto-troca (motor Spec B)

**Files:**
- Modify: `projetos/acolitos/ausencias.html`

**Interfaces:**
- Consumes: `GeradorSubstituto.escolherSubstituto`, o `ctxBuilder` já existente em `ausencias.html` (o mesmo usado na auto-troca ao aprovar ausência), `acolitos_solicitacao_decidir(id,'confirmar_cobertura',substituto)`.
- Produces: `renderCaixaCobrir(container, cobrir)` (substitui o stub da Task 10).

- [ ] **Step 1: Localizar o ctxBuilder/roster já usado na auto-troca**

Run: `grep -n "escolherSubstituto\|ctxBuilder\|roster\|dispMap\|cargaMap\|acolitos_roster_substituicao" projetos/acolitos/ausencias.html`
Expected: identificar a função/local que monta o `ctx` do motor (roster/habMap/dispMap/cargaMap). A cobertura reusa exatamente esse builder — **não** montar um novo do zero.

- [ ] **Step 2: Implementar `renderCaixaCobrir` (sugestão do motor + confirmar/trocar)**

Substituir o stub `renderCaixaCobrir` por:
```js
async function renderCaixaCobrir(container, cobrir){
  if(!cobrir.length) return;
  const h=document.createElement('div'); h.style.cssText='font-family:Sora,sans-serif;font-weight:800;font-size:13px;color:var(--gold-light);margin:16px 0 8px;';
  h.textContent='🛟 Cobrir / auto-troca ('+cobrir.length+')'; container.appendChild(h);

  for (const it of cobrir){
    const c=document.createElement('div'); c.style.cssText='background:var(--surface);border:1px solid var(--border-wine);border-radius:10px;padding:12px;margin-bottom:8px;';
    const t=document.createElement('div'); t.style.fontWeight='700'; t.textContent='Vaga de '+(it.de_nome||'?')+' — '+(FUNCAO_LABEL[it.funcao]||it.funcao);
    const s=document.createElement('div'); s.style.cssText='font-size:12px;color:var(--gold);'; s.textContent=dataLabel(it.data)+' · '+it.horario+' · '+comLabel(it.comunidade);
    c.append(t,s);
    const sug=document.createElement('div'); sug.style.cssText='font-size:13px;margin-top:8px;'; sug.textContent='Calculando sugestão...'; c.appendChild(sug);

    // usa o MESMO builder de contexto da auto-troca de ausência (roster/hab/disp/carga)
    let sugeridoId=null;
    try {
      const ctxMotor = await construirCtxMotor(it.funcao, it.celebracao_id, it.data, it.comunidade, it.membro_id);
      const r = GeradorSubstituto.escolherSubstituto(ctxMotor);
      sugeridoId = r.membroId || null;
      sug.textContent = sugeridoId ? ('Sugerido: '+nomeDoMembro(sugeridoId)) : 'Sem candidato disponível (vaga ficará vazia)';
    } catch(e){ sug.textContent='Não foi possível calcular sugestão.'; }

    const a=document.createElement('div'); a.style.cssText='display:flex;gap:8px;margin-top:10px;';
    const ok=document.createElement('button'); ok.className='btn-sm'; ok.style.flex='1'; ok.textContent=sugeridoId?'Confirmar':'Deixar vago';
    const no=document.createElement('button'); no.className='btn-sm gray'; no.style.flex='1'; no.textContent='Negar';
    ok.onclick=async()=>{ const { data:res }=await sb.rpc('acolitos_solicitacao_decidir',{p_solicitacao_id:it.id,p_acao:'confirmar_cobertura',p_substituto_id:sugeridoId});
      if(res&&res.ok){ toast('Cobertura confirmada.','success'); c.remove(); } else toast('Falhou.','error'); };
    no.onclick=async()=>{ const { data:res }=await sb.rpc('acolitos_solicitacao_decidir',{p_solicitacao_id:it.id,p_acao:'negar',p_substituto_id:null});
      if(res&&res.ok){ toast('Negado.','success'); c.remove(); } else toast('Falhou.','error'); };
    a.append(ok,no); c.appendChild(a); container.appendChild(c);
  }
}
```

**Nota de integração:** `construirCtxMotor(funcao, celebracaoId, data, comunidade, membroAusenteId)` e `nomeDoMembro(id)` devem ser adaptados do builder existente identificado no Step 1 (o mesmo roster/habMap/dispMap/cargaMap da auto-troca de ausência). Se o builder atual estiver acoplado ao fluxo de aprovação, extraí-lo para uma função reutilizável e chamá-lo dos dois lugares (DRY) — sem duplicar as regras.

- [ ] **Step 3: Verificar no navegador (login coord de teste)**

Servir localhost, login coord. Com uma solicitação `aguardando_cobertura` na base descartável, a Caixa mostra 🛟 Cobrir com a sugestão do motor. Confirmar → checar MCP: ausente `substituido`, sugerido inserido, solicitação `coberto`. Testar caso sem candidato (vaga vazia) e Negar. Limpar depois.
Expected: sugestão do motor bate com a lógica da Spec B; confirmar efetiva; negar fecha.

- [ ] **Step 4: Commit**

```bash
git add projetos/acolitos/ausencias.html
git commit -m "feat(acolitos): Caixa — grupo Cobrir com auto-troca (reusa motor Spec B)"
```

---

### Task 12: Caixa — agregar novos cadastros (CRM) + carimbar BUILD

**Files:**
- Modify: `projetos/acolitos/ausencias.html`

**Interfaces:**
- Consumes: CRM etapa `aprovacao_cadastro` (padrão já usado em `crm.html`).
- Produces: grupo 🆕 Novos cadastros na Caixa, com atalho de decisão (ou link pro CRM se a decisão for complexa).

- [ ] **Step 1: Ver como o CRM lista/decide novos cadastros**

Run: `grep -n "aprovacao_cadastro\|acolitos_crm\|etapa" projetos/acolitos/crm.html | head -20`
Expected: identificar a query de listagem (`acolitos_crm` etapa=`aprovacao_cadastro`) e a ação de aprovar/rejeitar (avançar etapa). Reusar a mesma lógica; se a aprovação exigir passos do CRM, o item na Caixa mostra o novo cadastro com um botão **"Abrir no CRM →"** em vez de decidir inline.

- [ ] **Step 2: Implementar o grupo Novos cadastros**

Adicionar em `renderCaixaSolicitacoes` (após `renderCaixaCobrir(container, cobrir);`):
```js
  // 🆕 Novos cadastros aguardando aprovação (fonte: CRM)
  try {
    const { data: novos } = await sb.from('acolitos_crm')
      .select('id,nome,criado_em').eq('etapa','aprovacao_cadastro').order('criado_em');
    if ((novos||[]).length){
      const h=document.createElement('div'); h.style.cssText='font-family:Sora,sans-serif;font-weight:800;font-size:13px;color:var(--gold-light);margin:16px 0 8px;';
      h.textContent='🆕 Novos cadastros ('+novos.length+')'; container.appendChild(h);
      novos.forEach(n=>{
        const c=document.createElement('div'); c.style.cssText='background:var(--surface);border:1px solid var(--border-wine);border-radius:10px;padding:12px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;gap:10px;';
        const t=document.createElement('div'); t.style.fontWeight='700'; t.textContent=n.nome||'(sem nome)';
        const b=document.createElement('a'); b.className='btn-sm'; b.href='crm.html'; b.textContent='Abrir no CRM →';
        c.append(t,b); container.appendChild(c);
      });
    }
  } catch(e){}
```

**Nota:** confirmar o nome real da coluna do nome em `acolitos_crm` no Step 1 (pode ser `nome`, `membro_nome`, etc.) e ajustar. Se o campo não existir, mostrar o que o CRM usa.

- [ ] **Step 3: Verificar no navegador + carimbar BUILD**

Servir localhost, login coord. Com um cadastro descartável em `aprovacao_cadastro`, a Caixa mostra 🆕 Novos cadastros com "Abrir no CRM →". Depois carimbar o BUILD conforme o padrão do repo (mesma convenção dos commits `chore(acolitos): carimba BUILD ...` — ver como o campo BUILD é definido em `shared.js`/HTML).
Run: `grep -rn "BUILD" projetos/acolitos/shared.js projetos/acolitos/index.html | head`
Expected: achar onde o carimbo de BUILD vive e atualizá-lo (só quando o dono pedir deploy).

- [ ] **Step 4: Commit**

```bash
git add projetos/acolitos/ausencias.html
git commit -m "feat(acolitos): Caixa — agrega novos cadastros do CRM (5 fontes completas)"
```

---

## Self-review notes (cobertura do spec)

- Escala eu (Minhas/Todas, ações) → Tasks 5–7. ✅
- Pedir troca (alerta+confirmação, colega/cobertura) + fallback 2+1 (reenviar/cobrir) → Tasks 6–7 + RPCs Task 3. ✅
- Candidatura a vaga (modelos − preenchidas, habilitação) → RPC Task 3 + UI Task 7. ✅
- Central do Servo (aviso de convites, relance sem ação, mantém jornada/KPIs) → Task 8. ✅
- Caixa unificada, 5 fontes (ausências existentes + trocas + candidaturas + cobrir + novos) → Tasks 9–12; ausências permanecem no fluxo atual da página. ✅
- Máquina de estados + tabela + RLS + RPCs (self-gated / coordenação) → Tasks 2–4. ✅
- Reuso auto-troca (Spec B) e `acolitos_aplicar_troca_escala` → Tasks 4 e 11. ✅
- Notificações in-app → aviso derivado de `acolitos_solicitacoes` na home (Task 8); popup via `enqueueNotif` fica como follow-up opcional (não bloqueia o spec).
- Segurança (self-gated, RLS, textContent) → Tasks 2–12. ✅

**Follow-ups não bloqueantes:** popup `enqueueNotif` de convite ao abrir o app; "Todas" ganhar deep-link pra Escala eu de uma missa específica; aposentar a página pública `/ausencias` (segue existindo).
