import assert from "node:assert/strict";
import { test } from "node:test";
import { hasNativeBounce, rubber, springStep } from "./elastic.js";

test("rubber: stigende modstand, højst max, samme fortegn som trækket", () => {
  assert.equal(rubber(0), 0);
  assert.ok(rubber(50) > 0 && rubber(50) < 50);
  assert.ok(rubber(-50) < 0);
  assert.ok(rubber(10000) <= 56 && rubber(10000) > 55);
  assert.ok(rubber(200) - rubber(100) < rubber(100) - rubber(0), "hvert ekstra træk flytter mindre");
});

test("hasNativeBounce: WebKit (Safari, alle browsere på iPhone) bouncer selv; Chrome og Edge gør ikke", () => {
  assert.equal(hasNativeBounce({ vendor: "Apple Computer, Inc." }), true);
  assert.equal(hasNativeBounce({ vendor: "Google Inc." }), false);
  assert.equal(hasNativeBounce({ vendor: "" }), false);
  assert.equal(hasNativeBounce(undefined), false);
});

test("springStep: kritisk dæmpet fjeder vender tilbage til 0 uden at skyde forbi", () => {
  let x = 40;
  let v = 0;
  let min = x;
  for (let i = 0; i < 120; i++) {
    [x, v] = springStep(x, v, 1 / 60);
    min = Math.min(min, x);
  }
  assert.ok(Math.abs(x) < 0.5, `ender ved ${x}`);
  assert.ok(min > -0.5, `skyder ikke forbi (min ${min})`);
});
