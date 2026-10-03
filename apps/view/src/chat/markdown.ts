import { FOCUSES, PERSON_FOCUSES } from "@lasso/spec";

/**
 * Den smule formatering, chatten tillader (agent.ts CHAT_INSTRUCTIONS): afsnit, punktlister, **fed**,
 * [tekst](https://…) og modul-links ([Risiko](lasso:modul/risiko), [Navn](lasso:firma/CVR-1-…),
 * [Navn](lasso:person/CVR-3-…)). Giver en træstruktur, som tegnes med React; aldrig HTML fra modellen.
 */
export type Inline =
  | { kind: "text"; text: string }
  | { kind: "bold"; text: string }
  | { kind: "link"; text: string; href: string }
  | { kind: "module"; text: string; target: { kind: "modul"; focus: string } | { kind: "firma" | "person"; id: string } };
/** "links": et afsnit, der kun består af modul-links (vises som en række modul-links under teksten). */
export type Block = { kind: "p"; lines: Inline[][] } | { kind: "ul"; items: Inline[][] } | { kind: "links"; items: Extract<Inline, { kind: "module" }>[] };

type ModuleInline = Extract<Inline, { kind: "module" }>;

const INLINE = /\*\*(.+?)\*\*|\[([^\]]+)\]\(lasso:([a-z]+)\/([^)\s]+)\)|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|(https?:\/\/[^\s)]+)/g;
const FOCUS_SET: ReadonlySet<string> = new Set<string>([...FOCUSES, ...PERSON_FOCUSES]);

/** Et lasso:-link med gyldigt mål; ukendte fokus og id'er giver null (teksten står så som almindelig tekst). */
function moduleTarget(kind: string, ref: string): ModuleInline["target"] | null {
  if (kind === "modul") return FOCUS_SET.has(ref) ? { kind: "modul", focus: ref } : null;
  if (kind === "firma") return /^CVR-1-\d+$/.test(ref) ? { kind: "firma", id: ref } : null;
  if (kind === "person") return /^CVR-[34]-\d+$/.test(ref) ? { kind: "person", id: ref } : null;
  return null;
}

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let at = 0;
  const push = (t: Inline) => {
    const last = out.at(-1);
    if (t.kind === "text" && last?.kind === "text") out[out.length - 1] = { kind: "text", text: last.text + t.text };
    else out.push(t);
  };
  for (const m of text.matchAll(INLINE)) {
    if (m.index > at) push({ kind: "text", text: text.slice(at, m.index) });
    if (m[1] !== undefined) push({ kind: "bold", text: m[1] });
    else if (m[2] !== undefined) {
      const target = moduleTarget(m[3]!, m[4]!);
      push(target ? { kind: "module", text: m[2], target } : { kind: "text", text: m[2] });
    } else if (m[5] !== undefined) push({ kind: "link", text: m[5], href: m[6]! });
    else push({ kind: "link", text: m[7]!, href: m[7]! });
    at = m.index + m[0].length;
  }
  if (at < text.length) push({ kind: "text", text: text.slice(at) });
  return out;
}

/** Linjen består kun af modul-links (og mellemrum eller kommaer imellem). */
function onlyModules(parts: Inline[]): ModuleInline[] | null {
  const mods = parts.filter((p): p is ModuleInline => p.kind === "module");
  if (!mods.length) return null;
  return parts.every((p) => p.kind === "module" || (p.kind === "text" && /^[\s,]*$/.test(p.text))) ? mods : null;
}

export function parseBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  for (const chunk of text.trim().split(/\n{2,}/)) {
    const lines = chunk.split("\n").filter((l) => l.trim());
    if (!lines.length) continue;
    const bullet = /^\s*(?:[-*•]|\d+\.)\s+/;
    if (lines.every((l) => bullet.test(l))) {
      blocks.push({ kind: "ul", items: lines.map((l) => parseInline(l.replace(bullet, ""))) });
      continue;
    }
    const parsed = lines.map((l) => parseInline(l.replace(/^#+\s*/, "")));
    const links = parsed.map(onlyModules);
    if (links.every((l) => l !== null)) blocks.push({ kind: "links", items: links.flatMap((l) => l!) });
    else blocks.push({ kind: "p", lines: parsed });
  }
  return blocks;
}
