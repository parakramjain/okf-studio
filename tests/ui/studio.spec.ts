import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("welcome, keyboard navigation, actions and native theme accessibility", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "OKF Studio", exact: true }),
  ).toBeVisible();
  await page.evaluate(() => {
    (window as unknown as { messages: unknown[] }).messages = [];
    window.addEventListener("okf-test-message", ((event: CustomEvent) => {
      (window as unknown as { messages: unknown[] }).messages.push(
        event.detail,
      );
    }) as EventListener);
  });
  await page.getByRole("button", { name: "Documents", exact: false }).click();
  expect(
    await page.evaluate(
      () => (window as unknown as { messages: unknown[] }).messages,
    ),
  ).toContainEqual({ type: "mode", mode: "document" });
  await page.getByRole("button", { name: "Choose source" }).click();
  expect(
    await page.evaluate(
      () => (window as unknown as { messages: unknown[] }).messages,
    ),
  ).toContainEqual({ type: "command", command: "import" });
  for (const name of [
    "Knowledge Explorer",
    "AI Assistant",
    "Vector Studio",
    "Quality & Governance",
    "Repositories",
  ]) {
    await page.getByRole("button", { name, exact: true }).click();
    await expect(
      page.getByRole("button", { name, exact: true }),
    ).toHaveAttribute("aria-current", "page");
  }
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toBeVisible();
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(result.violations).toEqual([]);
  await page.setViewportSize({ width: 320, height: 800 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("scoped chat, progress/cancel, citations, preview, graph and review dispatch real messages", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => {
    (window as unknown as { messages: unknown[] }).messages = [];
    window.addEventListener("okf-test-message", ((e: CustomEvent) => {
      (window as unknown as { messages: unknown[] }).messages.push(e.detail);
    }) as EventListener);
    window.postMessage(
      {
        type: "state",
        state: {
          trusted: true,
          repositories: [
            {
              id: "r",
              name: "Fixture",
              kind: "hybrid",
              roots: ["file:///fixture"],
              permissions: { read: true, write: true },
            },
          ],
          records: [
            { id: "d", repoId: "r", path: "guide.md", kind: "document" },
          ],
          issues: [],
          proposals: [
            { id: "p", path: "guide.md", reason: "Review", status: "pending" },
          ],
          graph: {
            nodes: [{ id: "d", label: "Guide", kind: "document" }],
            edges: [],
          },
          provider: "evidence",
          model: "",
          chunkCount: 1,
          mode: "hybrid",
          auditCount: 0,
        },
      },
      "*",
    );
  });
  await page
    .getByRole("button", { name: "Proceed to Create OKF", exact: true })
    .click();
  expect(
    await page.evaluate(
      () => (window as unknown as { messages: unknown[] }).messages,
    ),
  ).toContainEqual({ type: "createBundle", repoId: "r" });
  await page
    .getByRole("button", { name: "Knowledge Explorer", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Explorer display" })
    .selectOption("list");
  await page.getByRole("checkbox", { name: "Select guide.md" }).check();
  await page.getByRole("button", { name: "AI Assistant", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Question", exact: true })
    .fill("Explain authentication");
  await page.getByRole("button", { name: "Ask in scope" }).click();
  const messages = await page.evaluate(
    () =>
      (window as unknown as { messages: { type: string; scope?: unknown }[] })
        .messages,
  );
  expect(messages.find((m) => m.type === "ask")?.scope).toEqual({
    recordIds: ["d"],
  });
  await page.evaluate(() => {
    window.postMessage({ type: "busy", busy: true }, "*");
    window.postMessage(
      {
        type: "progress",
        progress: { stage: "Indexing sources", completed: 1, total: 2 },
      },
      "*",
    );
  });
  await expect(page.getByRole("progressbar")).toHaveAttribute("value", "1");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(
    await page.evaluate(
      () => (window as unknown as { messages: unknown[] }).messages,
    ),
  ).toContainEqual({ type: "cancel" });
  await page.evaluate(() => {
    window.postMessage({ type: "busy", busy: false }, "*");
    window.postMessage({ type: "answer", text: "Source evidence [1]" }, "*");
    window.postMessage(
      {
        type: "results",
        channel: "answer",
        hits: [
          {
            recordId: "d",
            text: "Evidence",
            citation: {
              chunkId: "c",
              title: "Guide",
              span: { start: 2, end: 3 },
              score: 1,
            },
          },
        ],
      },
      "*",
    );
  });
  await expect(page.getByLabel("Answer", { exact: true })).toContainText(
    "Source evidence",
  );
  await page
    .locator("summary")
    .filter({ hasText: "Guide · lines 2–3" })
    .click();
  await page.getByRole("button", { name: /Guide · lines 2–3/ }).click();
  await page
    .getByRole("button", { name: "Knowledge Explorer", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Explorer display" })
    .selectOption("graph");
  await page
    .getByRole("button", { name: "Inspect Guide", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  expect(
    await page.evaluate(
      () => (window as unknown as { messages: unknown[] }).messages,
    ),
  ).toContainEqual({ type: "impact", id: "d", depth: 3 });
  const graphAudit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(graphAudit.violations).toEqual([]);
  await page
    .getByRole("button", { name: "Quality & Governance", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Review & approve", exact: true })
    .click();
  expect(
    await page.evaluate(
      () => (window as unknown as { messages: unknown[] }).messages,
    ),
  ).toContainEqual({ type: "review", id: "p", action: "approve" });
});
