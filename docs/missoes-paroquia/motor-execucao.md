# SDD ledger — plan: docs/superpowers/plans/2026-11-04-motor-missoes.md
Base: 7aefb1d; worktree /tmp/iajcbp-motor branch feat/motor-missoes. Baseline 29/29 API tests passed.
Pre-flight: Task 1 contract -> Tasks 2/3/4/5 public/private version interface consistent. Task 2 quota/CAS -> Task 3 provider calls atomic. Task 4 assignment -> Task 5/6 execution must guard RPC and API. Task 6 -> Task 7 feature flag and no activation before editorial review.
Ruling: use isolated /tmp worktree without changing dirty root gitignore — reversible isolation authorized by implementation request — root remains untouched.
Ruling: Supabase CLI SIGKILL confirmed; use psql and UTC timestamp migration with manual history once verified — same established fallback — CLI-generated name unavailable.
Task 1: complete (commits 7aefb1d..022decf, tests: node --test testes-api/missoes-core.test.mjs → ℹ duration_ms 99.778666)
Task 2: complete (commits 022decf..ae1e055, tests: node --test testes-api/missoes-banco.test.mjs → ℹ duration_ms 64.729291)
Task 3: complete (commits ae1e055..1a1cc07, tests: node --test testes-api/missoes-core.test.mjs testes-api/missoes-editorial.test.mjs testes-api/jornada.test.mjs → ℹ duration_ms 342.319041)
Task 2 evidence: /tmp/motor-editorial-db.log — schema applied only inside ROLLBACK, private ACL and idempotent quota passed.
Task 4/5 evidence: /tmp/motor-runtime.log — authenticated SQL proof published 1392 fixture assignments (174 members x 8), 130 XP each; mandatory owned photo, correct answer, duplicate reward and duplicate approval passed; all rolled back.
Ruling: tasks 4 and 5 share execution imports and RPC guards; commit backend together so no intermediate commit references absent modules — both independently tested — larger review unit.
Ruling: no scheduler for Jornada found in Vercel config or Supabase cron; add daily Vercel job using existing CRON_SECRET, separate modo=motor, no sends — avoids silently nonoperational auto-replenishment — one daily invocation.
Ruling: legacy automatic pushes are not used for the individual engine yet; engine cron returns sem_envios — current global flow remains before transition — no automated invitations for new engine until separately enabled.
Task 4: complete (commits 1a1cc07..f71e77c, tests: node --test testes-api/missoes-distribuicao.test.mjs → ℹ duration_ms 88.747333)
Task 5: complete (commits 1a1cc07..f71e77c, tests: node --test testes-api/missoes-execucao.test.mjs → ℹ duration_ms 60.7775)
Task 6: complete (commits f71e77c..56da533, tests: node projetos/acolitos/provas/missoes-motor.prova.mjs → PASS motor: painel em 390/768/1440/2560, fontes e rascunhos carregados.)
Final review: fresh reviewer /root/revisao_motor_final reviewed 7aefb1d..56da533 read-only, six Important findings.
Final: fixed consumed-stock replenishment — estoque disponível considers member history RED→GREEN.
Final: fixed provider failure blocking distribution — executarMotor independence RED→GREEN.
Final: fixed legacy transition — anexarLegadoIniciado regression RED→GREEN; preserve pending extras.
Final: fixed late legacy completion — SQL runtime RED late_failed=true to GREEN, synced canonical ledger and checked both award orders; member advisory lock covers concurrency.
Final: fixed active configuration updates — active-date regression RED→GREEN; keep date on capacity changes.
Final: fixed same-location swap at full capacity — SQL runtime RED trade_failed=true to GREEN; exclude replaced assignment under config lock.
Final: fixed own editorial mismatch — five seed hooks were mapped to wrong source positions; source-ID regression RED→GREEN before any import/publication.
Final: minor (deferred): new capacity fields require reopening panel after generating new targets.
Final: minor (deferred): approval queue gabaritos still uses static MODELOS; motor answer is available in Banco de missões version.
Final: minor (deferred): generic legacy RPC test result assertion can be more explicit (current execution evidence and trigger guard verified separately).
Final: Ruling: factual truth remains explicit human editorial approval — source reference validation cannot establish truth — no automatic publication.
Final: Ruling: reviewer did not execute concurrency/ACL/screens; executor ran authenticated rollback SQL and four-width screenshots; quota concurrency will be verified before enablement — no claim that reviewer ran these.

Final: real provider verified through Vercel cron run, four new proposals + review persisted; automatic replenishment enabled, individual distribution remains off pending editorial/capacity gate.
Final: production verification — 7 file hashes, private sources/migrations/tests 404, anonymous motor 401. DB 818 progress / 15340 XP before and after.
Task 7: complete (product through 13da9d9; 51 focused tests passed; full suite 675/678, same three baseline navigator failures; SQL runtime/concurrent quota/UI/install proofs passed).
Ruling: retain the isolated worktree because known baseline suite failures are outside scope; no unrelated fixes or branch cleanup disguised as a green suite — app changes verified separately.
Ruling: no new reviewer pass after final fixes, per executing-plans; each reported issue covered by failing then passing regression, including real SQL transition/swap proofs — remaining factual review belongs to coordination.
