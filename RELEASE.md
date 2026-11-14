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

## Verified production promotion — v0.5.8 (8 November 2026 UTC)

- [PR #16](https://github.com/7dmsfwwmyd-max/Living-manifesto/pull/16) merged the Daily Intelligence Briefing. The immutable release source commit is `092541c50ed280d06e6cd4ce7d2c7c61d476bc71`; the final main-branch change solely fixed repeated-run staging preference revision handling.
- This exact source commit passed [isolated main-branch staging #42505684339](https://github.com/7dmsfwwmyd-max/Living-manifesto/actions/runs/42505684339), **28/28** automated tests, public health SHA identity, authenticated Chromium Today-screen briefing and filters, Learning Studio private D1 sync, evergreen concepts, quote ledger, privacy, D1 persisted preference CAS snooze/restore, X/PDF extraction, saved dossiers and topic resource retrieval.
- A previous v0.5.8 release-candidate staging failure was traced to the build script injecting the SHA into the briefing payload instead of /api/health. This was corrected by targeting the health route and adding a regression test. An initial main staging failure was a *test-only* stale preference revision error in shared staging; the test now retrieves the existing private stored revision before writing.
- The live AI grounding in staging uses a **previously live-generated synthetic fixture**; this run did not make fresh inference and must not be represented as independently validating the AI model on the candidate SHA. The briefing itself makes no additional Workers AI calls.
- [Production promotion #42505820123](https://github.com/7dmsfwwmyd-max/Living-manifesto/actions/runs/42505820123) succeeded and installed exact asset hashes. Cloudflare production Worker version ID: `238e9adc-8f0e-45bc-9472-b4cc6833f815`. Verified health SHA, original D1 binding, secret names, anonymous access denial and unchanged pre-existing D1 table fingerprints. Previous Worker deployment and D1 Time Travel bookmark retained in the rollback artifact. One-time promotion trigger removed after success.
- Briefing recommendations are deterministic and limited to existing saved source capture events, due recall, D1 evidence audits, evergreen concepts and user-authored links; they do **not** represent new internet discovery or independent claim verification. The original timestamp is a capture date, not a publication date. All actions are user-directed.
- Snooze, dismiss and restore use optimistic revision checks against an additive private `briefing_preferences` table. Its rows are included in the standard authenticated JSON export. No paid services or billing mutations were added; external provider billing guarantees cannot be independently established.
- **Remaining:** authenticate to production from the user's own iPhone Home Screen, verify saved articles and the Today briefing, test dismiss/snooze/recover, then verify Explore and source evidence. Automated production checks cannot substitute for this actual-device validation.

## Verified production promotion — v0.5.9 (9 November 2026 UTC)

- [PR #17](https://github.com/7dmsfwwmyd-max/Living-manifesto/pull/17) merged the deeper source summary feature. Exact release source commit: `b505db22be82f2dc7b22a2a5b00d2d087594de22`.
- Independent [main-branch staging #42542322976](https://github.com/7dmsfwwmyd-max/Living-manifesto/actions/runs/42542322976) passed **32/32** generated tests, authenticated Chromium session, original learning-state sync, evergreen and evidence features, correct version / exact commit and unchanged private data. Staging validated X/PDF extraction, saved Deep Dive and topic retrieval. Live AI generation was **reused from a previously genuine synthetic staging fixture**, not rerun with the new summary prompt.
- Automatic summary prompt now asks for a distinctive thesis, actual evidence, mechanisms, critical objections and 3–4 meaningful ideas instead of many shallow statements. New long-source sampler uses approx. first 6,800 and last 2,700 characters **within** the original 10,000-character source context budget and explicitly discloses the omitted middle. One inference call per automatic analysis, unchanged 2,400 max output tokens.
- The Analysis screen for prior **and** new sources can expand a detailed argument map from already stored source, idea, mechanism, evidence, short direct excerpt, counterargument and related link records without requesting further inference. Unverifiable excerpts and non-independent explanations are clearly identified; historical source/dossier records are never silently overwritten or regenerated.
- The user-triggered Deep Dive prompt now requests more rigorous first-principles, context, alternative interpretations, falsification, challenging questions and targeted foundational reading, staying on the prior one-call, 3,400 max output-token model path. Existing dossiers are retained and returned from cache.
- [One-time production release #42542477920](https://github.com/7dmsfwwmyd-max/Living-manifesto/actions/runs/42542477920) **SUCCESS**, Cloudflare Worker version `861d9993-0685-4623-9ef2-f7441fad084b`. Exact staged immutable build, public health SHA, asset hashes, original secret/D1 bindings, anonymous access denial, unchanged stored-D1 fingerprints and original cron were verified. Previous deployment and D1 Time Travel bookmark saved in restricted rollback artifact. One-time trigger removed.
- No additional AI calls, new paid API keys, subscriptions, billing edits, external providers or service-level changes were introduced. A hard guarantee of third-party costs cannot be independently supplied from software tests alone.
- Follow-up: real authenticated iPhone Home Screen session and independent evaluation of quality on **fresh** actual articles remain necessary; automation proves the prompts and data pathways, not that an LLM consistently produces good substantive summaries or the original source is complete. User should inspect the Analysis summary, Understand Deep Dive and evidence passage flags on selected materials.

## v0.5.10 candidate — bounded discovery attempts and honest coverage

- Failed searches previously bypassed the five-per-hour limit because only successful saved reports were counted. Each uncached POST now atomically reserves an attempt before contacting providers, including refreshes and failures. Concurrent requests share the same limit. Reservations expire after one hour; cached searches and saved history remain available without additional provider or AI calls. A 429 response includes Retry-After.
- A failed new search clears the prior active report, retains saved history, and displays provider coverage even when no resources were retrieved. The frontend carries structured error details and prevents duplicate form submissions.
- Resource cards identify the discovery provider and distinguish metadata/citations from retrieved full text, with a safe fallback for older saved reports.
- No new providers, API keys, paid dependencies, inference calls, scheduled discovery or billing changes. This does not make restricted YouTube/X retrieval reliable and does not verify existing account billing configuration.
- Additive, transient topic_search_attempts table contains only random attempt IDs and timestamps. It is not user-authored content and is not exported. Existing saved reports, source records and dossiers are unchanged.
- Local generated build passes 35 tests, including concurrent allowance reservations, failure coverage, expiry, cached access at the limit, provenance labels and frontend stale-result handling. Live staging and promotion remain pending until explicitly recorded below.

### Staging follow-up: Deep Dive output contract
The first v0.5.10 staging candidate passed browser/data checks but fresh Deep Dive returned HTTP 502 twice. Its exact malformed output was not logged, so truncation versus schema mismatch is not established. The follow-up supplies an explicit Workers AI JSON schema for the existing eight fields instead of generic JSON mode, retains strict validation and the same one-call/3,400-token ceiling, and validates reading objects before persistence. Invalid responses return a content-free diagnostic code; source text and model output are never added to CI diagnostics. This is a candidate fix pending live validation. Local suite: 36/36 passing.


## Verified production promotion — v0.5.10 (13 November 2026 UTC)

- PR [#19](https://github.com/7dmsfwwmyd-max/Living-manifesto/pull/19) merged as `2cbd5b375c50b2e2ea79837e27013b338db2579b`.
- Initial discovery candidate passed 35 tests and authenticated browser checks, but the existing Deep Dive generation failed twice with HTTP 502. The precise malformed output was not retained. Adding the explicit provider schema and strict reading-entry validation passed **fresh live Deep Dive generation**, persistence, fresh-session reopening and cached reuse in [candidate staging 43344947890](https://github.com/7dmsfwwmyd-max/Living-manifesto/actions/runs/43344947890).
- The exact merge SHA then passed [main staging 43345300757](https://github.com/7dmsfwwmyd-max/Living-manifesto/actions/runs/43345300757): 36 generated tests, authenticated Chromium, learning sync, evergreen concepts, evidence, briefing, X/PDF ingestion and saved topic retrieval. Previously generated synthetic analysis/dossier data were reused where available; do not describe every stage as fresh inference.
- [Production promotion 43345602675](https://github.com/7dmsfwwmyd-max/Living-manifesto/actions/runs/43345602675) succeeded. Worker version `3340a56b-9822-44be-aeed-dddcaeaaf7af`. Verified exact live asset hashes, health version/commit, anonymous access denial, original bindings and secrets, and unchanged pre-existing D1 fingerprints. Rollback metadata remains in the restricted workflow artifact. Original cron scheduling restored.
- Independent public health check confirmed production v0.5.10 and the exact merge SHA. The temporary promotion trigger was removed and the manual gate restored.
- General search remained blocked in staging: automated YouTube/X discovery is **not fixed**. Independent Wikipedia reference and Crossref retrieval worked. Resource cards now disclose metadata provenance and unverified full-text access; failure coverage is visible, stale results cleared, and all uncached attempts are bounded.
- No new providers, paid API keys, subscriptions or billing edits. Deep Dive retains the existing model and 3,400 output-token ceiling. Existing saved sources/dossiers were not regenerated.
- Authenticated production verification in the user's actual iPhone/Home Screen session remains unperformed. Passing staging browser checks and public production checks do not establish actual-device behaviour.

## v0.5.11 candidate — topic workspaces and thinking reviews

Explore now begins with private topic pages, linking selected saved sources, up to three saved arguments per source, shared-source evergreen concepts, current view/confidence, falsifying evidence, open questions and a reason for each revision. Keyword suggestions scan titles, summaries and disciplines in the latest 400 saved sources; they do not infer agreement. Source relationships are user classifications. All content is drawn from saved records or authored by the user; no new AI or external service calls.

Shared source-coverage indicators appear in Library, source detail and topic pages. They distinguish missing text/video links, very short text, supplied text, X excerpts and PDF/other extraction, flagging text longer than the current automatic-analysis context budget. No category certifies completeness or truth.

Two additive private D1 tables retain topic snapshots and earlier revisions. Saves use revision-checked transactions to prevent stale edits overwriting another device's work. Both tables are included in the authenticated standard JSON export. Removing a reference only detaches it from the topic; it never deletes the source. There is no automatic belief adoption or regeneration of existing analyses. Limits: 100 topics, 50 sources/topic, 12 match terms/topic. Historical snapshots are read-only; restoring a position requires a new authored review. Topic export is included in backup; automatic backup import for these tables is not implemented in this release.

41 generated tests pass locally, covering authentication/origin checks, persistence, suggestion provenance, conflict rejection, source retention, coverage classification, safe rendering and draft retention. Real staging browser validation additionally exercises creation, attachment, draft redraw, revised views/confidence, history, export and reload persistence. Production promotion remains gated on successful isolated staging.


## Verified production promotion — v0.5.11 (13 November 2026 UTC)

- PR [#20](https://github.com/7dmsfwwmyd-max/Living-manifesto/pull/20) merged as `621ece4bdfdb9fd3cf907eb380369276fdfb0def`.
- [Candidate staging 43514501991](https://github.com/7dmsfwwmyd-max/Living-manifesto/actions/runs/43514501991) passed on its second attempt. The first attempt lost the staging browser session during an unchanged briefing request, before the topic tests. No gate was bypassed. The retry passed all 41 tests, topic creation/attachment, draft redraw retention, revised confidence/views, readable history, private export and reload persistence.
- The candidate's 390×844 Chromium screenshot was inspected: topic page text and controls fit the mobile viewport. This is emulation, not a test on the user's own iPhone.
- Independent [main staging 43515031401](https://github.com/7dmsfwwmyd-max/Living-manifesto/actions/runs/43515031401) passed at the exact merged SHA, including the new browser tests and existing ingestion, saved Deep Dive, evidence, learning and briefing regressions. Existing synthetic model outputs were reused where available; the topic features make no inference requests.
- [Production promotion 43515384376](https://github.com/7dmsfwwmyd-max/Living-manifesto/actions/runs/43515384376) passed exact artifact/asset hashes, original secret and D1 bindings, anonymous access denial and unchanged pre-existing stored-data fingerprints. Worker version `fd9cbd3a-7d4f-40bb-985d-73c47ab61fcc`. Public health independently confirmed v0.5.11 and the exact merge SHA. Rollback metadata remains in the workflow artifact; manual promotion trigger restored.
- New user flow: Explore → New topic → record a view/questions → attach saved sources → Review my thinking → Read previous views. The standard JSON export includes topic state and history; automated import of these tables is not yet implemented.
- No new AI calls in these features, paid providers, API keys or billing changes. Existing source/dossier data and adopted beliefs are preserved. Private production behaviour in the user's actual iPhone session remains unverified.

## v0.5.12 — Today capture repair

Separates incomplete captures from reading recommendations, derives missing display titles from saved URLs, preserves incoming share titles on retrieval failure, and adds an escaped expandable original-text reader. No stored records are rewritten or removed; unavailable upstream text is not reconstructed. Existing snooze/dismiss controls work in the Processing filter. Local validation: 44 generated Worker/frontend tests. Authenticated Chromium staging passed for the merged release `79d85d716a1e16838cc25f04cb0687a3b0d39304` in [run 43586059237](https://github.com/7dmsfwwmyd-max/Living-manifesto/actions/runs/43586059237). It checks the collapsed incomplete-capture section, usable YouTube label, exclusion from the reading agenda, and expandable original text alongside existing feature checks. Existing synthetic analysis fixtures were reused where available; this is not a fresh AI evaluation for every path. [Production promotion 43586160322](https://github.com/7dmsfwwmyd-max/Living-manifesto/actions/runs/43586160322) passed health, exact asset hashes, anonymous access denial, unchanged bindings and full pre/post data fingerprints on 2026-11-14. Authenticated browser checks ran against staging; the owner's production browser session was signed out, so no authenticated production browser claim is made.
