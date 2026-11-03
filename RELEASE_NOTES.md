# OKF Studio 0.4.1 — public preview

Turn code and documents into trusted knowledge that AI agents can use.

Author, developer and owner: Parakram Jain.

This patch publishes the six-section OKF Studio extension. It fixes the renamed `docs/pending_issue.md` links and package inclusion, removes obsolete private-repository wording, rewrites packaged README links/images to public HTTPS URLs, and adds a manually triggered Marketplace Trusted Publishing workflow with publisher/version/branch/CI checks.

Install from the [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=ParakramJain.okf-knowledge-studio), or install the attached `okf-studio-0.4.1.vsix` with **Extensions > Install from VSIX**. Version 0.4.1 is published as a public preview under publisher `ParakramJain`. The attached VSIX is the exact archive submitted by the successful [Trusted Publishing workflow](https://github.com/parakramjain/okf-studio/actions/runs/41569561059). Publication verification is recorded in `docs/pending_issue.md`.

The public identity is `ParakramJain.okf-knowledge-studio`. Disable the old `okf-studio-local` extension and reload before enabling this release. The new installation validates and copies the current workspace’s legacy catalog once, preserving original catalog and source/OKF files. Existing public catalogs are never replaced by this migration. Provider credentials must be re-entered; `okf.*` settings are retained. Keep the old installation/profile until you confirm the imported catalog.

Retained features: document/code/hybrid repositories; first-create location picker; full file tree; bounded, cited AI scope; Vector Studio; Agent Hub with nine MCP tools and runtime checks; review/approval/undo, traceability, diagnostics; searchable features, tours and offline guide. Live model/vector accounts, signed-in agent clients, manual screen readers and remote-host behavior remain Not Verified. No production-integration certification is implied.

Validation: all four CI jobs passed for release commit `9b64d5e0c0525ee225ec0459191f4ac3915e7125`; 75 unit tests and two UI integration tests passed. The exact Marketplace archive passed installed Windows host checks, catalog migration/upgrade checks, runtime-file verification and a zero-vulnerability dependency audit. Its SHA-256 is `0d356b3d1eb88f5cc0ec72fd0a06bfa632d008fb4070e6d1b0482d47c91a4bc1`.
