# Changelog

## 0.4.0

- Six workflow destinations, editor view, explicit multi-repository/document scope and migrated preferences.
- Vector provider settings/tests, derived readiness, chunk inspection and retrieval playground.
- Agent Hub runtime verification, tool catalog/playground and bounded context packs.
- Governance tracing, sensitive-data warnings and diagnostics export.
- Searchable Features/About, all guides updated, release/publication/security/UX documentation and real extension screenshots.
- Author, developer and owner: Parakram Jain. Marketplace publisher and external checks remain pending.

- Browse all repository files with expandable folders and lazy directory loading.
- Preview compact, question-specific AI evidence and token estimates; no unrelated workspace fallback.
- Select all pending changes and review/approve a combined batch with one confirmation.
- Add guided workflow, page explanations, feature labels, replayable tours, and an offline HTML guide.
- Surface native Git commands in Overview and the Command Palette.

# Changelog

## 0.2.1 — 2026-11-01

- Rename the action to **Proceed to Create OKF** and place it on each source repository card.
- Ask for a parent folder and bundle folder name; generate only the selected repository.
- Create first-time bundles immediately using a staged directory publish, index them and open their index. Initial creation does not populate the review queue.
- Queue only changed files for subsequent updates; skip identical output and preserve unrelated directories. Remember the previous destination as a suggestion.
- Exclude registered bundle folders from parent-source indexing and recursive generation. Validate live source hashes before building; preserve existing files on collisions/cancellation.

## 0.2.0 — 2026-11-01

- Refresh all five views with responsive theme-aware navigation, dashboard actions, source rows, onboarding and explicit empty states.
- Add saved views, persistent scope/filter preferences, paginated source browsing, source type/path filters and sorting, scoped graphs, prompt starters, finding filters and review status filters.
- Show durable per-root sync summaries and full finding totals; prioritize errors before capped informational results.
- Separate search/answer evidence and reject stale search responses; show only budgeted answer citations.
- Correct nested Git ignore semantics, unchanged-file commit provenance, per-root Git commits, failed re-chunk retries and watcher activation after trust is granted.
- Recheck permissions, proposal state, targets and generated source hashes after approval; serialize reviews of each proposal.
- Retain committed vectors after disk-write failures and require rebuilding after vector backend configuration changes.
- Preserve the installed extension ID and local database schema. No external provider requests were needed for this update.
- Retain source extensions in generated concept filenames to prevent collisions; refuse empty editor selections instead of asking across the whole catalog.

## Branding and documentation update

- Rename the visible extension and UI to OKF Studio, preserving its installed extension ID.
- Replace the book icon with connected-node/open-hexagon activity-bar, sidebar and extension artwork.
- Expand the README into a complete feature catalog, configuration overview, MCP tool reference and explicitly labeled roadmap/verification limits.

## 0.1.0 — 2026-11-01

Initial local-first implementation with document/code/hybrid ingestion, portable OKF v0.2, graph and traceability, offline retrieval, configured model/vector providers, scoped assistant, MCP, review/undo and documentation workflows. See RELEASE_NOTES.md and IMPLEMENTATION_STATUS.md for executed checks and integration limits.
