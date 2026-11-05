# ChatGPT prompt: OKF Studio architecture diagram

Copy the prompt below into ChatGPT. It is self-contained and describes the repository architecture reviewed for this draft. If implementation files are also available, reconcile these details with them before drawing.

---

Act as a senior software architect and technical visual designer. Prepare an accurate, readable architecture diagram for **OKF Studio**, accompanied by a detailed explanation of its components, data flows, and role in software development.

The primary audience is software developers, engineering leads, and people building coding agents. The diagram will support a LinkedIn article, but it must be technically defensible. Explain terminology in plain language. Use the architecture described below as the factual basis; do not add hypothetical infrastructure or imply that experimental features are proven.

## 1. Product purpose and central message

OKF Studio is a **local-first VS Code extension** that turns code and documents into portable, traceable project knowledge. Developers can explore repositories, retrieve cited evidence, supply context to coding agents, and review knowledge updates as software changes.

Its central software-development loop is:

**Understand → retrieve evidence → plan and implement with an agent → test and review → maintain project knowledge.**

Show coding, test execution, and code review as developer/coding-agent activities in the surrounding development workflow. OKF Studio supplies knowledge and review controls; its indexing pipeline does not execute imported code, and its built-in assistant does not autonomously implement or test the application.

Explain why this architecture matters: useful context is distributed across code, requirements, architecture decisions, documentation, and tests. OKF Studio connects those sources and preserves evidence so developers and agents can investigate a task without repeatedly assembling all context by hand.

## 2. Sources and ingestion

Show a source area containing:

- Local folders, VS Code workspace roots, and local checkouts imported through HTTPS Git cloning.
- Documents: Markdown, plain text, and HTML, including supported requirements and architecture-decision documents.
- Code: TypeScript, JavaScript, and Python, including supported test files.
- Document-only, code-only, and hybrid import modes, with multiple repositories supported.

Show these sources entering an **incremental synchronization and ingestion pipeline** owned by the extension host:

1. Enumerate permitted files using VS Code filesystem access.
2. Apply Git ignore rules, configured exclusions, file-size limits, binary/credential-file exclusions, and path/symlink guards.
3. Compare content hashes; skip unchanged parsing and remove projections for deleted files when enumeration succeeds.
4. Parse supported content in a worker so parsing does not block the extension host.
5. Extract document headings, links, metadata, symbols, imports, and supported requirement/test identifiers.
6. Produce heading/symbol-aware chunks and provenance-bearing source records.

TypeScript/JavaScript extraction uses the TypeScript AST. Python structure uses Lezer; some Python call relationships are approximate. Provenance includes repository identity, source URI, line spans, content hash, and Git commit information when available.

Label ingestion **“Static extraction; source code is not executed.”** Synchronization uses manual actions and file watchers. Local Sync does not fetch or pull Git changes; native VS Code Git handles those actions separately.

## 3. Local application and interface

Draw a **VS Code / filesystem-backed Node extension host** boundary containing the host application services. A separate React/Vite webview is the presentation surface and communicates with the host through validated messages.

Show the six user-facing destinations as a grouped UI surface:

- **Repositories:** import, synchronization, bundle creation, and native Git actions.
- **Knowledge Explorer:** source browsing, search, citations, and relationship exploration.
- **AI Assistant:** scoped context preview, evidence excerpts, and optional generated answers.
- **Vector Studio:** embedding/storage configuration, chunk preview, index lifecycle, and retrieval comparison.
- **Agent Hub:** MCP tools, runtime checks, and context-pack preview/export.
- **Quality & Governance:** findings, change proposals, diffs, approval, rejection, and guarded undo.

These are views of one extension, not six independent backend services. The host coordinates filesystem access, persistence, workers, providers, review dialogs, and agent tools. The webview has no direct model/vector-service network path and receives no provider credentials.

## 4. Knowledge representation and storage

Clearly distinguish three related concepts:

**A. Original project files.** Code and human-authored documents remain in their repositories.

**B. Portable Open Knowledge Format (OKF) bundles.** OKF is a knowledge format using Markdown with YAML metadata, not a database or model. OKF Studio can generate an `index.md` and `concepts/` files containing observed facts and provenance. These ordinary files can be read, reviewed, and versioned in Git independently of a model or vector backend. Generation is deterministic and does not require an LLM. A generated bundle is registered as a separate document repository and can enter the same indexing pipeline; known generated output roots are excluded from parent-source ingestion to prevent recursive generation and duplicate ingestion.

**C. Derived local catalog and indexes.** A SQL.js SQLite/WASM store, persisted in VS Code extension storage and separated by workspace identity, holds source records/content, chunks, lexical terms, local vectors, metadata, proposals, audit records, and snapshots. It uses transaction/snapshot and recovery mechanisms. These derived structures support retrieval and can be rebuilt from sources. They are separate from portable OKF files.

Show a **derived relationship graph** built from indexed records for definitions, imports, calls, references, dependencies, and supported requirement/code/test relationships. Do not invent a standalone graph database such as Neo4j.

State that static impact, traceability, drift, and coverage findings include heuristics. They guide investigation and do not prove runtime behavior, business intent, or complete test coverage.

## 5. Built-in retrieval and RAG

Show a retrieval layer serving Explorer, Assistant, and agent tools:

- **Keyword/BM25 retrieval:** available locally without model credentials.
- **Semantic retrieval:** requires a configured embedding model and compatible built vector index.
- **Hybrid retrieval:** combines lexical/vector ranking and a small confidence-weighted graph-neighbor relevance signal.
- **Scope controls:** one document, selected files, a folder, one repository, selected repositories, or workspace. An empty explicit repository selection must remain empty.
- **Evidence assembly:** ranked excerpts, source/line citations, redaction, and bounded results/context budgets.

Distinguish general retrieval capabilities from the built-in Assistant's relevance-first local context-selection path. Do not imply every question automatically performs semantic or graph retrieval.

Explain retrieval-augmented generation (RAG) as retrieving evidence before asking a model to generate an answer. Draw two answer paths:

1. **Offline evidence path:** question + scope → relevant excerpts → context preview/evidence display, without a chat-model call.
2. **Optional generated-answer path:** question + scope → relevant evidence → budgeted context → configured chat model → streamed answer with citations → developer verification.

The built-in Assistant does not call a model when no relevant evidence is found. Its default answer context selects at most six relevant excerpts, at most two per file, within an estimated 3,000-token input limit, also constrained by the global budget. Explain those defaults in the accompanying text rather than crowding the diagram.

Treat retrieved content as untrusted quoted data. Citations enable checking; neither citations nor retrieval scores establish correctness. A built-in assistant answer can inform a separate review proposal but cannot directly write approved files.

## 6. Optional model and vector services

Draw chat, embeddings, and vector storage as **independent optional capabilities**, not a single mandatory cloud service:

- Chat: available VS Code language models, Ollama, OpenAI, Azure OpenAI, or compatible configured endpoints.
- Embeddings: configured Ollama, OpenAI, Azure, or compatible embedding endpoints.
- Vector storage: local vectors or optional Qdrant / PostgreSQL with pgvector adapters.

Place Ollama in a local-runtime area. Place remote model/vector endpoints outside the local application boundary. Treat VS Code model calls as an optional provider path that may involve external processing; do not label them inherently offline.

Distinguish **indexing-time** chunk embedding/storage from **query-time** query embedding/vector search. Embedding builds may process many source-derived chunks; an answer request receives bounded selected evidence. Do not imply answer context limits also bound a full embedding job.

Show index lifecycle concepts in a note: staged builds, reuse of unchanged vectors, readiness/staleness, rollback, and explicit historical remote-namespace cleanup. A successful connection test does not establish index readiness. Live provider/backend and signed-in client behavior require environment-specific verification.

## 7. Coding-agent integration through MCP

Draw this integration topology accurately:

**Compatible coding-agent client ↔ bundled MCP stdio server ↔ authenticated loopback bridge ↔ extension-host knowledge services.**

MCP means Model Context Protocol. VS Code registers the server definition; the packaged server is a separate process using stdio for the client connection. It delegates requests through a session-authenticated local bridge to the running trusted host. It does not own another mutable knowledge database and does not connect agents directly to SQLite or provider secrets.

Show search/context tools as a group in the main diagram. List all nine tools in the explanation:

- `search_knowledge`
- `get_document`
- `get_code_context`
- `get_dependencies`
- `analyze_change_impact`
- `trace_requirement`
- `validate_against_knowledge`
- `get_index_status`
- `propose_knowledge_update`

Most tools are read-only. The proposal tool requires human consent to queue a proposal, and applying it requires separate diff review and approval. Also show a manual **context-pack preview/export** route containing bounded, redacted evidence and citations, with no model call required for pack preparation.

The external coding agent may edit and test code using its own authorized tools. Draw that activity outside OKF Studio's knowledge-write path. MCP registration/runtime success and a particular signed-in client's successful connection are separate verification states.

## 8. Documentation maintenance and human review

Show two different bundle-write paths:

**First creation:** explicit developer action → choose destination → deterministic generation → staged, non-overwriting publication → register/index the new bundle. Initial creation writes the new bundle directly without putting every file into the proposal queue.

**Existing-bundle update:** changed sources or agent suggestion → regeneration/update proposal → combined diff review → explicit human approval → recheck source hashes, target state, and permissions → apply approved changes → synchronize affected knowledge.

Show rejection and guarded undo as available review actions, without cluttering the main diagram. Undo must preserve subsequent edits. Drift/freshness/link findings help identify maintenance work; they are not automatic guarantees of semantic accuracy. A failed multi-file application may report partial completion rather than transactionally reverting every filesystem write.

## 9. Security and trust boundaries

Represent these controls as cross-cutting gates or concise callouts:

- Workspace Trust and repository permissions gate access and operations.
- VS Code SecretStorage holds credentials separately from workspace settings, UI state, and MCP responses.
- Destination/operation-specific runtime consent gates model/vector egress independently of Workspace Trust.
- Host networking validates destinations and rejects redirects; loopback Ollama is an explicit local exception. PostgreSQL uses verified TLS.
- Redaction, injection indicators, and bounded contexts mitigate exposure but cannot guarantee complete detection.
- Imported content is evidence, not executable instructions. Built-in model output cannot approve proposals or write source files.
- Local catalog data includes source-derived content and is not independently encrypted. Local-first permits optional external calls after consent.

## 10. Diagram composition and deliverables

Produce **one primary architecture diagram** titled:

**“OKF Studio — Project Knowledge for Software Development and Coding Agents”**

Arrange sources on the left, the local extension and knowledge/retrieval services in the center, and optional providers/coding-agent clients on the right. Put human review and the return path to maintained knowledge along the bottom. Keep the overview to approximately 15–20 major nodes by grouping related components. Make it readable at LinkedIn article width.

Use labeled arrows for reads, parsed records/chunks, retrieval, model requests, MCP calls, proposals, approved writes, and synchronization. Separate data flow from approval/control flow. Use a legend for always-local operation, optional integrations, human approval, and experimental relationships. Label lines explicitly so meaning does not depend on color alone. Use a restrained palette, generous whitespace, and no decorative icons that obscure the architecture.

Return:

1. A rendered overview if your environment supports it, followed by the complete editable Mermaid `flowchart` source. If rendering is unavailable, provide the Mermaid source without claiming a rendered image or export exists.
2. A component table with each component's responsibility, input, output, storage role, and execution location.
3. Numbered walkthroughs for ingestion/OKF creation, offline evidence retrieval, optional model-assisted answering, MCP-assisted development, and reviewed documentation updates.
4. A concrete example: a developer changes an API retry policy, retrieves implementation/requirements/tests, supplies cited context to an agent, edits and runs tests through the normal coding workflow, then reviews proposed knowledge updates. Mark this as an illustrative workflow rather than a measured outcome.
5. A short explanation of why portable OKF files, the derived SQLite catalog, optional vectors, and optional models are separate architectural choices.
6. A concise LinkedIn caption of 80–120 words describing how the architecture supports software development, agent context, and documentation maintenance, without unsupported performance claims.

Keep technical depth in the explanation. If needed, add one supplementary sequence diagram for the reviewed-update or MCP flow instead of overcrowding the overview.

## 11. Accuracy constraints

Depict the implemented preview architecture, with experimental relationships labeled. PDF/DOCX ingestion, external enterprise connectors, shared team indexes, RBAC, managed SaaS, and Git-PR-based approval are planned; omit them from the active architecture or place them in a clearly separate future-work note.

Do not invent Kubernetes, microservices, a central hosted platform, a standalone graph database, automatic model training, autonomous approval, universal language support, or guaranteed reductions in latency, cost, bugs, or hallucinations. Do not imply that all providers and clients are live-verified. Distinguish extracted facts, inferred conclusions, developer-provided intent, and tested behavior.

Before returning the result, check every arrow against these facts. In particular, verify that the diagram preserves offline operation, separates OKF files from derived storage, places optional external calls behind consent, shows MCP delegating to the host, distinguishes new-bundle creation from reviewed updates, and keeps agent code-edit/test activity separate from built-in model output.
