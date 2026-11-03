# Security and data boundaries

Version 0.4.0. Owner: Parakram Jain. See [PRIVACY](../PRIVACY.md) for storage and retention.

## Trust and evidence

Indexing, model use, Git actions and MCP require Workspace Trust and repository permissions. Imported source is data; parsers never execute code, attesters or computations. File limits, ignore rules, credential-directory exclusion, binary rejection, containment and symlink checks restrict ingestion. The full file tree can list unindexed filenames but cannot turn them into model evidence.

## Network and credentials

Chat and embedding/vector operations use independent, destination-specific session consent. HTTPS, redirect rejection, address validation and DNS pinning guard requests; loopback Ollama is the explicit local exception. PostgreSQL verifies TLS. Credentials are in VS Code SecretStorage and never accepted in endpoint URLs. Settings changes and restart revoke consent.

Embedding connection tests send one fixed synthetic string. Qdrant/pgvector connection checks are read-only. Index builds send many source-derived chunks/vectors according to the configured provider; question requests contain only bounded relevant context. Pattern redaction is a mitigation, not proof that all sensitive information was removed.

## Webview and agents

Webviews have restrictive nonce CSPs and no direct network permission. React renders source/model content as text. Context packs delimit evidence as untrusted data. The MCP stdio process uses a per-session authenticated loopback bridge. Agent Hub's runtime check validates a real handshake/tool call, separately from client connection status. The playground accepts only read-only tool names through a validated protocol. Proposal creation and approved file writes are separate human decisions.

## Writes and exports

New bundles use staged, non-overwriting publication. Existing file changes require diff review and repeated source/target/permission checks after confirmation. Undo preserves subsequent edits. Exported diagnostics/context can contain source-derived identifiers or information; inspect them before sharing. Local deletion does not guarantee erasure of remote vectors or provider backups.

## Reporting and remaining verification

Report security-sensitive reproductions through [GitHub private vulnerability reporting](https://github.com/parakramjain/okf-studio/security/advisories/new), which is enabled for this repository. Do not put credentials or private source in public issues. Live provider deployments, OS/remote environments and manual assistive-technology checks remain explicitly tracked in pending_issue.md. No independent security certification is claimed.
