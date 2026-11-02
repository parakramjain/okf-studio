import React, { useEffect, useRef, useState } from "react";
import type { Repository } from "../src/domain/types";
import { Icon } from "./components";
type Entry = { name: string; path: string; kind: string; recordId?: string };
type Page = {
  entries: Entry[];
  next: number | null;
  total: number;
  error?: string;
};
type Props = {
  repositories: Repository[];
  selected: string[];
  folder: string;
  disabled: boolean;
  send: (m: unknown) => void;
  select: (id: string, checked: boolean) => void;
};

function Folder({
  repo,
  root,
  path,
  name,
  props,
  initial = false,
}: {
  repo: Repository;
  root: string;
  path: string;
  name: string;
  props: Props;
  initial?: boolean;
}) {
  const [expanded, setExpanded] = useState(initial);
  const [page, setPage] = useState<Page>();
  const [loading, setLoading] = useState(false);
  const request = useRef("");
  const row = useRef<HTMLButtonElement>(null);
  const load = (offset = 0) => {
    const requestId = crypto.randomUUID();
    request.current = requestId;
    setLoading(true);
    props.send({
      type: "listFiles",
      repoId: repo.id,
      root,
      path,
      offset,
      requestId,
    });
  };
  useEffect(() => {
    const listener = (event: MessageEvent) => {
      const m = event.data;
      if (m?.type !== "files" || m.requestId !== request.current) return;
      setLoading(false);
      setPage((old) => ({
        ...m,
        entries: m.offset ? [...(old?.entries ?? []), ...m.entries] : m.entries,
      }));
    };
    window.addEventListener("message", listener);
    if (initial) load();
    return () => window.removeEventListener("message", listener);
  }, []);
  const expand = () => {
    setExpanded(true);
    if (!page && !loading) load();
  };
  return (
    <li role="treeitem" aria-expanded={expanded} aria-label={name}>
      <button
        ref={row}
        className="tree-row"
        disabled={props.disabled}
        onClick={() => (expanded ? setExpanded(false) : expand())}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") {
            e.preventDefault();
            if (!expanded) expand();
            else
              (
                e.currentTarget.parentElement?.querySelector(
                  '[role="group"] button',
                ) as HTMLElement
              )?.focus();
          }
          if (e.key === "ArrowLeft") {
            e.preventDefault();
            if (expanded) setExpanded(false);
            else
              (
                e.currentTarget
                  .closest('[role="group"]')
                  ?.parentElement?.querySelector("button") as HTMLElement
              )?.focus();
          }
        }}
      >
        <span aria-hidden="true">{expanded ? "▾" : "▸"}</span>
        <Icon name="explorer" />
        <span>{name}</span>
      </button>
      {expanded && (
        <ul role="group">
          {page?.entries.map((entry) =>
            entry.kind === "directory" ? (
              <Folder
                key={entry.path}
                repo={repo}
                root={root}
                path={entry.path}
                name={entry.name}
                props={props}
              />
            ) : (
              <li
                key={entry.path}
                role="treeitem"
                aria-label={entry.name}
                aria-selected={
                  !!entry.recordId && props.selected.includes(entry.recordId)
                }
              >
                <div className="tree-file">
                  {entry.recordId && (
                    <input
                      type="checkbox"
                      aria-label={`Select ${entry.path}`}
                      checked={props.selected.includes(entry.recordId)}
                      onChange={(e) =>
                        props.select(entry.recordId!, e.target.checked)
                      }
                    />
                  )}
                  <button
                    className="tree-row"
                    disabled={props.disabled || entry.kind === "symlink"}
                    title={
                      entry.kind === "symlink"
                        ? "Symbolic link — not followed"
                        : entry.recordId
                          ? "Open indexed file"
                          : "Open file · not indexed for AI"
                    }
                    onClick={() =>
                      props.send(
                        entry.recordId
                          ? { type: "open", id: entry.recordId }
                          : {
                              type: "openFile",
                              repoId: repo.id,
                              root,
                              path: entry.path,
                            },
                      )
                    }
                  >
                    <Icon name="document" />
                    <span>{entry.name}</span>
                    <small>
                      {entry.kind === "symlink"
                        ? "link"
                        : entry.recordId
                          ? "indexed"
                          : "file"}
                    </small>
                  </button>
                </div>
              </li>
            ),
          )}
          {loading && (
            <li role="none" className="muted">
              Loading folder…
            </li>
          )}
          {page?.error && (
            <li role="none">
              <span role="alert">{page.error}</span>
              <button onClick={() => load()}>Retry folder</button>
            </li>
          )}
          {page && !page.error && !page.entries.length && (
            <li role="none" className="muted">
              Empty folder
            </li>
          )}
          {page?.next != null && (
            <li role="none">
              <button disabled={loading} onClick={() => load(page.next!)}>
                Load more ({page.entries.length} of {page.total})
              </button>
            </li>
          )}
        </ul>
      )}
    </li>
  );
}

export function FileTree(props: Props) {
  const [revision, setRevision] = useState(0);
  return (
    <section className="file-tree-panel" data-tour="tree">
      <div className="toolbar">
        <p className="muted">
          All files, including files excluded from indexing. Expand folders;
          select indexed files to scope Ask AI.
        </p>
        <button
          disabled={props.disabled}
          onClick={() => setRevision((n) => n + 1)}
        >
          <Icon name="sync" />
          Refresh tree
        </button>
      </div>
      <ul
        role="tree"
        aria-label="Repository files"
        className="file-tree"
        onKeyDown={(e) => {
          if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
          const buttons = [
            ...e.currentTarget.querySelectorAll<HTMLButtonElement>(
              "button:not(:disabled)",
            ),
          ];
          const index = buttons.indexOf(e.target as HTMLButtonElement);
          if (index < 0) return;
          e.preventDefault();
          buttons[
            e.key === "Home"
              ? 0
              : e.key === "End"
                ? buttons.length - 1
                : Math.max(
                    0,
                    Math.min(
                      buttons.length - 1,
                      index + (e.key === "ArrowDown" ? 1 : -1),
                    ),
                  )
          ]?.focus();
        }}
      >
        {props.repositories
          .filter((r) => r.permissions.read)
          .flatMap((repo) =>
            repo.roots.map((root) => (
              <Folder
                key={`${repo.id}:${root}:${props.folder}:${revision}`}
                repo={repo}
                root={root}
                path={props.folder
                  .replace(/\\/g, "/")
                  .replace(/^\.\//, "")
                  .replace(/\/$/, "")}
                name={`${repo.name}${repo.roots.length > 1 ? ` · ${decodeURI(root.split("/").at(-1) ?? root)}` : ""}${props.folder ? ` / ${props.folder}` : ""}`}
                props={props}
                initial
              />
            )),
          )}
      </ul>
    </section>
  );
}
