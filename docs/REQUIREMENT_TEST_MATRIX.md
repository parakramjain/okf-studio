# Requirement to verification matrix

## 0.4.0 development review

Release owner: Parakram Jain. Status describes implementation, not external-service certification. Exact commands and package evidence are in [IMPLEMENTATION_STATUS](../IMPLEMENTATION_STATUS.md).

| Capability | State | Evidence / limits |
| --- | --- | --- |
| Repositories: Import documents, code, or both | Implemented | ingestion/bundle/workflow tests; actual host imports all three modes, publishes a new bundle and preserves collisions/cancellation; Git status/history host smoke |
| Repositories: Create OKF where you choose | Implemented | ingestion/bundle/workflow tests; actual host imports all three modes, publishes a new bundle and preserves collisions/cancellation; Git status/history host smoke |
| Repositories: Keep the catalog current | Implemented | ingestion/bundle/workflow tests; actual host imports all three modes, publishes a new bundle and preserves collisions/cancellation; Git status/history host smoke |
| Repositories: Use native Git workflows | Implemented | ingestion/bundle/workflow tests; actual host imports all three modes, publishes a new bundle and preserves collisions/cancellation; Git status/history host smoke |
| Knowledge Explorer: Browse every file | Implemented | studio-review/graph-retrieval tests; actual host filesystem pagination and guards; browser scope/graph checks and real Explorer capture |
| Knowledge Explorer: Search and inspect evidence | Implemented | studio-review/graph-retrieval tests; actual host filesystem pagination and guards; browser scope/graph checks and real Explorer capture |
| Knowledge Explorer: Trace relationships and impact | Partial (heuristic) | studio-review/graph-retrieval tests; actual host filesystem pagination and guards; browser scope/graph checks and real Explorer capture |
| AI Assistant: Ask one document or a chosen scope | Implemented | graph-retrieval/workflow/hardening tests; Edge scoped dispatch/citations; focused multi-repository/single-document UI checks; bounded context evaluation |
| AI Assistant: Preview relevant context | Implemented | graph-retrieval/workflow/hardening tests; Edge scoped dispatch/citations; focused multi-repository/single-document UI checks; bounded context evaluation |
| AI Assistant: Choose independent chat models | Implemented | graph-retrieval/workflow/hardening tests; Edge scoped dispatch/citations; focused multi-repository/single-document UI checks; bounded context evaluation |
| Vector Studio: Configure and test embeddings | Implemented | providers-review/development-review tests; real local storage probe and keyword playground; live model/remote storage remains Not Verified |
| Vector Studio: Choose vector storage | Implemented | providers-review/development-review tests; real local storage probe and keyword playground; live model/remote storage remains Not Verified |
| Vector Studio: Build and evaluate retrieval | Implemented | providers-review/development-review tests; real local storage probe and keyword playground; live model/remote storage remains Not Verified |
| Agent Hub: Connect agents through MCP | Implemented | mcp.test.ts invokes all nine tools over SDK stdio; real extension runtime handshake/discovery/authenticated status, pack preview and tool playground |
| Agent Hub: Prepare portable context | Implemented | mcp.test.ts invokes all nine tools over SDK stdio; real extension runtime handshake/discovery/authenticated status, pack preview and tool playground |
| Agent Hub: Install an optional knowledge agent | Implemented | mcp.test.ts invokes all nine tools over SDK stdio; real extension runtime handshake/discovery/authenticated status, pack preview and tool playground |
| Quality & Governance: Find knowledge risks | Partial (heuristic) | foundation/graph-retrieval/providers-review/bundle tests; batch review guards; actual findings page; heuristic results are not runtime proof |
| Quality & Governance: Review changes safely | Implemented | foundation/graph-retrieval/providers-review/bundle tests; batch review guards; actual findings page; heuristic results are not runtime proof |
| Quality & Governance: Export diagnostics and manage local data | Implemented | foundation/graph-retrieval/providers-review/bundle tests; batch review guards; actual findings page; heuristic results are not runtime proof |
| Quality & Governance: PR-based team review | Missing (Planned) | Backlog only; no availability claim |
| Repositories: PDF/DOCX and enterprise connectors | Missing (Planned) | Backlog only; no availability claim |
| Vector Studio: Shared indexes, RBAC, and managed plans | Missing (Planned) | Backlog only; no availability claim |

| External / release check | State | Evidence / next step |
| --- | --- | --- |
| Saved navigation upgrade | Implemented | Edition-3 aliases migrate to edition 4; old scopes/saved views retained; regression test |
| Full editor and narrow UI | Implemented | Actual editor captures; 24 axe checks (six sections, two themes, two widths); forced-colors overflow check |
| Guide parity/search | Implemented | HTML generated from Markdown; guide search, no-match, clear and axe/overflow checks |
| Live chat/embedding/vector services | Not Verified | Provider request/response contracts tested; user deployments/account availability not supplied |
| Signed-in Copilot/custom client | Not Verified | Actual MCP runtime passes; client authentication/configuration is a separate check |
| Manual screen reader and remote hosts | Not Verified | Semantic keyboard/axe checks do not replace manual assistive-technology testing |
| Marketplace publisher/public links | Missing | Real private GitHub URL available; verified publisher and anonymous public support/images pending |
| VSIX clean install and upgrade | Implemented / verified on Windows | Both installed host runs pass; upgrade retains existing repositories/records before sync; runtime/manifest byte verification and zero-vulnerability audit pass |
| Private source repository | Implemented | Verified `parakramjain/okf-studio` exists with private visibility; GitHub records published commits. Marketplace publication is separate and pending. |

## Earlier release coverage


## 0.2.1 creation workflow

`tests/bundle.test.ts` covers immediate first creation, selected-repository isolation, read-only source support, stable no-op generations, reviewed updates, existing-folder/foreign-bundle preservation, cancellation/failure, pending review guards, recursion exclusion and link encoding. `tests/studio-review.test.ts` checks separate output-root indexing. The Edge suite checks **Proceed to Create OKF** dispatches the intended repository ID. The actual VS Code host suite tests staged publication on disk, overwrite refusal, cancelled-build cleanup and folder-name validation.

The native parent-folder/name dialogs are implemented in the host command; OS picker interaction is not automated. Bundle files generated during acceptance checks stay inside the isolated test extension's `.cache/` directory.

## 0.2 review additions

| Area | Verification |
| --- | --- |
| Saved views, normalized scope, source filtering and scoped graphs | `tests/studio-review.test.ts`; browser saved-view restore/recreation checks with synthetic catalog |
| Nested ignore rules, refreshed commit provenance and re-chunk retry | `tests/studio-review.test.ts` regression cases |
| Approval-time edits, target locks, generated filename collisions, vector persistence failure | `tests/providers-review.test.ts` regression cases |
| Pagination, stale responses, search/answer evidence isolation | Playwright CLI flow checks under `output/playwright/` using explicit host-message fixtures |
| Theme/accessibility/responsiveness | All six destinations × light/dark × 320/1280px: axe WCAG A/AA and no viewport overflow; forced-colors screenshot check |

The CLI fixtures test UI behavior, not live provider responses. The existing Edge suite, real SDK stdio contracts and installed VS Code host smoke remain separate release gates.

## Original feature coverage

| Prompt | Concrete implementation | Verification |
| --- | --- | --- |
| 00–01 discovery/product | Supplied prompts preserved; PRODUCT.md, status and ADRs | Complete source inspection and evidence log |
| 02 contracts/storage | Zod protocol; SQLite repository/record/chunk/terms/review/audit/snapshots; version check; atomic writes/backup | foundation and hardening suites; actual host activation |
| 03 native UX | React/Vite six destinations, scope, graph/outline/preview, loading/cancel/errors, native editor/diffs, themes | 2 Edge Playwright tests, axe WCAG A/AA, 320px layout; real host ready handshake |
| 04 ingestion | Filesystem/Git import, multiple roots/modes, ignore/symlink/path/size/binary safety, TS/JS/Python parsing, watchers/checkpoints | ingestion mode/AST/ignore/cancel/delete tests; multi-root regression; three real host modes |
| 05 canonical OKF | Parser, comment/unknown-key preservation, minimal/unknown types, index/log, trust, links, provenance generation | conformance and generation tests against canonical v0.2 conventions |
| 06 graph/traceability | Typed nodes/edges, resolved/approximate, calls/imports/tests/requirements, BFS impact, static coverage | graph cyclic/rename/trace tests; UI graph actions; MCP dependencies/impact/trace invocations |
| 07 retrieval/providers | BM25/vector/hybrid/graph scope; true remote embedding contracts; local/Qdrant/pgvector; dimension check, reuse/reindex/rollback | ranking/scope/dimension tests; provider HTTP/SQL contract tests; rollback/source preservation/reuse regressions |
| 08 assistant | Scoped tasks, bounded JSON evidence, source citations, uncertainty rules, streaming redaction/cancel, LM and configured providers | context/injection/PII/budget tests; streaming network-boundary test; UI scoped dispatch; cloud generation unverified |
| 09 MCP/agents | Nine SDK stdio tools, annotations/schemas, authenticated trusted host bridge, catalog resource/prompt, additive agent | actual SDK Client invokes all nine tools, prompts/resources, rejects unauthenticated bridge; host provider registration |
| 10 human docs | Native Markdown editor/compare, outline/frontmatter/backlinks, templates, duplicate/contradiction heuristics, review/undo/export | review/concurrency/hash/undo and escaped HTML tests; UI review/citation dispatch; actual native view loaded |
| 11 governance | Trust, destination consent, secrets, redaction, CSP/text rendering, HTTPS/DNS/path guards, audit/retention/drift | security, egress-declined, injection, streaming secret, HTML escaping, stale-source, quality tests |
| 12 operations | Single parser worker, bounded responses, checkpoint/resume, caching/vector reuse, retries/timeouts/cancel, structured trace IDs, no telemetry | retry/cancel/reuse tests; measured benchmark JSON for 1k/10k/100k parsing/chunk/graph/search (excludes I/O/persistence/network) |
| 13 QA | Vitest, real MCP stdio, Edge UI/axe, actual VS Code host, audit, SBOM, CI matrix | Exact final command evidence in IMPLEMENTATION_STATUS.md; remote CI and live providers not inferred |
| 14 package | Official vsce, manifest/contributions/assets, VSIX inspection/checksum, isolated CLI install and packaged-host smoke | dist/package-inspection.json, SHA256SUMS.txt and final evidence log |

Optional PDF/DOCX and P2 external connectors/enterprise collaboration are not implemented. OS/remote verification requires those environments. Static relations and contradiction detection do not prove runtime coverage or semantic consistency. No provider keys or service accounts were available for live cloud/vector verification.
