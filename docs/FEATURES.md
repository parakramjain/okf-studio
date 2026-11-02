# OKF Studio features

Turn code and documents into trusted knowledge that AI agents can use.

Version 0.4.0. Author, developer and owner: **Parakram Jain**.

**Supported** means implemented; live service verification is separate. **Experimental** means approximate or heuristic. **Planned** means unavailable. External services require configuration, credentials where applicable, Workspace Trust and destination consent.

## Three flagship journeys

1. Understand a repository: import code, documents or both, create OKF at your chosen location, and explore observed relationships.
2. Ask your knowledge: choose evidence scope, preview relevant excerpts, and receive cited evidence or a model-generated answer.
3. Give agents reliable context: test MCP, inspect tools, export bounded context packs, and review any proposed updates.

## Repositories

| Feature | User benefit | Status | Prerequisites |
| --- | --- | --- | --- |
| Import documents, code, or both | Connect local folders, workspace roots, and Git checkouts to one catalog; add another source type at any time. | Supported | Trusted desktop workspace; Git for Git operations. |
| Create OKF where you choose | Choose a destination, create the first bundle immediately, and review later updates to existing bundles. | Supported | A synchronized source repository and writable destination. |
| Keep the catalog current | Incrementally sync changed files, inspect sync failures, cancel work, and remove catalog entries while retaining sources. | Supported | Readable imported roots. |
| Use native Git workflows | Inspect status/history, switch branches, fetch, pull, commit, push, or clone through VS Code Git. | Supported | Git and the built-in Git extension; remote credentials for network actions. Live remote actions: Not Verified. |
| PDF/DOCX and enterprise connectors | Proposed future safe document adapters and external source connectors. | Planned | Not supported in this release; import supported Markdown/text/HTML and TS/JS/Python files. |

## Knowledge Explorer

| Feature | User benefit | Status | Prerequisites |
| --- | --- | --- | --- |
| Browse every file | Expand real folders, open unindexed files, and select indexed files for AI without silently broadening scope. | Supported | Imported readable repository; symbolic links are displayed but not followed. |
| Search and inspect evidence | Search the full index, save views, inspect metadata and source provenance, compare two records, and export portable knowledge. | Supported | Synchronized supported sources. Semantic search additionally needs a ready vector index. |
| Trace relationships and impact | Explore definitions, imports, calls, document links, and requirement-to-code-to-test relations with source jumps. | Experimental | Extracted relations. Static calls, impact, and coverage are approximate rather than runtime proof. |

## AI Assistant

| Feature | User benefit | Status | Prerequisites |
| --- | --- | --- | --- |
| Ask one document or a chosen scope | Ask about one file, selected files, a folder, one repository, chosen repositories, or the whole workspace. | Supported | Indexed sources; a configured chat provider for synthesized answers. Evidence mode works offline. |
| Preview relevant context | Inspect bounded excerpts, citations, and estimated input tokens before contacting a model; no relevant match means no model call. | Supported | A specific lexical query, or selected files for a general summary. Synonym retrieval may need rephrasing. |
| Choose independent chat models | Use VS Code chat models, Ollama, OpenAI, Azure, or compatible endpoints for cited answers, summaries, comparisons, and drafts. | Supported | An available provider/model, credentials where required, and consent. Live provider/client accounts: Not Verified. |

## Vector Studio

| Feature | User benefit | Status | Prerequisites |
| --- | --- | --- | --- |
| Configure and test embeddings | Set the embedding provider/model, chunk size and overlap, and run a synthetic connection test without repository content. | Supported | Available embedding service/model. Configuration does not establish a successful connection. |
| Choose vector storage | Use local vectors, Qdrant, or PostgreSQL/pgvector and test access without changing remote collections or tables. | Supported | Remote services require credentials, consent, and deployment configuration. Live remote deployments: Not Verified. |
| Build and evaluate retrieval | Preview chunks/tokens, build or rebuild, inspect readiness, roll back, clean old namespaces, and compare retrieval scores and latency. | Supported | Indexed chunks, configured embeddings, and compatible storage. Scores do not measure model groundedness. |
| Shared indexes, RBAC, and managed plans | Proposed future team sharing, access control, managed indexing, and Pro/Team licensing. | Planned | Backend, security, and commercial design work; no paid or shared service is implemented. |

## Agent Hub

| Feature | User benefit | Status | Prerequisites |
| --- | --- | --- | --- |
| Connect agents through MCP | Discover nine knowledge tools, inspect permissions, and test the packaged stdio runtime and authenticated status call. | Supported | Trusted VS Code host with MCP API support. Each consuming client still needs its own setup and verification. |
| Prepare portable context | Preview and export redacted evidence packs with line citations and a token budget without a model request. | Supported | Relevant indexed evidence and a valid scope. |
| Install an optional knowledge agent | Add a reviewed agent definition and try read-only tools locally before asking a coding agent to use them. | Supported | Writable repository and separate human approval; existing agent files are preserved. |

## Quality & Governance

| Feature | User benefit | Status | Prerequisites |
| --- | --- | --- | --- |
| Find knowledge risks | Inspect validation, drift, freshness, heuristic coverage, prompt-injection indicators, and sensitive-content warnings. | Experimental | Indexed sources. These heuristics are not comprehensive security or semantic validation. |
| Review changes safely | Select all pending changes, inspect a combined diff, approve once, reject proposals, or undo unchanged approved files. | Supported | Write permission and unchanged source/target hashes. A failed multi-file write can leave reported partial completion. |
| Export diagnostics and manage local data | Export redacted diagnostics, review retention, revoke consent, and delete derived indexes without deleting source repositories. | Supported | Trusted workspace; destructive local-data actions require confirmation. |
| PR-based team review | Proposed future review through pull requests, with team governance and audit integration. | Planned | Future authenticated Git hosting integration; no PR workflow is implemented. |

## Verification boundaries

The release evidence is in [IMPLEMENTATION_STATUS](../IMPLEMENTATION_STATUS.md). Live cloud/Ollama services, remote Qdrant/pgvector, signed-in coding agents, manual screen readers and remote hosts need separate verification. The extension is a desktop Node extension; browser-only and virtual workspaces are unsupported. Static graphs and requirement coverage do not prove runtime behavior or business correctness.
