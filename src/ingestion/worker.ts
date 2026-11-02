import { parentPort } from "node:worker_threads";
import { parseSource } from "./parser";
parentPort?.on("message", ({ id, args }) => {
  try {
    parentPort?.postMessage({
      id,
      record: parseSource(...(args as Parameters<typeof parseSource>)),
    });
  } catch (error) {
    parentPort?.postMessage({ id, error: String(error) });
  }
});
