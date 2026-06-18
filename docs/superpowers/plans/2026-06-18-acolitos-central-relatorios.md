# Central de Relatórios (fundação + Membros) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar um utilitário de relatório reutilizável em `shared.js` (PDF via janela + CSV), refatorar o relatório de Desenvolvimento para usá-lo, e adicionar o relatório de Membros.

**Architecture:** `abrirRelatorio()`/`baixarCSV()`/`relEsc()`/`relTabela()` no `shared.js` (globais de módulo, usados por todas as páginas). Cada relatório monta só o `corpo` (HTML) / `linhas` (CSV) e delega o "encanamento" (janela, brasão, CSS, impressão, blob). Sem banco, sem libs.

**Tech Stack:** HTML/JS vanilla.

---

## Contexto técnico
- `shared.js`: inserir após `buildPresencaChart` (fecha **l.2028**) e antes do bloco "ARRASTAR-PARA-FECHAR" (**l.2030**). `toast(msg,tipo)` (l.105). Nenhuma função de relatório existe ainda.
- `jornada-admin.html`: já tem `gerarRelatorioPDF()`/`baixarRelatorioCSV()` + helpers (`_escHtml`, `_profDe`, `_membrosComProf`, `_membrosDaLiga`, `_compLabelMap`, `PROF_ABREV`, `PROF_COR_PRINT`, `bucketsFuncao`, `_devFuncoes`, `_devMembros`, `_devComps`, `LIGAS_DEV`, `PROF_LABEL`, `PROF_NIVEIS`).
- `membros.html`: global `todos` (lista carregada, respeita `verArquivados`), funções top-level perto de `loadMembros` (l.187). Toolbar em l.80-88. `nivelInfo(slug)` (shared) disponível. Não há `calcIdade` — calcular inline. `comLabel` é local — usar helper próprio.
- Brasão: `/midia/logos/brasao-pastoral.png` (raiz do domínio).

Convenções: commits PT + `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`; `main`; deploy do **root**.

Checagem de sintaxe (genérica p/ html ou js):
```bash
node -e "const fs=require('fs');for(const f of ['projetos/acolitos/shared.js','projetos/acolitos/jornada-admin.html','projetos/acolitos/membros.html']){const h=fs.readFileSync(f,'utf8');const b=f.endsWith('.js')?[h]:(h.match(/<script>([\s\S]*?)<\/script>/g)||[]).map(s=>s.replace(/^<script>/,'').replace(/<\/script>$/,''));let ok=true;b.forEach((c,i)=>{if(!c.trim())return;try{new Function(c);}catch(e){ok=false;console.log(f,'bloco',i,e.message);}});console.log(f,ok?'OK':'FALHOU');}"
```

---

## File Structure
- Modify: `projetos/acolitos/shared.js` (fundação — Task 1).
- Modify: `projetos/acolitos/jornada-admin.html` (refatorar — Task 2).
- Modify: `projetos/acolitos/membros.html` (relatório novo — Task 3).

---

## Task 1: Fundação em `shared.js`

- [ ] **Step 1: Inserir os utilitários após `buildPresencaChart` (entre l.2028 e l.2030)**

```js
// ── Central de Relatórios (impressão/PDF + CSV) ──
function relEsc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function relTabela(headers, rows){
  const th = headers.map(h=>'<th>'+relEsc(h)+'</th>').join('');
  const tb = rows.map(r=>'<tr>'+r.map(c=>{
    if(c && typeof c==='object') return '<td style="background:'+(c.bg||'transparent')+'">'+relEsc(c.t)+'</td>';
    return '<td>'+relEsc(c)+'</td>';
  }).join('')+'</tr>').join('');
  return '<table class="rel"><thead><tr>'+th+'</tr></thead><tbody>'+tb+'</tbody></table>';
}
function abrirRelatorio(opts){
  const o = opts || {};
  const w = window.open('', '_blank');
  if(!w){ toast('Permita pop-ups para gerar o relatório.','error'); return null; }
  const hoje = new Date().toLocaleDateString('pt-BR');
  const css = '<style>'
    + '*{ -webkit-print-color-adjust:exact; print-color-adjust:exact; box-sizing:border-box; }'
    + 'body{ font-family:Georgia,serif; color:#1c1c1c; margin:0; padding:18px; }'
    + 'h1{ font-size:20px; margin:0; } h2{ font-size:15px; border-bottom:2px solid #8a6a24; color:#7a5a14; margin:22px 0 8px; } h3{ font-size:12px; margin:12px 0 4px; color:#333; }'
    + '.rel-hd{ display:flex; align-items:center; gap:12px; border-bottom:3px solid #8a6a24; padding-bottom:10px; }'
    + '.rel-hd img{ height:54px; } .rel-hd .sub{ font-size:11px; color:#666; }'
    + 'table{ border-collapse:collapse; width:100%; font-size:11px; margin:4px 0 10px; } th,td{ border:1px solid #bbb; padding:3px 6px; text-align:left; }'
    + 'td.nm{ white-space:nowrap; } .muted{ color:#777; font-size:11px; } .dev{ margin:6px 0; font-size:12px; }'
    + '.leg span{ display:inline-block; padding:1px 6px; border:1px solid #bbb; border-radius:3px; } tr.warn td{ font-weight:bold; color:#b00; }'
    + '@page{ margin:12mm; }'
    + (o.css||'')
    + '</style>';
  const cab = '<div class="rel-hd"><img src="'+location.origin+'/midia/logos/brasao-pastoral.png" onerror="this.style.display=\'none\'"><div><h1>'+relEsc(o.titulo||'Relatório')+'</h1><div class="sub">'+relEsc(o.subtitulo||'')+' · '+hoje+'</div></div></div>';
  const html = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>'+relEsc(o.titulo||'Relatório')+'</title>'+css+'</head><body>'+cab+(o.corpo||'')+'</body></html>';
  w.document.write(html); w.document.close(); w.focus();
  setTimeout(()=>{ try{ w.print(); }catch(e){} }, 350);
  return w;
}
function baixarCSV(nomeBase, linhas){
  const esc=s=>{ s=String(s==null?'':s); return /[";\n]/.test(s) ? '"'+s.replace(/"/g,'""')+'"' : s; };
  const csv='﻿'+(linhas||[]).map(r=>r.map(esc).join(';')).join('\r\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob); const a=document.createElement('a');
  a.href=url; a.download=(nomeBase||'relatorio')+'-'+new Date().toISOString().slice(0,10)+'.csv'; a.click();
  URL.revokeObjectURL(url); toast('✓ CSV gerado');
}
```

- [ ] **Step 2: Validar sintaxe** (comando acima) — `shared.js OK`.
- [ ] **Step 3: Conferir que não há colisão** (nenhuma página redefine os nomes):
```bash
grep -ln "function abrirRelatorio\|function baixarCSV\|function relTabela\|function relEsc" projetos/acolitos/*.html || echo "✅ só no shared.js"
```
- [ ] **Step 4: Commit**
```bash
git add projetos/acolitos/shared.js
git commit -m "feat(acolitos): fundação de relatórios em shared.js (abrirRelatorio/baixarCSV/relTabela)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Refatorar relatório de Desenvolvimento para usar a fundação

**Files:** Modify `projetos/acolitos/jornada-admin.html`

- [ ] **Step 1: Substituir o fim de `gerarRelatorioPDF` (a parte da janela/CSS) por `abrirRelatorio(...)`**

Localizar, dentro de `gerarRelatorioPDF()`, do `const css = '<style>'` até o fim da função
(`w.document.write(...) ... setTimeout(...print...); }`). Trocar TODO esse trecho (a montagem
de `css`, `cab`, `html`, `window.open` e print) por:
```js
  const extraCss = 'table.cob th,table.cob td{text-align:center} table.cob td:first-child{text-align:left}'
    + ' table.mtz th,table.mtz td{text-align:center} table.mtz td.nm{text-align:left}'
    + ' table.virt td{text-align:left}';
  const corpo = '<h2>1. Cobertura por função</h2><table class="cob"><thead><tr><th>Função</th><th>Prontos</th><th>Em formação</th><th>Zero</th></tr></thead><tbody>'+linhasCob+'</tbody></table>'
    + '<h2>2. A desenvolver (funções escassas)</h2>'+blocosDev
    + '<h2>3. Matriz de proficiência</h2>'+legenda+matriz
    + '<h2>4. Virtudes formadas</h2>'+virtudes;
  abrirRelatorio({ titulo:'Relatório de Desenvolvimento', subtitulo:'Acólitos · '+_devMembros.length+' membros ativos', corpo, css: extraCss });
}
```
Manter intactas, ANTES desse ponto, as variáveis já existentes: `orden`, `linhasCob`,
`escassas`, `blocosDev`, `matriz`, `legenda`, `virtudes` (e a remoção das linhas `const w = window.open...; if(!w)...; const hoje...; const total...` do começo da função — `hoje`/`total` saem; `compMap` permanece se usado por `virtudes`). As tabelas continuam com classes `cob`/`mtz`/`virt` e cores inline nas células.

- [ ] **Step 2: Substituir o corpo de `baixarRelatorioCSV` por `baixarCSV(...)`**

Trocar a montagem manual de CSV/Blob por:
```js
function baixarRelatorioCSV(){
  const head=['Liga','Membro'].concat(_devFuncoes.map(([,l])=>l));
  const linhas=[head];
  LIGAS_DEV.forEach(([lglabel,slugs])=>{
    _membrosDaLiga(slugs).forEach(m=>{
      linhas.push([lglabel.replace(/^[^\w]+\s*/,''), _nome(m)].concat(_devFuncoes.map(([v])=>PROF_LABEL[_profDe(m.id,v)])));
    });
  });
  baixarCSV('desenvolvimento', linhas);
}
```

- [ ] **Step 3: Validar sintaxe** (comando acima) — `jornada-admin.html OK`.
- [ ] **Step 4: Commit**
```bash
git add projetos/acolitos/jornada-admin.html
git commit -m "refactor(acolitos): relatório de Desenvolvimento usa a fundação compartilhada

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Relatório de Membros (`membros.html`)

- [ ] **Step 1: Adicionar 2 botões na toolbar (após o botão `🗄`, l.87)**

Inserir após `<button class="btn-sm gray" id="btn-arq" ...>🗄</button>`:
```html
    <button class="btn-sm gray" onclick="relatorioMembrosPDF()" title="Relatório (imprimir/PDF)">📄</button>
    <button class="btn-sm gray" onclick="relatorioMembrosCSV()" title="Exportar CSV">⬇️</button>
```

- [ ] **Step 2: Adicionar as funções (top-level, após `loadMembros` ~l.203)**

```js
function _comLabelRel(c){ return c==='matriz'?'Matriz':c==='santo_antonio'?'Sto. Antônio':'Outra'; }
function _idadeRel(dn){ if(!dn) return ''; const d=new Date(dn+'T00:00:00'); if(isNaN(d.getTime())) return ''; const h=new Date(); let a=h.getFullYear()-d.getFullYear(); const mm=h.getMonth()-d.getMonth(); if(mm<0||(mm===0&&h.getDate()<d.getDate())) a--; return (a>=0&&a<120)?String(a):''; }
function _nivelLabel(m){ return (typeof nivelInfo==='function' ? nivelInfo(m.nivel||m.role||'aspirante').label : (m.nivel||'')) || '—'; }
function relatorioMembrosPDF(){
  const ordem=['matriz','santo_antonio','outra']; const porCom={matriz:[],santo_antonio:[],outra:[]};
  todos.forEach(m=>{ porCom[ordem.includes(m.comunidade)?m.comunidade:'outra'].push(m); });
  let corpo='<p class="muted">Total: <b>'+todos.length+'</b> · '+ordem.filter(c=>porCom[c].length).map(c=>_comLabelRel(c)+': '+porCom[c].length).join(' · ')+'</p>';
  ordem.forEach(c=>{ const ms=porCom[c]; if(!ms.length) return;
    ms.sort((a,b)=>(a.nome||'').localeCompare(b.nome||''));
    const rows=ms.map(m=>[ m.nome||'—', _nivelLabel(m), _idadeRel(m.data_nascimento), m.telefone||'', m.telefone_whatsapp||'', m.responsavel||'', m.tem_tunica?'Sim':'Não', m.status==='afastado'?'Afastado':'Ativo' ]);
    corpo+='<h2>'+_comLabelRel(c)+' · '+ms.length+'</h2>'+relTabela(['Nome','Nível','Idade','Telefone','WhatsApp','Responsável','Túnica','Status'], rows);
  });
  abrirRelatorio({ titulo:'Relatório de Membros', subtitulo:'Acólitos · '+todos.length+' '+(verArquivados?'arquivados':'ativos'), corpo });
}
function relatorioMembrosCSV(){
  const linhas=[['Nome','Apelido','Nível','Comunidade','Nascimento','Idade','Telefone','WhatsApp','Responsável','Cel. Mãe','Cel. Recado','Túnica','Status','Grupo irmãos']];
  todos.slice().sort((a,b)=>(a.nome||'').localeCompare(b.nome||'')).forEach(m=>{
    linhas.push([ m.nome||'', m.apelido||'', _nivelLabel(m), _comLabelRel(m.comunidade), m.data_nascimento||'', _idadeRel(m.data_nascimento), m.telefone||'', m.telefone_whatsapp||'', m.responsavel||'', m.celular_mae||'', m.celular_recado||'', m.tem_tunica?'Sim':'Não', m.status==='afastado'?'Afastado':'Ativo', m.grupo_irmaos||'' ]);
  });
  baixarCSV('membros', linhas);
}
```

- [ ] **Step 3: Validar sintaxe** (comando acima) — `membros.html OK`.
- [ ] **Step 4: Commit + deploy do root**
```bash
git add projetos/acolitos/membros.html
git commit -m "feat(acolitos): relatório de Membros (PDF por comunidade + CSV) na toolbar

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
cd /Users/erickmartins/iajcbp && pwd   # precisa ser /Users/erickmartins/iajcbp
git push origin main
vercel --prod --yes   # deve sair iajcbp-...
```

- [ ] **Step 5: Validação (humano) no deploy**
  - **Desenvolvimento** (Jornada): 🖨 Imprimir/PDF e ⬇️ CSV continuam iguais (sem regressão do refator) — PDF com as 4 seções, matriz colorida; CSV abre no Excel.
  - **Membros**: 📄 abre PDF agrupado por comunidade com resumo no topo; ⬇️ baixa `membros-AAAA-MM-DD.csv` com acentos e todas as colunas. Testar com pop-ups permitidos; testar também com 🗄 (arquivados) ligado.

---

## Self-Review (preenchido)
**1. Spec coverage:** fundação `abrirRelatorio/baixarCSV/relEsc/relTabela` (Task 1) ✅; refator Desenvolvimento (Task 2) ✅; Membros PDF por comunidade + resumo e CSV completo (Task 3) ✅; base pronta p/ relatórios futuros (param `css`/`corpo`/`linhas`) ✅.
**2. Placeholder scan:** sem TBD/TODO; código completo.
**3. Type consistency:** `abrirRelatorio({titulo,subtitulo,corpo,css})`, `baixarCSV(nomeBase, linhas[][])`, `relTabela(headers[], rows[][]|{t,bg})`, `relEsc(s)` — usados igual em Desenvolvimento e Membros. `_membrosDaLiga`/`_profDe`/`_nome`/`PROF_LABEL` já existem no jornada-admin (Task 2 os reusa).
**Riscos:** (a) confirmar que o trecho removido em `gerarRelatorioPDF` é só o de janela/CSS (manter as variáveis de seção). (b) nomes novos no shared.js não colidem (Task 1 Step 3 verifica). (c) `todos` respeita `verArquivados` — relatório reflete a visão atual (documentado no subtítulo).
