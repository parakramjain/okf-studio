# Publishing OKF Studio

Version 0.4.1 public preview is published on the [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=ParakramJain.okf-knowledge-studio) and [GitHub Releases](https://github.com/parakramjain/okf-studio/releases/tag/v0.4.1). Owner: Parakram Jain. Repository: https://github.com/parakramjain/okf-studio (public). The [Trusted Publishing workflow](https://github.com/parakramjain/okf-studio/actions/runs/41569561059) succeeded and the public listing was verified on 2026-11-02 (America/Toronto). Both channels use the same verified VSIX. No further account setup is required for this release; [installation and remaining manual checks](pending_issue.md#steps-for-parakram-now) are documented separately.

## One-time setup completed by Parakram

1. Created publisher **ParakramJain**, display name **Parakram Jain**, in [Marketplace management](https://marketplace.visualstudio.com/manage).
2. Created Trusted Publishing policy **OKF Studio releases** with repository owner `parakramjain`, repository `okf-studio`, workflow `publish-marketplace.yml`, and **Environment** blank. A successful OIDC publication verified this configuration.

Private vulnerability reporting has also been enabled and verified for the public repository; no extra security-setting step is needed from the owner.

Microsoft documents publisher creation and [GitHub Trusted Publishing](https://code.visualstudio.com/api/working-with-extensions/publishing-extension#publish-with-github-actions-and-trusted-publishing). The installed VSCE CLI supports `--oidc`; this route does not require a PAT or a GitHub repository secret. Authentication details should remain in the account's own sign-in UI.

## Future release operator checklist

- The manifest is aligned to `ParakramJain`; the previous local ID is `okf-studio-local.okf-knowledge-studio`. Disable the old extension before enabling the replacement because their commands/views have the same IDs. The new installation imports a validated catalog once for each workspace and keeps original files. Re-enter credentials because SecretStorage is bound to extension identity.
- The non-secret Actions repository variable `VSCE_PUBLISHER=ParakramJain` is configured. Future publisher changes require deliberate identity handling; this variable alone does not rewrite a VSIX.
- Increment the manifest/lockfile and runtime version references for a new release; published version 0.4.1 cannot be overwritten. Update release notes, commit and push, then wait for **Validate and package** to pass for that exact commit.
- Trigger **Publish to Visual Studio Marketplace** on `main`, supplying the exact `package.json` version. The workflow rejects a missing/mismatched publisher, a different branch/repository, an incorrect version, and missing/pending/failed CI. It builds and inspects a VSIX, retains the artifact/checksum, and submits that archive using OIDC. It runs only on manual dispatch; pushes do not publish to Marketplace.
- Check the Marketplace listing after its processing completes. Until that check succeeds, report the release as GitHub-only, not Marketplace-published.
- Download the workflow's `marketplace-<version>` artifact and verify/install that exact archive. Publish the matching GitHub release with the same VSIX, SHA-256 checksum, inspection, installed-runtime verification, SBOM and audit reports. Keep the release tag on the verified source commit; subsequent documentation-only status updates may follow on `main`.

## If running the workflow yourself

For a new, unpublished version whose exact commit has passed CI, open [Actions](https://github.com/parakramjain/okf-studio/actions/workflows/publish-marketplace.yml), select **Run workflow**, choose `main`, and enter the current manifest version. A rejected preflight gives the missing prerequisite. An OIDC authorization failure usually means the publisher policy's owner/repository/workflow/environment does not match; fix the policy and rerun. Do not bypass the gate or supply an unverified publisher ID. Do not rerun publication of 0.4.1.

## Local verification and public release

Use Node 22, Python 3, Git, desktop VS Code and Edge. Run `npm ci`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm test`, `npm run test:ui`, `npm run test:host`, `npm audit --audit-level=moderate`, `npm run sbom`, `npm run package`, and `python scripts/inspect-package.py`. The package command uses the manifest version and rewrites README content/image URLs to the public repository; the in-extension HTML guide remains local and offline. `vsce ls --no-dependencies` lists shipped files.

Install the exact VSIX into an isolated profile, run the installed host checks with `OKF_EXTENSION_PATH`, then run `python scripts/verify-installed.py`. Attach the VSIX, checksum, inspection, verification and SBOM to a public GitHub preview release. Do not describe that release as a Marketplace listing. Keep model/vector/client/manual verification limits in [pending_issue.md](pending_issue.md).

## Service and manual checks

For each provider you intend to advertise as live-tested: configure it using native SecretStorage prompts; test embedding and vector connections; index a small non-sensitive fixture; run a scoped question and inspect cited lines; cancel a request and check failure recovery. For your coding client, enable MCP and run status/search plus a reviewed proposal. Use the chosen screen reader to traverse all six pages, scope selectors, citations, dialogs and review controls; test intended remote hosts separately. These are preview limitations until actual evidence is recorded.

## Rollback

Retain the previous verified VSIX, checksum and user profile. Install the previous version with the same extension ID if a patch regresses, and verify its catalog before normal use. A publisher-ID change is a separate installation transition, not an ordinary downgrade. Never delete source/OKF files or local knowledge to force a release. Record the affected version and workaround publicly without exposing private data.
