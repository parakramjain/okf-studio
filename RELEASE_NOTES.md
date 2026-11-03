# OKF Studio 0.4.1 — public preview

Turn code and documents into trusted knowledge that AI agents can use.

Author, developer and owner: Parakram Jain.

This patch prepares public distribution of the six-section OKF Studio extension. It fixes the renamed `docs/pending_issue.md` links and package inclusion, removes obsolete private-repository wording, rewrites packaged README links/images to public HTTPS URLs, and adds a manually triggered Marketplace Trusted Publishing workflow with publisher/version/branch/CI checks.

Install the attached `okf-studio-0.4.1.vsix` with **Extensions > Install from VSIX**, or use the [Marketplace listing](https://marketplace.visualstudio.com/items?itemName=ParakramJain.okf-knowledge-studio) once its publication workflow completes. GitHub source and downloads are public. This release is a Preview. The owner has authorized publication and supplied publisher `ParakramJain` plus its Trusted Publishing policy. Publication verification is recorded in `docs/pending_issue.md`.

The public identity is `ParakramJain.okf-knowledge-studio`. Disable the old `okf-studio-local` extension and reload before enabling this release. The new installation validates and copies the current workspace’s legacy catalog once, preserving original catalog and source/OKF files. Existing public catalogs are never replaced by this migration. Provider credentials must be re-entered; `okf.*` settings are retained. Keep the old installation/profile until you confirm the imported catalog.

Retained features: document/code/hybrid repositories; first-create location picker; full file tree; bounded, cited AI scope; Vector Studio; Agent Hub with nine MCP tools and runtime checks; review/approval/undo, traceability, diagnostics; searchable features, tours and offline guide. Live model/vector accounts, signed-in agent clients, manual screen readers and remote-host behavior remain Not Verified. No production-integration certification is implied.
