# Developer guide

## Structure and contracts

`src/governance/bundle.ts` implements deterministic planning and create-versus-update behavior. `src/host/bundle-files.ts` publishes new folders through staging plus `workspace.fs.rename(..., { overwrite: false })`. A native-dialog-selected destination is registered as a document repository with `bundleSourceId`; later updates use the existing review guards at that root. `.okf-studio.json` identifies the source repository, and `bundleDestination:<sourceId>` remembers the location. Generation uses source indexing timestamps to avoid needless diffs. `IngestOptions.excludedRoots` keeps registered output trees out of parent-source indexing. The original source repository's write permission is unchanged.

The 0.4 UI separates the React entry point (`webview/main.tsx`), application views (`App.tsx`), shared icons/components (`components.tsx`) and tested view selectors/preferences (`model.ts`). `src/domain/scope.ts` is browser-safe and shared with retrieval. Preferences are validated and capped before restoration; no bodies, questions or answers are persisted. Host search responses carry a request ID and `search` channel; assistant evidence uses the `answer` channel and only the final context pack's documents. Per-root sync summaries live under `sync:<repoId>:<root>` metadata keys. No schema migration is required.

Review operations lock the target path and repeat target/source/permission checks after human confirmation. Generated concept paths retain the source extension to prevent filename collisions. Older generated files remain user-owned; regeneration queues new paths for review. A vector build that commits in memory but fails to flush retains its remote namespace so that in-memory references remain valid and a later persistence retry can succeed.

`src/extension.ts` adapts supported VS Code APIs, commands, trust, configuration, SecretStorage, review dialogs, diagnostics and webview transport. `webview/` is React/Vite with native theme tokens and text-only rendering. `src/domain/` defines versioned contracts and Zod messages. `src/ingestion/` handles worker parsing, incremental enumeration, OKF and heading/symbol-aware chunks. `src/persistence/` owns SQLite transactions, inverted terms, atomic snapshot writes and recovery. `src/graph/`, `src/retrieval/`, `src/providers/`, `src/assistant/`, `src/governance/`, and `src/mcp/` separate projections, egress, assistance, review and agent transports.

Store schema version 1 uses SQL.js WASM, avoiding native platform binaries. Source records retain root/path identities, original content hash, line spans and optional Git commit. A symbol ID depends on file identity, symbol kind/name and duplicate ordinal. Moving/renaming a file invalidates its old projection; Sync removes/recreates it. Call resolution is conservative and ambiguity is not promoted to certainty. Python function/class structure uses Lezer; Python call-name extraction is approximate. TypeScript/JavaScript symbols/imports/routes use TypeScript AST.

An indexing worker processes one file at a time, providing backpressure and keeping AST parsing off the host. Jobs persist start/interrupted/completed states and flush about every five seconds plus on completion/cancellation. Resume re-enumerates and hashes files; it does not trust stale offsets. File-level failures are isolated; failed directory enumeration suppresses deletion of prior records. Source access uses workspace.fs, with filesystem realpath and symlink guards for local paths. Browser/virtual workspace execution is unsupported. Remote/WSL require a filesystem-backed Node extension host; Git cloning requires its Git executable. Cross-platform execution is delegated to CI and is not implied by Windows results.

## Provider and retrieval boundaries

EmbeddingProvider and VectorAdapter are independent of portable source. SafeHTTP validates destinations, blocks private/metadata addresses except explicit loopback Ollama, disallows redirects, pins connection DNS checks, requires consent, propagates cancellation/timeouts and retries 429/5xx twice with backoff. Model credentials enter host-side headers only. Token estimates are heuristic. Embedding output count/dimensions/finiteness/zero vectors are validated.

Vector builds stage new namespaces incorporating repository set, provider/model and dimension; unchanged vectors can be reused. Local commit swaps metadata/chunks transactionally and retains snapshots. Failed staging cleans its new remote namespace best-effort. Old committed remote namespaces are retained for rollback; remote cleanup/retention must be managed explicitly by the operator. Local SQLite vectors remain a recovery projection. BM25 works independently of models. Hybrid ranking combines reciprocal lexical/vector ranks and a small confidence-weighted graph-neighbor bonus, always filtered to requested scope.

The assistant's context builder quotes retrieved text as JSON data, includes source citations and caps estimated input. No tool execution or source writing is available to models. Output redaction buffers complete lines to avoid leaking credentials split across streaming chunks. A model's citation correctness is not automatically guaranteed: source evidence remains visible for review.

## MCP and permissions

Stable `registerMcpServerDefinitionProvider` registration launches the bundled SDK stdio server using the editor's Node runtime. An ephemeral bearer-authenticated loopback bridge delegates bounded tools to current host state. No separate mutable database process exists. The bridge rejects cross-origin/unauthenticated requests. Tools carry readOnly/destructive/idempotent/openWorld annotations and Zod schemas. Mutation only queues a proposal after a human prompt; writing requires a second reviewed approval. Existing custom agents are never overwritten.

Other extensions can call the exported `status()`, `sync()` and `indexWorkspace('document'|'code'|'hybrid')` API. The indexing API is confined to current trusted workspace roots. It does not authorize source mutation or external egress.

## Build and test

Use Node 22 and the lockfile (`npm ci`). `npm run build` bundles extension, parser worker and MCP, copies SQLite WASM and builds the React view. `npm test` includes real SDK stdio integration against the built MCP server, so build first. `npm run typecheck` and `npm run lint` are separate release gates. `npm run test:ui` uses Edge, tests dispatch and responsive controls, and runs axe. `npm run test:host` launches an isolated VS Code profile and verifies actual activation/modes/registration/webview readiness. Set `OKF_CODE_EXECUTABLE` to choose a local editor executable.

`npm run benchmark` writes measured 1k/10k/100k synthetic parse/chunk/graph/search data; exclusions are embedded in the JSON. `npm audit`, `npm run sbom`, `npm run package` and package inspection complete release checks. `.github/workflows/ci.yml` validates three operating systems and uploads artifacts without publishing. CI status must be checked independently; local configuration is not proof of a successful remote CI run.

To add a parser, implement deterministic extraction without executing source and supply provenance/line tests. To add a model/backend, implement the interfaces, consent/cancellation and isolated request contracts. To add UI messages, update the Zod protocol and host dispatcher together. Extend schema versions through explicit migrations and preservation tests. See ARCHITECTURE_DECISIONS.md for assumptions and trade-offs.

## 0.4.0 development review architecture

`webview/ScopeControls.tsx` shares document/folder/single-or-multiple-repository scope across Explorer, AI, Vector and Agent workflows. `workspaceScope` preserves empty selected repository sets. Preferences edition 4 migrates old tab names and retains existing saved views. `VectorStudio`, `AgentHub`, `Catalog` and `Traceability` split the new surfaces; `src/domain/features.json` is the in-app/catalog source. The editor panel and sidebar use the same CSP and host transport.

`src/domain/readiness.ts` derives vector state from source chunks, provider/model signature, backend and active/error state. `src/providers/diagnostics.ts` validates synthetic embedding probes and read-only adapter checks. Pgvector probing does not initialize schema. `src/mcp/smoke.ts` uses the SDK client to launch the actual packaged stdio server and perform discovery plus authenticated status. No provider credential is added to webview state.

Run `python scripts/build-guide.py` after editing USER_GUIDE.md to regenerate the offline HTML guide. Its renderer deliberately supports the limited heading/paragraph/list/table/code/link syntax used by the guide and escapes raw text. `OKF_DEBUG_PORT` and `OKF_CAPTURE_GATE` enable an isolated host capture run; the gate is a local sentinel created only after screenshot validation. Normal host tests do not wait for it. Release ownership: Parakram Jain. See PUBLISHING.md for exact artifact checks.

## Publisher identity transition (0.4.1)

The public publisher is ParakramJain. `src/persistence/migrate.ts` validates the legacy primary/backup before writing a new catalog; it never overwrites an existing public catalog or changes legacy bytes. `src/extension.ts` resolves the old sibling globalStorage location for the same workspace hash. Disable the legacy extension first to prevent duplicate commands/views. SecretStorage remains bound to the original extension ID; credentials are deliberately not copied. Unit and installed-host checks cover preservation, corrupt-primary backup recovery, invalid-data refusal and missing catalogs.
