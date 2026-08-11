# Release & Windows Installer — Stage 4 Implementation Log

> **Stage 4 of 6** · Repo: `C:\Users\antmi\interviewer` · Branch: `feature/release-installer-packaging`
> Source of truth: `03-quality-review.md` Section E. This log records every WP with commands, outputs, and evidence. Nothing passes a gate on assertion.
> Date: 2026-08-09. Session: continuation after an interrupted implementation session (verified prior WP0/WP1 work, then completed WP2–WP6).

---

## WP0 · Lockfile & freeze — VERIFIED (completed in prior session)

- `package-lock.json` regenerated in working tree: `git diff --stat package-lock.json` → **25 insertions(+), 281 deletions(−)** (removes minimatch/brace-expansion transitive drift).
- **Proof `npm ci` green from clean install:**
  ```
  > npm ci
  added 967 packages, and audited 974 packages in 26s
  ```
  (Deprecation warnings only — inflight/rimraf/glob/boolean transitives; no install errors.)

## WP1 · package.json metadata & builder config — VERIFIED (completed in prior session)

Field-by-field check against `03-quality-review.md` §E.2 (all applied, valid JSON, no comments):

| §E.2 requirement | Status |
|---|---|
| `author: "Lemonade SDK"` | ✅ L24 |
| `repository` → lemonade-sdk/interviewer.git | ✅ L25–28 |
| `inspect` / `inspect:log` scripts deleted | ✅ absent |
| `electron-store`, `form-data` removed from deps | ✅ absent (zero imports, §D10/§D12) |
| react, react-dom, react-router-dom, zustand, lucide-react, clsx, tailwind-merge, date-fns → devDependencies | ✅ all present in devDependencies only |
| axios, openai, pdf-parse, mammoth, uuid kept in dependencies (uuid per N9) | ✅ |
| `directories.buildResources: "resources"` | ✅ |
| `publish` github/lemonade-sdk/interviewer | ✅ |
| `win.target` nsis+dir x64, `signAndEditExecutable: false` | ✅ |
| full `nsis` block (oneClick, perMachine false, allowElevation, desktop+start-menu shortcuts, shortcutName, runAfterFinish, deleteAppDataOnUninstall false, artifactName `Interviewer-Setup-${version}.${ext}`) | ✅ |
| **B3 guard:** existing `mac` (dmg), `linux` (AppImage), `forceCodeSigning: false` retained | ✅ L118–124 |

**Main-process import audit (WP1 verification a):** grep of `src/**` for `react|react-dom|react-router-dom|zustand|clsx|date-fns|lucide-react|tailwind-merge|electron-store|form-data` imports → 27 hits, **all under `src/ui/**`** (renderer-only, Vite-bundled). Zero hits in electron/, database/, mcp/, services/, utils/. Dep move is safe.

## WP2 · Icon — DONE (this session)

- Tooling survey: no ImageMagick (`C:\Windows\System32\convert.exe` is the FAT→NTFS utility, not IM); **Python 3.12.11 + Pillow 12.1.1 available** → used PIL.
- Source: `public/logo.png` 187×185 RGBA (non-square — N4). Pipeline: pad to 187×187 square on transparent background (centered), LANCZOS upscale → 512×512.
- Commands (Python/PIL): `Image.open('public/logo.png').convert('RGBA')` → paste centered on 187² transparent canvas → `.resize((512,512), LANCZOS)` → `resources/icon.png`; `.save(format='ICO', sizes=[16,24,32,48,64,128,256])` → `resources/icon.ico`.
- **Verification output:**
  ```
  saved resources/icon.png (512, 512)
  verify png: (512, 512)
  verify ico sizes: [(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)]
  ico file size: 56392 bytes / png file size: 80779 bytes
  ```
- Icon ≥512² PNG + multi-size ICO incl. 256 (meets §E.3). Packaged exe picked it up: no "default Electron icon is used" warning in electron-builder output. Interim asset (derived from logo.png) — replace with human-supplied ≥256 px brand icon if one arrives; re-run M1 after swap.

## WP3/M0–M1 · Build + installer verification — DONE (this session, automated portion)

1. `npm ci` — green (see WP0).
2. `npm run build` — green:
   ```
   > tsc -p tsconfig.electron.json && vite build
   ✓ 2112 modules transformed.
   dist/renderer/index.html                  2.29 kB
   dist/renderer/assets/index-DNLwYVhe.css  68.41 kB
   dist/renderer/assets/index-B0FB2lVp.js  495.31 kB │ gzip: 145.45 kB
   ✓ built in 14.54s
   ```
   Outputs confirmed present:
   - `dist/electron/src/electron_app/main.js` (47,972 B) ✅
   - `dist/renderer/index.html` (2,289 B) ✅
   - `dist/electron/src/data/prompts.json` ✅ — **B2: tsc emitted the imported JSON (no copy step required)**.
3. `npx electron-builder --win nsis --x64 --publish never`:
   ```
   • electron-builder  version=26.7.0 os=10.0.26200
   • loaded configuration  file=package.json ("build" field)
   • executing @electron/rebuild  electronVersion=40.2.1 arch=x64
   • completed installing native dependencies
   • packaging  platform=win32 arch=x64 electron=40.2.1 appOutDir=release\win-unpacked
   • updating asar integrity executable resource  executablePath=release\win-unpacked\Interviewer.exe
   • building  target=nsis file=release\Interviewer-Setup-1.0.0.exe archs=x64 oneClick=true perMachine=false
   • building block map  blockMapFile=release\Interviewer-Setup-1.0.0.exe.blockmap
   ```
4. **Asar proof (B2/M0 gate)** — `npx asar list release/win-unpacked/resources/app.asar`:
   ```
   \dist\electron\src\data\prompts.json        ← startup-critical JSON present
   \dist\electron\src\electron_app\main.js     ← main entry present
   \dist\renderer\index.html                   ← renderer entry present
   ```
   Prod deps present (file counts): axios 101 · openai 1781 · pdf-parse 99 · mammoth 60 · uuid 52.
   Removed/moved deps absent (file counts, all 0): electron-store · react · react-dom · react-router-dom · zustand · lucide-react · clsx · tailwind-merge · date-fns.
   **Nuance:** `form-data` appears (6 files at `\node_modules\form-data\`) — verified via `npm ls` and `axios/package.json` that this is **axios's own declared runtime dependency** (`"form-data": "^4.0.5"`), hoisted to top level by npm. It is not a direct app dependency (removed from package.json per §D12) and cannot be stripped without breaking axios. B2 intent (no direct form-data dependency packed) is satisfied.
   Unpacked (`app.asar.unpacked`): `@napi-rs/canvas-win32-x64-msvc` native `.node` binary (pdf-parse → @napi-rs/canvas; native modules cannot load from asar — correctly unpacked automatically) + jszip (mammoth). No manual `asarUnpack` config needed.
5. Artifact sanity:
   ```
   release/Interviewer-Setup-1.0.0.exe          118,628,418 B (113 MiB)  ← >80 MB ✅, <150 MB SM-9 ✅
   release/Interviewer-Setup-1.0.0.exe.blockmap     125,280 B
   release/latest.yml                                 351 B  (version 1.0.0, sha512, size)
   release/win-unpacked/                              (Interviewer.exe + full app)
   ```

**Rebuild note:** after WP6 copy polish landed (this session), the installer was **rebuilt** so the shipped artifact contains final copy + final icon per §E.5 ("Installer must contain final icon + final copy"). Final artifact: `Interviewer-Setup-1.0.0.exe` 118,628,541 B; `latest.yml` regenerated (sha512 `dD0vteKXkCFR4XBCEa/tx0NZmX1Xb78FNsXwRkkDr0iNpmZS1JF6I5h3m5/jhpHvt8UKLDqMzgWNJzwpasAbvg==`); asar re-verified — `\dist\renderer\assets\index-5ez--wNF.js` present (renderer bundle with polished copy: contains `github.com/lemonade-sdk/lemonade-server`, zero occurrences of `lemonade-server.ai`); `prompts.json`/`main.js`/`renderer/index.html` still present. `release/SHA256SUMS.txt` regenerated for the final artifact:
```
366052D2B50EEE5AC568631A73835E9500B362E90992A4B39C59403727C8FA81  Interviewer-Setup-1.0.0.exe
EC398E2180E0946FF9A8722924335B1EAD16D61A19647EFE44B8C6C83217D651  latest.yml
7FF1D5494051BE1B3117A389BE1E0D8CF1985FA07F02577AFEE61EE45CDA9A84  Interviewer-Setup-1.0.0.exe.blockmap
```
Round-trip verified: each hash recomputed from file and matched. Installed footprint measured (N7): **436 MB** (`release/win-unpacked`, 456,002,909 B); app.asar 70 MB + app.asar.unpacked 36 MB.


**M1 manual verification matrix (§E.5 items 1–9: fresh non-admin account, SmartScreen capture, timed install, Env-B functional smoke incl. .pdf/.docx, uninstall/overlay-install) is NOT executable from this session — it requires human/interactive Windows sessions and sign-off. Handed to Stage 5 with the built installer as input. See Deviations D-1.**


## WP4 · CI/CD rewrite — DONE (this session)

**`.github/workflows/electron-release.yml` fully rewritten** per §E.6 (YAML validated programmatically):
- Header comment: dispatch = smoke build only; releases = tags vX.Y.Z; frozen-fields warning (appId/productName/artifactName/output/artifact-set, D6); tag glob `v*.*.*` matches prereleases note (N8); rationale for shared concurrency group.
- `workflow_dispatch` `version` input **removed** (N1).
- `concurrency: group: self-hosted-windows-serial, cancel-in-progress: false` (see Deviations D-2).
- `build-windows` steps, in order: checkout → **version guard immediately** (N3; tag stripped of `v`, full semver incl. prerelease compared to `node -p require('./package.json').version`; skipped on dispatch) → pre-build cleanup action → setup-node 20 → `npm ci` → `npm run build` → `npx electron-builder --win nsis --x64 --publish never` (no GH_TOKEN in env — D-3) → disk guard (fail < 10 GB free) → SHA256SUMS generation (`Get-FileHash`, `<HASH>  <filename>` format) → upload-artifact with exactly the frozen 4 paths (`release/*.exe`, `release/latest.yml`, `release/*.blockmap`, `release/SHA256SUMS.txt` — **B4**) with `retention-days: 30` and `if-no-files-found: error` → delete `release/win-unpacked` (always) → post-build cleanup (always). `timeout-minutes: 45` added.
- `create-release` job (`if: startsWith(github.ref, 'refs/tags/')`): checkout → download artifact → **verify all 4 artifact types present, fail loudly if any missing** → outputs `prerelease` (tag contains `-`) and `body` (tag-specific `docs/release-notes/<tag>.md` if authored, else `.github/RELEASE-NOTES-TEMPLATE.md`) → `softprops/action-gh-release@v2` with `files: release-artifacts/**/*`, `prerelease` from output, `body` + `generate_release_notes: true` (GitHub prepends body to generated notes), `draft: false`.
- **Logic tested locally (PowerShell, this session):** version guard accepts `v1.0.0`↔`1.0.0`, rejects `v0.0.2-rc.1`; prerelease detection `v1.1.0-rc.1`→true, `v1.0.0`→false; checksum script generated+round-trip-verified against the real `release/` files; artifact verification NEGATIVE test (missing SHA256SUMS.txt → fail) and POSITIVE test (all 4 detected) both passed; multi-line `GITHUB_OUTPUT` heredoc (`body<<EOFBODY`) format verified.

**`.github/workflows/nodejs-ci.yml`:** same `concurrency` group added at top level — nothing else changed (per directive).

**`.github/RELEASE-NOTES-TEMPLATE.md` created** — six mandatory sections (02 §6.3): prerequisite Lemonade Server (canonical link), system requirements (honest Strix Halo wording, models not bundled), install steps incl. SmartScreen + close-before-upgrade (B1) + never-disable-AV, what's new/fixed/known-issues, uninstall & user data (`%APPDATA%\ai-interviewer` preserved, purge path), checksums (verify SHA256SUMS.txt). **`docs/release-notes/TEMPLATE.md` created** as authoring pointer to the canonical template (§E.7.3; single-source-of-truth — D-4).

## WP5 · Docs — DONE (this session)

**README.md rewritten:**
- Installation headline = download `Interviewer-Setup-x.y.z.exe` from GitHub Releases + INSTALLATION.md link; `git clone` demoted into a collapsed `<details>` "Build from source" block; Node badge scoped into that dev section (E.7.1).
- New **System Requirements** section: Windows 10/11 x64; Lemonade Server prerequisite with canonical link; hardware honesty ("tested on Strix Halo with 128 GB RAM; NPU-class hardware recommended"); recommended model `Qwen3-Coder-30B-A3B-Instruct-GGUF`; models-not-bundled note.
- SmartScreen note in Installation ("More info → Run anyway", unsigned builds).
- **Falsehoods fixed (N2):** L35 "Cross-Platform … Windows, macOS, and Linux" → "Built on Electron (cross-platform technology); official releases are currently Windows-only"; L148 "React 18" → "React 19".
- Quick Start dev command corrected to `lemonade-server serve` (was bare `lemonade-server` — outlier; see D-6).
- Build-for-production command updated to the real NSIS packaging invocation; Project Structure updated (resources/, release/; removed nonexistent `tests/` dir claim — repo uses `src/__tests__`).

**docs/INSTALLATION.md created** — full end-user walkthrough: system requirements (measured disk numbers: ~120 MB download / ~450 MB installed, N7); Lemonade prerequisite step incl. `lemonade-server serve`; checksum verification; one-click install (per-user `%LOCALAPPDATA%\Programs\Interviewer`, no admin); **SmartScreen walkthrough** (screenshot placeholder pending M1 captures); first-launch expectations incl. Landing guidance + Retry Connection; close-before-upgrade warning (B1); uninstall (data preserved) + exact data locations table (`Interviewer` install dir vs `ai-interviewer` data dir divergence, §D22) + purge path; FAQ: no-admin/per-user, non-ASCII usernames/long paths safe (N5), SmartScreen-per-version, AV false-positive guidance (never disable AV), Windows-only releases.

## WP6 · First-run copy polish — DONE (this session)

`src/ui/pages/Landing.tsx` — copy/links only, UX structure untouched (E.4.2: no new IPC/behavior):
- Not-installed message → "Install it using the link below, then click **Retry Connection**." (matches actual button label, E.4.1); download link canonicalized `https://lemonade-server.ai/` → `https://github.com/lemonade-sdk/lemonade-server` (D8 resolution — D-5); hint changed from "restart this application" to "click Retry Connection below" + new link to `docs/INSTALLATION.md` on the repo (E.4.1).
- Installed-but-not-running message → keeps terminal snippet `lemonade-server serve` (verified command, D-6) + "then click Retry Connection" + INSTALLATION.md link.
- **Settings.tsx parity check (E.4.1):** Settings.tsx L303 already shows `Not running — start with: lemonade-server serve`; no lemonade-server.ai references; messaging now consistent with Landing. No change needed.
- **Hardcoded version check:** grep of `src/ui` for version strings → zero matches; UI shows no hardcoded version. Nothing to fix.
- Verification: `npx tsc --noEmit` green; renderer bundle rebuilt — contains new GitHub URL, zero `lemonade-server.ai` occurrences; installer rebuilt to include final copy (WP3 rebuild note).

## Housekeeping — final checks

- `npx tsc --noEmit`: **PASS** (no output).
- `npm run lint`: 333 problems = **4 errors + 329 warnings, all pre-existing** in files untouched by this program (`TextProcessingService.ts` ×2: no-control-regex L123, no-empty L336; `Preparing.tsx` L169 and `Settings.tsx` L53: react-hooks setState-in-effect). Zero errors/warnings introduced (only code change: `Landing.tsx`, which reports clean).
- `npm test`: **pre-existing failure, NOT introduced** — `jest.config.js` declares `preset: 'ts-jest'` but `ts-jest` is absent from package.json **at HEAD** (`git show HEAD:package.json` → not in deps or devDeps), so `npm test` fails with "Preset ts-jest not found" on the unmodified baseline too. Consistent with review §D24 (tests run `continue-on-error` in CI). Left unfixed: out of WP scope, and adding a devDependency mid-freeze (D9) would churn the lockfile. Flagged for the backlog: add `ts-jest` (+ `@types/jest`) to devDependencies when test infra is revisited.
- `02-program-plan.md` has no task checkboxes to update.
- **Files created:** `resources/icon.png`, `resources/icon.ico`, `docs/release-planning/04-implementation-log.md`, `.github/RELEASE-NOTES-TEMPLATE.md`, `docs/release-notes/TEMPLATE.md`, `docs/INSTALLATION.md`, `release/` artifacts (Interviewer-Setup-1.0.0.exe, .blockmap, latest.yml, SHA256SUMS.txt, win-unpacked/).
- **Files modified:** `package.json`, `package-lock.json` (prior session, verified), `.github/workflows/electron-release.yml` (rewrite), `.github/workflows/nodejs-ci.yml` (concurrency only), `README.md` (rewrite), `src/ui/pages/Landing.tsx` (copy/links).
- Working tree intentionally left uncommitted (no commit requested).

---

## Deviations from 03-quality-review.md Section E (with justification)

- **D-1 — M1 manual matrix not executed here.** §E.5 items 1–9 (fresh non-admin account, SmartScreen screenshots, timed install, Env-B functional smoke with .pdf/.docx, uninstall/re-install/overlay-install, human sign-off) require interactive Windows sessions and a human; they are out of reach for this implementation session. Automated portion (build, packaging, asar proof, size checks, footprint measurement) is complete with evidence above; the installer is ready as input for Stage 5. INSTALLATION.md marks the screenshot slot as pending M1.
- **D-2 — Concurrency group: kept §E.6's `self-hosted-windows-serial` instead of the stage directive's `ci-${{ github.workflow }}-${{ github.ref }}`.** The directive's own rationale ("cleanup action kills processes and concurrent runs would collide") is only satisfied by a single repo-wide group: `${{ github.workflow }}` differs between the two workflows and `${{ github.ref }}` differs per branch/PR, so that expression would still allow concurrent runs on the single self-hosted runner whose cleanup action kills processes machine-wide (§D20). E is designated the source of truth and §E.6.2 specifies the fixed group for exactly this hazard. Applied to both workflows.
- **D-3 — electron-builder invocation follows the stage directive, overriding §E.6.3:** `npx electron-builder --win nsis --x64 --publish never` with **no GH_TOKEN in the step env** (E.6.3 kept GH_TOKEN for Electron-download rate-limit relief). Rationale: explicit `--publish never` makes publishing impossible regardless of token; token hygiene preferred; the Electron binary is already cached on this machine (both local builds succeeded without auth). NSIS-only also matches the frozen artifact set (the `dir` target's win-unpacked is deleted post-upload anyway). Risk noted: a cold runner with an exhausted GitHub download rate limit may need the token re-added (02 risk R5 contingency).
- **D-4 — Release body assembly merges §E.6.4 with the stage directive:** body = tag-specific notes (`docs/release-notes/<tag>.md`) if authored, else `.github/RELEASE-NOTES-TEMPLATE.md`; `generate_release_notes: true` always on, so GitHub appends the auto changelog after the body (GitHub API prepends body to generated notes). E.6.4's either/or (body_path else generated notes) would have left releases without the mandatory §6.3 sections the directive requires in every release body. Canonical template lives at `.github/RELEASE-NOTES-TEMPLATE.md` (workflow consumes it); `docs/release-notes/TEMPLATE.md` (§E.7.3) is a short authoring pointer to it — single source of truth, no drift.
- **D-5 — D8 canonical URL resolved to `https://github.com/lemonade-sdk/lemonade-server`** per the stage directive (superseding §E.4's default `https://lemonade-server.ai/`). Applied in Landing.tsx, README, INSTALLATION.md, release-notes template. **Caveat for human sign-off:** that repo URL currently returns 404 anonymously (checked via `gh api` and WebFetch on 2026-08-09; the org owns `lemonade`, `lemonade-server-snap`, `ryzenai-server` but no public `lemonade-server` repo). It must be made public by release time or links break. The product site lemonade-server.ai does exist; D8's required human confirmation with the Lemonade team should double-check this URL. **Kept deliberately:** the developer-facing code comment `LemonadeClient.ts` L15 (`Documentation: https://lemonade-server.ai/docs/`) still points at the live product documentation portal; swapping it for the currently-404 repo URL would be a downgrade. Revisit when D-5's URL question is closed by the human.
- **D-6 — Start command kept as `lemonade-server serve`** (Landing + Settings + README Quick Start fixed to it). Verified against in-repo evidence: `LemonadeClient.ts` L846–848 instructs `lemonade-server serve --max-loaded-models 3`, `MultiModelStatus.tsx` L123 and `Settings.tsx` L303 use `lemonade-server serve`; the bare `lemonade-server` in the old README quick-start was the lone outlier (now fixed). External docs were inconclusive (product site documents the Windows MSI service install, no CLI command; the server repo is not public — D-5). Flagged for confirmation with the Lemonade team alongside D8.
- **D-7 — `retention-days: 30`** on the windows-build artifact per the stage directive (old workflow had 7; §E.6 silent).
- **D-8 — Icon is the §E.3 interim asset** (logo.png padded+upscaled via Pillow; no ImageMagick on this machine; System32 `convert.exe` is the FAT→NTFS utility). Human brand asset ≥256 px still outstanding — swap and re-run M1 when supplied.
- **D-9 — WP ordering:** §E.4 requires WP6 before WP3; the prior interrupted session had already produced an installer, so WP6 landed after the first build — resolved by **rebuilding the installer** after the copy fix (evidence in WP3 rebuild note). Final artifact contains final icon + final copy as §E.5 requires.

---

## Post-Stage-4 correction — D5/D8 canonical Lemonade URL (2026-08-09, orchestrator, after user confirmation)

**Trigger:** D-5 above flagged that `https://github.com/lemonade-sdk/lemonade-server` returns 404. The human owner confirmed the correct repository is **`lemonade-sdk/lemonade`** ("ITS lemond"). Verified via `gh api`: `lemonade-sdk/lemonade` is public ("Lemonade helps users discover and run local AI apps..."); `lemonade-sdk/lemonade-server` is 404; the org has no public repo by that name. The lemonade repo's own README documents: Windows install = `https://github.com/lemonade-sdk/lemonade/releases/latest/download/lemonade.msi` (direct MSI), docs portal = `https://lemonade-server.ai/docs/guide/install/` (lemonade-server.ai is the LIVE official docs domain — the original Landing.tsx link was not wrong, just less direct).

**Decision D8/D-5 CLOSED:** canonical product repo = `https://github.com/lemonade-sdk/lemonade`; canonical Windows download = `.../releases/latest/download/lemonade.msi`; docs = `https://lemonade-server.ai/docs/guide/install/`.

**Applied (all broken `lemonade-sdk/lemonade-server` references eliminated from shipped files):**
- `src/ui/pages/Landing.tsx` — "Download Lemonade Server" button → direct `lemonade.msi` download (smoothest no-code path for our Windows-only v1 audience).
- `README.md` — prerequisite, install step 1, acknowledgments → repo URL (+ direct MSI links).
- `docs/INSTALLATION.md` — requirements table → repo URL; Step 1 → direct MSI for Windows + repo + official install guide for other platforms.
- `.github/RELEASE-NOTES-TEMPLATE.md` — prerequisite section → repo URL + direct MSI + install guide.
- Kept as-is (valid): `src/services/LemonadeClient.ts` doc comment (`lemonade-server.ai/docs/`), `lemonade-server serve` command (D-6 unchanged; lemonade MSI installs the service that the app's checkInstallation probe expects at `%LOCALAPPDATA%\lemonade_server\bin\lemonade-server.exe`).
- Planning docs 01–03 retain the historical URL in analysis text (record, not shipped artifact) — superseded by this section.

**Verification:** `grep -rn "lemonade-sdk/lemonade-server" src/ README.md docs/INSTALLATION.md .github/` → zero hits. Renderer + NSIS installer **rebuilt** so the shipped artifact contains the corrected links.

**Rebuild evidence (2026-08-09):** `npm run build` green (vite: 2112 modules, index-DkCNibxK.js 496 kB) → `npx electron-builder --win nsis --x64 --publish never` exit 0 → `release\Interviewer-Setup-1.0.0.exe` + `.blockmap` regenerated (electron-builder 26.7.0, electron 40.2.1, oneClick=true perMachine=false).

---

## Post-Stage-5 BLOCKER fix — Lemonade Server detection failure (2026-08-09, orchestrator)

**Trigger:** (a) Stage-5 test report OBS-1: app failed to detect the LemonadeServer running on this machine; (b) user report during pipeline: UI shows "Lemonade Server is not installed" though it IS installed — "IM USING PORT 13305".

**Root causes (verified empirically on this machine):**
1. `server:checkInstallation` (main.ts) looked ONLY for `%LOCALAPPDATA%\lemonade_server\bin\lemonade-server.exe`. The current Lemonade installer (lemonade.msi, server v10.8.0) ships **`LemonadeServer.exe`** (+ `lemonade.exe`) in that same directory — no `lemonade-server.exe` exists → `installed: false`. (This also corrects line 182 above, which assumed the old binary name.)
2. `LemonadeClient.baseURL` hardcoded `http://localhost:8000/api/v1`. User's server API listens on **13305** (verified: `GET :13305/api/v1/health` → `{"status":"ok","version":"10.8.0","websocket_port":9000}`); port 9000 is the WebSocket/ASR port, not HTTP API.
3. Voice path had the same hardcode downstream: Interview.tsx passed `'http://localhost:8000/api/v1'` into VoiceInterviewManager, and VoiceInterviewManager built `new TTSService()` with the default — ASR-HTTP-fallback + TTS would have silently broken on any non-8000 port even after detection worked.

**Fixes applied:**
- `src/services/LemonadeClient.ts`: added `LEMONADE_CANDIDATE_PORTS = [8000, 13305, 8080, 3000]`, `probeHealth(port)` (1.5 s timeout), `discoverServer()` (re-points baseURL + re-initializes OpenAI client on hit); `checkServerHealth()` now falls back to discovery before returning false; error messages no longer claim port 8000 is required; doc comments updated. Existing `getBaseURL()` doc updated (it now reflects the discovered port).
- `src/electron_app/main.ts` `server:checkInstallation`: checks `LemonadeServer.exe` AND `lemonade-server.exe` in the known bin dir; PATH fallback tries `lemonade-server` then `lemonade`; final fallback probes live health on 8000/13305 (a responding server proves installation regardless of binary location) and reports the server version from `/health`.
- `src/electron_app/main.ts` `server:getStatus`: returns the discovered base URL (minus `/api/v1`) instead of hardcoded `http://localhost:8000`.
- `src/ui/pages/Interview.tsx`: fetches `getServerStatus()` and passes the discovered `${url}/api/v1` into VoiceInterviewManager (falls back to 8000 default if IPC fails).
- `src/services/VoiceInterviewManager.ts`: `new TTSService(asrBaseURL)` — TTS uses the same discovered endpoint as ASR.
- Remaining `:8000` literals are constructor-default fallbacks only (TTSService, VoiceInterviewManager, main.ts error path) — intentional; every real call site now passes the discovered URL.

**Stage-5 hygiene defects fixed in the same pass:**
- D1 — SHA256SUMS.txt regenerated after the final rebuild (was stale vs 18:03 artifact).
- D2 — install path corrected to `%LOCALAPPDATA%\Programs\ai-interviewer` (5 sites: INSTALLATION.md ×4, RELEASE-NOTES-TEMPLATE.md ×1); empirically confirmed on this machine.
- D3 — README Kokoro link → https://github.com/hexgrad/kokoro (HTTP 200 verified; kokoro-js/kokoro was 404).
- D4 — removed Pandoc `{#smartscreen}` marker from INSTALLATION.md heading; README anchor link now targets GitHub's real auto-anchor `#smartscreen-windows-protected-your-pc`.
- D5 — both workflow sites `$tag = "${{ github.ref_name }}"` → `$tag = $env:GITHUB_REF_NAME` (no expression injection into PowerShell).

**Verification:** `npx tsc --noEmit` PASS after all edits; final rebuild + installer regeneration + checksum regeneration executed; installed-app live verification against the user's running server on port 13305 recorded in 05-test-report.md addendum.

*End of post-Stage-5 fix log.*

---

## Stage 6 — Final quality-reviewer coherence review (2026-08-09)

Full-work review of docs 01–05, the complete changeset (10 modified files + new docs/resources/workflow template), and the shipped artifact set. Verdict: **COHERENT-AND-RELEASE-READY after two one-line doc fixes**, which were applied immediately:

- **S6-1 (MED)** INSTALLATION.md L92 still carried the wrong "two different folder names" note (residual half of Stage-5 D2). → Rewritten: install dir and data dir are both `ai-interviewer`; `Interviewer` is display name only.
- **S6-2 (LOW)** INSTALLATION.md L107 FAQ anchor `#step-3--run-the-installer-smartscreen` was dead after the `{#smartscreen}` marker removal (residual half of Stage-5 D4). → Now `#smartscreen-windows-protected-your-pc`, matching the heading slug and the README link.
- **S6-3 (LOW)** Discovery false-positive risk (any HTTP 200 on `/api/v1/health` across candidate ports) accepted and documented as residual risk #6 in 05-test-report.md; optional hardening (health body-shape validation) recorded as backlog. Also noted there: startup audio preload has no discovery fallback (lazy load after discovery — harmless).
- Reviewer independently recomputed: SHA256 of shipped exe = `02B5597D…CEA681B` (matches Addendum A.2), latest.yml SHA-512 matches, frozen 4-artifact set conformed, frozen D6 fields respected in package.json, no port-8000-only claims in any user-facing doc, all workflow-referenced files exist, `$env:GITHUB_REF_NAME` at both sites, shared concurrency group in both workflows.

Also in this pass: removed stray build artifact `index-DkCNibxK.js` from repo root (misplaced Vite bundle from an earlier build attempt; regenerated correctly into `dist/` by `npm run build`).

**Final pipeline state: all six stages complete; branch is release-ready subject to the standing HUMAN-REQUIRED items (SmartScreen capture, fresh-account walkthrough, M2 CI evidence on the real runner) and acknowledged backlog (brand icon ≥256 px, ts-jest devDependency, optional discovery body-shape validation, authored docs/release-notes/v1.0.0.md before tagging to avoid template placeholders in the release body).**

*End of Stage 6 log.*

---

## Rebase onto upstream main — default port realigned to 13305 (2026-08-11)

While opening the PR, `origin/main` was found to have advanced. Notably upstream PR **#59 "Update Lemonade port"** had already hardcoded the default Lemonade API port from `8000` → `13305` across the same files this branch touches. This branch was based on the older commit (default still 8000 + auto-discovery), producing a semantic merge conflict.

**Decision (Option C — superset):** rebase onto `origin/main`, adopt upstream's `13305` as the default port everywhere, and RETAIN this branch's port auto-discovery as a fallback for custom ports. This honors the merged maintainer change and still satisfies the detection requirement.

**Changes made during conflict resolution:**
- `LemonadeClient.ts`: `LEMONADE_DEFAULT_PORT` 8000 → **13305**; `LEMONADE_CANDIDATE_PORTS` reordered to `[13305, 8000, 8080, 3000]`; `baseURL` derives from the constant; error messages and doc comments updated to "default port 13305; custom ports are auto-detected".
- `Interview.tsx`: voice fallback default → `http://localhost:13305/api/v1`; still overridden by the discovered URL from `server:getStatus`.
- `main.ts`: `server:getStatus` returns the discovered base URL (kept); `checkInstallation` live-health fallback probe order → `[13305, 8000]`.
- Upstream additions preserved: README Linux/Node badges + References section; `package.json` `dev:linux`; VoiceInterviewManager/TTSService default param 13305.
- This branch's D3 fix kept: Kokoro link → `hexgrad/kokoro` (kokoro-js/kokoro 404s).

`npx tsc --noEmit` passes post-rebase. Installer rebuilt and checksums regenerated; post-rebase binary supersedes the `02B5597D…` hash from Addendum A.2.

*End of rebase log.*
