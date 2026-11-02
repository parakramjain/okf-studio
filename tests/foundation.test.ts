import { describe, it, expect } from "vitest";
import { Store } from "../src/persistence/store";
import { ClientMessage, RepositorySchema } from "../src/domain/types";
import {
  safePath,
  redact,
  endpointURL,
  resolveLink,
} from "../src/domain/security";
describe("phase 02 foundation", () => {
  it("persists SQLite records and atomic transactions", async () => {
    let bytes: Uint8Array | undefined;
    const io = {
      read: async () => bytes,
      write: async (data: Uint8Array) => {
        bytes = data;
      },
    };
    const store = await Store.open(io);
    store.putRepository({
      id: "r",
      name: "Docs",
      kind: "document",
      roots: ["file:///repo"],
      permissions: { read: true, write: true },
    });
    expect(() =>
      store.transaction(() => {
        store.setMeta("failed", "yes");
        throw new Error("rollback");
      }),
    ).toThrow();
    expect(store.getMeta("failed")).toBeUndefined();
    await store.close();
    const reopened = await Store.open(io);
    expect(reopened.repositories()[0].name).toBe("Docs");
    await reopened.close();
  });
  it("validates the protocol and repository contract", () => {
    expect(
      ClientMessage.safeParse({ type: "command", command: "execute-shell" })
        .success,
    ).toBe(false);
    expect(RepositorySchema.safeParse({ roots: [] }).success).toBe(false);
  });
  it("rejects traversal, malformed encodings and private egress", () => {
    for (const value of ["../x", "%2e%2e/x", "C:/x", "a\\..\\x", "/x", "a\0b"])
      expect(() => safePath(value)).toThrow();
    expect(resolveLink("docs/a.md", "../b.md")).toBe("b.md");
    for (const url of [
      "http://example.com",
      "https://169.254.169.254",
      "https://user:pass@example.com",
      "https://10.0.0.1",
    ])
      expect(() => endpointURL(url)).toThrow();
    expect(endpointURL("http://localhost:11434", true).hostname).toBe(
      "localhost",
    );
  });
  it("redacts secrets and PII", () => {
    const text = redact(
      "api_key=verysecret person@example.com sk-12345678901234567890",
    );
    expect(text).not.toContain("verysecret");
    expect(text).not.toContain("person@");
    expect(text).not.toContain("sk-");
  });
});
