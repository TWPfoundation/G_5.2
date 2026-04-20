# V1 Recovery Rehearsal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rehearse one clean same-machine restore of the declared `v1` system using `git clone` for repo content and a full `data/` backup for runtime state, then record whether the restore succeeded from documented artifacts alone.

**Architecture:** Treat this as an operator drill, not a software feature. The source checkout remains untouched after backup capture. The restored environment is a fresh sibling clone populated from a dated runtime backup, then validated through the documented Windows operator path. The durable outputs are a recovery result note and only the minimum doc corrections exposed by the drill.

**Tech Stack:** PowerShell, git, pnpm, the existing Windows operator wrappers, Markdown docs, Windows filesystem copy operations.

---

## File Structure

- Create: `docs/recovery-drills/2026-04-21-v1-recovery-rehearsal.md`
  Purpose: dated result note for the observed drill outcome, including commands run, pass/fail status, and overall judgment.
- Modify: `docs/recovery-and-backups.md`
  Purpose: capture any recovery-reference clarifications exposed by the drill, if needed.
- Modify: `docs/operator-quickstart.md`
  Purpose: capture any bootstrap-path clarifications exposed by the drill, if needed.
- Modify: `docs/operator-handbook.md`
  Purpose: capture any missing operational guidance exposed by the drill, if needed.
- Create: `.local/recovery-rehearsal/2026-04-21-data-backup/`
  Purpose: dated local backup copy of the full `data/` directory used as the authoritative runtime-state restore input for this drill.
- Create: `F:\ProcessoErgoSum\G_5.2-recovery-rehearsal-2026-04-21\`
  Purpose: fresh sibling restore target for the cloned repo plus restored runtime state. This is operational drill state, not a repo file.

## Task 1: Capture Source State And Backup Runtime Data

**Files:**
- Create: `.local/recovery-rehearsal/2026-04-21-data-backup/`
- Later write into: `docs/recovery-drills/2026-04-21-v1-recovery-rehearsal.md`

- [ ] **Step 1: Confirm the source checkout is clean and record the source commit**

Run:

```powershell
git status --short --branch
git rev-parse HEAD
git rev-parse --short HEAD
git rev-parse refs/tags/v1
```

Expected:

- source checkout is not carrying unrelated working-tree edits
- `HEAD` is recorded explicitly
- local `v1` tag SHA is available for reference

- [ ] **Step 2: Create the dated local backup root**

Run:

```powershell
New-Item -ItemType Directory -Force -Path .local\recovery-rehearsal\2026-04-21-data-backup | Out-Null
```

Expected:

- `.local\recovery-rehearsal\2026-04-21-data-backup` exists

- [ ] **Step 3: Copy the full `data/` directory into the backup root**

Run:

```powershell
Copy-Item -LiteralPath .\data -Destination .local\recovery-rehearsal\2026-04-21-data-backup -Recurse -Force
```

Expected:

- `.local\recovery-rehearsal\2026-04-21-data-backup\data\` exists
- backup is a real copy, not a pointer to the live runtime state

- [ ] **Step 4: Record how `.env` will be handled for the restore**

Use one of these and record it in the drill note:

- reuse the existing `.env` as operator-local config for the restored clone
- copy `.env.example` and manually fill only what is needed
- copy a redacted/operator-local equivalent

This step is complete only when the chosen path is written down for the result note.

- [ ] **Step 5: Commit nothing yet**

There should be no repo changes required from backup capture itself. The only tracked artifact will be the later result note.

## Task 2: Create The Fresh Restore Target

**Files:**
- Create: `F:\ProcessoErgoSum\G_5.2-recovery-rehearsal-2026-04-21\`
- Later write into: `docs/recovery-drills/2026-04-21-v1-recovery-rehearsal.md`

- [ ] **Step 1: Remove any stale restore target from an earlier aborted drill**

Run:

```powershell
if (Test-Path 'F:\ProcessoErgoSum\G_5.2-recovery-rehearsal-2026-04-21') {
  Remove-Item -LiteralPath 'F:\ProcessoErgoSum\G_5.2-recovery-rehearsal-2026-04-21' -Recurse -Force
}
```

Expected:

- no stale restore target remains

- [ ] **Step 2: Clone the repo into the fresh sibling restore target**

Run:

```powershell
git clone . 'F:\ProcessoErgoSum\G_5.2-recovery-rehearsal-2026-04-21'
```

Expected:

- restore target contains a fresh clone
- restore target was created by `git clone`, not by copying the live repo tree

- [ ] **Step 3: Check out the intended restore ref explicitly**

Run:

```powershell
git -C 'F:\ProcessoErgoSum\G_5.2-recovery-rehearsal-2026-04-21' checkout master
git -C 'F:\ProcessoErgoSum\G_5.2-recovery-rehearsal-2026-04-21' rev-parse HEAD
git -C 'F:\ProcessoErgoSum\G_5.2-recovery-rehearsal-2026-04-21' rev-parse --short HEAD
```

Expected:

- restore clone is on the intended ref
- restore commit is recorded explicitly for the result note

- [ ] **Step 4: Confirm the restore target starts without recovered runtime state**

Run:

```powershell
Test-Path 'F:\ProcessoErgoSum\G_5.2-recovery-rehearsal-2026-04-21\data'
```

Expected:

- result is `False`, or the path is absent prior to restore

## Task 3: Restore Runtime State And Operator Config

**Files:**
- Copy into: `F:\ProcessoErgoSum\G_5.2-recovery-rehearsal-2026-04-21\data\`
- Optional copy into: `F:\ProcessoErgoSum\G_5.2-recovery-rehearsal-2026-04-21\.env`
- Later write into: `docs/recovery-drills/2026-04-21-v1-recovery-rehearsal.md`

- [ ] **Step 1: Copy the backed-up `data/` directory into the restored clone**

Run:

```powershell
Copy-Item `
  -LiteralPath .local\recovery-rehearsal\2026-04-21-data-backup\data `
  -Destination 'F:\ProcessoErgoSum\G_5.2-recovery-rehearsal-2026-04-21' `
  -Recurse `
  -Force
```

Expected:

- `F:\ProcessoErgoSum\G_5.2-recovery-rehearsal-2026-04-21\data\` exists
- restored runtime state comes only from the captured backup

- [ ] **Step 2: Apply the chosen `.env` handling path**

Use exactly one of the following:

```powershell
Copy-Item -LiteralPath .\.env -Destination 'F:\ProcessoErgoSum\G_5.2-recovery-rehearsal-2026-04-21\.env' -Force
```

or

```powershell
Copy-Item -LiteralPath .\.env.example -Destination 'F:\ProcessoErgoSum\G_5.2-recovery-rehearsal-2026-04-21\.env' -Force
```

Expected:

- restore clone has the intended operator-local env file state
- the chosen path is recorded for the result note

- [ ] **Step 3: Confirm the restored clone is self-contained**

Run:

```powershell
Get-ChildItem 'F:\ProcessoErgoSum\G_5.2-recovery-rehearsal-2026-04-21' | Select-Object Name
Get-ChildItem 'F:\ProcessoErgoSum\G_5.2-recovery-rehearsal-2026-04-21\data' | Select-Object Name
```

Expected:

- repo content is present
- restored `data/` is present in the clone itself
- no step depends on reading live source `data/`

## Task 4: Run Verification And Startup Checks Inside The Restored Clone

**Files:**
- Later write into: `docs/recovery-drills/2026-04-21-v1-recovery-rehearsal.md`

- [ ] **Step 1: Run policy-root validation in the restored clone**

Run:

```powershell
pnpm validate:canon
pnpm validate:witness
```

Workdir:

```text
F:\ProcessoErgoSum\G_5.2-recovery-rehearsal-2026-04-21
```

Expected:

- both commands pass in the restored clone

- [ ] **Step 2: Run typecheck in the restored clone**

Run:

```powershell
pnpm typecheck
```

Expected:

- typecheck passes in the restored clone

- [ ] **Step 3: Run the supported install wrapper in the restored clone**

Run:

```powershell
pwsh -NoProfile -File .\scripts\operator-install.ps1
```

Expected:

- install wrapper passes
- wrapper prints current short SHA, declared `v1` SHA when available, and release identity

- [ ] **Step 4: Start the dashboard through the supported start wrapper**

Run:

```powershell
pwsh -NoProfile -File .\scripts\operator-start.ps1
```

Expected:

- start wrapper passes
- dashboard URL is printed
- dashboard becomes reachable in the restored clone

- [ ] **Step 5: Stop the transient restored-clone dashboard cleanly after verification**

Use the shell/process-control approach needed at execution time, then record in the result note how startup was verified and how the process was stopped.

## Task 5: Prove The Restored System Is Usable

**Files:**
- Later write into: `docs/recovery-drills/2026-04-21-v1-recovery-rehearsal.md`

- [ ] **Step 1: Prove one normal inquiry path**

Use the restored dashboard and perform one normal inquiry path. Record:

- the surface used
- the command or browser path used
- pass/fail result

This step is complete only when the result note can state that one normal inquiry path worked in the restored clone.

- [ ] **Step 2: Prove one Witness path**

Use the restored dashboard and perform one Witness path. Record:

- the surface used
- whether consent/testimony state restored correctly
- pass/fail result

This step is complete only when the result note can state that one Witness path worked in the restored clone.

- [ ] **Step 3: Prove one eval-report inspection path**

Use the restored dashboard and inspect one eval-report path. Record:

- the surface used
- the report or view checked
- pass/fail result

This step is complete only when the result note can state that one eval-report inspection path worked in the restored clone.

## Task 6: Write The Recovery Result Note

**Files:**
- Create: `docs/recovery-drills/2026-04-21-v1-recovery-rehearsal.md`

- [ ] **Step 1: Write the result note with the captured evidence**

Create `docs/recovery-drills/2026-04-21-v1-recovery-rehearsal.md` with this structure:

```md
# V1 Recovery Rehearsal — 2026-04-21

**Status:** <succeeded from documented artifacts alone | succeeded but required undocumented operator knowledge | failed>

## Source

- source repo path: `...`
- source commit SHA: `...`
- restore ref: `...`
- backup path: `...`
- restore target path: `...`
- `.env` handling: `<reused | copied example | recreated operator-local equivalent>`

## Commands run

```powershell
<exact commands used for backup, clone, restore, validation, install, start>
```

## Verification results

- `pnpm validate:canon` — `<pass/fail>`
- `pnpm validate:witness` — `<pass/fail>`
- `pnpm typecheck` — `<pass/fail>`
- `.\scripts\operator-install.ps1` — `<pass/fail>`
- `.\scripts\operator-start.ps1` — `<pass/fail>`
- normal inquiry path — `<pass/fail>`
- Witness path — `<pass/fail>`
- eval-report inspection path — `<pass/fail>`

## Friction and undocumented knowledge

- <bullet list of real gaps, if any>

## Judgment

<explicit statement of whether restore succeeded from documented artifacts alone>

## Next changes

- <doc gaps or follow-up fixes>
- reserve failure injection for the next rehearsal
```

- [ ] **Step 2: Review the result note for auditability**

Check:

- all paths are explicit
- all commands are explicit
- every required pass/fail item is present
- the final judgment is explicit

Run:

```powershell
Get-Content docs\recovery-drills\2026-04-21-v1-recovery-rehearsal.md
```

Expected:

- note is complete enough for another operator to understand exactly what happened

## Task 7: Apply Minimal Doc Corrections If The Drill Exposed Real Gaps

**Files:**
- Modify: `docs/recovery-and-backups.md` if needed
- Modify: `docs/operator-quickstart.md` if needed
- Modify: `docs/operator-handbook.md` if needed

- [ ] **Step 1: Decide whether doc changes are actually needed**

Only proceed if the result note identifies:

- misleading recovery guidance
- missing bootstrap guidance
- missing operational steps

If no doc gaps were exposed, skip Task 7 and state that explicitly in the final commit summary.

- [ ] **Step 2: Apply only the minimum necessary doc changes**

Make only the clarifications directly justified by the rehearsal.

- [ ] **Step 3: Verify doc linkage and consistency**

Run:

```powershell
rg -n "recovery|backup|restore|operator-install|operator-start|operator-quickstart" `
  docs/recovery-and-backups.md `
  docs/operator-quickstart.md `
  docs/operator-handbook.md `
  docs/recovery-drills/2026-04-21-v1-recovery-rehearsal.md
```

Expected:

- the result note and any touched docs use consistent terminology
- no contradictory restore/bootstrap statements were introduced

## Task 8: Final Verification And Commit

**Files:**
- Create: `docs/recovery-drills/2026-04-21-v1-recovery-rehearsal.md`
- Modify: `docs/recovery-and-backups.md` if needed
- Modify: `docs/operator-quickstart.md` if needed
- Modify: `docs/operator-handbook.md` if needed

- [ ] **Step 1: Re-run the focused operator-path tests on the source checkout**

Run:

```powershell
pnpm test:operator-path
```

Expected:

- helper coverage still passes after any doc/result-note work

- [ ] **Step 2: Confirm the source checkout remains clean apart from the intended docs**

Run:

```powershell
git status --short --branch
```

Expected:

- only the result note and any justified doc updates are present

- [ ] **Step 3: Commit the rehearsal artifacts**

If only the result note was added:

```bash
git add docs/recovery-drills/2026-04-21-v1-recovery-rehearsal.md
git commit -m "docs: record v1 recovery rehearsal"
```

If doc clarifications were also needed:

```bash
git add docs/recovery-drills/2026-04-21-v1-recovery-rehearsal.md docs/recovery-and-backups.md docs/operator-quickstart.md docs/operator-handbook.md
git commit -m "docs: record v1 recovery rehearsal"
```

---

## Self-Review

### Spec coverage

- same-machine fresh sibling restore target: covered by Tasks 2 and 3
- `git clone` plus full `data/` backup boundary: covered by Tasks 1 through 3
- required validation and operator wrapper checks: covered by Task 4
- one normal inquiry, one Witness path, one eval-report inspection path: covered by Task 5
- dated result note with explicit judgment: covered by Task 6
- minimal doc corrections only if exposed by the drill: covered by Task 7
- no failure injection in this pass: preserved by scope and task boundaries

### Placeholder scan

- No `TBD`, `TODO`, or “implement later” markers remain.
- All operational paths, commands, and output expectations are concrete enough to execute.

### Type and interface consistency

- The restore target path is consistently `F:\ProcessoErgoSum\G_5.2-recovery-rehearsal-2026-04-21`.
- The backup path is consistently `.local/recovery-rehearsal/2026-04-21-data-backup`.
- The durable tracked output is consistently `docs/recovery-drills/2026-04-21-v1-recovery-rehearsal.md`.
