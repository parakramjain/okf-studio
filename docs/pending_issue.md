# Pending improvements and verification

Updated 2026-11-02 (America/Toronto). Owner: Parakram Jain. This file tracks open work only. Release evidence is retained in [IMPLEMENTATION_STATUS.md](../IMPLEMENTATION_STATUS.md); installation and migration instructions are in [README.md](../README.md#install).

## Network graph viewer upgrade

**Priority: High. Status: Planned; not implemented. Owner: Development.**

The current viewer is under **Knowledge Explorer > Sources > Graph**. It uses a fixed four-column layout, renders at most 60 nodes and 150 edges, and supports selecting nodes for change impact with text relations below. It needs a more discoverable, sophisticated interface for exploring connected knowledge.

Planned improvements:

- **Visible entry point and workspace:** expose a clearly labeled **Network Graph** action in Knowledge Explorer, with a spacious editor view, brief explanation, legend and page tour.
- **Navigation:** add zoom, pan, fit-to-view, reset, a minimap, and draggable/pinnable nodes. Preserve the viewport while inspecting nodes.
- **Readable layouts:** offer force-directed and hierarchical layouts; group by repository, folder or module with expandable clusters. Reduce overlapping labels and edges.
- **Search and filtering:** find and focus a node by name/path; filter by repository, node type and relationship type; honor source selections and distinguish resolved from approximate relations.
- **Focused exploration:** highlight incoming/outgoing connections, expand or collapse neighbors, choose traversal depth and inspect bounded change-impact paths without losing the wider context.
- **Details and evidence:** provide a node/edge inspector with full labels, relationship direction/type, available provenance and source links. Clearly label inferred relationships and missing evidence.
- **Large graph handling:** replace the fixed visual cutoff with progressive exploration and clustering. Show loaded/visible/total counts where known, disclose every cap and provide actionable empty/loading/error states.
- **Accessibility and saved views:** keep keyboard navigation and a text equivalent; support light/dark/high-contrast themes and reduced motion. Save layout/filter preferences and provide an explicit export of the visible graph.

Acceptance criteria:

1. Users can discover the graph directly, find a node, inspect its neighbors and open supporting source evidence without losing their selected scope.
2. Navigation, filtering and layout changes work in both sidebar and full editor views. Keyboard users can perform equivalent exploration and return focus reliably.
3. Representative small and large fixtures cover cycles, disconnected nodes, long labels and approximate relations. Record rendering/interaction performance and declared limits; no silent truncation or frozen UI.
4. Update the feature catalog, tour, screenshots and Markdown/HTML guides to match the shipped viewer. Correct the current guide's claim of 200 rendered nodes to match the actual implementation or its replacement. Add focused interaction and accessibility checks before marking this item complete.

## Remaining verification

| Item | Current state | Next action | Owner |
| --- | --- | --- | --- |
| Live model/vector deployments | Not Verified | Use a non-sensitive fixture. Test each intended chat/embedding provider, build/retrieve with the chosen vector backend, and check citations, cancellation and failure recovery. | Parakram or deployment tester |
| Signed-in coding agent | Not Verified | Enable OKF Studio in the intended client, run status/search, open a citation and confirm proposals require human review. Local MCP runtime is already tested. | Parakram |
| Manual accessibility and remote-host coverage | Not Verified | Check keyboard and screen-reader output, then each intended WSL/SSH/container host. Automated axe and hosted CI do not replace these checks. | Parakram or tester |

## Steps for Parakram now

1. For services you use, configure credentials with **OKF: Configure Providers and Credentials**, test embedding/vector connections, index a small non-sensitive fixture, ask a scoped question and inspect citations.
2. In your coding client, enable OKF's MCP tools, run status/search and confirm proposed changes require review.
3. Test your screen reader and intended remote hosts where applicable. Record the version, environment, result and any reproducible failures against the remaining verification items.

These service/client/manual checks remain preview limitations. Offline keyword search needs no credentials. Future release instructions are in [PUBLISHING.md](PUBLISHING.md).
