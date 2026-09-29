import assert from "node:assert/strict";
import { test } from "node:test";
import { entityHost, SHELL_MOBILE_MAX } from "./data.js";

test("Én synlig Gem-knap: hovedets knap under 1024 px (tablet og mobil har ingen modulbjælke)", () => {
  assert.equal(SHELL_MOBILE_MAX, 560);
  for (const w of [320, 390, 560, 768, 1023]) assert.equal(entityHost(w).savePage, true, `${w} px: ingen modulbjælke, Gem i hovedet (26f.1)`);
  for (const w of [1024, 1280, 1440]) assert.equal(entityHost(w).savePage, false, `${w} px: Gem står i modulbjælken`);
  // Resten af kapabiliteterne er de samme på alle bredder (docs/portal.md)
  const { savePage: _a, ...desktop } = entityHost(1280);
  const { savePage: _b, ...mobile } = entityHost(390);
  assert.deepEqual(desktop, mobile);
  assert.deepEqual(desktop, { save: true, refine: false, drillDown: true, refresh: true, export: true, back: false, openSection: true });
});
