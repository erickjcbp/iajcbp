# Escala automática do São Tarcísio — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On Tuesday 18:01 the system generates the coming weekend's schedule, sends it to the owner's WhatsApp with Confirmar/Revisar buttons, confirms and sends the art to the 4 groups on Confirmar, reminds everyone about absences Sun–Tue, and places servers in the same Mass as their minister parent using the monthly ministers' PDF.

**Architecture:** The generator leaves `escala.html` and becomes a pure module used by the app and by the robot. The robot (Node, VPS, `tarcisio-robo/`) gets three new duties: absence reminder, Tuesday generation + owner conference, inbound handling (buttons and PDF). App and robot talk only through `tarcisio_*` / `acolitos_*` tables. The ministers' PDF is parsed by one pure module that runs in the browser (upload) and in Node (WhatsApp).

**Tech Stack:** Vanilla JS modules (UMD style like `confirmar-escala-core.js`), Node 20 `node --test`, Supabase Postgres + RLS, Evolution API, pdf.js (browser, vendored) and a PDF text library in the robot image, Playwright proofs in `projetos/acolitos/provas/`.

**Spec:** `docs/superpowers/specs/2026-10-20-escala-automatica-design.md`

## Global Constraints

- Generating is a **draft**: nothing notifies a server or reaches a group before the owner confirms (rule of 18/08/2026). The art goes once; a confirmed week never changes.
- Week generated: the **coming Saturday and Sunday**, Masses already in `acolitos_celebracoes`. Time zone `America/Sao_Paulo`.
- Minimum **2× per month for everybody**; when no one else is eligible a person may pass 2×. Hard rules never relaxed: qualification (kits), absence, availability, not twice in one Mass, not twice in the weekend.
- Owner conference number default **5519999071702**, stored in Settings, never in code. Only that number (and listed coordinator numbers for the PDF) is obeyed.
- Absence notice gives **`https://coroinhas.jcbplimeira.com.br/ausencias` or the app**, deadline Tuesday 18:00.
- Responsive rule on every screen touched: no `max-width`+`margin:auto` on pages, 44 px targets, 16 px fields, dialogs full screen on phone, no horizontal scroll; photograph at 375, 768, 1366, 2560.
- Never write real assignments or messages in tests. Anything run against production uses a transaction with `ROLLBACK` or fixtures; prove the "lets it through" path too, not only the block.
- Behaviour of the existing generator must stay identical for the same input.
- Migrations continue at **104**; apply with `psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -1 -f`. Tests: `cd tarcisio-robo && node --test`; app: `cd projetos/acolitos && node --test *.test.js`; screens: `npm run provar-telas`.
- Do not touch the unrelated uncommitted files (`LEIA-ME.txt` deletions, `docs/pendencias.md`, `criar-logins/tirar-fotos.mjs`). Commit only the files each task lists.

## Review Focus

1. Robot restarts between 18:01 and the owner's answer: no second generation, no second message (state lives in `tarcisio_escala_auto`).
2. Owner presses Confirmar twice, or confirms in the app first: nothing is sent twice.
3. A button or PDF arrives from a number that is not the owner's: ignored, no answer.
4. Two members fit the same abbreviated name ("Rita E."): asked, never guessed; a remembered "no" is not asked again; a memory whose parent name changed is ignored.
5. Week has no Masses / is already confirmed / generator throws: nothing written, owner told why.
6. The PDF is an unknown layout or has zero matches: schedule still generates, owner told "escala dos ministros não lida".

---

### Task 1: Extract the generator into a pure module

**Files:**
- Create: `projetos/acolitos/gerador-escala-core.js`, `projetos/acolitos/gerador-escala-core.test.js`, `projetos/acolitos/fixtures/gerador-semana.json`
- Modify: `projetos/acolitos/escala.html` (≈ lines 975–1360: `elegivelFuncao`, `planejarVagas`, `gerarEscalaSemana`, `gerarEscalaAuto`), loads `<script src="gerador-escala-core.js">`

**Interfaces:**
- Produces: `GeradorEscalaCore.gerarSemana(entrada) -> { novas: {celebracao_id, membro_id, funcao}[], vazias: {celebracao_id, funcao}[], alemDoMinimo: {membro_id, vezes}[], semanalPendentes: string[] }` where `entrada = { celebracoes, membros, habMap, dispMap, escalasExistentes, ausencias /* {celebracao_id: Set<membro_id>} */, historicoSemanal, carga /* {membro_id: peso} */, config: { gerador, funcoes_maiores, minimo_mes }, modeloFor /* (tipo, comunidade) => {funcao}[] */, rnd /* () => number */ }`.
- Consumes (already pure, loaded by `require` in Node): `kits-core.js` (`podeNaFuncao`, `normalizarKits`), `servir-semanal-core.js` (`SemanalCore.pode/reservar/situacao`), `rodizio-core.js` (`RodizioCore.PESO_MES`).

- [ ] **Step 1:** Capture a fixture: in `escala.html` console, dump the inputs of one real `gerarEscalaSemana` call for a past weekend (members anonymised to ids) into `fixtures/gerador-semana.json`, plus the assignments the OLD inline code produced with `Math.random` seeded (`rnd` stub). Test `gerador-escala-core.test.js` named `"mesmo resultado do código antigo na semana de referência"` asserts `deepEqual(gerarSemana(entrada).novas, fixture.esperado)`.
- [ ] **Step 2:** Run `node --test gerador-escala-core.test.js`. Expected: FAIL (module missing).
- [ ] **Step 3:** Implement the module by **moving** the logic, not rewriting it: replace page globals with fields of `entrada`, replace `Math.random` with `entrada.rnd`, return data instead of inserting. Keep tie-break order identical.
- [ ] **Step 4:** In `escala.html` keep only: load data, call `gerarSemana({... rnd: Math.random})`, insert `novas`, show alerts. Keep the "ninguém é avisado" comment.
- [ ] **Step 5:** Run the new test and the full app suite (`node --test *.test.js`, expect 417+ pass, 0 fail) and `npm run provar-telas` filtered to Escala. Prove by mutation: change the `usadoFds` check in the module, the parity test must fail; restore.
- [ ] **Step 6:** Commit `escala: gerador vira módulo puro (mesmo resultado)` with only the files above.

### Task 2: Minimum 2× and beyond-minimum fallback

**Files:** Modify `gerador-escala-core.js`; Test `gerador-escala-core.test.js`; Modify the Settings "Regras do gerador" section in `config.html` (new field **Mínimo por mês**, default 2, saved in `acolitos_config.gerador.minimo_mes`).

**Interfaces:** Consumes Task 1. Produces `entrada.config.minimo_mes` (number, default 2) and `alemDoMinimo` filled.

- [ ] **Step 1:** Tests: `"vaga sem ninguém abaixo de 2× é preenchida por quem já serviu 2×, o menos servido primeiro"`; `"nunca escala quem está ausente, sem habilitação ou já na missa, mesmo faltando gente"`; `"alemDoMinimo lista fulano com 3 vezes"`; `"com todos acima do mínimo e vaga cheia nada muda"`.
- [ ] **Step 2:** Run, expect FAIL. Step 3: after the greedy pass, run a second pass over still-empty slots with the candidate filter unchanged except the month-load ceiling removed; record who passed `minimo_mes`.
- [ ] **Step 4:** Add the settings field (read/write through the existing `cfg`/`setConfig` helpers). Run suite + a screen proof of the field at 4 widths. Commit `gerador: mínimo mensal e quem passa do mínimo`.

### Task 3: Migration 104 (tables, settings, RLS)

**Files:** Create `docs/migrations/104_escala_automatica.sql`; Modify `db/estrutura-completa.sql` (regenerated with `pg_dump --schema-only`).

**Interfaces:** Produces tables:
- `tarcisio_escala_auto(semana date primary key /* Saturday */, estado text check in ('gerando','aguardando','em_revisao','confirmada','falhou','sem_missas','ja_confirmada'), gerada_em timestamptz, resumo jsonb, mensagem_dono_id text, lembretes int default 0, erro text)`.
- `acolitos_escala_ministros(id, mes date, data date, horario text, comunidade text, membro_id uuid references acolitos_membros, pai_ou_mae text check in ('pai','mae'), arquivo text, unique(data,horario,comunidade,membro_id))`.
- `acolitos_ministro_apelidos(id, nome_pdf text /* normalised with nomeLimpo */, membro_id uuid, pai_ou_mae text, resposta text check in ('sim','nao'), respondido_por text, em timestamptz default now(), unique(nome_pdf,membro_id,pai_ou_mae))`.
- Columns on `tarcisio_config`: `numero_conferencia text default '5519999071702'`, `remetentes_pdf text[] default '{}'`, `ausencia_horas text[] default '{09:00}'`, `ausencia_ultimo text default '15:00'`, `ausencia_texto text`.
- RLS: coordination (`tarcisio_pode_gerir()`) manages all three; robot uses the service key; `anon` has no grant.

- [ ] **Step 1:** Write the SQL; wrap a proof script that runs it inside `begin; ... rollback;` and checks `anon` cannot select and a non-coordinator authenticated user cannot insert.
- [ ] **Step 2:** Apply for real, then `select` the new columns and defaults. Regenerate `db/estrutura-completa.sql`. Commit.

### Task 4: Ministers' PDF parser and name matching (pure)

**Files:** Create `projetos/acolitos/escala-ministros-core.js`, `escala-ministros-core.test.js`, `fixtures/escala-ministros-outubro.txt` (the extracted text of `ESCALA OUTUBRO REV01 (1).pdf` from Drive folder MECE, id `1f-W2zWUJDBF__jMMrnAs1S3h48l_YRWg`); copy the module to `tarcisio-robo/escala-ministros-core.mjs` through a build step (`npm run sincronizar-core` in the robot) so there is one source.

**Interfaces:**
- Produces `lerEscalaMinistros(texto: string, ano: number) -> { data: 'YYYY-MM-DD', horario: string /* '7h','17h','18h30' */, comunidade: 'matriz'|'santo_antonio'|'outra', nomes: string[] }[]`. Names are tokens like `"Rita E."`, `"Cristiana M."`, `"Luís"`.
- Produces `casarNomes(lidos, membros, apelidos) -> { casados: {data,horario,comunidade,membro_id,pai_ou_mae,nome}[], duvidas: {nome, opcoes: {membro_id, pai_ou_mae, rotulo}[]}[], ignorados: string[] }`; match = first name + optional initial against `nome_pai_ministro`/`nome_mae_ministro` (accents, case ignored via `nomeLimpo`); a remembered `sim` is a match, a remembered `nao` removes that option; a memory is used only if that member still has that parent flag and a name that normalises the same.

- [ ] **Step 1:** Tests on the October fixture: `"lê 'SÁBADO 24/out' 17h Matriz com os nomes certos"`; `"Santo Antônio 18h30 do sábado 24"`; `"dom 25/10 7h, 9h e 19h"`; `"data especial 12/out entra"`; `"nome com inicial casa só quem tem a inicial"`; `"dois 'Luís' viram dúvida com as duas opções"`; `"sim lembrado casa sozinho"`; `"não lembrado não volta como dúvida"`; `"memória de pai que mudou de nome é ignorada"`; `"texto vazio ou de outro layout devolve [] sem lançar"`.
- [ ] **Step 2:** Run, FAIL. Step 3: implement; the PDF text order is date heading → time → names, with community markers ("SANTO ANTÔNIO") separate, so parse by a state machine over tokens, not by line.
- [ ] **Step 4:** Run, PASS. Mutation: break the initial rule, a test fails. Commit.

### Task 5: Reserve the child in the generator

**Files:** Modify `gerador-escala-core.js`; Test `gerador-escala-core.test.js`.

**Interfaces:** Consumes Task 4 output as `entrada.ministros: {data, horario, comunidade, membro_id}[]`. Produces `gerarSemana(...).semVagaFilhoDeMinistro: {membro_id, motivo}[]`.

- [ ] **Step 1:** Tests: `"filho entra na missa em que a mãe serve"`; `"mãe em duas missas do fim de semana: filho na primeira em que cabe, uma só vez"`; `"filho ausente não é escalado e aparece em semVagaFilhoDeMinistro"`; `"filho sem habilitação para nenhuma vaga aberta não é forçado"`; `"sem ministros o resultado é igual ao da Task 2"`.
- [ ] **Step 2:** Run, FAIL. Step 3: reserve before the greedy pass, same place as `SemanalCore.reservar`; reserved child still passes the hard rules. Apply to every member with a minister parent; read how `escalar_com_pais` is used on screen first and, if it is an opt-out, honour it (record the finding in the commit message).
- [ ] **Step 4:** Run, PASS. Commit.

### Task 6: Shared "confirm week" rule

**Files:** Create `projetos/acolitos/confirmar-semana-core.js` + test; Modify `escala.html` (`confirmarEscalaSemana` ≈ line 1213) and `api/enviar-push.js`.

**Interfaces:** Produces `confirmarSemana({ sb, enviarPush, chaveSemana, celebracoes, escalas }) -> { avisados: number, jaTodosAvisados: boolean }`: uses `aNotificar`, reads/writes `acolitos_config.escala_avisados`, marks avisados only after the push succeeds, then calls the art request RPC `tarcisio_pedir_escala(p_domingo)`. Screen passes `enviarPush` = `apiPost('/api/enviar-push', …)`; the robot passes a function that calls the same endpoint with the robot secret.
- Decision: add push type `escalado_robo` to `api/enviar-push.js`, authorised exactly like type `arte` (shared secret, `segredoConfere`), body `{ membros: uuid[] }`, text identical to type `escalado`.

- [ ] **Step 1:** Tests with fake `sb`/`enviarPush`: `"avisa só quem ainda não foi avisado"`; `"push falha: ninguém é marcado como avisado"`; `"segunda chamada não avisa nem pede arte de novo"`; `"gravar avisados falha: devolve erro claro"`.
- [ ] **Step 2:** Run, FAIL. Step 3: move the non-UI body of `confirmarEscalaSemana` into the module; the screen keeps `uiConfirm`/`uiAlert`. Step 4: add `escalado_robo` in the API with a test in the existing API tests style (wrong secret → 401).
- [ ] **Step 5:** Run app suite + Escala screen proof, commit.

### Task 7: Robot — absence reminder

**Files:** Modify `tarcisio-robo/robo.mjs` (`gerarAvisos` ≈ line 99), `tarcisio-robo/regras.mjs`; Test `regras.test.mjs`, `robo.test.mjs`.

**Interfaces:** Produces `regras.lembreteAusenciaAgora(agoraSP, cfg) -> { texto: string } | null` — non-null only Sunday–Tuesday, at each time in `cfg.ausencia_horas` and at `cfg.ausencia_ultimo` on Tuesday, never after Tuesday 18:00, once per (day, time). Text default: lists link `https://coroinhas.jcbplimeira.com.br/ausencias` **or** the app and "até terça, 18h".

- [ ] **Step 1:** Tests: `"domingo 9h devolve texto com o link e o prazo"`; `"quarta 9h devolve null"`; `"terça 18h01 devolve null"`; `"terça 15h devolve o último lembrete"`; `"pausa geral suprime"`; `"a mesma hora não repete na mesma rodada nem após reinício"` (dedupe by a `tarcisio_envios` key).
- [ ] **Step 2:** Run, FAIL. Step 3: implement; enqueue one message per group through the existing `inserirNaFila`. Step 4: run `node --test`, commit.

### Task 8: Robot — Tuesday 18:01 generation and owner conference

**Files:** Create `tarcisio-robo/escala-auto.mjs`, `escala-auto.test.mjs`; Modify `robo.mjs` (`rodada`), `evolution.mjs` (add `enviarBotoes(destino, texto, botoes)`), `principal.mjs`.

**Interfaces:**
- Consumes Tasks 1–6. Produces `criarEscalaAuto({ db, evo, push, relogio, rnd }) -> { cuidar(agora): Promise<void> }`. Rule: Tuesday ≥ 18:01 SP and no `tarcisio_escala_auto` row for that Saturday → insert row `estado='gerando'` first (this is the once-only lock), load data with the service key, call `gerarSemana`, insert `novas` into `acolitos_escalas` (columns as `escala.html` writes them, `created_by` = system user id from config), send the owner message, set `estado='aguardando'`. Reminders at Tue 20:00 and Wed 09:00 while `aguardando`.
- Produces `montarMensagemConferencia(semana, resultado) -> string`: Mass by Mass "função — nome", then blocks "Vagas vazias", "Passou de 2×", "Filho de ministro sem vaga", "Escala dos ministros não enviada" when relevant.
- `evolution.enviarBotoes` uses the endpoint the owner tested (read it from the Evolution docs/`/message/sendButtons/{instance}` and confirm with one real send to the owner number, text `teste de botões`; do not send anything else).

- [ ] **Step 1:** Tests with fakes: `"gera uma vez; segunda rodada e reinício não geram"`; `"semana já confirmada: não grava, avisa o dono"`; `"sem missas: não grava, avisa o dono"`; `"gerador lança: nada gravado, estado falhou, dono avisado"`; `"mensagem lista vazias, além do mínimo e filho sem vaga"`; `"lembretes 20h terça e 9h quarta, depois param"`; `"horário em America/Sao_Paulo (18:01 UTC-3)"`.
- [ ] **Step 2:** Run, FAIL. Step 3: implement. Step 4: run `node --test` (all green), commit.

### Task 9: Robot — inbound buttons and PDF intake

**Files:** Modify `tarcisio-robo/evolution.mjs` (`lerMensagemRecebida` + `baixarMidia(external_id)`), `principal.mjs` (webhook), `assistente.mjs` (route owner replies before the AI); Create `tarcisio-robo/ministros-pdf.mjs` + test; Modify `package.json` (PDF text library) and `Dockerfile`.

**Interfaces:**
- Produces `lerMensagemRecebida(corpo)` additionally returns `{ botao: string|null, documento: {mimetype, nome}|null }`; fallback text `1`/`confirmar` and `2`/`revisar` map to the same button ids `escala:confirmar` and `escala:revisar`.
- Produces `tratarRespostaDono({ db, evo, push, numero, botao }) -> Promise<boolean>`: ignores any `numero` ≠ `cfg.numero_conferencia`; `escala:confirmar` → `confirmarSemana`, state `confirmada`, answer "Confirmada. Arte indo para os grupos."; `escala:revisar` → state `em_revisao`, answer "Combinado, revise no app."; idempotent via state.
- Produces `receberPdfMinistros({ db, evo, numero, documento }) -> Promise<void>`: only `cfg.numero_conferencia` and `cfg.remetentes_pdf`; downloads, extracts text, `lerEscalaMinistros`, `casarNomes`, saves `casados` into `acolitos_escala_ministros` (replacing that month), answers "Li a escala dos ministros de outubro: N casos, M com dúvida", then asks each dúvida with buttons `apelido:sim:<id>` / `apelido:nao:<id>`; each answer writes `acolitos_ministro_apelidos` and re-runs the match for that name.

- [ ] **Step 1:** Capture real payloads first: send the Task 8 test buttons, press one on the owner phone, send a PDF to the number, read both from the Evolution webhook log, save sanitised copies in `tarcisio-robo/fixtures/` and base the parser tests on them.
- [ ] **Step 2:** Tests: `"botão do dono confirma uma vez"`; `"duas vezes: segunda não envia nada"`; `"botão de outro número é ignorado sem resposta"`; `"texto 2 vira revisar"`; `"PDF de número não autorizado é ignorado"`; `"PDF do dono grava casados e pergunta só as dúvidas"`; `"sim grava apelido e o próximo mês não pergunta"`; `"não grava e não pergunta de novo"`; `"PDF ilegível: avisa 'não consegui ler' e não grava nada"`.
- [ ] **Step 3:** Run, FAIL. Step 4: implement; the owner's replies are handled before the AI assistant sees the message. Step 5: `node --test` green, commit.

### Task 10: App screens (Settings)

**Files:** Modify `projetos/acolitos/config.html`, `tarcisio-painel.js`, `tarcisio-painel.css`; Create `projetos/acolitos/ministros-painel.js`; Modify `provas/tarcisio.prova.mjs`; vendor `pdf.min.js`/worker into `projetos/acolitos/vendor/` (pinned version).

**Interfaces:** Consumes Tasks 3–4. Produces in Settings → Escala: **Escala dos ministros** (choose PDF → browser reads it with the Task 4 module → review list of matches and dúvidas with a choice per dúvida → **Confirmar e salvar** writes `acolitos_escala_ministros` and `acolitos_ministro_apelidos`), **Nomes lembrados** (list with remove), and in São Tarcísio → Avisos/WhatsApp the fields `numero_conferencia`, `remetentes_pdf`, `ausencia_horas`, `ausencia_ultimo`, `ausencia_texto`.

- [ ] **Step 1:** Extend `tarcisio.prova.mjs` with fake tables for the three new tables and cases: `"ministros: PDF mostra casados e dúvida"`, `"confirmar grava e a dúvida respondida vira apelido"`, `"remover nome lembrado"`, `"campos do WhatsApp salvam"`; each at 375/768/1366/2560 with the standing checks (no horizontal scroll, 44 px, 16 px, full width).
- [ ] **Step 2:** Run, FAIL. Step 3: implement with the design the app already uses (fonts per the visual audit, compact on phone). Step 4: run `npm run provar-telas`; look at the photos at 375 and 2560 before saying done. Commit.

### Task 11: Deploy, dry run, notes

**Files:** Modify `docs/pendencias.md` (only the lines for this project), memory index entry.

- [ ] **Step 1:** Copy robot files to the server (`scp` with `~/.ssh/sator_whatsapp_gateway_ed25519` to `/opt/whatsapp/tarcisio/robo/`), `docker compose -p wa-tarcisio build robo && up -d robo`; confirm "no ar (com IA)" in the logs.
- [ ] **Step 2:** Dry run without sending to anyone: run `cuidar()` with the clock set to a Tuesday 18:01 against a copy of next week's data inside a transaction that rolls back, print the owner message to the log, check it by eye.
- [ ] **Step 3:** Verify with fresh evidence (suite output, screen photos, log lines) before telling the owner it is done; then list what remains his: SIM + QR, group links, number in Settings, first real Tuesday.
- [ ] **Step 4:** Update `docs/pendencias.md` and the memory note; commit.
