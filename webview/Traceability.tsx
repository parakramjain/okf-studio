import React, { useEffect, useRef, useState } from "react";
import type { KnowledgeRecord } from "../src/domain/types";
export function Traceability({
  busy,
  send,
  records,
}: {
  busy: boolean;
  send: (m: unknown) => void;
  records: KnowledgeRecord[];
}) {
  const request = useRef("");
  const [id, setId] = useState("");
  const [result, setResult] = useState<{ nodes: string[]; tested: boolean }>();
  useEffect(() => {
    const listener = (e: MessageEvent) => {
      if (
        e.data?.type === "agentResult" &&
        e.data.name === "trace_requirement" &&
        e.data.requestId === request.current
      ) {
        try {
          const parsed = JSON.parse(e.data.result);
          if (Array.isArray(parsed.nodes)) setResult(parsed);
        } catch {
          setResult(undefined);
        }
      }
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, []);
  return (
    <details className="panel">
      <summary>Requirement → code → test trace</summary>
      <p>
        Find the static links for an indexed requirement. Extracted test
        relations indicate traceability, not passing tests or runtime coverage.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setResult(undefined);
          request.current = crypto.randomUUID();
          send({
            type: "agentTool",
            name: "trace_requirement",
            args: { id },
            requestId: request.current,
          });
        }}
      >
        <label>
          Requirement ID
          <input
            placeholder="REQ-001"
            value={id}
            onChange={(e) => {
              request.current = "";
              setResult(undefined);
              setId(e.target.value);
            }}
            required
          />
        </label>
        <button disabled={busy || !id.trim()}>Trace requirement</button>
      </form>
      {result && (
        <div role="status">
          <p>
            {result.nodes.length} related nodes ·{" "}
            {result.tested
              ? "Extracted test relation found"
              : "No extracted test relation"}
          </p>
          {result.nodes.map((node) => {
            const record = records.find(
              (r) => r.id === node || r.symbols?.some((s) => s.id === node),
            );
            return record ? (
              <button
                key={node}
                className="link citation"
                onClick={() =>
                  send({
                    type: "open",
                    id: record.id,
                    line: record.symbols?.find((s) => s.id === node)?.span
                      .start,
                  })
                }
              >
                {record.path}
              </button>
            ) : (
              <p key={node} className="path">
                {node}
              </p>
            );
          })}
        </div>
      )}
    </details>
  );
}
