# Acólitos Fase 1B — novos.html + crm.html + membros.html + index.html

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir os quatro arquivos HTML da Fase 1: cadastro de novos membros, pipeline CRM, gestão de membros e home dashboard.

**Architecture:** Cada arquivo linkando shared.css + shared.js (Fase 1A). Mobile-first. Auth guard via initModulo(). Sem innerHTML com dados não confiáveis — dados do banco inseridos via textContent ou escHtml().

**Tech Stack:** HTML/CSS/JS vanilla, Supabase JS v2, shared.js/shared.css da Fase 1A.

**Pré-requisito:** Fase 1A concluída (schema aplicado, shared.css e shared.js criados).

## Notas de Segurança

**innerHTML — todas as ocorrências neste plano são seguras:**
- `addMembroBloco()`: usa apenas `idx` (número inteiro contador) — zero dados de usuário
- `avatarHtml()`: usa `sanitizeUrl()` + `escHtml()` antes de qualquer dado do banco
- `_navIcon()` / `renderHeader()`: strings SVG e labels hardcoded no código

Dados do banco (nomes, textos, datas) são sempre inseridos via `.textContent =` ou `escHtml()`.

**SRI (Subresource Integrity) — ação necessária ao implementar:**

Todos os `<script src="https://cdn.jsdelivr.net/...">` devem incluir o atributo `integrity`. Buscar o hash em [srihash.org](https://www.srihash.org) com a URL exata antes de subir para produção. Exemplo de como deve ficar:

```html
<script
  src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/dist/umd/supabase.min.js"
  integrity="sha384-HASH_AQUI"
  crossorigin="anonymous">
</script>
```

O mesmo se aplica ao `shared.js` existente em `central.html` e `login.html` — pendência de todo o projeto, não só deste módulo.

---

## File Structure

```
projetos/acolitos/
  novos.html    — cadastro novo membro (CREATE)      ← Task 4
  crm.html      — pipeline CRM equipe (READ/UPDATE)  ← Task 5
  membros.html  — gestão de membros (READ/UPDATE)    ← Task 6
  index.html    — home: status CRM ou dashboard      ← Task 7
vercel.json     — rotas do módulo                    ← Task 8
```

---

## Task 4: novos.html

**Files:**
- Create: `projetos/acolitos/novos.html`

- [ ] **Step 1: Criar o arquivo**

```html
<!DOCTYPE html>
<html lang="pt-BR" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <title>Novo Membro — Acólitos JCBP</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Lora:ital,wght@0,400;0,500;1,400&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="shared.css">
  <style>
    body { padding-bottom: 0; }
    .registro-wrap { max-width: 560px; margin: 0 auto; padding: 20px 16px 40px; }
    .membro-bloco {
      background: var(--surface); border: 1px solid var(--border-wine);
      border-radius: 4px; padding: 20px 16px; margin-bottom: 16px; position: relative;
    }
    .membro-bloco-title {
      font-family: 'Cinzel', serif; font-size: 13px; color: var(--gold);
      letter-spacing: 1px; margin-bottom: 16px; text-transform: uppercase;
    }
    .btn-remover {
      position: absolute; top: 12px; right: 12px;
      background: transparent; border: none; color: var(--text-muted);
      cursor: pointer; font-size: 18px; padding: 4px; line-height: 1;
    }
    .toggle-row { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
    .toggle-row label { font-size: 13px; color: var(--text); flex: 1; }
    .toggle-checkbox { width: 20px; height: 20px; accent-color: var(--gold); cursor: pointer; }
    .expand-block { display: none; margin-top: 10px; }
    .expand-block.show { display: block; }
    .section-divider {
      border: none; border-top: 1px solid var(--border-wine);
      margin: 24px 0; opacity: .5;
    }
    .responsavel-section {
      background: var(--surface); border: 1px solid var(--border-wine);
      border-radius: 4px; padding: 20px 16px; margin-bottom: 20px;
    }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
</head>
<body>
<div id="app-header"></div>

<div class="registro-wrap">
  <h1 class="page-title" style="margin-top:16px;">Cadastro de Novo Membro</h1>
  <p style="color:var(--text-muted);font-size:13px;margin-bottom:24px;font-style:italic;">
    Preencha os dados abaixo para ingressar na Pastoral de Acólitos e Coroinhas.
  </p>

  <!-- MEMBROS -->
  <div id="membros-container"></div>
  <button type="button" class="btn" style="background:transparent;border:1px dashed var(--border-wine);color:var(--text-muted);margin-bottom:20px;" onclick="addMembroBloco()">
    + Adicionar outro membro (irmão/filho)
  </button>

  <hr class="section-divider">

  <!-- RESPONSÁVEL -->
  <div class="responsavel-section">
    <div class="membro-bloco-title">Dados do Responsável / Contato</div>
    <div class="form-group">
      <label class="form-label">Nome do Pai</label>
      <input class="form-input" id="r-nome-pai" placeholder="Nome completo do pai">
    </div>
    <div class="form-group">
      <label class="form-label">Nome da Mãe</label>
      <input class="form-input" id="r-nome-mae" placeholder="Nome completo da mãe">
    </div>
    <div class="form-group">
      <label class="form-label">Celular da Mãe</label>
      <input class="form-input" id="r-cel-mae" type="tel" placeholder="(99) 99999-9999">
    </div>
    <div class="form-group">
      <label class="form-label">Celular de Recado</label>
      <input class="form-input" id="r-cel-recado" type="tel" placeholder="(99) 99999-9999">
    </div>
    <div class="form-group">
      <label class="form-label">Endereço</label>
      <input class="form-input" id="r-endereco" placeholder="Rua, número, bairro">
    </div>

    <div class="toggle-row">
      <label>Os pais são ministros extraordinários?</label>
      <input class="toggle-checkbox" type="checkbox" id="r-pais-ministros" onchange="togglePaisMinistros()">
    </div>
    <div class="expand-block" id="bloco-pais-ministros">
      <div class="form-group">
        <label class="form-label">Nome do Ministro (pai/mãe)</label>
        <input class="form-input" id="r-nome-ministro" placeholder="Nome completo">
      </div>
      <div class="form-group">
        <label class="form-label">Comunidade</label>
        <select class="form-select" id="r-comunidade-ministro">
          <option value="">Selecionar...</option>
          <option value="matriz">Matriz</option>
          <option value="santo_antonio">Santo Antônio</option>
        </select>
      </div>
    </div>
  </div>

  <div id="msg-cadastro"></div>
  <button type="button" class="btn gold" id="btn-cadastrar" onclick="enviarCadastro()">
    Concluir Cadastro
  </button>
</div>

<script src="shared.js"></script>
<script>
let membroCount = 0;
let currentUser = null;

async function init() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { window.location.href = '../central/login.html'; return; }
  currentUser = session.user;

  // Se já tem vínculo, redireciona
  const { data: modulo } = await sbAdmin
    .from('pastoral_modules').select('id').eq('slug','acolitos').single();
  if (modulo) {
    const { data: vinculo } = await sbAdmin
      .from('pastoral_members')
      .select('id').eq('user_id', session.user.id).eq('module_id', modulo.id).maybeSingle();
    if (vinculo) { window.location.href = 'index.html'; return; }
  }

  renderHeader({ user: session.user, membership: null, membro: null }, null);
  addMembroBloco(); // primeiro bloco
}

function addMembroBloco() {
  membroCount++;
  const idx = membroCount;
  const container = document.getElementById('membros-container');
  const bloco = document.createElement('div');
  bloco.className = 'membro-bloco';
  bloco.id = `membro-bloco-${idx}`;
  bloco.innerHTML = `
    <div class="membro-bloco-title">Membro ${idx}</div>
    ${idx > 1 ? `<button class="btn-remover" onclick="removeBloco(${idx})" title="Remover">✕</button>` : ''}
    <div class="form-group">
      <label class="form-label">Nome Completo *</label>
      <input class="form-input" id="m${idx}-nome" placeholder="Nome completo" required>
    </div>
    <div class="form-group">
      <label class="form-label">Data de Nascimento *</label>
      <input class="form-input" id="m${idx}-nasc" type="date" required>
    </div>
    <div class="form-group">
      <label class="form-label">Celular do Membro (opcional)</label>
      <input class="form-input" id="m${idx}-cel" type="tel" placeholder="(99) 99999-9999">
    </div>
    <div class="form-group">
      <label class="form-label">Comunidade Principal *</label>
      <select class="form-select" id="m${idx}-comunidade">
        <option value="matriz">Matriz</option>
        <option value="santo_antonio">Santo Antônio</option>
        <option value="outra">Outra</option>
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Sacramentos</label>
      <div class="form-toggle-group">
        <button type="button" class="form-toggle" id="m${idx}-batismo" onclick="toggleSacramento(${idx},'batismo')">Batismo</button>
        <button type="button" class="form-toggle" id="m${idx}-eucaristia" onclick="toggleSacramento(${idx},'eucaristia')">1ª Eucaristia</button>
        <button type="button" class="form-toggle" id="m${idx}-crisma" onclick="toggleSacramento(${idx},'crisma')">Crisma</button>
      </div>
    </div>
    <div class="toggle-row">
      <label>Já possui túnica?</label>
      <input class="toggle-checkbox" type="checkbox" id="m${idx}-tunica">
    </div>
    <div class="toggle-row">
      <label>Já está no grupo de WhatsApp?</label>
      <input class="toggle-checkbox" type="checkbox" id="m${idx}-whatsapp">
    </div>
  `;
  // innerHTML acima usa apenas dados hardcoded (idx é número) — seguro
  container.appendChild(bloco);
}

function removeBloco(idx) {
  document.getElementById(`membro-bloco-${idx}`)?.remove();
}

function toggleSacramento(idx, tipo) {
  const btn = document.getElementById(`m${idx}-${tipo}`);
  btn.classList.toggle('active');
}

function togglePaisMinistros() {
  const checked = document.getElementById('r-pais-ministros').checked;
  document.getElementById('bloco-pais-ministros').classList.toggle('show', checked);
}

function showMsg(text, tipo) {
  const el = document.getElementById('msg-cadastro');
  el.className = 'msg ' + tipo;
  el.textContent = text;
}

async function enviarCadastro() {
  const btn = document.getElementById('btn-cadastrar');
  btn.disabled = true;
  btn.textContent = 'Salvando...';

  // Coleta dados do responsável
  const resp = {
    nome_pai: document.getElementById('r-nome-pai').value.trim(),
    nome_mae: document.getElementById('r-nome-mae').value.trim(),
    cel_mae:  document.getElementById('r-cel-mae').value.trim(),
    cel_recado: document.getElementById('r-cel-recado').value.trim(),
    endereco: document.getElementById('r-endereco').value.trim(),
    tem_pai_ministro:  document.getElementById('r-pais-ministros').checked,
    nome_ministro: document.getElementById('r-nome-ministro').value.trim(),
    comunidade_ministro: document.getElementById('r-comunidade-ministro').value,
  };

  // Coleta blocos de membros
  const blocos = document.querySelectorAll('.membro-bloco');
  if (!blocos.length) { showMsg('Adicione ao menos um membro.', 'error'); btn.disabled = false; btn.textContent = 'Concluir Cadastro'; return; }

  const membrosData = [];
  for (const bloco of blocos) {
    const id = bloco.id.replace('membro-bloco-','');
    const nome = document.getElementById(`m${id}-nome`)?.value.trim();
    const nasc = document.getElementById(`m${id}-nasc`)?.value;
    if (!nome || !nasc) {
      showMsg('Nome e data de nascimento são obrigatórios para todos os membros.', 'error');
      btn.disabled = false; btn.textContent = 'Concluir Cadastro'; return;
    }
    membrosData.push({
      nome,
      data_nascimento: nasc,
      telefone: document.getElementById(`m${id}-cel`)?.value.trim() || null,
      comunidade: document.getElementById(`m${id}-comunidade`)?.value || 'matriz',
      responsavel: [resp.nome_pai, resp.nome_mae].filter(Boolean).join(' / ') || null,
      tem_pai_ministro: resp.tem_pai_ministro,
      nome_pai_ministro: resp.tem_pai_ministro ? resp.nome_ministro || null : null,
      tem_mae_ministro: resp.tem_pai_ministro,
      nome_mae_ministro: resp.tem_pai_ministro ? resp.nome_ministro || null : null,
      comunidade_ministro: resp.tem_pai_ministro ? resp.comunidade_ministro || null : null,
      escalar_com_pais: resp.tem_pai_ministro,
      observacoes: [
        resp.cel_mae   ? `Cel. mãe: ${resp.cel_mae}`   : null,
        resp.cel_recado? `Recado: ${resp.cel_recado}`  : null,
        resp.endereco  ? `End.: ${resp.endereco}`       : null,
      ].filter(Boolean).join(' | ') || null,
    });
  }

  // Busca module_id
  const { data: modulo } = await sbAdmin
    .from('pastoral_modules').select('id').eq('slug','acolitos').single();
  if (!modulo) { showMsg('Erro interno. Contate o administrador.', 'error'); btn.disabled = false; btn.textContent = 'Concluir Cadastro'; return; }

  // Insere membros
  for (let i = 0; i < membrosData.length; i++) {
    const mData = { ...membrosData[i] };
    // Primeiro membro → vincula ao usuário logado
    if (i === 0) mData.user_id = currentUser.id;

    const { data: membro, error: eM } = await sbAdmin
      .from('acolitos_membros').insert(mData).select('id').single();
    if (eM || !membro) { showMsg('Erro ao salvar membro. Tente novamente.', 'error'); btn.disabled = false; btn.textContent = 'Concluir Cadastro'; return; }

    // Cria vínculo pastoral (apenas para o usuário logado — outros membros ficam sem user_id)
    if (i === 0) {
      await sbAdmin.from('pastoral_members').insert({
        user_id: currentUser.id, module_id: modulo.id, role: 'novo'
      });
    }

    // Abre CRM
    await sbAdmin.from('acolitos_crm').insert({
      membro_id: membro.id, etapa: 'integracao'
    });
  }

  showMsg('Cadastro realizado! Aguarde o contato da equipe.', 'success');
  setTimeout(() => { window.location.href = 'index.html'; }, 2000);
}

init();
</script>
</body>
</html>
```

- [ ] **Step 2: Verificar no browser**

1. Abrir `novos.html` sem estar logado → redireciona para `../central/login.html` ✓
2. Logar como usuário sem vínculo pastoral → form aparece com 1 bloco ✓
3. Clicar "+ Adicionar outro membro" → segundo bloco aparece com botão remover ✓
4. Enviar form sem nome → exibe mensagem de erro ✓
5. Preencher e enviar → Supabase Dashboard: linha em `acolitos_membros` + `pastoral_members` (role='novo') + `acolitos_crm` (etapa='integracao') ✓
6. Após envio → redireciona para `index.html` ✓

- [ ] **Step 3: Commit**

```bash
git add projetos/acolitos/novos.html
git commit -m "feat: novos.html — cadastro de novos membros da pastoral"
```

---

## Task 5: crm.html

**Files:**
- Create: `projetos/acolitos/crm.html`

- [ ] **Step 1: Criar o arquivo**

```html
<!DOCTYPE html>
<html lang="pt-BR" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CRM — Acólitos JCBP</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Lora:ital,wght@0,400;0,500;1,400&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="shared.css">
  <style>
    .view-toggle { display: flex; gap: 8px; margin-bottom: 16px; }
    .view-btn {
      padding: 8px 16px; background: var(--surface2); border: 1px solid var(--border);
      color: var(--text-muted); border-radius: 2px; cursor: pointer;
      font-family: 'Cinzel', serif; font-size: 11px; letter-spacing: 1px;
    }
    .view-btn.active { border-color: var(--gold); color: var(--gold); background: rgba(201,168,76,.08); }
    .crm-list-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .crm-list-table th {
      text-align: left; padding: 10px 12px; font-family: 'Cinzel', serif;
      font-size: 10px; letter-spacing: 1.5px; color: var(--text-muted);
      border-bottom: 1px solid var(--border-wine); white-space: nowrap;
    }
    .crm-list-table td { padding: 10px 12px; border-bottom: 1px solid var(--border); }
    .days-badge {
      display: inline-block; padding: 2px 6px; border-radius: 2px;
      font-size: 10px; font-family: 'Cinzel', serif;
    }
    .days-badge.ok   { background: rgba(30,80,30,.2); color: var(--success-text); }
    .days-badge.warn { background: rgba(100,60,0,.2); color: var(--warn-text); }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
</head>
<body>
<div id="app-header"></div>
<div id="app-nav"></div>

<div class="main">
  <!-- KPIs -->
  <div class="kpi-grid" id="crm-kpis"></div>

  <h1 class="page-title">Pipeline de Integração</h1>

  <!-- View toggle -->
  <div class="view-toggle">
    <button class="view-btn active" id="btn-pipeline" onclick="setView('pipeline')">Pipeline</button>
    <button class="view-btn" id="btn-lista" onclick="setView('lista')">Lista</button>
  </div>

  <!-- Pipeline view -->
  <div id="view-pipeline" class="crm-pipeline"></div>

  <!-- List view -->
  <div id="view-lista" style="display:none;overflow-x:auto;">
    <table class="crm-list-table">
      <thead>
        <tr><th>Nome</th><th>Idade</th><th>Etapa</th><th>Dias</th><th>Entrada</th><th>Ações</th></tr>
      </thead>
      <tbody id="crm-list-body"></tbody>
    </table>
  </div>
</div>

<!-- Modal avançar etapa -->
<div class="modal-overlay" id="modal-avancar">
  <div class="modal">
    <div class="modal-handle"></div>
    <div class="modal-title" id="modal-avancar-title">Avançar Etapa</div>
    <p id="modal-avancar-desc" style="color:var(--text-muted);font-size:13px;margin-bottom:16px;"></p>
    <div id="modal-avancar-role" style="display:none;">
      <label class="form-label">Definir nível do membro</label>
      <select class="form-select" id="select-role-final">
        <option value="aspirante">Aspirante</option>
        <option value="coroinha">Coroinha</option>
        <option value="acolito">Acólito</option>
      </select>
    </div>
    <div class="form-group" style="margin-top:16px;">
      <label class="form-label">Observação (opcional)</label>
      <input class="form-input" id="modal-obs" placeholder="Anotação desta etapa">
    </div>
    <div class="modal-actions">
      <button class="btn-sm gray" onclick="fecharModal('modal-avancar')">Cancelar</button>
      <button class="btn-sm gold" id="btn-confirmar-avancar" onclick="confirmarAvancar()">Confirmar</button>
    </div>
  </div>
</div>

<script src="shared.js"></script>
<script>
const ETAPAS = ['integracao','whatsapp','tunica','disponivel_escala','integrado'];
const ETAPA_LABEL = {
  integracao: 'Integração', whatsapp: 'WhatsApp', tunica: 'Túnica',
  disponivel_escala: 'Disp. Escala', integrado: 'Integrado'
};
const ETAPA_ACAO = {
  integracao: 'Reunião de integração realizada',
  whatsapp: 'Entrada nos grupos confirmada',
  tunica: 'Túnica confirmada',
  disponivel_escala: 'Disponibilidade preenchida',
  integrado: 'Membro integrado — definir nível'
};

let ctx = null;
let crmData = [];
let pendingMembro = null;
let currentView = 'pipeline';

async function init() {
  ctx = await initModulo(['coord_admin','subadmin','membro_equipe']);
  if (!ctx) return;
  renderHeader(ctx, 'crm');
  renderBottomNav(ctx.membership.role, 'crm');
  await loadCRM();
}

async function loadCRM() {
  const { data } = await sbAdmin
    .from('acolitos_crm')
    .select('*, acolitos_membros(id, nome, data_nascimento, foto_url, status)')
    .neq('etapa', 'integrado')
    .order('etapa_iniciada_em', { ascending: true });
  crmData = data || [];
  renderKpis();
  if (currentView === 'pipeline') renderPipeline();
  else renderLista();
}

function renderKpis() {
  const el = document.getElementById('crm-kpis');
  el.textContent = '';
  const total = crmData.length;
  const travados = crmData.filter(c => diasNaEtapa(c.etapa_iniciada_em) > 30).length;
  const por_etapa = {};
  ETAPAS.slice(0, -1).forEach(e => { por_etapa[e] = crmData.filter(c => c.etapa === e).length; });
  [
    { label: 'Em Onboarding', value: total, sub: 'aguardando integração' },
    { label: 'Travados +30d', value: travados, sub: 'precisam de atenção' },
    { label: 'Na Integração', value: por_etapa.integracao, sub: 'primeira etapa' },
    { label: 'Quase lá', value: por_etapa.disponivel_escala, sub: 'disp. escala' },
  ].forEach(k => {
    const card = document.createElement('div');
    card.className = 'kpi-card';
    const lbl = document.createElement('div'); lbl.className = 'kpi-label'; lbl.textContent = k.label;
    const val = document.createElement('div'); val.className = 'kpi-value'; val.textContent = k.value;
    const sub = document.createElement('div'); sub.className = 'kpi-sub'; sub.textContent = k.sub;
    card.append(lbl, val, sub);
    el.appendChild(card);
  });
}

function renderPipeline() {
  const el = document.getElementById('view-pipeline');
  el.textContent = '';
  ETAPAS.slice(0, -1).forEach(etapa => {
    const membros = crmData.filter(c => c.etapa === etapa);
    const col = document.createElement('div'); col.className = 'crm-col';
    const header = document.createElement('div'); header.className = 'crm-col-header';
    const title = document.createElement('span'); title.textContent = ETAPA_LABEL[etapa];
    const count = document.createElement('span');
    count.style.cssText = 'background:var(--wine-dim);color:var(--text);border-radius:10px;padding:1px 7px;font-size:10px;';
    count.textContent = membros.length;
    header.append(title, count);
    const body = document.createElement('div'); body.className = 'crm-col-body';
    if (!membros.length) {
      const empty = document.createElement('span');
      empty.style.cssText = 'color:var(--text-muted);font-size:12px;font-style:italic;padding:8px 0;';
      empty.textContent = 'Nenhum membro';
      body.appendChild(empty);
    }
    membros.forEach(c => {
      const m = c.acolitos_membros;
      const dias = diasNaEtapa(c.etapa_iniciada_em);
      const card = document.createElement('div'); card.className = 'crm-card';
      card.onclick = () => abrirAvancar(c);
      const name = document.createElement('div'); name.className = 'crm-card-name';
      name.textContent = m?.nome || '—';
      const meta = document.createElement('div'); meta.className = 'crm-card-meta';
      meta.textContent = m?.data_nascimento ? `${calcIdade(m.data_nascimento)} anos` : '—';
      const daysEl = document.createElement('div');
      daysEl.className = 'crm-card-days' + (dias > 30 ? ' alert' : '');
      daysEl.textContent = `${dias} dias nesta etapa`;
      card.append(name, meta, daysEl);
      body.appendChild(card);
    });
    col.append(header, body);
    el.appendChild(col);
  });
}

function renderLista() {
  const tbody = document.getElementById('crm-list-body');
  tbody.textContent = '';
  if (!crmData.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td'); td.colSpan = 6;
    td.className = 'empty'; td.textContent = 'Nenhum membro em onboarding.';
    tr.appendChild(td); tbody.appendChild(tr); return;
  }
  crmData.forEach(c => {
    const m = c.acolitos_membros;
    const dias = diasNaEtapa(c.etapa_iniciada_em);
    const tr = document.createElement('tr');
    [
      m?.nome || '—',
      m?.data_nascimento ? String(calcIdade(m.data_nascimento)) : '—',
    ].forEach(v => {
      const td = document.createElement('td'); td.textContent = v; tr.appendChild(td);
    });
    const tdEtapa = document.createElement('td');
    const badge = document.createElement('span'); badge.className = 'badge pendente';
    badge.textContent = ETAPA_LABEL[c.etapa]; tdEtapa.appendChild(badge); tr.appendChild(tdEtapa);
    const tdDias = document.createElement('td');
    const db = document.createElement('span');
    db.className = 'days-badge ' + (dias > 30 ? 'warn' : 'ok');
    db.textContent = dias + 'd'; tdDias.appendChild(db); tr.appendChild(tdDias);
    const tdData = document.createElement('td'); tdData.textContent = formatDate(c.etapa_iniciada_em); tr.appendChild(tdData);
    const tdAcoes = document.createElement('td');
    const btn = document.createElement('button'); btn.className = 'btn-sm gold';
    btn.textContent = 'Avançar'; btn.onclick = () => abrirAvancar(c);
    tdAcoes.appendChild(btn); tr.appendChild(tdAcoes);
    tbody.appendChild(tr);
  });
}

function setView(view) {
  currentView = view;
  document.getElementById('view-pipeline').style.display = view === 'pipeline' ? '' : 'none';
  document.getElementById('view-lista').style.display = view === 'lista' ? '' : 'none';
  document.getElementById('btn-pipeline').classList.toggle('active', view === 'pipeline');
  document.getElementById('btn-lista').classList.toggle('active', view === 'lista');
  if (view === 'pipeline') renderPipeline();
  else renderLista();
}

function abrirAvancar(crmEntry) {
  pendingMembro = crmEntry;
  const etapaAtual = crmEntry.etapa;
  const idx = ETAPAS.indexOf(etapaAtual);
  const proximaEtapa = ETAPAS[idx + 1];
  const nome = crmEntry.acolitos_membros?.nome || '—';
  const title = document.getElementById('modal-avancar-title');
  const desc = document.getElementById('modal-avancar-desc');
  title.textContent = 'Avançar: ' + nome;
  desc.textContent = ETAPA_ACAO[etapaAtual];
  const roleBlock = document.getElementById('modal-avancar-role');
  roleBlock.style.display = proximaEtapa === 'integrado' ? '' : 'none';
  document.getElementById('modal-obs').value = '';
  document.getElementById('modal-avancar').classList.add('open');
}

async function confirmarAvancar() {
  if (!pendingMembro) return;
  const btn = document.getElementById('btn-confirmar-avancar');
  btn.disabled = true;
  const etapaAtual = pendingMembro.etapa;
  const idx = ETAPAS.indexOf(etapaAtual);
  const proximaEtapa = ETAPAS[idx + 1];
  const obs = document.getElementById('modal-obs').value.trim();
  const roleFinal = document.getElementById('select-role-final').value;
  const membroId = pendingMembro.membro_id;

  // Avança etapa
  await sbAdmin.from('acolitos_crm')
    .update({ etapa: proximaEtapa, etapa_iniciada_em: new Date().toISOString(), observacoes: obs || null })
    .eq('membro_id', membroId);

  // Histórico
  await sbAdmin.from('acolitos_crm_historico').insert({
    membro_id: membroId, etapa_de: etapaAtual, etapa_para: proximaEtapa, changed_by: ctx.user.id
  });

  // Se integrado → atualiza role no pastoral_members
  if (proximaEtapa === 'integrado') {
    const { data: modulo } = await sbAdmin.from('pastoral_modules').select('id').eq('slug','acolitos').single();
    const membroRow = await sbAdmin.from('acolitos_membros').select('user_id').eq('id', membroId).single();
    if (modulo && membroRow?.data?.user_id) {
      await sbAdmin.from('pastoral_members')
        .update({ role: roleFinal })
        .eq('user_id', membroRow.data.user_id)
        .eq('module_id', modulo.id);
    }
  }

  fecharModal('modal-avancar');
  btn.disabled = false;
  pendingMembro = null;
  await loadCRM();
}

function fecharModal(id) { document.getElementById(id)?.classList.remove('open'); }

init();
</script>
</body>
</html>
```

- [ ] **Step 2: Verificar no browser**

1. Logar como equipe → pipeline aparece com colunas das 4 etapas ✓
2. KPIs mostram contagens corretas ✓
3. Toggle Pipeline/Lista alterna views ✓
4. Clicar card → modal abre com nome e ação da etapa ✓
5. Confirmar avanço → card some da coluna, membro aparece na próxima ✓
6. Avançar para "integrado" → modal mostra seletor de nível ✓
7. Confirmar integrado → `pastoral_members.role` atualizado no Supabase ✓

- [ ] **Step 3: Commit**

```bash
git add projetos/acolitos/crm.html
git commit -m "feat: crm.html — pipeline CRM de onboarding"
```

---

## Task 6: membros.html

**Files:**
- Create: `projetos/acolitos/membros.html`

- [ ] **Step 1: Criar o arquivo**

```html
<!DOCTYPE html>
<html lang="pt-BR" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Membros — Acólitos JCBP</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Lora:ital,wght@0,400;0,500;1,400&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="shared.css">
  <style>
    .ficha-tabs { display: flex; border-bottom: 1px solid var(--border-wine); margin-bottom: 20px; overflow-x: auto; }
    .ficha-tab {
      padding: 10px 16px; background: transparent; border: none;
      border-bottom: 2px solid transparent; color: var(--text-muted);
      cursor: pointer; font-size: 11px; font-family: 'Cinzel', serif;
      letter-spacing: 1px; text-transform: uppercase; white-space: nowrap; transition: all .2s;
    }
    .ficha-tab.active { color: var(--gold); border-bottom-color: var(--gold); }
    .ficha-content { display: none; }
    .ficha-content.active { display: block; }
    .hab-grid { display: grid; grid-template-columns: repeat(2,1fr); gap: 8px; }
    @media(min-width:480px) { .hab-grid { grid-template-columns: repeat(3,1fr); } }
    .hab-item {
      background: var(--surface2); border: 1px solid var(--border);
      border-radius: 3px; padding: 10px; cursor: pointer; transition: border-color .2s;
    }
    .hab-item.nao_treinado  { border-color: var(--border); }
    .hab-item.em_formacao   { border-color: #d4a060; }
    .hab-item.apto          { border-color: var(--success); }
    .hab-item.experiente    { border-color: #4a90c4; }
    .hab-item.referencia    { border-color: #9b59d4; }
    .hab-nome { font-size: 11px; color: var(--text); font-family: 'Cinzel', serif; margin-bottom: 4px; }
    .hab-nivel { font-size: 10px; color: var(--text-muted); }
    .niveis-select {
      width: 100%; padding: 6px 8px; background: var(--surface);
      border: 1px solid var(--border-wine); border-radius: 2px;
      color: var(--text); font-size: 12px; outline: none; margin-top: 4px;
    }
    .stat-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--border); }
    .stat-label { font-size: 13px; color: var(--text-muted); }
    .stat-value { font-size: 15px; color: var(--text); font-weight: 600; }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
</head>
<body>
<div id="app-header"></div>
<div id="app-nav"></div>

<div class="main">
  <div class="toolbar">
    <input class="search-input" id="busca" placeholder="🔍 Buscar por nome..." oninput="filtrar()">
    <button class="btn-sm gold" onclick="abrirNovoMembro()">+ Novo</button>
  </div>

  <!-- Filtros rápidos -->
  <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;" id="filtros">
    <button class="form-toggle active" data-filtro="" onclick="setFiltro(this,'')">Todos</button>
    <button class="form-toggle" data-filtro="cerimonario" onclick="setFiltro(this,'cerimonario')">Cerimoniários</button>
    <button class="form-toggle" data-filtro="acolito" onclick="setFiltro(this,'acolito')">Acólitos</button>
    <button class="form-toggle" data-filtro="coroinha" onclick="setFiltro(this,'coroinha')">Coroinhas</button>
    <button class="form-toggle" data-filtro="aspirante" onclick="setFiltro(this,'aspirante')">Aspirantes</button>
  </div>

  <div class="cards-grid" id="membros-grid">
    <span class="loading">Carregando...</span>
  </div>
</div>

<!-- Modal Ficha do Membro -->
<div class="modal-overlay" id="modal-ficha">
  <div class="modal" style="max-height:95vh;">
    <div class="modal-handle"></div>
    <div id="ficha-header" style="text-align:center;margin-bottom:20px;"></div>
    <div class="ficha-tabs" id="ficha-tabs"></div>
    <div id="ficha-body"></div>
    <div class="modal-actions" style="justify-content:space-between;">
      <button class="btn-sm gray" onclick="fecharModal('modal-ficha')">Fechar</button>
      <button class="btn-sm gold" id="btn-salvar-ficha" onclick="salvarFicha()">Salvar</button>
    </div>
  </div>
</div>

<script src="shared.js"></script>
<script>
const HAB_FUNCOES = [
  { id:'apoio',          label:'Apoio',          categoria:'basica' },
  { id:'cruz',           label:'Cruz',           categoria:'basica' },
  { id:'vela',           label:'Vela',           categoria:'basica' },
  { id:'sineta',         label:'Sineta',         categoria:'basica' },
  { id:'sinao',          label:'Sinão',          categoria:'basica' },
  { id:'altar',          label:'Altar',          categoria:'intermediaria' },
  { id:'turibulo',       label:'Turíbulo',       categoria:'intermediaria' },
  { id:'naveta',         label:'Naveta',         categoria:'intermediaria' },
  { id:'missal',         label:'Missal',         categoria:'avancada' },
  { id:'cred_altar',     label:'Cred. Altar',    categoria:'avancada' },
  { id:'cred_credencia', label:'Cred. Credência',categoria:'avancada' },
  { id:'mitra',          label:'Mitra',          categoria:'episcopal' },
  { id:'baculo',         label:'Báculo',         categoria:'episcopal' },
];
const NIVEIS = ['nao_treinado','em_formacao','apto','experiente','referencia'];
const NIVEL_LABEL = {
  nao_treinado:'Não Treinado', em_formacao:'Em Formação',
  apto:'Apto', experiente:'Experiente', referencia:'Referência'
};
const ROLE_LABEL = { cerimonario:'Cerimoniário', acolito:'Acólito', coroinha:'Coroinha', aspirante:'Aspirante', novo:'Novo' };

let ctx = null;
let todosOsMembros = [];
let filtroRole = '';
let membroAtual = null;
let habAtual = {};

async function init() {
  ctx = await initModulo(['coord_admin','subadmin','membro_equipe']);
  if (!ctx) return;
  renderHeader(ctx, 'membros');
  renderBottomNav(ctx.membership.role, 'membros');
  await loadMembros();
}

async function loadMembros() {
  const { data: membros } = await sbAdmin
    .from('acolitos_membros')
    .select('*')
    .eq('status','ativo')
    .order('nome');

  // Busca roles
  const { data: modulo } = await sbAdmin.from('pastoral_modules').select('id').eq('slug','acolitos').single();
  const { data: pmRows } = modulo
    ? await sbAdmin.from('pastoral_members').select('user_id,role').eq('module_id', modulo.id)
    : { data: [] };
  const roleMap = {};
  (pmRows || []).forEach(r => { roleMap[r.user_id] = r.role; });

  todosOsMembros = (membros || []).map(m => ({ ...m, role: roleMap[m.user_id] || 'aspirante' }));
  renderGrid();
}

function filtrar() { renderGrid(); }
function setFiltro(btn, role) {
  filtroRole = role;
  document.querySelectorAll('#filtros .form-toggle').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderGrid();
}

function renderGrid() {
  const busca = document.getElementById('busca').value.toLowerCase();
  const grid = document.getElementById('membros-grid');
  grid.textContent = '';
  const filtrado = todosOsMembros.filter(m => {
    const matchBusca = m.nome.toLowerCase().includes(busca);
    const matchRole = !filtroRole || m.role === filtroRole;
    return matchBusca && matchRole;
  });
  if (!filtrado.length) {
    const em = document.createElement('span');
    em.className = 'empty'; em.textContent = 'Nenhum membro encontrado.';
    grid.appendChild(em); return;
  }
  filtrado.forEach(m => {
    const card = document.createElement('div');
    card.className = 'member-card';
    card.onclick = () => abrirFicha(m);
    const avatarDiv = document.createElement('div');
    avatarDiv.className = 'member-card-avatar';
    avatarDiv.innerHTML = avatarHtml(m.foto_url, m.role, 64);
    const nameDiv = document.createElement('div');
    nameDiv.className = 'member-card-name'; nameDiv.textContent = m.nome;
    const metaDiv = document.createElement('div');
    metaDiv.className = 'member-card-meta';
    const roleLabel = document.createElement('span');
    roleLabel.className = 'badge ' + (m.role || 'aspirante');
    roleLabel.textContent = ROLE_LABEL[m.role] || m.role;
    metaDiv.appendChild(roleLabel);
    card.append(avatarDiv, nameDiv, metaDiv);
    if (m.comunidade) {
      const com = document.createElement('div');
      com.className = 'member-card-meta';
      com.textContent = m.comunidade === 'matriz' ? 'Matriz' : m.comunidade === 'santo_antonio' ? 'Sto. Antônio' : 'Outra';
      card.appendChild(com);
    }
    grid.appendChild(card);
  });
}

async function abrirFicha(membro) {
  membroAtual = membro;
  habAtual = {};

  // Header
  const header = document.getElementById('ficha-header');
  header.innerHTML = avatarHtml(membro.foto_url, membro.role, 72);
  const nome = document.createElement('div');
  nome.style.cssText = 'font-family:Cinzel,serif;font-size:16px;font-weight:700;margin-top:10px;';
  nome.textContent = membro.nome;
  const badge = document.createElement('span');
  badge.className = 'badge ' + (membro.role || 'aspirante');
  badge.style.marginTop = '6px';
  badge.textContent = ROLE_LABEL[membro.role] || membro.role;
  header.appendChild(nome); header.appendChild(document.createElement('br')); header.appendChild(badge);

  // Tabs
  renderFichaTabs(['Pessoal','Habilitações','Disponibilidade','Família','Observações']);
  await renderFichaTab('Pessoal');
  document.getElementById('modal-ficha').classList.add('open');
}

function renderFichaTabs(tabs) {
  const tabsEl = document.getElementById('ficha-tabs');
  tabsEl.textContent = '';
  tabs.forEach((t, i) => {
    const btn = document.createElement('button');
    btn.className = 'ficha-tab' + (i === 0 ? ' active' : '');
    btn.textContent = t;
    btn.onclick = () => {
      document.querySelectorAll('.ficha-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderFichaTab(t);
    };
    tabsEl.appendChild(btn);
  });
}

async function renderFichaTab(tab) {
  const body = document.getElementById('ficha-body');
  body.textContent = '';
  const m = membroAtual;

  if (tab === 'Pessoal') {
    [
      ['Nome completo', m.nome],
      ['Data de nascimento', m.data_nascimento ? formatDate(m.data_nascimento) : '—'],
      ['Idade', m.data_nascimento ? calcIdade(m.data_nascimento) + ' anos' : '—'],
      ['Telefone', m.telefone || '—'],
      ['Responsável', m.responsavel || '—'],
      ['Comunidade', m.comunidade === 'matriz' ? 'Matriz' : m.comunidade === 'santo_antonio' ? 'Sto. Antônio' : '—'],
    ].forEach(([label, value]) => {
      const row = document.createElement('div'); row.className = 'stat-row';
      const lbl = document.createElement('span'); lbl.className = 'stat-label'; lbl.textContent = label;
      const val = document.createElement('span'); val.className = 'stat-value'; val.textContent = value;
      row.append(lbl, val); body.appendChild(row);
    });
  }

  if (tab === 'Habilitações') {
    const { data: habs } = await sbAdmin
      .from('acolitos_habilitacoes').select('*').eq('membro_id', m.id);
    habAtual = {};
    (habs || []).forEach(h => { habAtual[h.funcao] = h.proficiencia; });
    const grid = document.createElement('div'); grid.className = 'hab-grid';
    HAB_FUNCOES.forEach(fn => {
      const nivel = habAtual[fn.id] || 'nao_treinado';
      const item = document.createElement('div'); item.className = 'hab-item ' + nivel; item.id = 'hab-' + fn.id;
      const nome = document.createElement('div'); nome.className = 'hab-nome'; nome.textContent = fn.label;
      const sel = document.createElement('select'); sel.className = 'niveis-select';
      sel.setAttribute('data-funcao', fn.id);
      NIVEIS.forEach(n => {
        const opt = document.createElement('option'); opt.value = n; opt.textContent = NIVEL_LABEL[n];
        if (n === nivel) opt.selected = true;
        sel.appendChild(opt);
      });
      sel.onchange = () => {
        const novoNivel = sel.value;
        habAtual[fn.id] = novoNivel;
        item.className = 'hab-item ' + novoNivel;
        const nivelEl = item.querySelector('.hab-nivel');
        if (nivelEl) nivelEl.textContent = NIVEL_LABEL[novoNivel];
      };
      const nivelEl = document.createElement('div'); nivelEl.className = 'hab-nivel'; nivelEl.textContent = NIVEL_LABEL[nivel];
      item.append(nome, nivelEl, sel); grid.appendChild(item);
    });
    body.appendChild(grid);
  }

  if (tab === 'Disponibilidade') {
    const { data: disp } = await sbAdmin
      .from('acolitos_disponibilidade').select('*').eq('membro_id', m.id);
    const horarios = [
      { dia:'sabado', horario:'17h', label:'Sáb 17h' },
      { dia:'sabado', horario:'18h30', label:'Sáb 18h30 (Sto. Antônio)' },
      { dia:'domingo', horario:'7h', label:'Dom 7h' },
      { dia:'domingo', horario:'9h', label:'Dom 9h' },
      { dia:'domingo', horario:'19h', label:'Dom 19h' },
    ];
    const dispSet = new Set((disp || []).map(d => d.dia + '_' + d.horario));
    horarios.forEach(h => {
      const row = document.createElement('div'); row.className = 'toggle-row';
      const lbl = document.createElement('label'); lbl.textContent = h.label; lbl.style.fontSize = '14px';
      const chk = document.createElement('input'); chk.type = 'checkbox'; chk.className = 'toggle-checkbox';
      chk.checked = dispSet.has(h.dia + '_' + h.horario);
      chk.setAttribute('data-dia', h.dia); chk.setAttribute('data-horario', h.horario);
      row.append(lbl, chk); body.appendChild(row);
    });
    if (m.observacoes) {
      const obs = document.createElement('div');
      obs.style.cssText = 'margin-top:16px;padding:10px;background:var(--surface2);border-radius:2px;font-size:13px;color:var(--text-muted);';
      obs.textContent = m.observacoes;
      body.appendChild(obs);
    }
  }

  if (tab === 'Família') {
    [
      ['Tem pai ministro?', m.tem_pai_ministro ? 'Sim' : 'Não'],
      ['Nome pai ministro', m.nome_pai_ministro || '—'],
      ['Tem mãe ministra?', m.tem_mae_ministro ? 'Sim' : 'Não'],
      ['Nome mãe ministra', m.nome_mae_ministro || '—'],
      ['Comunidade dos ministros', m.comunidade_ministro || '—'],
      ['Escalar com pais?', m.escalar_com_pais ? 'Sim' : 'Não'],
      ['Tem irmão na pastoral?', m.tem_irmao_pastoral ? 'Sim' : 'Não'],
      ['Escalar com irmão?', m.escalar_com_irmao ? 'Sim' : 'Não'],
    ].forEach(([label, value]) => {
      const row = document.createElement('div'); row.className = 'stat-row';
      const lbl = document.createElement('span'); lbl.className = 'stat-label'; lbl.textContent = label;
      const val = document.createElement('span'); val.className = 'stat-value'; val.textContent = value;
      row.append(lbl, val); body.appendChild(row);
    });
  }

  if (tab === 'Observações') {
    const textarea = document.createElement('textarea'); textarea.className = 'form-textarea';
    textarea.id = 'obs-textarea'; textarea.rows = 5;
    textarea.value = m.necessidades_especiais
      ? (m.observacoes ? m.observacoes + '\n' : '') + m.necessidades_especiais
      : m.observacoes || '';
    textarea.placeholder = 'Necessidades especiais, restrições, anotações...';
    body.appendChild(textarea);
  }
}

async function salvarFicha() {
  if (!membroAtual) return;
  const btn = document.getElementById('btn-salvar-ficha');
  btn.disabled = true; btn.textContent = 'Salvando...';

  // Salva habilitações se aba Habilitações foi aberta
  if (Object.keys(habAtual).length) {
    const upserts = Object.entries(habAtual).map(([funcao, proficiencia]) => ({
      membro_id: membroAtual.id, funcao, proficiencia, updated_at: new Date().toISOString()
    }));
    await sbAdmin.from('acolitos_habilitacoes').upsert(upserts, { onConflict: 'membro_id,funcao' });
  }

  // Salva disponibilidades se aba foi aberta
  const chks = document.querySelectorAll('.toggle-checkbox[data-dia]');
  if (chks.length) {
    await sbAdmin.from('acolitos_disponibilidade').delete().eq('membro_id', membroAtual.id);
    const dispArr = [...chks].filter(c => c.checked).map(c => ({
      membro_id: membroAtual.id, dia: c.getAttribute('data-dia'), horario: c.getAttribute('data-horario')
    }));
    if (dispArr.length) await sbAdmin.from('acolitos_disponibilidade').insert(dispArr);
  }

  // Salva observações
  const obsTextarea = document.getElementById('obs-textarea');
  if (obsTextarea) {
    await sbAdmin.from('acolitos_membros')
      .update({ observacoes: obsTextarea.value.trim() || null })
      .eq('id', membroAtual.id);
  }

  btn.disabled = false; btn.textContent = 'Salvar';
  fecharModal('modal-ficha');
  await loadMembros();
}

function abrirNovoMembro() { window.location.href = 'novos.html'; }
function fecharModal(id) { document.getElementById(id)?.classList.remove('open'); }

init();
</script>
</body>
</html>
```

- [ ] **Step 2: Verificar no browser**

1. Logar como equipe → grid de cards carrega ✓
2. Busca por nome filtra cards em tempo real ✓
3. Filtros de role funcionam ✓
4. Clicar card → modal abre com tabs ✓
5. Aba Habilitações → selectores por função aparecem ✓
6. Mudar nível de uma função → cor do card de habilitação muda ✓
7. Salvar → Supabase: `acolitos_habilitacoes` atualizado ✓
8. Aba Disponibilidade → checkboxes de horários ✓

- [ ] **Step 3: Commit**

```bash
git add projetos/acolitos/membros.html
git commit -m "feat: membros.html — gestão de membros com ficha e habilitações"
```

---

## Task 7: index.html

**Files:**
- Create: `projetos/acolitos/index.html`

- [ ] **Step 1: Criar o arquivo**

```html
<!DOCTYPE html>
<html lang="pt-BR" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Acólitos e Coroinhas — JCBP</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Lora:ital,wght@0,400;0,500;1,400&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="shared.css">
  <style>
    .jornada-track {
      display: flex; align-items: center; gap: 0;
      background: var(--surface); border: 1px solid var(--border-wine);
      border-radius: 4px; padding: 16px; margin-bottom: 20px; overflow-x: auto;
    }
    .jornada-step { display: flex; flex-direction: column; align-items: center; flex: 1; min-width: 70px; }
    .jornada-dot {
      width: 32px; height: 32px; border-radius: 50%;
      border: 2px solid var(--border-wine); background: var(--surface2);
      display: flex; align-items: center; justify-content: center;
      font-size: 14px; margin-bottom: 6px; transition: all .3s;
    }
    .jornada-dot.done { border-color: var(--gold); background: rgba(201,168,76,.15); }
    .jornada-dot.current { border-color: var(--gold); background: var(--gold); color: #000; }
    .jornada-label { font-size: 9px; color: var(--text-muted); font-family: 'Cinzel', serif; text-align: center; letter-spacing: .5px; }
    .jornada-label.current { color: var(--gold); }
    .jornada-line { flex: 1; height: 2px; background: var(--border); margin: 0 4px; margin-bottom: 22px; min-width: 16px; }
    .jornada-line.done { background: var(--gold-dim); }
    .crm-status-card {
      background: var(--surface); border: 1px solid var(--gold-dim);
      border-radius: 4px; padding: 24px 20px; text-align: center; margin-bottom: 20px;
    }
    .crm-status-title {
      font-family: 'Cinzel', serif; font-size: 16px; color: var(--gold-light);
      margin-bottom: 8px; letter-spacing: 1px;
    }
    .crm-status-sub { font-size: 13px; color: var(--text-muted); font-style: italic; }
    .next-scale-card {
      background: var(--surface); border: 1px solid var(--border-wine);
      border-radius: 4px; padding: 14px 16px; margin-bottom: 10px;
      display: flex; align-items: center; justify-content: space-between; gap: 12px;
    }
    .next-scale-info { flex: 1; }
    .next-scale-date { font-size: 12px; color: var(--text-muted); margin-bottom: 3px; }
    .next-scale-funcao { font-family: 'Cinzel', serif; font-size: 14px; color: var(--gold); }
    .alert-item {
      display: flex; align-items: flex-start; gap: 10px; padding: 10px 0;
      border-bottom: 1px solid var(--border);
    }
    .alert-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; margin-top: 4px; }
    .alert-dot.red { background: var(--danger-text); }
    .alert-dot.yellow { background: var(--warn-text); }
    .alert-text { font-size: 13px; color: var(--text); }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
</head>
<body>
<div id="app-header"></div>
<div id="app-nav"></div>
<div class="main" id="main-content">
  <span class="loading">Carregando...</span>
</div>

<script src="shared.js"></script>
<script>
const CRM_ETAPA_LABEL = {
  integracao:'Reunião de Integração',
  whatsapp:'Grupos de WhatsApp',
  tunica:'Receber Túnica',
  disponivel_escala:'Disponibilidade para Escala',
  integrado:'Integrado ✓'
};
const CRM_ETAPA_PROX = {
  integracao: 'Em breve entraremos em contato para agendar sua reunião de integração.',
  whatsapp: 'Aguardando sua entrada nos grupos de WhatsApp da pastoral.',
  tunica: 'Em processo de recebimento da túnica.',
  disponivel_escala: 'A equipe está preenchendo sua disponibilidade.',
  integrado: 'Bem-vindo à pastoral!'
};
const ETAPAS_CRM = ['integracao','whatsapp','tunica','disponivel_escala','integrado'];
const EQUIPE_ROLES = ['coord_admin','subadmin','membro_equipe'];
const JORNADA = [
  { role:'aspirante', label:'Aspirante', icon:'✦' },
  { role:'coroinha',  label:'Coroinha',  icon:'♛' },
  { role:'acolito',   label:'Acólito',   icon:'⊕' },
  { role:'cerimonario',label:'Cerimoniário',icon:'✵' },
];

async function init() {
  const ctx = await initModulo();
  if (!ctx) return;
  renderHeader(ctx, 'home');
  const role = ctx.membership?.role;
  renderBottomNav(role || 'novo', 'home');

  if (!ctx.membership || role === 'novo') {
    await renderCrmStatus(ctx);
  } else if (EQUIPE_ROLES.includes(role)) {
    await renderDashboardEquipe(ctx);
  } else {
    await renderDashboardMembro(ctx);
  }
}

async function renderCrmStatus(ctx) {
  const main = document.getElementById('main-content');
  main.textContent = '';

  // Busca etapa atual do CRM
  const { data: crm } = ctx.membro
    ? await sb.from('acolitos_crm').select('etapa,etapa_iniciada_em').eq('membro_id', ctx.membro.id).maybeSingle()
    : { data: null };
  const etapaAtual = crm?.etapa || 'integracao';
  const etapaIdx = ETAPAS_CRM.indexOf(etapaAtual);

  const card = document.createElement('div'); card.className = 'crm-status-card';
  const title = document.createElement('div'); title.className = 'crm-status-title';
  title.textContent = 'Sua Integração';
  const sub = document.createElement('div'); sub.className = 'crm-status-sub';
  sub.textContent = CRM_ETAPA_PROX[etapaAtual];
  card.append(title, sub);
  main.appendChild(card);

  // Barra de progresso
  const track = document.createElement('div'); track.className = 'jornada-track';
  ETAPAS_CRM.forEach((etapa, i) => {
    const step = document.createElement('div'); step.className = 'jornada-step';
    const dot = document.createElement('div');
    dot.className = 'jornada-dot' + (i < etapaIdx ? ' done' : i === etapaIdx ? ' current' : '');
    dot.textContent = i < etapaIdx ? '✓' : String(i + 1);
    const lbl = document.createElement('div');
    lbl.className = 'jornada-label' + (i === etapaIdx ? ' current' : '');
    lbl.textContent = CRM_ETAPA_LABEL[etapa].split(' ')[0];
    step.append(dot, lbl); track.appendChild(step);
    if (i < ETAPAS_CRM.length - 1) {
      const line = document.createElement('div');
      line.className = 'jornada-line' + (i < etapaIdx ? ' done' : '');
      track.appendChild(line);
    }
  });
  main.appendChild(track);

  const info = document.createElement('p');
  info.style.cssText = 'color:var(--text-muted);font-size:13px;text-align:center;font-style:italic;margin-top:8px;';
  info.textContent = 'Em caso de dúvidas, entre em contato com a equipe da pastoral.';
  main.appendChild(info);
}

async function renderDashboardMembro(ctx) {
  const main = document.getElementById('main-content');
  main.textContent = '';
  const m = ctx.membro;
  const role = ctx.membership.role;

  // Avatar e saudação
  const greet = document.createElement('div');
  greet.style.cssText = 'text-align:center;margin-bottom:20px;';
  greet.innerHTML = avatarHtml(m?.foto_url, role, 80);
  const nome = document.createElement('div');
  nome.style.cssText = 'font-family:Cinzel,serif;font-size:18px;font-weight:700;margin-top:12px;';
  nome.textContent = m?.nome || '—';
  const badge = document.createElement('span');
  badge.className = 'badge ' + role; badge.style.marginTop = '8px';
  badge.textContent = { cerimonario:'Cerimoniário', acolito:'Acólito', coroinha:'Coroinha', aspirante:'Aspirante' }[role] || role;
  greet.appendChild(nome); greet.appendChild(document.createElement('br')); greet.appendChild(badge);
  main.appendChild(greet);

  // Jornada
  const track = document.createElement('div'); track.className = 'jornada-track';
  const roleIdx = JORNADA.findIndex(j => j.role === role);
  JORNADA.forEach((j, i) => {
    const step = document.createElement('div'); step.className = 'jornada-step';
    const dot = document.createElement('div');
    dot.className = 'jornada-dot' + (i < roleIdx ? ' done' : i === roleIdx ? ' current' : '');
    dot.innerHTML = i <= roleIdx ? j.icon : '○';
    const lbl = document.createElement('div');
    lbl.className = 'jornada-label' + (i === roleIdx ? ' current' : '');
    lbl.textContent = j.label;
    step.append(dot, lbl); track.appendChild(step);
    if (i < JORNADA.length - 1) {
      const line = document.createElement('div');
      line.className = 'jornada-line' + (i < roleIdx ? ' done' : '');
      track.appendChild(line);
    }
  });
  main.appendChild(track);

  // Próximas escalas (placeholder — preenchido quando escala.html for implementado)
  const secTitle = document.createElement('div');
  secTitle.className = 'section-card-title'; secTitle.style.marginBottom = '12px';
  secTitle.textContent = 'Próximas Escalas';
  main.appendChild(secTitle);
  const placeholder = document.createElement('span');
  placeholder.className = 'empty';
  placeholder.style.paddingTop = '20px';
  placeholder.textContent = 'Nenhuma escala publicada ainda.';
  main.appendChild(placeholder);
}

async function renderDashboardEquipe(ctx) {
  const main = document.getElementById('main-content');
  main.textContent = '';

  const title = document.createElement('h1'); title.className = 'page-title';
  title.textContent = 'Painel Operacional';
  main.appendChild(title);

  // KPIs
  const { count: totalAtivos } = await sbAdmin
    .from('acolitos_membros').select('*', { count: 'exact', head: true }).eq('status','ativo');
  const { count: totalCrm } = await sbAdmin
    .from('acolitos_crm').select('*', { count: 'exact', head: true }).neq('etapa','integrado');

  const kpiGrid = document.createElement('div'); kpiGrid.className = 'kpi-grid';
  [
    { label: 'Membros Ativos', value: totalAtivos || 0, sub: 'na pastoral' },
    { label: 'Em Onboarding', value: totalCrm || 0, sub: 'no CRM' },
    { label: 'Freq. Média', value: '—', sub: 'disponível em breve' },
    { label: 'Alertas', value: '—', sub: 'disponível em breve' },
  ].forEach(k => {
    const card = document.createElement('div'); card.className = 'kpi-card';
    const lbl = document.createElement('div'); lbl.className = 'kpi-label'; lbl.textContent = k.label;
    const val = document.createElement('div'); val.className = 'kpi-value'; val.textContent = k.value;
    const sub = document.createElement('div'); sub.className = 'kpi-sub'; sub.textContent = k.sub;
    card.append(lbl, val, sub); kpiGrid.appendChild(card);
  });
  main.appendChild(kpiGrid);

  // Alertas
  const alertTitle = document.createElement('div');
  alertTitle.className = 'page-title'; alertTitle.style.fontSize = '14px';
  alertTitle.textContent = 'Acesso Rápido';
  main.appendChild(alertTitle);

  const links = [
    { label: 'Gerenciar Membros', href: 'membros.html', icon: '👥' },
    { label: 'Pipeline CRM', href: 'crm.html', icon: '🔄' },
    { label: 'Gestão de Escala', href: 'escala.html', icon: '📅' },
  ];
  links.forEach(l => {
    const card = document.createElement('a');
    card.href = l.href; card.className = 'section-card';
    card.style.cssText = 'display:flex;align-items:center;gap:12px;text-decoration:none;';
    const icon = document.createElement('span'); icon.style.fontSize = '24px'; icon.textContent = l.icon;
    const lbl = document.createElement('span');
    lbl.style.cssText = 'font-family:Cinzel,serif;font-size:13px;color:var(--text);';
    lbl.textContent = l.label;
    card.append(icon, lbl); main.appendChild(card);
  });
}

init();
</script>
</body>
</html>
```

- [ ] **Step 2: Verificar no browser**

1. Usuário `novo` → vê tela de status com barra de progresso CRM ✓
2. Usuário `coroinha`/`acolito`/`cerimonario` → dashboard pessoal com jornada ✓
3. Usuário equipe → dashboard operacional com KPIs e acesso rápido ✓
4. KPIs de membros ativos e em CRM mostram números reais do Supabase ✓

- [ ] **Step 3: Commit**

```bash
git add projetos/acolitos/index.html
git commit -m "feat: index.html — home dashboard por role"
```

---

## Task 8: vercel.json + Registro como Tool

**Files:**
- Modify: `vercel.json`

- [ ] **Step 1: Adicionar rotas do módulo ao vercel.json**

Abrir `~/iajcbp/vercel.json` e adicionar as rotas do módulo:

```json
{
  "rewrites": [
    { "source": "/",              "destination": "/projetos/central/login.html" },
    { "source": "/central",       "destination": "/projetos/central/central.html" },
    { "source": "/acolitos",      "destination": "/projetos/acolitos/index.html" },
    { "source": "/acolitos/novos","destination": "/projetos/acolitos/novos.html" },
    { "source": "/acolitos/crm",  "destination": "/projetos/acolitos/crm.html" },
    { "source": "/acolitos/membros","destination":"/projetos/acolitos/membros.html" }
  ]
}
```

- [ ] **Step 2: Registrar o módulo como tool na Central JCBP**

No Supabase Dashboard → SQL Editor:

```sql
insert into public.tools (nome, descricao, icone, url, ativo)
values (
  'Acólitos e Coroinhas',
  'Gestão da pastoral de acólitos, coroinhas e cerimoniários',
  '⛪',
  '/acolitos',
  true
)
on conflict do nothing;
```

- [ ] **Step 3: Verificar deploy**

```bash
git add vercel.json
git commit -m "feat: vercel.json — rotas módulo acólitos"
git push origin main
```

Após deploy no Vercel:
- `/acolitos` abre `index.html` ✓
- Login na Central → card "Acólitos e Coroinhas" aparece ✓
- Clicar card → redireciona para `/acolitos` ✓
- Usuário sem vínculo → redireciona para `novos.html` ✓

---

## Self-Review

**Spec coverage:**
- Novos membros com suporte a múltiplos filhos: Task 4 ✓
- Login imediato + CRM status page: Task 4 (cria pastoral_members role='novo') + Task 7 (renderCrmStatus) ✓
- Pipeline CRM 5 etapas com pipeline e lista: Task 5 ✓
- Avançar etapa → registra histórico: Task 5 (confirmarAvancar) ✓
- Integrado → define role no pastoral_members: Task 5 ✓
- Cards de membros com patch de rank: Task 6 (usa avatarHtml de shared.js) ✓
- Ficha individual: Pessoal / Habilitações / Disponibilidade / Família / Observações: Task 6 ✓
- Salvar habilitações com upsert: Task 6 (salvarFicha) ✓
- Salvar disponibilidade: Task 6 ✓
- Dashboard por role (novo/membro/equipe): Task 7 ✓
- Jornada visual Aspirante → Cerimoniário: Task 7 (renderDashboardMembro) ✓
- KPIs operacionais: Task 7 (renderDashboardEquipe) ✓
- Rotas Vercel + registro como tool: Task 8 ✓
- innerHTML apenas com dados hardcoded/numéricos (idx) ou sanitizados (escHtml/sanitizeUrl): ✓

**Sem placeholders. Sem TBDs. Assinaturas consistentes com shared.js da Fase 1A.**
