import { createServer, type Server } from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { errorMessage } from "../domain/security";
export class MCPBridge {
  readonly token = randomBytes(32).toString("hex");
  private server?: Server;
  url = "";
  async start(
    invoke: (name: string, args: unknown) => Promise<unknown>,
  ): Promise<void> {
    this.server = createServer((req, res) => {
      void (async () => {
        res.setHeader("content-type", "application/json");
        const expected = Buffer.from(`Bearer ${this.token}`);
        const actual = Buffer.from(req.headers.authorization ?? "");
        if (
          req.method !== "POST" ||
          req.url !== "/tool" ||
          req.headers.origin ||
          expected.length !== actual.length ||
          !timingSafeEqual(expected, actual)
        ) {
          res.writeHead(403).end("{}");
          return;
        }
        let body = "";
        for await (const chunk of req) {
          body += chunk;
          if (body.length > 70000) {
            res.writeHead(413).end("{}");
            return;
          }
        }
        try {
          const value = JSON.parse(body) as { name: string; args: unknown };
          const result = JSON.stringify({
            result: await invoke(value.name, value.args),
          });
          if (result.length > 260000)
            throw new Error("Result too large; narrow the scope");
          res.end(result);
        } catch (error) {
          res
            .writeHead(400)
            .end(JSON.stringify({ error: errorMessage(error) }));
        }
      })().catch(() => {
        if (!res.headersSent) res.writeHead(500);
        res.end("{}");
      });
    });
    await new Promise<void>((resolve, reject) => {
      this.server!.once("error", reject);
      this.server!.listen(0, "127.0.0.1", () => resolve());
    });
    const address = this.server.address();
    if (!address || typeof address === "string")
      throw new Error("Bridge unavailable");
    this.url = `http://127.0.0.1:${address.port}/tool`;
  }
  async close(): Promise<void> {
    this.server?.closeAllConnections();
    await new Promise<void>((resolve) =>
      this.server ? this.server.close(() => resolve()) : resolve(),
    );
  }
}
