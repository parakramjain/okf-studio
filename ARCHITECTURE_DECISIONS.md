# Architecture decisions

## ADR-012: Explicit first-time bundle creation and reviewed updates

The user's create action authorizes writing a new bundle to a native-dialog-selected destination. Select one source repository, choose a parent directory and folder name, stage all files, then publish with overwrite disabled. Register the generated document repository separately (`bundleSourceId`) so later proposals have a validated writable root outside the original source roots. Retain the original source's write permissions; read-only sources can produce a separately authorized bundle.

An ownership marker prevents treating an unrelated existing folder as an update target. Later generations use stable source-index timestamps, skip identical output and queue changed files for review. Validate live source hashes before creating; do not recursively generate known output folders or index them twice through their parents. Failed unpublished builds remove only their own staging tree. Existing legacy proposals/bundles remain user-owned and are not migrated or deleted implicitly.

## ADR-011: Scoped, persistent views and explicit evidence channels

Keep bounded view preferences in VS Code webview state: named queries, repository/folder/record scope, source filters and navigation only. Never persist source bodies or AI answers there. Restore saved views only when all referenced repositories/records exist in the loaded catalog; never turn an unavailable explicit scope into an unrestricted query. Browsing filters affect the source list and graph, while retrieval uses the separately labeled Scope controls. Share folder normalization and scope matching between UI/domain retrieval.

Search results and assistant evidence use separate host message channels. Search request IDs let the UI discard results after scope/query changes. Assistant citations are taken from the final budgeted context pack. Native review confirmation is followed by renewed permission, target and source-hash checks; a target-level lock prevents overlapping review operations. Generated concept paths retain source extensions to avoid collisions such as `auth.ts` and `auth.md`; existing generated documents are preserved until the user reviews changes.

## ADR-010: OKF Studio branding and compatibility
The product's visible name is OKF Studio. Activity-bar, sidebar, commands, MCP display labels, output/progress titles and documentation use the new name and a connected-node/open-hexagon logo. Keep the existing extension package ID, MCP/tool IDs and provenance producer identifier to preserve installed settings, SecretStorage, knowledge lineage and local storage. New distribution filenames use `okf-studio-<version>.vsix`. SVG assets are editable source; the manifest uses a matching 256px PNG, with a monochrome SVG for the native activity bar.

## ADR-001: Local-first desktop extension
Use stable VS Code APIs, TypeScript domain modules, React/Vite webview and worker-based parsing. Use workspace.fs for source access, globalStorageUri for derived state and SecretStorage for credentials. Desktop/remote extension hosts are supported; browser-only and virtual workspaces are explicitly unsupported. Workspace Trust gates repository access and MCP registration.

## ADR-002: Canonical OKF is a format, not a database
The canonical Google OKF v0.2 SPEC.md is authoritative over assumptions in the prompt pack. Only non-empty `type` is always required. Unknown fields/types and broken links do not invalidate concepts. Trust/provenance failures are advisory diagnostics. Reserved index/log files receive their own validation. Never execute attesters or imported code.

## ADR-003: Portable SQLite and explicit embedding capability
Use sql.js SQLite with a bundled WASM asset, transactional snapshots and an inverted lexical index; avoid platform-specific native addons. BM25 works offline. Local vector storage accepts actual model vectors; no fabricated offline embeddings or semantic claims. Ollama is the supported local model runtime; no model is silently downloaded. Remote vector adapters remain derived projections with rollback; approved source remains portable Markdown.

## ADR-004: Consent is tied to destination and operation
All model/vector egress, including VS Code LM, requires explicit runtime consent. Provider secrets never enter workspace settings, webview state, logs or MCP. Retrieved content is untrusted evidence delimited as data, redacted, bounded and unable to invoke tools or write source. A proposal requires host-side review, diff and approval before writing.

## ADR-005: Honest verification
Mocks prove contracts, not cloud availability. Automated host/UI tests and package inspection are recorded separately. P2 enterprise connectors are backlog items per prompt-pack README; required P0/P1 limitations remain visible, never silently removed.

## ADR-006: Static extraction and derived projections
TypeScript/JavaScript symbols, imports, schemas and routes use the TypeScript AST. Python class/function/decorator structure uses Lezer; call-name resolution is an explicitly approximate heuristic. Source-path identities are stable until rename, after which the old projection is removed. Graph traversal is depth/result bounded. Canonical Markdown knowledge is independent of graph/vector projection storage.

## ADR-007: Index generations and controlled remote cleanup
Each vector generation incorporates repository set, provider/model and dimension. Unchanged vectors are reused without a model call; explicit full reindex refreshes them. Builds stage remote data before committing local metadata. Rollback restores index metadata and matching vectors while preserving current source chunks. Historical namespaces are tracked; deleting selected historical remote projections requires explicit host approval and invalidates local rollback snapshots. Active remote namespace/provider backups remain administrative deletion operations.

## ADR-008: Conservative networking and deletion
HTTPS requests reject redirects and validate DNS both before a request and at the transport resolver, preventing DNS rebinding to private networks. PostgreSQL pins a validated public address and uses certificate-checked TLS with the configured hostname. Loopback HTTP is reserved for explicitly configured Ollama. Private enterprise endpoints are not enabled in this release. SQLite uses secure deletion, local catalog clearing vacuums freed pages and scrubs its recovery backup; source files stay under human review.

## ADR-009: Offline packaging without an invented repository
The supplied workspace has no Git repository or upstream URL. VSCE uses `--no-rewrite-relative-links --allow-missing-repository`, retaining bundled local documentation rather than inventing a GitHub address. Runtime dependency license notices and an SBOM accompany the source/package. Development-host test output lives under `.cache`, outside packaged runtime assets.

## ADR: six destinations and verified readiness (0.4.0)

Expose user workflows in Repositories, Knowledge Explorer, AI Assistant, Vector Studio, Agent Hub and Quality & Governance. Keep installed IDs, database schema and commands compatible; migrate only local navigation preferences. Share evidence scope rather than implementing separate subtly different selectors. An empty multiple-repository set remains empty. New vector state is derived from actual source/signature/backend metadata; connection success does not imply index freshness. MCP registration, packaged runtime checks and signed-in client verification are independent facts. Feature statuses explicitly distinguish implemented, heuristic and planned behavior. Retain OKF Studio as requested by its owner, Parakram Jain.
