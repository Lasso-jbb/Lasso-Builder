import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Accordion, CardGrid } from "./components/Layout.js";

test("Harmonika (30, mønster 9): aria-expanded, skjult panel og meta som ren tekst", () => {
  const html = renderToStaticMarkup(
    createElement(Accordion, {
      defaultOpen: ["n"],
      items: [
        { id: "o", title: "Observationer", meta: "Se detaljer", children: "obs" },
        { id: "n", title: "Nøgletal", meta: "3 kommentarer", children: "tal" },
      ],
    }),
  );
  assert.match(html, /aria-expanded="false"[^>]*aria-controls="acc-o"/);
  assert.match(html, /aria-expanded="true"[^>]*aria-controls="acc-n"/);
  assert.match(html, /id="acc-o"[^>]*hidden=""/);
  assert.doesNotMatch(html, /id="acc-n"[^>]*hidden/);
  assert.match(html, /lasso-accordion__meta">3 kommentarer</);
});

test("Kortgitter (30, mønster 8)", () => {
  const html = renderToStaticMarkup(createElement(CardGrid, null, createElement("article", null, "a"), createElement("article", null, "b")));
  assert.match(html, /class="lasso-cardgrid "/);
  assert.equal((html.match(/<article>/g) ?? []).length, 2);
});
