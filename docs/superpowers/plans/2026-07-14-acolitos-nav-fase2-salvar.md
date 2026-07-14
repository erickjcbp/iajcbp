# Spec D · Fase 2 — Salvar sem perder o lugar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Ao salvar a escala, manter o modal aberto com "✓ salvo", sem recarregar a tela; ao fechar, atualizar a planilha/cards a partir da memória preservando a rolagem/semana/filtro — nunca `loadDados()` (rede) nem "pulo pro topo".

**Architecture:** Um arquivo (`escala.html`). O `salvarEscala` deixa de fechar+`loadDados`; passa a atualizar `escalasMap[celeb]` em memória com o retorno do insert (com join do membro) e marca "sujo". Um `fecharMontagem()` re-renderiza de memória (`renderCards`/`renderPlanilha`) com `scrollY` preservado. Sem rede no fluxo de fechar.

**Tech Stack:** HTML/JS puro, sem bundler. Sem framework de teste → verificação por leitura + navegador (login-gated; teste funcional completo fica pra sessão com login de coordenação).

## Global Constraints
- Só `escala.html`. Não introduzir dependência externa. Não usar `confirm/alert` nativos.
- **Nunca** `loadDados()` no fluxo de salvar/fechar do modal de montagem (é rede + reset). Re-render **de memória**.
- Preservar `window.scrollY` ao re-renderizar. Preservar semana/filtro (não mexer em `filtro-com`/`verHistorico`).
- Salvar pode ser **incompleto** (vagas vazias ignoradas) — comportamento atual mantido.
- Trava "mesmo membro em 2 funções da missa" mantida.
- Mobile-first; não quebrar os outros fluxos de `escala.html`.

---

## Task 1: Salvar mantém o modal + refresh de memória ao fechar

**Files:**
- Modify: `projetos/acolitos/escala.html`

**Interfaces:**
- Consome: `pendingCelebId`, `pendingEdicao`, `escalasMap`, `abaAtual`, `renderCards()`, `renderPlanilha()`, `fecharModal(id)`, `toast()`, `ctx.user.id`.
- Produz: flag `montagemDirty` (bool), função `fecharMontagem()`.

- [ ] **Step 1: Status element no rodapé do modal de montagem**

No HTML do `#modal-montagem`, junto aos botões (perto do `Salvar Escala`, ~linha 172), adicionar um status inline:

```html
<span id="montagem-status" style="font-size:12px;color:var(--success-text,#7bd88f);margin-right:auto;align-self:center;"></span>
```
(colocar como primeiro filho da barra de botões pra empurrar os botões pra direita; se a barra não for flex, envolver ou ajustar).

- [ ] **Step 2: Declarar a flag**

Perto das outras variáveis de estado do topo do script (onde estão `pendingCelebId`, `abaAtual`, etc.), adicionar:
```js
let montagemDirty = false;
```

- [ ] **Step 3: Reescrever `salvarEscala` (não fecha, não loadDados)**

Substituir o corpo pós-gravação. Chaves: (a) insert com join do membro; (b) atualizar `escalasMap` em memória; (c) status "✓ salvo"; (d) manter modal aberto; (e) `montagemDirty=true`.

```js
async function salvarEscala() {
  if(salvandoEscala || !pendingCelebId){ if(!pendingCelebId) toast('Abra uma celebração para montar a escala.','error'); return; }
  salvandoEscala=true;
  const btn=document.getElementById('btn-sv-escala');
  btn.disabled=true;btn.textContent='Salvando...';
  const novas=[];
  pendingEdicao.forEach(({sel,funcao})=>{ if(sel.value) novas.push({celebracao_id:pendingCelebId,membro_id:sel.value,funcao,created_by:ctx.user.id}); });
  const _ids=novas.map(n=>n.membro_id); const _dupId=_ids.find((id,i)=>_ids.indexOf(id)!==i);
  if(_dupId){ const _m=membros.find(x=>x.id===_dupId); salvandoEscala=false; btn.disabled=false; btn.textContent='Salvar Escala'; toast('✋ '+((_m&&(_m.apelido||_m.nome))||'Um membro')+' está em duas funções nesta missa. Ajuste antes de salvar.','error'); return; }
  const del=await sb.from('acolitos_escalas').delete().eq('celebracao_id',pendingCelebId);
  if(del.error){ salvandoEscala=false; btn.disabled=false; btn.textContent='Salvar Escala'; toast('Erro ao salvar: '+del.error.message,'error'); return; }
  let gravadas=0, novasLinhas=[];
  if(novas.length){
    const ins=await sb.from('acolitos_escalas').insert(novas).select('*, acolitos_membros!membro_id(id,nome)');
    if(ins.error){ salvandoEscala=false; btn.disabled=false; btn.textContent='Salvar Escala'; toast('Erro ao salvar: '+ins.error.message,'error'); return; }
    novasLinhas = ins.data || [];
    gravadas = novasLinhas.length;
  }
  if(novas.length && gravadas===0){
    salvandoEscala=false; btn.disabled=false; btn.textContent='Salvar Escala';
    toast('⚠ Nada foi gravado (0 de '+novas.length+') — sem permissão de escrita na escala.','error'); return;
  }
  // atualiza em memória (sem rede) e marca p/ refresh ao fechar
  escalasMap[pendingCelebId] = novasLinhas;
  montagemDirty = true;
  const st=document.getElementById('montagem-status'); if(st) st.textContent='✓ salvo · '+gravadas+' posições';
  toast('✓ Escala salva! ('+gravadas+' de '+novas.length+' posições)');
  btn.className='btn-sm gold'; btn.textContent='Salvar Escala'; btn.disabled=false;
  salvandoEscala=false;
  // NÃO fecha o modal, NÃO chama loadDados — o dono fecha quando quiser (Fase 2)
}
```

- [ ] **Step 4: `fecharMontagem()` — refresh de memória com scroll preservado**

Adicionar (perto de `fecharModal`):
```js
function fecharMontagem(){
  const st=document.getElementById('montagem-status'); if(st) st.textContent='';
  fecharModal('modal-montagem');
  if(montagemDirty){
    montagemDirty=false;
    const y = window.scrollY;
    (abaAtual==='cards' ? renderCards() : renderPlanilha());   // re-render de MEMÓRIA (sem rede)
    window.scrollTo(0, y);                                     // preserva o lugar
  }
}
```

- [ ] **Step 5: Apontar o Fechar/X do modal de montagem para `fecharMontagem()`**

No `#modal-montagem`, trocar os `onclick="fecharModal('modal-montagem')"` (o botão "Fechar" ~linha 169 e o X do cabeçalho, se houver) por `onclick="fecharMontagem()"`. NÃO trocar os outros modais.

- [ ] **Step 6: Zerar `montagemDirty` ao (re)abrir a montagem**

Na função que abre o modal de montagem (`abrirMontagem`), no início, garantir estado limpo:
```js
montagemDirty = false;
const st=document.getElementById('montagem-status'); if(st) st.textContent='';
```
(evita status/flag remanescente de uma abertura anterior).

- [ ] **Step 7: Verificação (offline; funcional precisa login de coordenação)**

- `python3 -m http.server 8765` no root + Playwright em `http://localhost:8765/projetos/acolitos/escala.html`: carrega sem erro de console; a página é login-gated (redireciona) — confirmar só que o boot não quebra e que `fecharMontagem`/`salvarEscala` existem (`typeof` via evaluate injetando o script, se possível).
- Leitura: confirmar que `salvarEscala` não chama mais `fecharModal`/`loadDados`; que `fecharMontagem` re-renderiza de memória e restaura `scrollY`; que o insert usa `.select('*, acolitos_membros!membro_id(id,nome)')` (mesma forma que `loadDados` monta `escalasMap`).
- **Teste funcional (requer login de coordenação, adiar se indisponível):** abrir uma celebração, montar, Salvar → modal fica aberto com "✓ salvo", tela por trás não recarrega; Fechar → só o card muda, rolagem/semana preservadas; reabrir a mesma celebração mostra o que foi salvo.

- [ ] **Step 8: Commit**
```bash
git add projetos/acolitos/escala.html
git commit -m "feat(acolitos): salvar escala mantém o modal + refresh de memória sem perder o lugar (Spec D F2)"
```

---

## Self-review (na escrita)
- **Cobertura:** F2 do spec (fica no modal + ✓ salvo; sem reload; refresh pontual de memória; scroll/semana/filtro preservados) → Task 1. ✔
- **Placeholders:** código completo do `salvarEscala`/`fecharMontagem`; os passos 1/5/6 são integração em arquivo existente (posições descritas; o implementador confirma os call-sites reais do X/Fechar e de `abrirMontagem`). ✔
- **Riscos:** o re-render de memória depende de `escalasMap[celeb]` ter a forma com join `acolitos_membros!membro_id(id,nome)` — garantido pelo `.select(...)` do insert. Fechar por fundo/Voltar ainda usa o caminho antigo (sem refresh) até a **Fase 1** — aceitável nesta fase (dono fecha pelo Fechar). ✔
