# Melhorias na Escala (Acólitos) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Na tela de escala (`projetos/acolitos/escala.html`): alerta de irmão ao escolher nome, slots extras de função por setor, botão para registrar ausência, e modal mais largo.

**Architecture:** Tudo em `escala.html`. A renderização de uma posição é extraída para um builder aninhado em `montar()` (`criarPosicao`), reusado por posições do modelo e por slots extras; categorias ganham um container próprio com botão "+". O alerta de irmão e o registro de ausência são funções novas. Sem migration; grava em `acolitos_escalas` e `acolitos_ausencias` (já existentes).

**Tech Stack:** HTML estático, JS vanilla, supabase-js (via CDN no `escala.html`), Supabase (ref `fttjgsotuosjfrasttds`).

---

## Contexto técnico (ler antes)

Tudo dentro de `montar(celeb)` (~l.600-700) tem acesso por closure a: `membros`,
`esc` (linhas de `acolitos_escalas` desta celebração), `tmpl` (modelo:
`[{funcao,cat,label}]`), `ausNesta` (Set de membros ausentes), `dupSemana`,
`semanaPassada`, `habMap`, `dispMap`, `horKey`, `celeb`, `pendingEdicao`.
Por isso os novos builders (`criarPosicao`, `getCatBox`, `adicionarSlotExtra`,
`abrirMenuAddFuncao`, `checarIrmao`) são **aninhados em `montar`**.

Helpers globais já existentes: `FUNCAO_META` (l.263-286, `{label,cat,ordem}` por
função), `elegivelFuncao(m,funcao,comunidade)`, `trocarPosicao(pe)`, `toast(msg,tipo?)`,
`MOTIVO_LABEL`, `dataCurta(d)`, `celebracoes` (array global de celebrações
carregadas), `ausMap` (celebracao_id → Set de ausentes), `ctx`.
`salvarEscala()` (l.1025-1033) apaga e reinsere uma linha por `pe` com
`sel.value` — logo qualquer `pe` em `pendingEdicao` com valor é persistido.

Verificação de sintaxe (rodar da raiz do repo):
```bash
node -e "const fs=require('fs');const h=fs.readFileSync('projetos/acolitos/escala.html','utf8');const m=h.match(/<script>([\s\S]*?)<\/script>/g)||[];let ok=true;m.forEach((s,i)=>{const c=s.replace(/^<script>/,'').replace(/<\/script>$/,'');if(!c.trim())return;try{new Function(c);}catch(e){ok=false;console.log('ERRO bloco',i,':',e.message);}});console.log(ok?'sintaxe OK ('+m.length+' blocos)':'FALHOU');"
```

Commits em PT terminando com `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Commitar na `main`. Deploy é decisão à parte (do root do repo).

---

## File Structure
- Modify: `projetos/acolitos/escala.html` — CSS (modal/select), refator de `montar` (builder de posição + categorias), slots extras, alerta de irmão, modal de registrar ausência.

---

## Task 1: Modal mais largo + seletor de nome mais largo (item 4)

**Files:** Modify `projetos/acolitos/escala.html`

- [ ] **Step 1: Alargar o modal de montagem**

Trocar (l.151):
```html
  <div class="modal" style="max-width:720px;">
```
por:
```html
  <div class="modal" style="max-width:min(1040px,96vw);">
```

- [ ] **Step 2: Alargar o `.pos-select` (nomes não cortam)**

Trocar o bloco CSS (l.107-111):
```css
    .pos-select {
      flex:0 0 150px; padding:6px 8px; min-height:34px;
      background:var(--surface2); border:1px solid var(--border-wine);
      border-radius:2px; color:var(--text); font-size:11px; outline:none; max-width:150px;
    }
```
por:
```css
    .pos-select {
      flex:0 0 230px; padding:6px 8px; min-height:34px;
      background:var(--surface2); border:1px solid var(--border-wine);
      border-radius:2px; color:var(--text); font-size:11px; outline:none;
    }
```

- [ ] **Step 3: Validar sintaxe** — Run o comando de sintaxe acima. Expected: `sintaxe OK`.

- [ ] **Step 4: Commit**
```bash
git add projetos/acolitos/escala.html
git commit -m "feat(acolitos): modal de escala mais largo e seletor de nome sem corte

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Refatorar montar em builder de posição + categorias (base p/ itens 1 e 2)

**Files:** Modify `projetos/acolitos/escala.html`

Este passo NÃO muda comportamento visível: extrai a renderização de posição
para `criarPosicao`, cria container por categoria com botão "+" (ainda sem menu
funcional além de adicionar), e reconstrói slots extras das linhas que excedem o
modelo. `checarIrmao` entra como stub (Task 4 implementa).

- [ ] **Step 1: Substituir o loop de posições**

Substituir TODO o bloco de l.629-677 (começa em `let catAtual='';` e termina na
chave de fechamento do `tmpl.forEach((pos,idx)=>{ ... });`) por:

```js
  // builder de UMA posição (modelo ou extra) — aninhado p/ usar o estado da celebração
  function criarPosicao(funcao, label, existMembroId, container, isExtra){
    const row=document.createElement('div');row.className='pos-item';
    const lbl=document.createElement('span');lbl.className='pos-label';lbl.textContent=label;
    const sel=document.createElement('select');sel.className='pos-select'+(existMembroId?' filled':'');
    sel.setAttribute('data-funcao',funcao);
    const optV=document.createElement('option');optV.value='';optV.textContent='— vazio —';sel.appendChild(optV);
    const emFormacaoNesta = m => ((habMap[m.id]||{})[funcao])==='em_formacao';
    membros.filter(m=>elegivelFuncao(m,funcao,celeb.comunidade) || emFormacaoNesta(m))
      .forEach(m=>{
        const opt=document.createElement('option');opt.value=m.id;
        const disp=!horKey||(dispMap[m.id]||[]).includes(horKey);
        const ausente=ausNesta.has(m.id);
        const jaSem=dupSemana[m.id];
        const emForm=emFormacaoNesta(m) && !elegivelFuncao(m,funcao,celeb.comunidade);
        opt.textContent=(ausente?'🚫 ':(disp?'':'⚠ '))+(m.apelido||m.nome)+(emForm?' 🎓 em formação':'')+(ausente?' — ausência':'')+(jaSem?' 🔁 já: '+[...jaSem].join(', '):'');
        if(ausente && existMembroId!==m.id) opt.disabled=true;
        if(existMembroId===m.id)opt.selected=true;
        sel.appendChild(opt);
      });
    const pe={sel,funcao,extra:!!isExtra};
    pendingEdicao.push(pe);
    const trc=document.createElement('button');trc.type='button';trc.className='mini-del';trc.textContent='🔄';trc.title='Trocar por outra opção';trc.style.cssText='width:28px;height:28px;flex:none;font-size:12px;';
    trc.onclick=()=>trocarPosicao(pe);
    const clr=document.createElement('button');clr.type='button';clr.className='mini-del';clr.textContent='✕';clr.title=isExtra?'Remover este campo extra':'Limpar esta função';clr.style.cssText='width:28px;height:28px;flex:none;font-size:12px;';
    const dp=document.createElement('div');dp.style.cssText='font-size:10px;margin:-4px 0 4px;padding-left:2px;font-weight:700;color:var(--danger-text);display:none;';
    const sp=document.createElement('div');sp.style.cssText='font-size:10px;margin:-4px 0 4px;padding-left:2px;font-weight:600;display:none;';
    pe.atualizarAvisos=()=>{
      const mid=sel.value;
      const dup=mid&&dupSemana[mid];
      if(dup&&dup.size){dp.style.display='';dp.textContent='⚠️ Já escalado(a) esta semana: '+[...dup].join(', ');}
      else{dp.style.display='none';dp.textContent='';}
      const stp=mid&&semanaPassada[mid];
      if(stp){const pres=(stp==='presente'||stp==='atrasado'),falt=(stp==='ausente'||stp==='ausente_justificado'||stp==='substituido');sp.style.display='';sp.style.color=pres?'var(--success-text)':falt?'var(--danger-text)':'var(--text-muted)';sp.textContent='🔁 Semana passada: '+(pres?'presença marcada ✓':falt?'faltou ✗':'escalado •');}
      else{sp.style.display='none';sp.textContent='';}
    };
    if(isExtra){
      clr.onclick=()=>{ const i=pendingEdicao.indexOf(pe); if(i>=0)pendingEdicao.splice(i,1); row.remove(); dp.remove(); sp.remove(); };
    } else {
      clr.onclick=()=>{sel.value='';sel.classList.remove('filled');pe.atualizarAvisos();};
    }
    sel.onchange=()=>{sel.classList.toggle('filled',!!sel.value);pe.atualizarAvisos();checarIrmao(pe);};
    row.append(lbl,sel,trc,clr);container.appendChild(row);container.appendChild(dp);container.appendChild(sp);
    pe.atualizarAvisos();
    return pe;
  }
  // container por categoria + botão "＋ função"
  const catBox={};
  function getCatBox(cat){
    if(catBox[cat]) return catBox[cat];
    const titulo=document.createElement('div');titulo.className='cat-titulo';titulo.textContent=cat;colPos.appendChild(titulo);
    const box=document.createElement('div');colPos.appendChild(box);
    const add=document.createElement('button');add.type='button';add.className='pos-add';add.textContent='＋ função';
    add.style.cssText='margin:4px 0 10px;font-size:11px;color:var(--gold-light);background:transparent;border:1px dashed var(--gold-dim);border-radius:6px;padding:4px 10px;cursor:pointer;';
    add.onclick=()=>abrirMenuAddFuncao(cat, add);
    colPos.appendChild(add);
    catBox[cat]={box,add};
    return catBox[cat];
  }
  function adicionarSlotExtra(funcao, membroId){
    const meta=FUNCAO_META[funcao]||{label:funcao,cat:'Outros'};
    const cb=getCatBox(meta.cat);
    const pe=criarPosicao(funcao, meta.label+' (extra)', membroId||null, cb.box, true);
    if(membroId){ pe.sel.value=membroId; pe.sel.classList.add('filled'); pe.atualizarAvisos(); }
    return pe;
  }
  function abrirMenuAddFuncao(cat, anchorBtn){
    if(anchorBtn._menu){ anchorBtn._menu.remove(); anchorBtn._menu=null; return; }
    const menu=document.createElement('div');menu.style.cssText='display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px;';
    Object.keys(FUNCAO_META).filter(f=>FUNCAO_META[f].cat===cat).forEach(f=>{
      const b=document.createElement('button');b.type='button';b.textContent=FUNCAO_META[f].label;
      b.style.cssText='font-size:11px;color:var(--text);background:var(--surface2);border:1px solid var(--border-wine);border-radius:6px;padding:4px 8px;cursor:pointer;';
      b.onclick=()=>{ adicionarSlotExtra(f); menu.remove(); anchorBtn._menu=null; };
      menu.appendChild(b);
    });
    anchorBtn.parentNode.insertBefore(menu, anchorBtn.nextSibling);
    anchorBtn._menu=menu;
  }
  // dispensados nesta sessão do modal (par membro|irmão) — usado no item 1
  const _irmaoDispensado=new Set();
  function checarIrmao(pe){ /* implementado na Task 4 */ }

  // posições do MODELO
  tmpl.forEach((pos,idx)=>{
    const existFn=esc.filter(e=>e.funcao===pos.funcao);
    const idxDessaFn=tmpl.slice(0,idx).filter(p=>p.funcao===pos.funcao).length;
    const exist=existFn[idxDessaFn];
    const cb=getCatBox(pos.cat);
    criarPosicao(pos.funcao, pos.label, exist?exist.membro_id:null, cb.box, false);
  });
  // SLOTS EXTRAS: linhas de escala que excedem a contagem do modelo (persistem ao reabrir)
  const _contFn={};
  esc.forEach(e=>{ _contFn[e.funcao]=(_contFn[e.funcao]||0)+1; });
  Object.keys(_contFn).forEach(funcao=>{
    const modeloN=tmpl.filter(p=>p.funcao===funcao).length;
    const rows=esc.filter(e=>e.funcao===funcao);
    for(let i=modeloN;i<rows.length;i++){ adicionarSlotExtra(funcao, rows[i].membro_id); }
  });
```

NOTA: o `let catAtual='';` antigo desaparece (categorias agora via `getCatBox`).
O título "Posições" (`t1`) e `colPos` criados em l.627-628 permanecem intactos
acima deste bloco.

- [ ] **Step 2: Validar sintaxe** — Run o comando de sintaxe. Expected: `sintaxe OK`.

- [ ] **Step 3: Validação manual (humano)**

No deploy: abrir uma celebração — as posições do modelo aparecem agrupadas por
categoria, igual antes; cada categoria tem um "＋ função" embaixo. Clicar nele
abre os botões das funções daquela categoria e adicionar cria um campo extra.
Salvar, reabrir → o extra reaparece. (Usar membro descartável.) Confirmar que
selecionar/limpar/trocar e os avisos "semana passada" continuam funcionando.

- [ ] **Step 4: Commit**
```bash
git add projetos/acolitos/escala.html
git commit -m "feat(acolitos): slots extras por setor na escala (+ refator do builder de posição)

Builder criarPosicao reusado por posições do modelo e extras; categorias com
botão '+'; extras persistem como linhas de acolitos_escalas (reconstruídos ao
reabrir) sem alterar acolitos_modelos.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Persistência dos extras no `trocarPosicao` (garantir avisos nos extras)

**Files:** Modify `projetos/acolitos/escala.html`

`trocarPosicao(pe)` (l.878-896) já chama `pe.atualizarAvisos()` no fim (fix
anterior). Como os extras usam o mesmo `pe`, nada novo é necessário — este passo
é só verificação.

- [ ] **Step 1: Conferir que `trocarPosicao` chama `pe.atualizarAvisos()`**

Run:
```bash
grep -n "if (pe.atualizarAvisos) pe.atualizarAvisos();" projetos/acolitos/escala.html
```
Expected: 1 ocorrência (dentro de `trocarPosicao`). Se ausente, adicionar após
`pe.sel.value = escolhido.id; pe.sel.classList.add('filled');`:
```js
  if (pe.atualizarAvisos) pe.atualizarAvisos();
```

- [ ] **Step 2: (sem commit se nada mudou)** Se o grep já achou, seguir para Task 4. Se houve edição, validar sintaxe e commitar:
```bash
git add projetos/acolitos/escala.html && git commit -m "fix(acolitos): atualizar avisos ao trocar posição (cobre slots extras)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Alerta de irmão ao escolher o nome (item 1)

**Files:** Modify `projetos/acolitos/escala.html`

- [ ] **Step 1: Implementar `checarIrmao` (substituir o stub da Task 2)**

Trocar:
```js
  function checarIrmao(pe){ /* implementado na Task 4 */ }
```
por:
```js
  function checarIrmao(pe){
    const id=pe.sel.value; if(!id) return;
    const m=membros.find(x=>x.id===id); if(!m||!m.escalar_com_irmao||!m.grupo_irmaos) return;
    const irmaos=membros.filter(x=>x.grupo_irmaos===m.grupo_irmaos && x.escalar_com_irmao && x.id!==m.id);
    irmaos.forEach(irmao=>{
      const jaEsta=pendingEdicao.some(p=>p.sel.value===irmao.id);
      const chave=m.id+'|'+irmao.id;
      if(jaEsta || _irmaoDispensado.has(chave)) return;
      const aus=ausNesta.has(irmao.id)?' (atenção: ele declarou ausência nesta missa)':'';
      if(confirm('Você escalou '+(m.apelido||m.nome)+' e o irmão '+(irmao.apelido||irmao.nome)+' ainda não está na escala.'+aus+'\n\nAdicionar '+(irmao.apelido||irmao.nome)+' como Apoio?')){
        adicionarSlotExtra('apoio', irmao.id);
      } else {
        _irmaoDispensado.add(chave);
      }
    });
  }
```

- [ ] **Step 2: Validar sintaxe** — Run o comando de sintaxe. Expected: `sintaxe OK`.

- [ ] **Step 3: Validação manual (humano)**

No deploy: escolher numa posição um membro que tem irmão marcado
`escalar_com_irmao` cujo irmão não está na escala → aparece o confirm; "sim"
adiciona o irmão como Apoio (extra); "não" não repete naquele modal. Se o irmão
já estiver em alguma posição, não alerta.

- [ ] **Step 4: Commit**
```bash
git add projetos/acolitos/escala.html
git commit -m "feat(acolitos): alerta de irmão ao escalar manualmente (adiciona como Apoio)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Botão "Registrar ausência" na escala (item 3)

**Files:** Modify `projetos/acolitos/escala.html`

- [ ] **Step 1: Adicionar o botão na toolbar**

Após o botão de Faltas (l.137), inserir:
```html
      <button class="btn-sm gray" onclick="abrirRegistrarAusenciaCoord()" title="Registrar ausência de um membro">📅 Registrar ausência</button>
```

- [ ] **Step 2: Adicionar a função `abrirRegistrarAusenciaCoord` (top-level, perto de `abrirAusencias`, ~l.1222)**

Inserir antes de `async function abrirAusencias(){`:
```js
// Registrar ausência de um membro pela coordenação (self-contained na escala)
async function abrirRegistrarAusenciaCoord(){
  let motivos=[['doenca','🤒 Doença'],['viagem','✈️ Viagem'],['familia','👨‍👩‍👧 Família'],['outro','📌 Outro']];
  try{ const {data}=await sb.from('acolitos_listas').select('valor,label').eq('tipo','motivo').order('label'); if(data&&data.length) motivos=data.map(r=>[r.valor,r.label]); }catch(e){}
  const hoje=new Date().toISOString().slice(0,10);
  const futuras=(celebracoes||[]).filter(c=>c.data>=hoje).sort((a,b)=>(a.data+a.horario).localeCompare(b.data+b.horario));
  const ov=document.createElement('div');ov.className='modal-overlay open';ov.onclick=e=>{if(e.target===ov)ov.remove();};
  const md=document.createElement('div');md.className='modal';md.style.maxWidth='460px';
  const tt=document.createElement('div');tt.className='modal-title';tt.textContent='Registrar Ausência';md.appendChild(tt);
  // membro
  const lM=document.createElement('label');lM.style.cssText='font-size:12px;color:var(--text-muted);display:block;margin:8px 0 4px;';lM.textContent='Membro';md.appendChild(lM);
  const selMembro=document.createElement('select');selMembro.className='form-select';selMembro.style.width='100%';
  const o0=document.createElement('option');o0.value='';o0.textContent='— escolha —';selMembro.appendChild(o0);
  (membros||[]).slice().sort((a,b)=>(a.nome||'').localeCompare(b.nome||'')).forEach(m=>{const o=document.createElement('option');o.value=m.id;o.textContent=m.apelido||m.nome;selMembro.appendChild(o);});
  md.appendChild(selMembro);
  // missas
  const lC=document.createElement('label');lC.style.cssText='font-size:12px;color:var(--text-muted);display:block;margin:12px 0 4px;';lC.textContent='Missas (marque uma ou mais)';md.appendChild(lC);
  const box=document.createElement('div');box.style.cssText='max-height:30vh;overflow-y:auto;border:1px solid var(--border);border-radius:6px;padding:6px;';
  if(!futuras.length){const e=document.createElement('div');e.style.cssText='font-size:12px;color:var(--text-muted);';e.textContent='Nenhuma missa futura cadastrada.';box.appendChild(e);}
  futuras.forEach(c=>{
    const r=document.createElement('label');r.style.cssText='display:flex;align-items:center;gap:8px;padding:5px 2px;font-size:12px;color:var(--text);cursor:pointer;';
    const chk=document.createElement('input');chk.type='checkbox';chk.className='aus-cel';chk.value=c.id;
    const sp=document.createElement('span');sp.textContent=dataCurta(c.data)+' '+c.horario+' · '+(c.comunidade==='matriz'?'Matriz':'Sto. Antônio');
    r.append(chk,sp);box.appendChild(r);
  });
  md.appendChild(box);
  // data avulsa
  const lAv=document.createElement('label');lAv.style.cssText='font-size:12px;color:var(--text-muted);display:block;margin:12px 0 4px;';lAv.textContent='Ou uma data avulsa (sem missa cadastrada)';md.appendChild(lAv);
  const avInp=document.createElement('input');avInp.type='date';avInp.className='form-input';avInp.min=hoje;avInp.style.width='100%';md.appendChild(avInp);
  // motivo
  const lMo=document.createElement('label');lMo.style.cssText='font-size:12px;color:var(--text-muted);display:block;margin:12px 0 4px;';lMo.textContent='Motivo';md.appendChild(lMo);
  const selMotivo=document.createElement('select');selMotivo.className='form-select';selMotivo.style.width='100%';
  motivos.forEach(([v,l])=>{const o=document.createElement('option');o.value=v;o.textContent=l;selMotivo.appendChild(o);});
  md.appendChild(selMotivo);
  // observação
  const obsInp=document.createElement('input');obsInp.className='form-input';obsInp.placeholder='Observação (opcional)';obsInp.style.cssText='width:100%;margin-top:10px;';md.appendChild(obsInp);
  // msg + ações
  const msg=document.createElement('div');msg.style.cssText='font-size:12px;color:var(--danger-text);margin-top:8px;min-height:16px;';md.appendChild(msg);
  const acts=document.createElement('div');acts.style.cssText='display:flex;gap:8px;margin-top:8px;';
  const cancel=document.createElement('button');cancel.className='btn-sm gray';cancel.style.flex='1';cancel.textContent='Cancelar';cancel.onclick=()=>ov.remove();
  const salvar=document.createElement('button');salvar.className='btn-sm gold';salvar.style.flex='1';salvar.textContent='Salvar';
  salvar.onclick=async()=>{
    const mid=selMembro.value; if(!mid){msg.textContent='Escolha um membro.';return;}
    const ids=[...box.querySelectorAll('.aus-cel:checked')].map(c=>c.value);
    const dataAvulsa=avInp.value;
    if(!ids.length && !dataAvulsa){msg.textContent='Escolha ao menos uma missa ou uma data.';return;}
    const motivo=selMotivo.value; const obs=obsInp.value.trim()||null;
    salvar.disabled=true; salvar.textContent='Salvando...';
    if(ids.length){
      const { error }=await sb.from('acolitos_ausencias').upsert(ids.map(cid=>({membro_id:mid,celebracao_id:cid,motivo,observacao:obs})),{onConflict:'membro_id,celebracao_id'});
      if(error){msg.textContent='Erro ao salvar (missas).';salvar.disabled=false;salvar.textContent='Salvar';return;}
      ids.forEach(cid=>{ (ausMap[cid]=ausMap[cid]||new Set()).add(mid); });
    }
    if(dataAvulsa){
      await sb.from('acolitos_ausencias').delete().eq('membro_id',mid).eq('data',dataAvulsa).is('celebracao_id',null);
      const { error }=await sb.from('acolitos_ausencias').insert([{membro_id:mid,data:dataAvulsa,celebracao_id:null,motivo,observacao:obs}]);
      if(error){msg.textContent='Erro ao salvar (data avulsa).';salvar.disabled=false;salvar.textContent='Salvar';return;}
    }
    toast('✓ Ausência registrada'); ov.remove();
  };
  acts.append(cancel,salvar);md.appendChild(acts);
  ov.appendChild(md);document.body.appendChild(ov);
}
```

- [ ] **Step 3: Validar sintaxe** — Run o comando de sintaxe. Expected: `sintaxe OK`.

- [ ] **Step 4: Validação manual (humano)**

No deploy: clicar "📅 Registrar ausência" → escolher membro de teste, marcar uma
missa (ou data avulsa), motivo, salvar → toast de sucesso; conferir em
"🚫 Ausências" que a ausência apareceu; ao montar aquela missa, o membro aparece
como ausente. Remover a ausência de teste depois.

- [ ] **Step 5: Commit**
```bash
git add projetos/acolitos/escala.html
git commit -m "feat(acolitos): registrar ausência pela tela de escala (coordenação)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review (preenchido)

**1. Spec coverage:**
- Item 1 (alerta de irmão, ao escolher nome, só escalar_com_irmao, vira Apoio extra) → Task 4 ✅
- Item 2 ("+" por setor, não altera modelo, reconstrói ao reabrir, ✕ remove extra) → Task 2 ✅
- Item 3 (botão registrar ausência na escala, self-contained) → Task 5 ✅
- Item 4 (modal mais largo + select sem corte) → Task 1 ✅

**2. Placeholder scan:** o único "stub" é `checarIrmao` na Task 2, substituído na
Task 4 (intencional, documentado). Sem TBD/TODO soltos.

**3. Type consistency:** `criarPosicao(funcao,label,existMembroId,container,isExtra)→pe`,
`pe={sel,funcao,extra,atualizarAvisos}`, `getCatBox(cat)→{box,add}`,
`adicionarSlotExtra(funcao,membroId?)→pe`, `abrirMenuAddFuncao(cat,anchorBtn)`,
`checarIrmao(pe)`, `_irmaoDispensado:Set` — consistentes entre tasks. Usa
`FUNCAO_META`, `elegivelFuncao`, `trocarPosicao`, `ausMap`, `dataCurta`,
`MOTIVO_LABEL` já existentes.

**Riscos:** (a) o bloco substituído na Task 2 é grande — conferir que apenas
l.629-677 são trocadas, preservando `colPos`/`t1` acima e a "Coluna membros"
abaixo (l.679+). (b) `checarIrmao`/`adicionarSlotExtra` etc. são declarações de
função aninhadas (hoisted) — ordem de definição não quebra. (c) Duplicação
consciente da lógica de ausência (decisão do usuário).
