import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
export const hash = (value: string | Uint8Array): string =>
  createHash("sha256").update(value).digest("hex");
export const uid = (): string => randomUUID();
export function safePath(value: string): string {
  const decoded = decodeURIComponent(value).replace(/\\/g, "/");
  if (
    !decoded ||
    decoded.includes("\0") ||
    decoded.startsWith("/") ||
    /^[a-z]:/i.test(decoded) ||
    decoded.split("/").some((p) => p === ".." || p === "." || p === "") ||
    /[<>:"|?*]/.test(decoded)
  )
    throw new Error("Unsafe relative path");
  return decoded;
}
export function resolveLink(from: string, target: string): string | undefined {
  if (
    /^[a-z][a-z0-9+.-]*:/i.test(target) ||
    target.startsWith("#") ||
    target.startsWith("//")
  )
    return undefined;
  const clean = decodeURIComponent(target.split("#")[0].split("?")[0]).replace(
    /\\/g,
    "/",
  );
  return safePath(
    path.posix.normalize(
      clean.startsWith("/")
        ? clean.slice(1)
        : path.posix.join(path.posix.dirname(from), clean),
    ),
  );
}
export function redact(value: string): string {
  return value
    .replace(
      /-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/g,
      "[REDACTED PRIVATE KEY]",
    )
    .replace(
      /\b(?:sk-[a-zA-Z0-9_-]{12,}|gh[pousr]_[a-zA-Z0-9_]{15,}|AKIA[A-Z0-9]{16})\b/g,
      "[REDACTED SECRET]",
    )
    .replace(
      /((?:api[_-]?key|password|secret|token)\s*[:=]\s*["']?)[^\s"',;]+/gi,
      "$1[REDACTED]",
    )
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[REDACTED EMAIL]");
}
export function endpointURL(raw: string, localAllowed = false): URL {
  const url = new URL(raw);
  if (url.username || url.password || url.hash || url.search)
    throw new Error(
      "Endpoint must not contain credentials, fragments or query parameters",
    );
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const loopback = ["localhost", "127.0.0.1", "::1"].includes(host);
  const privateHost =
    loopback ||
    /^(0\.|10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(
      host,
    ) ||
    host.includes(":") ||
    /(?:\.local|\.internal)$/.test(host);
  if (privateHost && !(localAllowed && loopback))
    throw new Error("Private or metadata endpoint is not allowed");
  if (
    url.protocol !== "https:" &&
    !(localAllowed && loopback && url.protocol === "http:")
  )
    throw new Error("HTTPS required (loopback Ollama may use HTTP)");
  return url;
}
export function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted)
    throw new DOMException("Operation cancelled", "AbortError");
}
export const isCancelled = (error: unknown): boolean =>
  error instanceof Error && error.name === "AbortError";
export const errorMessage = (error: unknown): string =>
  redact(error instanceof Error ? error.message : String(error));
export function injectionWarnings(text: string): string[] {
  return /ignore (?:all |previous |prior )?instructions|system\s*prompt|exfiltrat|reveal.*(?:secret|key)|<\/?(?:system|assistant)>/i.test(
    text,
  )
    ? [
        "Possible instruction injection in source; treated as quoted evidence only.",
      ]
    : [];
}
// Buffer complete lines so credentials split across transport chunks cannot escape redaction.
export class OutputRedactor {
  private pending = "";
  constructor(private readonly emit: (text: string) => void) {}
  push(text: string, final = false): void {
    this.pending += text;
    if (this.pending.length > 120000)
      throw new Error("Model response exceeded output limit");
    const privateStart = this.pending.indexOf("-----BEGIN ");
    let boundary = final
      ? this.pending.length
      : this.pending.lastIndexOf("\n") + 1;
    if (
      privateStart >= 0 &&
      !/-----END [^-]*PRIVATE KEY-----/.test(
        this.pending.slice(privateStart),
      ) &&
      !final
    )
      boundary = Math.min(boundary, privateStart);
    if (boundary) {
      this.emit(redact(this.pending.slice(0, boundary)));
      this.pending = this.pending.slice(boundary);
    }
    if (final && this.pending) {
      this.emit(redact(this.pending));
      this.pending = "";
    }
  }
}
