import assert from "node:assert/strict";
import { test } from "node:test";
import { entityHost, SHELL_MOBILE_MAX } from "./data.js";

test("Én synlig Gem-knap: hovedets knap kun under AppShells mobilbrudpunkt (560 px)", () => {
  assert.equal(SHELL_MOBILE_MAX, 560);
  for (const w of [320, 390, 560]) assert.equal(entityHost(w).savePage, true, `${w} px: modulbjælkens handlinger er skjult`);
  for (const w of [561, 768, 1280, 1440]) assert.equal(entityHost(w).savePage, false, `${w} px: Gem står i modulbjælken`);
  // Resten af kapabiliteterne er de samme på alle bredder (docs/portal.md)
  const { savePage: _a, ...desktop } = entityHost(1280);
  const { savePage: _b, ...mobile } = entityHost(390);
  assert.deepEqual(desktop, mobile);
  // openFocus: overblikkets "Se alle … i Historik" skifter fane som modulbjælken.
  assert.deepEqual(desktop, { save: true, refine: false, drillDown: true, refresh: true, export: true, back: false, openFocus: true });
});
