# Submódulo de Configuração (superadmin) — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar um painel `config.html` (só superadmin) que centraliza configurações hoje espalhadas/hardcoded, via override-com-fallback, sem quebrar o app atual.

**Architecture:** Tabela chave-valor `acolitos_config` + `acolitos_listas` (estendida com `meta jsonb`). `loadConfig()` no shared.js sobrescreve globais com fallback pro padrão do código. Gate por username (`isSuperadmin`). Cada seção é um editor CRUD isolado em `config.html`.

**Tech Stack:** HTML/CSS/JS vanilla, Supabase (RLS + RPC via MCP `apply_migration`/`execute_sql`), deploy via Vercel CLI. Verificação: `node --check` (sintaxe inline), MCP SQL (banco), `curl` no domínio `coroinhas.jcbplimeira.com.br`.

**Convenções do projeto (seguir sempre):**
- Após editar qualquer `.html`/`shared.js`: checar sintaxe do bloco inline com `node --check` (extrair com `sed` o range do `<script>` principal).
- Deploy: re-carimbar `sw.js` BUILD + `vercel --prod --yes --scope erickjcbp-1650s-projects` (token em env `VERCEL_TOKEN`).
- Sem emoji como ícone visual (usar SVG `_svgIcon`); emoji em texto/botão é ok.
- Migrations via MCP `apply_migration` (próxima: **038**).

---

## Task 1: Migração — `acolitos_config`, gate superadmin, `meta` em listas, relaxar constraint de tipo

**Files:**
- Migration via MCP `apply_migration` name `038_config_superadmin`
- Doc: registrar em `docs/migrations/` é opcional (projeto aplica via MCP)

- [ ] **Step 1: Aplicar a migração 038**

```sql
-- Tabela de configurações chave-valor
create table if not exists public.acolitos_config (
  chave text primary key,
  valor jsonb not null,
  updated_at timestamptz default now(),
  updated_by uuid
);
alter table public.acolitos_config enable row level security;

-- meta jsonb em acolitos_listas (categoria/eh_maior/ordem das funções, etc.)
alter table public.acolitos_listas add column if not exists meta jsonb not null default '{}';

-- seed da lista de superadmins (chave usada pelo gate)
insert into public.acolitos_config (chave, valor)
values ('superadmins', '["erickmartins","erickmartinsadmin"]'::jsonb)
on conflict (chave) do nothing;

-- gate: a conta logada é superadmin? (username = parte antes do @ do e-mail sintético)
create or replace function public.acolitos_is_superadmin(uid uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1
    from auth.users u,
         jsonb_array_elements_text( (select valor from public.acolitos_config where chave='superadmins') ) as sa(name)
    where u.id = uid
      and split_part(u.email, '@', 1) = sa.name
  );
$$;

-- RLS config: todos autenticados leem; só superadmin escreve
do $$ begin
  if not exists (select 1 from pg_policies where tablename='acolitos_config' and policyname='Autenticados leem config') then
    create policy "Autenticados leem config" on public.acolitos_config
      for select using (auth.role() = 'authenticated');
  end if;
  if not exists (select 1 from pg_policies where tablename='acolitos_config' and policyname='Superadmin gerencia config') then
    create policy "Superadmin gerencia config" on public.acolitos_config
      for all using (acolitos_is_superadmin(auth.uid())) with check (acolitos_is_superadmin(auth.uid()));
  end if;
end $$;

-- garantir que acolitos_celebracoes.tipo aceita qualquer slug (relaxar constraint se existir)
do $$ declare cn text;
begin
  select conname into cn from pg_constraint
   where conrelid='public.acolitos_celebracoes'::regclass and contype='c'
     and pg_get_constraintdef(oid) ilike '%tipo%';
  if cn is not null then execute 'alter table public.acolitos_celebracoes drop constraint '||quote_ident(cn); end if;
end $$;
```

- [ ] **Step 2: Verificar no banco**

Run (MCP `execute_sql`):
```sql
select chave, valor from acolitos_config;
select acolitos_is_superadmin((select id from auth.users where email like 'erickmartins@%' limit 1)) as sou_super;
select column_name from information_schema.columns where table_name='acolitos_listas' and column_name='meta';
```
Expected: `superadmins` retorna o array; `sou_super=true`; coluna `meta` existe.

- [ ] **Step 3: Sanidade da RLS de escrita** — opcional: confirmar que `acolitos_config` tem as 2 policies via `select policyname,cmd from pg_policies where tablename='acolitos_config'`. Expected: "Autenticados leem config" (SELECT) + "Superadmin gerencia config" (ALL).

---

## Task 2: `loadConfig()` + `isSuperadmin()` + item de nav + shell do `config.html`

**Files:**
- Modify: `projetos/acolitos/shared.js` (adicionar `loadConfig`, `isSuperadmin`, helper `_cfg`, item de nav)
- Create: `projetos/acolitos/config.html`

- [ ] **Step 1: Adicionar estado e `loadConfig` no shared.js**

Perto de `loadListasCustom` no shared.js, adicionar:
```js
let _APP_CONFIG = {};            // cache das chaves de acolitos_config
let _CONFIG_CARREGADO = false;
async function loadConfig() {
  try {
    const { data } = await sb.from('acolitos_config').select('chave,valor');
    _APP_CONFIG = {}; (data||[]).forEach(r => { _APP_CONFIG[r.chave] = r.valor; });
    _CONFIG_CARREGADO = true;
  } catch (e) { _APP_CONFIG = {}; } // fallback total: app usa padrões do código
}
function cfg(chave, padrao) { return (_APP_CONFIG && chave in _APP_CONFIG) ? _APP_CONFIG[chave] : padrao; }
function isSuperadmin(ctx) {
  const lista = cfg('superadmins', ['erickmartins','erickmartinsadmin']);
  const email = (ctx && ctx.user && ctx.user.email) || '';
  const usuario = email.includes('@') ? email.split('@')[0] : email;
  return Array.isArray(lista) && lista.includes(usuario);
}
```

- [ ] **Step 2: Chamar `loadConfig()` no `initModulo`**

Em `shared.js`, dentro de `initModulo`, logo após carregar `loadListasCustom()` (procurar a chamada existente), adicionar `await loadConfig();` na mesma sequência (antes do `return`). Se `loadListasCustom` não for awaited ali, adicionar `try { await loadConfig(); } catch(e){}` antes do `return { user, membership, membro, conta, grupoIrmaos }`.

- [ ] **Step 3: Adicionar item "Config" na nav (só superadmin), no `renderBottomNav`**

No `renderBottomNav`, no bloco do modo `coordenacao` (onde monta `items`), após o loop de `ORDEM_MODULOS`, adicionar:
```js
if (isSuperadmin(ctx)) items.push({ id:'config', href:'config.html', label:'Config', icon:'settings' });
```
E adicionar o ícone `settings` em `_svgIcon` (engrenagem, SVG):
```js
settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z'
```

- [ ] **Step 4: Criar `config.html` (shell)**

Copiar o head padrão de outra página (ex.: `casas.html`: meta/fonts/manifest/theme/apple-touch + `beforeinstallprompt` inline + supabase CDN). Corpo: `#app-header`, `#app-nav`, `#main-content`. Inline script:
```js
let ctx = null, secaoAtual = 'listas';
const SECOES = [
  ['identidade','Identidade'], ['tipos','Tipos de celebração'], ['funcoes','Funções litúrgicas'],
  ['listas','Listas custom'], ['gerador','Regras do gerador'], ['comunidades','Comunidades & horários'],
  ['cadastro','Campos do cadastro'], ['admins','Admins & superadmin'],
];
async function init(){
  ctx = await initModulo();
  if (!ctx) return;
  if (!isSuperadmin(ctx)) { window.location.href = 'index.html'; return; } // gate
  renderHeader(ctx, 'config'); renderBottomNav(ctx, 'config');
  render();
}
function render(){
  const main = document.getElementById('main-content'); main.textContent='';
  const t = document.createElement('h1'); t.className='page-title'; t.textContent='Configuração'; main.appendChild(t);
  // menu lateral (chips horizontais no mobile)
  const nav = document.createElement('div'); nav.className='cfg-nav';
  SECOES.forEach(([id,label])=>{ const b=document.createElement('button'); b.className='cfg-tab'+(id===secaoAtual?' on':''); b.textContent=label; b.onclick=()=>{secaoAtual=id;render();}; nav.appendChild(b); });
  main.appendChild(nav);
  const body = document.createElement('div'); body.id='cfg-body'; main.appendChild(body);
  ({ listas:renderListas, tipos:renderTipos, funcoes:renderFuncoes, gerador:renderGerador,
     comunidades:renderComunidades, cadastro:renderCadastro, admins:renderAdmins, identidade:renderIdentidade
   }[secaoAtual] || (()=>{}))(body);
}
// helpers de escrita
async function setConfig(chave, valor){
  const { error } = await sb.from('acolitos_config').upsert({ chave, valor, updated_by: ctx.user.id, updated_at: new Date().toISOString() }, { onConflict:'chave' });
  if (error) { toast('Erro ao salvar.', 'error'); return false; }
  _APP_CONFIG[chave] = valor; toast('✓ Salvo!'); return true;
}
// stubs (preenchidos nas próximas tasks)
function renderListas(b){ b.textContent='(em construção)'; }
function renderTipos(b){ b.textContent='(em construção)'; }
function renderFuncoes(b){ b.textContent='(em construção)'; }
function renderGerador(b){ b.textContent='(em construção)'; }
function renderComunidades(b){ b.textContent='(em construção)'; }
function renderCadastro(b){ b.textContent='(em construção)'; }
function renderAdmins(b){ b.textContent='(em construção)'; }
function renderIdentidade(b){ b.textContent='(em construção)'; }
init();
```
CSS no `<style>`: `.cfg-nav{display:flex;gap:6px;overflow-x:auto;margin:-4px 0 14px;} .cfg-tab{padding:7px 12px;border-radius:20px;border:1px solid var(--border-wine);background:var(--surface2);color:var(--text-muted);font-family:'Sora';font-weight:700;font-size:12px;white-space:nowrap;cursor:pointer;} .cfg-tab.on{background:linear-gradient(165deg,rgba(232,185,74,.18),var(--surface));color:var(--gold-light);border-color:var(--gold-dim);}`

- [ ] **Step 5: Checar sintaxe**

Run:
```bash
node --check projetos/acolitos/shared.js && echo OK
open=$(grep -n '^<script>$' projetos/acolitos/config.html | tail -1 | cut -d: -f1)
close=$(awk -v s="$open" 'NR>s && /<\/script>/{print NR; exit}' projetos/acolitos/config.html)
sed -n "$((open+1)),$((close-1))p" projetos/acolitos/config.html > /tmp/chk.js && node --check /tmp/chk.js && echo OK
```
Expected: `OK` nos dois.

- [ ] **Step 6: Deploy + verificar gate**

Re-carimbar BUILD do sw.js, `vercel --prod`. Depois: logar como `erickmartins` → ver item **Config** na nav → abrir → ver os chips das seções. Logar como não-superadmin → **não** ver Config; abrir `config.html` direto → redireciona pra index.

---

## Task 3: Seção "Listas customizáveis" (habilidades, competências, setores, motivos)

**Files:** Modify `projetos/acolitos/config.html` (`renderListas`)

- [ ] **Step 1: Implementar `renderListas`** — sub-abas por tipo, CRUD em `acolitos_listas`.

```js
const LISTAS_TIPOS = [['habilidade','Habilidades'],['competencia','Competências'],['setor','Setores'],['motivo','Motivos de ausência']];
let _listaTipo = 'habilidade';
async function renderListas(b){
  b.textContent='';
  const subnav=document.createElement('div'); subnav.className='cfg-nav';
  LISTAS_TIPOS.forEach(([t,l])=>{ const x=document.createElement('button'); x.className='cfg-tab'+(t===_listaTipo?' on':''); x.textContent=l; x.onclick=()=>{_listaTipo=t;renderListas(b);}; subnav.appendChild(x); });
  b.appendChild(subnav);
  const { data } = await sb.from('acolitos_listas').select('id,valor,label').eq('tipo',_listaTipo).order('valor');
  (data||[]).forEach(item=>{
    const row=document.createElement('div'); row.style.cssText='display:flex;align-items:center;gap:8px;padding:7px 2px;border-bottom:1px solid var(--border);';
    const nm=document.createElement('span'); nm.style.flex='1'; nm.textContent=item.label||item.valor;
    const del=document.createElement('button'); del.className='mini-del'; del.textContent='−';
    del.onclick=async()=>{ if(!confirm('Remover "'+(item.label||item.valor)+'"?'))return; await sb.from('acolitos_listas').delete().eq('id',item.id); renderListas(b); };
    row.append(nm,del); b.appendChild(row);
  });
  const add=document.createElement('div'); add.style.cssText='display:flex;gap:8px;margin-top:10px;';
  const inp=document.createElement('input'); inp.className='form-input'; inp.placeholder='Novo item…';
  const bt=document.createElement('button'); bt.className='mini-add'; bt.textContent='+';
  bt.onclick=async()=>{ const v=inp.value.trim(); if(!v)return; const slug=v.toLowerCase().normalize('NFD').replace(/[^\w]+/g,'_'); await sb.from('acolitos_listas').insert({tipo:_listaTipo,valor:slug,label:v}); renderListas(b); };
  add.append(inp,bt); b.appendChild(add);
}
```

- [ ] **Step 2: Sintaxe + deploy + testar** — `node --check` no inline; deploy; adicionar/remover um item de teste em cada sub-aba; confirmar que aparece no app onde a lista é usada (ex.: setor novo aparece no organograma do Consilium; habilidade nova na ficha). Confirmar que `loadListasCustom` já mescla `acolitos_listas` (não precisa mexer).

---

## Task 4: Seção "Tipos de celebração"

**Files:** Modify `config.html` (`renderTipos`) + `shared.js` (`loadConfig` mescla em `TIPO_LABEL`) + `escala.html` (select de tipo lê da lista)

- [ ] **Step 1: `renderTipos`** — CRUD em `acolitos_listas` tipo `tipo_celebracao` (mesmo padrão da Task 3, lista única). Cada item: `valor`(slug)+`label`.

- [ ] **Step 2: Override em `TIPO_LABEL`** — em `shared.js`, definir `TIPO_LABEL` como `let` (padrão atual) e, no fim de `loadConfig`, mesclar:
```js
const tps = (_APP_CONFIG.__listas_tipo_celebracao)||[]; // ver Step 3
tps.forEach(t => { TIPO_LABEL[t.valor] = t.label; });
```
(Se `TIPO_LABEL` estiver em `escala.html`/`escalas-membro.html` e não no shared, mover pra shared OU aplicar o merge nas duas páginas. Verificar com grep `TIPO_LABEL =` antes.)

- [ ] **Step 3: `loadConfig` também carrega listas usadas como config** — estender `loadConfig` pra buscar `acolitos_listas` dos tipos `tipo_celebracao` e `funcao` e guardar em `_APP_CONFIG.__listas_tipo_celebracao` / `__listas_funcao`:
```js
const { data: lst } = await sb.from('acolitos_listas').select('tipo,valor,label,meta').in('tipo',['tipo_celebracao','funcao']);
_APP_CONFIG.__listas_tipo_celebracao = (lst||[]).filter(x=>x.tipo==='tipo_celebracao');
_APP_CONFIG.__listas_funcao = (lst||[]).filter(x=>x.tipo==='funcao');
```

- [ ] **Step 4: `escala.html` — select de tipo de celebração** lê de `TIPO_LABEL` (já mesclado) em vez de lista fixa. Localizar o `<select id="nc-tipo">` / onde monta as opções e gerar a partir de `Object.entries(TIPO_LABEL)`.

- [ ] **Step 5: Sintaxe + deploy + testar** — criar um tipo novo (ex.: "Missa de Formatura"), confirmar que aparece no select de criar celebração e que salva sem erro (constraint relaxada na Task 1).

---

## Task 5: Seção "Funções litúrgicas"

**Files:** Modify `config.html` (`renderFuncoes`) + `shared.js`/`escala.html` (override de `FUNCAO_LABEL`, `FUNCOES_MAIORES`, `FUNCOES_ORDER`)

- [ ] **Step 1: `renderFuncoes`** — CRUD em `acolitos_listas` tipo `funcao`, com `meta = {categoria, eh_maior, ordem}`. UI por item: rótulo (input), categoria (select: Cerimoniais/Altares/Litúrgicos/Episcopal/Apoio), eh_maior (toggle Sim/Não), ordem (number). Salvar via update do `meta` + `label`.

- [ ] **Step 2: Override em `escala.html`** — no `loadDados` (ou início), após `loadConfig`, se houver `__listas_funcao` não-vazio, reconstruir:
```js
const fns = cfg('__listas_funcao', []);
if (fns.length){
  fns.forEach(f=>{ FUNCAO_LABEL[f.valor]=f.label; });
  FUNCOES_MAIORES = new Set(fns.filter(f=>f.meta&&f.meta.eh_maior).map(f=>f.valor));   // FUNCOES_MAIORES vira let
  FUNCOES_ORDER = fns.slice().sort((a,b)=>(a.meta?.ordem??99)-(b.meta?.ordem??99)).map(f=>f.valor); // FUNCOES_ORDER vira let
}
```
(Tornar `FUNCOES_MAIORES` e `FUNCOES_ORDER` `let` em `escala.html`; `FUNCAO_LABEL` mutável.)

- [ ] **Step 3: Sintaxe + deploy + testar** — marcar uma função como "maior", regerar uma escala e confirmar via MCP SQL que cerimoniários foram reservados pra ela; mudar ordem e conferir o exportador.

---

## Task 6: Seção "Campos do cadastro"

**Files:** Modify `config.html` (`renderCadastro`) + `shared.js` (`camposIncompletos` lê config)

- [ ] **Step 1: `renderCadastro`** — checkboxes sobre os campos candidatos (os `key`/`label` de `CAMPOS_OBRIGATORIOS` + foto). Estado salvo em `config['cadastro_campos']` = `{ key:true/false, foto:true/false }`. Botão "Salvar".

- [ ] **Step 2: `camposIncompletos` lê config** — em `shared.js`:
```js
function camposIncompletos(membro) {
  const cfgCampos = cfg('cadastro_campos', null); // null = tudo ativo (comportamento atual)
  const ativo = k => !cfgCampos || cfgCampos[k] !== false;
  const faltam = CAMPOS_OBRIGATORIOS.filter(c => ativo(c.key) && (c.tipo==='bool' ? (membro[c.key]==null) : !String(membro[c.key]??'').trim()));
  if (ativo('foto') && !membro.foto_url) faltam.push({ key:'foto_url', label:'Foto de perfil', tipo:'foto' });
  return faltam;
}
```

- [ ] **Step 3: Sintaxe + deploy + testar** — desmarcar "endereço" e "foto"; reabrir o app com um membro incompleto só nesses → o "Complete seu cadastro" não deve mais cobrá-los.

---

## Task 7: Seção "Regras do gerador"

**Files:** Modify `config.html` (`renderGerador`) + `escala.html` (lê `config['gerador']`)

- [ ] **Step 1: `renderGerador`** — form sobre `config['gerador']`: `janela_dias` (number, default 42), `aleatorio` (toggle, default true), `kit_leve` (comunidade select + funções multi + idade_min number). Botão "Salvar".

- [ ] **Step 2: `escala.html` lê config (com fallback)** —
  - `carregarCargaHistorica`: `const dias = cfg('gerador',{}).janela_dias ?? 42;` no lugar do `42` fixo.
  - `elegivelFuncao`: a regra do kit lê `cfg('gerador',{}).kit_leve` (comunidade/funções/idade) com fallback pros valores atuais (`santo_antonio`, `['cruz','vela']`, `7`).

- [ ] **Step 3: Sintaxe + deploy + testar** — mudar janela pra 14 dias, regerar e conferir via SQL que o histórico considerado mudou; mudar idade do kit pra 9 e conferir elegibilidade no Sto. Antônio.

---

## Task 8: Seção "Comunidades & horários"

**Files:** Modify `config.html` (`renderComunidades`) + `escala.html` (criação de celebração lê horários/comunidades de config)

- [ ] **Step 1: `renderComunidades`** — editor de `config['comunidades']` = `[{slug,label,horarios:[...]}]`. UI: lista de comunidades (label editável, slug fixo após criado), cada uma com chips de horários (add/remove). Botão "Salvar".

- [ ] **Step 2: `escala.html` — criação de celebração** lê comunidades/horários de `cfg('comunidades', PADRAO)` (PADRAO = `[{slug:'matriz',label:'Matriz',horarios:['17h','7h','9h','19h']},{slug:'santo_antonio',label:'Sto. Antônio',horarios:['18h30']}]`). O select de comunidade e o de horário no modal "Nova celebração" passam a vir daí.

- [ ] **Step 3: Sintaxe + deploy + testar** — adicionar um horário novo (ex.: 11h na Matriz) e confirmar que aparece no select de criar celebração. NÃO renomear slug de comunidade existente (só label) pra não órfãos.

---

## Task 9: Seção "Admins & superadmin"

**Files:** Modify `config.html` (`renderAdmins`)

- [ ] **Step 1: `renderAdmins`** — duas partes:
  - **Papéis**: lista membros com `role in (coord_admin, subadmin)` (join `pastoral_members` + `acolitos_membros`), com botão promover/rebaixar via `apiPost('/api/acolito-admin', {action:'sync_role', user_id, role})`. Mostrar também um buscador pra promover qualquer membro a subadmin/coord_admin.
  - **Superadmins**: editar a lista `config['superadmins']` (chips de username add/remove). Aviso: não remover a si mesmo sem outro superadmin.

- [ ] **Step 2: Sintaxe + deploy + testar** — promover um membro descartável a subadmin e rebaixar de volta (NÃO usar contas reais — ver regra de não-mexer-em-dados-reais). Adicionar/remover um username superadmin de teste e confirmar que o gate (`isSuperadmin`) reflete após reload.

---

## Task 10: Seção "Identidade da pastoral" (tema — risco maior, por último)

**Files:** Modify `config.html` (`renderIdentidade`) + `shared.js` (aplicar tema/identidade no load)

- [ ] **Step 1: `renderIdentidade`** — form sobre `config['identidade']` = `{nome, paroquia, logo_url, cor_primaria, cor_ouro}`. Upload de logo reusa `uploadAvatar`-like (ou bucket avatars com prefixo). Color inputs pra cores. Botão "Salvar".

- [ ] **Step 2: Aplicar no load (`shared.js`)** — após `loadConfig`, se houver `identidade`, injetar variáveis CSS:
```js
const idn = cfg('identidade', null);
if (idn) {
  if (idn.cor_primaria) document.documentElement.style.setProperty('--wine', idn.cor_primaria);
  if (idn.cor_ouro) document.documentElement.style.setProperty('--gold', idn.cor_ouro);
  // nome/paróquia: usados em renderHeader/login (substituir textos fixos por cfg('identidade').nome quando presente)
}
```
Testar dark e light. Fallback: sem `identidade`, tema atual intacto.

- [ ] **Step 3: Sintaxe + deploy + testar** — trocar a cor ouro por outra, recarregar, conferir que o tema muda sem quebrar contraste; reverter.

---

## Self-review (cobertura do spec)

- §2.1 `acolitos_config` + RLS → Task 1. ✓
- §2.2/§2.3 listas + `meta jsonb` → Task 1 (schema) + Tasks 3/5. ✓
- §3 gate superadmin (RPC + front) → Task 1 (RPC) + Task 2 (`isSuperadmin`+nav). ✓
- §4 `config.html` shell → Task 2. ✓
- §5 as 8 seções → Tasks 3–10. ✓
- §6 pontos de integração (override) → Tasks 4/5/6/7/8/10. ✓
- §7 ordem de construção → ordem das tasks (shell→baixo risco→identidade). ✓
- §8 riscos → tema por último (Task 10), fallback em `loadConfig` (Task 2 try/catch), constraints relaxadas (Task 1). ✓
- §10 critérios de sucesso → passos de teste de cada task. ✓

Sem placeholders de implementação (stubs do shell na Task 2 são substituídos nas Tasks 3–10, explicitamente). Nomes consistentes: `cfg()`, `setConfig()`, `_APP_CONFIG`, `isSuperadmin()`, `loadConfig()`, `__listas_funcao`/`__listas_tipo_celebracao` usados igual entre tasks.
