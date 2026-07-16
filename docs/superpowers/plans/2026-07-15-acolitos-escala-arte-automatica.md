# Arte Automática da Escala (Acólitos) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gerar automaticamente, todo domingo 21h (BRT), um PNG 2160×4800 da escala do fim de semana seguinte (fiel ao modelo Canva), entregue como download na tela de Escala.

**Architecture:** Um subprojeto Node novo (`arte-escala/`) roda num GitHub Actions cron: calcula o fim de semana alvo, lê as escalas do Supabase, resolve os dados litúrgicos (cálculo próprio + override manual), renderiza um HTML fiel via Puppeteer → PNG, e publica no Supabase Storage + tabela. A tela de Escala ganha botões para baixar e regenerar (via função Vercel que dispara o workflow).

**Tech Stack:** Node (ESM), Puppeteer (Chromium headless), @supabase/supabase-js, GitHub Actions, Vercel serverless (`api/`), HTML/CSS estático com fontes Sora+Inter embarcadas, Vitest (testes).

## Global Constraints

- **Projeto Supabase:** ref `fttjgsotuosjfrasttds`, URL `https://fttjgsotuosjfrasttds.supabase.co`.
- **Conta git/deploy:** identidade `erickjcbp` (`gh auth switch --user erickjcbp`; git config já setado). Nunca commitar como conta errada.
- **Fuso:** America/São_Paulo = UTC−3 fixo (Brasil sem horário de verão). Cron `0 0 * * 1` UTC = domingo 21h BRT.
- **Formato do PNG:** exatamente **2160×4800**.
- **Ordem das missas:** `['17h','18h30','7h','9h','19h']` (sábado 17h/18h30, domingo 7h/9h/19h).
- **Comunidade → rótulo da arte:** `matriz`→`JCBP`, `santo_antonio`→`STO. ANTONIO`.
- **Funções (FUNCAO_LABEL):** espelhar de `projetos/acolitos/escala.html:360-364` — nunca redefinir com valores diferentes.
- **Embed do Supabase:** `acolitos_escalas` tem 2 FKs para `acolitos_membros` → embed **obrigatoriamente** `acolitos_membros!membro_id(id,nome)`.
- **Status da escala (VALIDADO contra o banco em 2026-07-15):** a arte usa **`status='escalado'`** = a *escalação* pré-missa. Depois da missa a chamada muda o status para `presente`/`ausente`/`ausente_justificado`/`substituido`/`atrasado` — por isso um fim de semana passado aparece com 0 `escalado`. Para o fim de semana **seguinte** (uso real), todos estão `escalado`. **Não** incluir os status de chamada na arte, e **não** "consertar" o filtro para incluí-los.
- **Cores litúrgicas (5):** `verde|vermelho|branco|rosa|roxo`. Branco/rosa exigem texto escuro no pill.
- **ESM:** todo o subprojeto usa `import`/`export` (`"type":"module"`).
- **Faseamento:** executar **uma fase por sessão** (evita estourar tokens). Cada fase termina shippável e testável.
- **Nunca mexer em dados reais** para testar (usar leitura ou datas/fins de semana já existentes).

---

## Estrutura de arquivos

```
arte-escala/
  package.json            # ESM, deps, scripts de teste
  rotulos.js              # constantes: FUNCAO_LABEL, COMUNIDADE_ARTE, HOR_ORDEM
  liturgico.mjs           # cálculo litúrgico próprio (Computus + estações) + merge override
  liturgico.test.mjs
  dados.mjs               # lê Supabase → objeto de dados da arte
  dados.test.mjs
  template.html           # layout fiel (placeholders __TOKEN__), Sora+Inter embarcadas
  render.mjs              # injeta dados no template + Puppeteer → PNG 2160×4800
  gerar.mjs               # orquestra: alvo → dados → litúrgico → render → upload
  fim-de-semana.mjs       # cálculo do sábado/domingo alvo a partir de "agora"
  fim-de-semana.test.mjs
  assets/                 # PNGs recortados do elementos.png + fontes woff2
    brasao.png
    bandeira-verde.png bandeira-vermelho.png bandeira-branco.png bandeira-rosa.png bandeira-roxo.png
    sora.woff2 inter.woff2
projetos/acolitos/midia/arte-escala/   # cópia pública dos assets (servida pelo app, se necessário)
.github/workflows/arte-escala.yml
api/regenerar-arte.js     # Vercel: dispara workflow_dispatch
db/migrations/0XX_arte_escala.sql       # tabelas + bucket
projetos/acolitos/escala.html           # botões + modal + form de override (modificar)
```

**Fases (uma por sessão):**
1. **Litúrgico** (`liturgico.mjs` + `fim-de-semana.mjs`) — lógica pura, 100% testável.
2. **Rótulos + Dados** (`rotulos.js` + `dados.mjs`) — leitura Supabase.
3. **Assets + Template + Render** (recorte, `template.html`, `render.mjs`) — validação visual vs. `teste.png`.
4. **Orquestração + Infra** (`gerar.mjs`, migrations, workflow cron, Storage).
5. **App UI** (botões, modal, override form, `api/regenerar-arte.js`, `workflow_dispatch`).

---

## FASE 1 — Litúrgico

### Task 1: Setup do subprojeto + cálculo do fim de semana alvo

**Files:**
- Create: `arte-escala/package.json`
- Create: `arte-escala/fim-de-semana.mjs`
- Test: `arte-escala/fim-de-semana.test.mjs`

**Interfaces:**
- Produces: `alvoFimDeSemana(agora: Date): { sabado: string, domingo: string }` — datas ISO `YYYY-MM-DD` (em horário local BRT) do **próximo** sábado e domingo estritamente após `agora`. Regra: a partir de um domingo 21h, retorna o sábado/domingo da semana seguinte (+6/+7 dias).

- [ ] **Step 1: Criar package.json**

```json
{
  "name": "arte-escala",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "gerar": "node gerar.mjs"
  },
  "devDependencies": {
    "vitest": "^2.1.0"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.45.0",
    "puppeteer": "^23.0.0"
  }
}
```

- [ ] **Step 2: Instalar deps**

Run: `cd arte-escala && npm install`
Expected: cria `node_modules` e `package-lock.json` sem erro.

- [ ] **Step 3: Escrever o teste que falha**

```javascript
// arte-escala/fim-de-semana.test.mjs
import { describe, it, expect } from 'vitest'
import { alvoFimDeSemana } from './fim-de-semana.mjs'

describe('alvoFimDeSemana', () => {
  it('domingo 21h → sábado/domingo da semana seguinte (+6/+7)', () => {
    // 2026-07-12 é domingo; 21h BRT = 2026-07-13T00:00Z
    const r = alvoFimDeSemana(new Date('2026-07-13T00:00:00Z'))
    expect(r).toEqual({ sabado: '2026-07-18', domingo: '2026-07-19' })
  })
  it('numa quarta → o sábado/domingo dessa mesma semana à frente', () => {
    // 2026-07-15 quarta 12:00 BRT = 15:00Z
    const r = alvoFimDeSemana(new Date('2026-07-15T15:00:00Z'))
    expect(r).toEqual({ sabado: '2026-07-18', domingo: '2026-07-19' })
  })
})
```

- [ ] **Step 4: Rodar e ver falhar**

Run: `cd arte-escala && npx vitest run fim-de-semana`
Expected: FAIL (`alvoFimDeSemana` não existe).

- [ ] **Step 5: Implementar**

```javascript
// arte-escala/fim-de-semana.mjs
// Trabalha em BRT (UTC-3) convertendo para um "instante local".
const BRT_OFFSET_MS = -3 * 60 * 60 * 1000

function toBRT(date) {
  return new Date(date.getTime() + BRT_OFFSET_MS)
}
function iso(d) {
  // d já é um Date "deslocado" para BRT; usar componentes UTC dele
  return d.toISOString().slice(0, 10)
}

export function alvoFimDeSemana(agora) {
  const local = toBRT(agora)
  const dow = local.getUTCDay() // 0=Dom .. 6=Sáb
  // Próximo sábado ESTRITAMENTE após hoje. Se hoje é sábado, pega o da semana que vem.
  let addSab = (6 - dow + 7) % 7
  if (addSab === 0) addSab = 7
  const sabado = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + addSab))
  const domingo = new Date(sabado.getTime() + 24 * 60 * 60 * 1000)
  return { sabado: iso(sabado), domingo: iso(domingo) }
}
```

- [ ] **Step 6: Rodar e ver passar**

Run: `cd arte-escala && npx vitest run fim-de-semana`
Expected: PASS (2 testes).

- [ ] **Step 7: Commit**

```bash
cd ~/iajcbp && git add arte-escala/package.json arte-escala/package-lock.json arte-escala/fim-de-semana.mjs arte-escala/fim-de-semana.test.mjs
git commit -m "feat(arte-escala): subprojeto + cálculo do fim de semana alvo

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Cálculo litúrgico (estação, nº do domingo, ano do ciclo, cor)

**Files:**
- Create: `arte-escala/liturgico.mjs`
- Test: `arte-escala/liturgico.test.mjs`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `pascoa(ano: number): Date` — domingo de Páscoa (UTC) via Computus gregoriano.
  - `liturgicoDoDomingo(domingoISO: string): { tempo: string, descricao: string, cor: string, auto: true }`
    onde `tempo ∈ {'TEMPO COMUM','ADVENTO','TEMPO DO NATAL','QUARESMA','TEMPO PASCAL'}`,
    `descricao` ex. `'15º Domingo do Tempo Comum, Ano A'`, `cor ∈ {verde,vermelho,branco,rosa,roxo}`.
  - `resolverLiturgico(domingoISO, override): {tempo,descricao,cor,auto}` — se `override` (linha da tabela)
    tiver `tempo/descricao/cor`, retorna esses (com `auto:false`); senão `liturgicoDoDomingo`.

Escopo do auto-cálculo: cobre os **domingos comuns** de Tempo Comum, Advento, Quaresma e Tempo Pascal, com as cores especiais Gaudete/Laetare (rosa), Ramos e Pentecostes (vermelho). Solenidades móveis, domingos do Tempo do Natal (Sagrada Família, Epifania, Batismo) e exceções vão pelo **override**.

- [ ] **Step 1: Escrever os testes que falham**

```javascript
// arte-escala/liturgico.test.mjs
import { describe, it, expect } from 'vitest'
import { pascoa, liturgicoDoDomingo, resolverLiturgico } from './liturgico.mjs'

describe('pascoa (Computus)', () => {
  it('Páscoa 2026 = 05/04', () => {
    expect(pascoa(2026).toISOString().slice(0,10)).toBe('2026-04-05')
  })
  it('Páscoa 2025 = 20/04', () => {
    expect(pascoa(2025).toISOString().slice(0,10)).toBe('2025-04-20')
  })
})

describe('liturgicoDoDomingo', () => {
  it('12/07/2026 → 15º Domingo do Tempo Comum, Ano A, verde (âncora do modelo)', () => {
    expect(liturgicoDoDomingo('2026-07-12')).toEqual({
      tempo: 'TEMPO COMUM',
      descricao: '15º Domingo do Tempo Comum, Ano A',
      cor: 'verde', auto: true
    })
  })
  it('Pentecostes 24/05/2026 → vermelho', () => {
    expect(liturgicoDoDomingo('2026-05-24').cor).toBe('vermelho')
  })
  it('1º Domingo do Advento 29/11/2026 → ADVENTO, roxo', () => {
    const r = liturgicoDoDomingo('2026-11-29')
    expect(r.tempo).toBe('ADVENTO')
    expect(r.descricao).toBe('1º Domingo do Advento, Ano B')
    expect(r.cor).toBe('roxo')
  })
  it('3º Domingo do Advento (Gaudete) 13/12/2026 → rosa', () => {
    expect(liturgicoDoDomingo('2026-12-13').cor).toBe('rosa')
  })
  it('4º Domingo da Quaresma (Laetare) 15/03/2026 → QUARESMA, rosa', () => {
    const r = liturgicoDoDomingo('2026-03-15')
    expect(r.tempo).toBe('QUARESMA')
    expect(r.cor).toBe('rosa')
  })
  it('Domingo de Ramos 29/03/2026 → vermelho', () => {
    expect(liturgicoDoDomingo('2026-03-29').cor).toBe('vermelho')
  })
  it('2º Domingo da Páscoa 12/04/2026 → TEMPO PASCAL, branco', () => {
    const r = liturgicoDoDomingo('2026-04-12')
    expect(r.tempo).toBe('TEMPO PASCAL')
    expect(r.cor).toBe('branco')
  })
})

describe('resolverLiturgico (override vence)', () => {
  it('override completo é usado', () => {
    const r = resolverLiturgico('2026-07-12', { tempo:'FESTA', descricao:'São Bento, Ano A', cor:'branco' })
    expect(r).toEqual({ tempo:'FESTA', descricao:'São Bento, Ano A', cor:'branco', auto:false })
  })
  it('sem override cai no cálculo', () => {
    expect(resolverLiturgico('2026-07-12', null).auto).toBe(true)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd arte-escala && npx vitest run liturgico`
Expected: FAIL (módulo não existe).

- [ ] **Step 3: Implementar**

```javascript
// arte-escala/liturgico.mjs
const DIA = 24 * 60 * 60 * 1000
const U = (y, m, d) => new Date(Date.UTC(y, m - 1, d))
const iso = d => d.toISOString().slice(0, 10)
const parse = s => { const [y,m,d] = s.split('-').map(Number); return U(y, m, d) }
const semanas = (a, b) => Math.round((b - a) / (7 * DIA))

// Páscoa gregoriana (Meeus/Jones/Butcher)
export function pascoa(year) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100
  const d = Math.floor(b / 4), e = b % 4
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4), k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const mth = Math.floor((h + l - 7 * ((a + 11 * h + 22 * l) / 451 | 0) + 114) / 31)
  const day = ((h + l - 7 * ((a + 11 * h + 22 * l) / 451 | 0) + 114) % 31) + 1
  return U(year, mth, day)
}

// 1º Domingo do Advento do ANO CIVIL y: 4 domingos antes do Natal (25/12).
function primeiroAdvento(y) {
  const natal = U(y, 12, 25)
  const dow = natal.getUTCDay() // 0=Dom
  const domingoAntesOuNoNatal = new Date(natal.getTime() - dow * DIA)
  return new Date(domingoAntesOuNoNatal.getTime() - 3 * 7 * DIA) // 4º domingo antes
}

// Ciclo dominical A/B/C a partir do ano de início do Advento.
function anoCiclo(adventYear) {
  return ['C', 'A', 'B'][(adventYear + 1) % 3]
}

const ORD = n => n + 'º'

export function liturgicoDoDomingo(domingoISO) {
  const dom = parse(domingoISO)
  const y = dom.getUTCFullYear()
  const P = pascoa(y)
  const cinzas = new Date(P.getTime() - 46 * DIA)          // Quarta de Cinzas
  const ramos = new Date(P.getTime() - 7 * DIA)            // Domingo de Ramos
  const pentecostes = new Date(P.getTime() + 49 * DIA)     // Pentecostes
  const adventoEsteAno = primeiroAdvento(y)

  // Ano do ciclo: se já passou do Advento deste ano, o Advento é o de referência; senão o do ano anterior.
  const adventYear = dom >= adventoEsteAno ? y : y - 1
  const ciclo = anoCiclo(adventYear)
  const anoLbl = `Ano ${ciclo}`

  // ADVENTO
  if (dom >= adventoEsteAno && dom < U(y, 12, 25)) {
    const n = semanas(adventoEsteAno, dom) + 1
    return { tempo:'ADVENTO', descricao:`${ORD(n)} Domingo do Advento, ${anoLbl}`,
             cor: n === 3 ? 'rosa' : 'roxo', auto:true }
  }
  // QUARESMA (após Cinzas, até Ramos exclusive)
  if (dom >= cinzas && dom < ramos) {
    const primeiroQuar = (() => { // 1º Domingo da Quaresma = domingo após as Cinzas
      const dw = cinzas.getUTCDay(); return new Date(cinzas.getTime() + ((7 - dw) % 7) * DIA)
    })()
    const n = semanas(primeiroQuar, dom) + 1
    return { tempo:'QUARESMA', descricao:`${ORD(n)} Domingo da Quaresma, ${anoLbl}`,
             cor: n === 4 ? 'rosa' : 'roxo', auto:true }
  }
  // RAMOS
  if (iso(dom) === iso(ramos)) {
    return { tempo:'QUARESMA', descricao:`Domingo de Ramos, ${anoLbl}`, cor:'vermelho', auto:true }
  }
  // PENTECOSTES
  if (iso(dom) === iso(pentecostes)) {
    return { tempo:'TEMPO PASCAL', descricao:`Domingo de Pentecostes, ${anoLbl}`, cor:'vermelho', auto:true }
  }
  // TEMPO PASCAL (Páscoa .. Pentecostes exclusive)
  if (dom >= P && dom < pentecostes) {
    const n = semanas(P, dom) + 1 // Páscoa = 1º Domingo da Páscoa
    const desc = n === 1 ? `Domingo de Páscoa, ${anoLbl}` : `${ORD(n)} Domingo da Páscoa, ${anoLbl}`
    return { tempo:'TEMPO PASCAL', descricao:desc, cor:'branco', auto:true }
  }
  // TEMPO COMUM
  // Parte 2 (após Pentecostes): numerar contando de trás pra frente até Cristo Rei (34º).
  if (dom > pentecostes && dom < adventoEsteAno) {
    const cristoRei = new Date(adventoEsteAno.getTime() - 7 * DIA)
    const n = 34 - semanas(dom, cristoRei)
    const desc = iso(dom) === iso(cristoRei)
      ? `Solenidade de Nosso Senhor Jesus Cristo, Rei do Universo, ${anoLbl}`
      : `${ORD(n)} Domingo do Tempo Comum, ${anoLbl}`
    return { tempo:'TEMPO COMUM', descricao:desc, cor:'verde', auto:true }
  }
  // Parte 1 (após Batismo do Senhor, antes das Cinzas): domingo após o Batismo = 2º Domingo do TC.
  // Batismo do Senhor = domingo após 06/01 (ou o próprio 06/01 se for domingo).
  const epifania = U(y, 1, 6)
  const batismo = new Date(epifania.getTime() + ((7 - epifania.getUTCDay()) % 7 || 7) * DIA)
  if (dom > batismo && dom < cinzas) {
    const n = semanas(batismo, dom) + 1
    return { tempo:'TEMPO COMUM', descricao:`${ORD(n)} Domingo do Tempo Comum, ${anoLbl}`, cor:'verde', auto:true }
  }

  // Fallback (Tempo do Natal e casos não cobertos) → verde/Tempo Comum; espera-se override.
  return { tempo:'TEMPO COMUM', descricao:`Domingo, ${anoLbl}`, cor:'verde', auto:true }
}

export function resolverLiturgico(domingoISO, override) {
  if (override && override.tempo && override.descricao && override.cor) {
    return { tempo:override.tempo, descricao:override.descricao, cor:override.cor, auto:false }
  }
  return liturgicoDoDomingo(domingoISO)
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd arte-escala && npx vitest run liturgico`
Expected: PASS (todos). Se algum nº de domingo divergir, ajustar o boundary e re-rodar (a âncora 12/07/2026=15º é a referência de ouro).

- [ ] **Step 5: Commit**

```bash
cd ~/iajcbp && git add arte-escala/liturgico.mjs arte-escala/liturgico.test.mjs
git commit -m "feat(arte-escala): cálculo litúrgico próprio + override

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

**Fim da Fase 1.** Deliverable: `npx vitest run` verde; lógica de datas e litúrgico pronta e testada.

---

## FASE 2 — Rótulos + Dados (Supabase)

### Task 3: Módulo de rótulos

**Files:**
- Create: `arte-escala/rotulos.js`
- Test: `arte-escala/rotulos.test.mjs`

**Interfaces:**
- Produces: `FUNCAO_LABEL` (objeto), `COMUNIDADE_ARTE` (objeto), `HOR_ORDEM` (array), `rotuloFuncao(cod, extra?)`, `rotuloComunidade(cod)`, `rankHorario(horario)`.

- [ ] **Step 1: Teste que falha**

```javascript
// arte-escala/rotulos.test.mjs
import { describe, it, expect } from 'vitest'
import { rotuloFuncao, rotuloComunidade, rankHorario, HOR_ORDEM } from './rotulos.js'

describe('rótulos', () => {
  it('funções conhecidas', () => {
    expect(rotuloFuncao('cred_altar')).toBe('Cerim. Altar')
    expect(rotuloFuncao('cred_credencia')).toBe('Cerim. Cred.')
    expect(rotuloFuncao('sinao')).toBe('Sinão')
  })
  it('função desconhecida cai no código', () => {
    expect(rotuloFuncao('xyz')).toBe('xyz')
  })
  it('função custom via extra', () => {
    expect(rotuloFuncao('novaf', { novaf: 'Nova' })).toBe('Nova')
  })
  it('comunidade → rótulo da arte', () => {
    expect(rotuloComunidade('matriz')).toBe('JCBP')
    expect(rotuloComunidade('santo_antonio')).toBe('STO. ANTONIO')
  })
  it('ordem dos horários', () => {
    expect(HOR_ORDEM).toEqual(['17h','18h30','7h','9h','19h'])
    expect(rankHorario('07h')).toBe(2) // normaliza 0 à esquerda
    expect(rankHorario('19h')).toBe(4)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd arte-escala && npx vitest run rotulos`
Expected: FAIL.

- [ ] **Step 3: Implementar**

```javascript
// arte-escala/rotulos.js  (espelha projetos/acolitos/escala.html:360-364)
export const FUNCAO_LABEL = {
  apoio:'Apoio', cruz:'Cruz', vela:'Vela', sineta:'Sineta', sinao:'Sinão',
  altar:'Altar', turibulo:'Turíbulo', naveta:'Naveta', missal:'Missal',
  cred_altar:'Cerim. Altar', cred_credencia:'Cerim. Cred.', mitra:'Mitra', baculo:'Báculo'
}
export const COMUNIDADE_ARTE = { matriz:'JCBP', santo_antonio:'STO. ANTONIO' }
export const HOR_ORDEM = ['17h','18h30','7h','9h','19h']

export function rotuloFuncao(cod, extra) {
  if (extra && extra[cod]) return extra[cod]
  return FUNCAO_LABEL[cod] || cod
}
export function rotuloComunidade(cod) {
  return COMUNIDADE_ARTE[cod] || String(cod || '').toUpperCase()
}
export function rankHorario(h) {
  const i = HOR_ORDEM.indexOf(String(h || '').replace(/^0/, ''))
  return i < 0 ? 99 : i
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd arte-escala && npx vitest run rotulos`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd ~/iajcbp && git add arte-escala/rotulos.js arte-escala/rotulos.test.mjs
git commit -m "feat(arte-escala): módulo de rótulos (funções, comunidade, horários)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Leitura do Supabase → objeto de dados da arte

**Files:**
- Create: `arte-escala/dados.mjs`
- Test: `arte-escala/dados.test.mjs`

**Interfaces:**
- Consumes: `rotulos.js`, `alvoFimDeSemana` (Task 1), `resolverLiturgico` (Task 2).
- Produces:
  - `montarMissas(celebracoes, escalasMap, funcExtra): Missa[]` — pura, ordena missas por `rankHorario`,
    cada `Missa = { comunidade, comunidadeLabel, horaHH, horaMM, dia, dataLabel, itens: {nome,funcao}[] }`
    com `itens` ordenados alfabeticamente por nome; só `status==='escalado'`.
  - `carregarDados(sb, { sabado, domingo }, override): Promise<DadosArte>` — usa o client Supabase para
    ler celebrações+escalas+funções custom e devolve o objeto completo pronto pro template.
  - `DadosArte = { tempo, descricao, cor, mesAno, sabadoLabel, domingoLabel, missasSabado, missasDomingo }`.

- [ ] **Step 1: Teste que falha (só a parte pura `montarMissas`)**

```javascript
// arte-escala/dados.test.mjs
import { describe, it, expect } from 'vitest'
import { montarMissas } from './dados.mjs'

const celebracoes = [
  { id:'c1', data:'2026-07-18', horario:'17h', comunidade:'matriz', tipo:'missa_comum' },
  { id:'c2', data:'2026-07-18', horario:'18h30', comunidade:'santo_antonio', tipo:'missa_comum' },
]
const escalasMap = {
  c1: [
    { funcao:'cruz', status:'escalado', acolitos_membros:{ nome:'Vitor Santana' } },
    { funcao:'apoio', status:'escalado', acolitos_membros:{ nome:'Ana Lima' } },
    { funcao:'altar', status:'ausente_justificado', acolitos_membros:{ nome:'Zzz Fulano' } },
  ],
  c2: [ { funcao:'altar', status:'escalado', acolitos_membros:{ nome:'Bruno X' } } ],
}

describe('montarMissas', () => {
  it('ordena missas por horário, filtra só escalados, ordena nomes A→Z', () => {
    const ms = montarMissas(celebracoes, escalasMap, {})
    expect(ms.map(m => m.horaHH + ':' + m.horaMM)).toEqual(['17:00','18:30'])
    expect(ms[0].comunidadeLabel).toBe('JCBP')
    expect(ms[0].dia).toBe('SÁBADO')
    expect(ms[0].itens.map(i => i.nome)).toEqual(['Ana Lima','Vitor Santana']) // ausente removido
    expect(ms[0].itens[0]).toEqual({ nome:'Ana Lima', funcao:'Apoio' })
    expect(ms[1].comunidadeLabel).toBe('STO. ANTONIO')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd arte-escala && npx vitest run dados`
Expected: FAIL.

- [ ] **Step 3: Implementar**

```javascript
// arte-escala/dados.mjs
import { rotuloFuncao, rotuloComunidade, rankHorario } from './rotulos.js'
import { resolverLiturgico } from './liturgico.mjs'

const MES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const DIA_SEMANA = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado']

function parseISO(s) { const [y,m,d] = s.split('-').map(Number); return new Date(Date.UTC(y,m-1,d)) }
function horaPartes(h) {
  const s = String(h || '').replace('h', ':').replace(/:$/, ':00')
  const [hh, mm] = s.split(':')
  return { HH: String(hh).padStart(2,'0'), MM: String(mm || '00').padStart(2,'0') }
}
function dataLabel(iso) {
  const d = parseISO(iso)
  return `${DIA_SEMANA[d.getUTCDay()]}, ${d.getUTCDate()} de ${MES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`
}

export function montarMissas(celebracoes, escalasMap, funcExtra) {
  return [...celebracoes]
    .sort((a,b) => rankHorario(a.horario) - rankHorario(b.horario))
    .map(c => {
      const { HH, MM } = horaPartes(c.horario)
      const d = parseISO(c.data)
      const itens = (escalasMap[c.id] || [])
        .filter(e => e.status === 'escalado' && e.acolitos_membros)
        .map(e => ({ nome: e.acolitos_membros.nome, funcao: rotuloFuncao(e.funcao, funcExtra) }))
        .sort((a,b) => a.nome.localeCompare(b.nome, 'pt'))
      return {
        comunidade: c.comunidade,
        comunidadeLabel: rotuloComunidade(c.comunidade),
        horaHH: HH, horaMM: MM,
        dia: d.getUTCDay() === 6 ? 'SÁBADO' : 'DOMINGO',
        dataLabel: dataLabel(c.data),
        itens,
      }
    })
}

export async function carregarDados(sb, { sabado, domingo }, override) {
  const { data: celebracoes, error: ce } = await sb
    .from('acolitos_celebracoes').select('*').in('data', [sabado, domingo])
  if (ce) throw ce
  const ids = celebracoes.map(c => c.id)
  const { data: esc, error: ee } = await sb
    .from('acolitos_escalas')
    .select('*, acolitos_membros!membro_id(id,nome)')
    .in('celebracao_id', ids)
  if (ee) throw ee
  const { data: fcustom } = await sb
    .from('acolitos_listas').select('valor,label').eq('tipo','funcao')
  const funcExtra = Object.fromEntries((fcustom || []).map(f => [f.valor, f.label]))

  const escalasMap = {}
  for (const e of esc) (escalasMap[e.celebracao_id] = escalasMap[e.celebracao_id] || []).push(e)

  const missas = montarMissas(celebracoes, escalasMap, funcExtra)
  const lit = resolverLiturgico(domingo, override)
  const dSab = parseISO(sabado)

  return {
    tempo: lit.tempo, descricao: lit.descricao, cor: lit.cor,
    mesAno: `${MES[dSab.getUTCMonth()].toUpperCase()} ${dSab.getUTCFullYear()}`,
    sabadoLabel: dataLabel(sabado), domingoLabel: dataLabel(domingo),
    missasSabado: missas.filter(m => m.dia === 'SÁBADO'),
    missasDomingo: missas.filter(m => m.dia === 'DOMINGO'),
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd arte-escala && npx vitest run dados`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd ~/iajcbp && git add arte-escala/dados.mjs arte-escala/dados.test.mjs
git commit -m "feat(arte-escala): leitura Supabase → dados da arte (montarMissas + carregarDados)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

**Fim da Fase 2.** Deliverable: dados prontos a partir de um fim de semana + override (parte pura testada; `carregarDados` exercitado na Fase 4 contra o banco real, leitura-só).

---

## FASE 3 — Assets + Template + Render

### Task 5: Recorte dos assets

**Files:**
- Create: `arte-escala/assets/brasao.png`, `bandeira-{verde,vermelho,branco,rosa,roxo}.png`
- Create: `arte-escala/assets/sora.woff2`, `arte-escala/assets/inter.woff2`

**Interfaces:**
- Produces: PNGs transparentes individuais (brasão + 5 bandeiras) e as duas fontes woff2.

- [ ] **Step 1: Recortar do `~/Downloads/elementos.png`**

Usar as coordenadas (imagem original 2160×4800). Ajustar as caixas conferindo visualmente cada recorte
antes de salvar. Ferramenta: `sips`/`ImageMagick` (ex.: `magick elementos.png -crop WxH+X+Y +repage saida.png`).
Elementos e posições aproximadas (multiplicar por 2.40 as coords vistas em preview 900×2000):
- `brasao.png`: topo-esquerda (~x140–830, y70–960 no original).
- `bandeira-verde.png`, `-vermelho.png`, `-branco.png`: fileira 1 (~y1180–1830).
- `bandeira-rosa.png`, `-roxo.png`: fileira 2 (~y1990–2620).

Salvar em `arte-escala/assets/`. **Verificar visualmente** cada PNG (abrir/`Read`) — fundo transparente, sem sobras dos vizinhos.

- [ ] **Step 2: Baixar as fontes**

Baixar `Sora` (peso 700/800) e `Inter` (400/600) em woff2 (Google Fonts) para `arte-escala/assets/`.
Fontes: `sora.woff2` (variável ou 700), `inter.woff2` (variável ou 400+600).

- [ ] **Step 3: Commit**

```bash
cd ~/iajcbp && git add arte-escala/assets/
git commit -m "assets(arte-escala): brasão + bandeiras (5 cores) + fontes Sora/Inter

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Template HTML fiel

**Files:**
- Create: `arte-escala/template.html`

**Interfaces:**
- Consumes: nada em runtime (recebe dados via substituição `__TOKEN__`/marcador `<!--MISSAS_SABADO-->` no `render.mjs`).
- Produces: um HTML de 2160×4800 com `#arte` como elemento raiz do screenshot.

- [ ] **Step 1: Escrever o template**

Requisitos concretos:
- `@font-face` de Sora e Inter com `src:url(data:font/woff2;base64,__SORA__)`/`__INTER__` (injetadas no render).
- Raiz `#arte { width:2160px; height:4800px; background:#F4E9D8; position:relative; font-family:'Inter'; }`.
- Cabeçalho: `<img id="brasao">` + `ESCALA - SERVIDORES DO ALTAR` (Sora 800, letter-spacing) +
  `__TEMPO__` (Sora 800, grande) + `__MES_ANO__` (Sora 800).
- Duas seções (sábado/domingo): cada uma com `<img class="bandeira">` (src = `bandeira-__COR__.png`),
  `__SABADO_LABEL__`/`__DOMINGO_LABEL__` (Inter) e `__DESCRICAO__` (Sora).
- Componente de **missa** (template JS-string em `render.mjs`, não aqui): pill (fundo=cor litúrgica via
  classe `.cor-verde/.cor-roxo/...`; `.cor-branco,.cor-rosa` → `color:#2B1C0E`), comunidade+dia, hora HH/MM/H,
  e a lista `<li>Nome <span class="fn">- Função</span></li>` com bolinha de rosário (`::before`), rosário
  central (`.rosario` com repetição de contas) e cruz (`.cruz`, SVG inline) no fim.
- Definir as 5 cores: `--verde:#0F5E3D; --vermelho:#9E2A2B; --branco:#FBF7EC; --rosa:#E8A6C4; --roxo:#4B2E63; --ouro:#D9A441;`
  (afinar comparando com `teste.png`).

- [ ] **Step 2: Commit**

```bash
cd ~/iajcbp && git add arte-escala/template.html
git commit -m "feat(arte-escala): template HTML fiel ao modelo (2160x4800)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Render Puppeteer → PNG + validação visual

**Files:**
- Create: `arte-escala/render.mjs`

**Interfaces:**
- Consumes: `template.html`, assets.
- Produces: `renderPNG(dados: DadosArte): Promise<Buffer>` — injeta assets (base64) + dados no template,
  monta o HTML das missas, abre no Puppeteer e faz screenshot de `#arte` (2160×4800).

- [ ] **Step 1: Implementar `render.mjs`**

```javascript
// arte-escala/render.mjs
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import puppeteer from 'puppeteer'

const DIR = dirname(fileURLToPath(import.meta.url))
const b64 = async p => (await readFile(join(DIR, p))).toString('base64')

function missaHTML(m, cor) {
  const itens = m.itens.length
    ? m.itens.map(i => `<li>${i.nome} <span class="fn">- ${i.funcao}</span></li>`).join('')
    : `<li class="vazia">(escala não montada)</li>` // missa sem escalados ainda
  return `<div class="missa cor-${cor}">
    <div class="pill"><span class="com">${m.comunidadeLabel}</span><span class="dia">${m.dia}</span>
      <span class="hora"><b>${m.horaHH}</b><b>${m.horaMM}</b></span><span class="h">H</span></div>
    <ul class="lista">${itens}</ul><div class="cruz"></div>
  </div>`
}

export async function renderPNG(dados) {
  let html = await readFile(join(DIR, 'template.html'), 'utf8')
  const subs = {
    __SORA__: await b64('assets/sora.woff2'),
    __INTER__: await b64('assets/inter.woff2'),
    __BRASAO__: await b64('assets/brasao.png'),
    __BANDEIRA__: await b64(`assets/bandeira-${dados.cor}.png`),
    __TEMPO__: dados.tempo, __MES_ANO__: dados.mesAno, __DESCRICAO__: dados.descricao,
    __SABADO_LABEL__: dados.sabadoLabel, __DOMINGO_LABEL__: dados.domingoLabel, __COR__: dados.cor,
  }
  for (const [k, v] of Object.entries(subs)) html = html.replaceAll(k, v)
  html = html
    .replace('<!--MISSAS_SABADO-->', dados.missasSabado.map(m => missaHTML(m, dados.cor)).join(''))
    .replace('<!--MISSAS_DOMINGO-->', dados.missasDomingo.map(m => missaHTML(m, dados.cor)).join(''))

  const browser = await puppeteer.launch({ args: ['--no-sandbox'] })
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 2160, height: 4800, deviceScaleFactor: 1 })
    await page.setContent(html, { waitUntil: 'networkidle0' })
    await page.evaluateHandle('document.fonts.ready')
    const el = await page.$('#arte')
    return await el.screenshot({ type: 'png' })
  } finally {
    await browser.close()
  }
}
```

- [ ] **Step 2: Gerar um PNG de prova com dados do modelo**

Criar um script temporário `arte-escala/_prova.mjs` que monta os `DadosArte` do fim de semana 18–19/07
(ou os do próprio `teste.png`, 11–12/07) manualmente e chama `renderPNG`, salvando `prova.png`.
Run: `cd arte-escala && node _prova.mjs`
Expected: gera `arte-escala/prova.png` 2160×4800.

- [ ] **Step 3: Validação visual**

`Read` `arte-escala/prova.png` e comparar com `~/Downloads/teste.png`: layout das 2 seções, 5 pills, cores,
fontes Sora/Inter, bandeira verde, rosário/cruz, listas alfabéticas. Ajustar `template.html`/CSS e
re-renderizar até ficar fiel. Remover `_prova.mjs`/`prova.png` ao final (não versionar).

- [ ] **Step 4: Commit**

```bash
cd ~/iajcbp && git add arte-escala/render.mjs
git commit -m "feat(arte-escala): render Puppeteer → PNG 2160x4800 (validado vs modelo)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

**Fim da Fase 3.** Deliverable: PNG fiel ao modelo a partir de um `DadosArte`.

---

## FASE 4 — Orquestração + Infra

### Task 8: Migrations (tabelas + bucket)

**Files:**
- Create: `db/migrations/0XX_arte_escala.sql` (usar o próximo número livre da pasta)

**Interfaces:**
- Produces: tabelas `acolitos_escala_artes`, `acolitos_liturgia_override`; bucket público `artes-escala`.

- [ ] **Step 1: Escrever a migration**

```sql
-- Tabela de artes geradas
create table if not exists acolitos_escala_artes (
  domingo_data date primary key,
  png_url text not null,
  tempo text, descricao text, cor text,
  gerado_em timestamptz not null default now(),
  gerado_por text not null default 'cron'
);
-- Override litúrgico manual
create table if not exists acolitos_liturgia_override (
  domingo_data date primary key,
  tempo text not null, descricao text not null, cor text not null,
  criado_por uuid, criado_em timestamptz not null default now()
);
-- Bucket público de artes
insert into storage.buckets (id, name, public)
values ('artes-escala','artes-escala', true)
on conflict (id) do nothing;

-- RLS: leitura das artes/override liberada a membros ativos; escrita do override só coordenação.
alter table acolitos_escala_artes enable row level security;
alter table acolitos_liturgia_override enable row level security;
create policy artes_read on acolitos_escala_artes for select using (true);
create policy override_read on acolitos_liturgia_override for select using (true);
create policy override_write on acolitos_liturgia_override for all
  using (exists (select 1 from pastoral_members pm join pastoral_modules pmod on pmod.id=pm.module_id
    where pm.user_id = auth.uid() and pmod.slug='acolitos' and pm.role in ('coord_admin','subadmin')))
  with check (exists (select 1 from pastoral_members pm join pastoral_modules pmod on pmod.id=pm.module_id
    where pm.user_id = auth.uid() and pmod.slug='acolitos' and pm.role in ('coord_admin','subadmin')));
```

- [ ] **Step 2: Aplicar via MCP Supabase**

Aplicar com `apply_migration` (nome `arte_escala`). Depois `list_tables` confirmando as 2 tabelas e o bucket.
Expected: tabelas criadas, bucket `artes-escala` público.

- [ ] **Step 3: Commit**

```bash
cd ~/iajcbp && git add db/migrations/0XX_arte_escala.sql
git commit -m "feat(db): tabelas de arte da escala + override litúrgico + bucket

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 9: Orquestrador `gerar.mjs`

**Files:**
- Create: `arte-escala/gerar.mjs`

**Interfaces:**
- Consumes: `alvoFimDeSemana`, `carregarDados`, `renderPNG`.
- Produces: script executável que lê env, gera e publica a arte; sai com código ≠0 em erro.

- [ ] **Step 1: Implementar**

```javascript
// arte-escala/gerar.mjs
import { createClient } from '@supabase/supabase-js'
import { alvoFimDeSemana } from './fim-de-semana.mjs'
import { carregarDados } from './dados.mjs'
import { renderPNG } from './render.mjs'

const URL = process.env.SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !KEY) { console.error('Faltam SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY'); process.exit(1) }

const sb = createClient(URL, KEY, { auth: { persistSession: false } })

async function main() {
  const { sabado, domingo } = alvoFimDeSemana(new Date())
  console.log('Fim de semana alvo:', sabado, domingo)

  const { data: ov } = await sb.from('acolitos_liturgia_override')
    .select('*').eq('domingo_data', domingo).maybeSingle()

  const dados = await carregarDados(sb, { sabado, domingo }, ov || null)
  const todas = [...dados.missasSabado, ...dados.missasDomingo]
  const totalEscalados = todas.reduce((n, m) => n + m.itens.length, 0)
  if (!todas.length) {
    console.error('Sem celebrações para o fim de semana — nada a gerar.'); process.exit(1)
  }
  if (totalEscalados === 0) {
    // Celebrações existem, mas a escala ainda não foi montada no app → não publica arte vazia.
    console.error('Escala ainda não gerada para o fim de semana — nada a publicar.'); process.exit(1)
  }
  const png = await renderPNG(dados)

  const path = `${domingo}.png`
  const up = await sb.storage.from('artes-escala').upload(path, png, {
    contentType: 'image/png', upsert: true })
  if (up.error) throw up.error
  const { data: pub } = sb.storage.from('artes-escala').getPublicUrl(path)

  const gerado_por = process.env.GERADO_POR || 'cron'
  const { error: te } = await sb.from('acolitos_escala_artes').upsert({
    domingo_data: domingo, png_url: pub.publicUrl,
    tempo: dados.tempo, descricao: dados.descricao, cor: dados.cor,
    gerado_em: new Date().toISOString(), gerado_por })
  if (te) throw te
  console.log('Arte publicada:', pub.publicUrl)
}
main().catch(e => { console.error(e); process.exit(1) })
```

- [ ] **Step 2: Rodar localmente (leitura + geração reais, escrita no bucket de teste)**

Exportar `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` (pegar via MCP `get_project_url`/keys — **service key só no shell, nunca commitada**).
Run: `cd arte-escala && SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... GERADO_POR=manual node gerar.mjs`
Expected: imprime a URL pública; `Read` da URL/arquivo confirma a arte do fim de semana seguinte.

- [ ] **Step 3: Commit**

```bash
cd ~/iajcbp && git add arte-escala/gerar.mjs
git commit -m "feat(arte-escala): orquestrador gerar.mjs (alvo→dados→render→Storage)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 10: GitHub Actions (cron + dispatch)

**Files:**
- Create: `.github/workflows/arte-escala.yml`

**Interfaces:**
- Produces: workflow agendado (dom 21h BRT) + `workflow_dispatch`.

- [ ] **Step 1: Escrever o workflow**

```yaml
name: Arte da Escala
on:
  schedule:
    - cron: '0 0 * * 1'   # segunda 00:00 UTC = domingo 21h BRT
  workflow_dispatch:
jobs:
  gerar:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
        working-directory: arte-escala
      - run: node gerar.mjs
        working-directory: arte-escala
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          GERADO_POR: ${{ github.event_name == 'workflow_dispatch' && 'manual' || 'cron' }}
```

- [ ] **Step 2: Configurar secrets do repo**

No repo `erickjcbp/iajcbp` (conta `erickjcbp`): adicionar secrets `SUPABASE_URL` e
`SUPABASE_SERVICE_ROLE_KEY` (`gh secret set ... --repo erickjcbp/iajcbp`, com `gh auth switch --user erickjcbp`).
Trocar `puppeteer` deps do runner: `npm ci` já baixa o Chromium do puppeteer no ubuntu-latest.

- [ ] **Step 3: Disparar manualmente e conferir**

Run: `gh workflow run "Arte da Escala" --repo erickjcbp/iajcbp` → acompanhar `gh run watch`.
Expected: run verde; nova linha em `acolitos_escala_artes` e PNG no bucket.

- [ ] **Step 4: Commit**

```bash
cd ~/iajcbp && git add .github/workflows/arte-escala.yml
git commit -m "ci(arte-escala): workflow cron domingo 21h BRT + dispatch

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

**Fim da Fase 4.** Deliverable: arte gerada e publicada automaticamente/on-demand pelo GitHub Actions.

---

## FASE 5 — App UI

### Task 11: Função Vercel de regeneração

**Files:**
- Create: `api/regenerar-arte.js`

**Interfaces:**
- Consumes: token do usuário (Authorization Bearer), env `SUPABASE_URL/ANON`, `GH_PAT`, `GH_REPO`.
- Produces: POST autenticado (coord) → dispara `workflow_dispatch` do GitHub → 202.

- [ ] **Step 1: Implementar (espelhando o padrão de `api/acolito-admin.js`)**

```javascript
// api/regenerar-arte.js — dispara o workflow da arte (só coordenação)
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const URL = process.env.SUPABASE_URL, ANON = process.env.SUPABASE_ANON_KEY
  const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY
  const GH_PAT = process.env.GH_PAT, GH_REPO = process.env.GH_REPO // ex.: erickjcbp/iajcbp
  if (!URL || !ANON || !SRK || !GH_PAT || !GH_REPO) return res.status(500).json({ error:'Server misconfigured' })

  const token = (req.headers.authorization || '').replace('Bearer ', '')
  if (!token) return res.status(401).json({ error:'Token ausente' })
  const uRes = await fetch(`${URL}/auth/v1/user`, { headers:{ apikey:ANON, Authorization:`Bearer ${token}` } })
  if (!uRes.ok) return res.status(401).json({ error:'Token inválido' })
  const caller = await uRes.json()

  const h = { apikey:SRK, Authorization:`Bearer ${SRK}` }
  const mod = (await (await fetch(`${URL}/rest/v1/pastoral_modules?slug=eq.acolitos&select=id`, { headers:h })).json())[0]
  if (!mod) return res.status(500).json({ error:'Módulo não encontrado' })
  const role = (await (await fetch(`${URL}/rest/v1/pastoral_members?user_id=eq.${caller.id}&module_id=eq.${mod.id}&select=role`, { headers:h })).json())[0]?.role
  if (!['coord_admin','subadmin'].includes(role)) return res.status(403).json({ error:'Acesso negado' })

  const gh = await fetch(`https://api.github.com/repos/${GH_REPO}/actions/workflows/arte-escala.yml/dispatches`, {
    method:'POST',
    headers:{ Authorization:`Bearer ${GH_PAT}`, Accept:'application/vnd.github+json', 'X-GitHub-Api-Version':'2022-11-28' },
    body: JSON.stringify({ ref:'main' }),
  })
  if (!gh.ok) return res.status(502).json({ error:'Falha ao disparar', detalhe: await gh.text() })
  return res.status(202).json({ ok:true })
}
```

- [ ] **Step 2: Configurar envs no Vercel**

No projeto Vercel `iajcbp` (conta `erickjcbp-1650`): adicionar `GH_PAT` (fine-grained PAT com `actions:write`
em `erickjcbp/iajcbp`) e `GH_REPO=erickjcbp/iajcbp`. `SUPABASE_*` já existem.

- [ ] **Step 3: Commit**

```bash
cd ~/iajcbp && git add api/regenerar-arte.js
git commit -m "feat(api): regenerar-arte dispara o workflow (só coordenação)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 12: Botões + modal + override na tela de Escala

**Files:**
- Modify: `projetos/acolitos/escala.html` (toolbar `.escala-acoes` ~l.142; funções JS perto de `escalaPDF` ~l.1123)

**Interfaces:**
- Consumes: `sb` (client global), `ctx.membership.role`, tabelas `acolitos_escala_artes`/`acolitos_liturgia_override`, `api/regenerar-arte.js`.

- [ ] **Step 1: Adicionar o botão na toolbar**

Após o botão `🖨 Escala PDF` (l.148), adicionar (gate coordenação — só renderiza se
`['coord_admin','subadmin'].includes(ctx.membership.role)`):

```html
<button class="btn-sm gray" onclick="abrirArteSemana()" title="Arte da escala (PNG)">🎨 Arte da semana</button>
```

- [ ] **Step 2: Implementar `abrirArteSemana()` (modal com preview + baixar + gerar + override)**

```javascript
// perto de escalaPDF() em escala.html
async function abrirArteSemana(){
  // domingo alvo = próximo domingo estritamente após hoje
  const now = new Date(); const dow = now.getDay();
  const addDom = ((7 - dow) % 7) || 7;
  const dAlvo = new Date(now.getFullYear(), now.getMonth(), now.getDate()+addDom);
  const domISO = dAlvo.toISOString().slice(0,10);

  const { data: arte } = await sb.from('acolitos_escala_artes').select('*').eq('domingo_data', domISO).maybeSingle();
  const { data: ov } = await sb.from('acolitos_liturgia_override').select('*').eq('domingo_data', domISO).maybeSingle();

  const md = document.getElementById('modal-body'); // usar o modal padrão do shared.js
  md.innerHTML = `
    <div class="modal-title">🎨 Arte — ${domISO}</div>
    ${arte ? `<img src="${arte.png_url}" style="max-width:100%;border-radius:8px"/>
      <a class="btn-sm" href="${arte.png_url}" download>⬇ Baixar</a>`
      : `<p class="muted">Ainda não gerada para este fim de semana.</p>`}
    <hr>
    <label>Tempo litúrgico<input id="ov-tempo" value="${ov?.tempo||''}" placeholder="ex.: TEMPO COMUM"></label>
    <label>Descrição<input id="ov-desc" value="${ov?.descricao||''}" placeholder="ex.: 16º Domingo do Tempo Comum, Ano A"></label>
    <label>Cor
      <select id="ov-cor">${['','verde','vermelho','branco','rosa','roxo'].map(c=>`<option ${ov?.cor===c?'selected':''}>${c}</option>`).join('')}</select>
    </label>
    <button class="btn-sm" onclick="salvarOverrideEArte('${domISO}')">💾 Salvar override</button>
    <button class="btn-sm" onclick="regenerarArte()">♻ Gerar/Atualizar</button>`;
  abrirModal(); // helper do shared.js
}

async function salvarOverrideEArte(domISO){
  const tempo=val('ov-tempo'), descricao=val('ov-desc'), cor=val('ov-cor');
  if (tempo && descricao && cor) {
    const { error } = await sb.from('acolitos_liturgia_override')
      .upsert({ domingo_data:domISO, tempo, descricao, cor, criado_por: ctx.conta?.user_id });
    if (error) return toast('Erro ao salvar override','error');
  } else {
    await sb.from('acolitos_liturgia_override').delete().eq('domingo_data', domISO);
  }
  toast('Override salvo. Clique em Gerar/Atualizar.','success');
}
function val(id){ return document.getElementById(id).value.trim(); }

async function regenerarArte(){
  const { data:{ session } } = await sb.auth.getSession();
  const r = await fetch('/api/regenerar-arte', { method:'POST',
    headers:{ Authorization:`Bearer ${session.access_token}` } });
  toast(r.ok ? 'Geração disparada — aguarde ~1min e reabra.' : 'Falha ao disparar', r.ok?'success':'error');
}
```

Ajustar os helpers (`abrirModal`, `toast`, id do corpo do modal) aos nomes reais do `shared.js` — conferir antes de implementar.

- [ ] **Step 3: Validar no app (staging)**

Conferir num deploy/preview: botão aparece só para coordenação; modal mostra a arte (se houver), baixa o
PNG, salva override, e "Gerar/Atualizar" retorna 202. Não usar dados reais destrutivos.

- [ ] **Step 4: Commit**

```bash
cd ~/iajcbp && git add projetos/acolitos/escala.html
git commit -m "feat(escala): botão Arte da semana (preview/baixar/gerar/override)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

**Fim da Fase 5.** Deliverable: coordenação baixa a arte, ajusta override e regenera pelo app.

---

## Validação final (ponta a ponta)

1. `cd arte-escala && npx vitest run` → tudo verde.
2. Disparar o workflow manual → PNG no bucket + linha na tabela.
3. App → Escala → 🎨 Arte da semana → preview + baixar OK.
4. Override numa data de teste → Gerar/Atualizar → arte reflete o override.
5. Comparação visual da arte gerada vs. `teste.png` (fidelidade).

## Notas de deploy

- Deployar do **root** do repo (Vercel), conta `erickjcbp`.
- Secrets GitHub (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) e envs Vercel (`GH_PAT`, `GH_REPO`) são pré-requisito das Fases 4/5.
- Service role key **nunca** entra no repo nem no front — só em secrets/CI.
