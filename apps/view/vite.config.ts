import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

const dev = process.env.NODE_ENV === "development";

// Alt samles i én HTML-fil (dist/view.html), som serveren leverer som
// ui://-ressource og som delt side.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: dev ? "inline" : false,
    minify: !dev,
    cssMinify: !dev,
    rollupOptions: { input: "view.html" },
  },
});
