import assert from "node:assert/strict";
import { test } from "node:test";
import { hasNativeBounce, MAX, relax, stretch } from "./elastic.js";

test("stretch: rulning ud over kanten strækker med stigende modstand, aldrig over MAX", () => {
  assert.ok(stretch(0, -20) > 0, "rul op ved toppen trækker indholdet ned");
  assert.ok(stretch(0, 20) < 0, "rul ned ved bunden trækker indholdet op");
  assert.ok(stretch(40, -20) - 40 < stretch(0, -20), "jo mere strakt, jo mindre flytter samme rulning");
  let x = 0;
  for (let i = 0; i < 500; i++) x = stretch(x, -40);
  assert.ok(x <= MAX && x > MAX - 5, `ender ved MAX (${x})`);
  assert.ok(stretch(0, -20, 500) < stretch(0, -20, 0) / 5, "længe mod kanten: stivere (trackpaddens efterløb)");
  assert.ok(Math.abs(stretch(0, -1000)) <= Math.abs(stretch(0, -40)), "et musehjul slår ikke et stort hak");
});

test("relax: glider tilbage mod 0 uden at skyde forbi, uafhængigt af billedrate", () => {
  let x = 60;
  for (let i = 0; i < 40; i++) x = relax(x, 16);
  assert.equal(x, 0, "på plads efter ca. 0,6 s");
  let a = 50;
  let b = 50;
  for (let i = 0; i < 4; i++) a = relax(a, 8);
  for (let i = 0; i < 2; i++) b = relax(b, 16);
  assert.ok(Math.abs(a - b) < 1e-9);
});

test("hasNativeBounce: WebKit (Safari, alle browsere på iPhone) bouncer selv; Chrome og Edge gør ikke", () => {
  assert.equal(hasNativeBounce({ vendor: "Apple Computer, Inc." }), true);
  assert.equal(hasNativeBounce({ vendor: "Google Inc." }), false);
  assert.equal(hasNativeBounce(undefined), false);
});
