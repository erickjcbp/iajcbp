# São Tarcísio | JCBP — the WhatsApp of the altar servers app

Date: 2026-10-20 · Status: design · Owner: Erick (coordination of the altar servers, JCBP Limeira)

## Intent

Today the coordination sends the schedule, reminders and announcements by hand on WhatsApp. São
Tarcísio is a WhatsApp number of its own that does this alone, following rules that the
coordination sets in the Acólitos app. It **only sends**: nobody talks to it.

Success: on the day the week is confirmed, the schedule art arrives in all four groups without
anyone downloading and forwarding it. The day before each Mass, the parent of every scheduled
altar server gets a reminder. Announcements go out on the scheduled day and time, with no one
remembering to send them.

## Decisions by the owner (do not reopen)

1. **Recipients:** groups, each altar server, parents/guardians, team.
2. **Only sends.** Replies are not read and get no answer.
3. **Its own number:** a new SIM card, named "São Tarcísio | JCBP".
4. **Four groups:** Parents, Acólitos, Cerimoniários, Team/coordination.
5. **Week schedule:** goes **only to the groups**, all four, **art only** (no text), **when the
   coordination clicks "Confirmar escala da semana"**. It is not resent after that. The owner
   considers the confirmed schedule final.
6. **Day-before reminder:** private message, the day before, at 19:00. For a **minor, only to the
   guardian's number**.
7. **Completing numbers:** when someone opens the app and the guardian's WhatsApp is missing, the
   app asks for it until it is filled in.
8. **Scheduled announcements** (coordinators only):
   - one-off with date and time;
   - repeating;
   - automatic birthdays;
   - private announcement.
9. **Birthday:** private message to the guardian (or to the person, if an adult).
10. **Who manages:** `coord_admin` and `subadmin`. Nobody else sees the screen.

## Calls I made (the owner can overturn them while reading)

- **Separate gateway `wa-tarcisio`** on the VPS that already exists (`zap.gruposator.com.br`,
  179.198.107.71). It is created with `/opt/whatsapp/_template/new-client.sh`, the same pattern as
  `wa-pink`. If SATOR goes down or is upgraded, the altar servers are not affected.
  - Measured on 20/10: 1 vCPU, 3.9 GB of memory with 3 GB free. Each stack costs about 250 MB.
- **The sender robot lives on the VPS** (a `tarcisio-robo` container in the same compose), not on
  Vercel or Supabase:
  - The Vercel free plan already uses all 12 functions.
  - The iajcbp Supabase has no Edge Functions, no pg_cron, and no access token found.
  - On the VPS, `cron` keeps the exact time. GitHub Actions has already run 3h late on this
    project.
  - The robot reads and writes in Supabase with the `service_role` key. The key lives only in the
    VPS `.env` (mode 600), never in the repository.
- **Code reused from SATOR Hub:** the Evolution client (`satorhub/supabase/functions/_shared/evolution.ts`)
  and the paced sending of `outreach.ts`, ported to Node. The shape of the calls and the error
  handling come along. Hub CRM business logic does not.
- **An adult** (18+) gets the reminder and the birthday message on their own number.
- **Guardian number:**
  - Priority: `celular_responsavel`, then `celular_mae`.
  - The new field the app asks for is saved in `celular_responsavel`, with
    `responsavel_whatsapp=true`.
  - An adult uses `telefone` when `telefone_whatsapp`.
  - Siblings in the same `grupo_irmaos` with the same guardian get **one combined message**
    ("amanhã: João — Missal 9h; Maria — Vela 9h"), not two.
- **Protecting the SIM card:**
  - At most 1 message every 20–40 s (random), with no burst.
  - Quiet window from 21:00 to 08:00: nothing goes out, the item waits for 08:00.
  - Daily ceiling of private messages (starts at 150, adjustable).
  - A "Pausar tudo" button.
  - A brand-new SIM card should "warm up" for a few days, chatting normally, before the first
    big batch. That is the owner's manual step.
- **Audience for a private announcement:** the same 4 roles, turned into people.
  - **Pais** = the guardian of every minor who serves, or the adult themselves.
  - **Acólitos** = whoever serves and is below cerimoniário (level < 6), by the number rule.
  - **Cerimoniários** = level ≥ 6.
  - **Equipe** = `coord_admin`/`subadmin`/`membro_equipe` roles, by `telefone`.
  - A number that shows up for more than one person gets a single message.
- **Single queue:** everything that leaves (art, reminder, announcement, birthday) is a row in
  `tarcisio_envios`. The rules only produce rows; the robot only consumes the queue. This gives a
  log of what left, what failed and why, with no extra screen.
- **The schedule art:** confirming the week calls the art generation that already exists
  (`/api/regenerar-arte` → GitHub Actions → `png_url`/`png_url_domingo`) and creates a
  `tarcisio_envios` row of type `escala` in the "waiting for art" state. The robot sends it when
  the art for that weekend is newer than the confirmation. Two pieces of art (Saturday/Sunday) go
  as two images. If the art does not appear within 30 min, the item fails and the coordination
  sees it on the screen.

## How it works

```
App (coordination)                     Supabase (iajcbp)                    VPS
──────────────────                     ─────────────────                    ───
Confirmar semana  ───────────────▶  tarcisio_envios (escala, aguardando arte)
Tela São Tarcísio ───────────────▶  tarcisio_grupos / tarcisio_avisos / tarcisio_config
                                                    ▲      │
                                                    │      ▼
                                             tarcisio-robo (cron 1/min)
                                             1. rules generate rows (reminder 19h, birthday 08h,
                                                due announcements, repetitions)
                                             2. sends the next due item, paced
                                             3. writes status/error back
                                                           │
                                                           ▼
                                             Evolution wa-tarcisio ──▶ WhatsApp
```

### Data (migration 098)

- `tarcisio_config` (one row):
  - `pausado`
  - `teto_diario`
  - `janela_inicio` / `janela_fim`
  - `hora_lembrete` (19:00)
  - `hora_aniversario` (08:00)
  - `lembrete_ligado`, `aniversario_ligado`, `escala_ligada`
- `tarcisio_grupos`:
  - `papel` ∈ pais | acolitos | cerimoniarios | equipe
  - `nome`
  - `jid` (WhatsApp group id)
  - `ativo`
  - The screen lists the groups the number belongs to (Evolution `fetchAllGroups`). The
    coordination picks which one is which role.
- `tarcisio_avisos` (what the coordinator schedules):
  - `texto`, `imagem_url` (optional), `destino` (list of group roles, or private + audience)
  - `quando` (first send)
  - `repetir` (none | daily | weekly | monthly) + `ate`
  - `criado_por`, `ativo`
- `tarcisio_envios` (the queue and the log):
  - `tipo` ∈ escala | lembrete | aviso | aniversario
  - `destino_jid` or `destino_numero`
  - `texto`, `imagem_url`
  - `agendado_para`
  - `estado` ∈ aguardando_arte | pendente | enviando | enviado | falhou | cancelado
  - `erro`, `tentativas`
  - `origem` (aviso_id / celebração / membro)
  - `chave_unica`: prevents duplicates, e.g. `lembrete:<celebracao>:<numero>` or
    `aniv:<membro>:<ano>`
- RLS: everything readable and writable only by `coord_admin`/`subadmin`; the robot uses
  `service_role`.
- `acolitos_membros` gains nothing new: the fields already exist (`celular_responsavel`,
  `responsavel_whatsapp`, `celular_mae`, `telefone`, `telefone_whatsapp`).

### Rules (inside the robot, once per minute)

- **Reminder:** at `hora_lembrete`, take tomorrow's Masses (Sao Paulo time zone). For each
  `escalado`, resolve the number by the rule above and create one row per number with its
  `chave_unica`.
  - Someone who entered later through an automatic swap (migration 096) and is scheduled at 19:00
    receives it. That is why it runs at 19:00, not earlier.
  - No number → nothing is sent, and the person appears on the "sem número" list.
- **Birthday:** at `hora_aniversario`, take today's birthdays (`data_nascimento`, active members
  who serve) and create one row per number. 29/02 falls on 28/02 in non-leap years.
- **Announcements:** each active `tarcisio_avisos` whose `quando` is due creates a row per
  destination.
  - If it repeats, it moves `quando` forward to the next occurrence.
  - If it is past `ate`, it turns off.
- **Schedule:** for a row `aguardando_arte`, check `png_url` for the weekend. When the art is
  newer than the row's `created_at`, the row becomes `pendente` (one image per group per piece of
  art).
- **Sending:** if not paused, inside the window and under the ceiling, send the oldest due
  `pendente` row.
  - A group does not count toward the daily ceiling.
  - On error, retry 3 times, 5 min apart, then `falhou` with the Evolution message.
  - A number without WhatsApp → `falhou` right away, error "sem WhatsApp", and goes on the list.

### Message texts (first version, editable later in config)

- Reminder: "Olá! Amanhã ({dia}) {nome} serve na missa das {hora} — {local}, função {função}.
  Chegar 20 min antes. — São Tarcísio | JCBP"
- Birthday: "Hoje é aniversário de {nome}! 🎉 A Pastoral dos Coroinhas e Acólitos da JCBP deseja
  muitas bênçãos. — São Tarcísio | JCBP"
- Every message ends with "Este número só envia avisos; dúvidas, fale com a coordenação."

### App screens

- **`tarcisio.html`** (new, menu item visible only to `coord_admin`/`subadmin`), in four tabs:
  1. **Situação:**
     - number connected or not;
     - QR code to pair;
     - Pausar/Retomar;
     - sent today vs the ceiling;
     - queue of the next sends, with Cancelar;
     - latest failures.
  2. **Grupos:** the number's groups, each assigned to one of the four roles.
  3. **Avisos:**
     - create, edit and turn off;
     - text, image, destination, date/time, repetition;
     - "Enviar agora" button (goes to the queue right away).
  4. **Sem número:** who would have received something but has no WhatsApp, with a link to the
     record.
- **`escala.html` → "Confirmar escala da semana":**
  - after the confirmation that already exists, it calls art generation and creates the
    `escala` row;
  - toast: "A arte vai para os grupos assim que ficar pronta."
- **Prompt for the guardian's number:**
  - in the `initModulo` of `shared.js`;
  - when the active profile is a minor with no WhatsApp from the guardian, a non-dismissable
    modal asks for the number and tests it on WhatsApp (Evolution `whatsappNumbers`, through the
    robot, so the API key does not go to the browser);
  - for a family account, it asks for each child missing one;
  - an adult is not asked.
- Responsive rules: all of it follows the owner's rule from `CLAUDE.md`:
  - the full width on desktop/TV;
  - tables scroll inside their own frame;
  - fullscreen dialogs on mobile;
  - 44 px tap targets;
  - 16 px inputs.

### Robot ↔ app (without a new Vercel function)

- The screen needs the QR code, the connection state, the group list and the number test.
- The robot exposes a small HTTPS API in the Caddy that already exists:
  `tarcisio.wa.gruposator.com.br/robo/*`.
- It accepts only requests with the user's Supabase JWT and checks `coord_admin`/`subadmin` in the
  database. The number test accepts any logged-in user, for their own number only.
- The Evolution key never leaves the VPS.

## Goals / non-goals / anti-goals

- **Goals:**
  - week art in the 4 groups when confirming;
  - reminder the day before for 100% of those scheduled who have a number;
  - scheduled, repeating and private announcements;
  - birthdays;
  - a list of who has no number.
- **Non-goals (now):**
  - reading replies or confirming attendance;
  - resending the art when the schedule changes;
  - the official WhatsApp API;
  - messages about changes to the schedule.
- **Anti-goals (a failure even if it works):**
  - the SIM card banned through a burst;
  - a message in the middle of the night;
  - a duplicate message (two reminders for the same Mass);
  - a reminder for someone who was swapped out;
  - the Evolution key or `service_role` in the browser or in the repository;
  - affecting the SATOR (Helena) or Pink number.

## The owner's steps (only what depends on him)

1. Buy the SIM card, activate WhatsApp on a phone, set the name "São Tarcísio | JCBP" and a
   photo, and use it normally for a few days.
2. Scan the QR code on the Situação tab.
3. Add the number to the 4 groups (as admin, if the group only lets admins post).
4. DNS: the `tarcisio.wa` record → 179.198.107.71 (Hostinger), if `*.wa` does not already
   cover it.

## Left to the builder

- Robot language and library: Node 22 + `postgres`/`@supabase/supabase-js`, following `outreach.ts`.
- The exact layout of the screens, within the house components (`shared.css`, `.modal-overlay`,
  `btn-sm`).
- How the art time is compared with the confirmation, using the `updated_at` or file time that
  already exists in the art table.
- Tests:
  - pure rules (number resolution, sibling grouping, next repetition, quiet window, unique key)
    in `*-core.js` with `node --test`, as the project does;
  - the robot with a fake Evolution;
  - a screen proof through `npm run provar-telas` in the 4 widths.
