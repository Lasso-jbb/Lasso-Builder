import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { emptyDataset, parseViewSpec } from "@lasso/spec";
import { LassoView } from "./LassoView.js";

const ID = "CVR-1-99000001";

test("30.1: svarets bundlinje har ét koral link videre og ingen kildelinje (G3); uden answer ingen bundlinje", () => {
  const ds = emptyDataset("demo");
  ds.companies[ID] = { lassoId: ID, cvr: "99000001", name: "Eksempel Byg A/S" };
  const spec = parseViewSpec({
    kind: "company",
    title: "Omsætning",
    answer: { source: "Kilde: CVR, opdateret 25.09.2026", next: { label: "Se hele økonomien", prompt: "Hvordan går det med Eksempel Byg A/S?" } },
    components: [{ type: "LassoCompanyHead", company: ID, variant: "line" }],
  });
  const html = renderToStaticMarkup(createElement(LassoView, { spec, dataset: ds, host: { prompt: true }, onAction: () => {} }));
  assert.match(html, /class="lasso-answerfoot"/);
  assert.doesNotMatch(html, /Kilde:/);
  assert.match(html, /lasso-answerfoot__next[^>]*>Se hele økonomien</);
  const plain = parseViewSpec({ kind: "company", title: "Omsætning", components: [{ type: "LassoCompanyHead", company: ID, variant: "line" }] });
  assert.doesNotMatch(renderToStaticMarkup(createElement(LassoView, { spec: plain, dataset: ds, host: {}, onAction: () => {} })), /lasso-answerfoot/);
});
