# OKF Studio UX guidelines

Version 0.4.0. Author, developer and owner: Parakram Jain.

## Product language

Use OKF Studio and the tagline “Turn code and documents into trusted knowledge that AI agents can use.” Keep technical IDs stable. Navigation has exactly six destinations: Repositories, Knowledge Explorer, AI Assistant, Vector Studio, Agent Hub, Quality & Governance. Each page starts with purpose, visible feature labels and a replayable tour. Features, About and the offline User guide remain readily accessible.

## Progressive workflows

Start with document/code/hybrid choice and source selection. Present the source-to-knowledge workflow before advanced configuration. Use concrete actions: Proceed to Create OKF, Preview context, Test embedding connection, Test MCP runtime, Review & approve. The first bundle asks for a location and builds directly. Later changes enter review.

Scope is a shared visible control for single/selected documents, folder, one/multiple repositories and workspace. Never broaden a missing/empty selection silently. Source display filters and retrieval scope must be distinguished. Expose provenance and source links next to evidence. Keep provider/model selection available beside AI tasks, credentials in native prompts and advanced details in disclosures.

## Honest state and errors

Use Not configured, Indexing, Ready, Stale, Failed and Unsupported for vectors. A connection test is separate from index readiness. MCP Registered is separate from runtime verified and agent-client connected. Supported, Experimental and Planned labels describe capability; Not Verified describes evidence. Never present approximate graph/coverage results as proven runtime behavior. Show cancellation, no-results, error recovery and list caps. Do not invent token prices.

## Accessible presentation

Use native VS Code theme tokens, semantic landmarks/labels, visible keyboard focus, live status and progress, text graph equivalents and a skip link. Support a narrow sidebar and wider editor view; avoid horizontal page overflow. Dialogs restore focus and close with Escape. Tours can be replayed/dismissed. Validate dark/light/high-contrast themes, keyboard use and narrow widths; automated axe checks supplement, not replace, manual screen-reader verification.

## Review and release visuals

Approval means inspect a real diff before confirming. Show changed-source blocks and batch partial failures. Product screenshots must come from the actual extension host with synthetic non-sensitive source fixtures. Label service states honestly; do not add fabricated model responses or index status for marketing screenshots. Keep native editor surroundings when they establish that the extension is running.
