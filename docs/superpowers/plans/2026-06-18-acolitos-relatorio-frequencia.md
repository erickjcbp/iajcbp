# Relatório de Frequência (PDF + CSV) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Botão 📊 Frequência na Escala → relatório de presença por membro (acumulado da view, ou por período via query), em PDF e CSV, usando a fundação `abrirRelatorio`/`relTabela`/`baixarCSV`.

**Architecture:** Tudo em `escala.html` (já tem `membros`, `freqMap`, `celebracoes`, `sb`, `toast` e a fundação do shared.js). Um modal com De/Até opcionais; `_freqDados(de,ate)` decide entre view acumulada e agregação por período; `freqPDF`/`freqCSV` renderizam. Sem banco novo.

**Tech Stack:** HTML/JS vanilla.

---

## Contexto técnico (`projetos/acolitos/escala.html`)
- Globais: `membros` (ativos, l.479), `freqMap` (mapa da view, l.504), `sb`, `toast`.
- View `acolitos_frequencia` (campos por membro): `servidas, faltas_just, faltas_nao_just, atrasos, taxa, ultima_participacao` (acumulado, com substituto).
- Período: `sb.from('acolitos_escalas').select('membro_id,status,acolitos_celebracoes!inner(data)').gte/lte('acolitos_celebracoes.data',...)`. `status ∈ {escalado,presente,ausente_justificado,ausente,atrasado,substituido}`.
- Fundação (shared.js): `abrirRelatorio({titulo,subtitulo,corpo,css})`, `relTabela(headers, rows)` (célula = string ou `{t,bg}`), `baixarCSV(nome, linhas[][])`.
- Toolbar `.escala-acoes` ~l.142-147 (❌ Faltas em l.146). Funções top-level perto: `abrirRegistrarAusenciaCoord` (l.1321), `abrirAusencias` (l.1377).
- Comunidade: `'matriz'→Matriz`, `'santo_antonio'→Sto. Antônio`, senão Outra.

Convenções: commits PT + `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`; `main`; deploy do **root**.

Sintaxe:
```bash
node -e "const fs=require('fs');const h=fs.readFileSync('projetos/acolitos/escala.html','utf8');const m=h.match(/<script>([\s\S]*?)<\/script>/g)||[];let ok=true;m.forEach((s,i)=>{const c=s.replace(/^<script>/,'').replace(/<\/script>$/,'');if(!c.trim())return;try{new Function(c);}catch(e){ok=false;console.log('ERRO',i,e.message);}});console.log(ok?'OK':'FALHOU');"
```

---

## Task 1: Funções do relatório

**Files:** Modify `projetos/acolitos/escala.html`

- [ ] **Step 1: Adicionar as funções (top-level, antes de `async function abrirAusencias(){` ~l.1377)**

```js
// ── Relatório de Frequência (acumulado via view OU por período) ──
function _freqComLabel(c){ return c==='matriz'?'Matriz':c==='santo_antonio'?'Sto. Antônio':'Outra'; }
function _freqPeriodoLabel(de,ate){ const f=d=>new Date(d+'T00:00:00').toLocaleDateString('pt-BR'); if(de&&ate)return 'de '+f(de)+' a '+f(ate); if(de)return 'a partir de '+f(de); if(ate)return 'até '+f(ate); return 'Acumulado (histórico total)'; }
async function _freqDados(de, ate){
  const out = membros.map(m=>({ m, servidas:0, faltas:0, atrasos:0, taxa:null, ultima:null }));
  const byId = {}; out.forEach(r=>{ byId[r.m.id]=r; });
  if(!de && !ate){
    const freq = (freqMap && Object.keys(freqMap).length) ? freqMap : (await fetchFrequencia());
    out.forEach(r=>{ const f=freq[r.m.id]; if(f){ r.servidas=f.servidas||0; r.faltas=(f.faltas_just||0)+(f.faltas_nao_just||0); r.atrasos=f.atrasos||0; r.taxa=(f.taxa!=null?f.taxa:null); r.ultima=f.ultima_participacao||null; } });
    return out;
  }
  let q = sb.from('acolitos_escalas').select('membro_id,status,acolitos_celebracoes!inner(data)');
  if(de) q=q.gte('acolitos_celebracoes.data', de);
  if(ate) q=q.lte('acolitos_celebracoes.data', ate);
  const { data } = await q;
  (data||[]).forEach(e=>{ const r=byId[e.membro_id]; if(!r) return; const dt=e.acolitos_celebracoes&&e.acolitos_celebracoes.data;
    if(e.status==='presente'||e.status==='atrasado'){ r.servidas++; if(e.status==='atrasado') r.atrasos++; if(dt&&(!r.ultima||dt>r.ultima)) r.ultima=dt; }
    else if(e.status==='ausente'||e.status==='ausente_justificado'){ r.faltas++; }
  });
  out.forEach(r=>{ const den=r.servidas+r.faltas; r.taxa = den ? Math.round(100*r.servidas/den) : null; });
  return out;
}
function _freqOrdena(a){ return a.sort((x,y)=>{ if(x.taxa==null&&y.taxa==null) return (x.m.nome||'').localeCompare(y.m.nome||''); if(x.taxa==null) return 1; if(y.taxa==null) return -1; return x.taxa-y.taxa; }); }
async function freqPDF(){
  const de=document.getElementById('freq-de').value, ate=document.getElementById('freq-ate').value;
  if(de&&ate&&de>ate){ toast('A data inicial é maior que a final.','error'); return; }
  const rows=await _freqDados(de,ate);
  const ordem=['matriz','santo_antonio','outra']; const grp={matriz:[],santo_antonio:[],outra:[]};
  rows.forEach(r=>grp[ordem.includes(r.m.comunidade)?r.m.comunidade:'outra'].push(r));
  const fmtD=d=>d?new Date(d+'T00:00:00').toLocaleDateString('pt-BR'):'—';
  let corpo='';
  ordem.forEach(c=>{ const arr=grp[c]; if(!arr.length) return; _freqOrdena(arr);
    const trows=arr.map(r=>[ (r.m.apelido||r.m.nome), String(r.servidas), String(r.faltas), String(r.atrasos),
      (r.taxa==null?{t:'—'}:{t:r.taxa+'%', bg:(r.taxa<70?'#f7caca':'transparent')}), fmtD(r.ultima) ]);
    corpo+='<h2>'+_freqComLabel(c)+' · '+arr.length+'</h2>'+relTabela(['Membro','Servidas','Faltas','Atrasos','Taxa','Última'], trows);
  });
  if(!corpo) corpo='<p class="muted">Sem dados.</p>';
  if(de||ate) corpo+='<p class="muted">Período não credita substitutos.</p>';
  abrirRelatorio({ titulo:'Relatório de Frequência', subtitulo:'Acólitos · '+_freqPeriodoLabel(de,ate), corpo });
}
async function freqCSV(){
  const de=document.getElementById('freq-de').value, ate=document.getElementById('freq-ate').value;
  if(de&&ate&&de>ate){ toast('A data inicial é maior que a final.','error'); return; }
  const rows=await _freqDados(de,ate); _freqOrdena(rows);
  const fmtD=d=>d?new Date(d+'T00:00:00').toLocaleDateString('pt-BR'):'';
  const linhas=[['Comunidade','Membro','Servidas','Faltas','Atrasos','Taxa','Última']];
  rows.forEach(r=>linhas.push([ _freqComLabel(r.m.comunidade), r.m.nome||'', String(r.servidas), String(r.faltas), String(r.atrasos), (r.taxa==null?'':r.taxa+'%'), fmtD(r.ultima) ]));
  baixarCSV('frequencia', linhas);
}
function abrirRelatorioFrequencia(){
  const ov=document.createElement('div'); ov.className='modal-overlay open'; ov.onclick=e=>{ if(e.target===ov) ov.remove(); };
  const md=document.createElement('div'); md.className='modal'; md.style.maxWidth='420px';
  md.innerHTML='<div class="modal-title">📊 Relatório de Frequência</div>'
    +'<p style="font-size:12px;color:var(--text-muted);margin:-4px 0 12px;">Deixe as datas em branco para o acumulado (histórico total).</p>'
    +'<div style="display:flex;gap:10px;"><label style="flex:1;font-size:12px;color:var(--text-muted);">De<input type="date" id="freq-de" class="form-input" style="width:100%;"></label>'
    +'<label style="flex:1;font-size:12px;color:var(--text-muted);">Até<input type="date" id="freq-ate" class="form-input" style="width:100%;"></label></div>'
    +'<div style="display:flex;gap:8px;margin-top:14px;"><button class="btn-sm gold" id="freq-pdf" style="flex:1;">📄 PDF</button><button class="btn-sm gray" id="freq-csv" style="flex:1;">⬇️ CSV</button><button class="btn-sm gray" id="freq-x">Fechar</button></div>';
  ov.appendChild(md); document.body.appendChild(ov);
  md.querySelector('#freq-pdf').onclick=freqPDF;
  md.querySelector('#freq-csv').onclick=freqCSV;
  md.querySelector('#freq-x').onclick=()=>ov.remove();
}
```

- [ ] **Step 2: Validar sintaxe** (comando acima) — `OK`.
- [ ] **Step 3: Commit**
```bash
git add projetos/acolitos/escala.html
git commit -m "feat(acolitos): relatório de frequência (acumulado + período) — funções

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Botão na toolbar + deploy

**Files:** Modify `projetos/acolitos/escala.html`

- [ ] **Step 1: Adicionar o botão 📊 Frequência (após ❌ Faltas, l.146)**

Inserir após `<button class="btn-sm gray" onclick="abrirFaltas()" ...>❌ Faltas</button>`:
```html
      <button class="btn-sm gray" onclick="abrirRelatorioFrequencia()" title="Relatório de frequência (PDF/CSV)">📊 Frequência</button>
```

- [ ] **Step 2: Validar sintaxe + commit + deploy do root**
```bash
node -e "..."   # → OK
git add projetos/acolitos/escala.html
git commit -m "feat(acolitos): botão 📊 Frequência na toolbar da escala

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
cd /Users/erickmartins/iajcbp && pwd   # /Users/erickmartins/iajcbp
git push origin main
vercel --prod --yes   # iajcbp-...
```

- [ ] **Step 3: Validação (humano)**
  - Escala → 📊 Frequência → sem datas → 📄 PDF (acumulado por comunidade, ordenado por taxa, <70% em vermelho) e ⬇️ CSV.
  - Com período (ex.: último mês) → números do intervalo + rodapé "Período não credita substitutos."
  - `de > ate` → toast de erro. Pop-ups permitidos.

---

## Self-Review (preenchido)
**1. Spec coverage:** modal De/Até + PDF/CSV (Task 1: `abrirRelatorioFrequencia`) ✅; acumulado via view / período via query (`_freqDados`) ✅; agrupado por comunidade, ordenado por taxa, <70% vermelho (`freqPDF`) ✅; CSV (`freqCSV`) ✅; botão na toolbar (Task 2) ✅; fundação reusada ✅; bordas (de>ate, sem dados, taxa null, popup) ✅.
**2. Placeholder scan:** sem TBD/TODO; código completo (`node -e "..."` = comando do topo).
**3. Type consistency:** `_freqDados→[{m,servidas,faltas,atrasos,taxa,ultima}]`, `relTabela` célula `{t,bg}` p/ taxa vermelha, `baixarCSV(nome, linhas[][])`, ids `freq-de`/`freq-ate`/`freq-pdf`/`freq-csv` consistentes entre modal e funções. Reusa `membros`, `freqMap`, `fetchFrequencia`, `abrirRelatorio`, `relTabela`, `baixarCSV`, `toast`.
**Risco:** `freqMap` pode estar vazio se `loadDados` não rodou — `_freqDados` faz fallback `await fetchFrequencia()`. View exige sessão autenticada (ok na escala da coordenação).
