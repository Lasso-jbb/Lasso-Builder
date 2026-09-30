import { createRoot } from "react-dom/client";
import { parseViewSpec, type Dataset } from "@lasso/spec";
import { LassoView, ToastProvider, Toasts, type HostCapabilities } from "@lasso/ui";

declare global {
  interface Window {
    __GALLERY_DATA__: Record<string, Dataset>;
    __GALLERY_SPECS__: Record<string, Record<string, unknown>>;
  }
}
const HOST: HostCapabilities = { prompt: true, save: true, savePage: true, refine: true, drillDown: true, export: true, monitor: true, openSection: true, verifyContact: true, refresh: true, fullscreen: true };

const q = new URLSearchParams(location.search);
const id = q.get("id") ?? "0";
const width = q.get("w") ?? "full";
const comp = window.__GALLERY_SPECS__[id]!;
// Dashboard-layout med ét element i den målte bredde: samme celle og samme container som på en rigtig side (1200-gitter).
// Alene i sit bånd står et element i fuld bredde (23.1); derfor følger et skjult fyldelement med, så båndet summerer til 12 og
// målelementet står i sin egen bredde. Fyldelementet skjules (højde 0), så det hverken påvirker målelementets højde eller bredde.
const COMPLEMENT: Record<string, string> = { quarter: "three-quarters", third: "two-thirds", half: "half", "two-thirds": "third", "three-quarters": "quarter" };
const filler = { type: "LassoFollowUps", prompts: [{ label: "fyld", prompt: "fyld" }], width: COMPLEMENT[width] };
const spec = parseViewSpec({ title: "m", layout: "dashboard", components: width === "full" ? [{ ...comp, width }] : [{ ...comp, width }, filler] });
const style = document.createElement("style");
style.textContent = ".lasso-dband > .lasso-dstack:nth-child(n+2){visibility:hidden;height:0;overflow:hidden;}";
document.head.appendChild(style);
createRoot(document.getElementById("stage")!).render(
  <ToastProvider>
    <LassoView spec={spec} dataset={window.__GALLERY_DATA__[id] ?? null} host={HOST} onAction={() => undefined} frameless />
    <Toasts />
  </ToastProvider>,
);
