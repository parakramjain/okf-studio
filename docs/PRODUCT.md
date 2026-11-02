# Product and acceptance requirements

**Turn code and documents into trusted knowledge that AI agents can use.**

Developer: import code/hybrid roots, find symbols, inspect bounded change impact, retrieve cited context in Copilot/MCP. Architect: inspect evidence graph, requirements, decisions and coverage. Technical writer: work without code, edit Markdown/frontmatter, check links and review proposed updates. Admin: set providers, egress consent, retention, credentials and diagnostics.

Document, code and hybrid repositories share one local catalog. A repository can have multiple roots; queries can span repositories or constrain one file, selected files or folders. Offline onboarding must reach searchable excerpts without credentials. Models, embeddings and vector storage are configured independently; unknown pricing is shown as unknown, with estimated tokens rather than fabricated costs.

| Priority / acceptance | Implementation evidence |
| --- | --- |
| P0: all three modes import files without executing them; repeated sync skips unchanged hashes, deletes removed sources and honors cancellation | ingestion integration fixtures |
| P0: OKF unknown metadata round trips, type-only concepts pass and reserved files follow v0.2 | golden parser/validator tests |
| P0: lexical retrieval works offline; citations resolve to indexed file/line ranges; every AI operation respects scope and budget | retrieval/assistant tests |
| P0: no egress without trust and destination-specific consent; no secrets in exported context | security tests and host smoke |
| P0: nine MCP tools discover IDs, return bounded results and never write approved knowledge | SDK stdio contract test |
| P0: React sidebar keyboard operation, responsive tabs, progress/error/cancel, actionable settings and source navigation | UI and host tests |
| P0: real VSIX activates in isolated VS Code profile | package and host smoke |
| P1: resolved/approximate graphs, drift, traceability, review/undo/export | graph/governance integration tests |
| P1: real embedding requests, dimension checks, Qdrant/pgvector adapters, index migration/rollback | provider contract tests; live services conditional |
| P1: reproducible 1k/10k/100k synthetic benchmarks, CI matrix, accessibility audit | operations and QA |
| P2: enterprise identity/collaboration, external content connectors, policy marketplaces | explicit future backlog; no disabled UI promises |

Accessibility uses semantic controls, visible focus, native theme colors, live status and text equivalents for graphs. Repository data stays local unless consented. Source changes always use a review proposal. Model outputs are inferences until approved by a human.

## 0.4.0 development review decisions

Owner, author and developer: Parakram Jain. Keep the requested OKF Studio brand and stable installed identity. The six destinations expose three flagship journeys: understand a repository, ask cited questions, and supply reliable agent context. See FEATURES.md for all capability statuses and prerequisites.

P0 implementation includes all three onboarding modes, explicit single/multiple-document/repository scopes, direct document-to-assistant handoff, provider settings/tests, six index states, retrieval playground, MCP runtime/tools/context packs, governance tracing/diagnostics, searchable Features and About, bundled guide and publication checklist. P1 static relationship/coverage heuristics are labeled Experimental. Git pull-request review and P2 enterprise identity/connectors, PDF/DOCX, shared RBAC and paid managed capabilities remain Planned. External verification and Marketplace publisher details remain in pendinissue.md.
