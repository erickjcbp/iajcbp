# Panorama por Membro (PDF) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Boletim imprimível por acólito — individual rico (do modal de Panorama) e lote leve (1 página/membro), reusando a fundação `abrirRelatorio` do shared.js.

**Architecture:** Helpers + 2 funções em `jornada-admin.html`. O individual reusa os dados que `abrirPanorama` já busca (board/estrelas/badges) → 0 RPC extra; o lote usa só dados baratos/globais (habAll, virtudes, frequência via 1 query). Sem banco novo.

**Tech Stack:** HTML/JS vanilla.

---

## Contexto técnico (`projetos/acolitos/jornada-admin.html`)
- `abrirPanorama(m)` (l.547-635): `close` criado l.552; RPCs em paralelo l.555-559
  (`board`,`est`,`badges`); guard de erro `if(!board||board.erro)` ~l.561.
- Fundação (shared.js): `abrirRelatorio({titulo,subtitulo,corpo,css})`, `relTabela`, `relEsc` (use `_escHtml` local, equivalente).
- Helpers locais já existentes: `_profDe`, `_membrosDaLiga`, `_nome`, `_compLabelMap`, `_devFuncoes`, `PROF_LABEL`, `LIGAS_DEV`, `nivelInfo`.
- `fetchFrequencia(membroId?)` (shared.js): com id→1 row; sem id→mapa `{id:row}`. Campos: `servidas, faltas_just, faltas_nao_just, taxa, ultima_participacao`.
- `carregarDev` select (l.464-473) **não** traz comunidade/nascimento.
- Lista de membros: `card`/`filtros` (`busca`+`selNivel`) em renderDesenvolvimento (~l.441-447).

Convenções: commits PT + `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`; `main`; deploy do **root**.

Sintaxe:
```bash
node -e "const fs=require('fs');const h=fs.readFileSync('projetos/acolitos/jornada-admin.html','utf8');const m=h.match(/<script>([\s\S]*?)<\/script>/g)||[];let ok=true;m.forEach((s,i)=>{const c=s.replace(/^<script>/,'').replace(/<\/script>$/,'');if(!c.trim())return;try{new Function(c);}catch(e){ok=false;console.log('ERRO',i,e.message);}});console.log(ok?'OK':'FALHOU');"
```

---

## Task 1: Dados + helpers

**Files:** Modify `projetos/acolitos/jornada-admin.html`

- [ ] **Step 1: Incluir comunidade/nascimento no `carregarDev`**

Na query de `acolitos_membros` (l.~465), trocar
`select('id,nome,apelido,nivel,foto_url,competencias_desenvolvidas,desenvolvimento_competencias')`
por
`select('id,nome,apelido,nivel,foto_url,comunidade,data_nascimento,competencias_desenvolvidas,desenvolvimento_competencias')`.

- [ ] **Step 2: Adicionar helpers (após `baixarRelatorioCSV`)**

```js
function _idadeDe(dn){ if(!dn) return ''; const d=new Date(dn+'T00:00:00'); if(isNaN(d.getTime())) return ''; const h=new Date(); let a=h.getFullYear()-d.getFullYear(); const mm=h.getMonth()-d.getMonth(); if(mm<0||(mm===0&&h.getDate()<d.getDate())) a--; return (a>=0&&a<120)?String(a):''; }
function _funcoesDoMembro(mId){
  const aptas=[], form=[]; let naoTreino=0;
  _devFuncoes.forEach(([v,l])=>{ const p=_profDe(mId,v);
    if(p==='apto'||p==='experiente'||p==='referencia') aptas.push(l+' ('+PROF_LABEL[p]+')');
    else if(p==='em_formacao') form.push(l);
    else naoTreino++; });
  return { aptas, form, naoTreino };
}
function _cabecalhoBoletim(m, comNome){
  const ni=nivelInfo(m.nivel||'aspirante');
  const com=m.comunidade==='matriz'?'Matriz':m.comunidade==='santo_antonio'?'Sto. Antônio':(m.comunidade?'Outra':'');
  const id=_idadeDe(m.data_nascimento);
  const sub='<p class="muted">'+_escHtml(ni.label)+(ni.titulo?' · '+_escHtml(ni.titulo):'')+(com?' · '+com:'')+(id?' · '+id+' anos':'')+'</p>';
  return (comNome?'<h2>'+_escHtml(m.apelido||m.nome)+'</h2>':'')+sub;
}
function _freqHtml(freq){
  if(!freq) return '<p class="muted">Sem dados de frequência.</p>';
  const faltas=(freq.faltas_just||0)+(freq.faltas_nao_just||0);
  const ult=freq.ultima_participacao ? new Date(freq.ultima_participacao+'T00:00:00').toLocaleDateString('pt-BR') : '—';
  return relTabela(['Servidas','Faltas','Taxa','Última participação'],
    [[String(freq.servidas||0), String(faltas), (freq.taxa!=null?freq.taxa+'%':'—'), ult]]);
}
function _blocoFuncoesVirtudes(m){
  const f=_funcoesDoMembro(m.id);
  const virt=(m.competencias_desenvolvidas||[]).map(s=>_compLabelMap()[s]||s);
  return '<h3>Funções</h3><p>Aptas: '+(f.aptas.length?_escHtml(f.aptas.join(', ')):'—')+'</p>'
    +(f.form.length?'<p>Em formação: '+_escHtml(f.form.join(', '))+'</p>':'')
    +'<p class="muted">Não treinadas: '+f.naoTreino+'</p>'
    +'<h3>Virtudes formadas</h3><p>'+(virt.length?_escHtml(virt.join(', ')):'—')+'</p>';
}
```

- [ ] **Step 3: Validar sintaxe + commit**
```bash
node -e "..."   # comando acima → OK
git add projetos/acolitos/jornada-admin.html
git commit -m "feat(acolitos): dados+helpers do boletim por membro

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Panorama individual (rico) + botão no modal

**Files:** Modify `projetos/acolitos/jornada-admin.html`

- [ ] **Step 1: Adicionar `gerarPanoramaPDF` (após os helpers da Task 1)**

```js
function gerarPanoramaPDF(m, board, est, badges){
  fetchFrequencia(m.id).then(freq=>{
    let corpo=_cabecalhoBoletim(m, false);
    if(board && !board.erro){
      const caps=board.capitulos||[], bonus=board.bonus||[]; const allQ=[];
      caps.forEach(c=>(c.missoes||[]).forEach(q=>allQ.push(q))); bonus.forEach(q=>allQ.push(q));
      let c=0,a=0,p=0; allQ.forEach(q=>{ if(q.status==='concluida')c++; else if(q.status==='em_analise')a++; else p++; });
      corpo+='<h3>Jornada</h3><p>✦ XP: <b>'+(board.xp_total||0)+'</b> &nbsp; ⭐ '+((est&&est.estrelas)||0)
        +' &nbsp; Próximo: '+(board.proximo_nivel?_escHtml(nivelInfo(board.proximo_nivel).label)+(board.elegivel?' (elegível!)':''):'nível máximo')+'</p>'
        +'<p>Quests — concluídas: '+c+' · em análise: '+a+' · pendentes: '+p+'</p>';
      const pend=(board.pendencias||[]).map(x=>_escHtml(x.label));
      if(pend.length) corpo+='<p class="muted">Funções pendentes: '+pend.join(', ')+'</p>';
      const med=(badges||[]).filter(b=>!b.nivel && b.validacao==='avaliada');
      if(med.length) corpo+='<p class="muted">Medalhas especiais: '+med.map(b=>_escHtml(b.label)+(b.ganho?' ✓':'')).join(', ')+'</p>';
    }
    corpo+=_blocoFuncoesVirtudes(m);
    corpo+='<h3>Frequência</h3>'+_freqHtml(freq);
    abrirRelatorio({ titulo:'Panorama — '+(m.apelido||m.nome), subtitulo:'Acólitos', corpo });
  });
}
```

- [ ] **Step 2: Adicionar o botão 🖨 no modal `abrirPanorama` (logo após o `Promise.all`, ~l.559)**

Após a linha que fecha o `const [{data:board}...] = await Promise.all([...]);`, inserir:
```js
  const btnPrint = document.createElement('button'); btnPrint.className='btn-sm';
  btnPrint.style.cssText='width:100%;margin-top:8px;background:linear-gradient(180deg,var(--gold),#9a7a1e);color:#2a1a00;border:none;font-weight:700;';
  btnPrint.textContent='🖨 Imprimir panorama';
  btnPrint.onclick=()=>gerarPanoramaPDF(m, board, est, badges);
  md.insertBefore(btnPrint, close);
```
(Fica ANTES do guard de erro, então o botão existe sempre; `gerarPanoramaPDF` trata `board.erro` omitindo a Jornada.)

- [ ] **Step 3: Validar sintaxe + commit**
```bash
git add projetos/acolitos/jornada-admin.html
git commit -m "feat(acolitos): panorama individual em PDF (botão no modal, reusa dados)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Boletins em lote (leve) + botão na lista

**Files:** Modify `projetos/acolitos/jornada-admin.html`

- [ ] **Step 1: Adicionar `gerarPanoramasLote` (após `gerarPanoramaPDF`)**

```js
function gerarPanoramasLote(){
  fetchFrequencia().then(freqMap=>{
    let corpo='';
    LIGAS_DEV.forEach(([lglabel,slugs])=>{
      _membrosDaLiga(slugs).forEach(m=>{
        corpo+='<div class="pg">'+_cabecalhoBoletim(m, true)
          +_blocoFuncoesVirtudes(m)
          +'<h3>Frequência</h3>'+_freqHtml(freqMap[m.id])
          +'</div>';
      });
    });
    if(!corpo) corpo='<p class="muted">Nenhum membro.</p>';
    abrirRelatorio({ titulo:'Boletins de Desenvolvimento', subtitulo:'Acólitos · '+_devMembros.length+' membros', corpo, css:'.pg{page-break-after:always} .pg:last-child{page-break-after:auto} h2{border:none;margin-top:0}' });
  });
}
```

- [ ] **Step 2: Botão "🖨 Boletins (todos)" nos filtros da lista (~l.447)**

Trocar `filtros.append(busca, selNivel); card.appendChild(filtros);` por:
```js
  const btnLote = document.createElement('button'); btnLote.type='button'; btnLote.textContent='🖨 Boletins';
  btnLote.title='Imprimir 1 boletim por membro (leve, sem quests)';
  btnLote.style.cssText='flex:none;font-family:Oxanium,sans-serif;font-weight:700;font-size:11px;padding:0 10px;border-radius:8px;cursor:pointer;background:transparent;border:1px solid var(--gold-dim);color:var(--gold-light);';
  btnLote.onclick = gerarPanoramasLote;
  filtros.append(busca, selNivel, btnLote); card.appendChild(filtros);
```

- [ ] **Step 3: Validar sintaxe + commit + deploy do root**
```bash
node -e "..."   # → OK
git add projetos/acolitos/jornada-admin.html
git commit -m "feat(acolitos): boletins de desenvolvimento em lote (1 página/membro, leve)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
cd /Users/erickmartins/iajcbp && pwd   # /Users/erickmartins/iajcbp
git push origin main
vercel --prod --yes   # iajcbp-...
```

- [ ] **Step 4: Validação (humano)**
  - Abrir Panorama de um membro → **🖨 Imprimir panorama**: boletim com cabeçalho, Jornada (XP/estrelas/quests/pendências/medalhas), Funções, Virtudes, Frequência.
  - Aba Desenvolvimento → **🖨 Boletins**: 1 página por membro (leve, sem quests), agrupado por liga, com quebra de página. Pop-ups permitidos.

---

## Self-Review (preenchido)
**1. Spec coverage:** comunidade/idade no select (Task 1.1) ✅; helpers DRY `_funcoesDoMembro/_freqHtml/_cabecalhoBoletim/_blocoFuncoesVirtudes` (Task 1) ✅; individual rico reusando board/est/badges + freq (Task 2) ✅; lote leve sem quests, 1 página/membro por liga (Task 3) ✅; via fundação `abrirRelatorio` ✅; bordas (board.erro, freq nula, popup) ✅.
**2. Placeholder scan:** sem TBD/TODO; código completo (os `node -e "..."` são o comando de sintaxe do topo).
**3. Type consistency:** `gerarPanoramaPDF(m,board,est,badges)`, `gerarPanoramasLote()`, helpers retornando string HTML; `_freqHtml` usa `relTabela`; reusa `_escHtml`, `_profDe`, `_membrosDaLiga`, `_compLabelMap`, `nivelInfo`, `fetchFrequencia`, `abrirRelatorio`. `.pg`/page-break via `opts.css`.
**Risco:** confirmar campos da view `acolitos_frequencia` (servidas/faltas_just/faltas_nao_just/taxa/ultima_participacao) — se algum diferir, a célula mostra fallback (não quebra).
