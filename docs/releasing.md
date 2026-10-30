# Releasing & Upgrading — Sustainable Plan

How we ship patches and new releases, and how users upgrade **without ever losing their songs, schedules, settings, or media.**

---

## The short version

1. User data lives in the OS user-data folder, **outside** the app — installing a new build never touches it.
2. On every launch the app **recovers data from any older install folder** (covers past folder renames), and **auto-backs-up** before a new version runs for the first time.
3. Users are told about new versions by an **in-app banner** and **Settings → Data & Updates → Check for Updates**, then download and install manually (guided manual update).
4. A one-click **Export / Restore Backup** gives a portable safety copy.

---

## Where data lives (and why upgrades are safe)

| Platform | Data folder |
|---|---|
| macOS   | `~/Library/Application Support/Church Presenter/` |
| Windows | `%APPDATA%\Church Presenter\` |
| Linux   | `~/.config/Church Presenter/` |

Inside it: `data/` (`songs.json`, `schedules.json`, `settings.json`), `media/`, `backups/`, `logs/`.

Because this is separate from the installed application, replacing the app (DMG / NSIS / AppImage) leaves all data in place. **Never move or rename the data folder in a release** — that is the one change that breaks upgrades.

### Automatic recovery from older folders

Earlier builds stored data under different folder names (`church-presenter`, `easyworship-clone`). On first launch the app scans those locations and migrates the newest real data into the current folder **once** (guarded by `data/.migrated-v2`), backing up anything it replaces to `data/pre-migration-backup/`. See `migrateLegacyData()` in [`electron/main.js`](../electron/main.js).

> If you ever change `app.name`, `productName`, or `appId`, **add the old folder name to `LEGACY_APP_DIR_NAMES`** in `electron/main.js`, or existing users will appear to lose their data.

### Automatic pre-upgrade backup

When the app detects the version changed since last launch, it snapshots the three data files to `backups/v<old>-to-v<new>-<timestamp>/` and keeps the most recent 6 (`backupOnVersionChange()`). This is the rollback path if a release misbehaves.

---

## Cutting a release

1. **Bump the version** in `package.json` following [semver](https://semver.org/):
   - patch (`1.0.1 → 1.0.2`) for fixes, minor (`1.1.0`) for features, major for breaking changes.
2. Update `CHANGELOG.md`.
3. Commit, then tag and push:
   ```bash
   git tag v1.0.2
   git push origin v1.0.2
   ```
4. The **Release** workflow ([`.github/workflows/release.yml`](../.github/workflows/release.yml)) builds macOS (arm64/x64), Windows, and Linux and uploads the installers to a GitHub Release. Tags containing `-` (e.g. `v1.1.0-beta.1`) are published as pre-releases.
5. Verify the GitHub Release has the expected assets.

The in-app update check reads the **latest published (non-pre) release** from the GitHub API, so users see the banner automatically once the release is live. For the check to reach users, the repo's **Releases must be publicly readable**.

### Release checklist
- [ ] `npm test` green
- [ ] Version bumped in `package.json`, `CHANGELOG.md` updated
- [ ] Installed the built app over a previous version on a test machine → songs/schedules/settings still present
- [ ] Exported a backup and restored it on a clean machine
- [ ] Tag pushed, GitHub Release has installers for every OS

---

## How users upgrade (guided manual)

- A banner appears in-app when a newer version exists (dismissible per version).
- Or **Settings → Data & Updates → Check for Updates**.
- Both lead to the GitHub Release download page. The user installs the new build over the old one; data is preserved automatically.
- Recommended habit: **Export Backup** before upgrading (one click in the same panel).

---

## Future option: fully automatic updates

If one day you want the app to download and apply updates itself (no manual install):

1. Add `electron-updater` and wire `autoUpdater` in `electron/main.js`.
2. Have the release build **publish** update metadata (`latest.yml`, `latest-mac.yml`, `.blockmap`) — i.e. run `electron-builder --publish always` (currently `--publish never`), or upload those files alongside the installers.
3. **Code-sign + notarize** macOS builds (the workflow already supports it when `MAC_CERT_*` / `APPLE_*` secrets are set) — Squirrel.Mac refuses unsigned updates. Sign Windows builds to avoid SmartScreen friction.

The data-safety machinery above (migration, auto-backup, export/restore) stays exactly the same under auto-update — only the delivery changes.
