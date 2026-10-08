# Interviewer {VERSION}

<!--
MANDATORY release-body template. The six sections below are required for every
release.
When used by .github/workflows/electron-release.yml this text becomes the
release body header, with GitHub's auto-generated changelog appended.
Replace {PLACEHOLDERS}; do not delete sections.
-->

## ⚠️ Prerequisite: Lemonade Server (required)

Interviewer performs local AI inference through **[Lemonade Server](https://github.com/lemonade-sdk/lemonade)** — it does not run standalone.
**Install Lemonade Server first** (Windows: [direct lemonade.msi download](https://github.com/lemonade-sdk/lemonade/releases/latest/download/lemonade.msi) · [install guide](https://lemonade-server.ai/docs/guide/install/)); Interviewer detects it automatically at startup.
Tested with Lemonade Server {TESTED_LEMONADE_VERSION}.

## System requirements

- Windows 10/11 x64 (Windows 11 22H2+ recommended)
- NPU-class hardware recommended — developed and tested on Strix Halo (AMD Ryzen AI Max) hardware with 128 GB unified memory; smaller configurations may struggle with the recommended model
- Models are **not** bundled: your first model is downloaded (multi-GB) through Lemonade Server on first use
- Recommended model: `Qwen3-Coder-30B-A3B-Instruct-GGUF`

## Installation

1. Download `Interviewer-Setup-{VERSION}.exe` from the assets below.
2. **Verify the checksum** (recommended): see the Checksums section.
3. Double-click the installer. Builds are **unsigned**, so Windows SmartScreen will show *"Windows protected your PC"* — click **More info**, then **Run anyway**. This is expected for unsigned builds; do not disable your antivirus.
4. The app installs per-user to `%LOCALAPPDATA%\Programs\ai-interviewer` (no admin rights needed).
5. Start Lemonade Server (`lemonade-server serve`), then launch Interviewer.

## What's new / fixed / known issues

**New**

- {WHAT'S_NEW}

**Fixed**

- {FIXES}

**Known issues**

- Close Interviewer before installing a newer version — the one-click installer cannot replace files that are in use.
- Unsigned builds trigger SmartScreen on every fresh machine (see Installation).
- {OTHER_KNOWN_ISSUES}

## Uninstall & user data

- Uninstall via Windows Settings → Apps & Features → Interviewer.
- Your data lives in `%APPDATA%\ai-interviewer` and is **preserved** on uninstall.
- To purge everything: uninstall, then delete `%APPDATA%\ai-interviewer`.

## Checksums

Verify your download against the attached `SHA256SUMS.txt`:

```powershell
Get-FileHash .\Interviewer-Setup-{VERSION}.exe -Algorithm SHA256
```

Compare the output with the matching line in `SHA256SUMS.txt`. If they differ, do not run the installer.
