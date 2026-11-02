import { z } from "zod";
import { ScopeSchema } from "../domain/types";
import { Store } from "../persistence/store";
import { buildGraph, changeImpact, traceRequirement } from "../graph/graph";
import { search } from "../retrieval/search";
import { redact } from "../domain/security";
import { quality } from "../governance/quality";
export const toolSpecs = [
  {
    name: "search_knowledge",
    description:
      "Search indexed knowledge offline. Discover document IDs automatically before requesting a document.",
    schema: z.object({
      query: z.string().max(4000),
      scope: ScopeSchema.optional(),
      topK: z.number().int().min(1).max(20).optional(),
    }),
    readOnly: true,
  },
  {
    name: "get_document",
    description:
      "Get a bounded redacted indexed document by discovered ID with source lines.",
    schema: z.object({
      id: z.string(),
      start: z.number().int().positive().optional(),
      end: z.number().int().positive().optional(),
    }),
    readOnly: true,
  },
  {
    name: "get_code_context",
    description: "Retrieve cited code and document evidence for a coding task.",
    schema: z.object({
      query: z.string().max(4000),
      scope: ScopeSchema.optional(),
    }),
    readOnly: true,
  },
  {
    name: "get_dependencies",
    description:
      "Get resolved and approximate dependencies/callers/callees for a discovered node ID.",
    schema: z.object({ id: z.string() }),
    readOnly: true,
  },
  {
    name: "analyze_change_impact",
    description:
      "Bounded incoming dependency traversal. Approximate edges do not prove runtime behavior.",
    schema: z.object({
      id: z.string(),
      depth: z.number().int().min(1).max(8).optional(),
    }),
    readOnly: true,
  },
  {
    name: "trace_requirement",
    description:
      "Trace a requirement ID or REQ identifier to code/tests, labeling approximate relations.",
    schema: z.object({ id: z.string() }),
    readOnly: true,
  },
  {
    name: "validate_against_knowledge",
    description:
      "Return source-backed evidence and relevant diagnostics for a proposed change; no claim of semantic proof.",
    schema: z.object({
      query: z.string().max(8000),
      scope: ScopeSchema.optional(),
    }),
    readOnly: true,
  },
  {
    name: "propose_knowledge_update",
    description:
      "Queue a suggested update after a human permission prompt. Never writes source; a separate diff and approval is required.",
    schema: z.object({
      id: z.string(),
      content: z.string().min(1).max(60000),
      reason: z.string().max(1000),
    }),
    readOnly: false,
  },
  {
    name: "get_index_status",
    description:
      "List repositories, IDs, index capability, document count and interrupted jobs.",
    schema: z.object({}),
    readOnly: true,
  },
] as const;
export async function invokeTool(
  store: Store,
  name: string,
  input: unknown,
  propose?: (id: string, content: string, reason: string) => Promise<unknown>,
): Promise<unknown> {
  const spec = toolSpecs.find((s) => s.name === name);
  if (!spec) throw new Error("Unknown MCP tool");
  const args = spec.schema.parse(input) as Record<string, unknown>;
  const records = store.records();
  const graph = buildGraph(records);
  if (name === "get_index_status")
    return {
      repositories: store
        .repositories()
        .map((r) => ({ id: r.id, name: r.name, kind: r.kind })),
      documents: records.length,
      chunks: store.chunks().length,
      namespace: store.getMeta("namespace"),
      jobs: store
        .repositories()
        .map((r) => ({ id: r.id, status: store.getMeta(`job:${r.id}`) })),
      capabilities: {
        keyword: true,
        semantic: !!store.getMeta("namespace"),
        writes: "human review only",
      },
    };
  if (
    name === "search_knowledge" ||
    name === "get_code_context" ||
    name === "validate_against_knowledge"
  ) {
    const evidence = search(records, store.chunks(), String(args.query), {
      scope: args.scope as z.infer<typeof ScopeSchema>,
      topK: Number(args.topK) || 8,
      tokenBudget: 6000,
    });
    const ids = new Set(evidence.map((hit) => hit.recordId));
    return {
      evidence,
      codeSymbols:
        name === "get_code_context"
          ? records
              .filter((record) => ids.has(record.id))
              .flatMap((record) =>
                record.symbols.map((symbol) => ({
                  ...symbol,
                  signature: redact(symbol.signature),
                  uri: record.sourceUri,
                })),
              )
              .slice(0, 100)
          : undefined,
      diagnostics:
        name === "validate_against_knowledge"
          ? quality(records, graph)
              .issues.filter((issue) => ids.has(issue.recordId))
              .slice(0, 100)
          : undefined,
      notice:
        name === "validate_against_knowledge"
          ? "Evidence retrieval only. Human review is required to judge consistency."
          : undefined,
    };
  }
  if (name === "get_document") {
    const record = store.record(String(args.id));
    if (!record) throw new Error("Unknown ID; use search_knowledge first");
    const start = Number(args.start) || 1;
    const end = Math.min(Number(args.end) || start + 199, start + 199);
    return {
      id: record.id,
      title: record.title,
      uri: record.sourceUri,
      span: { start, end: Math.min(end, record.span.end) },
      commit: record.commit,
      content: redact(
        record.content
          .split("\n")
          .slice(start - 1, end)
          .join("\n"),
      ).slice(0, 60000),
    };
  }
  if (name === "get_dependencies") {
    const id = String(args.id);
    return {
      node: graph.nodes.find((n) => n.id === id),
      incoming: graph.edges.filter((e) => e.to === id).slice(0, 100),
      outgoing: graph.edges.filter((e) => e.from === id).slice(0, 100),
    };
  }
  if (name === "analyze_change_impact")
    return {
      nodes: changeImpact(graph, String(args.id), Number(args.depth) || 3),
      notice: "Includes approximate static relations.",
    };
  if (name === "trace_requirement")
    return traceRequirement(graph, String(args.id));
  if (name === "propose_knowledge_update") {
    if (!propose)
      throw new Error(
        "Proposals require the running trusted extension and human consent",
      );
    return propose(String(args.id), String(args.content), String(args.reason));
  }
  throw new Error("Unsupported tool");
}
