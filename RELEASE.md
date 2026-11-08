# Living Manifesto release procedure

## Source of truth

`deploy.mjs` reconstructs the historical application and applies `understand-patch.mjs` and `integrated-learning-patch.mjs`. Root app.js and _worker.js are historical copies, not the release. Always deploy the tested dist directory. Never upload the repository root as the application.

Run `node scripts/build.mjs` with Node 22 or later. This cleans dist, generates the complete app, checks syntax, checks route/UI invariants, runs the generated Worker with an in-memory SQLite D1 adapter, executes the complete frontend in a simulated DOM, and records version, Git commit and file hashes in release.json. AI, X and PDF converter responses in these local tests are controlled fixtures, not proof of live external services. GitHub runs this on every PR and main/stabilise push. Artifact names contain version and commit.

## Staging gate — required before production

1. Inspect Cloudflare production deployment and record its version ID, routes, secrets names, bindings, build command and last healthy commit. Preserve the known working v0.4.8 deployment.
2. Create/use a separate staging Worker and separate staging D1 database. NEVER bind staging to production database `39259550-5d35-4d51-aaee-f203d33af1c9`. Staging must use separate APP_PASSWORD, SESSION_SECRET and SHORTCUT_TOKEN secrets. Retain the CONVERTER AI binding and ASSETS static binding. Do not copy production personal data into staging.
3. Build once, save the artifact and its digest. Deploy those exact dist bytes to staging with a staging-specific Wrangler configuration. Do not let a deployment command regenerate a different build. Use GitHub staging/promotion for deployment; direct deployment through the root Wrangler configuration is intentionally blocked.
4. Run `APP_URL=https://verified-staging-route EXPECTED_SHA=<commit> APP_PASSWORD=<secret> node scripts/healthcheck.mjs`. Supply secrets through CI secrets/environment, never command history or public logs.
5. In the staging browser: sign in; save a test article; capture an accessible public X post and X Article; import a selectable-text PDF via the current supported workflow and retrieve a PDF URL; verify text is actually stored; generate a real Deep Dive; reload, sign out/in and reopen the same dossier. Verify all sections, no regeneration on reopen, and exported dossier content. Record exact URLs, expected extraction coverage, timestamps and outcomes. Review Worker errors. Simulated tests cannot replace these checks.
6. Stop on any failure. Do not promote merely because a packaging workflow is green.

## Production promotion and verification

Take a private D1 export or confirm a usable Time Travel restore point before promotion; do not place backups in GitHub artifacts or this public repository. Record source and belief counts. Deploy the exact tested release to the existing living-manifesto-app Worker, retaining production DB, secrets, routes and bindings. Never delete/recreate the production D1 database. The new learning_dossiers table is additive and old releases can ignore it.

Run scripts/healthcheck.mjs against the verified production URL with the expected commit and an existing authorised password. This reads existing articles/dossiers and does not create or delete sources. Check the actual browser login, saved articles, version/hash, X/PDF ingestion and a generated-and-reopened dossier. Inspect Cloudflare errors. Report precise tests and limitations; do not declare completion before these live checks pass.

## Rollback

If production checks fail, select the recorded last healthy deployment in Cloudflare deployment history and roll the Worker back to that version. Preserve its asset bundle and configuration. Do not restore, delete or recreate D1 for a code regression: rolling back code must retain existing sources and new dossiers. Confirm the prior health version, login and saved articles afterwards. Database restoration is a separate incident decision, never an automatic release rollback. Retain deployment IDs, commit hashes, artifact hashes and verification evidence in a private operational record.

## Verified release — 6 November 2026

Production v0.5.1 is commit `cd529912abfe385f3a0252e59da204a617b155cc`, Cloudflare version `3d22fca7-479c-4b3a-95e0-bd3dd2979982`.
Staging run [42217790467](https://github.com/7dmsfwwmyd-max/Living-manifesto/actions/runs/42217790467) passed real login, X/PDF retrieval, AI dossier creation, fresh login/reopening, cached reuse and export. Production promotion [42218025196](https://github.com/7dmsfwwmyd-max/Living-manifesto/actions/runs/42218025196) passed exact revision/asset hashes, anonymous access denial, original secret/DB bindings and unchanged stored-data fingerprints. A D1 Time Travel bookmark and previous Worker deployment are recorded in its rollback artifact; no private article data is exported there.

Authenticated production browser checks passed: existing saved article and analysis opened; a real dossier generated for the saved Loops and Graphs article; a full page reload followed by reopening displayed the stored dossier without another generation request. Real production X retrieval and a 39,327-character public PDF URL import were verified earlier in this release session. The labelled PDF test source is retained. Production login was tested earlier and the authenticated session survived promotion. A second production sign-out/sign-in was not performed; that cycle passed in isolated staging.

Known limits: external retrieval can fail for private/deleted/paywalled sources; one Google Drive preview did not expose its document text. PDF verification covers selectable text/PDF URLs, not scanned-image OCR. AI reading suggestions are not independently verified citations, and depth/quality vary. Free quota exhaustion must fail rather than upgrade or incur paid usage. The account screenshot showed Workers Free active and no payment method; the API token cannot read billing subscriptions.

## Operating the release workflows

1. Push a change or run **Build and validate isolated staging** manually. It builds the entire generated application, runs six regression tests, deploys to a separate Worker/D1, and runs real integration checks. It creates an artifact only after success. Keep the run ID and exact commit SHA.
2. Run **Promote validated artifact** manually with that staging run ID and commit SHA. There are no stale default inputs and production is never deployed on push by this workflow. It checks the successful staging result and file hashes, records the previous deployment and D1 restore point, promotes identical bytes, then checks live health, hashes, bindings, access control and data preservation. Any automated post-deploy failure restores the previous Worker version without modifying D1.
3. Verify the authenticated production UI and dossier reopening before announcing success. Read-only `validate-live.yml` can additionally use a production GitHub environment with an existing APP_PASSWORD secret; it is optional and not preconfigured.
4. To roll back manually, use Cloudflare Workers → living-manifesto-app → Deployments → the last healthy recorded version → Roll back. For this release the preceding version is `b3724231-82a5-4c66-9b6f-f9f4b8ebbe68`. Do not restore D1 as part of code rollback. Confirm login, saved articles and cached dossiers afterwards.

Cloudflare’s old main-branch build trigger has been moved to the inactive `release-via-github-actions-only` branch, with build command `node scripts/build.mjs` and a deployment command that refuses direct promotion. Its original build command regenerated unvalidated files and excluded _headers. The settings were read back successfully in run 42218952596.

The root Wrangler configuration deliberately fails direct deployment with a clear promotion instruction. This prevents ordinary `wrangler deploy` or connected Git builds bypassing staging. Staging and promotion supply their own explicit generated configurations. Use `node scripts/build.mjs` for builds, not `wrangler deploy`. No workflow enables billing or changes plans. Keep the public repository and standard runners; review free allowances before changing that arrangement.

## AI model maintenance

Deep Dive uses `@cf/meta/llama-3.3-70b-instruct-fp8-fast`. The original
`@cf/meta/llama-3.1-8b-instruct` was retired on 30 May 2026:
https://developers.cloudflare.com/changelog/post/2026-05-08-planned-model-deprecations/
The replacement model and JSON output are documented at:
https://developers.cloudflare.com/workers-ai/models/llama-3.3-70b-instruct-fp8-fast/

The generated-worker tests verify the selected model and preserve source data
on AI failure. They cannot establish provider availability. Before promotion,
generate and reopen a dossier against the real staging AI binding. Review the
Cloudflare deprecation changelog before each release. Do not claim real AI success
from fixture tests. Existing cached dossiers remain readable if AI is unavailable.

## Automated deployed validation

`validate-live.yml` is a manually dispatched workflow. Configure GitHub environments
`staging` and `production`, each with APP_URL variable and APP_PASSWORD secret.
Staging additionally requires TEST_X_URL and TEST_PDF_URL for stable, accessible
public fixtures. Run the workflow on the reviewed release branch with the exact
deployed commit. It fails closed when configuration or external calls are missing.
It does not deploy anything or provision databases. Production checking is optional,
read-only and depends on successful staging validation. Configure these environments
only after verifying the staging Worker has a separate database and production's
original database is retained.

The staging script writes only synthetic sources, generates a real dossier,
logs in again and compares stored content, checks cached reuse and export, then
checks X and PDF extraction. It refuses the known production hostname. Test sources
are retained, with no destructive cleanup. Never supply another production/custom
production URL as STAGING_URL. A staging hostname guard is not database isolation;
verify bindings before enabling the workflow. Browser validation remains necessary.

## v0.5.2 — automatic analysis

New captures and Share Sheet intake start analysis using the existing CONVERTER Workers AI binding. Share Sheet responses set `processing_automatically: true` and `ready_for_analysis: false` to skip the old manual ChatGPT handoff. Supplied text replacement also queues work, but already-analysed sources cannot be overwritten. Manual analysis import remains available as a fallback.

The sources table is the durable queue; no paid queue service is used. A two-minute scheduled handler processes one pending source per run and recovers processing leases older than five minutes. Existing pending sources are eligible too. Each source has at most three automatic attempts. Quota/capacity failures defer the next attempt for 24 hours. Exhausted retries show a retry action; inaccessible sources show Text needed. The scheduler continues when the browser is closed. The browser polls status every ten seconds while pending work exists and no edit dialog is open.

Analysis covers up to the first 10,000 characters of saved text, to bound free-tier usage. It requires a nonempty summary/question and at least one verified source excerpt before atomically committing ideas and proposed principles. Proposals are never automatically adopted. Deep Dive remains a separate saved learning dossier under Understand.

Staging supplies fresh credentials without preserving previous staging values. Health checks allow a short credential-propagation window, capped below the login lockout threshold. Production credentials remain preserved. Promotion records and pauses existing schedules, verifies data preservation, then enables the two-minute schedule; automatic rollback restores the previous code and schedules. When manually rolling back to v0.5.1, also restore the saved schedule configuration (normally no cron). Do not restore D1 for a code rollback.

Validation adds tests for capture-only analysis, Share Sheet handoff suppression, duplicate/ready-source preservation, grounded excerpts, invalid AI results, scheduled recovery and quota backoff. Staging creates a synthetic source and requires it to become Analysed without a process request or pasted analysis, then verifies fresh-login persistence and the existing Deep Dive, X and PDF flows.

## v0.5.3 topic discovery
Explore now accepts a topic and retrieves indexed web, YouTube, X and PDF candidates through public search, with an independent public Wikipedia reference discovery and Crossref metadata search for scholarly resources. No account or API key is used. It stops on provider challenges, reports partial coverage and never fabricates unavailable results. Workers AI can rank only retrieved IDs using titles/snippets; it cannot invent resource URLs. Reports persist in an additive `topic_searches` table and are included in export. Repeated topics reuse 24-hour results; five new successful searches/hour limit free service consumption. Platform search links remain available if retrieval is limited. Saving a result uses normal automatic capture; videos may require supplied transcripts. This is a metadata-based reading pathway, not a claim that every resource was read or that search is exhaustive.

Validation adds generated-app cases for authenticated search, URL filtering, invented ID rejection, duplicate rejection, persistence/export, caching and provider challenge handling. Staging must retrieve actual resources and reopen them in a new authenticated session before promotion.

### Verified deployment record (7 November 2026 UTC)
- Production serves v0.5.3, commit `1496c45d6705012fd1b609df8eb2f81d23b3e3a5`.
- Staging run `42317760771` passed all 13 generated-app tests and real login, automatic capture analysis, grounded excerpts, fresh-session persistence, Deep Dive creation/cache/export, X and PDF retrieval, and fresh topic retrieval plus saved search reopening.
- Promotion run `42317968687` passed exact asset hashes, original production bindings/secrets, anonymous access denial and unchanged database fingerprints. Rollback metadata is retained in that run's artifact; restore code/schedules only, not D1.
- Authenticated production browser verified existing articles (including the previously awaiting-analysis Livsun article) as Analysed. A Bayesian reasoning search returned 11 ranked resources. The report reopened in a fresh tab; saving the overview persisted a library source. That overview's full text could not be retrieved and correctly remained Text needed.
- Current limitation: the general search provider restricts server requests, so automated YouTube/X/broad-web discovery is not currently verified working. Independent Wikipedia references and Crossref metadata return useful resources, including PDF references. Direct platform search links remain available. Recommendations are based on metadata and are not full-content reviews.
- The temporary promotion trigger was removed after the successful deployment; future promotion again requires explicit selection of a successful staging artifact.


## v0.5.4 candidate — Learning Studio (not yet promoted)
A free-service-only, browser-resident learning layer is rendered beneath each saved source's Understand dossier and in Explore. It supports active recall (answer-before-reveal), confidence-based review intervals (1/3/7 days), named reading paths, user-authored supports/challenges/extends/questions links between saved sources, and an optional JSON clipboard backup/restore. The references are either verbatim excerpts of saved text or clearly labelled AI-generated explanations from the existing saved dossier. No new AI calls, API keys, scheduled tasks, paid services, or D1 tables are introduced.

Important privacy and persistence limitation: reviews, links, and paths use iPhone/browser localStorage rather than the Cloudflare database. They are not synced between the installed Home Screen app and Safari tabs, are not included in the normal library export, and can be lost if local browser data are cleared. The Learning Studio backup must be copied and stored securely to preserve them. This is an initial study workspace, not yet a durable cross-device knowledge graph. Do not describe its links as inferred or verified relationships.

The branch is a release candidate; it must pass a complete generated-app build, frontend/worker regression tests, live isolated staging, and authenticated browser verification before merging or production promotion. Production v0.5.3 remains the last verified release until that gate has passed. Promotion must retain the existing DB and use the exact tested artifact, never a reconstructed build. Existing source ingestion, model settings, security boundaries, and free-only configuration must remain untouched.

Before considering v0.5.4 release-ready, the isolated staging workflow also runs `scripts/staging-browser.mjs` in installed headless Chromium. It must authenticate with the real login form, open the E2E source in Understand, submit a recall review, reveal reference content, save a path and manual connection, restore a backup and verify data remain after reload. It fails closed if Chrome or any interaction is unavailable. No production or paid-service calls are made by this browser smoke test.

## Verified production promotion — v0.5.4 (8 November 2026 UTC)

- Learning Studio PR #9 merged as `0acdf0f940a8dcca2a0c999efb2dc77a7d882d07`. Separate isolated staging run [42434445270](https://github.com/7dmsfwwmyd-max/Living-manifesto/actions/runs/42434445270) validated **that exact SHA**, passing 14 generated-app tests, real automatic capture and AI analysis, saved Deep Dive, accessible X/PDF text, topic retrieval/caching, and a real authenticated Chromium session for recall answers, confidence-based review scheduling, source connections, learning paths, backup/restore and persistence on reload.
- User-approved one-time production promotion [42435033259](https://github.com/7dmsfwwmyd-max/Living-manifesto/actions/runs/42435033259) completed successfully with the **exact staging-validated artifact** (not the subsequent workflow-trigger commit). Cloudflare Worker version `745e7edf-7fd5-48be-b987-4d09ed3eb3e1` was logged on deployment.
- Production validation artifact records `version: 0.5.4`, `commit: 0acdf0f940a8dcca2a0c999efb2dc77a7d882d07`, timestamp `2026-11-08T01:37:50.457Z`, `public_health: true`, `asset_hashes: true`, `anonymous_access_denied: true`, `data_unchanged: true`. Original production D1 binding and all three secrets were preserved; prior Worker deployment and D1 Time Travel bookmark are recorded privately in the run's rollback artifact. The production two-minute cron schedule was restored. No paid keys/services or billing configuration were introduced.
- Temporary one-shot promotion trigger was removed after a successful deployment. Normal `workflow_dispatch` manual promotion gate remains unchanged for future releases.
- **Remaining check:** production authentication and Learning Studio behaviour in the user's actual Home Screen browser session have **not** been independently tested following promotion. The deployment report intentionally records `authenticated_browser_checks: pending`. Run a read-only sign-in/source-dossier check, then save one disposable learning review if desired. Do not mistake the successful staging browser test for a post-deployment production browser test.
- **Device storage:** Learning Studio review histories, paths and manual source links are stored in the browser's localStorage, not synced to Cloudflare D1 or included in the standard source export. Use the Learning Studio JSON backup to protect them, particularly before clearing browser data, changing phones or using a different Safari/PWA storage context.

## Verified production promotion — v0.5.5 (8 November 2026 UTC)

- PR [#12](https://github.com/7dmsfwwmyd-max/Living-manifesto/pull/12) merged to main commit `38d43b5b3aa7310fb452bed5b776256a8e316327`.
- Exactly that commit passed [isolated staging run 42476322959](https://github.com/7dmsfwwmyd-max/Living-manifesto/actions/runs/42476322959): 17 generated integration tests, real authenticated browser login, saved recall, named learning paths, manual source links, revision-checked D1 cloud sync, recovery after clearing local browser storage, navigable grounded concept links, and regression checks for real automatic AI capture, X/PDF ingestion and saved Deep Dive.
- [Production promotion run 42476493755](https://github.com/7dmsfwwmyd-max/Living-manifesto/actions/runs/42476493755) passed. Cloudflare Worker version: `f74d99e3-9944-4c40-b5ef-ec9bd218296a`. Exact asset hashes, original secret/D1 bindings, anonymous access denial and unchanged stored-data fingerprints were verified. Normal two-minute cron restored. The rollback artifact retains the original deployment and D1 Time Travel bookmark; do not put private data in the public repository.
- No new paid service, external search service or AI calls for Learning Studio were introduced. The one-shot workflow trigger was removed after successful promotion. A separate authenticated **production iPhone browser** check remains pending; the automated validation has no access to the user's actual session.
- Existing learning notes in the v0.5.4 browser localStorage are **not automatically migrated from other device contexts**; they upload when that original browser context opens the authenticated v0.5.5 app and synchronises. Keep an independent private Learning Studio JSON backup. Source links are user-authored; inferred shared-concept edges from tags/discipline are *not* verified agreement.

## Verified production promotion — v0.5.7 (8 November 2026 UTC)

- [PR #14](https://github.com/7dmsfwwmyd-max/Living-manifesto/pull/14) merged `77aa3092e21ae1cda72cc4f9d9fd1712f006ca54`. This includes the previously unpromoted v0.5.6 evergreen concepts feature and the new deterministic claim–evidence ledger.
- The exact merge SHA passed independent [main-branch staging #42503889422](https://github.com/7dmsfwwmyd-max/Living-manifesto/actions/runs/42503889422): 23/23 automated tests; authenticated Chromium browser exercising learning synchronisation, recovered study state, evergreen authoring, provenance/quote checks and the evidence panel; deterministic audit and workflow status, live X/PDF extraction and cached topic retrieval. For free-tier conservation, the model result in this stage was REUSED from a prior *live-generated* synthetic staging source; this is **not** fresh inference validation on the merged commit.
- [One-shot production promotion #42504011729](https://github.com/7dmsfwwmyd-max/Living-manifesto/actions/runs/42504011729) completed successfully, installing exactly the tested artifact. Cloudflare Worker version: `cbde019c-765e-4163-acbb-4877a089650c`.
- Production checks passed: expected release commit and health, exact live asset SHA-256 hashes, anonymous access denied, preserved original D1 binding and secret names, unchanged existing D1 table fingerprints, and restoration of existing cron scheduling. Previous Worker deployment and D1 Time Travel bookmark are retained in the restricted rollback artifact. No production dataset was copied into staging.
- Release only adds deterministic source-text matching, bounded D1 audit snapshots, provenance and workflow transparency. It introduces **no additional AI calls, paid API keys, billing changes or new third-party services**. The temporary one-shot release trigger was removed after verification.
- The claim audit distinguishes an exact quotation in SAVED text from independent factual corroboration. Status `anchored_in_saved_text` is not a claim that the author is accurate or that the original article was fully retrieved. Failed retrieval, insufficient saved text and AI capacity limits remain explicitly visible.
- **Remaining user verification:** real authenticated iPhone Home Screen production browser checks have not been performed by the deployment automation. Sign in, verify saved material remains visible, and test the new Explore → Claim verification and processing status / Evergreen concepts and source-detail Evidence ledger. Keep an independent private backup. The validated staging checks are not a substitute for personal-device verification.
