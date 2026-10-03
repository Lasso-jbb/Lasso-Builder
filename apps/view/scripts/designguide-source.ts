// Designguidens kildeudtræk (/designguide). Kører før designguiden bygges (npm run build -w @lasso/view)
// og læser alt direkte fra koden, så guiden aldrig står og fortæller noget, koden ikke gør:
//  - tokens: alle --lasso-*-variabler i packages/ui/src/styles.css med lys og mørk værdi og kommentaren
//  - tekster: al brugervendt tekst i packages/ui/src og de brugervendte filer i packages/spec/src
//  - moduler: hvilke kildefiler hver komponenttype tegnes af (LassoView.tsx) og dens fejlnøgler
//  - dokumenter: reglerne i docs/design/*.md
//  - galleri: demodata til galleriets visninger (tools/gallery), løst som i MCP'en
// Brug (fra repoets rod): npx tsx apps/view/scripts/designguide-source.ts [ud-fil]
import { execSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { parseViewSpec, type Dataset } from "@lasso/spec";
import { DemoProvider } from "../../server/src/data/demo.js";
import { resolveSpec } from "../../server/src/data/resolve.js";
import { ENTRIES } from "../../../tools/gallery/entries/index.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../../..");
const OUT = process.argv[2] ?? join(HERE, "../src/designguide/generated/source.json");
const rel = (p: string) => relative(ROOT, p).replaceAll("\\", "/");

/* ---------- Tokens ---------- */

export interface Token {
  name: string;
  light: string;
  dark?: string;
  comment?: string;
  /** Overskriften (kommentarlinjen) over tokenet i styles.css, fx "Koral: den eneste accentfarve". */
  group: string;
  line: number;
}

/** Brødteksten i den første regel, hvis selektor matcher `head`, fra startindekset. */
function blockAt(css: string, start: number): { body: string; bodyStart: number } {
  const open = css.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}" && --depth === 0) return { body: css.slice(open + 1, i), bodyStart: open + 1 };
  }
  return { body: css.slice(open + 1), bodyStart: open + 1 };
}

function parseTokens(css: string): Token[] {
  const lineOf = (idx: number) => css.slice(0, idx).split("\n").length;
  const light = blockAt(css, css.indexOf(":root,"));
  const darkStart = css.indexOf('.lasso-root[data-theme="dark"] {');
  const dark = darkStart >= 0 ? blockAt(css, darkStart) : { body: "", bodyStart: 0 };
  const decl = /(--lasso-[\w-]+)\s*:\s*([^;]+);[ \t]*(?:\/\*\s*([\s\S]*?)\s*\*\/)?/g;
  const darkValues = new Map<string, string>();
  for (const m of dark.body.matchAll(decl)) darkValues.set(m[1]!, m[2]!.trim());
  const out = new Map<string, Token>();
  let group = "Generelt";
  const lines = light.body.split("\n");
  let offset = light.bodyStart;
  for (const raw of lines) {
    const line = raw.trim();
    const heading = /^\/\*\s*(.+?)\s*\*\/$/.exec(line);
    if (heading && !line.includes("--lasso-")) {
      // "Tilføjet af 01/05 (W2): linjehøjder til …" er en ændringsnote; navnet er det efter kolonet.
      const h = heading[1]!.replace(/^Tilføjet af [^:]*:\s*/, "");
      group = (h.charAt(0).toUpperCase() + h.slice(1)).replace(/\s*\(.*$/, "").trim();
    }
    for (const m of raw.matchAll(decl)) {
      const name = m[1]!;
      // Første forekomst vinder (en senere gentagelse i samme blok er en rettelse af samme token).
      const token: Token = { name, light: m[2]!.trim(), group, line: lineOf(offset + (m.index ?? 0)) };
      if (m[3]) token.comment = m[3].replace(/\s+/g, " ");
      const d = darkValues.get(name);
      if (d && d !== token.light) token.dark = d;
      out.set(name, token);
    }
    offset += raw.length + 1;
  }
  // Tokens, der kun findes i mørk tilstand.
  for (const [name, v] of darkValues) if (!out.has(name)) out.set(name, { name, light: "", dark: v, group: "Kun mørk tilstand", line: 0 });
  return [...out.values()];
}

/* ---------- Tekster ---------- */

export interface Text {
  /** Teksten; `${…}` står som {…} med udtrykket. */
  t: string;
  /** Filen relativt til repoets rod. */
  f: string;
  l: number;
  /** jsx = synlig tekst i JSX, attr = tekst i en attribut (aria-label, title, placeholder …), str = streng i koden. */
  k: "jsx" | "attr" | "str";
  a?: string;
}

const SKIP_ATTRS = new Set(["className", "key", "style", "href", "src", "d", "viewBox", "id", "role", "type", "name", "htmlFor", "fill", "stroke", "points", "transform", "xmlns", "target", "rel", "method", "action", "autoComplete", "inputMode", "lang", "dir", "tabIndex", "width", "height", "x", "y", "cx", "cy", "r", "rx", "ry", "x1", "x2", "y1", "y2", "strokeLinecap", "strokeLinejoin", "strokeWidth", "fillRule", "clipRule", "textAnchor", "dominantBaseline", "preserveAspectRatio", "variant", "kind", "tone", "size", "state", "shape", "span", "as", "icon", "mode", "align", "value", "defaultValue", "data-theme", "data-state"]);

/** Ligner teksten en CSS-klasse, et id, en sti eller CSS frem for noget, en bruger læser? */
function looksLikeCode(s: string): boolean {
  const t = s.trim();
  if (!/\p{L}/u.test(t)) return true;
  if (/^(https?:|mailto:|tel:|\/|\.\.?\/|#)/.test(t)) return true;
  if (/var\(--|calc\(|rgba?\(|:\s*[^ ]+;|^[MmLlHhVvCcSsQqTtAaZz0-9 .,-]+$/.test(t)) return true;
  if (/^[\w.-]+\.(js|ts|tsx|css|json|png|svg|woff2?)$/.test(t)) return true;
  // CSS-klasser: tokens med bindestreger/lasso-præfiks, ingen store bogstaver eller danske tegn.
  const tokens = t.split(/\s+/);
  if (tokens.every((w) => /^[a-z0-9_-]+$/.test(w)) && tokens.some((w) => w.startsWith("lasso") || w.includes("--") || w.includes("__") || /^[a-z]+-[a-z-]+$/.test(w))) return true;
  // Identifikatorer: ét ord i camelCase/PascalCase/SNAKE, fx "LassoKeyValueList", "financials", "NORMAL".
  if (tokens.length === 1 && (/^[a-z]+[A-Z]\w*$/.test(t) || /^Lasso[A-Z]/.test(t) || /^[A-Z_]{3,}$/.test(t) || /^[a-z_]+$/.test(t))) return true;
  return false;
}

function templateText(node: ts.TemplateExpression, sf: ts.SourceFile): string {
  let s = node.head.text;
  for (const span of node.templateSpans) s += `{${span.expression.getText(sf).slice(0, 40)}}${span.literal.text}`;
  return s;
}

function extractTexts(file: string): Text[] {
  const src = readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const out: Text[] = [];
  const seen = new Set<string>();
  const push = (t: string, node: ts.Node, k: Text["k"], a?: string) => {
    const text = t.replace(/\s+/g, " ").trim();
    if (!text || looksLikeCode(text)) return;
    // En skabelon er kun tekst, hvis dens faste dele er det (ikke "{size}px" eller "lasso-x--{tone}").
    if (text.includes("{")) {
      const fixed = text.replace(/\{[^}]*\}/g, " ").replace(/\b(px|em|rem|fr|vh|vw|ms|deg)\b/g, " ").trim();
      if (!/\p{L}{2,}/u.test(fixed) || looksLikeCode(fixed) || /^(rotate|translate|scale|matrix|repeat|minmax|url)\(/.test(fixed)) return;
    }
    const key = `${k}|${text}`;
    if (seen.has(key)) return;
    seen.add(key);
    const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
    out.push({ t: text, f: rel(file), l: line, k, ...(a ? { a } : {}) });
  };
  /** Strengen står et sted, hvor den er kode (import, type, sammenligning, case, nøgle, className …). */
  const isCodePosition = (node: ts.Node): string | false | "skip" => {
    let p: ts.Node | undefined = node.parent;
    let child: ts.Node = node;
    while (p) {
      if (ts.isImportDeclaration(p) || ts.isExportDeclaration(p) || ts.isLiteralTypeNode(p) || ts.isTypeNode(p)) return "skip";
      if (ts.isCaseClause(p) || ts.isElementAccessExpression(p)) return "skip";
      if (ts.isBinaryExpression(p) && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken, ts.SyntaxKind.InKeyword].includes(p.operatorToken.kind)) return "skip";
      if (ts.isPropertyAssignment(p) && p.name === child) return "skip";
      if (ts.isCallExpression(p)) {
        const callee = p.expression.getText(sf);
        if (/(^|\.)(describe|log|warn|debug|info|error|querySelector|querySelectorAll|closest|matches|getAttribute|setAttribute|setProperty|addEventListener|removeEventListener|includes|startsWith|endsWith|test|replace|split|join|matchMedia|createElement|getElementById|toLocaleString|toLocaleDateString|Intl\.NumberFormat)$/.test(callee)) return "skip";
        if (/^(require|import)$/.test(callee)) return "skip";
      }
      if (ts.isJsxAttribute(p)) {
        const name = p.name.getText(sf);
        return SKIP_ATTRS.has(name) || name.startsWith("on") || name.startsWith("data-") ? "skip" : name;
      }
      if (ts.isPropertyAssignment(p)) {
        const name = p.name.getText(sf);
        if (/^(className|key|type|kind|id|icon|tone|variant|style|href|url|path|field|metric|status|focus|layout|width|mode|state|shape|span|group|pattern|section|source|column|show|sort|order)$/.test(name)) return "skip";
      }
      if (ts.isJsxExpression(p) || ts.isReturnStatement(p) || ts.isVariableDeclaration(p) || ts.isArrowFunction(p) || ts.isFunctionDeclaration(p)) return false;
      child = p;
      p = p.parent;
    }
    return false;
  };
  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node)) {
      push(node.text, node, "jsx");
    } else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      const pos = isCodePosition(node);
      if (pos !== "skip") push(node.text, node, pos ? "attr" : ts.isJsxExpression(node.parent) && ts.isJsxElement(node.parent.parent) ? "jsx" : "str", pos || undefined);
    } else if (ts.isTemplateExpression(node)) {
      const pos = isCodePosition(node);
      if (pos !== "skip") push(templateText(node, sf), node, pos ? "attr" : "str", pos || undefined);
      return; // spændene er udtryk, ikke tekst
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

function walk(dir: string, ok: (f: string) => boolean): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p, ok));
    else if (ok(p)) out.push(p);
  }
  return out.sort();
}

/** Model- og udviklervendte filer i spec-pakken (værktøjsbeskrivelser, ordbøger, skemaer) er ikke brugertekst. */
const SPEC_NOT_UI = /\/(catalog|spec|ask|register|registerDoc|templates|criteria|index|lassoId|models|eval\/.*)\.ts$/;

/* ---------- Moduler: kildefiler og fejlnøgler pr. komponenttype ---------- */

function componentSources(): { files: Record<string, string[]>; errPrefixes: Record<string, string[]> } {
  const viewFile = join(ROOT, "packages/ui/src/LassoView.tsx");
  const src = readFileSync(viewFile, "utf8");
  const imports = new Map<string, string>();
  for (const m of src.matchAll(/import\s*\{([^}]+)\}\s*from\s*"\.\/(components\/[\w]+)\.js"/g)) {
    for (const name of m[1]!.split(",").map((s) => s.trim().replace(/^type\s+/, "").split(/\s+as\s+/).pop()!)) if (name) imports.set(name, `packages/ui/src/${m[2]}.tsx`);
  }
  const files: Record<string, string[]> = {};
  const errPrefixes: Record<string, string[]> = {};
  const cases = [...src.matchAll(/case "(Lasso\w+)":/g)];
  cases.forEach((m, i) => {
    let body = src.slice(m.index!, cases[i + 1]?.index ?? m.index! + 4000);
    // Broer i LassoView (fx CompanyHeadBridge): deres krop tæller med, så komponenten og fejlnøglen findes.
    for (const b of body.matchAll(/<(\w+Bridge)\b/g)) {
      const at = src.indexOf(`function ${b[1]}(`);
      if (at >= 0) body += src.slice(at, src.indexOf("\n}\n", at));
    }
    const set = new Set<string>();
    for (const t of body.matchAll(/<([A-Z]\w+)/g)) {
      const f = imports.get(t[1]!);
      if (f) set.add(f);
    }
    // Komponentens egne lokale imports (fx statementTable), ét niveau ned.
    for (const f of [...set]) {
      try {
        const own = readFileSync(join(ROOT, f), "utf8");
        for (const im of own.matchAll(/from\s*"\.\/(\w+)\.js"/g)) {
          const p = `packages/ui/src/components/${im[1]}.tsx`;
          try {
            statSync(join(ROOT, p));
            if (!/\/(Icon|Tooltip|Menu|Layer|Button|ExpandLink|Tabs|TabStrip|Toast|Dialog|Values)\.tsx$/.test(p)) set.add(p);
          } catch {
            /* .ts-hjælper eller findes ikke */
          }
        }
      } catch {
        /* ignoreres */
      }
    }
    files[m[1]!] = [...(files[m[1]!] ?? []), ...set].filter((v, k, a) => a.indexOf(v) === k);
    // Fejlnøgler: err(`x:…`) og errors[`x:…`] i LassoView, og errors[`x:…`] i komponentens egne filer (fx CompareTable).
    const own = [...set].map((f) => readFileSync(join(ROOT, f), "utf8")).join("\n");
    errPrefixes[m[1]!] = [...new Set([...body.matchAll(/(?:err\(|errors\[)`(\w+):/g), ...own.matchAll(/errors\[`(\w+):/g)].map((x) => x[1]!))];
  });
  return { files, errPrefixes };
}

/* ---------- Dokumenter ---------- */

function docs(): { file: string; title: string; markdown: string }[] {
  const dir = join(ROOT, "docs/design");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .sort((a, b) => (a === "README.md" ? -1 : b === "README.md" ? 1 : a.localeCompare(b)))
    .map((f) => {
      const markdown = readFileSync(join(dir, f), "utf8");
      return { file: `docs/design/${f}`, title: /^#\s+(.+)$/m.exec(markdown)?.[1] ?? f, markdown };
    });
}

/* ---------- Galleri ---------- */

async function galleryData(): Promise<{ data: Record<string, Dataset>; problems: string[] }> {
  const provider = new DemoProvider();
  const data: Record<string, Dataset> = {};
  const problems: string[] = [];
  for (const [i, e] of ENTRIES.entries()) {
    if (!e.spec) continue;
    try {
      data[String(i)] = await resolveSpec(parseViewSpec(e.spec), provider);
    } catch (err) {
      problems.push(`${e.nr} ${e.title}: ${(err as Error).message}`);
    }
  }
  return { data, problems };
}

/* ---------- Samlet ---------- */

const css = readFileSync(join(ROOT, "packages/ui/src/styles.css"), "utf8");
const uiFiles = walk(join(ROOT, "packages/ui/src"), (f) => /\.(tsx?)$/.test(f) && !f.endsWith(".test.ts") && !f.endsWith(".test.tsx"));
const specFiles = walk(join(ROOT, "packages/spec/src"), (f) => f.endsWith(".ts") && !f.endsWith(".test.ts") && !SPEC_NOT_UI.test(f.replaceAll("\\", "/")));
const texts = [...uiFiles, ...specFiles].flatMap(extractTexts);
const { files, errPrefixes } = componentSources();
const gallery = await galleryData();
let commit = "";
try {
  commit = execSync("git rev-parse --short HEAD", { cwd: ROOT, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
} catch {
  commit = process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 7) ?? "";
}

const source = {
  generatedAt: new Date().toISOString(),
  commit,
  stylesLines: css.split("\n").length,
  tokens: parseTokens(css),
  texts,
  componentFiles: files,
  errPrefixes,
  docs: docs(),
  gallery,
};
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(source));
console.log(`designguide: ${source.tokens.length} tokens, ${texts.length} tekster fra ${uiFiles.length + specFiles.length} filer, ${Object.keys(files).length} moduler, ${source.docs.length} dokumenter, ${Object.keys(gallery.data).length} galleridatasæt -> ${rel(OUT)}`);
if (gallery.problems.length) console.log("Galleriproblemer:\n" + gallery.problems.join("\n"));
