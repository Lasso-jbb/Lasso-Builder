import { readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";

/**
 * Finder den byggede render-app (én HTML-fil). I produktion ligger den ved
 * siden af server-bundlen; under udvikling i apps/view/dist.
 */
const HERE = path.dirname(fileURLToPath(import.meta.url));
const CANDIDATES = [
  process.env.VIEW_HTML_PATH,
  path.join(HERE, "view.html"),
  path.join(HERE, "../../view/dist/view.html"), // fra apps/server/dist
  path.join(HERE, "../../../view/dist/view.html"), // fra apps/server/src/web (udvikling)
].filter((p): p is string => Boolean(p));

let cached: string | null = null;

/**
 * Kort hash af den byggede render-app. Indgår i visningens ui://-adresse, så Claude og
 * ChatGPT henter den nye app efter hver deploy i stedet for at bruge en gemt, gammel
 * version (som ikke kender nye komponenter og derfor tegner tomme felter).
 */
export function viewVersion(): string {
  const file = CANDIDATES.find((p) => existsSync(p));
  if (!file) return "dev";
  return createHash("sha256").update(readFileSync(file)).digest("hex").slice(0, 10);
}

export async function loadViewHtml(): Promise<string> {
  if (cached && process.env.NODE_ENV === "production") return cached;
  const file = CANDIDATES.find((p) => existsSync(p));
  if (!file) {
    return `<!doctype html><html lang="da"><head><meta charset="utf-8"><title>Lasso</title></head><body style="font-family:system-ui;padding:24px"><h1>Render-appen er ikke bygget</h1><p>Kør <code>npm run build -w @lasso/view</code>.</p></body></html>`;
  }
  cached = await readFile(file, "utf8");
  return cached;
}

const GUIDE_CANDIDATES = [
  process.env.DESIGNGUIDE_HTML_PATH,
  path.join(HERE, "designguide.html"),
  path.join(HERE, "../../view/dist/designguide.html"), // fra apps/server/dist
  path.join(HERE, "../../../view/dist/designguide.html"), // fra apps/server/src/web (udvikling)
].filter((p): p is string => Boolean(p));
let guideCached: string | null = null;

/** Designguiden (/designguide) er sin egen HTML-fil, så MCP-appen ikke får kildeudtrækket med. */
export async function loadDesignguideHtml(): Promise<string> {
  if (guideCached && process.env.NODE_ENV === "production") return guideCached;
  const file = GUIDE_CANDIDATES.find((p) => existsSync(p));
  if (!file) {
    return `<!doctype html><html lang="da"><head><meta charset="utf-8"><title>Designguide</title></head><body style="font-family:system-ui;padding:24px"><h1>Designguiden er ikke bygget</h1><p>Kør <code>npm run build -w @lasso/view</code>.</p></body></html>`;
  }
  guideCached = await readFile(file, "utf8");
  return guideCached;
}

/** Indsætter startdata til web-tilstand (delte links). JSON escapes, så den ikke kan bryde ud af <script>. */
export function injectBoot(html: string, boot: unknown, title: string): string {
  const json = JSON.stringify(boot).replace(/</g, "\\u003c").replaceAll(String.fromCharCode(0x2028), "\\u2028").replaceAll(String.fromCharCode(0x2029), "\\u2029");
  const safeTitle = title.replace(/[<>&"]/g, (ch) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[ch]!);
  const withTitle = html.replace(/<title>[^<]*<\/title>/, `<title>${safeTitle}, Lasso</title>`);
  // Det sidste </head>: den indlejrede app står selv i <head> og kan indeholde teksten "</head>".
  const at = withTitle.lastIndexOf("</head>");
  if (at < 0) return withTitle.replace("<body", `<script>window.__LASSO_BOOT__=${json};</script><body`);
  return `${withTitle.slice(0, at)}<script>window.__LASSO_BOOT__=${json};</script>${withTitle.slice(at)}`;
}
