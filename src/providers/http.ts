import { lookup } from "node:dns/promises";
import { lookup as dnsLookup } from "node:dns";
import type { LookupFunction } from "node:net";
import { Agent } from "undici";
import { setTimeout as delay } from "node:timers/promises";
import { assertNotAborted, endpointURL, hash } from "../domain/security";
export type Consent = (
  destination: string,
  operation: string,
  estimatedTokens: number,
) => Promise<void>;
export type Fetch = typeof fetch;
const safeLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { all: true }, (error, addresses) => {
    if (error) {
      callback(error, []);
      return;
    }
    try {
      for (const address of addresses)
        endpointURL(
          `https://${address.family === 6 ? "[" + address.address + "]" : address.address}`,
        );
      if (options.all) callback(null, addresses);
      else if (addresses[0])
        callback(null, addresses[0].address, addresses[0].family);
      else callback(new Error("No provider addresses"), []);
    } catch (error) {
      callback(
        error instanceof Error ? error : new Error("Unsafe DNS result"),
        [],
      );
    }
  });
};
const secureDispatcher = new Agent({ connect: { lookup: safeLookup } });
export class SafeHTTP {
  constructor(
    private readonly consent: Consent,
    private readonly fetcher: Fetch = fetch,
    private readonly checkDNS = true,
  ) {}
  async request(
    raw: string,
    init: RequestInit,
    operation: string,
    signal?: AbortSignal,
    local = false,
    tokens = 0,
  ): Promise<Response> {
    const input = new URL(raw);
    const base = new URL(raw);
    base.search = "";
    const allowed = endpointURL(base.toString(), local);
    if (
      this.checkDNS &&
      !["localhost", "127.0.0.1", "[::1]"].includes(allowed.hostname)
    )
      for (const address of await lookup(allowed.hostname, { all: true }))
        endpointURL(
          `https://${address.family === 6 ? "[" + address.address + "]" : address.address}`,
        );
    await this.consent(allowed.origin, operation, tokens);
    assertNotAborted(signal);
    for (let attempt = 0; ; attempt++) {
      const timed = AbortSignal.timeout(60000);
      const combined = signal ? AbortSignal.any([signal, timed]) : timed;
      const response = await this.fetcher(input, {
        ...init,
        ...(this.checkDNS && !local ? { dispatcher: secureDispatcher } : {}),
        redirect: "error",
        signal: combined,
        headers: {
          ...init.headers,
          traceparent: `00-${hash(String(Date.now())).slice(0, 32)}-${hash(operation).slice(0, 16)}-01`,
        },
      });
      if (response.ok) return response;
      if ((response.status === 429 || response.status >= 500) && attempt < 2) {
        await response.body?.cancel();
        await delay(Math.min(500 * 2 ** attempt, 4000), undefined, { signal });
        continue;
      }
      await response.body?.cancel();
      throw new Error(
        `Provider HTTP ${response.status}; verify endpoint, credentials, model capability and quota. Request content omitted.`,
      );
    }
  }
  async json<T>(
    url: string,
    body: unknown,
    headers: Record<string, string>,
    operation: string,
    signal?: AbortSignal,
    local = false,
  ): Promise<T> {
    const response = await this.request(
      url,
      {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body: JSON.stringify(body),
      },
      operation,
      signal,
      local,
      Math.ceil(JSON.stringify(body).length / 4),
    );
    if (!response.body) throw new Error("Empty provider response");
    const reader = response.body.getReader();
    const parts: Uint8Array[] = [];
    let total = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.length;
        if (total > 16_000_000)
          throw new Error("Provider response exceeds 16 MB limit");
        parts.push(value);
      }
    } finally {
      await reader.cancel().catch(() => undefined);
      reader.releaseLock();
    }
    return JSON.parse(Buffer.concat(parts).toString("utf8")) as T;
  }
}
