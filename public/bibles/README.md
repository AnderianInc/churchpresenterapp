# Bible Translation Assets

Place full translation JSON files here for offline access.

Supported version keys:
- KJV
- NIV
- ESV
- NKJV
- NLT
- AMP
- TPT
- MSG

Each file should be named using the version code, for example:
- `NIV.json`
- `ESV.json`
- `AMP.json`

Expected JSON structure:

```json
{
  "version": "NIV",
  "passages": {
    "John 3:16": "For God so loved the world...",
    "Psalm 23:1": "The Lord is my shepherd..."
  }
}
```

If the app is running in offline mode, it will attempt to load assets from `/bibles/<VERSION>.json`.

> Note: this repository does not include copyrighted full translations. You must provide the translation data yourself or use a remote service in online mode.
