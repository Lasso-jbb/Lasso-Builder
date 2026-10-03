import { useEffect, useMemo, useState } from "react";
import { CATALOG_ICONS, ICON_LABELS, Icon } from "@lasso/ui";
import type { Ctx } from "../App.js";
import { ENTRIES, GalleryItem } from "../gallery.js";
import { SOURCE, type Token } from "../source.js";
import { FOUNDATION } from "../structure.js";
import { Chip, PageHead, SourceRef } from "../ui.js";
import { CommentButton } from "../comments.js";

/** Tokenets endelige værdi i lys og mørk tilstand (var(--…) opløst af browseren). */
function useResolved(tokens: Token[]): Record<string, { light: string; dark: string }> {
  const [out, setOut] = useState<Record<string, { light: string; dark: string }>>({});
  useEffect(() => {
    const mk = (theme: string) => {
      const el = document.createElement("div");
      el.className = "lasso-root";
      el.setAttribute("data-theme", theme);
      el.style.cssText = "position:absolute;left:-9999px;top:0;width:10px;height:10px";
      document.body.appendChild(el);
      return el;
    };
    const l = mk("light");
    const d = mk("dark");
    const probe = (root: HTMLElement, name: string) => {
      // Custom properties står med var() opløst; er værdien en farve, gives den som rgb.
      const raw = getComputedStyle(root).getPropertyValue(name).trim();
      if (!raw || !CSS.supports("color", raw)) return raw;
      const x = document.createElement("span");
      x.style.color = raw;
      root.appendChild(x);
      const c = getComputedStyle(x).color;
      x.remove();
      return c;
    };
    const res: Record<string, { light: string; dark: string }> = {};
    for (const t of tokens) res[t.name] = { light: probe(l, t.name), dark: probe(d, t.name) };
    l.remove();
    d.remove();
    setOut(res);
  }, [tokens]);
  return out;
}

function rgb(c: string): [number, number, number, number] | null {
  const m = /rgba?\(([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:[ ,/]+([\d.]+))?/.exec(c);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3]), m[4] === undefined ? 1 : Number(m[4])] : null;
}
function luminance([r, g, b]: [number, number, number, number]): number {
  const f = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
export function contrast(a: string, b: string): number | null {
  const x = rgb(a);
  const y = rgb(b);
  if (!x || !y || x[3] < 1) return null;
  const [l1, l2] = [luminance(x), luminance(y)].sort((p, q) => q - p);
  return (l1! + 0.05) / (l2! + 0.05);
}

function ContrastChip({ fg, bg }: { fg: string; bg: string }) {
  const c = contrast(fg, bg);
  if (c == null) return null;
  const grade = c >= 7 ? "AAA" : c >= 4.5 ? "AA" : c >= 3 ? "AA stor" : "Under AA";
  return (
    <Chip tone={c >= 4.5 ? "ok" : c >= 3 ? "info" : "muted"} title="Kontrast mod fladen (surface), WCAG 2.1">
      {c.toFixed(1)}:1 {grade}
    </Chip>
  );
}

export function TokenTable({ tokens, showContrast = false }: { tokens: Token[]; showContrast?: boolean }) {
  // Fladen slås altid op, også når den ikke er blandt de viste tokens (fx ved filtrering), så kontrasten er rigtig.
  const withSurface = useMemo(() => (tokens.some((t) => t.name === "--lasso-surface") ? tokens : [...tokens, ...SOURCE.tokens.filter((t) => t.name === "--lasso-surface")]), [tokens]);
  const resolved = useResolved(withSurface);
  const surface = resolved["--lasso-surface"] ?? { light: "rgb(255, 255, 255)", dark: "rgb(27, 29, 33)" };
  const [copied, setCopied] = useState("");
  const groups = useMemo(() => {
    const m = new Map<string, Token[]>();
    for (const t of tokens) m.set(t.group, [...(m.get(t.group) ?? []), t]);
    return [...m.entries()];
  }, [tokens]);
  const copy = (name: string) => {
    void navigator.clipboard?.writeText(`var(${name})`);
    setCopied(name);
    setTimeout(() => setCopied(""), 1200);
  };
  return (
    <div className="dg-tokens">
      {groups.map(([group, list]) => (
        <section key={group} className="dg-tokens__group">
          <h3 className="dg-h3">{group}</h3>
          <div className="dg-tokens__table" role="table">
            <div className="dg-tokens__row dg-tokens__row--head" role="row">
              <span role="columnheader">Token</span>
              <span role="columnheader">Lys</span>
              <span role="columnheader">Mørk</span>
              <span role="columnheader">Brug</span>
            </div>
            {list.map((t) => {
              const r = resolved[t.name];
              const colorish = r && /^rgba?\(/.test(r.light);
              return (
                <div key={t.name} className="dg-tokens__row" role="row">
                  <span role="cell">
                    <button className="dg-token" onClick={() => copy(t.name)} title="Kopiér var(…)">
                      {t.name}
                    </button>
                    {copied === t.name ? <span className="dg-copied">Kopieret</span> : null}
                    <CommentButton small target={{ target: `token:${t.name}`, label: `Token ${t.name}`, context: { kind: "token", ref: `${t.name} (styles.css:${t.line})` } }} />
                  </span>
                  <span role="cell" className="dg-tokens__val">
                    {colorish ? <span className="dg-swatch" style={{ background: r.light }} /> : null}
                    <span>
                      <code>{t.light || "(arvet)"}</code>
                      {colorish && showContrast ? <ContrastChip fg={r.light} bg={surface.light} /> : null}
                    </span>
                  </span>
                  <span role="cell" className="dg-tokens__val">
                    {colorish ? <span className="dg-swatch dg-swatch--dark" style={{ background: r.dark }} /> : null}
                    <span>
                      <code className={t.dark ? "" : "dg-dim"}>{t.dark ?? "som lys"}</code>
                      {colorish && showContrast ? <ContrastChip fg={r.dark} bg={surface.dark} /> : null}
                    </span>
                  </span>
                  <span role="cell" className="dg-tokens__use">
                    {t.comment ?? ""}
                    {t.line ? <SourceRef file="styles.css" line={t.line} /> : null}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

export function FoundationPage({ ctx, id }: { ctx: Ctx; id: string }) {
  const f = FOUNDATION.find((x) => x.id === id) ?? FOUNDATION[0]!;
  const entries = ENTRIES.map((e, i) => ({ e, i })).filter(({ e }) => f.entries.test(e.nr));
  const tokens = SOURCE.tokens.filter((t) => f.tokens.source !== "^$" && f.tokens.test(t.name.replace(/^--lasso-/, "")));
  return (
    <div className="dg-page">
      <PageHead eyebrow="Fundament" title={f.label} lead={f.intro} />
      {id === "ikoner" ? (
        <section className="dg-section">
          <h2 className="dg-h2">Ikonsættet</h2>
          <p className="dg-p">24-grid, streg 1,8, runde ender. Ikonet arver tekstfarven og står altid med et ord eller en aria-label.</p>
          <div className="dg-icons">
            {CATALOG_ICONS.map((name) => (
              <div key={name} className="dg-icon">
                <Icon name={name} size={24} />
                <span className="dg-icon__label">{ICON_LABELS[name]}</span>
                <code>{name}</code>
              </div>
            ))}
          </div>
        </section>
      ) : null}
      {entries.length ? (
        <section className="dg-section">
          <h2 className="dg-h2">Fra kataloget</h2>
          {entries.map(({ e, i }) => (
            <GalleryItem key={i} entry={e} index={i} theme={ctx.theme} mobile={false} />
          ))}
        </section>
      ) : null}
      {tokens.length ? (
        <section className="dg-section">
          <div className="dg-h2row">
            <h2 className="dg-h2">Tokens</h2>
            <span className="dg-meta">
              {tokens.length} af {SOURCE.tokens.length}, fra packages/ui/src/styles.css. Klik for at kopiere.
            </span>
          </div>
          <TokenTable tokens={tokens} showContrast={id === "farver"} />
        </section>
      ) : null}
    </div>
  );
}

export function TokensPage({ ctx: _ctx, query }: { ctx: Ctx; query: string }) {
  const [q, setQ] = useState(query);
  const needle = q.trim().toLowerCase();
  const tokens = SOURCE.tokens.filter((t) => !needle || `${t.name} ${t.light} ${t.dark ?? ""} ${t.comment ?? ""} ${t.group}`.toLowerCase().includes(needle));
  return (
    <div className="dg-page">
      <PageHead eyebrow="Fundament" title="Alle tokens" lead="Alle CSS-variabler, komponenterne bruger. Farver, radier, afstande og typografi står kun her; ingen komponent har sine egne værdier." />
      <div className="dg-toolbar">
        <input className="dg-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrér tokens, fx accent eller radius" aria-label="Filtrér tokens" />
        <span className="dg-meta">
          {tokens.length} af {SOURCE.tokens.length}
        </span>
      </div>
      <TokenTable tokens={tokens} showContrast />
    </div>
  );
}
