# Auto-troca por ausência — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Quando uma ausência cai em cima de alguém já escalado, remover a pessoa e encaixar automaticamente um substituto válido, usando um motor de escolha JS único compartilhado entre a Escala e a tela de Ausências.

**Architecture:** Um módulo JS puro (`gerador-substituto.js`, exposto em `window` + `module.exports` p/ testar em node) implementa `escolherSubstituto(ctx)` com as regras completas do gerador. `escala.html` e `ausencias.html` montam o `ctx` (queries) e chamam o módulo; a gravação da troca (`acolitos_escalas`) e o modal-resumo com Desfazer são compartilhados. Sem RPC SQL nova para a escolha (single-source-of-truth em JS).

**Tech Stack:** HTML/CSS/JS puro (páginas standalone, sem bundler); Supabase JS (vendor local); o motor é um `<script>` clássico. Testes do motor: `node` sobre fixtures (função pura, determinística com `rnd` injetável). Integração: verificação no navegador (Playwright) + banco ao vivo.

## Global Constraints

- **Deriva de schema:** o histórico de migrations do repo está desatualizado vs. produção. TODA suposição de banco (retorno do `acolitos_roster_substituicao()`, colunas de `acolitos_membros`/`acolitos_disponibilidade`/`acolitos_escalas`, RLS de escrita em `acolitos_escalas`, leitura de `acolitos_disponibilidade`) deve ser CONFIRMADA no schema AO VIVO (Task 1) antes de codar a integração. Fazer via MCP Supabase **na conta erickjcbp** (project ref `fttjgsotuosjfrasttds`). Hoje o MCP está na conta **erickia** — não trocar p/ não derrubar a outra janela; a integração só é testável quando o MCP estiver livre/na conta certa.
- Páginas **standalone**: sem shared.js novo, CSS/JS inline, **zero** CDN externo. O motor é `<script src="gerador-substituto.js">` (global `window.GeradorSubstituto`), sem ES modules/bundler.
- **Regras completas** do substituto (idênticas nas duas telas): elegibilidade (habilitação apto/experiente/referencia OU kit Santo Antônio) → filtro duro (disponível + não-ausente + sem repetir na missa) → camadas de comunidade (mesma → cruza se `pode_outras_comunidades` → qualquer) → cerimoniário (nível int ≥ 6) reservado pras MAIORES → rodízio por carga (menor primeiro, empate aleatório).
- **MAIORES** default: `cred_altar, cred_credencia, missal, turibulo, naveta, mitra, baculo` (override via `acolitos_config` chave `funcoes_maiores`).
- **Nível→int**: `aspirante=0, coroinha=1, acolito_aspirante=2, acolito_guardiao=3, acolito_sentinela=4, aspirante_cerimoniario=5, cerimoniario_aspirante=6, cerimoniario_guardiao=7, cerimoniario_magistral=8, cerimoniario_mor=9` (espelho de `shared.js` NIVEIS).
- **Gravação**: ausente → `acolitos_escalas.status='substituido'` + `substituto_id=<novoId|null>`; substituto → nova linha `status='escalado'`. **Desfazer** = apaga a linha do substituto, mantém o ausente `substituido` (vaga vazia), não mexe na ausência, não re-troca sozinho.
- **Não** arrasta irmãos (co-escala) — é geração em massa, fora de escopo.
- Testes NUNCA com dados reais (usar linha/celebração descartável; nunca membros reais).
- **Só local**: sem push/deploy; migration (se precisar) não aplicada até o dono pedir.

---

## Task 1: Verificação do schema ao vivo (gate da integração)

**Precisa do MCP Supabase na conta erickjcbp (ref `fttjgsotuosjfrasttds`). Se o MCP estiver na conta erickia (outra janela), PARE e reporte BLOCKED — não troque a auth do MCP.**

Objetivo: confirmar os fatos de banco que a integração (Tasks 3–5) assume, já que as migrations do repo estão desatualizadas. Não altera nada (só leitura).

**Files:**
- Create: `.superpowers/sdd/task-1-schema-findings.md` (documento de achados; scratch, não versionado)

**Interfaces:**
- Produces: documento com o retorno real de `acolitos_roster_substituicao()`, colunas relevantes, e as RLS — consumido por Tasks 3–5.

- [ ] **Step 1: Confirmar disponibilidade do MCP na conta certa**

Via MCP: `list_projects`. Se aparecer o projeto ref `fttjgsotuosjfrasttds` (erickjcbp), seguir. Se aparecer só `erickia`/outra conta, reportar **BLOCKED**: "MCP na conta errada; Task 1 aguarda MCP em erickjcbp".

- [ ] **Step 2: Definição do roster e colunas (só leitura)**

Rodar (via `execute_sql`, project_id `fttjgsotuosjfrasttds`):

```sql
-- 1) corpo da RPC de roster
select pg_get_functiondef(p.oid) as def
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname='acolitos_roster_substituicao';

-- 2) colunas das tabelas usadas
select table_name, column_name, data_type
from information_schema.columns
where table_schema='public'
  and table_name in ('acolitos_membros','acolitos_disponibilidade','acolitos_escalas','acolitos_celebracoes')
order by table_name, ordinal_position;

-- 3) constraints/uniques de acolitos_escalas
select conname, pg_get_constraintdef(oid)
from pg_constraint where conrelid='public.acolitos_escalas'::regclass;

-- 4) policies (RLS) de escrita em escalas e leitura de disponibilidade
select tablename, policyname, cmd, qual, with_check
from pg_policies
where schemaname='public' and tablename in ('acolitos_escalas','acolitos_disponibilidade');
```

- [ ] **Step 3: Registrar achados e decidir sobre a RPC**

No documento, responder explicitamente:
1. `acolitos_roster_substituicao()` retorna `data_nascimento` nos membros? (se NÃO → Task 1b: estender a RPC.) Retorna `comunidade`, `pode_outras_comunidades`, `nivel`, `apelido`? (esperado que sim.)
2. `acolitos_disponibilidade` tem colunas `membro_id, dia, horario`? Coordenação (role coord_admin/subadmin/membro_equipe/cerimonario) tem SELECT?
3. `acolitos_escalas`: existe UNIQUE em `(celebracao_id,funcao)` ou `(membro_id,celebracao_id)`? A policy de INSERT/UPDATE cobre a coordenação (mesma que a `escala.html` usa)?
4. Os valores de `status` incluem `escalado`/`substituido` e a policy de UPDATE permite gravar `substituido` + `substituto_id`.

Se (1) faltar `data_nascimento`: criar **Task 1b** — migration que estende `acolitos_roster_substituicao()` para incluir `data_nascimento` no JSON de membros (apenas adicionar o campo; não mudar assinatura). Documentar e NÃO aplicar sem o dono pedir.

- [ ] **Step 4: Commit do documento não é necessário** (scratch). Reportar os achados no report da task.

> Se BLOCKED por MCP: as Tasks 2 (motor) pode prosseguir sem isso; Tasks 3–5 ficam pausadas até Task 1 rodar.

---

## Task 2: Motor `gerador-substituto.js` (função pura + testes node)

Independente do banco — 100% testável offline com fixtures.

**Files:**
- Create: `projetos/acolitos/gerador-substituto.js`
- Test: `projetos/acolitos/gerador-substituto.test.js` (node, sem framework)

**Interfaces:**
- Produces: global `window.GeradorSubstituto` com `escolherSubstituto(ctx)`, `elegivelFuncao(m,f,comKey,habMap,config)`, `nivelInt(slug)`, `calcIdade(dn)`. `ctx` = `{funcao, comunidade, horKey, membroAusenteId, roster[], habMap{}, dispMap{}, cargaMap{}, usadosNaMissa:Set, usadoFds:Set, config{gerador,funcoes_maiores}, rnd?}`. Retorno: `{membroId:<id>|null, motivo:'sem_candidato'|null}`.

- [ ] **Step 1: Escrever os testes que falham** (`projetos/acolitos/gerador-substituto.test.js`)

```js
// Testes do motor de substituição. Rodar: node projetos/acolitos/gerador-substituto.test.js
const { escolherSubstituto, elegivelFuncao, nivelInt } = require('./gerador-substituto.js');
let falhas = 0;
function eq(nome, got, exp){
  const ok = JSON.stringify(got)===JSON.stringify(exp);
  console.log((ok?'PASS':'FAIL')+' — '+nome+(ok?'':'  got='+JSON.stringify(got)+' exp='+JSON.stringify(exp)));
  if(!ok) falhas++;
}
const rnd0 = ()=>0; // determinístico: empate escolhe o 1º após sort estável

// roster base
const M = (id, over={}) => Object.assign({id, nome:id, apelido:id, nivel:'coroinha', comunidade:'matriz', pode_outras_comunidades:true, data_nascimento:null}, over);
const hab = (fn, prof='apto') => ({[fn]:prof});

// 1) elegibilidade por habilitação
eq('elegível se apto na função',
  elegivelFuncao(M('a'), 'altar', 'matriz', {a:hab('altar')}, {}), true);
eq('não elegível se só em_formacao',
  elegivelFuncao(M('a'), 'altar', 'matriz', {a:{altar:'em_formacao'}}, {}), false);

// 2) kit Santo Antônio: cruz liberado p/ coroinha 7+ (sem data_nascimento → nível coroinha basta)
eq('kit sto antonio: coroinha sem hab pode cruz em santo_antonio',
  elegivelFuncao(M('a',{nivel:'coroinha'}), 'cruz', 'santo_antonio', {}, {}), true);
eq('kit não vale na matriz',
  elegivelFuncao(M('a',{nivel:'coroinha'}), 'cruz', 'matriz', {}, {}), false);
eq('kit não vale p/ aspirante (int 0)',
  elegivelFuncao(M('a',{nivel:'aspirante'}), 'cruz', 'santo_antonio', {}, {}), false);

// 3) escolha básica: rodízio pega menor carga
const roster3 = [M('x'), M('y'), M('z')];
eq('rodízio: menor carga primeiro',
  escolherSubstituto({ funcao:'altar', comunidade:'matriz', horKey:'dom_08:00',
    membroAusenteId:'q', roster:roster3, habMap:{x:hab('altar'),y:hab('altar'),z:hab('altar')},
    dispMap:{x:['dom_08:00'],y:['dom_08:00'],z:['dom_08:00']}, cargaMap:{x:5,y:1,z:9},
    usadosNaMissa:new Set(), usadoFds:new Set(), config:{}, rnd:rnd0 }).membroId, 'y');

// 4) filtro duro: exclui indisponível, ausente-alvo, já-usado-na-missa, inelegível
eq('exclui quem não está disponível no horário',
  escolherSubstituto({ funcao:'altar', comunidade:'matriz', horKey:'dom_08:00',
    membroAusenteId:'q', roster:[M('x'),M('y')], habMap:{x:hab('altar'),y:hab('altar')},
    dispMap:{x:['seg_19:00'], y:['dom_08:00']}, cargaMap:{x:0,y:9},
    usadosNaMissa:new Set(), usadoFds:new Set(), config:{}, rnd:rnd0 }).membroId, 'y');

eq('exclui quem já está na missa',
  escolherSubstituto({ funcao:'altar', comunidade:'matriz', horKey:'dom_08:00',
    membroAusenteId:'q', roster:[M('x'),M('y')], habMap:{x:hab('altar'),y:hab('altar')},
    dispMap:{x:['dom_08:00'],y:['dom_08:00']}, cargaMap:{x:0,y:9},
    usadosNaMissa:new Set(['x']), usadoFds:new Set(), config:{}, rnd:rnd0 }).membroId, 'y');

// 5) comunidade: prioriza mesma comunidade; cruza só se pode_outras_comunidades
eq('prioriza mesma comunidade',
  escolherSubstituto({ funcao:'altar', comunidade:'santo_antonio', horKey:'dom_08:00',
    membroAusenteId:'q',
    roster:[M('x',{comunidade:'matriz'}), M('y',{comunidade:'santo_antonio'})],
    habMap:{x:hab('altar'),y:hab('altar')}, dispMap:{x:['dom_08:00'],y:['dom_08:00']},
    cargaMap:{x:0,y:9}, usadosNaMissa:new Set(), usadoFds:new Set(), config:{}, rnd:rnd0 }).membroId, 'y');

eq('cruza comunidade só quem pode_outras_comunidades',
  escolherSubstituto({ funcao:'altar', comunidade:'santo_antonio', horKey:'dom_08:00',
    membroAusenteId:'q',
    roster:[M('x',{comunidade:'matriz',pode_outras_comunidades:false}), M('y',{comunidade:'matriz',pode_outras_comunidades:true})],
    habMap:{x:hab('altar'),y:hab('altar')}, dispMap:{x:['dom_08:00'],y:['dom_08:00']},
    cargaMap:{x:0,y:9}, usadosNaMissa:new Set(), usadoFds:new Set(), config:{}, rnd:rnd0 }).membroId, 'y');

// 6) cerimoniário reservado: em função MENOR, evita cerimoniário (int>=6) se houver não-cerimoniário
eq('menor: evita cerimoniário quando há coroinha',
  escolherSubstituto({ funcao:'altar', comunidade:'matriz', horKey:'dom_08:00',
    membroAusenteId:'q',
    roster:[M('cer',{nivel:'cerimoniario_guardiao'}), M('cor',{nivel:'coroinha'})],
    habMap:{cer:hab('altar'),cor:hab('altar')}, dispMap:{cer:['dom_08:00'],cor:['dom_08:00']},
    cargaMap:{cer:0,cor:9}, usadosNaMissa:new Set(), usadoFds:new Set(), config:{}, rnd:rnd0 }).membroId, 'cor');

eq('menor: usa cerimoniário se é o único',
  escolherSubstituto({ funcao:'altar', comunidade:'matriz', horKey:'dom_08:00',
    membroAusenteId:'q', roster:[M('cer',{nivel:'cerimoniario_guardiao'})],
    habMap:{cer:hab('altar')}, dispMap:{cer:['dom_08:00']}, cargaMap:{cer:0},
    usadosNaMissa:new Set(), usadoFds:new Set(), config:{}, rnd:rnd0 }).membroId, 'cer');

// 7) MAIOR: cerimoniário é elegível normalmente
eq('maior (turibulo): cerimoniário entra',
  escolherSubstituto({ funcao:'turibulo', comunidade:'matriz', horKey:'dom_08:00',
    membroAusenteId:'q', roster:[M('cer',{nivel:'cerimoniario_guardiao'})],
    habMap:{cer:hab('turibulo')}, dispMap:{cer:['dom_08:00']}, cargaMap:{cer:0},
    usadosNaMissa:new Set(), usadoFds:new Set(), config:{}, rnd:rnd0 }).membroId, 'cer');

// 8) sem candidato → null
eq('sem candidato válido → null',
  escolherSubstituto({ funcao:'altar', comunidade:'matriz', horKey:'dom_08:00',
    membroAusenteId:'q', roster:[M('x')], habMap:{}, dispMap:{x:['dom_08:00']},
    cargaMap:{}, usadosNaMissa:new Set(), usadoFds:new Set(), config:{}, rnd:rnd0 }).membroId, null);

console.log(falhas? ('\n'+falhas+' FALHA(S)') : '\nTODOS OK');
process.exit(falhas?1:0);
```

- [ ] **Step 2: Rodar os testes e confirmar que falham** (módulo ainda não existe)

Run: `node projetos/acolitos/gerador-substituto.test.js`
Expected: erro `Cannot find module './gerador-substituto.js'` (ou falhas), confirmando RED.

- [ ] **Step 3: Escrever o motor** (`projetos/acolitos/gerador-substituto.js`)

```js
// Motor de escolha de substituto — ÚNICO ponto de verdade das regras, usado por
// escala.html e ausencias.html. Função PURA (sem I/O): quem chama monta o ctx.
// Espelha as regras do gerador (elegibilidade, comunidade, cerimoniário, rodízio).
(function(global){
  'use strict';
  // Espelho de shared.js NIVEIS (int por slug de nível da jornada)
  var NIVEL_INT = {
    aspirante:0, coroinha:1, acolito_aspirante:2, acolito_guardiao:3, acolito_sentinela:4,
    aspirante_cerimoniario:5, cerimoniario_aspirante:6, cerimoniario_guardiao:7,
    cerimoniario_magistral:8, cerimoniario_mor:9
  };
  function nivelInt(slug){ return NIVEL_INT[slug] != null ? NIVEL_INT[slug] : 0; }
  function calcIdade(dn){
    if(!dn) return null;
    var d = new Date(dn); if(isNaN(d.getTime())) return null;
    var t = new Date(); var a = t.getFullYear()-d.getFullYear();
    var m = t.getMonth()-d.getMonth();
    if(m<0 || (m===0 && t.getDate()<d.getDate())) a--;
    return a;
  }
  function elegivelFuncao(m, f, comKey, habMap, config){
    var h = (habMap[m.id]||{})[f];
    if (h && (h==='apto'||h==='experiente'||h==='referencia')) return true;
    var ger = (config && config.gerador) || {};
    var kit = ger.kit_leve || { comunidade:'santo_antonio', funcoes:['cruz','vela'], idade_min:7 };
    if (kit && comKey===kit.comunidade && (kit.funcoes||[]).indexOf(f) >= 0){
      var idade = m.data_nascimento ? calcIdade(m.data_nascimento) : null;
      if (idade != null) return idade >= (kit.idade_min!=null ? kit.idade_min : 7);
      return nivelInt(m.nivel||'aspirante') >= 1;   // sem idade → coroinha pra cima
    }
    return false;
  }
  function escolherSubstituto(ctx){
    var funcao = ctx.funcao, comKey = ctx.comunidade, horKey = ctx.horKey;
    var roster = ctx.roster || [], habMap = ctx.habMap || {}, dispMap = ctx.dispMap || {};
    var carga = ctx.cargaMap || {};
    var usadosNaMissa = ctx.usadosNaMissa || new Set();
    var usadoFds = ctx.usadoFds || new Set();
    var config = ctx.config || {};
    var rnd = ctx.rnd || Math.random;
    var maiores = (config.funcoes_maiores && config.funcoes_maiores.length)
      ? config.funcoes_maiores
      : ['cred_altar','cred_credencia','missal','turibulo','naveta','mitra','baculo'];
    var MAIORES = {}; maiores.forEach(function(f){ MAIORES[f]=true; });

    var disp = function(id){ return !horKey || (dispMap[id]||[]).indexOf(horKey) >= 0; };
    var pool = roster.filter(function(m){
      return m.id !== ctx.membroAusenteId
        && !usadosNaMissa.has(m.id)
        && disp(m.id)
        && elegivelFuncao(m, funcao, comKey, habMap, config);
    });
    if(!pool.length) return { membroId:null, motivo:'sem_candidato' };

    // camadas de comunidade
    var mesma = pool.filter(function(m){ return !comKey || (m.comunidade||'')===comKey; });
    var cruza = pool.filter(function(m){ return (m.comunidade||'')!==comKey && m.pode_outras_comunidades; });
    var base = [mesma, cruza, pool].find(function(t){ return t.length; }) || pool;

    var ehCerimo = function(m){ return nivelInt(m.nivel||'aspirante') >= 6; };
    var menor = !MAIORES[funcao];
    var tiers = menor
      ? [ base.filter(function(m){ return !ehCerimo(m) && !usadoFds.has(m.id); }),
          base.filter(function(m){ return !ehCerimo(m); }),
          base.filter(function(m){ return !usadoFds.has(m.id); }),
          base ]
      : [ base.filter(function(m){ return !usadoFds.has(m.id); }), base ];
    var grupo = tiers.find(function(t){ return t.length; });
    if(!grupo || !grupo.length) return { membroId:null, motivo:'sem_candidato' };

    // rodízio: menor carga primeiro, empate aleatório
    grupo = grupo.slice().sort(function(a,b){
      return (carga[a.id]||0) - (carga[b.id]||0) || (rnd()-0.5);
    });
    return { membroId: grupo[0].id, motivo:null };
  }

  var API = { escolherSubstituto: escolherSubstituto, elegivelFuncao: elegivelFuncao, nivelInt: nivelInt, calcIdade: calcIdade };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;   // node/testes
  global.GeradorSubstituto = API;                                             // navegador
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 4: Rodar os testes e confirmar GREEN**

Run: `node projetos/acolitos/gerador-substituto.test.js`
Expected: todas as linhas `PASS` e `TODOS OK`, exit 0.

- [ ] **Step 5: Commit**

```bash
git add projetos/acolitos/gerador-substituto.js projetos/acolitos/gerador-substituto.test.js
git commit -m "feat(acolitos): motor JS de escolha de substituto (regras completas, testado)"
```

---

## Task 3: `escala.html` usa o motor (refatora trocarPosicao + montagem)

Remover a duplicação: `escala.html` passa a chamar `GeradorSubstituto.escolherSubstituto`. Ganha rodízio no `trocarPosicao` (hoje aleatório). **Verificação de ponta-a-ponta depende do banco ao vivo** (Task 1); offline dá pra confirmar carregamento sem erro e fiação.

**Files:**
- Modify: `projetos/acolitos/escala.html`

**Interfaces:**
- Consumes: `window.GeradorSubstituto.escolherSubstituto` (Task 2); dados já carregados na escala (`membros`, `habMap`, `dispMap`, `ausMap`, `celAtual`, carga via `carregarCargaHistorica`).
- Produces: função helper `montarCtxSub(celeb, funcao, membroAusenteId, usadosNaMissa, usadoFds)` reutilizável nas Tasks 3/4.

- [ ] **Step 1: Incluir o `<script>` do motor**

Adicionar no `<head>` (ou antes do script principal) de `escala.html`, junto aos outros scripts locais:

```html
<script src="gerador-substituto.js"></script>
```

- [ ] **Step 2: Helper de montagem de ctx**

Adicionar (perto de `trocarPosicao`) uma função que monta o `ctx` a partir do estado da escala. Usar `carregarCargaHistorica` (já existente) para `cargaMap`:

```js
async function montarCtxSub(celeb, funcao, membroAusenteId, usadosNaMissa, usadoFds){
  const carga = await carregarCargaHistorica(celeb.data);
  return {
    funcao: funcao,
    comunidade: celeb.comunidade,
    horKey: horKeyDe(celeb),
    membroAusenteId: membroAusenteId,
    roster: membros,                     // já carregado (status ativo)
    habMap: habMap,                      // já carregado
    dispMap: dispMap,                    // já carregado
    cargaMap: carga,
    usadosNaMissa: usadosNaMissa || new Set(),
    usadoFds: usadoFds || new Set(),
    config: { gerador: (typeof cfg==='function'?cfg('gerador',{}):{}), funcoes_maiores: (typeof cfg==='function'?cfg('funcoes_maiores',null):null) }
  };
}
```

- [ ] **Step 3: Reescrever `trocarPosicao` para usar o motor**

Substituir o corpo de escolha (o trecho que monta `pool`, `tiers`, e faz `Math.floor(rnd*grupo.length)`) por uma chamada ao motor. Manter a UI (`pe.sel.value`, toast, `refreshDuplicatasMissa`). Como `trocarPosicao` hoje é síncrona e o motor precisa de `cargaMap`, tornar `trocarPosicao` async e montar o ctx:

```js
async function trocarPosicao(pe){
  if(!celAtual) return;
  const usadosOutros = new Set();
  pendingEdicao.forEach(p => { if(p!==pe && p.sel.value) usadosOutros.add(p.sel.value); });
  const ctx = await montarCtxSub(celAtual, pe.funcao, pe.sel.value, usadosOutros, new Set());
  const r = GeradorSubstituto.escolherSubstituto(ctx);
  if(!r.membroId){ toast('Sem outra opção disponível e apta pra essa função.','error'); return; }
  const escolhido = membros.find(m => m.id === r.membroId);
  pe.sel.value = escolhido.id; pe.sel.classList.add('filled');
  refreshDuplicatasMissa();
  toast('🔄 ' + (escolhido.apelido || (escolhido.nome||'').split(' ')[0]));
}
```

> Ajustar o call-site de `trocarPosicao` para `await`/`.catch` se necessário (é acionado por clique — `onclick=()=>{ trocarPosicao(pe); }` já funciona sem await).

- [ ] **Step 4: Verificação offline (carregamento e fiação)**

Servir do root: `python3 -m http.server 8765` (background). Playwright → `http://localhost:8765/projetos/acolitos/escala.html`.
- A página carrega sem erro de console referente a `GeradorSubstituto` (script achado).
- `window.GeradorSubstituto` existe (evaluate).
- (Login/dados reais podem não estar disponíveis no ambiente de teste — se a página exigir login e não der pra logar, confirmar ao menos que o script do motor carrega e não quebra o boot; o teste funcional do `trocarPosicao` fica para a verificação com banco/login — anotar.)

Expected: sem erro de carregamento do motor; `window.GeradorSubstituto` presente.

- [ ] **Step 5: Commit**

```bash
git add projetos/acolitos/escala.html
git commit -m "refactor(acolitos): escala usa o motor único de substituto (trocarPosicao com rodízio)"
```

---

## Task 4: Auto-troca no "Registrar ausência" (escala.html) + modal-resumo/Desfazer

**Files:**
- Modify: `projetos/acolitos/escala.html`
- Modify: `projetos/acolitos/gerador-substituto.js` (adiciona helper de UI do resumo)

**Interfaces:**
- Consumes: `montarCtxSub` (Task 3), `escolherSubstituto` (Task 2).
- Produces: `window.GeradorSubstituto.aplicarTrocaEscala(sb, {celebracao_id, comunidade, data, membroAusenteId})` → grava a troca em `acolitos_escalas` e retorna `{funcao, saiu, entrou|null, novoEscalaId|null}`; `window.GeradorSubstituto.abrirResumoTrocas(trocas, onDesfazer)` → modal.

- [ ] **Step 1: Função de aplicação da troca (no módulo, com I/O via `sb` recebido)**

Adicionar ao `gerador-substituto.js` (usa `sb` passado; mantém o motor puro separado). Busca a linha escalada do ausente naquela celebração/qualquer função, escolhe substituto e grava:

```js
// --- Camada de I/O (recebe o client supabase `sb`) ---
async function aplicarTrocaEscala(sb, arg, ctxBuilder){
  // arg: {celebracao_id, comunidade, data, membroAusenteId}
  // ctxBuilder(funcao, usadosNaMissa, usadoFds) -> ctx (cada página injeta suas queries)
  const { data: linhas } = await sb.from('acolitos_escalas')
    .select('id,membro_id,funcao,status')
    .eq('celebracao_id', arg.celebracao_id);
  const alvo = (linhas||[]).find(e => e.membro_id===arg.membroAusenteId
    && (e.status==='escalado' || e.status==='presente' || e.status==='atrasado'));
  if(!alvo) return null; // não estava escalado (ativo) nessa missa
  const usadosNaMissa = new Set((linhas||[]).map(e=>e.membro_id));
  const ctx = await ctxBuilder(alvo.funcao, usadosNaMissa, new Set());
  const r = escolherSubstituto(ctx);
  const novoId = r.membroId || null;
  // marca o ausente como substituido (+ substituto_id se houver)
  await sb.from('acolitos_escalas').update({ status:'substituido', substituto_id: novoId })
    .eq('id', alvo.id);
  let novoEscalaId = null;
  if(novoId){
    const { data: ins } = await sb.from('acolitos_escalas')
      .insert([{ celebracao_id: arg.celebracao_id, membro_id: novoId, funcao: alvo.funcao, status:'escalado' }])
      .select('id').single();
    novoEscalaId = ins ? ins.id : null;
  }
  return { funcao: alvo.funcao, saiu: arg.membroAusenteId, entrou: novoId, novoEscalaId: novoEscalaId, alvoId: alvo.id };
}
```

E o Desfazer (apaga a linha do substituto; mantém o ausente `substituido`):

```js
async function desfazerTroca(sb, troca){
  if(troca.novoEscalaId){
    await sb.from('acolitos_escalas').delete().eq('id', troca.novoEscalaId);
  }
  // opcional: limpar substituto_id do alvo (vaga vazia); mantém status 'substituido'
  await sb.from('acolitos_escalas').update({ substituto_id: null }).eq('id', troca.alvoId);
}
```

Expor no `API`: `aplicarTrocaEscala`, `desfazerTroca`, `abrirResumoTrocas` (próximo step).

- [ ] **Step 2: Modal-resumo (no módulo, CSS/HTML mínimos injetados)**

Adicionar `abrirResumoTrocas(trocas, ctxNomes, onDesfazer)` que cria um overlay simples listando cada troca (`saiu → entrou` ou `→ SEM substituto ⚠`) com botão Desfazer por item e um Fechar. `ctxNomes` = `{membroId: 'Nome'}` p/ exibir nomes. Reusar as classes de modal já existentes se possível; senão, estilo inline no padrão vinho+dourado. (Sem `confirm` nativo.)

```js
function abrirResumoTrocas(trocas, nomes, onDesfazer){
  var nome = function(id){ return id ? (nomes[id]||id) : '—'; };
  var ov = document.createElement('div');
  ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9000;display:flex;align-items:center;justify-content:center;padding:16px;';
  var card = document.createElement('div');
  card.style.cssText='background:#241019;border:1px solid #5a3a3f;border-radius:16px;max-width:440px;width:100%;padding:18px;color:#f7ebe7;max-height:80vh;overflow:auto;';
  var h = document.createElement('div'); h.textContent='⚡ Trocas por ausência ('+trocas.length+')';
  h.style.cssText='font-weight:800;font-size:16px;margin-bottom:10px;color:#ffd97a;'; card.appendChild(h);
  trocas.forEach(function(t){
    var row = document.createElement('div');
    row.style.cssText='display:flex;justify-content:space-between;gap:8px;align-items:center;padding:8px 0;border-bottom:1px solid #43282e;font-size:13px;';
    var txt = document.createElement('div');
    txt.innerHTML = '<b>'+nome(t.saiu)+'</b> ('+(t.funcao)+') ausente<br>→ '+(t.entrou?('entrou <b>'+nome(t.entrou)+'</b>'):'<span style="color:#e0607a">SEM substituto ⚠ (vaga vazia)</span>');
    row.appendChild(txt);
    if(t.entrou){
      var d = document.createElement('button'); d.textContent='Desfazer';
      d.style.cssText='flex:none;background:#3a1c24;border:1px solid #7a5a1a;color:#ffd97a;border-radius:8px;padding:6px 10px;font-size:12px;cursor:pointer;';
      d.onclick=async function(){ d.disabled=true; d.textContent='...'; await onDesfazer(t); txt.innerHTML='<b>'+nome(t.saiu)+'</b> ('+t.funcao+') — vaga vazia (desfeito)'; d.remove(); };
      row.appendChild(d);
    }
    card.appendChild(row);
  });
  var fechar = document.createElement('button'); fechar.textContent='Ok';
  fechar.style.cssText='margin-top:14px;width:100%;background:linear-gradient(160deg,#ffd97a,#8a6a24);color:#2a1500;border:none;border-radius:10px;padding:11px;font-weight:800;cursor:pointer;';
  fechar.onclick=function(){ ov.remove(); if(typeof onDesfazer._done==='function') onDesfazer._done(); };
  card.appendChild(fechar); ov.appendChild(card); document.body.appendChild(ov);
}
```

- [ ] **Step 3: Ligar no fluxo de `abrirRegistrarAusenciaCoord`**

Após a gravação da(s) ausência(s) em `acolitos_ausencias` (no sucesso), para cada `(membro_id, celebracao_id)` gravado com celebração definida, chamar `aplicarTrocaEscala` com um `ctxBuilder` que reusa `montarCtxSub`, acumular as trocas não-nulas e chamar `abrirResumoTrocas`. Depois, recarregar a escala (`loadDados()` / re-render).

```js
// dentro do sucesso de abrirRegistrarAusenciaCoord, após gravar ausências:
const trocas = [];
for(const cid of celebracoesGravadas){          // ids de celebração da ausência
  const celeb = celebsById[cid];                 // ou buscar {comunidade,data}
  const t = await GeradorSubstituto.aplicarTrocaEscala(sb,
    { celebracao_id: cid, comunidade: celeb.comunidade, data: celeb.data, membroAusenteId: mid },
    (funcao, usadosNaMissa, usadoFds) => montarCtxSub(celeb, funcao, mid, usadosNaMissa, usadoFds));
  if(t) trocas.push(t);
}
if(trocas.length){
  const nomes = {}; membros.forEach(m=>nomes[m.id]=m.apelido||m.nome);
  GeradorSubstituto.abrirResumoTrocas(trocas, nomes, (t)=>GeradorSubstituto.desfazerTroca(sb,t));
}
await loadDados();
```

> Ajustar nomes de variáveis (`celebsById`, `celebracoesGravadas`, `mid`) aos reais do `abrirRegistrarAusenciaCoord` ao implementar.

- [ ] **Step 4: Verificação**

**Precisa de login + banco ao vivo.** Se disponível (MCP/erickjcbp e login de coordenação): criar uma **celebração descartável** + escalar uma **linha de teste** (membro de teste, NUNCA real), registrar ausência desse membro de teste, e confirmar: sai da escala (status substituido), entra substituto válido, modal-resumo aparece, Desfazer esvazia a vaga. Limpar a celebração/linha de teste depois.
Se banco/login indisponível no ambiente: reportar **DONE_WITH_CONCERNS** com verificação offline (carrega sem erro, funções expostas) e deixar o teste funcional para a sessão com banco.

- [ ] **Step 5: Commit**

```bash
git add projetos/acolitos/escala.html projetos/acolitos/gerador-substituto.js
git commit -m "feat(acolitos): auto-troca ao registrar ausência (coord) + modal-resumo com desfazer"
```

---

## Task 5: Auto-troca na aprovação (ausencias.html)

**Files:**
- Modify: `projetos/acolitos/ausencias.html`

**Interfaces:**
- Consumes: `GeradorSubstituto.{escolherSubstituto,aplicarTrocaEscala,desfazerTroca,abrirResumoTrocas}` (Tasks 2/4); RPC `acolitos_ausencia_pendente_decidir`; roster já carregado (`rosterMembrosAus`).
- Produces: nada consumido por outras tasks.

- [ ] **Step 1: Incluir o `<script>` do motor**

```html
<script src="gerador-substituto.js"></script>
```

- [ ] **Step 2: Montar ctx nesta tela (buscar disponibilidade/carga/config/hab)**

A `ausencias.html` já tem `rosterMembrosAus` (membros) e busca `habs`. Adicionar buscas na hora da aprovação: `acolitos_disponibilidade` (dispMap), config `gerador`/`funcoes_maiores` (de `acolitos_config`), e carga de rodízio (query igual `carregarCargaHistorica` — replicar a função aqui, pequena). `usadoFds` pode entrar vazio nesta tela (só preferência) — anotar como simplificação conhecida.

```js
async function carregarCargaAus(refData){
  const dias = 42;
  const ini = new Date(refData+'T00:00:00'); ini.setDate(ini.getDate()-dias);
  const iniStr = ini.toISOString().slice(0,10);
  const base = {};
  const { data: cels } = await sb.from('acolitos_celebracoes').select('id').gte('data',iniStr).lte('data',refData);
  const ids = (cels||[]).map(c=>c.id); if(!ids.length) return base;
  const { data } = await sb.from('acolitos_escalas').select('membro_id').in('celebracao_id',ids).limit(5000);
  (data||[]).forEach(e=>{ base[e.membro_id]=(base[e.membro_id]||0)+1; });
  return base;
}
function dispMapDe(rows){ const m={}; (rows||[]).forEach(r=>{ (m[r.membro_id]=m[r.membro_id]||[]).push(r.dia+'_'+r.horario); }); return m; }
function horKeyDeCel(c){ const d=new Date(c.data+'T00:00:00'); const DIA=['dom','seg','ter','qua','qui','sex','sab']; return DIA[d.getDay()]+'_'+c.horario; }
```

- [ ] **Step 3: Aplicar troca após aprovar**

No handler de Aprovar, depois do retorno OK de `acolitos_ausencia_pendente_decidir`, para cada ausência aprovada com `celebracao_id`, montar ctx e aplicar via `aplicarTrocaEscala`, acumulando o resumo. Buscar `{comunidade,data}` da celebração e `habMap` do roster.

```js
// após aprovar com sucesso, para cada item aprovado {membro_id, celebracao_id}:
const habMap = {}; ((rosterHabs)||[]).forEach(h=>{ (habMap[h.membro_id]=habMap[h.membro_id]||{})[h.funcao]=h.proficiencia; });
const { data: dispRows } = await sb.from('acolitos_disponibilidade').select('membro_id,dia,horario');
const dispMap = dispMapDe(dispRows);
const config = { gerador: (cfgAus('gerador')||{}), funcoes_maiores: (cfgAus('funcoes_maiores')||null) }; // ler acolitos_config
const trocas = [];
for(const it of aprovados){
  const { data: cel } = await sb.from('acolitos_celebracoes').select('data,horario,comunidade').eq('id', it.celebracao_id).single();
  if(!cel) continue;
  const carga = await carregarCargaAus(cel.data);
  const t = await GeradorSubstituto.aplicarTrocaEscala(sb,
    { celebracao_id: it.celebracao_id, comunidade: cel.comunidade, data: cel.data, membroAusenteId: it.membro_id },
    (funcao, usadosNaMissa, usadoFds) => ({
      funcao, comunidade: cel.comunidade, horKey: horKeyDeCel(cel), membroAusenteId: it.membro_id,
      roster: rosterMembrosAus, habMap, dispMap, cargaMap: carga,
      usadosNaMissa, usadoFds: new Set(), config
    }));
  if(t) trocas.push(t);
}
if(trocas.length){
  const nomes = {}; rosterMembrosAus.forEach(m=>nomes[m.id]=m.apelido||m.nome);
  GeradorSubstituto.abrirResumoTrocas(trocas, nomes, (t)=>GeradorSubstituto.desfazerTroca(sb,t));
}
```

> `aprovados`, `rosterHabs`, `cfgAus` precisam existir/ser buscados; ajustar aos nomes reais da `ausencias.html` ao implementar (a tela já carrega roster; garantir que os `habs` ficam guardados; ler `acolitos_config` uma vez).

- [ ] **Step 4: Verificação**

**Precisa de banco/login.** Com celebração + membro de teste descartáveis: enviar ausência pública do membro de teste (que está escalado numa celebração de teste), aprovar na tela → confirmar troca + modal + Desfazer. Limpar depois. Se banco indisponível: **DONE_WITH_CONCERNS** com verificação offline (script carrega, sem erro) e teste funcional adiado.

- [ ] **Step 5: Commit**

```bash
git add projetos/acolitos/ausencias.html
git commit -m "feat(acolitos): auto-troca por ausência na aprovação (usa motor único)"
```

---

## Verificação final (fim a fim, requer banco/login na conta erickjcbp)

- [ ] Motor: `node projetos/acolitos/gerador-substituto.test.js` → TODOS OK.
- [ ] Escala: registrar ausência de escalado de teste → troca + resumo + desfazer.
- [ ] Ausências: aprovar ausência pública de escalado de teste → troca + resumo + desfazer.
- [ ] Consistência: a escolha do substituto é a MESMA que a Escala faria (mesmo motor).
- [ ] Sem substituto → vaga vazia sinalizada, nos dois caminhos.
- [ ] Dados de teste descartáveis limpos; nenhum membro/celebração real tocado.
- [ ] /code-review no diff.

---

## Self-review (feito na escrita)

- **Cobertura do spec:** motor único → Task 2; escala usa o motor (mata duplicação) → Task 3; auto-troca Registrar ausência + modal/desfazer → Task 4; auto-troca na aprovação → Task 5; verificação de schema (deriva) → Task 1; extensão condicional do roster RPC → Task 1 step 3 (1b). Gravação com histórico (`substituido`+`substituto_id`) e Desfazer=vaga vazia → Tasks 4/5. Regras completas (comunidade/cerimoniário/kit/rodízio) → Task 2 + testes. ✔
- **Placeholders:** o motor e seus testes têm código completo. As Tasks 3–5 mostram o código real de fiação, com a ressalva explícita de ajustar nomes de variáveis internas (`celebsById`, `aprovados`, `cfgAus`) aos reais das páginas — isso é integração em arquivo existente grande, não um placeholder de lógica. ✔
- **Consistência de tipos:** `ctx` com os mesmos campos em Task 2/3/5; `escolherSubstituto→{membroId,motivo}`; `aplicarTrocaEscala→{funcao,saiu,entrou,novoEscalaId,alvoId}`; `desfazerTroca(sb,troca)`; `abrirResumoTrocas(trocas,nomes,onDesfazer)`. Nomes usados igual entre tasks. ✔
- **Ordem/risco:** Task 1 (gate de banco) e Task 2 (motor, offline) são independentes — Task 2 pode ir primeiro sem banco. Tasks 3–5 dependem de Task 2 e da verificação da Task 1 pra teste funcional. ✔
