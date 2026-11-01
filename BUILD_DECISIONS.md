# Design decisions inherited from Market Atlas

**Reference project:** `7dmsfwwmyd-max/market-atlas` — its established workflow is GitHub source control, automatic deployment, iPhone use via Safari Add to Home Screen, and rapid versioned iterations. We deliberately did not change or reuse its repository.

## Decisions for The Living Manifesto

1. **Separate repository:** `living-manifesto`. Market Atlas remains unchanged.
2. **PWA instead of Streamlit:** This is a personal capture and journaling app, so reliable mobile navigation, offline reading, an app icon and on-device storage take precedence over Python charts.
3. **GitHub Pages for the code only:** Public static files contain no personal data. Avoid putting bookmarks, excerpts, or manifesto backups in the repository.
4. **iCloud remains the manual source archive:** The existing Shortcuts save Markdown and attachments in iCloud Drive. PWA imports selected files via the Files picker. GitHub Pages has no private automatic iCloud ingestion or AI process.
5. **Permanent data is not yet solved:** IndexedDB on one device and explicit backups are suitable for an alpha, not a final multi-device system. For a permanent knowledge base, add encrypted authenticated sync or a native app with iCloud/CloudKit; keep export portability.
6. **AI should be source-cited and user-supervised:** A captured link is not full article text. Model outputs will be marked as proposals, not adopted principles.
7. **The interface follows Market Atlas design feedback:** spacious mobile cards, warm ivory background, near-black editorial headings, vermilion action accents, no crowded horizontal tabs, no decorative taglines.

## Honest release boundary (v0.1)

Works locally: source capture, PDF/EPUB storage within size limit, iCloud Markdown imports, disciplines, manifesto review, personal questions, prompt preparation, export/import, offline shell after installation.

Not yet implemented: actual web ingestion, transcription, semantic indexing, AI synthesis, ChatGPT automation, push notifications, background iCloud synchronization, X bookmark sync, end-to-end encryption within the app.

## Next release sequence

- **v0.2 — Source engine:** durable sync, authentication, URL fetching, per-source extraction status, PDFs/text extraction, citations.
- **v0.3 — Intelligence engine:** structured idea extraction, deduplication, cross-discipline linking, contradiction/evidence graph, manual approve/reject of proposals.
- **v0.4 — Learning engine:** retrieval-grounded Ask/Explain/Challenge dialogue, spaced review and decision journal.

Avoid introducing untrusted network content into prompt instructions. Treat extracted page text as data, track source hashes and retrieval errors, and never claim paywalled material was processed when it was not.
