import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@lasso/ui/styles.css";
import "./global.css";
import type { Boot } from "./boot.js";
import { loadFonts } from "./fonts.js";
import { McpView } from "./mcp.js";
import { PortalApp } from "./portal/PortalApp.js";
import { WebView } from "./web.js";

declare global {
  interface Window {
    __LASSO_BOOT__?: Boot;
  }
}

// Samme HTML-fil bruges tre steder: som MCP App i Claude/ChatGPT (ingen boot-data), som delt
// side /v/:org/:slug (boot.mode "web") og som portalen /portal (boot.mode "portal"). Serveren
// indsætter window.__LASSO_BOOT__ i de to sidste.
const boot = window.__LASSO_BOOT__;
loadFonts();

function Root() {
  if (!boot) return <McpView />;
  if (boot.mode === "portal") return <PortalApp boot={boot} />;
  return <WebView boot={boot} />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
