# Contributing to Church Presenter

Thank you for helping improve Church Presenter. This guide covers how to set up a development environment, run tests, and submit changes.

---

## Quick start

```bash
git clone https://github.com/anderianinc/churchpresenterapp.git
cd ChurchPresenterApp
npm install
npm run electron:dev      # start Electron dev build
# or
npm start                 # browser-only (no IPC features)
```

Node.js 18 or higher is required.

---

## Project structure

```
ChurchPresenterApp/
├── .github/workflows/    CI (ci.yml) and release (release.yml) pipelines
├── build-resources/      App icons and macOS entitlements (icons not committed)
├── docs/                 Church-facing guides and runbooks
├── electron/             Electron main process
│   ├── main.js           Window management, IPC handlers, file I/O
│   ├── preload.js        contextBridge — exposes IPC to renderer
│   ├── validators.js     CommonJS JSON schema validators
│   ├── defaultData.js    Re-exports src/data/defaultSongs.js for CJS
│   └── youversion.js     YouVersion API client
├── public/bibles/        Offline Bible data (KJV, NIV)
└── src/
    ├── App.jsx            Route definitions
    ├── store/
    │   ├── AppContext.jsx  All state and actions
    │   ├── persistence.js  localStorage validators and storage helpers
    │   └── liveStateSync.js  Browser live-state recovery
    ├── data/
    │   ├── defaultSongs.js  Starter song library (single source of truth)
    │   └── bible.js         Offline search + YouVersion bridge
    ├── hooks/
    │   └── useKeyboardShortcuts.js
    ├── components/        All React UI components
    └── __tests__/         Jest test suites
```

---

## Running tests

```bash
npm test                  # run once and exit
npm run test:watch        # watch mode
```

Tests use Jest + React Testing Library. There are no browser globals required — tests run in jsdom.

**All 186 tests must pass before submitting a pull request.**

---

## Code conventions

- **React** — functional components with hooks. No class components.
- **State** — all shared state lives in `AppContext`. Local UI state (e.g., open/closed panels) stays in the component.
- **Styles** — inline `style` objects using CSS variables from `src/styles/global.css`. No CSS modules or Tailwind.
- **IPC** — all Electron IPC handlers live in `electron/main.js`. All renderer-facing APIs are exposed via `electron/preload.js` using `contextBridge`. Never use `ipcRenderer.sendSync`.
- **Data** — any schema change to songs, schedules, or settings requires updating both `electron/validators.js` and `src/store/persistence.js` (keep them in sync).
- **Tests** — test pure logic by extracting functions from components, not by mounting the full React tree with IPC mocks. See `src/__tests__/domain.test.js` for the pattern.

---

## Making a change

1. **Fork** the repository and create a branch: `git checkout -b feature/your-feature`
2. **Write tests** for new logic before or alongside implementation
3. **Run the full test suite** — `npm test` must exit green
4. **Test manually** in Electron (`npm run electron:dev`) — automated tests don't cover the live output windows
5. **Open a pull request** — describe what changed and why; include screenshots for UI changes

---

## Submitting a bug report

Open a GitHub issue and include:

- Church Presenter version (shown in the window title or `package.json`)
- Operating system and version
- Steps to reproduce
- What you expected vs. what happened
- Browser console errors (open DevTools with `Ctrl/Cmd+Shift+I` in Electron)

---

## Release process (maintainers)

1. Update `CHANGELOG.md` — move items from `[Unreleased]` to a new version section
2. Bump the version in `package.json`
3. Refresh the bundled Bible translation list (see below)
4. Commit: `git commit -m "chore: release v1.x.x"`
5. Tag: `git tag v1.x.x && git push origin v1.x.x`
6. The `release.yml` workflow builds macOS/Windows/Linux installers and creates a GitHub Release automatically

> **Note:** `release.yml` runs `node scripts/update-bible-translations.js` automatically before each build, so you only need step 3 if you want the refreshed list committed to the repo (useful so `main` always ships the latest data even without a release).

### Bundled Bible translation list

The file `public/bibles/translations.json` contains a snapshot of all translations available from [bible.helloao.org](https://bible.helloao.org). The app loads this file immediately on launch (fast, works offline), then background-refreshes from the live API.

**To regenerate the snapshot manually:**

```bash
npm run update-translations
# → updates public/bibles/translations.json
git add public/bibles/translations.json
git commit -m "chore: update bundled Bible translations"
```

**Automated refresh:** `.github/workflows/update-translations.yml` runs this on the 1st of every month and commits the result automatically if anything changed. You can also trigger it manually from the Actions tab.

### Code signing (optional but recommended)

Unsigned builds work on all platforms with a one-time bypass:
- **macOS** — right-click → Open (first launch only)
- **Windows** — click "More info" → "Run anyway" in SmartScreen

For signed production builds, add these secrets to the GitHub repo:

| Secret | Purpose |
|---|---|
| `MAC_CERT_P12_BASE64` | Base64-encoded `.p12` Developer ID Application certificate |
| `MAC_CERT_PASSWORD` | Password for the `.p12` certificate |
| `APPLE_ID` | Apple ID for notarization |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password from appleid.apple.com |
| `APPLE_TEAM_ID` | Apple Developer Team ID |
| `WIN_CERT_P12_BASE64` | Base64-encoded Windows code-signing certificate (optional) |
| `WIN_CERT_PASSWORD` | Password for the Windows certificate (optional) |

---

## Questions?

Open a GitHub issue with the `question` label or start a Discussion.
