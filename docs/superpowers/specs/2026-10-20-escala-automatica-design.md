# Automatic schedule and absence reminder — São Tarcísio | JCBP

Date: 2026-10-20 · Status: design, waiting for owner approval · Owner: Erick (coordination of the altar servers, JCBP Limeira)

## Intent

Every week the coordination collects absences, runs the generator, checks the result, confirms the
schedule and forwards the art to four WhatsApp groups. The steps are always the same and depend on
someone remembering them. This project makes São Tarcísio do the repeatable part:

1. It reminds everybody, in the four groups, to send their absences (universal link or app), from Sunday to Tuesday 18:00.
2. On Tuesday at 18:01 the system generates the schedule of the coming weekend by itself.
3. It sends the result to the owner's own WhatsApp (19 99907-1702) with two buttons: **Confirmar**
   and **Revisar**.
4. On **Confirmar** it does what the "Confirmar escala da semana" button does today, then sends the
   art to the four groups.

Success: on a normal week the owner touches one button on the phone and the schedule is final and
in the groups. Nothing reaches the groups or the servers without that touch.

## Decisions by the owner (do not reopen)

1. **Absence notice:** São Tarcísio posts it in the **four groups** (parents, acólitos,
   cerimoniários, team), repeating from **Sunday to Tuesday until 18:00**. It asks everyone to send
   their absences.
2. **Generation:** Tuesday **18:01**, automatic, uses the generator the owner already uses ("works
   well"; its behaviour does not change).
3. **Week generated:** the **coming weekend** (Saturday and Sunday), with the Masses already
   registered.
4. **Not enough people for a role:** the generator may serve someone **more than 2× in the month**.
   **2× is the minimum for everybody**. This is a generator setting, not a robot special case.
5. **Check:** the schedule goes to **19 99907-1702**, with buttons **Confirmar** and **Revisar**.
   The owner tested buttons on the Evolution and they work.
6. **Confirmar:** the system confirms the week and sends the art to the four groups.
7. **Revisar:** the owner reviews and confirms **by hand in the app**. After he confirms there,
   the system sends the art to the groups. The robot does nothing else on Revisar.
8. **Ministers' schedule (option A + WhatsApp):** some servers have a father or mother who is a
   minister (MECE). The monthly ministers' PDF (Drive folder `MECE`, e.g. "ESCALA OUTUBRO REV01.pdf")
   reaches the system **by the owner**, once a month, in **either way**: uploaded in the app, or
   **sent as a file to the São Tarcísio WhatsApp number**. In both ways the system reads it, matches
   the names, asks the owner only about doubtful names, and saves the result. The generator then puts
   the child **in the same Mass** where the parent serves. The robot never reads the Drive.
   **Confirmed abbreviated names are remembered** ("Rita E." = Rita Eder, mother of X), so the next
   months do not ask again. This approval covers the design in this document ("plano aprovado",
   20/10).
9. **Rule of 18/08 stays:** generating is a draft. Nobody is notified until the week is confirmed.
   The art goes once and is not resent. A confirmed week does not change.

## Constraints

- The generator lives **inside `projetos/acolitos/escala.html`** (`planejarVagas`,
  `gerarEscalaSemana`, `elegivelFuncao`, ~lines 1006–1360). It depends on page globals (`membros`,
  `habMap`, `dispMap`, `escalasMap`, `cfg`, `SemanalCore`, `RodizioCore`, `nivelInfo`...). The robot
  runs on the VPS (Node, `tarcisio-robo/`) and cannot run page code.
- "Confirmar escala da semana" (`confirmarEscalaSemana`, ~line 1213) mixes screen and rule: it reads
  `acolitos_config.escala_avisados`, sends push through `POST /api/enviar-push` (type `escalado`),
  records who was notified and calls `pedirArteNosGrupos` (RPC `tarcisio_pedir_escala`).
- The existing cron files (`api/cron-arte.js`, `cron-vigia-arte.js`) trigger the art and the alert
  "a escala do fim de semana não foi montada" (push type `escala_pendente`). The new flow must
  coexist with them, not duplicate a notice.
- App ↔ robot talk only through database tables (`tarcisio_*`). No new public route.
- Responsive rule applies to any screen touched: full width on desktop, 44 px targets and 16 px
  fields on phone.
- Time zone: America/Sao_Paulo. "Tuesday 18:01" is local time.

## How it works

### 1. Shared generator (the risky part)
Extract the generator into a **pure module** `gerador-escala-core.js` (no DOM, no network), same
style as `kits-core.js` and `confirmar-escala-core.js`: loads in the browser and in Node. It receives
the data as arguments (members, qualifications, availability, absences, existing schedule, Masses,
config, rotation history) and returns the new assignments. `escala.html` keeps the screen and calls
the module. The robot calls the same module.

- Behaviour must stay **identical** for the same input. Proof: tests with a frozen fixture, and a
  run of the old inline code against the new module on the same data.
- The random tie-break (`Math.random`) becomes an injectable source, so tests are repeatable.
- New generator setting `minimo_mes` (default 2) and `permitir_alem_do_minimo`: after the normal
  pass, empty slots are filled from people who already served ≥ 2× in the month, least-served first.
  Rules that stay hard: qualification (kits), absence, availability, not twice on the same Mass,
  not twice in the weekend.

### 2. Absence reminder
- New robot rule in the once-a-minute loop, inside the existing announcement machinery
  (`tarcisio_avisos`): a built-in announcement "Ausências da semana", repeating Sun/Mon/Tue.
- *My call:* once a day at 09:00 plus a last reminder on Tuesday at 15:00. Text and times editable
  in Settings → São Tarcísio → Avisos. After Tuesday 18:00 it stops by itself.
- **Owner's decision:** the text gives the two ways to send an absence: the universal link
  `https://coroinhas.jcbplimeira.com.br/ausencias` (public page `ausencias-publica.html`, checked
  today: answers 200) **or the app**, plus the deadline. The robot does not read replies (as decided
  before); the page and the app are the only places absences are recorded.
- Pause switch: the existing WhatsApp pause also pauses this.

### 3. Tuesday 18:01 generation (robot)
- Robot checks every minute: Tuesday, ≥ 18:01, no run recorded for this week → runs once.
- Loads data with the service key, picks the Masses of the coming Saturday and Sunday, calls the
  shared generator, writes the assignments to `acolitos_escalas` (same columns the screen writes),
  **without notifying anyone**.
- Records the run in a new table `tarcisio_escala_auto` (week, state, generated_at, vacancies,
  over-minimum list, owner message id). One row per week. This is what makes "once" true even if
  the robot restarts.
- If the week is already confirmed, or has no Masses: does nothing and tells the owner why.
- If the generator fails: nothing is written; the owner gets a WhatsApp saying it failed.

### 4. Message to the owner
- Text: week, Mass by Mass, **role — name**, then a short block: empty slots (if any) and people
  served beyond 2× ("Fulano 3×").
- Buttons **Confirmar** and **Revisar**. The owner number lives in Settings (new field "WhatsApp de
  conferência", default 5519999071702), not in code.
- *My call:* if the owner does not answer, the robot reminds at 20:00 on Tuesday and at 09:00 on
  Wednesday, then stops. Nothing goes to the groups without the touch.
- Only a reply **from that number** counts. Any other number pressing a button is ignored.

### 5. Confirm
- Inbound webhook already reaches the robot (`lerMensagemRecebida`). Extend it to read the button
  reply (`buttonsResponseMessage` or the equivalent id the Evolution sends) and, as a fallback, the
  text "1" / "2" / "confirmar" / "revisar".
- Confirmar → robot does the same as the screen button, through one shared rule (see below), then
  sets `tarcisio_escala_auto.state = confirmada`, asks the art for the four groups and answers the
  owner "Confirmada. Arte indo para os grupos."
- Idempotent: pressing twice, or confirming in the app before pressing, sends nothing twice (the
  `escala_avisados` map and the "art sent once" rule already exist; the robot checks both first).
- Revisar → state `em_revisao`, answer "Combinado, revise no app.". When the owner confirms in the
  app, the existing `pedirArteNosGrupos` path sends the art, as today.

### 6. Shared "confirm" rule
Move the non-screen part of `confirmarEscalaSemana` (who still needs notice, push call, writing
`escala_avisados`, art request) into one function used by the screen and by the robot. The push call
for `escalado` currently needs a logged-in coordinator; the robot has no user session.
**Open for the builder:** either give `api/enviar-push.js` a robot-only type with the shared secret
(like `arte` and `escala_pendente`) or have the robot write the pending push to a table the app
already drains. Pick the smaller one and say which.

### 7. Ministers' schedule (PDF → same Mass as the parent)
What exists: `acolitos_membros` already has `tem_pai_ministro`, `tem_mae_ministro`,
`nome_pai_ministro`, `nome_mae_ministro`, `comunidade_ministro`, `escalar_com_pais`. Today 11 active
members have a minister parent, all with the name filled. Nobody has `escalar_com_pais` on.

What the PDF is (October file, checked): text is readable (no OCR), but it comes out as loose blocks:
a date heading ("SÁBADO 24/out"), a time ("17:00h") and a run of **first name + initial** ("Rita E.
Eder Sônia Fabiana ..."). Santo Antônio and special days ("Nossa Sra Aparecida 12/out", Adoration)
appear as separate markers. A couple is written side by side.

Flow:
- **Upload screen** (Settings → Escala, owner and admins): choose the PDF. The browser reads it
  (pdf.js, vendored like `supabase-js`) and builds `date → time → community → names`.
- **Matching:** each name is matched against the 22 possible parent names of the members above
  (first name + initial, accents and case ignored). Three outcomes per name: *matched* (one member),
  *ambiguous* (two or more), *not a known parent* (ignored, most names are other ministers).
- **Review screen:** lists only the matches: "Mãe de Fulano serve: sáb 24/10 17h Matriz; dom
  25/10 9h Matriz". Ambiguous ones are shown with the choices; the owner picks or discards. Nothing
  is saved until he confirms. Re-uploading the same month replaces that month.
- **Storage:** new table `acolitos_escala_ministros` (month, date, time, community, member_id, which
  parent, source file name). RLS: coordination only.
- **Generator:** before the greedy pass (same place `SemanalCore.reservar` runs), it reserves a slot
  for the child on each Mass where the parent serves. Child still must pass the hard rules
  (qualification, absence, availability, not twice in the weekend). If the child cannot go (absent,
  no qualification, no open slot), he is **not forced**: the owner's message lists "filho de
  ministro sem vaga: Fulano (mãe serve sáb 17h)".
- **Sending the PDF to São Tarcísio's number:** the robot accepts a PDF document **only from the
  owner's number** (the same "WhatsApp de conferência" field) and from coordinators' numbers listed
  in Settings (*my call*: default only the owner). Any other sender is ignored without an answer.
  The robot downloads the file through the Evolution (media endpoint), runs the **same parser
  module** the app uses (pure text-in, structure-out, so one code path and one set of tests; the PDF
  text is extracted in Node, with a PDF library in the robot image), then answers in the chat:
  "Li a escala dos ministros de outubro: 9 casos encontrados, 2 com dúvida."
- **Doubtful names in the chat:** one question per name, with buttons: "'Rita E.' é a Rita Eder, mãe
  da Maria? **Sim** / **Não, outra pessoa**". If two members fit, the buttons name each of them.
  The answer is saved at once. When all are answered, the robot says what it will use and the
  generator takes it from the table.
- **Memory of confirmed names:** new table `acolitos_ministro_apelidos` (name as written in the PDF
  normalised, member_id, which parent, answer yes/no, who answered, when). A "yes" matches that name
  automatically next time. A "no" is remembered too, so the same doubt is not asked again. The app
  review screen reads and writes this same table, so an answer given in the chat or in the app counts
  in both. Settings → Escala shows the list, where the owner can remove a wrong memory.
- **Safety:** a remembered name is only used if that member still has that parent as minister
  (`nome_*_ministro`); if the member's data changed, the memory is ignored and the robot asks again.
- **Parent serves in several Masses on the weekend:** *my call* — the child goes to the **first one
  that fits**, because the weekend rule forbids twice. The owner's message shows which one.
- **Month with no PDF uploaded:** the generator runs without this rule and the owner's message says
  "escala dos ministros de <mês> não enviada".
- *My call:* it applies to all members with a minister parent, regardless of `escalar_com_pais`
  (nobody has it on today). The builder reads how the flag is used on screen and reports; if it was
  meant as a per-member opt-out, we keep it as opt-out.
- A name that cannot be matched never blocks the schedule. Worst case the rule does nothing.

## Goals / non-goals / anti-goals

**Goals**
- One touch per week for the normal case.
- The same schedule the screen would have produced.
- No message to groups or servers before the owner confirms.

**Non-goals**
- No change to how the generator chooses people (only the new minimum rule).
- The robot does not read or answer free replies in the groups.
- No automatic absence recording from WhatsApp messages.

**Anti-goals (failure even if it "works")**
- A draft schedule reaching a group or a server's phone.
- The art or the notices going out twice.
- The robot generating over a week the owner already edited or confirmed.
- A different result between the screen and the robot for the same data.

## Tests that must exist

- Ministers: the October PDF as a fixture (same parser in Node and in the browser, same output) (names matched, ambiguous flagged, other ministers
  ignored); a child is reserved on the parent's Mass; a remembered "yes" is used without asking, a remembered "no" is not asked again, a stale memory is ignored; a PDF from a number other than the owner's is ignored; a child who cannot go is reported, not forced;
  re-upload replaces the month. The upload never reads the Drive.
- Generator module: same assignments as the inline code on a frozen fixture; the 2× minimum;
  beyond-minimum only when no one else is eligible; hard rules never broken (proved by mutation:
  remove a rule, a test must fail).
- Robot: runs once per week (restart in the middle does not run again); skips confirmed weeks;
  ignores buttons from other numbers; double-press sends nothing twice; reminder times in São Paulo
  time, including the Sunday→Tuesday window.
- Screen: the "Gerar" and "Confirmar escala da semana" buttons behave as before (existing 417 tests
  stay green, plus a screen proof of the new setting fields at 375, 768, 1366 and 2560 px).
- **No test writes to production data.** Tests use fixtures; the real run is proved on a copy week
  with the owner watching, never by inserting real assignments.

## The owner's steps

1. SIM card and QR code (still open from the first project).
1b. Once a month: upload the ministers' PDF and check what the app understood.
2. Check the number in the "WhatsApp de conferência" field.
3. First real Tuesday: watch the message arrive and press the button.

## Left to the builder

- File layout of the shared module, and how the browser loads it.
- The push path in section 6 (decide and record).
- Exact Evolution payload for button replies (read a real one from the webhook log before coding).
- Migration number and the shape of `tarcisio_escala_auto`.
