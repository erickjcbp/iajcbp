# Ordenar e filtrar — Passo 1 (peça + Membros) — Plano de execução

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar a barra de ordenar e filtrar (regra + tela) e colocá-la na aba Membros, com "Mais recentes" e o filtro "já entrou no app".

**Architecture:** A regra mora em `filtro-lista-core.js` (funções puras, exposta como UM objeto global `FiltroLista`, testada por `node --test`). A barra e o painel moram no `shared.js` (`montarFiltroLista`). Membros descreve suas opções e usa a barra. O filtro App lê uma função nova do banco (migration 068).

**Tech Stack:** HTML + JS sem build (scripts clássicos), Supabase (Postgres + PostgREST), `node --test`, harness de telas em `projetos/acolitos/provas/` (Chrome via puppeteer-core), `psql` em `/opt/homebrew/opt/libpq/bin/`.

**Spec:** `docs/superpowers/specs/2026-09-16-acolitos-ordenar-e-filtrar-design.md`

## Global Constraints

- Tudo em português, sem jargão na tela. Ícones em SVG (`_svgIcon`), nunca emoji na moldura.
- A escolha fica em `localStorage['filtro-lista:<chave>']`, sempre dentro de `try/catch`; sem armazenamento a tela abre no padrão.
- Falha nunca vira zero: erro de consulta mostra erro ou esconde a opção — nunca "0" nem "nenhum".
- Mesmo filtro com duas opções = OU; filtros diferentes = E. Vazio vai sempre para o fim da ordem, também na decrescente. Desempate pelo nome.
- Testes de regra: `node --test projetos/acolitos/*.test.js` (NUNCA `*-core.test.js` — deixa arquivo de fora). Provas de tela: `npm run provar-telas`. Os totais de hoje são **238** e **155**; eles têm de SUBIR.
- Banco: `cd /Users/erickmartins/iajcbp && set -a && . ./.env && set +a` e `/opt/homebrew/opt/libpq/bin/psql "$SUPABASE_DB_URL" ...`. Função nova copia a trava das irmãs: `security definer`, `set search_path to 'public'`, `revoke` de `public` E de `anon`, `grant` a `authenticated` e `service_role`.
- Commit arquivo por arquivo (nunca `git add <pasta>`), conferindo `git status --short` antes: arquivo mexido que não é seu = outra sessão trabalhando.
- Mensagens de commit em português, no estilo `tipo(escopo): frase`, terminando com `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.

### Duas diferenças conscientes em relação à spec

1. **Ordem declarada por função, não por nome de campo.** A spec mostrava `campo: 'created_at'`; o plano usa `valor: m => ...`, porque "Próximos aniversários" e "Nível" não são um campo. O resto do contrato é igual.
2. **"Aniversário do mês" virou "Próximos aniversários"** — ordena todo mundo pelo próximo aniversário a partir de hoje, sem data no fim. Diz o que faz.
3. **A função "já entrou" aceita `membro_equipe`** além de `coord_admin`/`subadmin`: é quem abre a tela Membros (`membros.html`, `initModulo(['coord_admin','subadmin','membro_equipe'])`). Com a trava só da coordenação, a equipe veria o filtro quebrado. A função só devolve `membro_id` — nem e-mail, nem data.

---

## Estrutura de arquivos

| Arquivo | O que muda | Responsabilidade |
|---|---|---|
| `projetos/acolitos/filtro-lista-core.js` | criar | A regra: estado, ordem, filtro, busca, guardar/restaurar |
| `projetos/acolitos/filtro-lista-core.test.js` | criar | Provas da regra |
| `docs/migrations/068_quem_ja_entrou_no_app.sql` | criar | Função `acolitos_membros_ja_entraram()` |
| `docs/provas/provar-068-quem-ja-entrou.sql` | criar | Prova da 068 rodando |
| `projetos/acolitos/shared.js` | modificar | `montarFiltroLista` + ícones `sliders` e `x` |
| `projetos/acolitos/shared.css` | modificar | Estilo da barra, etiquetas e painel |
| `projetos/acolitos/*.html` (as que carregam `foto-recado-core.js`) | modificar | `<script src="filtro-lista-core.js">` |
| `projetos/acolitos/senha-nova-imports.test.js` | modificar | Guarda: toda tela carrega o core novo |
| `projetos/acolitos/membros.html` | modificar | Usar a barra; tirar busca e botões antigos |
| `projetos/acolitos/provas/telas.prova.mjs` | modificar | Provas da barra e de Membros |
| `projetos/acolitos/sw.js`, `docs/pendencias.md` | modificar | Carimbo e lista (tarefa 5) |

---

### Task 1: A regra (`filtro-lista-core.js`)

**Files:**
- Create: `projetos/acolitos/filtro-lista-core.js`
- Test: `projetos/acolitos/filtro-lista-core.test.js`

**Interfaces:**
- Consumes: nada.
- Produces: objeto `FiltroLista` (global no navegador, `module.exports` no node) com:
  - `estadoInicial(config) -> Estado`
  - `escolherOrdem(estado, config, ordemId) -> Estado`
  - `alternar(estado, config, filtroId, opcaoId) -> Estado`
  - `estaLigado(estado, filtroId, opcaoId) -> boolean`
  - `definirBusca(estado, texto) -> Estado`
  - `limpar(estado) -> Estado` (tira os filtros; ordem e busca ficam)
  - `contar(estado) -> number` (filtros ligados; a busca não conta)
  - `aplicar(lista, estado, config) -> Array` (lista NOVA)
  - `etiquetas(estado, config) -> [{ f, o, texto }]`
  - `nomeDaOrdem(estado, config) -> string`
  - `legenda(item, estado, config) -> string`
  - `guardar(estado) -> string`
  - `restaurar(texto, config) -> Estado`
  - `Estado = { ordem: string, ligados: [{ f: string, o: string }], busca: string }`
  - `Config = { chave, rotulo: [singular, plural], ordemPadrao, ordens: [{ id, nome, valor(item), desc?, legenda?(item) }], filtros: [{ id, nome, opcoes: [{ id, nome, testa(item) }] }], busca?: { placeholder, campos(item) -> string[] }, desempate?(item), contar?(estado) -> number|Promise<number> }`

- [ ] **Step 1: Confirmar que o nome não colide**

Run: `cd /Users/erickmartins/iajcbp/projetos/acolitos && grep -rn "FiltroLista\|montarFiltroLista\|filtro-lista" . | grep -v node_modules`
Expected: nenhuma linha. (Memória do projeto: colisão de nomes globais já derrubou telas.)

- [ ] **Step 2: Escrever as provas que falham**

Criar `projetos/acolitos/filtro-lista-core.test.js`:

```js
// Ordenar e filtrar: a regra que as seis listas do app vão dividir.
//
// Nasceu do pedido "na aba Membros não consigo ver quem entrou por último". A regra mora
// fora da tela para poder ser provada sem navegador — e porque seis telas vão usá-la:
// um defeito aqui aparece em todas, então é aqui que ele tem de ser pego.
const { test } = require('node:test');
const assert = require('node:assert');
const F = require('./filtro-lista-core.js');

const pessoas = [
  { id: 1, nome: 'Bruno', criado: '2026-06-01', com: 'matriz', foto: '' },
  { id: 2, nome: 'Ana', criado: '2026-06-01', com: 'matriz', foto: 'a.jpg' },
  { id: 3, nome: 'Carla', criado: '2026-08-27', com: 'santo_antonio', foto: '' },
  { id: 4, nome: 'Érico', criado: null, com: 'matriz', foto: 'e.jpg' },
];

const config = {
  chave: 'prova',
  rotulo: ['pessoa', 'pessoas'],
  ordemPadrao: 'nome',
  ordens: [
    { id: 'nome', nome: 'Nome A–Z', valor: (p) => p.nome },
    { id: 'recentes', nome: 'Mais recentes', desc: true, valor: (p) => p.criado,
      legenda: (p) => (p.criado ? 'cadastro ' + p.criado.slice(8, 10) + '/' + p.criado.slice(5, 7) : '') },
  ],
  filtros: [
    { id: 'com', nome: 'Comunidade', opcoes: [
      { id: 'matriz', nome: 'Matriz', testa: (p) => p.com === 'matriz' },
      { id: 'sa', nome: 'Santo Antônio', testa: (p) => p.com === 'santo_antonio' },
    ] },
    { id: 'foto', nome: 'Foto', opcoes: [
      { id: 'com', nome: 'Com foto', testa: (p) => !!p.foto },
      { id: 'sem', nome: 'Sem foto', testa: (p) => !p.foto },
    ] },
  ],
  busca: { placeholder: 'Buscar', campos: (p) => [p.nome] },
};

const nomes = (l) => l.map((p) => p.nome);

test('abre na ordem padrão, sem filtro e sem busca', () => {
  assert.deepStrictEqual(F.estadoInicial(config), { ordem: 'nome', ligados: [], busca: '' });
});

test('ordem por nome ignora acento e caixa', () => {
  assert.deepStrictEqual(nomes(F.aplicar(pessoas, F.estadoInicial(config), config)),
    ['Ana', 'Bruno', 'Carla', 'Érico']);
});

test('MAIS RECENTES: o mais novo no topo, empate pelo nome, sem data no FIM', () => {
  // É o pedido do dono. 156 dos 177 membros foram cadastrados no mesmo dia (a importação),
  // então o empate é o caso comum, não a exceção — e tem de ser estável.
  const e = F.escolherOrdem(F.estadoInicial(config), config, 'recentes');
  assert.deepStrictEqual(nomes(F.aplicar(pessoas, e, config)), ['Carla', 'Ana', 'Bruno', 'Érico']);
});

test('ordem desconhecida é ignorada — não troca para algo que a tela não oferece', () => {
  const e = F.escolherOrdem(F.estadoInicial(config), config, 'inventada');
  assert.strictEqual(e.ordem, 'nome');
});

test('duas opções do MESMO filtro somam (OU)', () => {
  let e = F.alternar(F.estadoInicial(config), config, 'com', 'matriz');
  e = F.alternar(e, config, 'com', 'sa');
  assert.strictEqual(F.aplicar(pessoas, e, config).length, 4);
});

test('filtros DIFERENTES se combinam (E)', () => {
  let e = F.alternar(F.estadoInicial(config), config, 'com', 'matriz');
  e = F.alternar(e, config, 'foto', 'sem');
  assert.deepStrictEqual(nomes(F.aplicar(pessoas, e, config)), ['Bruno']);
});

test('alternar duas vezes desliga', () => {
  let e = F.alternar(F.estadoInicial(config), config, 'foto', 'com');
  assert.strictEqual(F.estaLigado(e, 'foto', 'com'), true);
  e = F.alternar(e, config, 'foto', 'com');
  assert.strictEqual(F.estaLigado(e, 'foto', 'com'), false);
  assert.strictEqual(F.contar(e), 0);
});

test('opção que não existe não liga nada', () => {
  const e = F.alternar(F.estadoInicial(config), config, 'foto', 'talvez');
  assert.strictEqual(F.contar(e), 0);
});

test('busca sem acento acha com acento, e não conta como filtro', () => {
  const e = F.definirBusca(F.estadoInicial(config), 'eri');
  assert.deepStrictEqual(nomes(F.aplicar(pessoas, e, config)), ['Érico']);
  assert.strictEqual(F.contar(e), 0);
});

test('limpar tira os filtros e mantém ordem e busca', () => {
  let e = F.escolherOrdem(F.estadoInicial(config), config, 'recentes');
  e = F.definirBusca(e, 'a');
  e = F.alternar(e, config, 'foto', 'com');
  const l = F.limpar(e);
  assert.deepStrictEqual(l, { ordem: 'recentes', ligados: [], busca: 'a' });
});

test('as etiquetas saem na ordem em que foram ligadas', () => {
  let e = F.alternar(F.estadoInicial(config), config, 'foto', 'sem');
  e = F.alternar(e, config, 'com', 'sa');
  assert.deepStrictEqual(F.etiquetas(e, config).map((t) => t.texto), ['Sem foto', 'Santo Antônio']);
});

test('nome da ordem e legenda seguem a ordem escolhida', () => {
  const e = F.escolherOrdem(F.estadoInicial(config), config, 'recentes');
  assert.strictEqual(F.nomeDaOrdem(e, config), 'Mais recentes');
  assert.strictEqual(F.legenda(pessoas[2], e, config), 'cadastro 27/08');
  assert.strictEqual(F.legenda(pessoas[2], F.estadoInicial(config), config), '');
});

test('aplicar não mexe na lista que veio', () => {
  const copia = pessoas.map((p) => p.nome);
  F.aplicar(pessoas, F.escolherOrdem(F.estadoInicial(config), config, 'recentes'), config);
  assert.deepStrictEqual(pessoas.map((p) => p.nome), copia);
});

test('guardar e restaurar devolvem o mesmo estado', () => {
  let e = F.escolherOrdem(F.estadoInicial(config), config, 'recentes');
  e = F.alternar(e, config, 'com', 'sa');
  e = F.definirBusca(e, 'car');
  assert.deepStrictEqual(F.restaurar(F.guardar(e), config), e);
});

test('restaurar DESCARTA o que a tela não oferece mais', () => {
  // Sem isto, uma opção removida numa versão futura deixaria a tela presa num filtro que
  // ninguém vê na tela e que esvazia a lista.
  const velho = JSON.stringify({ v: 1, ordem: 'sumiu', busca: 'x',
    ligados: [{ f: 'com', o: 'sa' }, { f: 'sumiu', o: 'a' }, { f: 'com', o: 'sumiu' }, { f: 'com', o: 'sa' }] });
  assert.deepStrictEqual(F.restaurar(velho, config), { ordem: 'nome', ligados: [{ f: 'com', o: 'sa' }], busca: 'x' });
});

test('restaurar com lixo, vazio ou nulo abre no padrão', () => {
  for (const t of [null, '', 'não é json', '42', '[]']) {
    assert.deepStrictEqual(F.restaurar(t, config), F.estadoInicial(config), 'entrada: ' + t);
  }
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `cd /Users/erickmartins/iajcbp && node --test projetos/acolitos/filtro-lista-core.test.js`
Expected: FAIL com `Cannot find module './filtro-lista-core.js'`.

- [ ] **Step 4: Escrever a regra**

Criar `projetos/acolitos/filtro-lista-core.js`:

```js
// Ordenar e filtrar listas: a REGRA, sem tela.
//
// Pedido do dono em 16/09/2026: "na aba Membros não consigo ver quem entrou por último".
// Nenhuma lista do app deixava escolher a ordem. Seis telas vão dividir esta regra, e a
// barra que a desenha mora no shared.js (montarFiltroLista).
//
// Três regras que parecem detalhe e não são:
//   · mesmo filtro com duas opções SOMA (Matriz OU Santo Antônio); filtros diferentes
//     COMBINAM (Matriz E sem foto);
//   · vazio vai para o FIM, também na ordem decrescente — senão "mais recentes" abriria
//     com quem não tem data;
//   · empate desempata pelo nome. 156 dos 177 membros têm a mesma data de cadastro.
//
// Exposta como UM objeto (FiltroLista), não função por função: este app já quebrou por
// nome global repetido entre telas.
(function (global) {
  'use strict';

  function normalizar(s) {
    return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  }
  function vazio(v) { return v == null || v === ''; }

  function acharOrdem(config, id) {
    var os = (config && config.ordens) || [];
    for (var i = 0; i < os.length; i++) if (os[i].id === id) return os[i];
    return null;
  }
  function acharFiltro(config, id) {
    var fs = (config && config.filtros) || [];
    for (var i = 0; i < fs.length; i++) if (fs[i].id === id) return fs[i];
    return null;
  }
  function acharOpcao(filtro, id) {
    var os = (filtro && filtro.opcoes) || [];
    for (var i = 0; i < os.length; i++) if (os[i].id === id) return os[i];
    return null;
  }
  function copia(estado, mudar) {
    var e = { ordem: estado.ordem, ligados: estado.ligados.slice(), busca: estado.busca };
    for (var k in mudar) e[k] = mudar[k];
    return e;
  }

  function estadoInicial(config) {
    return { ordem: config.ordemPadrao, ligados: [], busca: '' };
  }

  function escolherOrdem(estado, config, ordemId) {
    if (!acharOrdem(config, ordemId)) return estado;
    return copia(estado, { ordem: ordemId });
  }

  function estaLigado(estado, filtroId, opcaoId) {
    return estado.ligados.some(function (l) { return l.f === filtroId && l.o === opcaoId; });
  }

  function alternar(estado, config, filtroId, opcaoId) {
    if (!acharOpcao(acharFiltro(config, filtroId), opcaoId)) return estado;
    var ligados = estaLigado(estado, filtroId, opcaoId)
      ? estado.ligados.filter(function (l) { return !(l.f === filtroId && l.o === opcaoId); })
      : estado.ligados.concat([{ f: filtroId, o: opcaoId }]);
    return copia(estado, { ligados: ligados });
  }

  function definirBusca(estado, texto) {
    return copia(estado, { busca: String(texto == null ? '' : texto) });
  }

  function limpar(estado) { return copia(estado, { ligados: [] }); }

  function contar(estado) { return estado.ligados.length; }

  function passa(item, estado, config) {
    var porFiltro = {};
    estado.ligados.forEach(function (l) { (porFiltro[l.f] = porFiltro[l.f] || []).push(l.o); });
    for (var fid in porFiltro) {
      var f = acharFiltro(config, fid);
      if (!f) continue;
      var algum = porFiltro[fid].some(function (oid) {
        var o = acharOpcao(f, oid);
        return !!(o && o.testa(item));
      });
      if (!algum) return false;
    }
    var termo = normalizar(estado.busca);
    if (termo && config.busca) {
      var campos = config.busca.campos(item) || [];
      var achou = campos.some(function (c) { return normalizar(c).indexOf(termo) >= 0; });
      if (!achou) return false;
    }
    return true;
  }

  function comparar(a, b) {
    if (typeof a === 'number' && typeof b === 'number') return a - b;
    return String(a).localeCompare(String(b), 'pt-BR', { sensitivity: 'base' });
  }

  function aplicar(lista, estado, config) {
    var ordem = acharOrdem(config, estado.ordem) || acharOrdem(config, config.ordemPadrao);
    var desempate = config.desempate || function (i) { return i && i.nome; };
    var marcados = (lista || [])
      .filter(function (item) { return passa(item, estado, config); })
      .map(function (item, pos) { return { item: item, pos: pos, v: ordem ? ordem.valor(item) : null }; });
    marcados.sort(function (x, y) {
      var xv = vazio(x.v), yv = vazio(y.v);
      if (xv !== yv) return xv ? 1 : -1;
      if (!xv) {
        var c = comparar(x.v, y.v);
        if (c !== 0) return (ordem && ordem.desc) ? -c : c;
      }
      var dx = desempate(x.item), dy = desempate(y.item);
      var d = (vazio(dx) || vazio(dy)) ? 0 : comparar(dx, dy);
      return d !== 0 ? d : x.pos - y.pos;
    });
    return marcados.map(function (m) { return m.item; });
  }

  function etiquetas(estado, config) {
    var out = [];
    estado.ligados.forEach(function (l) {
      var o = acharOpcao(acharFiltro(config, l.f), l.o);
      if (o) out.push({ f: l.f, o: l.o, texto: o.nome });
    });
    return out;
  }

  function nomeDaOrdem(estado, config) {
    var o = acharOrdem(config, estado.ordem);
    return o ? o.nome : '';
  }

  function legenda(item, estado, config) {
    var o = acharOrdem(config, estado.ordem);
    return (o && o.legenda) ? (o.legenda(item) || '') : '';
  }

  function guardar(estado) {
    return JSON.stringify({ v: 1, ordem: estado.ordem, ligados: estado.ligados, busca: estado.busca });
  }

  function restaurar(texto, config) {
    var base = estadoInicial(config);
    var dado;
    try { dado = JSON.parse(texto); } catch (e) { return base; }
    if (!dado || typeof dado !== 'object' || Array.isArray(dado)) return base;
    var ordem = acharOrdem(config, dado.ordem) ? dado.ordem : base.ordem;
    var ligados = [];
    (Array.isArray(dado.ligados) ? dado.ligados : []).forEach(function (l) {
      if (!l || !acharOpcao(acharFiltro(config, l.f), l.o)) return;
      var repetido = ligados.some(function (x) { return x.f === l.f && x.o === l.o; });
      if (!repetido) ligados.push({ f: l.f, o: l.o });
    });
    var busca = typeof dado.busca === 'string' ? dado.busca : '';
    return { ordem: ordem, ligados: ligados, busca: busca };
  }

  var api = {
    estadoInicial: estadoInicial,
    escolherOrdem: escolherOrdem,
    alternar: alternar,
    estaLigado: estaLigado,
    definirBusca: definirBusca,
    limpar: limpar,
    contar: contar,
    aplicar: aplicar,
    etiquetas: etiquetas,
    nomeDaOrdem: nomeDaOrdem,
    legenda: legenda,
    guardar: guardar,
    restaurar: restaurar,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.FiltroLista = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
```

- [ ] **Step 5: Rodar e ver passar**

Run: `cd /Users/erickmartins/iajcbp && node --test projetos/acolitos/filtro-lista-core.test.js`
Expected: `pass 16`, `fail 0`.

- [ ] **Step 6: A suíte inteira subiu**

Run: `cd /Users/erickmartins/iajcbp && npm run provar-regras 2>&1 | grep -E "^ℹ (tests|pass|fail)"`
Expected: `tests 254`, `pass 254`, `fail 0` (238 + 16).

- [ ] **Step 7: Commit**

```bash
cd /Users/erickmartins/iajcbp && git status --short
git add projetos/acolitos/filtro-lista-core.js projetos/acolitos/filtro-lista-core.test.js
git commit -m "feat(acolitos): a regra de ordenar e filtrar listas, provada sem navegador" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Quem já entrou no app (migration 068)

**Files:**
- Create: `docs/migrations/068_quem_ja_entrou_no_app.sql`
- Test: `docs/provas/provar-068-quem-ja-entrou.sql`

**Interfaces:**
- Consumes: `acolitos_get_role(uid uuid) -> text` (já existe, `security definer`).
- Produces: `public.acolitos_membros_ja_entraram() returns table (membro_id uuid)`. Pelo cliente: `await sb.rpc('acolitos_membros_ja_entraram')` → `{ data: [{ membro_id }], error }`. Sem permissão: **erro** `42501` (nunca lista vazia).

- [ ] **Step 1: Conferir a irmã e o número de hoje**

```bash
cd /Users/erickmartins/iajcbp && set -a && . ./.env && set +a
P=/opt/homebrew/opt/libpq/bin/psql
$P "$SUPABASE_DB_URL" -At -c "select coalesce(array_to_string(proacl, ' '),'') from pg_proc where proname='acolitos_avisar_todos';"
$P "$SUPABASE_DB_URL" -At -c "select count(*) from acolitos_membros m join auth.users u on u.id=m.user_id where u.last_sign_in_at is not null;"
```
Expected: a primeira mostra `postgres=X/postgres authenticated=X/postgres service_role=X/postgres` (a trava a copiar). A segunda, o número de hoje (39 em 16/09 — a prova NÃO crava esse número, compara com a conta direta).

- [ ] **Step 2: Escrever a prova que falha**

Criar `docs/provas/provar-068-quem-ja-entrou.sql`:

```sql
-- Prova da 068 SEM gravar nada: pergunta quem já entrou no app, fingindo ser cada pessoa.
-- Rodar:  psql "$SUPABASE_DB_URL" -f docs/provas/provar-068-quem-ja-entrou.sql
-- Regra do projeto: trava se prova RODANDO, não lendo o SQL.
--
-- O QUE ESTA PROVA DEFENDE: o filtro "já entrou / nunca entrou" da aba Membros. A data do
-- último acesso mora em auth.users, que o app não enxerga. A função devolve SÓ o id do
-- membro — nem e-mail, nem data — e só para quem abre a tela Membros.
\set ON_ERROR_STOP on
\timing off

\echo '=== 0) quem pode executar, e o que a função devolve ==='
select has_function_privilege('anon',          'public.acolitos_membros_ja_entraram()', 'execute') as anon_executa_DEVE_SER_f,
       has_function_privilege('authenticated', 'public.acolitos_membros_ja_entraram()', 'execute') as logado_executa_DEVE_SER_t,
       pg_get_function_result('public.acolitos_membros_ja_entraram()'::regprocedure) as devolve_DEVE_SER_so_membro_id;

\echo ''
\echo '=== 1) COORDENAÇÃO pergunta — tem de bater com a conta direta no banco ==='
select count(*) as direto
  from public.acolitos_membros m join auth.users u on u.id = m.user_id
 where u.last_sign_in_at is not null \gset
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"b6f27ee7-e19f-4444-a771-8fc6ef3c35cb","role":"authenticated"}';
select count(*) as pela_funcao, :direto as direto_DEVE_IGUALAR
  from public.acolitos_membros_ja_entraram();
rollback;

\echo ''
\echo '=== 2) quem NÃO abre a tela Membros leva ERRO — lista vazia seria mentira ==='
select m.user_id as uid_sem_acesso
  from public.acolitos_membros m
 where m.user_id is not null
   and coalesce(public.acolitos_get_role(m.user_id), '') not in ('coord_admin','subadmin','membro_equipe')
 limit 1 \gset
begin;
set local role authenticated;
select set_config('request.jwt.claims',
       json_build_object('sub', :'uid_sem_acesso', 'role', 'authenticated')::text, true) is not null as fingiu;
do $$
begin
  perform 1 from public.acolitos_membros_ja_entraram();
  raise notice 'RESULTADO: PASSOU — ERRADO, devia recusar';
exception when insufficient_privilege then
  raise notice 'RESULTADO: recusado — CERTO';
end $$;
rollback;
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `cd /Users/erickmartins/iajcbp && set -a && . ./.env && set +a && /opt/homebrew/opt/libpq/bin/psql "$SUPABASE_DB_URL" -f docs/provas/provar-068-quem-ja-entrou.sql 2>&1 | head -6`
Expected: `ERROR:  function "public.acolitos_membros_ja_entraram()" does not exist`.

- [ ] **Step 4: Escrever a migration**

Criar `docs/migrations/068_quem_ja_entrou_no_app.sql`:

```sql
-- Acólitos 068 — quem já entrou no app (para o filtro da aba Membros)
--
-- O dono pediu filtros melhores nas abas (16/09/2026). Em Membros, um deles é "já entrou
-- no app / nunca entrou": só 39 dos 177 entraram alguma vez, e é assim que a coordenação
-- acha quem precisa de ajuda com o login.
--
-- A data do último acesso mora em auth.users, que o app não enxerga — e não deve: lá tem
-- e-mail. Esta função devolve SÓ o id do membro. Nem e-mail, nem data.
--
-- A TRAVA é a da própria tela Membros (membros.html: coord_admin, subadmin,
-- membro_equipe). Mais estreita que isso, a equipe veria o filtro quebrado.
--
-- SEM PERMISSÃO = ERRO, não lista vazia. Lista vazia diria "ninguém entrou" — e a tela
-- mostraria 177 pessoas como "nunca entrou". Falha que vira número é o defeito que este
-- app mais repetiu.
--
-- IDEMPOTENTE: create or replace. Prova: docs/provas/provar-068-quem-ja-entrou.sql

create or replace function public.acolitos_membros_ja_entraram()
returns table (membro_id uuid)
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
  return query
    select m.id
      from acolitos_membros m
      join auth.users u on u.id = m.user_id
     where u.last_sign_in_at is not null;
end; $$;

revoke all on function public.acolitos_membros_ja_entraram() from public;
revoke all on function public.acolitos_membros_ja_entraram() from anon;
grant execute on function public.acolitos_membros_ja_entraram() to authenticated;
grant execute on function public.acolitos_membros_ja_entraram() to service_role;

comment on function public.acolitos_membros_ja_entraram() is
  'Ids dos membros que já entraram no app (filtro da aba Membros). Só devolve membro_id. Sem permissão = erro 42501. Prova: docs/provas/provar-068-quem-ja-entrou.sql';
```

- [ ] **Step 5: Aplicar e rodar a prova**

```bash
cd /Users/erickmartins/iajcbp && set -a && . ./.env && set +a
P=/opt/homebrew/opt/libpq/bin/psql
$P "$SUPABASE_DB_URL" -f docs/migrations/068_quem_ja_entrou_no_app.sql
$P "$SUPABASE_DB_URL" -f docs/provas/provar-068-quem-ja-entrou.sql
```
Expected: `CREATE FUNCTION`, 2×`REVOKE`, 2×`GRANT`, `COMMENT`. Na prova: `f | t | TABLE(membro_id uuid)`; `pela_funcao` igual a `direto_deve_igualar`; `NOTICE:  RESULTADO: recusado — CERTO`.

- [ ] **Step 6: Commit**

```bash
cd /Users/erickmartins/iajcbp && git status --short
git add docs/migrations/068_quem_ja_entrou_no_app.sql docs/provas/provar-068-quem-ja-entrou.sql
git commit -m "feat(acolitos): o banco diz quem já entrou no app, sem expor e-mail nem data" -m "Migration 068, aplicada e provada. Sem permissão é erro, não lista vazia." -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: A barra e o painel (`montarFiltroLista`)

**Files:**
- Modify: `projetos/acolitos/shared.js` (ícones em `_svgIcon`, perto da linha 2250; função nova no fim do bloco de `avisarTodos`, antes de `// ── PORTÃO DE NOTIFICAÇÕES`)
- Modify: `projetos/acolitos/shared.css` (fim do arquivo)
- Modify: todas as `projetos/acolitos/*.html` que carregam `foto-recado-core.js`
- Modify: `projetos/acolitos/senha-nova-imports.test.js`
- Test: `projetos/acolitos/provas/telas.prova.mjs`

**Interfaces:**
- Consumes: `FiltroLista` (Task 1); `_svgIcon(nome)`, `toast` do `shared.js`.
- Produces: `montarFiltroLista(alvo: HTMLElement, config: Config, aoMudar: (estado) => void) -> { estado(): Estado, aplicar(lista): Array, legenda(item): string } | null`
  - `config.contar(estado)` é **obrigatório**: devolve número ou Promise de número; se lançar erro, o botão diz "Ver resultado" (nunca "Ver 0").
  - Desenha: `.filtro-barra` (busca `.search-input` se `config.busca` + botão `.filtro-btn` com `.filtro-contagem`), `.filtro-linha` (ordem + `.filtro-etiqueta` + `.filtro-limpar`), painel `.modal-overlay.open > .modal.filtro-painel` com `.filtro-painel-secao`, botões `.form-toggle` e o botão final `.filtro-ver`.
  - Guarda em `localStorage['filtro-lista:' + config.chave]`.

- [ ] **Step 1: A guarda de import falha primeiro**

Em `projetos/acolitos/senha-nova-imports.test.js`, antes do `});` final do teste, acrescentar:

```js
  // E para a regra de ORDENAR E FILTRAR: a barra mora no shared.js e usa o FiltroLista.
  // Tela que esquecer o <script> fica sem a barra — e a lista some junto com ela.
  const semFiltro = telas.filter(f => !fs.readFileSync(path.join(dir, f), 'utf8').includes('filtro-lista-core.js'));
  assert.deepStrictEqual(semFiltro, [], 'estas telas não carregam a regra de ordenar e filtrar: ' + semFiltro.join(', '));
```

Run: `cd /Users/erickmartins/iajcbp && node --test projetos/acolitos/senha-nova-imports.test.js`
Expected: FAIL listando as 20+ telas.

- [ ] **Step 2: Pôr o `<script>` em todas as telas**

```bash
cd /Users/erickmartins/iajcbp/projetos/acolitos && python3 - <<'PY'
import io, glob, re
mexidas = []
for f in sorted(glob.glob('*.html')):
    s = io.open(f, encoding='utf-8').read()
    if 'foto-recado-core.js' not in s or 'filtro-lista-core.js' in s:
        continue
    linhas = s.split('\n')
    for i, l in enumerate(linhas):
        if 'foto-recado-core.js' in l:
            linhas.insert(i + 1, l.replace('foto-recado-core.js', 'filtro-lista-core.js'))
            break
    io.open(f, 'w', encoding='utf-8').write('\n'.join(linhas))
    mexidas.append(f)
print(len(mexidas), 'telas:', ', '.join(mexidas))
PY
cd /Users/erickmartins/iajcbp && node --test projetos/acolitos/senha-nova-imports.test.js
```
Expected: o script lista as telas (as mesmas que carregam `foto-recado-core.js`); a guarda passa.

- [ ] **Step 3: Os dois ícones**

Em `projetos/acolitos/shared.js`, dentro do objeto `d` de `_svgIcon` (a última entrada antes do `};` que fecha o objeto, ~linha 2250), acrescentar:

```js
    sliders:        'M21 4h-7 M10 4H3 M21 12h-9 M8 12H3 M21 20h-5 M12 20H3 M14 2v4 M8 10v4 M16 18v4',
    x:              'M18 6L6 18 M6 6l12 12',
```

Conferir antes: `grep -n "^    sliders:\|^    x:" projetos/acolitos/shared.js` não pode achar nada.

- [ ] **Step 4: A prova de tela que falha**

Em `projetos/acolitos/provas/telas.prova.mjs`, antes de `async function provaRecadoDaFotoAparece(provas) {`, acrescentar:

```js
async function provaBarraDeFiltroFunciona(provas) {
  console.log('\n\x1b[1mBarra de ordenar e filtrar: abre, filtra, conta e lembra\x1b[0m');

  // A barra é a mesma nas seis listas. Aqui ela é provada SOZINHA, numa lista de mentira
  // montada dentro da Caixa (que já carrega o shared.js), para que um defeito nela não se
  // confunda com um defeito de Membros.
  const r = await provas.abrir('caixa.html', {
    papel: PAPEIS.admin,
    avaliar: `
      try { localStorage.removeItem('filtro-lista:prova-barra'); } catch (e) {}
      const itens = [
        { nome: 'Ana', com: 'matriz' }, { nome: 'Bia', com: 'sa' }, { nome: 'Caio', com: 'matriz' },
      ];
      let erroNaContagem = false;
      const cfg = {
        chave: 'prova-barra', rotulo: ['pessoa', 'pessoas'], ordemPadrao: 'nome',
        ordens: [
          { id: 'nome', nome: 'Nome A–Z', valor: i => i.nome },
          { id: 'inverso', nome: 'Nome Z–A', desc: true, valor: i => i.nome },
        ],
        filtros: [{ id: 'com', nome: 'Comunidade', opcoes: [
          { id: 'matriz', nome: 'Matriz', testa: i => i.com === 'matriz' },
          { id: 'sa', nome: 'Santo Antônio', testa: i => i.com === 'sa' },
        ] }],
        busca: { placeholder: 'Buscar nome...', campos: i => [i.nome] },
        contar: e => { if (erroNaContagem) throw new Error('fora do ar'); return FiltroLista.aplicar(itens, e, cfg).length; },
      };
      const alvo = document.createElement('div'); document.body.appendChild(alvo);
      let mudancas = 0;
      const ctl = montarFiltroLista(alvo, cfg, () => { mudancas++; });
      const esperar = (ms) => new Promise(f => setTimeout(f, ms));
      const painel = () => document.querySelector('.modal-overlay.open .filtro-painel');
      const botaoNoPainel = (txt) => [...painel().querySelectorAll('button')].find(b => b.textContent.trim() === txt);

      const temBusca = !!alvo.querySelector('.filtro-barra .search-input');
      const contagemAntes = alvo.querySelector('.filtro-contagem').textContent;

      alvo.querySelector('.filtro-btn').click();
      const abriu = !!painel();
      botaoNoPainel('Matriz').click(); await esperar(30);
      const verComMatriz = painel().querySelector('.filtro-ver').textContent.trim();
      botaoNoPainel('Nome Z–A').click(); await esperar(30);
      painel().querySelector('.filtro-ver').click(); await esperar(30);
      const fechou = !painel();
      const depois = ctl.aplicar(itens).map(i => i.nome);
      const contagemDepois = alvo.querySelector('.filtro-contagem').textContent;
      const etiquetas = [...alvo.querySelectorAll('.filtro-etiqueta')].map(b => b.textContent.trim());
      const ordemEscrita = (alvo.querySelector('.filtro-linha') || {}).textContent || '';
      const guardado = (() => { try { return localStorage.getItem('filtro-lista:prova-barra'); } catch (e) { return null; } })();

      // Remontar = reabrir a tela: a escolha tem de voltar.
      const ctl2 = montarFiltroLista(alvo, cfg, () => {});
      const lembrou = ctl2.aplicar(itens).map(i => i.nome);

      // Tirar pela etiqueta.
      alvo.querySelector('.filtro-etiqueta').click(); await esperar(30);
      const semEtiqueta = ctl2.aplicar(itens).length;

      // Contagem com erro: "Ver resultado", nunca "Ver 0".
      erroNaContagem = true;
      alvo.querySelector('.filtro-btn').click(); await esperar(50);
      const verComErro = painel().querySelector('.filtro-ver').textContent.trim();
      document.querySelector('.modal-overlay.open').click(); await esperar(30);
      const fechouSemAplicar = !painel();

      try { localStorage.removeItem('filtro-lista:prova-barra'); } catch (e) {}
      alvo.remove();
      return { temBusca, contagemAntes, abriu, verComMatriz, fechou, depois, contagemDepois,
               etiquetas, ordemEscrita, guardado: !!guardado, lembrou, semEtiqueta, verComErro,
               fechouSemAplicar, mudancas };
    `,
  });

  const a = r.avaliado || {};
  exigir(!r.erroAvaliar, 'a barra monta e o painel roda sem estourar', r.erroAvaliar);
  exigir(a.temBusca === true, 'com busca declarada, o campo aparece na barra');
  exigir(a.contagemAntes === '', 'sem filtro, o botão não mostra número', 'mostrou: ' + JSON.stringify(a.contagemAntes));
  exigir(a.abriu === true, 'o botão Filtrar abre o painel');
  exigir(a.verComMatriz === 'Ver 2 pessoas', 'o painel conta ANTES de aplicar', 'mostrou: ' + JSON.stringify(a.verComMatriz));
  exigir(a.fechou === true, '"Ver" fecha o painel');
  exigir(JSON.stringify(a.depois) === JSON.stringify(['Caio', 'Ana']), 'aplica filtro E ordem juntos', 'saiu: ' + JSON.stringify(a.depois));
  exigir(a.contagemDepois === '1', 'o botão mostra quantos filtros estão ligados', 'mostrou: ' + JSON.stringify(a.contagemDepois));
  exigir(JSON.stringify(a.etiquetas) === JSON.stringify(['Matriz']), 'o filtro ligado vira etiqueta', 'saiu: ' + JSON.stringify(a.etiquetas));
  exigir(/Nome Z–A/.test(a.ordemEscrita || ''), 'a ordem escolhida fica escrita na tela', 'linha: ' + JSON.stringify(a.ordemEscrita));
  exigir(a.guardado === true, 'a escolha é guardada no aparelho');
  exigir(JSON.stringify(a.lembrou) === JSON.stringify(['Caio', 'Ana']), 'reabrir traz a escolha de volta', 'saiu: ' + JSON.stringify(a.lembrou));
  exigir(a.semEtiqueta === 3, 'o X da etiqueta tira o filtro', 'sobraram: ' + a.semEtiqueta);
  exigir(a.verComErro === 'Ver resultado', 'contagem com erro NÃO vira "Ver 0"', 'mostrou: ' + JSON.stringify(a.verComErro));
  exigir(a.fechouSemAplicar === true, 'tocar fora fecha o painel');
  exigir(a.mudancas >= 1, 'a tela é avisada quando a escolha muda');
}
```

E no rodapé, depois de `    await provaAvisoDaCoordenacaoFicaNoApp(provas);`:

```js
    await provaBarraDeFiltroFunciona(provas);
```

Run: `cd /Users/erickmartins/iajcbp && npm run provar-telas 2>&1 | tail -6`
Expected: FAIL em "a barra monta e o painel roda sem estourar" com `montarFiltroLista is not defined`.

- [ ] **Step 5: Escrever a barra**

Em `projetos/acolitos/shared.js`, logo antes da linha `// ── PORTÃO DE NOTIFICAÇÕES ───`, acrescentar:

```js
// ── ORDENAR E FILTRAR (a barra das listas) ───────────────────────────────────
// Pedido do dono em 16/09/2026: nenhuma lista deixava escolher a ordem. A REGRA mora em
// filtro-lista-core.js (FiltroLista); aqui é só o desenho: a linha com busca e o botão
// "Filtrar (n)", as etiquetas com X, e o painel que sobe de baixo.
//
// A barra NÃO decide onde filtrar. Lista que já veio inteira filtra na memória; lista que
// vem do banco em pedaços tem de refazer a consulta em `aoMudar` — filtrar só o pedaço que
// veio esconde resultado (a aba de ausências traz 60 de 1.201).
//
// config.contar(estado) dá o número do botão "Ver N". Se ele falhar, o botão diz
// "Ver resultado": um "Ver 0" seria mentira.
function montarFiltroLista(alvo, config, aoMudar) {
  const F = window.FiltroLista;
  if (!F) { console.error('filtro-lista-core.js não foi carregado nesta tela'); return null; }
  const chaveGuarda = 'filtro-lista:' + config.chave;
  let estado;
  try { estado = F.restaurar(localStorage.getItem(chaveGuarda), config); }
  catch (e) { estado = F.estadoInicial(config); }
  const guardar = () => { try { localStorage.setItem(chaveGuarda, F.guardar(estado)); } catch (e) {} };
  const rotulo = (n) => n + ' ' + (n === 1 ? config.rotulo[0] : config.rotulo[1]);
  const icone = (nome, px) => {
    const s = document.createElement('span');
    s.style.cssText = 'display:inline-flex;width:' + px + 'px;height:' + px + 'px;';
    s.innerHTML = _svgIcon(nome);  // SVG fixo do próprio app — seguro
    return s;
  };

  alvo.textContent = '';
  const barra = document.createElement('div'); barra.className = 'filtro-barra';
  if (config.busca) {
    const inp = document.createElement('input');
    inp.className = 'search-input'; inp.type = 'search';
    inp.placeholder = config.busca.placeholder || 'Buscar...';
    inp.value = estado.busca;
    inp.oninput = () => { estado = F.definirBusca(estado, inp.value); guardar(); aoMudar(estado); };
    barra.appendChild(inp);
  }
  const btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'btn-sm gray filtro-btn';
  const contagem = document.createElement('span'); contagem.className = 'filtro-contagem';
  btn.append(icone('sliders', 16), document.createTextNode('Filtrar'), contagem);
  barra.appendChild(btn);
  const linha = document.createElement('div'); linha.className = 'filtro-linha';
  alvo.append(barra, linha);

  function desenharLinha() {
    const n = F.contar(estado);
    contagem.textContent = n ? String(n) : '';
    contagem.style.display = n ? 'inline-flex' : 'none';
    btn.setAttribute('aria-label', n ? 'Filtrar — ' + n + ' filtro(s) ligado(s)' : 'Filtrar');
    linha.textContent = '';
    const ord = document.createElement('span'); ord.className = 'filtro-ordem';
    ord.textContent = F.nomeDaOrdem(estado, config);
    linha.appendChild(ord);
    F.etiquetas(estado, config).forEach((t) => {
      const et = document.createElement('button');
      et.type = 'button'; et.className = 'filtro-etiqueta';
      et.setAttribute('aria-label', 'Tirar o filtro ' + t.texto);
      et.append(document.createTextNode(t.texto), icone('x', 12));
      et.onclick = () => { estado = F.alternar(estado, config, t.f, t.o); mudou(); };
      linha.appendChild(et);
    });
    if (n) {
      const lp = document.createElement('button');
      lp.type = 'button'; lp.className = 'filtro-limpar'; lp.textContent = 'Limpar';
      lp.onclick = () => { estado = F.limpar(estado); mudou(); };
      linha.appendChild(lp);
    }
  }
  function mudou() { guardar(); desenharLinha(); aoMudar(estado); }

  btn.onclick = () => {
    let rascunho = estado;
    let pedido = 0;
    const ov = document.createElement('div'); ov.className = 'modal-overlay open';
    ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
    const md = document.createElement('div'); md.className = 'modal filtro-painel';
    const handle = document.createElement('div'); handle.className = 'modal-handle';
    const tt = document.createElement('div'); tt.className = 'modal-title'; tt.textContent = 'Ordenar e filtrar';
    const corpo = document.createElement('div');
    const ver = document.createElement('button');
    ver.type = 'button'; ver.className = 'btn gold filtro-ver'; ver.style.width = '100%';
    md.append(handle, tt, corpo, ver);
    ov.appendChild(md); document.body.appendChild(ov);

    const secao = (titulo) => {
      const s = document.createElement('div'); s.className = 'filtro-painel-secao';
      const h = document.createElement('div'); h.className = 'filtro-painel-titulo'; h.textContent = titulo;
      const g = document.createElement('div'); g.className = 'form-toggle-group';
      s.append(h, g); corpo.appendChild(s);
      return g;
    };
    const opcao = (grupo, texto, ligado, papel, aoTocar) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'form-toggle' + (ligado ? ' active' : '');
      b.textContent = texto;
      b.setAttribute('role', papel);
      b.setAttribute('aria-checked', ligado ? 'true' : 'false');
      b.onclick = aoTocar;
      grupo.appendChild(b);
    };

    async function atualizarVer() {
      const meu = ++pedido;
      let n = null;
      try { n = await config.contar(rascunho); } catch (e) { n = null; }
      if (meu !== pedido) return;  // chegou resposta velha depois da nova
      ver.textContent = (typeof n === 'number' && isFinite(n)) ? 'Ver ' + rotulo(n) : 'Ver resultado';
    }
    function desenharCorpo() {
      corpo.textContent = '';
      const g = secao('Ordenar por');
      config.ordens.forEach((o) => opcao(g, o.nome, rascunho.ordem === o.id, 'radio', () => {
        rascunho = F.escolherOrdem(rascunho, config, o.id); desenharCorpo();
      }));
      (config.filtros || []).forEach((f) => {
        const gf = secao(f.nome);
        f.opcoes.forEach((op) => opcao(gf, op.nome, F.estaLigado(rascunho, f.id, op.id), 'checkbox', () => {
          rascunho = F.alternar(rascunho, config, f.id, op.id); desenharCorpo(); atualizarVer();
        }));
      });
    }
    ver.onclick = () => { estado = rascunho; ov.remove(); mudou(); };
    ver.textContent = 'Ver resultado';
    desenharCorpo();
    atualizarVer();
  };

  desenharLinha();
  return {
    estado: () => estado,
    aplicar: (lista) => F.aplicar(lista, estado, config),
    legenda: (item) => F.legenda(item, estado, config),
  };
}
```

- [ ] **Step 6: O estilo**

No fim de `projetos/acolitos/shared.css`, acrescentar:

```css
/* ── Ordenar e filtrar (montarFiltroLista, shared.js) ── */
.filtro-barra { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; }
.filtro-barra .search-input { flex: 1; min-width: 0; }
.filtro-btn { display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0; }
.filtro-contagem { min-width: 18px; height: 18px; padding: 0 5px; border-radius: 9px; background: var(--red-soft); color: #fff; font-size: 11px; font-weight: 700; align-items: center; justify-content: center; }
.filtro-linha { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-bottom: 14px; font-size: 12px; color: var(--text-muted); }
.filtro-etiqueta { display: inline-flex; align-items: center; gap: 4px; padding: 3px 6px 3px 10px; border-radius: 12px; border: 1px solid var(--border); background: var(--surface); color: var(--text); font-size: 12px; cursor: pointer; }
.filtro-limpar { background: none; border: 0; color: var(--red-soft); font-size: 12px; font-weight: 700; cursor: pointer; padding: 3px 4px; }
.filtro-painel-secao { margin-bottom: 14px; }
.filtro-painel-titulo { font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--text-muted); margin-bottom: 6px; }
.filtro-legenda { font-size: 11px; color: var(--text-muted); margin-top: 2px; }
```

Conferir que o CSS fechou todas as chaves (memória: CSS quebrado engole a regra seguinte, sem erro nenhum):

Run: `cd /Users/erickmartins/iajcbp && node -e "const s=require('fs').readFileSync('projetos/acolitos/shared.css','utf8').replace(/\/\*[\s\S]*?\*\//g,'');let n=0;for(const c of s){if(c==='{')n++;if(c==='}')n--;if(n<0)break}console.log('saldo de chaves:',n)"`
Expected: `saldo de chaves: 0`.

- [ ] **Step 7: Rodar tudo**

```bash
cd /Users/erickmartins/iajcbp && node --check projetos/acolitos/shared.js && npm run provar-regras 2>&1 | grep -E "^ℹ (tests|fail)" && npm run provar-telas 2>&1 | tail -4
```
Expected: `tests 254`, `fail 0`; provas de tela `171 provas … 171 passaram, 0 falharam` (155 + 16).

- [ ] **Step 8: Commit**

```bash
cd /Users/erickmartins/iajcbp && git status --short
git add projetos/acolitos/shared.js projetos/acolitos/shared.css projetos/acolitos/senha-nova-imports.test.js projetos/acolitos/provas/telas.prova.mjs
git add $(git diff --name-only -- 'projetos/acolitos/*.html')
git commit -m "feat(acolitos): a barra de ordenar e filtrar, igual para todas as listas" -m "Painel que sobe de baixo, etiquetas com X, escolha lembrada no aparelho. Contagem com erro diz 'Ver resultado', nunca 'Ver 0'. Toda tela carrega a regra — a guarda de import confere." -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```
(Antes do `git add $(...)`, conferir que `git diff --name-only -- 'projetos/acolitos/*.html'` lista SÓ as telas do Step 2.)

---

### Task 4: Membros usa a barra

**Files:**
- Modify: `projetos/acolitos/membros.html` (linhas 81, 91–97, 174, 185–216, 242–262, 355–370, 376–440)
- Test: `projetos/acolitos/provas/telas.prova.mjs`

**Interfaces:**
- Consumes: `montarFiltroLista` (Task 3), `FiltroLista` (Task 1), RPC `acolitos_membros_ja_entraram` (Task 2), `nivelInfo`, `nivelFromRole`, `temFotoDePerfil` (já existentes).
- Produces: globais da tela `filtroMembros` (controle da barra) e `configFiltroMembros()`.

- [ ] **Step 1: A prova de Membros que falha**

Em `projetos/acolitos/provas/telas.prova.mjs`, antes de `async function provaRecadoDaFotoAparece(provas) {`, acrescentar:

```js
async function provaMembrosMostraQuemEntrouPorUltimo(provas) {
  console.log('\n\x1b[1mMembros: "mais recentes" mostra quem entrou por último\x1b[0m');

  // Os níveis são os slugs REAIS (acolito_guardiao, não "acolito" — "acolito" é só a
  // base, e um slug inexistente cai no primeiro nível da lista sem avisar).
  //
  // O pedido do dono, com a forma real do banco: a maioria cadastrada no MESMO dia (a
  // importação de 01/06), e poucos depois. O empate é o caso comum e tem de sair em ordem
  // alfabética, não embaralhado.
  const membros = [
    { id: 'm-bruno', nome: 'Bruno Lote', created_at: '2026-06-01T10:00:00+00:00', comunidade: 'matriz', foto_url: null, nivel: 'acolito_guardiao', status: 'ativo', data_nascimento: '2012-03-05' },
    { id: 'm-ana', nome: 'Ana Lote', created_at: '2026-06-01T10:00:00+00:00', comunidade: 'matriz', foto_url: 'https://x/a.jpg', nivel: 'acolito_aspirante', status: 'ativo', data_nascimento: null },
    { id: 'm-carla', nome: 'Carla Nova', created_at: '2026-08-27T12:00:00+00:00', comunidade: 'santo_antonio', foto_url: null, nivel: 'cerimoniario_aspirante', status: 'ativo', data_nascimento: null },
    { id: 'm-davi', nome: 'Davi Recente', created_at: '2026-08-10T12:00:00+00:00', comunidade: 'matriz', foto_url: null, nivel: 'coroinha', status: 'ativo', data_nascimento: null },
  ];
  const cenario = (rpc) => `
    const esperar = (ms) => new Promise(f => setTimeout(f, ms));
    // Só o primeiro span: o bloco do nome carrega a estrela junto, que chega depois.
    const nomes = () => [...document.querySelectorAll('#grid .member-card-name')].map(e => ((e.querySelector('span') || e).textContent || '').trim());
    const painel = () => document.querySelector('.modal-overlay.open .filtro-painel');
    const tocar = (txt) => { const b = [...painel().querySelectorAll('button')].find(x => x.textContent.trim() === txt); if (!b) throw new Error('sem botão ' + txt); b.click(); };
    try { localStorage.removeItem('filtro-lista:membros'); localStorage.removeItem('estado-membros'); localStorage.setItem('membros-vista', 'cards'); } catch (e) {}
    vista = 'cards';
    await loadMembros(); await esperar(50);
    const r = { padrao: nomes() };
    r.temBarra = !!document.querySelector('#filtro-membros .filtro-barra .search-input');
    r.botoesVelhos = document.querySelectorAll('#filtros .form-toggle').length;
    document.querySelector('#filtro-membros .filtro-btn').click();
    r.filtrosNoPainel = [...painel().querySelectorAll('.filtro-painel-titulo')].map(e => e.textContent.trim());
    tocar('Mais recentes');
    ${rpc ? `tocar('Já entrou no app'); await esperar(30); r.ver = painel().querySelector('.filtro-ver').textContent.trim(); tocar('Já entrou no app'); await esperar(30);` : ''}
    painel().querySelector('.filtro-ver').click(); await esperar(50);
    r.recentes = nomes();
    r.legendas = [...document.querySelectorAll('#grid .filtro-legenda')].map(e => e.textContent.trim());
    // estado antigo (antes da barra): nível "acolito" e busca "lote" têm de sobreviver
    try { localStorage.removeItem('filtro-lista:membros'); localStorage.setItem('estado-membros', JSON.stringify({ filtro: 'acolito', busca: 'lote', y: 0 })); } catch (e) {}
    await loadMembros(); await esperar(50);
    r.migrado = nomes();
    r.buscaMigrada = (document.querySelector('#filtro-membros .search-input') || {}).value;
    try { localStorage.removeItem('filtro-lista:membros'); localStorage.removeItem('estado-membros'); } catch (e) {}
    return r;
  `;

  const r = await provas.abrir('membros.html', {
    papel: PAPEIS.admin,
    tabelas: { acolitos_membros: { data: membros } },
    rpcs: { acolitos_membros_ja_entraram: { data: [{ membro_id: 'm-carla' }] } },
    avaliar: cenario(true),
  });
  const a = r.avaliado || {};
  exigir(!r.erroAvaliar, 'Membros abre com a barra sem estourar', r.erroAvaliar);
  exigir((r.erros || []).length === 0, 'nenhum erro de JavaScript na tela', (r.erros || []).join(' | '));
  exigir(a.temBarra === true, 'a busca mora na barra nova');
  exigir(a.botoesVelhos === 0, 'os botões de nível antigos saíram (viraram filtro no painel)');
  exigir(JSON.stringify(a.padrao) === JSON.stringify(['Ana Lote', 'Bruno Lote', 'Carla Nova', 'Davi Recente']),
    'abre em ordem alfabética, como antes', 'saiu: ' + JSON.stringify(a.padrao));
  exigir(JSON.stringify(a.filtrosNoPainel) === JSON.stringify(['Ordenar por', 'Nível', 'Comunidade', 'App', 'Foto']),
    'o painel oferece nível, comunidade, app e foto', 'saiu: ' + JSON.stringify(a.filtrosNoPainel));
  exigir(a.ver === 'Ver 1 membro', '"já entrou no app" conta pelo banco', 'mostrou: ' + JSON.stringify(a.ver));
  exigir(JSON.stringify(a.recentes) === JSON.stringify(['Carla Nova', 'Davi Recente', 'Ana Lote', 'Bruno Lote']),
    'MAIS RECENTES: quem entrou por último no topo, o lote em ordem alfabética', 'saiu: ' + JSON.stringify(a.recentes));
  exigir((a.legendas || [])[0] === 'cadastro 27/08',
    'a data do cadastro aparece embaixo do nome', 'saiu: ' + JSON.stringify(a.legendas));
  exigir(JSON.stringify(a.migrado) === JSON.stringify(['Ana Lote', 'Bruno Lote']),
    'o filtro guardado antes da barra (nível + busca) não se perde', 'saiu: ' + JSON.stringify(a.migrado));
  exigir(a.buscaMigrada === 'lote', 'e a busca guardada volta para o campo', 'campo: ' + JSON.stringify(a.buscaMigrada));

  // Banco fora do ar para "quem já entrou": o filtro App SOME. Mostrar todo mundo como
  // "nunca entrou" seria falha virando número.
  const r2 = await provas.abrir('membros.html', {
    papel: PAPEIS.admin,
    tabelas: { acolitos_membros: { data: membros } },
    rpcs: { acolitos_membros_ja_entraram: { error: { message: 'sem_permissao', code: '42501' } } },
    avaliar: cenario(false),
  });
  const b = r2.avaliado || {};
  exigir(!r2.erroAvaliar, 'com a função recusando, Membros abre mesmo assim', r2.erroAvaliar);
  exigir(JSON.stringify(b.filtrosNoPainel) === JSON.stringify(['Ordenar por', 'Nível', 'Comunidade', 'Foto']),
    'sem resposta do banco, o filtro App não aparece (em vez de mentir)', 'saiu: ' + JSON.stringify(b.filtrosNoPainel));
}
```

E no rodapé, depois de `    await provaBarraDeFiltroFunciona(provas);`:

```js
    await provaMembrosMostraQuemEntrouPorUltimo(provas);
```

Run: `cd /Users/erickmartins/iajcbp && npm run provar-telas 2>&1 | grep -A14 "mais recentes"`
Expected: FAIL (a barra não existe em Membros; `#filtro-membros` é nulo).

- [ ] **Step 2: O HTML — tirar a busca e os botões antigos, pôr o lugar da barra**

Em `projetos/acolitos/membros.html`:

Apagar a linha 81:
```html
    <input class="search-input" id="busca" placeholder="🔍 Buscar nome..." oninput="filtrar()">
```

Trocar as linhas 91–97 (o bloco inteiro `<div class="filtros-wrap" id="filtros"> … </div>`) por:
```html
  <div id="filtro-membros"></div>
```

- [ ] **Step 3: O estado — só a rolagem continua no `estado-membros`**

Trocar a linha 174 `let filtroAtivo = '';` por:
```js
let filtroMembros = null;  // controle da barra de ordenar e filtrar (montarFiltroLista)
let jaEntraram = null;     // Set de membro_id que já entraram no app; null = o banco não respondeu
```

Trocar o bloco das linhas 185–206 (de `// ── Lembrar filtro/busca/rolagem` até o fim de `restaurarEstadoMembros`) por:
```js
// ── Lembrar a rolagem ao reabrir. Busca, ordem e filtros agora moram na barra
// (localStorage 'filtro-lista:membros'); 'membros-vista' continua separado. ──
function salvarEstadoMembros() {
  try {
    const antigo = JSON.parse(localStorage.getItem('estado-membros') || 'null') || {};
    localStorage.setItem('estado-membros', JSON.stringify({ ...antigo, y: window.scrollY }));
  } catch (e) {}
}
function restaurarEstadoMembros() {
  let s; try { s = JSON.parse(localStorage.getItem('estado-membros') || 'null'); } catch (e) { s = null; }
  if (!s) return;
  window.__memRestoreY = (s.y != null) ? s.y : null;
}

// Antes da barra, o nível e a busca ficavam em 'estado-membros'. Converte UMA vez, para
// ninguém abrir a tela depois da atualização e perder o filtro que tinha.
function migrarEstadoAntigoDosMembros(cfg) {
  try {
    if (localStorage.getItem('filtro-lista:membros') != null) return;
    const s = JSON.parse(localStorage.getItem('estado-membros') || 'null');
    if (!s || (!s.filtro && !s.busca)) return;
    let e = FiltroLista.estadoInicial(cfg);
    if (s.filtro) e = FiltroLista.alternar(e, cfg, 'nivel', s.filtro);
    if (s.busca) e = FiltroLista.definirBusca(e, s.busca);
    localStorage.setItem('filtro-lista:membros', FiltroLista.guardar(e));
    localStorage.setItem('estado-membros', JSON.stringify({ y: s.y != null ? s.y : null }));
  } catch (e) {}
}

// ── As opções da barra nesta tela ──
const NIVEL_ORDEM = { cerimonario: 0, acolito: 1, coroinha: 2, aspirante: 3 };
function nivelBaseDe(m) { return nivelInfo(m.nivel || nivelFromRole(m.role)).base; }
function diaMes(iso) { return iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) : ''; }
function proximoAniversario(m) {
  if (!m.data_nascimento) return null;
  const [a, mes, dia] = m.data_nascimento.split('-').map(Number);
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  let prox = new Date(hoje.getFullYear(), mes - 1, dia);
  if (prox < hoje) prox = new Date(hoje.getFullYear() + 1, mes - 1, dia);
  return { dias: Math.round((prox - hoje) / 86400000), idade: prox.getFullYear() - a };
}
function configFiltroMembros() {
  const filtros = [
    { id: 'nivel', nome: 'Nível', opcoes: [
      { id: 'cerimonario', nome: 'Cerimoniários', testa: m => nivelBaseDe(m) === 'cerimonario' },
      { id: 'acolito', nome: 'Acólitos', testa: m => nivelBaseDe(m) === 'acolito' },
      { id: 'coroinha', nome: 'Coroinhas', testa: m => nivelBaseDe(m) === 'coroinha' },
      { id: 'aspirante', nome: 'Aspirantes', testa: m => nivelBaseDe(m) === 'aspirante' },
    ] },
    { id: 'comunidade', nome: 'Comunidade', opcoes: [
      { id: 'matriz', nome: 'Matriz', testa: m => m.comunidade === 'matriz' },
      { id: 'santo_antonio', nome: 'Santo Antônio', testa: m => m.comunidade === 'santo_antonio' },
      { id: 'outra', nome: 'Outra', testa: m => m.comunidade !== 'matriz' && m.comunidade !== 'santo_antonio' },
    ] },
  ];
  // Só oferece o filtro App se o banco respondeu. Sem resposta, esconder é honesto;
  // mostrar todo mundo como "nunca entrou" seria falha virando número.
  if (jaEntraram) filtros.push({ id: 'app', nome: 'App', opcoes: [
    { id: 'entrou', nome: 'Já entrou no app', testa: m => jaEntraram.has(m.id) },
    { id: 'nunca', nome: 'Nunca entrou no app', testa: m => !jaEntraram.has(m.id) },
  ] });
  filtros.push({ id: 'foto', nome: 'Foto', opcoes: [
    { id: 'com', nome: 'Com foto', testa: m => temFotoDePerfil(m) },
    { id: 'sem', nome: 'Sem foto', testa: m => !temFotoDePerfil(m) },
  ] });
  const cfg = {
    chave: 'membros',
    rotulo: ['membro', 'membros'],
    ordemPadrao: 'nome',
    ordens: [
      { id: 'nome', nome: 'Nome A–Z', valor: m => m.nome },
      { id: 'recentes', nome: 'Mais recentes', desc: true, valor: m => m.created_at || null,
        legenda: m => m.created_at ? 'cadastro ' + diaMes(m.created_at.slice(0, 10)) : '' },
      { id: 'aniversario', nome: 'Próximos aniversários', valor: m => { const p = proximoAniversario(m); return p ? p.dias : null; },
        legenda: m => { const p = proximoAniversario(m); return p ? 'faz ' + p.idade + ' anos em ' + diaMes(m.data_nascimento) : ''; } },
      { id: 'nivel', nome: 'Nível', valor: m => { const r = NIVEL_ORDEM[nivelBaseDe(m)]; return r == null ? 9 : r; } },
    ],
    filtros,
    busca: { placeholder: 'Buscar nome...', campos: m => [m.nome, m.apelido] },
  };
  cfg.contar = (e) => FiltroLista.aplicar(todos, e, cfg).length;
  return cfg;
}
function montarFiltroMembros() {
  const cfg = configFiltroMembros();
  migrarEstadoAntigoDosMembros(cfg);
  filtroMembros = montarFiltroLista(document.getElementById('filtro-membros'), cfg, () => renderGrid());
}
```

- [ ] **Step 4: Carregar "quem já entrou" e montar a barra**

Em `loadMembros()` (linha ~241), trocar a última linha `  renderGrid();` por:
```js
  const { data: entraram, error: erroEntraram } = await sbAdmin.rpc('acolitos_membros_ja_entraram');
  if (erroEntraram) console.warn('Membros: não deu para saber quem já entrou no app', erroEntraram);
  jaEntraram = erroEntraram ? null : new Set((entraram || []).map(r => r.membro_id));
  montarFiltroMembros();
  renderGrid();
```

- [ ] **Step 5: Tirar as funções antigas e usar a barra na lista**

Apagar as funções `filtrar()` (linha 355) e `setFiltro(btn, role)` (linhas 364–370). Antes, conferir que nada mais as chama:

Run: `cd /Users/erickmartins/iajcbp/projetos/acolitos && grep -n "filtrar()\|setFiltro(\|filtroAtivo\|getElementById('busca')" membros.html`
Expected: depois das trocas dos Steps 2–3, só aparecem as próprias definições e a linha de `renderGrid` que o Step 6 troca.

- [ ] **Step 6: `renderGrid` usa a barra e mostra a legenda**

Em `renderGrid()`: apagar a linha `  const busca = document.getElementById('busca').value.toLowerCase();` e trocar o bloco

```js
  const lista = todos.filter(m =>
    semAcento(m.nome).includes(semAcento(busca)) &&
    (!filtroAtivo || nivelInfo(m.nivel || nivelFromRole(m.role)).base === filtroAtivo)
  );
```
por:
```js
  const lista = filtroMembros ? filtroMembros.aplicar(todos) : todos;
  const legendaDe = (m) => (filtroMembros ? filtroMembros.legenda(m) : '');
```

Na vista em lista, logo depois de `info.appendChild(nameBlock(...));`, acrescentar:
```js
      const legL = legendaDe(m);
      if (legL) { const lg = document.createElement('div'); lg.className = 'filtro-legenda'; lg.textContent = legL; info.appendChild(lg); }
```

Na vista em cartões, trocar `    card.append(avatarWrap, nome, meta, com);` por:
```js
    const legC = legendaDe(m);
    if (legC) { const lg = document.createElement('div'); lg.className = 'filtro-legenda'; lg.textContent = legC; card.append(avatarWrap, nome, lg, meta, com); }
    else card.append(avatarWrap, nome, meta, com);
```

Em `setVista(v)` e `toggleArquivados()` nada muda (`loadMembros` já remonta a barra).

- [ ] **Step 7: Rodar tudo**

```bash
cd /Users/erickmartins/iajcbp && npm run provar-regras 2>&1 | grep -E "^ℹ (tests|fail)" && npm run provar-telas 2>&1 | tail -4
```
Expected: `tests 254`, `fail 0`; provas de tela `184 provas … 184 passaram, 0 falharam` (171 + 13). A prova de fumaça de Membros (todos os papéis) continua verde.

- [ ] **Step 8: Olhar a tela de verdade, no tamanho do celular**

Com o harness, tirar foto de `membros.html` em 390×844 com o painel aberto e conferir a imagem (a busca e o botão na mesma linha; etiquetas quebrando linha; painel sem cortar o botão "Ver"). Memória: teste verde não é tela que abre.

- [ ] **Step 9: Commit**

```bash
cd /Users/erickmartins/iajcbp && git status --short
git add projetos/acolitos/membros.html projetos/acolitos/provas/telas.prova.mjs
git commit -m "feat(acolitos): Membros mostra quem entrou por último" -m "A aba usa a barra nova: mais recentes, próximos aniversários, nível; filtros de nível, comunidade, app e foto. O nível e a busca guardados antes da barra são convertidos, não perdidos. Se o banco não disser quem já entrou, o filtro App some em vez de mentir." -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Registrar e publicar

**Files:**
- Modify: `projetos/acolitos/sw.js:3`, `docs/pendencias.md`, `docs/pendencias-fechados.md`

- [ ] **Step 1: A lista**

Em `docs/pendencias.md`, no bloco "## 1. Pendente", trocar a linha `**Nada.** Em 31/08/2026 …` pelo item novo acima dela:

```markdown
**Ordenar e filtrar — passos 2 a 5 da spec** (`docs/superpowers/specs/2026-09-16-acolitos-ordenar-e-filtrar-design.md`).
O passo 1 (a barra + Membros) está no ar desde 16/09/2026. Faltam: Agenda e CRM; Chamada;
migration 069 + Ausências (Avisos e Faltas — a parte que filtra na consulta); Tarefas.

```

E em `docs/pendencias-fechados.md`, no topo do bloco "## Fechados em 16/09/2026", acrescentar (trocando `<R>` e `<T>` pelos totais que o Step 7 da Task 4 imprimiu):

```markdown
**Membros mostra quem entrou por último — e a barra de ordenar e filtrar existe**
- **O que era:** "na aba Membros não consigo ver quem entrou por último". Nenhuma lista do app
  deixava escolher a ordem; Membros era sempre alfabética.
- **O que entrou:** `filtro-lista-core.js` (a regra) e `montarFiltroLista` no `shared.js` (a
  barra: busca + "Filtrar (n)", etiquetas com X, painel). Membros ganhou Mais recentes (com a
  data embaixo do nome), Próximos aniversários e Nível; filtros de Nível, Comunidade, App e Foto.
  Migration 068 diz quem já entrou no app sem expor e-mail nem data.
- **Provado:** `filtro-lista-core.test.js`, `provar-068-quem-ja-entrou.sql`,
  `provaBarraDeFiltroFunciona` e `provaMembrosMostraQuemEntrouPorUltimo`. <R> regras e <T>
  provas de tela, todas verdes.
- **Não repetir:** o filtro guardado antes da barra (`estado-membros`) é convertido uma vez;
  apagar essa conversão faz quem já tinha filtro abrir a tela sem ele.

```

- [ ] **Step 2: Perguntar ao dono antes de publicar**

Publicar muda o site. Mostrar o que vai subir e esperar o ok.

- [ ] **Step 3: Carimbar, commitar e enviar**

```bash
cd /Users/erickmartins/iajcbp
perl -pi -e "s/const BUILD = '[^']*'/const BUILD = '$(date +%Y%m%d%H%M%S)'/" projetos/acolitos/sw.js
git status --short
git add projetos/acolitos/sw.js docs/pendencias.md docs/pendencias-fechados.md
git commit -m "docs(pendencias): o passo 1 dos filtros no ar, e o que falta" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
gh auth switch --user erickjcbp && git fetch -q origin && git rev-list --count HEAD..origin/main && git push origin main; gh auth switch --user brenoov
```
Expected: `0` antes do push (ninguém subiu nada no meio); push aceito; a conta ativa volta a ser `brenoov`.

- [ ] **Step 4: Conferir no ar**

```bash
B=$(grep -o "BUILD = '[0-9]*'" /Users/erickmartins/iajcbp/projetos/acolitos/sw.js)
for i in $(seq 1 40); do curl -s "https://coroinhas.jcbplimeira.com.br/projetos/acolitos/sw.js?x=$RANDOM" | grep -q "$B" && { echo "NO AR: $B"; break; }; sleep 15; done
curl -s "https://coroinhas.jcbplimeira.com.br/projetos/acolitos/filtro-lista-core.js?x=$RANDOM" | grep -c "FiltroLista"
curl -s "https://coroinhas.jcbplimeira.com.br/projetos/acolitos/membros.html?x=$RANDOM" | grep -c "filtro-membros"
```
Expected: `NO AR: …`, `1`, `1`. Se o carimbo não mudar em 10 minutos, é o gatilho da Vercel (memória `project_acolitos_deploy`): `git commit --allow-empty` + push.
