import React, { useState } from "react";
import type { Repository } from "../src/domain/types";
import { Icon } from "./components";
export function GitPanel({
  repositories,
  busy,
  send,
}: {
  repositories: Repository[];
  busy: boolean;
  send: (value: unknown) => void;
}) {
  const [repoId, setRepoId] = useState("");
  return (
    <section className="git-panel" data-tour="git" aria-label="Git workflow">
      <h2>
        <Icon name="git" />
        Git workflow
      </h2>
      <p className="muted">
        Use VS Code Git to review changes, manage branches, and sync with your
        remote. Import a cloned folder to index it in OKF Studio.
      </p>
      <label>
        Git repository
        <select value={repoId} onChange={(e) => setRepoId(e.target.value)}>
          <option value="">Choose when running a command</option>
          {repositories.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </label>
      <div className="git-actions">
        {[
          [
            "status",
            "Status & diff",
            "Open Source Control to inspect and stage changes.",
          ],
          [
            "history",
            "Commit history",
            "Open Source Control Graph to browse commits.",
          ],
          [
            "branches",
            "Switch branch",
            "Choose or create a branch in VS Code.",
          ],
          ["fetch", "Fetch", "Download remote refs without merging."],
          ["pull", "Pull", "Bring remote commits into your branch."],
          [
            "commit",
            "Commit",
            "Use VS Code’s commit message and staging workflow.",
          ],
          ["push", "Push", "Publish local commits through VS Code Git."],
          [
            "clone",
            "Clone repository",
            "Clone with VS Code, then import the folder.",
          ],
        ].map(([action, title, description]) => (
          <button
            key={action}
            disabled={busy || (action !== "clone" && !repositories.length)}
            onClick={() =>
              send({ type: "git", action, repoId: repoId || undefined })
            }
          >
            <strong>{title}</strong>
            <small>{description}</small>
          </button>
        ))}
      </div>
    </section>
  );
}
