import assert from "node:assert/strict";
import { test } from "node:test";
import * as React from "react";
(globalThis as { React?: typeof React }).React = React;
import { sharedHost } from "./web.js";

test("/d/<id> (minimal): kun visningen, ingen Opdatér, Eksportér eller PDF; /v som før", () => {
  const links = { "CVR-1-1": "https://x/e/1" };
  assert.deepEqual(sharedHost({ minimal: true, pdf: true, pdfUrl: "https://x/p.pdf", links }), { drillDown: true, openFocus: false });
  assert.deepEqual(sharedHost({ pdf: true, pdfUrl: "https://x/p.pdf" }), { refresh: true, export: true, pdf: true, drillDown: false, openFocus: false });
});
