# Ordenar e filtrar — Passo 4 (Ausências: Avisos e Faltas) — Plano de execução

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Filtrar as duas abas da tela Ausências — Avisos (1.202) e Faltas (357) — por pessoa, período, comunidade (e motivo nos avisos), com o filtro DENTRO da consulta ao banco.

**Architecture:** As duas listas vêm do banco em pedaços (60 avisos, 80 faltas); filtrar o pedaço que veio esconderia resultado. A regra (`FiltroLista`) ganha filtro de escolha única, leitura das escolhas e o cálculo dos períodos; a barra (`montarFiltroLista`) ganha busca dentro do painel para listas longas (177 pessoas). No banco (migration 069): uma VISTA das ausências já juntada com a missa, que obedece às mesmas regras de acesso da tabela, e uma função nova de faltas com filtros e contagem. A tela passa a montar a consulta a partir da escolha e mostra erro como erro.

**Tech Stack:** HTML + JS sem build, Supabase (Postgres 17 + PostgREST), `node --test`, harness de telas (Chrome via puppeteer-core), `psql` em `/opt/homebrew/opt/libpq/bin/`.

**Spec:** `docs/superpowers/specs/2026-09-16-acolitos-ordenar-e-filtrar-design.md`
**Planos anteriores (no ar):** `…-passo1.md`, `…-passos2e3.md`

## Global Constraints

- Tudo em português, sem jargão; ícones SVG, nunca emoji na moldura (os rótulos de motivo do Config têm emoji: tirar ao usar como opção de filtro).
- **Falha nunca vira zero:** consulta com erro mostra erro; sem permissão mostra "sem acesso"; nunca "nenhum"/"0".
- **Filtro na consulta:** nas duas abas a tela NUNCA filtra o que já veio — cada escolha refaz a consulta com o filtro dentro, e o "Ver N" e o "Mostrando X de N" vêm do banco.
- Regras: `npm run provar-regras` (hoje **254**). Telas: `npm run provar-telas` (hoje **259**, ~90 s); só uma tela: `npm run provar-telas -- ausencias.html`. **Sempre** `> /tmp/claude-501/<nome>.txt 2>&1` e ler de lá. Os totais têm de SUBIR exatamente como cada tarefa diz.
- **Corrida conhecida:** fechar uma janela chama `history.back()` depois. Toda prova espera **≥120 ms** depois de fechar um painel e confere `r.avaliado` é objeto.
- Banco = PRODUÇÃO: a única escrita permitida é aplicar a migration 069. Provas SQL só leem, com `rollback`.
- Função nova no banco copia a trava das irmãs (`security definer`, `set search_path to 'public'`, `revoke` de `public` E `anon`, `grant` a `authenticated` e `service_role`); **sem permissão = erro 42501**, nunca lista vazia.
- Commit arquivo por arquivo, mensagem em português `tipo(escopo): frase` + `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.

### Diferenças conscientes em relação à spec

1. **Função nova de faltas com OUTRO nome** (`acolitos_faltas_filtradas`), não uma segunda versão de `acolitos_faltas_recentes`. Com duas funções de mesmo nome e argumentos opcionais, a chamada sem argumentos que a tela de hoje faz fica ambígua e o banco recusa: **a aba Faltas quebraria no ar no instante da migration**, antes da tela nova subir. A antiga fica intacta.
2. **Avisos por uma VISTA, não por função.** A data da missa só está copiada em 648 das 1.202 ausências — filtrar por `acolitos_ausencias.data` deixaria 554 de fora. A vista junta a missa e é `security_invoker`: obedece às mesmas regras de acesso da tabela, sem repetir a trava à mão.
3. **Período é de escolha única** e sem a opção "tudo" (nada escolhido = tudo). Opções: Próximas missas · Este mês · Mês passado · Últimos 90 dias. "Próximas missas" entrou porque aviso de ausência é quase sempre para missa futura.
4. **Faltas também filtra por comunidade** e aceita várias pessoas de uma vez (a função recebe listas).
5. **Cerimoniário na aba Faltas:** ele vê a aba, mas a trava do banco não deixa ver faltas — hoje ele lê "Nenhuma falta registrada ainda.", que é mentira. Passa a ler "Você não tem acesso às faltas." **O acesso não muda** (ampliar é decisão do dono).

---

## Estrutura de arquivos

| Arquivo | O que muda |
|---|---|
| `projetos/acolitos/filtro-lista-core.js` (+ `.test.js`) | filtro `unico`; `escolhidos`; `intervaloDoPeriodo`; `normalizar` exportado |
| `projetos/acolitos/shared.js`, `shared.css` | barra: filtro `unico` vira escolha única; filtro com `busca` ganha campo no painel |
| `docs/migrations/069_filtros_de_ausencias.sql`, `docs/provas/provar-069-filtros-de-ausencias.sql` | vista + funções de faltas |
| `projetos/acolitos/ausencias.html` | as duas abas com a barra, filtro na consulta, erro como erro |
| `projetos/acolitos/provas/telas.prova.mjs` | provas da barra nova e das duas abas |
| `docs/pendencias*.md`, `projetos/acolitos/sw.js` | Tarefa 6 |

---

### Task 1: A regra aprende escolha única, períodos e leitura das escolhas

**Files:**
- Modify: `projetos/acolitos/filtro-lista-core.js`
- Test: `projetos/acolitos/filtro-lista-core.test.js`

**Interfaces:**
- Produces (no objeto `FiltroLista`):
  - filtro com `unico: true` — `alternar` desliga as outras opções DO MESMO filtro ao ligar uma; `restaurar` guarda só a primeira de um filtro único.
  - `escolhidos(estado, filtroId) -> string[]` (ids ligados daquele filtro, na ordem em que foram ligados)
  - `intervaloDoPeriodo(periodoId, hojeYmd) -> { desde: 'YYYY-MM-DD'|null, ate: 'YYYY-MM-DD'|null }` para `proximas`, `este_mes`, `mes_passado`, `ultimos_90` (qualquer outro: ambos `null`)
  - `normalizar(texto) -> string` (a mesma usada na busca: sem acento, minúsculo, sem espaço nas pontas)

- [ ] **Step 1: As provas que falham** — acrescentar ao FIM de `filtro-lista-core.test.js`:

```js
// ── Passo 4: escolha única, períodos e leitura das escolhas ──
const configUnico = {
  chave: 'prova-unico', rotulo: ['item', 'itens'], ordemPadrao: 'nome',
  ordens: [{ id: 'nome', nome: 'Nome', valor: (p) => p.nome }],
  filtros: [
    { id: 'periodo', nome: 'Período', unico: true, opcoes: [
      { id: 'este_mes', nome: 'Este mês', testa: () => true },
      { id: 'mes_passado', nome: 'Mês passado', testa: () => true },
    ] },
    { id: 'com', nome: 'Comunidade', opcoes: [
      { id: 'matriz', nome: 'Matriz', testa: () => true },
      { id: 'sa', nome: 'Santo Antônio', testa: () => true },
    ] },
  ],
};

test('filtro ÚNICO: ligar outra opção desliga a anterior', () => {
  let e = F.alternar(F.estadoInicial(configUnico), configUnico, 'periodo', 'este_mes');
  e = F.alternar(e, configUnico, 'periodo', 'mes_passado');
  assert.deepStrictEqual(F.escolhidos(e, 'periodo'), ['mes_passado']);
  assert.strictEqual(F.contar(e), 1);
});

test('filtro ÚNICO: tocar na ligada desliga, e não mexe nos outros filtros', () => {
  let e = F.alternar(F.estadoInicial(configUnico), configUnico, 'com', 'matriz');
  e = F.alternar(e, configUnico, 'periodo', 'este_mes');
  e = F.alternar(e, configUnico, 'periodo', 'este_mes');
  assert.deepStrictEqual(F.escolhidos(e, 'periodo'), []);
  assert.deepStrictEqual(F.escolhidos(e, 'com'), ['matriz']);
});

test('restaurar guarda só UMA opção de um filtro único', () => {
  const velho = JSON.stringify({ v: 1, ordem: 'nome', busca: '',
    ligados: [{ f: 'periodo', o: 'este_mes' }, { f: 'com', o: 'sa' }, { f: 'periodo', o: 'mes_passado' }] });
  assert.deepStrictEqual(F.restaurar(velho, configUnico).ligados,
    [{ f: 'periodo', o: 'este_mes' }, { f: 'com', o: 'sa' }]);
});

test('escolhidos devolve só o filtro pedido, na ordem em que foi ligado', () => {
  let e = F.alternar(F.estadoInicial(configUnico), configUnico, 'com', 'sa');
  e = F.alternar(e, configUnico, 'periodo', 'este_mes');
  e = F.alternar(e, configUnico, 'com', 'matriz');
  assert.deepStrictEqual(F.escolhidos(e, 'com'), ['sa', 'matriz']);
  assert.deepStrictEqual(F.escolhidos(e, 'nada'), []);
});

test('intervaloDoPeriodo calcula cada período a partir do dia dado', () => {
  assert.deepStrictEqual(F.intervaloDoPeriodo('proximas', '2026-09-17'), { desde: '2026-09-17', ate: null });
  assert.deepStrictEqual(F.intervaloDoPeriodo('este_mes', '2026-09-17'), { desde: '2026-09-01', ate: '2026-09-30' });
  assert.deepStrictEqual(F.intervaloDoPeriodo('este_mes', '2028-02-10'), { desde: '2028-02-01', ate: '2028-02-29' });
  assert.deepStrictEqual(F.intervaloDoPeriodo('mes_passado', '2026-01-10'), { desde: '2025-12-01', ate: '2025-12-31' });
  assert.deepStrictEqual(F.intervaloDoPeriodo('mes_passado', '2026-03-31'), { desde: '2026-02-01', ate: '2026-02-28' });
  assert.deepStrictEqual(F.intervaloDoPeriodo('ultimos_90', '2026-03-01'), { desde: '2025-12-01', ate: '2026-03-01' });
  assert.deepStrictEqual(F.intervaloDoPeriodo('inventado', '2026-09-17'), { desde: null, ate: null });
});

test('normalizar tira acento, caixa e espaço das pontas', () => {
  assert.strictEqual(F.normalizar('  Érico LÚCIO '), 'erico lucio');
  assert.strictEqual(F.normalizar(null), '');
});
```

Run: `node --test projetos/acolitos/filtro-lista-core.test.js > /tmp/claude-501/p4t1-red.txt 2>&1; tail -12 /tmp/claude-501/p4t1-red.txt`
Expected: as 6 provas novas falham (`F.escolhidos is not a function` etc.); as 16 antigas passam.

- [ ] **Step 2: A regra**

Em `filtro-lista-core.js`, trocar a função `alternar` inteira por:

```js
  function alternar(estado, config, filtroId, opcaoId) {
    var f = acharFiltro(config, filtroId);
    if (!acharOpcao(f, opcaoId)) return estado;
    var jaLigado = estaLigado(estado, filtroId, opcaoId);
    // Filtro de escolha ÚNICA (ex.: período): ligar uma opção desliga as outras dele.
    var base = (f.unico && !jaLigado)
      ? estado.ligados.filter(function (l) { return l.f !== filtroId; })
      : estado.ligados;
    var ligados = jaLigado
      ? base.filter(function (l) { return !(l.f === filtroId && l.o === opcaoId); })
      : base.concat([{ f: filtroId, o: opcaoId }]);
    return copia(estado, { ligados: ligados });
  }
```

Em `restaurar`, trocar o bloco
```js
    var ligados = [];
    (Array.isArray(dado.ligados) ? dado.ligados : []).forEach(function (l) {
      if (!l || !acharOpcao(acharFiltro(config, l.f), l.o)) return;
      var repetido = ligados.some(function (x) { return x.f === l.f && x.o === l.o; });
      if (!repetido) ligados.push({ f: l.f, o: l.o });
    });
```
por
```js
    var ligados = [];
    (Array.isArray(dado.ligados) ? dado.ligados : []).forEach(function (l) {
      if (!l) return;
      var f = acharFiltro(config, l.f);
      if (!acharOpcao(f, l.o)) return;
      var repetido = ligados.some(function (x) {
        return x.f === l.f && (f.unico || x.o === l.o);
      });
      if (!repetido) ligados.push({ f: l.f, o: l.o });
    });
```

Logo antes de `var api = {`, acrescentar:

```js
  function escolhidos(estado, filtroId) {
    return estado.ligados.filter(function (l) { return l.f === filtroId; }).map(function (l) { return l.o; });
  }

  // Períodos das listas que filtram por data da missa. `hoje` vem de fora ('YYYY-MM-DD',
  // no fuso local) para a conta poder ser provada com uma data fixa.
  function intervaloDoPeriodo(periodoId, hoje) {
    var p = String(hoje || '').split('-').map(Number);
    var y = p[0], m = p[1], d = p[2];
    function ymd(Y, M, D) { return Y + '-' + String(M).padStart(2, '0') + '-' + String(D).padStart(2, '0'); }
    function ultimoDia(Y, M) { return new Date(Y, M, 0).getDate(); }
    if (!y || !m || !d) return { desde: null, ate: null };
    if (periodoId === 'proximas') return { desde: ymd(y, m, d), ate: null };
    if (periodoId === 'este_mes') return { desde: ymd(y, m, 1), ate: ymd(y, m, ultimoDia(y, m)) };
    if (periodoId === 'mes_passado') {
      var Y = m === 1 ? y - 1 : y, M = m === 1 ? 12 : m - 1;
      return { desde: ymd(Y, M, 1), ate: ymd(Y, M, ultimoDia(Y, M)) };
    }
    if (periodoId === 'ultimos_90') {
      var ini = new Date(y, m - 1, d - 90);
      return { desde: ymd(ini.getFullYear(), ini.getMonth() + 1, ini.getDate()), ate: ymd(y, m, d) };
    }
    return { desde: null, ate: null };
  }
```

E no objeto `api`, acrescentar as quatro chaves:
```js
    escolhidos: escolhidos,
    intervaloDoPeriodo: intervaloDoPeriodo,
    normalizar: normalizar,
```
(`normalizar` já existe dentro do arquivo; só passa a ser exportada.)

- [ ] **Step 3: Rodar**

Run: `node --test projetos/acolitos/filtro-lista-core.test.js > /tmp/claude-501/p4t1-green.txt 2>&1; tail -8 /tmp/claude-501/p4t1-green.txt; npm run provar-regras 2>&1 | grep -E "^ℹ (tests|fail)"`
Expected: `pass 22`; suíte `tests 260`, `fail 0` (254 + 6). As provas de tela não mudam (rodar uma vez, `> /tmp/claude-501/p4t1-telas.txt`, esperar **259**).

- [ ] **Step 4: Commit**
```bash
git add projetos/acolitos/filtro-lista-core.js projetos/acolitos/filtro-lista-core.test.js
git commit -m "feat(acolitos): a regra dos filtros aprende escolha única e períodos" -m "Filtro único (período) desliga a opção anterior; escolhidos() lê o que está ligado para montar a consulta; intervaloDoPeriodo() calcula próximas / este mês / mês passado / últimos 90 dias." -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: A barra ganha escolha única e busca dentro do painel

**Files:**
- Modify: `projetos/acolitos/shared.js` (dentro de `montarFiltroLista`), `projetos/acolitos/shared.css` (fim)
- Test: `projetos/acolitos/provas/telas.prova.mjs`

**Interfaces:**
- Consumes: Task 1 (`unico`, `normalizar`).
- Produces: filtro com `unico: true` desenha opções com `role="radio"`; filtro com `busca: { placeholder, max }` desenha, dentro da sua seção, um campo `input.search-input.filtro-painel-busca` e mostra: as opções já escolhidas (sempre) + as que batem com o que foi digitado (no máximo `max`, padrão 8); sem nada: `.filtro-painel-dica` "Digite para buscar." ou "Ninguém com esse nome.". O texto digitado sobrevive a tocar numa opção.

- [ ] **Step 1: A prova que falha** — antes de `async function provaRecadoDaFotoAparece(provas) {`:

```js
async function provaBarraBuscaNoPainelEEscolhaUnica(provas) {
  console.log('\n\x1b[1mBarra de filtro: busca dentro do painel e escolha única\x1b[0m');

  // Ausências filtra por pessoa: são 177, não cabem em botões. O painel mostra as escolhidas
  // e só as que batem com o que se digita. Período é de escolha única.
  const r = await provas.abrir('caixa.html', {
    papel: PAPEIS.admin,
    avaliar: `
      const esperar = (ms) => new Promise(f => setTimeout(f, ms));
      try { localStorage.removeItem('filtro-lista:prova-busca'); } catch (e) {}
      const nomes = ['Ana Clara', 'Ana Lúcia'];
      for (let i = 1; i <= 30; i++) nomes.push('Pessoa ' + String(i).padStart(2, '0'));
      const cfg = {
        chave: 'prova-busca', rotulo: ['item', 'itens'], ordemPadrao: 'x',
        ordens: [{ id: 'x', nome: 'X', valor: () => '' }],
        filtros: [
          { id: 'pessoa', nome: 'Pessoa', busca: { placeholder: 'Buscar pessoa...', max: 8 },
            opcoes: nomes.map((n, i) => ({ id: 'p' + i, nome: n, testa: () => true })) },
          { id: 'periodo', nome: 'Período', unico: true, opcoes: [
            { id: 'este_mes', nome: 'Este mês', testa: () => true },
            { id: 'mes_passado', nome: 'Mês passado', testa: () => true },
          ] },
        ],
        contar: () => 0,
      };
      const alvo = document.createElement('div'); document.body.appendChild(alvo);
      montarFiltroLista(alvo, cfg, () => {});
      const painel = () => document.querySelector('.modal-overlay.open .filtro-painel');
      const secao = (i) => painel().querySelectorAll('.filtro-painel-secao')[i];
      const botoes = (i) => [...secao(i).querySelectorAll('.form-toggle')].map(b => b.textContent.trim());
      const dica = (i) => ((secao(i).querySelector('.filtro-painel-dica') || {}).textContent || '').trim();
      const digitar = async (txt) => { const inp = secao(0).querySelector('.filtro-painel-busca'); inp.value = txt; inp.dispatchEvent(new Event('input')); await esperar(20); };
      const out = {};

      alvo.querySelector('.filtro-btn').click(); await esperar(30);
      out.temCampo = !!secao(0).querySelector('.filtro-painel-busca');
      out.semTermo = botoes(0);
      out.dicaSemTermo = dica(0);
      await digitar('ana');
      out.comAna = botoes(0);
      await digitar('pessoa');
      out.quantasPessoa = botoes(0).length;
      await digitar('zzz');
      out.dicaSemAchar = dica(0);
      await digitar('ana');
      [...secao(0).querySelectorAll('.form-toggle')].find(b => b.textContent.trim() === 'Ana Lúcia').click(); await esperar(30);
      out.termoDepoisDeTocar = secao(0).querySelector('.filtro-painel-busca').value;
      out.depoisDeTocar = botoes(0);
      await digitar('');
      out.soEscolhida = botoes(0);

      const tocarPeriodo = async (txt) => { [...secao(1).querySelectorAll('.form-toggle')].find(b => b.textContent.trim() === txt).click(); await esperar(30); };
      await tocarPeriodo('Este mês');
      await tocarPeriodo('Mês passado');
      out.periodoLigados = [...secao(1).querySelectorAll('.form-toggle')].filter(b => b.getAttribute('aria-checked') === 'true').map(b => b.textContent.trim());
      out.papelPeriodo = secao(1).querySelector('.form-toggle').getAttribute('role');
      out.papelPessoa = secao(0).querySelector('.form-toggle').getAttribute('role');

      painel().querySelector('.filtro-ver').click(); await esperar(120);
      out.etiquetas = [...alvo.querySelectorAll('.filtro-etiqueta')].map(b => b.textContent.trim());
      try { localStorage.removeItem('filtro-lista:prova-busca'); } catch (e) {}
      alvo.remove();
      return out;
    `,
  });
  const a = r.avaliado || {};
  exigir(!r.erroAvaliar, 'a busca no painel roda sem estourar', r.erroAvaliar);
  exigir(r.avaliado && typeof r.avaliado === 'object', 'a prova da busca chegou ao fim (a página não saiu do lugar)', 'avaliado: ' + JSON.stringify(r.avaliado));
  exigir(a.temCampo === true, 'filtro com lista longa ganha campo de busca no painel');
  exigir(JSON.stringify(a.semTermo) === '[]' && a.dicaSemTermo === 'Digite para buscar.', 'sem digitar, não despeja a lista inteira', 'botões: ' + JSON.stringify(a.semTermo) + ' dica: ' + JSON.stringify(a.dicaSemTermo));
  exigir(JSON.stringify(a.comAna) === JSON.stringify(['Ana Clara', 'Ana Lúcia']), 'a busca acha pelo nome, com ou sem acento', 'saiu: ' + JSON.stringify(a.comAna));
  exigir(a.quantasPessoa === 8, 'a busca mostra no máximo o limite (8)', 'saiu: ' + a.quantasPessoa);
  exigir(a.dicaSemAchar === 'Ninguém com esse nome.', 'busca sem resultado diz isso', 'saiu: ' + JSON.stringify(a.dicaSemAchar));
  exigir(a.termoDepoisDeTocar === 'ana', 'tocar numa pessoa não apaga o que foi digitado', 'campo: ' + JSON.stringify(a.termoDepoisDeTocar));
  exigir(JSON.stringify(a.depoisDeTocar) === JSON.stringify(['Ana Lúcia', 'Ana Clara']), 'a escolhida vem primeiro', 'saiu: ' + JSON.stringify(a.depoisDeTocar));
  exigir(JSON.stringify(a.soEscolhida) === JSON.stringify(['Ana Lúcia']), 'com o campo vazio, a escolhida continua à vista', 'saiu: ' + JSON.stringify(a.soEscolhida));
  exigir(JSON.stringify(a.periodoLigados) === JSON.stringify(['Mês passado']), 'período é de escolha única', 'saiu: ' + JSON.stringify(a.periodoLigados));
  exigir(a.papelPeriodo === 'radio' && a.papelPessoa === 'checkbox', 'escolha única é anunciada como opção única', 'papéis: ' + a.papelPeriodo + '/' + a.papelPessoa);
  exigir(JSON.stringify(a.etiquetas) === JSON.stringify(['Ana Lúcia', 'Mês passado']), 'as escolhas viram etiquetas', 'saiu: ' + JSON.stringify(a.etiquetas));
}
```

No rodapé, depois de `    await provaChamadaFiltra(provas);`: `    await provaBarraBuscaNoPainelEEscolhaUnica(provas);`

Run: `npm run provar-telas > /tmp/claude-501/p4t2-red.txt 2>&1; grep -a -A16 "busca dentro do painel" /tmp/claude-501/p4t2-red.txt | head -18`
Expected: falhas (sem campo de busca; período soma).

- [ ] **Step 2: A barra**

Em `montarFiltroLista` (shared.js), no começo do `btn.onclick = () => {`, logo depois de `    let pedido = 0;`, acrescentar:
```js
    const termos = {};   // o que foi digitado em cada filtro com busca — sobrevive ao redesenho
```

Trocar o bloco
```js
      (config.filtros || []).forEach((f) => {
        const gf = secao(f.nome);
        f.opcoes.forEach((op) => opcao(gf, op.nome, F.estaLigado(rascunho, f.id, op.id), 'checkbox', () => {
          rascunho = F.alternar(rascunho, config, f.id, op.id); desenharCorpo(); atualizarVer();
        }));
      });
```
por
```js
      (config.filtros || []).forEach((f) => {
        const gf = secao(f.nome);
        const papel = f.unico ? 'radio' : 'checkbox';
        const tocar = (op) => () => { rascunho = F.alternar(rascunho, config, f.id, op.id); desenharCorpo(); atualizarVer(); };
        if (!f.busca) {
          f.opcoes.forEach((op) => opcao(gf, op.nome, F.estaLigado(rascunho, f.id, op.id), papel, tocar(op)));
          return;
        }
        // Lista longa (ex.: 177 pessoas): campo de busca dentro do painel. As já escolhidas
        // aparecem sempre; as outras só quando se digita, até o limite.
        const inp = document.createElement('input');
        inp.className = 'search-input filtro-painel-busca'; inp.type = 'search';
        inp.placeholder = f.busca.placeholder || 'Buscar...';
        inp.value = termos[f.id] || '';
        gf.parentNode.insertBefore(inp, gf);
        const desenharAchadas = () => {
          gf.textContent = '';
          const termo = F.normalizar(inp.value);
          const escolhidas = f.opcoes.filter((op) => F.estaLigado(rascunho, f.id, op.id));
          const achadas = termo
            ? f.opcoes.filter((op) => !F.estaLigado(rascunho, f.id, op.id) && F.normalizar(op.nome).indexOf(termo) >= 0).slice(0, f.busca.max || 8)
            : [];
          escolhidas.concat(achadas).forEach((op) => opcao(gf, op.nome, F.estaLigado(rascunho, f.id, op.id), papel, tocar(op)));
          if (!escolhidas.length && !achadas.length) {
            const dica = document.createElement('div'); dica.className = 'filtro-painel-dica';
            dica.textContent = termo ? 'Ninguém com esse nome.' : 'Digite para buscar.';
            gf.appendChild(dica);
          }
        };
        inp.oninput = () => { termos[f.id] = inp.value; desenharAchadas(); };
        desenharAchadas();
      });
```

No fim de `shared.css`:
```css
.filtro-painel-busca { width: 100%; margin-bottom: 8px; }
.filtro-painel-dica { font-size: 12px; color: var(--text-muted); font-style: italic; padding: 4px 2px; }
```
Saldo de chaves 0 (o mesmo comando `node -e` do passo 1).

- [ ] **Step 3: Rodar** — `node --check projetos/acolitos/shared.js`; `npm run provar-telas > /tmp/claude-501/p4t2-green.txt 2>&1` → **272** (259 + 13), duas vezes; regras **260**.

- [ ] **Step 4: Commit** (`shared.js`, `shared.css`, `telas.prova.mjs`): `feat(acolitos): a barra de filtro busca dentro do painel e aceita escolha única`

---

### Task 3: Migration 069 — a vista das ausências e as faltas filtradas

**Files:**
- Create: `docs/migrations/069_filtros_de_ausencias.sql`, `docs/provas/provar-069-filtros-de-ausencias.sql`

**Interfaces (produzidas):**
- Vista `public.acolitos_ausencias_v` (security_invoker): `id, membro_id, celebracao_id, motivo, observacao, created_at, missa_data date, missa_horario text, missa_comunidade text`. Pelo cliente: `sb.from('acolitos_ausencias_v')` com `.in/.gte/.lte/.order/.limit` e `{ count: 'exact' }`.
- `public.acolitos_faltas_filtradas(p_membros uuid[] default null, p_desde date default null, p_ate date default null, p_comunidades text[] default null, p_limite int default 80) returns jsonb` — lista de `{ membro_id, membro, funcao, data, horario, comunidade, substituto }`, da missa mais recente para a mais antiga.
- `public.acolitos_faltas_contar(p_membros uuid[] default null, p_desde date default null, p_ate date default null, p_comunidades text[] default null) returns integer`.
- As duas funções: só `coord_admin`, `subadmin`, `membro_equipe` (a MESMA trava de `acolitos_faltas_recentes`); sem permissão = erro **42501**. `acolitos_faltas_recentes()` fica intacta.

- [ ] **Step 1: Conferir o terreno** (só leitura)
```bash
U=$(grep '^SUPABASE_DB_URL=' .env | cut -d= -f2-)
P=/opt/homebrew/opt/libpq/bin/psql
$P "$U" -At -c "select count(*), count(celebracao_id) from acolitos_ausencias;"
$P "$U" -At -c "select count(*) from acolitos_chamadas_itens where resultado='ausente';"
$P "$U" -At -c "select to_regclass('public.acolitos_ausencias_v'), to_regprocedure('public.acolitos_faltas_filtradas(uuid[],date,date,text[],integer)');"
$P "$U" -At -c "select coalesce(array_to_string(proacl,' '),'') from pg_proc where proname='acolitos_faltas_recentes';"
```
Expected: os totais de hoje (1202/1202 e ~357); `|` (nada existe ainda); a ACL `postgres=X… authenticated=X… service_role=X…`.

- [ ] **Step 2: A prova que falha** — criar `docs/provas/provar-069-filtros-de-ausencias.sql`:

```sql
-- Prova da 069 SEM gravar nada: filtros de Ausências no banco.
-- Rodar:  psql "$SUPABASE_DB_URL" -f docs/provas/provar-069-filtros-de-ausencias.sql
-- O QUE DEFENDE: (1) a vista das ausências obedece às MESMAS regras de acesso da tabela;
-- (2) a função de faltas filtra DENTRO do banco — a pessoa com 30 faltas aparece com 30,
-- não com as que caberiam nas 80 mais recentes; (3) sem permissão é ERRO, não lista vazia;
-- (4) a função antiga continua respondendo (a tela de hoje depende dela).
\set ON_ERROR_STOP on
\timing off

\echo '=== 0) quem pode ler/executar ==='
select has_table_privilege('anon', 'public.acolitos_ausencias_v', 'select') as anon_le_vista_DEVE_SER_f,
       has_table_privilege('authenticated', 'public.acolitos_ausencias_v', 'select') as logado_le_vista_DEVE_SER_t,
       has_function_privilege('anon', 'public.acolitos_faltas_filtradas(uuid[],date,date,text[],integer)', 'execute') as anon_faltas_DEVE_SER_f,
       has_function_privilege('anon', 'public.acolitos_faltas_contar(uuid[],date,date,text[])', 'execute') as anon_contar_DEVE_SER_f,
       (select reloptions from pg_class where oid = 'public.acolitos_ausencias_v'::regclass) as opcoes_DEVE_TER_security_invoker;

\echo ''
\echo '=== 1) a vista traz a data da missa de TODAS as ausências ==='
select count(*) as na_tabela, (select count(*) from public.acolitos_ausencias_v) as na_vista_DEVE_IGUALAR,
       (select count(*) from public.acolitos_ausencias_v where missa_data is null) as sem_data_DEVE_SER_0
  from public.acolitos_ausencias;

\echo ''
\echo '=== 2) a vista obedece às regras: para cada papel, vê o MESMO que a tabela ==='
select m.user_id as uid_membro from public.acolitos_membros m
 where m.user_id is not null and coalesce(public.acolitos_get_role(m.user_id), '') not in ('coord_admin','subadmin','membro_equipe','cerimonario')
   and exists (select 1 from public.acolitos_ausencias a where a.membro_id = m.id)
 limit 1 \gset
select m.user_id as uid_cerimo from public.acolitos_membros m
 where m.user_id is not null and public.acolitos_get_role(m.user_id) = 'cerimonario' limit 1 \gset
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'uid_membro', 'role', 'authenticated')::text, true) is not null as membro;
select (select count(*) from public.acolitos_ausencias) as tabela, (select count(*) from public.acolitos_ausencias_v) as vista_DEVE_IGUALAR;
select set_config('request.jwt.claims', json_build_object('sub', :'uid_cerimo', 'role', 'authenticated')::text, true) is not null as cerimoniario;
select (select count(*) from public.acolitos_ausencias) as tabela, (select count(*) from public.acolitos_ausencias_v) as vista_DEVE_IGUALAR;
select set_config('request.jwt.claims', '{"sub":"b6f27ee7-e19f-4444-a771-8fc6ef3c35cb","role":"authenticated"}', true) is not null as coordenacao;
select (select count(*) from public.acolitos_ausencias) as tabela, (select count(*) from public.acolitos_ausencias_v) as vista_DEVE_IGUALAR;
rollback;
\echo '   (o membro comum tem de ver MENOS que a coordenação — conferir nos números acima)'

\echo ''
\echo '=== 3) faltas: sem filtro bate com a função antiga; com pessoa, traz TODAS as dela ==='
select e.membro_id as membro_mais_faltas, count(*) as faltas_dele
  from public.acolitos_chamadas_itens ci join public.acolitos_escalas e on e.id = ci.escala_id
 where ci.resultado = 'ausente' group by e.membro_id order by count(*) desc limit 1 \gset
select count(*) as total_faltas from public.acolitos_chamadas_itens where resultado = 'ausente' \gset
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"b6f27ee7-e19f-4444-a771-8fc6ef3c35cb","role":"authenticated"}';
select jsonb_array_length(public.acolitos_faltas_recentes()) as antiga,
       jsonb_array_length(public.acolitos_faltas_filtradas()) as nova_DEVE_IGUALAR;
select public.acolitos_faltas_contar() as contar_tudo, :total_faltas as direto_DEVE_IGUALAR;
select jsonb_array_length(public.acolitos_faltas_filtradas(array[:'membro_mais_faltas']::uuid[], null, null, null, 500)) as da_pessoa,
       public.acolitos_faltas_contar(array[:'membro_mais_faltas']::uuid[]) as contar_pessoa,
       :faltas_dele as direto_DEVE_IGUALAR_OS_DOIS;
select count(*) as de_outra_pessoa_DEVE_SER_0
  from jsonb_array_elements(public.acolitos_faltas_filtradas(array[:'membro_mais_faltas']::uuid[], null, null, null, 500)) x
 where x->>'membro_id' <> :'membro_mais_faltas';
select count(*) as fora_do_periodo_DEVE_SER_0
  from jsonb_array_elements(public.acolitos_faltas_filtradas(null, '2026-08-01', '2026-08-31', null, 500)) x
 where (x->>'data')::date not between '2026-08-01' and '2026-08-31';
select count(*) as fora_da_comunidade_DEVE_SER_0
  from jsonb_array_elements(public.acolitos_faltas_filtradas(null, null, null, array['santo_antonio'], 500)) x
 where x->>'comunidade' <> 'santo_antonio';
select (select (x->>'data') from jsonb_array_elements(public.acolitos_faltas_filtradas()) with ordinality t(x, n) where n = 1)
       >= (select (x->>'data') from jsonb_array_elements(public.acolitos_faltas_filtradas()) with ordinality t(x, n) order by n desc limit 1)
       as mais_recente_primeiro_DEVE_SER_t;
rollback;

\echo ''
\echo '=== 4) sem permissão é ERRO (cerimoniário), não lista vazia ==='
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'uid_cerimo', 'role', 'authenticated')::text, true) is not null as cerimoniario;
do $$ begin
  perform public.acolitos_faltas_filtradas();
  raise notice 'LISTA: PASSOU — ERRADO';
exception when insufficient_privilege then raise notice 'LISTA: recusada — CERTO';
end $$;
do $$ begin
  perform public.acolitos_faltas_contar();
  raise notice 'CONTAR: PASSOU — ERRADO';
exception when insufficient_privilege then raise notice 'CONTAR: recusada — CERTO';
end $$;
rollback;
```

Run: `set -a && . ./.env && set +a && /opt/homebrew/opt/libpq/bin/psql "$SUPABASE_DB_URL" -f docs/provas/provar-069-filtros-de-ausencias.sql > /tmp/claude-501/p4t3-red.txt 2>&1; head -8 /tmp/claude-501/p4t3-red.txt`
Expected: erro "relation public.acolitos_ausencias_v does not exist".

- [ ] **Step 3: A migration** — criar `docs/migrations/069_filtros_de_ausencias.sql`:

```sql
-- Acólitos 069 — filtros da tela Ausências (passo 4 do ordenar e filtrar)
--
-- As duas abas vêm do banco em PEDAÇOS (60 avisos, 80 faltas). Filtrar o pedaço que veio
-- mostraria a pessoa com 30 ausências como se tivesse 2. O filtro tem de ir para a consulta.
--
-- AVISOS → uma VISTA. A data da missa só está copiada em 648 das 1.202 ausências; filtrar
-- por acolitos_ausencias.data deixaria 554 de fora. A vista junta a missa. Ela é
-- security_invoker: quem consulta a vista passa pelas MESMAS regras de acesso da tabela
-- (equipe e cerimoniário veem todas; o membro, as suas e as da família) — sem repetir a
-- trava à mão, que é como trava se desencontra.
--
-- FALTAS → função NOVA, com outro nome. Uma segunda acolitos_faltas_recentes com argumentos
-- opcionais deixaria AMBÍGUA a chamada sem argumentos que a tela de hoje faz, e a aba Faltas
-- quebraria no instante desta migration. A antiga fica intacta até a tela trocar.
-- Sem permissão = ERRO 42501. A antiga devolvia lista vazia, e o cerimoniário lia
-- "Nenhuma falta registrada ainda." — falha virando zero.
--
-- IDEMPOTENTE. Prova: docs/provas/provar-069-filtros-de-ausencias.sql

create or replace view public.acolitos_ausencias_v
with (security_invoker = true) as
select a.id, a.membro_id, a.celebracao_id, a.motivo, a.observacao, a.created_at,
       coalesce(c.data, a.data) as missa_data,
       c.horario as missa_horario,
       c.comunidade as missa_comunidade
  from public.acolitos_ausencias a
  left join public.acolitos_celebracoes c on c.id = a.celebracao_id;

revoke all on public.acolitos_ausencias_v from public;
revoke all on public.acolitos_ausencias_v from anon;
grant select on public.acolitos_ausencias_v to authenticated;
grant select on public.acolitos_ausencias_v to service_role;
comment on view public.acolitos_ausencias_v is
  'Ausências com a data/horário/comunidade da missa, para filtrar na consulta. security_invoker: obedece às regras de acolitos_ausencias. Prova: provar-069.';

create or replace function public.acolitos_faltas_filtradas(
  p_membros uuid[] default null, p_desde date default null, p_ate date default null,
  p_comunidades text[] default null, p_limite integer default 80)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare v_role text := acolitos_get_role(auth.uid());
begin
  if v_role is null or v_role not in ('coord_admin','subadmin','membro_equipe') then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(t.x order by t.d desc, t.h desc)
      from (
        select jsonb_build_object(
                 'membro_id', m.id,
                 'membro', coalesce(nullif(m.apelido,''), m.nome),
                 'funcao', e.funcao,
                 'data', cel.data, 'horario', cel.horario, 'comunidade', cel.comunidade,
                 'substituto', case when ci.substituto_id is not null
                                    then coalesce(nullif(sub.apelido,''), sub.nome) end
               ) as x,
               cel.data as d, cel.horario as h
          from acolitos_chamadas_itens ci
          join acolitos_chamadas ch on ch.id = ci.chamada_id
          join acolitos_escalas e on e.id = ci.escala_id
          join acolitos_celebracoes cel on cel.id = ch.celebracao_id
          join acolitos_membros m on m.id = e.membro_id
          left join acolitos_membros sub on sub.id = ci.substituto_id
         where ci.resultado = 'ausente'
           and (p_membros is null or e.membro_id = any(p_membros))
           and (p_desde is null or cel.data >= p_desde)
           and (p_ate is null or cel.data <= p_ate)
           and (p_comunidades is null or cel.comunidade = any(p_comunidades))
         order by cel.data desc, cel.horario desc
         limit greatest(1, least(coalesce(p_limite, 80), 500))
      ) t
  ), '[]'::jsonb);
end; $$;

create or replace function public.acolitos_faltas_contar(
  p_membros uuid[] default null, p_desde date default null, p_ate date default null,
  p_comunidades text[] default null)
returns integer
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare v_role text := acolitos_get_role(auth.uid()); v_n integer;
begin
  if v_role is null or v_role not in ('coord_admin','subadmin','membro_equipe') then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;
  select count(*) into v_n
    from acolitos_chamadas_itens ci
    join acolitos_chamadas ch on ch.id = ci.chamada_id
    join acolitos_escalas e on e.id = ci.escala_id
    join acolitos_celebracoes cel on cel.id = ch.celebracao_id
   where ci.resultado = 'ausente'
     and (p_membros is null or e.membro_id = any(p_membros))
     and (p_desde is null or cel.data >= p_desde)
     and (p_ate is null or cel.data <= p_ate)
     and (p_comunidades is null or cel.comunidade = any(p_comunidades));
  return v_n;
end; $$;

revoke all on function public.acolitos_faltas_filtradas(uuid[], date, date, text[], integer) from public;
revoke all on function public.acolitos_faltas_filtradas(uuid[], date, date, text[], integer) from anon;
grant execute on function public.acolitos_faltas_filtradas(uuid[], date, date, text[], integer) to authenticated;
grant execute on function public.acolitos_faltas_filtradas(uuid[], date, date, text[], integer) to service_role;
revoke all on function public.acolitos_faltas_contar(uuid[], date, date, text[]) from public;
revoke all on function public.acolitos_faltas_contar(uuid[], date, date, text[]) from anon;
grant execute on function public.acolitos_faltas_contar(uuid[], date, date, text[]) to authenticated;
grant execute on function public.acolitos_faltas_contar(uuid[], date, date, text[]) to service_role;

comment on function public.acolitos_faltas_filtradas(uuid[], date, date, text[], integer) is
  'Faltas (chamada = ausente) filtradas no banco. Só coord_admin/subadmin/membro_equipe; sem permissão = 42501. Prova: provar-069.';
comment on function public.acolitos_faltas_contar(uuid[], date, date, text[]) is
  'Quantas faltas batem com os filtros. Mesma trava de acolitos_faltas_filtradas.';

-- O servidor de consultas (PostgREST) só enxerga vista e função novas depois de recarregar.
notify pgrst, 'reload schema';
```

- [ ] **Step 4: Aplicar e provar**
```bash
set -a && . ./.env && set +a
P=/opt/homebrew/opt/libpq/bin/psql
$P "$SUPABASE_DB_URL" -f docs/migrations/069_filtros_de_ausencias.sql > /tmp/claude-501/p4t3-aplicar.txt 2>&1; cat /tmp/claude-501/p4t3-aplicar.txt
$P "$SUPABASE_DB_URL" -f docs/provas/provar-069-filtros-de-ausencias.sql > /tmp/claude-501/p4t3-green.txt 2>&1; cat /tmp/claude-501/p4t3-green.txt
```
Expected: `CREATE VIEW`, REVOKE/GRANT, 2×`CREATE FUNCTION`, COMMENT, `NOTIFY`. Na prova: seção 0 `f | t | f | f | {security_invoker=true}`; seção 1 números iguais e `0`; seção 2 os três pares iguais, e o membro com menos que a coordenação; seção 3 todos os `DEVE_IGUALAR` iguais e os `DEVE_SER_0` zerados, `t` na ordem; seção 4 duas linhas `recusada — CERTO`.

Depois, conferir que a tela de HOJE (no ar) não quebrou: `$P "$SUPABASE_DB_URL" -At -c "select count(*) from pg_proc where proname='acolitos_faltas_recentes';"` → `1`.

- [ ] **Step 5: Commit** (os dois arquivos): `feat(acolitos): o banco filtra ausências e faltas na consulta` + parágrafo sobre a vista e o nome novo.

---

### Task 4: Aba Avisos — a barra com o filtro na consulta

**Files:**
- Modify: `projetos/acolitos/ausencias.html` (`renderViewEquipe`, trecho dos avisos)
- Test: `projetos/acolitos/provas/telas.prova.mjs`

**Interfaces:**
- Consumes: Task 1 (`escolhidos`, `intervaloDoPeriodo`, `unico`), Task 2 (`busca` no filtro), Task 3 (vista `acolitos_ausencias_v`), `hojeLocal()` (shared.js), `carregarRosterAus()`, `MOTIVOS`, `DIAS`, `comLabel`.
- Produces: globais `filtroAvisos`, `configFiltroAvisos(membros)`, `consultaAvisos(estado, soContar)`, `recarregarAvisos()`, `PERIODOS_AUSENCIA`.

- [ ] **Step 1: A prova que falha** — antes de `async function provaRecadoDaFotoAparece(provas) {`:

```js
async function provaAvisosDeAusenciaFiltramNaConsulta(provas) {
  console.log('\n\x1b[1mAusências › Avisos: o filtro vai para a CONSULTA, e erro é erro\x1b[0m');

  // O banco falso do harness ignora filtros. Então esta prova olha a PERGUNTA que a tela faz
  // ao banco — é ela que garante que a pessoa com 30 ausências não aparece com 2.
  const roster = { membros: [
    { id: 'u-ana', nome: 'Ana Souza', apelido: null }, { id: 'u-bia', nome: 'Beatriz Lima', apelido: 'Bia' },
  ], habs: [] };
  const r = await provas.abrir('ausencias.html', {
    papel: PAPEIS.admin,
    rpcs: { acolitos_roster_substituicao: { data: roster } },
    avaliar: `
      const esperar = (ms) => new Promise(f => setTimeout(f, ms));
      const guarda = () => { try { localStorage.removeItem('filtro-lista:ausencias-avisos'); } catch (e) {} };
      guarda();
      const consultas = [];
      let modo = 'ok';
      const linhas = Array.from({ length: 60 }, (_, i) => ({ id: 'a' + i, membro_id: i % 2 ? 'u-bia' : 'u-ana',
        celebracao_id: 'c' + i, motivo: 'viagem', observacao: null, created_at: '2026-09-0' + (1 + i % 9) + 'T12:00:00+00:00',
        missa_data: '2026-09-1' + (i % 9), missa_horario: '19:00', missa_comunidade: 'matriz' }));
      const orig = sb.from.bind(sb);
      sb.from = (t) => {
        if (t !== 'acolitos_ausencias_v') return orig(t);
        const reg = { chamadas: [] }; consultas.push(reg);
        const resp = () => {
          const soContar = reg.chamadas.some(c => c[0] === 'select' && c[2] && c[2].head);
          if (modo === 'erro') return { data: null, count: null, error: { message: 'fora do ar' } };
          if (soContar) return { data: null, count: 1202, error: null };
          return { data: modo === 'vazio' ? [] : linhas, count: modo === 'vazio' ? 0 : 1202, error: null };
        };
        const p = new Proxy({}, { get: (_, k) => k === 'then'
          ? (ok, ko) => Promise.resolve(resp()).then(ok, ko)
          : (...args) => { reg.chamadas.push([k, ...args]); return p; } });
        return p;
      };
      const ultimaLista = () => [...consultas].reverse().find(c => !c.chamadas.some(x => x[0] === 'select' && x[2] && x[2].head));
      const tem = (c, ...alvo) => !!c && c.chamadas.some(x => JSON.stringify(x.slice(0, alvo.length)) === JSON.stringify(alvo));
      const painel = () => document.querySelector('.modal-overlay.open .filtro-painel');
      const abrir = async () => { document.querySelector('#filtro-avisos .filtro-btn').click(); await esperar(40); };
      const ver = async () => { painel().querySelector('.filtro-ver').click(); await esperar(150); };
      const tocar = (txt) => { const b = [...painel().querySelectorAll('.form-toggle')].find(x => x.textContent.trim() === txt); if (!b) throw new Error('sem opção ' + txt); b.click(); };
      const limpar = async () => { const l = document.querySelector('#filtro-avisos .filtro-limpar'); if (l) { l.click(); await esperar(150); } };
      const texto = () => (document.getElementById('lista-avisos') || {}).textContent || '';
      const out = {};

      abaAusencias = 'avisos'; await renderViewEquipe(); await esperar(80);
      const primeira = ultimaLista();
      out.semFiltroSemIn = !!primeira && !primeira.chamadas.some(x => x[0] === 'in' || x[0] === 'gte' || x[0] === 'lte');
      out.ordemPadrao = tem(primeira, 'order', 'missa_data');
      out.limite = tem(primeira, 'limit', 60);
      out.mostrando = /Mostrando 60 de 1202/.test(texto());
      out.nomeDoRoster = /Ana Souza/.test(texto()) && /Bia/.test(texto());

      await abrir();
      out.secoes = [...painel().querySelectorAll('.filtro-painel-titulo')].map(e => e.textContent.trim());
      const campo = painel().querySelector('.filtro-painel-busca');
      campo.value = 'bia'; campo.dispatchEvent(new Event('input')); await esperar(20);
      tocar('Bia · Beatriz Lima'); await esperar(60);
      out.verComPessoa = painel().querySelector('.filtro-ver').textContent.trim();
      const contagem = [...consultas].reverse().find(c => c.chamadas.some(x => x[0] === 'select' && x[2] && x[2].head));
      out.contagemComPessoa = tem(contagem, 'in', 'membro_id', ['u-bia']);
      await ver();
      out.listaComPessoa = tem(ultimaLista(), 'in', 'membro_id', ['u-bia']);
      await limpar();

      await abrir(); tocar('Este mês'); await ver();
      const iv = FiltroLista.intervaloDoPeriodo('este_mes', hojeLocal());
      out.periodo = tem(ultimaLista(), 'gte', 'missa_data', iv.desde) && tem(ultimaLista(), 'lte', 'missa_data', iv.ate);
      await limpar();

      await abrir(); tocar('Santo Antônio'); tocar('Viagem'); await ver();
      out.comunidadeEMotivo = tem(ultimaLista(), 'in', 'missa_comunidade', ['santo_antonio']) && tem(ultimaLista(), 'in', 'motivo', ['viagem']);
      out.motivoSemEmoji = [...document.querySelectorAll('#filtro-avisos .filtro-etiqueta')].map(e => e.textContent.trim());
      await limpar();

      await abrir(); tocar('Quando avisou'); await ver();
      out.ordemAviso = tem(ultimaLista(), 'order', 'created_at');

      modo = 'vazio'; await abrir(); tocar('Santo Antônio'); await ver();
      out.vazioComFiltro = texto();
      await limpar();
      modo = 'erro'; await recarregarAvisos(); await esperar(60);
      out.comErro = texto();

      guarda(); sb.from = orig;
      return out;
    `,
  });
  const a = r.avaliado || {};
  exigir(!r.erroAvaliar, 'a aba Avisos filtra sem estourar', r.erroAvaliar);
  exigir(r.avaliado && typeof r.avaliado === 'object', 'a prova dos Avisos chegou ao fim (a página não saiu do lugar)', 'avaliado: ' + JSON.stringify(r.avaliado));
  exigir((r.erros || []).length === 0, 'nenhum erro de JavaScript em Ausências', (r.erros || []).join(' | '));
  exigir(a.semFiltroSemIn === true, 'sem filtro, a consulta não filtra nada');
  exigir(a.ordemPadrao === true, 'a ordem padrão é pela data da missa');
  exigir(a.limite === true, 'a lista continua vindo em pedaços de 60');
  exigir(a.mostrando === true, 'a tela diz que mostra 60 de 1202 — não finge que é tudo');
  exigir(a.nomeDoRoster === true, 'os nomes vêm do cadastro seguro (vale para o cerimoniário)');
  exigir(JSON.stringify(a.secoes) === JSON.stringify(['Ordenar por', 'Pessoa', 'Período (data da missa)', 'Comunidade', 'Motivo']),
    'o painel oferece ordem, pessoa, período, comunidade e motivo', 'saiu: ' + JSON.stringify(a.secoes));
  exigir(a.contagemComPessoa === true, 'o "Ver N" pergunta ao BANCO com a pessoa escolhida');
  exigir(a.verComPessoa === 'Ver 1202 avisos', 'o "Ver N" mostra o número que o banco deu', 'mostrou: ' + JSON.stringify(a.verComPessoa));
  exigir(a.listaComPessoa === true, 'escolher a pessoa MUDA A CONSULTA (não filtra os 60 que vieram)');
  exigir(a.periodo === true, 'o período vira intervalo de datas na consulta');
  exigir(a.comunidadeEMotivo === true, 'comunidade e motivo também vão para a consulta');
  exigir(JSON.stringify(a.motivoSemEmoji) === JSON.stringify(['Santo Antônio', 'Viagem']), 'as etiquetas de motivo saem sem emoji', 'saiu: ' + JSON.stringify(a.motivoSemEmoji));
  exigir(a.ordemAviso === true, '"Quando avisou" ordena pela data do aviso');
  exigir(/Nenhum aviso com esses filtros/.test(a.vazioComFiltro || ''), 'filtro sem resultado diz isso', 'saiu: ' + JSON.stringify(a.vazioComFiltro));
  exigir(/Não foi possível carregar os avisos/.test(a.comErro || '') && !/Nenhum/.test(a.comErro || ''),
    'consulta com erro mostra ERRO, nunca "nenhum"', 'saiu: ' + JSON.stringify(a.comErro));
}
```

No rodapé, depois de `    await provaBarraBuscaNoPainelEEscolhaUnica(provas);`: `    await provaAvisosDeAusenciaFiltramNaConsulta(provas);`

Run: `npm run provar-telas -- ausencias.html > /tmp/claude-501/p4t4-red.txt 2>&1; tail -25 /tmp/claude-501/p4t4-red.txt` — falhas (sem `#filtro-avisos`). (Se o filtro por tela não rodar esta prova, rodar a suíte inteira.)

- [ ] **Step 2: O código** — em `ausencias.html`, logo depois da linha `let abaAusencias = 'avisos';   // …`, acrescentar:

```js
// ── Filtros da tela Ausências (passo 4 do ordenar e filtrar) ──
// As duas abas vêm do banco em PEDAÇOS (60 avisos, 80 faltas). O filtro NUNCA age sobre o
// pedaço que veio: cada escolha refaz a consulta com o filtro dentro, e os números vêm do
// banco. Filtrar os 60 mostraria a pessoa com 30 ausências como se tivesse 2.
let filtroAvisos = null, filtroFaltas = null;
let pedidoAvisos = 0, pedidoFaltas = 0;
const PERIODOS_AUSENCIA = [
  { id: 'proximas', nome: 'Próximas missas', testa: () => true },
  { id: 'este_mes', nome: 'Este mês', testa: () => true },
  { id: 'mes_passado', nome: 'Mês passado', testa: () => true },
  { id: 'ultimos_90', nome: 'Últimos 90 dias', testa: () => true },
];
function semEmoji(txt) { return String(txt || '').replace(/^[^\p{L}\p{N}]+/u, '').trim(); }
function opcoesDePessoa(membros) {
  return (membros || []).map(m => ({ id: m.id, nome: m.apelido ? m.apelido + ' · ' + m.nome : (m.nome || '—'), testa: () => true }));
}
const COMUNIDADES_AUSENCIA = [
  { id: 'matriz', nome: 'Matriz', testa: () => true },
  { id: 'santo_antonio', nome: 'Santo Antônio', testa: () => true },
];
function configFiltroAvisos(membros) {
  return {
    chave: 'ausencias-avisos',
    rotulo: ['aviso', 'avisos'],
    ordemPadrao: 'missa',
    ordens: [
      { id: 'missa', nome: 'Data da missa', desc: true, valor: () => null },
      { id: 'aviso', nome: 'Quando avisou', desc: true, valor: () => null },
    ],
    filtros: [
      { id: 'pessoa', nome: 'Pessoa', busca: { placeholder: 'Buscar pessoa...', max: 8 }, opcoes: opcoesDePessoa(membros) },
      { id: 'periodo', nome: 'Período (data da missa)', unico: true, opcoes: PERIODOS_AUSENCIA },
      { id: 'comunidade', nome: 'Comunidade', opcoes: COMUNIDADES_AUSENCIA },
      { id: 'motivo', nome: 'Motivo', opcoes: Object.keys(MOTIVOS).map(k => ({ id: k, nome: semEmoji(MOTIVOS[k]), testa: () => true })) },
    ],
    contar: async (e) => {
      const { count, error } = await consultaAvisos(e, true);
      if (error) throw error;
      return count;
    },
  };
}
function consultaAvisos(estado, soContar) {
  const E = (f) => FiltroLista.escolhidos(estado, f);
  let q = soContar
    ? sb.from('acolitos_ausencias_v').select('id', { count: 'exact', head: true })
    : sb.from('acolitos_ausencias_v').select('*', { count: 'exact' });
  if (E('pessoa').length) q = q.in('membro_id', E('pessoa'));
  if (E('comunidade').length) q = q.in('missa_comunidade', E('comunidade'));
  if (E('motivo').length) q = q.in('motivo', E('motivo'));
  const per = E('periodo')[0];
  if (per) {
    const iv = FiltroLista.intervaloDoPeriodo(per, hojeLocal());
    if (iv.desde) q = q.gte('missa_data', iv.desde);
    if (iv.ate) q = q.lte('missa_data', iv.ate);
  }
  if (soContar) return q;
  q = estado.ordem === 'aviso'
    ? q.order('created_at', { ascending: false })
    : q.order('missa_data', { ascending: false, nullsFirst: false }).order('missa_horario', { ascending: false });
  return q.limit(60);
}
async function recarregarAvisos() {
  const lista = document.getElementById('lista-avisos');
  if (!lista || !filtroAvisos) return;
  const meu = ++pedidoAvisos;
  lista.textContent = '';
  const ld = document.createElement('span'); ld.className = 'loading'; ld.textContent = 'Carregando...'; lista.appendChild(ld);
  const estado = filtroAvisos.estado();
  const { data, count, error } = await consultaAvisos(estado, false);
  if (meu !== pedidoAvisos) return;   // chegou resposta velha depois da nova
  lista.textContent = '';
  const aviso = (txt) => { const s = document.createElement('span'); s.className = 'empty'; s.textContent = txt; lista.appendChild(s); };
  if (error) { console.error('Avisos: consulta falhou', error); aviso('Não foi possível carregar os avisos. Tente de novo.'); return; }
  if (!data || !data.length) {
    aviso(FiltroLista.contar(estado) > 0 ? 'Nenhum aviso com esses filtros.' : 'Nenhuma ausência informada.');
    return;
  }
  if (typeof count === 'number' && count > data.length) {
    const info = document.createElement('p');
    info.style.cssText = 'font-size:12px;color:var(--text-muted);margin:0 0 8px;';
    info.textContent = 'Mostrando ' + data.length + ' de ' + count + '. Use os filtros para achar o resto.';
    lista.appendChild(info);
  }
  data.forEach(a => lista.appendChild(linhaDeAviso(a)));
}
function linhaDeAviso(a) {
  const rm = rosterMapAus[a.membro_id] || {};
  const d = a.missa_data ? new Date(a.missa_data + 'T00:00:00') : null;
  const row = document.createElement('div'); row.className = 'equipe-row';
  const info = document.createElement('div'); info.className = 'equipe-row-info';
  const n = document.createElement('div'); n.className = 'equipe-row-nome';
  n.textContent = (rm.apelido ? rm.apelido + ' · ' + rm.nome : rm.nome) || '—';
  const m = document.createElement('div'); m.className = 'equipe-row-meta';
  m.textContent = (d ? DIAS[d.getDay()] + ' ' + d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) + (a.missa_horario ? ' · ' + a.missa_horario : '') : '—')
    + (a.missa_comunidade ? ' · ' + comLabel(a.missa_comunidade) : '')
    + ' · ' + semEmoji(MOTIVOS[a.motivo] || a.motivo);
  info.append(n, m);
  // A lixeira: era o ÚNICO lugar do app que desfazia uma ausência (ver histórico da tela).
  const del = document.createElement('button'); del.className = 'btn-sm gray';
  del.style.cssText = 'flex:none;margin-left:8px;'; del.textContent = 'Remover';
  del.onclick = async () => {
    if (!(await uiConfirm('Remover a ausência de ' + (rm.nome || 'esta pessoa') + '?'))) return;
    del.disabled = true;
    const { error } = await sb.from('acolitos_ausencias').delete().eq('id', a.id);
    if (error) { del.disabled = false; toast('Não foi possível remover.', 'error'); return; }
    row.remove();
  };
  row.append(info, del);
  return row;
}
```

(O selo "AJ" da linha antiga sai: ele dizia sempre "AJ" para toda linha e não informava nada. Registrar na Tarefa 6.)

Em `renderViewEquipe()`, trocar os KPIs (o bloco de `// KPIs` até `main.appendChild(kpi);`) para mostrar `—` quando a contagem falhar:
```js
  // KPIs — contagem que falha mostra "—", nunca 0.
  const [{ count: totalAus, error: e1 }, { count: sem30, error: e2 }] = await Promise.all([
    sb.from('acolitos_ausencias').select('*', { count: 'exact', head: true }),
    sb.from('acolitos_ausencias').select('*', { count: 'exact', head: true })
      .gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString()),
  ]);
  const kpi = document.createElement('div'); kpi.className = 'kpi-grid'; kpi.style.gridTemplateColumns = '1fr 1fr';
  [{ label: 'Total Registradas', value: e1 ? '—' : (totalAus ?? '—'), sub: 'histórico' },
   { label: 'Últimos 30 dias', value: e2 ? '—' : (sem30 ?? '—'), sub: 'recentes' }].forEach(k => {
    const c = document.createElement('div'); c.className = 'kpi-card';
    const l = document.createElement('div'); l.className = 'kpi-label'; l.textContent = k.label;
    const v = document.createElement('div'); v.className = 'kpi-value'; v.textContent = k.value;
    const s = document.createElement('div'); s.className = 'kpi-sub'; s.textContent = k.sub;
    c.append(l, v, s); kpi.appendChild(c);
  });
  main.appendChild(kpi);
```

E trocar TODO o trecho que vai de `  const { data: ausencias } = await sb` até o `});` que fecha o `ausencias.forEach(…)` por:
```js
  // cerimoniário não lê acolitos_membros por RLS → o nome vem do roster (security definer)
  const membros = await carregarRosterAus();
  const alvoFiltro = document.createElement('div'); alvoFiltro.id = 'filtro-avisos'; main.appendChild(alvoFiltro);
  const lista = document.createElement('div'); lista.id = 'lista-avisos'; main.appendChild(lista);
  filtroAvisos = montarFiltroLista(alvoFiltro, configFiltroAvisos(membros), () => recarregarAvisos());
  await recarregarAvisos();
```
Os comentários que seguem (editor de motivos) ficam.

- [ ] **Step 3: Rodar** — suíte inteira `> /tmp/claude-501/p4t4-green.txt` → **290** (272 + 18), duas vezes; regras 260; `provaFumaca` e `provaBarraAcendeSecao` (Ausências) verdes. Extrair o script de ausencias.html e `node --check`.

- [ ] **Step 4: Commit** (`ausencias.html`, `telas.prova.mjs`): `feat(acolitos): os avisos de ausência filtram no banco` + parágrafo (60 de 1.202; erro é erro; KPIs com "—").

---

### Task 5: Aba Faltas — a barra com a função nova

**Files:**
- Modify: `projetos/acolitos/ausencias.html` (`renderAbaFaltas`)
- Test: `projetos/acolitos/provas/telas.prova.mjs`

**Interfaces:**
- Consumes: Tasks 1–4, RPCs `acolitos_faltas_filtradas` e `acolitos_faltas_contar` (Task 3).
- Produces: `configFiltroFaltas(membros)`, `argsFaltas(estado)`, `recarregarFaltas()`.

- [ ] **Step 1: A prova que falha** — antes de `async function provaRecadoDaFotoAparece(provas) {`:

```js
async function provaFaltasFiltramNaConsulta(provas) {
  console.log('\n\x1b[1mAusências › Faltas: o filtro vai para a função do banco, e "sem acesso" é dito\x1b[0m');
  const roster = { membros: [{ id: 'u-ana', nome: 'Ana Souza', apelido: null }], habs: [] };
  const faltas = Array.from({ length: 80 }, (_, i) => ({ membro_id: 'u-ana', membro: 'Ana Souza', funcao: 'vela',
    data: '2026-08-' + String(1 + i % 28).padStart(2, '0'), horario: '19:00', comunidade: 'matriz', substituto: null }));
  const abrirFaltas = (rpcs, avaliar) => provas.abrir('ausencias.html', { papel: PAPEIS.admin, rpcs, avaliar });
  const cenario = `
    const esperar = (ms) => new Promise(f => setTimeout(f, ms));
    try { localStorage.removeItem('filtro-lista:ausencias-faltas'); } catch (e) {}
    const chamadas = [];
    const origRpc = sb.rpc.bind(sb);
    sb.rpc = async (nome, args) => { chamadas.push([nome, args || null]); return origRpc(nome, args); };
    abaAusencias = 'faltas'; await renderViewEquipe(); await esperar(80);
    const out = { texto: (document.getElementById('lista-faltas') || document.getElementById('main-content')).textContent,
                  temBarra: !!document.querySelector('#filtro-faltas .filtro-btn') };
    out.usouAntiga = chamadas.some(c => c[0] === 'acolitos_faltas_recentes');
    out.primeira = chamadas.filter(c => c[0] === 'acolitos_faltas_filtradas')[0] || null;
    if (out.temBarra) {
      const painel = () => document.querySelector('.modal-overlay.open .filtro-painel');
      document.querySelector('#filtro-faltas .filtro-btn').click(); await esperar(40);
      out.secoes = [...painel().querySelectorAll('.filtro-painel-titulo')].map(e => e.textContent.trim());
      const campo = painel().querySelector('.filtro-painel-busca');
      campo.value = 'ana'; campo.dispatchEvent(new Event('input')); await esperar(20);
      [...painel().querySelectorAll('.form-toggle')].find(b => b.textContent.trim() === 'Ana Souza').click(); await esperar(30);
      [...painel().querySelectorAll('.form-toggle')].find(b => b.textContent.trim() === 'Mês passado').click(); await esperar(60);
      out.contar = chamadas.filter(c => c[0] === 'acolitos_faltas_contar').pop() || null;
      out.ver = painel().querySelector('.filtro-ver').textContent.trim();
      painel().querySelector('.filtro-ver').click(); await esperar(150);
      out.lista = chamadas.filter(c => c[0] === 'acolitos_faltas_filtradas').pop() || null;
      out.iv = FiltroLista.intervaloDoPeriodo('mes_passado', hojeLocal());
      out.mostrando = (document.getElementById('lista-faltas') || {}).textContent || '';
    }
    try { localStorage.removeItem('filtro-lista:ausencias-faltas'); } catch (e) {}
    sb.rpc = origRpc;
    return out;
  `;

  const r = await abrirFaltas({ acolitos_roster_substituicao: { data: roster }, acolitos_faltas_filtradas: { data: faltas }, acolitos_faltas_contar: { data: 357 } }, cenario);
  const a = r.avaliado || {};
  exigir(!r.erroAvaliar, 'a aba Faltas filtra sem estourar', r.erroAvaliar);
  exigir(r.avaliado && typeof r.avaliado === 'object', 'a prova das Faltas chegou ao fim (a página não saiu do lugar)', 'avaliado: ' + JSON.stringify(r.avaliado));
  exigir(a.usouAntiga === false && !!a.primeira, 'a aba usa a função NOVA, com filtros', 'antiga: ' + a.usouAntiga);
  exigir(JSON.stringify(a.secoes) === JSON.stringify(['Pessoa', 'Período (data da missa)', 'Comunidade']),
    'o painel das faltas oferece pessoa, período e comunidade — sem "Ordenar por"', 'saiu: ' + JSON.stringify(a.secoes));
  exigir(!!a.contar && JSON.stringify(a.contar[1] && a.contar[1].p_membros) === JSON.stringify(['u-ana']),
    'o "Ver N" pergunta ao banco com a pessoa escolhida', 'args: ' + JSON.stringify(a.contar));
  exigir(a.ver === 'Ver 357 faltas', 'o "Ver N" mostra o número do banco', 'mostrou: ' + JSON.stringify(a.ver));
  exigir(!!a.lista && JSON.stringify(a.lista[1].p_membros) === JSON.stringify(['u-ana'])
    && a.lista[1].p_desde === a.iv.desde && a.lista[1].p_ate === a.iv.ate,
    'escolher pessoa e período MUDA A CONSULTA', 'args: ' + JSON.stringify(a.lista) + ' esperado ' + JSON.stringify(a.iv));
  exigir(/Mostrando 80 de 357/.test(a.mostrando || ''), 'a aba diz que mostra 80 de 357', 'saiu: ' + JSON.stringify((a.mostrando || '').slice(0, 80)));

  const r2 = await abrirFaltas({ acolitos_roster_substituicao: { data: roster }, acolitos_faltas_filtradas: { error: { message: 'sem_permissao', code: '42501' } }, acolitos_faltas_contar: { error: { message: 'sem_permissao', code: '42501' } } }, cenario);
  const b = r2.avaliado || {};
  exigir(/Você não tem acesso às faltas/.test(b.texto || '') && !/Nenhuma/.test(b.texto || ''),
    'sem permissão, a aba diz isso — e não "nenhuma falta"', 'saiu: ' + JSON.stringify(b.texto));
  exigir(b.temBarra === false, 'sem permissão, a barra de filtro não aparece');

  const r3 = await abrirFaltas({ acolitos_roster_substituicao: { data: roster }, acolitos_faltas_filtradas: { error: { message: 'fora do ar' } }, acolitos_faltas_contar: { data: 0 } }, cenario);
  const c = r3.avaliado || {};
  exigir(/Não foi possível carregar as faltas/.test(c.texto || '') && !/Nenhuma/.test(c.texto || ''),
    'erro de consulta mostra erro, não "nenhuma"', 'saiu: ' + JSON.stringify(c.texto));
}
```

No rodapé, depois de `    await provaAvisosDeAusenciaFiltramNaConsulta(provas);`: `    await provaFaltasFiltramNaConsulta(provas);`

Run: `npm run provar-telas > /tmp/claude-501/p4t5-red.txt 2>&1` — falhas (a aba ainda usa a função antiga).

- [ ] **Step 2: O código** — em `ausencias.html`, logo depois de `function linhaDeAviso(a) { … }` (Task 4), acrescentar:

```js
function configFiltroFaltas(membros) {
  return {
    chave: 'ausencias-faltas',
    rotulo: ['falta', 'faltas'],
    ordemPadrao: 'missa',
    ordens: [{ id: 'missa', nome: 'Data da missa', desc: true, valor: () => null }],
    filtros: [
      { id: 'pessoa', nome: 'Pessoa', busca: { placeholder: 'Buscar pessoa...', max: 8 }, opcoes: opcoesDePessoa(membros) },
      { id: 'periodo', nome: 'Período (data da missa)', unico: true, opcoes: PERIODOS_AUSENCIA },
      { id: 'comunidade', nome: 'Comunidade', opcoes: COMUNIDADES_AUSENCIA },
    ],
    contar: async (e) => {
      const { data, error } = await sb.rpc('acolitos_faltas_contar', argsFaltas(e, false));
      if (error) throw error;
      return data;
    },
  };
}
function argsFaltas(estado, comLimite) {
  const E = (f) => FiltroLista.escolhidos(estado, f);
  const iv = E('periodo')[0] ? FiltroLista.intervaloDoPeriodo(E('periodo')[0], hojeLocal()) : { desde: null, ate: null };
  const args = {
    p_membros: E('pessoa').length ? E('pessoa') : null,
    p_desde: iv.desde, p_ate: iv.ate,
    p_comunidades: E('comunidade').length ? E('comunidade') : null,
  };
  if (comLimite) args.p_limite = 80;
  return args;
}
async function recarregarFaltas() {
  const lista = document.getElementById('lista-faltas');
  if (!lista) return false;
  const meu = ++pedidoFaltas;
  lista.textContent = '';
  const ld = document.createElement('span'); ld.className = 'loading'; ld.textContent = 'Carregando...'; lista.appendChild(ld);
  const estado = filtroFaltas ? filtroFaltas.estado() : FiltroLista.estadoInicial(configFiltroFaltas([]));
  const [{ data, error }, { data: total, error: eTotal }] = await Promise.all([
    sb.rpc('acolitos_faltas_filtradas', argsFaltas(estado, true)),
    sb.rpc('acolitos_faltas_contar', argsFaltas(estado, false)),
  ]);
  if (meu !== pedidoFaltas) return true;
  lista.textContent = '';
  const aviso = (txt) => { const s = document.createElement('span'); s.className = 'empty'; s.textContent = txt; lista.appendChild(s); };
  if (error) {
    console.error('Faltas: consulta falhou', error);
    // Sem permissão (o cerimoniário vê a aba, mas o banco não deixa ver faltas): dizer isso.
    // Antes a função devolvia lista vazia e a tela dizia "nenhuma falta" — mentira.
    aviso(error.code === '42501' ? 'Você não tem acesso às faltas.' : 'Não foi possível carregar as faltas. Tente de novo.');
    return error.code !== '42501';
  }
  if (!data || !data.length) {
    aviso(FiltroLista.contar(estado) > 0 ? 'Nenhuma falta com esses filtros.' : 'Nenhuma falta registrada ainda.');
    return true;
  }
  if (!eTotal && typeof total === 'number' && total > data.length) {
    const info = document.createElement('p');
    info.style.cssText = 'font-size:12px;color:var(--text-muted);margin:0 0 8px;';
    info.textContent = 'Mostrando ' + data.length + ' de ' + total + '. Use os filtros para achar o resto.';
    lista.appendChild(info);
  }
  data.forEach(a => {
    const row = document.createElement('div'); row.className = 'equipe-row';
    const left = document.createElement('div'); left.className = 'equipe-row-info';
    const nm = document.createElement('div'); nm.className = 'equipe-row-nome'; nm.textContent = a.membro || '—';
    const wh = document.createElement('div'); wh.style.cssText = 'font-size:12px;color:var(--gold);';
    wh.textContent = (a.data ? dataLabel(a.data) : '—') + (a.horario ? ' ' + a.horario : '') + ' · ' + comLabel(a.comunidade);
    const fn = document.createElement('div'); fn.className = 'equipe-row-meta';
    fn.textContent = (FUNCAO_LABEL[a.funcao] || a.funcao) + (a.substituto ? ' · coberto por ' + a.substituto : ' · vaga aberta');
    left.append(nm, wh, fn);
    const badge = document.createElement('span'); badge.className = 'badge';
    badge.style.cssText = 'flex:none;color:var(--danger-text);font-weight:700;font-size:11px;';
    badge.textContent = 'faltou';
    row.append(left, badge); lista.appendChild(row);
  });
  return true;
}
```

Trocar a função `renderAbaFaltas(main)` inteira (e o comentário acima dela fica) por:
```js
async function renderAbaFaltas(main) {
  main.textContent = '';
  const membros = await carregarRosterAus();
  const alvoFiltro = document.createElement('div'); alvoFiltro.id = 'filtro-faltas';
  const lista = document.createElement('div'); lista.id = 'lista-faltas';
  main.append(alvoFiltro, lista);
  filtroFaltas = null;
  const pode = await recarregarFaltas();
  if (!pode) return;   // sem permissão: nada de barra, só o recado
  filtroFaltas = montarFiltroLista(alvoFiltro, configFiltroFaltas(membros), () => recarregarFaltas());
  // a primeira carga foi sem filtro; se havia escolha guardada, recarrega com ela
  if (FiltroLista.contar(filtroFaltas.estado()) > 0) await recarregarFaltas();
}
```

- [ ] **Step 3: Rodar** — suíte inteira → **301** (290 + 11), duas vezes; regras 260. Fotos 390×844 (script descartável FORA do repo): Avisos com o painel aberto e a busca de pessoa digitada; Faltas com "Mostrando 80 de 357"; Faltas como cerimoniário ("Você não tem acesso às faltas.").

- [ ] **Step 4: Commit** (`ausencias.html`, `telas.prova.mjs`): `feat(acolitos): as faltas filtram no banco, e o cerimoniário lê que não tem acesso`

---

### Task 6: Registrar e publicar (controlador, com ok do dono)

- Juntar, rodar tudo (arquivo), carimbar o `sw.js`, perguntar ao dono, enviar com `git push` comum (**nunca** `gh auth switch`), conferir no ar: `BUILD`, `filtro-avisos` e `acolitos_faltas_filtradas` no `ausencias.html`.
- `docs/pendencias.md`: passo 4 feito, falta Tarefas (passo 5). Registrar: o selo "AJ" que saiu; o acesso do cerimoniário às faltas (decisão do dono); a função antiga `acolitos_faltas_recentes` pode ser apagada numa migration futura, depois de a tela nova estar no ar e conferida.
- `docs/pendencias-fechados.md`: bloco do passo 4.
