# Mapa de Cobertura (módulo Desenvolvimento) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar à aba Desenvolvimento (`jornada-admin.html`) um mapa de cobertura — resumo por função (escassez) + matriz membros×funções colapsável — com edição rápida de proficiência que salva direto.

**Architecture:** Tudo dentro de `projetos/acolitos/jornada-admin.html` (já roda como coordenação, lê/escreve `acolitos_habilitacoes` direto). Uma carga única traz todas as habilitações para `habAll[membro][funcao]` em memória; resumo, matriz e modal desenham a partir desse estado; toda edição faz `upsert` e atualiza o estado, redesenhando localmente. Desenvolve-se primeiro num lab (`mapa-cobertura-lab.html`) com dados reais, depois porta-se para o app.

**Tech Stack:** HTML estático, JS vanilla, supabase-js (via `shared.js`), Supabase (ref `fttjgsotuosjfrasttds`).

---

## Contexto técnico (ler antes de começar)

Helpers/constantes JÁ existentes em `jornada-admin.html` que o código reusa:
- `sb` — client supabase (de `shared.js`).
- `_devMembros` — array de membros ativos `{id,nome,apelido,nivel,foto_url,...}` (carregado por `carregarDev()`, ~l.303).
- `_devFuncoes` — array `[[valor,label],...]` de funções (default + customizadas), ~l.310.
- `PROF_NIVEIS = ['nao_treinado','em_formacao','apto','experiente','referencia']` (l.300).
- `PROF_LABEL = {nao_treinado:'Não Treinado',...}` (l.301).
- `nivelInfo(slug)` → `{label,...}`; `NIVEIS` (array de níveis); `buildAvatarEl(...)`; `toast(msg,tipo)`; `semAcento(s)`.
- Cores de proficiência (CSS já no `<style>`, l.31-35): classes `.hab-card.<nivel>` com `border-color`. Para células coloridas usamos um map de cor próprio (abaixo).
- `LIGAS` (definido dentro de `renderDesenvolvimento`, l.325-329): `[[label,[slugs...]],...]`.
- `abrirFuncoesEditor(m)` (l.471): exemplo do `upsert` em `acolitos_habilitacoes` com `onConflict:'membro_id,funcao'`.

`renderDesenvolvimento(main)` vive em ~l.313-369. O mapa entra logo após o subtítulo (l.316), antes do `card` de filtros/cards por liga.

Cor por proficiência (usar em todo o componente):
```js
const PROF_COR = { nao_treinado:'transparent', em_formacao:'#d4a060', apto:'var(--success)', experiente:'#4a90c4', referencia:'#9b59d4' };
```

Convenção de commit (repo já usa): mensagens em PT, terminar com
`Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Commitar na `main`
(convenção do projeto). NÃO deployar como parte deste plano (deploy é decisão
à parte; quando for, do root do repo).

Verificação de sintaxe (sem framework de teste) — rodar da raiz do repo:
```bash
node -e "const fs=require('fs');const h=fs.readFileSync('projetos/acolitos/jornada-admin.html','utf8');const m=h.match(/<script>([\s\S]*?)<\/script>/g)||[];let i=0,ok=true;for(const s of m){const c=s.replace(/^<script>/,'').replace(/<\/script>$/,'');try{new Function(c);}catch(e){ok=false;console.log('ERRO bloco',i,':',e.message);}i++;}console.log(ok?'sintaxe OK ('+m.length+' blocos)':'FALHOU');"
```

---

## File Structure

- Create (temporário): `projetos/acolitos/mapa-cobertura-lab.html` — página de staging que reusa `shared.js`, carrega os dados reais e renderiza o componente isolado para validação visual. Removida na Task 6.
- Modify: `projetos/acolitos/jornada-admin.html` — adiciona estado `habAll`, helpers (`carregarHabAll`, `bucketsFuncao`, `salvarProficiencia`), e funções de render (`renderCobertura`, `abrirCoberturaFuncao`, `renderMatriz`), e a chamada dentro de `renderDesenvolvimento`.

---

## Task 1: Lab de staging — carga de dados e dump

**Files:**
- Create: `projetos/acolitos/mapa-cobertura-lab.html`

- [ ] **Step 1: Criar o lab que carrega membros, funções e TODAS as habilitações e mostra um resumo bruto**

Criar `projetos/acolitos/mapa-cobertura-lab.html`:

```html
<!doctype html>
<html lang="pt-BR" data-theme="dark">
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Lab — Mapa de Cobertura</title>
  <link rel="stylesheet" href="shared.css">
  <style>
    body{padding:16px;font-family:Inter,sans-serif;color:var(--text);background:var(--bg);}
    #out{margin-top:14px;}
  </style>
</head>
<body>
  <h1 style="font-family:Sora,sans-serif;color:var(--gold);font-size:16px;">Lab — Mapa de Cobertura</h1>
  <div id="out"><span class="loading">Carregando…</span></div>
  <script src="shared.js"></script>
  <script>
    const PROF_NIVEIS = ['nao_treinado','em_formacao','apto','experiente','referencia'];
    const PROF_LABEL = { nao_treinado:'Não Treinado', em_formacao:'Em Formação', apto:'Apto', experiente:'Experiente', referencia:'Referência' };
    const PROF_COR = { nao_treinado:'transparent', em_formacao:'#d4a060', apto:'var(--success)', experiente:'#4a90c4', referencia:'#9b59d4' };
    const FUNCOES_DEFAULT_DEV = [['apoio','Apoio'],['cruz','Cruz'],['vela','Vela'],['sineta','Sineta'],['sinao','Sinão'],['altar','Altar'],['turibulo','Turíbulo'],['naveta','Naveta'],['missal','Missal'],['cred_altar','Cerimoniário Altar'],['cred_credencia','Cerimoniário Credência'],['mitra','Mitra'],['baculo','Báculo']];
    let _devMembros=[], _devFuncoes=[], habAll={};
    async function carregar(){
      await initModulo(); // garante sessão/contexto da coordenação
      const [{data:mems},{data:listas},{data:habs}] = await Promise.all([
        sb.from('acolitos_membros').select('id,nome,apelido,nivel,foto_url').eq('status','ativo').order('nome'),
        sb.from('acolitos_listas').select('valor,label,tipo').eq('tipo','funcao'),
        sb.from('acolitos_habilitacoes').select('membro_id,funcao,proficiencia')
      ]);
      _devMembros = mems||[];
      _devFuncoes = FUNCOES_DEFAULT_DEV.concat((listas||[]).map(l=>[l.valor,l.label||l.valor]));
      habAll = {}; (habs||[]).forEach(h=>{ (habAll[h.membro_id]=habAll[h.membro_id]||{})[h.funcao]=h.proficiencia; });
    }
    function bucketsFuncao(funcao){
      let prontos=0,form=0;
      _devMembros.forEach(m=>{ const p=(habAll[m.id]||{})[funcao];
        if(p==='apto'||p==='experiente'||p==='referencia') prontos++;
        else if(p==='em_formacao') form++; });
      return { prontos, form, zero:_devMembros.length-prontos-form };
    }
    (async()=>{
      await carregar();
      const out=document.getElementById('out'); out.textContent='';
      const pre=document.createElement('pre'); pre.style.cssText='font-size:12px;white-space:pre-wrap;';
      pre.textContent = 'membros ativos: '+_devMembros.length+'\nfunções: '+_devFuncoes.length+'\n\n'+
        _devFuncoes.map(([v,l])=>{ const b=bucketsFuncao(v); return l.padEnd(22)+' prontos='+b.prontos+' form='+b.form+' zero='+b.zero; }).join('\n');
      out.appendChild(pre);
    })();
  </script>
</body>
</html>
```

- [ ] **Step 2: Validar sintaxe do lab**

Run:
```bash
node -e "const fs=require('fs');const h=fs.readFileSync('projetos/acolitos/mapa-cobertura-lab.html','utf8');const m=h.match(/<script>([\s\S]*?)<\/script>/g)||[];let ok=true;m.forEach((s,i)=>{try{new Function(s.replace(/^<script>/,'').replace(/<\/script>$/,''));}catch(e){ok=false;console.log('ERRO',i,e.message);}});console.log(ok?'OK':'FALHOU');"
```
Expected: `OK`

- [ ] **Step 3: Validação visual (humano)**

Abrir o lab logado como coordenação (via servidor local ou deploy de preview) e confirmar que os números de prontos/form/zero por função fazem sentido (ex.: Turíbulo com poucos prontos). Referência de sanidade vinda do banco: 169 membros ativos.

- [ ] **Step 4: Commit**

```bash
git add projetos/acolitos/mapa-cobertura-lab.html
git commit -m "wip(acolitos): lab do mapa de cobertura — carga + buckets

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Resumo por função no lab (renderCobertura + salvarProficiencia)

**Files:**
- Modify: `projetos/acolitos/mapa-cobertura-lab.html`

- [ ] **Step 1: Adicionar `salvarProficiencia` e `renderCobertura` ao `<script>` do lab**

Inserir antes do IIFE final (`(async()=>{`):

```js
// grava 1 proficiência, atualiza estado em memória e redesenha
async function salvarProficiencia(membroId, funcao, nivel, onOk){
  const { error } = await sb.from('acolitos_habilitacoes')
    .upsert([{ membro_id:membroId, funcao, proficiencia:nivel, updated_at:new Date().toISOString() }], { onConflict:'membro_id,funcao' });
  if(error){ toast('Erro ao salvar.','error'); return false; }
  (habAll[membroId]=habAll[membroId]||{})[funcao]=nivel;
  toast('✓ Salvo'); if(onOk) onOk(); return true;
}
// resumo: uma linha por função, ordenado por escassez (menos prontos primeiro)
function renderCobertura(container, onChanged){
  container.textContent='';
  const ordenadas = _devFuncoes.slice().sort((a,b)=> bucketsFuncao(a[0]).prontos - bucketsFuncao(b[0]).prontos);
  const total=_devMembros.length||1;
  ordenadas.forEach(([val,label])=>{
    const b=bucketsFuncao(val);
    const row=document.createElement('div'); row.style.cssText='display:flex;align-items:center;gap:10px;padding:7px 4px;border-bottom:1px solid var(--border);cursor:pointer;';
    row.onclick=()=>abrirCoberturaFuncao(val,label,onChanged);
    const nm=document.createElement('div'); nm.style.cssText='flex:1.4;min-width:0;font-size:13px;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
    nm.textContent=(b.prontos<3?'⚠ ':'')+label;
    if(b.prontos<3) nm.style.color='var(--danger-text)';
    const bar=document.createElement('div'); bar.style.cssText='flex:2;display:flex;height:12px;border-radius:6px;overflow:hidden;background:var(--surface2);';
    const seg=(n,cor)=>{ if(!n) return; const s=document.createElement('div'); s.style.cssText='height:100%;background:'+cor+';flex:'+n+' 0 0;'; bar.appendChild(s); };
    seg(b.prontos, PROF_COR.apto); seg(b.form, PROF_COR.em_formacao); seg(b.zero, 'var(--border)');
    const cnt=document.createElement('div'); cnt.style.cssText='flex:1;text-align:right;font-size:11px;color:var(--text-muted);white-space:nowrap;';
    cnt.innerHTML='<b style="color:var(--success-text)">'+b.prontos+'</b> · '+b.form+' · '+b.zero;
    row.append(nm,bar,cnt); container.appendChild(row);
  });
}
```

- [ ] **Step 2: Stub temporário de `abrirCoberturaFuncao` (substituído na Task 3)**

Adicionar logo abaixo (para o lab rodar antes da Task 3):

```js
function abrirCoberturaFuncao(val,label,onChanged){ alert('drill-down: '+label+' (Task 3)'); }
```

- [ ] **Step 3: Trocar o IIFE final para chamar `renderCobertura`**

Substituir o corpo do `(async()=>{ ... })()` por:

```js
(async()=>{
  await carregar();
  const out=document.getElementById('out'); out.textContent='';
  renderCobertura(out, ()=>renderCobertura(out, arguments.callee));
})();
```
(Se `arguments.callee` falhar em strict, usar uma função nomeada: `async function go(){ await carregar(); const out=$('out')... } go();` — definir `redraw=()=>renderCobertura(out,redraw)`.)

Versão robusta a usar:
```js
async function go(){
  await carregar();
  const out=document.getElementById('out'); out.textContent='';
  const redraw=()=>renderCobertura(out, redraw);
  redraw();
}
go();
```

- [ ] **Step 4: Validar sintaxe**

Run: (mesmo comando do Task 1 Step 2)
Expected: `OK`

- [ ] **Step 5: Validação visual (humano)**

Abrir o lab: confirmar barras empilhadas, ordenação por escassez (funções com menos prontos no topo), ⚠ nas com prontos<3.

- [ ] **Step 6: Commit**

```bash
git add projetos/acolitos/mapa-cobertura-lab.html
git commit -m "wip(acolitos): resumo por função + salvarProficiencia no lab

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Modal drill-down com edição inline (abrirCoberturaFuncao)

**Files:**
- Modify: `projetos/acolitos/mapa-cobertura-lab.html`

- [ ] **Step 1: Substituir o stub `abrirCoberturaFuncao` pela versão real**

Trocar a linha do stub (Task 2 Step 2) por:

```js
function abrirCoberturaFuncao(funcao, label, onChanged){
  const ov=document.createElement('div'); ov.className='modal-overlay open'; ov.onclick=e=>{ if(e.target===ov){ ov.remove(); if(onChanged) onChanged(); } };
  const md=document.createElement('div'); md.className='modal'; md.style.maxWidth='460px';
  const tt=document.createElement('div'); tt.className='modal-title'; tt.textContent='Cobertura — '+label; md.appendChild(tt);
  const sub=document.createElement('p'); sub.style.cssText='font-size:12px;color:var(--text-muted);margin:-6px 0 10px;'; sub.textContent='Ajuste a proficiência. Apto ou mais = pronto para a função.'; md.appendChild(sub);
  const box=document.createElement('div'); box.style.cssText='max-height:60vh;overflow-y:auto;'; md.appendChild(box);
  const rank=p=>({nao_treinado:0,em_formacao:1,apto:2,experiente:3,referencia:4})[p||'nao_treinado'];
  const ordenados=_devMembros.slice().sort((a,b)=> rank((habAll[a.id]||{})[funcao]) - rank((habAll[b.id]||{})[funcao]));
  ordenados.forEach(m=>{
    const cur=(habAll[m.id]||{})[funcao]||'nao_treinado';
    const r=document.createElement('div'); r.style.cssText='display:flex;align-items:center;gap:10px;padding:8px 2px;border-bottom:1px solid var(--border);';
    const dot=document.createElement('span'); dot.style.cssText='width:10px;height:10px;border-radius:50%;flex:none;background:'+(PROF_COR[cur]==='transparent'?'var(--border)':PROF_COR[cur])+';';
    const nm=document.createElement('span'); nm.style.cssText='flex:1;min-width:0;font-size:13px;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;'; nm.textContent=m.apelido||m.nome;
    const sel=document.createElement('select'); sel.className='hab-sel'; sel.style.cssText='width:auto;flex:none;';
    PROF_NIVEIS.forEach(n=>{ const o=document.createElement('option'); o.value=n; o.textContent=PROF_LABEL[n]; if(n===cur)o.selected=true; sel.appendChild(o); });
    sel.onchange=async()=>{ const ok=await salvarProficiencia(m.id,funcao,sel.value); if(ok){ dot.style.background=(PROF_COR[sel.value]==='transparent'?'var(--border)':PROF_COR[sel.value]); } };
    r.append(dot,nm,sel); box.appendChild(r);
  });
  const close=document.createElement('button'); close.className='btn-sm gray'; close.style.cssText='width:100%;margin-top:14px;'; close.textContent='Fechar'; close.onclick=()=>{ ov.remove(); if(onChanged) onChanged(); };
  md.appendChild(close); ov.appendChild(md); document.body.appendChild(ov);
}
```

- [ ] **Step 2: Validar sintaxe**

Run: (comando do Task 1 Step 2) — Expected: `OK`

- [ ] **Step 3: Validação visual (humano)**

Abrir o lab → clicar numa função → o modal lista membros ordenados (menos aptos primeiro), trocar a proficiência de uma **linha descartável** salva e atualiza o dot; ao fechar, o resumo reflete a nova contagem. (Regra: não alterar dados de contas reais sensíveis — usar membro de teste.)

- [ ] **Step 4: Commit**

```bash
git add projetos/acolitos/mapa-cobertura-lab.html
git commit -m "wip(acolitos): drill-down por função com edição inline no lab

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Matriz membros×funções com edição por célula (renderMatriz)

**Files:**
- Modify: `projetos/acolitos/mapa-cobertura-lab.html`

- [ ] **Step 1: Adicionar `LIGAS` e `renderMatriz` ao `<script>` do lab**

Inserir antes do IIFE/`go()`:

```js
const LIGAS = [
  ['🟢 Iniciantes', ['aspirante','coroinha','acolito_aspirante']],
  ['🔵 Acólitos', ['acolito_guardiao','acolito_sentinela']],
  ['🟣 Cerimoniários', ['aspirante_cerimoniario','cerimoniario_aspirante','cerimoniario_guardiao','cerimoniario_magistral','cerimoniario_mor']]
];
function renderMatriz(container){
  container.textContent='';
  const wrap=document.createElement('div'); wrap.style.cssText='overflow-x:auto;border:1px solid var(--border);border-radius:8px;';
  const tbl=document.createElement('table'); tbl.style.cssText='border-collapse:collapse;font-size:11px;min-width:100%;';
  // cabeçalho
  const thead=document.createElement('thead'); const htr=document.createElement('tr');
  const corner=document.createElement('th'); corner.textContent='Membro';
  corner.style.cssText='position:sticky;left:0;z-index:2;background:var(--surface2);color:var(--gold);text-align:left;padding:6px 8px;border-bottom:1px solid var(--border);min-width:120px;';
  htr.appendChild(corner);
  _devFuncoes.forEach(([val,label])=>{ const th=document.createElement('th'); th.textContent=label.length>4?label.slice(0,4):label; th.title=label; th.style.cssText='padding:6px 4px;color:var(--text-muted);border-bottom:1px solid var(--border);white-space:nowrap;'; htr.appendChild(th); });
  thead.appendChild(htr); tbl.appendChild(thead);
  const tbody=document.createElement('tbody');
  LIGAS.forEach(([lglabel,slugs])=>{
    const membros=_devMembros.filter(m=>slugs.includes(m.nivel||'aspirante'));
    if(!membros.length) return;
    const sep=document.createElement('tr'); const sc=document.createElement('td'); sc.colSpan=_devFuncoes.length+1;
    sc.textContent=lglabel+' · '+membros.length; sc.style.cssText='position:sticky;left:0;background:var(--surface);color:var(--gold);font-family:Sora,sans-serif;font-weight:700;padding:6px 8px;border-bottom:1px solid var(--border-wine);';
    sep.appendChild(sc); tbody.appendChild(sep);
    membros.forEach(m=>{
      const tr=document.createElement('tr');
      const nmtd=document.createElement('td'); nmtd.textContent=m.apelido||m.nome;
      nmtd.style.cssText='position:sticky;left:0;z-index:1;background:var(--surface2);color:var(--text);padding:5px 8px;border-bottom:1px solid var(--border);white-space:nowrap;max-width:140px;overflow:hidden;text-overflow:ellipsis;';
      tr.appendChild(nmtd);
      _devFuncoes.forEach(([val])=>{
        const cur=(habAll[m.id]||{})[val]||'nao_treinado';
        const td=document.createElement('td'); td.style.cssText='text-align:center;border-bottom:1px solid var(--border);padding:0;';
        const cell=document.createElement('div'); cell.style.cssText='width:24px;height:22px;margin:2px auto;border-radius:4px;cursor:pointer;background:'+(PROF_COR[cur]==='transparent'?'transparent':PROF_COR[cur])+';border:1px solid var(--border);';
        cell.title=(m.apelido||m.nome)+' — '+PROF_LABEL[cur];
        cell.onclick=()=>editarCelula(td, cell, m, val);
        td.appendChild(cell); tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
  });
  tbl.appendChild(tbody); wrap.appendChild(tbl); container.appendChild(wrap);
}
function editarCelula(td, cell, m, funcao){
  if(td.querySelector('select')) return;
  const cur=(habAll[m.id]||{})[funcao]||'nao_treinado';
  const sel=document.createElement('select'); sel.className='hab-sel'; sel.style.cssText='width:auto;font-size:10px;';
  PROF_NIVEIS.forEach(n=>{ const o=document.createElement('option'); o.value=n; o.textContent=PROF_LABEL[n]; if(n===cur)o.selected=true; sel.appendChild(o); });
  cell.style.display='none'; td.appendChild(sel); sel.focus();
  const fechar=()=>{ sel.remove(); cell.style.display=''; };
  sel.onchange=async()=>{ const ok=await salvarProficiencia(m.id,funcao,sel.value); if(ok){ const c=PROF_COR[sel.value]; cell.style.background=(c==='transparent'?'transparent':c); cell.title=(m.apelido||m.nome)+' — '+PROF_LABEL[sel.value]; } fechar(); };
  sel.onblur=fechar;
}
```

- [ ] **Step 2: Renderizar a matriz no lab (adicionar um segundo container)**

No HTML do lab, após `<div id="out">…</div>`, adicionar:
```html
  <h2 style="font-family:Sora,sans-serif;color:var(--gold);font-size:14px;margin-top:20px;">Matriz</h2>
  <div id="mtz"></div>
```
E em `go()`, depois do `redraw()`:
```js
  renderMatriz(document.getElementById('mtz'));
```

- [ ] **Step 3: Validar sintaxe**

Run: (comando do Task 1 Step 2) — Expected: `OK`

- [ ] **Step 4: Validação visual (humano)**

Abrir o lab: matriz agrupada por liga, coluna de nome fixa ao rolar horizontalmente, células coloridas; clicar numa célula de **membro de teste** vira select, salvar recolore. Conferir em viewport estreita (mobile) que o scroll horizontal funciona.

- [ ] **Step 5: Commit**

```bash
git add projetos/acolitos/mapa-cobertura-lab.html
git commit -m "wip(acolitos): matriz membros×funções com edição por célula no lab

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Costurar resumo↔matriz (edição num reflete no outro)

**Files:**
- Modify: `projetos/acolitos/mapa-cobertura-lab.html`

- [ ] **Step 1: Fazer `salvarProficiencia` aceitar um redraw global e ligar os dois componentes**

Em `go()`, criar um redraw que redesenha ambos e passá-lo onde há edição:

```js
async function go(){
  await carregar();
  const out=document.getElementById('out'); const mtz=document.getElementById('mtz');
  const redrawTudo=()=>{ renderCobertura(out, ()=>redrawTudo()); renderMatriz(mtz); };
  redrawTudo();
}
go();
```

E em `editarCelula`, após salvar com sucesso, atualizar também os números do resumo. Trocar o `sel.onchange` de `editarCelula` por:
```js
  sel.onchange=async()=>{ const ok=await salvarProficiencia(m.id,funcao,sel.value); if(ok){ const c=PROF_COR[sel.value]; cell.style.background=(c==='transparent'?'transparent':c); cell.title=(m.apelido||m.nome)+' — '+PROF_LABEL[sel.value]; const out=document.getElementById('out'); if(out) renderCobertura(out, ()=>document.getElementById('mtz') && (renderCobertura(out,()=>{}), renderMatriz(document.getElementById('mtz')))); } fechar(); };
```
(Simplificação aceitável: após editar célula, chamar `renderCobertura(out, reabreModalRedraw)` para atualizar contagens; a matriz já se auto-atualiza pela recoloração da célula.)

Versão limpa recomendada — expor um `window`-less closure: definir no topo de `go()` um `redrawResumo=()=>renderCobertura(out, ...)` e referenciá-lo em `editarCelula` via parâmetro. Para o lab, basta `renderCobertura(document.getElementById('out'), ()=>{})` após a edição.

- [ ] **Step 2: Validar sintaxe**

Run: (comando do Task 1 Step 2) — Expected: `OK`

- [ ] **Step 3: Validação visual (humano)**

Editar uma célula na matriz → as contagens do resumo (prontos/form/zero) mudam. Editar no modal do resumo → ao fechar, a matriz reflete a cor nova. (Usar membro de teste.)

- [ ] **Step 4: Commit**

```bash
git add projetos/acolitos/mapa-cobertura-lab.html
git commit -m "wip(acolitos): sincroniza resumo e matriz após edição (lab)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Portar para jornada-admin.html e remover o lab

**Files:**
- Modify: `projetos/acolitos/jornada-admin.html`
- Delete: `projetos/acolitos/mapa-cobertura-lab.html`

- [ ] **Step 1: Adicionar `PROF_COR`, `habAll`, `carregarHabAll`, `bucketsFuncao`, `salvarProficiencia`, `renderCobertura`, `abrirCoberturaFuncao`, `renderMatriz` ao `<script>` de `jornada-admin.html`**

Inserir o bloco de funções (as versões validadas no lab) logo após a definição de `PROF_LABEL` (l.301). Diferenças em relação ao lab:
- NÃO redefinir `PROF_NIVEIS`/`PROF_LABEL`/`FUNCOES_DEFAULT_DEV`/`LIGAS`/`_devMembros`/`_devFuncoes` (já existem no arquivo). Usar os existentes.
- Adicionar só: `const PROF_COR = {...}`, `let habAll = {}`, e `async function carregarHabAll(){ const {data:habs}=await sb.from('acolitos_habilitacoes').select('membro_id,funcao,proficiencia'); habAll={}; (habs||[]).forEach(h=>{(habAll[h.membro_id]=habAll[h.membro_id]||{})[h.funcao]=h.proficiencia;}); }`.
- Colar `bucketsFuncao`, `salvarProficiencia`, `renderCobertura`, `abrirCoberturaFuncao`, `renderMatriz`, `editarCelula` exatamente como validados.
- `LIGAS` já existe DENTRO de `renderDesenvolvimento` (l.325). Para `renderMatriz` enxergá-lo, mover `LIGAS` para o escopo do módulo (top-level no `<script>`, antes de `renderDesenvolvimento`) e remover a redeclaração local em `renderDesenvolvimento` (senão dá `SyntaxError`/sombra). ⚠️ Conferir que não há outra `const LIGAS` no arquivo (evitar colisão de globais — ver memória de colisões).

- [ ] **Step 2: Chamar a carga e o render dentro de `renderDesenvolvimento`**

Em `renderDesenvolvimento` (após o `sub` da l.316, antes do `card` de filtros l.317), inserir:

```js
  await carregarHabAll();
  const mapaSec = document.createElement('div'); mapaSec.className='mx-card'; mapaSec.style.marginBottom='14px';
  const mh = document.createElement('div'); mh.style.cssText='font-family:Sora,sans-serif;font-weight:700;font-size:13px;color:var(--gold);margin-bottom:8px;'; mh.textContent='🗺 Mapa de Cobertura'; mapaSec.appendChild(mh);
  const resumoBox = document.createElement('div'); mapaSec.appendChild(resumoBox);
  // matriz colapsável (fechada por padrão)
  const toggle = document.createElement('div'); toggle.style.cssText='cursor:pointer;font-family:Sora,sans-serif;font-weight:700;font-size:12px;color:var(--gold-light);margin-top:12px;'; 
  const matrizBox = document.createElement('div'); matrizBox.style.display='none'; matrizBox.style.marginTop='10px';
  let matrizAberta=false, matrizDesenhada=false;
  const setToggle=()=>{ toggle.textContent=(matrizAberta?'▾':'▸')+' Matriz completa'; };
  toggle.onclick=()=>{ matrizAberta=!matrizAberta; matrizBox.style.display=matrizAberta?'':'none'; if(matrizAberta && !matrizDesenhada){ renderMatriz(matrizBox); matrizDesenhada=true; } setToggle(); };
  setToggle();
  const redrawResumo=()=>renderCobertura(resumoBox, ()=>{ redrawResumo(); if(matrizDesenhada) renderMatriz(matrizBox); });
  redrawResumo();
  mapaSec.append(toggle, matrizBox); main.appendChild(mapaSec);
```

E em `editarCelula` (no app), após salvar com sucesso, atualizar o resumo: como `resumoBox` é local de `renderDesenvolvimento`, expor um redraw via variável de módulo. Adicionar no topo do `<script>`: `let _redrawCobertura=null;`. Em `renderDesenvolvimento`, após definir `redrawResumo`, fazer `_redrawCobertura=redrawResumo;`. Em `editarCelula`, após sucesso: `if(_redrawCobertura) _redrawCobertura();`.

- [ ] **Step 3: Validar sintaxe de `jornada-admin.html`**

Run:
```bash
node -e "const fs=require('fs');const h=fs.readFileSync('projetos/acolitos/jornada-admin.html','utf8');const m=h.match(/<script>([\s\S]*?)<\/script>/g)||[];let ok=true;m.forEach((s,i)=>{try{new Function(s.replace(/^<script>/,'').replace(/<\/script>$/,''));}catch(e){ok=false;console.log('ERRO',i,e.message);}});console.log(ok?'sintaxe OK':'FALHOU');"
```
Expected: `sintaxe OK`

- [ ] **Step 4: Validação visual (humano) no app real**

Abrir `jornada-admin.html` (logado como coordenação) → aba Desenvolvimento: o Mapa de Cobertura aparece no topo (resumo ordenado por escassez), "Matriz completa" expande/recolhe, edição no resumo e na matriz salva e sincroniza. Confirmar que os cards por liga e a lista de competências (que já existiam) continuam funcionando abaixo.

- [ ] **Step 5: Remover o lab e commitar a feature**

```bash
git rm projetos/acolitos/mapa-cobertura-lab.html
git add projetos/acolitos/jornada-admin.html
git commit -m "feat(acolitos): mapa de cobertura na aba Desenvolvimento

Resumo por função (escassez + ⚠ <3 prontos) e matriz membros×funções
colapsável, com edição rápida de proficiência que salva direto em
acolitos_habilitacoes e sincroniza resumo↔matriz. Remove o lab de staging.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review (preenchido)

**1. Spec coverage:**
- Resumo por função + escassez + ⚠ → Task 2 ✅
- Drill-down com edição inline → Task 3 ✅
- Matriz colapsável, sticky, scroll, cor por proficiência → Task 4 + Task 6 Step 2 ✅
- Edição rápida compartilhada (`salvarProficiencia`, upsert onConflict) → Task 2 Step 1 ✅
- Carga única `habAll` + redesenho local → Task 1 + Task 5 + Task 6 ✅
- Sincronização resumo↔matriz → Task 5 / Task 6 Step 2 ✅
- Proficiência global (sem comunidade), sem notificar membro → respeitado (nenhuma notificação; sem filtro de comunidade) ✅
- Validar em staging antes do app → Tasks 1-5 no lab; Task 6 porta e remove ✅
- Fora de escopo (plano de competências, export) → não incluído ✅

**2. Placeholder scan:** sem TBD/TODO; todo passo de código tem o código. Task 5 Step 1 oferece versão "limpa recomendada" explícita para evitar ambiguidade.

**3. Type consistency:** `habAll[membro][funcao]`, `bucketsFuncao(funcao)→{prontos,form,zero}`, `salvarProficiencia(membroId,funcao,nivel,onOk?)`, `renderCobertura(container,onChanged)`, `renderMatriz(container)`, `abrirCoberturaFuncao(funcao,label,onChanged)`, `editarCelula(td,cell,m,funcao)`, `PROF_COR` — nomes consistentes entre tasks. `LIGAS` movido para escopo de módulo (Task 6 Step 1) para `renderMatriz` enxergar.

**Risco conhecido:** colisão de `const LIGAS` (já existe local em `renderDesenvolvimento`) — Task 6 Step 1 trata explicitamente (mover para top-level, remover a local). Conferir também que `_redrawCobertura` não colide com outro global.
