import React, { useEffect, useRef, useState } from "react";
import { Icon } from "./components";
import { tabs, type Tab } from "./model";

export const pageHelp: Record<
  Tab,
  { purpose: string; features: string[]; steps: [string, string, string][] }
> = {
  "Agent Hub": {
    purpose:
      "Connect coding agents to your knowledge, test MCP tools, and prepare bounded evidence packs.",
    features: [
      "MCP runtime check",
      "Tool catalog",
      "Context packs",
      "Agent setup",
    ],
    steps: [
      [
        "agent-status",
        "Verify the connection",
        "Registration means VS Code knows the provider. Test MCP runtime to verify the packaged server and authenticated tool call; client setup is a separate step.",
      ],
      [
        "agent-pack",
        "Control agent context",
        "Choose a scope, describe the coding task, and preview the redacted evidence and token budget. Export a portable pack for another client.",
      ],
      [
        "agent-tools",
        "Try tools safely",
        "Run read-only tools locally. Agent proposals still require permission to queue and a separate human review before writing.",
      ],
    ],
  },
  Repositories: {
    purpose:
      "Connect a repository and follow its journey from source files to useful, maintained knowledge.",
    features: [
      "Repository setup",
      "OKF creation",
      "Sync health",
      "Git workflows",
    ],
    steps: [
      [
        "workflow",
        "Your workflow",
        "Import sources, choose an OKF destination, explore, ask questions, then review future updates.",
      ],
      [
        "repositories",
        "Create your first OKF",
        "Proceed to Create OKF asks for a parent location and folder name. A new bundle is built immediately; existing bundle changes go to Quality & Governance.",
      ],
      [
        "git",
        "Work with Git",
        "Choose a repository to inspect status and history, switch branches, fetch, pull, commit, or push using VS Code’s Git workflow.",
      ],
    ],
  },
  "Knowledge Explorer": {
    purpose:
      "Browse every repository file in expandable folders, then search indexed knowledge or follow relationships.",
    features: [
      "Full file tree",
      "Keyword & semantic search",
      "Saved views",
      "Graph & change impact",
    ],
    steps: [
      [
        "scope",
        "Choose your scope",
        "Limit search and AI by repository, folder, or selected indexed files. Reset scope to return to the whole workspace.",
      ],
      [
        "tree",
        "Browse the real files",
        "Folders expand on demand. All filenames appear, including unindexed files. Indexed files have checkboxes for AI Assistant. Use arrow keys to navigate.",
      ],
      [
        "sources",
        "Search and connect",
        "List and graph show the indexed catalog. Search checks the full index; saved views remember your scope and filters.",
      ],
    ],
  },
  "AI Assistant": {
    purpose:
      "Ask a specific question and receive an answer grounded in relevant excerpts with file and line citations.",
    features: [
      "Relevant excerpts only",
      "Context preview",
      "Token estimates",
      "Cited answers",
    ],
    steps: [
      [
        "scope",
        "Control the evidence",
        "Choose a repository or select files in Knowledge Explorer. An unscoped question searches the workspace locally before choosing excerpts.",
      ],
      [
        "question",
        "Preview before asking",
        "Preview context shows the exact evidence pack and estimated tokens without calling a model. No relevant match means no model request.",
      ],
      [
        "answer",
        "Verify the answer",
        "Open citations to check the underlying files. Evidence mode works offline; a configured chat provider can synthesize an answer.",
      ],
    ],
  },
  "Vector Studio": {
    purpose:
      "Prepare optional semantic search and keep the local and vector indexes current.",
    features: [
      "Provider setup",
      "Embedding preview",
      "Build & reindex",
      "Rollback & cleanup",
    ],
    steps: [
      [
        "page-content",
        "Optional semantic search",
        "Keyword retrieval and file browsing work without embeddings. Configure an embedding provider only when you want semantic search.",
      ],
      [
        "page-content",
        "Inspect the build",
        "Preview estimates the entire embedding job. These are indexing tokens, separate from the small evidence pack used by AI Assistant.",
      ],
      [
        "page-content",
        "Maintain the index",
        "Reindex after changing embedding settings. Rollback restores the previous vector namespace; cleanup removes obsolete vectors.",
      ],
    ],
  },
  "Quality & Governance": {
    purpose:
      "Find knowledge gaps and review proposed changes before they update existing files.",
    features: [
      "Quality & coverage",
      "Drift findings",
      "Select all",
      "Combined review & approval",
    ],
    steps: [
      [
        "page-content",
        "Understand health",
        "Review errors, warnings, coverage, and source drift. Filter findings to focus on the changes that matter.",
      ],
      [
        "review",
        "Select your changes",
        "Select all pending changes or pick individual files. Review & approve all opens a combined diff and asks for one confirmation.",
      ],
      [
        "review",
        "Keep edits safe",
        "Changed sources or targets block approval. Reject dismisses a proposal; Undo restores an approved file only if it has not changed since.",
      ],
    ],
  },
};

export function PageHelp({
  tab,
  start,
}: {
  tab: Tab;
  start: (full?: boolean) => void;
}) {
  const help = pageHelp[tab];
  return (
    <section className="page-help" aria-label={`${tab} explanation`}>
      <div>
        <p>{help.purpose}</p>
        <div className="feature-tags">
          {help.features.map((f) => (
            <span key={f}>{f}</span>
          ))}
        </div>
      </div>
      <button onClick={() => start()}>
        <Icon name="tour" />
        Tour this page
      </button>
    </section>
  );
}
export function Tour({
  tab,
  full,
  navigate,
  close,
}: {
  tab: Tab;
  full: boolean;
  navigate: (tab: Tab) => void;
  close: () => void;
}) {
  const [index, setIndex] = useState(0);
  const initialTab = useRef(tab);
  const dialog = useRef<HTMLDialogElement>(null);
  const steps = full
    ? tabs.flatMap((t) => pageHelp[t].steps.map((s) => ({ tab: t, step: s })))
    : pageHelp[initialTab.current].steps.map((s) => ({
        tab: initialTab.current,
        step: s,
      }));
  const current = steps[index];
  useEffect(() => {
    const prior = document.activeElement;
    dialog.current?.showModal();
    return () => {
      if (prior instanceof HTMLElement) prior.focus();
    };
  }, []);
  useEffect(() => {
    navigate(current.tab);
    const id = requestAnimationFrame(() => {
      const target = document.querySelector(`[data-tour="${current.step[0]}"]`);
      target?.classList.add("tour-highlight");
      target?.scrollIntoView({ block: "center", behavior: "instant" });
    });
    return () => {
      cancelAnimationFrame(id);
      document
        .querySelectorAll(".tour-highlight")
        .forEach((e) => e.classList.remove("tour-highlight"));
    };
  }, [index]);
  return (
    <dialog
      ref={dialog}
      className="tour-dialog"
      aria-labelledby="tour-title"
      onCancel={close}
    >
      <div className="eyebrow">
        {full ? "STUDIO TOUR" : `${initialTab.current.toUpperCase()} TOUR`} ·{" "}
        {index + 1} / {steps.length}
      </div>
      <h2 id="tour-title">{current.step[1]}</h2>
      <p>{current.step[2]}</p>
      <progress
        aria-label="Tour progress"
        value={index + 1}
        max={steps.length}
      />
      <div className="toolbar">
        <button onClick={close}>Close tour</button>
        <button disabled={!index} onClick={() => setIndex((i) => i - 1)}>
          Back
        </button>
        <button
          className="primary"
          onClick={() =>
            index + 1 === steps.length ? close() : setIndex((i) => i + 1)
          }
        >
          {index + 1 === steps.length ? "Finish tour" : "Next"}
        </button>
      </div>
    </dialog>
  );
}

export function Workflow({
  repositories,
  sources,
  pending,
  navigate,
  command,
}: {
  repositories: number;
  sources: number;
  pending: number;
  navigate: (t: Tab) => void;
  command: (name: string) => void;
}) {
  const steps: {
    title: string;
    text: string;
    action: () => void;
    status: string;
  }[] = [
    {
      title: "Connect",
      text: "Import a local folder, workspace, or Git repository.",
      action: () => command("import"),
      status: repositories ? `${repositories} connected` : "Start here",
    },
    {
      title: "Create OKF",
      text: "Choose a destination and build portable knowledge.",
      action: () => command("generate"),
      status: sources ? "Ready to create" : "Import & sync first",
    },
    {
      title: "Explore",
      text: "Browse files, search knowledge, and trace dependencies.",
      action: () => navigate("Knowledge Explorer"),
      status: `${sources} indexed files`,
    },
    {
      title: "Ask",
      text: "Preview relevant evidence, then ask a cited question.",
      action: () => navigate("AI Assistant"),
      status: "Relevant excerpts only",
    },
    {
      title: "Review",
      text: "Resolve findings and approve updates to existing files.",
      action: () => navigate("Quality & Governance"),
      status: pending ? `${pending} pending changes` : "No pending changes",
    },
  ];
  return (
    <section data-tour="workflow" className="workflow">
      <h2>From repository to knowledge</h2>
      <ol>
        {steps.map((s, i) => (
          <li key={s.title}>
            <button onClick={s.action}>
              <span className="step-number">{i + 1}</span>
              <strong>{s.title}</strong>
              <small>{s.text}</small>
              <span className="workflow-status">
                {s.status}
                <Icon name="arrow" />
              </span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
