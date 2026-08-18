# Caixa e Ausências — Plano de Implementação

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA: use `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans` para implementar tarefa por tarefa. Os passos usam caixinha (`- [ ]`) para marcação.

**Objetivo:** Separar `ausencias.html` — hoje a caixa de decisões da coordenação e o formulário de aviso do membro no mesmo arquivo — em três lugares com trabalhos distintos.

**Arquitetura:** Uma tela nova enxuta (`caixa.html`) fica só com o que espera decisão. `ausencias.html` é reaproveitada e passa a ser a tela de Ausências da coordenação, com duas abas (avisos × faltas), absorvendo os três modais que hoje vivem no menu ⋯ Mais da Escala. O formulário do membro migra para dentro de `escalas-membro.html`. A regra de quem vê o quê vira módulo puro testado em node.

**Tecnologias:** HTML/JS sem framework, Supabase (PostgREST + RLS), testes com `node --test`, deploy pela Vercel a cada push na `main`.

**Spec:** `docs/superpowers/specs/2026-08-17-acolitos-caixa-ausencias-design.md`

## Restrições globais

- **Português claro, sem jargão**, em rótulos de tela e em comentários. Comentário explica o *porquê*, não o *o quê*.
- **Nada de emoji como ícone.** Ícone é SVG por `_svgIcon(nome)` (shared.js). Emoji em rótulo de texto é tolerado no legado, mas UI nova usa SVG.
- **Módulo `-core.js` deve expor a FUNÇÃO pelo nome no navegador** (`global.podeVerTela = podeVerTela`), como faz `navegacao-core.js`. Expor só um objeto (`global.acessoCore = api`) deixa a tela em branco com todos os testes verdes — já aconteceu em 17/08 com `alertas-core.js`.
- **Ids da barra são contrato** com `acolitos_config.nav_ordem_coord/jornada`. Pode acrescentar id novo e mudar `href`; **nunca renomear id existente**.
- **Nunca `git add <pasta>`** — adicionar arquivo por arquivo.
- **Carimbar `BUILD` em `projetos/acolitos/sw.js`** em todo deploy, senão o app aberto continua na versão velha.
- **Conferir o deploy pela ponta:** baixar o arquivo do ar e comparar com o local. O "sucesso" da Vercel não é prova.
- Rodar os testes com: `node --test projetos/acolitos/*.test.js` (passe os arquivos, não a pasta — `node --test <pasta>` não varre).

---

## Estrutura de arquivos

| Arquivo | Responsabilidade | Fase |
|---|---|---|
| `projetos/acolitos/acesso-core.js` | **novo** — regra pura: quem vê a Caixa e quem vê Ausências | 1 |
| `projetos/acolitos/acesso-core.test.js` | **novo** — um caso por papel × tela | 1 |
| `projetos/acolitos/caixa.html` | **novo** — só pendências + "Tudo em dia" + Enviar aviso | 1 |
| `projetos/acolitos/shared.js` | o mapa de módulos: id `caixa` passa a apontar para `caixa.html` (linha ~1502) | 1 |
| `projetos/acolitos/navegacao-core.js` | id `ausencias` sai de `ITENS_JORNADA` (linha 19) | 3 |
| `projetos/acolitos/ausencias.html` | vira a tela de Ausências (2 abas + registrar) | 2 |
| `projetos/acolitos/escala.html` | 3 itens do menu ⋯ Mais viram 1 | 2 |
| `projetos/acolitos/escalas-membro.html` | recebe o "não poderei ir" do membro | 3 |

---

# FASE 1 — a Caixa enxuta

Ao fim da fase 1 a coordenação tem uma Caixa nova, e nada quebrou: `ausencias.html` continua funcionando como está para todo mundo.

### Tarefa 1: regra de acesso em módulo testável

**Arquivos:**
- Criar: `projetos/acolitos/acesso-core.js`
- Teste: `projetos/acolitos/acesso-core.test.js`

**Interfaces:**
- Consome: nada.
- Produz: `podeVerTela({ tela, role, caps })` → `boolean`.
  - `tela`: `'caixa'` ou `'ausencias'`
  - `role`: string do `ctx.membership.role` (ex.: `'coord_admin'`, `'cerimonario'`, `'membro'`)
  - `caps`: o objeto devolvido por `navCaps(ctx)` — usa-se `caps.isAdmin`, `caps.ehEquipe`, `caps.isCerimo`, `caps.perms`

- [ ] **Passo 1: escrever o teste que falha**

```js
// projetos/acolitos/acesso-core.test.js
// Testes da regra de acesso às telas de Caixa e Ausências.
// Rodar: node --test projetos/acolitos/acesso-core.test.js
const test = require('node:test');
const assert = require('node:assert');
const { podeVerTela } = require('./acesso-core.js');

const caps = (o) => Object.assign({ isAdmin:false, ehEquipe:false, isCerimo:false, perms:[] }, o);

test('coordenador com a permissão caixa vê a Caixa', () => {
  assert.strictEqual(podeVerTela({ tela:'caixa', role:'coord_admin', caps:caps({ isAdmin:true }) }), true);
});
```

- [ ] **Passo 2: rodar e ver falhar**

Rodar: `node --test projetos/acolitos/acesso-core.test.js`
Esperado: FALHA com `TypeError: podeVerTela is not a function`

- [ ] **Passo 3: implementar o mínimo**

```js
// projetos/acolitos/acesso-core.js
// Quem vê a Caixa e quem vê a tela de Ausências. PURO (sem DOM, sem rede),
// no mesmo padrão de navegacao-core.js, alertas-core.js e kits-core.js.
(function (global) {
  'use strict';

  function podeVerTela(o) {
    o = o || {};
    var caps = o.caps || {};
    if (o.tela === 'caixa') return !!caps.isAdmin;
    return false;
  }

  var api = { podeVerTela: podeVerTela };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { global.podeVerTela = podeVerTela; }   // pelo NOME: senão a tela fica em branco
})(typeof globalThis !== 'undefined' ? globalThis : this);
```

- [ ] **Passo 4: rodar e ver passar**

Rodar: `node --test projetos/acolitos/acesso-core.test.js`
Esperado: `pass 1 | fail 0`

- [ ] **Passo 5: escrever os testes que faltam (é aqui que mora o risco da spec)**

```js
test('quem tem a permissão caixa sem ser admin também vê a Caixa', () => {
  assert.strictEqual(podeVerTela({ tela:'caixa', role:'membro_equipe', caps:caps({ ehEquipe:true, perms:['caixa'] }) }), true);
});

test('membro comum NÃO vê a Caixa', () => {
  assert.strictEqual(podeVerTela({ tela:'caixa', role:'membro', caps:caps({}) }), false);
});

test('cerimoniário NÃO vê a Caixa — ele não aprova', () => {
  assert.strictEqual(podeVerTela({ tela:'caixa', role:'cerimonario', caps:caps({ isCerimo:true }) }), false);
});

// O RISCO DECLARADO NA SPEC: o cerimoniário registra ausência de outro (a RLS já
// libera, ausencias.html:307). Se a tela de Ausências for trancada por 'caixa',
// ele perde a função e ninguém é avisado — a tela só não abre.
test('cerimoniário VÊ a tela de Ausências', () => {
  assert.strictEqual(podeVerTela({ tela:'ausencias', role:'cerimonario', caps:caps({ isCerimo:true }) }), true);
});

test('equipe vê a tela de Ausências', () => {
  assert.strictEqual(podeVerTela({ tela:'ausencias', role:'membro_equipe', caps:caps({ ehEquipe:true }) }), true);
});

test('membro comum NÃO vê a tela de Ausências', () => {
  assert.strictEqual(podeVerTela({ tela:'ausencias', role:'membro', caps:caps({}) }), false);
});

test('tela desconhecida não libera nada', () => {
  assert.strictEqual(podeVerTela({ tela:'qualquer', role:'coord_admin', caps:caps({ isAdmin:true }) }), false);
});
```

- [ ] **Passo 6: rodar e ver os novos falharem**

Rodar: `node --test projetos/acolitos/acesso-core.test.js`
Esperado: os 3 primeiros passam, os de `'ausencias'` e o de permissão sem admin FALHAM.

- [ ] **Passo 7: completar a regra**

```js
  // A Caixa é onde se DECIDE (aprovar troca, candidatura, cobrir vaga, confirmar
  // aviso da página pública). Quem decide é admin ou quem recebeu a permissão.
  // A tela de Ausências é onde se CONSULTA e se REGISTRA — e aí entra o
  // cerimoniário, que registra ausência de outro mas não aprova nada.
  function podeVerTela(o) {
    o = o || {};
    var caps = o.caps || {};
    var perms = caps.perms || [];
    if (o.tela === 'caixa')     return !!caps.isAdmin || perms.indexOf('caixa') >= 0;
    if (o.tela === 'ausencias') return !!caps.isAdmin || !!caps.ehEquipe || !!caps.isCerimo;
    return false;
  }
```

- [ ] **Passo 8: rodar tudo e ver verde**

Rodar: `node --test projetos/acolitos/acesso-core.test.js`
Esperado: `pass 8 | fail 0`

- [ ] **Passo 9: commitar**

```bash
git add projetos/acolitos/acesso-core.js projetos/acolitos/acesso-core.test.js
git commit -m "feat(acesso): regra de quem vê Caixa e Ausências em módulo testável

O cerimoniário registra ausência de outro (a RLS libera) mas não aprova nada.
Trancar a tela de Ausências pela permissão 'caixa' o deixaria de fora sem aviso
nenhum — a tela só não abriria. É o risco declarado na spec, e o teste do
cerimoniário existe para travá-lo."
```

---

### Tarefa 2: a tela `caixa.html`

**Arquivos:**
- Criar: `projetos/acolitos/caixa.html`
- Ler para copiar: `projetos/acolitos/ausencias.html` (funções `renderCaixaSolicitacoes` ~linha 196, `renderCaixaCobrir` ~261, `renderPendentesPublicas` ~316, e o botão Enviar aviso em `renderViewEquipe` ~607)

**Interfaces:**
- Consome: `podeVerTela` (Tarefa 1), `initModulo`, `renderHeader`, `renderBottomNav`, `navCaps`, `avisarTodos` — todos do `shared.js`.
- Produz: a rota `caixa.html`, consumida pela Tarefa 3.

- [ ] **Passo 1: criar o arquivo copiando a moldura de `ausencias.html`**

Copiar de `ausencias.html`: o `<head>` inteiro (mesmos `<link>`, mesmos `<script src>`), o `<body>` com `#main-content`, e **acrescentar** `<script src="acesso-core.js"></script>` logo depois de `navegacao-core.js`.

- [ ] **Passo 2: escrever o `init()`**

```js
let ctx = null;
async function init() {
  ctx = await initModulo();
  if (!ctx) return;
  renderHeader(ctx, 'caixa');
  renderBottomNav(ctx, 'caixa');
  const caps = navCaps(ctx);
  const role = ctx.membership ? ctx.membership.role : null;
  // A tela inteira é da coordenação — diferente da ausencias.html antiga, que
  // precisava abrir para todo membro. Ver a spec de 17/08.
  if (!podeVerTela({ tela: 'caixa', role, caps })) { semAcesso(); return; }
  await renderCaixa();
}
function semAcesso() {
  const main = document.getElementById('main-content'); main.textContent = '';
  const p = document.createElement('p'); p.className = 'empty';
  p.textContent = 'Esta tela é da coordenação.';
  main.appendChild(p);
}
```

- [ ] **Passo 3: mover as três seções de pendência**

Copiar de `ausencias.html`, **sem alterar a lógica**, as funções `renderCaixaSolicitacoes(container)`, `renderCaixaCobrir(container, cobrir)` e `renderPendentesPublicas()`. Ajustar apenas o id do container onde elas escrevem, para `#main-content` desta tela.

- [ ] **Passo 4: o estado "Tudo em dia"**

```js
// A Caixa vazia é o estado COMUM, não a exceção: das 16 solicitações que
// existem no banco, todas já foram decididas. Então é esta tela que a
// coordenação mais vê — e por isso ela precisa estar certa.
function renderTudoEmDia(main) {
  const box = document.createElement('div');
  box.style.cssText = 'text-align:center;padding:42px 16px;color:var(--text-muted);';
  const ic = document.createElement('div');
  ic.style.cssText = 'width:44px;height:44px;margin:0 auto 12px;';
  ic.innerHTML = _svgIcon('inbox');   // SVG, nunca emoji
  const svg = ic.firstChild;
  if (svg) svg.setAttribute('style','width:44px;height:44px;fill:none;stroke:var(--success-text);stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round;');
  const t = document.createElement('div');
  t.style.cssText = 'font-family:Sora,sans-serif;font-weight:700;font-size:16px;color:var(--text);';
  t.textContent = 'Tudo em dia';
  const s = document.createElement('div');
  s.style.cssText = 'font-size:13px;margin-top:4px;';
  s.textContent = 'Não há nada esperando decisão sua.';
  box.append(ic, t, s);
  main.appendChild(box);
}
```

- [ ] **Passo 5: costurar o `renderCaixa()`**

```js
async function renderCaixa() {
  const main = document.getElementById('main-content'); main.textContent = '';
  const t = document.createElement('h1'); t.className = 'page-title';
  t.textContent = 'Caixa'; main.appendChild(t);

  const box = document.createElement('div'); main.appendChild(box);
  const houve = await renderCaixaSolicitacoes(box);   // devolve quantas pendências desenhou
  const houvePub = await renderPendentesPublicas(box);
  if (!houve && !houvePub) renderTudoEmDia(main);

  // "Enviar aviso" fica sempre visível: é ação da coordenação, não pendência.
  if (navCaps(ctx).isAdmin) main.appendChild(botaoEnviarAviso());
}
```

**Atenção — duas mudanças de assinatura, sem as quais nada disso funciona:**
1. `renderCaixaSolicitacoes` e `renderPendentesPublicas` **hoje não devolvem nada**. Faça as duas devolverem o **número de itens desenhados** — é isso que decide se a tela mostra "Tudo em dia".
2. `renderPendentesPublicas` hoje **não recebe parâmetro**: ela busca `#main-content` por conta própria (`ausencias.html:320`). Passe o container por argumento, como já faz `renderCaixaSolicitacoes(container)`.

Sem a mudança 1 a tela mostra "Tudo em dia" por cima de pendências reais — o defeito mais perigoso desta fase, porque parece que está tudo certo.

- [ ] **Passo 6: provar na tela, sem sessão**

```bash
python3 -m http.server 5199 --bind 127.0.0.1 &   # da raiz do repositório
```

Carregar `http://127.0.0.1:5199/projetos/acolitos/caixa.html` com a partida (`init()`) desligada, injetar `#main-content`, chamar `renderTudoEmDia` e tirar foto em 390px e 1100px.
Esperado: ícone SVG, "Tudo em dia", zero erro de JavaScript, nada estourando na horizontal.

- [ ] **Passo 7: commitar**

```bash
git add projetos/acolitos/caixa.html
git commit -m "feat(caixa): tela própria só para o que espera decisão

Separa da ausencias.html, que era a caixa de 4 coordenadores e o formulário de
aviso de 41 membros no mesmo arquivo. Sem pendências mostra 'Tudo em dia' — que
é o estado comum: as 16 solicitações do banco já foram todas decididas."
```

---

### Tarefa 3: a barra aponta para a Caixa nova

**Arquivos:**
- Modificar: `projetos/acolitos/shared.js:1502` (o mapa de módulos, entrada `caixa`) — **é no shared.js, não no navegacao-core.js**: o core monta a barra, o mapa de destinos mora no shared
- Teste: `projetos/acolitos/navegacao-core.test.js`

**Interfaces:**
- Consome: a rota `caixa.html` (Tarefa 2).
- Produz: nada novo.

- [ ] **Passo 1: escrever o teste que falha**

```js
test('o item Caixa aponta para a tela própria, não para ausencias.html', () => {
  const r = montarItensNav({ ...base, modo:'coordenacao', perms:['caixa'], isAdmin:false });
  const caixa = r.find(x => x.id === 'caixa');
  assert.strictEqual(caixa.href, 'caixa.html');
});
```

- [ ] **Passo 2: rodar e ver falhar**

Rodar: `node --test projetos/acolitos/navegacao-core.test.js`
Esperado: FALHA — recebeu `ausencias.html`.

- [ ] **Passo 3: mudar o href**

Em `shared.js`, no mapa de módulos: `caixa: { label:'Caixa', href:'caixa.html', icon:'inbox' }`.
**Não mude o id `caixa`** — ele é contrato com `acolitos_config.nav_ordem_coord`.

- [ ] **Passo 4: rodar todos os testes**

Rodar: `node --test projetos/acolitos/acesso-core.test.js projetos/acolitos/navegacao-core.test.js projetos/acolitos/alertas-core.test.js projetos/acolitos/kits-core.test.js projetos/acolitos/solicitacoes-core.test.js`
Esperado: tudo verde, nenhum teste a menos que antes.

- [ ] **Passo 5: carimbar o service worker e commitar**

```bash
perl -pi -e "s/const BUILD = '[0-9]*'/const BUILD = '$(date +%Y%m%d%H%M%S)'/" projetos/acolitos/sw.js
git add projetos/acolitos/shared.js projetos/acolitos/navegacao-core.test.js projetos/acolitos/sw.js
git commit -m "feat(nav): item Caixa passa a abrir a tela própria

O id 'caixa' é mantido — é contrato com nav_ordem_coord. Só o href muda."
```

- [ ] **Passo 6: publicar e conferir pela ponta**

```bash
git push origin main
# esperar e conferir que o ar bate com o local:
curl -s -o /tmp/c.html https://coroinhas.jcbplimeira.com.br/projetos/acolitos/caixa.html
cmp -s /tmp/c.html projetos/acolitos/caixa.html && echo "publicado" || echo "ainda nao"
```

---

# FASE 2 — Ausências com duas abas

Ao fim da fase 2, o menu ⋯ Mais tem uma porta em vez de três, e `ausencias.html` é a tela de Ausências. O membro **ainda** usa o caminho antigo — a view dele só sai na fase 3.

### Tarefa 4: as duas abas em `ausencias.html`

**Arquivos:**
- Modificar: `projetos/acolitos/ausencias.html`
- Ler para mover: `projetos/acolitos/escala.html:1695` (`abrirAusencias`), `:1717` (`abrirFaltas`), `:1560` (`abrirRegistrarAusenciaCoord`)

**Interfaces:**
- Consome: `podeVerTela` (Tarefa 1).
- Produz: `ausencias.html?aba=avisos` e `?aba=faltas` — usadas pela Tarefa 5.

- [ ] **Passo 1: trancar a tela pela regra nova**

```js
  const caps = navCaps(ctx);
  const role = ctx.membership ? ctx.membership.role : null;
  if (!podeVerTela({ tela:'ausencias', role, caps })) { semAcesso(); return; }
```

**Este é o ponto crítico da spec.** Confira com uma conta de cerimoniário antes de seguir: se a tela não abrir para ele, a regra está errada, não a conta.

- [ ] **Passo 2: desenhar as abas**

```js
// Aviso de ausência e falta são coisas OPOSTAS: uma é "avisou antes", a outra é
// "não apareceu", apurada na chamada. Ficam na mesma tela porque tratam do mesmo
// assunto, e em abas separadas porque misturá-las apagaria a diferença entre
// quem foi responsável e quem sumiu.
const ABAS = [['avisos','Avisos de ausência'], ['faltas','Faltas']];
let abaAtual = new URLSearchParams(location.search).get('aba') || 'avisos';

function renderAbas(main) {
  const nav = document.createElement('div'); nav.className = 'cfg-nav';
  ABAS.forEach(([id, rot]) => {
    const b = document.createElement('button');
    b.className = 'cfg-tab' + (id === abaAtual ? ' on' : '');
    b.textContent = rot;
    b.onclick = () => { abaAtual = id; renderTela(); };
    nav.appendChild(b);
  });
  main.appendChild(nav);
}
```

- [ ] **Passo 3: mover a lista de avisos**

Trazer o corpo de `abrirAusencias` (escala.html:1695) para uma função `renderAvisos(main)` aqui, trocando o modal por conteúdo de tela. A consulta é a mesma:

```js
const { data } = await sb.from('acolitos_ausencias')
  .select('*, acolitos_membros(nome,apelido), acolitos_celebracoes(data,horario,comunidade)')
  .order('created_at', { ascending:false }).limit(80);
```

- [ ] **Passo 4: mover a lista de faltas**

Trazer o corpo de `abrirFaltas` (escala.html:1717) para `renderFaltas(main)`. A fonte é a RPC `acolitos_faltas_recentes` — não mude a RPC.

- [ ] **Passo 5: mover o registrar**

Trazer `abrirRegistrarAusenciaCoord` (escala.html:1560) para esta tela como botão no topo, acima das abas — vale para as duas.

- [ ] **Passo 6: rodar os testes e provar na tela**

Rodar: `node --test projetos/acolitos/*.test.js` (listando os arquivos)
Depois carregar a tela local em 390px e 1100px, nas duas abas, e conferir zero erro de JavaScript.

- [ ] **Passo 7: commitar**

```bash
git add projetos/acolitos/ausencias.html
git commit -m "feat(ausencias): uma tela com duas abas no lugar de três modais

Avisos e faltas ficam juntos porque são o mesmo assunto, e separados em abas
porque carregam informações opostas: quem avisou antes e quem não apareceu."
```

---

### Tarefa 5: três itens do menu viram um

**Arquivos:**
- Modificar: `projetos/acolitos/escala.html:167-172` (o menu ⋯ Mais)
- Remover de `escala.html`: `abrirAusencias` (~1695), `abrirFaltas` (~1717), `abrirRegistrarAusenciaCoord` (~1560) e os modais `#modal-ausencias` e `#modal-faltas`

**Interfaces:**
- Consome: `ausencias.html?aba=` (Tarefa 4).

- [ ] **Passo 1: trocar os três botões por um**

```html
<button class="mais-item" role="menuitem" onclick="location.href='ausencias.html'">Ausências</button>
```

Apagar as linhas dos outros dois (`❌ Faltas` e `📅 Registrar ausência`).

- [ ] **Passo 2: apagar o código órfão**

Remover as três funções e os dois modais do HTML. **Conferir que nada mais as chama:**

```bash
grep -n "abrirAusencias\|abrirFaltas\|abrirRegistrarAusenciaCoord\|modal-ausencias\|modal-faltas" projetos/acolitos/*.html projetos/acolitos/*.js
```
Esperado: nenhuma linha.

- [ ] **Passo 3: conferir a sintaxe do arquivo**

```bash
node -e "const fs=require('fs');const h=fs.readFileSync('projetos/acolitos/escala.html','utf8');
const re=/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g;let m,i=0;
while((m=re.exec(h))){i++;fs.writeFileSync('/tmp/e'+i+'.js',m[1]);require('child_process').execSync('node --check /tmp/e'+i+'.js');}
console.log('escala.html: '+i+' blocos, sintaxe ok');"
```

- [ ] **Passo 4: carimbar, commitar e publicar**

```bash
perl -pi -e "s/const BUILD = '[0-9]*'/const BUILD = '$(date +%Y%m%d%H%M%S)'/" projetos/acolitos/sw.js
git add projetos/acolitos/escala.html projetos/acolitos/sw.js
git commit -m "feat(escala): menu Mais com uma porta para Ausências em vez de três"
git push origin main
```

- [ ] **Passo 5: conferir no ar**

```bash
curl -s https://coroinhas.jcbplimeira.com.br/projetos/acolitos/escala.html | grep -c "abrirFaltas"
```
Esperado: `0`.

---

# FASE 3 — o membro avisa pelas Escalas

**Só execute esta fase depois que a fase 2 estiver no ar.** Até aqui o membro ainda usa `ausencias.html`; tirar o item da barra antes deixaria 41 pessoas sem caminho.

### Tarefa 6: o "não poderei ir" dentro das Escalas

**Arquivos:**
- Modificar: `projetos/acolitos/escalas-membro.html`
- Mover de: `projetos/acolitos/ausencias.html` (`renderViewMembro`, ~linha 414)

**Interfaces:**
- Consome: nada novo.
- Produz: o caminho do membro, que a Tarefa 7 pressupõe existir.

- [ ] **Passo 1: mover a função**

Trazer `renderViewMembro` de `ausencias.html` para `escalas-membro.html`, aberta por um botão no topo da tela. **Não mude a gravação** — o upsert em `acolitos_ausencias` continua igual, com `celebracao_id` preenchido (as 913 ausências do banco são todas assim).

- [ ] **Passo 2: provar com conta de membro**

Abrir a tela logado como membro comum e conferir: o botão aparece, o formulário lista as missas futuras, e marcar uma grava.

- [ ] **Passo 3: commitar**

```bash
git add projetos/acolitos/escalas-membro.html projetos/acolitos/ausencias.html
git commit -m "feat(jornada): membro informa ausência dentro das próprias Escalas"
```

---

### Tarefa 7: "Faltar" sai da barra do membro

**Arquivos:**
- Modificar: `projetos/acolitos/navegacao-core.js:19` (remover o item `ausencias` de `ITENS_JORNADA`)
- Teste: `projetos/acolitos/navegacao-core.test.js`

- [ ] **Passo 1: escrever o teste que falha**

```js
test('a barra do membro não tem mais o item Faltar', () => {
  const r = montarItensNav({ ...base, modo:'jornada' });
  assert.strictEqual(r.find(x => x.id === 'ausencias'), undefined);
});
```

- [ ] **Passo 2: rodar e ver falhar**

Rodar: `node --test projetos/acolitos/navegacao-core.test.js`
Esperado: FALHA — o item ainda existe.

- [ ] **Passo 3: remover o item**

Apagar a entrada `{ id:'ausencias', href:'ausencias.html', label:'Faltar', icon:'x-circle' }` de `ITENS_JORNADA`.
Deixar um comentário dizendo para onde a função foi — quem ler `nav_ordem_jornada` no banco vai encontrar um id que não existe mais, e `ordenarPorConfig` já ignora isso (`navegacao-core.js:58`).

- [ ] **Passo 4: rodar todos os testes**

Rodar: `node --test projetos/acolitos/acesso-core.test.js projetos/acolitos/navegacao-core.test.js projetos/acolitos/alertas-core.test.js projetos/acolitos/kits-core.test.js projetos/acolitos/solicitacoes-core.test.js`
Esperado: verde, e o total **não pode diminuir** em relação à fase 1.

- [ ] **Passo 5: carimbar, commitar, publicar e conferir**

```bash
perl -pi -e "s/const BUILD = '[0-9]*'/const BUILD = '$(date +%Y%m%d%H%M%S)'/" projetos/acolitos/sw.js
git add projetos/acolitos/navegacao-core.js projetos/acolitos/navegacao-core.test.js projetos/acolitos/sw.js
git commit -m "feat(jornada): item Faltar sai da barra — a função vive nas Escalas"
git push origin main
```

Depois, com conta de membro no ar: a barra tem um item a menos e o aviso de ausência funciona pelas Escalas.
