import React from "react";
import type { Graph } from "../src/domain/types";
export function GraphVisual({
  graph,
  onSelect,
}: {
  graph: Graph;
  onSelect: (id: string) => void;
}) {
  const nodes = graph.nodes.slice(0, 60);
  const coords = new Map(
    nodes.map((node, index) => [
      node.id,
      { x: 90 + (index % 4) * 180, y: 45 + Math.floor(index / 4) * 85 },
    ]),
  );
  return (
    <div className="graph-canvas">
      <svg
        viewBox={`0 0 720 ${Math.max(150, Math.ceil(nodes.length / 4) * 85)}`}
        aria-label="Interactive dependency graph"
        role="group"
      >
        <defs>
          <marker
            id="okf-arrow"
            viewBox="0 0 10 10"
            refX="24"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" />
          </marker>
        </defs>
        {graph.edges
          .filter((edge) => coords.has(edge.from) && coords.has(edge.to))
          .slice(0, 150)
          .map((edge, index) => {
            const from = coords.get(edge.from)!;
            const to = coords.get(edge.to)!;
            return (
              <line
                className={
                  edge.resolved ? "graph-line" : "graph-line graph-approximate"
                }
                key={index}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                markerEnd="url(#okf-arrow)"
              >
                <title>
                  {edge.kind} ({edge.resolved ? "resolved" : "approximate"})
                </title>
              </line>
            );
          })}
        {nodes.map((node) => {
          const point = coords.get(node.id)!;
          return (
            <g
              key={node.id}
              transform={`translate(${point.x},${point.y})`}
              role="button"
              tabIndex={0}
              aria-label={`Inspect ${node.label}`}
              onClick={() => onSelect(node.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect(node.id);
                }
              }}
            >
              <title>
                {node.kind}: {node.label}
              </title>
              <circle r="17" />
              <text y="34" textAnchor="middle">
                {node.label.length > 22
                  ? node.label.slice(0, 19) + "…"
                  : node.label}
              </text>
            </g>
          );
        })}
      </svg>
      <small>
        First {nodes.length} nodes. Full text relations and controls below.
      </small>
    </div>
  );
}
