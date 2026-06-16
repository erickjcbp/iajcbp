# Competências como Virtudes da Jornada — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer as competências (virtudes) serem formadas pela jornada: quests dão progresso (evidência), a coordenação sela; limiar configurável; aposenta Habilidades.

**Architecture:** Uma RPC nova deriva o progresso por virtude (quests concluídas que a carregam, desde uma data de início). O selo é gravado no array existente `competencias_desenvolvidas`. Editor da Jornada mostra progresso + selo; perfil do membro mostra formadas + em formação. Sem tabela nova.

**Tech Stack:** HTML/JS vanilla, supabase-js, Postgres (RPC SECURITY DEFINER via migration), Supabase ref `fttjgsotuosjfrasttds`.

---

## Contexto técnico (ler antes)
- `acolitos_missao_progresso(missao_id, membro_id, status, concluida_em timestamptz, ...)` — conclusão = `status='concluida'`.
- `acolitos_missoes.criterio->>'competencia'` = virtude que a quest trabalha (já preenchido em muitas quests).
- `acolitos_membros.competencias_desenvolvidas text[]` = **virtudes seladas** (reusar).
- `acolitos_listas(tipo='competencia', valor, label, meta jsonb)` — `meta.faixa` já existe; adicionar `meta.limiar`.
- `acolitos_config(chave text, valor jsonb)` — kv. `cfg(chave,padrao)` (shared.js:1167) lê do `_APP_CONFIG`.
- Editor atual: `jornada-admin.html` `abrirCompetenciasEditor` (l.626-649) e `renderCompLista` (l.652-674).
- Perfil do membro: `shared.js` `buildEngajamentoEl` (l.191-213), chips em l.208-211. `sec(title)` e `box` estão no escopo da função.

Convenções: commits PT terminando com `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`; commitar na `main`. Migration local sequencial: próximo número **044**. Aplicar no banco via Supabase MCP (`apply_migration`) e versionar o arquivo em `docs/migrations/`.

Sintaxe JS (raiz do repo):
```bash
node -e "const fs=require('fs');for(const f of ['projetos/acolitos/jornada-admin.html','projetos/acolitos/shared.js']){const h=fs.readFileSync(f,'utf8');const m=f.endsWith('.js')?[h]:(h.match(/<script>([\s\S]*?)<\/script>/g)||[]).map(s=>s.replace(/^<script>/,'').replace(/<\/script>$/,''));let ok=true;m.forEach((c,i)=>{if(!c.trim())return;try{new Function(c);}catch(e){ok=false;console.log(f,'bloco',i,e.message);}});console.log(f, ok?'OK':'FALHOU');}"
```

---

## File Structure
- Create: `docs/migrations/044_acolitos_competencias_virtudes.sql` — RPC `acolitos_competencias_progresso` + seeds de config.
- Modify: `projetos/acolitos/jornada-admin.html` — editor de virtudes (progresso+selo) e limiar na lista.
- Modify: `projetos/acolitos/shared.js` — perfil do membro (formadas + em formação; sem habilidades).
- Verify: `projetos/acolitos/membros.html` — aposentar habilidades se ainda exibidas.

---

## Task 1: Migration 044 — RPC de progresso + seeds de config

**Files:** Create `docs/migrations/044_acolitos_competencias_virtudes.sql`

- [ ] **Step 1: Escrever o SQL da migration**

Conteúdo de `docs/migrations/044_acolitos_competencias_virtudes.sql`:
```sql
-- Competências como Virtudes da Jornada: progresso derivado de quests + selo manual.
-- Sem mudança de schema. RPC SECURITY DEFINER + seeds de config.

create or replace function public.acolitos_competencias_progresso(p_membro uuid)
returns jsonb
language sql stable security definer set search_path to 'public'
as $$
  with params as (
    select
      coalesce((select (valor #>> '{}')::int  from acolitos_config where chave='competencia_limiar_padrao'), 3) as padrao,
      coalesce((select (valor #>> '{}')::date from acolitos_config where chave='competencia_inicio'), current_date) as inicio
  ),
  formadas as (
    select coalesce(competencias_desenvolvidas, '{}'::text[]) as arr
    from acolitos_membros where id = p_membro
  ),
  prog as (
    select m.criterio->>'competencia' as comp, count(distinct mp.missao_id) as n
    from acolitos_missao_progresso mp
    join acolitos_missoes m on m.id = mp.missao_id
    cross join params p
    where mp.membro_id = p_membro
      and mp.status = 'concluida'
      and mp.concluida_em >= p.inicio
      and m.criterio ? 'competencia'
      and (m.criterio->>'competencia') <> ''
    group by 1
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'valor', l.valor,
      'label', coalesce(l.label, l.valor),
      'progresso', coalesce(pr.n, 0),
      'limiar', greatest(1, coalesce((l.meta->>'limiar')::int, p.padrao)),
      'formada', l.valor = any((select arr from formadas)),
      'status', case
         when l.valor = any((select arr from formadas)) then 'formada'
         when coalesce(pr.n,0) >= greatest(1, coalesce((l.meta->>'limiar')::int, p.padrao)) then 'candidata'
         when coalesce(pr.n,0) > 0 then 'em_formacao'
         else 'nenhuma' end
    ) order by l.label), '[]'::jsonb)
  from acolitos_listas l
  cross join params p
  left join prog pr on pr.comp = l.valor
  where l.tipo = 'competencia';
$$;

revoke execute on function public.acolitos_competencias_progresso(uuid) from public, anon;
grant  execute on function public.acolitos_competencias_progresso(uuid) to authenticated;

-- seeds (idempotentes) — só criam se não existirem
insert into acolitos_config (chave, valor)
  select 'competencia_limiar_padrao', '3'::jsonb
  where not exists (select 1 from acolitos_config where chave='competencia_limiar_padrao');
insert into acolitos_config (chave, valor)
  select 'competencia_inicio', to_jsonb(current_date::text)
  where not exists (select 1 from acolitos_config where chave='competencia_inicio');
```

- [ ] **Step 2: Aplicar no banco via Supabase MCP**

Usar `mcp__plugin_supabase_supabase__apply_migration` com `project_id='fttjgsotuosjfrasttds'`, `name='acolitos_competencias_virtudes'` e o `query` = conteúdo do arquivo acima.

- [ ] **Step 3: Testar a RPC como authenticated num membro com quests concluídas**

Via `execute_sql` (project `fttjgsotuosjfrasttds`):
```sql
set local role authenticated;
select jsonb_pretty(acolitos_competencias_progresso(
  (select membro_id from acolitos_missao_progresso where status='concluida' limit 1)
));
```
Expected: array de virtudes com `progresso/limiar/status`. (Como `competencia_inicio` = hoje, o progresso pode vir 0 até haver conclusões novas — confirmar que NÃO dá erro e a estrutura está correta. Para validar a contagem, rodar uma vez com `inicio` antigo: `select acolitos_competencias_progresso(...)` após `update acolitos_config set valor=to_jsonb('2020-01-01'::text) where chave='competencia_inicio'` num teste e reverter.)

- [ ] **Step 4: Conferir grants**
```sql
select has_function_privilege('authenticated','public.acolitos_competencias_progresso(uuid)','execute') as auth,
       has_function_privilege('anon','public.acolitos_competencias_progresso(uuid)','execute') as anon;
```
Expected: `auth=true, anon=false`.

- [ ] **Step 5: Commit**
```bash
git add docs/migrations/044_acolitos_competencias_virtudes.sql
git commit -m "feat(acolitos): RPC de progresso de competências (virtudes pela jornada) + config

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Jornada — editor de virtudes (progresso + selo)

**Files:** Modify `projetos/acolitos/jornada-admin.html`

- [ ] **Step 1: Substituir `abrirCompetenciasEditor` (l.626-649) pela versão com progresso + selo**

Trocar a função inteira por:
```js
// [Virtudes] = progresso vem das quests; coordenação SELA quando formada (grava em competencias_desenvolvidas)
async function abrirCompetenciasEditor(m, onSaved) {
  const feitas = new Set(m.competencias_desenvolvidas || []);
  const ov = document.createElement('div'); ov.className = 'modal-overlay open'; ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
  const md = document.createElement('div'); md.className = 'modal'; md.style.maxWidth = '460px';
  const tt = document.createElement('div'); tt.className = 'modal-title'; tt.textContent = 'Virtudes de ' + m.nome; md.appendChild(tt);
  const sub = document.createElement('p'); sub.style.cssText = 'font-size:12px;color:var(--text-muted);margin:-6px 0 10px;'; sub.textContent = 'O progresso vem das quests. Confirme quando a virtude estiver formada.'; md.appendChild(sub);
  const box = document.createElement('div'); box.style.cssText = 'max-height:55vh;overflow-y:auto;'; box.innerHTML = '<span class="loading">Carregando...</span>'; md.appendChild(box);
  const { data } = await sb.rpc('acolitos_competencias_progresso', { p_membro: m.id });
  const comps = (data || []).slice();
  const ordem = { candidata: 0, em_formacao: 1, formada: 2, nenhuma: 3 };
  comps.sort((a, b) => (ordem[a.status] - ordem[b.status]) || a.label.localeCompare(b.label));
  box.textContent = '';
  if (!comps.length) { const e = document.createElement('div'); e.style.cssText = 'font-size:12px;color:var(--text-muted);'; e.textContent = 'Nenhuma competência cadastrada.'; box.appendChild(e); }
  comps.forEach(c => {
    const r = document.createElement('div'); r.style.cssText = 'display:flex;align-items:center;gap:10px;padding:9px 4px;border-bottom:1px solid var(--border);';
    const info = document.createElement('div'); info.style.cssText = 'flex:1;min-width:0;';
    const nm = document.createElement('div'); nm.style.cssText = 'font-size:13px;color:var(--text);font-weight:600;'; nm.textContent = c.label;
    const meta = document.createElement('div'); meta.style.cssText = 'font-size:10px;color:var(--text-muted);margin-top:2px;';
    const bw = document.createElement('div'); bw.style.cssText = 'height:6px;border-radius:3px;background:var(--surface2);overflow:hidden;margin-top:4px;max-width:170px;';
    const bar = document.createElement('div'); const pct = Math.min(100, Math.round(100 * c.progresso / Math.max(1, c.limiar))); bar.style.cssText = 'height:100%;background:var(--gold);width:' + pct + '%;'; bw.appendChild(bar);
    const btn = document.createElement('button'); btn.style.cssText = 'flex:none;font-family:Oxanium,sans-serif;font-weight:700;font-size:11px;padding:5px 10px;border-radius:6px;cursor:pointer;';
    const upd = () => {
      const sld = feitas.has(c.valor);
      meta.textContent = sld ? '✅ formada' : (c.status === 'candidata' ? '🟡 candidata · ' + c.progresso + '/' + c.limiar : c.progresso + '/' + c.limiar + ' quests');
      btn.textContent = sld ? 'Retirar selo' : 'Confirmar';
      btn.style.background = sld ? 'transparent' : 'linear-gradient(180deg,var(--gold),#9a7a1e)';
      btn.style.color = sld ? 'var(--gold-light)' : '#2a1a00';
      btn.style.border = sld ? '1px solid var(--gold-dim)' : 'none';
    };
    upd();
    btn.onclick = () => { if (feitas.has(c.valor)) feitas.delete(c.valor); else feitas.add(c.valor); upd(); };
    info.append(nm, meta, bw); r.append(info, btn); box.appendChild(r);
  });
  const save = document.createElement('button'); save.className = 'btn gold'; save.style.cssText = 'width:100%;margin-top:14px;'; save.textContent = 'Salvar';
  save.onclick = async () => {
    save.disabled = true; save.textContent = 'Salvando...';
    const patch = { competencias_desenvolvidas: [...feitas] };
    const { error } = await sb.from('acolitos_membros').update(patch).eq('id', m.id);
    if (error) { toast('Erro ao salvar.', 'error'); save.disabled = false; save.textContent = 'Salvar'; return; }
    Object.assign(m, patch); toast('✓ Salvo!'); ov.remove(); if (onSaved) onSaved();
  };
  md.appendChild(save); ov.appendChild(md); document.body.appendChild(ov);
}
```

- [ ] **Step 2: Validar sintaxe** (comando acima). Expected: `jornada-admin.html OK`.

- [ ] **Step 3: Commit**
```bash
git add projetos/acolitos/jornada-admin.html
git commit -m "feat(acolitos): editor de virtudes com progresso de quests + selo da coordenação

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Jornada — limiar por competência + padrão global na lista

**Files:** Modify `projetos/acolitos/jornada-admin.html`

- [ ] **Step 1: Adicionar limiar por competência em `renderCompLista` (l.656-666, dentro do `forEach`)**

Trocar o bloco do `forEach(item => { ... row.append(nm, fsel, del); ... })` por (inserindo o input `lim` antes do `del`):
```js
  (data || []).forEach(item => {
    const fx = item.meta && item.meta.faixa;
    const row = document.createElement('div'); row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:7px 2px;border-bottom:1px solid var(--border);';
    const nm = document.createElement('span'); nm.style.cssText = 'flex:1;font-size:13px;color:var(--text);'; nm.textContent = item.label || item.valor;
    const fsel = document.createElement('select'); fsel.style.cssText = 'font-size:11px;padding:4px;background:var(--surface);border:1px solid var(--border-wine);border-radius:4px;color:var(--text);';
    FAIXAS_DEV.forEach(([v, l]) => { const o = document.createElement('option'); o.value = v; o.textContent = l; if (v === fx) o.selected = true; fsel.appendChild(o); });
    if (!fx) { const o = document.createElement('option'); o.value = ''; o.textContent = '— faixa —'; o.selected = true; fsel.insertBefore(o, fsel.firstChild); }
    fsel.onchange = async () => { await sb.from('acolitos_listas').update({ meta: Object.assign({}, item.meta || {}, { faixa: fsel.value }) }).eq('id', item.id); toast('✓ Faixa atualizada'); };
    const lim = document.createElement('input'); lim.type = 'number'; lim.min = '1'; lim.value = (item.meta && item.meta.limiar) || ''; lim.title = 'Limiar: quests p/ virar candidata (vazio = padrão global)'; lim.placeholder = 'lim'; lim.style.cssText = 'width:50px;font-size:11px;padding:4px;background:var(--surface);border:1px solid var(--border-wine);border-radius:4px;color:var(--text);';
    lim.onchange = async () => { const v = lim.value === '' ? null : Math.max(1, parseInt(lim.value, 10) || 1); await sb.from('acolitos_listas').update({ meta: Object.assign({}, item.meta || {}, { limiar: v }) }).eq('id', item.id); item.meta = Object.assign({}, item.meta || {}, { limiar: v }); toast('✓ Limiar atualizado'); };
    const del = mini('−', true); del.onclick = async () => { if (!confirm('Remover competência "' + (item.label || item.valor) + '"?')) return; await sb.from('acolitos_listas').delete().eq('id', item.id); renderCompLista(b); };
    row.append(nm, fsel, lim, del); b.appendChild(row);
  });
```

- [ ] **Step 2: Adicionar editor do limiar padrão global no topo de `renderCompLista` (logo após `b.textContent='';`)**

Inserir após `b.textContent = '';` (l.653) e antes do `const { data } = ...`:
```js
  const padraoAtual = (typeof cfg === 'function') ? (cfg('competencia_limiar_padrao', 3)) : 3;
  const head = document.createElement('div'); head.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:10px;font-size:12px;color:var(--text-muted);';
  const ht = document.createElement('span'); ht.textContent = 'Limiar padrão (quests p/ candidata):';
  const hi = document.createElement('input'); hi.type = 'number'; hi.min = '1'; hi.value = padraoAtual; hi.style.cssText = 'width:56px;font-size:12px;padding:4px;background:var(--surface);border:1px solid var(--border-wine);border-radius:4px;color:var(--text);';
  hi.onchange = async () => { const v = Math.max(1, parseInt(hi.value, 10) || 1); const { error } = await sb.from('acolitos_config').upsert({ chave: 'competencia_limiar_padrao', valor: v }, { onConflict: 'chave' }); if (error) { toast('Erro ao salvar limiar.', 'error'); return; } if (typeof _APP_CONFIG === 'object' && _APP_CONFIG) _APP_CONFIG['competencia_limiar_padrao'] = v; toast('✓ Limiar padrão atualizado'); };
  head.append(ht, hi); b.appendChild(head);
```
NOTA: confirmar que `acolitos_config` tem unique em `chave` (o `onConflict:'chave'` exige). Se não tiver, ajustar a migration 044 para adicionar `unique(chave)` ou usar update/insert manual. Verificar no Step 3.

- [ ] **Step 3: Verificar unique de `chave` em acolitos_config**

Via `execute_sql`:
```sql
select indexdef from pg_indexes where tablename='acolitos_config';
```
Se não houver índice único em `chave`, adicionar à migration 044 (e reaplicar): `alter table acolitos_config add constraint acolitos_config_chave_key unique (chave);` (só se não existir).

- [ ] **Step 4: Validar sintaxe + commit**
```bash
git add projetos/acolitos/jornada-admin.html
git commit -m "feat(acolitos): limiar de virtude por competência + padrão global na Jornada

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Perfil do membro — virtudes formadas + em formação; aposenta habilidades

**Files:** Modify `projetos/acolitos/shared.js`

- [ ] **Step 1: Trocar os chips (l.208-211) por só as virtudes formadas + bloco assíncrono de "em formação"**

Trocar:
```js
  chips('Habilidades a desenvolver', membro.desenvolvimento_habilidades, HABILIDADE_LABEL);
  chips('Habilidades desenvolvidas', membro.habilidades_desenvolvidas, HABILIDADE_LABEL, true);
  chips('Competências a desenvolver', membro.desenvolvimento_competencias, COMPETENCIA_LABEL);
  chips('Competências desenvolvidas', membro.competencias_desenvolvidas, COMPETENCIA_LABEL, true);
  return box;
```
por:
```js
  chips('✨ Virtudes formadas', membro.competencias_desenvolvidas, COMPETENCIA_LABEL, true);
  // Em formação: progresso vindo das quests (assíncrono; degrada se indisponível)
  if (membro && membro.id && typeof sb !== 'undefined') {
    (async () => {
      try {
        const { data } = await sb.rpc('acolitos_competencias_progresso', { p_membro: membro.id });
        const emForm = (data || []).filter(c => c.status === 'em_formacao' || c.status === 'candidata');
        if (!emForm.length) return;
        sec('Em formação');
        const w = document.createElement('div'); w.style.cssText = 'display:flex;flex-direction:column;gap:6px;';
        emForm.forEach(c => {
          const line = document.createElement('div'); line.style.cssText = 'display:flex;align-items:center;gap:8px;';
          const lab = document.createElement('span'); lab.style.cssText = 'font-size:11px;color:var(--gold);min-width:110px;'; lab.textContent = c.label + (c.status === 'candidata' ? ' 🟡' : '');
          const bwp = document.createElement('div'); bwp.style.cssText = 'flex:1;height:6px;border-radius:3px;background:var(--surface2);overflow:hidden;';
          const bb = document.createElement('div'); const pct = Math.min(100, Math.round(100 * c.progresso / Math.max(1, c.limiar))); bb.style.cssText = 'height:100%;background:var(--gold);width:' + pct + '%;'; bwp.appendChild(bb);
          const n = document.createElement('span'); n.style.cssText = 'font-size:10px;color:var(--text-muted);'; n.textContent = c.progresso + '/' + c.limiar;
          line.append(lab, bwp, n); w.appendChild(line);
        });
        box.appendChild(w);
      } catch (e) {}
    })();
  }
  return box;
```

- [ ] **Step 2: Validar sintaxe** (comando acima). Expected: `shared.js OK`.

- [ ] **Step 3: Commit**
```bash
git add projetos/acolitos/shared.js
git commit -m "feat(acolitos): perfil mostra virtudes formadas + em formação (quests); remove habilidades

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Aposentar habilidades remanescentes (verificação)

**Files:** Verify/Modify `projetos/acolitos/membros.html`

- [ ] **Step 1: Verificar se a aba Evolução de membros.html ainda exibe/edita habilidades**

Run:
```bash
grep -n "Evolução\|habilidade\|HABILIDADE" projetos/acolitos/membros.html | head -30
```
Avaliar: se houver uma aba/seção que renderiza chips/checklists de **habilidades** para edição, ela é redundante (Funções já cobre). Se a aba Evolução já tiver saído (memória diz que migrou para a Jornada) e só restarem helpers de lista não usados, não mexer.

- [ ] **Step 2: Se ainda exibir habilidades ao usuário, remover apenas a parte de habilidades**

Editar o ponto onde habilidades são renderizadas para o usuário (NÃO as competências), mantendo competências intactas. Mostrar o trecho exato encontrado no Step 1 e remover só o bloco de habilidades. Se nada exibe habilidades ao usuário, registrar "nada a fazer" e pular o commit.

- [ ] **Step 3: Validar sintaxe (se houve edição) + commit**
```bash
git add projetos/acolitos/membros.html
git commit -m "chore(acolitos): aposenta exibição de habilidades (redundante com Funções)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review (preenchido)

**1. Spec coverage:**
- RPC de progresso (estados, início, limiar por comp/global) → Task 1 ✅
- Limiar configurável (global + por competência) → Task 1 (seed) + Task 3 ✅
- Coordenação: progresso + candidata + selar/retirar → Task 2 ✅
- Membro: formadas + em formação → Task 4 ✅
- Aposentar habilidades + chip órfão → Task 4 (perfil) + Task 5 (membros.html) ✅
- Sem retroativo (concluida_em >= início) → Task 1 ✅
- Sem schema novo (reusa array + config) → ✅

**2. Placeholder scan:** sem TBD/TODO; código completo em cada passo. Task 5 é verificação condicional (legítimo: depende do estado real de membros.html), com instrução clara de não mexer se nada exibe habilidades.

**3. Type consistency:** RPC retorna itens `{valor,label,progresso,limiar,formada,status}` usados igualmente em Task 2 e Task 4. `status ∈ {formada,candidata,em_formacao,nenhuma}`. Selo grava em `competencias_desenvolvidas` (array existente). Config `competencia_limiar_padrao` (int) e `competencia_inicio` (date string) consistentes entre migration e Task 3.

**Riscos:** (a) `onConflict:'chave'` em acolitos_config exige unique — Task 3 Step 3 verifica/corrige. (b) `buildEngajamentoEl` é síncrono; o bloco "em formação" é anexado async — aceitável (aparece após as formadas). (c) `competencia_inicio`=hoje → progresso começa em 0 (decisão do usuário: só daqui pra frente).
