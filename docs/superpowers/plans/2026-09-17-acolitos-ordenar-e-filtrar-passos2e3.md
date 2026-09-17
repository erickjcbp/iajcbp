# Ordenar e filtrar — Passos 2 e 3 (Agenda, CRM, Chamada) — Plano de execução

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pôr a barra de ordenar e filtrar (já no ar em Membros) nas telas Agenda, CRM e Chamada.

**Architecture:** A regra (`FiltroLista`, em `filtro-lista-core.js`) e a barra (`montarFiltroLista`, no `shared.js`) já existem e estão no ar. A barra ganha duas regras de "só mostrar o que a tela oferece"; cada tela descreve suas opções e aplica o resultado. As três listas vêm INTEIRAS do banco, então tudo filtra na memória — nenhuma migration neste plano.

**Tech Stack:** HTML + JS sem build (scripts clássicos), Supabase, `node --test`, harness de telas em `projetos/acolitos/provas/` (Chrome via puppeteer-core).

**Spec:** `docs/superpowers/specs/2026-09-16-acolitos-ordenar-e-filtrar-design.md`
**Plano anterior (passo 1, no ar):** `docs/superpowers/plans/2026-09-16-acolitos-ordenar-e-filtrar-passo1.md`

## Global Constraints

- Tudo em português, sem jargão na tela. Ícones em SVG (`_svgIcon`), nunca emoji na moldura.
- A escolha fica em `localStorage['filtro-lista:<chave>']` (a barra já faz isso), sempre em `try/catch`.
- Falha nunca vira zero: nenhuma tela mostra "0"/"nenhum" por causa de erro.
- Mesmo filtro com duas opções = OU; filtros diferentes = E (a regra já faz isso).
- Testes de regra: `npm run provar-regras` (hoje **254**). Provas de tela: `npm run provar-telas` (hoje **195**, ~80 s). Os totais têm de SUBIR. **Sempre guardar a saída inteira das provas num arquivo** (`npm run provar-telas > <arquivo> 2>&1`) — em 17/09 uma rodada deu 22 falhas e ninguém soube quais.
- As provas de tela que já existem para essas telas têm de continuar verdes: `provaFumaca` (todas as telas, todos os papéis), `provaBarraAcendeSecao` (Chamada), `provaSairDoWhatsappMarcaAFicha` e `provaCartaoDoCrmEComentarioObrigatorio` (CRM).
- Dado de prova com data RELATIVA a hoje, calculada na hora — nunca data cravada (envelhece).
- Commit arquivo por arquivo, mensagem em português `tipo(escopo): frase`, terminando com `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.

### Diferenças conscientes em relação à spec

1. **Chamada não troca a ordem.** A spec previa "Função · Nome". A Chamada é um formulário usado NA HORA da missa (botões de presença e seletor de substituto em cada linha): reordenar as linhas enquanto alguém marca faz o nome fugir do dedo. Fica o agrupamento por função de hoje; entra só o filtro.
2. **Na Chamada, o filtro vale quando é escolhido — marcar alguém não esconde a linha.** Se "Ainda sem marcar" escondesse a linha no toque, marcar "ausente" levaria junto o seletor de substituto, que aparece embaixo da linha. A linha marcada some só na próxima vez que o filtro for aplicado.
3. **Agenda sem "Ordenar por".** Só existe a ordem por data, e a linha do tempo agrupa por proximidade (Hoje, Amanhã…). A barra passa a esconder "Ordenar por" quando a tela tem uma ordem só.
4. **Agenda: o filtro "Tipo" vira três.** "Mostrar" (Celebrações / Eventos — é o que os botões Tudo/Celebrações/Eventos de hoje fazem, e a escolha guardada neles é convertida), "Tipo de evento" (a lista CONFIGURÁVEL do Config, não a fixa da spec) e "Comunidade (missas)". Evento não tem comunidade no banco; o filtro de comunidade vale só para as celebrações, e o nome da seção diz isso.
5. **CRM: botão "Ordenar"** no lugar de "Filtrar", porque o CRM não tem filtro (a spec já tinha tirado o de etapa).

---

## Estrutura de arquivos

| Arquivo | O que muda |
|---|---|
| `projetos/acolitos/shared.js` | `montarFiltroLista`: esconde "Ordenar por" com uma ordem só; botão "Ordenar" sem filtros; sem botão quando não há nada a escolher |
| `projetos/acolitos/agenda.html` | barra nas duas visões; some o `tl-filtros`; conversão da escolha antiga |
| `projetos/acolitos/crm.html` | barra com busca e 3 ordens, no quadro e na lista |
| `projetos/acolitos/chamada.html` | barra na escolha da missa (comunidade) e na chamada (situação) |
| `projetos/acolitos/provas/telas.prova.mjs` | uma prova nova por tarefa |
| `docs/pendencias.md`, `docs/pendencias-fechados.md`, `projetos/acolitos/sw.js` | Tarefa 5 |

---

### Task 1: A barra mostra só o que a tela oferece

**Files:**
- Modify: `projetos/acolitos/shared.js` (dentro de `function montarFiltroLista`)
- Test: `projetos/acolitos/provas/telas.prova.mjs`

**Interfaces:**
- Consumes: `montarFiltroLista(alvo, config, aoMudar)` como está no ar.
- Produces: mesma assinatura. Novas regras: com `config.ordens.length < 2` não há seção "Ordenar por" no painel nem o nome da ordem na linha; com `config.filtros` vazio/ausente o botão diz **"Ordenar"**; sem ordens a escolher E sem filtros, o botão fica escondido (`style.display = 'none'`).

- [ ] **Step 1: A prova que falha**

Em `telas.prova.mjs`, antes de `async function provaRecadoDaFotoAparece(provas) {`, acrescentar:

```js
async function provaBarraMostraSoOQueATelaOferece(provas) {
  console.log('\n\x1b[1mBarra de filtro: mostra só o que a tela oferece\x1b[0m');

  // A Agenda só ordena por data; o CRM não tem filtro. Uma seção "Ordenar por" com uma
  // opção só, ou um botão "Filtrar" que abre só ordens, são enfeite que confunde.
  const r = await provas.abrir('caixa.html', {
    papel: PAPEIS.admin,
    avaliar: `
      const esperar = (ms) => new Promise(f => setTimeout(f, ms));
      const painel = () => document.querySelector('.modal-overlay.open .filtro-painel');
      const titulos = () => [...painel().querySelectorAll('.filtro-painel-titulo')].map(e => e.textContent.trim());
      const fechar = () => { const ov = document.querySelector('.modal-overlay.open'); if (ov) ov.remove(); };
      const itens = [{ nome: 'Ana', t: 'a' }, { nome: 'Bia', t: 'b' }];
      const out = {};
      try { ['prova-uma-ordem', 'prova-sem-filtro', 'prova-nada'].forEach(k => localStorage.removeItem('filtro-lista:' + k)); } catch (e) {}

      // 1) uma ordem só + um filtro
      const a1 = document.createElement('div'); document.body.appendChild(a1);
      const c1 = { chave: 'prova-uma-ordem', rotulo: ['item', 'itens'], ordemPadrao: 'data',
        ordens: [{ id: 'data', nome: 'Data', valor: i => i.nome }],
        filtros: [{ id: 't', nome: 'Tipo', opcoes: [{ id: 'a', nome: 'Tipo A', testa: i => i.t === 'a' }] }],
        contar: e => FiltroLista.aplicar(itens, e, c1).length };
      montarFiltroLista(a1, c1, () => {});
      out.botao1 = a1.querySelector('.filtro-btn').textContent.trim();
      out.linha1 = (a1.querySelector('.filtro-linha') || {}).textContent || '';
      a1.querySelector('.filtro-btn').click(); await esperar(30);
      out.titulos1 = titulos();
      fechar(); a1.remove();

      // 2) duas ordens, nenhum filtro
      const a2 = document.createElement('div'); document.body.appendChild(a2);
      const c2 = { chave: 'prova-sem-filtro', rotulo: ['item', 'itens'], ordemPadrao: 'az',
        ordens: [{ id: 'az', nome: 'Nome A–Z', valor: i => i.nome }, { id: 'za', nome: 'Nome Z–A', desc: true, valor: i => i.nome }],
        filtros: [],
        busca: { placeholder: 'Buscar...', campos: i => [i.nome] },
        contar: e => FiltroLista.aplicar(itens, e, c2).length };
      montarFiltroLista(a2, c2, () => {});
      out.botao2 = a2.querySelector('.filtro-btn').textContent.trim();
      out.linha2 = (a2.querySelector('.filtro-linha') || {}).textContent || '';
      a2.querySelector('.filtro-btn').click(); await esperar(30);
      out.titulos2 = titulos();
      fechar(); a2.remove();

      // 3) uma ordem só, nenhum filtro, com busca: não há o que escolher no painel
      const a3 = document.createElement('div'); document.body.appendChild(a3);
      const c3 = { chave: 'prova-nada', rotulo: ['item', 'itens'], ordemPadrao: 'data',
        ordens: [{ id: 'data', nome: 'Data', valor: i => i.nome }],
        filtros: [],
        busca: { placeholder: 'Buscar...', campos: i => [i.nome] },
        contar: e => FiltroLista.aplicar(itens, e, c3).length };
      montarFiltroLista(a3, c3, () => {});
      const b3 = a3.querySelector('.filtro-btn');
      out.botao3Visivel = !!b3 && b3.style.display !== 'none';
      out.busca3 = !!a3.querySelector('.search-input');
      a3.remove();

      try { ['prova-uma-ordem', 'prova-sem-filtro', 'prova-nada'].forEach(k => localStorage.removeItem('filtro-lista:' + k)); } catch (e) {}
      return out;
    `,
  });
  const a = r.avaliado || {};
  exigir(!r.erroAvaliar, 'as três formas da barra montam sem estourar', r.erroAvaliar);
  exigir(/^Filtrar/.test(a.botao1 || ''), 'com filtro, o botão continua "Filtrar"', 'botão: ' + JSON.stringify(a.botao1));
  exigir(JSON.stringify(a.titulos1) === JSON.stringify(['Tipo']), 'com UMA ordem, o painel não tem "Ordenar por"', 'seções: ' + JSON.stringify(a.titulos1));
  exigir(!/Data/.test(a.linha1 || ''), 'com UMA ordem, o nome da ordem não aparece solto na tela', 'linha: ' + JSON.stringify(a.linha1));
  exigir(/^Ordenar/.test(a.botao2 || ''), 'sem filtro, o botão se chama "Ordenar"', 'botão: ' + JSON.stringify(a.botao2));
  exigir(JSON.stringify(a.titulos2) === JSON.stringify(['Ordenar por']), 'sem filtro, o painel só tem "Ordenar por"', 'seções: ' + JSON.stringify(a.titulos2));
  exigir(/Nome A–Z/.test(a.linha2 || ''), 'com duas ordens, a ordem escolhida continua escrita', 'linha: ' + JSON.stringify(a.linha2));
  exigir(a.botao3Visivel === false, 'sem nada a escolher, o botão some', 'visível: ' + a.botao3Visivel);
  exigir(a.busca3 === true, 'e a busca continua lá');
}
```

No rodapé, depois de `    await provaMembrosMostraQuemEntrouPorUltimo(provas);`:

```js
    await provaBarraMostraSoOQueATelaOferece(provas);
```

Run: `npm run provar-telas > /tmp/claude-501/t1-red.txt 2>&1; tail -12 /tmp/claude-501/t1-red.txt`
Expected: falhas em "com UMA ordem…", "…não aparece solto…", "sem filtro, o botão se chama Ordenar", "sem nada a escolher, o botão some".

- [ ] **Step 2: A mudança na barra**

Em `projetos/acolitos/shared.js`, dentro de `montarFiltroLista`:

Trocar
```js
  const btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'btn-sm gray filtro-btn';
  const contagem = document.createElement('span'); contagem.className = 'filtro-contagem';
  btn.append(icone('sliders', 16), document.createTextNode('Filtrar'), contagem);
  barra.appendChild(btn);
```
por
```js
  // Só mostra o que a tela oferece: "Ordenar por" com uma opção só, ou um botão "Filtrar"
  // que abre só ordens, são enfeite que confunde (Agenda só ordena por data; CRM não filtra).
  const escolheOrdem = (config.ordens || []).length > 1;
  const temFiltros = (config.filtros || []).length > 0;
  const nomeBotao = temFiltros ? 'Filtrar' : 'Ordenar';
  const btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'btn-sm gray filtro-btn';
  const contagem = document.createElement('span'); contagem.className = 'filtro-contagem';
  btn.append(icone('sliders', 16), document.createTextNode(nomeBotao), contagem);
  if (!escolheOrdem && !temFiltros) btn.style.display = 'none';
  barra.appendChild(btn);
```

Trocar
```js
    btn.setAttribute('aria-label', n ? 'Filtrar — ' + n + ' filtro(s) ligado(s)' : 'Filtrar');
    linha.textContent = '';
    const ord = document.createElement('span'); ord.className = 'filtro-ordem';
    ord.textContent = F.nomeDaOrdem(estado, config);
    linha.appendChild(ord);
```
por
```js
    btn.setAttribute('aria-label', n ? nomeBotao + ' — ' + n + ' filtro(s) ligado(s)' : nomeBotao);
    linha.textContent = '';
    if (escolheOrdem) {
      const ord = document.createElement('span'); ord.className = 'filtro-ordem';
      ord.textContent = F.nomeDaOrdem(estado, config);
      linha.appendChild(ord);
    }
```

Trocar
```js
      const g = secao('Ordenar por');
      config.ordens.forEach((o) => opcao(g, o.nome, rascunho.ordem === o.id, 'radio', () => {
        rascunho = F.escolherOrdem(rascunho, config, o.id); desenharCorpo();
      }));
```
por
```js
      if (escolheOrdem) {
        const g = secao('Ordenar por');
        config.ordens.forEach((o) => opcao(g, o.nome, rascunho.ordem === o.id, 'radio', () => {
          rascunho = F.escolherOrdem(rascunho, config, o.id); desenharCorpo();
        }));
      }
```

Trocar, no mesmo bloco do painel, a linha do título `tt.textContent = 'Ordenar e filtrar';` por:
```js
    tt.textContent = temFiltros ? (escolheOrdem ? 'Ordenar e filtrar' : 'Filtrar') : 'Ordenar';
```

- [ ] **Step 3: Rodar tudo**

Run: `node --check projetos/acolitos/shared.js && npm run provar-regras 2>&1 | grep -E "^ℹ (tests|fail)" && npm run provar-telas > /tmp/claude-501/t1-green.txt 2>&1; tail -3 /tmp/claude-501/t1-green.txt`
Expected: `tests 254`, `fail 0`; `204 provas … 204 passaram, 0 falharam` (195 + 9). As provas de Membros continuam verdes (Membros tem 4 ordens e 4 filtros: nada muda para ela).

- [ ] **Step 4: Commit**

```bash
git status --short
git add projetos/acolitos/shared.js projetos/acolitos/provas/telas.prova.mjs
git commit -m "feat(acolitos): a barra de filtro mostra só o que a tela oferece" -m "Uma ordem só: sem 'Ordenar por'. Sem filtros: o botão se chama 'Ordenar'. Sem nada a escolher: o botão some e fica só a busca." -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Agenda

**Files:**
- Modify: `projetos/acolitos/agenda.html`
- Test: `projetos/acolitos/provas/telas.prova.mjs`

**Interfaces:**
- Consumes: `montarFiltroLista` (com as regras da Task 1), `FiltroLista`, e da Agenda: `EVT`, `celebs`, `eventos`, `tlItens`, `viewMode`, `render()`, `reload()`, `itensDoDia(ds)`, `renderTimelineBody(main)`.
- Produces: globais da tela `filtroAgenda` e `configFiltroAgenda()`. Itens da Agenda têm a forma `{ kind: 'celeb'|'evento', hora, data: <linha do banco> }` (a linha do tempo acrescenta `date`).

- [ ] **Step 1: A prova que falha**

Em `telas.prova.mjs`, antes de `async function provaRecadoDaFotoAparece(provas) {`, acrescentar:

```js
async function provaAgendaFiltra(provas) {
  console.log('\n\x1b[1mAgenda: a barra filtra a linha do tempo e o calendário\x1b[0m');

  // Datas relativas a HOJE, calculadas agora: a linha do tempo só mostra o que está por vir,
  // e uma data cravada envelheceria até a prova mentir.
  const dia = (n) => { const d = new Date(); d.setDate(d.getDate() + n);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const celebracoes = [
    { id: 'c1', data: dia(1), horario: '19:00', comunidade: 'matriz', tipo: 'missa_comum', observacoes: null },
    { id: 'c2', data: dia(2), horario: '08:00', comunidade: 'santo_antonio', tipo: 'missa_comum', observacoes: null },
  ];
  const eventos = [
    { id: 'e1', titulo: 'Ensaio geral', tipo: 'ensaio', data: dia(1), hora: '15:00:00', hora_fim: null, local: null },
    { id: 'e2', titulo: 'Retiro', tipo: 'retiro', data: dia(3), hora: null, hora_fim: null, local: null },
  ];
  const r = await provas.abrir('agenda.html', {
    papel: PAPEIS.admin,
    tabelas: { acolitos_celebracoes: { data: celebracoes }, acolitos_eventos: { data: eventos }, acolitos_listas: { data: [] } },
    avaliar: `
      const esperar = (ms) => new Promise(f => setTimeout(f, ms));
      const titulos = () => [...document.querySelectorAll('#main-content .ag-tit')].map(e => e.textContent.trim());
      const painel = () => document.querySelector('.modal-overlay.open .filtro-painel');
      const abrir = async () => { document.querySelector('#main-content .filtro-btn').click(); await esperar(30); };
      const tocar = (txt) => { const b = [...painel().querySelectorAll('button')].find(x => x.textContent.trim() === txt); if (!b) throw new Error('sem botão ' + txt); b.click(); };
      const ver = async () => { painel().querySelector('.filtro-ver').click(); await esperar(60); };
      const limpar = async () => { const l = document.querySelector('#main-content .filtro-limpar'); if (l) { l.click(); await esperar(60); } };
      const guarda = (k) => { try { localStorage.removeItem(k); } catch (e) {} };
      guarda('filtro-lista:agenda'); guarda('agenda-tl-filtro');
      const out = {};

      viewMode = 'linha'; await reload(); await esperar(60);
      out.botoesVelhos = document.querySelectorAll('.tl-filtros').length;
      out.temBusca = !!document.querySelector('#main-content .filtro-barra .search-input');
      out.padrao = titulos();
      await abrir();
      out.secoes = [...painel().querySelectorAll('.filtro-painel-titulo')].map(e => e.textContent.trim());
      out.tiposOferecidos = [...painel().querySelectorAll('.filtro-painel-secao')][1]
        ? [...[...painel().querySelectorAll('.filtro-painel-secao')][1].querySelectorAll('.form-toggle')].map(b => b.textContent.trim()) : [];
      tocar('Eventos'); await esperar(30);
      out.verEventos = painel().querySelector('.filtro-ver').textContent.trim();
      await ver();
      out.soEventos = titulos();
      await limpar();

      await abrir(); tocar('Ensaio'); await ver();
      out.soEnsaio = titulos();
      await limpar();

      await abrir(); tocar('Santo Antônio'); await ver();
      out.comunidadeSA = titulos();
      await limpar();

      // o calendário usa o mesmo filtro, no painel do dia
      await abrir(); tocar('Celebrações'); await ver();
      viewMode = 'cal'; selDate = celebs.length ? '${dia(1)}' : selDate; render(); await esperar(60);
      out.diaSoCelebracao = titulos();
      await limpar();
      viewMode = 'linha'; await reload(); await esperar(60);

      // a escolha guardada nos botões antigos (Tudo/Celebrações/Eventos) não se perde
      guarda('filtro-lista:agenda');
      try { localStorage.setItem('agenda-tl-filtro', 'celeb'); } catch (e) {}
      await reload(); await esperar(60);
      out.migrado = titulos();
      out.etiquetaMigrada = [...document.querySelectorAll('#main-content .filtro-etiqueta')].map(e => e.textContent.trim());
      out.chaveVelhaSumiu = (() => { try { return localStorage.getItem('agenda-tl-filtro') === null; } catch (e) { return null; } })();

      guarda('filtro-lista:agenda'); guarda('agenda-tl-filtro');
      return out;
    `,
  });
  const a = r.avaliado || {};
  exigir(!r.erroAvaliar, 'a Agenda filtra sem estourar', r.erroAvaliar);
  exigir((r.erros || []).length === 0, 'nenhum erro de JavaScript na Agenda', (r.erros || []).join(' | '));
  exigir(a.botoesVelhos === 0, 'os botões Tudo/Celebrações/Eventos viraram filtro no painel');
  exigir(a.temBusca === false, 'a Agenda não ganhou busca (não foi pedida)');
  exigir(JSON.stringify(a.padrao) === JSON.stringify(['Ensaio geral', 'Missa', 'Missa', 'Retiro']),
    'sem filtro, a linha do tempo segue na ordem de data e hora', 'saiu: ' + JSON.stringify(a.padrao));
  exigir(JSON.stringify(a.secoes) === JSON.stringify(['Mostrar', 'Tipo de evento', 'Comunidade (missas)']),
    'o painel oferece Mostrar, Tipo de evento e Comunidade — e não "Ordenar por"', 'saiu: ' + JSON.stringify(a.secoes));
  exigir((a.tiposOferecidos || []).includes('Ensaio') && (a.tiposOferecidos || []).includes('Retiro'),
    'os tipos de evento vêm da lista configurável', 'saiu: ' + JSON.stringify(a.tiposOferecidos));
  exigir(a.verEventos === 'Ver 2 itens', 'o painel conta antes de aplicar', 'mostrou: ' + JSON.stringify(a.verEventos));
  exigir(JSON.stringify(a.soEventos) === JSON.stringify(['Ensaio geral', 'Retiro']), '"Eventos" esconde as celebrações', 'saiu: ' + JSON.stringify(a.soEventos));
  exigir(JSON.stringify(a.soEnsaio) === JSON.stringify(['Ensaio geral']), 'um tipo de evento mostra só ele', 'saiu: ' + JSON.stringify(a.soEnsaio));
  exigir(JSON.stringify(a.comunidadeSA) === JSON.stringify(['Ensaio geral', 'Missa', 'Retiro']),
    'comunidade filtra as missas e mantém os eventos', 'saiu: ' + JSON.stringify(a.comunidadeSA));
  exigir(JSON.stringify(a.diaSoCelebracao) === JSON.stringify(['Missa']), 'no calendário, o dia também obedece ao filtro', 'saiu: ' + JSON.stringify(a.diaSoCelebracao));
  exigir(JSON.stringify(a.migrado) === JSON.stringify(['Missa', 'Missa']), 'a escolha antiga "Celebrações" continua valendo', 'saiu: ' + JSON.stringify(a.migrado));
  exigir(JSON.stringify(a.etiquetaMigrada) === JSON.stringify(['Celebrações']), 'e aparece como etiqueta', 'saiu: ' + JSON.stringify(a.etiquetaMigrada));
  exigir(a.chaveVelhaSumiu === true, 'a chave antiga é convertida uma vez só');
}
```

No rodapé, depois de `    await provaBarraMostraSoOQueATelaOferece(provas);`:
```js
    await provaAgendaFiltra(provas);
```

Run: `npm run provar-telas > /tmp/claude-501/t2-red.txt 2>&1; grep -A20 "Agenda: a barra" /tmp/claude-501/t2-red.txt | head -24`
Expected: falhas (a barra não existe na Agenda; `.filtro-btn` nulo).

- [ ] **Step 2: O estado**

Em `agenda.html`, trocar a linha
```js
let tlFiltro = localStorage.getItem('agenda-tl-filtro') || 'todos'; // 'todos' | 'celeb' | 'evento'
```
por
```js
let filtroAgenda = null;                 // controle da barra de ordenar e filtrar (montarFiltroLista)
```

- [ ] **Step 3: As opções e a montagem**

Logo depois da função `switchView` (a linha que começa com `function switchView(mode)`), acrescentar:

```js
// ── A barra de filtro da Agenda ──
// Só uma ordem (data e hora), então a barra não mostra "Ordenar por". Os tipos de evento vêm
// de EVT, que já junta o padrão com o que a paróquia configurou. Evento não tem comunidade no
// banco: o filtro de comunidade vale só para as celebrações, e o nome da seção diz isso.
function configFiltroAgenda() {
  const tipoDe = (ev) => (EVT[ev.tipo] ? ev.tipo : 'outro');
  const cfg = {
    chave: 'agenda',
    rotulo: ['item', 'itens'],
    ordemPadrao: 'data',
    ordens: [{ id: 'data', nome: 'Data', valor: it => (it.date || it.data.data) + ' ' + (it.hora || '') }],
    desempate: () => '',
    filtros: [
      { id: 'mostrar', nome: 'Mostrar', opcoes: [
        { id: 'celeb', nome: 'Celebrações', testa: it => it.kind === 'celeb' },
        { id: 'evento', nome: 'Eventos', testa: it => it.kind === 'evento' },
      ] },
      { id: 'tipo', nome: 'Tipo de evento', opcoes: Object.keys(EVT).map(k => (
        { id: k, nome: EVT[k].label, testa: it => it.kind === 'evento' && tipoDe(it.data) === k }
      )) },
      { id: 'comunidade', nome: 'Comunidade (missas)', opcoes: [
        { id: 'matriz', nome: 'Matriz', testa: it => it.kind !== 'celeb' || it.data.comunidade === 'matriz' },
        { id: 'santo_antonio', nome: 'Santo Antônio', testa: it => it.kind !== 'celeb' || it.data.comunidade === 'santo_antonio' },
      ] },
    ],
  };
  cfg.contar = (e) => FiltroLista.aplicar(itensDaVisao(), e, cfg).length;
  return cfg;
}
// O que a visão atual tem para filtrar: a linha do tempo inteira, ou o mês do calendário.
function itensDaVisao() {
  if (viewMode !== 'cal') return tlItens;
  return celebs.map(c => ({ kind: 'celeb', hora: c.horario, data: c }))
    .concat(eventos.map(e => ({ kind: 'evento', hora: e.hora || '', data: e })));
}
// Antes da barra, a linha do tempo guardava Tudo/Celebrações/Eventos em 'agenda-tl-filtro'.
// Converte UMA vez, para ninguém perder a escolha que tinha.
function migrarFiltroAntigoDaAgenda(cfg) {
  try {
    const velho = localStorage.getItem('agenda-tl-filtro');
    if (velho === null) return;
    if (localStorage.getItem('filtro-lista:agenda') == null && (velho === 'celeb' || velho === 'evento')) {
      const e = FiltroLista.alternar(FiltroLista.estadoInicial(cfg), cfg, 'mostrar', velho);
      localStorage.setItem('filtro-lista:agenda', FiltroLista.guardar(e));
    }
    localStorage.removeItem('agenda-tl-filtro');
  } catch (e) {}
}
function montarFiltroAgenda(alvo) {
  const cfg = configFiltroAgenda();
  migrarFiltroAntigoDaAgenda(cfg);
  filtroAgenda = montarFiltroLista(alvo, cfg, () => render());
}
```

- [ ] **Step 4: Montar a barra no `render()` e aplicar nas duas visões**

Em `render()`, logo depois de `  tabs.append(tCal, tLin); main.appendChild(tabs);`, acrescentar:
```js
  const alvoFiltro = document.createElement('div'); main.appendChild(alvoFiltro);
  montarFiltroAgenda(alvoFiltro);
```

Em `itensDoDia(dateStr)`, trocar a última linha `  return out;` por:
```js
  return filtroAgenda ? filtroAgenda.aplicar(out) : out;
```

Em `renderTimelineBody(main)`, trocar o trecho que vai de `  // filtro Tudo / Celebrações / Eventos` até o fim do `if (!base.length) { … return; }` (inclusive) por:
```js
  const base = filtroAgenda ? filtroAgenda.aplicar(tlItens) : tlItens;
  if (!base.length) {
    const e = document.createElement('div'); e.className = 'ag-empty';
    const comFiltro = filtroAgenda && FiltroLista.contar(filtroAgenda.estado()) > 0;
    e.textContent = comFiltro ? 'Nada marcado com esses filtros.' : 'Nada marcado por enquanto.';
    main.appendChild(e);
    return;
  }
```

Apagar do `<style>` as três regras `.tl-filtros …` (linhas ~20–22), que ficam sem uso. Conferir antes: `grep -n "tl-filtros\|tlFiltro" projetos/acolitos/agenda.html` só pode achar essas três linhas depois das trocas acima.

- [ ] **Step 5: Rodar tudo**

Run: `npm run provar-regras 2>&1 | grep -E "^ℹ (tests|fail)"; npm run provar-telas > /tmp/claude-501/t2-green.txt 2>&1; tail -3 /tmp/claude-501/t2-green.txt`
Expected: `tests 254`, `fail 0`; `219 provas … 219 passaram, 0 falharam` (204 + 15).

- [ ] **Step 6: Commit**

```bash
git status --short
git add projetos/acolitos/agenda.html projetos/acolitos/provas/telas.prova.mjs
git commit -m "feat(acolitos): a Agenda filtra por tipo e comunidade" -m "A barra entra nas duas visões. Os botões Tudo/Celebrações/Eventos viraram o filtro Mostrar, e a escolha guardada neles é convertida. Os tipos de evento vêm da lista configurável; comunidade vale só para as missas." -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: CRM

**Files:**
- Modify: `projetos/acolitos/crm.html`
- Test: `projetos/acolitos/provas/telas.prova.mjs`

**Interfaces:**
- Consumes: `montarFiltroLista` (Task 1), `FiltroLista`, `formatDate` (shared.js), e do CRM: `crmData` (linhas de `acolitos_crm` com `acolitos_membros` embutido), `currentView`, `renderPipeline()`, `renderLista()`, `renderKpis()`.
- Produces: globais `filtroCrm`, `configFiltroCrm()`, `montarFiltroCrm()`.

- [ ] **Step 1: A prova que falha**

Em `telas.prova.mjs`, antes de `async function provaRecadoDaFotoAparece(provas) {`, acrescentar:

```js
async function provaCrmOrdenaEBusca(provas) {
  console.log('\n\x1b[1mCRM: ordenar e buscar no quadro e na lista\x1b[0m');

  // O CRM já abria com quem está parado há mais tempo (a pergunta da coordenação ali é
  // "quem está esquecido?"). A barra mantém isso como padrão e acrescenta as outras ordens.
  const pessoa = (id, nome, criado) => ({ id, nome, apelido: null, data_nascimento: '2012-01-01',
    comunidade: 'matriz', status: 'em_integracao', created_at: criado });
  const crm = [
    { id: 'k1', membro_id: 'p1', etapa: 'integracao', etapa_iniciada_em: '2026-07-01T12:00:00+00:00', acolitos_membros: pessoa('p1', 'Zeca Antigo', '2026-06-20T12:00:00+00:00') },
    { id: 'k2', membro_id: 'p2', etapa: 'integracao', etapa_iniciada_em: '2026-09-01T12:00:00+00:00', acolitos_membros: pessoa('p2', 'Bia Nova', '2026-09-01T01:30:00+00:00') },
    { id: 'k3', membro_id: 'p3', etapa: 'tunica', etapa_iniciada_em: '2026-08-10T12:00:00+00:00', acolitos_membros: pessoa('p3', 'Caio Meio', '2026-08-01T12:00:00+00:00') },
  ];
  const r = await provas.abrir('crm.html', {
    papel: PAPEIS.admin,
    tabelas: { acolitos_crm: { data: crm }, acolitos_crm_comentarios: { data: [] }, acolitos_crm_historico: { data: [] } },
    avaliar: `
      const esperar = (ms) => new Promise(f => setTimeout(f, ms));
      const guarda = () => { try { localStorage.removeItem('filtro-lista:crm'); } catch (e) {} };
      const coluna = (i) => [...document.querySelectorAll('#view-pipeline .crm-col')[i].querySelectorAll('.crm-card-name')].map(e => e.textContent.trim());
      const painel = () => document.querySelector('.modal-overlay.open .filtro-painel');
      const tocar = (txt) => { const b = [...painel().querySelectorAll('button')].find(x => x.textContent.trim() === txt); if (!b) throw new Error('sem botão ' + txt); b.click(); };
      const escolher = async (txt) => { document.querySelector('#filtro-crm .filtro-btn').click(); await esperar(30); tocar(txt); await esperar(30); painel().querySelector('.filtro-ver').click(); await esperar(60); };
      guarda();
      currentView = 'pipeline'; montarFiltroCrm(); await loadCrm(); await esperar(60);
      const out = {};
      out.botao = document.querySelector('#filtro-crm .filtro-btn').textContent.trim();
      out.temBusca = !!document.querySelector('#filtro-crm .search-input');
      out.colIntegracaoPadrao = coluna(ETAPAS.indexOf('integracao'));
      document.querySelector('#filtro-crm .filtro-btn').click(); await esperar(30);
      out.secoes = [...painel().querySelectorAll('.filtro-painel-titulo')].map(e => e.textContent.trim());
      document.querySelector('.modal-overlay.open').remove();

      await escolher('Nome A–Z');
      out.colIntegracaoNome = coluna(ETAPAS.indexOf('integracao'));

      await escolher('Mais recentes');
      out.colIntegracaoRecentes = coluna(ETAPAS.indexOf('integracao'));
      const leg = document.querySelector('#view-pipeline .filtro-legenda');
      out.legenda = leg ? leg.textContent.trim() : null;
      out.legendaEsperada = 'cadastro ' + new Date('2026-09-01T01:30:00+00:00').toLocaleDateString('pt-BR').slice(0, 5);

      const inp = document.querySelector('#filtro-crm .search-input');
      inp.value = 'bia'; inp.dispatchEvent(new Event('input')); await esperar(60);
      out.cartoesComBusca = [...document.querySelectorAll('#view-pipeline .crm-card-name')].map(e => e.textContent.trim());
      out.kpiTotal = [...document.querySelectorAll('#crm-kpis .kpi-card')].map(c => c.querySelector('.kpi-value').textContent.trim())[1];

      setView('lista'); await esperar(60);
      out.linhasComBusca = [...document.querySelectorAll('#crm-tbody tr td:first-child')].map(e => e.textContent.trim());
      inp.value = 'ninguem-assim'; inp.dispatchEvent(new Event('input')); await esperar(60);
      out.listaVazia = (document.querySelector('#crm-tbody') || {}).textContent || '';
      setView('pipeline');

      guarda();
      return out;
    `,
  });
  const a = r.avaliado || {};
  exigir(!r.erroAvaliar, 'o CRM ordena e busca sem estourar', r.erroAvaliar);
  exigir((r.erros || []).length === 0, 'nenhum erro de JavaScript no CRM', (r.erros || []).join(' | '));
  exigir(/^Ordenar/.test(a.botao || ''), 'sem filtro, o botão do CRM se chama "Ordenar"', 'botão: ' + JSON.stringify(a.botao));
  exigir(a.temBusca === true, 'o CRM tem busca por nome');
  exigir(JSON.stringify(a.secoes) === JSON.stringify(['Ordenar por']), 'o painel do CRM só oferece ordens', 'saiu: ' + JSON.stringify(a.secoes));
  exigir(JSON.stringify(a.colIntegracaoPadrao) === JSON.stringify(['Zeca Antigo', 'Bia Nova']),
    'o padrão continua: quem está parado há mais tempo primeiro', 'saiu: ' + JSON.stringify(a.colIntegracaoPadrao));
  exigir(JSON.stringify(a.colIntegracaoNome) === JSON.stringify(['Bia Nova', 'Zeca Antigo']), 'Nome A–Z ordena dentro da coluna', 'saiu: ' + JSON.stringify(a.colIntegracaoNome));
  exigir(JSON.stringify(a.colIntegracaoRecentes) === JSON.stringify(['Bia Nova', 'Zeca Antigo']), 'Mais recentes põe o cadastro mais novo primeiro', 'saiu: ' + JSON.stringify(a.colIntegracaoRecentes));
  exigir(a.legenda === a.legendaEsperada, 'a data do cadastro aparece no cartão, no horário local', 'saiu: ' + JSON.stringify(a.legenda) + ' esperado ' + JSON.stringify(a.legendaEsperada));
  exigir(JSON.stringify(a.cartoesComBusca) === JSON.stringify(['Bia Nova']), 'a busca vale no quadro', 'saiu: ' + JSON.stringify(a.cartoesComBusca));
  exigir(a.kpiTotal === '3', 'os números do topo não mudam com a busca (são do funil inteiro)', 'saiu: ' + JSON.stringify(a.kpiTotal));
  exigir(JSON.stringify(a.linhasComBusca) === JSON.stringify(['Bia Nova']), 'e a busca vale na lista', 'saiu: ' + JSON.stringify(a.linhasComBusca));
  exigir(/Ninguém com essa busca/.test(a.listaVazia || ''), 'busca sem resultado diz isso, e não "nenhum membro em onboarding"', 'saiu: ' + JSON.stringify(a.listaVazia));
}
```

No rodapé, depois de `    await provaAgendaFiltra(provas);`:
```js
    await provaCrmOrdenaEBusca(provas);
```

Run: `npm run provar-telas > /tmp/claude-501/t3-red.txt 2>&1; grep -A16 "CRM: ordenar" /tmp/claude-501/t3-red.txt | head -18`
Expected: falha com `montarFiltroCrm is not defined`.

- [ ] **Step 2: O lugar da barra**

Em `crm.html`, logo depois do bloco
```html
  <div class="view-toggle">
    <button class="view-btn active" id="btn-v-pipeline" onclick="setView('pipeline')">Pipeline</button>
    <button class="view-btn" id="btn-v-lista" onclick="setView('lista')">Lista</button>
  </div>
```
acrescentar:
```html
  <div id="filtro-crm"></div>
```

- [ ] **Step 3: As opções e a montagem**

Logo depois da linha `let currentView = 'pipeline';`, acrescentar:

```js
let filtroCrm = null;   // controle da barra de ordenar e buscar (montarFiltroLista)

// ── A barra do CRM ──
// Sem filtros (a coluna já é a etapa). O padrão é o de sempre: quem está parado há mais
// tempo primeiro. Os números do topo continuam contando o funil inteiro, com ou sem busca.
function configFiltroCrm() {
  const membroDe = (c) => c.acolitos_membros || {};
  const cfg = {
    chave: 'crm',
    rotulo: ['pessoa', 'pessoas'],
    ordemPadrao: 'parado',
    ordens: [
      { id: 'parado', nome: 'Há mais tempo na etapa', valor: c => c.etapa_iniciada_em || null },
      { id: 'recentes', nome: 'Mais recentes', desc: true, valor: c => membroDe(c).created_at || null,
        legenda: c => membroDe(c).created_at ? 'cadastro ' + formatDate(membroDe(c).created_at).slice(0, 5) : '' },
      { id: 'nome', nome: 'Nome A–Z', valor: c => membroDe(c).nome || null },
    ],
    desempate: c => membroDe(c).nome || '',
    filtros: [],
    busca: { placeholder: 'Buscar nome...', campos: c => [membroDe(c).nome, membroDe(c).apelido] },
  };
  cfg.contar = (e) => FiltroLista.aplicar(crmData, e, cfg).length;
  return cfg;
}
function montarFiltroCrm() {
  filtroCrm = montarFiltroLista(document.getElementById('filtro-crm'), configFiltroCrm(), () => {
    currentView === 'pipeline' ? renderPipeline() : renderLista();
  });
}
function crmVisivel() { return filtroCrm ? filtroCrm.aplicar(crmData) : crmData; }
```

Em `init()`, trocar `  await loadCrm();` por:
```js
  montarFiltroCrm();
  await loadCrm();
```

- [ ] **Step 4: Aplicar no quadro e na lista**

Em `renderPipeline()`, trocar `    const membros = crmData.filter(c => c.etapa === etapa);` por:
```js
    const membros = crmVisivel().filter(c => c.etapa === etapa);
```
e, logo depois de `      name.textContent = m?.nome || '—';`, acrescentar:
```js
      const leg = filtroCrm ? filtroCrm.legenda(c) : '';
```
e trocar `      card.append(name, meta, daysEl);` por:
```js
      if (leg) { const lg = document.createElement('div'); lg.className = 'filtro-legenda'; lg.textContent = leg; card.append(name, lg, meta, daysEl); }
      else card.append(name, meta, daysEl);
```

Em `renderLista()`, trocar
```js
  if (!crmData.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td'); td.colSpan = 6; td.className = 'empty';
    td.textContent = 'Nenhum membro em onboarding.';
    tr.appendChild(td); tbody.appendChild(tr); return;
  }
  crmData.forEach(c => {
```
por
```js
  const lista = crmVisivel();
  if (!lista.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td'); td.colSpan = 6; td.className = 'empty';
    td.textContent = crmData.length ? 'Ninguém com essa busca.' : 'Nenhum membro em onboarding.';
    tr.appendChild(td); tbody.appendChild(tr); return;
  }
  lista.forEach(c => {
```

`renderKpis()` NÃO muda: continua lendo `crmData`.

- [ ] **Step 5: Rodar tudo**

Run: `npm run provar-regras 2>&1 | grep -E "^ℹ (tests|fail)"; npm run provar-telas > /tmp/claude-501/t3-green.txt 2>&1; tail -3 /tmp/claude-501/t3-green.txt`
Expected: `tests 254`, `fail 0`; `232 provas … 232 passaram, 0 falharam` (219 + 13). As duas provas de CRM que já existiam continuam verdes.

- [ ] **Step 6: Commit**

```bash
git status --short
git add projetos/acolitos/crm.html projetos/acolitos/provas/telas.prova.mjs
git commit -m "feat(acolitos): o CRM ordena e busca no quadro e na lista" -m "O padrão continua sendo quem está parado há mais tempo. Entram Mais recentes (com a data do cadastro no cartão) e Nome. Os números do topo seguem contando o funil inteiro." -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Chamada

**Files:**
- Modify: `projetos/acolitos/chamada.html`
- Test: `projetos/acolitos/provas/telas.prova.mjs`

**Interfaces:**
- Consumes: `montarFiltroLista` (Task 1), `FiltroLista`, e da Chamada: `renderSelecao()`, `abrirChamada(celeb)`, `escalasAtuais`, `resultados`, `setRes(id, val)`, `getCat(funcao)`.
- Produces: globais `filtroMissas`, `filtroChamada`, `configFiltroMissas(lista)`, `configFiltroChamada()`, `aplicarFiltroChamada()`.

- [ ] **Step 1: A prova que falha**

Em `telas.prova.mjs`, antes de `async function provaRecadoDaFotoAparece(provas) {`, acrescentar:

```js
async function provaChamadaFiltra(provas) {
  console.log('\n\x1b[1mChamada: filtra a missa e a situação, sem mexer no que já foi marcado\x1b[0m');

  // A Chamada é usada NA HORA. O filtro esconde linhas, não redesenha a tela — redesenhar
  // apagaria o substituto escolhido. E marcar alguém não esconde a linha na frente de quem
  // marca: o seletor de substituto do "ausente" mora embaixo dela.
  const dia = (n) => { const d = new Date(); d.setDate(d.getDate() + n);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const missas = [
    { id: 'ce1', data: dia(1), horario: '19:00', comunidade: 'matriz', tipo: 'missa_comum', acolitos_escalas: [{ id: 'x1' }, { id: 'x2' }, { id: 'x3' }] },
    { id: 'ce2', data: dia(2), horario: '08:00', comunidade: 'santo_antonio', tipo: 'missa_comum', acolitos_escalas: [{ id: 'x4' }] },
  ];
  const escalas = [
    { id: 'es1', funcao: 'altar', status: 'escalado', membro_id: 'm1', acolitos_membros: { nome: 'Ana Altar', foto_url: null, nivel: 'acolito_guardiao' } },
    { id: 'es2', funcao: 'cruz', status: 'presente', membro_id: 'm2', acolitos_membros: { nome: 'Bruno Cruz', foto_url: null, nivel: 'acolito_guardiao' } },
    { id: 'es3', funcao: 'vela', status: 'escalado', membro_id: 'm3', acolitos_membros: { nome: 'Caio Vela', foto_url: null, nivel: 'coroinha' } },
  ];
  const roster = { membros: [
    { id: 'm1', nome: 'Ana Altar' }, { id: 'm2', nome: 'Bruno Cruz' }, { id: 'm3', nome: 'Caio Vela' },
  ], habs: [] };
  const r = await provas.abrir('chamada.html', {
    papel: PAPEIS.admin,
    tabelas: { acolitos_celebracoes: { data: missas }, acolitos_escalas: { data: escalas }, acolitos_chamadas_itens: { data: [] } },
    rpcs: { acolitos_roster_substituicao: { data: roster }, acolitos_avulsos_celebracao: { data: [] }, acolitos_chamada_responsavel: { data: null } },
    avaliar: `
      const esperar = (ms) => new Promise(f => setTimeout(f, ms));
      const guarda = () => { try { localStorage.removeItem('filtro-lista:chamada-missas'); localStorage.removeItem('filtro-lista:chamada-lista'); } catch (e) {} };
      const painel = () => document.querySelector('.modal-overlay.open .filtro-painel');
      const escolher = async (alvo, txt) => { document.querySelector(alvo + ' .filtro-btn').click(); await esperar(30);
        const b = [...painel().querySelectorAll('button')].find(x => x.textContent.trim() === txt); if (!b) throw new Error('sem botão ' + txt);
        b.click(); await esperar(30); painel().querySelector('.filtro-ver').click(); await esperar(60); };
      const tirar = async (alvo) => { const l = document.querySelector(alvo + ' .filtro-limpar'); if (l) { l.click(); await esperar(60); } };
      const visiveis = () => [...document.querySelectorAll('[data-escala-id]')].filter(b => b.style.display !== 'none')
        .map(b => b.querySelector('.chamada-nome-el').textContent.trim());
      const catsVisiveis = () => [...document.querySelectorAll('[data-cat]')].filter(h => h.style.display !== 'none').map(h => h.textContent.trim());
      guarda();
      const out = {};

      await renderSelecao(); await esperar(60);
      out.missas = document.querySelectorAll('.celeb-opt').length;
      out.botaoMissas = (document.querySelector('#filtro-missas .filtro-btn') || {}).textContent;
      await escolher('#filtro-missas', 'Santo Antônio');
      out.missasSA = document.querySelectorAll('.celeb-opt').length;
      await tirar('#filtro-missas');

      await abrirChamada(missas_[0]); await esperar(80);
      out.todos = visiveis();
      await escolher('#filtro-chamada', 'Ainda sem marcar');
      out.semMarcar = visiveis();
      out.catsSemMarcar = catsVisiveis();
      setRes('es1', 'ausente'); await esperar(30);
      out.depoisDeMarcar = visiveis();
      const subRow = document.querySelector('[data-escala-id="es1"] .sub-row');
      out.substitutoAparece = !!subRow && subRow.style.display !== 'none';
      await tirar('#filtro-chamada');
      await escolher('#filtro-chamada', 'Presentes');
      out.presentes = visiveis();
      out.catsPresentes = catsVisiveis();
      out.resultadoGuardado = resultados['es1'];
      await tirar('#filtro-chamada');
      out.botoesDeMarcar = document.querySelectorAll('.r-btn').length;

      guarda();
      return out;
    `.replace('missas_[0]', JSON.stringify(missas[0])),
  });
  const a = r.avaliado || {};
  exigir(!r.erroAvaliar, 'a Chamada filtra sem estourar', r.erroAvaliar);
  exigir((r.erros || []).length === 0, 'nenhum erro de JavaScript na Chamada', (r.erros || []).join(' | '));
  exigir(a.missas === 2, 'sem filtro, aparecem as duas missas', 'saiu: ' + a.missas);
  exigir(/^Filtrar/.test(a.botaoMissas || ''), 'a escolha da missa tem o botão Filtrar', 'botão: ' + JSON.stringify(a.botaoMissas));
  exigir(a.missasSA === 1, 'comunidade filtra as missas', 'saiu: ' + a.missasSA);
  exigir(JSON.stringify(a.todos) === JSON.stringify(['Ana Altar', 'Bruno Cruz', 'Caio Vela']), 'sem filtro, a chamada mostra todo mundo na ordem de sempre', 'saiu: ' + JSON.stringify(a.todos));
  exigir(JSON.stringify(a.semMarcar) === JSON.stringify(['Ana Altar', 'Caio Vela']), '"Ainda sem marcar" esconde quem já foi marcado', 'saiu: ' + JSON.stringify(a.semMarcar));
  exigir(JSON.stringify(a.catsSemMarcar) === JSON.stringify(['Altares', 'Litúrgicos']), 'os títulos de grupo com gente visível continuam', 'saiu: ' + JSON.stringify(a.catsSemMarcar));
  exigir(JSON.stringify(a.depoisDeMarcar) === JSON.stringify(['Ana Altar', 'Caio Vela']), 'marcar alguém NÃO esconde a linha na frente de quem marca', 'saiu: ' + JSON.stringify(a.depoisDeMarcar));
  exigir(a.substitutoAparece === true, 'e o seletor de substituto do ausente fica à vista');
  exigir(JSON.stringify(a.presentes) === JSON.stringify(['Bruno Cruz']), '"Presentes" mostra só os presentes', 'saiu: ' + JSON.stringify(a.presentes));
  exigir(JSON.stringify(a.catsPresentes) === JSON.stringify(['Litúrgicos']), 'grupo sem ninguém visível some junto', 'saiu: ' + JSON.stringify(a.catsPresentes));
  exigir(a.resultadoGuardado === 'ausente', 'filtrar não apaga o que foi marcado', 'saiu: ' + JSON.stringify(a.resultadoGuardado));
  exigir(a.botoesDeMarcar === 9, 'os botões de marcar continuam todos lá (3 por pessoa)', 'saiu: ' + a.botoesDeMarcar);
}
```

No rodapé, depois de `    await provaCrmOrdenaEBusca(provas);`:
```js
    await provaChamadaFiltra(provas);
```

Run: `npm run provar-telas > /tmp/claude-501/t4-red.txt 2>&1; grep -A18 "Chamada: filtra" /tmp/claude-501/t4-red.txt | head -20`
Expected: falhas (sem `#filtro-missas`).

- [ ] **Step 2: As opções**

Em `chamada.html`, logo depois da linha `let _deepLink = false; …`, acrescentar:

```js
// ── A barra de filtro da Chamada ──
// Duas listas: a escolha da missa (filtra por comunidade) e a chamada da missa (filtra por
// situação). A chamada NÃO troca a ordem — o agrupamento por função é o de sempre — e o
// filtro ESCONDE linhas, não redesenha: redesenhar apagaria o substituto escolhido.
let filtroMissas = null, filtroChamada = null;
function configFiltroMissas(lista) {
  const cfg = {
    chave: 'chamada-missas',
    rotulo: ['missa', 'missas'],
    ordemPadrao: 'data',
    ordens: [{ id: 'data', nome: 'Data', valor: c => c.data + ' ' + (c.horario || '') }],
    desempate: () => '',
    filtros: [{ id: 'comunidade', nome: 'Comunidade', opcoes: [
      { id: 'matriz', nome: 'Matriz', testa: c => c.comunidade === 'matriz' },
      { id: 'santo_antonio', nome: 'Santo Antônio', testa: c => c.comunidade === 'santo_antonio' },
    ] }],
  };
  cfg.contar = (e) => FiltroLista.aplicar(lista, e, cfg).length;
  return cfg;
}
function configFiltroChamada() {
  const cfg = {
    chave: 'chamada-lista',
    rotulo: ['pessoa', 'pessoas'],
    ordemPadrao: 'funcao',
    ordens: [{ id: 'funcao', nome: 'Função', valor: () => '' }],
    desempate: () => '',
    filtros: [{ id: 'situacao', nome: 'Situação', opcoes: [
      { id: 'sem', nome: 'Ainda sem marcar', testa: e => !resultados[e.id] },
      { id: 'presente', nome: 'Presentes', testa: e => resultados[e.id] === 'presente' },
      { id: 'atrasado', nome: 'Atrasados', testa: e => resultados[e.id] === 'atrasado' },
      { id: 'ausente', nome: 'Ausentes', testa: e => resultados[e.id] === 'ausente' },
    ] }],
  };
  cfg.contar = (e) => FiltroLista.aplicar(escalasAtuais, e, cfg).length;
  return cfg;
}
// Esconde/mostra linhas e títulos de grupo. Só roda quando o FILTRO muda — nunca ao marcar
// alguém, para a linha (e o seletor de substituto embaixo dela) não sumir da frente de quem marca.
function aplicarFiltroChamada() {
  if (!filtroChamada) return;
  const visiveis = new Set(filtroChamada.aplicar(escalasAtuais).map(e => String(e.id)));
  document.querySelectorAll('[data-escala-id]').forEach(b => {
    b.style.display = visiveis.has(b.getAttribute('data-escala-id')) ? '' : 'none';
  });
  document.querySelectorAll('[data-cat]').forEach(h => {
    const cat = h.getAttribute('data-cat');
    const algum = [...document.querySelectorAll('[data-escala-id]')]
      .some(b => b.getAttribute('data-escala-cat') === cat && b.style.display !== 'none');
    h.style.display = algum ? '' : 'none';
  });
  const aviso = document.getElementById('chamada-filtro-vazio');
  if (aviso) aviso.style.display = visiveis.size ? 'none' : '';
}
```

- [ ] **Step 3: A escolha da missa**

Em `renderSelecao()`, trocar
```js
  comEscala.forEach(c => {
    const d = new Date(c.data+'T00:00:00');
```
por
```js
  const alvoFiltro = document.createElement('div'); alvoFiltro.id = 'filtro-missas'; main.appendChild(alvoFiltro);
  const listaEl = document.createElement('div'); main.appendChild(listaEl);
  const desenharMissas = () => {
    listaEl.textContent = '';
    const lista = filtroMissas ? filtroMissas.aplicar(comEscala) : comEscala;
    if (!lista.length) {
      const em = document.createElement('span'); em.className = 'empty';
      em.textContent = 'Nenhuma missa com esses filtros.'; listaEl.appendChild(em); return;
    }
    lista.forEach(c => desenharMissa(c));
  };
  filtroMissas = montarFiltroLista(alvoFiltro, configFiltroMissas(comEscala), desenharMissas);
  const desenharMissa = (c) => {
    const d = new Date(c.data+'T00:00:00');
```
e, no mesmo bloco, trocar a linha `    opt.append(dt,sb2); main.appendChild(opt);` e o `  });` que fecha o antigo `forEach` por:
```js
    opt.append(dt,sb2); listaEl.appendChild(opt);
  };
  desenharMissas();
```

(`desenharMissa` é `const` declarada depois de `desenharMissas`, mas só é chamada dentro de `desenharMissas()` — que roda na última linha, depois das duas declarações.)

- [ ] **Step 4: A chamada da missa**

Em `abrirChamada(celeb)`, logo depois de `  main.appendChild(summaryBar); updateSummary();`, acrescentar:
```js
  const alvoFiltroCh = document.createElement('div'); alvoFiltroCh.id = 'filtro-chamada'; main.appendChild(alvoFiltroCh);
  filtroChamada = montarFiltroLista(alvoFiltroCh, configFiltroChamada(), aplicarFiltroChamada);
  const avisoVazio = document.createElement('span'); avisoVazio.className = 'empty'; avisoVazio.id = 'chamada-filtro-vazio';
  avisoVazio.textContent = 'Ninguém nesta situação.'; avisoVazio.style.display = 'none'; main.appendChild(avisoVazio);
```

No laço dos grupos, trocar
```js
    const catEl=document.createElement('div');catEl.className='chamada-cat';catEl.textContent=cat;main.appendChild(catEl);
```
por
```js
    const catEl=document.createElement('div');catEl.className='chamada-cat';catEl.textContent=cat;catEl.setAttribute('data-cat',cat);main.appendChild(catEl);
```
e trocar
```js
      const block=document.createElement('div');
```
por
```js
      const block=document.createElement('div');block.setAttribute('data-escala-id',String(e.id));block.setAttribute('data-escala-cat',cat);
```

Antes de `  // Avulsos (quem veio sem estar escalado)`, acrescentar:
```js
  aplicarFiltroChamada();
```

`setRes` NÃO chama `aplicarFiltroChamada` (ver a diferença consciente 2 do topo).

- [ ] **Step 5: Rodar tudo**

Run: `npm run provar-regras 2>&1 | grep -E "^ℹ (tests|fail)"; npm run provar-telas > /tmp/claude-501/t4-green.txt 2>&1; tail -3 /tmp/claude-501/t4-green.txt`
Expected: `tests 254`, `fail 0`; `246 provas … 246 passaram, 0 falharam` (232 + 14). `provaBarraAcendeSecao` (Chamada, admin e cerimoniário) continua verde.

- [ ] **Step 6: Olhar as três telas no tamanho do celular**

Com um script descartável FORA do repositório (o mesmo jeito do passo 1: reaproveitar o servidor e o navegador de `abrir-tela.mjs` sem mexer nele), fotografar em 390×844, com os mesmos dados de mentira das provas: Agenda (linha do tempo com o painel aberto), CRM (quadro com a barra), Chamada (escolha da missa com a barra; chamada com "Ainda sem marcar" ligado). Conferir: barra sem cortar texto, painel com o botão "Ver" inteiro, etiquetas quebrando linha.

- [ ] **Step 7: Commit**

```bash
git status --short
git add projetos/acolitos/chamada.html projetos/acolitos/provas/telas.prova.mjs
git commit -m "feat(acolitos): a Chamada filtra por comunidade e por situação" -m "Na escolha da missa, comunidade. Na chamada, 'ainda sem marcar' e cada resultado. O filtro esconde linhas sem redesenhar, e marcar alguém não esconde a linha — o seletor de substituto mora embaixo dela." -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Registrar e publicar

**Files:**
- Modify: `docs/pendencias.md`, `docs/pendencias-fechados.md`, `projetos/acolitos/sw.js:3`

- [ ] **Step 1: A lista**

Em `docs/pendencias.md`, no item "Ordenar e filtrar — passos 2 a 5", trocar o texto por:

```markdown
**Ordenar e filtrar — passos 4 e 5 da spec**
(`docs/superpowers/specs/2026-09-16-acolitos-ordenar-e-filtrar-design.md`). Membros (16/09),
Agenda, CRM e Chamada (17/09) estão feitos. Faltam: migration 069 + Ausências (Avisos e
Faltas — a parte que filtra NA CONSULTA, porque as listas vêm em pedaços); Tarefas.
```

Em `docs/pendencias-fechados.md`, no topo de um bloco "## Fechados em 17/09/2026" (criar acima do de 16/09), registrar: o que entrou em cada tela, as cinco diferenças conscientes deste plano, as provas novas e os totais que a Task 4 imprimiu.

- [ ] **Step 2: Juntar, carimbar, perguntar, publicar**

1. Juntar a branch na `main` (fast-forward) e rodar `npm test` na `main`, guardando a saída em arquivo.
2. Carimbar: `perl -pi -e "s/const BUILD = '[^']*'/const BUILD = '$(date +%Y%m%d%H%M%S)'/" projetos/acolitos/sw.js`, commit.
3. **Perguntar ao dono antes de enviar.**
4. Enviar com a conta `erickjcbp` e devolver a `brenoov`; conferir no ar o `BUILD` do `sw.js` e `grep -c` de `filtro-crm` no `crm.html`, `filtro-missas` no `chamada.html` e `montarFiltroAgenda` no `agenda.html`.
