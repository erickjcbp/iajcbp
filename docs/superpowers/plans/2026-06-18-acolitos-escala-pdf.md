# Escala em PDF — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Botão global 🖨 Escala (PDF) na toolbar da escala → PDF da escala carregada, por semana → missa → tabela Membro/Função em ordem alfabética, via a fundação `abrirRelatorio`.

**Architecture:** 1 função em `escala.html` reusando `celebracoes`/`escalasMap`/`FUNCAO_LABEL`/`TIPO_LABEL`/`DIAS` e a fundação do shared.js. Sem banco novo.

**Tech Stack:** HTML/JS vanilla.

---

## Contexto técnico (`projetos/acolitos/escala.html`)
- `celebracoes` (global): `{id,data,horario,comunidade,tipo}` (período carregado; respeita comunidade + toggle Histórico).
- `escalasMap[c.id]` → linhas com `funcao` e `acolitos_membros.nome`.
- `FUNCAO_LABEL` (l.357), `TIPO_LABEL` (l.362), `DIAS` (l.367).
- Agrupamento por semana (renderCards l.539-546): segunda ISO → `{label:'Semana de DD/mmm', items:[]}`.
- Ordem de missas e nome (de `exportarSemana` l.1072-1080): `HOR_ORDEM=['17h','18h30','7h','9h','19h']`; `nomeDe(e)=e.acolitos_membros?.nome`.
- Toolbar `.escala-acoes` l.142-150 (após `📊 Frequência` l.147). Fundação: `abrirRelatorio({titulo,subtitulo,corpo,css})`, `relTabela(headers,rows)` (shared.js).

Convenções: commits PT + `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`; `main`; deploy do **root**.

Sintaxe:
```bash
node -e "const fs=require('fs');const h=fs.readFileSync('projetos/acolitos/escala.html','utf8');const m=h.match(/<script>([\s\S]*?)<\/script>/g)||[];let ok=true;m.forEach((s,i)=>{const c=s.replace(/^<script>/,'').replace(/<\/script>$/,'');if(!c.trim())return;try{new Function(c);}catch(e){ok=false;console.log('ERRO',i,e.message);}});console.log(ok?'OK':'FALHOU');"
```

---

## Task 1: Função `escalaPDF()`

**Files:** Modify `projetos/acolitos/escala.html`

- [ ] **Step 1: Adicionar `escalaPDF` (top-level, antes de `function exportarSemana` ~l.1070)**

```js
// ── Escala em PDF (período carregado, por semana → missa, alfabético) ──
function escalaPDF(){
  if(!celebracoes || !celebracoes.length){ toast('Nenhuma celebração no período.','error'); return; }
  const HOR_ORDEM=['17h','18h30','7h','9h','19h'];
  const horRank=h=>{ const i=HOR_ORDEM.indexOf(String(h||'').replace(/^0/,'')); return i<0?99:i; };
  const nomeDe=e=>(e.acolitos_membros && e.acolitos_membros.nome) || '—';
  const comLbl=c=>c==='matriz'?'Matriz':'Sto. Antônio';
  // agrupa por semana (segunda ISO)
  const semanas={};
  celebracoes.forEach(c=>{
    const d=new Date(c.data+'T00:00:00'); const mon=new Date(d); mon.setDate(d.getDate()-((d.getDay()+6)%7));
    const key=mon.toISOString().slice(0,10);
    if(!semanas[key]) semanas[key]={ label:'Semana de '+mon.toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}), items:[] };
    semanas[key].items.push(c);
  });
  let corpo='';
  Object.keys(semanas).sort().forEach(key=>{
    const sem=semanas[key];
    corpo+='<h2>'+relEsc(sem.label)+'</h2>';
    sem.items.slice().sort((a,b)=>a.data.localeCompare(b.data)||horRank(a.horario)-horRank(b.horario)).forEach(c=>{
      const d=new Date(c.data+'T00:00:00');
      const tit=DIAS[d.getDay()]+' '+d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})+' · '+c.horario+' · '+comLbl(c.comunidade)+' · '+(TIPO_LABEL[c.tipo]||c.tipo);
      corpo+='<h3>'+relEsc(tit)+'</h3>';
      const escalas=(escalasMap[c.id]||[]).slice().sort((a,b)=>nomeDe(a).localeCompare(nomeDe(b),'pt',{sensitivity:'base'}));
      if(!escalas.length){ corpo+='<p class="muted">(escala não montada)</p>'; return; }
      corpo+=relTabela(['Membro','Função'], escalas.map(e=>[ nomeDe(e), (FUNCAO_LABEL[e.funcao]||e.funcao) ]));
    });
  });
  const datas=celebracoes.map(c=>c.data).sort();
  const f=s=>new Date(s+'T00:00:00').toLocaleDateString('pt-BR');
  const periodo = datas.length ? (f(datas[0])+' a '+f(datas[datas.length-1])) : 'período carregado';
  abrirRelatorio({ titulo:'Escala', subtitulo:'Acólitos · '+periodo, corpo, css:'h3{margin:14px 0 4px}' });
}
```

- [ ] **Step 2: Validar sintaxe** (comando acima) — `OK`.
- [ ] **Step 3: Commit**
```bash
git add projetos/acolitos/escala.html
git commit -m "feat(acolitos): escala em PDF (por semana → missa, ordem alfabética) — função

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Botão na toolbar + deploy

**Files:** Modify `projetos/acolitos/escala.html`

- [ ] **Step 1: Adicionar o botão 🖨 Escala (PDF) após 📊 Frequência (l.147)**

Inserir após `<button class="btn-sm gray" onclick="abrirRelatorioFrequencia()" ...>📊 Frequência</button>`:
```html
      <button class="btn-sm gray" onclick="escalaPDF()" title="Imprimir a escala do período (PDF)">🖨 Escala PDF</button>
```

- [ ] **Step 2: Validar sintaxe + commit + deploy do root**
```bash
node -e "..."   # → OK
git add projetos/acolitos/escala.html
git commit -m "feat(acolitos): botão 🖨 Escala PDF na toolbar

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
cd /Users/erickmartins/iajcbp && pwd   # /Users/erickmartins/iajcbp
git push origin main
vercel --prod --yes   # iajcbp-...
```

- [ ] **Step 3: Validação (humano)**
  - Escala → 🖨 Escala PDF → abre o PDF com semanas/missas e a lista alfabética Membro/Função.
  - Testar com 🕓 Histórico ligado (inclui passadas) e com filtro de comunidade. Pop-ups permitidos.

---

## Self-Review (preenchido)
**1. Spec coverage:** botão global na toolbar (Task 2) ✅; PDF por semana → missa → tabela Membro/Função alfabética (Task 1) ✅; missa sem escala → "(escala não montada)" ✅; usa `celebracoes`/`escalasMap`/`FUNCAO_LABEL`/`TIPO_LABEL`/`DIAS` + fundação ✅; subtítulo com intervalo de datas ✅; bordas (sem celebrações, nome ausente, popup) ✅.
**2. Placeholder scan:** sem TBD/TODO; código completo (`node -e "..."` = comando do topo).
**3. Type consistency:** `escalaPDF()` usa `relTabela(headers, rows[][])` + `abrirRelatorio({titulo,subtitulo,corpo,css})` + `relEsc`; reaproveita `HOR_ORDEM`/`nomeDe`/agrupamento-semana iguais aos de `exportarSemana`/`renderCards`. Sem novos globais conflitantes (função única `escalaPDF`).
**Risco:** join `acolitos_membros` traz só `nome` (sem apelido) — PDF usa nome completo (ok p/ escala formal).
