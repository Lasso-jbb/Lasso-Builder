import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { komponenterMarkdown } from "./registerDoc.js";
import { DEFAULT_WIDTH } from "./spec.js";

test("A9: komponenterMarkdown() indeholder alle typer fra spec.ts", () => {
  const md = komponenterMarkdown();
  for (const t of Object.keys(DEFAULT_WIDTH)) assert.ok(md.includes(`## `) && md.includes(`<a id="${t}"></a>`), `mangler ${t}`);
});

test("A9: docs/komponenter.md er ajour med registeret", () => {
  let disk = "";
  try {
    disk = readFileSync(new URL("../../../docs/komponenter.md", import.meta.url), "utf8");
  } catch {
    /* mangler */
  }
  assert.ok(disk === komponenterMarkdown(), "docs/komponenter.md er ikke ajour: kør npm run docs:komponenter -w @lasso/spec");
});
