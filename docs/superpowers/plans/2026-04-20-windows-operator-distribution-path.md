# Windows Operator Distribution Path Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Windows-first local operator install/start path for the v1 release line using PowerShell wrappers, explicit release identity output, and a short operator quickstart.

**Architecture:** Keep the implementation conservative. Use two PowerShell entrypoints for operator install/start, and one small Node helper module for testable release-identity and `.env` parsing logic. The PowerShell scripts derive repo root from script location, stay fail-fast, and remain thin wrappers around the repo’s existing verification and dashboard commands. Documentation points to this path instead of duplicating bootstrap knowledge.

**Tech Stack:** PowerShell 5.1+/7+, Node.js built-ins, existing pnpm monorepo scripts, Markdown docs, Node test runner.

---

## File Structure

- Create: `scripts/operator-support.mjs`
  Purpose: parse plain `.env` content safely, inspect git/tag state, and resolve the declared v1 release SHA from repo artifacts in a testable Node module.
- Create: `scripts/operator-support.test.mjs`
  Purpose: focused tests for release-identity fallback logic and non-executable `.env` parsing.
- Modify: `package.json`
  Purpose: add a focused script for running operator-path helper tests.
- Create: `scripts/operator-install.ps1`
  Purpose: Windows-first install/verify wrapper that derives repo root from script location, runs the local verification chain, and prints release identity.
- Create: `scripts/operator-start.ps1`
  Purpose: Windows-first dashboard start wrapper that derives repo root from script location, loads `.env` via the safe parser helper, and prints release identity plus dashboard URL.
- Create: `docs/operator-quickstart.md`
  Purpose: shortest supported Windows-first path from clone to running dashboard.
- Modify: `README.md`
  Purpose: point operators to the quickstart as the supported bootstrap path for the v1 release line.
- Modify: `docs/operator-handbook.md`
  Purpose: cross-link the quickstart and avoid duplicated bootstrap/setup detail.

## Task 1: Add Testable Operator Helper Logic

**Files:**
- Create: `scripts/operator-support.mjs`
- Create: `scripts/operator-support.test.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write the failing helper tests**

Create `scripts/operator-support.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";

import {
  parseDotEnvContent,
  readDeclaredV1ReleaseSha,
  summarizeReleaseIdentity,
} from "./operator-support.mjs";

test("parseDotEnvContent accepts only plain KEY=VALUE lines", () => {
  const parsed = parseDotEnvContent(`
# comment
OPENROUTER_API_KEY=abc123
AZURE_OPENAI_ENDPOINT=https://example.openai.azure.com/
 BAD LINE
QUOTED=value=with=equals
`);

  assert.deepEqual(parsed, {
    OPENROUTER_API_KEY: "abc123",
    AZURE_OPENAI_ENDPOINT: "https://example.openai.azure.com/",
    QUOTED: "value=with=equals",
  });
});

test("readDeclaredV1ReleaseSha falls back from release gate to release note commit", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "g52-operator-support-"));

  await mkdir(path.join(root, "packages", "canon", "changelog"), {
    recursive: true,
  });
  await mkdir(path.join(root, "docs", "release-notes"), { recursive: true });

  await writeFile(
    path.join(root, "packages", "canon", "changelog", "0004-v1-release-gate.md"),
    [
      "# 0004 — V1 Release Gate",
      "",
      "Grounded in:",
      "- `docs/release-notes/v1-rc-2026-04-20.md`",
    ].join("\\n"),
    "utf8"
  );
  await writeFile(
    path.join(root, "docs", "release-notes", "v1-rc-2026-04-20.md"),
    "- Commit SHA: `b044c7b512ae61154c8b840ba4740fd68db137f4`\\n",
    "utf8"
  );

  const sha = await readDeclaredV1ReleaseSha(root);
  assert.equal(sha, "b044c7b512ae61154c8b840ba4740fd68db137f4");
});

test("summarizeReleaseIdentity distinguishes local tag states", () => {
  assert.equal(
    summarizeReleaseIdentity({
      headSha: "aaa111",
      declaredV1Sha: "aaa111",
      localTagSha: "aaa111",
    }).state,
    "local_tag_matches"
  );

  assert.equal(
    summarizeReleaseIdentity({
      headSha: "bbb222",
      declaredV1Sha: "aaa111",
      localTagSha: "aaa111",
    }).state,
    "local_tag_mismatch"
  );

  assert.equal(
    summarizeReleaseIdentity({
      headSha: "aaa111",
      declaredV1Sha: "aaa111",
      localTagSha: null,
    }).state,
    "no_local_tag_declared_match"
  );
});
```

- [ ] **Step 2: Run the helper tests to verify they fail**

Run:

```bash
node --test scripts/operator-support.test.mjs
```

Expected: FAIL because `scripts/operator-support.mjs` does not exist yet.

- [ ] **Step 3: Implement the helper module**

Create `scripts/operator-support.mjs`:

```js
import path from "node:path";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";

const ENV_KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function parseDotEnvContent(content) {
  const result = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const equalsIndex = line.indexOf("=");
    if (equalsIndex <= 0) continue;

    const key = line.slice(0, equalsIndex).trim();
    const value = line.slice(equalsIndex + 1);

    if (!ENV_KEY_RE.test(key)) continue;
    result[key] = value;
  }

  return result;
}

export async function readDeclaredV1ReleaseSha(repoRoot) {
  const gatePath = path.join(
    repoRoot,
    "packages",
    "canon",
    "changelog",
    "0004-v1-release-gate.md"
  );
  const gateText = await readFile(gatePath, "utf8");
  const noteMatch = gateText.match(/`(docs\/release-notes\/[^`]+\.md)`/);

  const releaseNotePath = noteMatch
    ? path.join(repoRoot, ...noteMatch[1].split("/"))
    : path.join(repoRoot, "docs", "release-notes", "v1-rc-2026-04-20.md");

  const releaseNote = await readFile(releaseNotePath, "utf8");
  const shaMatch = releaseNote.match(/- Commit SHA: `([0-9a-f]{40})`/i);

  return shaMatch ? shaMatch[1] : null;
}

export function summarizeReleaseIdentity({ headSha, declaredV1Sha, localTagSha }) {
  if (localTagSha) {
    if (localTagSha === headSha) {
      return {
        state: "local_tag_matches",
        message: "This checkout matches local v1 tag.",
      };
    }

    return {
      state: "local_tag_mismatch",
      message: "Local v1 tag exists but does not match this checkout.",
    };
  }

  if (declaredV1Sha && declaredV1Sha === headSha) {
    return {
      state: "no_local_tag_declared_match",
      message:
        "Local v1 tag is not present; this checkout matches the declared v1 release commit.",
    };
  }

  return {
    state: "no_local_tag_declared_mismatch",
    message:
      "Local v1 tag is not present; comparing against declared v1 release commit instead.",
  };
}

export function gitSha(cwd, ref) {
  try {
    return execFileSync("git", ["rev-parse", ref], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Expose a focused test script in the root package**

Update `package.json`:

```json
{
  "scripts": {
    "test:operator-path": "node --test scripts/operator-support.test.mjs"
  }
}
```

- [ ] **Step 5: Run the helper tests to verify they pass**

Run:

```bash
pnpm test:operator-path
```

Expected: PASS with all three helper tests green.

- [ ] **Step 6: Commit**

```bash
git add package.json scripts/operator-support.mjs scripts/operator-support.test.mjs
git commit -m "test: add operator path helper coverage"
```

## Task 2: Add The Windows Install Wrapper

**Files:**
- Create: `scripts/operator-install.ps1`
- Modify: `scripts/operator-support.mjs`
- Modify: `scripts/operator-support.test.mjs`

- [ ] **Step 1: Add a failing helper test for release-identity display data**

Append to `scripts/operator-support.test.mjs`:

```js
test("summarizeReleaseIdentity includes both current and declared SHAs in operator output data", () => {
  const summary = summarizeReleaseIdentity({
    headSha: "b044c7b512ae61154c8b840ba4740fd68db137f4",
    declaredV1Sha: "b044c7b512ae61154c8b840ba4740fd68db137f4",
    localTagSha: null,
  });

  assert.equal(summary.headSha, "b044c7b512ae61154c8b840ba4740fd68db137f4");
  assert.equal(summary.declaredV1Sha, "b044c7b512ae61154c8b840ba4740fd68db137f4");
});
```

- [ ] **Step 2: Run the helper tests to verify they fail**

Run:

```bash
pnpm test:operator-path
```

Expected: FAIL because `summarizeReleaseIdentity` does not yet return the SHA fields.

- [ ] **Step 3: Extend the helper to return install-script display data**

Update the return objects inside `scripts/operator-support.mjs`:

```js
export function summarizeReleaseIdentity({ headSha, declaredV1Sha, localTagSha }) {
  const base = {
    headSha,
    declaredV1Sha,
    localTagSha,
  };

  if (localTagSha) {
    if (localTagSha === headSha) {
      return {
        ...base,
        state: "local_tag_matches",
        message: "This checkout matches local v1 tag.",
      };
    }

    return {
      ...base,
      state: "local_tag_mismatch",
      message: "Local v1 tag exists but does not match this checkout.",
    };
  }

  if (declaredV1Sha && declaredV1Sha === headSha) {
    return {
      ...base,
      state: "no_local_tag_declared_match",
      message:
        "Local v1 tag is not present; this checkout matches the declared v1 release commit.",
    };
  }

  return {
    ...base,
    state: "no_local_tag_declared_mismatch",
    message:
      "Local v1 tag is not present; comparing against declared v1 release commit instead.",
  };
}
```

- [ ] **Step 4: Implement the install script**

Create `scripts/operator-install.ps1`:

```powershell
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $repoRoot

$requiredPaths = @(
  "package.json",
  "README.md",
  "docs/operator-handbook.md",
  "packages/canon/changelog/0004-v1-release-gate.md"
)

foreach ($relativePath in $requiredPaths) {
  $fullPath = Join-Path $repoRoot $relativePath
  if (-not (Test-Path -LiteralPath $fullPath)) {
    throw "Derived repo root is invalid. Missing required path: $relativePath"
  }
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Missing prerequisite: node"
}

if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
  throw "Missing prerequisite: pnpm"
}

$headSha = (git rev-parse HEAD).Trim()
$localTagSha = $null
try {
  $localTagSha = (git rev-parse refs/tags/v1).Trim()
} catch {
  $localTagSha = $null
}

$declaredV1Sha = node --input-type=module -e @'
import { readDeclaredV1ReleaseSha } from "./scripts/operator-support.mjs";
const repoRoot = process.cwd();
const sha = await readDeclaredV1ReleaseSha(repoRoot);
process.stdout.write(sha ?? "");
'@

$identityJson = node --input-type=module -e @'
import { summarizeReleaseIdentity } from "./scripts/operator-support.mjs";
const summary = summarizeReleaseIdentity({
  headSha: process.argv[1],
  declaredV1Sha: process.argv[2] || null,
  localTagSha: process.argv[3] || null,
});
process.stdout.write(JSON.stringify(summary));
'@ $headSha $declaredV1Sha $localTagSha

$identity = $identityJson | ConvertFrom-Json

function Invoke-Step {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Label,
    [Parameter(Mandatory = $true)]
    [scriptblock]$Action
  )

  Write-Host "==> $Label"
  & $Action
  if ($LASTEXITCODE -ne 0) {
    throw "Verification failed at step: $Label"
  }
}

Invoke-Step -Label "pnpm install" -Action { pnpm install }
Invoke-Step -Label "pnpm validate:canon" -Action { pnpm validate:canon }
Invoke-Step -Label "pnpm validate:witness" -Action { pnpm validate:witness }
Invoke-Step -Label "pnpm typecheck" -Action { pnpm typecheck }
Invoke-Step -Label "pnpm test" -Action { pnpm test }
Invoke-Step -Label "pnpm smoke" -Action { pnpm smoke }

Write-Host ""
Write-Host "Operator install succeeded."
Write-Host "Current SHA: $($identity.headSha.Substring(0, 7))"
if ($identity.declaredV1Sha) {
  Write-Host "Declared v1 SHA: $($identity.declaredV1Sha.Substring(0, 7))"
}
Write-Host $identity.message
```

- [ ] **Step 5: Run the helper tests to verify they still pass**

Run:

```bash
pnpm test:operator-path
```

Expected: PASS.

- [ ] **Step 6: Manually verify the install wrapper on the current checkout**

Run:

```powershell
.\scripts\operator-install.ps1
```

Expected:

- all verification commands pass
- script prints current SHA
- script prints declared `v1` SHA
- script prints one of the three release-identity states

- [ ] **Step 7: Commit**

```bash
git add scripts/operator-support.mjs scripts/operator-support.test.mjs scripts/operator-install.ps1
git commit -m "feat: add windows operator install wrapper"
```

## Task 3: Add The Windows Start Wrapper

**Files:**
- Create: `scripts/operator-start.ps1`
- Modify: `scripts/operator-support.mjs`
- Modify: `scripts/operator-support.test.mjs`

- [ ] **Step 1: Add a failing helper test for reading `.env` files from disk without evaluation**

Update the import block in `scripts/operator-support.test.mjs`:

```js
import {
  parseDotEnvContent,
  readDeclaredV1ReleaseSha,
  readDotEnvFile,
  summarizeReleaseIdentity,
} from "./operator-support.mjs";
```

Then append:

```js
test("readDotEnvFile loads KEY=VALUE content from disk without evaluation", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "g52-operator-env-"));
  const envPath = path.join(root, ".env");

  await writeFile(
    envPath,
    [
      "SAFE_KEY=value",
      "INLINE_EXPR=$env:HOME",
      "SUBSHELL=$(Get-ChildItem)",
      "# comment",
    ].join("\\n"),
    "utf8"
  );

  const parsed = await readDotEnvFile(envPath);
  assert.equal(parsed.SAFE_KEY, "value");
  assert.equal(parsed.INLINE_EXPR, "$env:HOME");
  assert.equal(parsed.SUBSHELL, "$(Get-ChildItem)");
});
```

- [ ] **Step 2: Run the helper tests to verify they fail if parsing is too aggressive**

Run:

```bash
pnpm test:operator-path
```

Expected: FAIL because `readDotEnvFile` does not exist yet.

- [ ] **Step 3: Add the `.env` file reader helper**

Update `scripts/operator-support.mjs`:

```js
export async function readDotEnvFile(envPath) {
  const content = await readFile(envPath, "utf8");
  return parseDotEnvContent(content);
}
```

and does not add any evaluation, unquoting, or interpolation behavior.

- [ ] **Step 4: Implement the start script**

Create `scripts/operator-start.ps1`:

```powershell
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $repoRoot

$requiredPaths = @(
  "package.json",
  "apps/dashboard/src/server.ts",
  "scripts/operator-support.mjs"
)

foreach ($relativePath in $requiredPaths) {
  $fullPath = Join-Path $repoRoot $relativePath
  if (-not (Test-Path -LiteralPath $fullPath)) {
    throw "Derived repo root is invalid. Missing required path: $relativePath"
  }
}

if (-not (Test-Path -LiteralPath (Join-Path $repoRoot "node_modules"))) {
  throw "Dependencies do not appear to be installed. Run .\\scripts\\operator-install.ps1 first."
}

$headSha = (git rev-parse HEAD).Trim()
$localTagSha = $null
try {
  $localTagSha = (git rev-parse refs/tags/v1).Trim()
} catch {
  $localTagSha = $null
}

$declaredV1Sha = node --input-type=module -e @'
import { readDeclaredV1ReleaseSha } from "./scripts/operator-support.mjs";
const sha = await readDeclaredV1ReleaseSha(process.cwd());
process.stdout.write(sha ?? "");
'@

$identityJson = node --input-type=module -e @'
import { summarizeReleaseIdentity } from "./scripts/operator-support.mjs";
const summary = summarizeReleaseIdentity({
  headSha: process.argv[1],
  declaredV1Sha: process.argv[2] || null,
  localTagSha: process.argv[3] || null,
});
process.stdout.write(JSON.stringify(summary));
'@ $headSha $declaredV1Sha $localTagSha

$identity = $identityJson | ConvertFrom-Json

$envPath = Join-Path $repoRoot ".env"
if (Test-Path -LiteralPath $envPath) {
  $envJson = node --input-type=module -e @'
import { readDotEnvFile } from "./scripts/operator-support.mjs";
const parsed = await readDotEnvFile(process.argv[1]);
process.stdout.write(JSON.stringify(parsed));
'@ $envPath

  $parsed = $envJson | ConvertFrom-Json
  foreach ($property in $parsed.PSObject.Properties) {
    [Environment]::SetEnvironmentVariable($property.Name, [string]$property.Value, "Process")
  }
} else {
  Write-Warning ".env not found. Dashboard can still start, but live provider calls may be unavailable."
}

$port = if ($env:DASHBOARD_PORT) { $env:DASHBOARD_PORT } else { "5000" }
$hostName = if ($env:DASHBOARD_HOST) { $env:DASHBOARD_HOST } else { "0.0.0.0" }

Write-Host "Current SHA: $($identity.headSha.Substring(0, 7))"
if ($identity.declaredV1Sha) {
  Write-Host "Declared v1 SHA: $($identity.declaredV1Sha.Substring(0, 7))"
}
Write-Host $identity.message
Write-Host "Dashboard URL: http://localhost:$port/"

pnpm dashboard
```

- [ ] **Step 5: Run the helper tests to verify they pass**

Run:

```bash
pnpm test:operator-path
```

Expected: PASS.

- [ ] **Step 6: Manually verify the start wrapper**

Run:

```powershell
.\scripts\operator-start.ps1
```

Expected:

- script warns, not fails, if `.env` is absent
- script prints SHA and release identity
- script prints dashboard URL
- dashboard starts successfully

- [ ] **Step 7: Commit**

```bash
git add scripts/operator-support.mjs scripts/operator-support.test.mjs scripts/operator-start.ps1
git commit -m "feat: add windows operator start wrapper"
```

## Task 4: Add Quickstart And Doc Linkage

**Files:**
- Create: `docs/operator-quickstart.md`
- Modify: `README.md`
- Modify: `docs/operator-handbook.md`

- [ ] **Step 1: Write the quickstart doc**

Create `docs/operator-quickstart.md`:

```md
# G_5.2 Operator Quickstart

**Status:** supported Windows-first operator bootstrap path for the v1 release line.

## 1. Supported shell

- PowerShell 7+ preferred
- Windows PowerShell 5.1 supported

If Windows blocks local scripts, run PowerShell with a process-local bypass:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\operator-install.ps1
```

## 2. Prerequisites

- Node >= 20
- pnpm >= 9
- git

## 3. First install

```powershell
Copy-Item .env.example .env
.\scripts\operator-install.ps1
```

Fill `.env` only with the variables relevant to your operator scope.

## 4. Start the dashboard

```powershell
.\scripts\operator-start.ps1
```

## 5. Update an existing checkout

```powershell
git pull
.\scripts\operator-install.ps1
.\scripts\operator-start.ps1
```

## 6. Confirm release identity

Both scripts print:

- current short SHA
- declared `v1` SHA when available
- local-tag/declared-release identity state

## 7. Use the operator handbook for

- inquiry operations
- Witness operations
- editorial workflow
- reflection workflow
- eval and release operations
```

- [ ] **Step 2: Point the README at the quickstart**

Update the `Getting Started` section in `README.md` so it begins with:

```md
Preferred Windows-first operator bootstrap path:

- [`docs/operator-quickstart.md`](docs/operator-quickstart.md)

Direct command path remains available below for operators who want the raw repo commands.
```

- [ ] **Step 3: Cross-link the operator handbook**

Add near the top of `docs/operator-handbook.md`:

```md
For first install, Windows-first startup, and post-update revalidation, use
[`docs/operator-quickstart.md`](operator-quickstart.md) as the supported
bootstrap path. This handbook remains the detailed day-to-day operations
reference once the system is already installed and running.
```

- [ ] **Step 4: Review docs for duplication and consistency**

Check:

- quickstart stays short
- README points rather than duplicates
- operator handbook stays the detailed runtime reference

Run:

```bash
rg -n "operator-quickstart|operator-install|operator-start" README.md docs/operator-handbook.md docs/operator-quickstart.md
```

Expected:

- all three docs mention the new path
- no contradictory bootstrap instructions

- [ ] **Step 5: Commit**

```bash
git add docs/operator-quickstart.md README.md docs/operator-handbook.md
git commit -m "docs: add windows operator quickstart"
```

## Task 5: Final Verification And Closeout

**Files:**
- Modify: `README.md`
- Modify: `docs/operator-handbook.md`
- Create: `docs/operator-quickstart.md`
- Create: `scripts/operator-install.ps1`
- Create: `scripts/operator-start.ps1`
- Create: `scripts/operator-support.mjs`
- Create: `scripts/operator-support.test.mjs`
- Modify: `package.json`

- [ ] **Step 1: Run the focused operator helper tests**

Run:

```bash
pnpm test:operator-path
```

Expected: PASS.

- [ ] **Step 2: Run the repo verification suite**

Run:

```bash
pnpm validate:canon
pnpm validate:witness
pnpm typecheck
pnpm test
pnpm smoke
```

Expected: PASS across the full existing suite.

- [ ] **Step 3: Run the Windows-first install path manually one more time**

Run:

```powershell
.\scripts\operator-install.ps1
```

Expected:

- all verification steps pass
- script prints current SHA
- script prints declared `v1` SHA when available
- script prints local tag state distinctly

- [ ] **Step 4: Run the Windows-first start path manually one more time**

Run:

```powershell
.\scripts\operator-start.ps1
```

Expected:

- script prints current SHA
- script prints declared `v1` SHA when available
- script prints local tag state distinctly
- dashboard launches and is reachable at the printed URL

- [ ] **Step 5: Commit the finished sub-project**

```bash
git add package.json scripts/operator-support.mjs scripts/operator-support.test.mjs scripts/operator-install.ps1 scripts/operator-start.ps1 docs/operator-quickstart.md README.md docs/operator-handbook.md
git commit -m "feat: add windows operator distribution path"
```

---

## Self-Review

### Spec coverage

- Windows-first PowerShell pair: covered by Tasks 2 and 3.
- Release identity without local-tag dependence: covered by Tasks 1, 2, and 3.
- Explicit shell support and execution-policy note: covered by Task 4.
- Non-executable `.env` loading: covered by Tasks 1 and 3.
- Quickstart + doc linkage: covered by Task 4.
- No recovery/container/service scope creep: preserved by the file structure and task boundaries.

### Placeholder scan

- No `TBD`, `TODO`, or “implement later” markers remain.
- Commands, file paths, and snippet shapes are concrete.

### Type and interface consistency

- The helper module is consistently named `scripts/operator-support.mjs`.
- Focused test command is consistently `pnpm test:operator-path`.
- The PowerShell wrappers consistently use the helper for declared release identity and `.env` parsing.
