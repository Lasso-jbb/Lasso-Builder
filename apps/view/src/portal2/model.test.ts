import assert from "node:assert/strict";
import { test } from "node:test";
import type { Dataset, ViewSpec } from "@lasso/spec";
import type { LookupResult } from "../portal/api.js";
import { canClose, closeOthers, orderPinned, parseDeepLink, setPinned, withoutDeepLink, COMPANY_TABS, isTemplateTab, moduleTabs, templateIdOf, templateTab, addRecent, historyTrimmed, summaryFingerprint, textHash, choiceKey, choiceSend, defaultChoiceSelection, isUnrecognizedHistory, shortName, askPlaceholder, choiceMessage, closeItem, contextFor, freeTextPick, headLines, highlight, loadRecent, openItem, searchCounts, searchRows, suggestions, withoutHead, withoutFollowUps, withoutChatPrompts, forPortal, type OpenItem, type PendingChoice } from "./model.js";

const novo: OpenItem = { key: "CVR-1-24256790", kind: "company", name: "NOVO NORDISK A/S", tab: "overblik" };
const lasso: OpenItem = { key: "CVR-1-34580820", kind: "company", name: "LASSO X A/S", tab: "overblik" };
const mette: OpenItem = { key: "CVR-3-4000123", kind: "person", name: "Mette Holm", tab: "overblik" };

test("åbne faner: åbn (eller opdatér) og luk; den aktive bliver naboen til venstre", () => {
  let list = openItem([], novo);
  list = openItem(list, lasso);
  list = openItem(list, { ...novo, tab: "ejerskab" });
  assert.deepEqual(
    list.map((o) => `${o.name}:${o.tab}`),
    ["NOVO NORDISK A/S:ejerskab", "LASSO X A/S:overblik"],
  );
  list = openItem(list, mette);
  const r = closeItem(list, lasso.key, lasso.key);
  assert.deepEqual(
    r.list.map((o) => o.key),
    [novo.key, mette.key],
  );
  assert.equal(r.active, novo.key);
  assert.equal(closeItem(r.list, mette.key, novo.key).active, novo.key);
  assert.equal(closeItem([novo], novo.key, novo.key).active, null);
});

test("withoutHead: portalen tegner selv navn og identitetslinje", () => {
  const spec = { version: 2, kind: "company", title: "X", layout: "dashboard", criteria: [], components: [{ type: "LassoCompanyHead", company: "CVR-1-1" }, { type: "LassoKeyFigureCards", company: "CVR-1-1" }] } as unknown as ViewSpec;
  assert.deepEqual(
    withoutHead(spec).components.map((c) => c.type),
    ["LassoKeyFigureCards"],
  );
});

test("withoutFollowUps/forPortal: ingen opfølgende spørgsmål i portalen, resten står (også i grupper og kolonner)", () => {
  const spec = {
    version: 2,
    kind: "company",
    title: "Eksempel Byg A/S",
    layout: "page",
    criteria: [],
    components: [
      { type: "LassoCompanyHead", company: "CVR-1-1" },
      { type: "LassoContact", company: "CVR-1-1", column: 1 },
      { type: "LassoFollowUps", company: "CVR-1-1", column: 1, group: { id: "g", pattern: "accordion" } },
      { type: "LassoPersonList", company: "CVR-1-1", column: 2, group: { id: "g", pattern: "accordion" } },
      { type: "LassoFollowUps", company: "CVR-1-1" },
    ],
  } as unknown as ViewSpec;
  const types = (s: ViewSpec) => s.components.map((c) => c.type);
  assert.deepEqual(types(withoutFollowUps(spec)), ["LassoCompanyHead", "LassoContact", "LassoPersonList"]);
  // Gruppens anden komponent og kolonnen står urørt; LassoView pakker resten uden hul.
  assert.deepEqual(withoutFollowUps(spec).components[2], spec.components[3]);
  assert.deepEqual(types(forPortal(spec, { head: false })), ["LassoContact", "LassoPersonList"]);
  assert.deepEqual(types(forPortal(spec)), ["LassoCompanyHead", "LassoContact", "LassoPersonList"]);
  // Uden opfølgende spørgsmål: samme objekt (intet at gentegne).
  const plain = { ...spec, components: spec.components.slice(0, 2) } as ViewSpec;
  assert.equal(withoutFollowUps(plain), plain);
});

test("withoutChatPrompts: ingen næste-knapper i portalen (answer.next, Se alle … i <fane>, værktøjslinjens spørgsmål); udfoldning bliver", () => {
  const spec = {
    version: 2,
    kind: "person",
    title: "Jeanette Hansen",
    layout: "stack",
    criteria: [],
    answer: { next: { label: "Se hele økonomien", prompt: "Vis økonomien" }, logo: true },
    components: [
      { type: "LassoPersonRoles", person: "CVR-3-1", show: "current", more: "roller" },
      { type: "LassoTimeline", company: "CVR-1-1", more: "expand" },
      { type: "LassoPersonNetwork", person: "CVR-3-1", more: "netvaerk", group: { id: "g", pattern: "cards", title: "Netværk", toolbar: { primary: { label: "Sammenlign", prompt: "Sammenlign" } } } },
      { type: "LassoFollowUps", company: "CVR-1-1" },
    ],
  } as unknown as ViewSpec;
  const out = withoutChatPrompts(spec) as unknown as { answer?: unknown; components: { type: string; more?: string; group?: Record<string, unknown> }[] };
  assert.equal(out.answer, undefined);
  assert.deepEqual(out.components.map((c) => c.type), ["LassoPersonRoles", "LassoTimeline", "LassoPersonNetwork"]);
  assert.equal(out.components[0]!.more, undefined, "Se alle N selskaber i Roller bliver til udfoldning på stedet");
  assert.equal(out.components[1]!.more, "expand", "udfoldning på stedet bliver");
  assert.deepEqual(out.components[2]!.group, { id: "g", pattern: "cards", title: "Netværk" });
  assert.equal(forPortal(spec).components.length, 3);
  // Intet at fjerne: samme objekt; originalen er urørt.
  const plain = { ...spec, answer: undefined, components: [spec.components[1]!] } as unknown as ViewSpec;
  const { answer: _a, ...plainNoAnswer } = plain as unknown as Record<string, unknown>;
  assert.equal(withoutChatPrompts(plainNoAnswer as unknown as ViewSpec), plainNoAnswer);
  assert.equal((spec.components[0] as unknown as { more: string }).more, "roller");
});

test("headLines: adresse og CVR-linje som i prototypen", () => {
  const ds = { companies: { "CVR-1-1": { lassoId: "CVR-1-1", name: "X", cvr: "13612870", phone: "12 34 56 78", website: "https://www.microsoft.dk/", address: { street: "Kanalvej 7", zip: "2800", city: "Kgs. Lyngby" } } }, persons: {} } as unknown as Dataset;
  assert.deepEqual(headLines("company", "CVR-1-1", ds), ["Kanalvej 7, 2800 Kgs. Lyngby", "CVR: 13612870, Telefon: 12 34 56 78, microsoft.dk"]);
  assert.deepEqual(headLines("company", "CVR-1-2", ds), []);
  assert.deepEqual(headLines("result", "result:1", ds), []);
});

test("contextFor: den aktive fane, de åbne firmaer og personer, og valget", () => {
  const result: OpenItem = { key: "result:1", kind: "result", name: "Søgning: lasso", tab: "lasso" };
  const open = [novo, mette, result];
  assert.deepEqual(contextFor({ ...novo, tab: "ejerskab" }, open), {
    active: { kind: "company", id: novo.key, name: novo.name, tab: "ejerskab" },
    open: [
      { kind: "company", id: novo.key, name: novo.name },
      { kind: "person", id: mette.key, name: mette.name },
    ],
  });
  assert.deepEqual(contextFor(undefined, []), { active: { kind: "global" }, open: [] });
  assert.deepEqual(contextFor(result, open).active, { kind: "global", title: "Søgning: lasso" });
  assert.equal(contextFor(undefined, Array.from({ length: 30 }, (_, i) => ({ ...novo, key: `CVR-1-${i}` }))).open.length, 20);
  const pick = { id: "toolu_1", free: true as const };
  assert.deepEqual(contextFor(novo, [novo], pick).choice, pick);
  // Det, brugeren ser: modulets resumé, afkortet til serverens grænse; ikke på Lasso-fanen.
  const shown = { spec: {} as ViewSpec, dataset: {} as Dataset, summary: "Omsætning 2025: 12 mio." };
  assert.deepEqual((contextFor({ ...novo, tab: "oekonomi" }, [novo], undefined, shown).active as { view?: unknown }).view, { module: "oekonomi", summary: "Omsætning 2025: 12 mio." });
  assert.equal((contextFor({ ...novo, tab: "lasso" }, [novo], undefined, shown).active as { view?: unknown }).view, undefined);
  assert.equal((contextFor(novo, [novo], undefined, { ...shown, summary: "x".repeat(5000) }).active as { view: { summary: string } }).view.summary.length, 4000);
});

test("choiceMessage: punktets prompt (ellers teksten) og valget med punktets action", () => {
  const choice: PendingChoice = {
    id: "toolu_1",
    question: "Hvad vil du se?",
    options: [
      { label: "Alt om Mette Holm", description: "Hele siden i en ny fane", action: { placement: "entity", entity: { kind: "person", id: mette.key, name: mette.name }, focus: "overblik", prompt: "Vis alt om Mette Holm (CVR-3-4000123)" } },
      { label: "Overordnet indblik her", description: "Kort svar her", recommended: true, action: { placement: "current" } },
    ],
    allowFreeText: true,
  };
  assert.deepEqual(choiceMessage(choice, 0), { message: "Vis alt om Mette Holm (CVR-3-4000123)", pick: { id: "toolu_1", index: 0, action: choice.options[0]!.action } });
  assert.equal(choiceMessage(choice, 1)!.message, "Overordnet indblik her");
  assert.equal(choiceMessage(choice, 2), null);
  assert.deepEqual(freeTextPick(choice), { id: "toolu_1", free: true });
});

test("forslag og pladsholder følger fanen", () => {
  assert.equal(askPlaceholder(novo), "Spørg Lasso");
  assert.equal(askPlaceholder(undefined), "Spørg Lasso");
  assert.notDeepEqual(suggestions({ ...novo, tab: "ejerskab" }), suggestions({ ...novo, tab: "oekonomi" }));
  assert.ok(suggestions(novo).includes("Hvem ejer NOVO NORDISK A/S?"));
  assert.equal(suggestions(undefined).length, 3);
});

test("søgeresultater: firmaer efter status, personer, antal og fremhævning", () => {
  const r: LookupResult = {
    q: "micro",
    companies: [
      { lassoId: "CVR-1-1", name: "MICROSOFT DANMARK ApS", cvr: "13612870", city: "Kgs. Lyngby", statusKind: "active" },
      { lassoId: "CVR-1-2", name: "MICRO-PC ApS", cvr: "25836316", city: "Ballerup", statusKind: "inactive", status: "Ophørt" },
    ],
    persons: [{ lassoId: "CVR-3-1", name: "Mette Microsen", city: "Aarhus" }],
  };
  assert.deepEqual(
    searchRows(r, "f", "Aktive").map((x) => x.meta),
    ["Kgs. Lyngby, CVR 13612870"],
  );
  assert.equal(searchRows(r, "f", "Inaktive")[0]?.status, "Ophørt");
  assert.equal(searchRows(r, "f", "Alle").length, 2);
  assert.deepEqual(searchCounts(r, "Aktive"), { f: 1, p: 1 });
  assert.deepEqual(highlight("MICROSOFT DANMARK ApS", "soft"), { pre: "MICRO", hit: "SOFT", post: " DANMARK ApS" });
  assert.deepEqual(highlight("LASSO X", "novo"), { pre: "LASSO X", hit: "", post: "" });
});

test("seneste: nyeste først uden dubletter; ødelagt lager giver en tom liste", () => {
  let l = addRecent([], { kind: "company", id: "a", name: "A", meta: "" });
  l = addRecent(l, { kind: "person", id: "b", name: "B", meta: "" });
  l = addRecent(l, { kind: "company", id: "a", name: "A", meta: "" });
  assert.deepEqual(
    l.map((x) => x.id),
    ["a", "b"],
  );
  assert.deepEqual(loadRecent({ getItem: () => "{ikke json" }), []);
  assert.deepEqual(loadRecent(undefined), []);
});

test("isUnrecognizedHistory: kun serverens 400 om en samtale, der ikke kan genkendes", () => {
  assert.equal(isUnrecognizedHistory(400, "Samtalen kunne ikke genkendes. Start en ny samtale."), true);
  assert.equal(isUnrecognizedHistory(400, "context er ugyldig"), false);
  assert.equal(isUnrecognizedHistory(429, "Samtalen kunne ikke genkendes"), false);
});

test("contextFor: resuméet sendes kun, når det er nyt; ellers same; trimmet historik opdages", () => {
  const shown = { spec: {} as ViewSpec, dataset: {} as Dataset, summary: "Omsætning 2025: 12 mio." };
  const item = { ...novo, tab: "oekonomi" };
  const fp = summaryFingerprint(item, shown)!;
  assert.equal(fp, `${novo.key}:oekonomi:${textHash(shown.summary)}`);
  assert.equal(summaryFingerprint({ ...novo, tab: "lasso" }, shown), null, "ikke på Lasso-fanen");
  assert.equal(summaryFingerprint(item, undefined), null);
  const view = (last?: string | null, s = shown) => (contextFor(item, [novo], undefined, s, last).active as { view?: unknown }).view;
  assert.deepEqual(view(null), { module: "oekonomi", summary: shown.summary }, "ny samtale: fuldt");
  assert.deepEqual(view(fp), { module: "oekonomi", same: true }, "uændret: kun same");
  assert.deepEqual(view(fp, { ...shown, summary: "Omsætning 2025: 13 mio." }), { module: "oekonomi", summary: "Omsætning 2025: 13 mio." }, "ændret: fuldt");
  assert.notEqual(summaryFingerprint({ ...item, tab: "ejerskab" }, shown), fp, "andet modul");
  assert.notEqual(textHash("a"), textHash("b"));
  // Trimning: historikken returneres kortere forfra, eller tom.
  const sent = [{ role: "user", content: "1" }, { role: "assistant", content: "a" }, { role: "user", content: "2" }, { role: "assistant", content: "b" }];
  assert.equal(historyTrimmed(sent, [...sent, { role: "user", content: "3" }]), false);
  assert.equal(historyTrimmed(sent, [...sent.slice(2), { role: "user", content: "3" }, { role: "assistant", content: "c" }, { role: "user", content: "4" }]), true, "ældste tur væk, selv om listen blev længere");
  assert.equal(historyTrimmed(sent, []), true);
  assert.equal(historyTrimmed([], [{ role: "user", content: "1" }]), false, "første tur er aldrig trimmet");
});

test("contextFor: navne og titler afkortes til serverens grænse (200); freeTextPick kun når menuen tillader fritekst", () => {
  const long = "x".repeat(500);
  const result: OpenItem = { key: "result:1", kind: "result", name: long, tab: "lasso" };
  const ctx = contextFor(result, [novo, { ...novo, key: "CVR-1-2", name: long }, result]);
  assert.equal((ctx.active as { title: string }).title.length, 200);
  assert.ok(ctx.open.every((e) => e.name.length <= 200));
  assert.equal((contextFor({ ...novo, name: long }, []).active as { name: string }).name.length, 200);
  const menu = { id: "toolu_1", question: "?", options: [], allowFreeText: false };
  assert.equal(freeTextPick(menu), undefined);
  assert.deepEqual(freeTextPick({ ...menu, allowFreeText: true }), { id: "toolu_1", free: true });
});

test("shortName: spørgsmålet afkortet ved et ordskel til højst 40 tegn, uden afsluttende tegn", () => {
  assert.equal(shortName("Største revisorer i Aarhus?"), "Største revisorer i Aarhus");
  assert.equal(shortName("  Sammenlign   Carlsberg og Royal Unibrew  "), "Sammenlign Carlsberg og Royal Unibrew");
  const long = shortName("Giv mig en samlet markedsundersøgelse af alle revisorer i Region Midtjylland");
  assert.ok(long.length <= 40 && long.endsWith("…"), long);
  assert.ok(!long.slice(0, -1).endsWith(" "));
  assert.equal(shortName("x".repeat(60)).length, 40);
});

/* ---------- valgpanelet ---------- */

const panel: PendingChoice = {
  id: "toolu_p",
  question: "Hvad vil du se om Mette Holm?",
  options: [
    { label: "Fuld indsigt", description: "Hele siden i en ny fane", action: { placement: "entity", entity: { kind: "person", id: mette.key, name: mette.name }, prompt: "Vis alt om Mette Holm" } },
    { label: "Kort indsigt", description: "Kort svar her", recommended: true, action: { placement: "current", prompt: "Kort om Mette Holm" } },
  ],
  allowFreeText: true,
};

test("valgpanel: forvalg, send, Andet og spring over", () => {
  assert.equal(defaultChoiceSelection(panel), 1, "det anbefalede");
  assert.equal(defaultChoiceSelection({ ...panel, options: panel.options.map((o) => ({ ...o, recommended: false })) }), 0);
  assert.deepEqual(choiceSend(panel, 1, ""), { message: "Kort om Mette Holm", pick: { id: "toolu_p", index: 1, action: panel.options[1]!.action } });
  assert.deepEqual(choiceSend(panel, "other", "  Sammenlign med branchen  "), { message: "Sammenlign med branchen", pick: { id: "toolu_p", free: true } });
  assert.equal(choiceSend(panel, "other", "   "), null, "tom Andet sender intet");
  assert.equal(choiceSend({ ...panel, allowFreeText: false }, "other", "tekst"), null, "Andet kun hvis tilladt");
});

test("valgpanel: taster (1–9, Andet efter punkterne, Cmd/Ctrl+Enter, Esc) og tal i tekstfelter", () => {
  const key = (k: string, mods: { metaKey?: boolean; ctrlKey?: boolean } = {}) => ({ key: k, metaKey: false, ctrlKey: false, ...mods });
  assert.deepEqual(choiceKey(key("1"), panel, false), { kind: "select", selection: 0 });
  assert.deepEqual(choiceKey(key("2"), panel, false), { kind: "select", selection: 1 });
  assert.deepEqual(choiceKey(key("3"), panel, false), { kind: "select", selection: "other" });
  assert.equal(choiceKey(key("4"), panel, false), null);
  assert.equal(choiceKey(key("3"), { ...panel, allowFreeText: false }, false), null);
  assert.equal(choiceKey(key("1"), panel, true), null, "tal i et tekstfelt er tekst");
  assert.equal(choiceKey(key("0"), panel, false), null);
  assert.deepEqual(choiceKey(key("Enter", { metaKey: true }), panel, true), { kind: "send" });
  assert.deepEqual(choiceKey(key("Enter", { ctrlKey: true }), panel, false), { kind: "send" });
  assert.equal(choiceKey(key("Enter"), panel, false), null);
  assert.deepEqual(choiceKey(key("Escape"), panel, true), { kind: "skip" });
  // Uden for panelet (fokus på siden): kun tal; Esc og Cmd/Ctrl+Enter gør intet (de kan høre til noget andet).
  assert.equal(choiceKey(key("Escape"), panel, false, "body"), null);
  assert.equal(choiceKey(key("Enter", { metaKey: true }), panel, false, "body"), null);
  assert.equal(choiceKey(key("Enter", { ctrlKey: true }), panel, false, "body"), null);
  assert.deepEqual(choiceKey(key("2"), panel, false, "body"), { kind: "select", selection: 1 });
  // Almindelig Enter sender kun i "Andet"-feltet.
  assert.deepEqual(choiceKey(key("Enter"), panel, true, "panel", true), { kind: "send" });
  assert.equal(choiceKey(key("Enter"), panel, true, "panel", false), null);
  assert.equal(choiceKey(key("Enter"), panel, false, "panel", false), null);
  assert.deepEqual(choiceKey(key("Enter", { metaKey: true }), panel, true, "panel", true), { kind: "send" });
});

test("moduleTabs: de indbyggede moduler og så én pr. egen side af slagsen (tpl:<id>); et resultat har ingen", () => {
  const templates = [
    { id: "a1", kind: "company" as const, title: "KYC-overblik" },
    { id: "b2", kind: "person" as const, title: "Mine roller" },
    { id: "c3", kind: "company" as const, title: "Ejere" },
  ];
  const company = moduleTabs("company", templates);
  assert.deepEqual(company.map((t) => t.id), [...COMPANY_TABS.map((t) => t.id), "tpl:a1", "tpl:c3"]);
  assert.deepEqual(company.slice(-2), [{ id: "tpl:a1", label: "KYC-overblik", template: true }, { id: "tpl:c3", label: "Ejere", template: true }]);
  assert.deepEqual(moduleTabs("person", templates).slice(-1), [{ id: "tpl:b2", label: "Mine roller", template: true }]);
  assert.deepEqual(moduleTabs("company", []).map((t) => t.id), COMPANY_TABS.map((t) => t.id));
  assert.deepEqual(moduleTabs("result", templates), []);
  assert.ok(isTemplateTab("tpl:a1") && !isTemplateTab("oekonomi"));
  assert.equal(templateIdOf("tpl:a1"), "a1");
  assert.equal(templateTab("a1"), "tpl:a1");
  // serverens context.tab er højst 40 tegn: tpl: + et UUID passer lige.
  assert.equal(templateTab("123e4567-e89b-12d3-a456-426614174000").length, 40);
});

test("Dybt link (Åben i Lasso): ?aabn=…&fokus=…&fastgoer=1 læses og fjernes fra adressen", () => {
  assert.deepEqual(parseDeepLink("?aabn=CVR-1-99000001&fokus=oekonomi&fastgoer=1"), { kind: "company", id: "CVR-1-99000001", tab: "oekonomi", pin: true });
  assert.deepEqual(parseDeepLink("?aabn=cvr-3-4000000001&fokus=netvaerk"), { kind: "person", id: "CVR-3-4000000001", tab: "netvaerk", pin: false });
  // Ukendt fokus giver Overblik; "ledelse" er Kontakt på en virksomhed; personfokus på en virksomhed gælder ikke.
  assert.equal(parseDeepLink("?aabn=CVR-1-1&fokus=noget")!.tab, "overblik");
  assert.equal(parseDeepLink("?aabn=CVR-1-1&fokus=ledelse")!.tab, "kontakt");
  assert.equal(parseDeepLink("?aabn=CVR-1-1&fokus=netvaerk")!.tab, "overblik");
  assert.equal(parseDeepLink("?aabn=CVR-1-1")!.tab, "overblik");
  assert.equal(parseDeepLink("?aabn=12345678"), null);
  assert.equal(parseDeepLink("?aaben=CVR-1-1"), null);
  // Kun linkets parametre fjernes; andre parametre og #-delen bliver.
  assert.equal(withoutDeepLink("https://x.dk/portal?aabn=CVR-1-1&fokus=oekonomi&fastgoer=1"), "/portal");
  assert.equal(withoutDeepLink("https://x.dk/portal?tema=dark&aabn=CVR-1-1&fastgoer=1#top"), "/portal?tema=dark#top");
});

test("Fastgjorte faner: først i bjælken, kan ikke lukkes, bliver ved 'Luk alle andre', og en ny åbning frigør dem ikke", () => {
  const a: OpenItem = { key: "CVR-1-1", kind: "company", name: "A", tab: "overblik" };
  const b: OpenItem = { key: "CVR-1-2", kind: "company", name: "B", tab: "overblik" };
  const c: OpenItem = { key: "CVR-3-3", kind: "person", name: "C", tab: "overblik" };
  let list = openItem(openItem(openItem([], a), b), c);
  list = setPinned(list, c.key, true);
  assert.deepEqual(list.map((o) => o.key), [c.key, a.key, b.key]);
  list = setPinned(list, b.key, true);
  assert.deepEqual(list.map((o) => o.key), [c.key, b.key, a.key], "en ny fastgjort lægges efter de andre fastgjorte");
  assert.ok(list[0]!.pinned && list[1]!.pinned && !list[2]!.pinned);
  // Lukning: en fastgjort fane lukkes ikke (× er skjult); en almindelig gør.
  assert.equal(canClose(list[0]), false);
  assert.deepEqual(closeItem(list, c.key, c.key), { list, active: c.key });
  assert.deepEqual(closeItem(list, a.key, a.key).list.map((o) => o.key), [c.key, b.key]);
  // Luk alle andre: den aktive og de fastgjorte bliver.
  assert.deepEqual(closeOthers(list, a.key).map((o) => o.key), [c.key, b.key, a.key]);
  assert.deepEqual(closeOthers(setPinned(list, b.key, false), c.key).map((o) => o.key), [c.key]);
  // En åbning uden pinned (søgning, links) bevarer fastgørelsen; orden er altid fastgjorte først.
  const again = openItem(list, { ...b, tab: "oekonomi" });
  assert.equal(again.find((o) => o.key === b.key)!.pinned, true);
  assert.equal(again.find((o) => o.key === b.key)!.tab, "oekonomi");
  // Frigør: fanen står lige efter de fastgjorte.
  assert.deepEqual(setPinned(list, c.key, false).map((o) => o.key), [b.key, c.key, a.key]);
  assert.deepEqual(orderPinned([a, { ...c, pinned: true }, b]).map((o) => o.key), [c.key, a.key, b.key]);
});
