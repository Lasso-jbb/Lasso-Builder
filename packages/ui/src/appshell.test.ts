import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppShell, Column, Columns } from "./components/AppShell.js";
import { ModuleBar } from "./components/ModuleBar.js";
import { ModuleToolbar } from "./components/ModuleToolbar.js";
import { Rail } from "./components/Rail.js";
import { TabStrip } from "./components/TabStrip.js";

const rail = {
  groups: [
    { id: "vaerktoejer", label: "Værktøjer", items: [{ id: "dataudtraek", label: "Dataudtræk" }, { id: "overvaagning", label: "Overvågning" }] },
    { id: "firmaer", label: "Firmaer", items: [{ id: "kunder", label: "Kunder", icon: "letter" as const }], footer: { label: "Opret ny liste" } },
    { id: "personer", label: "Personer", collapsed: true, items: [{ id: "p1", label: "Bestyrelser" }] },
  ],
};

const tabs = {
  tabs: [
    { id: "c1", label: "Eksempel Byg A/S", active: true },
    { id: "c2", label: "Prøve Handel ApS" },
  ],
  onClose: () => {},
  onAdd: () => {},
  onBell: () => {},
  unread: 3,
};

const modules = [
  { id: "overblik", label: "Overblik" },
  { id: "salg", label: "Salg" },
  { id: "stamoplysninger", label: "Stamoplysninger" },
];

test("Skinnen (06): tre grupper, sammenfoldet gruppe uden punkter, bogstav-ikon og fod", () => {
  const html = renderToStaticMarkup(createElement(Rail, rail));
  assert.equal((html.match(/class="lasso-rail__group/g) ?? []).length, 3);
  assert.match(html, /aria-expanded="true"[^>]*>[^]*?Værktøjer/);
  assert.match(html, /aria-expanded="false"[^>]*aria-controls="lasso-rail-personer"/);
  assert.doesNotMatch(html, /Bestyrelser/);
  assert.match(html, /class="lasso-rail__letter"[^>]*>K</);
  assert.match(html, /lasso-rail__footer[^>]*>[^]*?Opret ny liste/);
  // Navnet står som title, så tablet-skinnen (kun ikoner) har tooltip
  assert.match(html, /title="Dataudtræk"/);
});

test("Fanebjælken (06): aktiv fane, luk-kryds, ingen tal eller badges på faner", () => {
  const html = renderToStaticMarkup(createElement(TabStrip, tabs));
  assert.match(html, /role="tablist" aria-label="Åbne sider"/);
  assert.match(html, /role="tab" aria-selected="true" class="lasso-strip__tab is-on"/);
  assert.match(html, /aria-selected="false" class="lasso-strip__tab "/);
  assert.match(html, /aria-label="Luk Eksempel Byg A\/S"/);
  assert.match(html, /aria-label="Åbn ny fane"/);
  const stripTabs = html.slice(html.indexOf('role="tablist"'), html.indexOf("lasso-strip__tools"));
  assert.doesNotMatch(stripTabs, /badge/);
  // Kun navnet i fanen: intet tal eller tæller ved siden af
  const labels = [...stripTabs.matchAll(/lasso-strip__label">([^<]*)</g)].map((m) => m[1]);
  assert.deepEqual(labels, ["Eksempel Byg A/S", "Prøve Handel ApS"]);
  assert.doesNotMatch(stripTabs.replace(/<svg[^]*?<\/svg>/g, ""), />\s*\d+\s*</);
  // Klokken bærer det eneste tilladte tal (katalog 21)
  assert.match(html, /aria-label="Notifikationer, 3 ulæste"/);
});

test("Modulbjælken (06): Tabs niveau 1 med role=tablist, handlinger til højre med koral tone og menu-pil", () => {
  const html = renderToStaticMarkup(
    createElement(ModuleBar, {
      modules,
      value: "salg",
      onChange: () => {},
      actions: [
        { id: "eksport", label: "Eksportér", menu: true },
        { id: "gemt", label: "Gemt", tone: "accent" },
      ],
    }),
  );
  assert.match(html, /role="tablist" aria-label="Moduler" class="lasso-tabs lasso-tabs--l1"/);
  assert.match(html, /aria-selected="true"[^>]*>Salg</);
  const tabsAt = html.indexOf("lasso-modulebar__tabs");
  const actionsAt = html.indexOf("lasso-modulebar__actions");
  assert.ok(tabsAt > 0 && actionsAt > tabsAt, "handlingerne står efter fanerne");
  assert.match(html, /aria-haspopup="menu"[^>]*>[^]*?Eksportér/);
  assert.match(html, /lasso-modulebar__action--accent[^>]*>[^]*?Gemt/);
});

test("Modulværktøjslinjen: udelades helt uden handlinger, ellers primær til venstre og visningsvalg til højre", () => {
  assert.equal(renderToStaticMarkup(createElement(ModuleToolbar, {})), "");
  const html = renderToStaticMarkup(createElement(ModuleToolbar, { primary: { label: "Tilføj kriterium" }, controls: createElement("span", { className: "ctl" }, "Segment") }));
  assert.match(html, /lasso-toolbar__primary[^>]*>Tilføj kriterium/);
  assert.ok(html.indexOf("lasso-toolbar__actions") < html.indexOf("lasso-toolbar__controls"));
});

test("AppShell (06 + 26a): skinne, fanebjælke, side, tre kolonner og bundnavigation i markup", () => {
  const html = renderToStaticMarkup(
    createElement(
      AppShell,
      { rail, tabs, mobile: { title: "Eksempel Byg A/S", subtitle: "Overblik", sections: modules, activeSection: "overblik" } },
      createElement(ModuleBar, { modules, value: "overblik", onChange: () => {} }),
      createElement(Columns, { count: 3 }, createElement(Column, {}, "A"), createElement(Column, {}, "B"), createElement(Column, {}, "C")),
    ),
  );
  assert.match(html, /<nav class="lasso-rail /);
  assert.match(html, /class="lasso-strip /);
  assert.match(html, /<main class="lasso-page">/);
  assert.equal((html.match(/class="lasso-page-column /g) ?? []).length, 3);
  assert.match(html, /lasso-page-columns--3/);
  // Mobil: topbjælke med burger, titel og undertitel; bundnavigation med de fire punkter (skjules på desktop via CSS)
  assert.match(html, /aria-label="Sektioner" aria-expanded="false"/);
  assert.match(html, /lasso-mobilebar__subtitle">Overblik/);
  assert.match(html, /<nav class="lasso-bottomnav" aria-label="Hovednavigation">/);
  for (const label of ["Søg", "Lister", "Overvågning", "Konto"]) assert.match(html, new RegExp(`lasso-bottomnav__label">${label}<`));
  assert.equal((html.match(/lasso-bottomnav__item/g) ?? []).length, 4);
  assert.doesNotMatch(html.slice(html.indexOf("lasso-bottomnav")), /badge/);
  // Sektionsarket er lukket som udgangspunkt
  assert.doesNotMatch(html, /lasso-sheet"/);
});

test("Sideskabelon (23.1, 26.1): valgfrit højre panel som aside ved siden af midten; uden panel er siden uændret", () => {
  const withPanel = renderToStaticMarkup(createElement(AppShell, { rail, tabs, panel: createElement("p", null, "Genveje") }, createElement("div", null, "midte")));
  assert.match(withPanel, /class="lasso-shell +lasso-shell--panel/);
  assert.match(withPanel, /<div class="lasso-page lasso-page--panel"><main class="lasso-page__main"><div>midte<\/div><\/main><aside class="lasso-page__panel" aria-label="Sammendrag og handlinger"><p>Genveje<\/p><\/aside><\/div>/);
  const without = renderToStaticMarkup(createElement(AppShell, { rail, tabs }, createElement("div", null, "midte")));
  assert.match(without, /<main class="lasso-page"><div>midte<\/div><\/main>/);
  assert.doesNotMatch(without, /lasso-page__panel/);
});
