# Pending publication issues

Updated 2026-11-02 (America/Toronto). Owner: Parakram Jain. Publication is explicitly authorized. Publisher and Trusted Publishing setup are complete; final CI, submission and public-listing verification are tracked below.

| Item | Current state | Evidence / next action | Owner |
| --- | --- | --- | --- |
| Public source repository | Resolved | https://github.com/parakramjain/okf-studio is public; anonymous access verified. | Completed |
| Public documentation, images and support | Resolved | Anonymous HTTPS checks return 200 for README, icon, three release screenshots and issue tracker. VSIX packaging rewrites relative README links to HTTPS. | Completed |
| Pending-file rename | Resolved | References and VSIX inclusion now use `docs/pending_issue.md`; the old misspelling is removed. | Completed |
| Automated platform coverage | Resolved for tested paths | CI run 41388060543 passed macOS/Ubuntu/Windows core checks and Ubuntu UI/extension-host checks. Local Windows install/upgrade/MCP checks also pass. This is not full manual platform certification. | Completed |
| Public VSIX release | Prepared | Version 0.4.1 is a GitHub preview release. See [Releases](https://github.com/parakramjain/okf-studio/releases). A GitHub release is separate from a Marketplace listing. | Agent |
| Marketplace publisher | Supplied | Owner created publisher `ParakramJain` (display name Parakram Jain). Marketplace authorization is checked by the publishing workflow. | Completed by Parakram |
| Publisher/package identity | Implemented | Manifest uses `ParakramJain`. Host/package checks derive the ID dynamically. Validated one-time legacy catalog import preserves old files; disable the old extension and re-enter credentials. | Agent |
| Trusted Publishing policy | Created | Owner confirmed policy creation: owner `parakramjain`, repository `okf-studio`, workflow `publish-marketplace.yml`, environment blank. | Completed by Parakram |
| Marketplace workflow configuration | Configured | `.github/workflows/publish-marketplace.yml` uses OIDC; `VSCE_PUBLISHER=ParakramJain` is configured. No PAT/repository secret is required. | Completed |
| Marketplace submission | Ready for verified workflow | Account setup and authorization are supplied. Run after exact-commit CI and installed-package migration checks pass; confirm the public listing afterward. | Agent |
| Live model/vector deployments | Not Verified; scope of preview disclosed | Use a non-sensitive fixture. Test each intended chat/embedding provider, build/retrieve with the chosen vector backend, and check citations/cancellation. No credentials were supplied. | Parakram or deployment tester |
| Signed-in coding agent | Not Verified | Enable OKF Studio in the intended client, run status/search, open a citation and confirm proposals require human review. Local MCP runtime is already tested. | Parakram |
| Manual accessibility and remote-host coverage | Not Verified | Check keyboard and screen-reader output, then each intended WSL/SSH/container host. Automated axe and hosted CI are not substitutes for these checks. | Parakram or tester |
| Public security reporting channel | Resolved | GitHub private vulnerability reporting is enabled and verified. Use the Security tab for sensitive reports, not public issues. | Completed |

Exact publisher setup and subsequent workflow steps are in [PUBLISHING.md](PUBLISHING.md). Optional service/manual checks remain visible limitations of the public preview; they are not falsely marked complete and do not require buying every supported service before distributing offline features.
