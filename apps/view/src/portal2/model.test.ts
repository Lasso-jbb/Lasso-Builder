import assert from "node:assert/strict";
import { test } from "node:test";
import type { Dataset, ViewSpec } from "@lasso/spec";
import type { LookupResult } from "../portal/api.js";
import type { ChatEvent } from "../chat/stream.js";
import { addRecent, applyEvent, choiceKey, choiceSend, defaultChoiceSelection, skipChoice, CHAT_CACHE_TTL_MS, clearCache, dropTabDatasets, isUnrecognizedHistory, resetConversation, recencyOrder, shortName, restoreCache, saveCache, serializeCache, askPlaceholder, choiceMessage, closeItem, contextFor, freeTextPick, headLines, highlight, lastView, loadRecent, mapViews, newAnswer, openItem, searchCounts, searchRows, suggestions, withLastView, withoutHead, type OpenItem, type PendingChoice } from "./model.js";

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

test("applyEvent: tekst og visninger i rækkefølge, placering først, menu og fejl", () => {
  const spec = { version: 2, kind: "company", title: "X", layout: "dashboard", criteria: [], components: [] } as unknown as ViewSpec;
  const ds = { companies: {}, persons: {} } as unknown as Dataset;
  const events: ChatEvent[] = [
    { type: "placement", placement: "entity", target: { kind: "person", id: mette.key, name: mette.name }, focus: "overblik" },
    { type: "text", text: "Jakob " },
    { type: "text", text: "har 4 firmaer." },
    { type: "tool", id: "t1", name: "render_view", title: "Vis oversigt" },
    { type: "view", id: "t1", name: "render_view", form: "module", spec, dataset: ds },
    { type: "text", text: "Og her er siden." },
    { type: "view", id: "t2", name: "show_person", form: "page", spec, dataset: ds },
    { type: "done", history: [], sig: "s", placement: { placement: "entity", target: { kind: "person", id: mette.key, name: mette.name }, focus: "overblik" } },
  ];
  let a = newAnswer("Hvad laver Jakob?");
  for (const e of events) a = applyEvent(a, e);
  assert.deepEqual(
    a.parts.map((p) => (p.kind === "text" ? `text:${p.text}` : `view:${p.form}`)),
    ["text:Jakob har 4 firmaer.", "view:module", "text:Og her er siden.", "view:page"],
  );
  assert.deepEqual(a.placement, { placement: "entity", target: { kind: "person", id: mette.key, name: mette.name }, focus: "overblik" });
  assert.equal(a.pending, false);
  assert.equal(a.status, undefined);
  assert.equal(lastView(a)?.spec, spec);

  // Status mens værktøjet henter; fejl fjerner status.
  const busy = applyEvent(newAnswer("q"), { type: "tool", id: "t", name: "show_company", title: "Vis virksomhed" });
  assert.equal(busy.status, "Vis virksomhed …");
  const failed = applyEvent(busy, { type: "error", message: "Nej." });
  assert.equal(failed.status, undefined);
  assert.equal(failed.error, "Nej.");

  // Menuen gemmes på svaret.
  const withMenu = applyEvent(newAnswer("vis alt om Mette"), { type: "choice", id: "toolu_1", question: "Hvad vil du se?", options: [{ label: "Alt om Mette", description: "Kort", action: { placement: "current" } }], allowFreeText: false });
  assert.deepEqual(withMenu.choice, { id: "toolu_1", question: "Hvad vil du se?", options: [{ label: "Alt om Mette", description: "Kort", action: { placement: "current" } }], allowFreeText: false });

  // Den seneste visning kan erstattes, og alle visninger kan ændres.
  const spec2 = { ...spec, title: "Y" } as ViewSpec;
  assert.equal(lastView(withLastView(a, { spec: spec2, dataset: ds }))?.spec.title, "Y");
  assert.equal((withLastView(a, { spec: spec2, dataset: ds }).parts[1] as { spec: ViewSpec }).spec.title, "X", "kun den seneste");
  assert.ok(mapViews(a, (s) => ({ ...s, dataset: { ...s.dataset, savedIds: ["a"] } })).parts.every((p) => p.kind !== "view" || p.dataset.savedIds?.[0] === "a"));
  assert.equal(lastView(newAnswer("q")), undefined);
});

/* ---------- chatten i browseren ---------- */

const tr = (content: unknown) => ({ role: "user", content });
const history = [
  tr("Spørgsmål 1"),
  { role: "assistant", content: [{ type: "tool_use", id: "t1", name: "show_company", input: {} }] },
  tr([{ type: "tool_result", tool_use_id: "t1", content: "ok" }]),
  { role: "assistant", content: [{ type: "text", text: "Svar 1" }] },
  tr([{ type: "text", text: "[Kontekst] …" }, { type: "text", text: "Spørgsmål 2" }]),
  { role: "assistant", content: [{ type: "text", text: "Svar 2" }] },
  tr("Spørgsmål 3"),
  { role: "assistant", content: [{ type: "text", text: "Svar 3" }] },
];

test("chat-cache: gemmes og læses for samme bruger inden udløb; svar med pending og lukkede faner udelades", () => {
  const answers = {
    [novo.key]: { question: "q", parts: [{ kind: "text" as const, text: "a" }], pending: false, status: "Henter …", choice: { id: "toolu_1", question: "Hvad?", options: [], allowFreeText: true } },
    [mette.key]: { question: "q2", parts: [], pending: true },
    "result:9": { question: "lukket", parts: [], pending: false },
  };
  const state = { chat: { history, sig: "sig" }, open: [novo, mette], active: mette.key, answers };
  const c = serializeCache("pia", state, 1000);
  assert.deepEqual(Object.keys(c.answers), [novo.key]);
  assert.equal(c.answers[novo.key]!.status, undefined);
  assert.deepEqual(c.answers[novo.key]!.choice?.id, "toolu_1", "en åben menu gemmes");
  const raw = JSON.stringify(c);
  const back = restoreCache(raw, "pia", 1000 + CHAT_CACHE_TTL_MS - 1)!;
  assert.deepEqual(back.open, [novo, mette]);
  assert.equal(back.active, mette.key);
  assert.deepEqual(back.chat, { history, sig: "sig" });
  assert.equal(back.answers[novo.key]!.question, "q");
  // Udløbet, anden bruger, ødelagt eller forkert version: intet.
  assert.equal(restoreCache(raw, "pia", 1000 + CHAT_CACHE_TTL_MS + 1), null);
  assert.equal(restoreCache(raw, "bo", 2000), null);
  assert.equal(restoreCache("{ikke json", "pia", 2000), null);
  assert.equal(restoreCache(JSON.stringify({ ...c, v: 2 }), "pia", 2000), null);
  assert.equal(restoreCache(null, "pia", 2000), null);
  // Den aktive fane skal findes blandt de åbne; ellers den sidste.
  assert.equal(restoreCache(JSON.stringify({ ...c, active: "væk" }), "pia", 2000)!.active, mette.key);
});

test("chat-cache: fuldt lager afkorter aldrig historikken (signaturen) og springer ellers over; rydning fejler aldrig", () => {
  const writes: string[] = [];
  const full = (limit: number): Pick<Storage, "setItem"> => ({
    setItem: (_k, v) => {
      if (v.length > limit) throw new DOMException("fuld", "QuotaExceededError");
      writes.push(v);
    },
  });
  const withMenu = { question: "q", parts: [{ kind: "text" as const, text: "a" }], pending: false, choice: { id: "toolu_1", question: "Hvad?", options: [], allowFreeText: true } };
  const cache = serializeCache("pia", { chat: { history, sig: "s" }, open: [novo], active: novo.key, answers: { [novo.key]: withMenu } }, 1);
  assert.equal(saveCache(full(1_000_000), cache), "saved");
  // Uden datasæt at droppe er næste trin at glemme hele samtalen: tom historik, ingen signatur, menuen lukket, fanerne bliver.
  const resetSize = JSON.stringify(resetConversation(cache)).length;
  assert.equal(saveCache(full(resetSize), cache), "reset");
  const saved = JSON.parse(writes.at(-1)!) as { chat: { history: unknown[]; sig?: string }; open: unknown[]; answers: Record<string, { choice?: unknown }> };
  assert.deepEqual(saved.chat, { history: [] });
  assert.equal(saved.open.length, 1);
  assert.equal(saved.answers[novo.key]!.choice, undefined);
  // Aldrig en afkortet historik med den gamle signatur: hver gemning har enten hele historikken eller ingen.
  for (const w of writes) {
    const c = JSON.parse(w) as { chat: { history: unknown[]; sig?: string } };
    assert.ok(c.chat.history.length === 0 ? c.chat.sig === undefined : c.chat.history.length === history.length && c.chat.sig === "s");
  }
  assert.equal(saveCache(full(10), cache), "skipped");
  assert.equal(saveCache(undefined, cache), "skipped");
  clearCache({ removeItem: () => { throw new Error("nej"); } });
  clearCache(undefined);
});

test("isUnrecognizedHistory: kun serverens 400 om en samtale, der ikke kan genkendes", () => {
  assert.equal(isUnrecognizedHistory(400, "Samtalen kunne ikke genkendes. Start en ny samtale."), true);
  assert.equal(isUnrecognizedHistory(400, "context er ugyldig"), false);
  assert.equal(isUnrecognizedHistory(429, "Samtalen kunne ikke genkendes"), false);
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

const view = { kind: "view" as const, id: "v", form: "page" as const, spec: { title: "T", components: [] } as unknown as ViewSpec, dataset: { companies: {}, persons: {} } as unknown as Dataset };

test("quota: datasæt fra de mindst nyligt aktive faner droppes ét ad gangen, så springes der over", () => {
  const a: OpenItem = { ...novo, tab: "lasso" };
  const b: OpenItem = { ...lasso, tab: "lasso" };
  const r: OpenItem = { key: "result:1", kind: "result", name: "Søgning", tab: "lasso" };
  const big = "x".repeat(2000);
  const answers = Object.fromEntries([a, b, r].map((o) => [o.key, { question: o.name, parts: [{ kind: "text" as const, text: "t" }, { ...view, dataset: { ...view.dataset, pad: big } as unknown as Dataset }], pending: false }]));
  const cache = serializeCache("pia", { chat: { history: [tr("Q")], sig: "s" }, open: [a, b, r], active: r.key, answers }, 1);
  const size = (c: unknown) => JSON.stringify(c).length;
  assert.deepEqual(recencyOrder([a, b, r], [b.key, a.key], r.key), [b.key, a.key, r.key]);

  // dropTabDatasets: visningerne væk, teksten bliver; en entitetsfane på Lasso-svaret går til Overblik (og henter selv sit modul).
  const dropped = dropTabDatasets(cache, a.key);
  assert.deepEqual(dropped.answers[a.key]!.parts, [{ kind: "text", text: "t" }]);
  assert.equal(dropped.open.find((o) => o.key === a.key)!.tab, "overblik");
  assert.equal(dropped.open.find((o) => o.key === r.key)!.tab, "lasso", "en resultatfane bliver stående");
  assert.equal(dropTabDatasets(dropped, a.key), dropped, "intet at droppe");

  const writes: string[] = [];
  const limited = (limit: number): Pick<Storage, "setItem"> => ({ setItem: (_k, v) => { if (v.length > limit) throw new DOMException("fuld", "QuotaExceededError"); writes.push(v); } });
  const order = [a.key, b.key, r.key];
  // Plads til to ud af tre faners datasæt: kun den ældste fane droppes.
  const withTwo = size(dropTabDatasets(cache, a.key)) + 10;
  assert.equal(saveCache(limited(withTwo), cache, order), "dropped");
  const saved = JSON.parse(writes.at(-1)!) as ChatCacheLike;
  assert.equal(saved.answers[a.key]!.parts.length, 1);
  assert.equal(saved.answers[b.key]!.parts.length, 2);
  assert.equal(saved.answers[r.key]!.parts.length, 2);
  // Kun plads til en: to droppes. Ingen plads: sidste udvej er at springe over.
  const withOne = size(dropTabDatasets(dropTabDatasets(cache, a.key), b.key)) + 10;
  assert.equal(saveCache(limited(withOne), cache, order), "dropped");
  assert.equal((JSON.parse(writes.at(-1)!) as ChatCacheLike).answers[r.key]!.parts.length, 2);
  assert.equal(saveCache(limited(10), cache, order), "skipped");
  // Er der kun plads uden samtalen, glemmes den (tom historik, ingen signatur) efter datasættene.
  const noConversation = size(resetConversation(order.reduce((c, k) => dropTabDatasets(c, k), cache))) + 10;
  assert.equal(saveCache(limited(noConversation), cache, order), "reset");
  assert.deepEqual((JSON.parse(writes.at(-1)!) as { chat: unknown }).chat, { history: [] });
});
type ChatCacheLike = { answers: Record<string, { parts: unknown[] }> };

test("recencyOrder: mindst nyligt aktive først, den aktive sidst, aldrig besøgte forrest", () => {
  const x: OpenItem = { ...novo };
  const y: OpenItem = { ...lasso };
  const z: OpenItem = { ...mette };
  assert.deepEqual(recencyOrder([x, y, z], [y.key, x.key], z.key), [y.key, x.key, z.key]);
  assert.deepEqual(recencyOrder([x, y, z], [x.key], y.key), [z.key, x.key, y.key]);
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
  const answer = applyEvent(newAnswer("q"), { type: "choice", id: panel.id, question: panel.question, options: panel.options, allowFreeText: true });
  assert.equal(skipChoice(answer).choice, undefined);
  assert.equal(skipChoice(answer).parts, answer.parts, "intet andet ændres, intet sendes");
  const none = newAnswer("q");
  assert.equal(skipChoice(none), none);
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
});
