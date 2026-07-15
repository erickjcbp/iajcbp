# ESCALA EU! — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar a lista seca da sub-aba "Vagas" (em Escalas › Minhas) por um card-herói animado **"ESCALA EU!"** com fluxo guiado missa → função, que envia candidatura pelo pipeline já existente.

**Architecture:** 100% frontend em `projetos/acolitos/escalas-membro.html` + um helper puro em `projetos/acolitos/solicitacoes-core.js`. Reusa os RPCs `acolitos_vagas_abertas_membro()` (leitura, já filtra "vaga aberta E apto") e `acolitos_candidatar_vaga()` (envio → Caixa da coordenação), e os helpers de UI `showCeleb()`, `toast()`, `uiConfirm()` do `shared.js`. Sem migration, sem RLS.

**Tech Stack:** HTML/JS vanilla (sem build), Supabase JS (RPCs `security definer`), CSS custom-props do `shared.css`. Testes unitários em Node puro (sem framework), no padrão do `solicitacoes-core.test.js`.

## Global Constraints

- **Sem banco novo:** nenhuma migration, RPC ou mudança de RLS. Só reuso do que está no ar.
- **Regras da casa:** responsivo full-bleed (não estourar no celular); modais `ui*` (nunca `confirm`/`alert`/`prompt` nativos); emoji só como decoração dentro de `showCeleb` (padrão já existente), nunca como ícone estrutural.
- **"Apto" = critério atual:** estar habilitado na função (o RPC `acolitos_vagas_abertas_membro` já faz o join com `acolitos_habilitacoes`). Não inventar critério novo.
- **É pedido, não auto-escala:** o envio cria candidatura `aguardando_coordenacao` (via `acolitos_candidatar_vaga`), homologada na Caixa. Nada entra escalado na hora.
- **Escopo cirúrgico:** só a função `carregarVagas` e o CSS da sub-aba mudam. "Minhas missas", "Meus pedidos" e visão "Todas" ficam intactas.

---

## File Structure

- `projetos/acolitos/solicitacoes-core.js` — **Modify.** Adiciona a função pura `agruparVagasPorMissa(vagas)` e a expõe na API (`window.SolicitacoesCore` + `module.exports`).
- `projetos/acolitos/solicitacoes-core.test.js` — **Modify.** Testes da nova função (Node puro).
- `projetos/acolitos/escalas-membro.html` — **Modify.** (a) CSS novo do herói/chips no `<style>`; (b) reescreve a função `carregarVagas(body, ctx)` para a máquina de 3 estados (herói → missas → funções).

---

### Task 1: Helper puro `agruparVagasPorMissa`

Agrupa a lista chapada do RPC (`{celebracao_id, data, horario, comunidade, tipo, funcao}`) por celebração, preservando a ordem de entrada (o RPC já ordena por data/horário) e deduplicando funções. É a única lógica não-visual da feature — fica isolada e testável sem DOM.

**Files:**
- Modify: `projetos/acolitos/solicitacoes-core.js`
- Test: `projetos/acolitos/solicitacoes-core.test.js`

**Interfaces:**
- Consumes: nada (função pura).
- Produces: `agruparVagasPorMissa(vagas: Array<{celebracao_id,data,horario,comunidade,tipo,funcao}>) → Array<{celebracao_id,data,horario,comunidade,tipo,funcoes: string[]}>`. Exposta em `SolicitacoesCore.agruparVagasPorMissa`.

- [ ] **Step 1: Escrever os testes que falham**

Adicionar ao final de `projetos/acolitos/solicitacoes-core.test.js`, **antes** da linha `console.log(falhas? ...)`:

```javascript
// ── agruparVagasPorMissa ──
const { agruparVagasPorMissa } = require('./solicitacoes-core.js');
eq('vazio → []', agruparVagasPorMissa([]), []);
eq('null → []', agruparVagasPorMissa(null), []);
eq('2 funções da mesma missa → 1 missa com 2 funções',
  agruparVagasPorMissa([
    { celebracao_id:'c1', data:'2026-07-19', horario:'19:00', comunidade:'matriz', tipo:'missa_comum', funcao:'cruz' },
    { celebracao_id:'c1', data:'2026-07-19', horario:'19:00', comunidade:'matriz', tipo:'missa_comum', funcao:'vela' }
  ]),
  [{ celebracao_id:'c1', data:'2026-07-19', horario:'19:00', comunidade:'matriz', tipo:'missa_comum', funcoes:['cruz','vela'] }]);
eq('2 missas → preserva ordem de entrada',
  agruparVagasPorMissa([
    { celebracao_id:'c1', data:'2026-07-19', horario:'19:00', comunidade:'matriz', tipo:'missa_comum', funcao:'cruz' },
    { celebracao_id:'c2', data:'2026-07-20', horario:'08:00', comunidade:'santo_antonio', tipo:'missa_comum', funcao:'vela' }
  ]).map(m=>m.celebracao_id),
  ['c1','c2']);
eq('função duplicada é deduplicada',
  agruparVagasPorMissa([
    { celebracao_id:'c1', data:'2026-07-19', horario:'19:00', comunidade:'matriz', tipo:'missa_comum', funcao:'cruz' },
    { celebracao_id:'c1', data:'2026-07-19', horario:'19:00', comunidade:'matriz', tipo:'missa_comum', funcao:'cruz' }
  ])[0].funcoes,
  ['cruz']);
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `node projetos/acolitos/solicitacoes-core.test.js`
Expected: FAIL — `agruparVagasPorMissa is not a function` (ou `TypeError`), processo sai com código 1.

- [ ] **Step 3: Implementar a função pura**

Em `projetos/acolitos/solicitacoes-core.js`, **antes** da linha `var API = { ... }`, adicionar:

```javascript
  // Agrupa a lista chapada de vagas (uma por celebração×função) do RPC
  // acolitos_vagas_abertas_membro em uma lista por missa, preservando a ordem
  // de entrada e deduplicando funções.
  function agruparVagasPorMissa(vagas){
    var byId = {}, ordem = [];
    (vagas || []).forEach(function(v){
      var id = v.celebracao_id;
      if(!byId[id]){
        byId[id] = { celebracao_id:id, data:v.data, horario:v.horario, comunidade:v.comunidade, tipo:v.tipo, funcoes:[] };
        ordem.push(id);
      }
      if(byId[id].funcoes.indexOf(v.funcao) < 0) byId[id].funcoes.push(v.funcao);
    });
    return ordem.map(function(id){ return byId[id]; });
  }
```

E incluir na API — trocar a linha:

```javascript
  var API = { STATUS_LABEL:STATUS_LABEL, STATUS_PENDENTE:STATUS_PENDENTE, estaPendente:estaPendente, TIPO_LABEL:TIPO_LABEL };
```

por:

```javascript
  var API = { STATUS_LABEL:STATUS_LABEL, STATUS_PENDENTE:STATUS_PENDENTE, estaPendente:estaPendente, TIPO_LABEL:TIPO_LABEL, agruparVagasPorMissa:agruparVagasPorMissa };
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `node projetos/acolitos/solicitacoes-core.test.js`
Expected: PASS em todas as linhas, termina com `TODOS OK`, código de saída 0.

- [ ] **Step 5: Commit**

```bash
git add projetos/acolitos/solicitacoes-core.js projetos/acolitos/solicitacoes-core.test.js
git commit -m "feat(acolitos): agruparVagasPorMissa — agrupa vagas por celebração (ESCALA EU!)"
```

---

### Task 2: Card ESCALA EU! (herói → missas → funções) em `carregarVagas`

Reescreve a renderização da sub-aba "Vagas" para a máquina de 3 estados dentro do mesmo `body`. Um único fetch de `acolitos_vagas_abertas_membro`, agrupado pelo helper da Task 1. Envio via `acolitos_candidatar_vaga`. Sucesso com `showCeleb`. Vaga pedida na sessão fica marcada "✓" (candidatura pendente ≠ escalado, então ela continua vindo do RPC).

**Files:**
- Modify: `projetos/acolitos/escalas-membro.html` (CSS no `<style>` do `<head>`; função `carregarVagas` no `<script>`)

**Interfaces:**
- Consumes: `SolicitacoesCore.agruparVagasPorMissa` (Task 1); helpers globais já existentes `dataLabel(d)`, `comLabel(c)`, `FUNCAO_LABEL{}`, `toast(msg,tipo)`, `uiConfirm(msg)→Promise<bool>`, `showCeleb(opts)`; RPCs `acolitos_vagas_abertas_membro()` e `acolitos_candidatar_vaga(p_celebracao_id,p_funcao,p_motivo)`.
- Produces: nada consumido por outras tasks (é a folha da árvore).

- [ ] **Step 1: Adicionar o CSS do herói e dos chips**

Em `projetos/acolitos/escalas-membro.html`, dentro do bloco `<style>` do `<head>`, **logo após** a regra `.esc-chamada-btn.feita { ... }`, adicionar:

```css
    /* ── ESCALA EU! ── */
    .ee-hero { position:relative; overflow:hidden; border-radius:14px; padding:24px 18px; text-align:center; cursor:pointer; background:linear-gradient(150deg, rgba(232,185,74,.18), rgba(120,20,30,.30)); border:1px solid var(--gold-dim); transition:transform .12s, box-shadow .3s; }
    .ee-hero.pulsa { animation:eePulse 2.2s ease-in-out infinite; }
    .ee-hero:active { transform:scale(.99); }
    @keyframes eePulse { 0%,100%{ box-shadow:0 0 0 0 rgba(232,185,74,0); } 50%{ box-shadow:0 0 26px 2px var(--red-glow); } }
    .ee-hero .ee-t { font-family:'Sora',sans-serif; font-weight:800; letter-spacing:2px; font-size:26px; color:var(--gold-light); text-shadow:0 0 16px var(--red-glow); }
    .ee-hero .ee-s { font-size:13px; color:var(--text); margin-top:6px; }
    .ee-hero .ee-badge { display:inline-block; margin-top:14px; font-family:'Sora',sans-serif; font-weight:700; font-size:12px; color:var(--text); background:rgba(0,0,0,.25); border:1px solid var(--border-wine); border-radius:999px; padding:5px 13px; }
    .ee-hero.calmo { animation:none; cursor:default; background:linear-gradient(150deg, rgba(120,20,30,.14), var(--surface2)); }
    .ee-back { background:none; border:none; color:var(--gold); font-family:'Sora',sans-serif; font-weight:700; font-size:13px; cursor:pointer; padding:6px 0; margin-bottom:6px; }
    .ee-step { animation:eeFade .28s ease both; }
    @keyframes eeFade { from{ opacity:0; transform:translateY(6px); } to{ opacity:1; transform:none; } }
    .ee-resumo { font-size:12px; color:var(--gold); margin:2px 0 10px; }
    .ee-chips { display:flex; flex-wrap:wrap; gap:10px; }
    .ee-chip { flex:1 1 44%; min-width:130px; padding:15px 12px; border-radius:12px; border:1px solid var(--gold-dim); background:linear-gradient(165deg, rgba(232,185,74,.12), var(--surface2)); color:var(--gold-light); font-family:'Sora',sans-serif; font-weight:700; font-size:14px; cursor:pointer; text-align:center; transition:border-color .15s, transform .1s, box-shadow .2s; }
    .ee-chip:hover { border-color:var(--gold); box-shadow:0 0 12px var(--red-glow); }
    .ee-chip:active { transform:scale(.98); }
    .ee-chip:disabled { cursor:default; border-color:var(--success-text,#4caf50); color:var(--success-text,#7bd88f); background:linear-gradient(165deg, rgba(76,175,80,.14), var(--surface2)); box-shadow:none; }
```

- [ ] **Step 2: Reescrever a função `carregarVagas`**

Substituir **toda** a função `async function carregarVagas(body, ctx){ ... }` (atualmente linhas ~204–222) por:

```javascript
// Vagas pedidas nesta sessão (celebracao_id|funcao). O RPC filtra por
// "escalado", não por candidatura pendente — então a vaga pedida continua
// aparecendo; marcamos o chip como "✓" pra não deixar re-pedir.
const _eePedidos = new Set();

async function carregarVagas(body, ctx){
  body.textContent = '';
  const wrap = document.createElement('div'); body.appendChild(wrap);
  const { data } = await sb.rpc('acolitos_vagas_abertas_membro');
  const missas = window.SolicitacoesCore.agruparVagasPorMissa((data && data.vagas) || []);
  renderHeroi();

  function mkBack(txt, fn){ const b=document.createElement('button'); b.className='ee-back'; b.textContent=txt; b.onclick=fn; return b; }

  function renderHeroi(){
    wrap.textContent = '';
    const hero = document.createElement('div');
    hero.className = 'ee-hero ee-step' + (missas.length ? ' pulsa' : ' calmo');
    const t = document.createElement('div'); t.className='ee-t'; t.textContent='ESCALA EU!';
    const s = document.createElement('div'); s.className='ee-s';
    hero.append(t, s);
    if(missas.length){
      s.textContent = 'Quer servir? Escolha uma missa e a sua função.';
      const b = document.createElement('div'); b.className='ee-badge';
      b.textContent = missas.length===1 ? '1 missa precisa de você' : missas.length+' missas precisam de você';
      hero.appendChild(b);
      hero.onclick = renderMissas;
    } else {
      s.textContent = 'Tudo escalado por enquanto — volte depois.';
    }
    wrap.appendChild(hero);
  }

  function renderMissas(){
    wrap.textContent = '';
    wrap.appendChild(mkBack('‹ voltar', renderHeroi));
    missas.forEach(function(m){
      const card = document.createElement('div'); card.className='esc-card ee-step';
      const dt = document.createElement('div'); dt.className='esc-data'; dt.textContent = dataLabel(m.data)+' · '+m.horario;
      const sub = document.createElement('div'); sub.className='esc-sub'; sub.textContent = comLabel(m.comunidade);
      const cnt = document.createElement('div'); cnt.className='esc-count';
      const strong = document.createElement('b'); strong.textContent = m.funcoes.length;
      const k = m.funcoes.length;
      cnt.append(strong, document.createTextNode(' '+(k===1?'função aberta pra você':'funções abertas pra você')));
      card.append(dt, sub, cnt);
      card.onclick = function(){ renderFuncoes(m); };
      wrap.appendChild(card);
    });
  }

  function renderFuncoes(m){
    wrap.textContent = '';
    wrap.appendChild(mkBack('‹ voltar', renderMissas));
    const res = document.createElement('div'); res.className='ee-resumo';
    res.textContent = dataLabel(m.data)+' · '+m.horario+' · '+comLabel(m.comunidade);
    wrap.appendChild(res);
    const chips = document.createElement('div'); chips.className='ee-chips ee-step'; wrap.appendChild(chips);
    m.funcoes.forEach(function(fn){
      const chip = document.createElement('button'); chip.className='ee-chip';
      const nome = FUNCAO_LABEL[fn]||fn;
      const jaPedido = _eePedidos.has(m.celebracao_id+'|'+fn);
      chip.textContent = jaPedido ? '✓ '+nome : nome;
      chip.disabled = jaPedido;
      chip.onclick = function(){ pedir(m, fn, chip); };
      chips.appendChild(chip);
    });
  }

  async function pedir(m, fn, chip){
    const nome = FUNCAO_LABEL[fn]||fn;
    const ok = await uiConfirm('Pedir para servir como '+nome+' em '+dataLabel(m.data)+' · '+m.horario+'?');
    if(!ok) return;
    chip.disabled = true; const antes = chip.textContent; chip.textContent = '...';
    const { data: res } = await sb.rpc('acolitos_candidatar_vaga', { p_celebracao_id:m.celebracao_id, p_funcao:fn, p_motivo:null });
    if(res && res.ok){
      _eePedidos.add(m.celebracao_id+'|'+fn);
      chip.textContent = '✓ '+nome;
      showCeleb({ icon:'⛪', tag:'ESCALA EU!', hero:'Pedido enviado!', sub:'A coordenação vai confirmar sua escala.', sound:'star', autoClose:2600, done:renderHeroi });
    } else if(res && res.erro==='ja_candidatou'){
      _eePedidos.add(m.celebracao_id+'|'+fn);
      chip.textContent = '✓ '+nome;
      toast('Você já se candidatou a essa vaga.','error');
    } else {
      chip.disabled = false; chip.textContent = antes;
      toast('Não foi possível pedir.','error');
    }
  }
}
```

- [ ] **Step 3: Verificação manual — happy path**

Servir a pasta localmente e abrir a tela como um membro apto (ou a conta de teste `coord_admin` — `bot-teste@jcbplimeira.com` / `Coroinha-Bot-2026!`, que também é membro).

Run: `cd ~/iajcbp && python3 -m http.server 8080`
Abrir: `http://localhost:8080/projetos/acolitos/escalas-membro.html` → login → visão **Minhas** → sub-aba **Vagas**.

Expected:
- Herói **"ESCALA EU!"** pulsando, com selo "N missas precisam de você" (N = nº de missas distintas com vaga apta).
- Tocar no herói → lista de missas, cada uma com "K funções abertas pra você".
- Tocar numa missa → chips só das funções aptas com vaga; resumo da missa no topo; "‹ voltar" funciona nos dois níveis.
- Tocar num chip → `uiConfirm` → confirmar → overlay `showCeleb` "Pedido enviado!" (com som/confete) → fecha sozinho e volta ao herói.
- Abrir "Meus pedidos": a candidatura aparece como "Aguardando a coordenação". Na Caixa da coordenação, o pedido aparece no grupo Candidaturas.

- [ ] **Step 4: Verificação manual — vazio, duplicado e responsivo**

Expected:
- **Vazio:** membro sem nenhuma vaga apta vê o herói em estado **calmo** (sem pulso), texto "Tudo escalado por enquanto — volte depois.", e o herói não abre ao tocar.
- **Duplicado:** voltar ao mesmo chip já pedido → ele aparece "✓ <função>" e **desabilitado** (não deixa re-pedir). Se forçar via um segundo device e o backend responder `ja_candidatou`, o toast "Você já se candidatou a essa vaga." aparece e o chip vira "✓".
- **Responsivo:** no viewport de celular (DevTools ~375px), herói e chips não estouram a tela; chips quebram em 1–2 colunas; nada de scroll horizontal.

- [ ] **Step 5: Commit**

```bash
git add projetos/acolitos/escalas-membro.html
git commit -m "feat(acolitos): ESCALA EU! — card animado + fluxo guiado missa→função na aba Escalas"
```

---

### Task 3: Tela única — 4 seções empilhadas (rolagem)

Achata a navegação da tela Escalas: remove o seletor **Minhas/Todas** e as
sub-abas; `init()` passa a renderizar 4 seções em sequência dentro de
`#main-content`: **ESCALA EU!** (herói) → **Minhas missas** → **Meus pedidos**
→ **Todas as missas** (com toggle Próximas/Histórico preservado). As funções
de conteúdo não mudam — só onde são montadas. Remove o código órfão
(`renderMinhas`, `subTab`, `estiloSub`).

**Files:**
- Modify: `projetos/acolitos/escalas-membro.html` (CSS `.esc-secao`; corpo do `init()`; remoção de 3 funções órfãs)

**Interfaces:**
- Consumes (todas já existem e ficam intactas): `carregarVagas(body,ctx)` (Task 2), `carregarMinhasMissas(body,ctx)`, `carregarMeusPedidos(body,ctx)`, `pintarSemanas(cels,container,isCerimo,chamadasFeitas,modo)`, e os RPCs `acolitos_escalas_futuras`/`acolitos_escalas_passadas`.
- Produces: nada consumido por outras tasks.

- [ ] **Step 1: Adicionar o CSS do título de seção**

Em `projetos/acolitos/escalas-membro.html`, no bloco `<style>`, **logo após** a última regra `.ee-chip:disabled { ... }` adicionada na Task 2, inserir:

```css
    .esc-secao { font-family:'Sora',sans-serif; font-weight:800; font-size:15px; color:var(--gold-light); letter-spacing:.5px; margin:28px 0 10px; padding-bottom:6px; border-bottom:1px solid var(--border-wine); }
```

- [ ] **Step 2: Reescrever o corpo do `init()` para as 4 seções**

No `init()`, substituir o trecho que vai **da linha do hint** `const hint = document.createElement('p'); ... main.appendChild(hint);` **até imediatamente antes** do `}` que fecha o `init()` (ou seja: todo o bloco `visSel`/`areaMinhas`/`areaTodas`/`setVisao`, as abas Próximas/Histórico e a chamada `setVisao('minhas')`) por:

```javascript
  // ── Tela única: seções empilhadas (rolagem) ──
  function secaoTitulo(txt){ const h=document.createElement('div'); h.className='esc-secao'; h.textContent=txt; return h; }

  // 1) ESCALA EU! (herói + fluxo missa→função) — se anuncia sozinho, sem título
  const secVagas = document.createElement('div'); main.appendChild(secVagas);
  carregarVagas(secVagas, ctx);

  // 2) Minhas missas
  main.appendChild(secaoTitulo('Minhas missas'));
  const secMinhas = document.createElement('div'); main.appendChild(secMinhas);
  carregarMinhasMissas(secMinhas, ctx);

  // 3) Meus pedidos
  main.appendChild(secaoTitulo('Meus pedidos'));
  const secPed = document.createElement('div'); main.appendChild(secPed);
  carregarMeusPedidos(secPed, ctx);

  // 4) Todas as missas (browse read-only) — mantém toggle Próximas/Histórico
  main.appendChild(secaoTitulo('Todas as missas'));
  const secTodas = document.createElement('div'); main.appendChild(secTodas);
  const hintTodas = document.createElement('p'); hintTodas.style.cssText='font-size:12px;color:var(--text-muted);margin:-2px 0 8px;'; hintTodas.textContent='Toque numa missa para ver quem está escalado.'; secTodas.appendChild(hintTodas);
  const tabs = document.createElement('div'); tabs.style.cssText='display:flex;gap:8px;margin-bottom:8px;';
  const tabProx=document.createElement('button'); tabProx.textContent='Próximas';
  const tabHist=document.createElement('button'); tabHist.textContent='Histórico';
  tabs.append(tabProx, tabHist); secTodas.appendChild(tabs);
  const wrap = document.createElement('div'); secTodas.appendChild(wrap);

  function setActive(modo){
    const on='flex:1;cursor:pointer;border-radius:8px;padding:8px;background:var(--gold);color:#1a0e10;border:1px solid var(--gold);font-weight:700;font-family:Sora,sans-serif;';
    const off='flex:1;cursor:pointer;border-radius:8px;padding:8px;background:transparent;color:var(--text-muted);border:1px solid var(--border);font-family:Sora,sans-serif;';
    tabProx.style.cssText = modo==='futuras'?on:off;
    tabHist.style.cssText = modo==='passadas'?on:off;
  }
  async function carregar(modo){
    setActive(modo);
    wrap.textContent=''; const ld=document.createElement('span'); ld.className='loading'; ld.textContent='Carregando...'; wrap.appendChild(ld);
    const rpc = modo==='passadas' ? 'acolitos_escalas_passadas' : 'acolitos_escalas_futuras';
    const { data, error } = await sb.rpc(rpc);
    wrap.textContent='';
    if (error) { const e=document.createElement('span'); e.className='empty'; e.textContent='Não foi possível carregar as escalas.'; wrap.appendChild(e); return; }
    const cels = data || [];
    if (!cels.length) { const e=document.createElement('span'); e.className='empty'; e.textContent = modo==='passadas' ? 'Nenhuma missa no histórico.' : 'Nenhuma missa futura cadastrada.'; wrap.appendChild(e); return; }
    let chamadasFeitas = new Set();
    if (isCerimo) { try { const { data: chs } = await sb.from('acolitos_chamadas').select('celebracao_id'); (chs||[]).forEach(x => chamadasFeitas.add(x.celebracao_id)); } catch (e) {} }
    pintarSemanas(cels, wrap, isCerimo, chamadasFeitas, modo);
  }
  tabProx.onclick=()=>carregar('futuras');
  tabHist.onclick=()=>carregar('passadas');
  carregar('futuras');
```

Observação: a linha original do hint genérico (`const hint = ...`) é **removida** (o hint agora vive dentro da seção "Todas as missas" como `hintTodas`). A `const title` acima do hint permanece.

- [ ] **Step 3: Remover as 3 funções órfãs**

Depois do Step 2, `renderMinhas`, `subTab` e `estiloSub` não têm mais nenhum chamador. Remover as três definições inteiras de `projetos/acolitos/escalas-membro.html`:
- `function subTab(label){ ... }` (bloco de ~3 linhas)
- `function estiloSub(b,on){ ... }` (bloco de ~2 linhas)
- `function renderMinhas(area, ctx){ ... }` (bloco que vai de `function renderMinhas` até seu `}` de fechamento, ~16 linhas)

Antes de remover, confirmar zero chamadores com grep; depois de remover, confirmar que sumiram e que não sobrou referência:

```bash
grep -n "renderMinhas\|subTab\|estiloSub" projetos/acolitos/escalas-membro.html
```
Expected após remoção: **nenhuma linha** (saída vazia).

- [ ] **Step 4: Validar sintaxe e core**

Run: `node projetos/acolitos/solicitacoes-core.test.js`
Expected: `TODOS OK`.

Extrair o conteúdo do `<script>` inline principal para um `.js` temporário e rodar `node --check` nele.
Expected: sem SyntaxError (só globais de browser, que `node --check` não avalia).

Confirmar que `carregarVagas`, `carregarMinhasMissas`, `carregarMeusPedidos`, `pintarSemanas` continuam definidas exatamente uma vez cada:

```bash
grep -c "function carregarVagas\|carregarVagas(secVagas" projetos/acolitos/escalas-membro.html
```

- [ ] **Step 5: Verificação manual — a rolagem de 4 seções**

`cd ~/iajcbp && python3 -m http.server 8080`, abrir `escalas-membro.html`, logar.
Expected:
- Uma rolagem única, sem seletor Minhas/Todas nem sub-abas.
- Ordem: herói **ESCALA EU!** → título **Minhas missas** + conteúdo → título **Meus pedidos** + conteúdo → título **Todas as missas** + hint + toggle Próximas/Histórico + lista.
- O herói ainda abre missa → função e o "‹ voltar" recolhe, tudo dentro da 1ª seção sem afetar as outras.
- Toggle Próximas/Histórico na seção Todas funciona (troca a lista).
- Celular (~375px): títulos e cards não estouram; rolagem vertical limpa.

- [ ] **Step 6: Commit**

```bash
git add projetos/acolitos/escalas-membro.html
git commit -m "feat(acolitos): Escalas em tela única — ESCALA EU! + Minhas missas + Meus pedidos + Todas (remove seletor/sub-abas)"
```

---

## Self-Review

**Spec coverage:**
- Substituir conteúdo da sub-aba Vagas pelo ESCALA EU! → Task 2 (Steps 1–2). ✅
- Fluxo guiado missa → função → Task 2 (`renderMissas`/`renderFuncoes`). ✅
- Passo 2 só funções com vaga aberta E apto → garantido pelo RPC + helper Task 1. ✅
- É pedido (candidatura), não auto-escala → `acolitos_candidatar_vaga` em `pedir`. ✅
- Estado herói/vazio/animação → Task 2 (`renderHeroi`, classes `pulsa`/`calmo`, `showCeleb`). ✅
- Marcar "✓ Pedido enviado" (candidatura pendente ≠ escalado) → `_eePedidos` Set. ✅
- Reuso `showCeleb`/`toast`/`uiConfirm` e regras da casa → Global Constraints + Task 2. ✅
- Extração testável `agruparVagasPorMissa` → Task 1. ✅
- Não mexer em Minhas missas / Meus pedidos / Todas / backend → escopo Task 2 (só `carregarVagas` + CSS). ✅

**Placeholder scan:** nenhum TBD/TODO; todo passo tem código ou comando concreto e resultado esperado. ✅

**Type consistency:** `agruparVagasPorMissa` produz `{...,funcoes:string[]}`; consumido em Task 2 via `m.funcoes`, `m.celebracao_id`, `m.data`, `m.horario`, `m.comunidade` — bate. Chave do Set `celebracao_id+'|'+fn` idêntica em `renderFuncoes` e `pedir`. RPC de envio `acolitos_candidatar_vaga(p_celebracao_id,p_funcao,p_motivo)` bate com a assinatura usada hoje no código. ✅
