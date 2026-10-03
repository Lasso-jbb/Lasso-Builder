/**
 * Lassos tekster (fx erhvervsresuméet, GET /modules/resume) har personer og virksomheder som metadata i
 * teksten: "{Annelise Jensen|CVR-3-4000654321}". De vises som links (visningen) eller som navnet alene
 * (tekstkort, resumé til Claude, print). Kun mønstre med præcis to dele ("navn|id") er links; andre
 * krøllede parenteser står urørt, som i Lassos eget snippet.
 */
export type TextPart = string | { name: string; lassoId: string };

const LINK = /\{([^{}]*)\}/g;

export function parseEntityLinks(text: string): TextPart[] {
  const out: TextPart[] = [];
  let last = 0;
  for (const m of text.matchAll(LINK)) {
    const parts = m[1]!.split("|");
    if (parts.length !== 2 || !parts[0]!.trim()) continue;
    if (m.index! > last) out.push(text.slice(last, m.index));
    out.push({ name: parts[0]!.trim(), lassoId: parts[1]!.trim() });
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Teksten med navnene alene ("{Annelise Jensen|CVR-3-…}" → "Annelise Jensen"). */
export function stripEntityLinks(text: string): string {
  return parseEntityLinks(text)
    .map((p) => (typeof p === "string" ? p : p.name))
    .join("");
}
