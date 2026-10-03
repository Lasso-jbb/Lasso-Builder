/**
 * Den smule formatering, chatten tillader (agent.ts CHAT_INSTRUCTIONS): afsnit, punktlister, **fed**
 * og [tekst](https://…). Giver en træstruktur, ChatApp tegner med React; aldrig HTML fra modellen.
 */
export type Inline = { kind: "text"; text: string } | { kind: "bold"; text: string } | { kind: "link"; text: string; href: string };
export type Block = { kind: "p"; lines: Inline[][] } | { kind: "ul"; items: Inline[][] };

const INLINE = /\*\*(.+?)\*\*|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|(https?:\/\/[^\s)]+)/g;

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let at = 0;
  for (const m of text.matchAll(INLINE)) {
    if (m.index > at) out.push({ kind: "text", text: text.slice(at, m.index) });
    if (m[1] !== undefined) out.push({ kind: "bold", text: m[1] });
    else if (m[2] !== undefined) out.push({ kind: "link", text: m[2], href: m[3]! });
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
    else blocks.push({ kind: "p", lines: lines.map((l) => parseInline(l.replace(/^#+\s*/, ""))) });
  }
  return blocks;
}
