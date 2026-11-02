# Publishing OKF Studio

Version 0.4.0. Release owner: Parakram Jain. Source repository: https://github.com/parakramjain/okf-studio (private; authentication required). Source publication is authorized. Marketplace publication is not part of the current task.

## Identity and metadata

Display name: OKF Studio. Tagline: Turn code and documents into trusted knowledge that AI agents can use. Author/developer/owner: Parakram Jain. The technical name remains `okf-knowledge-studio` and publisher remains `okf-studio-local` to preserve the local extension identity. Do not invent a verified publisher or silently change installed IDs. A real publisher migration requires an explicit continuity plan for extension storage, settings and secrets.

The manifest uses valid Machine Learning, Visualization and Other categories, a raster icon, benefit-oriented description, keywords, genuine repository/homepage/issue URLs and 19 contributed commands. The private URLs work for collaborators; they are not anonymous Marketplace support or image hosting. Current screenshots are real local VS Code extension captures. Public image/docs/support hosting remains a release blocker.

## Reproducible local release

1. Use Node 22, Python 3, Git, desktop VS Code and Edge for UI tests. Run `npm ci` using the lockfile.
2. Run `npm run typecheck`, `npm run lint`, `npm run build`, `npm test`, `npm run test:ui` and `npm run test:host`. The build creates bundled extension/worker/MCP code, WASM, webview assets and third-party notices.
3. Run `npm audit --audit-level=moderate`, `npm run benchmark`, `npm run sbom`, and `npm run package`. Inspect `npx vsce ls --no-dependencies` and run `python scripts/inspect-package.py`.
4. Install the exact `dist/okf-studio-0.4.0.vsix` into an isolated profile. Run host tests with `OKF_EXTENSION_PATH` pointing to the installed extension. Run `python scripts/verify-installed.py`; verify installed bytes, manifest contributions, host log and audit result.
5. Capture actual extension screens; UI fixture screenshots alone do not establish a running product. Record SHA-256, file size, test results, platform, limitations and pending external checks in IMPLEMENTATION_STATUS and the requirement matrix.
6. For upgrades retain the extension ID and inspect saved navigation migration, storage compatibility, file associations, command registration and activation. Do not claim live-provider or cross-platform tests from mocks.

## Marketplace gate

Resolve every applicable item in [pendinissue.md](pendinissue.md): verified publisher/account ownership, publicly reachable documentation/images/support, verified metadata, legal ownership/notices, live service/platform claims and reviewed final artifact. Consult the official [manifest reference](https://code.visualstudio.com/api/references/extension-manifest) and [publishing guide](https://code.visualstudio.com/api/working-with-extensions/publishing-extension) for current publisher authentication and submission requirements.

Only after the owner approves the concrete final package for Marketplace publication should the release operator authenticate the verified publisher and publish. Never store Marketplace/GitHub tokens in source, screenshots, docs, logs or the VSIX. Packaging and private source push do not publish to Marketplace.

## Rollback and support

Keep the prior verified VSIX and checksum. If a release regresses, stop distributing it, install the previous VSIX with the same extension ID into a backed-up profile, and verify activation/storage before returning to normal use. Never delete user knowledge to force an upgrade. Avoid automatically downgrading databases across future schema changes. Record affected version, reproduction and workaround in release notes. Marketplace version withdrawal or replacement must follow the verified publisher's current controls and explicit owner approval.
