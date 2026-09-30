import { createRoot } from "react-dom/client";
import "@lasso/ui/styles.css";
import "./designguide.css";
import { loadFonts } from "../fonts.js";
import { App } from "./App.js";
import type { DesignguideBoot } from "./source.js";

// /designguide: serveren indsætter window.__LASSO_BOOT__ med de rigtige data (apps/server/src/web/designguide.ts).
const boot = (window as unknown as { __LASSO_BOOT__?: DesignguideBoot }).__LASSO_BOOT__;
loadFonts();
const root = createRoot(document.getElementById("root")!);
if (boot?.mode === "designguide") root.render(<App boot={boot} />);
else
  root.render(
    <div style={{ fontFamily: "Poppins, system-ui, sans-serif", padding: 32, maxWidth: 560 }}>
      <h1 style={{ fontSize: 20 }}>Designguiden skal åbnes via serveren</h1>
      <p>Guiden får sine rigtige data fra serveren. Start serveren (npm run dev) og åbn /designguide.</p>
    </div>,
  );
