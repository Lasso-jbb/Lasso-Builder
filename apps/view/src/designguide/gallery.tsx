import { useMemo, type ReactNode } from "react";
import { parseViewSpec, type Dataset } from "@lasso/spec";
import { LassoView, ToastProvider, Toasts } from "@lasso/ui";
import { ENTRIES } from "../../../../tools/gallery/entries/index.js";
import { entryGridWidth } from "../../../../tools/gallery/grid.js";
import type { GalleryEntry } from "../../../../tools/gallery/types.js";
import { CommentButton, type CommentTarget } from "./comments.js";
import { Frame } from "./Frame.js";
import { HOST } from "./modules.js";
import { SOURCE } from "./source.js";
import { boardOf } from "./structure.js";

/**
 * Galleriets elementer (tools/gallery): hvert element tegnet fra koden og mærket med sit katalognummer.
 * Visninger (spec) tegnes med demodata løst som i MCP'en ved build; rene UI-komponenter med eksempelprops.
 * Samme opsætning som galleriets egen Stage (tools/gallery/client.tsx), men i designguidens rammer.
 */
export { ENTRIES };
export type { GalleryEntry };

export const entriesOfBoard = (board: string) => ENTRIES.map((e, i) => ({ e, i })).filter(({ e }) => boardOf(e.sortAs ?? e.nr) === board);
export const boards = () => [...new Set(ENTRIES.map((e) => boardOf(e.sortAs ?? e.nr)))];

/** Papers mobilkort: 1 px kant, radius 12, padding 16. Rammen er præsentation, ikke komponent. */
function CardFrame({ children, inset = true, theme }: { children: ReactNode; inset?: boolean; theme: "light" | "dark" }) {
  return (
    <div className="lasso-root" data-theme={theme} style={{ padding: 16, background: "var(--lasso-surface)" }}>
      <div style={{ border: "1px solid var(--lasso-border)", borderRadius: 12, padding: inset ? 16 : 0, overflow: "hidden" }}>{children}</div>
    </div>
  );
}

/** Kalder elementets render() inde i en komponent, så dets hooks har et fast hjem. */
function Rendered({ entry }: { entry: GalleryEntry }) {
  return <>{entry.render?.()}</>;
}

function EntryBody({ entry, index, theme }: { entry: GalleryEntry; index: number; theme: "light" | "dark" }) {
  const dataset = useMemo<Dataset | null>(() => {
    const base = SOURCE.gallery.data[String(index)];
    if (!base) return null;
    const ds = structuredClone(base);
    entry.mutate?.(ds);
    return ds;
  }, [entry, index]);
  if (entry.spec) {
    let spec;
    try {
      spec = parseViewSpec(entry.spec);
    } catch (err) {
      return <div className="dg-note dg-note--warn">Visningen kunne ikke læses: {(err as Error).message}</div>;
    }
    const view = <LassoView spec={spec} dataset={dataset} host={HOST} onAction={() => undefined} frameless theme={theme} />;
    return entry.card ? <CardFrame inset={false} theme={theme}>{view}</CardFrame> : view;
  }
  return (
    <ToastProvider>
      {entry.card ? (
        <CardFrame theme={theme}>
          <Rendered entry={entry} />
        </CardFrame>
      ) : (
        <div className="lasso-root" data-theme={theme} style={{ padding: 24, background: "var(--lasso-surface)" }}>
          <Rendered entry={entry} />
        </div>
      )}
      <Toasts />
    </ToastProvider>
  );
}

/** Ét galleri-element i sine bredder: desktop (i elementets gitterbredde) og mobil 390, som galleriet tegner dem. */
export function GalleryItem({ entry, index, theme, mobile = true }: { entry: GalleryEntry; index: number; theme: "light" | "dark"; mobile?: boolean }) {
  const gw = entryGridWidth(entry);
  const desktopW = entry.desktopWidth ?? 1200;
  const showDesktop = entry.only !== "mobile";
  const showMobile = mobile && entry.only !== "desktop";
  const widths = [...(showDesktop ? [{ vw: desktopW, label: `${desktopW < 1200 ? "Tablet" : "Desktop"} ${desktopW}${gw ? `, element ${gw} px` : ""}` }] : []), ...(entry.extraWidths ?? []).map((w) => ({ vw: w, label: `${w} px` })), ...(showMobile ? [{ vw: 390, label: "Mobil 390" }] : [])];
  return (
    <article className="dg-gitem" id={`e-${entry.nr}`}>
      <header className="dg-gitem__head">
        <span className="dg-nr">{entry.nr}</span>
        <h3 className="dg-gitem__title">{entry.title}</h3>
        {entry.node ? <span className="dg-meta">Paper {entry.node}</span> : null}
        <span className="dg-meta">{entry.spec ? "Visning med demodata" : "UI-komponent"}</span>
      </header>
      {entry.note ? <p className="dg-gitem__note">{entry.note}</p> : null}
      <div className="dg-gitem__frames">
        {widths.map((w) => (
          <figure key={w.vw} className={`dg-gframe${w.vw <= 420 ? " dg-gframe--mobile" : ""}`}>
            <figcaption>
              <span>{w.label}</span>
              <CommentButton small target={elementTarget(entry, w.vw, w.label)} />
            </figcaption>
            <Frame vw={w.vw} comment={elementTarget(entry, w.vw, w.label)} cropContent={!entry.spec && w.vw > 560} cropBox={gw && w.vw === desktopW && w.vw > 560 ? { left: 0, width: gw + 48 } : undefined} label={`${entry.nr} ${entry.title}, ${w.label}`}>
              {gw && w.vw === desktopW && w.vw > 560 ? <GridWidthStyle width={gw} /> : null}
              <EntryBody entry={entry} index={index} theme={theme} />
            </Frame>
          </figure>
        ))}
      </div>
    </article>
  );
}

const elementTarget = (entry: GalleryEntry, vw: number, label: string): CommentTarget => ({
  target: `element:${entry.nr}:${entry.title}:${vw}`,
  label: `${entry.nr} ${entry.title}, ${label}`,
  context: { kind: "element", ref: entry.nr, vw, viewport: vw <= 420 ? "mobil" : "desktop", data: entry.spec ? "demodata" : "eksempelprops" },
});

/** G6 (galleriet): elementet står i sin egen gitterbredde i en 1200-visning; kun cellen gøres smal. */
function GridWidthStyle({ width }: { width: number }) {
  const css = `.lasso-frame--bare>.lasso-content{display:flex!important;flex-direction:column;align-items:flex-start;row-gap:40px}.lasso-frame--bare>.lasso-content>*{width:${width}px!important;max-width:${width}px}#r>.lasso-root>*:not(style){max-width:${width}px}`;
  return <style>{css}</style>;
}
