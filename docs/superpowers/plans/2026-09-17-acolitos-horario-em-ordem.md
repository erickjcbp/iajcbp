# O horário das missas sai em ordem de hora, não de texto — Plano de execução

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nas telas Agenda, Chamada, Escala, Escalas do membro, Início e Ausências, as missas do mesmo dia aparecem na ordem da HORA (7h, 9h, 19h), e não na ordem do texto (19h, 7h, 9h).

**Architecture:** O horário está guardado como texto sem zero na frente (`7h`, `18h30`, `19h30`), então toda comparação de texto erra. O banco ganha uma coluna `minutos` calculada sozinha a partir do horário (usando a função `acolitos_minutos_do_horario`, da migration 070), e as telas passam a pedir a ordem por ela. Onde a ordenação acontece na tela (listas já carregadas, ou missas misturadas com eventos), entra um ajudante novo em `horario-core.js`, espelho da função do banco, testado sem navegador.

**Tech Stack:** HTML + JS sem build, Supabase (Postgres 17 + PostgREST), `node --test`, harness de telas (Chrome via puppeteer-core), `psql` em `/opt/homebrew/opt/libpq/bin/`.

**Contexto medido em 17/09/2026 (produção):** 101 celebrações; **39 dias têm mais de uma missa e 20 deles saem fora de ordem hoje** — todos os domingos (a tela mostra `19h, 7h, 9h`), de 31/05 a 11/10, incluindo **este domingo, 20/09**. A `escala.html` usa uma lista escrita à mão (`['17h','18h30','7h','9h','19h']`) que joga para o fim qualquer horário fora dela — e existem `16h` e `19h30` no banco. Os EVENTOS não têm esse problema: `acolitos_eventos.hora` é hora de verdade (`time`).

## Global Constraints

- Tudo em português, sem jargão na tela.
- Regras: `npm run provar-regras` (hoje **260**). Telas: `npm run provar-telas` (hoje **326**, ~95 s). **Sempre** `> /tmp/claude-501/<nome>.txt 2>&1` e ler de lá; rodar o GREEN duas vezes. Os totais têm de SUBIR exatamente como cada tarefa diz.
- **Corrida conhecida:** fechar uma janela (`.modal-overlay`) chama `history.back()` depois; toda prova espera ≥120 ms depois de fechar um painel e confere que `r.avaliado` é objeto.
- Banco = PRODUÇÃO. A única escrita permitida é aplicar `docs/migrations/071_celebracao_guarda_os_minutos.sql`. Provas SQL só leem (`begin … rollback` quando fingirem papel).
- **Nunca** imprimir a linha de conexão: usar `psql "$SUPABASE_DB_URL" -f <arquivo.sql>`; se der erro, ler a saída do arquivo, não repetir o comando na tela.
- `git push`, `gh auth switch`, `vercel switch`, `checkout` de branch e `stash` são proibidos. Commit arquivo por arquivo.
- Mensagens de commit em português, `tipo(escopo): frase`, terminando com `Co-Authored-By:` do modelo que escreveu o commit.
- A `escala.html` **não roda no harness** (carrega dados demais): as mudanças nela são conferidas por `node --check`, pela prova de fumaça (que abre a tela e exige zero erro de JavaScript) e por leitura cuidadosa. Não inventar prova que não roda.

---

## Estrutura de arquivos

| Arquivo | O que muda |
|---|---|
| `projetos/acolitos/horario-core.js` (+ `.test.js`) | criar: `minutosDoHorario` e `compararHorario` |
| `projetos/acolitos/*.html` (as que carregam `foto-recado-core.js`) | `<script src="horario-core.js">` |
| `projetos/acolitos/senha-nova-imports.test.js` | guarda: toda tela carrega o ajudante novo |
| `docs/migrations/071_celebracao_guarda_os_minutos.sql`, `docs/provas/provar-071-celebracao-em-ordem.sql` | coluna `minutos` |
| `agenda.html`, `chamada.html`, `escala.html`, `escalas-membro.html`, `index.html`, `ausencias.html` | pedir a ordem por `minutos`; comparar por minutos na tela |
| `projetos/acolitos/provas/telas.prova.mjs` | prova da Agenda com 7h/9h/19h |
| `docs/pendencias*.md`, `projetos/acolitos/sw.js` | Tarefa 4 |

---

### Task 1: O ajudante que lê o horário

**Files:**
- Create: `projetos/acolitos/horario-core.js`, `projetos/acolitos/horario-core.test.js`
- Modify: todas as `projetos/acolitos/*.html` que carregam `foto-recado-core.js`; `projetos/acolitos/senha-nova-imports.test.js`

**Interfaces (produzidas):** global `HorarioDaMissa` com
- `minutosDoHorario(texto) -> number|null` — `'7h'`→420, `'18h30'`→1110, `'19:00'`→1140, `'15:00:00'`→900, `'07h'`→420; qualquer coisa que não comece com hora → `null`.
- `compararHorario(a, b) -> number` — para usar em `sort`: hora menor primeiro, e o que não dá para ler vai para o FIM.

- [ ] **Step 1: As provas que falham** — criar `projetos/acolitos/horario-core.test.js`:

```js
// O horário da missa está guardado como TEXTO, sem zero na frente ('7h', '18h30', '19h30').
// Em ordem de texto, '9h' vem depois de '19h' — e era assim que as telas mostravam os
// domingos: 19h, 7h, 9h. Medido em 17/09/2026: 20 dos 39 dias com mais de uma missa saíam
// fora de ordem. Este ajudante é o espelho, em JavaScript, da função
// acolitos_minutos_do_horario do banco (migration 070) — se um mudar, o outro muda junto.
const { test } = require('node:test');
const assert = require('node:assert');
const { minutosDoHorario, compararHorario } = require('./horario-core.js');

test('lê os horários que existem no banco hoje', () => {
  assert.strictEqual(minutosDoHorario('7h'), 420);
  assert.strictEqual(minutosDoHorario('9h'), 540);
  assert.strictEqual(minutosDoHorario('16h'), 960);
  assert.strictEqual(minutosDoHorario('17h'), 1020);
  assert.strictEqual(minutosDoHorario('18h30'), 1110);
  assert.strictEqual(minutosDoHorario('19h'), 1140);
  assert.strictEqual(minutosDoHorario('19h30'), 1170);
});

test('lê também hora com dois pontos e com zero na frente', () => {
  assert.strictEqual(minutosDoHorario('19:00'), 1140);
  assert.strictEqual(minutosDoHorario('08:15'), 495);
  assert.strictEqual(minutosDoHorario('15:00:00'), 900);   // é assim que o EVENTO guarda
  assert.strictEqual(minutosDoHorario('07h'), 420);
  assert.strictEqual(minutosDoHorario('  19h '), 1140);
});

test('o que não dá para ler devolve nada — e nunca estoura', () => {
  for (const ruim of [null, undefined, '', '   ', 'sem hora', 'h', 'manhã']) {
    assert.strictEqual(minutosDoHorario(ruim), null, 'entrada: ' + JSON.stringify(ruim));
  }
});

test('ordena pela HORA, não pelo texto — o domingo é o caso real', () => {
  const domingo = ['19h', '7h', '9h'];
  assert.deepStrictEqual(domingo.slice().sort(compararHorario), ['7h', '9h', '19h']);
  const sabado = ['18h30', '17h'];
  assert.deepStrictEqual(sabado.slice().sort(compararHorario), ['17h', '18h30']);
});

test('o que não dá para ler vai para o FIM, e horários iguais empatam', () => {
  assert.deepStrictEqual(['19h', 'sem hora', '7h'].slice().sort(compararHorario), ['7h', '19h', 'sem hora']);
  assert.strictEqual(compararHorario('19h', '19:00'), 0);
  assert.strictEqual(compararHorario(null, null), 0);
});
```

Run: `node --test projetos/acolitos/horario-core.test.js > /tmp/claude-501/h-t1-red.txt 2>&1; tail -6 /tmp/claude-501/h-t1-red.txt`
Expected: FAIL — `Cannot find module './horario-core.js'`.

- [ ] **Step 2: O ajudante** — criar `projetos/acolitos/horario-core.js`:

```js
// A hora da missa, em minutos — para ordenar.
//
// O horário é TEXTO no banco, sem zero na frente: '7h', '9h', '18h30', '19h30'. Comparar
// texto põe '9h' depois de '19h', e era assim que as telas mostravam os domingos
// (19h, 7h, 9h). Em 17/09/2026, 20 dos 39 dias com mais de uma missa estavam assim.
//
// ESTE ARQUIVO É O ESPELHO, em JavaScript, da função acolitos_minutos_do_horario do banco
// (migration 070). Mudou um, muda o outro — senão a tela e o banco ordenam diferente.
//
// O EVENTO guarda hora de verdade ('15:00:00') e também é lido aqui, porque a Agenda mistura
// missas e eventos na mesma lista.
(function (global) {
  'use strict';

  function minutosDoHorario(texto) {
    var m = String(texto == null ? '' : texto).trim().match(/^(\d{1,2})\s*[h:]\s*(\d{0,2})/);
    if (!m) return null;
    var h = Number(m[1]);
    var min = m[2] === '' ? 0 : Number(m[2]);
    if (!isFinite(h) || !isFinite(min)) return null;
    return h * 60 + min;
  }

  // Para usar direto em sort(): hora menor primeiro; o que não dá para ler vai para o fim.
  function compararHorario(a, b) {
    var ma = minutosDoHorario(a), mb = minutosDoHorario(b);
    if (ma === null && mb === null) return 0;
    if (ma === null) return 1;
    if (mb === null) return -1;
    return ma - mb;
  }

  var api = { minutosDoHorario: minutosDoHorario, compararHorario: compararHorario };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else {  // pelo NOME: as telas chamam direto
    global.HorarioDaMissa = api;
    global.minutosDoHorario = minutosDoHorario;
    global.compararHorario = compararHorario;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
```

Run: `node --test projetos/acolitos/horario-core.test.js > /tmp/claude-501/h-t1-green.txt 2>&1; tail -6 /tmp/claude-501/h-t1-green.txt`
Expected: `pass 5`, `fail 0`.

- [ ] **Step 3: A guarda de import falha primeiro**

Em `projetos/acolitos/senha-nova-imports.test.js`, antes do `});` final do teste, acrescentar:

```js
  // E para a regra do HORÁRIO: tela que esquecer o <script> volta a ordenar as missas pelo
  // texto ('9h' depois de '19h') — e isso não estoura, só mostra errado, que é pior.
  const semHorario = telas.filter(f => !fs.readFileSync(path.join(dir, f), 'utf8').includes('horario-core.js'));
  assert.deepStrictEqual(semHorario, [], 'estas telas não carregam a regra do horário: ' + semHorario.join(', '));
```

Run: `node --test projetos/acolitos/senha-nova-imports.test.js` → FAIL listando as 20+ telas.

- [ ] **Step 4: Pôr o `<script>` em todas as telas**

```bash
cd /Users/erickmartins/iajcbp/projetos/acolitos && python3 - <<'PY'
import io, glob
mexidas = []
for f in sorted(glob.glob('*.html')):
    s = io.open(f, encoding='utf-8').read()
    if 'foto-recado-core.js' not in s or 'horario-core.js' in s:
        continue
    linhas = s.split('\n')
    for i, l in enumerate(linhas):
        if 'foto-recado-core.js' in l:
            linhas.insert(i + 1, l.replace('foto-recado-core.js', 'horario-core.js'))
            break
    io.open(f, 'w', encoding='utf-8').write('\n'.join(linhas))
    mexidas.append(f)
print(len(mexidas), 'telas:', ', '.join(mexidas))
PY
```
Depois: `node --test projetos/acolitos/senha-nova-imports.test.js` (passa) e `npm run provar-regras 2>&1 | grep -E "^ℹ (tests|fail)"` → **265** (260 + 5), `fail 0`.

- [ ] **Step 5: Commit**

```bash
git status --short
git add projetos/acolitos/horario-core.js projetos/acolitos/horario-core.test.js projetos/acolitos/senha-nova-imports.test.js
git add $(git diff --name-only -- 'projetos/acolitos/*.html')
git commit -m "feat(acolitos): a regra que lê a hora da missa, em minutos" -m "Espelho em JavaScript da função do banco (070). O horário é texto sem zero na frente, então comparar texto põe 9h depois de 19h." -m "Co-Authored-By: <o modelo que escreveu> <noreply@anthropic.com>"
```
(Conferir antes que `git diff --name-only -- 'projetos/acolitos/*.html'` lista SÓ as telas do Step 4.)

---

### Task 2: O banco guarda os minutos da missa

**Files:**
- Create: `docs/migrations/071_celebracao_guarda_os_minutos.sql`, `docs/provas/provar-071-celebracao-em-ordem.sql`

**Interfaces (produzidas):** `public.acolitos_celebracoes.minutos` — coluna inteira, **calculada sozinha** a partir de `horario` (não se escreve nela), para as telas pedirem `order('minutos')`.

- [ ] **Step 1: A prova que falha** — criar `docs/provas/provar-071-celebracao-em-ordem.sql`:

```sql
-- Prova da 071 SEM gravar nada: a missa guarda a hora em minutos, e a ordem sai certa.
-- Rodar:  psql "$SUPABASE_DB_URL" -f docs/provas/provar-071-celebracao-em-ordem.sql
--
-- O QUE DEFENDE: o horário é texto sem zero ('7h','19h30'); ordenar por texto põe 9h depois
-- de 19h. Em 17/09/2026, 20 dos 39 dias com mais de uma missa saíam assim — todo domingo.
\set ON_ERROR_STOP on
\timing off

\echo '=== 0) a coluna existe e é calculada sozinha ==='
select column_name, data_type, is_generated, generation_expression
  from information_schema.columns
 where table_name = 'acolitos_celebracoes' and column_name = 'minutos';

\echo ''
\echo '=== 1) minutos bate com a função, em TODAS as linhas ==='
select count(*) as total,
       count(*) filter (where minutos is distinct from public.acolitos_minutos_do_horario(horario)) as diferentes_DEVE_SER_0,
       count(*) filter (where minutos is null) as sem_minutos_DEVE_SER_0
  from public.acolitos_celebracoes;

\echo ''
\echo '=== 2) cada horário do banco vira o minuto certo ==='
select horario, min(minutos) as minutos, count(*) as missas
  from public.acolitos_celebracoes group by horario order by min(minutos);

\echo ''
\echo '=== 3) a ordem por minutos conserta os dias que saíam errados ==='
with d as (
  select data,
         array_agg(horario order by minutos) as por_minutos,
         array_agg(horario order by horario) as por_texto,
         count(*) as n
    from public.acolitos_celebracoes group by data)
select count(*) filter (where n > 1) as dias_com_2_ou_mais,
       count(*) filter (where n > 1 and por_minutos <> por_texto) as dias_que_o_texto_errava
  from d;
-- e, para provar que a ordem por minutos é mesmo crescente, sem confiar no array acima:
select count(*) as pares_fora_de_ordem_DEVE_SER_0
  from (select data, minutos, lag(minutos) over (partition by data order by minutos) as anterior
          from public.acolitos_celebracoes) t
 where anterior is not null and minutos < anterior;

\echo ''
\echo '=== 4) o domingo mais próximo, do jeito certo ==='
with d as (select data, array_agg(horario order by minutos) as por_minutos, array_agg(horario order by horario) as por_texto
             from public.acolitos_celebracoes where data >= current_date group by data having count(*) > 1)
select data, por_texto::text as como_saia_antes, por_minutos::text as como_sai_agora
  from d order by data limit 3;

\echo ''
\echo '=== 5) a coluna é só de leitura: ninguém escreve nela ==='
do $$
begin
  update public.acolitos_celebracoes set minutos = 1 where false;
  raise notice 'ESCRITA: PASSOU — ERRADO (coluna deveria recusar)';
exception when others then
  raise notice 'ESCRITA: recusada — CERTO (%)', left(SQLERRM, 60);
end $$;
```

Run: `set -a && . ./.env && set +a && /opt/homebrew/opt/libpq/bin/psql "$SUPABASE_DB_URL" -f docs/provas/provar-071-celebracao-em-ordem.sql > /tmp/claude-501/h-t2-red.txt 2>&1; head -12 /tmp/claude-501/h-t2-red.txt`
Expected: seção 0 devolve 0 linhas e a seção 1 falha com `column "minutos" does not exist`.

- [ ] **Step 2: A migration** — criar `docs/migrations/071_celebracao_guarda_os_minutos.sql`:

```sql
-- Acólitos 071 — a missa passa a guardar a hora em MINUTOS
--
-- O horário está guardado como texto sem zero na frente ('7h', '9h', '18h30', '19h30').
-- Ordenar por texto põe '9h' DEPOIS de '19h': medido em 17/09/2026, 20 dos 39 dias com mais
-- de uma missa saíam fora de ordem — todo domingo aparecia 19h, 7h, 9h, inclusive o próximo.
--
-- A coluna é CALCULADA pelo banco a partir do horário (a função veio na 070, e é imutável,
-- que é o que permite usá-la aqui). Ninguém escreve nela: some a chance de a hora e os
-- minutos discordarem. As telas passam a pedir a ordem por `minutos`.
--
-- Os EVENTOS não precisam disto: acolitos_eventos.hora já é hora de verdade (time).
--
-- IDEMPOTENTE: `add column if not exists`.

alter table public.acolitos_celebracoes
  add column if not exists minutos integer
  generated always as (public.acolitos_minutos_do_horario(horario)) stored;

comment on column public.acolitos_celebracoes.minutos is
  'A hora da missa em minutos do dia, calculada de `horario`. Serve para ORDENAR: horario é texto sem zero e ordena errado. Prova: docs/provas/provar-071-celebracao-em-ordem.sql';

-- O servidor de consultas só enxerga a coluna nova depois de recarregar.
notify pgrst, 'reload schema';
```

- [ ] **Step 3: Aplicar e provar**

```bash
set -a && . ./.env && set +a
P=/opt/homebrew/opt/libpq/bin/psql
$P "$SUPABASE_DB_URL" -f docs/migrations/071_celebracao_guarda_os_minutos.sql > /tmp/claude-501/h-t2-aplicar.txt 2>&1; cat /tmp/claude-501/h-t2-aplicar.txt
$P "$SUPABASE_DB_URL" -f docs/provas/provar-071-celebracao-em-ordem.sql > /tmp/claude-501/h-t2-green.txt 2>&1; cat /tmp/claude-501/h-t2-green.txt
```
Expected: `ALTER TABLE`, `COMMENT`, `NOTIFY`. Na prova: seção 0 com `ALWAYS` e a expressão; seção 1 com `0` e `0`; seção 2 com 7h=420 … 19h30=1170; seção 3 com `dias_que_o_texto_errava` = **20** e `ordem_errada_DEVE_SER_0` = 0; seção 4 mostrando `{19h,7h,9h}` virando `{7h,9h,19h}`; seção 5 com `ESCRITA: recusada — CERTO`.

Conferir também que o servidor de consultas já enxerga a coluna (sem expor a conexão):
```bash
node -e 'const fs=require("fs");const e=Object.fromEntries(fs.readFileSync(".env","utf8").split("\n").filter(l=>l.includes("=")).map(l=>[l.slice(0,l.indexOf("=")),l.slice(l.indexOf("=")+1)]));fetch(e.SUPABASE_URL+"/rest/v1/acolitos_celebracoes?select=horario,minutos&limit=3&order=minutos",{headers:{apikey:e.SUPABASE_ANON_KEY,Authorization:"Bearer "+e.SUPABASE_ANON_KEY}}).then(r=>r.text()).then(t=>console.log(t.slice(0,200)))'
```
Expected: ou as linhas com `minutos`, ou uma recusa por permissão (`42501`) — **nunca** "não existe a coluna" (`PGRST204`/`PGRST205`).

- [ ] **Step 4: Commit** (os dois arquivos): `feat(acolitos): a missa guarda a hora em minutos, para ordenar direito`

---

### Task 3: As telas pedem e usam a ordem certa

**Files:**
- Modify: `projetos/acolitos/agenda.html`, `chamada.html`, `escala.html`, `escalas-membro.html`, `index.html`, `ausencias.html`
- Test: `projetos/acolitos/provas/telas.prova.mjs`

**Interfaces:** consome `minutos` (Task 2) e `compararHorario` (Task 1).

- [ ] **Step 1: A prova que falha** — em `telas.prova.mjs`, antes de `async function provaRecadoDaFotoAparece(provas) {`:

```js
async function provaAgendaOrdenaPelaHora(provas) {
  console.log('\n\x1b[1mAgenda: as missas do mesmo dia saem na ordem da HORA\x1b[0m');

  // O caso real: domingo com missas às 7h, 9h e 19h. Em ordem de texto sai 19h, 7h, 9h —
  // era assim em 20 dos 39 dias com mais de uma missa (medido em 17/09/2026).
  const dia = (n) => { const d = new Date(); d.setDate(d.getDate() + n);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const domingo = dia(2);
  const celebracoes = [
    { id: 'm19', data: domingo, horario: '19h', minutos: 1140, comunidade: 'matriz', tipo: 'missa_comum', observacoes: null },
    { id: 'm7', data: domingo, horario: '7h', minutos: 420, comunidade: 'matriz', tipo: 'missa_comum', observacoes: null },
    { id: 'm9', data: domingo, horario: '9h', minutos: 540, comunidade: 'santo_antonio', tipo: 'missa_comum', observacoes: null },
  ];
  const eventos = [{ id: 'ev', titulo: 'Ensaio geral', tipo: 'ensaio', data: domingo, hora: '08:00:00', hora_fim: null, local: null }];
  const r = await provas.abrir('agenda.html', {
    papel: PAPEIS.admin,
    tabelas: { acolitos_celebracoes: { data: celebracoes }, acolitos_eventos: { data: eventos }, acolitos_listas: { data: [] } },
    avaliar: `
      const esperar = (ms) => new Promise(f => setTimeout(f, ms));
      try { localStorage.removeItem('filtro-lista:agenda'); localStorage.removeItem('agenda-tl-filtro'); } catch (e) {}
      const horas = () => [...document.querySelectorAll('#main-content .ag-meta b')].map(e => e.textContent.trim());
      viewMode = 'linha'; await reload(); await esperar(80);
      const linha = horas();
      viewMode = 'cal'; selDate = '${domingo}'; render(); await esperar(80);
      const dia = horas();
      try { localStorage.removeItem('filtro-lista:agenda'); } catch (e) {}
      return { linha, dia, ajudante: typeof compararHorario };
    `,
  });
  const a = r.avaliado || {};
  exigir(!r.erroAvaliar, 'a Agenda desenha sem estourar', r.erroAvaliar);
  exigir(r.avaliado && typeof r.avaliado === 'object', 'a prova da Agenda chegou ao fim (a página não saiu do lugar)', 'avaliado: ' + JSON.stringify(r.avaliado));
  exigir(a.ajudante === 'function', 'a tela carrega a regra do horário');
  // 7h (420) < ensaio 08:00 (480) < 9h (540) < 19h (1140). A Agenda escreve a hora do evento
  // com horaFmt ('08:00:00' vira '08h00') e a da missa como está ('7h').
  exigir(JSON.stringify(a.linha) === JSON.stringify(['7h', '08h00', '9h', '19h']),
    'na linha do tempo, o dia sai em ordem de hora (o ensaio das 8h ENTRE 7h e 9h)', 'saiu: ' + JSON.stringify(a.linha));
  exigir(JSON.stringify(a.dia).indexOf('"7h","9h","19h"') >= 0 || /7h.*9h.*19h/.test(JSON.stringify(a.dia)),
    'no calendário, o painel do dia também sai em ordem de hora', 'saiu: ' + JSON.stringify(a.dia));
}
```

No rodapé, depois de `    await provaFaltasFiltramNaConsulta(provas);`: `    await provaAgendaOrdenaPelaHora(provas);`

> **Atenção do implementador:** a primeira exigência da ordem depende de como a Agenda escreve a hora do EVENTO (`horaFmt`) e da missa. RODE a prova antes de mexer no código e ajuste os valores esperados ao que a tela realmente escreve (sem mudar a ORDEM esperada: ensaio 8h entre 7h e 9h, e 19h por último). Registre no relatório o que a tela escreveu.

Run: `npm run provar-telas > /tmp/claude-501/h-t3-red.txt 2>&1; grep -a -A8 "ordem da HORA" /tmp/claude-501/h-t3-red.txt | head -10`
Expected: falha mostrando a ordem errada (19h antes de 7h).

- [ ] **Step 2: Pedir a ordem ao banco por `minutos`** (8 lugares; localizar por conteúdo)

| Arquivo | Trocar | Por |
|---|---|---|
| `ausencias.html` (2×) | `.select('id,data,horario,comunidade').gte('data', hoje).order('data').order('horario');` | `.select('id,data,horario,minutos,comunidade').gte('data', hoje).order('data').order('minutos');` |
| `escalas-membro.html` | a mesma linha acima | o mesmo acima |
| `agenda.html` | `.select('id,data,horario,comunidade,tipo,observacoes').gte('data', ini).lte('data', fim).order('horario'),` | `.select('id,data,horario,minutos,comunidade,tipo,observacoes').gte('data', ini).lte('data', fim).order('minutos'),` |
| `agenda.html` | `.select('id,data,horario,comunidade,tipo,observacoes').gte('data', hojeStr).order('data').order('horario'),` | `.select('id,data,horario,minutos,comunidade,tipo,observacoes').gte('data', hojeStr).order('data').order('minutos'),` |
| `chamada.html` | `.order('data').order('horario');` (depois de `.lte('data', limit…)`) | `.order('data').order('minutos');` |
| `escala.html` | `.order('data').order('horario');` | `.order('data').order('minutos');` |
| `index.html` | `.gte('data', hojeLocal()).order('data').order('horario').limit(limit);` | `.gte('data', hojeLocal()).order('data').order('minutos').limit(limit);` |

Conferir depois: `grep -rn "order('horario')" projetos/acolitos/*.html` não acha nada.

- [ ] **Step 3: Comparar por hora nas listas já carregadas** (7 lugares)

| Arquivo | Trocar | Por |
|---|---|---|
| `agenda.html` | `  out.sort((a,b) => String(a.hora).localeCompare(String(b.hora)));` | `  out.sort((a,b) => compararHorario(a.hora, b.hora));` |
| `agenda.html` | `  tlItens.sort((a, b) => a.date === b.date ? String(a.hora).localeCompare(String(b.hora)) : a.date.localeCompare(b.date));` | `  tlItens.sort((a, b) => a.date === b.date ? compararHorario(a.hora, b.hora) : a.date.localeCompare(b.date));` |
| `index.html` | `      .sort((a,b)=> (a.acolitos_celebracoes.data+a.acolitos_celebracoes.horario).localeCompare(b.acolitos_celebracoes.data+b.acolitos_celebracoes.horario))` | `      .sort((a,b)=> a.acolitos_celebracoes.data.localeCompare(b.acolitos_celebracoes.data) || compararHorario(a.acolitos_celebracoes.horario, b.acolitos_celebracoes.horario))` |
| `escalas-membro.html` | `    .sort((a,b)=> (a.acolitos_celebracoes.data+a.acolitos_celebracoes.horario).localeCompare(b.acolitos_celebracoes.data+b.acolitos_celebracoes.horario));` | `    .sort((a,b)=> a.acolitos_celebracoes.data.localeCompare(b.acolitos_celebracoes.data) || compararHorario(a.acolitos_celebracoes.horario, b.acolitos_celebracoes.horario));` |
| `escala.html` | `  const ordc = celebs.slice().sort((a,b) => (a.data+a.horario).localeCompare(b.data+b.horario));` | `  const ordc = celebs.slice().sort((a,b) => a.data.localeCompare(b.data) || compararHorario(a.horario, b.horario));` |
| `escala.html` (2×, linhas ~1207-1208 e ~1342-1343) | as duas linhas `const HOR_ORDEM=…;` e `const horRank=…;` | **apagar as duas**, e trocar os dois usos `horRank(a.horario)-horRank(b.horario)` por `compararHorario(a.horario, b.horario)` |

Na `escala.html`, o comentário acima da lista apagada (`// ordem fixa das missas: 17h, 18h30, 7h, 9h, 19h (por dia)…`) passa a ser:
```js
  // ordem das missas do dia pela HORA (a lista fixa que havia aqui jogava 16h e 19h30 para o
  // fim); lista de cada missa em ordem ALFABÉTICA por nome
```

Conferir depois: `grep -rn "HOR_ORDEM\|horRank" projetos/acolitos/` não acha nada.

- [ ] **Step 4: Rodar tudo**

```bash
for f in agenda chamada escala escalas-membro index ausencias; do node -e "
const s=require('fs').readFileSync('projetos/acolitos/$f.html','utf8');
const m=[...s.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(x=>x[1]).join('\n;\n');
require('fs').writeFileSync('/tmp/claude-501/$f.js', m);" && node --check /tmp/claude-501/$f.js && echo "$f OK"; done
npm run provar-regras 2>&1 | grep -E "^ℹ (tests|fail)"
npm run provar-telas > /tmp/claude-501/h-t3-green.txt 2>&1; tail -3 /tmp/claude-501/h-t3-green.txt
```
Expected: os 6 arquivos `OK`; regras **265**; provas de tela **331** (326 + 5), duas vezes. A prova de fumaça (que abre a `escala.html` em todos os papéis e exige zero erro de JavaScript) tem de continuar verde — é a única cobertura automática dessa tela.

- [ ] **Step 5: Olhar a tela** — fotografar (script descartável FORA do repo, 390×844) a Agenda na linha do tempo com o domingo de mentira (7h, 9h, 19h) e o painel do dia no calendário, e conferir a ordem na imagem.

- [ ] **Step 6: Commit** (os 6 .html + `telas.prova.mjs`): `fix(acolitos): as missas do mesmo dia saem na ordem da hora`

---

### Task 4: Registrar e publicar (controlador, com ok do dono)

- `docs/pendencias.md`: tirar o item "o app inteiro ordena HORÁRIO como texto"; registrar o que sobrou (se sobrou).
- `docs/pendencias-fechados.md`: bloco do conserto, com os números (20 de 39 dias, todo domingo) e o porquê da coluna calculada.
- Juntar na `main`, rodar tudo com a saída em arquivo, carimbar o `sw.js`, **perguntar ao dono**, enviar com `git push` comum, conferir no ar (`BUILD`, `horario-core.js` publicado, `order('minutos')` presente na Agenda).
