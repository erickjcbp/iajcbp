# Cadastro Família ("Eu vs. Meu Filho") — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Na aba "Quero servir" do login, oferecer dois caminhos — "Eu vou servir" (fluxo atual) e "Meu filho(a) vai servir" (wizard que cadastra 1+ filhos com conta por filho, ligados por `grupo_irmaos`).

**Architecture:** Front em arquivo único `login.html` (chooser + wizard + JS vanilla). Os membros/contas dos filhos são criados **server-side** num endpoint serverless novo (`api/signup-familia.js`) com a service role, porque cada filho tem `user_id` próprio e a RLS (`user_id = auth.uid()`) impediria o responsável de inserir os irmãos pelo client. Dados dos pais ficam denormalizados em cada filho. Aprovação reusa o CRM (`etapa='aprovacao_cadastro'`).

**Tech Stack:** HTML/JS vanilla, Supabase (Auth admin API + PostgREST), Vercel serverless functions (Node 24), service role key (`SUPABASE_SERVICE_ROLE_KEY`).

**Spec:** `docs/superpowers/specs/2026-06-10-acolitos-cadastro-familia-design.md`

**Sem test runner no projeto.** Verificação = SQL via Supabase + `curl` ao endpoint (preview) + checagem no browser. Toda família de teste criada é **descartável** e removida no fim (regra: nunca tocar em contas reais).

---

## File Structure

- **DB migration** (via Supabase `apply_migration`, nome `acolitos_cadastro_familia_campos`): novas colunas em `acolitos_membros`.
- **Create:** `api/signup-familia.js` — endpoint do cadastro família.
- **Modify:** `projetos/acolitos/login.html` — chooser de 2 botões, wizard `screen-cadastro-familia`, e funções JS (`sugereUsuario`, `addFilho`, `sugereNoBloco`, `syncMinistro`, `criarFamilia`) + ajuste de `showScreen`.

---

## Task 1: Migration — colunas dos pais em `acolitos_membros`

**Files:**
- DB only (Supabase migration `acolitos_cadastro_familia_campos`).

- [ ] **Step 1: Verificar que as colunas ainda não existem (deve falhar/retornar vazio)**

Rodar via Supabase MCP `execute_sql` (project_id `fttjgsotuosjfrasttds`):
```sql
select column_name from information_schema.columns
where table_name='acolitos_membros'
  and column_name in ('nome_mae','nome_pai','contato_principal','celular_responsavel','responsavel_whatsapp');
```
Esperado: `[]` (nenhuma das colunas existe ainda).

- [ ] **Step 2: Aplicar a migration**

Via Supabase MCP `apply_migration` (name: `acolitos_cadastro_familia_campos`):
```sql
alter table acolitos_membros
  add column if not exists nome_mae text,
  add column if not exists nome_pai text,
  add column if not exists contato_principal text,
  add column if not exists celular_responsavel text,
  add column if not exists responsavel_whatsapp boolean not null default false;

alter table acolitos_membros
  drop constraint if exists acolitos_membros_contato_principal_check;
alter table acolitos_membros
  add constraint acolitos_membros_contato_principal_check
  check (contato_principal is null or contato_principal in ('mae','pai'));
```

- [ ] **Step 3: Confirmar que as 5 colunas existem**

Via `execute_sql`:
```sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_name='acolitos_membros'
  and column_name in ('nome_mae','nome_pai','contato_principal','celular_responsavel','responsavel_whatsapp')
order by column_name;
```
Esperado: 5 linhas — `celular_responsavel(text)`, `contato_principal(text)`, `nome_mae(text)`, `nome_pai(text)`, `responsavel_whatsapp(boolean,NO)`.

- [ ] **Step 4: Confirmar o CHECK de contato_principal**

Via `execute_sql`:
```sql
select pg_get_constraintdef(oid) from pg_constraint
where conname='acolitos_membros_contato_principal_check';
```
Esperado: `CHECK ((contato_principal IS NULL OR (contato_principal = ANY (ARRAY['mae'::text, 'pai'::text]))))`.

(Sem commit — migration vive no histórico do Supabase, não em arquivo no repo.)

---

## Task 2: Endpoint `api/signup-familia.js`

**Files:**
- Create: `api/signup-familia.js`

- [ ] **Step 1: Criar o arquivo com o handler completo**

```js
// Vercel serverless — cadastro de FAMÍLIA (responsável cadastra 1+ filhos).
// Público (a aprovação no CRM é a trava). Cria contas Auth + membros + entradas CRM
// server-side com a service role: cada filho tem user_id próprio, então a RLS
// (user_id = auth.uid()) não deixaria o responsável inserir os irmãos pelo client.
const DOMINIO = '@coroinhas.jcbplimeira.com.br';
const COMUNIDADES = ['matriz', 'santo_antonio', 'outra'];

function userBase(u) {
  return String(u || '').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const URL = process.env.SUPABASE_URL;
  const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL || !SRK) return res.status(500).json({ error: 'Server misconfigured' });

  const { senha, pais, filhos } = req.body || {};
  if (!senha || String(senha).length < 6) return res.status(400).json({ error: 'A senha deve ter ao menos 6 caracteres.' });
  if (!Array.isArray(filhos) || filhos.length < 1) return res.status(400).json({ error: 'Inclua ao menos um filho.' });
  for (const f of filhos) {
    if (!f || !String(f.nome || '').trim()) return res.status(400).json({ error: 'Cada filho precisa de um nome.' });
    if (!userBase(f.usuario)) return res.status(400).json({ error: 'Cada filho precisa de um usuário válido.' });
    if (f.comunidade && !COMUNIDADES.includes(f.comunidade)) return res.status(400).json({ error: 'Comunidade inválida.' });
  }

  const p = pais || {};
  const auth = { apikey: SRK, Authorization: `Bearer ${SRK}`, 'Content-Type': 'application/json' };
  const rest = { ...auth, Prefer: 'return=representation' };
  const grupo = crypto.randomUUID();

  const nomeMae = String(p.nome_mae || '').trim() || null;
  const nomePai = String(p.nome_pai || '').trim() || null;
  const contatoPrincipal = p.contato_principal === 'pai' ? 'pai' : (p.contato_principal === 'mae' ? 'mae' : null);
  const responsavelNome = contatoPrincipal === 'pai' ? nomePai : nomeMae;
  const paisBase = {
    nome_mae: nomeMae,
    nome_pai: nomePai,
    contato_principal: contatoPrincipal,
    celular_responsavel: String(p.celular || '').trim() || null,
    responsavel_whatsapp: !!p.whatsapp,
    responsavel: responsavelNome,
    tem_mae_ministro: !!p.mae_ministra,
    nome_mae_ministro: p.mae_ministra ? nomeMae : null,
    tem_pai_ministro: !!p.pai_ministro,
    nome_pai_ministro: p.pai_ministro ? nomePai : null,
    comunidade_ministro: (p.mae_ministra || p.pai_ministro) ? (String(p.comunidade_ministro || '').trim() || null) : null,
    grupo_irmaos: grupo,
    escalar_com_irmao: true,
    status: 'ativo'
  };

  const criados = []; // { authId, membroId, usuario }

  async function rollback() {
    for (const c of criados.slice().reverse()) {
      if (c.membroId) await fetch(`${URL}/rest/v1/acolitos_membros?id=eq.${c.membroId}`, { method: 'DELETE', headers: auth }).catch(() => {});
      if (c.authId) await fetch(`${URL}/auth/v1/admin/users/${c.authId}`, { method: 'DELETE', headers: auth }).catch(() => {});
    }
  }

  try {
    for (const f of filhos) {
      const nome = String(f.nome).trim();
      const base = userBase(f.usuario);

      // 1) cria a conta Auth resolvendo colisão de usuário com sufixo (base, base2, base3...)
      let usuario = base, authId = null;
      for (let n = 1; n <= 30; n++) {
        const tentativa = n === 1 ? base : base + n;
        const r = await fetch(`${URL}/auth/v1/admin/users`, {
          method: 'POST', headers: auth,
          body: JSON.stringify({ email: tentativa + DOMINIO, password: senha, email_confirm: true, user_metadata: { nome } })
        });
        const d = await r.json();
        if (r.ok) { authId = d.id; usuario = tentativa; break; }
        const existe = /registered|already|exists/i.test(d.msg || d.message || d.error_code || '');
        if (!existe) throw new Error(d.msg || d.message || ('Erro ao criar conta de ' + nome));
      }
      if (!authId) throw new Error('Não foi possível gerar um usuário para ' + nome);
      criados.push({ authId, membroId: null, usuario });

      // 2) cria o membro (denormaliza dados dos pais)
      const membro = { ...paisBase, user_id: authId, nome, data_nascimento: f.data_nascimento || null, comunidade: f.comunidade || null };
      const rm = await fetch(`${URL}/rest/v1/acolitos_membros`, { method: 'POST', headers: rest, body: JSON.stringify(membro) });
      const dm = await rm.json();
      if (!rm.ok || !dm[0]) throw new Error((dm && (dm.message || dm.error)) || ('Erro ao cadastrar ' + nome));
      criados[criados.length - 1].membroId = dm[0].id;

      // 3) entrada no CRM para aprovação da coordenação
      const rc = await fetch(`${URL}/rest/v1/acolitos_crm`, { method: 'POST', headers: auth, body: JSON.stringify({ membro_id: dm[0].id, etapa: 'aprovacao_cadastro' }) });
      if (!rc.ok) { const dc = await rc.json().catch(() => ({})); throw new Error(dc.message || ('Erro ao registrar aprovação de ' + nome)); }
    }
  } catch (e) {
    await rollback();
    return res.status(400).json({ error: e.message || 'Não foi possível concluir o cadastro.' });
  }

  return res.status(200).json({ ok: true, usuarios: criados.map(c => c.usuario) });
}
```

- [ ] **Step 2: Lint local — arquivo é JS válido (sintaxe)**

Run: `node --check api/signup-familia.js`
Esperado: sem saída (exit 0).

- [ ] **Step 3: Commit**

```bash
git add api/signup-familia.js
git commit -m "feat(acolitos): endpoint signup-familia (cadastro de filhos com conta de familia)"
```

(Verificação funcional ponta-a-ponta é a Task 6, após o deploy.)

---

## Task 3: `login.html` — chooser de 2 botões

**Files:**
- Modify: `projetos/acolitos/login.html` (bloco `<!-- CADASTRO -->`, ~linhas 131-144, e `showScreen` ~linha 164)

- [ ] **Step 1: Transformar `screen-cadastro` em chooser e mover o form solo para `screen-cadastro-solo`**

Substituir o bloco atual:
```html
    <!-- CADASTRO -->
    <div id="screen-cadastro" class="screen">
      <p class="hint">Crie seu acesso para ingressar na pastoral. Depois você preenche seu cadastro e a coordenação aprova.</p>
      <label>Nome completo</label>
      <input type="text" id="ca-nome" placeholder="Seu nome completo">
      <label>Usuário (escolha o seu)</label>
      <input type="text" id="ca-email" placeholder="ex: joao.silva" autocomplete="username">
      <label>Crie uma senha</label>
      <input type="password" id="ca-senha" placeholder="mínimo 6 caracteres"
             onkeydown="if(event.key==='Enter')criarConta()">
      <button class="btn" id="btn-cadastro" onclick="criarConta()">Criar conta e continuar</button>
      <a class="link-action" onclick="showScreen('entrar')">Já tenho conta — entrar</a>
      <div class="msg" id="msg-cadastro"></div>
    </div>
```
por:
```html
    <!-- CADASTRO — escolha do caminho -->
    <div id="screen-cadastro" class="screen">
      <p class="hint">Quem vai servir ao altar?</p>
      <button class="btn" onclick="showScreen('cadastro-solo')">Eu vou servir</button>
      <button class="btn" style="background:transparent;border:1px solid var(--gold,#8a6a24)" onclick="showScreen('cadastro-familia')">Meu filho(a) vai servir</button>
      <a class="link-action" onclick="showScreen('entrar')">Já tenho conta — entrar</a>
    </div>

    <!-- CADASTRO — eu vou servir (fluxo atual) -->
    <div id="screen-cadastro-solo" class="screen">
      <p class="hint">Crie seu acesso para ingressar na pastoral. Depois você preenche seu cadastro e a coordenação aprova.</p>
      <label>Nome completo</label>
      <input type="text" id="ca-nome" placeholder="Seu nome completo">
      <label>Usuário (escolha o seu)</label>
      <input type="text" id="ca-email" placeholder="ex: joao.silva" autocomplete="username">
      <label>Crie uma senha</label>
      <input type="password" id="ca-senha" placeholder="mínimo 6 caracteres"
             onkeydown="if(event.key==='Enter')criarConta()">
      <button class="btn" id="btn-cadastro" onclick="criarConta()">Criar conta e continuar</button>
      <a class="link-action" onclick="showScreen('cadastro')">← Voltar</a>
      <div class="msg" id="msg-cadastro"></div>
    </div>
```

- [ ] **Step 2: Ajustar `showScreen` para manter a aba "Quero servir" ativa em qualquer sub-tela `cadastro*`**

Substituir:
```js
    document.getElementById('t-cadastro').classList.toggle('active', s==='cadastro');
```
por:
```js
    document.getElementById('t-cadastro').classList.toggle('active', s.indexOf('cadastro')===0);
```

- [ ] **Step 3: Verificar no browser que o chooser aparece e roteia**

Abrir `login.html` (preview/local), clicar aba "Quero servir" → ver os 2 botões. Clicar "Eu vou servir" → aparece o form solo (campos Nome/Usuário/Senha). "← Voltar" → volta ao chooser. (Família ainda não montada — Task 4.)
Esperado: nenhum erro no console; o fluxo solo (`criarConta`) continua intacto.

- [ ] **Step 4: Commit**

```bash
git add projetos/acolitos/login.html
git commit -m "feat(acolitos): chooser eu/meu-filho na aba Quero servir"
```

---

## Task 4: `login.html` — markup do wizard família

**Files:**
- Modify: `projetos/acolitos/login.html` (inserir `screen-cadastro-familia` logo após `screen-cadastro-solo`)

- [ ] **Step 1: Inserir o bloco do wizard após `</div>` de `screen-cadastro-solo`**

```html
    <!-- CADASTRO — meu filho vai servir -->
    <div id="screen-cadastro-familia" class="screen">
      <p class="hint">Cadastro dos pais e do(s) filho(s) que vão servir.</p>

      <div style="font-weight:700;margin:10px 0 4px">Dados dos pais</div>
      <label>Nome da mãe</label>
      <input type="text" id="cf-nome-mae" oninput="syncMinistro()">
      <label>Nome do pai</label>
      <input type="text" id="cf-nome-pai" oninput="syncMinistro()">
      <label>Telefone/WhatsApp de contato</label>
      <input type="text" id="cf-celular" placeholder="(19) 90000-0000">
      <label style="display:flex;align-items:center;gap:6px"><input type="checkbox" id="cf-whatsapp" checked style="width:auto"> É WhatsApp</label>
      <label>Contato principal</label>
      <div style="display:flex;gap:16px;margin-bottom:8px">
        <label style="display:flex;align-items:center;gap:6px"><input type="radio" name="cf-contato" value="mae" checked style="width:auto"> Mãe</label>
        <label style="display:flex;align-items:center;gap:6px"><input type="radio" name="cf-contato" value="pai" style="width:auto"> Pai</label>
      </div>
      <label style="display:flex;align-items:center;gap:6px"><input type="checkbox" id="cf-mae-ministra" onchange="syncMinistro()" style="width:auto"> Mãe é ministra na paróquia</label>
      <label style="display:flex;align-items:center;gap:6px"><input type="checkbox" id="cf-pai-ministro" onchange="syncMinistro()" style="width:auto"> Pai é ministro na paróquia</label>
      <div id="cf-ministro-comunidade-wrap" style="display:none">
        <label>Comunidade dos ministros</label>
        <input type="text" id="cf-comunidade-ministro">
      </div>

      <div style="font-weight:700;margin:14px 0 4px">Filho(s) que vão servir</div>
      <div id="cf-filhos"></div>
      <button class="btn" type="button" style="background:transparent;border:1px solid var(--gold,#8a6a24)" onclick="addFilho()">+ Adicionar outro filho</button>

      <div style="font-weight:700;margin:14px 0 4px">Senha de acesso</div>
      <p class="hint">Criaremos uma conta por filho (usuário sugerido do nome). Qualquer uma enxerga todos os irmãos para acompanhar a jornada.</p>
      <label>Senha única (todas as contas)</label>
      <input type="password" id="cf-senha" placeholder="mínimo 6 caracteres">
      <button class="btn" id="btn-cadastro-familia" onclick="criarFamilia()">Criar contas e continuar</button>
      <a class="link-action" onclick="showScreen('cadastro')">← Voltar</a>
      <div class="msg" id="msg-familia"></div>
    </div>
```

- [ ] **Step 2: Verificar que a tela renderiza sem quebrar layout**

Abrir login → "Quero servir" → "Meu filho(a) vai servir". A tela aparece com seções Pais / Filhos / Senha. (Lista de filhos vazia até a Task 5 inicializar; botões já visíveis.)
Esperado: sem erro de HTML; `console` pode acusar `addFilho`/`syncMinistro`/`criarFamilia` indefinidos ao interagir — resolvido na Task 5.

- [ ] **Step 3: Commit**

```bash
git add projetos/acolitos/login.html
git commit -m "feat(acolitos): markup do wizard de cadastro familia"
```

---

## Task 5: `login.html` — JS do wizard família

**Files:**
- Modify: `projetos/acolitos/login.html` (`<script>`, inserir antes da linha do deep-link `if (location.hash === '#cadastro')`)

- [ ] **Step 1: Inserir as funções do wizard**

Inserir, dentro do `<script>`, logo antes de `// Deep-link da landing`:
```js
  // ── Cadastro família ───────────────────────────────────────────
  function sugereUsuario(nome){
    const limpo = String(nome||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
    const toks = limpo.split(/\s+/).filter(Boolean);
    if(!toks.length) return '';
    const base = toks.length===1 ? toks[0] : (toks[0]+'.'+toks[toks.length-1]);
    return base.replace(/[^a-z0-9._-]/g,'');
  }
  function sugereNoBloco(inp){
    const bloco = inp.closest('.filho-block');
    const userInp = bloco.querySelector('.cf-filho-user');
    if(userInp.dataset.touched) return;          // não sobrescreve se o usuário editou
    userInp.value = sugereUsuario(inp.value);
  }
  function addFilho(){
    const wrap = document.getElementById('cf-filhos');
    const n = wrap.children.length + 1;
    const div = document.createElement('div');
    div.className = 'filho-block';
    div.style.cssText = 'border:1px solid var(--gold,#8a6a24);border-radius:8px;padding:10px;margin-bottom:10px';
    div.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;font-weight:700;margin-bottom:6px">Filho '+n+
      ' <button type="button" style="background:none;border:none;color:#c66;cursor:pointer;font-size:12px" onclick="removeFilho(this)">remover</button></div>'+
      '<label>Nome completo</label><input type="text" class="cf-filho-nome" oninput="sugereNoBloco(this)">'+
      '<label>Data de nascimento</label><input type="date" class="cf-filho-nasc">'+
      '<label>Comunidade</label><select class="cf-filho-com"><option value="matriz">Matriz</option><option value="santo_antonio">Sto. Antônio</option><option value="outra">Outra</option></select>'+
      '<label>Usuário sugerido</label><input type="text" class="cf-filho-user" placeholder="ex: joao.silva" oninput="this.dataset.touched=1">';
    wrap.appendChild(div);
  }
  function removeFilho(btn){
    const wrap = document.getElementById('cf-filhos');
    if(wrap.children.length <= 1){ msg('msg-familia','É preciso ao menos um filho.','error'); return; }
    btn.closest('.filho-block').remove();
    [...wrap.children].forEach((b,i)=>{ b.firstChild.childNodes[0].nodeValue = 'Filho '+(i+1)+' '; });
  }
  function syncMinistro(){
    const mae = document.getElementById('cf-nome-mae').value.trim();
    const pai = document.getElementById('cf-nome-pai').value.trim();
    const cm = document.getElementById('cf-mae-ministra');
    const cp = document.getElementById('cf-pai-ministro');
    cm.disabled = !mae; if(!mae) cm.checked = false;
    cp.disabled = !pai; if(!pai) cp.checked = false;
    document.getElementById('cf-ministro-comunidade-wrap').style.display = (cm.checked||cp.checked) ? 'block' : 'none';
  }
  async function criarFamilia(){
    const btn = document.getElementById('btn-cadastro-familia');
    const senha = document.getElementById('cf-senha').value;
    const nomeMae = document.getElementById('cf-nome-mae').value.trim();
    const nomePai = document.getElementById('cf-nome-pai').value.trim();
    if(!nomeMae && !nomePai){ msg('msg-familia','Informe o nome da mãe ou do pai.','error'); return; }
    if(senha.length < 6){ msg('msg-familia','A senha deve ter ao menos 6 caracteres.','error'); return; }
    const blocks = [...document.querySelectorAll('#cf-filhos .filho-block')];
    if(!blocks.length){ msg('msg-familia','Inclua ao menos um filho.','error'); return; }
    const filhos = [];
    for(const b of blocks){
      const nome = b.querySelector('.cf-filho-nome').value.trim();
      if(!nome){ msg('msg-familia','Preencha o nome de todos os filhos.','error'); return; }
      let usuario = b.querySelector('.cf-filho-user').value.trim();
      if(!usuario) usuario = sugereUsuario(nome);
      filhos.push({ nome, usuario, data_nascimento: b.querySelector('.cf-filho-nasc').value || null, comunidade: b.querySelector('.cf-filho-com').value });
    }
    const pais = {
      nome_mae: nomeMae, nome_pai: nomePai,
      celular: document.getElementById('cf-celular').value.trim(),
      whatsapp: document.getElementById('cf-whatsapp').checked,
      contato_principal: document.querySelector('input[name=cf-contato]:checked').value,
      mae_ministra: document.getElementById('cf-mae-ministra').checked,
      pai_ministro: document.getElementById('cf-pai-ministro').checked,
      comunidade_ministro: document.getElementById('cf-comunidade-ministro').value.trim()
    };
    btn.disabled = true; btn.textContent = 'Criando...';
    try {
      const r = await fetch('/api/signup-familia', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ senha, pais, filhos }) });
      const d = await r.json();
      if(!r.ok) throw new Error(d.error || 'Erro ao criar cadastro.');
      msg('msg-familia','Contas criadas! Anote os usuários: '+d.usuarios.join(', ')+'. A senha é a que você definiu. Agora é só entrar.','success');
      setTimeout(()=>showScreen('entrar'), 5000);
    } catch(e){
      msg('msg-familia', e.message || 'Não foi possível concluir o cadastro.','error');
      btn.disabled = false; btn.textContent = 'Criar contas e continuar';
    }
  }
  // inicializa o wizard com 1 filho e o estado dos toggles de ministro
  addFilho(); syncMinistro();
```

- [ ] **Step 2: Lint — o HTML continua parseável e o JS sem erro de sintaxe**

Run: `node -e "const s=require('fs').readFileSync('projetos/acolitos/login.html','utf8'); const m=s.match(/<script>([\s\S]*)<\/script>/)[1]; new Function(m); console.log('script OK');"`
Esperado: imprime `script OK` (a função compila sem SyntaxError).

- [ ] **Step 3: Verificar interação no browser**

Abrir login → "Quero servir" → "Meu filho(a) vai servir":
- Já aparece **1 bloco de filho**.
- Digitar "João da Silva" no nome do filho → campo "Usuário sugerido" preenche `joao.silva`.
- "+ Adicionar outro filho" cria "Filho 2"; "remover" tira (não deixa zerar).
- Os toggles "Mãe é ministra"/"Pai é ministro" só habilitam quando o nome correspondente está preenchido; marcando, surge "Comunidade dos ministros".
Esperado: sem erros no console.

- [ ] **Step 4: Commit**

```bash
git add projetos/acolitos/login.html
git commit -m "feat(acolitos): JS do wizard de cadastro familia (sugestao de usuario, filhos, ministros)"
```

---

## Task 6: Deploy + verificação ponta-a-ponta (com família descartável)

**Files:** nenhum (deploy + testes + limpeza)

- [ ] **Step 1: Deploy de preview (não mexe em produção)**

Guardar a landing WIP e subir preview:
```bash
git stash push -m "WIP landing" -- projetos/acolitos/pastoral.html 2>/dev/null
vercel --yes 2>&1 | tail -3   # preview; anotar a URL https://...vercel.app
git stash pop 2>/dev/null
```
Esperado: deploy `Ready`; guardar a URL de preview em `$PREVIEW`.

- [ ] **Step 2: Criar uma família de teste DESCARTÁVEL via o endpoint**

```bash
curl -s -X POST "$PREVIEW/api/signup-familia" -H 'Content-Type: application/json' -d '{
  "senha":"teste123",
  "pais":{"nome_mae":"Maria Teste QA","nome_pai":"Jose Teste QA","celular":"19999990000","whatsapp":true,"contato_principal":"mae","mae_ministra":true,"pai_ministro":false,"comunidade_ministro":"Matriz"},
  "filhos":[
    {"nome":"Joao Teste QA","usuario":"joao.teste.qa","data_nascimento":"2014-03-01","comunidade":"matriz"},
    {"nome":"Ana Teste QA","usuario":"ana.teste.qa","data_nascimento":"2016-07-12","comunidade":"matriz"}
  ]
}'
```
Esperado: `{"ok":true,"usuarios":["joao.teste.qa","ana.teste.qa"]}`.

- [ ] **Step 3: Verificar no banco (SQL via Supabase) que tudo foi criado e vinculado**

```sql
select nome, status, comunidade, grupo_irmaos, escalar_com_irmao, nome_mae, nome_pai,
       contato_principal, celular_responsavel, responsavel_whatsapp,
       tem_mae_ministro, nome_mae_ministro, tem_pai_ministro
from acolitos_membros where nome like '%Teste QA%' order by nome;
```
Esperado: 2 linhas, **mesmo `grupo_irmaos`**, `escalar_com_irmao=true`, `status='ativo'`, `nome_mae='Maria Teste QA'`, `tem_mae_ministro=true`, `nome_mae_ministro='Maria Teste QA'`, `tem_pai_ministro=false`.

```sql
select c.etapa, m.nome from acolitos_crm c join acolitos_membros m on m.id=c.membro_id
where m.nome like '%Teste QA%';
```
Esperado: 2 linhas com `etapa='aprovacao_cadastro'`.

- [ ] **Step 4: Verificar colisão de usuário (sufixo) — repetir um usuário já criado**

```bash
curl -s -X POST "$PREVIEW/api/signup-familia" -H 'Content-Type: application/json' -d '{
  "senha":"teste123","pais":{"nome_mae":"Maria Teste QA"},
  "filhos":[{"nome":"Joao Teste QA Dois","usuario":"joao.teste.qa","comunidade":"matriz"}]
}'
```
Esperado: `{"ok":true,"usuarios":["joao.teste.qa2"]}` (sufixo numérico aplicado).

- [ ] **Step 5: LIMPEZA — apagar a família de teste (Auth + membros + CRM)**

Pegar os user_ids e apagar via SQL (CRM/membros caem por CASCADE ao apagar o membro; depois remover as contas Auth):
```sql
-- 1) ver os user_ids de teste para apagar do Auth
select user_id, nome from acolitos_membros where nome like '%Teste QA%';
-- 2) apagar os membros (CASCADE limpa acolitos_crm)
delete from acolitos_membros where nome like '%Teste QA%';
```
Para cada `user_id` retornado, apagar a conta Auth via Supabase MCP/admin (ou `auth.users`):
```sql
delete from auth.users where id in (
  -- colar aqui os user_ids do passo 1
);
```
Esperado: `select count(*) from acolitos_membros where nome like '%Teste QA%';` → `0`; e os usuários `joao.teste.qa%`, `ana.teste.qa` somem de `auth.users`.

- [ ] **Step 6: Deploy de produção (com os fixes; sem a landing WIP)**

```bash
git stash push -m "WIP landing" -- projetos/acolitos/pastoral.html 2>/dev/null
vercel --prod --yes 2>&1 | tail -3
git stash pop 2>/dev/null
```
Esperado: produção `Ready`. O fluxo "Eu vou servir" continua idêntico; "Meu filho(a) vai servir" disponível.

---

## Notas de verificação final

- **Cobertura do spec:** chooser (T3) ✓; dados dos pais + ministros reaproveitando nomes (T2,T4,T5) ✓; filhos com nome/nascimento/comunidade + add (T4,T5) ✓; uma senha única (T2,T5) ✓; grupo_irmaos + escalar_com_irmao (T2) ✓; usuário sugerido + colisão (T2,T5,T6) ✓; CRM aprovacao_cadastro (T2,T6) ✓; rollback (T2) ✓; mostrar usuários criados (T5) ✓; migration colunas (T1) ✓.
- **Regra de dados reais:** a única escrita de teste é a família "Teste QA", removida no Step 5 antes do deploy de produção.
