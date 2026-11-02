import React, { useEffect, useMemo, useRef, useState } from "react";
import type {
  KnowledgeRecord,
  Repository,
  Issue,
  Proposal,
  SearchHit,
  Graph,
  Progress,
  Mode,
  SyncStats,
} from "../src/domain/types";
import { GraphVisual } from "./GraphVisual";
import { FileTree } from "./FileTree";
import { VectorStudio, type StudioServices } from "./VectorStudio";
import { AgentHub } from "./AgentHub";
import { ScopeControls } from "./ScopeControls";
import { Catalog } from "./Catalog";
import { Traceability } from "./Traceability";
import { GitPanel } from "./GitPanel";
import { PageHelp, Tour, Workflow } from "./Help";
import { Brand, Empty, Icon, SectionTitle, type IconName } from "./components";
import {
  filterSources,
  workspaceScope,
  restorePreferences,
  savedViewAvailable,
  scopeGraph,
  tabs,
  type Preferences,
  type SavedView,
} from "./model";

declare function acquireVsCodeApi(): {
  postMessage(value: unknown): void;
  getState(): unknown;
  setState(value: unknown): void;
};
const api =
  typeof acquireVsCodeApi === "function"
    ? acquireVsCodeApi()
    : {
        postMessage: (value: unknown) =>
          window.dispatchEvent(
            new CustomEvent("okf-test-message", { detail: value }),
          ),
        getState: () => {
          try {
            return JSON.parse(sessionStorage.getItem("okf-preview") ?? "null");
          } catch {
            return null;
          }
        },
        setState: (value: unknown) =>
          sessionStorage.setItem("okf-preview", JSON.stringify(value)),
      };
const send = (value: unknown) => api.postMessage(value);
type SyncSummary = SyncStats & { at: string; errorCount?: number };
type State = StudioServices & {
  recordIds?: string[];
  recordCount?: number;
  qualityScore?: number;
  requirementCoverage?: number;
  vectorBackend?: string;
  repositories: Repository[];
  records: KnowledgeRecord[];
  issues: Issue[];
  issueCount?: number;
  issueCounts?: Record<Issue["severity"], number>;
  syncStatus?: Record<string, SyncSummary[]>;
  proposals: Proposal[];
  graph: Graph;
  trusted: boolean;
  namespace?: string;
  chunkCount: number;
  provider: string;
  model: string;
  mode: Mode;
  auditCount: number;
};
const empty: State = {
  repositories: [],
  records: [],
  issues: [],
  proposals: [],
  graph: { nodes: [], edges: [] },
  trusted: false,
  chunkCount: 0,
  provider: "evidence",
  model: "",
  mode: "hybrid",
  auditCount: 0,
};
const navIcons: IconName[] = [
  "overview",
  "explorer",
  "ask",
  "indexes",
  "agent",
  "insights",
];
const date = (value?: string) =>
  value && Number.isFinite(Date.parse(value))
    ? new Date(value).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Not synced yet";
const number = (value: number) => value.toLocaleString();

export function App() {
  const [state, setState] = useState<State>(empty);
  const [utility, setUtility] = useState<"features" | "about">();
  const [prefs, setPrefs] = useState(() => restorePreferences(api.getState()));
  const update = (patch: Partial<Preferences>) =>
    setPrefs((p) => ({ ...p, ...patch }));
  const { tab, repo, folder, selected, query, strategy, display } = prefs;
  const [question, setQuestion] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [citations, setCitations] = useState<SearchHit[]>([]);
  const [searched, setSearched] = useState(false);
  const [answer, setAnswer] = useState("");
  const [context, setContext] = useState<{
    excerpts: number;
    workspaceChunks: number;
    evidenceTokens: number;
    promptTokens: number;
    limit: number;
    preview: boolean;
    modelRequest: boolean;
  }>();
  const [tour, setTour] = useState<{ full: boolean }>();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<Progress>();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [task, setTask] = useState("answer");
  const [detail, setDetail] = useState<KnowledgeRecord>();
  const [metadata, setMetadata] = useState("");
  const [impact, setImpact] = useState<string[] | null>(null);
  const [reviewSelected, setReviewSelected] = useState<string[]>([]);
  const [viewName, setViewName] = useState("");
  const [severity, setSeverity] = useState("all");
  const [findingFilter, setFindingFilter] = useState("");
  const [reviewFilter, setReviewFilter] = useState("pending");
  const [page, setPage] = useState(0);
  const [issueLimit, setIssueLimit] = useState(30);
  const searchRequest = useRef<string | undefined>(undefined);
  const searchInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    api.setState(prefs);
  }, [prefs]);
  useEffect(() => {
    const listener = (event: MessageEvent) => {
      const m = event.data;
      if (!m || typeof m !== "object") return;
      if (m.type === "state") {
        setState({ ...empty, ...m.state });
        if (!m.state.trusted || !m.state.repositories.length) {
          setAnswer("");
          setCitations([]);
          setHits([]);
          setSearched(false);
          setDetail(undefined);
          setImpact(null);
          setReviewSelected([]);
          searchRequest.current = undefined;
        }
      }
      if (m.type === "results") {
        if (m.channel === "answer") setCitations(m.hits);
        else if (!m.requestId || m.requestId === searchRequest.current) {
          setHits(m.hits);
          setSearched(true);
        }
      }
      if (m.type === "answer") setAnswer((a) => a + m.text);
      if (m.type === "context") setContext(m.context);
      if (m.type === "answerStart") {
        setContext(undefined);
        setAnswer("");
        setCitations([]);
      }
      if (m.type === "busy") {
        setBusy(m.busy);
        if (m.busy) {
          setError("");
          setProgress(undefined);
        }
      }
      if (m.type === "progress") setProgress(m.progress);
      if (m.type === "error") setError(m.message);
      if (m.type === "notice") setNotice(m.message);
      if (m.type === "navigate" && tabs.includes(m.tab))
        setPrefs((p) => ({ ...p, tab: m.tab }));
      if (m.type === "impact") setImpact(m.ids);
      if (m.type === "preview") {
        setDetail(m.record);
        setMetadata(m.yaml);
      }
      if (m.type === "scope")
        setPrefs((p) => ({
          ...p,
          repo: "",
          repoIds: [],
          multiRepo: false,
          folder: "",
          selected: m.ids,
          tab: "AI Assistant",
        }));
    };
    window.addEventListener("message", listener);
    send({ type: "ready" });
    return () => window.removeEventListener("message", listener);
  }, []);
  useEffect(() => {
    searchRequest.current = undefined;
    setHits([]);
    setSearched(false);
    setImpact(null);
  }, [repo, prefs.multiRepo, prefs.repoIds, folder, selected, query, strategy]);
  useEffect(() => {
    setPage(0);
  }, [repo, folder, prefs.sourceFilter, prefs.kind, prefs.sort]);
  useEffect(() => {
    setContext(undefined);
  }, [question, task, repo, prefs.multiRepo, prefs.repoIds, folder, selected]);
  const scope = workspaceScope(prefs);
  const records = useMemo(
    () => filterSources(state.records, prefs),
    [state.records, prefs],
  );
  const graph = useMemo(
    () =>
      scopeGraph(state.graph, records, {
        recordIds: selected.length ? selected : undefined,
      }),
    [state.graph, records, selected],
  );
  const pageCount = Math.max(1, Math.ceil(records.length / 50));
  const currentPage = Math.min(page, pageCount - 1);
  const pageRecords = records.slice(currentPage * 50, currentPage * 50 + 50);
  const recordMap = useMemo(
    () => new Map(state.records.map((r) => [r.id, r])),
    [state.records],
  );
  const nodes = useMemo(
    () => new Map(state.graph.nodes.map((n) => [n.id, n])),
    [state.graph.nodes],
  );
  const pending = state.proposals.filter((p) => p.status === "pending");
  const issueCount = state.issueCount ?? state.issues.length;
  const sourceCount = state.recordCount ?? state.records.length;
  const errors =
    state.issueCounts?.error ??
    state.issues.filter((i) => i.severity === "error").length;
  const warnings =
    state.issueCounts?.warning ??
    state.issues.filter((i) => i.severity === "warning").length;
  const filteredIssues = state.issues.filter(
    (i) =>
      (severity === "all" || i.severity === severity) &&
      `${i.code} ${i.message} ${recordMap.get(i.recordId)?.path ?? ""}`
        .toLowerCase()
        .includes(findingFilter.toLowerCase()),
  );
  const proposals = state.proposals.filter(
    (p) => reviewFilter === "all" || p.status === reviewFilter,
  );
  const command = (command: string) => send({ type: "command", command });
  const open = (id: string, line?: number) => send({ type: "open", id, line });
  const saveView = () => {
    if (!viewName.trim()) return;
    if (prefs.saved.length >= 12) {
      setNotice(
        "You can save up to 12 views. Remove a saved view to make room.",
      );
      return;
    }
    const { tab: _tab, saved, ...filters } = prefs;
    update({
      saved: [
        ...saved,
        { ...filters, id: crypto.randomUUID(), name: viewName.trim() },
      ],
    });
    setViewName("");
    setNotice(
      "View saved locally. Queries and scope are remembered; answers and source content are not saved.",
    );
  };
  const restoreView = (view: SavedView) => {
    if (
      !savedViewAvailable(
        view,
        state.repositories,
        state.recordIds?.map((id) => ({ id })) ?? state.records,
      )
    ) {
      setNotice(
        "This view references sources unavailable in the loaded catalog. Re-import them or create a new view; its scope has not been broadened.",
      );
      return;
    }
    const { id: _id, name: _name, ...filters } = view;
    update({ ...filters, tab: "Knowledge Explorer" });
    setNotice(`Restored “${view.name}”. Run Search to refresh its results.`);
  };
  const unavailable =
    (prefs.multiRepo &&
      (!prefs.repoIds.length ||
        prefs.repoIds.some(
          (id) => !state.repositories.some((r) => r.id === id),
        ))) ||
    (!!repo && !state.repositories.some((r) => r.id === repo)) ||
    selected.some(
      (id) => !(state.recordIds ?? [...recordMap.keys()]).includes(id),
    );
  const performSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const requestId = crypto.randomUUID();
    searchRequest.current = requestId;
    setHits([]);
    setSearched(false);
    send({ type: "search", query, scope, strategy, requestId });
  };
  return (
    <main>
      <header className="app-header">
        <div className="brand-row">
          <h1>
            <Brand />
            OKF Studio
          </h1>
          <span className="status-dot">
            <span />
            Local-first
          </span>
        </div>
        <p className="muted tagline">
          Turn code and documents into trusted knowledge that AI agents can use.
        </p>
        <div className="toolbar header-actions">
          <button
            className="guide-button"
            title="Open the offline HTML user guide"
            onClick={() => send({ type: "guide", page: tab })}
          >
            <Icon name="guide" />
            User guide
          </button>
          <button
            title="Take a tour of every section"
            onClick={() => setTour({ full: true })}
          >
            <Icon name="tour" />
            Studio tour
          </button>
          <button
            className="primary"
            onClick={() => command("import")}
            disabled={busy}
          >
            <Icon name="plus" />
            Import
          </button>
          <button
            disabled={busy || !state.repositories.length}
            onClick={() => command("sync")}
          >
            <Icon name="sync" />
            Sync
          </button>
          <button
            className="icon-button"
            onClick={() => command("configure")}
            aria-label="Configure providers"
            title="Configure providers"
          >
            <Icon name="settings" />
          </button>
        </div>
      </header>
      {!state.trusted && (
        <div role="status" className="notice">
          <Icon name="shield" />
          <span>
            Trust this workspace to enable repository access, models and MCP.
          </span>
        </div>
      )}
      <nav aria-label="Studio views">
        {tabs.map((t, i) => (
          <button
            key={t}
            aria-label={t}
            aria-current={tab === t ? "page" : undefined}
            onClick={() => update({ tab: t })}
          >
            <Icon name={navIcons[i]} />
            <span>{t}</span>
            {t === "Quality & Governance" && pending.length > 0 && (
              <span
                className="nav-dot"
                aria-hidden="true"
                title={`${pending.length} pending changes`}
              />
            )}
          </button>
        ))}
      </nav>
      <div className="toolbar utility-actions">
        <button onClick={() => setUtility("features")}>Features</button>
        <button onClick={() => setUtility("about")}>About</button>
        <button onClick={() => send({ type: "openStudioEditor" })}>
          Open in editor
        </button>
      </div>
      {utility && (
        <Catalog
          page={utility}
          version={state.version}
          publisher={state.publisher}
          close={() => setUtility(undefined)}
          navigate={(tab) => update({ tab })}
        />
      )}
      <PageHelp tab={tab} start={() => setTour({ full: false })} />
      {tour && (
        <Tour
          tab={tab}
          full={tour.full}
          navigate={(tab) => update({ tab })}
          close={() => setTour(undefined)}
        />
      )}
      {busy && (
        <div role="status" className="progress">
          <div>
            <strong>{progress?.stage || "Working"}</strong>
            <span className="muted">
              {progress
                ? `${progress.completed}${progress.total ? ` / ${progress.total}` : ""} · ${progress.detail ?? ""}`
                : "Preparing your request…"}
            </span>
          </div>
          <progress
            aria-label="Operation progress"
            value={progress?.total ? progress.completed : undefined}
            max={progress?.total || 100}
          />
          <button onClick={() => send({ type: "cancel" })}>Cancel</button>
        </div>
      )}
      {error && (
        <div role="alert" className="alert">
          <Icon name="warning" />
          <span>{error}</span>
          <button
            className="icon-button"
            aria-label="Dismiss error"
            onClick={() => setError("")}
          >
            <Icon name="close" />
          </button>
        </div>
      )}
      {notice && (
        <div role="status" className="notice">
          <span>{notice}</span>
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setNotice("")}
          >
            <Icon name="close" />
          </button>
        </div>
      )}

      {tab === "Repositories" && (
        <section aria-label="Repositories" data-tour="page-content">
          <Workflow
            repositories={state.repositories.length}
            sources={sourceCount}
            pending={pending.length}
            navigate={(tab) => update({ tab })}
            command={command}
          />
          {!state.repositories.length && (
            <div className="hero">
              <div className="eyebrow">YOUR KNOWLEDGE WORKSPACE</div>
              <h2>
                {state.repositories.length
                  ? "Your workspace, connected."
                  : "Your knowledge starts here"}
              </h2>
              <p>
                {state.repositories.length
                  ? "Turn scattered sources into context you can trust. Explore, ask, and keep your knowledge current."
                  : "Bring your code and documentation together. Start with a local folder or Git repository."}
              </p>
              <span className="chip accent">
                <Icon name="shield" />
                {state.provider === "evidence"
                  ? "Offline evidence mode"
                  : `${state.provider} assistance`}
              </span>
            </div>
          )}
          {!state.repositories.length ? (
            <>
              <SectionTitle
                eyebrow="01 / CHOOSE YOUR FOCUS"
                title="What are you working with?"
              />
              <div className="cards mode-cards">
                {(["document", "code", "hybrid"] as const).map((m, i) => (
                  <button
                    className={`mode ${state.mode === m ? "chosen" : ""}`}
                    aria-pressed={state.mode === m}
                    key={m}
                    onClick={() => send({ type: "mode", mode: m })}
                  >
                    <Icon name={(["document", "code", "graph"] as const)[i]} />
                    <strong>{["Documents", "Code", "Both"][i]}</strong>
                    <span>
                      {
                        [
                          "Guides, decisions, requirements",
                          "Symbols, dependencies, tests",
                          "Connect code and documentation",
                        ][i]
                      }
                    </span>
                    {state.mode === m && (
                      <Icon name="check" className="mode-check" />
                    )}
                  </button>
                ))}
              </div>
              <button
                className="primary"
                disabled={busy}
                onClick={() => command("import")}
              >
                Choose source
                <Icon name="arrow" />
              </button>
              <ol className="steps">
                <li>
                  <span>1</span>
                  <div>
                    <strong>Connect your sources</strong>
                    <small>
                      Import and index a repository on this machine.
                    </small>
                  </div>
                </li>
                <li>
                  <span>2</span>
                  <div>
                    <strong>Explore the evidence</strong>
                    <small>Search files, follow links, and ask in scope.</small>
                  </div>
                </li>
                <li>
                  <span>3</span>
                  <div>
                    <strong>Keep knowledge current</strong>
                    <small>Review findings and approve proposed changes.</small>
                  </div>
                </li>
              </ol>
            </>
          ) : (
            <>
              <div className="metrics">
                <article>
                  <Icon name="explorer" />
                  <strong>{number(sourceCount)}</strong>
                  <span>Sources</span>
                </article>
                <article>
                  <Icon name="indexes" />
                  <strong>{number(state.chunkCount)}</strong>
                  <span>Searchable chunks</span>
                </article>
                <button
                  onClick={() => {
                    setSeverity("all");
                    update({ tab: "Quality & Governance" });
                  }}
                >
                  <Icon name="insights" />
                  <strong>{number(issueCount)}</strong>
                  <span>
                    Health findings
                    <Icon name="arrow" />
                  </span>
                </button>
                <button
                  onClick={() => {
                    setReviewFilter("pending");
                    update({ tab: "Quality & Governance" });
                  }}
                >
                  <Icon name="check" />
                  <strong>{pending.length}</strong>
                  <span>
                    Awaiting review
                    <Icon name="arrow" />
                  </span>
                </button>
              </div>
              <SectionTitle title="Connected repositories">
                <span className="chip">{state.repositories.length}</span>
              </SectionTitle>
              {state.repositories.map((r) => {
                const jobs = state.syncStatus?.[r.id] ?? [];
                const latest = jobs
                  .map((j) => j.at)
                  .sort()
                  .at(-1);
                const failures = jobs.reduce(
                  (n, j) => n + (j.errorCount ?? j.errors.length),
                  0,
                );
                const cancelled = jobs.some((j) => j.cancelled);
                return (
                  <article
                    className="repo-card"
                    data-tour="repositories"
                    key={r.id}
                  >
                    <div className="row">
                      <span className="tile-icon">
                        <Icon name={r.kind === "code" ? "code" : "explorer"} />
                      </span>
                      <div className="grow">
                        <strong>{r.name}</strong>
                        <small>{r.kind} repository</small>
                      </div>
                      <span
                        className={`chip ${failures || cancelled ? "warning" : ""}`}
                      >
                        {failures
                          ? `${failures} sync errors`
                          : cancelled
                            ? "Sync interrupted"
                            : latest
                              ? "Synced"
                              : "Ready to sync"}
                      </span>
                    </div>
                    <p className="path">{r.roots.join("\n")}</p>
                    <div className="row repo-footer">
                      <small>
                        <Icon name="clock" />
                        {date(latest)}
                      </small>
                      <button
                        className="link"
                        onClick={() =>
                          update({
                            tab: "Knowledge Explorer",
                            repo: r.id,
                            multiRepo: false,
                            repoIds: [],
                            folder: "",
                            selected: [],
                          })
                        }
                      >
                        Explore
                        <Icon name="arrow" />
                      </button>
                      <button
                        className="subtle"
                        disabled={busy}
                        aria-label={`Remove ${r.name}`}
                        onClick={() => send({ type: "removeRepo", id: r.id })}
                      >
                        Remove
                      </button>
                    </div>
                    {jobs.length > 0 && (
                      <details>
                        <summary>Last sync details</summary>
                        {jobs.map((j, i) => (
                          <div key={i}>
                            <p>
                              {j.scanned} scanned · {j.changed} updated ·{" "}
                              {j.removed} removed · {j.skipped} skipped
                            </p>
                            {j.errors.map((e, n) => (
                              <p className="path" key={n}>
                                {e}
                              </p>
                            ))}
                          </div>
                        ))}
                      </details>
                    )}
                    {!r.bundleSourceId && (
                      <div className="toolbar bundle-action">
                        <button
                          className="primary"
                          disabled={busy}
                          onClick={() =>
                            send({ type: "createBundle", repoId: r.id })
                          }
                        >
                          <Icon name="plus" />
                          Proceed to Create OKF
                        </button>
                        <small>
                          Choose a location for this repository’s bundle.
                        </small>
                      </div>
                    )}
                  </article>
                );
              })}
            </>
          )}
          <article className="privacy-card">
            <Icon name="shield" />
            <div>
              <strong>Your sources stay in your control</strong>
              <p>
                Keyword search works offline. Model connections ask for consent.
                Existing-file changes enter your review queue. New OKF bundles
                are created in the location you choose.
              </p>
            </div>
          </article>
        </section>
      )}

      {tab === "Repositories" && (
        <GitPanel
          repositories={state.repositories}
          busy={busy || !state.trusted}
          send={send}
        />
      )}
      {[
        "Knowledge Explorer",
        "AI Assistant",
        "Vector Studio",
        "Agent Hub",
      ].includes(tab) && (
        <>
          <SectionTitle
            eyebrow={
              tab === "Knowledge Explorer"
                ? "FIND & CONNECT"
                : "GROUNDED IN YOUR SOURCES"
            }
            title={
              tab === "Knowledge Explorer"
                ? "Knowledge explorer"
                : tab === "AI Assistant"
                  ? "Ask your workspace"
                  : "Evidence scope"
            }
          />
          <ScopeControls
            prefs={prefs}
            repositories={state.repositories}
            records={state.records}
            update={update}
            disabled={busy}
            unavailable={unavailable}
          />
        </>
      )}

      {tab === "Knowledge Explorer" && (
        <section aria-label="Knowledge Explorer">
          <form className="search-panel" onSubmit={performSearch}>
            <label>
              Search knowledge
              <div className="search-field">
                <Icon name="search" />
                <input
                  ref={searchInput}
                  value={query}
                  onChange={(e) => update({ query: e.target.value })}
                  placeholder="Concepts, symbols, decisions…"
                  maxLength={4000}
                />
              </div>
            </label>
            <div className="row">
              <select
                aria-label="Search strategy"
                value={strategy}
                onChange={(e) =>
                  update({
                    strategy: e.target.value as Preferences["strategy"],
                  })
                }
              >
                <option value="keyword">Keyword · offline</option>
                <option value="semantic">Semantic · model required</option>
                <option value="hybrid">Hybrid</option>
              </select>
              <button
                className="primary"
                type="submit"
                disabled={busy || !query.trim() || !state.trusted}
              >
                Search
                <Icon name="arrow" />
              </button>
            </div>
          </form>
          <details className="saved-panel">
            <summary>
              <Icon name="bookmark" />
              Saved views
              <span className="muted">{prefs.saved.length} / 12</span>
            </summary>
            <p className="muted">
              Remember your query, scope and source filters on this machine.
              Restoring a view never runs a model request.
            </p>
            <div className="row">
              <label className="grow">
                View name
                <input
                  value={viewName}
                  maxLength={60}
                  onChange={(e) => setViewName(e.target.value)}
                  placeholder="e.g. Authentication docs"
                />
              </label>
              <button
                disabled={!viewName.trim() || prefs.saved.length >= 12}
                onClick={saveView}
              >
                Save view
              </button>
            </div>
            {prefs.saved.map((v) => (
              <div className="saved-row" key={v.id}>
                <button className="link" onClick={() => restoreView(v)}>
                  <Icon name="bookmark" />
                  {v.name}
                </button>
                <button
                  className="icon-button"
                  aria-label={`Delete saved view ${v.name}`}
                  onClick={() =>
                    update({ saved: prefs.saved.filter((s) => s.id !== v.id) })
                  }
                >
                  <Icon name="close" />
                </button>
              </div>
            ))}
          </details>
          {searched && (
            <div className="search-results">
              <SectionTitle title="Search results">
                <span className="chip">{hits.length}</span>
                <button
                  className="link"
                  onClick={() => {
                    setHits([]);
                    setSearched(false);
                  }}
                >
                  Clear results
                </button>
              </SectionTitle>
              {!hits.length && (
                <Empty title="No matching evidence" icon="search">
                  <p>
                    Try a different phrase, broaden your scope, or sync your
                    repositories.
                  </p>
                </Empty>
              )}
              {hits.map((h, i) => (
                <article className="result-card" key={h.citation.chunkId}>
                  <div className="eyebrow">
                    EVIDENCE {i + 1} · SCORE {h.citation.score.toFixed(3)}
                  </div>
                  <button
                    className="link result-title"
                    onClick={() => open(h.recordId, h.citation.span.start)}
                  >
                    {h.citation.title} · L{h.citation.span.start}–
                    {h.citation.span.end}
                  </button>
                  <p className="excerpt">{h.text}</p>
                </article>
              ))}
            </div>
          )}
          <div data-tour="sources" />
          <SectionTitle title="Sources">
            <span className="chip">{number(records.length)}</span>
            <select
              aria-label="Explorer display"
              value={display}
              onChange={(e) =>
                update({ display: e.target.value as Preferences["display"] })
              }
            >
              <option value="list">List</option>
              <option value="tree">Tree</option>
              <option value="graph">Graph</option>
            </select>
          </SectionTitle>
          {display !== "tree" && (
            <div className="source-controls">
              <p className="muted">
                Filters apply to this list and graph. To narrow search or
                answers, select files or set Scope above.
              </p>
              <label>
                Filter sources
                <input
                  placeholder="File path or title"
                  value={prefs.sourceFilter}
                  onChange={(e) => update({ sourceFilter: e.target.value })}
                />
              </label>
              <div className="scope-fields">
                <label>
                  Source type
                  <select
                    value={prefs.kind}
                    onChange={(e) =>
                      update({ kind: e.target.value as Preferences["kind"] })
                    }
                  >
                    <option value="all">All types</option>
                    <option value="document">Documents</option>
                    <option value="code">Code</option>
                  </select>
                </label>
                <label>
                  Sort by
                  <select
                    value={prefs.sort}
                    onChange={(e) =>
                      update({ sort: e.target.value as Preferences["sort"] })
                    }
                  >
                    <option value="path">File path</option>
                    <option value="title">Title</option>
                    <option value="recent">Recently indexed</option>
                  </select>
                </label>
              </div>
            </div>
          )}
          {display !== "tree" && sourceCount > state.records.length && (
            <p className="muted">
              Browsing the first {number(state.records.length)} of{" "}
              {number(sourceCount)} sources. Knowledge search checks the full
              catalog.
            </p>
          )}
          {display === "tree" && state.repositories.length ? (
            <FileTree
              repositories={state.repositories.filter((r) =>
                prefs.multiRepo
                  ? prefs.repoIds.includes(r.id)
                  : !repo || r.id === repo,
              )}
              selected={selected}
              folder={folder}
              disabled={busy || !state.trusted}
              send={send}
              select={(id, checked) =>
                update({
                  selected: checked
                    ? [...new Set([...selected, id])]
                    : selected.filter((v) => v !== id),
                })
              }
            />
          ) : !records.length ? (
            <Empty
              title={
                sourceCount
                  ? "No sources match these filters"
                  : "No sources connected yet"
              }
            >
              <p>
                {sourceCount
                  ? "Change the folder, type or path filter to see more sources."
                  : "Import a repository to start exploring your knowledge."}
              </p>
              <button
                onClick={() =>
                  sourceCount
                    ? update({
                        sourceFilter: "",
                        kind: "all",
                        repo: "",
                        folder: "",
                        selected: [],
                      })
                    : command("import")
                }
              >
                {sourceCount ? "Reset filters" : "Import source"}
              </button>
            </Empty>
          ) : display === "graph" ? (
            <>
              <p className="muted">
                Graph follows your source filters and selected files. Choose a
                node to inspect change impact. Dotted relations are approximate.
              </p>
              <div className="graph" role="list" aria-label="Knowledge graph">
                <div role="listitem" className="graph-visual">
                  <GraphVisual
                    graph={graph}
                    onSelect={(id) => send({ type: "impact", id, depth: 3 })}
                  />
                </div>
                {graph.nodes.slice(0, 100).map((n) => (
                  <article role="listitem" key={n.id}>
                    <span className="chip">{n.kind}</span>
                    <button
                      className="link graph-label"
                      onClick={() =>
                        send({ type: "impact", id: n.id, depth: 3 })
                      }
                    >
                      {n.label}
                    </button>
                    {(n.recordId || recordMap.has(n.id)) && (
                      <button
                        className="link"
                        onClick={() => open(n.recordId ?? n.id)}
                      >
                        Open {n.label} source
                      </button>
                    )}
                    {graph.edges
                      .filter((e) => e.from === n.id)
                      .slice(0, 8)
                      .map((e, i) => (
                        <div
                          className={`edge ${e.resolved ? "" : "approximate"}`}
                          key={i}
                        >
                          {e.kind} → {nodes.get(e.to)?.label ?? e.to}
                        </div>
                      ))}
                  </article>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="row list-toolbar">
                <button
                  className="link"
                  onClick={() =>
                    update({
                      selected: [
                        ...new Set([
                          ...selected,
                          ...pageRecords.map((r) => r.id),
                        ]),
                      ],
                    })
                  }
                >
                  Select page
                </button>
                <small>
                  {currentPage * 50 + 1}–
                  {Math.min((currentPage + 1) * 50, records.length)} of{" "}
                  {records.length}
                </small>
              </div>
              <div className="source-list">
                {pageRecords.map((r) => (
                  <div
                    className={`source ${selected.includes(r.id) ? "is-selected" : ""}`}
                    key={r.id}
                  >
                    <input
                      type="checkbox"
                      aria-label={`Select ${r.path}`}
                      checked={selected.includes(r.id)}
                      onChange={(e) =>
                        update({
                          selected: e.target.checked
                            ? [...selected, r.id]
                            : selected.filter((id) => id !== r.id),
                        })
                      }
                    />
                    <Icon name={r.kind === "code" ? "code" : "document"} />
                    <button
                      className="link source-link"
                      onClick={() => open(r.id)}
                    >
                      <strong>{r.path.split("/").at(-1)}</strong>
                      <small>
                        {r.path.includes("/")
                          ? r.path.slice(0, r.path.lastIndexOf("/"))
                          : state.repositories.find(
                              (repo) => repo.id === r.repoId,
                            )?.name}
                      </small>
                    </button>
                    <span className="chip">
                      {r.kind === "document" ? "doc" : "code"}
                    </span>
                  </div>
                ))}
              </div>
              {pageCount > 1 && (
                <div className="pagination">
                  <button
                    disabled={!currentPage}
                    onClick={() => setPage(currentPage - 1)}
                  >
                    Previous
                  </button>
                  <span>
                    Page {currentPage + 1} of {pageCount}
                  </span>
                  <button
                    disabled={currentPage === pageCount - 1}
                    onClick={() => setPage(currentPage + 1)}
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
          {selected.length > 0 && (
            <div className="selection-bar">
              <strong>{selected.length} selected</strong>
              <button
                className="primary"
                onClick={() => update({ tab: "AI Assistant" })}
              >
                Ask about selection
              </button>
              {selected.length === 2 && (
                <button
                  onClick={() => send({ type: "compare", ids: selected })}
                >
                  Compare selected
                </button>
              )}
            </div>
          )}
          {detail && (
            <article className="preview-panel">
              <div className="row">
                <div className="eyebrow grow">SOURCE PREVIEW</div>
                <button
                  className="icon-button"
                  aria-label="Close source preview"
                  onClick={() => setDetail(undefined)}
                >
                  <Icon name="close" />
                </button>
              </div>
              <h2>{detail.title}</h2>
              <button
                disabled={busy}
                onClick={() =>
                  update({
                    tab: "AI Assistant",
                    selected: [detail.id],
                    repo: "",
                    repoIds: [],
                    multiRepo: false,
                    folder: "",
                  })
                }
              >
                Ask AI about this document
              </button>
              <p className="path">{detail.path}</p>
              <div className="row">
                <span className="chip">{detail.status}</span>
                <span className="chip">
                  Owner: {String(detail.metadata.owner ?? "unassigned")}
                </span>
              </div>
              <p className="muted">
                Source hash {detail.contentHash.slice(0, 12)} · Indexed{" "}
                {date(detail.indexedAt)} · Commit{" "}
                {detail.commit?.slice(0, 12) ?? "not recorded"}
              </p>
              <details>
                <summary>Provenance, outline & backlinks</summary>
                <p className="path">{detail.sourceUri}</p>
                <p>
                  Observed source facts. Static relationships may be
                  approximate; generated conclusions require review.
                </p>
                {detail.headings.map((h) => (
                  <button
                    className="link citation"
                    key={h.line}
                    onClick={() => open(detail.id, h.line)}
                  >
                    {h.title}
                  </button>
                ))}
                {state.graph.edges
                  .filter((e) => e.to === detail.id && e.kind === "references")
                  .map((e, i) => {
                    const n = nodes.get(e.from);
                    return n?.recordId ? (
                      <button
                        className="link citation"
                        key={i}
                        onClick={() => open(n.recordId!)}
                      >
                        {n.label}
                      </button>
                    ) : null;
                  })}
                {!detail.headings.length &&
                  !state.graph.edges.some(
                    (e) => e.to === detail.id && e.kind === "references",
                  ) && (
                    <p className="muted">
                      No headings or incoming document links.
                    </p>
                  )}
              </details>
              <pre>{detail.content}</pre>
              {detail.kind === "document" && (
                <details>
                  <summary>Edit frontmatter</summary>
                  <label>
                    Frontmatter YAML
                    <textarea
                      rows={7}
                      value={metadata}
                      onChange={(e) => setMetadata(e.target.value)}
                    />
                  </label>
                  <button
                    disabled={busy}
                    onClick={() =>
                      send({ type: "metadata", id: detail.id, yaml: metadata })
                    }
                  >
                    Propose metadata change
                  </button>
                </details>
              )}
              <button
                onClick={() =>
                  send({ type: "impact", id: detail.id, depth: 3 })
                }
              >
                <Icon name="graph" />
                Change impact
              </button>
            </article>
          )}
          {impact !== null && (
            <article>
              <SectionTitle title="Change impact">
                <button
                  className="icon-button"
                  aria-label="Close impact"
                  onClick={() => setImpact(null)}
                >
                  <Icon name="close" />
                </button>
              </SectionTitle>
              <p className="muted">
                Connected nodes within three steps; static relationships may be
                approximate.
              </p>
              {!impact.length && <p>No connected nodes found.</p>}
              {impact.map((id) => {
                const n = nodes.get(id);
                return (
                  <div key={id}>
                    {n?.recordId ? (
                      <button
                        className="link citation"
                        onClick={() => open(n.recordId!)}
                      >
                        {n.label}
                      </button>
                    ) : (
                      <p>{n?.label ?? id}</p>
                    )}
                  </div>
                );
              })}
            </article>
          )}
        </section>
      )}

      {tab === "AI Assistant" && (
        <section aria-label="AI Assistant" data-tour="page-content">
          <div className="provider-strip">
            <Icon name={state.provider === "evidence" ? "shield" : "ask"} />
            <div>
              <strong>
                {state.provider === "evidence"
                  ? "Offline evidence"
                  : state.provider}
              </strong>
              <small>
                {state.provider === "evidence"
                  ? "Retrieved excerpts. No model required."
                  : state.model || "Choose a model in Settings"}
              </small>
            </div>
            <button
              className="link"
              onClick={() =>
                send({ type: "configureSection", section: "Chat provider" })
              }
            >
              Choose model
            </button>
          </div>
          <label>
            Task
            <select value={task} onChange={(e) => setTask(e.target.value)}>
              {[
                "answer",
                "summarize",
                "compare",
                "explain",
                "FAQ",
                "requirements",
                "ADR",
                "tests",
              ].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          {!answer && (
            <div className="prompt-suggestions">
              {[
                {
                  label: "Summarize sources",
                  task: "summarize",
                  question: selected.length
                    ? "Summarize these selected files."
                    : "Summarize the authentication flow.",
                },
                {
                  label: "Find requirements",
                  task: "requirements",
                  question:
                    "Which requirements are established by these sources?",
                },
                {
                  label: "Explain the code",
                  task: "explain",
                  question:
                    "Explain the responsibilities and dependencies of this code.",
                },
              ].map((p) => (
                <button
                  key={p.task}
                  onClick={() => {
                    setTask(p.task);
                    setQuestion(p.question);
                  }}
                >
                  {p.label}
                  <Icon name="arrow" />
                </button>
              ))}
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setAnswer("");
              setCitations([]);
              send({ type: "ask", question, scope, task });
            }}
          >
            <label>
              Question
              <textarea
                rows={5}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                maxLength={8000}
                placeholder="For example: How does api_router handle authentication?"
                data-tour="question"
                required
              />
            </label>
            <div className="row">
              <small className="grow">
                Only relevant excerpts from this scope are sent.
              </small>
              <button
                type="button"
                disabled={
                  busy || !question.trim() || !state.trusted || unavailable
                }
                onClick={() =>
                  send({ type: "ask", question, scope, task, preview: true })
                }
              >
                Preview context
              </button>
              <button
                className="primary"
                type="submit"
                disabled={
                  busy || !question.trim() || !state.trusted || unavailable
                }
              >
                Ask in scope
                <Icon name="arrow" />
              </button>
            </div>
          </form>
          {context && (
            <aside className="context-preview" role="status">
              <strong>
                {context.preview ? "Context preview" : "Context used"}
              </strong>
              <p>
                {context.excerpts} relevant excerpts selected from{" "}
                {number(context.workspaceChunks)} indexed chunks.
              </p>
              <div className="feature-tags">
                <span>≈ {number(context.evidenceTokens)} evidence tokens</span>
                <span>≈ {number(context.promptTokens)} total input tokens</span>
                <span>{number(context.limit)} token limit</span>
              </div>
              <small>
                {context.preview
                  ? "No model contacted. A new question or source sync may change this selection."
                  : context.modelRequest
                    ? "Includes your question, instructions, citations, and selected excerpts."
                    : "No model request; evidence stays local."}{" "}
                Token counts are estimates.
              </small>
            </aside>
          )}
          <SectionTitle title="Answer">
            {answer && (
              <button
                className="link"
                disabled={busy}
                onClick={() => {
                  setAnswer("");
                  setCitations([]);
                }}
              >
                Clear answer
              </button>
            )}
          </SectionTitle>
          <article
            data-tour="answer"
            aria-live="polite"
            aria-label="Answer"
            className={`answer ${answer ? "" : "answer-empty"}`}
          >
            {answer || (
              <>
                <Icon name="ask" />
                <p>Ask a question to bring the evidence together.</p>
                <small>Answers and source citations will appear here.</small>
              </>
            )}
          </article>
          {citations.length > 0 && (
            <>
              <h3>Evidence used · {citations.length} excerpts</h3>
              {citations.map((h, i) => (
                <details key={h.citation.chunkId} className="evidence-excerpt">
                  <summary>
                    [{i + 1}] {h.citation.title} · lines {h.citation.span.start}
                    –{h.citation.span.end}
                  </summary>
                  <pre>{h.text}</pre>
                  <button
                    key={h.citation.chunkId}
                    className="link citation"
                    onClick={() => open(h.recordId, h.citation.span.start)}
                  >
                    <span className="citation-number">{i + 1}</span>
                    {h.citation.title} · lines {h.citation.span.start}–
                    {h.citation.span.end}
                  </button>
                </details>
              ))}
            </>
          )}
        </section>
      )}

      {tab === "Vector Studio" && (
        <VectorStudio state={state} busy={busy} scope={scope} send={send} />
      )}
      {tab === "Agent Hub" && (
        <AgentHub state={state} busy={busy} scope={scope} send={send} />
      )}

      {tab === "Quality & Governance" && (
        <section aria-label="Quality & Governance" data-tour="page-content">
          <SectionTitle
            eyebrow="QUALITY & HUMAN REVIEW"
            title="Knowledge health"
          />
          <div className="health-summary">
            <div>
              <strong>
                {sourceCount ? (state.qualityScore ?? "—") : "—"}
                <small>/ 100</small>
              </strong>
              <span>Quality score</span>
            </div>
            <div>
              <strong>
                {sourceCount && state.requirementCoverage !== undefined
                  ? `${Math.round(state.requirementCoverage * 100)}%`
                  : "—"}
              </strong>
              <span>Static requirement coverage</span>
            </div>
          </div>
          <p className="muted">
            {errors} errors · {warnings} warnings · {state.auditCount} recent
            audit events. Coverage and some findings use static heuristics.
          </p>
          <div className="toolbar">
            <button
              disabled={busy}
              onClick={() => send({ type: "command", command: "sync" })}
            >
              Refresh validation
            </button>
            <button
              disabled={busy || !state.trusted}
              onClick={() => send({ type: "exportDiagnostics" })}
            >
              Export diagnostics
            </button>
          </div>
          <Traceability
            busy={busy || !state.trusted}
            send={send}
            records={state.records}
          />
          <SectionTitle title="Findings">
            <span className="chip">{filteredIssues.length}</span>
          </SectionTitle>
          <div className="scope-fields">
            <label>
              Severity
              <select
                value={severity}
                onChange={(e) => {
                  setSeverity(e.target.value);
                  setIssueLimit(30);
                }}
              >
                <option value="all">All severities</option>
                <option value="error">Errors</option>
                <option value="warning">Warnings</option>
                <option value="info">Information</option>
              </select>
            </label>
            <label>
              Filter findings
              <input
                value={findingFilter}
                placeholder="Path, message or rule"
                onChange={(e) => {
                  setFindingFilter(e.target.value);
                  setIssueLimit(30);
                }}
              />
            </label>
          </div>
          {issueCount > state.issues.length && (
            <p className="muted">
              Showing the first {state.issues.length} of {issueCount} findings.
              Filters apply to this loaded set.
            </p>
          )}
          {!filteredIssues.length && (
            <Empty
              title={
                sourceCount
                  ? "No findings in this view"
                  : "Health checks start with your sources"
              }
              icon="check"
            >
              <p>
                {sourceCount
                  ? "Try another severity or clear the filter to see other findings."
                  : "Import a repository to check metadata, links and coverage."}
              </p>
            </Empty>
          )}
          {filteredIssues.slice(0, issueLimit).map((i, n) => (
            <article
              className={`finding ${i.severity}`}
              key={`${i.recordId}:${i.code}:${n}`}
            >
              <div className="row">
                <span className={`chip ${i.severity}`}>{i.severity}</span>
                <small>{i.code}</small>
              </div>
              <p>{i.message}</p>
              {recordMap.has(i.recordId) && (
                <button
                  className="link"
                  onClick={() => open(i.recordId, i.line)}
                >
                  <Icon name="document" />
                  {recordMap.get(i.recordId)?.path}
                  {i.line ? `:${i.line}` : ""}
                  <span className="sr-only"> Open source</span>
                </button>
              )}
            </article>
          ))}
          {filteredIssues.length > issueLimit && (
            <button onClick={() => setIssueLimit(issueLimit + 30)}>
              Show more findings ({filteredIssues.length - issueLimit}{" "}
              remaining)
            </button>
          )}
          <SectionTitle title="Review queue">
            <span className="chip">{pending.length} pending</span>
          </SectionTitle>
          <label>
            Review status
            <select
              value={reviewFilter}
              onChange={(e) => setReviewFilter(e.target.value)}
            >
              {["pending", "approved", "rejected", "undone", "all"].map((s) => (
                <option key={s} value={s}>
                  {s === "all"
                    ? "All changes"
                    : s[0].toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </label>
          {pending.length > 0 && (
            <div className="toolbar" data-tour="review">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  aria-label="Select all pending changes"
                  checked={pending.every((p) => reviewSelected.includes(p.id))}
                  onChange={(e) =>
                    setReviewSelected(
                      e.target.checked ? pending.map((p) => p.id) : [],
                    )
                  }
                />
                Select all ({pending.length})
              </label>
              <span className="muted">
                {
                  reviewSelected.filter((id) =>
                    pending.some((p) => p.id === id),
                  ).length
                }{" "}
                selected
              </span>
              <button
                className="primary"
                disabled={busy}
                onClick={() =>
                  send({
                    type: "batchReview",
                    ids: [],
                    all: true,
                    action: "approve",
                  })
                }
              >
                Review &amp; approve all
              </button>
              <button
                disabled={busy || !reviewSelected.length}
                onClick={() => {
                  send({
                    type: "batchReview",
                    ids: reviewSelected.filter((id) =>
                      pending.some((p) => p.id === id),
                    ),
                    action: "approve",
                  });
                  setReviewSelected([]);
                }}
              >
                Review &amp; approve selected
              </button>
              <button
                disabled={busy || !reviewSelected.length}
                onClick={() => {
                  send({
                    type: "batchReview",
                    ids: reviewSelected.filter((id) =>
                      pending.some((p) => p.id === id),
                    ),
                    action: "reject",
                  });
                  setReviewSelected([]);
                }}
              >
                Reject selected
              </button>
            </div>
          )}
          {!proposals.length && (
            <Empty title="No changes in this queue" icon="check">
              <p>
                New OKF bundles are created directly. Updates to an existing
                bundle, frontmatter edits and document templates appear here for
                review.
              </p>
            </Empty>
          )}
          {proposals.map((p) => (
            <article key={p.id}>
              {p.status === "pending" && (
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    aria-label={`Select proposal ${p.path}`}
                    checked={reviewSelected.includes(p.id)}
                    onChange={(e) =>
                      setReviewSelected((ids) =>
                        e.target.checked
                          ? [...ids, p.id]
                          : ids.filter((id) => id !== p.id),
                      )
                    }
                  />
                  Select change
                </label>
              )}
              <div className="row">
                <strong className="grow">{p.path}</strong>
                <span className="chip">{p.status}</span>
              </div>
              <p>{p.reason}</p>
              <div className="toolbar">
                <button
                  onClick={() =>
                    send({ type: "review", id: p.id, action: "diff" })
                  }
                >
                  View diff
                </button>
                {p.status === "pending" && (
                  <>
                    <button
                      disabled={busy}
                      className="primary"
                      onClick={() =>
                        send({ type: "review", id: p.id, action: "approve" })
                      }
                    >
                      Review & approve
                    </button>
                    <button
                      disabled={busy}
                      onClick={() =>
                        send({ type: "review", id: p.id, action: "reject" })
                      }
                    >
                      Reject
                    </button>
                  </>
                )}
                {p.status === "approved" && (
                  <button
                    disabled={busy}
                    onClick={() =>
                      send({ type: "review", id: p.id, action: "undo" })
                    }
                  >
                    Undo
                  </button>
                )}
              </div>
            </article>
          ))}
          <details className="panel">
            <summary>Document tools & export</summary>
            {state.repositories.map((r) => (
              <article key={r.id}>
                <strong>{r.name}</strong>
                <div className="toolbar">
                  {["ADR", "Requirement", "Glossary"].map((template) => (
                    <button
                      key={template}
                      disabled={busy}
                      onClick={() =>
                        send({ type: "template", template, repoId: r.id })
                      }
                    >
                      New {template}
                    </button>
                  ))}
                </div>
              </article>
            ))}
            <div className="toolbar">
              <button onClick={() => command("export")}>
                Export knowledge
              </button>
              <button onClick={() => command("agent")}>Install agent</button>
            </div>
          </details>
          <details className="panel danger-panel">
            <summary>Local data controls</summary>
            <p>
              Delete derived indexes and credentials, and revoke consent. This
              requires confirmation; your source files are preserved. Saved view
              preferences can be cleared separately below.
            </p>
            <button disabled={busy} onClick={() => command("clear")}>
              Delete index & revoke consent
            </button>
            <button
              className="subtle"
              onClick={() => {
                setPrefs(restorePreferences({ tab: "Quality & Governance" }));
                setNotice(
                  "Saved views, filters and navigation preferences cleared.",
                );
              }}
            >
              Clear saved views & preferences
            </button>
          </details>
        </section>
      )}
      <footer>
        <Icon name="shield" />
        <span>
          Local source of truth · Human-reviewed changes · No telemetry
        </span>
        <span className="footer-version">
          Parakram Jain · Studio {state.version ?? "dev"} · OKF 0.2
        </span>
      </footer>
    </main>
  );
}
