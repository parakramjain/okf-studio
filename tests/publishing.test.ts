import { describe, expect, it } from "vitest";
// @ts-expect-error Release tooling is an ESM JavaScript module, executed directly by Node in CI.
import { validatePublication } from "../scripts/publish-preflight.mjs";
const manifest = {
  publisher: "verified-fixture",
  name: "okf-knowledge-studio",
  version: "0.4.1",
};
const env = {
  GITHUB_REPOSITORY: "parakramjain/okf-studio",
  GITHUB_REF: "refs/heads/main",
  VSCE_PUBLISHER: "verified-fixture",
  OKF_EXPECTED_VERSION: "0.4.1",
  GITHUB_SHA: "current",
};
const passing = {
  id: 1,
  head_sha: "current",
  event: "push",
  status: "completed",
  conclusion: "success",
};
describe("publication boundary", () => {
  it("requires verified matching publisher, exact version and intended branch", () => {
    const runs = { workflow_runs: [passing] };
    expect(validatePublication(manifest, env, runs)).toBe(
      "verified-fixture.okf-knowledge-studio@0.4.1",
    );
    for (const patch of [
      { VSCE_PUBLISHER: "" },
      { VSCE_PUBLISHER: "different" },
      { OKF_EXPECTED_VERSION: "0.4.0" },
      { OKF_EXPECTED_VERSION: "0.4.1; command" },
      { GITHUB_REF: "refs/heads/other" },
      { GITHUB_REPOSITORY: "other/repository" },
    ])
      expect(() =>
        validatePublication(manifest, { ...env, ...patch }, runs),
      ).toThrow();
  });
  it("rejects missing, unrelated, pending or failed CI, including newer failed reruns", () => {
    for (const workflow_runs of [
      [],
      [{ ...passing, head_sha: "old" }],
      [{ ...passing, status: "in_progress" }],
      [{ ...passing, conclusion: "failure" }],
      [passing, { ...passing, id: 2, conclusion: "failure" }],
    ])
      expect(() =>
        validatePublication(manifest, env, { workflow_runs }),
      ).toThrow("exact commit");
  });
});
