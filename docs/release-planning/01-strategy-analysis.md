# Release & Windows Installer — Strategy Analysis

> **Stage 1 of 6** (planning → program management → quality review → implementation → testing → final review)
> Audience: downstream software-program-manager agent. Self-contained; no external context assumed.
> Repo: `C:\Users\antmi\interviewer` · Branch: `feature/release-installer-packaging` · Date: 2026-08-07
> Status: analysis-only — **nothing was committed**; working tree was left untouched.

---

## 0. Verification Log — Claims Checked Against the Repo

Every claim in the briefing was re-verified against the actual files. **All briefing claims are accurate**, with the additions/refinements below. Items marked 🚩 are newly discovered issues the briefing did not mention; items marked ✅-Δ are confirmed-with-nuance.

| # | Finding | Where verified | Severity |
|---|---------|----------------|----------|
| ✅ | package.json v1.0.0, `author: ""`, main = `dist/electron/src/electron_app/main.js` | `package.json` | — |
| ✅ | electron-builder 26.7.0 locked; electron 40.2.1 locked; build config as described | `package.json`, `package-lock.json` | — |
| ✅ | **Bug A**: workflow uploads `dist/*.exe|msi`, electron-builder writes to `release/` | `electron-release.yml` L90-92 vs `package.json` L77 | Release-blocker |
| ✅ | **Bug B**: `dist/*.msi` globbed but no MSI target exists anywhere | `electron-release.yml` L92, `package.json` targets | Confirmed |
| ✅ | **Bug C**: `create-release` gated on `startsWith(github.ref,'refs/tags/')`; workflow_dispatch never releases | `electron-release.yml` L107 | Confirmed |
| ✅ | **Bug D**: empty `author` — electron-builder NSIS metadata requires it (errors or warns depending on version) | `package.json` L26 | Must-fix |
| 🚩 **E** | `GH_TOKEN` is passed **into the electron-builder build step** while neither `publish` config nor a `repository` field exists. electron-builder's default publish behavior is environment-dependent; this is at best ambiguous and at worst causes electron-builder to try publishing its own GitHub release *in parallel* with the softprops step. Fix: explicit `publish` config + `--publish never` on the CLI. | `electron-release.yml` L83-84 | High |
| 🚩 **F** | No `repository` field in package.json (needed for electron-builder publish metadata and good hygiene; remote is `https://github.com/lemonade-sdk/interviewer.git`). | `package.json`, `git remote -v` | Medium |
| 🚩 **G** | **No application icon exists** (no `.ico`/`.icns`/`icon.*` anywhere). electron-builder will fall back to the stock Electron icon in the exe, installer, and shortcuts. Worse: electron-builder's default resource directory is `build/`, and **`build/` is in `.gitignore`** — adding `build/icon.ico` naively will not get committed. Must set `directories.buildResources` to an un-ignored dir (e.g. `resources/`). | repo-wide search; `.gitignore` | High |
| 🚩 **H** | `package-lock.json` is **modified in the working tree** (uncommitted `M`). CI uses `npm ci`, which fails on lock/package mismatch — whoever implements must reconcile and commit the lockfile deliberately. | `git status` | High |
| 🚩 **I** | `"inspect": "node scripts/inspect-interview.js"` references a `scripts/` directory that **does not exist**. Not release-blocking; flag for cleanup so nobody ships a broken npm script. | `package.json` L16-17, `ls` | Low |
| 🚩 **J** | `electron-store` is in `dependencies` but **imported nowhere in src** — dead weight that gets packed into the asar. Additionally, renderer-only deps (`react`, `react-dom`, `react-router-dom`, `zustand`, `lucide-react`, `clsx`, `tailwind-merge`, `date-fns`) are in `dependencies`, so electron-builder packs them into the asar's `node_modules` even though Vite already bundles them. Moving them to `devDependencies` shrinks the installer with zero runtime risk **iff** verified. Runtime-required deps that must stay: `axios`, `openai`, `pdf-parse`, `mammoth` (used by compiled main-process services). | `src/**` grep, `package.json` | Medium (size opt) |
| 🚩 **K** | The Lemonade-missing UX in `Landing.tsx` is **more complete than the briefing implied**: it already calls `checkLemonadeInstallation`, gates the Begin button, shows a download link (`https://lemonade-server.ai/`), shows a `lemonade-server serve` terminal snippet when installed-but-not-running, and has a Retry button. Remaining gap for no-code users: starting the server is still a manual terminal command. | `src/ui/pages/Landing.tsx` L53-87, L265-295 | Good news |
| 🚩 **L** | Landing links `https://lemonade-server.ai/` while README links `github.com/lemonade-sdk/lemonade-server` — two different download surfaces; pick one canonical URL in all docs. | `Landing.tsx` L274, `README.md` L51 | Low |
| 🚩 **M** | Repo contains `pyproject.toml` + `lemonade_api/` (a Python client lib) — **not** matched by the electron-builder `files` globs, so the packaged app has zero Python dependency. Confirms briefing claim #5 territory, but README should be explicit that end users need no Python. | root listing | Info |
| 🚩 **N** | **No git tags exist yet** — the first release tag is greenfield; no legacy version/tag expectations to respect. | `git tag -l` (empty) | Info |
| ✅-Δ | Production HTML load uses `path.join(__dirname,'..','..','..','renderer','index.html')` which resolves correctly given `tsc` output layout (`dist/electron/src/electron_app` → `dist/renderer`). Commit 0449dfb already fixed this. Residual risk only if someone changes outDir layout or vite `base` (`./` confirmed). `pdf-parse` is loaded via dynamic `import()` from CJS main — an asar edge case that must be smoke-tested in the packaged app. | `src/electron_app/main.ts` L144-162; `vite.config.ts` | Verify at WP3 |
| ✅ | MCPManager initializes with zero default servers; no hidden Node/Python requirement. | `src/mcp/MCPManager.ts` L13-22 | Confirmed |
| ✅-Δ | Cleanup action kills **all** `node`/`electron`/`Interviewer` processes — safe only because the self-hosted runner is dedicated. Concurrent workflow runs would kill each other; add a workflow `concurrency` group (Risk R10). | `.github/actions/cleanup-processes-windows/action.yml` | Medium |
| ✅ | `nodejs-ci.yml` (PR/push CI) exists, uses same self-hosted runner, `npm ci`, tsc check, jest, vite build. | `nodejs-ci.yml` | Confirmed |

---

## 1. Executive Summary

- **Ship an NSIS one-click installer (`.exe`) for Windows x64 as the v1 installer.** It is electron-builder's native, battle-tested target (already configured), is what VS Code / Slack / Discord / GitHub Desktop ship, and behaves best for unsigned builds. **`.msi` is deferred to Phase 2** (WiX toolchain, real maintenance cost, no electron-builder support); **MSIX is rejected** (unsigned MSIX cannot be installed by normal users — it requires Developer Mode or a trusted cert, which defeats the purpose).
- **The existing release workflow is broken in four known ways plus three newly found** (artifact path, phantom MSI glob, dispatch-never-releases, empty author, plus ambiguous publish behavior, missing `repository` field, and a dirty package-lock). All are fixed in one coherent workflow rewrite (WP4).
- **No code signing is available; be honest about it.** Every download will trigger SmartScreen ("Windows protected your PC"). Mitigation is documentation (screenshots/GIF of "More info → Run anyway"), checksums published with each release, and time/reputation — with an OV/EV certificate as the Phase 2 budget item that actually removes the warning.
- **Lemonade Server cannot and should not be bundled in v1** (large, NPU-specific, separately installed product). The app already detects it in-app (`server:checkInstallation` wired into `Landing.tsx`); v1 completes the loop with consistent docs, release-notes prerequisites, and canonical download URL. An in-app "Start server" button is Phase 2.
- **Auto-update (electron-updater) is excluded from v1 but explicitly future-proofed**: every release will publish `latest.yml` + `.blockmap` alongside the installer so enabling updates later is additive, not re-architecting.
- **Releases are tag-driven (`vX.Y.Z`), package.json is the single version source of truth**, and CI gets a hard guard failing the build if tag ≠ package.json version. Artifacts per release: installer + `latest.yml` + blockmap + `SHA256SUMS.txt`.
- **Windows-only for v1 is correct and verified**: the only runner available is a self-hosted Windows machine; README only claims testing on AMD Strix Halo (x64). Mac/Linux targets remain dormant in config for later.
- **Estimated effort for one developer: ~2–3 focused days** across 8 small work packages (WP0–WP7), each independently verifiable, ending with a real `v1.0.0` release dry-run.

---

## 2. Requirements Analysis

### 2.1 Functional Requirements

| ID | Requirement | Notes |
|----|-------------|-------|
| FR-1 | End user downloads **one file** from GitHub Releases and installs with a double-click — no CLI, no build tools, no Node/Python/Git. | Primary goal of the whole effort. |
| FR-2 | Installer creates **Start Menu shortcut** ("Interviewer") and **Desktop shortcut**, and launches the app at end of install ("run after finish"). | NSIS provides all three natively. |
| FR-3 | Installer registers a proper **Windows uninstaller** (Apps & Features entry, removes app dir + shortcuts). User data (`%APPDATA%\ai-interviewer` — *verify actual folder name at WP3*) is **preserved on uninstall** by default; document how to purge it. | NSIS default with `deleteAppDataOnUninstall: false`. |
| FR-4 | Installer works **per-user without admin rights** (installs under `%LOCALAPPDATA%\Programs`), with elevation fallback if the user chooses a different location. | Matches electron-builder NSIS defaults (`oneClick + allowElevation`). |
| FR-5 | Upgrades: installing a newer version over an older one replaces the app cleanly. | Requires **freezing `appId` (`com.interviewer.app`) and `productName` forever after v1** — the NSIS GUID is derived from appId; changing it breaks upgrade/uninstall linkage. |
| FR-6 | Each release publishes: installer, `latest.yml`, `.blockmap`, `SHA256SUMS.txt`, and **release notes containing Lemonade Server prerequisite + system requirements + SmartScreen guidance**. | See §4. |
| FR-7 | Users without Lemonade Server get **clear in-app guidance** on first run (detected state → download link → retry), not a blank/broken app. | Already ~80% built (Landing.tsx); §6 completes it. |
| FR-8 | Version shown in Apps & Features, exe properties, and installer matches the release tag. | package.json `version` + `author` fix feeds NSIS metadata. |
| FR-9 | A developer/contributor path (clone + npm) **continues to exist** in README, but is no longer the headline. | README rewrite, WP5. |
| FR-10 | Future auto-update can be enabled **without changing the release artifact set** (latest.yml/blockmap already present). | §5. |

### 2.2 Non-Functional Requirements & Constraints (assumptions stated explicitly)

| ID | Constraint / Requirement | Assumption status |
|----|--------------------------|-------------------|
| NFR-1 | **No code-signing certificate available.** Installers are unsigned; SmartScreen warnings are accepted for v1. `signAndEditExecutable: false`, `forceCodeSigning: false` already set. | Given; re-verified in `package.json`. |
| NFR-2 | **Builds run only on a self-hosted Windows runner.** No GitHub-hosted or macOS/Linux runners are available. ⇒ **Windows-only releases for v1 is accepted.** (Verified: both workflows target `[self-hosted, Windows]` only; README only tests Strix Halo.) | Verified assumption — stated here as required. |
| NFR-3 | Runner is **persistent** (state survives between runs): needs pre/post process cleanup (exists) **and** disk-space hygiene (`release/` + `win-unpacked/` ≈ several hundred MB per build). | Verified: cleanup action exists; disk cleanup does **not** — add it. |
| NFR-4 | Node 20 in CI (`actions/setup-node@v4` with `node-version: '20'`); npm ci semantics ⇒ lockfile must be committed and consistent. | Verified; 🚩H applies. |
| NFR-5 | Installer size target: **< ~150 MB** (Electron runtime dominates; expect ~80–110 MB). GitHub asset limit is 2 GB — not a constraint. | Estimate; confirm at WP3. |
| NFR-6 | Install-to-running time on a clean machine: **< 3 minutes** for the app itself (excluding Lemonade Server + model downloads, which are separately documented as large and unavoidable). | Success criterion §2.4. |
| NFR-7 | Release process must be **reproducible and single-operator**: tag push → published release, zero manual steps except writing release notes (template provided). | §4. |
| NFR-8 | No telemetry/license-server/DRM; MIT-licensed; offline-capable app — installer must not require internet at install time (electron-builder's NSIS is fully offline once built). | Verified by design. |
| NFR-9 | **Lemonade Server is not bundled.** Reasons: it is a separate product with its own installer; it is NPU/hardware-specific (AMD Strix Halo class); bundling multi-GB binaries inflates our installer past usefulness. Handled via prerequisites + first-run UX instead. | Analyzed; agreed with briefing. |
| NFR-10 | Security baseline for unsigned distribution: publish SHA256 checksums, use HTTPS-only download links (GitHub Releases), never advise users to disable Defender/SmartScreen — only to approve explicitly. | Policy decision. |

### 2.3 User Personas

| Persona | Description | Installer needs |
|---------|-------------|-----------------|
| **P1 — "NPU Enthusiast" (primary)** | Owns an AMD Strix Halo / NPU-class Windows 11 machine; installs software routinely but has **no dev tools** and no desire to use a terminal. Discovered the app via the Lemonade ecosystem. | Double-click install, SmartScreen hand-holding, clear Lemonade Server prerequisite, works-or-tells-me-why first run. |
| **P2 — "Interview Candidate"** | Non-technical professional preparing for interviews; may be on company or personal hardware; least tolerant of friction or scary warnings. | Same as P1, plus extra trust signals (checksums, clear publisher identity, screenshots in release notes). |
| **P3 — "Community Contributor"** | Developer who will clone, build, and contribute. | Keeps `npm` path in README; benefits from the fixed workflow (can run dispatch builds); not the target of the installer UX. |
| **P4 — "Evaluator/Press"** | Downloads to evaluate the Lemonade ecosystem; may uninstall after. | Clean uninstall, honest capability messaging (hardware requirements front-and-center). |

### 2.4 Success Criteria (measurable)

| # | Criterion | How measured |
|---|-----------|--------------|
| S1 | A user with **zero dev tools** goes from downloaded `.exe` to running app in **< 3 minutes** (median, clean Windows 11 x64 VM/account, excluding Lemonade Server and model downloads). | Timed WP3/WP7 smoke test. |
| S2 | End-user install path contains **0 CLI commands** and 0 manual file operations. | Walkthrough checklist in WP3. |
| S3 | Tag push `vX.Y.Z` → GitHub Release containing exactly {installer, `latest.yml`, `.blockmap`, `SHA256SUMS.txt`} within **15 minutes**, **zero manual steps**. | WP4 acceptance + WP7 dry run. |
| S4 | Release notes for every release contain: Lemonade Server prerequisite + link, system requirements, SmartScreen instructions, changelog. | Template enforced in WP5; checked at release time. |
| S5 | Fresh install works on a clean Windows 11 x64 machine/VM with no Node, Python, Git, or VC++ prereq installs. | WP3/WP7 test matrix. |
| S6 | Uninstall removes app dir + shortcuts, appears correctly in Apps & Features with version + publisher, and preserves user data. | WP3 checklist. |
| S7 | Installed app passes full functional smoke: launches → Landing detects missing Lemonade correctly → (with server running) persona generation, document upload incl. **.pdf and .docx** (asar dynamic-import risk), audio preload logs clean. | WP3/WP7 checklist. |
| S8 | CI fails fast (before any packaging) if tag version ≠ package.json version. | WP4 guard step, deliberately broken in a test run. |

---

## 3. Installer Format — Critical Evaluation

### 3.1 Candidates

**A. NSIS (`.exe`) — electron-builder native target.**
Already configured (`win.target: nsis x64`). One-click or assisted wizard, per-user install (no admin needed), desktop/Start shortcuts, Apps & Features uninstaller, differential-update blockmap support, stable upgrade GUID via `appId`. This is the ecosystem norm: **VS Code, Slack, Discord, GitHub Desktop, Obsidian all ship NSIS .exe installers on Windows.** Works fully unsigned (SmartScreen treatment identical to any other unsigned exe). Zero extra tooling — electron-builder downloads/caches NSIS itself on the runner.

**B. MSI (`.msi`) — WiX Toolset.**
electron-builder **does not support MSI** (targets are nsis/nsis-web/portable/appx/squirrel/zip/dir — no msi). Realistic paths:
 1. *Author a WiX project ourselves*: harvest the `win-unpacked/` output of the existing `dir` target into a WiX v4/v5 MSI. Feasible (~150–300 lines of WiX authoring + a build step needing the WiX toolchain on the runner) but introduces a second packaging stack to maintain in lockstep with every app change (file lists, upgrade codes, custom actions for shortcuts). MSI semantics (per-machine default, Windows Installer transactions, upgrade tables) are meaningfully different from what we test with NSIS — doubling the test matrix.
 2. *Third-party "wrap NSIS in MSI" tools*: fragile, poorly maintained, generally rejected.
 MSI's real value is **enterprise fleet deployment** (GPO/SCCM/Intune). Our audience (P1/P2) is individual consumers of niche NPU hardware — that value is currently ~zero.
 **Stance: defer to Phase 2, demand-driven.** If an enterprise request materializes, path B1 (WiX harvesting `win-unpacked`) is the honest implementation.

**C. MSIX / Microsoft Store.**
Requires signing: an MSIX **must** be signed with a certificate the installing machine trusts (or Store association). Unsigned MSIX installs only with Developer Mode enabled — a hostile dead-end for no-code users. Tooling (`electron-windows-store`) is stale. Store listing needs a paid Partner account and review. **Rejected for v1; revisitable only if/when we have a signing certificate AND Store ambitions.**

**D. Portable `.exe` (electron-builder `portable` target).**
Trivial to add as a *companion* artifact; helps users who refuse installers or lack write access. But it forfeits shortcuts/uninstaller/upgrade story and encourages the weaker path. Optional add-on, not primary.

### 3.2 Decision Matrix

Weights reflect this project's realities: consumer users, no cert, tiny maintenance budget, Electron norms.

| Criterion (weight) | NSIS `.exe` | MSI (WiX) | MSIX | Portable `.exe` |
|---|---|---|---|---|
| End-user simplicity (0.30) | 9 | 6 | 4 | 8 |
| Unsigned-build compatibility (0.25) | 10 | 7 | 2 | 10 |
| Maintenance burden, inverted (0.20) | 9 | 3 | 4 | 8 |
| Electron ecosystem norms (0.15) | 10 | 2 | 3 | 6 |
| Enterprise manageability (0.10) | 4 | 9 | 6 | 2 |
| **Weighted score** | **8.9** | **5.35** | **3.55** | **7.6** |

### 3.3 Recommendation

> **Primary: NSIS one-click installer (`.exe`, x64)** via electron-builder, hardened config in §4.2.
> **MSI: explicit Phase 2 stance — not before an enterprise deployment requirement exists; implement via WiX harvesting of `win-unpacked/` when it does.**
> **MSIX: rejected.** **Portable: optional companion, default no.**

This directly satisfies the user's "`.msi` or similar" ask: NSIS delivers the same end-user outcome (a real installer with shortcuts and uninstaller) at a fraction of the risk; the MSI door stays open with a concrete plan.

---

## 4. Release Pipeline Design

### 4.1 How releases get cut

1. Developer lands changes on `main` (PRs gated by `nodejs-ci.yml`).
2. Version bump PR: update `version` in `package.json` (single source of truth; no other file carries a version) + update release-notes draft.
3. **Release = pushing an annotated tag `vX.Y.Z`.** CI builds, checksums, and publishes a GitHub Release.
4. `workflow_dispatch` remains for **smoke/dry-run builds** (artifacts only, no release) — Bug C's behavior is retained *by design* but documented, and the dispatch form gains a read-me note that releases require tags.

### 4.2 electron-builder config changes (package.json `build`)

```jsonc
{
  "appId": "com.interviewer.app",          // FROZEN FOREVER (upgrade GUID)
  "productName": "Interviewer",            // FROZEN FOREVER (paths/shortcuts)
  "directories": { "output": "release", "buildResources": "resources" }, // 🚩G: build/ is gitignored
  "files": ["dist/electron/**/*", "dist/renderer/**/*", "package.json"],
  "publish": { "provider": "github", "owner": "lemonade-sdk", "repo": "interviewer" }, // guarantees latest.yml generation; actual upload stays with softprops; CLI passes --publish never
  "win": {
    "target": [ { "target": "nsis", "arch": ["x64"] }, { "target": "dir", "arch": ["x64"] } ],
    "signAndEditExecutable": false
  },
  "nsis": {
    "oneClick": true,
    "perMachine": false,
    "allowElevation": true,
    "createDesktopShortcut": true,
    "createStartMenuShortcut": true,
    "shortcutName": "Interviewer",
    "runAfterFinish": true,
    "deleteAppDataOnUninstall": false,
    "artifactName": "Interviewer-Setup-${version}.${ext}"   // hyphenated → clean release URLs (no %20)
  }
}
```
Plus package.json top-level fixes: `"author": "Lemonade SDK"` (or the legal name decided in OQ-8), `"repository": { "type": "git", "url": "https://github.com/lemonade-sdk/interviewer.git" }`, and Bug-I script cleanup. `dir` target is kept for local smoke-testing and as the future WiX harvest source; it is **not** uploaded to releases.

### 4.3 Workflow rewrite (`.github/workflows/electron-release.yml`)

Fixes, in order of the bugs:
- **Bug A**: `upload-artifact` path becomes explicit: `release/*.exe`, `release/latest.yml`, `release/*.blockmap` (no wildcards over `win-unpacked/`, no `dist/`).
- **Bug B**: remove `*.msi` glob entirely.
- **Bug C**: keep tag-gating for `create-release`; document dispatch = smoke build; add a workflow `concurrency: group: electron-release, cancel-in-progress: false` so parallel runs can't kill each other's node processes (cleanup action is a process-killer).
- **Bug D/E/F**: author/repository/publish config per §4.2; build step invokes `npm run build:electron -- --win --publish never` (retains `GH_TOKEN` env purely for download-rate-limit relief on electron-builder's cache fetches).
- **New steps**: (1) *version guard* — compare `${{ github.ref_name }}` (tag, `v`-stripped) to package.json `version`; fail fast on mismatch (S8); (2) *checksum* — `Get-FileHash -Algorithm SHA256` over artifacts → `SHA256SUMS.txt`; (3) *post-build disk cleanup* — delete `release/win-unpacked` after upload (self-hosted disk hygiene); (4) release body sourced from `docs/release-notes/vX.Y.Z.md` if present, else `generate_release_notes: true` fallback; `prerelease: true` auto-detected when the tag contains `-` (e.g. `v1.1.0-rc.1`).

### 4.4 Release artifact set & notes

Per release: `Interviewer-Setup-X.Y.Z.exe`, `latest.yml`, `Interviewer-Setup-X.Y.Z.exe.blockmap`, `SHA256SUMS.txt`.

**Release notes template (mandatory sections)** — lives at `docs/release-notes/TEMPLATE.md`:
1. **⚠️ Prerequisite: Lemonade Server** — what it is, canonical link (single URL decided in OQ-6), tested version, "install this first; Interviewer detects it automatically."
2. **System requirements** — Windows 11 x64 (22H2+), AMD Strix Halo / NPU-class hardware recommended (tested: Strix Halo 128 GB), RAM/disk guidance, microphone for voice. **Note: AI models are not bundled** — first run pulls `Qwen3-Coder-30B-A3B-Instruct-GGUF` (multi-GB) through Lemonade Server.
3. **Install instructions incl. SmartScreen**: "Windows protected your PC → More info → Run anyway" with screenshot/GIF; **never** advise disabling Defender.
4. What's new / fixed / known issues. 5. Uninstall & data location. 6. Checksums note ("verify SHA256SUMS.txt").

**Draft/prerelease policy**: tags without suffix → public, non-draft, non-prerelease. `-rc.N` → prerelease. Drafts only used manually for embargoed announcements.

---

## 5. Auto-Update Assessment (electron-updater)

**Feasibility on our infra: technically good, operationally premature.**
- *Mechanics*: NSIS target ✓, GitHub Releases as provider ✓, self-hosted hosting is irrelevant (updates are pulled client-side from GitHub). Requires `latest.yml` + blockmap alongside the installer — which §4 publishes anyway.
- *Unsigned caveat*: electron-updater will install unsigned updates (integrity relies on HTTPS from GitHub; no certificate chain to verify). Acceptable for an MIT PoC, **but** every downloaded update is a fresh unsigned binary → SmartScreen fires on *every* update with no docs page there to guide the user through it — worse UX than manual re-download, where release notes can prepare the user.
- *Cost*: update-available/checking/error UI, rollback handling, AV-interference support burden, and testing on real machines we barely control.

> **Recommendation: EXCLUDE auto-update from v1. Future-proofing is already paid for** (latest.yml + blockmap + stable artifact naming + frozen appId). Enable in a later phase with a signed build if/when a certificate exists.

---

## 6. First-Run / Dependency UX (missing Lemonade Server)

**Verified current state**: `Landing.tsx` runs `performBackgroundChecks()` on mount → `checkLemonadeInstallation` (checks `%LOCALAPPDATA%\lemonade_server\bin\lemonade-server.exe`, falls back to PATH) → if missing: red panel + "Download Lemonade Server" button (links `lemonade-server.ai`) + "restart this app after installing"; if installed-but-down: shows `lemonade-server serve` snippet; Retry button re-runs checks. Begin is gated on installed+running. The app itself boots fine without the server (preload failures are caught and logged — verified in `main.ts` `initializeApp`).

**Gaps for the no-code user & plan:**
| Gap | v1 (this release) | Phase 2 |
|-----|-------------------|---------|
| Starting the server is a terminal command | Improve copy: link to a step-by-step doc (`docs/INSTALLATION.md`), keep the command visible as fallback | **"Start Lemonade Server" button**: new IPC `server:startLocal` spawning the detected `binaryPath` detached, then polling `checkServerHealth` every 2s until ready; disabled when not installed |
| Requires full app restart after install | Retry button already exists; sharpen copy to "click Retry after installing" | Background polling while the panel is shown |
| Two different download URLs (L vs README) | Canonicalize one URL everywhere (OQ-6) | — |
| Settings page may lack the same status | Verify Settings.tsx parity at WP6; match Landing's messaging | Status widget with version + models loaded |
| Honesty about hardware | Release notes + README state Strix Halo-class requirement plainly | In-app hardware check via `server:getSystemInfo` |

Principle: **the installer installs Interviewer only; Lemonade Server is a declared prerequisite handled with first-run guidance, not silent failure.** No bundling, no pretending.

---

## 7. Implementation Roadmap (single developer, ordered)

> All on `feature/release-installer-packaging`. Estimates assume familiarity with the repo.

**WP0 — Branch & lockfile hygiene (0.5h).** Reconcile the dirty `package-lock.json` (🚩H): run `npm install` deliberately or restore it; ensure `npm ci` is green. Untracked archaeology files (`PRE-UCL-GIT-ARCHAEOLOGY.md`, etc.) left alone. *Acceptance: `git status` shows only intended changes; `npm ci` succeeds.*

**WP1 — Package metadata & builder config (2–3h).** Apply §4.2: author, repository, description, nsis block, `buildResources: resources`, publish config, artifactName, dead-dep cleanup (🚩J: remove `electron-store`; move renderer-only deps to devDependencies **only after** `npm run build` + `build:electron:dir` prove nothing imports them at main-process runtime; keep axios/openai/pdf-parse/mammoth/uuid/form-data as needed). *Acceptance: `npm run build` then `npm run build:electron:dir` succeed locally; `release/win-unpacked/Interviewer.exe` file properties show product name, version 1.0.0, author.*

**WP2 — App icon & branding (1–2h + asset).** Create `resources/icon.ico` (multi-size, ≥256×256; source a branded mark from the team — blocker if none exists) + `resources/icon.png`. electron-builder picks them up via `buildResources`. *Acceptance: win-unpacked exe, installer, and shortcuts show the Interviewer icon, not stock Electron.*

**WP3 — Local installer verification (2–4h).** Full `npm run build && npm run build:electron -- --win` (no publish). On a **clean** Windows 11 VM or fresh user account (no Node/Python/Git): install, verify shortcuts/launch, S7 functional smoke (**including .pdf and .docx upload** — the asar dynamic-import risk), verify Apps & Features entry + uninstall + data preservation, note installer size + userData folder name. *Acceptance: signed-off checklist checked into `docs/release-planning/`; S1/S2/S5/S6 measured.*

**WP4 — Workflow rewrite (3–5h).** Implement §4.3 incl. version guard, checksums, artifact paths, concurrency, dispatch docs, disk cleanup. *Acceptance: (a) workflow_dispatch run uploads exactly the artifact set, creates NO release; (b) test tag `v0.0.1-rc.1` (deleted after) produces a prerelease with installer+latest.yml+blockmap+SHA256SUMS.txt; (c) mismatched tag fails the version guard.*

**WP5 — User docs & release notes (3–4h).** Rewrite README installation: end-user path = "Download from Releases" (S4 content); developer path demoted to "Build from source". Fix badges (Node badge → devs only). Create `docs/INSTALLATION.md` (SmartScreen screenshots, Lemonade prerequisite walkthrough, hardware requirements, uninstall/data location) and `docs/release-notes/TEMPLATE.md`. Canonical download URL everywhere (OQ-6). *Acceptance: a reader of README needs zero prior tooling to reach a running app; no `git clone` in the primary path.*

**WP6 — First-run copy polish (1–2h).** §6 v1 column: Landing error copy + Settings parity check + links to INSTALLATION.md. *Acceptance: screenshots of all three Landing states (missing / installed-not-running / healthy) reviewed.*

**WP7 — Ship dry-run & v1.0.0 (1–2h + CI time).** Merge branch → tag `v1.0.0` (OQ-1 default) → monitor run → verify release against S3/S4 → fresh-machine timed install (S1). Announce. *Acceptance: public release exists with full artifact set and notes; timed install < 3 min.*

---

## 8. Risk Register

| # | Risk | L | I | Mitigation |
|---|------|---|---|------------|
| R1 | **Unsigned SmartScreen warnings** scare off P1/P2 users on every new version (no per-hash reputation without signing) | High | High | Release-note walkthrough w/ screenshots; checksums for trust; canonical FAQ; Phase 2 OV/EV cert (EV clears SmartScreen immediately; OV builds reputation) |
| R2 | **Self-hosted runner = single point of failure** (hardware/OS/disk failure halts releases) | Med | High | Workflow is secret-light (GITHUB_TOKEN only) ⇒ documented fallback: temporarily switch `runs-on` to GitHub-hosted `windows-latest`; keep runner updated; disk-cleanup step; monitor runner in repo settings |
| R3 | **x64-only installer** excludes Windows-on-ARM devices | Low | Med | State x64 requirement in release notes/README; Strix Halo target fleet is x64; arm64 arch can be added to the nsis target later (runs under emulation anyway, but NPU stack is x64-native) |
| R4 | **package-lock drift** breaks `npm ci` in CI (already dirty locally — 🚩H) | Med | High | WP0 reconciliation; rule: lockfile changes only via explicit dependency PRs; CI fails loudly on mismatch (npm ci default) |
| R5 | **electron-builder cache download failures** on runner (NSIS/winCodeSign/Electron zips fetched from GitHub; rate limits/flaky network) | Med | Med | Keep `GH_TOKEN` in build env (auth'd downloads); caches persist on self-hosted runner after first success; retry step; document manual cache-warm procedure |
| R6 | **asar path assumptions** break packaged app: production HTML traversal (`main.ts` L150) and dynamic `import('pdf-parse')` inside asar | Low | High | WP3 smoke tests cover both explicitly (doc upload with real .pdf/.docx); never change `outDir` layout or vite `base` without re-testing; error logging already prints resolved paths |
| R7 | **Version/tag mismatch** (tag says v1.0.1, package.json says 1.0.0) ships wrong metadata | Med | Med | WP4 version-guard step fails the build before packaging; tag is applied only after bump PR merges |
| R8 | **Antivirus false positives** on unsigned Electron binaries (heuristic hits), quarantining the installer or app | Med | High | Publish SHA256SUMS.txt; run installer through VirusTotal before announcing each release (note offending engines in release notes); signing cert is the real fix (Phase 2); never advise disabling AV |
| R9 | **Lemonade Server missing/incompatible** → app "doesn't work" → blame falls on installer | High | Med | Mandatory prerequisite block in release notes + README + first-run UX (§6); pin/test a known-good Lemonade version per release; `server:getSystemInfo` surfaced later for diagnostics |
| R10 | **Concurrent runs on the shared runner**: cleanup action kills all node processes ⇒ parallel jobs murder each other | Med | Med | Workflow-level `concurrency` group serializing runs (WP4); document runner as dedicated resource |
| R11 | **Runner disk exhaustion** (`release/win-unpacked` ~300 MB/build + Electron caches accumulate) | Med | Med | Post-build cleanup of `release/`; caches are reusable (keep); periodic manual disk audit; build fails loudly if space < 10 GB (guard step) |
| R12 | **appId/productName changed later** breaks upgrades & uninstall linkage | Low | High | FROZEN markers in config comments + roadmap note; quality-review stage should reject any diff touching these fields |

---

## 9. Open Questions (with default recommendations)

| # | Question | Default recommendation if unanswered |
|---|----------|--------------------------------------|
| OQ-1 | First installer release version: `v1.0.0` (package.json today) or bump to signal the "installer era"? | **`v1.0.0`** — package.json and public messaging already say 1.0.0; no tags exist yet, so 1.0.0 is unclaimed. |
| OQ-2 | One-click vs assisted NSIS wizard? | **One-click (`oneClick: true`)** — simplest for P1/P2; revisit if per-machine install demand appears. |
| OQ-3 | Publish a portable `.exe` companion? | **No** for v1 — keeps release surface minimal; trivial to add later. |
| OQ-4 | Move renderer-only deps to devDependencies in v1 (🚩J)? | **Yes**, gated on WP1's build proof; drop `electron-store` unconditionally. |
| OQ-5 | In-app "Start Lemonade Server" button in v1? | **Defer to Phase 2** — v1 ships copy/doc improvements only (keeps WP scope tight). |
| OQ-6 | Canonical Lemonade Server download URL (`lemonade-server.ai` vs GitHub repo)? | **Use `lemonade-server.ai`** if it is the maintained product page (Landing already links it); confirm with the Lemonade team, then fix README to match. |
| OQ-7 | Legal/publisher name for `author` (appears in installer metadata)? | **"Lemonade SDK"** pending confirmation (matches repo org); must be set before WP1. |
| OQ-8 | Include `win-unpacked` zip in releases for troubleshooting? | **No** — artifacts stay at 4 files; devs can build `--dir` locally. |
| OQ-9 | Prerelease naming convention? | **`vX.Y.Z-rc.N`** → auto-flagged prerelease by tag containing `-` (WP4). |
| OQ-10 | MSI trigger condition for Phase 2? | **Concrete enterprise/GPO deployment request**; implement via WiX harvesting `win-unpacked` — not before. |
| OQ-11 | Is the Strix Halo 128 GB the *minimum* RAM to claim, or just the tested config? | State "**tested on** Strix Halo 128 GB; NPU-class hardware recommended" — avoid unverified minimums; refine with community data. |

---

*End of Stage 1 deliverable. Prepared for handoff to the Stage 2 program-management agent. No commits were made; working tree untouched except creation of this file under `docs/release-planning/`.*
