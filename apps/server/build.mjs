// Bundler serveren til én fil. Workspace-pakker (@lasso/*) bundles med;
// alt fra node_modules forbliver eksternt. Render-appen kopieres ved siden af.
import { build } from "esbuild";
import { copyFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";

await mkdir("dist", { recursive: true });
await build({
  entryPoints: ["src/index.ts"],
  outfile: "dist/index.js",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  sourcemap: true,
  logLevel: "info",
  plugins: [
    {
      name: "externalize-node-modules",
      setup(b) {
        b.onResolve({ filter: /^[^./]/ }, (args) => (args.path.startsWith("@lasso/") ? undefined : { path: args.path, external: true }));
      },
    },
  ],
});

const view = "../view/dist/view.html";
if (existsSync(view)) {
  await copyFile(view, "dist/view.html");
  console.log("kopierede view.html til dist/");
} else {
  console.warn("ADVARSEL: ../view/dist/view.html findes ikke. Byg @lasso/view først.");
}
