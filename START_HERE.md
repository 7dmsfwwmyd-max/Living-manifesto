# Start here: make Living Manifesto an iPhone app

## 1. Create the GitHub repository (one account, already used for Market Atlas)

Open https://github.com/new while signed into the same account.

- Repository name: `living-manifesto`
- Visibility: **Public** for free GitHub Pages. This publishes *application code*, not your personal content. Do not upload any saved sources or backups.
- Check **Add a README file** to initialize `main`.
- Press **Create repository**.

Once the new repository exists, return to ChatGPT and say `living-manifesto repository created`. The connected GitHub integration can then be used to push these files, without asking you to manually edit source code.

Alternatively, from a laptop with Git installed and GitHub authenticated, copy the files from this archive into your new repository and push to `main`.

## 2. Enable deployment

In that new repository open Settings → Pages → under Build and deployment choose **GitHub Actions**. After the included `.github/workflows/pages.yml` is committed, the Actions tab should show the deployment. Use its *actual* `pages` URL once successful.

## 3. Put the app on your iPhone Home Screen

Open the deployed URL in Safari → Share → Add to Home Screen → ensure **Open as Web App** is enabled → Add. You get a dedicated **M.** icon and standalone app window.

## 4. Capture and back up

In the Home Screen app use + to save links, thoughts and documents. Use Library → Import iCloud files to import `.md` documents from the earlier Save Link to Manifesto Shortcut. Save exported backups to iCloud Drive frequently. The app does **not** automatically monitor iCloud.

## Status

This package is **built and smoke-tested**, but not yet deployed. A new GitHub repository is required, and iPhone device testing remains outstanding. AI is not connected; the app prepares source-grounded context for the ChatGPT project rather than generating answers itself.
