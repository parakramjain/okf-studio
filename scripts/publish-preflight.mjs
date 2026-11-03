import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export function validatePublication(manifest, env, runs) {
  if (
    env.GITHUB_REPOSITORY !== "parakramjain/okf-studio" ||
    env.GITHUB_REF !== "refs/heads/main"
  )
    throw new Error("Publish only from parakramjain/okf-studio on main.");
  if (!env.VSCE_PUBLISHER?.trim())
    throw new Error(
      "Set the VSCE_PUBLISHER repository variable to your verified Marketplace publisher ID. See docs/PUBLISHING.md.",
    );
  if (env.VSCE_PUBLISHER !== manifest.publisher)
    throw new Error(
      "The verified publisher does not match package.json. Resolve extension identity/data migration before publication.",
    );
  if (
    !/^\d+\.\d+\.\d+$/.test(env.OKF_EXPECTED_VERSION ?? "") ||
    env.OKF_EXPECTED_VERSION !== manifest.version
  )
    throw new Error(
      "The requested version must exactly match package.json (major.minor.patch).",
    );
  const latest = runs.workflow_runs
    ?.filter((run) => run.head_sha === env.GITHUB_SHA && run.event === "push")
    .sort((a, b) => b.id - a.id)[0];
  if (
    !latest ||
    latest.status !== "completed" ||
    latest.conclusion !== "success"
  )
    throw new Error(
      "Wait for Validate and package to pass on this exact commit before publishing.",
    );
  return `${manifest.publisher}.${manifest.name}@${manifest.version}`;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const manifest = JSON.parse(readFileSync("package.json", "utf8"));
  const runs = JSON.parse(readFileSync(process.argv[2], "utf8"));
  console.log(
    `Publication preflight passed: ${validatePublication(manifest, process.env, runs)}`,
  );
}
