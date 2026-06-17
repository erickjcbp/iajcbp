# Relatório de Desenvolvimento (PDF + CSV) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Botões "🖨 Imprimir/PDF" e "⬇️ CSV" no Mapa de Cobertura (Jornada → Desenvolvimento) que geram um relatório imprimível (janela própria) e um CSV da matriz, a partir dos dados já em memória.

**Architecture:** Funções de nível de módulo em `jornada-admin.html` que montam HTML (string) numa janela nova + um CSV via Blob, reusando `_devMembros`, `_devFuncoes`, `_devComps`, `habAll`, `bucketsFuncao`, `LIGAS_DEV`, `PROF_LABEL`. Sem banco, sem libs, sem deploy de função.

**Tech Stack:** HTML/JS vanilla.

---

## Contexto técnico
Tudo em `projetos/acolitos/jornada-admin.html` (globais de módulo, já carregados ao abrir a aba):
- `_devMembros` `{id,nome,apelido,nivel,competencias_desenvolvidas,...}`, `_devFuncoes` `[[valor,label]]`, `_devComps` `[[valor,label]]`.
- `habAll[membro_id][funcao]=proficiencia`; `bucketsFuncao(funcao)→{prontos,form,zero}`.
- `LIGAS_DEV` `[[label,[slugs]]]`; `PROF_LABEL`; `PROF_NIVEIS`.
- Cabeçalho do Mapa: `mh` (`🗺 Mapa de Cobertura`) na l.430. `mk` (helper de botão) só existe a partir da l.450 → os botões do relatório usam estilo inline próprio (não dependem de `mk`).
- Brasão servido em `/midia/logos/brasao-pastoral.png` (raiz do domínio).

Convenções: commits PT + `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`; commitar na `main`; deploy do **root**.

Checagem de sintaxe:
```bash
node -e "const fs=require('fs');const h=fs.readFileSync('projetos/acolitos/jornada-admin.html','utf8');const m=h.match(/<script>([\s\S]*?)<\/script>/g)||[];let ok=true;m.forEach((s,i)=>{const c=s.replace(/^<script>/,'').replace(/<\/script>$/,'');if(!c.trim())return;try{new Function(c);}catch(e){ok=false;console.log('ERRO',i,e.message);}});console.log(ok?'OK':'FALHOU');"
```

---

## File Structure
- Modify: `projetos/acolitos/jornada-admin.html` — funções do relatório (Task 1 e 2) + botões (Task 3).

---

## Task 1: Funções utilitárias + dados do relatório

**Files:** Modify `projetos/acolitos/jornada-admin.html`

- [ ] **Step 1: Adicionar helpers de relatório (nível de módulo, logo após `bucketsFuncao` ~l.319)**

Inserir após a função `bucketsFuncao(...)`:
```js
// ── Relatório de Desenvolvimento (PDF + CSV) ──
const PROF_ABREV = { nao_treinado:'NT', em_formacao:'F', apto:'A', experiente:'E', referencia:'R' };
const PROF_COR_PRINT = { nao_treinado:'#ffffff', em_formacao:'#f6e3c4', apto:'#c9ecd5', experiente:'#cfe2f3', referencia:'#e4d2f3' };
function _escHtml(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function _profDe(mId, funcao){ return (habAll[mId]||{})[funcao] || 'nao_treinado'; }
function _membrosComProf(funcao, profs){ return _devMembros.filter(m => profs.includes(_profDe(m.id,funcao))); }
function _membrosDaLiga(slugs){ return _devMembros.filter(m => slugs.includes(m.nivel||'aspirante')); }
function _compLabelMap(){ const o={}; _devComps.forEach(([v,l])=>{o[v]=l;}); return o; }
function _nome(m){ return m.apelido || m.nome || '—'; }
```

- [ ] **Step 2: Validar sintaxe** (comando acima). Expected: `OK`.

- [ ] **Step 3: Commit**
```bash
git add projetos/acolitos/jornada-admin.html
git commit -m "feat(acolitos): helpers do relatório de desenvolvimento

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: `gerarRelatorioPDF()` e `baixarRelatorioCSV()`

**Files:** Modify `projetos/acolitos/jornada-admin.html`

- [ ] **Step 1: Adicionar as duas funções (nível de módulo, logo após os helpers da Task 1)**

```js
function gerarRelatorioPDF(){
  const w = window.open('', '_blank');
  if(!w){ toast('Permita pop-ups para gerar o relatório.','error'); return; }
  const hoje = new Date().toLocaleDateString('pt-BR');
  const total = _devMembros.length;
  const compMap = _compLabelMap();

  // 1) Cobertura por função (ordenada por escassez)
  const orden = _devFuncoes.slice().sort((a,b)=>bucketsFuncao(a[0]).prontos - bucketsFuncao(b[0]).prontos);
  const linhasCob = orden.map(([v,l])=>{ const b=bucketsFuncao(v); const al=b.prontos<3?' ⚠':'';
    return '<tr'+(b.prontos<3?' class="warn"':'')+'><td>'+_escHtml(l)+al+'</td><td>'+b.prontos+'</td><td>'+b.form+'</td><td>'+b.zero+'</td></tr>'; }).join('');

  // 2) A desenvolver — funções escassas (prontos<3)
  const escassas = orden.filter(([v])=>bucketsFuncao(v).prontos<3);
  const blocosDev = escassas.map(([v,l])=>{
    const emForm = _membrosComProf(v,['em_formacao']).map(_nome).map(_escHtml);
    const nt = bucketsFuncao(v).zero;
    return '<div class="dev"><b>'+_escHtml(l)+'</b><div>'+(emForm.length?('Em formação: '+emForm.join(', ')):'<i>Ninguém em formação — recrutar</i>')+'</div><div class="muted">Não treinados: '+nt+'</div></div>';
  }).join('') || '<p class="muted">Nenhuma função escassa. 🎉</p>';

  // 3) Matriz por liga
  const matriz = LIGAS_DEV.map(([lglabel,slugs])=>{
    const mem=_membrosDaLiga(slugs); if(!mem.length) return '';
    const head='<th>Membro</th>'+_devFuncoes.map(([,l])=>'<th title="'+_escHtml(l)+'">'+_escHtml(l.length>4?l.slice(0,4):l)+'</th>').join('');
    const rows=mem.map(m=>'<tr><td class="nm">'+_escHtml(_nome(m))+'</td>'+_devFuncoes.map(([v])=>{const p=_profDe(m.id,v);return '<td style="background:'+PROF_COR_PRINT[p]+'">'+PROF_ABREV[p]+'</td>';}).join('')+'</tr>').join('');
    return '<h3>'+_escHtml(lglabel)+' · '+mem.length+'</h3><table class="mtz"><thead><tr>'+head+'</tr></thead><tbody>'+rows+'</tbody></table>';
  }).join('');
  const legenda='<p class="leg">'+PROF_NIVEIS.map(p=>'<span style="background:'+PROF_COR_PRINT[p]+'">'+PROF_ABREV[p]+'</span> '+_escHtml(PROF_LABEL[p])).join(' &nbsp; ')+'</p>';

  // 4) Virtudes formadas por membro
  const virtudes = LIGAS_DEV.map(([lglabel,slugs])=>{
    const mem=_membrosDaLiga(slugs); if(!mem.length) return '';
    const rows=mem.map(m=>{ const vs=(m.competencias_desenvolvidas||[]).map(s=>compMap[s]||s).map(_escHtml);
      return '<tr><td class="nm">'+_escHtml(_nome(m))+'</td><td>'+(vs.length?vs.join(', '):'—')+'</td></tr>'; }).join('');
    return '<h3>'+_escHtml(lglabel)+'</h3><table class="virt"><tbody>'+rows+'</tbody></table>';
  }).join('');

  const css = '<style>'
    + '*{ -webkit-print-color-adjust:exact; print-color-adjust:exact; box-sizing:border-box; }'
    + 'body{ font-family:Georgia,serif; color:#1c1c1c; margin:0; padding:18px; }'
    + 'h1{ font-size:20px; margin:0; } h2{ font-size:15px; border-bottom:2px solid #8a6a24; color:#7a5a14; margin:22px 0 8px; }'
    + 'h3{ font-size:12px; margin:12px 0 4px; color:#333; }'
    + '.hd{ display:flex; align-items:center; gap:12px; border-bottom:3px solid #8a6a24; padding-bottom:10px; }'
    + '.hd img{ height:54px; } .hd .sub{ font-size:11px; color:#666; }'
    + 'table{ border-collapse:collapse; width:100%; font-size:11px; } th,td{ border:1px solid #bbb; padding:3px 6px; text-align:center; }'
    + 'table.mtz td.nm, table.virt td.nm{ text-align:left; white-space:nowrap; } table.virt td{ text-align:left; }'
    + '.cob th,.cob td{ text-align:center; } .cob td:first-child{ text-align:left; }'
    + 'tr.warn td{ font-weight:bold; color:#b00; }'
    + '.dev{ margin:6px 0; font-size:12px; } .muted{ color:#777; font-size:11px; } .leg span{ display:inline-block; padding:1px 6px; border:1px solid #bbb; border-radius:3px; }'
    + '@page{ margin:12mm; }'
    + '</style>';
  const cab = '<div class="hd"><img src="'+location.origin+'/midia/logos/brasao-pastoral.png" onerror="this.style.display=\'none\'"><div><h1>Relatório de Desenvolvimento</h1><div class="sub">Acólitos · '+hoje+' · '+total+' membros ativos</div></div></div>';
  const html = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório de Desenvolvimento</title>'+css+'</head><body>'
    + cab
    + '<h2>1. Cobertura por função</h2><table class="cob"><thead><tr><th>Função</th><th>Prontos</th><th>Em formação</th><th>Zero</th></tr></thead><tbody>'+linhasCob+'</tbody></table>'
    + '<h2>2. A desenvolver (funções escassas)</h2>'+blocosDev
    + '<h2>3. Matriz de proficiência</h2>'+legenda+matriz
    + '<h2>4. Virtudes formadas</h2>'+virtudes
    + '</body></html>';
  w.document.write(html); w.document.close(); w.focus();
  setTimeout(()=>{ try{ w.print(); }catch(e){} }, 350);
}

function baixarRelatorioCSV(){
  const SEP=';';
  const esc=s=>{ s=String(s==null?'':s); return /[";\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s; };
  const head=['Liga','Membro'].concat(_devFuncoes.map(([,l])=>l)).map(esc).join(SEP);
  const linhas=[head];
  LIGAS_DEV.forEach(([lglabel,slugs])=>{
    _membrosDaLiga(slugs).forEach(m=>{
      const cols=[lglabel.replace(/^[^\w]+\s*/,''), _nome(m)].concat(_devFuncoes.map(([v])=>PROF_LABEL[_profDe(m.id,v)]));
      linhas.push(cols.map(esc).join(SEP));
    });
  });
  const csv='﻿'+linhas.join('\r\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob); const a=document.createElement('a');
  a.href=url; a.download='desenvolvimento-'+new Date().toISOString().slice(0,10)+'.csv'; a.click();
  URL.revokeObjectURL(url); toast('✓ CSV gerado');
}
```

- [ ] **Step 2: Validar sintaxe** (comando acima). Expected: `OK`.

- [ ] **Step 3: Commit**
```bash
git add projetos/acolitos/jornada-admin.html
git commit -m "feat(acolitos): relatório de desenvolvimento — PDF (janela) + CSV da matriz

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Botões no cabeçalho do Mapa

**Files:** Modify `projetos/acolitos/jornada-admin.html`

- [ ] **Step 1: Trocar o cabeçalho `mh` (l.430) por um header flex com título + 2 botões**

Trocar:
```js
  const mh = document.createElement('div'); mh.style.cssText = 'font-family:Sora,sans-serif;font-weight:700;font-size:13px;color:var(--gold);margin-bottom:8px;'; mh.textContent = '🗺 Mapa de Cobertura'; mapaSec.appendChild(mh);
```
por:
```js
  const mh = document.createElement('div'); mh.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap;';
  const mhT = document.createElement('span'); mhT.style.cssText = 'font-family:Sora,sans-serif;font-weight:700;font-size:13px;color:var(--gold);flex:1;'; mhT.textContent = '🗺 Mapa de Cobertura';
  const btnRel = (txt, fn) => { const b=document.createElement('button'); b.type='button'; b.textContent=txt; b.style.cssText='font-family:Oxanium,sans-serif;font-weight:700;font-size:11px;padding:5px 10px;border-radius:6px;cursor:pointer;background:transparent;border:1px solid var(--gold-dim);color:var(--gold-light);'; b.onclick=fn; return b; };
  mh.append(mhT, btnRel('🖨 Imprimir/PDF', gerarRelatorioPDF), btnRel('⬇️ CSV', baixarRelatorioCSV)); mapaSec.appendChild(mh);
```

- [ ] **Step 2: Validar sintaxe** (comando acima). Expected: `OK`.

- [ ] **Step 3: Commit + deploy do root**
```bash
git add projetos/acolitos/jornada-admin.html
git commit -m "feat(acolitos): botões Imprimir/PDF e CSV no Mapa de Cobertura

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
cd /Users/erickmartins/iajcbp && pwd   # precisa ser /Users/erickmartins/iajcbp
git push origin main
vercel --prod --yes   # deve sair iajcbp-...
```

- [ ] **Step 4: Validação (humano) no deploy**

Jornada → Desenvolvimento: **🖨 Imprimir/PDF** abre janela formatada com brasão + 4 seções (cobertura, a desenvolver, matriz colorida por liga com legenda, virtudes formadas) e abre a prévia de impressão. **⬇️ CSV** baixa `desenvolvimento-AAAA-MM-DD.csv` e abre no Excel/Sheets com acentos certos e colunas por função. Testar com pop-ups permitidos.

---

## Self-Review (preenchido)

**1. Spec coverage:**
- Cobertura por função (escassez, ⚠<3) → Task 2 seção 1 ✅
- A desenvolver (em formação nominal + contagem não-treinados, só escassas) → Task 2 seção 2 ✅
- Matriz por liga (abreviação + cor print-safe + legenda) → Task 2 seção 3 ✅
- Virtudes formadas por membro (de competencias_desenvolvidas) → Task 2 seção 4 ✅
- PDF via janela + CSV da matriz → Task 2 ✅
- Botões no Mapa → Task 3 ✅
- Sem banco/deps; bordas (popup bloqueado, brasão ausente, cor na impressão) → ✅

**2. Placeholder scan:** sem TBD/TODO; código completo.

**3. Type consistency:** helpers `_profDe/_membrosComProf/_membrosDaLiga/_compLabelMap/_nome/_escHtml`, maps `PROF_ABREV/PROF_COR_PRINT`, e `gerarRelatorioPDF/baixarRelatorioCSV` consistentes entre tasks; todos no nível de módulo, usando globais já existentes (`_devMembros`, `_devFuncoes`, `_devComps`, `habAll`, `bucketsFuncao`, `LIGAS_DEV`, `PROF_LABEL`, `PROF_NIVEIS`, `toast`).

**Risco:** os botões (Task 3) referenciam `gerarRelatorioPDF`/`baixarRelatorioCSV` (declarações de função de módulo, hoisted) — ok mesmo definidas depois no arquivo.
