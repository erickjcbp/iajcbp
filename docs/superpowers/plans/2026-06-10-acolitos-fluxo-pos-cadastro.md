# Fluxo pós-cadastro (família pula `novos.html` + melhorias) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer o filho cadastrado pelo wizard família cair na **home** (não no `novos.html`), mostrar o pop-up "Complete seu cadastro" (só faltantes) **após aprovação**, e melhorar o `novos.html` (celular por idade + reaproveitar nomes dos pais nos ministros).

**Architecture:** Backend serverless (`signup-familia`) passa a criar o `pastoral_members` de cada filho. `shared.js` busca a etapa do CRM e gateia o pop-up. `novos.html` ganha label de celular por idade e reaproveita os nomes. Helper de idade único em `shared.js` reusado pelo `novos.html` (que já carrega `shared.js`).

**Tech Stack:** HTML/JS vanilla, Supabase (PostgREST + Auth admin), Vercel serverless (Node 24).

**Spec:** `docs/superpowers/specs/2026-06-10-acolitos-fluxo-pos-cadastro-design.md`

**Sem test runner.** Verificação: `node --check` (sintaxe), `node -e` evaluando helpers puros, runner local para o endpoint (família descartável, depois apagada) e checagem no browser/Playwright.

---

## File Structure
- **Modify:** `api/signup-familia.js` — cria `pastoral_members` (role `'novo'`) por filho + rollback.
- **Modify:** `projetos/acolitos/shared.js` — busca etapa do CRM; gateia o pop-up "Complete seu cadastro"; helper `idadeAnos`; `telefone` exigido só se >12.
- **Modify:** `projetos/acolitos/novos.html` — celular obrigatório por idade; ministros reaproveitam Nome do Pai/Mãe.

---

## Task 1: `signup-familia.js` — criar `pastoral_members` por filho

**Files:** Modify: `api/signup-familia.js`

- [ ] **Step 1: Buscar o `module_id` do módulo acólitos antes do laço**

Substitua EXATAMENTE:
```js
  const criados = []; // { authId, membroId, usuario }
```
por:
```js
  // módulo acólitos (para o vínculo pastoral_members de cada filho)
  let moduleId = null;
  {
    const rmod = await fetch(`${URL}/rest/v1/pastoral_modules?slug=eq.acolitos&select=id`, { headers: auth });
    const dmod = await rmod.json().catch(() => []);
    moduleId = Array.isArray(dmod) && dmod[0] ? dmod[0].id : null;
  }
  if (!moduleId) return res.status(500).json({ error: 'Módulo acólitos não encontrado.' });

  const criados = []; // { authId, membroId, usuario }
```

- [ ] **Step 2: Incluir o vínculo no rollback**

Substitua EXATAMENTE:
```js
  async function rollback() {
    for (const c of criados.slice().reverse()) {
      if (c.membroId) await fetch(`${URL}/rest/v1/acolitos_membros?id=eq.${c.membroId}`, { method: 'DELETE', headers: auth }).catch(() => {});
      if (c.authId) await fetch(`${URL}/auth/v1/admin/users/${c.authId}`, { method: 'DELETE', headers: auth }).catch(() => {});
    }
  }
```
por:
```js
  async function rollback() {
    for (const c of criados.slice().reverse()) {
      if (c.authId) await fetch(`${URL}/rest/v1/pastoral_members?user_id=eq.${c.authId}&module_id=eq.${moduleId}`, { method: 'DELETE', headers: auth }).catch(() => {});
      if (c.membroId) await fetch(`${URL}/rest/v1/acolitos_membros?id=eq.${c.membroId}`, { method: 'DELETE', headers: auth }).catch(() => {});
      if (c.authId) await fetch(`${URL}/auth/v1/admin/users/${c.authId}`, { method: 'DELETE', headers: auth }).catch(() => {});
    }
  }
```

- [ ] **Step 3: Criar o vínculo após o CRM, dentro do laço**

Substitua EXATAMENTE:
```js
      // 3) entrada no CRM para aprovação da coordenação
      const rc = await fetch(`${URL}/rest/v1/acolitos_crm`, { method: 'POST', headers: auth, body: JSON.stringify({ membro_id: dm[0].id, etapa: 'aprovacao_cadastro' }) });
      if (!rc.ok) { const dc = await rc.json().catch(() => ({})); throw new Error(dc.message || ('Erro ao registrar aprovação de ' + nome)); }
    }
```
por:
```js
      // 3) entrada no CRM para aprovação da coordenação
      const rc = await fetch(`${URL}/rest/v1/acolitos_crm`, { method: 'POST', headers: auth, body: JSON.stringify({ membro_id: dm[0].id, etapa: 'aprovacao_cadastro' }) });
      if (!rc.ok) { const dc = await rc.json().catch(() => ({})); throw new Error(dc.message || ('Erro ao registrar aprovação de ' + nome)); }

      // 4) vínculo do módulo — sem ele o app jogaria o filho pro novos.html
      const rv = await fetch(`${URL}/rest/v1/pastoral_members`, {
        method: 'POST',
        headers: { ...auth, Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify({ user_id: authId, module_id: moduleId, role: 'novo' })
      });
      if (!rv.ok) { const dv = await rv.json().catch(() => ({})); throw new Error(dv.message || ('Erro ao vincular ' + nome)); }
    }
```

- [ ] **Step 4: Validar sintaxe**

Run: `node --check api/signup-familia.js`
Expected: sem saída, exit 0.

- [ ] **Step 5: Commit**

```bash
git add api/signup-familia.js
git commit -m "feat(acolitos): signup-familia cria vinculo pastoral_members por filho"
```

(Verificação funcional na Task 5.)

---

## Task 2: `shared.js` — gatear "Complete seu cadastro" até aprovado

**Files:** Modify: `projetos/acolitos/shared.js`

- [ ] **Step 1: Buscar a etapa do CRM antes de enfileirar notificações**

Substitua EXATAMENTE (linha ~177):
```js
  queueNotificacoes(membro);
```
por:
```js
  // etapa atual do CRM do membro — gateia "Complete seu cadastro" (só após aprovado)
  if (membro && membro.id) {
    const { data: _crm } = await sb.from('acolitos_crm')
      .select('etapa').eq('membro_id', membro.id)
      .order('etapa_iniciada_em', { ascending: false }).limit(1).maybeSingle();
    membro._crmEtapa = _crm ? _crm.etapa : null;
  }

  queueNotificacoes(membro);
```

- [ ] **Step 2: Suprimir o pop-up enquanto a etapa for `aprovacao_cadastro`**

Substitua EXATAMENTE:
```js
  const faltando = camposIncompletos(membro);
  if (faltando.length && !sessionStorage.getItem('cadastro-prompt-' + membro.id)) {
```
por:
```js
  const faltando = camposIncompletos(membro);
  // pendente de aprovação (etapa inicial do CRM) → não pede dados ainda; sem CRM = membro já estabelecido (mostra normal)
  const aguardandoAprovacao = membro._crmEtapa === 'aprovacao_cadastro';
  if (faltando.length && !aguardandoAprovacao && !sessionStorage.getItem('cadastro-prompt-' + membro.id)) {
```

- [ ] **Step 3: Validar sintaxe**

Run: `node --check projetos/acolitos/shared.js`
Expected: sem saída, exit 0.

- [ ] **Step 4: Commit**

```bash
git add projetos/acolitos/shared.js
git commit -m "feat(acolitos): pop-up Complete seu cadastro so apos aprovacao do CRM"
```

---

## Task 3: `shared.js` — helper `idadeAnos` + `telefone` só se >12

**Files:** Modify: `projetos/acolitos/shared.js`

- [ ] **Step 1: Adicionar o helper `idadeAnos` antes de `function campoExigido`**

Substitua EXATAMENTE:
```js
// um campo é exigido se o Config disser; sem config, usa o `padrao` do campo
function campoExigido(key, padrao) {
```
por:
```js
// idade em anos completos a partir de hoje; null se sem data válida
function idadeAnos(dataNasc) {
  if (!dataNasc) return null;
  const d = new Date(dataNasc); if (isNaN(d.getTime())) return null;
  const hoje = new Date();
  let a = hoje.getFullYear() - d.getFullYear();
  const m = hoje.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < d.getDate())) a--;
  return a;
}
// um campo é exigido se o Config disser; sem config, usa o `padrao` do campo
function campoExigido(key, padrao) {
```

- [ ] **Step 2: Exigir `telefone` só de quem tem mais de 12 anos**

Substitua EXATAMENTE:
```js
  const faltam = CAMPOS_OBRIGATORIOS.filter(c => {
    if (!campoExigido(c.key, !!c.padrao)) return false;
    const v = membro[c.key];
```
por:
```js
  const faltam = CAMPOS_OBRIGATORIOS.filter(c => {
    if (!campoExigido(c.key, !!c.padrao)) return false;
    if (c.key === 'telefone' && !(idadeAnos(membro.data_nascimento) > 12)) return false; // celular só obrigatório p/ 13+
    const v = membro[c.key];
```

- [ ] **Step 3: Testar o helper `idadeAnos` (eval da função real)**

Run:
```bash
node -e "const s=require('fs').readFileSync('projetos/acolitos/shared.js','utf8'); const m=s.match(/function idadeAnos[\s\S]*?\n}/); eval(m[0]); const old='2008-01-01', young=new Date().getFullYear()-5+'-01-01'; console.log('13+:', idadeAnos(old)>12, '| 5yo>12:', idadeAnos(young)>12, '| null:', idadeAnos(null))"
```
Expected: `13+: true | 5yo>12: false | null: null`

- [ ] **Step 4: Validar sintaxe**

Run: `node --check projetos/acolitos/shared.js`
Expected: sem saída, exit 0.

- [ ] **Step 5: Commit**

```bash
git add projetos/acolitos/shared.js
git commit -m "feat(acolitos): telefone obrigatorio so para maiores de 12 (helper idadeAnos)"
```

---

## Task 4: `novos.html` — celular por idade + ministros reaproveitam nomes

**Files:** Modify: `projetos/acolitos/novos.html`

- [ ] **Step 1: Remover o campo "Nome do Ministro" e adicionar a dica de reaproveitamento**

Substitua EXATAMENTE:
```html
    <div class="expand-block" id="bloco-ministros">
      <div class="form-group">
        <label class="form-label">Nome do Ministro (pai ou mãe)</label>
        <input class="form-input" id="r-ministro-nome" placeholder="Nome completo">
      </div>
      <div class="form-group">
        <label class="form-label">Comunidade onde serve</label>
        <select class="form-select" id="r-ministro-comunidade">
          <option value="">Selecionar...</option>
          <option value="matriz">Matriz</option>
          <option value="santo_antonio">Santo Antônio</option>
        </select>
      </div>
    </div>
```
por:
```html
    <div class="expand-block" id="bloco-ministros">
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:10px;font-style:italic">Usaremos os nomes do pai e da mãe informados acima.</div>
      <div class="form-group">
        <label class="form-label">Comunidade onde serve</label>
        <select class="form-select" id="r-ministro-comunidade">
          <option value="">Selecionar...</option>
          <option value="matriz">Matriz</option>
          <option value="santo_antonio">Santo Antônio</option>
        </select>
      </div>
    </div>
```

- [ ] **Step 2: Dar id ao label do celular e marcar a data de nascimento para atualizar o hint**

Substitua EXATAMENTE:
```js
  campos.forEach(c => {
    const grp = document.createElement('div'); grp.className = 'form-group';
    const lbl = document.createElement('label'); lbl.className = 'form-label'; lbl.textContent = c.label;
    const inp = document.createElement('input');
    inp.className = 'form-input'; inp.id = 'm' + n + '-' + c.id;
    inp.type = c.type; inp.placeholder = c.placeholder;
    grp.append(lbl, inp); bloco.appendChild(grp);
  });
```
por:
```js
  campos.forEach(c => {
    const grp = document.createElement('div'); grp.className = 'form-group';
    const lbl = document.createElement('label'); lbl.className = 'form-label'; lbl.textContent = c.label;
    lbl.id = 'lbl-m' + n + '-' + c.id;
    const inp = document.createElement('input');
    inp.className = 'form-input'; inp.id = 'm' + n + '-' + c.id;
    inp.type = c.type; inp.placeholder = c.placeholder;
    if (c.id === 'nasc') inp.addEventListener('change', () => atualizaCelHint(n));
    grp.append(lbl, inp); bloco.appendChild(grp);
  });
```

- [ ] **Step 3: Adicionar a função `atualizaCelHint` (logo após `addBlocoMembro`)**

Substitua EXATAMENTE:
```js
function toggleMinistros() {
```
por:
```js
function atualizaCelHint(n) {
  const nasc = document.getElementById('m' + n + '-nasc') && document.getElementById('m' + n + '-nasc').value;
  const lbl = document.getElementById('lbl-m' + n + '-cel');
  if (!lbl) return;
  const idade = (typeof idadeAnos === 'function') ? idadeAnos(nasc) : null;
  const obrig = idade !== null && idade > 12;
  lbl.textContent = 'Celular do Membro ' + (obrig ? '(obrigatório)' : '(opcional)');
}

function toggleMinistros() {
```

- [ ] **Step 4: Trocar o label estático do celular para refletir o estado inicial (opcional)**

Substitua EXATAMENTE:
```js
    { id: 'cel',    label: 'Celular do Membro (opcion.)',type: 'tel',   placeholder: '(99) 99999-9999',required: false },
```
por:
```js
    { id: 'cel',    label: 'Celular do Membro (opcional)',type: 'tel',   placeholder: '(99) 99999-9999',required: false },
```

- [ ] **Step 5: Remover a leitura de `r-ministro-nome` do objeto `resp`**

Substitua EXATAMENTE:
```js
    ministros: document.getElementById('r-ministros').checked,
    ministroNome:      document.getElementById('r-ministro-nome').value.trim(),
    ministroComunidade:document.getElementById('r-ministro-comunidade').value,
```
por:
```js
    ministros: document.getElementById('r-ministros').checked,
    ministroComunidade:document.getElementById('r-ministro-comunidade').value,
```

- [ ] **Step 6: Validar o celular por idade na submissão**

Substitua EXATAMENTE:
```js
  // Valida campos obrigatórios
  for (const bloco of blocos) {
    const idx = bloco.id.replace('bloco-','');
    const nome = document.getElementById('m' + idx + '-nome')?.value.trim();
    const nasc = document.getElementById('m' + idx + '-nasc')?.value;
    if (!nome || !nasc) {
      showMsg('Nome e data de nascimento são obrigatórios para todos os membros.', 'error');
      btn.disabled = false; btn.textContent = 'Concluir Cadastro'; return;
    }
  }
```
por:
```js
  // Valida campos obrigatórios
  for (const bloco of blocos) {
    const idx = bloco.id.replace('bloco-','');
    const nome = document.getElementById('m' + idx + '-nome')?.value.trim();
    const nasc = document.getElementById('m' + idx + '-nasc')?.value;
    if (!nome || !nasc) {
      showMsg('Nome e data de nascimento são obrigatórios para todos os membros.', 'error');
      btn.disabled = false; btn.textContent = 'Concluir Cadastro'; return;
    }
    const cel = document.getElementById('m' + idx + '-cel')?.value.trim();
    if (idadeAnos(nasc) > 12 && !cel) {
      showMsg('Informe o celular do membro com 13 anos ou mais.', 'error');
      btn.disabled = false; btn.textContent = 'Concluir Cadastro'; return;
    }
  }
```

- [ ] **Step 7: Gravar os nomes do pai e da mãe nos campos de ministro**

Substitua EXATAMENTE:
```js
      tem_pai_ministro: resp.ministros,
      nome_pai_ministro: resp.ministros ? resp.ministroNome || null : null,
      tem_mae_ministro: resp.ministros,
      nome_mae_ministro: resp.ministros ? resp.ministroNome || null : null,
      comunidade_ministro: resp.ministros ? resp.ministroComunidade || null : null,
```
por:
```js
      tem_pai_ministro: resp.ministros && !!resp.pai,
      nome_pai_ministro: resp.ministros ? (resp.pai || null) : null,
      tem_mae_ministro: resp.ministros && !!resp.mae,
      nome_mae_ministro: resp.ministros ? (resp.mae || null) : null,
      comunidade_ministro: resp.ministros ? resp.ministroComunidade || null : null,
```

- [ ] **Step 8: Validar sintaxe do script inline e que o id removido sumiu**

Run:
```bash
node -e "const s=require('fs').readFileSync('projetos/acolitos/novos.html','utf8'); const m=s.match(/<script>([\s\S]*?)<\/script>/g); m.forEach((b,i)=>{const c=b.replace(/<\/?script>/g,''); if(c.trim()){try{new Function(c)}catch(e){console.log('block',i,'ERRO',e.message)}}}); console.log('check ok'); console.log('r-ministro-nome refs:', (s.match(/r-ministro-nome/g)||[]).length)"
```
Expected: `check ok` e `r-ministro-nome refs: 0`.

- [ ] **Step 9: Commit**

```bash
git add projetos/acolitos/novos.html
git commit -m "feat(acolitos): novos.html celular obrigatorio por idade + ministros reaproveitam nomes"
```

---

## Task 5: Deploy preview + verificação ponta-a-ponta + produção

**Files:** nenhum (deploy + testes + limpeza)

- [ ] **Step 1: Preparar env de teste local (mesma técnica já usada)**

```bash
URLV=$(grep -E "^SUPABASE_URL=" .env | cut -d= -f2- | tr -d '"'); SRKV=$(grep -E "^SUPABASE_SERVICE_KEY=" .env | cut -d= -f2- | tr -d '"'); printf 'SUPABASE_URL=%s\nSUPABASE_SERVICE_ROLE_KEY=%s\n' "$URLV" "$SRKV" > .env.qa.local; grep -cE '^SUPABASE_URL=|^SUPABASE_SERVICE_ROLE_KEY=' .env.qa.local
```
Expected: `2`. (`.env.qa.local` NÃO é coberto pelo `.gitignore` — apagar no Step 6 e nunca commitar.)

- [ ] **Step 2: Runner temporário invocando o handler real**

Criar `test-familia-runner.mjs`:
```js
import handler from './api/signup-familia.js';
function mkRes(){ const r={_s:200}; r.status=c=>{r._s=c;return r;}; r.json=o=>{console.log('STATUS='+r._s); console.log(JSON.stringify(o)); return r;}; r.end=()=>{console.log('STATUS='+r._s+' (end)'); return r;}; return r; }
const body = { senha:'teste123', pais:{ nome_mae:'Maria Teste QA', nome_pai:'Jose Teste QA', contato_principal:'mae' },
  filhos:[{ nome:'Joao Teste QA', usuario:'joao.teste.qa', data_nascimento:'2014-03-01', comunidade:'matriz' }] };
await handler({ method:'POST', body }, mkRes());
```
Run: `node --env-file=.env.qa.local test-familia-runner.mjs`
Expected: `STATUS=200` e `{"ok":true,"usuarios":["joao.teste.qa"]}`.

- [ ] **Step 3: Conferir no banco que o vínculo foi criado**

Via Supabase MCP `execute_sql` (project_id `fttjgsotuosjfrasttds`):
```sql
select m.nome, pm.role,
  (select id from pastoral_modules where slug='acolitos') = pm.module_id as modulo_ok,
  (select count(*) from acolitos_crm c where c.membro_id=m.id) as crm
from acolitos_membros m
join pastoral_members pm on pm.user_id = m.user_id
where m.nome like '%Teste QA%';
```
Expected: 1 linha — `role='novo'`, `modulo_ok=true`, `crm=1`.

- [ ] **Step 4: LIMPEZA da família de teste (membros + auth + vínculo)**

`auth.users` é o pai de `acolitos_membros` e `pastoral_members`; capturar os ids numa temp table antes de apagar os membros (executar como UM bloco/transação):
```sql
begin;
create temp table _qa_ids on commit drop as
  select user_id from acolitos_membros where nome like '%Teste QA%' and user_id is not null;
delete from pastoral_members where user_id in (select user_id from _qa_ids);
delete from acolitos_membros where nome like '%Teste QA%';   -- CASCADE limpa acolitos_crm
delete from auth.users where id in (select user_id from _qa_ids);
commit;
```
Depois confirme:
```sql
select (select count(*) from acolitos_membros where nome like '%Teste QA%') membros,
       (select count(*) from auth.users where email like '%teste.qa%') auth,
       (select count(*) from acolitos_membros) total;
```
Expected: `membros=0, auth=0, total=174`.

- [ ] **Step 5: Remover arquivos temporários**

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

- [ ] **Step 7: Verificação visual (Playwright) do `novos.html`**

Abrir `https://iajcbp.vercel.app/projetos/acolitos/novos.html` exige login; em vez disso, validar o comportamento por inspeção do código já feita nos Steps anteriores. Como smoke público, abrir o login e confirmar que carrega sem erro de console:
- `browser_navigate https://iajcbp.vercel.app/projetos/acolitos/login.html`
- Confirmar título "Acólitos & Coroinhas — JCBP" e ausência de erro fatal.

(O fluxo logado do filho → home é verificado manualmente pelo usuário com uma conta real de teste, pois exige sessão autenticada.)

---

## Notas de verificação final (spec coverage)
- Parte A (vínculo) → Task 1 + Task 5 (e2e mostra `role='novo'`, módulo ok) ✓
- Parte B (gate pós-aprovação; sem CRM não suprime) → Task 2 ✓
- Parte C/D (telefone só >12; helper idade) → Task 3 (com teste do helper) ✓
- Parte C novos.html (celular por idade; ministros reaproveitam) → Task 4 ✓
- Regra de dados reais: única escrita de teste é a família "Teste QA", apagada no Step 4 antes do deploy.
