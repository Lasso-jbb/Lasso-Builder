import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@lasso/ui/styles.css";
import "./global.css";
import { loadFonts } from "./fonts.js";
import { McpView } from "./mcp.js";
import { WebView, type Boot } from "./web.js";

declare global {
  interface Window {
    __LASSO_BOOT__?: Boot;
  }
}

// Samme HTML-fil bruges to steder: som MCP App i Claude/ChatGPT (ingen boot-data)
// og som delt side /v/:org/:slug (serveren indsætter window.__LASSO_BOOT__).
const boot = window.__LASSO_BOOT__;
loadFonts();

createRoot(document.getElementById("root")!).render(<StrictMode>{boot ? <WebView boot={boot} /> : <McpView />}</StrictMode>);
