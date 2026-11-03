# Publishing OKF Studio

Version 0.4.1 public preview. Owner: Parakram Jain. Repository: https://github.com/parakramjain/okf-studio (public). Publication was explicitly authorized on 2026-11-02. Publisher `ParakramJain` and the matching Trusted Publishing policy were supplied by the owner. The non-secret repository variable is configured. The workflow’s authenticated exchange verifies authorization during submission.

## One-time setup completed by Parakram

1. Open [Marketplace management](https://marketplace.visualstudio.com/manage), sign in with a Microsoft account, and select **Create publisher**. Choose a permanent ID (`parakramjain` is a suggestion if available) and display name (`Parakram Jain`). Complete the account's required fields and select **Create**. Send the exact ID to the agent; never send passwords or tokens.
2. In that publisher, open **Trusted Publishing > Create**. Use policy name `OKF Studio releases`, repository owner `parakramjain`, repository `okf-studio`, workflow `publish-marketplace.yml`, and leave **Environment** blank. Create the policy and tell the agent it is ready.

Private vulnerability reporting has also been enabled and verified for the public repository; no extra security-setting step is needed from the owner.

Microsoft documents publisher creation and [GitHub Trusted Publishing](https://code.visualstudio.com/api/working-with-extensions/publishing-extension#publish-with-github-actions-and-trusted-publishing). The installed VSCE CLI supports `--oidc`; this route does not require a PAT or a GitHub repository secret. Authentication details should remain in the account's own sign-in UI.

## Release operator checklist

- The manifest is aligned to `ParakramJain`; the previous local ID is `okf-studio-local.okf-knowledge-studio`. Disable the old extension before enabling the replacement because their commands/views have the same IDs. The new installation imports a validated catalog once for each workspace and keeps original files. Re-enter credentials because SecretStorage is bound to extension identity.
- The non-secret Actions repository variable `VSCE_PUBLISHER=ParakramJain` is configured. Future publisher changes require deliberate identity handling; this variable alone does not rewrite a VSIX.
- Commit, package, verify and publish the updated source/release; wait for **Validate and package** to pass for that exact commit.
- Trigger **Publish to Visual Studio Marketplace** on `main`, supplying the exact `package.json` version. The workflow rejects a missing/mismatched publisher, a different branch/repository, an incorrect version, and missing/pending/failed CI. It builds and inspects a VSIX, retains the artifact/checksum, and submits that archive using OIDC. It runs only on manual dispatch; pushes do not publish to Marketplace.
- Check the Marketplace listing after its processing completes. Until that check succeeds, report the release as GitHub-only, not Marketplace-published.

## If running the workflow yourself

After the agent confirms identity alignment and account setup, open [Actions](https://github.com/parakramjain/okf-studio/actions/workflows/publish-marketplace.yml), select **Run workflow**, choose `main`, and enter the current manifest version. A rejected preflight gives the missing prerequisite. An OIDC authorization failure usually means the publisher policy's owner/repository/workflow/environment does not match; fix the policy and rerun. Do not bypass the gate or supply an unverified publisher ID.

## Local verification and public release

Use Node 22, Python 3, Git, desktop VS Code and Edge. Run `npm ci`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm test`, `npm run test:ui`, `npm run test:host`, `npm audit --audit-level=moderate`, `npm run sbom`, `npm run package`, and `python scripts/inspect-package.py`. The package command uses the manifest version and rewrites README content/image URLs to the public repository; the in-extension HTML guide remains local and offline. `vsce ls --no-dependencies` lists shipped files.

Install the exact VSIX into an isolated profile, run the installed host checks with `OKF_EXTENSION_PATH`, then run `python scripts/verify-installed.py`. Attach the VSIX, checksum, inspection, verification and SBOM to a public GitHub preview release. Do not describe that release as a Marketplace listing. Keep model/vector/client/manual verification limits in [pending_issue.md](pending_issue.md).

## Service and manual checks

For each provider you intend to advertise as live-tested: configure it using native SecretStorage prompts; test embedding and vector connections; index a small non-sensitive fixture; run a scoped question and inspect cited lines; cancel a request and check failure recovery. For your coding client, enable MCP and run status/search plus a reviewed proposal. Use the chosen screen reader to traverse all six pages, scope selectors, citations, dialogs and review controls; test intended remote hosts separately. These are preview limitations until actual evidence is recorded.

## Rollback

Retain the previous verified VSIX, checksum and user profile. Install the previous version with the same extension ID if a patch regresses, and verify its catalog before normal use. A publisher-ID change is a separate installation transition, not an ordinary downgrade. Never delete source/OKF files or local knowledge to force a release. Record the affected version and workaround publicly without exposing private data.
