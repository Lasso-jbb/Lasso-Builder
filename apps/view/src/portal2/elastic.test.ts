import assert from "node:assert/strict";
import { test } from "node:test";
import { hasNativeBounce, rubber } from "./elastic.js";

test("rubber: stigende modstand, højst max, samme fortegn som trækket", () => {
  assert.equal(rubber(0), 0);
  assert.ok(rubber(50) > 0 && rubber(50) < 50);
  assert.ok(rubber(-50) < 0);
  assert.ok(rubber(10000) <= 90 && rubber(10000) > 89);
  assert.ok(rubber(200) - rubber(100) < rubber(100) - rubber(0), "hvert ekstra træk flytter mindre");
});

test("hasNativeBounce: WebKit (Safari, alle browsere på iPhone) bouncer selv; Chrome og Edge gør ikke", () => {
  assert.equal(hasNativeBounce({ vendor: "Apple Computer, Inc." }), true);
  assert.equal(hasNativeBounce({ vendor: "Google Inc." }), false);
  assert.equal(hasNativeBounce({ vendor: "" }), false);
  assert.equal(hasNativeBounce(undefined), false);
});
