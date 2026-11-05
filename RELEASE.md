# Living Manifesto release procedure

## Source of truth

`deploy.mjs` reconstructs the historical application and applies `understand-patch.mjs` and `integrated-learning-patch.mjs`. Root app.js and _worker.js are historical copies, not the release. Always deploy the tested dist directory. Never upload the repository root as the application.

Run `node scripts/build.mjs` with Node 22 or later. This cleans dist, generates the complete app, checks syntax, checks route/UI invariants, runs the generated Worker with an in-memory SQLite D1 adapter, executes the complete frontend in a simulated DOM, and records version, Git commit and file hashes in release.json. AI, X and PDF converter responses in these local tests are controlled fixtures, not proof of live external services. GitHub runs this on every PR and main/stabilise push. Artifact names contain version and commit.

## Staging gate — required before production

1. Inspect Cloudflare production deployment and record its version ID, routes, secrets names, bindings, build command and last healthy commit. Preserve the known working v0.4.8 deployment.
2. Create/use a separate staging Worker and separate staging D1 database. NEVER bind staging to production database `39259550-5d35-4d51-aaee-f203d33af1c9`. Staging must use separate APP_PASSWORD, SESSION_SECRET and SHORTCUT_TOKEN secrets. Retain the CONVERTER AI binding and ASSETS static binding. Do not copy production personal data into staging.
3. Build once, save the artifact and its digest. Deploy those exact dist bytes to staging with a staging-specific Wrangler configuration. Do not let a deployment command regenerate a different build. Configure Cloudflare build to `node scripts/build.mjs` when using Git builds; disable production auto-deployment until staging promotion is established.
4. Run `APP_URL=https://verified-staging-route EXPECTED_SHA=<commit> APP_PASSWORD=<secret> node scripts/healthcheck.mjs`. Supply secrets through CI secrets/environment, never command history or public logs.
5. In the staging browser: sign in; save a test article; capture an accessible public X post and X Article; import a selectable-text PDF via the current supported workflow and retrieve a PDF URL; verify text is actually stored; generate a real Deep Dive; reload, sign out/in and reopen the same dossier. Verify all sections, no regeneration on reopen, and exported dossier content. Record exact URLs, expected extraction coverage, timestamps and outcomes. Review Worker errors. Simulated tests cannot replace these checks.
6. Stop on any failure. Do not promote merely because a packaging workflow is green.

## Production promotion and verification

Take a private D1 export or confirm a usable Time Travel restore point before promotion; do not place backups in GitHub artifacts or this public repository. Record source and belief counts. Deploy the exact tested release to the existing living-manifesto-app Worker, retaining production DB, secrets, routes and bindings. Never delete/recreate the production D1 database. The new learning_dossiers table is additive and old releases can ignore it.

Run scripts/healthcheck.mjs against the verified production URL with the expected commit and an existing authorised password. This reads existing articles/dossiers and does not create or delete sources. Check the actual browser login, saved articles, version/hash, X/PDF ingestion and a generated-and-reopened dossier. Inspect Cloudflare errors. Report precise tests and limitations; do not declare completion before these live checks pass.

## Rollback

If production checks fail, select the recorded last healthy deployment in Cloudflare deployment history and roll the Worker back to that version. Preserve its asset bundle and configuration. Do not restore, delete or recreate D1 for a code regression: rolling back code must retain existing sources and new dossiers. Confirm the prior health version, login and saved articles afterwards. Database restoration is a separate incident decision, never an automatic release rollback. Retain deployment IDs, commit hashes, artifact hashes and verification evidence in a private operational record.

## Current verification boundary

Local generated-app tests are automated. Cloudflare access, staging configuration, real AI/X/PDF calls, production deployment and live verification are still required. The health-check script is implemented but must be wired to the verified environments after account access. Do not interpret this document as confirmation that staging or production has been configured.
