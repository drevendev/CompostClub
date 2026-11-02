# RC3 technical regression — 26 October 2026

Related issue: [#81](https://github.com/drevendev/CompostClub/issues/81). This is a local preview patch, **not full generation acceptance**. The two compatible Russian regression cases still returned incorrect semantic refusals; do not advertise Russian generation as fixed or useful. The earlier full-spec gates remain open.

## Confirmed cause and patch

RC2's generator schema allowed much more prose than its declared checker byte budget. Both real responses in the reported Eureka attempt were retained but rejected before screening. RC3 uses a jointly budgeted candidate-3 schema, with short per-field limits, one supplied citation per parent and a reserved bounded repair. All creative prose fields compete for one aggregate allowance. UTF-8 admission remains conservative, explicit and capped at context 4096; no tokenizer counts are fabricated. References/unknown lists and the unused follow-up question are empty in this compact generation contract; it makes no external reference claims. Exact source evidence, revisions and previous model responses remain retained.

The scheduler had persisted admission refusals for both frozen pairs. It was not proven to have a stalled timer. The view formerly displayed only the interval wait function and hid these refusals after due. RC3 surfaces the persisted admission/selection reason in the UI and operator view, emits changes to the UI, and includes the current contract version in the block fingerprint. A stale block is re-evaluated on the **same** plan and parent revisions; RNG, donor consent and source selection are not silently replaced. Truly oversized mandatory context still refuses before dispatch and requires explicit preparation.

Historical coherent-2/3/4 contracts and receipts retain their old admission calculation. The short-lived development contracts coherent-5 and coherent-6 are also versioned; the final candidate uses coherent-6/job-admission-4. Existing schema-3 data needs no destructive migration.

## Frozen live regression, not a holdout

The six new fictional inputs in `fixtures/public/rc3-regression.json` were frozen before implementation: two compatible RU, two compatible EN, one incompatible control in each language. Each language exercises both Eureka and a genuine 5-second timer invoking the scheduled controller path. This is a regression set, not the earlier ten-case comparison and not an independent usefulness study. Maximum 18 calls per variant, two variants, 36 total; each job allows at most three calls. No owner budget or owner text is used.

| Variant | Compatible RU cards | Compatible EN cards | Controls committed | Calls | Byte/transport failures |
| --- | --- | --- | --- | --- | --- |
| coherent-5 / admission-3 | 0/2 | 0/2 | 0/2 | 6 | 0 |
| coherent-6 / admission-4 | 0/2 | 2/2 | 0/2 | 9 | 0 |

The first compact tuple context caused spurious missing-context refusals. The final variant restored named context fields and explicit combination instructions. Both EN results passed the required local checker and committed once, including the timer-driven result. Both compatible RU cases instead returned `no_blend`; these are failures against the expected compatibility rubric, **not successful generation**. The RU incompatible control generated a candidate which screening rejected; the EN incompatible control was a negative. All originals, observed counts, decisions and failed cases are retained locally. Every runtime was released after its case. No retry replaces an observed response and no human override is used to pass a case.

Fifteen real regression calls were used. Additional native pause/Exit checks have a separate cap of six calls, on fictional data only. Presentation checks of retained genuine outputs must use zero new inference calls. JSON/schema validity never establishes usefulness.

## Verification and installation contract

Deterministic regression tests cover due admission visibility, notification, no repeated writes/dispatch while blocked, stale-contract invalidation without replacing the frozen route, and the complete maximum-size multilingual/escaped screening tuple. Existing pause, cancellation, negative/error accounting, raw retention, backup/restore and atomic commit checks remain mandatory.

Before switching the test shortcut, retain a hash-verified complete closed-app copy of its **current** data and shortcut configuration. Preserve the pre-RC2 personal database independently. A rollback to RC2 must use the retained data copy; later edits in RC3 are kept separately and never overwritten automatically. Installation itself does not launch the personal app, resume its background work or call the model.

The delivery identity records the exact portable hash, Chromium evidence, recorded standalone HTML SHA-256 and source archive identity. Source archives contain the explicit reviewed allowlist only; no private data, receipts, model files, runtime or signing secrets.

## Exact-candidate checks

- `verify`: 165 unit, 50 desktop, three bridge and one packaging tests, typecheck/lint/format pass, zero skips. Production build and standalone packaging pass; 40 local Markdown destinations checked.
- Final portable identity: `81db3cc4968fe1eee71bf360b8b2bd65ce056aa728b876e24940f72a4983cd66` (the full package manifest digest, not the EXE hash).
- Exact portable Chromium: migration/originals, 430 px, 200% zoom, forced colors, keyboard/focus/Escape, two global commands, **main status** admission reason, zero renderer HTTP requests and page errors. Both genuine new EN cards were opened in this exact portable, without inference, recordings or human overrides.
- Four browser Sample/recorded HTML checks pass, including renamed local file, blocked network and denied storage. The recorded HTML is an explicitly labelled public-fixture demo, not the live generator.
- Both Pause stages and both Exit stages were observed on the final portable. Five additional genuine calls were used against the six-call cap, counting a failed initial Exit observation. Pause probes used one call each; the initial Exit/generating probe used one; the two retained repeat Exit probes used one each. The first Exit probe timed out at 35 seconds despite a persisted `shutdown prepared` record; its exact cause is **not established** and it is not claimed fixed. Repeats exited with code 0 in 13.3s (generating) and 7.3s (screening); owned server PID was absent, calls retained, next open paused. Keep lifecycle reliability under observation alongside #73. Do not equate a prepared record with observed OS exit.
- The initial native fixture had no credit and correctly refused without a model call; a separate initial UI assertion read before the dialog effect. These harness failures remain in local evidence. The corrected harness gives only fictional probes their own explicit credits and awaits visible UI; no personal budget is changed.
- A verified private current-data copy loads with the new store and validates a full backup: originals/revisions/documents, five nodes, 15 jobs including original failures/raw, 29 calls, 58 receipts, credits, consent, runtime paths and settings unchanged. Installation uses another byte-verified copy and never edits the pre-RC2 personal database.

The technical crash/hidden-block patches can be inspected as RC3. Full specification acceptance, a new successful RU card and human usefulness acceptance are still **open**; #81 must not be closed as fully resolved.
