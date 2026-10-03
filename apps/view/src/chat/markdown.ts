/**
 * Den smule formatering, chatten tillader (agent.ts CHAT_INSTRUCTIONS): afsnit, punktlister, **fed**
 * og [tekst](https://…). Giver en træstruktur, ChatApp tegner med React; aldrig HTML fra modellen.
 */
import { FOCUSES, PERSON_FOCUSES } from "@lasso/spec";

/** Hvor et modullink fører hen: et modul på den aktive side, eller en anden virksomhed/person (lasso:-links, se CHAT_RULES). */
export type ModuleTarget = { kind: "modul"; focus: string } | { kind: "firma" | "person"; id: string };
export type Inline =
  | { kind: "text"; text: string }
  | { kind: "bold"; text: string }
  | { kind: "link"; text: string; href: string }
  | { kind: "module"; text: string; target: ModuleTarget };
/** links: et afsnit, der kun består af modullinks (tegnes som en række). */
export type Block = { kind: "p"; lines: Inline[][] } | { kind: "ul"; items: Inline[][] } | { kind: "links"; items: Extract<Inline, { kind: "module" }>[] };

const INLINE = /\*\*(.+?)\*\*|\[([^\]]+)\]\((https?:\/\/[^)\s]+|lasso:[^)\s]+)\)|(https?:\/\/[^\s)]+)/g;
const FOCUS_IDS: readonly string[] = [...FOCUSES, ...PERSON_FOCUSES];

/** lasso:modul/<fokus>, lasso:firma/CVR-1-…, lasso:person/CVR-3-…; null ved et ugyldigt id eller fokus (så bliver linket almindelig tekst). */
export function lassoTarget(href: string): ModuleTarget | null {
  const m = /^lasso:(modul|firma|person)\/(.+)$/.exec(href);
  if (!m) return null;
  const [, kind, rest] = m as unknown as [string, "modul" | "firma" | "person", string];
  if (kind === "modul") return FOCUS_IDS.includes(rest) ? { kind, focus: rest } : null;
  if (kind === "firma") return /^CVR-1-\d+$/i.test(rest) ? { kind, id: rest } : null;
  return /^CVR-3-\d+$/i.test(rest) ? { kind, id: rest } : null;
}

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let at = 0;
  for (const m of text.matchAll(INLINE)) {
    if (m.index > at) out.push({ kind: "text", text: text.slice(at, m.index) });
    if (m[1] !== undefined) out.push({ kind: "bold", text: m[1] });
    else if (m[2] !== undefined && m[3]!.startsWith("lasso:")) {
      const target = lassoTarget(m[3]!);
      out.push(target ? { kind: "module", text: m[2], target } : { kind: "text", text: m[0] });
    } else if (m[2] !== undefined) out.push({ kind: "link", text: m[2], href: m[3]! });
    else out.push({ kind: "link", text: m[4]!, href: m[4]! });
    at = m.index + m[0].length;
  }
  if (at < text.length) out.push({ kind: "text", text: text.slice(at) });
  return out;
}

export function parseBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  for (const chunk of text.trim().split(/\n{2,}/)) {
    const lines = chunk.split("\n").filter((l) => l.trim());
    if (!lines.length) continue;
    const bullet = /^\s*(?:[-*•]|\d+\.)\s+/;
    if (lines.every((l) => bullet.test(l))) blocks.push({ kind: "ul", items: lines.map((l) => parseInline(l.replace(bullet, ""))) });
    else {
      const parsed = lines.map((l) => parseInline(l.replace(/^#+\s*/, "")));
      // Et afsnit, der kun er modullinks (mellemrum imellem), bliver en linkrække.
      const flat = parsed.flat().filter((p) => !(p.kind === "text" && !p.text.trim()));
      if (flat.length && flat.every((p): p is Extract<Inline, { kind: "module" }> => p.kind === "module")) blocks.push({ kind: "links", items: flat });
      else blocks.push({ kind: "p", lines: parsed });
    }
  }
  return blocks;
}
