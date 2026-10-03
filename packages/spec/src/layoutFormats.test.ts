import assert from "node:assert/strict";
import { test } from "node:test";
import { formatRanges, KEY_FIGURE_FORMATS, pickFormat } from "./layoutFormats.js";

const id = (w: number, n = 4, approved?: string[]) => pickFormat("LassoKeyFigureCards", w, n, approved)?.id;

test("nøgletal: formen følger modulets bredde fra stor til lille", () => {
  assert.equal(id(1104), "linjer");
  assert.equal(id(868), "linjer"); // tablet horisontal i portalen
  assert.equal(id(612), "kort"); // tablet vertikal
  assert.equal(id(552), "2x2");
  assert.equal(id(288), "2x2"); // mobil 320
  assert.equal(id(270), "stablet"); // ¼ på desktop
});

test("nøgletal: formen skifter kun én vej, når bredden falder", () => {
  for (const n of [3, 4, 5]) {
    let last = -1;
    for (let w = 1400; w >= 200; w--) {
      const i = KEY_FIGURE_FORMATS.findIndex((f) => f.id === id(w, n));
      assert.ok(i >= last, `${n} tal, ${w} px: ${i} efter ${last}`);
      last = i;
    }
  }
});

test("ikke-godkendte former springes over, og den mindste godkendte bruges under alle", () => {
  assert.equal(id(612, 4, ["linjer", "2x2"]), "2x2");
  assert.equal(id(200, 4, ["linjer", "kort"]), "kort");
  assert.equal(id(612, 4, []), "stablet");
});

test("formatRanges samler bredderne pr. form", () => {
  const r = formatRanges("LassoKeyFigureCards", 4, 1104, 280);
  assert.deepEqual(r.map((x) => [x.format.id, x.from, x.to]), [["linjer", 1104, 800], ["kort", 799, 596], ["2x2", 595, 280]]);
});
