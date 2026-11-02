import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { assertNotAborted } from "../domain/security";
export async function testMCPRuntime(
  executable: string,
  server: string,
  url: string,
  token: string,
  signal?: AbortSignal,
) {
  assertNotAborted(signal);
  const started = performance.now();
  const transport = new StdioClientTransport({
    command: executable,
    args: [server],
    env: { ELECTRON_RUN_AS_NODE: "1", OKF_BRIDGE: url, OKF_TOKEN: token },
    stderr: "pipe",
  });
  const client = new Client({ name: "okf-runtime-check", version: "1" });
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let abort: (() => void) | undefined;
  const interrupted = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(
      () => reject(new Error("MCP runtime check timed out after 15 seconds.")),
      15000,
    );
    abort = () => reject(new Error("MCP runtime check cancelled."));
    signal?.addEventListener("abort", abort, { once: true });
  });
  try {
    return await Promise.race([
      (async () => {
        await client.connect(transport);
        const tools = await client.listTools();
        if (
          tools.tools.length !== 9 ||
          !tools.tools.some((t) => t.name === "get_index_status")
        )
          throw new Error(
            "MCP runtime did not expose the expected nine knowledge tools.",
          );
        const result = await client.callTool({
          name: "get_index_status",
          arguments: {},
        });
        if (result.isError)
          throw new Error("MCP get_index_status returned an error.");
        return {
          status: "Ready",
          detail: `Stdio handshake, ${tools.tools.length} tools, and authenticated get_index_status succeeded.`,
          latencyMs: Math.round(performance.now() - started),
          at: new Date().toISOString(),
        };
      })(),
      interrupted,
    ]);
  } finally {
    clearTimeout(timeout);
    if (abort) signal?.removeEventListener("abort", abort);
    await client.close();
  }
}
