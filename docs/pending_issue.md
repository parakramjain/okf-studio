# Publication status and pending verification

Updated 2026-11-02 (America/Toronto). Owner: Parakram Jain. **OKF Studio 0.4.1 is published** on the [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=ParakramJain.okf-knowledge-studio) and [GitHub Releases](https://github.com/parakramjain/okf-studio/releases/tag/v0.4.1). Publisher setup and release blockers are resolved. No further publishing credentials or account setup are required for this release.

| Item | Current state | Evidence / next action | Owner |
| --- | --- | --- | --- |
| Public source repository | Resolved | https://github.com/parakramjain/okf-studio is public; anonymous access verified. | Completed |
| Public documentation, images and support | Resolved | Anonymous HTTPS checks return 200 for README, icon, three release screenshots and issue tracker. VSIX packaging rewrites relative README links to HTTPS. | Completed |
| Pending-file rename | Resolved | References and VSIX inclusion now use `docs/pending_issue.md`; the old misspelling is removed. | Completed |
| Automated platform coverage | Resolved for tested paths | [CI run 41569121733](https://github.com/parakramjain/okf-studio/actions/runs/41569121733) passed all four jobs on release commit `9b64d5e`: macOS/Ubuntu/Windows core checks and Ubuntu UI/extension-host checks. Local results: 75 unit tests, two UI integration tests, clean installation and upgrade/migration checks passed. This is not full manual platform certification. | Completed |
| Public VSIX release | Published | [v0.4.1 preview release](https://github.com/parakramjain/okf-studio/releases/tag/v0.4.1) includes the exact Marketplace-submitted VSIX, checksum, package/runtime verification, SBOM and zero-vulnerability audit. | Completed |
| Marketplace publisher | Verified | `ParakramJain` (display name Parakram Jain) successfully published through OIDC. Marketplace metadata confirms the publisher, OKF Studio and version 0.4.1. | Completed |
| Publisher/package identity | Verified | Manifest uses `ParakramJain`. Installed checks on the Marketplace archive passed: legacy catalog migration, retained workspace records, 19 commands and matching runtime files. The migration preserves originals; disable the old extension and re-enter credentials. | Completed |
| Trusted Publishing policy | Verified | Successful authenticated workflow: owner `parakramjain`, repository `okf-studio`, workflow `publish-marketplace.yml`, environment blank. | Completed |
| Marketplace workflow configuration | Configured | `.github/workflows/publish-marketplace.yml` uses OIDC; `VSCE_PUBLISHER=ParakramJain` is configured. No PAT/repository secret is required. | Completed |
| Marketplace submission | Published and verified | [Publishing run 41569561059](https://github.com/parakramjain/okf-studio/actions/runs/41569561059) succeeded on release commit `9b64d5e`. The public listing returns HTTP 200, and the Marketplace API reports version 0.4.1. | Completed |
| Live model/vector deployments | Not Verified; scope of preview disclosed | Use a non-sensitive fixture. Test each intended chat/embedding provider, build/retrieve with the chosen vector backend, and check citations/cancellation. No credentials were supplied. | Parakram or deployment tester |
| Signed-in coding agent | Not Verified | Enable OKF Studio in the intended client, run status/search, open a citation and confirm proposals require human review. Local MCP runtime is already tested. | Parakram |
| Manual accessibility and remote-host coverage | Not Verified | Check keyboard and screen-reader output, then each intended WSL/SSH/container host. Automated axe and hosted CI are not substitutes for these checks. | Parakram or tester |
| Public security reporting channel | Resolved | GitHub private vulnerability reporting is enabled and verified. Use the Security tab for sensitive reports, not public issues. | Completed |

## Steps for Parakram now

1. If installed, **disable** the old `okf-studio-local.okf-knowledge-studio` extension, then run **Developer: Reload Window**. Keep its installation and data until you verify the import.
2. Install **OKF Studio** by **ParakramJain** from the Marketplace link above. Alternatively, download the release VSIX and use **Extensions: Install from VSIX**.
3. Open the same trusted workspace and run **OKF: Open OKF Studio**. Check that your existing repositories and source records appear. Each workspace's legacy catalog imports once when the new catalog is absent; original files remain intact.
4. If you use AI or remote vector services, run **OKF: Configure Providers and Credentials** and re-enter credentials. Existing `okf.*` settings remain; credentials cannot transfer between extension identities. Offline keyword search needs no credentials.
5. Validate the integrations you actually use: test embedding/vector connections, index a small non-sensitive fixture, ask a scoped question and inspect citations. In your coding client, enable OKF's MCP tools, run status/search and confirm changes require review. Record results for the three remaining verification rows above; test screen readers and remote hosts where applicable.

The Marketplace and GitHub VSIX is 5,992,516 bytes. SHA-256: `0d356b3d1eb88f5cc0ec72fd0a06bfa632d008fb4070e6d1b0482d47c91a4bc1`.

Future release instructions are in [PUBLISHING.md](PUBLISHING.md). The remaining service/client/manual checks are disclosed preview limitations, not outstanding account setup. They do not require buying every supported service before using offline features.
