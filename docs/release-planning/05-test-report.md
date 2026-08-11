# Release & Windows Installer — Stage 5 Test Report

> **Stage 5 of 6** (empirical validation) · Repo: `C:\Users\antmi\interviewer` · Branch: `feature/release-installer-packaging`
> Date: 2026-08-09/10 (session spans local UTC−7 midnight; log dates are UTC) · Tester: `testing-quality-specialist`
> Method: everything automatable was executed on this Windows machine with commands + outputs recorded. Interactive-GUI-only items are marked **HUMAN-REQUIRED** with exact steps — nothing is faked.
> Inputs validated: `release/Interviewer-Setup-1.0.0.exe` (built 2026-08-09 18:03 local), `.github/workflows/electron-release.yml`, `.github/workflows/nodejs-ci.yml`, README.md, docs/INSTALLATION.md, `.github/RELEASE-NOTES-TEMPLATE.md`, shipped asar bundle.

## Verdict headline

**FIX-FIRST — four small doc/hygiene fixes, no rebuild required.** The installer binary itself passed every functional test (silent install, overlay install, no-admin, launch, graceful no-server boot, uninstall with data preservation, byte-identical asar round-trip). The failures are all in the *paperwork around it*: a stale `SHA256SUMS.txt`, a wrong install path documented in 5 places, one 404 link, and one GitHub-invalid anchor. Fix list at §Defects; estimated effort < 30 min, no rebuild/re-sign needed.

**Score: T1 PASS-with-defect · T2 PASS · T3 PASS · T4 PASS · T5 PASS · T6 FAIL (4 defects) · T7 PASS-as-documented.** 7 defects (0 critical / 1 high-doc-impact / 2 medium / 4 low) + 3 observations.

---

## T1 — Artifact integrity — **PASS with defect D1**

Environment: PowerShell `Get-FileHash` / .NET SHA512 on `C:\Users\antmi\interviewer\release\`.

| Check | Result | Evidence |
|---|---|---|
| Installer exists | PASS | `release\Interviewer-Setup-1.0.0.exe`, LastWrite 2026-08-09 18:03:10 |
| Size | PASS (SM-9) | 118,628,621 B = **113.13 MB** (>80 MB expected band, <150 MB cap) |
| SHA256 | recorded | `5E0AD1B7BE4B405F6F70F7D62EBCBCC0D91D25418D0D034A1982B72E047DAAE2` |
| Blockmap exists | PASS | `Interviewer-Setup-1.0.0.exe.blockmap`, 125,400 B |
| latest.yml references | PASS | `url: Interviewer-Setup-1.0.0.exe`, `size: 118628621` (exact byte match), `version: 1.0.0` |
| **latest.yml sha512 == actual file** | **PASS** | computed base64 SHA512 = `yNzglIx4P+Swvn0/mcLNeTVifDe9WznB44AdaOIK15IogvH7wNRkAfIgWHS0QloFg3wWCq8eQoUPcwsnIxiRZQ==` = latest.yml value (both occurrences) |
| Version coherence | PASS | `package.json version = 1.0.0` (`name: ai-interviewer`) == artifact name `Interviewer-Setup-1.0.0.exe` == latest.yml `version: 1.0.0` |
| SHA256SUMS.txt entries vs files | **FAIL → D1** | all 3 entries MISMATCH (file is stale) |

**D1 evidence (verbatim):**
```
Interviewer-Setup-1.0.0.exe: expected=366052D2B50E…C8FA81 actual=5E0AD1B7BE4B…047DAAE2 -> MISMATCH
latest.yml:                  expected=EC398E2180FC…1D6BC6B actual=1027FE9B8BFC…221D6BC6B -> MISMATCH
…exe.blockmap:               expected=7FF1D5494051…4FAB9   actual=B97F08133AB8…F74FAB9   -> MISMATCH
SHA256SUMS.txt timestamp: 08/09/2026 13:19:05   ← generated BEFORE the final rebuild
exe timestamp:            08/09/2026 18:03:10   ← D8-URL-fix rebuild happened after
```
Root cause: the final installer rebuild (04-implementation-log.md “Post-Stage-4 correction”, 18:03) regenerated exe/latest.yml/blockmap but **not** SHA256SUMS.txt, invalidating the log’s 13:19 round-trip claim. CI is unaffected (workflow regenerates the file each run) — but the local deliverable set is internally inconsistent.

## T2 — Installer behavior (per-user, no admin) — **PASS** (overlay = B1 verified)

Pre-state discovery (matters for interpretation):
- No Interviewer process running; a **March 2026 build** was installed at `%LOCALAPPDATA%\Programs\ai-interviewer` (494.8 MB, exe SHA256 `C9D66510…`, ARP GUID key `75eb1a78-f70b-5907-a0c1-7d9f8f7ce8b6`, Publisher empty, UninstallString in the old dir).
- **Current account is NOT administrator** (`IsInRole(Administrator) = False`) → every install/uninstall below genuinely ran non-admin.

Silent install (overlay onto March build):
```
Start-Process -Wait .\release\Interviewer-Setup-1.0.0.exe -ArgumentList '/S'
→ EXIT_CODE: 0   ELAPSED: 54.7 s   (NSIS /S honored; no auto-launch in silent mode, as expected)
```
Verification:
- Files replaced in the prior install dir (electron-builder upgrade semantics — same appId GUID, registry `InstallLocation` reuse). Proof of replacement: installed `resources\app.asar` SHA256 `3A114729ED3A86F163701868A92EF67544496B5026EF4CE592D8F48397951306` **==** build `release\win-unpacked\resources\app.asar` hash; exe sizes equal (213,764,096 B).
- Recursive file comparison install-vs-build: 131 vs 130 files — **0 orphans, 0 missing**, sole extra = `Uninstall Interviewer.exe` (expected).
- Shortcuts survived and resolve: Start Menu + Desktop `.lnk` → `…\Programs\ai-interviewer\Interviewer.exe` (targetExists=True).
- ARP: single entry (GUID reused, no duplicate), `Publisher` updated `"" → "Lemonade SDK"`, `EstimatedSize` updated `506533 → 445316 KB` (~435 MB installed footprint, N7).
- **B1 verdict: PASS** — overlay over an occupied install (app closed) succeeded cleanly, one ARP entry, shortcuts intact.

**Caveat discovered (feeds D2):** the install dir remained `Programs\ai-interviewer` (prior dir name), not `Programs\Interviewer` — investigated to root cause in T4.

## T3 — Installed app smoke test — **PASS**

Launch test: started installed `Interviewer.exe`; after 20 s: 4 processes alive (normal Electron main/GPU/renderer/utility), `MainWindowTitle = "Interviewer"`. Killed with `taskkill /IM Interviewer.exe /F` — all terminated, none respawned.

userData: `%APPDATA%\ai-interviewer` created on first launch — **folder name `ai-interviewer` confirmed** (the value all docs use). Log: `logs\app-2026-08-10.log` (UTC-dated).

Startup log analysis (key lines, verbatim):
```
[APP START] 2026-08-10T01:16:30.573Z | Electron 40.2.1 | Node v24.11.1
[LOG] Database initialized successfully
[LOG] Lemonade Server client initialized: {"baseURL":"http://localhost:8000/api/v1","model":"gpt-oss-mxp4"}
[LOG] Application initialized successfully
[LOG] Loading production HTML from: …\Programs\ai-interviewer\resources\app.asar\dist\renderer\index.html
[LOG] App is packaged: true
[ERROR] Failed to fetch server health: … "url":"http://localhost:8000/api/v1/health" … "code":"ECONNREFUSED"
[WARN] [AudioPreload] Server not reachable — skipping audio model preload.
[ERROR] Failed to load model "gpt-oss-mxp4": Failed to load model (HTTP N/A)
```
Verdict: clean boot, packaged-mode paths correct, server-absence handled gracefully (logged, no crash, window stayed up). The two ERROR lines are the *expected* no-server behavior, not boot defects. **No fatal stack traces.** See OBS-1 for the environment nuance (a LemonadeServer process WAS running on this box but is undetectable by the app).

Shipped-bundle content checks (against the **installed** app.asar, extracted to temp):
| Check | Result | Evidence |
|---|---|---|
| B2: `prompts.json` in asar | PASS | `\dist\electron\src\data\prompts.json` present (31,719 B); parses as JSON; keys `interview, persona, document, extraction` |
| URL-fix: `lemonade.msi` present | PASS | 1 occurrence: `github.com/lemonade-sdk/lemonade/releases/latest/download/lemonade.msi` in `index-DkCNibxK.js` |
| URL-fix: zero `lemonade-sdk/lemonade-server` | PASS | `grep -rc` over entire shipped `dist/` → **zero occurrences** |
| Zero `lemonade-server.ai` in renderer | PASS | 0 occurrences (kept only in LemonadeClient.ts dev comment, intentional per D-5) |
| INSTALLATION.md in-app link | PASS | `https://github.com/lemonade-sdk/interviewer/blob/main/docs/INSTALLATION.md` present |

## T4 — Uninstall behavior — **PASS** (and produced root-cause finding D2)

Pre-uninstall snapshot of `%APPDATA%\ai-interviewer`: 39 files, 1,768.4 KB; data-file hashes pinned:
`interviewer.json → 7088C71E…F4100230`, `user.json → 8C065606…15CFF4606C`.
(Note: this entire dir was created by the T3 launch minutes earlier — no real user data existed; destructive risk was zero.)

Silent uninstall via registry QuietUninstallString (`"…\Uninstall Interviewer.exe" /currentuser /S`): **exit 0, ~28 s.** Post-checks:
| Check | Result |
|---|---|
| Install dir gone | PASS (`Programs\ai-interviewer` and `Programs\Interviewer` both absent) |
| Start Menu + Desktop shortcuts gone | PASS (0 and 0) |
| ARP registry entry gone | PASS (0 matching keys) |
| `%APPDATA%\ai-interviewer` **preserved** | PASS — exists, 39 files, 1,768.4 KB, both data-file SHA256 hashes **byte-identical** to pre-snapshot |

`deleteAppDataOnUninstall: false` claim **empirically confirmed**.

**Clean-machine simulation + reinstall (root-causing the directory name):**
1. Deleted electron-builder’s installer-memory key `HKCU:\Software\75eb1a78-…` (which stores `InstallLocation` and, notably, **survives uninstall** — OBS-2), uninstalled again → fully clean state, no registry trace.
2. Fresh silent install (exit 0, 25.3 s) → installed to `%LOCALAPPDATA%\Programs\ai-interviewer` — **not** `Programs\Interviewer`.
3. Root cause verified in electron-builder source: `NsisTarget.js:165` sets `APP_FILENAME = getWindowsInstallationDirName(appInfo, !oneClick || isPerMachine)`; `targetUtil.js`: with `oneClick:true, perMachine:false` the flag is `false` → returns `appInfo.sanitizedName` = package.json `name` = **`ai-interviewer`** (productName is only used for assisted/per-machine installs).
4. **Therefore `%LOCALAPPDATA%\Programs\Interviewer` as documented in INSTALLATION.md (×4) + RELEASE-NOTES-TEMPLATE.md (×1) is wrong for every machine — defect D2.** Corollary: INSTALLATION.md L92 (“two different folder names… both are expected”) is doubly wrong — install dir and data dir are both `ai-interviewer`.

Final state restore: app reinstalled (latest asar hash matches build), both shortcuts recreated and resolving, userData intact, launch re-verified (window up in 12 s, then killed). Machine left with app installed.

## T5 — Release workflow static validation — **PASS**

YAML validity (js-yaml programmatic parse): both files **valid**; `electron-release.yml` jobs `build-windows, create-release`; `nodejs-ci.yml` job `build-and-test`.

Logic review (electron-release.yml line refs):
| Requirement | Result | Evidence (quoted) |
|---|---|---|
| Upload paths = 4 frozen artifacts (B4) | PASS | L157–161 `release/*.exe`, `release/latest.yml`, `release/*.blockmap`, `release/SHA256SUMS.txt` |
| Version↔tag guard present, before packaging | PASS | L56–70, 2nd step after checkout: `if ($actual -ne $expected) { … exit 1 }` |
| Guard skipped on dispatch | PASS | L57 `if: startsWith(github.ref, 'refs/tags/')` |
| `--publish never`, never `--publish` alone | PASS | L111 `npx electron-builder --win nsis --x64 --publish never` (only occurrence) |
| No GH_TOKEN in electron-builder step (D-3) | PASS | L104–116 carry no `env:` at all |
| Concurrency groups identical in both workflows | PASS | both: `group: self-hosted-windows-serial` / `cancel-in-progress: false` (release L34–36; nodejs-ci L35–37) |
| create-release verifies 4 artifact types, fails loudly | PASS | L209–218 builds `$missing`, `exit 1` if non-empty |
| Body = tag notes else template | PASS | L229–236: `docs/release-notes/$tag.md` if `Test-Path`, else `.github/RELEASE-NOTES-TEMPLATE.md` |
| Retention 30d / if-no-files-found error | PASS | L162–163 |
| Extras: timeout 45 (L46), disk guard <10 GB (L119–129), win-unpacked delete `if: always()` (L166–173), prerelease = tag contains `-` (L221–224), no dispatch inputs (L28–29), `contents: write` (L31–32), referenced files exist (`.github/actions/cleanup-processes-windows/action.yml`, template) | PASS | all confirmed |

Executed simulations:
- **SHA256SUMS generation snippet** run verbatim against `release/` (output to temp): 3 lines, format `^[0-9A-F]{64}  \S+$` all OK, hashes equal the recomputed file hashes (this is also the exact fix for D1).
- **Version guard** run verbatim (script-file variant of L59–70): `v1.0.0` → “Version guard passed”, **exit 0**; `v9.9.9` → Write-Error, **exit 1**; `v1.0.0-rc.1` → **exit 1** (prerelease suffix strictness).
- **Artifact verification snippet** (L209–218): positive dir with 4 types → exit 0; dir missing SHA256SUMS.txt → “Frozen artifact set incomplete”, exit 1.

**Hardening note (D5, low):** `${{ github.ref_name }}` is interpolated directly into PowerShell strings (L61, L221). Git tag names may contain `$`/backticks, so a hostile tag = script-injection surface; risk is low (tag push requires write access). Recommend `$env:GITHUB_REF_NAME` instead.

## T6 — Docs accuracy — **FAIL** (defects D2, D3, D4)

URL validation (curl -L, final status):
| URL | Status |
|---|---|
| https://github.com/lemonade-sdk/lemonade | 200 |
| https://github.com/lemonade-sdk/lemonade/releases/latest/download/lemonade.msi | 206 (range GET) — redirects to real release asset `lemonade.msi` |
| https://github.com/lemonade-sdk/interviewer (+ /releases, /blob/main/LICENSE) | 200 / 200 / 200 |
| https://lemonade-server.ai/docs/guide/install/ | 200 |
| https://github.com/ggerganov/llama.cpp · https://github.com/openai/whisper | 200 / 200 |
| **https://github.com/kokoro-js/kokoro** | **404 → D3** |

Anchors:
- README `#system-requirements` → heading `## System Requirements` exists (README L36) — PASS.
- **README `docs/INSTALLATION.md#smartscreen` → BROKEN (D4).** INSTALLATION.md L46 uses `## Step 3 — Run the installer {#smartscreen}` — the `{#id}` syntax is Pandoc-style and **not supported by GitHub Markdown**: the literal `{#smartscreen}` renders as visible heading text and the real GitHub slug is `step-3--run-the-installer-smartscreen` (which is exactly what the internal FAQ link at L107 uses — confirming the slug analysis). The README link will land on the page without scrolling to the section.

Cross-checks:
- Artifact-name pattern: README/INSTALLATION/template say `Interviewer-Setup-x.y.z.exe` / `Interviewer-Setup-{VERSION}.exe` — matches real `Interviewer-Setup-1.0.0.exe`. PASS.
- Size claims: INSTALLATION “~120 MB download / ~450 MB installed” vs measured 113.13 MB / ~435 MB (ARP 445,316 KB) — honest. PASS.
- Install-path claims: **wrong in 5 places (D2)** — INSTALLATION.md L50, L81, L88 (table), L104 (FAQ) and RELEASE-NOTES-TEMPLATE.md L29 all say `%LOCALAPPDATA%\Programs\Interviewer`; measured reality on a simulated clean machine is `%LOCALAPPDATA%\Programs\ai-interviewer`. INSTALLATION.md L92 “different folder names” note also wrong. (README makes no install-path claim — clean.)
- Release-notes template mandatory sections (02 §6.3): all six present, incl. close-before-upgrade known-issue (B1) and purge path. PASS.

## T7 — Pre-existing test suite — **PASS-as-documented**

`npm test` → **exit 1**, sole output:
```
● Validation Error:
  Preset ts-jest not found relative to rootDir C:\Users\antmi\interviewer.
```
Confirmed pre-existing: `ts-jest` absent from `package.json` **at HEAD** (`git show HEAD:package.json`) and in the working tree; jest never initializes, so no test-level failures can exist and none new were introduced. Matches 04-implementation-log “Housekeeping” + freeze D9 (CI runs tests `continue-on-error`). Test files present: `src/__tests__/{database,services}.test.ts` (currently unrunnable — backlog: add `ts-jest` + `@types/jest`).

---

## Defects (severity-ranked)

| # | Sev | Where | Defect | Fix (exact) |
|---|---|---|---|---|
| D1 | **MED** | `release/SHA256SUMS.txt` | Stale: generated 13:19, artifacts rebuilt 18:03; all 3 hashes mismatch actual files | Re-run the workflow checksum snippet against `release/` (simulated output verified in T5): `366052D2…→5E0AD1B7…` (exe), `EC398E21…→1027FE9B…` (latest.yml), `7FF1D549…→B97F0813…` (blockmap) |
| D2 | **HIGH (docs)** | INSTALLATION.md L50/L81/L88/L92/L104; RELEASE-NOTES-TEMPLATE.md L29 | Install path documented as `%LOCALAPPDATA%\Programs\Interviewer`; reality (proven clean-machine, root-caused in electron-builder source) is `%LOCALAPPDATA%\Programs\ai-interviewer`. L92 “two different folder names” note is wrong — both dirs are `ai-interviewer`. Template error would ship in **every release body** | Replace path in all 5 spots with `%LOCALAPPDATA%\Programs\ai-interviewer`; rewrite L92 note (“install dir and data dir share the name `ai-interviewer`”). Do **not** rename package.json (frozen D6) |
| D3 | LOW | README.md L239 | `https://github.com/kokoro-js/kokoro` → 404 | Point at the correct upstream (e.g. `https://github.com/hexgrad/kokoro`) |
| D4 | LOW–MED | README.md link + INSTALLATION.md L46/L107 | `{#smartscreen}` anchor syntax unsupported by GitHub → `#smartscreen` link from README doesn’t resolve; literal `{#smartscreen}` renders in the heading | Remove `{#smartscreen}` from the heading; change README link to `docs/INSTALLATION.md#step-3--run-the-installer`; update FAQ internal link (L107) to the same slug |
| D5 | LOW (hardening) | electron-release.yml L61/L221 | `${{ github.ref_name }}` interpolated directly into PowerShell (tag-name injection surface; low risk — tag push needs write access) | Use `$env:GITHUB_REF_NAME` / `$env:GITHUB_REF` instead |

D1–D4 are docs/hygiene-only: **no source changes, no installer rebuild required.** The shipped binary passed everything.

## Observations (not release-blocking)

- **OBS-1 (MED–HIGH, app-level, pre-existing — backlog):** on this reference box a Lemonade Server IS running (`LemonadeServer.exe`, PID 13024, listening on 9000/13305; port 13305 answers HTTP with a FLUX/ComfyUI-style model catalog), yet the app cannot detect it: file probe expects `%LOCALAPPDATA%\lemonade_server\bin\lemonade-server.exe` (doesn’t exist; real binary is `LemonadeServer.exe`), PATH probe fails, and health checks hardcode `http://localhost:8000/api/v1` (nothing on 8000). Result: users with a current Lemonade build may be told “not installed” while it runs. App handled it gracefully (guidance path, no crash) — but the detection/port assumptions need confirmation with the Lemonade team. Outside this program’s freeze (no behavior changes allowed).
- **OBS-2 (LOW):** electron-builder’s installer-memory key `HKCU:\Software\75eb1a78-…` (`InstallLocation`) **survives uninstall** and permanently pins the install directory — this is why overlay and post-uninstall reinstalls both reuse `Programs\ai-interviewer` on this box. Irrelevant for fresh users; useful for support.
- **OBS-3 (INFO):** `npm test` red by pre-existing config (T7); CI tolerates it (`continue-on-error`). Backlog already noted in D-log.

## Residual risk

1. **M1 manual matrix incomplete** — automated coverage here substitutes for parts of §E.5 (install/uninstall/overlay/no-server boot/timings), but these items remain **HUMAN-REQUIRED** (exact steps below): SmartScreen capture, fresh-account walkthrough, GUI one-click pass, visual Landing-state screenshots, Env-B functional smoke (.pdf/.docx/persona) — the latter is additionally blocked on this box by OBS-1 until a server answers on port 8000.
2. **CI pipeline unproven on the real runner (M2)** — workflow logic is statically validated and snippet-simulated, but no GitHub run has happened (D-3: no GH_TOKEN available locally; tags not pushed). M2 evidence a–f still required before v1.0.0.
3. **Unsigned binary** — SmartScreen/AV friction on every fresh machine (accepted D4; docs mitigate).
4. **SHA256SUMS staleness recurrence risk** — any future local rebuild must regenerate it (CI is safe).
5. **Lemonade detection mismatch (OBS-1)** could make first-run UX misleading for users whose Lemonade build doesn’t match the app’s assumptions. *(Closed by Addendum A — fixed and live-verified.)*
6. **Port-discovery false-positive risk (LOW, added post-fix):** `discoverServer()` accepts any HTTP 200 on `/api/v1/health` across candidate ports [8000, 13305, 8080, 3000]; an unrelated local service answering 200 on that exact path could make the app bind to the wrong endpoint. Probability low (path is product-specific); worst case also adds ≤ ~4.5 s to the nothing-running failure path (1.5 s per probe). Optional hardening: validate the health body shape (`status:"ok"`). Also note: startup audio preload (`fetchServerHealth`) has no discovery fallback, so on non-default-port machines audio models load lazily after discovery (harmless).

## HUMAN-REQUIRED items (exact steps)

1. **SmartScreen capture (§E.5-2):** on a clean machine, copy `Interviewer-Setup-1.0.0.exe` via network/USB, double-click → capture “Windows protected your PC” screen → More info → Run anyway. Screenshot feeds INSTALLATION.md L63 placeholder.
2. **Fresh non-admin account walkthrough (§E.5-1/3/4):** create a fresh local non-admin account; install via GUI one-click; verify shortcuts launch; observe Landing “not installed” state rendering + Retry Connection; screenshot all three Landing states. (Partial substitute achieved this session: current account is non-admin and silent install/uninstall/boot all passed.)
3. **Env-B functional smoke (§E.5-6):** with a Lemonade Server actually serving `http://localhost:8000/api/v1` (see OBS-1 — not available on this box at test time): persona generation, **.pdf and .docx** upload, audio preload logs clean.
4. **GUI one-click (non-silent) pass:** run installer without `/S` once to confirm the interactive flow (silent path fully tested).
5. **Timed install from published URL (§E.5-5 / M3)** — post-release.
6. **M2 CI evidence a–f** per 02-program-plan.md §2.4 WP4 on the real runner (dispatch smoke, test-tag prerelease, negative tag `v0.0.2-rc.1`, CI-artifact checksum + abbreviated install, runner hygiene, dry-run residue cleanup).

## Final recommendation

**FIX-FIRST**, then READY-FOR-RELEASE (subject to the HUMAN-REQUIRED M1/M2 items):
1. Regenerate `release/SHA256SUMS.txt` (D1) — verified snippet output available in T5.
2. Correct install path ×5 + L92 note (D2) in INSTALLATION.md and RELEASE-NOTES-TEMPLATE.md.
3. Fix kokoro link (D3) and smartscreen anchor (D4).
4. Optional: D5 env-var hardening in the workflow.

No installer rebuild is required for any of these; the tested binary (`sha256 5E0AD1B7…`, asar `3A114729…`) is the one that should ship once D1’s checksum file matches it.

*End of Stage 5 test report.*

---

# ADDENDUM A — Post-Stage-5 BLOCKER fix: verified on the live machine (2026-08-09)

**Status of OBS-1: RESOLVED.** The detection mismatch flagged above was confirmed, root-caused, fixed in source, rebuilt, and re-verified end-to-end on this same machine against the user’s real Lemonade Server (v10.8.0, API on **port 13305**, WebSocket on 9000). Full root-cause analysis and change list: `04-implementation-log.md` → "Post-Stage-5 BLOCKER fix".

## A.1 Root causes (confirmed)

1. **Binary name**: `checkInstallation` probed only `%LOCALAPPDATA%\lemonade_server\bin\lemonade-server.exe`; the real installed binary is **`LemonadeServer.exe`** (verified present, 5,645,824 bytes; `lemonade-server.exe` absent). → candidate list now `[‘LemonadeServer.exe’, ‘lemonade-server.exe’]`.
2. **Hardcoded port 8000**: `LemonadeClient.baseURL` and the voice path (Interview.tsx / TTSService) assumed port 8000; user’s API listens on 13305. → added `discoverServer()` port auto-discovery over candidates `[8000, 13305, 8080, 3000]`, plus live-health probe fallback in `checkInstallation` itself; voice path now derives base URL from `server:getStatus`.

## A.2 Rebuild (supersedes the binary tested in T1–T4)

- `npm run build` (tsc + vite) → PASS; `npx electron-builder --win nsis --x64 --publish never` → PASS.
- **New shipping artifact**: `release\Interviewer-Setup-1.0.0.exe`, 118,630,895 bytes, **sha256 `02B5597DA2A8330F8B0BF4375F6A81C9C0927AEA896B9E2CCDF3E43ABCEA681B`** (the `5E0AD1B7…` hash cited above is obsolete).
- `SHA256SUMS.txt` regenerated against the new artifacts (all 3 lines match `Get-FileHash` output). `latest.yml` + `.blockmap` rebuilt alongside.

## A.3 Live verification evidence (installed build, not dev build)

Test sequence: silent overlay install (`Interviewer-Setup-1.0.0.exe /S`, exit 0, fresh `Interviewer.exe` timestamp = build time) → launch installed app from `%LOCALAPPDATA%\Programs\ai-interviewer\Interviewer.exe` → capture `%APPDATA%\ai-interviewer\logs\app-2026-08-10.log` → terminate.

Log evidence (verbatim, new-session entries only):

```
[02:07:05.039] [LOG] Lemonade Server client initialized: {"baseURL":"http://localhost:8000/api/v1","model":"gpt-oss-mxp4"}
[02:07:05.133] [ERROR] Failed to load model "gpt-oss-mxp4": Failed to load model (HTTP N/A)
[02:07:05.135] [ERROR] Failed to fetch server health: … "url":"http://localhost:8000/api/v1/health" … "code":"ECONNREFUSED"
[02:07:05.135] [WARN] [AudioPreload] Server not reachable - skipping audio model preload.
[02:07:05.905] [LOG] [LemonadeClient] Server discovered on non-default port 13305 - switching baseURL to http://localhost:13305/api/v1
[02:07:05.906] [LOG] Lemonade Server client initialized: {"baseURL":"http://localhost:13305/api/v1","model":"gpt-oss-mxp4"}
```

Interpretation: default port 8000 fails exactly as on the user’s machine (ECONNREFUSED) → auto-discovery runs → **server found on 13305** → client re-initialized against the discovered port. Independent check: `http://localhost:13305/api/v1/health` returns `status:"ok"`, `version:"10.8.0"`, `websocket_port:9000` — matching what the app now targets.

## A.4 Impact on earlier conclusions

- **OBS-1** (MED–HIGH): closed — fixed and verified above.
- **Residual risk #5** (detection mismatch): closed.
- **Residual risk #4** (SHA256SUMS staleness): satisfied — checksums regenerated after this final rebuild.
- **Final recommendation** upgrades from FIX-FIRST to **READY-FOR-RELEASE** subject only to the standing HUMAN-REQUIRED items (§HUMAN-REQUIRED 1–6) and M2 CI evidence. All D1–D5 defects were fixed in the same pass (docs + workflow hardening); the shipped binary is the A.2 rebuild.
- Note for future test runs: the log filename is **UTC-dated** (`app-2026-08-10.log` while local date was 2026-08-09).

*End of Addendum A.*
