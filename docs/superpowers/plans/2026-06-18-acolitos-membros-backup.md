# Membros: Backup Completo + Botões Padronizados/Responsivos — Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membros com 1 botão "📄 Relatório" → modal com "🖨 Imprimir/PDF" e "⬇️ CSV (backup completo)"; CSV exporta TODOS os dados do membro + funções + frequência; toolbar responsiva; rótulos padronizados.

**Architecture:** Modal + CSV-backup em `membros.html` (reusa fundação shared.js + `todos`/`FUNCOES`/`fetchFrequencia`); `.toolbar` ganha `flex-wrap` em shared.css; relabel no modal de frequência (escala.html). Sem banco novo.

**Tech Stack:** HTML/JS vanilla.

---

## Contexto técnico
- `shared.css:410`: `.toolbar { display:flex; ... }` — **sem** `flex-wrap` (estoura no mobile).
- `membros.html`: toolbar botões em l.88-89 (`relatorioMembrosPDF`/`relatorioMembrosCSV`); funções em l.211-232; `todos` = `select('*')` (todas as colunas + `role`); `FUNCOES` (l.127-139, `{id,label}`); `nivelInfo`, `fetchFrequencia` (shared), `sb` disponível.
- `acolitos_habilitacoes(membro_id,funcao,proficiencia)` — lida via `sb` (como no jornada-admin).
- Fundação: `abrirRelatorio`, `relTabela`, `baixarCSV(nome,linhas)`, `toast`.
- `escala.html:1467`: botão do modal de frequência `📄 PDF` (relabel p/ `🖨 Imprimir/PDF`).

Convenções: commits PT + `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`; `main`; deploy do **root**.

Sintaxe:
```bash
node -e "for(const f of ['projetos/acolitos/membros.html','projetos/acolitos/escala.html']){const h=require('fs').readFileSync(f,'utf8');const m=(h.match(/<script>([\s\S]*?)<\/script>/g)||[]).map(s=>s.replace(/^<script>/,'').replace(/<\/script>$/,''));let ok=true;m.forEach((c,i)=>{if(!c.trim())return;try{new Function(c);}catch(e){ok=false;console.log(f,'bloco',i,e.message);}});console.log(f.split('/').pop(),ok?'OK':'FALHOU');}"
```

---

## Task 1: Toolbar responsiva (shared.css)

- [ ] **Step 1:** Trocar (l.410):
```css
.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; gap: 10px; }
```
por:
```css
.toolbar { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; margin-bottom: 14px; gap: 10px; }
```
- [ ] **Step 2:** Commit
```bash
git add projetos/acolitos/shared.css
git commit -m "fix(acolitos): toolbar com flex-wrap (não estoura no mobile)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Membros — botão único + modal + CSV backup completo

**Files:** Modify `projetos/acolitos/membros.html`

- [ ] **Step 1: Trocar os 2 botões de ícone (l.88-89) por um**

Trocar:
```html
    <button class="btn-sm gray" onclick="relatorioMembrosPDF()" title="Relatório (imprimir/PDF)">📄</button>
    <button class="btn-sm gray" onclick="relatorioMembrosCSV()" title="Exportar CSV">⬇️</button>
```
por:
```html
    <button class="btn-sm gray" onclick="abrirRelatorioMembros()" title="Relatório / backup">📄 Relatório</button>
```

- [ ] **Step 2: Adicionar `abrirRelatorioMembros()` (logo após `_nivelLabel`, antes de `relatorioMembrosPDF`)**
```js
function abrirRelatorioMembros(){
  const ov=document.createElement('div'); ov.className='modal-overlay open'; ov.onclick=e=>{ if(e.target===ov) ov.remove(); };
  const md=document.createElement('div'); md.className='modal'; md.style.maxWidth='420px';
  md.innerHTML='<div class="modal-title">📄 Relatório de Membros</div>'
    +'<p style="font-size:12px;color:var(--text-muted);margin:-4px 0 12px;">PDF = resumo legível. CSV = backup completo (todos os dados + funções + frequência).</p>'
    +'<div style="display:flex;flex-direction:column;gap:8px;">'
    +'<button class="btn-sm gold" id="rm-pdf" style="width:100%;">🖨 Imprimir/PDF</button>'
    +'<button class="btn-sm" id="rm-csv" style="width:100%;background:transparent;border:1px solid var(--gold-dim);color:var(--gold-light);">⬇️ CSV (backup completo)</button>'
    +'<button class="btn-sm gray" id="rm-x" style="width:100%;">Fechar</button></div>';
  ov.appendChild(md); document.body.appendChild(ov);
  md.querySelector('#rm-pdf').onclick=()=>relatorioMembrosPDF();
  md.querySelector('#rm-csv').onclick=()=>relatorioMembrosCSV();
  md.querySelector('#rm-x').onclick=()=>ov.remove();
}
```

- [ ] **Step 3: Reescrever `relatorioMembrosCSV()` (backup completo)**

Trocar a função `relatorioMembrosCSV` inteira por:
```js
async function relatorioMembrosCSV(){
  if(!todos.length){ baixarCSV('membros-backup', [['(sem membros)']]); return; }
  const { data: habs } = await sb.from('acolitos_habilitacoes').select('membro_id,funcao,proficiencia');
  const habBy={}; (habs||[]).forEach(h=>{ (habBy[h.membro_id]=habBy[h.membro_id]||{})[h.funcao]=h.proficiencia; });
  let freqMap={}; try{ freqMap = await fetchFrequencia() || {}; }catch(e){}
  const memberCols=[...new Set(todos.flatMap(m=>Object.keys(m)))];
  const funcCols=FUNCOES.map(f=>f.id);
  const head=memberCols.concat(funcCols.map(id=>'func:'+id)).concat(['freq_servidas','freq_faltas','freq_atrasos','freq_taxa','freq_ultima']);
  const fmt=v=>(Array.isArray(v)||(v&&typeof v==='object'))?JSON.stringify(v):(v==null?'':String(v));
  const linhas=[head];
  todos.slice().sort((a,b)=>(a.nome||'').localeCompare(b.nome||'')).forEach(m=>{
    const h=habBy[m.id]||{}, f=freqMap[m.id]||{};
    const faltas=(f.faltas_just||0)+(f.faltas_nao_just||0);
    linhas.push(
      memberCols.map(c=>fmt(m[c]))
        .concat(funcCols.map(id=>h[id]||''))
        .concat([ f.servidas!=null?String(f.servidas):'', String(faltas), f.atrasos!=null?String(f.atrasos):'', f.taxa!=null?String(f.taxa):'', f.ultima_participacao||'' ])
    );
  });
  baixarCSV('membros-backup', linhas);
}
```
(`relatorioMembrosPDF` permanece igual — resumo legível por comunidade.)

- [ ] **Step 4: Validar sintaxe + commit**
```bash
git add projetos/acolitos/membros.html
git commit -m "feat(acolitos): Membros com modal de relatório + CSV backup completo (todos os campos + funções + frequência)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Padronizar rótulo do modal de Frequência (escala.html)

- [ ] **Step 1:** Em `escala.html:1467`, trocar o texto do botão `id="freq-pdf"` de `📄 PDF` para `🖨 Imprimir/PDF`.
- [ ] **Step 2: Validar sintaxe + commit + deploy do root**
```bash
node -e "..."   # → membros/escala OK
git add projetos/acolitos/escala.html
git commit -m "polish(acolitos): rótulo do botão de PDF da frequência padronizado

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
cd /Users/erickmartins/iajcbp && pwd   # /Users/erickmartins/iajcbp
git push origin main
vercel --prod --yes   # iajcbp-...
```

- [ ] **Step 3: Validação (humano)**
  - Membros → 📄 Relatório → modal com 🖨 Imprimir/PDF e ⬇️ CSV (backup completo).
  - CSV → `membros-backup-AAAA-MM-DD.csv` com TODAS as colunas + `func:*` + `freq_*`; abrir no Excel (acentos, arrays serializados).
  - **Celular:** toolbar do Membros não estoura; modal responsivo.
  - Escala → 📊 Frequência → modal agora com 🖨 Imprimir/PDF.

---

## Self-Review (preenchido)
**1. Spec coverage:** botão único + modal padronizado (Task 2.1/2.2) ✅; CSV backup completo (todas as colunas + funções + frequência) (Task 2.3) ✅; PDF legível mantido ✅; toolbar responsiva (Task 1) ✅; rótulos padronizados (Task 3) ✅.
**2. Placeholder scan:** sem TBD/TODO; código completo (`node -e "..."` = comando do topo).
**3. Type consistency:** `relatorioMembrosCSV` agora `async` (chamada via onclick `()=>relatorioMembrosCSV()` — ok, promessa ignorada); usa `baixarCSV(nome, linhas[][])`, `FUNCOES[].id`, `fetchFrequencia()→{id:row}`, `sb.from('acolitos_habilitacoes')`. Modal reusa padrão `.modal-overlay`/`.modal`.
**Risco:** (a) `memberCols` inclui `role`/`foto_url`/`avisos` (jsonb) — desejado (backup completo); jsonb/array serializados via JSON.stringify. (b) `sb` lê `acolitos_habilitacoes` (coord/equipe — gate da página garante). (c) toolbar `flex-wrap` é global (shared.css) — melhora todas as toolbars, sem regressão.
