import type React from "react";
import { createRoot } from "react-dom/client";
import { parseViewSpec, type Dataset } from "@lasso/spec";
import { LassoView, ToastProvider, Toasts, type HostCapabilities } from "@lasso/ui";
import { entries as ENTRIES } from "./entries.js";

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

function Stage({ id }: { id: number }) {
  const entry = ENTRIES[id];
  if (!entry) return <div>Ukendt element {id}</div>;
  if (entry.spec) {
    const spec = parseViewSpec(entry.spec);
    // Elementerne står i Paper uden visningens egen ramme (logo, "Data hentet …", Gem visning).
    const view = <LassoView spec={spec} dataset={window.__GALLERY_DATA__[String(id)] ?? null} host={HOST} onAction={() => undefined} frameless />;
    return entry.card ? <CardFrame inset={false}>{view}</CardFrame> : view;
  }
  if (entry.card) return <CardFrame>{entry.render?.()}</CardFrame>;
  return (
    <div className="lasso-root" style={{ padding: 24, background: "var(--lasso-surface, #fff)" }}>
      {entry.render?.()}
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
