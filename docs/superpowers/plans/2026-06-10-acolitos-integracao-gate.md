# Gate de integração (status `em_integracao`) + recusar apaga conta — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membro recém-cadastrado fica `status='em_integracao'` (some de Membros/Escala) até o CRM chegar em `integrado` (vira `ativo`); recusar na 1ª etapa apaga membro + vínculo + CRM + conta Auth.

**Architecture:** Novo valor de `status` que reusa os filtros `status='ativo'` já existentes em todas as telas. O `crm.html` promove o status ao integrar. O recusar passa por uma ação `reject` server-side (service role) que também remove a conta Auth.

**Tech Stack:** HTML/JS vanilla, Supabase (PostgREST + Auth admin), Vercel serverless (Node 24).

**Spec:** `docs/superpowers/specs/2026-06-10-acolitos-integracao-gate-design.md`

**Sem test runner.** Verificação: SQL via Supabase, runner local para o endpoint (família descartável, depois apagada), checagem da camada de dados do `reject` via MCP, e nota de verificação manual do fluxo logado de coordenação.

---

## File Structure
- **Migration** (Supabase): amplia o CHECK de `acolitos_membros.status`.
- **Modify** `api/signup-familia.js`: membro nasce `em_integracao`.
- **Modify** `projetos/acolitos/novos.html`: membro nasce `em_integracao`.
- **Modify** `projetos/acolitos/crm.html`: ao integrar → `status='ativo'`; recusar → chama `reject`.
- **Modify** `api/acolito-admin.js`: nova ação `reject`.

---

## Task 1: Migration — status `em_integracao`

**Files:** DB (Supabase migration `acolitos_status_em_integracao`).

- [ ] **Step 1: Conferir o CHECK atual**

Via Supabase MCP `execute_sql` (project_id `fttjgsotuosjfrasttds`):
```sql
select pg_get_constraintdef(oid) from pg_constraint where conname='acolitos_membros_status_check';
```
Expected: `CHECK ((status = ANY (ARRAY['ativo'::text, 'afastado'::text, 'desligado'::text])))`.

- [ ] **Step 2: Aplicar a migration**

Via `apply_migration` (name: `acolitos_status_em_integracao`):
```sql
alter table acolitos_membros drop constraint if exists acolitos_membros_status_check;
alter table acolitos_membros add constraint acolitos_membros_status_check
  check (status in ('ativo','afastado','desligado','em_integracao'));
```

- [ ] **Step 3: Confirmar que `em_integracao` é aceito e os existentes seguem `ativo`**

```sql
select 'em_integracao' = any(array['ativo','afastado','desligado','em_integracao']) as aceito,
       (select count(*) from acolitos_membros where status='ativo') as ativos,
       (select count(*) from acolitos_membros) as total;
```
Expected: `aceito=true`, `ativos=173`, `total=173`.

(Sem commit — migration vive no histórico do Supabase.)

---

## Task 2: Membro nasce `em_integracao`

**Files:** Modify: `api/signup-familia.js`, `projetos/acolitos/novos.html`

- [ ] **Step 1: `signup-familia.js` — paisBase com `em_integracao`**

Substitua EXATAMENTE:
```js
    grupo_irmaos: grupo,
    escalar_com_irmao: true,
    status: 'ativo'
  };
```
por:
```js
    grupo_irmaos: grupo,
    escalar_com_irmao: true,
    status: 'em_integracao'
  };
```

- [ ] **Step 2: `novos.html` — mData com `em_integracao`**

Substitua EXATAMENTE:
```js
    const mData = {
      nome,
      data_nascimento: nasc || null,
```
por:
```js
    const mData = {
      nome,
      status: 'em_integracao',
      data_nascimento: nasc || null,
```

- [ ] **Step 3: Validar sintaxe**

Run:
```bash
node --check api/signup-familia.js && node -e "const s=require('fs').readFileSync('projetos/acolitos/novos.html','utf8'); const m=s.match(/<script>([\s\S]*?)<\/script>/g); m.forEach(b=>{const c=b.replace(/<\/?script>/g,''); if(c.trim())new Function(c)}); console.log('novos OK')"
```
Expected: `novos OK` (e sem erro do `node --check`).

- [ ] **Step 4: Commit**

```bash
git add api/signup-familia.js projetos/acolitos/novos.html
git commit -m "feat(acolitos): membro novo nasce status em_integracao (some de membros/escala ate integrar)"
```

---

## Task 3: `crm.html` — ao integrar, status vira `ativo`

**Files:** Modify: `projetos/acolitos/crm.html`

- [ ] **Step 1: Setar `status='ativo'` ao avançar para `integrado`**

Substitua EXATAMENTE:
```js
  // Se integrado → atualiza role (apenas coord_admin e subadmin)
  if (proximaEtapa === 'integrado') {
    const podeAtribuirRole = ['coord_admin','subadmin'].includes(ctx.membership.role);
```
por:
```js
  // Se integrado → "sobe" o membro (status ativo) e atualiza role (apenas coord_admin e subadmin)
  if (proximaEtapa === 'integrado') {
    await sbAdmin.from('acolitos_membros').update({ status: 'ativo' }).eq('id', membroId);
    const podeAtribuirRole = ['coord_admin','subadmin'].includes(ctx.membership.role);
```

- [ ] **Step 2: Validar sintaxe do script inline**

Run:
```bash
node -e "const s=require('fs').readFileSync('projetos/acolitos/crm.html','utf8'); const m=s.match(/<script>([\s\S]*?)<\/script>/g); m.forEach(b=>{const c=b.replace(/<\/?script>/g,''); if(c.trim())new Function(c)}); console.log('crm OK')"
```
Expected: `crm OK`.

- [ ] **Step 3: Commit**

```bash
git add projetos/acolitos/crm.html
git commit -m "feat(acolitos): ao integrar no CRM, membro sobe para status ativo"
```

---

## Task 4: `api/acolito-admin.js` — ação `reject`

**Files:** Modify: `api/acolito-admin.js`

- [ ] **Step 1: Adicionar a ação `reject` antes do retorno final**

Substitua EXATAMENTE:
```js
  return res.status(400).json({ error: 'Ação inválida' });
}
```
por:
```js
  if (action === 'reject') {
    if (!membro_id) return res.status(400).json({ error: 'Faltam dados.' });
    const mr = await fetch(`${URL}/rest/v1/acolitos_membros?id=eq.${membro_id}&select=user_id`, { headers: h });
    const mrow = (await mr.json())[0];
    if (!mrow) return res.status(404).json({ error: 'Cadastro não encontrado.' });
    const targetUid = mrow.user_id || null;
    if (targetUid && !(await podeMexer(targetUid))) return res.status(403).json({ error: 'Sem permissão sobre este usuário.' });
    if (targetUid) await fetch(`${URL}/rest/v1/pastoral_members?user_id=eq.${targetUid}&module_id=eq.${mod.id}`, { method: 'DELETE', headers: h }).catch(() => {});
    const dm = await fetch(`${URL}/rest/v1/acolitos_membros?id=eq.${membro_id}`, { method: 'DELETE', headers: h });
    if (!dm.ok) { const dd = await dm.json().catch(() => ({})); return res.status(400).json({ error: dd.message || 'Não foi possível apagar (pode estar vinculado em escalas).' }); }
    if (targetUid) await fetch(`${URL}/auth/v1/admin/users/${targetUid}`, { method: 'DELETE', headers: h }).catch(() => {});
    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ error: 'Ação inválida' });
}
```
(`membro_id` já é desestruturado de `req.body` na linha ~59; `h`, `mod`, `podeMexer` já existem no handler.)

- [ ] **Step 2: Validar sintaxe**

Run: `node --check api/acolito-admin.js`
Expected: sem saída, exit 0.

- [ ] **Step 3: Commit**

```bash
git add api/acolito-admin.js
git commit -m "feat(acolitos): acao reject no acolito-admin (apaga membro + vinculo + conta Auth)"
```

---

## Task 5: `crm.html` — recusar chama o `reject`

**Files:** Modify: `projetos/acolitos/crm.html`

- [ ] **Step 1: Reescrever `recusarCadastro()` para usar o endpoint**

Substitua EXATAMENTE:
```js
async function recusarCadastro() {
  if (!pendingEntry) return;
  const nome = pendingEntry.acolitos_membros?.nome || 'este cadastro';
  if (!confirm('RECUSAR e APAGAR o cadastro de ' + nome + '?\n\nRemove o membro, o funil e todo o histórico — não dá pra desfazer.\n(Para só tirar do funil sem apagar, use "Tirar do funil".)')) return;
  const { data: mrow } = await sbAdmin.from('acolitos_membros').select('user_id').eq('id', pendingEntry.membro_id).maybeSingle();
  if (mrow && mrow.user_id) {
    const { data: modulo } = await sbAdmin.from('pastoral_modules').select('id').eq('slug', 'acolitos').maybeSingle();
    if (modulo) await sbAdmin.from('pastoral_members').delete().eq('user_id', mrow.user_id).eq('module_id', modulo.id);
  }
  const { error } = await sbAdmin.from('acolitos_membros').delete().eq('id', pendingEntry.membro_id); // cascata remove crm/histórico/etc.
  if (error) { alert('Não foi possível apagar (o membro pode estar vinculado em escalas). Use "Tirar do funil" ou arquive em Membros.'); return; }
  fecharModal(); pendingEntry = null; await loadCrm();
}
```
por:
```js
async function recusarCadastro() {
  if (!pendingEntry) return;
  const nome = pendingEntry.acolitos_membros?.nome || 'este cadastro';
  if (!confirm('RECUSAR e APAGAR o cadastro de ' + nome + '?\n\nRemove o membro, o funil, o histórico E a conta de acesso — não dá pra desfazer.\n(Para só tirar do funil sem apagar, use "Tirar do funil".)')) return;
  const { data: { session } } = await sb.auth.getSession();
  const r = await fetch('/api/acolito-admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (session ? session.access_token : '') },
    body: JSON.stringify({ action: 'reject', membro_id: pendingEntry.membro_id })
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) { alert(d.error || 'Não foi possível apagar.'); return; }
  fecharModal(); pendingEntry = null; await loadCrm();
}
```

- [ ] **Step 2: Validar sintaxe do script inline**

Run:
```bash
node -e "const s=require('fs').readFileSync('projetos/acolitos/crm.html','utf8'); const m=s.match(/<script>([\s\S]*?)<\/script>/g); m.forEach(b=>{const c=b.replace(/<\/?script>/g,''); if(c.trim())new Function(c)}); console.log('crm OK')"
```
Expected: `crm OK`.

- [ ] **Step 3: Commit**

```bash
git add projetos/acolitos/crm.html
git commit -m "feat(acolitos): recusar cadastro apaga tambem a conta de acesso (via reject)"
```

---

## Task 6: Deploy + verificação ponta-a-ponta + produção

**Files:** nenhum (deploy + testes + limpeza)

- [ ] **Step 1: Env de teste local + runner (cria família, deve nascer `em_integracao`)**

```bash
URLV=$(grep -E "^SUPABASE_URL=" .env | cut -d= -f2- | tr -d '"'); SRKV=$(grep -E "^SUPABASE_SERVICE_KEY=" .env | cut -d= -f2- | tr -d '"'); printf 'SUPABASE_URL=%s\nSUPABASE_SERVICE_ROLE_KEY=%s\n' "$URLV" "$SRKV" > .env.qa.local
cat > test-familia-runner.mjs <<'EOF'
import handler from './api/signup-familia.js';
function mkRes(){ const r={_s:200}; r.status=c=>{r._s=c;return r;}; r.json=o=>{console.log('STATUS='+r._s); console.log(JSON.stringify(o)); return r;}; r.end=()=>{console.log('STATUS='+r._s); return r;}; return r; }
await handler({ method:'POST', body:{ senha:'teste123', pais:{ nome_mae:'Maria Teste QA' }, filhos:[{ nome:'Joao Teste QA', usuario:'joao.teste.qa', data_nascimento:'2014-03-01', comunidade:'matriz' }] } }, mkRes());
EOF
node --env-file=.env.qa.local test-familia-runner.mjs 2>&1 | tail -2
```
Expected: `STATUS=200` e `{"ok":true,"usuarios":["joao.teste.qa"]}`.

- [ ] **Step 2: Verificar status `em_integracao` e que NÃO entra na lista ativa**

Via `execute_sql`:
```sql
select nome, status from acolitos_membros where nome like '%Teste QA%';
select count(*) as apareceria_em_membros from acolitos_membros where nome like '%Teste QA%' and status='ativo';
```
Expected: `status='em_integracao'`; `apareceria_em_membros=0`.

- [ ] **Step 3: Simular "subir ao integrar" (o que o crm.html faz) e conferir**

```sql
update acolitos_membros set status='ativo' where nome like '%Teste QA%';
select count(*) as agora_ativo from acolitos_membros where nome like '%Teste QA%' and status='ativo';
```
Expected: `agora_ativo=1` (prova que ao virar `ativo` ele apareceria em Membros/Escala).

- [ ] **Step 4: Verificar a camada de dados do `reject` (apaga membro + vínculo + auth)**

Pegar o `user_id`, depois apagar exatamente como o endpoint faz, e confirmar remoção total:
```sql
begin;
create temp table _qa on commit drop as select id, user_id from acolitos_membros where nome like '%Teste QA%';
delete from pastoral_members where user_id in (select user_id from _qa);
delete from acolitos_membros where id in (select id from _qa);
delete from auth.users where id in (select user_id from _qa);
commit;
select (select count(*) from acolitos_membros where nome like '%Teste QA%') membros,
       (select count(*) from auth.users where email like '%teste.qa%') auth,
       (select count(*) from acolitos_membros) total;
```
Expected: `membros=0, auth=0, total=173`. (A ação `reject` do endpoint executa exatamente esses três deletes server-side, gateada por coord_admin/subadmin + `podeMexer`.)

- [ ] **Step 5: Remover temporários**

```bash
rm -f .env.qa.local test-familia-runner.mjs
git status --short   # só pastoral.html deve aparecer
```

- [ ] **Step 6: Deploy de produção (sem a landing WIP)**

```bash
git stash push -m "WIP landing" -- projetos/acolitos/pastoral.html 2>/dev/null
vercel --prod --yes 2>&1 | tail -3
git stash pop 2>/dev/null
```
Expected: produção `Ready`.

- [ ] **Step 7: Verificação manual (coordenação)**

Pelo usuário, com conta de coordenação real: (a) cadastrar um membro de teste → confirmar que NÃO aparece em Membros, só no CRM; (b) avançar até `integrado` → confirmar que passa a aparecer em Membros; (c) em outro cadastro, usar **Recusar** na 1ª etapa → confirmar que some de tudo e o login não entra mais. (Este passo exige sessão de coordenação autenticada, que o agente não possui.)

---

## Notas de verificação final (spec coverage)
- Parte 1 (status `em_integracao`): migration (T1), nascimento (T2), subir ao integrar (T3); e2e em T6 Steps 2-3. ✓
- Parte 2 (recusar apaga conta): ação `reject` (T4), `recusarCadastro` (T5); camada de dados em T6 Step 4 + verificação manual T6 Step 7. ✓
- Regra de dados reais: única escrita de teste é a família "Teste QA", apagada no T6 Step 4 antes do deploy.
