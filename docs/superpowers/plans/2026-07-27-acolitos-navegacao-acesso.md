# Navegação — arrumar o acesso · Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer a Caixa de Aprovações e a tela de Conquistas alcançáveis pela barra de navegação, com o item ativo sempre visível e rótulos que descrevem o destino — sem criar, fundir ou remover nenhuma tela.

**Architecture:** A montagem da lista de itens da barra sai de dentro de `renderBottomNav` (que mexe no DOM) e vira uma função pura em `navegacao-core.js`, seguindo o padrão `solicitacoes-core.js` que já existe no projeto (UMD: global no browser, `module.exports` no node). Isso dá um harness de teste real para todas as decisões de navegação seguintes. O resto são edições pontuais em `shared.js`, `shared.css`, `config.html` e `ausencias.html`.

**Tech Stack:** JavaScript sem build (scripts soltos + `shared.js` global), Supabase JS v2, testes com `node --test` (runner nativo, sem dependências).

## Global Constraints

- **Nenhuma tela é criada, fundida ou removida.** Só muda de onde se chega nelas.
- **O menu `⋯ Mais` da Escala não é tocado.** O dono usa Modelos, Ausências, Registrar ausência, Frequência e Faltas de dentro da Escala.
- **Português literal, sem jargão**, em qualquer texto que apareça na tela.
- **Responsivo:** nada pode estourar a lateral em 390px de largura.
- **Sem emoji como ícone** em elemento visual — usar SVG via `_svgIcon`.
- **Modais só com `uiConfirm`/`uiAlert`/`uiPrompt`**, nunca `confirm`/`alert` nativos.
- **Não mexer em dados reais** para testar: não conceder/remover permissão de pessoa real, não semear registro. Usar simulação no cliente ou a conta de teste `bot-teste@jcbplimeira.com` / `Coroinha-Bot-2026!`.
- **Ids de item da barra são contrato:** `nav_ordem_coord` e `nav_ordem_jornada` já estão gravados no banco com os ids atuais. Nunca renomear um id existente — só adicionar novos e mudar `label`.
- Rodar tudo com um servidor estático local na porta **8177** (`python3 -m http.server 8177 --bind 127.0.0.1` a partir da raiz do repo), nunca na 5173.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade | Ação |
|---|---|---|
| `projetos/acolitos/navegacao-core.js` | Decidir **quais** itens a barra mostra e em que ordem. Puro, sem DOM, sem rede. | Criar |
| `projetos/acolitos/navegacao-core.test.js` | Testes da função acima. | Criar |
| `projetos/acolitos/shared.js` | Renderizar a barra no DOM, ícones, constantes de módulo, rolagem. | Modificar |
| `projetos/acolitos/shared.css` | Estilo do contador na barra. | Modificar |
| `projetos/acolitos/config.html` | Listar os itens novos no editor de ordem da barra. | Modificar |
| `projetos/acolitos/ausencias.html` | Gatear o bloco de aprovações pela permissão `caixa`. | Modificar |
| Todas as telas com `<script src="shared.js">` | Carregar `navegacao-core.js` antes do `shared.js`. | Modificar |

---

### Task 1: Extrair a montagem da barra para um core testável

Refactor puro: nenhum comportamento muda. Existe para dar teste às tarefas seguintes.

**Files:**
- Create: `projetos/acolitos/navegacao-core.js`
- Create: `projetos/acolitos/navegacao-core.test.js`
- Modify: `projetos/acolitos/shared.js` (dentro de `renderBottomNav`, hoje linhas 1613-1633)
- Modify: todas as telas que carregam `shared.js` (adicionar `<script src="navegacao-core.js"></script>` **antes**)

**Interfaces:**
- Produces: `montarItensNav(opts)` onde
  `opts = { modo: 'coordenacao'|'jornada', perms: string[], isAdmin: boolean, isSuperadmin: boolean, ordemCfg: string[]|null, modulos: object, ordemModulos: string[] }`
  e o retorno é `Array<{ id: string, href: string, label: string, icon: string }>`.
  `modulos` recebe `NAV_COORD_MODULOS` e `ordemModulos` recebe `ORDEM_MODULOS` — injetados para o core não depender de globais.

- [ ] **Step 1: Escrever o teste que falha**

Criar `projetos/acolitos/navegacao-core.test.js`:

```js
// Testes da montagem da barra de navegação.
// Rodar: node --test projetos/acolitos/navegacao-core.test.js
const test = require('node:test');
const assert = require('node:assert');
const { montarItensNav } = require('./navegacao-core.js');

const MODULOS = {
  jornada:    { label:'Jornada',    href:'jornada-admin.html', icon:'star' },
  membros:    { label:'Membros',    href:'membros.html',    icon:'users' },
  escala:     { label:'Escala',     href:'escala.html',     icon:'calendar' },
  crm:        { label:'CRM',        href:'crm.html',        icon:'shuffle' },
  tesouraria: { label:'Tesouraria', href:'tesouraria.html', icon:'dollar' },
  casas:      { label:'Casas',      href:'casas.html',      icon:'shield' },
};
const ORDEM = ['jornada','membros','escala','crm','tesouraria','casas'];
const base = { modulos: MODULOS, ordemModulos: ORDEM, ordemCfg: null, isSuperadmin: false };
const ids = (r) => r.map(x => x.id);

test('coordenação: sem permissão nenhuma, sobram só os itens fixos', () => {
  const r = montarItensNav({ ...base, modo:'coordenacao', perms:[], isAdmin:false });
  assert.deepStrictEqual(ids(r), ['home','agenda']);
});

test('coordenação: cada permissão acrescenta seu módulo, na ordem de ORDEM_MODULOS', () => {
  const r = montarItensNav({ ...base, modo:'coordenacao', perms:['casas','escala'], isAdmin:false });
  assert.deepStrictEqual(ids(r), ['home','agenda','escala','casas']);
});

test('coordenação: Config só aparece para superadmin', () => {
  const sem = montarItensNav({ ...base, modo:'coordenacao', perms:[], isAdmin:true });
  assert.ok(!ids(sem).includes('config'));
  const com = montarItensNav({ ...base, modo:'coordenacao', perms:[], isAdmin:true, isSuperadmin:true });
  assert.ok(ids(com).includes('config'));
});

test('jornada: lista fixa, independente de permissão', () => {
  const r = montarItensNav({ ...base, modo:'jornada', perms:[], isAdmin:false });
  assert.deepStrictEqual(ids(r),
    ['home','quests','escalas-membro','agenda','destaques','minha-casa','ausencias']);
});

test('a ordem salva no Config reordena, e quem não está nela vai pro fim', () => {
  const semOrdem = montarItensNav({ ...base, modo:'jornada', perms:[], isAdmin:false });
  const r = montarItensNav({
    ...base, modo:'jornada', perms:[], isAdmin:false,
    ordemCfg: ['agenda','home'],
  });
  assert.deepStrictEqual(ids(r).slice(0, 2), ['agenda','home']);
  // compara com o total real, NÃO com um número fixo: a barra do membro ganha
  // itens ao longo do plano (Conquistas na Task 6) e um 7 cravado aqui quebraria lá.
  assert.strictEqual(ids(r).length, semOrdem.length);
  assert.ok(ids(r).length >= 7);
});

test('cada item tem id, href, label e icon preenchidos', () => {
  const r = montarItensNav({ ...base, modo:'coordenacao', perms:['membros'], isAdmin:false });
  for (const item of r) {
    for (const campo of ['id','href','label','icon']) {
      assert.ok(item[campo], `item ${item.id} sem ${campo}`);
    }
  }
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `node --test projetos/acolitos/navegacao-core.test.js`
Expected: FAIL — `Cannot find module './navegacao-core.js'`

- [ ] **Step 3: Escrever o core**

Criar `projetos/acolitos/navegacao-core.js`:

```js
// Montagem da barra de navegação — QUEM aparece e em QUE ordem. PURO (sem DOM, sem rede).
// Usado por shared.js (renderBottomNav) e testável em node, igual solicitacoes-core.js.
// Os ids são contrato: estão gravados em acolitos_config.nav_ordem_coord/nav_ordem_jornada.
// Pode acrescentar id novo; NUNCA renomear id existente.
(function (global) {
  'use strict';

  var ITENS_JORNADA = [
    { id:'home',            href:'index.html',           label:'Início',    icon:'home' },
    { id:'quests',          href:'missoes.html',         label:'Quests',    icon:'star' },
    { id:'escalas-membro',  href:'escalas-membro.html',  label:'Escalas',   icon:'calendar' },
    { id:'agenda',          href:'agenda.html',          label:'Agenda',    icon:'calendar-days' },
    { id:'destaques',       href:'destaques.html',       label:'Destaques', icon:'star' },
    { id:'minha-casa',      href:'minha-casa.html',      label:'Casa',      icon:'shield' },
    { id:'ausencias',       href:'ausencias.html',       label:'Ausência',  icon:'x-circle' },
  ];

  var ITENS_COORD_FIXOS = [
    { id:'home',   href:'index.html',  label:'Início', icon:'home' },
    { id:'agenda', href:'agenda.html', label:'Agenda', icon:'calendar-days' },
  ];

  function montarItensNav(opts) {
    opts = opts || {};
    var itens;

    if (opts.modo === 'coordenacao') {
      itens = ITENS_COORD_FIXOS.map(function (x) { return Object.assign({}, x); });
      (opts.ordemModulos || []).forEach(function (chave) {
        if ((opts.perms || []).indexOf(chave) === -1) return;
        var mod = (opts.modulos || {})[chave];
        if (!mod) return;
        itens.push({ id: chave, href: mod.href, label: mod.label, icon: mod.icon });
      });
      if (opts.isSuperadmin) {
        itens.push({ id:'config', href:'config.html', label:'Config', icon:'settings' });
      }
    } else {
      itens = ITENS_JORNADA.map(function (x) { return Object.assign({}, x); });
    }

    // Ordem customizável (Config › Navegação). Quem não está na lista vai pro fim.
    var ord = opts.ordemCfg;
    if (Array.isArray(ord) && ord.length) {
      itens.sort(function (a, b) {
        var ia = ord.indexOf(a.id), ib = ord.indexOf(b.id);
        return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
      });
    }
    return itens;
  }

  var api = { montarItensNav: montarItensNav };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { global.montarItensNav = montarItensNav; }
})(typeof globalThis !== 'undefined' ? globalThis : this);
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `node --test projetos/acolitos/navegacao-core.test.js`
Expected: PASS — `pass 6`, `fail 0`

- [ ] **Step 5: Ligar o core no `renderBottomNav`**

Em `projetos/acolitos/shared.js`, substituir o trecho que hoje monta e ordena `items` (da linha `let items;` até o fecho do `if (Array.isArray(_ordCfg) ...)`) por:

```js
  const _ordCfg = (typeof cfg === 'function') ? cfg(mode === 'coordenacao' ? 'nav_ordem_coord' : 'nav_ordem_jornada', null) : null;
  const items = montarItensNav({
    modo: mode,
    perms: c.perms,
    isAdmin: c.isAdmin,
    isSuperadmin: isSuperadmin(ctx),
    ordemCfg: _ordCfg,
    modulos: NAV_COORD_MODULOS,
    ordemModulos: ORDEM_MODULOS,
  });
```

Apagar o comentário "Chamada foi fundida na Escala…" junto com o bloco antigo (ele foi para o core).

- [ ] **Step 6: Carregar o core em todas as telas**

Em **cada** arquivo que tem `<script src="shared.js"></script>`, inserir a linha imediatamente antes:

```html
<script src="navegacao-core.js"></script>
```

Descobrir a lista exata com:

```bash
grep -l 'src="shared.js"' projetos/acolitos/*.html
```

- [ ] **Step 7: Verificar no navegador que nada mudou**

```bash
cd /Users/erickmartins/iajcbp && python3 -m http.server 8177 --bind 127.0.0.1 &
```

Entrar com a conta de teste, abrir `index.html` e conferir no console:

```js
[...document.querySelectorAll('.nav-item')].map(e => e.textContent.trim())
```

Expected: exatamente a mesma barra de antes do refactor. Se mudou, o refactor quebrou algo.

- [ ] **Step 8: Commit**

```bash
git add projetos/acolitos/navegacao-core.js projetos/acolitos/navegacao-core.test.js projetos/acolitos/shared.js projetos/acolitos/*.html
git commit -m "refactor(nav): montagem da barra vira core puro e testável"
```

---

### Task 2: Rolar até o item ativo

**Files:**
- Modify: `projetos/acolitos/shared.js` — `setupNavArrows`, hoje linhas 1652-1669

**Interfaces:**
- Consumes: nada de Task 1.
- Produces: nada para tarefas seguintes.

- [ ] **Step 1: Ler a função atual**

`setupNavArrows(el)` já cria as setas `‹ ›`, calcula transbordo em `upd()` e pisca a seta direita por 2,6s dentro de um `requestAnimationFrame`.

- [ ] **Step 2: Acrescentar a rolagem até o ativo**

Substituir a última linha da função:

```js
  requestAnimationFrame(() => { upd(); if (!right.hidden) { right.classList.add('hint'); setTimeout(() => right.classList.remove('hint'), 2600); } });
```

por:

```js
  // Numa barra que rola, a tela pode abrir com o item ativo fora da vista.
  // Centraliza o ativo ANTES de medir as setas, senão elas mostram o estado errado.
  const centralizarAtivo = () => {
    const ativo = el.querySelector('.nav-item.active');
    if (!ativo || el.scrollWidth - el.clientWidth <= 4) return;
    const alvo = ativo.offsetLeft - (el.clientWidth - ativo.offsetWidth) / 2;
    el.scrollLeft = Math.max(0, Math.min(alvo, el.scrollWidth - el.clientWidth));
  };
  requestAnimationFrame(() => {
    centralizarAtivo();
    upd();
    if (!right.hidden) { right.classList.add('hint'); setTimeout(() => right.classList.remove('hint'), 2600); }
  });
```

- [ ] **Step 3: Verificar em 390px**

Com o servidor da porta 8177 no ar e logado, abrir a **última** tela da barra (hoje `minha-casa.html` no modo jornada) num viewport de 390×844 e rodar no console:

```js
(() => {
  const nav = document.querySelector('.app-nav');
  const at = nav.querySelector('.nav-item.active');
  const r = at.getBoundingClientRect(), n = nav.getBoundingClientRect();
  return { visivel: r.left >= n.left - 1 && r.right <= n.right + 1, item: at.textContent.trim() };
})()
```

Expected: `{ visivel: true, item: 'Casa' }`

- [ ] **Step 4: Verificar que barra curta não rola sozinha**

Abrir `index.html` com uma barra que cabe inteira (ex.: simulando poucas permissões) e conferir `document.querySelector('.app-nav').scrollLeft`.
Expected: `0`

- [ ] **Step 5: Commit**

```bash
git add projetos/acolitos/shared.js
git commit -m "fix(nav): rolar a barra até o item ativo ao abrir a tela"
```

---

### Task 3: Caixa de Aprovações como módulo liberável na barra

**Files:**
- Modify: `projetos/acolitos/shared.js` — `MODULOS_LIBERAVEIS`, `NAV_COORD_MODULOS`, `ORDEM_MODULOS`, `_svgIcon`
- Modify: `projetos/acolitos/config.html` — `NAV_ITENS.coord` (linha 366)
- Modify: `projetos/acolitos/navegacao-core.test.js`

**Interfaces:**
- Consumes: `montarItensNav` da Task 1.
- Produces: a chave de permissão `'caixa'`, consumida pela Task 5.

- [ ] **Step 1: Escrever o teste que falha**

Acrescentar ao fim de `navegacao-core.test.js`:

```js
test('caixa aparece na coordenação só para quem tem a permissão', () => {
  const MOD = Object.assign({}, MODULOS, {
    caixa: { label:'Caixa', href:'ausencias.html', icon:'inbox' },
  });
  const ORD = ['jornada','caixa','membros','escala','crm','tesouraria','casas'];
  const sem = montarItensNav({ ...base, modulos:MOD, ordemModulos:ORD, modo:'coordenacao', perms:['escala'], isAdmin:false });
  assert.ok(!ids(sem).includes('caixa'));
  const com = montarItensNav({ ...base, modulos:MOD, ordemModulos:ORD, modo:'coordenacao', perms:['escala','caixa'], isAdmin:false });
  assert.ok(ids(com).includes('caixa'));
  assert.strictEqual(com.find(x => x.id === 'caixa').href, 'ausencias.html');
});
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `node --test projetos/acolitos/navegacao-core.test.js`
Expected: FAIL no teste novo (o core recebe `modulos`/`ordemModulos` injetados, então esse teste passa sozinho — se passar de primeira, confirme que o `assert.ok(!ids(sem).includes('caixa'))` realmente roda; a falha real aparece no Step 5, no app).

- [ ] **Step 3: Registrar o módulo em `shared.js`**

Em `MODULOS_LIBERAVEIS`, acrescentar como segundo item (logo após `jornada`):

```js
  ['caixa','Caixa de Aprovações','ausencias.html'],
```

Em `NAV_COORD_MODULOS`, acrescentar após a linha de `jornada`:

```js
  caixa:      { label:'Caixa',      href:'ausencias.html',  icon:'inbox' },
```

Em `ORDEM_MODULOS`, passar a:

```js
const ORDEM_MODULOS = ['jornada','caixa','membros','escala','crm','tesouraria','casas']; // chamada fundida na Escala
```

- [ ] **Step 4: Criar o ícone `inbox`**

Em `_svgIcon` (`shared.js:1554`), acrescentar ao objeto `d`, logo antes da linha `settings:`:

```js
    inbox:          'M22 12h-6l-2 3h-4l-2-3H2 M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z',
```

- [ ] **Step 5: Listar no editor de ordem**

Em `projetos/acolitos/config.html` linha 366, acrescentar `['caixa','Caixa']` logo após `['jornada','Jornada']`:

```js
  coord:   [['home','Início'],['agenda','Agenda'],['jornada','Jornada'],['caixa','Caixa'],['membros','Membros'],['escala','Escala'],['crm','CRM'],['tesouraria','Tesouraria'],['casas','Casas'],['config','Config']],
```

- [ ] **Step 6: Rodar os testes**

Run: `node --test projetos/acolitos/navegacao-core.test.js`
Expected: PASS — `pass 7`, `fail 0`

- [ ] **Step 7: Verificar no navegador sem tocar em dado real**

Com o servidor na 8177, logado como coordenação, rodar no console:

```js
montarItensNav({ modo:'coordenacao', perms:['caixa'], isAdmin:false, isSuperadmin:false,
  ordemCfg:null, modulos:NAV_COORD_MODULOS, ordemModulos:ORDEM_MODULOS }).map(x => x.id)
```

Expected: `['home','agenda','caixa']`

E conferir que o ícone existe: `_svgIcon('inbox').includes('<path d="M22 12h-6')` → `true`

- [ ] **Step 8: Commit**

```bash
git add projetos/acolitos/shared.js projetos/acolitos/config.html projetos/acolitos/navegacao-core.test.js
git commit -m "feat(nav): Caixa de Aprovações vira módulo liberável na barra da coordenação"
```

---

### Task 4: Contador de pendências na Caixa

**Files:**
- Modify: `projetos/acolitos/shared.css` — bloco novo após `.nav-item.active::before`
- Modify: `projetos/acolitos/shared.js` — `renderBottomNav`

**Interfaces:**
- Consumes: o item `caixa` da Task 3.
- Produces: `pintarContadorCaixa(el)` — busca as pendências e pinta o número; não retorna nada.

- [ ] **Step 1: Estilo do contador**

Em `projetos/acolitos/shared.css`, após o bloco `.nav-item.active::before { ... }`, acrescentar:

```css
/* Contador de pendências sobre o ícone da barra (ex.: Caixa de Aprovações) */
.nav-badge {
  position: absolute; top: 4px; left: 50%; margin-left: 4px;
  min-width: 16px; height: 16px; padding: 0 4px;
  display: flex; align-items: center; justify-content: center;
  background: var(--red-soft); color: #fff;
  font-family: 'Sora', sans-serif; font-size: 9px; font-weight: 700; line-height: 1;
  border-radius: 9px; box-shadow: 0 0 8px var(--red-glow);
  pointer-events: none;
}
```

`.nav-item` já é `position: relative`, então o `absolute` ancora nele.

- [ ] **Step 2: Buscar e pintar**

Em `shared.js`, logo **antes** de `function setupNavArrows(el) {`, acrescentar:

```js
// Contador de pendências no item Caixa. Roda DEPOIS do render (a barra não espera
// rede pra aparecer) e reaproveita as mesmas RPCs do aviso da Home.
// O item nunca some: sem pendência, só não há número.
async function pintarContadorCaixa(el) {
  const item = el.querySelector('.nav-item[data-id="caixa"]');
  if (!item) return;
  try {
    const [{ data: sol }, { data: aus }] = await Promise.all([
      sb.rpc('acolitos_solicitacoes_pendentes'),
      sb.rpc('acolitos_ausencia_pendente_listar'),
    ]);
    const nSol = sol ? (((sol.trocas || []).length) + ((sol.candidaturas || []).length) + ((sol.cobrir || []).length)) : 0;
    const nAus = aus ? ((aus.pendentes || []).length) : 0;
    const total = nSol + nAus;
    const velho = item.querySelector('.nav-badge');
    if (velho) velho.remove();
    if (!total) return;
    const b = document.createElement('span');
    b.className = 'nav-badge';
    b.textContent = total > 99 ? '99+' : String(total);
    item.appendChild(b);
  } catch (e) { /* contador é enfeite: falhou, a barra continua funcionando */ }
}
```

- [ ] **Step 3: Marcar o item e disparar a busca**

Em `renderBottomNav`, dentro do `items.forEach`, logo após `a.href = item.href;`, acrescentar:

```js
    a.dataset.id = item.id;
```

E logo após `setupNavArrows(el);`, acrescentar:

```js
  pintarContadorCaixa(el);   // sem await: a barra não espera a rede
```

- [ ] **Step 4: Verificar com pendência**

Logado como coordenação com a permissão `caixa`, abrir qualquer tela e rodar:

```js
(async () => {
  await new Promise(r => setTimeout(r, 2500));
  const b = document.querySelector('.nav-item[data-id="caixa"] .nav-badge');
  const { data: s } = await sb.rpc('acolitos_solicitacoes_pendentes');
  const { data: a } = await sb.rpc('acolitos_ausencia_pendente_listar');
  const esperado = ((s?.trocas||[]).length + (s?.candidaturas||[]).length + (s?.cobrir||[]).length) + ((a?.pendentes||[]).length);
  return { naTela: b ? b.textContent : '(sem número)', esperado };
})()
```

Expected: `naTela` igual a `esperado`, ou `(sem número)` quando `esperado` é `0`.

- [ ] **Step 5: Verificar que o item não some com zero**

Com `esperado === 0`, conferir:

```js
!!document.querySelector('.nav-item[data-id="caixa"]')
```

Expected: `true` — esse era exatamente o bug do aviso da Home.

- [ ] **Step 6: Commit**

```bash
git add projetos/acolitos/shared.js projetos/acolitos/shared.css
git commit -m "feat(nav): contador de pendências no item Caixa (some o número, não o item)"
```

---

### Task 5: Gatear o bloco de aprovações no `ausencias.html`

**Files:**
- Modify: `projetos/acolitos/ausencias.html` — `init()` (linhas 287-302) e `renderViewEquipe()` (linhas 579-588)

**Interfaces:**
- Consumes: a chave `'caixa'` da Task 3 e `navCaps` de `shared.js`.

**Contexto que o implementador precisa saber:** esta tela serve dois públicos no mesmo arquivo. Qualquer membro logado usa "Informar Ausência"; equipe e **cerimoniários** (22 pessoas hoje) caem em `renderViewEquipe`, que mistura duas coisas: **aprovações** (`renderCaixaSolicitacoes` + `renderPendentesPublicas`) e **operação de ausências** (registrar por outro, KPIs, lista, motivos).

**Passar `{ perm: 'caixa' }` no `initModulo` desta tela seria uma regressão grave** — trancaria os 171 membros para fora da própria ausência. O gate vai no bloco, não na porta.

- [ ] **Step 1: Gatear as duas partes de aprovação**

Em `init()`, trocar:

```js
  if (EQUIPE_ROLES.includes(_r) || _r === 'cerimonario') {
    await renderViewEquipe();
    renderPendentesPublicas();
  }
  else renderViewMembro();
```

por:

```js
  // ATENÇÃO: o gate de 'caixa' é sobre o BLOCO DE APROVAÇÕES, nunca sobre a tela.
  // Esta tela é a única do app com dois públicos no mesmo arquivo: todo membro
  // precisa dela pra informar ausência. Não troque isto por initModulo({perm:'caixa'}).
  const _caps = navCaps(ctx);
  podeAprovar = _caps.isAdmin || _caps.perms.includes('caixa');
  if (EQUIPE_ROLES.includes(_r) || _r === 'cerimonario') {
    await renderViewEquipe();
    if (podeAprovar) renderPendentesPublicas();
  }
  else renderViewMembro();
```

E declarar a variável junto das outras globais do topo do `<script>`:

```js
let podeAprovar = false;
```

- [ ] **Step 2: Gatear a caixa dentro da view de equipe**

Em `renderViewEquipe()`, trocar:

```js
  const caixaBox = document.createElement('div');
  main.appendChild(caixaBox);
  renderCaixaSolicitacoes(caixaBox);
```

por:

```js
  // Só quem tem a permissão 'caixa' aprova. Cerimoniário continua com o resto da
  // tela (registrar ausência de outro, KPIs, lista) — a RLS já libera isso pra ele.
  if (podeAprovar) {
    const caixaBox = document.createElement('div');
    main.appendChild(caixaBox);
    renderCaixaSolicitacoes(caixaBox);
  }
```

- [ ] **Step 3: Verificar que membro comum não perdeu nada**

Com a conta de teste, simular membro no console **antes** de abrir a tela não é possível (o roteamento é por papel real). Em vez disso, conferir por leitura que `renderViewMembro` não foi tocada e que `initModulo()` continua sem `perm`:

```bash
grep -n "initModulo" projetos/acolitos/ausencias.html
```

Expected: `ctx = await initModulo();` — sem segundo argumento.

- [ ] **Step 4: Verificar o gate na prática**

Logado como coordenação (que é admin, então `podeAprovar` é `true`), abrir `ausencias.html` e conferir que a caixa aparece:

```js
document.body.textContent.includes('Novos cadastros') || document.body.textContent.includes('Cobrir')
```

Expected: `true`

Depois simular sem a permissão, sem tocar em dado real — no console, antes de recarregar:

```js
const orig = navCaps;
navCaps = (ctx) => ({ ...orig(ctx), isAdmin:false, perms:[] });
init();
```

Expected: a tela monta, "Ausências Informadas" e "+ Registrar ausência" continuam lá, e o bloco de aprovações não.

- [ ] **Step 5: Commit**

```bash
git add projetos/acolitos/ausencias.html
git commit -m "feat(caixa): aprovações gateadas por permissão sem trancar a tela de ausência"
```

---

### Task 6: Conquistas na barra do membro e rótulos por público

**Files:**
- Modify: `projetos/acolitos/navegacao-core.js` — `ITENS_JORNADA`
- Modify: `projetos/acolitos/navegacao-core.test.js`
- Modify: `projetos/acolitos/shared.js` — `_svgIcon` (ícone `award`)
- Modify: `projetos/acolitos/config.html` — `NAV_ITENS.jornada` (linha 365)

**Interfaces:**
- Consumes: `montarItensNav` da Task 1.

- [ ] **Step 1: Escrever o teste que falha**

Acrescentar em `navegacao-core.test.js`:

```js
test('jornada: Conquistas está na barra e Ausência virou Faltar', () => {
  const r = montarItensNav({ ...base, modo:'jornada', perms:[], isAdmin:false });
  const conq = r.find(x => x.id === 'conquistas');
  assert.ok(conq, 'conquistas deveria estar na barra do membro');
  assert.strictEqual(conq.href, 'conquistas.html');
  assert.strictEqual(r.find(x => x.id === 'ausencias').label, 'Faltar');
});

test('jornada: o id ausencias NÃO muda (contrato com nav_ordem_jornada)', () => {
  const r = montarItensNav({ ...base, modo:'jornada', perms:[], isAdmin:false });
  assert.ok(r.some(x => x.id === 'ausencias'));
});
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `node --test projetos/acolitos/navegacao-core.test.js`
Expected: FAIL — `conquistas deveria estar na barra do membro`

- [ ] **Step 3: Atualizar a expectativa do teste da Task 1**

A barra do membro muda de verdade nesta task, então o teste `'jornada: lista fixa, independente de permissão'` (escrito na Task 1) tem de refletir a lista nova. **Isto é esperado, não é um teste quebrado.** Trocar o `deepStrictEqual` dele por:

```js
  assert.deepStrictEqual(ids(r),
    ['home','quests','escalas-membro','agenda','conquistas','destaques','minha-casa','ausencias']);
```

- [ ] **Step 4: Ajustar o core**

Em `navegacao-core.js`, `ITENS_JORNADA` passa a:

```js
  var ITENS_JORNADA = [
    { id:'home',            href:'index.html',           label:'Início',     icon:'home' },
    { id:'quests',          href:'missoes.html',         label:'Quests',     icon:'star' },
    { id:'escalas-membro',  href:'escalas-membro.html',  label:'Escalas',    icon:'calendar' },
    { id:'agenda',          href:'agenda.html',          label:'Agenda',     icon:'calendar-days' },
    { id:'conquistas',      href:'conquistas.html',      label:'Conquistas', icon:'award' },
    { id:'destaques',       href:'destaques.html',       label:'Destaques',  icon:'star' },
    { id:'minha-casa',      href:'minha-casa.html',      label:'Casa',       icon:'shield' },
    // id 'ausencias' é contrato com nav_ordem_jornada — só o rótulo muda.
    // "Faltar" diz o que a tela faz pro membro; pra equipe a mesma tela é a Caixa.
    { id:'ausencias',       href:'ausencias.html',       label:'Faltar',     icon:'x-circle' },
  ];
```

- [ ] **Step 5: Criar o ícone `award`**

Em `_svgIcon` (`shared.js`), acrescentar ao objeto `d`, logo antes de `settings:`:

```js
    award:          'M12 15a7 7 0 1 0 0-14 7 7 0 0 0 0 14z M8.21 13.89L7 23l5-3 5 3-1.21-9.12',
```

- [ ] **Step 6: Listar no editor de ordem**

Em `config.html` linha 365, `NAV_ITENS.jornada` passa a:

```js
  jornada: [['home','Início'],['quests','Quests'],['escalas-membro','Escalas'],['agenda','Agenda'],['conquistas','Conquistas'],['destaques','Destaques'],['minha-casa','Casa'],['ausencias','Faltar']],
```

- [ ] **Step 7: Rodar os testes**

Run: `node --test projetos/acolitos/navegacao-core.test.js`
Expected: PASS — `pass 9`, `fail 0`

- [ ] **Step 8: Verificar no navegador em 390px**

Logado como membro (ou no modo Minha Jornada), conferir:

```js
({
  barra: [...document.querySelectorAll('.nav-item')].map(e => e.textContent.trim()),
  estouraLateral: document.documentElement.scrollWidth > window.innerWidth,
})
```

Expected: `Conquistas` presente, `Faltar` no lugar de `Ausência`, `estouraLateral: false`.

- [ ] **Step 9: Verificar que a ordem salva não quebrou**

`nav_ordem_jornada` no banco não contém `conquistas`; ele deve cair no fim da ordenação, não sumir:

```js
[...document.querySelectorAll('.nav-item')].map(e => e.textContent.trim()).includes('Conquistas')
```

Expected: `true`

- [ ] **Step 10: Commit**

```bash
git add projetos/acolitos/navegacao-core.js projetos/acolitos/navegacao-core.test.js projetos/acolitos/shared.js projetos/acolitos/config.html
git commit -m "feat(nav): Conquistas na barra do membro e rótulos por público"
```

---

### Task 7: Fechamento — verificação de ponta a ponta e limpeza

**Files:**
- Nenhum arquivo novo. Só verificação.

- [ ] **Step 1: Rodar toda a suíte**

```bash
node --test projetos/acolitos/navegacao-core.test.js projetos/acolitos/solicitacoes-core.test.js projetos/acolitos/gerador-substituto.test.js
cd arte-escala && npx vitest run && cd ..
```

Expected: tudo verde. Os testes de `arte-escala` (20) não podem ter regredido.

- [ ] **Step 2: Checar sintaxe de todas as telas tocadas**

```bash
for f in projetos/acolitos/*.html; do
  python3 -c "
import re,sys
s=open('$f').read()
b=re.findall(r'<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>', s, re.S)
open('/tmp/chk.js','w').write('\n;\n'.join(b))"
  node --check /tmp/chk.js >/dev/null 2>&1 && echo "ok  $f" || echo "ERRO $f"
done
node --check projetos/acolitos/shared.js && node --check projetos/acolitos/navegacao-core.js
```

Expected: nenhum `ERRO`.

- [ ] **Step 3: Percorrer os 8 itens de "Como verificar" do spec**

Abrir `docs/superpowers/specs/2026-07-27-acolitos-navegacao-acesso-design.md` e confirmar um a um. Anotar qualquer divergência antes de dar por pronto.

- [ ] **Step 4: Encerrar o servidor de teste**

```bash
pkill -f "http.server 8177"
```

- [ ] **Step 5: Avisar o dono do que ele precisa fazer à mão**

A permissão `caixa` **nasce vazia para todos**, igual aconteceu com `jornada`. Os 4 da equipe (Gustavo, Franciele, Erick, Maria E. Carli) só verão a Caixa depois de liberada em **Config › Equipe & Permissões**. `coord_admin` continua entrando por ser admin.

- [ ] **Step 6: Commit final se sobrou algo**

```bash
git status --short
```

Se limpo, nada a fazer.

---

## Auto-revisão

**Cobertura do spec:**

| Requisito do spec | Task |
|---|---|
| Item ativo sempre visível | 2 |
| Caixa como módulo liberável `caixa` | 3 |
| Ícone `inbox` | 3 |
| `NAV_ITENS.coord` ganha Caixa | 3 |
| Contador reaproveitando as 2 RPCs da Home | 4 |
| Item nunca some, só o número | 4 |
| CSS `.nav-badge` novo | 4 |
| Gate no bloco, não na porta | 5 |
| Conquistas na barra do membro | 6 |
| Ícone `award` | 6 |
| `NAV_ITENS.jornada` ganha Conquistas | 6 |
| Rótulo Ausência → Faltar, id preservado | 6 |
| `⋯ Mais` da Escala intocado | — (nenhuma task o modifica) |

**Nota sobre Task 3, Step 2:** o teste do core injeta `modulos`/`ordemModulos`, então ele passa antes da mudança em `shared.js`. Isso está sinalizado no próprio step. A falha real que a Task 3 corrige aparece no app (Step 7), não no core — o core já era genérico desde a Task 1. Mantido assim de propósito: o teste protege contra alguém quebrar a filtragem por permissão depois.
