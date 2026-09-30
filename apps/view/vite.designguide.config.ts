import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// Designguiden (/designguide) bygges som sin egen HTML-fil (dist/designguide.html), så MCP-appen
// (view.html) ikke får kildeudtrækket og galleriet med. Kildeudtrækket laves først af
// scripts/designguide-source.ts (se "build" i package.json).
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: {
    outDir: "dist",
    emptyOutDir: false,
    minify: true,
    cssMinify: true,
    rollupOptions: { input: "designguide.html" },
  },
  server: { fs: { allow: ["../.."] } },
});
