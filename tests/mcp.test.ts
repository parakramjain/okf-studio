import { it, expect } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "node:path";
import { MCPBridge } from "../src/mcp/bridge";
import { invokeTool, toolSpecs } from "../src/mcp/tools";
import { Store } from "../src/persistence/store";
import { parseSource } from "../src/ingestion/parser";
import { chunkRecord } from "../src/ingestion/chunks";
it("serves all nine MCP tools over real stdio with authenticated resources and prompts", async () => {
  const store = await Store.open({
    read: async () => undefined,
    write: async () => undefined,
  });
  const repo = {
    id: "r",
    name: "R",
    kind: "hybrid" as const,
    roots: ["file:///r"],
    permissions: { read: true, write: true },
  };
  store.putRepository(repo);
  const r = parseSource(
    repo,
    repo.roots[0],
    "auth.md",
    "file:///r/auth.md",
    "---\ntype: Requirement\n---\n# REQ-001\nAuthentication uses OAuth.",
  );
  store.putRecord(r, chunkRecord(r));
  const bridge = new MCPBridge();
  await bridge.start((name, args) => invokeTool(store, name, args));
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.resolve("out/mcp.cjs")],
    env: {
      ...Object.fromEntries(
        Object.entries(process.env).filter(
          (e): e is [string, string] => typeof e[1] === "string",
        ),
      ),
      OKF_BRIDGE: bridge.url,
      OKF_TOKEN: bridge.token,
    },
    stderr: "pipe",
  });
  const client = new Client({ name: "okf-test", version: "1" });
  try {
    await client.connect(transport);
    const tools = await client.listTools();
    expect(tools.tools.map((t) => t.name).sort()).toEqual(
      toolSpecs.map((t) => t.name).sort(),
    );
    expect(
      tools.tools.find((t) => t.name === "propose_knowledge_update")
        ?.annotations?.readOnlyHint,
    ).toBe(false);
    const result = await client.callTool({
      name: "search_knowledge",
      arguments: { query: "OAuth" },
    });
    expect(JSON.stringify(result)).toContain(r.id);
    expect(
      JSON.stringify(
        await client.callTool({
          name: "get_document",
          arguments: { id: r.id },
        }),
      ),
    ).toContain("Authentication uses OAuth");
    for (const name of ["get_code_context", "validate_against_knowledge"])
      expect(
        (await client.callTool({ name, arguments: { query: "OAuth" } }))
          .isError,
      ).not.toBe(true);
    for (const name of [
      "get_dependencies",
      "analyze_change_impact",
      "trace_requirement",
    ])
      expect(
        (
          await client.callTool({
            name,
            arguments: { id: name === "trace_requirement" ? "REQ-001" : r.id },
          })
        ).isError,
      ).not.toBe(true);
    expect(
      (await client.callTool({ name: "get_index_status", arguments: {} }))
        .isError,
    ).not.toBe(true);
    expect(
      (
        await client.callTool({
          name: "propose_knowledge_update",
          arguments: { id: r.id, content: "change", reason: "review" },
        })
      ).isError,
    ).toBe(true);
    expect((await client.listResources()).resources[0].uri).toBe(
      "okf://catalog",
    );
    expect(
      (await client.readResource({ uri: "okf://catalog" })).contents.length,
    ).toBe(1);
    expect((await client.listPrompts()).prompts[0].name).toBe(
      "knowledge-triage",
    );
    const denied = await fetch(bridge.url, { method: "POST", body: "{}" });
    expect(denied.status).toBe(403);
  } finally {
    await client.close();
    await transport.close();
    await bridge.close();
    await store.close();
  }
}, 30000);
