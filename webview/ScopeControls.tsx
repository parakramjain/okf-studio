import React from "react";
import type { KnowledgeRecord, Repository } from "../src/domain/types";
import { inScope } from "../src/domain/scope";
import { workspaceScope, type Preferences } from "./model";
export function ScopeControls({
  prefs,
  repositories,
  records,
  update,
  disabled,
  unavailable,
}: {
  prefs: Preferences;
  repositories: Repository[];
  records: KnowledgeRecord[];
  update: (patch: Partial<Preferences>) => void;
  disabled: boolean;
  unavailable: boolean;
}) {
  const scope = workspaceScope({ ...prefs, selected: [] });
  const options = records.filter((r) => inScope(r, scope));
  const label =
    prefs.selected.length === 1
      ? "Single document"
      : prefs.selected.length > 1
        ? `${prefs.selected.length} selected documents`
        : prefs.multiRepo
          ? `${prefs.repoIds.length} repositories`
          : prefs.folder
            ? `Folder: ${prefs.folder}`
            : prefs.repo
              ? (repositories.find((r) => r.id === prefs.repo)?.name ??
                "Unavailable repository")
              : "Whole workspace";
  return (
    <details className="scope-panel" data-tour="scope">
      <summary>
        Evidence scope <span className="muted">{label}</span>
      </summary>
      <fieldset disabled={disabled} className="scope-fieldset">
        <legend className="sr-only">Choose knowledge scope</legend>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={prefs.multiRepo}
            onChange={(e) =>
              update({
                multiRepo: e.target.checked,
                repoIds: prefs.repo ? [prefs.repo] : [],
                repo: "",
                selected: [],
              })
            }
          />
          Choose multiple repositories
        </label>
        {prefs.multiRepo ? (
          <fieldset className="repository-checks">
            <legend>Included repositories</legend>
            {repositories.map((r) => (
              <label className="checkbox-label" key={r.id}>
                <input
                  type="checkbox"
                  checked={prefs.repoIds.includes(r.id)}
                  onChange={(e) =>
                    update({
                      repoIds: e.target.checked
                        ? [...prefs.repoIds, r.id]
                        : prefs.repoIds.filter((id) => id !== r.id),
                      selected: [],
                    })
                  }
                />
                {r.name}
              </label>
            ))}
            {!prefs.repoIds.length && (
              <p className="warning-text">
                Choose at least one repository. An empty selection sends no
                evidence.
              </p>
            )}
          </fieldset>
        ) : (
          <label>
            Repository
            <select
              value={prefs.repo}
              onChange={(e) => update({ repo: e.target.value, selected: [] })}
            >
              <option value="">All repositories</option>
              {repositories.map((r) => (
                <option value={r.id} key={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="scope-fields">
          <label>
            Folder prefix
            <input
              value={prefs.folder}
              placeholder="docs or src"
              onChange={(e) => update({ folder: e.target.value, selected: [] })}
            />
          </label>
          <label>
            Single document
            <select
              value={prefs.selected.length === 1 ? prefs.selected[0] : ""}
              onChange={(e) =>
                update({ selected: e.target.value ? [e.target.value] : [] })
              }
            >
              <option value="">Choose an indexed document or code file</option>
              {options.map((r) => (
                <option value={r.id} key={r.id}>
                  {r.path}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="muted">
          Select several files in Knowledge Explorer, or choose one here.
          Repository and folder limits apply to every request. The document
          picker shows the loaded catalog; the file tree can select additional
          indexed files.
        </p>
        <div className="toolbar">
          <span className="chip">{label}</span>
          <button
            type="button"
            onClick={() =>
              update({
                repo: "",
                repoIds: [],
                multiRepo: false,
                folder: "",
                selected: [],
              })
            }
          >
            Reset scope
          </button>
          {prefs.selected.length > 0 && (
            <button type="button" onClick={() => update({ selected: [] })}>
              Clear selection
            </button>
          )}
        </div>
        {unavailable && (
          <p className="warning-text">
            This scope has missing sources or no repositories selected. Restore
            the sources or reset scope to continue.
          </p>
        )}
      </fieldset>
    </details>
  );
}
