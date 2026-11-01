# The Living Manifesto — Home Screen App (v0.1)

A private, offline-first, mobile-first personal knowledge app. No Readwise, Supabase, external AI keys, tracking or data connection. Built as a static progressive web app (PWA).

## What works

- Add source links, excerpts, personal thoughts, or documents (max 8 MB each) to browser IndexedDB.
- Search and filter sources; automatically count discipline coverage.
- Draft / approve / reject manifesto principles; manually revise adopted principles with version history.
- Save questions; assemble a careful, text-limited ChatGPT research prompt to copy to your ChatGPT Project.
- Import the Markdown files saved by the previous iCloud Shortcuts; import documents and JSON backups.
- Export all records plus attached file contents to JSON, up to 25 MB of attachments.
- PWA home screen installation with bespoke icon and offline shell after first successful load.

**Not yet connected:** AI processing, automatic content extraction, passive X bookmark ingestion, iCloud folder sync, or cross-device syncing. Linked URLs are never scraped. This is not a server or cloud account.

## Quick local preview

```bash
python3 -m http.server 8000
```

Open http://localhost:8000 in a browser. IndexedDB requires a supported browser and permitted storage. The Home Screen install requires HTTPS. If developing under a GitHub Pages project subdirectory, relative paths in the manifest and service worker work unchanged.

## Deploy through GitHub like Market Atlas

1. Create **a new repository** named `living-manifesto` under the same GitHub account as Market Atlas. Leave it distinct from `market-atlas`.
2. Upload the **contents** of this folder to the repository root. Do **not** upload private data or backup exports.
3. In repository **Settings → Pages → Build and deployment → Source**, select **GitHub Actions**. The included `.github/workflows/pages.yml` deploys on pushes to `main`.
4. Check the published URL in the **Actions** and **Pages** sections. The expected pattern is `https://<owner>.github.io/living-manifesto/`, but only use the URL GitHub actually reports once deployment succeeds.
5. On iPhone, open the published address in Safari → Share → **Add to Home Screen** → enable **Open as Web App** → Add.

GitHub Free's Pages hosting normally requires a **public repository**. GitHub Pages websites are publicly reachable, even when built from eligible private repositories. This application stores personal content only in your own browser, never in the code repository. The website **itself is public, not password protected**, and must not be mistaken for a secure multi-user service.

## Working with your existing iCloud Shortcuts

Existing Shortcuts save Markdown files and documents into `iCloud Drive/Shortcuts/Living Manifesto/Inbox` and `Attachments`. You can retain those shortcuts and their iCloud source of truth. In the app, choose **Library → Import iCloud files** or **Today → Backup & setup → Import sources**, then select one or more of those files in the iOS Files picker.

The app **does not automatically see iCloud folder contents**, due to browser sandbox restrictions. iOS Home Screen apps also maintain storage separate from a Safari tab, so make captures/imports inside the installed app to see them there. Exports via Share → Save to Files are your backup and method of migrating data to a different device. Protect any backup copies; they contain your personal writing.

## Architecture

- `index.html` / `styles.css` / `app.js`: static interface, validated input, IndexedDB storage.
- `manifest.webmanifest` / `assets/icon-*.png`: iPhone Home Screen identity.
- `service-worker.js`: cache the app shell for offline visits (not cloud sync).
- `.github/workflows/pages.yml`: GitHub Pages deployment workflow.
- `tests/test_app.py`: browser smoke tests using Python Playwright.

## Planned next milestone

A genuine sync + AI service with authentication, durable source retrieval, semantic knowledge processing and source-cited reasoning. GitHub Pages alone cannot do that. Maintain the principle that AI-generated suggestions and adopted user beliefs are always separate.
