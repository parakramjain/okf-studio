import React from "react";

const paths = {
  agent:
    "M8 5h8v3H8z M5 8h14v12H5z M9 12v2 M15 12v2 M9 17h6 M12 2v3 M2 11v6 M22 11v6",
  guide:
    "M12 5C9 3 5 3 2 4v16c3-1 7-1 10 1 3-2 7-2 10-1V4c-3-1-7-1-10 1z M12 5v16",
  tour: "M9 7l8 5-8 5z M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  git: "M7 3v12a4 4 0 0 0 8 0V9 M7 7h7a4 4 0 0 0 4-4 M9 3a2 2 0 1 1-4 0 2 2 0 0 1 4 0 M20 3a2 2 0 1 1-4 0 2 2 0 0 1 4 0",
  overview: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  explorer: "M3 7h7l2-3h9v16H3z M3 10h18",
  ask: "M4 4h16v12H9l-5 4z M8 8h8 M8 12h5",
  indexes: "M3 6l9-4 9 4-9 4z M3 12l9 4 9-4 M3 18l9 4 9-4",
  insights: "M4 20V10 M12 20V4 M20 20v-7",
  search: "M21 21l-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  plus: "M12 5v14 M5 12h14",
  sync: "M20 8a9 9 0 0 0-15-3L2 8 M2 2v6h6 M4 16a9 9 0 0 0 15 3l3-3 M16 16h6v6",
  settings: "M4 7h16 M4 17h16 M9 4v6 M15 14v6",
  arrow: "M5 12h14 M13 6l6 6-6 6",
  code: "M8 5l-6 7 6 7 M16 5l6 7-6 7 M14 3l-4 18",
  document: "M5 2h9l5 5v15H5z M14 2v6h5 M8 12h8 M8 16h6",
  check: "M5 12l4 4L19 6",
  shield: "M12 2l8 4v6c0 5-8 10-8 10S4 17 4 12V6z M8 11l3 3 5-5",
  close: "M6 6l12 12 M6 18L18 6",
  bookmark: "M6 3h12v19l-6-4-6 4z",
  clock: "M12 7v5l4 2 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  warning: "M12 3l10 18H2z M12 9v5 M12 17v1",
  graph:
    "M6 6l12 6-12 6 M6 6v12 M8 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0 M20 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0 M8 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0",
};
export type IconName = keyof typeof paths;
export function Icon({
  name,
  className = "",
}: {
  name: IconName;
  className?: string;
}) {
  return (
    <svg
      className={`icon ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={paths[name]} />
    </svg>
  );
}
export function Brand() {
  return (
    <svg
      className="brand-mark"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M18.7 5.1 12 1.5 3 6.8v10.4l9 5.3 9-5.3V9.7" />
        <path d="m8 8 6.5 4L8 16m6.5-4 5-3" />
      </g>
      <g fill="currentColor">
        <circle cx="8" cy="8" r="1.8" />
        <circle cx="8" cy="16" r="1.8" />
        <circle cx="14.5" cy="12" r="2" />
        <circle cx="20" cy="8.5" r="1.8" />
      </g>
    </svg>
  );
}
export function Empty({
  title,
  children,
  icon = "explorer",
}: {
  title: string;
  children: React.ReactNode;
  icon?: IconName;
}) {
  return (
    <div className="empty-state">
      <Icon name={icon} />
      <h3>{title}</h3>
      <div className="muted">{children}</div>
    </div>
  );
}
export function SectionTitle({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="section-title">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h2>{title}</h2>
      </div>
      {children}
    </div>
  );
}
