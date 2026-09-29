import { createRoot } from "react-dom/client";
import { parseViewSpec, type Dataset } from "@lasso/spec";
import { LassoView, ToastProvider, Toasts, type HostCapabilities } from "@lasso/ui";
import { ENTRIES } from "./entries/index.js";

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
};

function Stage({ id }: { id: number }) {
  const entry = ENTRIES[id];
  if (!entry) return <div>Ukendt element {id}</div>;
  if (entry.spec) {
    const spec = parseViewSpec(entry.spec);
    // Elementerne står i Paper uden visningens egen ramme (logo, "Data hentet …", Gem visning).
    return <LassoView spec={spec} dataset={window.__GALLERY_DATA__[String(id)] ?? null} host={HOST} onAction={() => undefined} frameless />;
  }
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
