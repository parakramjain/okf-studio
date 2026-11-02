import { z } from "zod";
export const Mode = z.enum(["document", "code", "hybrid"]);
export type Mode = z.infer<typeof Mode>;
export const RepositorySchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: Mode,
  roots: z.array(z.string()).min(1),
  permissions: z.object({ read: z.boolean(), write: z.boolean() }),
  commit: z.string().optional(),
  bundleSourceId: z.string().optional(),
});
export type Repository = z.infer<typeof RepositorySchema>;
export type Span = { start: number; end: number };
export type SymbolKind =
  | "module"
  | "class"
  | "function"
  | "API"
  | "schema"
  | "test"
  | "requirement"
  | "decision"
  | "document";
export interface CodeSymbol {
  id: string;
  name: string;
  kind: SymbolKind;
  span: Span;
  signature: string;
  calls: string[];
}
export interface KnowledgeRecord {
  id: string;
  repoId: string;
  root: string;
  path: string;
  sourceUri: string;
  title: string;
  kind: "code" | "document";
  content: string;
  contentHash: string;
  commit?: string;
  span: Span;
  confidence: number;
  status: string;
  metadata: Record<string, unknown>;
  symbols: CodeSymbol[];
  imports: string[];
  links: string[];
  headings: { title: string; line: number }[];
  indexedAt: string;
}
export interface Chunk {
  id: string;
  recordId: string;
  repoId: string;
  text: string;
  span: Span;
  section?: string;
  hash: string;
  vector?: number[];
  namespace?: string;
}
export interface Citation {
  uri: string;
  span: Span;
  commit?: string;
  chunkId: string;
  score: number;
  title: string;
}
export interface SearchHit {
  recordId: string;
  text: string;
  citation: Citation;
  lexical: number;
  vector: number;
}
export const ScopeSchema = z.object({
  repoIds: z.array(z.string()).optional(),
  recordIds: z.array(z.string()).optional(),
  folder: z.string().optional(),
});
export type Scope = z.infer<typeof ScopeSchema>;
export type GraphNode = {
  id: string;
  label: string;
  kind: string;
  recordId?: string;
};
export type GraphEdge = {
  from: string;
  to: string;
  kind:
    | "defines"
    | "calls"
    | "imports"
    | "implements"
    | "tests"
    | "depends_on"
    | "references";
  resolved: boolean;
};
export type Graph = { nodes: GraphNode[]; edges: GraphEdge[] };
export interface Issue {
  recordId: string;
  severity: "error" | "warning" | "info";
  code: string;
  message: string;
  line?: number;
}
export interface Proposal {
  id: string;
  repoId: string;
  root: string;
  path: string;
  before: string | null;
  after: string;
  reason: string;
  createdAt: string;
  status: "pending" | "approved" | "rejected" | "undone";
  sourceHashes: Record<string, string>;
  appliedAt?: string;
}
export type ProviderKind =
  "none" | "evidence" | "vscode" | "ollama" | "openai" | "azure" | "compatible";
export interface ProviderConfig {
  provider: ProviderKind;
  model: string;
  endpoint: string;
  apiVersion?: string;
  dimension?: number;
}
export interface EmbeddingProvider {
  config: ProviderConfig;
  embed(texts: string[], signal?: AbortSignal): Promise<number[][]>;
}
export interface VectorAdapter {
  testConnection?(signal?: AbortSignal): Promise<string>;
  upsert(
    namespace: string,
    chunks: Chunk[],
    signal?: AbortSignal,
  ): Promise<void>;
  search(
    namespace: string,
    vector: number[],
    topK: number,
    signal?: AbortSignal,
  ): Promise<{ id: string; score: number }[]>;
  remove(
    namespace: string,
    ids?: string[],
    signal?: AbortSignal,
  ): Promise<void>;
}
export interface FileEntry {
  name: string;
  kind: "file" | "directory" | "symlink";
}
export interface SourceFS {
  list(uri: string): Promise<FileEntry[]>;
  read(uri: string): Promise<Uint8Array>;
  size(uri: string): Promise<number>;
  join(root: string, path: string): string;
}
export interface Progress {
  stage: string;
  completed: number;
  total?: number;
  detail?: string;
}
export interface SyncStats {
  scanned: number;
  changed: number;
  removed: number;
  skipped: number;
  errors: string[];
  cancelled: boolean;
}
export interface AuditEvent {
  at: string;
  action: string;
  subject: string;
  detail?: string;
  traceId: string;
}
export interface AgentContextPack {
  task: string;
  documents: SearchHit[];
  constraints: string[];
  citations: Citation[];
  tokenBudget: number;
  estimatedTokens: number;
}
export const ClientMessage = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("saveSettings"),
    settings: z
      .object({
        embeddingProvider: z.enum([
          "none",
          "ollama",
          "openai",
          "azure",
          "compatible",
        ]),
        embeddingModel: z.string().max(200),
        embeddingEndpoint: z.string().max(2000),
        vectorBackend: z.enum(["local", "qdrant", "pgvector"]),
        vectorEndpoint: z.string().max(2000),
        chunkLines: z.number().int().min(8).max(300),
        chunkOverlap: z.number().int().min(0).max(100),
      })
      .refine(
        (s) => s.chunkOverlap < s.chunkLines,
        "Chunk overlap must be smaller than chunk length",
      ),
  }),
  z.object({
    type: z.literal("connectionTest"),
    target: z.enum(["embedding", "vector"]),
  }),
  z.object({
    type: z.literal("configureSection"),
    section: z.enum([
      "Chat provider",
      "Embedding provider",
      "Vector backend",
      "Store provider API key",
      "Store vector credential",
      "Open all settings",
      "Revoke session consent",
    ]),
  }),
  z.object({ type: z.literal("agentRuntimeTest") }),
  z.object({
    type: z.literal("agentTool"),
    requestId: z.string().max(100).optional(),
    name: z.enum([
      "get_index_status",
      "search_knowledge",
      "get_document",
      "get_code_context",
      "get_dependencies",
      "analyze_change_impact",
      "trace_requirement",
      "validate_against_knowledge",
    ]),
    args: z.record(z.string(), z.unknown()),
  }),
  z.object({
    type: z.literal("agentPack"),
    requestId: z.string().max(100).optional(),
    question: z.string().min(1).max(8000),
    scope: ScopeSchema,
    tokenBudget: z.number().int().min(500).max(12000),
    save: z.boolean().optional(),
  }),
  z.object({ type: z.literal("exportDiagnostics") }),
  z.object({ type: z.literal("openStudioEditor") }),
  z.object({ type: z.literal("guide"), page: z.string().max(40).optional() }),
  z.object({
    type: z.literal("git"),
    action: z.enum([
      "status",
      "history",
      "branches",
      "fetch",
      "pull",
      "commit",
      "push",
      "clone",
    ]),
    repoId: z.string().optional(),
  }),
  z.object({
    type: z.literal("listFiles"),
    repoId: z.string(),
    root: z.string(),
    path: z.string().max(4000),
    offset: z.number().int().min(0).default(0),
    requestId: z.string().max(100),
  }),
  z.object({
    type: z.literal("openFile"),
    repoId: z.string(),
    root: z.string(),
    path: z.string().min(1).max(4000),
  }),
  z.object({ type: z.literal("createBundle"), repoId: z.string().min(1) }),
  z.object({
    type: z.literal("batchReview"),
    ids: z.array(z.string()).max(10000),
    all: z.boolean().optional(),
    action: z.enum(["approve", "reject"]),
  }),
  z.object({ type: z.literal("ready") }),
  z.object({
    type: z.literal("command"),
    command: z.enum([
      "import",
      "sync",
      "generate",
      "configure",
      "agent",
      "export",
      "clear",
    ]),
  }),
  z.object({ type: z.literal("mode"), mode: Mode }),
  z.object({
    type: z.literal("search"),
    target: z.enum(["search", "playground"]).optional(),
    requestId: z.string().max(100).optional(),
    query: z.string().max(4000),
    scope: ScopeSchema,
    strategy: z.enum(["keyword", "semantic", "hybrid"]),
  }),
  z.object({
    type: z.literal("ask"),
    preview: z.boolean().optional(),
    question: z.string().min(1).max(8000),
    scope: ScopeSchema,
    task: z.enum([
      "answer",
      "summarize",
      "compare",
      "explain",
      "FAQ",
      "requirements",
      "ADR",
      "tests",
    ]),
  }),
  z.object({
    type: z.literal("open"),
    id: z.string(),
    line: z.number().int().positive().optional(),
  }),
  z.object({ type: z.literal("cancel") }),
  z.object({
    type: z.literal("review"),
    id: z.string(),
    action: z.enum(["diff", "approve", "reject", "undo"]),
  }),
  z.object({
    type: z.literal("impact"),
    id: z.string(),
    depth: z.number().int().min(1).max(8),
  }),
  z.object({ type: z.literal("removeRepo"), id: z.string() }),
  z.object({
    type: z.literal("index"),
    action: z.enum(["preview", "build", "reindex", "rollback", "cleanup"]),
  }),
  z.object({
    type: z.literal("template"),
    template: z.enum(["ADR", "Requirement", "Glossary"]),
    repoId: z.string(),
  }),
  z.object({
    type: z.literal("metadata"),
    id: z.string(),
    yaml: z.string().max(100000),
  }),
  z.object({ type: z.literal("compare"), ids: z.array(z.string()).length(2) }),
]);
export type ClientMessage = z.infer<typeof ClientMessage>;
