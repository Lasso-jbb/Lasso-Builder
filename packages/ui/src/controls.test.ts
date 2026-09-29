import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ActionRow, Button, IconButton, Label } from "./components/Button.js";
import { CATALOG_ICONS, Icon, ICON_LABELS } from "./components/Icon.js";
import { PageHeader } from "./components/PageHeader.js";
import { TreePicker, compactSelection, expandSelection, type TreeNode } from "./components/TreePicker.js";
import { AppShell } from "./components/AppShell.js";
import { FollowUps } from "./components/FollowUps.js";
import { StatusBadge, statusTone } from "./primitives.js";

test("Ikoner (01.6): 20 katalogikoner, streg 1,8, runde ender, aria-hidden uden label", () => {
  assert.equal(CATALOG_ICONS.length, 20);
  assert.equal(Object.keys(ICON_LABELS).length, 20);
  for (const name of CATALOG_ICONS) {
    const html = renderToStaticMarkup(createElement(Icon, { name }));
    assert.match(html, /stroke-width="1.8"/);
    assert.match(html, /stroke-linecap="round"/);
    assert.match(html, /aria-hidden="true"/);
    assert.match(html, /<path d="M/);
  }
  const labelled = renderToStaticMarkup(createElement(Icon, { name: "ai", label: "AI" }));
  assert.match(labelled, /role="img"[^>]*aria-label="AI"/);
});

test("Knapper (05.1): varianter inkl. link, størrelser og Gemmer…", () => {
  const link = renderToStaticMarkup(createElement(Button, { variant: "link", children: "Se alle" }));
  assert.match(link, /class="lasso-btn lasso-btn--link"/);
  assert.match(link, /M9.5 6l6 6-6 6/); // chevron højre efter teksten
  assert.match(renderToStaticMarkup(createElement(Button, { variant: "primary", size: 42, icon: "plus", children: "Tilføj" })), /lasso-btn lasso-btn--primary lasso-btn--lg/);
  assert.match(renderToStaticMarkup(createElement(Button, { size: 32, children: "Ryd" })), /class="lasso-btn lasso-btn--sm"/);
  const busy = renderToStaticMarkup(createElement(Button, { variant: "primary", loading: true, children: "Gemmer…" }));
  assert.match(busy, /disabled=""[^>]*aria-busy="true"/);
  assert.match(busy, /lasso-btn__spinner/);
});

test("Ikonknapper (05.2): 38 og 32 px, aria-label, aktiv ved aria-pressed", () => {
  const a = renderToStaticMarkup(createElement(IconButton, { icon: "more", label: "Flere" }));
  assert.match(a, /class="lasso-iconbtn lasso-iconbtn--sq lasso-iconbtn--38"/);
  assert.match(a, /aria-label="Flere"/);
  const on = renderToStaticMarkup(createElement(IconButton, { icon: "bell", label: "Overvåg", pressed: true }));
  assert.match(on, /lasso-iconbtn--active/);
  assert.match(on, /aria-pressed="true"/);
  assert.match(renderToStaticMarkup(createElement(IconButton, { icon: "edit", label: "Redigér", size: 32, variant: "subtle" })), /lasso-iconbtn--32 lasso-iconbtn--subtle/);
});

test("Handlingsrække (05.3): '…' først, sekundær, primær sidst", () => {
  const html = renderToStaticMarkup(
    createElement(ActionRow, { more: [{ id: "x", label: "Omdøb" }], secondary: [{ label: "Gem som ny" }], primary: { label: "Gem" } }),
  );
  const iMore = html.indexOf('aria-label="Flere handlinger"');
  const iSec = html.indexOf("Gem som ny");
  const iPri = html.indexOf("lasso-btn--primary");
  assert.ok(iMore >= 0 && iMore < iSec && iSec < iPri, "rækkefølgen er fast");
});

test("Etiket (05.6) og status som ren tekst (05.7)", () => {
  assert.equal(renderToStaticMarkup(createElement(Label, { children: "Branchekode" })), '<span class="lasso-label ">Branchekode</span>');
  assert.equal(statusTone("Under likvidation", "warning"), "liquidation");
  assert.equal(statusTone("Under konkurs", "warning"), "warning");
  assert.equal(statusTone("Ny", undefined), "new");
  assert.equal(statusTone("Ophørt", "inactive"), "inactive");
  assert.match(renderToStaticMarkup(createElement(StatusBadge, { status: "Ny", kind: "new" })), /lasso-badge--new/);
});

test("Sidehoved (04.1): i ro kun '…'; ændret viser tekst og Gem; omdøb på stedet", () => {
  const idle = renderToStaticMarkup(createElement(PageHeader, { title: "Store IT-selskaber", subtitle: "Gemt liste, 1.243 virksomheder", onSave: () => {}, onRename: () => {} }));
  assert.match(idle, /<h1 class="lasso-pagehead__title">Store IT-selskaber<\/h1>/);
  assert.doesNotMatch(idle, /lasso-btn--primary/);
  assert.match(idle, /aria-label="Flere handlinger"/);
  const dirty = renderToStaticMarkup(createElement(PageHeader, { title: "Store IT-selskaber", dirty: true, onSave: () => {}, secondary: { label: "Gem som ny" } }));
  assert.match(dirty, /Ændret, ikke gemt/);
  assert.match(dirty, /lasso-btn--primary[^>]*><span>Gem<\/span>/);
  const menu = renderToStaticMarkup(createElement(PageHeader, { title: "Liste", onRename: () => {}, defaultMenuOpen: true }));
  assert.match(menu, /role="menuitem"[^>]*>.*Omdøb/);
  const renaming = renderToStaticMarkup(createElement(PageHeader, { title: "Liste", onRename: () => {}, defaultRenaming: true }));
  assert.match(renaming, /<input class="lasso-pagehead__input"[^>]*value="Liste"/);
  assert.doesNotMatch(renaming, /role="dialog"/);
});

const NACE: TreeNode[] = [
  {
    id: "A",
    code: "A",
    label: "Landbrug, jagt, skovbrug og fiskeri",
    count: 40,
    children: [
      {
        id: "01",
        code: "01",
        label: "Plante- og husdyravl",
        count: 31,
        children: [
          { id: "01.1", code: "01.1", label: "Dyrkning af etårige afgrøder", count: 7 },
          { id: "01.2", code: "01.2", label: "Dyrkning af flerårige afgrøder", count: 9 },
        ],
      },
    ],
  },
  { id: "B", code: "B", label: "Råstofindvinding", count: 15 },
];

test("Trævælger (07.7): delvis markering, valgt række, kompakt værdi og søgning", () => {
  const html = renderToStaticMarkup(createElement(TreePicker, { nodes: NACE, value: ["01.1"], defaultExpanded: ["A", "01"], searchPlaceholder: "Søg branche eller NACE-kode", extra: { label: "Søg også i bibrancher", checked: false } }));
  assert.match(html, /role="tree"/);
  assert.match(html, /data-id="A"[^>]*aria-level="1"[^>]*aria-expanded="true"[^>]*aria-checked="mixed"/);
  assert.match(html, /data-id="01.1"[^>]*aria-checked="true"[^>]*class="lasso-tree__row lasso-tree__row--l3 is-on"/);
  assert.match(html, /lasso-check--mixed/);
  assert.match(html, /role="checkbox" aria-checked="false"[^>]*>.*Søg også i bibrancher/);
  // Alle koder under 01 valgt → værdien er "01"; A er stadig kun delvis (A har ét barn, så A)
  assert.deepEqual(compactSelection(NACE, expandSelection(NACE, ["01.1", "01.2"])), ["A"]);
  assert.deepEqual(compactSelection(NACE, expandSelection(NACE, ["01.2", "B"])), ["01.2", "B"]);
  const found = renderToStaticMarkup(createElement(TreePicker, { nodes: NACE, value: [], query: "flerårige" }));
  assert.match(found, /data-id="A"/);
  assert.match(found, /data-id="01.2"/);
  assert.doesNotMatch(found, /data-id="01.1"/);
  assert.doesNotMatch(found, /data-id="B"/);
});

test("Mobil (26a.3): bundnavigation med fire punkter, dæmpet punkt har grund; '…' som handlingsark", () => {
  const html = renderToStaticMarkup(
    createElement(AppShell, {
      rail: { groups: [] },
      tabs: { tabs: [] },
      mobile: {
        title: "Eksempel A/S",
        subtitle: "Overblik",
        moreItems: [{ id: "save", label: "Gem på din liste" }],
        nav: [
          { id: "soeg", label: "Søg", active: true },
          { id: "lister", label: "Lister" },
          { id: "overvaagning", label: "Overvågning", disabled: true, disabledReason: "Ikke slået til" },
          { id: "konto", label: "Konto" },
        ],
      },
    }),
  );
  assert.equal((html.match(/lasso-bottomnav__item/g) ?? []).length, 4);
  assert.match(html, /disabled=""[^>]*title="Ikke slået til"/);
  assert.match(html, /class="lasso-mobilebar__btn"[^>]*aria-haspopup="menu"/);
  assert.match(html, /lasso-menu__context-title">Eksempel A\/S/);
});

test("Genveje (26a.7): gruppe med klassen, der ruller vandret på mobil", () => {
  const html = renderToStaticMarkup(createElement(FollowUps, { prompts: [{ label: "Ejerdiagram", prompt: "x" }], onAction: () => {}, enabled: true }));
  assert.match(html, /class="lasso-span-2 lasso-followups" role="group" aria-label="Genveje"/);
});
