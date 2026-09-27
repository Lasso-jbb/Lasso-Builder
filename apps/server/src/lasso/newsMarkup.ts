/**
 * Lasso News' indlejrede entitets-markup og HTML-oprydning (katalog 12, "Nyheder").
 *
 * `POST /modules/news` leverer headline/content/tagLine med indlejret markup i formatet
 * "{Navn|LassoId}" (fx "{LASSO X A/S|CVR-1-34580820}"). Lasso demonstrerer selv mekanismen i
 * deres dokumentation med regex /{([^}]*)}/g, split på "|" — se docs/endpoints-risiko-nyheder.md.
 * `content` er desuden HTML ("sæt som innerHTML" ifølge dokumentationen), men vores UI sætter
 * aldrig innerHTML (packages/ui/src/components/LassoNews.tsx), så HTML strippes til ren tekst her.
 */

export interface MarkupSegment {
  text: string;
  lassoId?: string;
}

const ENTITY_RE = /\{([^}]*)\}/g;

/**
 * Splitter en tekst med "{Navn|LassoId}"-markup op i almindelige og navngivne segmenter.
 * En brik uden LassoId (kun tekst i klammerne) får blot `lassoId: undefined`.
 */
export function parseEntityMarkup(text: string): MarkupSegment[] {
  if (!text) return [];
  const segments: MarkupSegment[] = [];
  let last = 0;
  ENTITY_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ENTITY_RE.exec(text))) {
    if (m.index > last) segments.push({ text: text.slice(last, m.index) });
    const [name, lassoId] = m[1]!.split("|");
    segments.push({ text: (name ?? "").trim(), lassoId: lassoId?.trim() || undefined });
    last = m.index + m[0].length;
  }
  if (last < text.length) segments.push({ text: text.slice(last) });
  return segments;
}

/**
 * Ren tekst uden markup (navnene beholdes, klammerne og Lasso Id'erne fjernes). Vandret
 * mellemrum (mellemrum/tab) collapses, men linjeskift bevares — `stripHtml` lægger dem ind for
 * <br>/<li>, og de skal ikke gå tabt igen her (fx en liste af nye bestyrelsesmedlemmer).
 */
export function plainTextFromMarkup(text: string | undefined): string | undefined {
  if (!text) return undefined;
  const plain = parseEntityMarkup(text)
    .map((s) => s.text)
    .join("");
  const lines = plain
    .replace(/[^\S\n]+/g, " ")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  return lines.join("\n") || undefined;
}

/**
 * HTML til ren tekst: <br>/<li> bliver linjeskift, resten af tags fjernes, og de mest almindelige
 * HTML-entiteter afkodes. Tomme linjer droppes. Bruges kun til content-feltet fra Lasso News.
 */
export function stripHtml(html: string | undefined): string | undefined {
  if (!html) return undefined;
  const withBreaks = html
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\s*li[^>]*>/gi, "\n")
    .replace(/<\s*\/\s*(p|div)\s*>/gi, "\n");
  const text = withBreaks
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/gi, "'");
  const lines = text
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  return lines.join("\n") || undefined;
}
