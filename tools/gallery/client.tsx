import type React from "react";
import { createRoot } from "react-dom/client";
import { parseViewSpec, type Dataset } from "@lasso/spec";
import { LassoView, ToastProvider, Toasts, type HostCapabilities } from "@lasso/ui";
import { ENTRIES } from "./entries/index.js";
import { entryGridWidth } from "./grid.js";

declare global {
  interface Window {
    __GALLERY_DATA__: Record<string, Dataset>;
    __GALLERY_READY__?: boolean;
  }
}

const HOST: HostCapabilities = {
  prompt: true,
  save: true,
  savePage: true,
  refine: true,
  drillDown: true,
  export: true,
  monitor: true,
  openSection: true,
  verifyContact: true,
  // Som MCP-værten (apps/view/src/mcp.tsx): "Opdatér" giver hovedets "Flere" (08.1, 16.1).
  refresh: true,
  // Som i Claude, hvor værten tilbyder fuld skærm (26c.6 "Åbn diagram i fuld skærm", 14.1 fuldskærmsknap).
  fullscreen: true,
};

/** Papers mobilkort (26b–26h): 1 px kant, radius 12, padding 16 på hvid flade, 16 px sidemargen. */
function CardFrame({ children, inset = true }: { children: React.ReactNode; inset?: boolean }) {
  // LassoView frameless har selv 16 px luft på mobil; en ren komponent får luften her.
  return (
    <div className="lasso-root" style={{ padding: 16, background: "var(--lasso-surface)" }}>
      <div style={{ border: "1px solid var(--lasso-border)", borderRadius: 12, padding: inset ? 16 : 0, overflow: "hidden" }}>{children}</div>
      <Toasts />
    </div>
  );
}

/**
 * G6: elementet står i sin egen gitterbredde. Visningen (containeren) er stadig 1200 bred som på siden,
 * så komponenten ser ud som i sin celle; kun cellen gøres smal. Mobil (≤ 560) tegnes uændret.
 */
function GridWidthStyle({ width }: { width: number }) {
  const css = `@media (min-width: 561px){#stage .lasso-frame--bare>.lasso-content{display:flex!important;flex-direction:column;align-items:flex-start;row-gap:40px}#stage .lasso-frame--bare>.lasso-content>*{width:${width}px!important;max-width:${width}px}}`;
  return <style>{css}</style>;
}

function Stage({ id }: { id: number }) {
  const entry = ENTRIES[id];
  if (!entry) return <div>Ukendt element {id}</div>;
  const gw = entryGridWidth(entry);
  const narrow = gw !== undefined && window.innerWidth > 560;
  if (entry.spec) {
    const spec = parseViewSpec(entry.spec);
    // Elementerne står i Paper uden visningens egen ramme (logo, "Data hentet …", Gem visning).
    const view = <LassoView spec={spec} dataset={window.__GALLERY_DATA__[String(id)] ?? null} host={HOST} onAction={() => undefined} frameless />;
    if (entry.card) return <CardFrame inset={false}>{view}</CardFrame>;
    return narrow ? (
      <>
        <GridWidthStyle width={gw} />
        {view}
      </>
    ) : (
      view
    );
  }
  if (entry.card) return <CardFrame>{entry.render?.()}</CardFrame>;
  return (
    <div className="lasso-root" style={{ padding: 24, background: "var(--lasso-surface, #fff)" }}>
      {narrow ? <div style={{ width: gw }}>{entry.render?.()}</div> : entry.render?.()}
      <Toasts />
    </div>
  );
}

const id = Number(new URLSearchParams(location.search).get("id") ?? "0");
createRoot(document.getElementById("stage")!).render(
  <ToastProvider>
    <Stage id={id} />
  </ToastProvider>,
);
setTimeout(() => (window.__GALLERY_READY__ = true), 400);
