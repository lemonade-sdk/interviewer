# Interviewer — Installation Guide (Windows)

End-user installation guide for the Interviewer desktop app.
For building from source, see the [README](../README.md#installation).

---

## System requirements

| | |
|---|---|
| **OS** | Windows 10/11 x64 (Windows 11 22H2+ recommended) |
| **Prerequisite** | [Lemonade Server](https://github.com/lemonade-sdk/lemonade) installed and running |
| **Hardware** | NPU-class hardware recommended — tested on Strix Halo (AMD Ryzen AI Max) with 128 GB unified memory |
| **Model** | `Qwen3-Coder-30B-A3B-Instruct-GGUF` recommended — downloaded (multi-GB) through Lemonade Server, not bundled |
| **Disk** | ~120 MB download (installer); ~450 MB installed |
| **Permissions** | None — installs per user, no administrator rights required |

## Step 1 — Install Lemonade Server (required first)

Interviewer does not run standalone: all AI inference happens through Lemonade Server.

1. Install Lemonade Server:
   - **Windows (recommended):** download and run [lemonade.msi](https://github.com/lemonade-sdk/lemonade/releases/latest/download/lemonade.msi)
   - Other platforms / options: see the [Lemonade repository](https://github.com/lemonade-sdk/lemonade) and the [official install guide](https://lemonade-server.ai/docs/guide/install/)
2. Make sure it is running before starting Interviewer. If it is not running, start it in a terminal:

   ```
   lemonade-server serve
   ```

Interviewer detects Lemonade Server automatically at startup and tells you what is missing if anything is wrong.

## Step 2 — Download Interviewer

Download `Interviewer-Setup-x.y.z.exe` from the **[GitHub Releases page](https://github.com/lemonade-sdk/interviewer/releases)** (latest release, Assets section).

**Verify your download (recommended):** the release includes `SHA256SUMS.txt`. Compare hashes:

```powershell
Get-FileHash .\Interviewer-Setup-1.0.0.exe -Algorithm SHA256
```

The printed hash must match the corresponding line in `SHA256SUMS.txt`.

## Step 3 — Run the installer

Double-click the downloaded `.exe`. The installer is a one-click setup:

- installs to `%LOCALAPPDATA%\Programs\ai-interviewer`,
- creates Desktop and Start Menu shortcuts,
- needs **no administrator rights** and writes nothing outside your user profile.

### SmartScreen: "Windows protected your PC"

Interviewer builds are currently **unsigned**, so Windows SmartScreen shows a warning the first time you run the installer on a machine:

1. Click **More info**
2. Click **Run anyway**

This is expected for unsigned applications and does not mean the file is malicious. Verify the checksum above if in doubt. **Do not disable your antivirus** to install Interviewer — it is not necessary.

*(SmartScreen walkthrough screenshots will be added after the M1 verification pass.)*

## Step 4 — First launch

1. Start Interviewer from the Desktop/Start Menu shortcut.
2. If Lemonade Server is missing or not running, the landing page explains exactly what to do (download link or the `lemonade-server serve` command) — click **Retry Connection** after fixing it.
3. Once connected, upload your resume and the job post, then press **begin**.

> **Note:** the first model download through Lemonade Server is several GB and can take a while depending on your connection.

## Updating

1. **Close Interviewer first.** The one-click installer cannot replace files that are in use — installing over a running app can fail.
2. Download the new `Interviewer-Setup-x.y.z.exe` from [Releases](https://github.com/lemonade-sdk/interviewer/releases) and run it. It installs over the existing copy; your shortcuts survive and your data is untouched.

## Uninstalling

- **Windows Settings → Apps → Installed apps → Interviewer → Uninstall**, or use the Start Menu uninstall shortcut.
- The uninstaller removes the application directory (`%LOCALAPPDATA%\Programs\ai-interviewer`) and the shortcuts.
- **Your data is preserved**: uninstalling never deletes `%APPDATA%\ai-interviewer` (your personas, interview history and settings live there).

### Where everything lives

| What | Where |
|---|---|
| Application | `%LOCALAPPDATA%\Programs\ai-interviewer` |
| Your data (personas, history, settings) | `%APPDATA%\ai-interviewer` |
| Lemonade Server (not installed by us) | `%LOCALAPPDATA%\lemonade_server` |

> Note: the install directory and the data directory both use the name `ai-interviewer`; `Interviewer` is the app's display name (shortcuts, Apps & Features) only.

### Purging all data

To remove every trace: uninstall Interviewer (above), then delete `%APPDATA%\ai-interviewer`. Lemonade Server and its models are managed separately.

## FAQ

**Do I need administrator rights?**
No. The installer is per-user and writes only inside your profile (`%LOCALAPPDATA%` / `%APPDATA%`).

**My Windows username contains non-ASCII characters / my paths are long. Is that a problem?**
No. The installer supports Unicode paths, and the install location (`%LOCALAPPDATA%\Programs\ai-interviewer`) is short and shallow.

**SmartScreen warns on every new version?**
Yes, until builds are code-signed. Follow the [SmartScreen steps](#smartscreen-windows-protected-your-pc) each time; the checksum in `SHA256SUMS.txt` lets you verify authenticity.

**Antivirus flags the installer. What now?**
Unsigned Electron apps occasionally trigger false positives. Verify the SHA256 checksum against `SHA256SUMS.txt` before running, and never disable your antivirus. If you can, report the false positive to your AV vendor.

**Do I need to uninstall before updating?**
No — run the new installer over the existing install, but **close Interviewer first** (see [Updating](#updating)).

**macOS / Linux?**
The codebase is Electron and technically portable, but official installers are currently built and tested for Windows only.
