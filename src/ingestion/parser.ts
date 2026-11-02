import ts from "typescript";
import { parser as python } from "@lezer/python";
import type { CodeSymbol, KnowledgeRecord, Repository } from "../domain/types";
import { hash } from "../domain/security";
import { parseOKF } from "./okf";
const lineAt = (text: string, offset: number) =>
  text.slice(0, offset).split("\n").length;
export const isCode = (file: string): boolean =>
  /\.(?:[cm]?[jt]sx?|py)$/i.test(file);
export const supported = (file: string): boolean =>
  isCode(file) || /\.(?:md|markdown|txt|html?)$/i.test(file);
export function parseSource(
  repo: Repository,
  root: string,
  path: string,
  uri: string,
  source: string,
): KnowledgeRecord {
  const id = hash(`${repo.id}:${root}:${path}`);
  const code = isCode(path);
  const symbols: CodeSymbol[] = [];
  const imports: string[] = [];
  const content = /\.html?$/i.test(path)
    ? source
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, (text) =>
          text.replace(/[^\n]/g, " "),
        )
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, (text) =>
          text.replace(/[^\n]/g, " "),
        )
        .replace(/<[^>]*>/g, (text) => text.replace(/[^\n]/g, " "))
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&")
    : source;
  const add = (
    name: string,
    kind: CodeSymbol["kind"],
    start: number,
    end: number,
    signature: string,
    calls: string[] = [],
  ) => {
    const ordinal = symbols.filter((s) => s.name === name).length;
    symbols.push({
      id: hash(`${id}:${kind}:${name}:${ordinal}`),
      name,
      kind,
      span: { start: lineAt(content, start), end: lineAt(content, end) },
      signature: signature.slice(0, 500),
      calls,
    });
  };
  if (code && !path.endsWith(".py")) {
    const ast = ts.createSourceFile(
      path,
      content,
      ts.ScriptTarget.Latest,
      true,
    );
    const callsIn = (node: ts.Node): string[] => {
      const names: string[] = [];
      const visit = (n: ts.Node) => {
        if (ts.isCallExpression(n)) names.push(n.expression.getText(ast));
        ts.forEachChild(n, visit);
      };
      visit(node);
      return [...new Set(names)];
    };
    const visit = (node: ts.Node): void => {
      if (
        ts.isImportDeclaration(node) &&
        ts.isStringLiteral(node.moduleSpecifier)
      )
        imports.push(node.moduleSpecifier.text);
      if (
        (ts.isFunctionDeclaration(node) ||
          ts.isMethodDeclaration(node) ||
          ts.isClassDeclaration(node) ||
          ts.isInterfaceDeclaration(node) ||
          ts.isTypeAliasDeclaration(node)) &&
        node.name
      ) {
        const kind = ts.isClassDeclaration(node)
          ? "class"
          : ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)
            ? "schema"
            : "function";
        const start = node.getStart(ast);
        const body = "body" in node ? node.body : undefined;
        add(
          node.name.getText(ast),
          /(?:^|[._])test|spec/i.test(path) ? "test" : kind,
          start,
          node.end,
          content
            .slice(
              start,
              body?.getStart(ast) ?? Math.min(node.end, start + 300),
            )
            .trim(),
          callsIn(node),
        );
      }
      if (
        ts.isVariableDeclaration(node) &&
        node.initializer &&
        (ts.isArrowFunction(node.initializer) ||
          ts.isFunctionExpression(node.initializer))
      )
        add(
          node.name.getText(ast),
          "function",
          node.getStart(ast),
          node.end,
          content
            .slice(node.getStart(ast), node.initializer.body.getStart(ast))
            .trim(),
          callsIn(node),
        );
      if (ts.isCallExpression(node)) {
        const callee = node.expression.getText(ast);
        if (
          /\.(get|post|put|delete|patch|route)$/.test(callee) &&
          node.arguments[0] &&
          ts.isStringLiteral(node.arguments[0])
        )
          add(
            `${callee} ${node.arguments[0].text}`,
            "API",
            node.getStart(ast),
            node.end,
            callee,
          );
        if (
          /^(test|it|describe)$/.test(callee) &&
          node.arguments[0] &&
          ts.isStringLiteral(node.arguments[0])
        )
          add(
            node.arguments[0].text,
            "test",
            node.getStart(ast),
            node.end,
            callee,
            callsIn(node),
          );
        if (
          callee === "require" &&
          node.arguments[0] &&
          ts.isStringLiteral(node.arguments[0])
        )
          imports.push(node.arguments[0].text);
      }
      ts.forEachChild(node, visit);
    };
    visit(ast);
  } else if (code) {
    const tree = python.parse(content);
    const cursor = tree.cursor();
    do {
      const name = cursor.name;
      const start = cursor.from;
      const end = cursor.to;
      if (name === "FunctionDefinition" || name === "ClassDefinition") {
        const header = content.slice(
          start,
          cursor.node.getChild('Body')?.from??(content.indexOf("\n", start) === -1?end:content.indexOf("\n", start)),
        );
        const symbolName = /(?:async\s+)?(?:def|class)\s+(\w+)/.exec(
          header,
        )?.[1];
        if (symbolName) {
          const body = content.slice(start, end);
          const calls = [...body.matchAll(/\b([\w.]+)\s*\(/g)]
            .map((m) => m[1])
            .filter((n) => n !== symbolName);
          add(
            symbolName,
            /test/i.test(path) || symbolName.startsWith("test_")
              ? "test"
              : name === "ClassDefinition"
                ? "class"
                : "function",
            start,
            end,
            header,
            calls,
          );
          if(name==='ClassDefinition'&&/\b(?:BaseModel|TypedDict|Schema)\b/.test(header))add(symbolName+' schema','schema',start,end,header);
        }
      }
      if(name==='Decorator'){const decorator=content.slice(start,end);const match=/@([\w.]+\.(?:get|post|put|delete|patch|route))\s*\(\s*['"]([^'"]+)['"]/.exec(decorator);if(match)add(`${match[1]} ${match[2]}`,'API',start,end,decorator.trim());}
      if (name === "ImportStatement") {
        const value = content.slice(start, end);
        const module = /from\s+(\S+)\s+import|import\s+(\S+)/.exec(value);
        if (module) imports.push(module[1] || module[2]);
      }
    } while (cursor.next());
  }
  const parsed = parseOKF(content);
  const headings = [...content.matchAll(/^(#{1,6})\s+(.+)$/gm)].map((m) => ({
    title: m[2],
    line: lineAt(content, m.index!),
  }));
  if(/\.html?$/i.test(path))for(const match of source.matchAll(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/gi))headings.push({title:match[1].replace(/<[^>]+>/g,''),line:lineAt(source,match.index!)});
  if (!code) {
    for (const m of content.matchAll(/\b(REQ[-_]\d+)\b/g))
      if (!symbols.some((s) => s.name === m[1]))
        add(m[1], "requirement", m.index!, m.index! + m[0].length, m[0]);
    if (
      /^\s*#\s*(?:ADR|Decision)/im.test(content) ||
      parsed.metadata.type === "Decision"
    )
      add(path, "decision", 0, content.length, headings[0]?.title || path);
  }
  return {
    id,
    repoId: repo.id,
    root,
    path,
    sourceUri: uri,
    title: String(parsed.metadata.title || headings[0]?.title || path),
    kind: code ? "code" : "document",
    content,
    contentHash: hash(source),
    commit: repo.commit,
    span: { start: 1, end: content.split("\n").length },
    confidence: 1,
    status: String(parsed.metadata.status || "stable"),
    metadata: parsed.metadata,
    symbols,
    imports: [...new Set(imports)],
    links: [...new Set([...content.matchAll(/\[[^\]]*\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g)].map(m=>m[1]).concat(/\.html?$/i.test(path)?[...source.matchAll(/\bhref\s*=\s*['"]([^'"]+)['"]/gi)].map(m=>m[1]):[]))],
    headings,
    indexedAt: new Date().toISOString(),
  };
}
