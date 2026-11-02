import React, { useEffect, useRef, useState } from "react";
import type { AgentContextPack, Scope } from "../src/domain/types";
import type { StudioServices } from "./VectorStudio";
export function AgentHub({
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
  const packRequest = useRef("");
  const toolRequest = useRef("");
  const scopeKey = JSON.stringify(scope);
  const dispatch = (m: Record<string, unknown>) => {
    const requestId = crypto.randomUUID();
    if (m.type === "agentPack") packRequest.current = requestId;
    else toolRequest.current = requestId;
    send({ ...m, requestId });
  };
  const [question, setQuestion] = useState("");
  const [budget, setBudget] = useState(3000);
  const [pack, setPack] = useState<AgentContextPack>();
  const [tool, setTool] = useState("get_index_status");
  const [query, setQuery] = useState("");
  const [id, setId] = useState("");
  const [result, setResult] = useState("");
  useEffect(() => {
    packRequest.current = "";
    setPack(undefined);
  }, [scopeKey, question, budget]);
  useEffect(() => {
    toolRequest.current = "";
    setResult("");
  }, [scopeKey, tool, query, id]);
  useEffect(() => {
    const listener = (e: MessageEvent) => {
      if (
        e.data?.type === "agentPack" &&
        e.data.requestId === packRequest.current
      )
        setPack(e.data.pack);
      if (
        e.data?.type === "agentResult" &&
        e.data.requestId === toolRequest.current
      )
        setResult(e.data.result);
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, []);
  const enabled = state.trusted && !busy;
  const catalog = state.agent?.tools ?? [];
  const needsQuery = [
    "search_knowledge",
    "get_code_context",
    "validate_against_knowledge",
  ].includes(tool);
  const needsID = [
    "get_document",
    "get_dependencies",
    "analyze_change_impact",
    "trace_requirement",
  ].includes(tool);
  return (
    <section aria-label="Agent Hub" data-tour="page-content">
      <div className="service-status" data-tour="agent-status">
        <span className="chip">
          {!state.trusted
            ? "Not configured"
            : state.agent?.registered
              ? "Registered"
              : "Unsupported"}
        </span>
        <div>
          <h2>Give agents reliable context</h2>
          <p>
            The OKF MCP provider exposes local knowledge, citations, and
            reviewed proposals. Registration does not prove that your coding
            agent has connected.
          </p>
          <small>
            Local bridge: {state.agent?.bridge ? "available" : "unavailable"} ·
            Agent client connection: Not Verified
          </small>
        </div>
      </div>
      <article>
        <h3>Verify the MCP runtime</h3>
        <p>
          Start the packaged stdio server, discover its tools, and call index
          status through the authenticated bridge. No source files are changed.
        </p>
        <button
          disabled={!enabled || !state.agent?.bridge}
          onClick={() => send({ type: "agentRuntimeTest" })}
        >
          Test MCP runtime
        </button>
        <p role="status">
          {state.agent?.runtime
            ? `${state.agent.runtime.status}: ${state.agent.runtime.detail} (${state.agent.runtime.latencyMs} ms)`
            : "Not Verified — run the check to verify this installation."}
        </p>
      </article>
      <article data-tour="agent-setup">
        <h3>Connect your coding agent</h3>
        <ol>
          <li>
            Use VS Code’s MCP server list to enable <strong>OKF Studio</strong>.
          </li>
          <li>
            Let the client discover tools, starting with{" "}
            <code>get_index_status</code> and <code>search_knowledge</code>.
          </li>
          <li>
            Ask the client to cite file and line evidence. Approve any proposed
            knowledge updates separately.
          </li>
        </ol>
        <p>
          Custom clients can use an exported context pack. The extension’s
          private bridge credentials are managed by VS Code and are never shown
          here.
        </p>
        <button
          disabled={!enabled}
          onClick={() => send({ type: "command", command: "agent" })}
        >
          Install optional knowledge agent
        </button>
        <button onClick={() => send({ type: "guide", page: "Agent Hub" })}>
          Agent setup guide
        </button>
      </article>
      <article data-tour="agent-pack">
        <h3>Prepare an agent context pack</h3>
        <p>
          Use the evidence scope above. Preview or export bounded, redacted
          evidence and citations without a model request.
        </p>
        <label>
          Coding task
          <textarea
            value={question}
            onChange={(e) => {
              setQuestion(e.target.value);
              setPack(undefined);
            }}
            maxLength={8000}
            placeholder="Which authentication tests cover token expiry?"
          />
        </label>
        <label>
          Estimated input-token budget
          <input
            type="number"
            min={500}
            max={12000}
            value={budget}
            onChange={(e) => setBudget(Number(e.target.value))}
          />
        </label>
        <div className="toolbar">
          <button
            disabled={!enabled || !question.trim()}
            onClick={() =>
              dispatch({
                type: "agentPack",
                question,
                scope,
                tokenBudget: budget,
              })
            }
          >
            Preview context pack
          </button>
          <button
            disabled={!enabled || !question.trim()}
            onClick={() =>
              dispatch({
                type: "agentPack",
                question,
                scope,
                tokenBudget: budget,
                save: true,
              })
            }
          >
            Export context pack
          </button>
        </div>
        {pack && (
          <div role="status">
            <p>
              {pack.documents.length} excerpts · approximately{" "}
              {pack.estimatedTokens} tokens · {pack.tokenBudget} token limit
            </p>
            {!pack.documents.length && (
              <p>
                No relevant evidence. Name a concrete file, symbol, or topic.
              </p>
            )}
            <details>
              <summary>Inspect context JSON</summary>
              <pre className="bounded-output">
                {JSON.stringify(pack, null, 2)}
              </pre>
            </details>
            {pack.documents.map((h, i) => (
              <button
                key={h.citation.chunkId}
                className="link"
                onClick={() =>
                  send({
                    type: "open",
                    id: h.recordId,
                    line: h.citation.span.start,
                  })
                }
              >
                [{i + 1}] {h.citation.title} · lines {h.citation.span.start}–
                {h.citation.span.end}
              </button>
            ))}
          </div>
        )}
      </article>
      <article data-tour="agent-tools">
        <h3>Tool playground</h3>
        <p>
          Try a read-only tool locally. Discover document or node IDs with
          search and dependency results. Requirement tracing accepts an ID such
          as REQ-001.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setResult("");
            dispatch({
              type: "agentTool",
              name: tool,
              args: needsQuery ? { query, scope } : needsID ? { id } : {},
            });
          }}
        >
          <label>
            Read-only tool
            <select
              value={tool}
              onChange={(e) => {
                setTool(e.target.value);
                setResult("");
              }}
            >
              {catalog
                .filter((t) => t.readOnly)
                .map((t) => (
                  <option key={t.name}>{t.name}</option>
                ))}
            </select>
          </label>
          {needsQuery && (
            <label>
              Tool query
              <input
                required
                maxLength={4000}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
          )}
          {needsID && (
            <label>
              Document, node, or requirement ID
              <input
                required
                value={id}
                onChange={(e) => setId(e.target.value)}
              />
            </label>
          )}
          <button disabled={!enabled || !catalog.length} type="submit">
            Run read-only tool
          </button>
        </form>
        {result && (
          <pre className="bounded-output" aria-label="Tool result">
            {result}
          </pre>
        )}
      </article>
      <h3>Available tools · {catalog.length}</h3>
      <div className="tool-catalog">
        {catalog.map((t) => (
          <details key={t.name}>
            <summary>
              <code>{t.name}</code>
              <span className="chip">
                {t.readOnly ? "Read only" : "Queues review"}
              </span>
            </summary>
            <p>{t.description}</p>
            {!t.readOnly && (
              <p>
                An agent must receive permission to queue a proposal. A separate
                diff and approval is required before any file changes.
              </p>
            )}
          </details>
        ))}
      </div>
    </section>
  );
}
