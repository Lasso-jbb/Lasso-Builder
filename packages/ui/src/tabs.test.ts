import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TabPanel, Tabs, panelId, tabId } from "./components/Tabs.js";

const items = [
  { id: "overblik", label: "Overblik" },
  { id: "oekonomi", label: "Økonomi" },
  { id: "risiko", label: "Risiko", disabled: true, disabledReason: "Ingen observationer" },
];

test("Fanebjælke (29): roller, valgt fane; en fane uden data (disabled) vises ikke (29.2)", () => {
  const html = renderToStaticMarkup(createElement(Tabs, { level: 1, id: "t", items, value: "oekonomi", ariaLabel: "Sider", onChange: () => {} }));
  assert.match(html, /role="tablist"/);
  assert.match(html, /aria-label="Sider"/);
  assert.equal((html.match(/role="tab"/g) ?? []).length, 2);
  assert.match(html, /id="t-tab-oekonomi"[^>]*aria-selected="true"/);
  assert.match(html, /aria-selected="false"[^>]*>Overblik/);
  // Kun den valgte fane er i tab-rækkefølgen
  assert.match(html, /aria-selected="true"[^>]*tabindex="0"/);
  assert.doesNotMatch(html, /Risiko|Ingen observationer/);
  // Kun navnet på fanen: ingen tal eller badges
  assert.doesNotMatch(html, /\(\d+\)/);
  assert.match(html, /class="lasso-tabs lasso-tabs--l1"/);
});

test("Niveau 1: over 8 faner samles bag Flere, og den valgte trækkes frem", () => {
  const many = Array.from({ length: 11 }, (_, i) => ({ id: `f${i}`, label: `Fane ${i}` }));
  const html = renderToStaticMarkup(createElement(Tabs, { level: 1, items: many, value: "f10", ariaLabel: "Sider", onChange: () => {} }));
  // 6 faste + den valgte + "Flere"
  assert.equal((html.match(/role="tab"/g) ?? []).length, 7);
  assert.match(html, /aria-selected="true"[^>]*>Fane 10</);
  // "Flere" er en menuknap (07), og de skjulte faner står som menupunkter i den lukkede menu
  assert.match(html, /<button[^>]*class="lasso-tab lasso-tab--more"[^>]*aria-haspopup="menu"[^>]*aria-expanded="false"[^>]*>Flere<\/button>/);
  assert.match(html, /role="menu"[^>]*aria-label="Flere faner"/);
  assert.match(html, /role="menuitem"[^>]*>(?:(?!<\/button>).)*Fane 6/);
  assert.doesNotMatch(html, /role="menuitem"[^>]*>(?:(?!<\/button>).)*Fane 10</);
  assert.doesNotMatch(html, /<select/);
});

test("Niveau 3: segmentkontrol, og over 3 segmenter får en dropdown til mobil", () => {
  const years = ["2025", "2024", "2023", "2022"].map((y) => ({ id: y, label: y }));
  const html = renderToStaticMarkup(createElement(Tabs, { level: 3, items: years, value: "2025", ariaLabel: "Vælg regnskabsår", onChange: () => {} }));
  assert.match(html, /lasso-tabs--l3/);
  assert.match(html, /lasso-tabs-wrap--many/);
  assert.match(html, /<select class="lasso-tabs__select"/);
  const three = renderToStaticMarkup(createElement(Tabs, { level: 3, items: years.slice(0, 3), value: "2025", ariaLabel: "Vælg regnskabsår", onChange: () => {} }));
  assert.doesNotMatch(three, /lasso-tabs__select/);
});

test("Panel: hænger sammen med fanen og viser skelet mens data hentes", () => {
  const html = renderToStaticMarkup(createElement(TabPanel, { id: "t", tab: "oekonomi", loading: true, loadingLabel: "Økonomi" }, "indhold"));
  assert.match(html, new RegExp(`role="tabpanel" id="${panelId("t", "oekonomi")}" aria-labelledby="${tabId("t", "oekonomi")}"`));
  assert.match(html, /aria-busy="true"/);
  assert.match(html, /Henter Økonomi …/);
  assert.doesNotMatch(html, /indhold/);
  const filled = renderToStaticMarkup(createElement(TabPanel, { id: "t", tab: "oekonomi" }, "indhold"));
  assert.match(filled, /indhold/);
});
