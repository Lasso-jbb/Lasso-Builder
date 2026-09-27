import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ObservationRowVM, ObservationsVM } from "@lasso/spec";
import { RiskObservations } from "./components/RiskObservations.js";

const ID = "CVR-1-11111111";
const row = (id: string, severity: 0 | 25 | 50 | 100, title: string): ObservationRowVM => ({ id, title, severity, detail: `${title}.` });

/** Som Lassos rigtige svar: få fund, mange neutrale fakta, og relaterede selskaber med hver 16 rækker. */
function data(): ObservationsVM {
  const neutral = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => row(`${prefix}-n${i}`, 0, `Neutral ${i}`));
  return {
    lassoId: ID,
    checkedAt: "2026-09-25",
    sources: ["Lasso"],
    observations: [row("o1", 50, "Ukendte ejere"), row("o2", 50, "Kreditorer"), row("o3", 25, "Konkursrelationer"), row("o4", 25, "Årets resultat"), ...neutral("o", 17)],
    related: [
      { lassoId: "CVR-1-2", name: "JP/POLITIKENS HUS A/S", rows: [row("r1", 25, "Konkursrelationer"), row("r2", 25, "Indirekte konkurser"), ...neutral("r", 14)] },
      { lassoId: "CVR-1-3", name: "EGGERT HOLDING ApS", rows: [row("e1", 25, "For sent afleveret regnskab"), ...neutral("e", 15)] },
      { lassoId: "CVR-1-4", name: "BENEDIKTSON HOLDING ApS", rows: neutral("b", 16) },
      { lassoId: "CVR-1-5", name: "FJERDE ApS", rows: [row("f1", 50, "Negativ egenkapital")] },
      { lassoId: "CVR-1-6", name: "FEMTE ApS", rows: [row("g1", 25, "Revisorskift")] },
    ],
  };
}

const render = (props: Partial<Parameters<typeof RiskObservations>[0]>) => renderToStaticMarkup(createElement(RiskObservations, { data: data(), ...props }));
const rows = (html: string) => (html.match(/<li class="lasso-observation/g) ?? []).length;

test("kompakt (uden for focus risiko): kun fundene, højst 3, ingen alvorsskala, ingen relaterede, 'Se alle' med tallene", () => {
  const html = render({ compact: true });
  assert.equal(rows(html), 3);
  assert.ok(!html.includes("lasso-sev-scale"));
  assert.ok(!html.includes("Vedrører"));
  assert.ok(!html.includes("Neutral 0"));
  assert.match(html, /Ukendte ejere/);
  assert.match(html, /Kreditorer/);
  assert.match(html, /Konkursrelationer/);
  // 21 egne rækker og 5 fund hos relaterede (JP 2, Eggert 1, Fjerde 1, Femte 1).
  assert.match(html, />Se alle 21 og 5 hos relaterede</);
  assert.match(html, /2 mulige, 2 til orientering, 17 neutrale/);
  assert.match(html, /Kilde: Lasso, opdateret 25\.09\.2026/);
});

test("fuld (focus risiko): egne rækker foldet efter 6; 'Vedrører' kun med fund, højst 3 relaterede udfoldet, de rene i én linje", () => {
  const html = render({});
  assert.ok(html.includes("lasso-sev-scale"));
  // 6 egne + JP 2 + Eggert 1 + Fjerde 1 = 10 rækker; Femte er den fjerde relaterede med fund og foldes.
  assert.equal(rows(html), 10);
  assert.match(html, />Se alle 21</);
  assert.match(html, />Se alle 4 relaterede</);
  assert.ok(!html.includes("Revisorskift"));
  assert.ok(!html.includes("Neutral 3"), "neutrale rækker hos relaterede vises ikke");
  assert.match(html, /Intet at bemærke hos BENEDIKTSON HOLDING ApS\./);
});

test("kompakt uden fund over neutral: sammenfatning uden liste; uden data: tom tilstand som før", () => {
  const onlyNeutral: ObservationsVM = { lassoId: ID, observations: [row("n1", 0, "Virksomhedsstatus")] };
  const html = render({ data: onlyNeutral, compact: true });
  assert.equal(rows(html), 0);
  assert.match(html, /1 neutral</);
  const empty = render({ data: { lassoId: ID, observations: [], checkedAt: "2026-09-25" }, compact: true });
  assert.match(empty, /fandt intet at bemærke/);
});
