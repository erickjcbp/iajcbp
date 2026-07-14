# Spec D · Fase 3 — Lembrar onde parei (estado por tela) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: subagent-driven-development / executing-plans. Steps use checkbox (`- [ ]`).

**Goal:** Ao reabrir/recarregar uma tela, restaurar o contexto onde o usuário estava (aba, filtro, histórico, rolagem). Aplicar nas duas telas mais navegadas: **Escala** e **Membros**. Padrão uniforme, extensível.

**Architecture:** Cada tela guarda seu estado num objeto JSON em `localStorage` (`estado-escala`, `estado-membros`), gravado quando o usuário muda algo (aba/filtro/busca) e a rolagem no `pagehide`/`visibilitychange`; restaura no load, ANTES/APÓS o primeiro render conforme o campo. Sem tocar em `shared.js` nesta fase (é por-tela); reusa as chaves já existentes (`membros-vista` continua válida).

**Tech Stack:** JS puro nas telas. Sem dependência externa. Verificação: navegador (Playwright, login coord) — mudar estado, recarregar, confirmar restauração.

## Global Constraints
- Só `escala.html` e `membros.html`. Não quebrar fluxos existentes.
- localStorage com try/catch (modo privado). Estado é POR-USUÁRIO no device (não vai pro banco).
- Restaurar rolagem só depois do render que cria o conteúdo (senão a página ainda é curta e o scroll não "pega").
- Não conflitar com `membros-vista` (manter a chave; ou migrar pra dentro de `estado-membros` sem perder o valor atual).
- Mobile-first; não introduzir flicker perceptível na restauração.

---

## Task 1: Escala — lembrar aba + filtro comunidade + histórico + rolagem

**Files:**
- Modify: `projetos/acolitos/escala.html`

**Interfaces:**
- Consome: `abaAtual`, `verHistorico`, `#filtro-com`, `loadDados()`, `setAba()`, `toggleHistorico` (o handler do botão histórico ~linha 448), `renderCards/renderPlanilha`.
- Produz: `salvarEstadoEscala()`, `restaurarEstadoEscala()`; chave `estado-escala`.

- [ ] **Step 1: Helpers de estado (perto do topo do script, após as vars de estado ~linha 377)**

```js
function salvarEstadoEscala(){
  try{ localStorage.setItem('estado-escala', JSON.stringify({
    aba: abaAtual, com: (document.getElementById('filtro-com')||{}).value || '',
    hist: !!verHistorico, y: window.scrollY
  })); }catch(e){}
}
function restaurarEstadoEscala(){
  let s; try{ s = JSON.parse(localStorage.getItem('estado-escala')||'null'); }catch(e){ s=null; }
  return s || null;
}
```

- [ ] **Step 2: Aplicar o estado ANTES do primeiro loadDados**

Na inicialização da tela (onde hoje chama o primeiro `loadDados()` — ~linha 512/na função de boot), antes de carregar:
```js
const _est = restaurarEstadoEscala();
if(_est){
  if(_est.com!==undefined){ const f=document.getElementById('filtro-com'); if(f) f.value=_est.com; }
  if(_est.hist){ verHistorico = true; const b=document.getElementById('btn-hist'); if(b){ b.classList.add('gold'); b.classList.remove('gray'); b.textContent='🕓 Histórico ✓'; } }
  if(_est.aba){ abaAtual = _est.aba; }
}
```
(ajustar o id real do botão histórico — confirmar; hoje o handler está ~448.)

- [ ] **Step 3: Restaurar aba (view toggle) e rolagem APÓS o render**

No fim de `loadDados()` (após `abaAtual==='cards'?renderCards():renderPlanilha()`), aplicar a aba visual e restaurar a rolagem uma vez:
```js
// aplica a aba selecionada no toggle visual + restaura rolagem salva (uma vez)
if(typeof setAba==='function'){ /* garante os toggles/visibilidade coerentes */ 
  document.getElementById('view-cards').style.display = abaAtual==='cards'?'':'none';
  document.getElementById('view-planilha').style.display = abaAtual==='planilha'?'':'none';
  const bc=document.getElementById('btn-cards'), bp=document.getElementById('btn-planilha');
  if(bc) bc.classList.toggle('active',abaAtual==='cards'); if(bp) bp.classList.toggle('active',abaAtual==='planilha');
}
if(window.__escRestoreY!=null){ const y=window.__escRestoreY; window.__escRestoreY=null; requestAnimationFrame(()=>window.scrollTo(0,y)); }
```
E no Step 2, guardar `window.__escRestoreY = _est ? _est.y : null;` para o loadDados restaurar depois do render.

- [ ] **Step 4: Gravar o estado quando muda**

- `filtro-com` onchange: já chama `loadDados()`; adicionar `salvarEstadoEscala()` (ex.: trocar `onchange="loadDados()"` por `onchange="loadDados();salvarEstadoEscala()"`, ou chamar dentro de loadDados no fim).
- `setAba(a)`: no fim, `salvarEstadoEscala()`.
- `toggleHistorico` (handler do botão ~448): no fim, `salvarEstadoEscala()`.
- Rolagem: `window.addEventListener('pagehide', salvarEstadoEscala); document.addEventListener('visibilitychange', ()=>{ if(document.visibilityState==='hidden') salvarEstadoEscala(); });`

- [ ] **Step 5: Verificação (Playwright, login coord)**

Login → Escala. Trocar pra aba "Planilha", setar um filtro de comunidade, ligar Histórico, rolar pra baixo. **Recarregar a página.** Confirmar: volta na aba Planilha + mesmo filtro + Histórico ligado + rolagem aproximada. Trocar de volta e recarregar → persiste o novo estado. Sem erro de console.

- [ ] **Step 6: Commit**
```bash
git add projetos/acolitos/escala.html
git commit -m "feat(acolitos): escala lembra aba/filtro/histórico/rolagem ao reabrir (Spec D F3)"
```

---

## Task 2: Membros — lembrar filtro (role) + busca + rolagem (vista já persiste)

**Files:**
- Modify: `projetos/acolitos/membros.html`

**Interfaces:**
- Consome: `filtroAtivo`, `#busca`, `vista` (já em `membros-vista`), `filtrar()`, `setFiltro(role)` (~267), `render`.
- Produz: `salvarEstadoMembros()`; chave `estado-membros` (para filtro+busca+scroll). Mantém `membros-vista`.

- [ ] **Step 1: Helper de estado**

```js
function salvarEstadoMembros(){
  try{ localStorage.setItem('estado-membros', JSON.stringify({
    filtro: filtroAtivo||'', busca: (document.getElementById('busca')||{}).value||'', y: window.scrollY
  })); }catch(e){}
}
```

- [ ] **Step 2: Restaurar no load (antes do primeiro render de lista)**

Onde a tela inicializa (após carregar os membros, antes/na hora do primeiro `filtrar()`/render):
```js
let _em; try{ _em = JSON.parse(localStorage.getItem('estado-membros')||'null'); }catch(e){ _em=null; }
if(_em){
  if(_em.filtro){ filtroAtivo=_em.filtro; }
  if(_em.busca){ const b=document.getElementById('busca'); if(b) b.value=_em.busca; }
  window.__memRestoreY = _em.y!=null ? _em.y : null;
}
// aplica o toggle visual do filtro selecionado (se houver)
if(filtroAtivo){ document.querySelectorAll('#filtros .form-toggle').forEach(b=>{ if(b.dataset.role===filtroAtivo||b.getAttribute('data-role')===filtroAtivo) b.classList.add('active'); }); }
```
(confirmar como os botões de filtro identificam o role — pode ser `onclick="setFiltro('coord_admin')"`; nesse caso marcar o ativo pela comparação textual/atributo real.)

- [ ] **Step 3: Restaurar rolagem após o render**

No fim de `filtrar()`/da função que popula a lista:
```js
if(window.__memRestoreY!=null){ const y=window.__memRestoreY; window.__memRestoreY=null; requestAnimationFrame(()=>window.scrollTo(0,y)); }
```

- [ ] **Step 4: Gravar quando muda**

- `setFiltro(role)`: no fim, `salvarEstadoMembros()`.
- `#busca` oninput já chama `filtrar()`; adicionar `salvarEstadoMembros()` (no fim de `filtrar()` ou no oninput).
- Rolagem: `pagehide` + `visibilitychange(hidden)` → `salvarEstadoMembros()`.

- [ ] **Step 5: Verificação (Playwright, login coord)**

Login → Membros. Aplicar um filtro de nível/role, digitar uma busca, rolar. **Recarregar.** Confirmar: filtro + busca + rolagem restaurados; a `vista` (cards/lista) continua funcionando como antes. Sem erro de console.

- [ ] **Step 6: Commit**
```bash
git add projetos/acolitos/membros.html
git commit -m "feat(acolitos): membros lembra filtro/busca/rolagem ao reabrir (Spec D F3)"
```

---

## Self-review (na escrita)
- **Cobertura:** F3 do spec (restaurar contexto por tela: aba/filtro/histórico/rolagem na Escala; filtro/busca/rolagem em Membros) → Tasks 1+2. Vista de Membros já persistia (mantida). ✔
- **Placeholders:** helpers completos; os pontos de "confirmar id real do botão/como o filtro marca ativo" são integração no arquivo existente — descritos com o critério. ✔
- **Risco baixo:** só localStorage + restauração; se algo falhar, o pior caso é "não restaura" (degrada pro comportamento atual), não quebra a tela. try/catch em tudo. ✔
- **Escopo:** limitado a 2 telas de propósito (as mais navegadas). Agenda já tem `agenda-view`/`agenda-tl-filtro`; fora do escopo desta fase. ✔
