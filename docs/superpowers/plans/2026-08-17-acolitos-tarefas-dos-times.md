# Tarefas dos times — Plano de Implementação

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA: use `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans`, tarefa por tarefa. Os passos usam caixinha (`- [ ]`).

**Objetivo:** Uma aba **Tarefas** no módulo de coordenação, onde cada um dos 11 times tem suas responsabilidades fixas e sua lista de tarefas, com prazo, conclusão e recorrência.

**Arquitetura:** Uma tabela nova (`acolitos_tarefas`) com RLS por papel, no padrão das irmãs. A regra da recorrência — dado uma tarefa concluída, qual é a próxima — vira módulo puro testado em node (`tarefas-core.js`), sem DOM e sem rede. A tela (`tarefas.html`) agrupa por time, com atrasadas no topo. As responsabilidades fixas de cada time ficam na configuração, não na tabela de tarefas.

**Tecnologias:** HTML/JS sem framework, Supabase (PostgREST + RLS), testes com `node --test`, deploy pela Vercel a cada push na `main`.

**Spec:** `docs/superpowers/specs/2026-08-17-acolitos-tarefas-dos-times-design.md`

## Restrições globais

- **Português claro, sem jargão**, em rótulos e comentários. Comentário explica o *porquê*.
- **Nada de emoji como ícone.** Ícone é SVG por `_svgIcon(nome)` do shared.js.
- **Módulo `-core.js` expõe a FUNÇÃO pelo nome no navegador** (`global.proximaTarefa = proximaTarefa`), como `navegacao-core.js`. Expor só um objeto deixa a tela em branco com todos os testes verdes — aconteceu em 17/08.
- **Rodar os testes com `node --test projetos/acolitos/*.test.js`** — passando os arquivos, e **não** o filtro `*-core.test.js`, que deixa `gerador-substituto.test.js` de fora (a sessão de 17/08 mediu 45 quando eram 46).
- **Verificar a tela EXECUTANDO o `init()`** com sessão simulada, nunca só carregando: sem sessão o `init()` sai em `if (!ctx) return;` antes de tocar em qualquer código. Foi assim que 6 defeitos críticos passaram por três verificações no mesmo dia. O harness está em `<scratchpad>/exec-tela.mjs`.
- **`sb` é `const`** no shared.js: para simular, trocar os MÉTODOS (`sb.from = ...`), nunca a variável.
- **Nunca `git add <pasta>`** — arquivo por arquivo.
- **Carimbar `BUILD` em `sw.js`** a cada publicação.
- **Conferir o deploy pela ponta**: baixar o arquivo do ar e comparar com o local.
- **NÃO mexer em `navMode` nem em `eh_equipe`.** O spec registra que a aba nasce visível para 4 pessoas e que isso precisará ser revisto quando os times forem preenchidos — mas é **outra frente**. Quem executar este plano não resolve isso de passagem.
- **A permissão `tarefas` é portão de TELA, não de banco.** A RLS trava por papel, como todas as irmãs `acolitos_*`. Quem é da equipe e chegar por outro caminho lê a tabela — é o desenho que já existe no app, não um defeito deste plano.
- **A migration NÃO pode ser aplicada nesta sessão** (MCP em outra conta, Docker parado, senha do banco velha). Ela é escrita, conferida contra as tabelas irmãs e commitada — quem aplica é o dono, pelo painel. **A branch não pode ser publicada antes disso**, senão a aba Tarefas nasce mostrando erro.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade | Fase |
|---|---|---|
| `docs/migrations/048_tarefas.sql` | **nova** — tabela + RLS + permissão | 1 |
| `projetos/acolitos/tarefas-core.js` | **novo** — regra pura da recorrência | 1 |
| `projetos/acolitos/tarefas-core.test.js` | **novo** — um caso por frequência + bordas | 1 |
| `projetos/acolitos/tarefas.html` | **nova** — a tela | 2 |
| `projetos/acolitos/shared.js` | registra o módulo `tarefas` na barra, na lista de liberáveis e o ícone novo | 2 |
| `projetos/acolitos/config.html:544` | responsabilidade de cada time, junto da lista de setores que já existe | 3 |

---

# FASE 1 — a tabela e a regra

### Tarefa 1: a regra da recorrência, testada

**Arquivos:**
- Criar: `projetos/acolitos/tarefas-core.js`
- Teste: `projetos/acolitos/tarefas-core.test.js`

**Interfaces:**
- Consome: nada.
- Produz: `proximaTarefa({ recorrencia, prazo, hoje, proximaCelebracao })` → `{ prazo }` ou `null`.
  - `recorrencia`: `'nenhuma' | 'semanal' | 'mensal' | 'anual' | 'celebracao'`
  - `prazo`: `'AAAA-MM-DD'` ou `null` — o prazo da tarefa que acabou de ser concluída
  - `hoje`: `'AAAA-MM-DD'` — base quando a concluída não tinha prazo
  - `proximaCelebracao`: `'AAAA-MM-DD'` ou `null`
  - devolve `null` quando não há próxima; devolve `{prazo: null}` quando há próxima mas sem data

- [ ] **Passo 1: escrever o teste que falha**

```js
// projetos/acolitos/tarefas-core.test.js
// Regra: ao CONCLUIR uma tarefa recorrente, qual é a próxima.
// Rodar: node --test projetos/acolitos/tarefas-core.test.js
const test = require('node:test');
const assert = require('node:assert');
const { proximaTarefa } = require('./tarefas-core.js');

test('tarefa sem recorrência não gera próxima', () => {
  assert.strictEqual(proximaTarefa({ recorrencia:'nenhuma', prazo:'2026-08-23', hoje:'2026-08-17' }), null);
});
```

- [ ] **Passo 2: rodar e ver falhar**

Rodar: `node --test projetos/acolitos/tarefas-core.test.js`
Esperado: FALHA com `TypeError: proximaTarefa is not a function`

- [ ] **Passo 3: implementar o mínimo**

```js
// projetos/acolitos/tarefas-core.js
// Quando uma tarefa recorrente é concluída, qual é a próxima. PURO (sem DOM, sem rede),
// no padrão de navegacao-core.js, alertas-core.js, kits-core.js e acesso-core.js.
//
// A recorrência dispara na CONCLUSÃO, nunca pelo relógio. Marcou feita, nasce a próxima;
// se ninguém concluir, nenhuma nova nasce e fica uma só, atrasada, cobrando. Foi decisão
// do dono: as alternativas (acumular, ou vencer a anterior) foram descartadas, e essa
// escolha elimina a necessidade de um robô e a pergunta do que fazer com a não concluída.
(function (global) {
  'use strict';

  function proximaTarefa(o) {
    o = o || {};
    if (o.recorrencia !== 'semanal' && o.recorrencia !== 'mensal'
        && o.recorrencia !== 'anual' && o.recorrencia !== 'celebracao') return null;
    return { prazo: null };
  }

  var api = { proximaTarefa: proximaTarefa };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { global.proximaTarefa = proximaTarefa; }   // pelo NOME: senão a tela fica em branco
})(typeof globalThis !== 'undefined' ? globalThis : this);
```

- [ ] **Passo 4: rodar e ver passar**

Rodar: `node --test projetos/acolitos/tarefas-core.test.js`
Esperado: `pass 1 | fail 0`

- [ ] **Passo 5: escrever os testes das quatro frequências e das bordas**

```js
test('semanal soma 7 dias ao prazo da concluída', () => {
  assert.deepStrictEqual(proximaTarefa({ recorrencia:'semanal', prazo:'2026-08-23', hoje:'2026-08-17' }), { prazo:'2026-08-30' });
});

test('mensal cai no mesmo dia do mês seguinte', () => {
  assert.deepStrictEqual(proximaTarefa({ recorrencia:'mensal', prazo:'2026-08-23', hoje:'2026-08-17' }), { prazo:'2026-09-23' });
});

test('mensal em dia que não existe no mês seguinte cai no último dia dele', () => {
  // 31/01 + 1 mês não é 31/02. Sem esta regra o JS empurra para 03/03, que ninguém espera.
  assert.deepStrictEqual(proximaTarefa({ recorrencia:'mensal', prazo:'2026-01-31', hoje:'2026-01-01' }), { prazo:'2026-02-28' });
});

test('anual soma um ano', () => {
  assert.deepStrictEqual(proximaTarefa({ recorrencia:'anual', prazo:'2026-08-23', hoje:'2026-08-17' }), { prazo:'2027-08-23' });
});

test('sem prazo na concluída, conta a partir de hoje', () => {
  assert.deepStrictEqual(proximaTarefa({ recorrencia:'semanal', prazo:null, hoje:'2026-08-17' }), { prazo:'2026-08-24' });
});

test('a cada celebração usa a próxima celebração da agenda', () => {
  assert.deepStrictEqual(proximaTarefa({ recorrencia:'celebracao', prazo:'2026-08-16', hoje:'2026-08-17', proximaCelebracao:'2026-08-22' }), { prazo:'2026-08-22' });
});

test('a cada celebração SEM celebração futura nasce sem prazo, não com data inventada', () => {
  assert.deepStrictEqual(proximaTarefa({ recorrencia:'celebracao', prazo:'2026-08-16', hoje:'2026-08-17', proximaCelebracao:null }), { prazo:null });
});

test('recorrência desconhecida não gera próxima', () => {
  assert.strictEqual(proximaTarefa({ recorrencia:'quinzenal', prazo:'2026-08-23', hoje:'2026-08-17' }), null);
});
```

- [ ] **Passo 6: rodar e ver os novos falharem**

Rodar: `node --test projetos/acolitos/tarefas-core.test.js`
Esperado: o primeiro passa; os oito novos falham (todos devolvem `{prazo:null}`).

- [ ] **Passo 7: completar a regra**

```js
  // Datas em texto 'AAAA-MM-DD', sem fuso: o app inteiro já trata data assim, e usar
  // Date com hora aqui traria o bug de virar o dia dependendo do fuso do aparelho.
  function partes(d) { var p = String(d).split('-'); return { a:+p[0], m:+p[1], d:+p[2] }; }
  function texto(a, m, d) {
    return a + '-' + String(m).padStart(2,'0') + '-' + String(d).padStart(2,'0');
  }
  function ultimoDia(a, m) { return new Date(Date.UTC(a, m, 0)).getUTCDate(); }

  function somarMeses(data, n) {
    var p = partes(data);
    var total = p.a * 12 + (p.m - 1) + n;
    var a = Math.floor(total / 12), m = (total % 12) + 1;
    // 31/01 + 1 mês não é 31/02: cai no último dia de fevereiro. Sem isto o JS
    // empurraria para março, que é o tipo de surpresa que ninguém confere.
    return texto(a, m, Math.min(p.d, ultimoDia(a, m)));
  }
  function somarDias(data, n) {
    var p = partes(data);
    var t = new Date(Date.UTC(p.a, p.m - 1, p.d + n));
    return texto(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
  }

  function proximaTarefa(o) {
    o = o || {};
    var base = o.prazo || o.hoje;
    switch (o.recorrencia) {
      case 'semanal':    return { prazo: somarDias(base, 7) };
      case 'mensal':     return { prazo: somarMeses(base, 1) };
      case 'anual':      return { prazo: somarMeses(base, 12) };
      // Sem celebração futura cadastrada, a próxima nasce SEM prazo. Inventar uma data
      // seria pior: cobraria a pessoa por um dia que ninguém marcou.
      case 'celebracao': return { prazo: o.proximaCelebracao || null };
      default:           return null;
    }
  }
```

- [ ] **Passo 8: rodar tudo e ver verde**

Rodar: `node --test projetos/acolitos/tarefas-core.test.js`
Esperado: `pass 9 | fail 0`

- [ ] **Passo 9: commitar**

```bash
git add projetos/acolitos/tarefas-core.js projetos/acolitos/tarefas-core.test.js
git commit -m "feat(tarefas): regra da recorrência em módulo testável

Dispara na CONCLUSÃO, nunca pelo relógio: marcou feita, nasce a próxima. Se ninguém
concluir, nenhuma nova nasce — decisão do dono, que descartou acumular e vencer a
anterior. Isso elimina o robô e a pergunta do que fazer com a não concluída.

Duas bordas que erram sozinhas e por isso têm teste: 31/01 + 1 mês cai em 28/02 e não
em 03/03; e 'a cada celebração' sem celebração futura nasce SEM prazo, em vez de com
uma data inventada que cobraria a pessoa por um dia que ninguém marcou."
```

---

### Tarefa 2: a tabela e a RLS

**Arquivos:**
- Criar: `docs/migrations/048_tarefas.sql`

**Interfaces:**
- Consome: o helper `public.acolitos_get_role(uuid)`, já usado pelas tabelas irmãs.
- Produz: a tabela `acolitos_tarefas`, consumida pela Fase 2.

- [ ] **Passo 1: ler DUAS irmãs antes de escrever**

Ler `docs/migrations/046_arte_escala.sql` inteiro e mais uma tabela `acolitos_*` recente. Anotar: como declaram RLS, que papéis usam, se dão `grant` explícito e se criam índice. **A tabela nova tem que parecer irmã das que já existem**, não uma invenção.

- [ ] **Passo 2: escrever a migration**

```sql
-- Acólitos — Tarefas dos times
-- Cada tarefa pertence a um TIME (obrigatório) e opcionalmente a um responsável.
-- O time é o mesmo 'setor' que já existe em acolitos_listas (tipo='setor') e no campo
-- setores de acolitos_membros — não se cria catálogo novo.
create table if not exists public.acolitos_tarefas (
  id            uuid primary key default gen_random_uuid(),
  titulo        text not null,
  time_slug     text not null,                      -- valor de acolitos_listas tipo='setor'
  responsavel_id uuid references public.acolitos_membros(id) on delete set null,
  prazo         date,
  observacao    text,
  recorrencia   text not null default 'nenhuma'
                check (recorrencia in ('nenhuma','semanal','mensal','anual','celebracao')),
  concluida_em  timestamptz,
  concluida_por uuid references public.acolitos_membros(id) on delete set null,
  criada_em     timestamptz not null default now(),
  criada_por    uuid
);

-- A tela abre agrupando por time e destacando atrasadas: os dois filtros da lista.
create index if not exists acolitos_tarefas_time_idx  on public.acolitos_tarefas (time_slug);
create index if not exists acolitos_tarefas_prazo_idx on public.acolitos_tarefas (prazo)
  where concluida_em is null;

alter table public.acolitos_tarefas enable row level security;

-- Quem lê e escreve é a coordenação com a permissão do módulo. Mesmo desenho das irmãs:
-- o helper acolitos_get_role, e não um join inline.
do $$ begin
  if not exists (select 1 from pg_policies
    where tablename='acolitos_tarefas' and policyname='Tarefas leitura coordenacao') then
    create policy "Tarefas leitura coordenacao" on public.acolitos_tarefas
      for select to authenticated
      using (public.acolitos_get_role(auth.uid()) in ('coord_admin','subadmin','membro_equipe'));
  end if;
  if not exists (select 1 from pg_policies
    where tablename='acolitos_tarefas' and policyname='Tarefas escrita coordenacao') then
    create policy "Tarefas escrita coordenacao" on public.acolitos_tarefas
      for all to authenticated
      using      (public.acolitos_get_role(auth.uid()) in ('coord_admin','subadmin','membro_equipe'))
      with check (public.acolitos_get_role(auth.uid()) in ('coord_admin','subadmin','membro_equipe'));
  end if;
end $$;
```

- [ ] **Passo 3: conferir contra as irmãs ANTES de aplicar**

Comparar, item a item, com `046_arte_escala.sql`: os papéis são os mesmos? falta algum `grant`? o `enable row level security` está lá? há política de escrita separada da de leitura?
**Uma tabela nova que não parece com as irmãs é o defeito mais provável desta tarefa** — já subiu tabela sem a trava por conta neste projeto, e nove revisões passaram sem ver.

- [ ] **Passo 4: NÃO aplicar — deixar pronto para o dono aplicar**

**Não tente aplicar.** Já foi conferido nesta sessão que os três caminhos estão fechados: o MCP do Supabase está logado em outra conta, o `supabase db dump` exige Docker (parado), e a senha do banco no `.env` está velha (`password authentication failed`). Não procure um quarto caminho e não mexa no `.env`.

O que você faz no lugar: conferir que o arquivo `048_tarefas.sql` está inteiro e colável de uma vez no editor de SQL do painel do Supabase — sem `\i`, sem depender de outro arquivo, e idempotente (os `if not exists` já estão lá, então rodar duas vezes não quebra).

- [ ] **Passo 5: registrar que a prova da trava ficou PENDENTE**

A prova de fogo — com a chave anônima, tentar `select` e `insert` e ver as duas recusadas — **só pode ser feita depois de a tabela existir**. Anote isso no seu relatório, com todas as letras: a RLS foi conferida por leitura contra `003_acolitos_fase2.sql` e `046_arte_escala.sql`, e **não** foi provada rodando.
Não escreva no relatório que a trava funciona. Ela ainda não foi testada.

- [ ] **Passo 6: commitar**

```bash
git add docs/migrations/048_tarefas.sql
git commit -m "feat(tarefas): tabela e RLS, no padrão das irmãs

Time obrigatório (o mesmo 'setor' que já existe), responsável opcional, prazo,
observação, recorrência com check, e quem concluiu e quando. Índice por time e por
prazo das não concluídas — os dois filtros da tela.

Conferida contra 046_arte_escala.sql antes de aplicar: mesmos papéis, mesmo helper
acolitos_get_role, leitura e escrita separadas. Trava provada com a chave anônima."
```

---

# FASE 2 — a tela

### Tarefa 3: `tarefas.html`

**Arquivos:**
- Criar: `projetos/acolitos/tarefas.html`
- Modificar: `projetos/acolitos/shared.js` (mapa de módulos ~1502, `ORDEM_MODULOS` 1513, `MODULOS_LIBERAVEIS` ~1487)

**Interfaces:**
- Consome: `proximaTarefa` (Tarefa 1), a tabela (Tarefa 2), `initModulo`, `renderHeader`, `renderBottomNav`, `navCaps`, `_svgIcon`, `uiConfirm`, `toast`.

- [ ] **Passo 1: registrar o módulo em QUATRO lugares do `shared.js`**

São quatro, e esquecer um não quebra nada visivelmente — só some um pedaço:

1. `NAV_COORD_MODULOS` (linha ~1500): `tarefas: { label:'Tarefas', href:'tarefas.html', icon:'tarefas' },`
2. `ORDEM_MODULOS` (linha 1513): acrescentar `'tarefas'` **no fim** — a ordem é a da barra, e mexer nas outras posições muda a barra de todo mundo.
3. `MODULOS_LIBERAVEIS` (linha 1487): `['tarefas','Tarefas dos times','tarefas.html'],` — sem isto o admin não consegue liberar a tela pra ninguém.
4. `TELA_LABEL` (linha ~1517): `'tarefas.html':'Tarefas',` — sem isto o chip "Continuar" da Home mostra o nome do arquivo.

**Id novo pode entrar; id existente nunca se renomeia** — é contrato com `acolitos_config.nav_ordem_coord`.

- [ ] **Passo 2: criar o ícone `tarefas` no `_svgIcon`**

`_svgIcon` termina com `d[name] || ''`: **nome que não existe devolve um SVG de caminho vazio** — o botão aparece com um quadrado em branco, sem erro nenhum no console. Por isso o ícone é passo próprio, e não pode reaproveitar `star` (já é da Jornada).

Em `shared.js`, dentro do objeto `d` de `_svgIcon`, no padrão dos vizinhos (traço de 24×24, sem preenchimento):

```js
    // ícone de Tarefas: prancheta com um "visto" — a lista de afazeres de cada time
    tarefas:        'M9 2h6a1 1 0 0 1 1 1v2H8V3a1 1 0 0 1 1-1z M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2 M9 14l2 2 4-4',
```

- [ ] **Passo 3: acrescentar o destino ao teste do mapa real**

Em `navegacao-core.test.js`, no teste que confere o mapa REAL do `shared.js`, acrescentar `tarefas: 'tarefas.html'` ao objeto `DESTINOS_ESPERADOS`.

- [ ] **Passo 4: a moldura da tela**

Copiar o `<head>` e o `<body>` de `caixa.html` (a tela mais nova e mais enxuta), trocando os títulos. Carregar `tarefas-core.js` junto dos outros `-core.js`.

- [ ] **Passo 5: o estado vazio, primeiro**

```js
// Nenhum time tem tarefa hoje: a tela sem tarefa nenhuma é a que a coordenação vai ver
// primeiro, então é a que precisa estar mais certa.
function renderNadaAqui(main) {
  const box = document.createElement('div');
  box.style.cssText = 'text-align:center;padding:42px 16px;color:var(--text-muted);';
  const t = document.createElement('div');
  t.style.cssText = 'font-family:Sora,sans-serif;font-weight:700;font-size:16px;color:var(--text);';
  t.textContent = 'Nenhuma tarefa por aqui';
  const s = document.createElement('div');
  s.style.cssText = 'font-size:13px;margin-top:4px;';
  s.textContent = 'Crie a primeira e ela aparece no time escolhido.';
  box.append(t, s); main.appendChild(box);
}
```

- [ ] **Passo 6: a lista, agrupada por time e com atrasadas no topo**

Buscar as tarefas **lendo o `error`**:

```js
const { data, error } = await sb.from('acolitos_tarefas')
  .select('*, responsavel:acolitos_membros!responsavel_id(nome,apelido)')
  .is('concluida_em', null).order('prazo', { nullsFirst:false });
if (error) {
  // Falha de consulta NÃO pode virar "nenhuma tarefa": seria dizer que está tudo em dia
  // quando na verdade não se conseguiu perguntar. Já aconteceu duas vezes neste projeto.
  console.error('Tarefas: consulta falhou', error);
  const e = document.createElement('span'); e.className = 'empty';
  e.textContent = 'Não foi possível carregar as tarefas. Tente de novo.';
  main.appendChild(e); return;
}
```

Depois: separar as com `prazo < hoje` num bloco **"Atrasadas"** no topo, **fora do agrupamento** — é o que transforma a lista em acompanhamento em vez de anotação. Agrupar o resto por `time_slug`, usando os rótulos de `acolitos_listas` tipo `setor`.

Cada linha: título · prazo (`vence sáb 23/08`, ou `sem prazo`) · responsável — e **`do time`** quando não há responsável, nunca em branco: em branco a pessoa não sabe se é dela ou se ninguém pegou.

- [ ] **Passo 7: criar e concluir**

Criar: modal com título, time (obrigatório), responsável (opcional), prazo, observação e recorrência.
Concluir: ao marcar, gravar `concluida_em`/`concluida_por` e — se houver recorrência — criar a próxima com o prazo que `proximaTarefa` devolver, buscando a próxima celebração em `acolitos_celebracoes` (coluna `data`, `gte` hoje, `order('data')`, `limit(1)`) quando a recorrência for `celebracao`.
**Ler o `error` das duas gravações.** Sem isso, a tarefa some da tela e continua aberta no banco.

- [ ] **Passo 8: provar EXECUTANDO**

Com o harness `<scratchpad>/exec-tela.mjs`: rodar o `init()` com sessão simulada para admin e para equipe sem a permissão, e conferir três cenários — sem tarefa (mostra "Nenhuma tarefa por aqui"), com tarefas (agrupadas, atrasadas no topo), e consulta falhando (mostra o erro, **não** o estado vazio).

- [ ] **Passo 9: rodar todos os testes, carimbar e commitar**

```bash
node --test projetos/acolitos/*.test.js     # o total NÃO pode diminuir
perl -pi -e "s/const BUILD = '[0-9]*'/const BUILD = '$(date +%Y%m%d%H%M%S)'/" projetos/acolitos/sw.js
git add projetos/acolitos/tarefas.html projetos/acolitos/shared.js projetos/acolitos/navegacao-core.test.js projetos/acolitos/sw.js
git commit -m "feat(tarefas): a tela, agrupada por time e com atrasadas no topo"
```

---

# FASE 3 — as responsabilidades fixas

### Tarefa 4: o que cada time É

**Arquivos:**
- Modificar: `projetos/acolitos/config.html` (uma seção nova), `projetos/acolitos/tarefas.html` (mostrar no topo do grupo)

- [ ] **Passo 1: guardar na configuração, não na tabela de tarefas**

Uma chave `responsabilidades` em `acolitos_config`, no formato `{ "<time_slug>": "texto" }`. Motivo: é texto de referência da pastoral, muda raramente, e não é tarefa — misturar na tabela de tarefas obrigaria a filtrar em toda consulta.

- [ ] **Passo 2: a edição no Config, junto do que já existe**

`config.html:544` já tem o CRUD dos setores (`renderSetorLista`, lendo `acolitos_listas` tipo `setor`). A responsabilidade entra **como campo de texto na linha de cada setor ali**, não numa seção nova: é a mesma lista, e duas telas para a mesma coisa é como a Caixa ficou confusa.
Os times vêm sempre dessa consulta — **nunca uma lista escrita no código**, que foi o que impediu usar o kit processional em outra paróquia.

- [ ] **Passo 3: mostrar na tela de Tarefas**

No topo de cada grupo, abaixo do nome do time. Time sem texto não mostra nada — não inventar frase de exemplo.

- [ ] **Passo 4: provar executando, carimbar e commitar**

Rodar o `init()` das duas telas com sessão simulada, conferir que um time sem responsabilidade escrita não mostra bloco vazio, rodar todos os testes, carimbar o `sw.js` e commitar.
