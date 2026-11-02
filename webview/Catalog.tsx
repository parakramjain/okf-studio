import React, { useEffect, useRef, useState } from "react";
import features from "../src/domain/features.json";
import { tabs, type Tab } from "./model";
export function Catalog({
  page,
  version,
  publisher,
  close,
  navigate,
}: {
  page: "features" | "about";
  version?: string;
  publisher?: string;
  close: () => void;
  navigate: (tab: Tab) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  useEffect(() => {
    const prior = document.activeElement;
    dialog.current?.showModal();
    return () => {
      if (prior instanceof HTMLElement) prior.focus();
    };
  }, []);
  const items = features.filter(
    (f) =>
      (!category || f.section === category) &&
      `${f.title} ${f.benefit} ${f.prerequisites}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <dialog
      ref={dialog}
      className="catalog-dialog"
      onCancel={close}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          close();
        }
      }}
      aria-labelledby="catalog-title"
    >
      <div className="row">
        <h2 id="catalog-title" className="grow">
          {page === "features" ? "FEATURES" : "About OKF Studio"}
        </h2>
        <button onClick={close}>
          Close {page === "features" ? "features" : "about"}
        </button>
      </div>
      <p className="lead">
        Turn code and documents into trusted knowledge that AI agents can use.
      </p>
      {page === "about" ? (
        <>
          <dl className="about-grid">
            <dt>Author</dt>
            <dd>Parakram Jain</dd>
            <dt>Developer</dt>
            <dd>Parakram Jain</dd>
            <dt>Owner</dt>
            <dd>Parakram Jain</dd>
            <dt>Version</dt>
            <dd>{version ?? "Development build"}</dd>
            <dt>Extension ID</dt>
            <dd>{publisher ?? "okf-studio-local"}.okf-knowledge-studio</dd>
            <dt>Marketplace publication</dt>
            <dd>Pending verified publisher and release approval</dd>
            <dt>License</dt>
            <dd>MIT. Third-party notices are included in the extension.</dd>
          </dl>
          <p>
            Local-first software. No telemetry exporter. External providers
            receive data only through configured, consented operations.
          </p>
          <p>
            Windows workflows are tested locally. Live provider accounts, remote
            Git actions, macOS/Linux/remote hosts, and manual screen-reader
            behavior are Not Verified unless recorded in the release evidence.
          </p>
        </>
      ) : (
        <>
          <div className="journeys">
            <p>
              <strong>Understand any repository.</strong> Import supported code
              or documents, create OKF, and explore relationships.
            </p>
            <p>
              <strong>Ask your knowledge.</strong> Get cited evidence for one
              document or a chosen scope.
            </p>
            <p>
              <strong>Give agents reliable context.</strong> Use MCP, context
              packs, provenance, and reviewed updates.
            </p>
          </div>
          <div className="scope-fields">
            <label>
              Find a feature
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                type="search"
              />
            </label>
            <label>
              Feature category
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">All six categories</option>
                {tabs.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
          </div>
          <p className="muted">
            Supported means implemented; live service verification is listed
            separately. Experimental features use approximations. Planned
            features are unavailable.
          </p>
          <p role="status">{items.length} features</p>
          <div className="feature-catalog">
            {items.map((f) => (
              <article key={f.title}>
                <div className="row">
                  <span className="eyebrow grow">{f.section}</span>
                  <span className="chip">{f.status}</span>
                </div>
                <h3>{f.title}</h3>
                <p>{f.benefit}</p>
                <small>
                  <strong>Requires:</strong> {f.prerequisites}
                </small>
                {f.status !== "Planned" && (
                  <button
                    onClick={() => {
                      navigate(f.section as Tab);
                      close();
                    }}
                  >
                    Open {f.section}
                  </button>
                )}
              </article>
            ))}
          </div>
        </>
      )}
    </dialog>
  );
}
