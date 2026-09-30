import { Fragment, type ReactNode } from "react";

/**
 * Lille markdown-læser til reglerne i docs/design/*.md: overskrifter, afsnit, lister, tabeller,
 * kodeblokke, citater, fed, kursiv, kode og links. Nok til designdokumenterne, ingen HTML.
 */

export const headingId = (text: string) =>
  text
    .toLowerCase()
    .replace(/[`*_]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "");

function inline(text: string, key = 0): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    const k = `${key}-${i++}`;
    if (t.startsWith("`")) out.push(<code key={k}>{t.slice(1, -1)}</code>);
    else if (t.startsWith("**")) out.push(<strong key={k}>{inline(t.slice(2, -2), i)}</strong>);
    else if (t.startsWith("*")) out.push(<em key={k}>{inline(t.slice(1, -1), i)}</em>);
    else {
      const [, label, href] = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(t)!;
      out.push(
        <a key={k} href={href} target={href!.startsWith("http") ? "_blank" : undefined} rel="noreferrer">
          {label}
        </a>,
      );
    }
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const cells = (row: string) =>
  row
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((c) => c.trim());

export function Markdown({ source, skipTitle = false }: { source: string; skipTitle?: boolean }) {
  const lines = source.replace(/\r/g, "").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let n = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (!line.trim()) {
      i++;
      continue;
    }
    const h = /^(#{1,4})\s+(.+)$/.exec(line);
    if (h) {
      const level = h[1]!.length;
      i++;
      if (level === 1 && skipTitle) continue;
      const Tag = `h${Math.min(4, level + 1)}` as "h2" | "h3" | "h4";
      blocks.push(
        <Tag key={n++} id={headingId(h[2]!)}>
          {inline(h[2]!)}
        </Tag>,
      );
      continue;
    }
    if (line.startsWith("```")) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i]!.startsWith("```")) body.push(lines[i++]!);
      i++;
      blocks.push(<pre key={n++}>{body.join("\n")}</pre>);
      continue;
    }
    if (line.trim().startsWith("|") && lines[i + 1]?.match(/^\s*\|?\s*:?-{3,}/)) {
      const head = cells(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i]!.trim().startsWith("|")) rows.push(cells(lines[i++]!));
      blocks.push(
        <div key={n++} className="dg-md-table">
          <table>
            <thead>
              <tr>
                {head.map((c, k) => (
                  <th key={k}>{inline(c)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, k) => (
                <tr key={k}>
                  {r.map((c, j) => (
                    <td key={j}>{inline(c)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const items: string[] = [];
      while (i < lines.length && lines[i]!.trim() && (/^\s*([-*]|\d+\.)\s+/.test(lines[i]!) || /^\s{2,}\S/.test(lines[i]!))) {
        const l = lines[i++]!;
        if (/^\s*([-*]|\d+\.)\s+/.test(l)) items.push(l.replace(/^\s*([-*]|\d+\.)\s+/, ""));
        else items[items.length - 1] += ` ${l.trim()}`;
      }
      const List = ordered ? "ol" : "ul";
      blocks.push(
        <List key={n++}>
          {items.map((it, k) => (
            <li key={k}>{inline(it)}</li>
          ))}
        </List>,
      );
      continue;
    }
    if (line.startsWith(">")) {
      const body: string[] = [];
      while (i < lines.length && lines[i]!.startsWith(">")) body.push(lines[i++]!.replace(/^>\s?/, ""));
      blocks.push(<blockquote key={n++}>{inline(body.join(" "))}</blockquote>);
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i]!.trim() && !/^(#{1,4}\s|```|>|\s*([-*]|\d+\.)\s+|\s*\|)/.test(lines[i]!)) para.push(lines[i++]!.trim());
    if (!para.length) {
      blocks.push(<p key={n++}>{inline(lines[i++]!)}</p>);
      continue;
    }
    blocks.push(<p key={n++}>{inline(para.join(" "))}</p>);
  }
  return <div className="dg-md">{blocks.map((b, k) => <Fragment key={k}>{b}</Fragment>)}</div>;
}
