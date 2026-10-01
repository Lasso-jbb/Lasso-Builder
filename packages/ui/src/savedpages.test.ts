import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { emptyDataset, savedPagesKey, viewSpecSchema, type Dataset, type SavedPageVM, type SavedPagesVM, type ViewSpecInput } from "@lasso/spec";
import { SavedPages } from "./components/SavedPages.js";
import { LassoView, saveTarget } from "./LassoView.js";
import type { HostCapabilities } from "./types.js";

const noop = () => {};

function page(i: number, over: Partial<SavedPageVM> = {}): SavedPageVM {
  const cvr = String(34580820 + i);
  return { lassoId: `CVR-1-${cvr}`, kind: "company", name: `Eksempel ${i} A/S`, cvr, origin: "manual", savedAt: "2026-09-27T10:15:00Z", ...over };
}

function list(pages: SavedPageVM[], total = pages.length): SavedPagesVM {
  return { pages, total, kind: "all", limit: 20 };
}

const render = (props: Partial<Parameters<typeof SavedPages>[0]>) =>
  renderToStaticMarkup(createElement(SavedPages, { canDrillDown: true, canRemove: true, onAction: noop, ...props }));

const rowCount = (html: string) => (html.match(/<li class="lasso-row/g) ?? []).length;

test("Gemte sider: over 6 rækker vises 5 + 'Vis alle 10' (global regel, Jakob 01.10), undertitel med antal og kildevisning", () => {
  const html = render({ list: list(Array.from({ length: 10 }, (_, i) => page(i))) });
  assert.equal(rowCount(html), 5);
  assert.match(html, /aria-expanded="false"[^>]*>Vis alle 10</);
  assert.match(html, /class="lasso-section__title">Gemte sider</);
  assert.match(html, /class="lasso-section__subtitle">10 gemte sider</);
  assert.doesNotMatch(html, /Kilde:/, "G3: ingen kildevisning");
  // Ingen piller, badges eller initial-cirkler
  assert.doesNotMatch(html, /lasso-badge|avatar|initial/);
  // 6 rækker eller færre foldes ikke
  const eight = render({ list: list(Array.from({ length: 6 }, (_, i) => page(i))) });
  assert.equal(rowCount(eight), 6);
  assert.doesNotMatch(eight, /Se alle/);
});

test("Gemte sider: ental, egen titel, og flere gemt end vist", () => {
  const one = render({ list: list([page(1)]), title: "Mine virksomheder" });
  assert.match(one, /class="lasso-section__title">Mine virksomheder</);
  assert.match(one, /class="lasso-section__subtitle">1 gemt side</);
  const capped = render({ list: list([page(1), page(2)], 35) });
  assert.match(capped, /35 gemte sider, de 2 nyeste vises/);
});

test("Gemte sider: rækken viser navn alene, hvad siden er, fokus, oprindelse, note og gemt-dato", () => {
  const html = render({
    list: list([
      page(0, { focus: "oekonomi", note: "Tjek regnskab i januar" }),
      page(1, { origin: "send" }),
      { lassoId: "CVR-3-4000123", kind: "person", name: "Anne Eksempel", origin: "link", savedAt: "2026-09-20" },
      page(2, { focus: "ukendt" }),
      { lassoId: "CVR-3-4000124", kind: "person", name: "Bo Eksempel", focus: "netvaerk", origin: "manual", savedAt: "2026-09-21" },
      page(3, { focus: "roller" }),
    ]),
  });
  // Personfokus med personens navne; et personfokus på en virksomhed er ukendt og vises ikke.
  assert.match(html, /class="lasso-row__sub">Person, fokus: Netværk</);
  assert.match(html, /class="lasso-row__sub">Virksomhed, CVR 34580823</);
  assert.match(html, /class="lasso-row__sub">Virksomhed, CVR 34580820, fokus: Økonomi</);
  assert.match(html, /class="lasso-row__sub lasso-savedpages__note">Tjek regnskab i januar</);
  assert.match(html, /class="lasso-row__sub">Virksomhed, CVR 34580821, sendt til Lasso</);
  assert.match(html, /class="lasso-row__sub">Person, sendt til Lasso</);
  // Ukendt fokus og manuel oprindelse vises ikke
  assert.match(html, /class="lasso-row__sub">Virksomhed, CVR 34580822</);
  assert.match(html, /<span>gemt 27\.09\.2026<\/span>/);
  assert.match(html, /<span>gemt 20\.09\.2026<\/span>/);
  // Navnet er en knap til siden, når værten kan åbne den
  assert.match(html, /<button type="button" class="lasso-link lasso-row__open">Anne Eksempel<\/button>/);
  const plain = render({ list: list([page(0)]), canDrillDown: false });
  assert.match(plain, /class="lasso-row__name">Eksempel 0 A\/S<\/div>/);
  assert.doesNotMatch(plain, /lasso-row__open/);
});

test("Gemte sider: tom liste siger hvorfor og viser aldrig 0", () => {
  const html = render({ list: list([]) });
  assert.match(html, /class="lasso-state"/);
  assert.match(html, /Du har ingen gemte sider endnu\. Gem en virksomhed eller person med Gem-knappen øverst på siden, eller sig &#x27;gem den&#x27; til Claude\./);
  assert.doesNotMatch(html, /0 gemte sider/);
  assert.doesNotMatch(html, /Kilde:/);
});

test("Gemte sider: henter, ingen adgang (tom med forklaring) og teknisk fejl", () => {
  assert.match(render({}), /aria-busy="true"/);
  const noAccess = render({ error: "Ingen adgang til gemte sider på en delt side." });
  assert.match(noAccess, /class="lasso-state"/);
  assert.match(noAccess, /Ingen adgang til gemte sider på en delt side\./);
  assert.doesNotMatch(noAccess, /role="alert"/);
  const failed = render({ error: "Databasen svarede ikke" });
  assert.match(failed, /class="lasso-state lasso-state--error" role="alert"/);
  assert.match(failed, /Data kunne ikke hentes/);
});

test("Gemte sider: filter Alle/Virksomheder/Personer kun når listen har begge slags", () => {
  const onlyCompanies = render({ list: list([page(0), page(1)]) });
  assert.doesNotMatch(onlyCompanies, /role="tablist"/);
  const mixed = render({ list: list([page(0), { lassoId: "CVR-3-4000123", kind: "person", name: "Anne Eksempel", origin: "manual", savedAt: "2026-09-20" }]) });
  assert.match(mixed, /role="tablist"[^>]*aria-label="Vis gemte sider"/);
  assert.match(mixed, /class="lasso-tabs lasso-tabs--l3"/);
  assert.match(mixed, /aria-selected="true"[^>]*>Alle</);
  assert.match(mixed, />Virksomheder</);
  assert.match(mixed, />Personer</);
  // Kun navnet på fanen, ingen tællere (regel 2)
  assert.doesNotMatch(mixed, /Virksomheder \(\d+\)|Personer \(\d+\)/);
});

test("Gemte sider: Fjern-knap kun når værten kan fjerne", () => {
  const withRemove = render({ list: list([page(0), page(1)]) });
  assert.equal((withRemove.match(/>Fjern<\/button>/g) ?? []).length, 2);
  assert.match(withRemove, /<button type="button" class="lasso-link lasso-savedpages__remove" aria-label="Fjern Eksempel 0 A\/S fra gemte">Fjern<\/button>/);
  const without = render({ list: list([page(0), page(1)]), canRemove: false });
  assert.doesNotMatch(without, /Fjern/);
});

/* ---------- Gem/Gemt i hovedet (katalog 01, regel 21) ---------- */

const COMPANY = "CVR-1-34580820";
const PERSON = "CVR-3-4000123";

function spec(input: Partial<ViewSpecInput> & Pick<ViewSpecInput, "components">) {
  return viewSpecSchema.parse({ kind: "company", title: "Eksempel A/S", layout: "columns", ...input });
}

function data(saved: string[] | undefined): Dataset {
  const ds = emptyDataset("live");
  ds.generatedAt = "2026-09-27T10:15:00";
  ds.companies[COMPANY] = { lassoId: COMPANY, cvr: "34580820", name: "Eksempel A/S", status: "Normal", statusKind: "active" };
  if (saved) ds.savedIds = saved;
  return ds;
}

const view = (s: ReturnType<typeof spec>, ds: Dataset | null, host: HostCapabilities) => renderToStaticMarkup(createElement(LassoView, { spec: s, dataset: ds, host, onAction: noop }));

const headerOf = (html: string) => html.slice(html.indexOf("<header class=\"lasso-frame__header"), html.indexOf("</header>") + 9);

/** Virksomheds-/personhovedet (katalog 08.1): Gem er en 32 px ikonknap blandt hovedets handlinger. */
const headOf = (html: string) => {
  const at = html.search(/<header class="lasso-(company|personhead) /);
  return html.slice(at, html.indexOf("</header>", at) + 9);
};

test("Hoved: Gem-knap i virksomhedshovedet (08.1), når værten kan gemme sider; ikke i rammens header", () => {
  const html = view(spec({ components: [{ type: "LassoCompanyHead", company: COMPANY }] }), data([]), { savePage: true });
  assert.match(headOf(html), /<button type="button" class="lasso-headbtn lasso-headbtn--save" aria-pressed="false" aria-label="Gem på din liste"[^>]*><svg[^>]*fill="none"/);
  assert.doesNotMatch(headerOf(html), /lasso-frame__save/);
  assert.doesNotMatch(html, /Gemt/);
});

test("Hoved: Gemt med aria-pressed og fyldt ikon, når siden står i savedIds", () => {
  const html = headOf(view(spec({ components: [{ type: "LassoCompanyHead", company: COMPANY }] }), data([COMPANY]), { savePage: true }));
  assert.match(html, /class="lasso-headbtn lasso-headbtn--save" aria-pressed="true" aria-label="Gemt, fjern fra din liste"[^>]*><svg[^>]*fill="currentColor"/);
});

test("Rammens header: Gem/Gemt står der kun, når siden ikke har et fuldt hoved (fx variant 'line')", () => {
  const html = headerOf(view(spec({ components: [{ type: "LassoCompanyHead", company: COMPANY, variant: "line" }] }), data([COMPANY]), { savePage: true }));
  assert.match(html, /class="lasso-iconbtn lasso-frame__save" aria-pressed="true"/);
  assert.match(html, /<svg[^>]*fill="currentColor"[^>]*>.*<\/svg><span>Gemt<\/span><\/button>/);
});

test("Hoved: ingen Gem-knap uden host.savePage, på lister eller før data er hentet", () => {
  const company = spec({ components: [{ type: "LassoCompanyHead", company: COMPANY }] });
  assert.doesNotMatch(view(company, data([COMPANY]), { save: true, drillDown: true }), /lasso-iconbtn/);
  assert.doesNotMatch(view(company, null, { savePage: true }), /lasso-iconbtn/);
  const listSpec = spec({ kind: "list", title: "Mine gemte sider", layout: "stack", components: [{ type: "LassoSavedPages" }] });
  assert.doesNotMatch(view(listSpec, data([]), { savePage: true }), /lasso-iconbtn/);
});

test("Hoved: personside får Gem-knap med personens ID", () => {
  const ds = data([PERSON]);
  const s = spec({ kind: "person", title: "Anne Eksempel", subtitle: "Roller i 3 selskaber", components: [{ type: "LassoPersonHead", person: PERSON }] });
  // Uden personens data tegner hovedet et skelet, så Gem står i rammens header.
  assert.match(headerOf(view(s, ds, { savePage: true })), /aria-pressed="true"[^>]*>.*<span>Gemt<\/span>/);
  ds.persons[PERSON] = { lassoId: PERSON, name: "Anne Eksempel", roles: [] };
  const withPerson = view(s, ds, { savePage: true });
  assert.match(headOf(withPerson), /lasso-headbtn--save" aria-pressed="true"/);
  assert.doesNotMatch(headerOf(withPerson), /lasso-frame__save/);
  assert.deepEqual(saveTarget(s, ds), { kind: "save-page", lassoId: PERSON, pageKind: "person", name: "Anne Eksempel" });
});

test("saveTarget: navn fra datasættet, focus kun når undertitlen er et fokusnavn", () => {
  const oek = spec({ subtitle: "Økonomi", components: [{ type: "LassoCompanyHead", company: COMPANY }] });
  assert.deepEqual(saveTarget(oek, data([])), { kind: "save-page", lassoId: COMPANY, pageKind: "company", name: "Eksempel A/S", focus: "oekonomi" });
  const free = spec({ subtitle: "Sammenlignet med branchen", components: [{ type: "LassoCompanyHead", company: COMPANY }] });
  assert.equal(saveTarget(free, data([]))?.focus, undefined);
  // Personsiden: composePerson sætter undertitlen til personfokusets navn uden for overblik.
  const risk = spec({ kind: "person", title: "Anne Eksempel", subtitle: "Netværk", components: [{ type: "LassoPersonHead", person: PERSON }] });
  assert.deepEqual(saveTarget(risk, data([])), { kind: "save-page", lassoId: PERSON, pageKind: "person", name: "Anne Eksempel", focus: "netvaerk" });
  const overview = spec({ kind: "person", title: "Anne Eksempel", subtitle: "Roller i 3 selskaber", components: [{ type: "LassoPersonHead", person: PERSON }] });
  assert.equal(saveTarget(overview, data([]))?.focus, undefined);
  // Et virksomhedsfokus som undertitel på en personside er ikke et personfokus.
  const wrong = spec({ kind: "person", title: "Anne Eksempel", subtitle: "Økonomi", components: [{ type: "LassoPersonHead", person: PERSON }] });
  assert.equal(saveTarget(wrong, data([]))?.focus, undefined);
  assert.equal(saveTarget(spec({ kind: "custom", components: [{ type: "LassoCompanyHead", company: COMPANY }] }), data([])), null);
});

test("LassoView: LassoSavedPages tegnes fra datasættet; Fjern kun med host.savePage", () => {
  const s = spec({ kind: "list", title: "Mine gemte sider", layout: "stack", components: [{ type: "LassoSavedPages", kind: "all", limit: 20 }] });
  const ds = data([]);
  ds.savedPages[savedPagesKey({ kind: "all", limit: 20 })] = list([page(0), page(1)]);
  const mcp = view(s, ds, { savePage: true, drillDown: true });
  assert.equal(rowCount(mcp), 2);
  assert.match(mcp, />Fjern<\/button>/);
  const web = view(s, ds, { refresh: true, export: true });
  assert.doesNotMatch(web, />Fjern</);
  // Delt side uden bruger: serverens fejlnøgle giver tom tilstand med forklaring
  const shared = data(undefined);
  shared.errors[`savedPages:${savedPagesKey({ kind: "all", limit: 20 })}`] = "Gemte sider kræver adgang som bruger i Lasso.";
  assert.match(view(s, shared, { refresh: true }), /class="lasso-state"><div class="lasso-small">Gemte sider kræver adgang som bruger i Lasso\./);
});

test("frameless (06.1/24/25): i portalens ramme udelades visningens egen header og fod", () => {
  const s = spec({ components: [{ type: "LassoCompanyHead", company: COMPANY }] });
  const host: HostCapabilities = { savePage: true, save: true, export: true, refresh: true };
  const framed = view(s, data([]), host);
  // Med virksomhedshovedet står navnet øverst (MCP-rammen, Jakob 30.09); rammens eget hoved tegnes ikke.
  assert.doesNotMatch(framed, /lasso-frame__header/);
  assert.match(framed, /<footer class="lasso-actionbar"/);
  const bare = renderToStaticMarkup(createElement(LassoView, { spec: s, dataset: data([]), host, onAction: noop, frameless: true }));
  assert.match(bare, /class="lasso-frame lasso-frame--bare"/);
  assert.doesNotMatch(bare, /lasso-frame__header|lasso-frame__eyebrow|Virksomhedsprofil|Data hentet|lasso-actionbar|Gem visning/);
  // Hovedet og dets handlinger står stadig
  assert.match(bare, /lasso-headbtn--save/);
});
