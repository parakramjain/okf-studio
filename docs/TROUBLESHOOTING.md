# Troubleshooting

- **Workspace Trust required:** use Manage Workspace Trust for the opened folder, then retry. Untrusted views show onboarding only.
- **Nothing indexed:** verify repository mode, UTF-8 encoding, extension, ignore rules, size cap, binary/symlink status and permissions. Source diagnostics/logs identify partial failures. Optional PDF/DOCX ingestion is not enabled in this release.
- **No evidence:** synchronize, broaden scope, use words appearing in sources, or choose a whole-document task. Folder prefixes are repository-relative. The selected-file chip continues to constrain searches until cleared.
- **No semantic search:** choose an embedding provider/model, store its credential if needed, preview and build an index. Chat availability does not imply embedding capability. Ollama must be running with an already installed embedding model.
- **Dimensions changed:** use Full reindex with the new embedding model. A failed build preserves the prior index. Rollback restores the old index metadata; select its model before querying it.
- **Provider HTTP error:** verify HTTPS endpoint/base path, model/deployment, API version, credential and quota. Requests never print provider response bodies or credentials in logs. Private service endpoints are intentionally blocked, except loopback Ollama; this release does not support private-cloud networking overrides.
- **PostgreSQL permission/TLS error:** provision pgvector or grant required extension/table privileges; use a certificate trusted by the host. Local insecure PostgreSQL connections are unsupported. Credentials belong in SecretStorage.
- **Declined egress:** offline keyword/evidence mode remains available. Change Settings or retry and explicitly allow the destination. Session consent is revoked after configuration changes or restart.
- **Source changed since preview:** synchronize and generate a fresh proposal; the extension avoids overwriting concurrent edits. Undo also refuses when approved source has changed.
- **Git import failure:** install Git in the extension host, authenticate with its credential manager and use an HTTPS URL without embedded credentials. No shell scripts, hooks or submodules are launched. Sync reads local state; use your existing Git tools to pull remote updates.
- **MCP absent:** use supported desktop VS Code (minimum 1.109), trust the workspace and enable the contributed MCP server. Inspect the OKF output channel and VS Code MCP logs. Browser-only hosts cannot run the bundled stdio process.
- **Recovered database:** a backup snapshot was loaded; synchronize to refresh recent changes. A corrupted primary and backup require rebuilding the derived index from original sources.
- **Large catalog:** sidebar source/graph/finding lists are bounded; search uses the full catalog. In-memory SQLite snapshots and projections constrain very large repositories. The benchmark file describes exactly which parts were measured.
- **Deletion and remote retention:** local deletion clears this workspace's derived state and credentials. Use Clean remote snapshots before deleting the catalog to remove tracked historical namespaces from the current backend. Active namespaces and provider backups require authenticated administrative retention/deletion controls. Do not assume local removal proves remote erasure.
- **Diagnostics overstate certainty:** call edges, coverage, contradictory statements and drift are static observations/heuristics; inspect source context. Source hashes do not prove business correctness. Model outputs and cited claims require review.
- **npm scripts fail under a restricted shell:** use the configured authorized shell/environment; dependencies can use a project-local npm cache. Do not disable security gates to force installation.

For a reproducible report include extension/editor versions, operating system, action, a minimal non-sensitive fixture and the redacted OKF output/error. Never include API keys, database connection strings or private repository content.

## New status controls in 0.4.0

- **No results with multiple repositories:** select at least one repository or reset scope. An empty set deliberately grants no evidence.
- **Vector connection Ready but index Not configured/Stale:** connectivity is not a built index. Save settings, synchronize after chunk changes, then build/rebuild.
- **Settings not applied:** finish/cancel active work, save vector settings, and resolve overlap errors. Overlap must be smaller than chunk length.
- **MCP Registered but client Not Verified:** registration is not a client session. Run Test MCP runtime in Agent Hub, then enable the server in the intended coding client.
- **Runtime test Failed:** inspect the reported startup/tool error and OKF output, check trust and the packaged `out/mcp.cjs` file. Reinstall the verified VSIX if files are missing.
- **Guide or Features hard to read in a narrow sidebar:** choose Open in editor; every page also has Tour this page.
- **Marketplace listing is not available yet:** the repository, docs and screenshots are public. The remaining account setup is tracked in pending_issue.md; public VSIX downloads are on GitHub Releases.

Use Quality & Governance > Export diagnostics for a redacted report. Inspect it before sharing; redaction cannot detect every sensitive detail. Release owner: Parakram Jain.
