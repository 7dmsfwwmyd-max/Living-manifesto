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
