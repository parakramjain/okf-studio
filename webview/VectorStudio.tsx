import React, { useEffect, useRef, useState } from "react";
import type { ProviderConfig, Scope, SearchHit } from "../src/domain/types";
import type { ConnectionResult } from "../src/providers/diagnostics";
import type { Readiness } from "../src/domain/readiness";
export interface StudioServices {
  version?: string;
  publisher?: string;
  embedding?: ProviderConfig;
  vectorEndpoint?: string;
  chunkLines?: number;
  chunkOverlap?: number;
  vectorBackend?: string;
  namespace?: string;
  chunkCount: number;
  trusted: boolean;
  indexState?: { status: Readiness; detail: string; indexed: number };
  connections?: Record<string, ConnectionResult>;
  agent?: {
    registered: boolean;
    bridge: boolean;
    runtime?: { status: string; detail: string; at: string; latencyMs: number };
    tools: { name: string; description: string; readOnly: boolean }[];
  };
}
export function VectorStudio({
  state,
  busy,
  scope,
  send,
}: {
  state: StudioServices;
  busy: boolean;
  scope: Scope;
  send: (m: unknown) => void;
}) {
  const configuration = JSON.stringify({
    embeddingProvider: state.embedding?.provider ?? "none",
    embeddingModel: state.embedding?.model ?? "",
    embeddingEndpoint: state.embedding?.endpoint ?? "",
    vectorBackend: state.vectorBackend ?? "local",
    vectorEndpoint: state.vectorEndpoint ?? "",
    chunkLines: state.chunkLines ?? 60,
    chunkOverlap: state.chunkOverlap ?? 6,
  });
  const [settings, setSettings] = useState(
    () =>
      JSON.parse(configuration) as {
        embeddingProvider: string;
        embeddingModel: string;
        embeddingEndpoint: string;
        vectorBackend: string;
        vectorEndpoint: string;
        chunkLines: number;
        chunkOverlap: number;
      },
  );
  useEffect(() => setSettings(JSON.parse(configuration)), [configuration]);
  const dirty = JSON.stringify(settings) !== configuration;
  const [preview, setPreview] = useState<{
    total: number;
    tokens: number;
    chunks: {
      id: string;
      recordId: string;
      span: { start: number; end: number };
      text: string;
      truncated: boolean;
    }[];
  }>();
  const [query, setQuery] = useState("");
  const [strategy, setStrategy] = useState("keyword");
  const [result, setResult] = useState<{
    hits: SearchHit[];
    latencyMs: number;
  }>();
  const request = useRef("");
  const scopeKey = JSON.stringify(scope);
  useEffect(() => {
    request.current = "";
    setResult(undefined);
  }, [scopeKey]);
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === "chunkPreview") setPreview(e.data);
      if (
        e.data?.type === "results" &&
        e.data.channel === "playground" &&
        e.data.requestId === request.current
      )
        setResult(e.data);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);
  const stateLabel = state.indexState?.status ?? "Not configured";
  const allowed = state.trusted && !busy;
  return (
    <section aria-label="Vector Studio" data-tour="page-content">
      <div className="service-status" role="status">
        <span className="chip">{stateLabel}</span>
        <div>
          <h2>Semantic retrieval, under your control</h2>
          <p>
            {state.indexState?.detail ??
              "Choose a provider to add semantic retrieval. Keyword search works offline."}
          </p>
          <small>
            {state.chunkCount} local chunks · {state.indexState?.indexed ?? 0}{" "}
            active vectors · {state.vectorBackend ?? "local"} storage
          </small>
        </div>
      </div>
      <form
        data-tour="vector-settings"
        onSubmit={(e) => {
          e.preventDefault();
          send({ type: "saveSettings", settings });
        }}
      >
        <fieldset disabled={!allowed}>
          <legend>Embedding and storage settings</legend>
          <p className="muted">
            Chat and embedding models are independent. Settings are saved to
            your VS Code user configuration; credentials stay in SecretStorage.
            Sync after changing chunk sizes.
          </p>
          <div className="settings-grid">
            <label>
              Embedding provider
              <select
                value={settings.embeddingProvider}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    embeddingProvider: e.target.value,
                  })
                }
              >
                {["none", "ollama", "openai", "azure", "compatible"].map(
                  (p) => (
                    <option key={p}>{p}</option>
                  ),
                )}
              </select>
            </label>
            <label>
              Embedding model
              <input
                value={settings.embeddingModel}
                onChange={(e) =>
                  setSettings({ ...settings, embeddingModel: e.target.value })
                }
                placeholder="Model or Azure deployment ID"
                maxLength={200}
              />
            </label>
            <label>
              Embedding endpoint
              <input
                value={settings.embeddingEndpoint}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    embeddingEndpoint: e.target.value,
                  })
                }
                placeholder="Provider base URL"
                maxLength={2000}
              />
            </label>
            <label>
              Vector backend
              <select
                value={settings.vectorBackend}
                onChange={(e) =>
                  setSettings({ ...settings, vectorBackend: e.target.value })
                }
              >
                {["local", "qdrant", "pgvector"].map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
            {settings.vectorBackend === "qdrant" && (
              <label>
                Qdrant endpoint
                <input
                  value={settings.vectorEndpoint}
                  onChange={(e) =>
                    setSettings({ ...settings, vectorEndpoint: e.target.value })
                  }
                  placeholder="https://your-qdrant-host"
                  maxLength={2000}
                />
              </label>
            )}
            <label>
              Lines per chunk
              <input
                type="number"
                min={8}
                max={300}
                value={settings.chunkLines}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    chunkLines: Number(e.target.value),
                  })
                }
              />
            </label>
            <label>
              Overlap lines
              <input
                type="number"
                min={0}
                max={Math.min(100, settings.chunkLines - 1)}
                value={settings.chunkOverlap}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    chunkOverlap: Number(e.target.value),
                  })
                }
              />
            </label>
          </div>
          <div className="toolbar">
            <button
              type="submit"
              className="primary"
              disabled={!dirty || settings.chunkOverlap >= settings.chunkLines}
            >
              Save vector settings
            </button>
            <button
              type="button"
              onClick={() =>
                send({
                  type: "configureSection",
                  section: "Store provider API key",
                })
              }
            >
              Provider credential
            </button>
            <button
              type="button"
              onClick={() =>
                send({
                  type: "configureSection",
                  section: "Store vector credential",
                })
              }
            >
              Vector credential
            </button>
          </div>
          {dirty && (
            <p role="status">Save these changes before testing or indexing.</p>
          )}
        </fieldset>
      </form>
      <div className="cards" data-tour="connection-tests">
        {(["embedding", "vector"] as const).map((target) => (
          <article key={target}>
            <h3>
              {target === "embedding"
                ? "Embedding connection"
                : "Vector storage connection"}
            </h3>
            <span className="chip">
              {state.connections?.[target]?.status ?? "Not Verified"}
            </span>
            <p>
              {state.connections?.[target]?.detail ??
                (target === "embedding"
                  ? "Test a fixed sample without sending repository content."
                  : "Check storage access without changing collections or tables.")}
            </p>
            {state.connections?.[target] && (
              <small>
                {new Date(state.connections[target].at).toLocaleString()} ·{" "}
                {state.connections[target].latencyMs} ms{" "}
                {state.connections[target].dimension
                  ? `· ${state.connections[target].dimension} dimensions`
                  : ""}
              </small>
            )}
            <button
              disabled={
                !allowed ||
                dirty ||
                (target === "embedding" &&
                  settings.embeddingProvider === "none")
              }
              onClick={() => send({ type: "connectionTest", target })}
            >
              Test {target} connection
            </button>
          </article>
        ))}
      </div>
      <article data-tour="vector-build">
        <h3>Preview, build, and maintain</h3>
        <p>
          Embedding jobs can process all indexed chunks. This is separate from
          the small context sent for one AI question. A failed build preserves
          the previous completed namespace.
        </p>
        <div className="toolbar">
          {[
            ["preview", "Preview chunks"],
            ["build", "Build vector index"],
            ["reindex", "Rebuild index"],
            ["rollback", "Rollback index"],
          ].map(([action, label]) => (
            <button
              key={action}
              disabled={
                !allowed ||
                dirty ||
                (action !== "rollback" && !state.chunkCount) ||
                (["build", "reindex"].includes(action) &&
                  (!settings.embeddingModel ||
                    settings.embeddingProvider === "none"))
              }
              onClick={() => send({ type: "index", action })}
            >
              {label}
            </button>
          ))}
          {state.vectorBackend !== "local" && (
            <button
              disabled={!allowed}
              onClick={() => send({ type: "index", action: "cleanup" })}
            >
              Clean remote snapshots
            </button>
          )}
        </div>
        <p className="path">Active namespace: {state.namespace ?? "None"}</p>
        {preview && (
          <div>
            <p>
              {preview.total} chunks · approximately{" "}
              {preview.tokens.toLocaleString()} embedding input tokens.
              Previewing the first {preview.chunks.length} chunks.
            </p>
            {preview.chunks.map((c) => (
              <details key={c.id}>
                <summary>
                  Lines {c.span.start}–{c.span.end}
                  {c.truncated ? " · excerpt truncated" : ""}
                </summary>
                <pre className="bounded-output">{c.text}</pre>
                <button
                  onClick={() =>
                    send({ type: "open", id: c.recordId, line: c.span.start })
                  }
                >
                  Open chunk source
                </button>
              </details>
            ))}
          </div>
        )}
      </article>
      <article data-tour="retrieval-playground">
        <h3>Retrieval playground</h3>
        <p>
          Compare retrieved evidence within the scope above. Scores and latency
          describe retrieval, not proof that an answer is correct.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            request.current = crypto.randomUUID();
            setResult(undefined);
            send({
              type: "search",
              target: "playground",
              query,
              strategy,
              scope,
              requestId: request.current,
            });
          }}
        >
          <label>
            Retrieval query
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              maxLength={4000}
              required
            />
          </label>
          <div className="toolbar">
            <label>
              Retrieval strategy
              <select
                value={strategy}
                onChange={(e) => setStrategy(e.target.value)}
              >
                <option value="keyword">Keyword · offline</option>
                <option value="semantic" disabled={stateLabel !== "Ready"}>
                  Semantic · requires ready index
                </option>
                <option value="hybrid" disabled={stateLabel !== "Ready"}>
                  Hybrid · requires ready index
                </option>
              </select>
            </label>
            <button disabled={!allowed || !query.trim()} type="submit">
              Run retrieval
            </button>
          </div>
        </form>
        {result && (
          <div role="status">
            <p>
              {result.hits.length} excerpts · {result.latencyMs} ms
            </p>
            {!result.hits.length && (
              <p>No evidence matched. Change the question or scope.</p>
            )}
            {result.hits.map((h) => (
              <details key={h.citation.chunkId}>
                <summary>
                  {h.citation.title} · score {h.citation.score.toFixed(3)}
                </summary>
                <pre className="bounded-output">{h.text}</pre>
                <button
                  onClick={() =>
                    send({
                      type: "open",
                      id: h.recordId,
                      line: h.citation.span.start,
                    })
                  }
                >
                  Open evidence source
                </button>
              </details>
            ))}
          </div>
        )}
      </article>
    </section>
  );
}
