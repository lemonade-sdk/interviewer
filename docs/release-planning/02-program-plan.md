# Release & Windows Installer — Program Management Plan

> **Stage 2 of 6** (planning → **program management** → quality review → implementation → testing → final review)
> Input: `docs/release-planning/01-strategy-analysis.md` (Stage 1). Audience: Stage-3 quality-reviewer agent, then the implementing agents.
> Repo: `C:\Users\antmi\interviewer` · Branch: `feature/release-installer-packaging` · Date: 2026-08-07
> Status: planning-only — **nothing committed, no code/config modified**. This document is the single authoritative plan; Stage 1 remains the single authoritative technical analysis. Where they disagree, §9 states why and the decision log (§8) rules.

---

## 1. Program Charter

### 1.1 Objective

Deliver a public `v1.0.0` GitHub Release of **Interviewer** containing a Windows x64 NSIS installer such that an end user with **zero developer tools** can download one file, double-click it, and reach a running installed app in under 3 minutes — with honest first-run guidance for the external Lemonade Server prerequisite — produced by a fully automated, tag-driven, single-operator CI pipeline.

### 1.2 Scope

**In scope (this program):**
- Reconcile the dirty lockfile and harden `package.json` metadata + electron-builder NSIS config (appId/productName frozen).
- Application icon in installer/exe/shortcuts.
- First-run copy polish in `Landing.tsx` (guidance only — no new IPC/features).
- Full local verification of the installer on a clean Windows profile (install / launch / no-server UX / functional smoke / uninstall).
- Rewrite of `.github/workflows/electron-release.yml` (version guard, checksums, correct artifact paths, concurrency, disk hygiene, prerelease detection, release-notes sourcing) + shared concurrency control for `nodejs-ci.yml`.
- User documentation: README rewrite, `docs/INSTALLATION.md`, release-notes template, canonical Lemonade URL everywhere.
- Tagged `v1.0.0` public release + announcement checklist.

**Out of scope (explicitly deferred — see Decision Log §8):**
- Code signing / SmartScreen elimination (Phase 2, budget item).
- Auto-update (`electron-updater`) — artifacts are future-proofed, no v1 code.
- MSI / MSIX / portable / arm64 / macOS / Linux targets.
- Bundling Lemonade Server; in-app "Start server" button; background server polling.
- New application features of any kind. **Any feature request arriving mid-program goes to the Phase-2 backlog, not this branch.**

### 1.3 Success Metrics (measurable)

| # | Metric | Target | Measured how |
|---|--------|--------|--------------|
| SM-1 | Clean-profile install → running app | **< 3 minutes median** | Timed test at M1 and again at M3 (published URL) |
| SM-2 | CLI commands / manual file ops in end-user path | **0** | M1 walkthrough checklist |
| SM-3 | Tag push → published release, zero manual pipeline steps | **≤ 15 min** (warm runner cache; one cold-cache run may exceed — allowed once, noted) | M2 test-tag run + M3 run timestamps |
| SM-4 | Release artifact set | Exactly `{Interviewer-Setup-X.Y.Z.exe, latest.yml, .blockmap, SHA256SUMS.txt}` | M2/M3 artifact inspection |
| SM-5 | Release-notes completeness | 100% of mandatory sections (§6.3) | M3 checklist |
| SM-6 | Uninstall cleanliness | App dir + both shortcuts removed; Apps & Features entry gone; `%APPDATA%\<userData folder>` **preserved** | M1 checklist (folder name confirmed during WP3) |
| SM-7 | Packaged-app functional smoke | Launch; no-Lemonade guidance renders (no crash); with server: persona gen + **.pdf and .docx** upload + clean audio preload logs | M1 checklist (asar dynamic-import risk) |
| SM-8 | Version guard effectiveness | Mismatched tag fails **before** packaging; dispatch runs skip the guard | M2 negative test |
| SM-9 | Installer size | < 150 MB (expect 80–110 MB) | M1 measurement |
| SM-10 | Release pipeline reliability | **2 consecutive green runs** (dispatch + tagged) before M3; no unresolved runner-hygiene findings | CI history at M2/M3 |

### 1.4 Program Exit Criteria

All true:
1. M3 gate (§3) passed and recorded.
2. v1.0.0 release public with full artifact set and complete notes; timed install from the **published URL** < 3 min.
3. Announcement checklist (§6.4) complete.
4. Phase-2 backlog written into the decision log (§8): signing, auto-update, MSI trigger, Start-server button, portable target, arm64.
5. All program evidence (checklists, CI run URLs, timings) committed under `docs/release-planning/`.

Post-program (operations, not gating): monitor first week for installer defects; any hotfix re-uses the same pipeline (which is itself a validation of SM-3).

---

## 2. Work Breakdown (aligned to Stage-1 WPs, critically re-validated)

### 2.1 Ordering verdict

Stage 1's WP0→WP7 order is **mostly correct**; I make **two changes**, both flagged to Stage 3 for scrutiny:

- **Δ1 — WP6 moves before WP3.** Stage 1 verifies the installer (WP3) *then* polishes first-run app copy (WP6). Any `Landing.tsx` change after WP3 means the validated installer no longer contains the shipped app code — forcing a second full verification cycle. Copy polish must land in the same local build that gets validated. WP6's only forward dependency (links to `docs/INSTALLATION.md`) is handled by fixing the doc path *now* (WP5 owns that path; file lands before M3).
- **Δ2 — WP0 scope extended to a dependency-change freeze** (see §7, risk PR-3): the repo has an **active dependabot config** (`.github/dependabot.yml`, weekly npm + github-actions PRs, and a broken placeholder reviewer `your-github-username`). WP0 must record the freeze; it does not fix dependabot itself (out of scope; backlog).

Everything else is validated: WP0 before WP1 (clean `npm ci` baseline), WP2 gated by WP1's `buildResources` setting, WP3 local-before-CI (fails fast without burning the single runner), WP4's dispatch-then-tag sequence (warms electron-builder caches before the tagged run), WP5 after WP3 (docs need WP3's measured facts: userData folder name, installer size, SmartScreen screenshots).

### 2.2 Roles

| Role | Who | Accountable for |
|------|-----|-----------------|
| `human` | Repo owner (single operator) | All gate approvals, tag pushes, merges, icon asset, external confirmations (canonical URL), announcements |
| `enhanced-senior-developer` | Implementing agent | WP0, WP1, WP4, WP5, WP6 implementation; proposes WP2 mechanics |
| `testing-quality-specialist` | QA agent | WP3 execution and all M1/M2 evidence; negative tests; checklist authorship |

`quality-reviewer` (Stage 3) is a separate downstream stage, not a WP owner; its boundary checks are defined in §5.

### 2.3 Dependency DAG (text)

```
                        ┌──► WP2 (icon; human asset) ──┐
WP0 ──► WP1 ────────────┤                              ├──► WP3 ══► [M1]
(lockfile) (config/meta)└──► WP6 (copy polish) ────────┘    │ local installer
                                                             │ verified
                              ┌──────────────────────────────┤
                              ▼                              ▼
                     WP4 (workflow rewrite) ══► [M2]    WP5 (docs; needs WP3 facts)
                              │                            │
                              └────────────┬───────────────┘
                                           ▼
                                      WP7 ══► [M3]
```

- Hard edges: WP0→WP1→{WP2, WP6}→WP3→WP4→WP7; WP3→WP5→WP7.
- Soft overlap (the *only* one): WP5 writing can proceed while WP4 CI iterations run (CI wait time is dead time). With one human operator this overlap is marginal — the schedule (§4) is treated as serial.
- M0 spans WP0+WP1+WP2+WP6 (see §3).

### 2.4 Work packages

Effort legend (single-developer reality): **S** ≤ 1h focused · **M** = 2–4h · **L** ≥ 5h or multi-session including CI waits. All estimates are focused-work hours; elapsed calendar time is handled in §4, not here.

---

**WP0 — Lockfile hygiene & dependency-change freeze** · Owner: `enhanced-senior-developer` (approval: `human`) · Effort: **S**
- **Entry:** Stage-2 plan reviewed; branch `feature/release-installer-packaging` checked out.
- **Work:** Reconcile dirty `package-lock.json` (verified: ~400 lines of transitive patch drift — minimatch/brace-expansion — with no `package.json` change). Preferred fix: **restore the committed lockfile** (`git checkout -- package-lock.json`) and prove `npm ci` green locally; only if that fails, re-run `npm install` and commit the refreshed lockfile deliberately. Record the dependency-PR freeze (§7 PR-3). Leave untracked archaeology files and `chroma_data/` untouched.
- **Exit / DoD:** `git status` shows only intended changes; `npm ci` succeeds locally; freeze noted in the decision log.
- **Dependencies:** none.
- **Verification:** local `npm ci` from clean `node_modules` state; next branch push runs `nodejs-ci.yml` green.

**WP1 — Package metadata & builder config** · Owner: `enhanced-senior-developer` · Effort: **M**
- **Entry:** WP0 done. **Blocking decision:** OQ-7 author/legal name resolved by `human` (default "Lemonade SDK").
- **Work:** Apply Stage-1 §4.2 verbatim unless this plan overrides: `author`, `repository` field, `nsis` block, `directories.buildResources: "resources"`, `publish` config (provider github, owner lemonade-sdk, repo interviewer), `artifactName: "Interviewer-Setup-${version}.${ext}"`. Remove broken `inspect`/`inspect:log` scripts (missing `scripts/` dir). Dependency audit: remove unused `electron-store` (verified: zero imports); move renderer-only deps (`react`, `react-dom`, `react-router-dom`, `zustand`, `lucide-react`, `clsx`, `tailwind-merge`, `date-fns`) to devDependencies **only after** `npm run build` + `build:electron:dir` succeed; verify via `npx asar list` that they are absent from the packaged asar and `axios/openai/pdf-parse/mammoth/uuid` remain. Re-audit `form-data` (Stage 1 listed it as keep; no import found in `src/` grep — confirm before keeping). **Trap guard:** keep all build config in `package.json` — `.gitignore` line 42 ignores `electron-builder.yml`, so a config file there would silently never commit.
- **Exit / DoD:** `npm run build` + `npm run build:electron:dir` succeed locally; `release/win-unpacked/Interviewer.exe` version-info shows product name "Interviewer", version 1.0.0, author; asar contains no dev-only deps.
- **Dependencies:** WP0.
- **Verification:** PowerShell `(Get-Item ...).VersionInfo` dump; `npx asar list` output saved as evidence.

**WP2 — App icon & branding** · Owner: `human` (asset) + `enhanced-senior-developer` (integration) · Effort: **M** — *human asset dependency; see risk PR-2*
- **Entry:** WP1 done (`buildResources: resources` configured).
- **Work:** Produce `resources/icon.ico` (multi-size, must include 256×256 — electron-builder minimum) and `resources/icon.png`. **Verified reality:** `public/logo.png` exists (34 KB) but is **187×185 px — below the 256×256 minimum**, so it cannot be converted as-is. Options: (a) `human` supplies a ≥256px source mark; (b) interim fallback: high-quality upscale of `logo.png` to 256×256 → multi-size `.ico` (tooling: ImageMagick/Powerwright one-liner on the dev box), explicitly labelled interim and replaceable any time before M3.
- **Exit / DoD:** icon visible in win-unpacked exe, installer exe, and created shortcuts — **not** the stock Electron icon.
- **Dependencies:** WP1.
- **Verification:** visual inspection + exe VersionInfo icon check; evidence screenshots.

**WP6 — First-run copy polish** *(reordered before WP3 — §2.1 Δ1)* · Owner: `enhanced-senior-developer` · Effort: **S**
- **Entry:** WP1 done (same branch/build).
- **Work:** Stage-1 §6 v1 column only: sharpen Landing missing-server copy ("click Retry after installing"), keep visible `lemonade-server serve` fallback, link to `https://github.com/lemonade-sdk/interviewer/blob/main/docs/INSTALLATION.md` (path fixed now; file lands in WP5), Settings-page parity check with Landing messaging. Canonical Lemonade URL per decision D8. **No new IPC, no behavior changes.**
- **Exit / DoD:** all three Landing states (missing / installed-not-running / healthy) render correct copy; screenshots captured; `git diff` confined to UI copy/links.
- **Dependencies:** WP1. Soft: OQ-6/D8 URL decision.
- **Verification:** screenshot evidence reviewed by `human`; jest/tsc still green.

**WP3 — Local installer verification (M1 evidence)** · Owner: `testing-quality-specialist` (execution), `human` (sign-off) · Effort: **M–L** (2–4h focused + 1–2h first-time environment setup)
- **Entry:** WP2 + WP6 done (installer must contain final icon **and** final copy); full local `npm run build && npm run build:electron -- --win` succeeds.
- **Work / test matrix** (checklist authored at `docs/release-planning/installer-verification-checklist.md`; evidence file names unnumbered to avoid collision with stage docs 03–06):
  1. **Environment A — clean profile (primary):** fresh **non-admin** local Windows account on the Strix Halo machine (fresh account ⇒ no Lemonade Server at `%LOCALAPPDATA%\lemonade_server` ⇒ exercises the no-server path; no Node/Python/Git). Secondary option: Windows Sandbox or clean Win11 VM for negative tests, if available.
  2. Download-copy installer → SmartScreen appears → capture screenshot (doubles as INSTALLATION.md asset) → More info → Run anyway.
  3. Install completes without admin; verify `%LOCALAPPDATA%\Programs\Interviewer`; Start Menu + Desktop shortcuts exist and launch.
  4. **No-server first run:** app launches, Landing shows guidance panel, **no crash**, Retry works; capture screenshot. Record exact `%APPDATA%` userData folder name (expected `ai-interviewer` from package.json `name`).
  5. **Timed:** download→running-app < 3 min (SM-1); installer size recorded (SM-9).
  6. **Environment B — full functional smoke (developer's primary account, where Lemonade Server exists):** install over the dev environment is *not* required — run the built installer once in account B (or run win-unpacked if account-B install conflicts with the dev checkout; note deviation in the checklist): persona generation, **.pdf and .docx** document upload (asar dynamic-import risk), audio preload logs clean.
  7. **Uninstall (Environment A):** Apps & Features entry shows correct name/version/publisher; uninstall removes app dir + both shortcuts; `%APPDATA%\<userData>` **preserved**; document purge path.
  8. Re-install over uninstall (upgrade sanity): installs cleanly again.
- **Exit / DoD:** every checklist item pass/fail recorded with evidence; all SM-1/2/6/7/9 measurements logged; `human` sign-off line dated.
- **Dependencies:** WP2, WP6.
- **Verification:** the committed checklist itself; any fail → defect is fixed in an earlier WP and WP3 re-run (no partial passes carry forward).

**WP4 — Workflow rewrite (M2 evidence)** · Owner: `enhanced-senior-developer` (build), `testing-quality-specialist` (CI evidence) · Effort: **L** (3–5h focused + 2–4 CI round-trips of ~10–20 min each on the single runner)
- **Entry:** M1 passed (do not automate an unverified installer); branch pushed.
- **Work:** implement Stage-1 §4.3 **plus** this plan's corrections:
  1. Artifact paths: `release/*.exe`, `release/latest.yml`, `release/*.blockmap` (no `dist/`, no `*.msi`).
  2. Version guard: on tag runs, compare tag (`v`-stripped) to package.json `version` — fail fast **before** packaging; **skip on `workflow_dispatch`** (no tag); prerelease tags must match exactly (`v1.1.0-rc.1` ⇔ `1.1.0-rc.1`).
  3. Checksums: `Get-FileHash` → `SHA256SUMS.txt` in standard `<hash>  <filename>` format (not raw Get-FileHash table output).
  4. `--publish never` + explicit `publish` config; `GH_TOKEN` retained for Electron/NSIS download auth only.
  5. **Shared concurrency group across BOTH workflows** (`concurrency: group: self-hosted-windows-serial`, `cancel-in-progress: false`) — `nodejs-ci.yml` included, because the cleanup action kills *all* node processes (Stage-1 correction §9.7).
  6. Post-build disk cleanup: remove `release/win-unpacked` after upload; fail loudly if free disk < 10 GB.
  7. Release job: body from `docs/release-notes/vX.Y.Z.md` if present else `generate_release_notes: true`; `prerelease: true` when tag contains `-`; dispatch documented as smoke-only (workflow header comment + dispatch input description).
  8. **Dry-run procedure (written into the checklist, executed by `testing-quality-specialist`):** create throwaway branch `tmp/release-dryrun` with package.json version `0.0.1-rc.1` → push → tag `v0.0.1-rc.1` on that commit → push tag → observe. **Cleanup checklist:** delete remote tag, delete the resulting public prerelease (`gh release delete`), delete branch. The prerelease is publicly visible until deleted — accepted for an unannounced repo, cleaned up same session.
- **Exit / DoD (M2 evidence, all recorded with CI run URLs):**
  a. Dispatch run: uploads exact artifact set, creates **no** release.
  b. Test-tag run: prerelease with exactly {exe, latest.yml, blockmap, SHA256SUMS.txt}; runtime logged (SM-3 baseline).
  c. **Negative test:** tag `v0.0.2-rc.1` pushed at the same commit → guard fails before packaging.
  d. Download CI-built installer → recompute SHA256 → matches `SHA256SUMS.txt` → **abbreviated clean-profile install/launch/uninstall** (the CI artifact, not the local one, is what ships).
  e. Runner hygiene: `release/win-unpacked` gone post-run; no orphaned node/electron processes; disk free recorded.
  f. Dry-run artifacts (tag/release/branch) deleted per cleanup checklist.
- **Dependencies:** WP3 (M1).
- **Verification:** the six evidence items above; any fail → fix and re-run; M2 requires all six.

**WP5 — User docs & release notes** · Owner: `enhanced-senior-developer` (drafts), `human` (fresh-reader review) · Effort: **M**
- **Entry:** M1 evidence exists (docs need WP3 facts: userData folder name, measured installer size, captured SmartScreen/no-server screenshots).
- **Work:** README rewrite — end-user path "Download from Releases" is the headline; `git clone` demoted to "Build from source"; Node badge scoped to the dev section; hardware honesty ("tested on Strix Halo 128 GB; NPU-class hardware recommended" — OQ-11 default). Create `docs/INSTALLATION.md` (SmartScreen walkthrough with the screenshots captured in WP3, Lemonade prerequisite step-by-step incl. the terminal command, system requirements, uninstall & data location incl. the verified userData path, canonical Lemonade URL). Create `docs/release-notes/TEMPLATE.md` with the six mandatory sections (§6.3). Fix canonical URL in every occurrence (README currently links the GitHub repo; `Landing.tsx` links `lemonade-server.ai` — D8 rules). Respect `docs/` convention (SCREAMING_SNAKE_CASE — `INSTALLATION.md` complies).
- **Exit / DoD:** `quality-reviewer`/`human` fresh-reader walkthrough as persona P1 (zero dev tools): README → Releases → INSTALLATION.md without ever seeing `git clone` in the primary path; all links resolve; no contradiction between README, INSTALLATION.md, and in-app copy.
- **Dependencies:** WP3. Soft-overlaps WP4.
- **Verification:** walkthrough record committed; link check.

**WP7 — Ship dry-run & v1.0.0 (M3)** · Owner: `human` (merge, tag, announce) + `testing-quality-specialist` (final evidence) · Effort: **S–M** focused + CI time
- **Entry:** M2 passed; WP5 done; OQ-6/D8 resolved; release notes file `docs/release-notes/v1.0.0.md` committed on the branch (authored from TEMPLATE — this is the one pre-tag manual step; the pipeline itself stays zero-touch).
- **Work:** PR `feature/release-installer-packaging` → `main`; `nodejs-ci.yml` green; squash-merge (`human`). On `main`: annotated tag `v1.0.0` (package.json already 1.0.0 — no bump needed; guard passes), push tag, monitor run live. Post-release: verify artifact set + notes against SM-4/SM-5; **fresh-account timed install from the published GitHub URL** (re-validates SM-1 against the shipped bytes); VirusTotal scan of the installer, engines noted in release notes if any flag (never advise disabling AV); execute announcement checklist (§6.4); update decision log (D-entries + Phase-2 backlog).
- **Exit / DoD:** M3 gate (§3) fully passed.
- **Dependencies:** WP4 (M2), WP5.
- **Verification:** release URL + run URL + timing + timed-install record committed as `docs/release-planning/v1.0.0-release-record.md`.

---

## 3. Milestones & Gating Criteria

**Rule: NOTHING advances past a gate until every criterion is met and recorded in-repo.** Gatekeeper for all gates: `human`, acting on `testing-quality-specialist` evidence and the Stage-3 `quality-reviewer` pass. Evidence lives under `docs/release-planning/` (unnumbered file names for evidence; numbers 03–06 reserved for pipeline-stage docs).

### M0 — Config ready (WP0 + WP1 + WP2 + WP6 complete)
1. Lockfile clean & committed; `npm ci` green locally and in CI.
2. `package.json`: author/repository/description set; nsis block, `buildResources`, `publish` config, `artifactName` present; broken `inspect` scripts removed; `electron-store` removed; dev-only dep move verified via asar listing.
3. `npm run build` + `build:electron:dir` green; win-unpacked exe VersionInfo correct (name/version/author); icon present in exe.
4. Landing copy final (WP6 DoD met, screenshots captured); diff confined to copy/links.
5. Freeze markers recorded (decision log D6; note: package.json is JSON — **no comments possible** — so freeze markers live in this plan, the workflows README update in WP4, and review policy, not in config comments).

### M1 — First locally-built installer installs cleanly (WP3 complete)
1. Installer built locally from final M0 config (icon + final copy included).
2. Full clean-profile matrix (§2.4 WP3 items 1–8) all PASS; any FAIL resets the gate.
3. Measurements logged: install-to-running < 3 min; installer size < 150 MB; userData folder name recorded.
4. Uninstall verified: app + shortcuts removed, userData preserved.
5. No-server UX verified (guidance renders, no crash); with-server functional smoke incl. **.pdf and .docx** upload verified (Environment B).
6. Checklist committed with `human` sign-off.

### M2 — CI release pipeline green end-to-end on a test tag (WP4 complete)
1. All six WP4 evidence items (a–f) recorded with CI run URLs.
2. CI-built artifact (not local build) passes abbreviated clean-profile install/launch/uninstall and checksum verification.
3. Version guard proven both ways (pass on matching tag; fail-fast on mismatch; skipped on dispatch).
4. Runner hygiene verified (disk, processes, cleanup of dry-run tag/release/branch).
5. Runtime logged; ≤ 15 min on warm cache (one cold-cache exception allowed, noted).

### M3 — v1.0.0 public release (WP7 complete)
1. PR merged to `main` with CI green; tag `v1.0.0` on the merged commit; pipeline run green in ≤ 15 min.
2. Public release contains exactly the 4-artifact set; release notes contain all mandatory sections (§6.3).
3. Fresh-account timed install **from the published URL** < 3 min.
4. VirusTotal scan done; findings noted.
5. Announcement checklist complete; decision log + release record committed.

---

## 4. Schedule — Single-Developer Sequencing

No calendar dates (single operator, interrupt-driven availability). Ordered critical path with effort:

```
WP0(S) → WP1(M) → WP2(M, human-asset-gated) → WP6(S) → WP3(M–L) → WP4(L) → WP5(M) → WP7(S–M)
 └──────────── M0 ───────────────────────────┘  └─ M1 ─┘  └─ M2 ─┘  └ M3 prep ┘ └ M3 ┘
```

- **Critical path:** everything above is on it except the soft WP4∥WP5 overlap (docs drafting during CI wait — marginal with one human; plan assumes serial).
- **Parallelization: effectively none.** One human operator, one self-hosted runner (serial by design after WP4's concurrency change), and strict gate ordering. WP2 and WP6 are independent of *each other* and can swap order; that is the only real flexibility.
- **Focused-work total:** ≈ 14–23 h. **Realistic elapsed: 3–5 working days**, because Stage-1's sum of task hours omits: CI round-trip latency (WP4 needs 3+ runs × ~10–20 min + queue/retry), fresh-account setup, screenshot capture for docs, and the icon asset. If the icon source asset does not exist, WP2 adds external wait (contingency in §7 PR-2 keeps the program moving).
- **Checkpoint cadence:** every WP exit is a natural stopping point; the plan is resumable from this document + the decision log alone (bus-factor mitigation, §7 PR-6).

---

## 5. Governance & Quality Gates

### 5.1 Stage-boundary checks (what Stage-3 `quality-reviewer` verifies at each boundary)

At **every** M0/M1/M2/M3 boundary, the reviewer actively hunts:
1. **Evidence completeness** — each gate criterion has a committed artifact (checklist/screenshot/CI URL/timing), not an assertion.
2. **No gate-skipping** — entry criteria of the next WP provably met before its work began.
3. **Frozen-field diff scan** — any change to `appId`, `productName`, `artifactName` pattern, or artifact-set composition is rejected unless it passed §8 change control.
4. **Scope-creep scan** — any feature/behavior diff beyond the WP's stated work (especially WP6: copy-only) is flagged and bounced.
5. **Decision-log consistency** — implementation matches D1–D10; deviations require a recorded change-control entry.
6. **Risk-register currency** — new risks surfaced during the WP are added to §7 with owner/trigger/mitigation/contingency.

### 5.2 What `testing-quality-specialist` must prove (evidence standards)

- **At M1:** the full §2.4 WP3 matrix — install on clean non-admin profile; install needs no internet beyond the download (NSIS runs offline once built); shortcuts work; app launches **without** Lemonade Server and shows guidance instead of crashing; with server, **.pdf and .docx** upload works (asar dynamic-import risk); uninstall removes app but **preserves** userData; Apps & Features metadata correct; timings and size recorded.
- **At M2:** the six WP4 evidence items — including the **negative** tests (mismatch tag fails; dispatch does not release) and **checksum integrity on the downloaded CI artifact**. Tag↔version guard is proven in both directions, not just the happy path.
- **At M3:** timed install from the published URL; artifact-set and notes completeness re-checked against the live release page.

### 5.3 Definition-of-Done overlay (every WP)

Code/config diff matches the WP's stated work; builds green; evidence committed; decision log touched only via change control; no lockfile drift reintroduced (any `package.json` dep change must land with its lockfile in the same commit).

---

## 6. Stakeholder & Communication Plan

### 6.1 Stakeholders

| Stakeholder | Interest | How served / communicated |
|---|---|---|
| **End users (P1/P2)** | Install that works, honest warnings | Release notes, README headline path, INSTALLATION.md, SmartScreen walkthrough with screenshots |
| **Community contributors (P3)** | Dev path still works | README "Build from source" retained; workflow header comments explain dispatch-vs-tag; CONTRIBUTING untouched |
| **Evaluators/press (P4)** | Clean trial + uninstall, honest hardware claims | Uninstall preserves/purges documented; "tested on Strix Halo 128 GB" phrasing, no unverified minimums |
| **Lemonade SDK ecosystem** | No install-path conflict; consistent messaging | Verified disjoint paths: Interviewer → `%LOCALAPPDATA%\Programs\Interviewer` + `%APPDATA%\ai-interviewer`; Lemonade Server → `%LOCALAPPDATA%\lemonade_server` (detected, not installed, by us). Installer writes nothing into Lemonade's dir and registers no conflicting PATH entries (checked in WP3). Canonical URL coordinated (D8); announcement offered to Lemonade channels |
| **Repo owner (`human`)** | Predictable, resumable program | This document + decision log + per-WP evidence; gate approvals are the only mandatory touchpoints |

### 6.2 Docs-as-deliverable policy
README rewrite, INSTALLATION.md, TEMPLATE.md, and release notes are **WP5 deliverables with their own DoD and gate (M3 criterion)**, not by-products. No tag is pushed until WP5's DoD is met.

### 6.3 Release-notes mandatory sections (enforced at M2/M3)
1. ⚠️ Prerequisite: Lemonade Server — what/where (canonical URL)/tested version/"install first, Interviewer detects it".
2. System requirements — Windows 11 x64 22H2+; NPU-class hardware recommended (tested config stated honestly); models **not** bundled (multi-GB first pull via Lemonade Server).
3. Install steps incl. SmartScreen ("Windows protected your PC → More info → Run anyway") with screenshot/GIF; never advise disabling Defender/AV.
4. What's new / fixed / known issues.
5. Uninstall & user-data location (verified userData path) incl. purge instructions.
6. Checksums — "verify SHA256SUMS.txt".

### 6.4 Announcement checklist (M3, in order)
1. Release page verified live + artifact URLs resolve (incognito/private window).
2. VirusTotal scan recorded; any engine flags noted in release notes.
3. README + INSTALLATION.md links verified from the rendered GitHub pages.
4. Community post / Lemonade SDK channels notified (prerequisite front-and-center).
5. Decision log + release record committed.
6. Watch repo issues for 48 h for install reports (operations note; not gating).

---

## 7. Program Risk Register (delivery-re-ranked; Stage-1 items folded in)

New program-level risks are prefixed **PR-n**; Stage-1 risks referenced as R-n. Ranked by *delivery* threat to this program, not by lifetime severity.

| Rank | Risk | L | I | Owner | Trigger | Mitigation | Contingency |
|---|---|---|---|---|---|---|---|
| 1 | **PR-1: Runner contention corrupts a release run.** Single self-hosted runner; the cleanup action kills *all* node/electron processes; `nodejs-ci.yml` has no concurrency control, so a PR build can murder an in-flight release build (sharpens R10) | Med | High | enhanced-senior-developer | PR CI starts during a release run | Shared repo-wide concurrency group `self-hosted-windows-serial` on **both** workflows (WP4 item 5); release runs scheduled when no PRs are merging | Re-run the release workflow (idempotent: same tag → same artifacts); delete partial release first if created |
| 2 | **PR-2: Icon asset blocks M0.** Verified: only brand mark is `public/logo.png` at **187×185 px < 256×256 minimum**; no agent can design a new mark without human input | Med | Med | human | No ≥256 px source by WP2 start | Ask for source asset at program kickoff (day 1, not WP2 start) | Interim: high-quality upscale of logo.png to 256×256 multi-size .ico, labelled interim; replace before/after M3 without pipeline changes |
| 3 | **PR-3: Dependabot churn mid-program.** Verified active weekly npm + github-actions dependabot with **placeholder reviewer** (`your-github-username`); a dependency/lockfile PR merging between WP0 and WP7 breaks `npm ci` baselines or the version guard (sharpens R4) | Med | High | human | Dependabot PR merges during the program | **Dependency-PR merge freeze** from WP0 to M3 (decision log D9); freeze recorded in WP0 | If one slips in: revert/rebase, re-run WP0 acceptance, re-verify affected gates |
| 4 | R9: Lemonade Server missing/incompatible → "installer broken" blame | High | Med | human | Post-release issue reports | Mandatory prerequisite block in notes/README/first-run UX; tested-version pinned in notes; honest hardware phrasing | Fast-follow release-notes edit; INSTALLATION.md FAQ expansion; hotfix via the same pipeline |
| 5 | R1: SmartScreen scares off P1/P2 on every version (unsigned, no per-hash reputation) | High | High | human | Users report abandoning install | Screenshots walkthrough in every release; checksums; canonical FAQ | Phase-2 OV/EV cert (D4 change-control); interim: none without budget |
| 6 | R6: asar assumptions break packaged app (HTML traversal; dynamic `import('pdf-parse')`) | Low | High | testing-quality-specialist | WP3 pdf/docx upload fails | WP3 matrix items 6 explicitly covers it; never change outDir/vite base without re-test | Defect → fix in app code → **full M1 re-run** (no exceptions); schedule buffer in WP3's L estimate |
| 7 | **PR-4: CI iteration latency eats the schedule.** Each runner round-trip ~10–20 min; WP4 realistically needs 3–4 runs plus retries; easy to burn a day | High | Med | enhanced-senior-developer | First WP4 run fails | Lint workflow YAML locally; dispatch smoke before tag runs (warms caches); all six evidence items batched per run | Extend elapsed estimate honestly rather than cutting evidence items |
| 8 | R5: electron-builder cache download failures/rate limits on first CI runs | Med | Med | enhanced-senior-developer | NSIS/Electron zip fetch fails | GH_TOKEN auth kept; dispatch run warms runner caches before tagged run | Manual cache-warm procedure on the runner; retry with backoff |
| 9 | R8: AV false positives on unsigned Electron binaries | Med | High | human | VirusTotal flags engines | SHA256SUMS.txt; per-release VirusTotal scan with disclosed findings; never advise disabling AV | Note offending engines; signing cert is the only real fix (Phase 2) |
| 10 | **PR-5: Scope creep** — auto-update, signing, portable, MSI, Start-server button requests mid-program | Med | Med | human | "Small addition" PRs/comments | Decision log D1–D5 frozen + §8 change control; reviewer scope-creep scan (§5.1.4) | Item goes to Phase-2 backlog entry, dated; program continues unchanged |
| 11 | **PR-6: Single-operator bus factor / context loss** over multi-day, many-increment execution | Med | Med | human | Sessions interrupted; context stale | Every WP's entry/exit criteria + evidence are self-contained in-repo; decision log is the resume point; nothing lives only in chat | Re-read this doc + decision log; worst case, resume at last passed gate — gates make partial progress safe |
| 12 | **PR-7: Dry-run residue.** Test tag, public prerelease, temp branch, temp version commit left behind after M2 | Med | Med | testing-quality-specialist | Cleanup checklist skipped | Explicit cleanup checklist in WP4 item 8; M2 criterion f verifies deletion | Manual deletion of tag/release/branch; verify `git tag -l` empty again |
| 13 | R2: Runner hardware/OS failure halts the program (SPOF) | Low | High | human | Runner offline during WP4/M3 | Workflow is secret-light (GITHUB_TOKEN only); runner updated; disk-hygiene step | Temporarily switch `runs-on` to GitHub-hosted `windows-latest` (cold caches ⇒ longer first run; allowed) |
| 14 | R11: Runner disk exhaustion (~300 MB/build + caches) | Med | Med | enhanced-senior-developer | Free disk < 10 GB | Post-build `win-unpacked` removal; fail-loudly guard (WP4 item 6) | Manual disk audit; prune `release/` history |
| 15 | R12: appId/productName later changed, breaking upgrades | Low | High | quality-reviewer | Any diff touching frozen fields | Frozen via D6; reviewer diff-scan at every boundary | Revert; if already shipped, ship corrective release restoring GUID |
| 16 | R3: x64-only excludes Windows-on-ARM | Low | Low | — | ARM user reports | Stated in notes/README; target fleet is x64-native NPU | arm64 arch added to nsis target in Phase 2 |

---

## 8. Decision Log (frozen unless change control is invoked)

| # | Decision | Status | Rationale (from Stage 1 + this plan) |
|---|----------|--------|--------------------------------------|
| D1 | **NSIS one-click `.exe` (x64) is the v1 installer** | FROZEN | Weighted 8.9/10; ecosystem norm; best unsigned behavior; native electron-builder target |
| D2 | **No MSI in v1** (WiX harvest of `win-unpacked` only after a concrete enterprise/GPO request) | FROZEN | electron-builder has no MSI target; doubled test matrix for ~0 current enterprise demand |
| D3 | **No auto-update in v1**; latest.yml + blockmap published anyway so enabling later is additive | FROZEN | Unsigned updates re-trigger SmartScreen with no docs at that moment; cost > benefit now |
| D4 | **Unsigned builds for v1**; SmartScreen handled by documentation, never by "disable AV" advice | FROZEN | No certificate available; OV/EV is Phase-2 budget item |
| D5 | **Windows-only, x64-only for v1** | FROZEN | Only a self-hosted Windows runner exists; target fleet is x64 NPU hardware |
| D6 | **`appId` (`com.interviewer.app`) and `productName` (`Interviewer`) frozen forever**; artifact naming `Interviewer-Setup-${version}.${ext}` frozen | FROZEN | NSIS upgrade GUID + paths derive from these; change breaks upgrade/uninstall linkage. Markers live in this log + workflows README (JSON has no comments) |
| D7 | **First release = `v1.0.0`**; package.json is the single version source of truth; tag↔version guard enforced in CI | FROZEN | package.json already 1.0.0; no tags exist; OQ-1 default |
| D8 | Canonical Lemonade Server URL: **default `https://lemonade-server.ai/`** (in-app Landing already uses it; one README fix beats one app-copy change) — *final confirmation by `human` with Lemonade team required before WP5 completes* | OPEN → must close by M2 | Stage-1 OQ-6; the only externally-dependent decision; blocked on nobody but `human` |
| D9 | **Dependency-PR merge freeze (incl. dependabot) from WP0 through M3** | FROZEN (program rule) | PR-3; lockfile/version-guard integrity |
| D10 | Artifact set per release = exactly {exe, latest.yml, blockmap, SHA256SUMS.txt}; no win-unpacked zip, no portable | FROZEN | OQ-3/OQ-8 defaults; minimal release surface |
| D11 | Test environments: clean **non-admin** local account (primary) + developer account with Lemonade Server (functional smoke); Sandbox/VM optional extras | FROZEN | Most representative, zero infra cost; deviation must be noted in checklist |
| D12 | One-click wizard (`oneClick: true`), per-user `%LOCALAPPDATA%\Programs`, **no install-location choice in v1** | FROZEN | Corrects Stage-1 FR-4 wording (§9.1); location choice would require assisted wizard |

**Change-control rule.** Any change to a FROZEN decision requires: (1) a written proposal recorded as a new D-entry with rationale and impact; (2) a `quality-reviewer` pass on that entry; (3) explicit `human` approval recorded in the log. Changes to D6 fields additionally require an upgrade-path analysis and a fresh clean-install test cycle (M1 re-run). OPEN decisions close only by recorded `human` decision. New scope of any kind follows the same control or is logged to the Phase-2 backlog.

---

## 9. Critical Review of Stage 1 (mandatory; findings are constructive)

I largely endorse 01-strategy-analysis.md — its verification log is unusually honest — but a quality reviewer should see these challenges:

1. **FR-4 contradicts OQ-2 (factual error).** FR-4 promises "elevation fallback **if the user chooses a different location**", but the chosen `oneClick: true` wizard offers **no** location chooser — install goes to `%LOCALAPPDATA%\Programs\Interviewer` unconditionally. Fixed as D12; FR-4 must be reworded in implementation docs so nobody "fixes" the installer to add a path picker (that would be the assisted wizard — a different decision).
2. **Icon situation mischaracterized (flag G incomplete).** "No application icon exists" is true for `.ico/.icns`, but `public/logo.png` exists as a brand mark — so WP2 is not greenfield. However it is **187×185 px, below electron-builder's 256×256 minimum**, so it also isn't the free fix it looks like. Net: WP2 remains human-asset-gated (PR-2), with a concrete interim path Stage 1 didn't define.
3. **Effort estimate is optimistic.** "~2–3 focused days" sums task hours (13.5–22.5 h) but omits CI round-trip latency on the single runner (WP4 needs 3–4 runs), fresh-account setup, doc-screenshot capture, and icon asset production. Realistic elapsed: **3–5 days** (§4). Not a strategy error, but a plan must carry the honest number.
4. **WP6-after-WP3 ordering flaw.** Verifying the installer before polishing shipped app copy (Landing/Settings) invalidates the verified artifact. Reordered (§2.1 Δ1). This is the kind of sequencing bug a reviewer should hunt for.
5. **Missed `.gitignore` trap.** Line 42 ignores `electron-builder.yml`. The config stays in `package.json` (already the design), but the trap is now explicitly flagged in WP1 so an implementer doesn't "tidy" config into a file that silently never commits.
6. **Missed dependabot exposure.** Stage 1's R4 treats lockfile drift as historical (the dirty working tree). The repo has an **active weekly dependabot config with a broken placeholder reviewer** — drift is a *recurring mechanism*, not a one-time cleanup. Added PR-3 + freeze D9. (Placeholder reviewer fix logged to Phase-2 backlog; touching it is out of this program's scope.)
7. **Concurrency fix underspecified.** Stage 1 proposes a concurrency group on `electron-release.yml` only. The cleanup action kills **all** node processes machine-wide, so a concurrent `nodejs-ci.yml` PR run can kill a release build too. GitHub concurrency groups are repo-scoped, so the correct fix is one shared group on **both** workflows (WP4 item 5).
8. **S3 "zero manual steps" needs a footnote.** The release-notes file (`docs/release-notes/vX.Y.Z.md`) must be authored and committed *before* tagging — a manual step, just pre-pipeline. Clarified in WP7: zero manual steps *after* tag push.
9. **Version-guard spec incomplete.** Stage 1 doesn't state: (a) guard must **skip on dispatch** (no tag ref); (b) prerelease tags match full semver incl. suffix; (c) the test-tag dry run requires a **temporary version-bump commit on a throwaway branch** (tag must point at matching version or the guard — correctly — fails the happy-path test), plus explicit cleanup of tag/release/branch afterwards. All now in WP4 + PR-7.
10. **CI test strength overstated as a safety net.** `npm test` runs with `continue-on-error`, there are only two jest files, and none touch packaging. The plan therefore leans on the WP3 manual matrix as the real gate (SM-7) and says so — CI green is necessary but far from sufficient.
11. **R8 VirusTotal note needs sequencing.** Scanning the installer publicly is fine (the release is public anyway), but the scan belongs in the M3 checklist *after* publish, with findings disclosed — encoded in §6.4.
12. **OQ-6/D8 is the only externally-blocked decision and is under-flagged.** It gates WP5 and WP6 link text; Stage 1 lists it as an open question with a default, but as a program matter it needs an owner and a deadline: `human`, close by M2, default stands if no answer (D8).

No disagreements with the installer-format decision, the auto-update deferral, the no-bundling stance, or the artifact-set design — those survive scrutiny.

---

## 10. Handoff Note (to Stage 3 quality-reviewer)

Attack surface for your review, in priority order: (1) gate criteria vs. evidence availability — can every M-criterion actually be evidenced on this machine? (2) DAG vs. milestone mapping consistency; (3) the two ordering changes (§2.1) and the FR-4/D12 correction (§9.1); (4) risk PR-1/PR-3 mitigations (shared concurrency group, freeze) — are they enforceable by one human? (5) decision log vs. Stage-1 recommendations — every delta is deliberate and cited. Do not rubber-stamp §9; if you find Stage 1 was right and this plan wrong, record it in your deliverable and bounce the affected gate.

*End of Stage 2 deliverable. No commits made; no code or config modified; only this file created under `docs/release-planning/`.*
