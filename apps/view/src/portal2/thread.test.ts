import assert from "node:assert/strict";
import { test } from "node:test";
import type { Dataset, ViewSpec } from "@lasso/spec";
import type { ChatEvent } from "../chat/stream.js";
import {
  CHAT_CACHE_TTL_MS,
  answerText,
  applyEvent,
  applyTurnEvent,
  clearCache,
  currentTurn,
  dropTabDatasets,
  finishTurn,
  globalTitleFallback,
  isPureText,
  lastView,
  mapViews,
  moveTurn,
  newAnswer,
  pendingChoice,
  recencyOrder,
  replaceLastView,
  resetConversation,
  restoreCache,
  saveCache,
  serializeCache,
  settleTurn,
  skipChoice,
  startTurn,
  undoMove,
  withLastView,
  type Notice,
  type OpenItem,
  type Threads,
  type TurnDone,
} from "./thread.js";

const novo: OpenItem = { key: "CVR-1-24256790", kind: "company", name: "NOVO NORDISK A/S", tab: "overblik" };
const lasso: OpenItem = { key: "CVR-1-34580820", kind: "company", name: "LASSO X A/S", tab: "overblik" };
const mette: OpenItem = { key: "CVR-3-4000123", kind: "person", name: "Mette Holm", tab: "overblik" };
const spec = { version: 2, kind: "company", title: "X", layout: "dashboard", criteria: [], components: [] } as unknown as ViewSpec;
const ds = { companies: {}, persons: {} } as unknown as Dataset;
const view = { kind: "view" as const, id: "v", form: "page" as const, spec, dataset: ds };
const done = (history: unknown[] = [{ role: "user", content: "q" }], extra: Partial<TurnDone> = {}): TurnDone => ({ type: "done", history, sig: "sig", placement: { placement: "current" }, ...extra });

test("applyEvent: tekst og visninger i rækkefølge, placering, menu og fejl; done hører til finishTurn", () => {
  const events: ChatEvent[] = [
    { type: "placement", placement: "entity", target: { kind: "person", id: mette.key, name: mette.name }, focus: "overblik" },
    { type: "text", text: "Jakob " },
    { type: "text", text: "har 4 firmaer." },
    { type: "tool", id: "t1", name: "render_view", title: "Vis oversigt" },
    { type: "view", id: "t1", name: "render_view", tool: "render_view", form: "module", spec, dataset: ds },
    { type: "text", text: "Og her er siden." },
    { type: "view", id: "t2", name: "show_person", tool: "show_person", form: "page", spec, dataset: ds },
  ];
  let a = newAnswer();
  for (const e of events) a = applyEvent(a, e);
  assert.deepEqual(
    a.parts.map((p) => (p.kind === "text" ? `text:${p.text}` : `view:${p.form}`)),
    ["text:Jakob har 4 firmaer.", "view:module", "text:Og her er siden.", "view:page"],
  );
  assert.equal(a.placement?.placement, "entity");
  assert.equal(a.pending, true, "done afslutter");
  assert.equal(applyEvent(a, done()), a);
  assert.equal(lastView(a)?.spec, spec);

  const busy = applyEvent(newAnswer(), { type: "tool", id: "t", name: "show_company", title: "Vis virksomhed" });
  assert.equal(busy.status, "Vis virksomhed …");
  const failed = applyEvent(busy, { type: "error", message: "Nej." });
  assert.equal(failed.status, undefined);
  assert.equal(failed.error, "Nej.");
  const withMenu = applyEvent(newAnswer(), { type: "choice", id: "toolu_1", question: "Hvilken?", options: [{ label: "Alt om Mette", description: "Kort", action: { placement: "current" } }], allowFreeText: false });
  assert.equal(withMenu.choice?.id, "toolu_1");

  const spec2 = { ...spec, title: "Y" } as ViewSpec;
  assert.equal(lastView(withLastView(a, { spec: spec2, dataset: ds }))?.spec.title, "Y");
  assert.equal((withLastView(a, { spec: spec2, dataset: ds }).parts[1] as { spec: ViewSpec }).spec.title, "X", "kun den seneste");
  assert.ok(mapViews(a, (s) => ({ ...s, dataset: { ...s.dataset, savedIds: ["a"] } })).parts.every((p) => p.kind !== "view" || p.dataset.savedIds?.[0] === "a"));
  assert.equal(lastView(newAnswer()), undefined);
});

test("isPureText, answerText og globalTitleFallback", () => {
  const text = applyEvent(applyEvent(newAnswer(), { type: "text", text: "Hej. " }), { type: "tool", id: "t", name: "x", title: "X" });
  assert.equal(isPureText(text), false, "venter stadig");
  const finished = { ...text, pending: false };
  assert.equal(isPureText(finished), true);
  assert.equal(isPureText({ ...finished, parts: [...finished.parts, view] }), false);
  assert.equal(isPureText({ ...finished, error: "Nej" }), false);
  assert.equal(isPureText({ pending: false, parts: [] }), false);
  assert.equal(answerText({ pending: false, parts: [{ kind: "text", text: "A " }, view, { kind: "text", text: " B" }] }), "A\n\nB");
  assert.equal(globalTitleFallback("search_companies", spec), "Firmaliste");
  assert.equal(globalTitleFallback("list_saved_pages", spec), "Firmaliste");
  assert.equal(globalTitleFallback("compare_companies", spec), "Sammenligning");
  assert.equal(globalTitleFallback("render_view", { ...spec, components: [{ type: "LassoMap" }] } as unknown as ViewSpec), "Kort");
  assert.equal(globalTitleFallback("render_view", spec), "Markedsanalyse");
});

test("startTurn, applyTurnEvent, finishTurn: turen i fanen, historikken og fingeraftrykket gemmes pr. fane", () => {
  let t: Threads = {};
  t = startTurn(t, novo.key, "Hvem ejer den?", 1000, "t1");
  assert.deepEqual(t[novo.key]!.chat, { history: [] });
  assert.equal(t[novo.key]!.turns[0]!.answer.pending, true);
  t = applyTurnEvent(t, novo.key, "t1", { type: "text", text: "Holm." });
  t = applyTurnEvent(t, novo.key, "andet", { type: "text", text: "ignoreres" });
  t = applyTurnEvent(t, "ukendt", "t1", { type: "text", text: "ignoreres" });
  assert.deepEqual(currentTurn(t, novo.key)!.answer.parts, [{ kind: "text", text: "Holm." }]);
  t = finishTurn(t, novo.key, { ...done([{ role: "user", content: "a" }]), sent: "fp", at: 2000 });
  const tab = t[novo.key]!;
  assert.deepEqual(tab.chat, { history: [{ role: "user", content: "a" }], sig: "sig" });
  assert.equal(tab.sent, "fp");
  assert.equal(tab.turns[0]!.answer.pending, false);
  assert.equal(tab.turns[0]!.answer.at, 2000);
  assert.deepEqual(tab.turns[0]!.answer.placement, { placement: "current" });
  // Uden sent beholdes det gamle; et nyt spørgsmål lukker åbne menuer i alle faner.
  t = startTurn(t, novo.key, "Og så?", 3000, "t2");
  t = finishTurn(t, novo.key, done());
  assert.equal(t[novo.key]!.sent, "fp");
  assert.equal(t[novo.key]!.turns.length, 2);
  t = applyTurnEvent(startTurn(t, lasso.key, "?", 4000, "t3"), lasso.key, "t3", { type: "choice", id: "c", question: "Hvem?", options: [], allowFreeText: true });
  assert.equal(pendingChoice(t, lasso.key)?.id, "c");
  t = startTurn(t, novo.key, "Nyt", 5000, "t4");
  assert.equal(pendingChoice(t, lasso.key), undefined);
  // settleTurn: afbrudt eller fejlet tur er ikke længere ventende.
  t = settleTurn(applyTurnEvent(t, novo.key, "t4", { type: "tool", id: "x", name: "y", title: "Vis" }), novo.key, "t4");
  assert.equal(currentTurn(t, novo.key)!.answer.pending, false);
  assert.equal(currentTurn(t, novo.key)!.answer.status, undefined);
});

test("skipChoice og pendingChoice: menuen i den seneste tur lukkes uden at røre andet", () => {
  let t = startTurn({}, novo.key, "q", 1, "t1");
  t = applyTurnEvent(t, novo.key, "t1", { type: "choice", id: "c", question: "Hvem?", options: [], allowFreeText: true });
  assert.equal(pendingChoice(t, novo.key)?.question, "Hvem?");
  const skipped = skipChoice(t, novo.key);
  assert.equal(pendingChoice(skipped, novo.key), undefined);
  assert.equal(skipped[novo.key]!.turns[0]!.answer.parts, t[novo.key]!.turns[0]!.answer.parts);
  assert.equal(skipChoice(skipped, novo.key), skipped);
  assert.equal(skipChoice(t, "ukendt"), t);
});

const moved = (tabKey: string, createdTab: boolean): Notice => ({ kind: "moved", name: "Mette Holm", tabKey, undoUntil: 5000, createdTab });

test("moveTurn: turen flytter med svaret; fanen, man spurgte fra, beholder spørgsmålet og notitsen uden svar", () => {
  let t = startTurn({}, novo.key, "Tidligere", 1, "t0");
  t = finishTurn(t, novo.key, done());
  t = startTurn(t, novo.key, "Vis alt om Mette", 2, "t1");
  t = applyTurnEvent(t, novo.key, "t1", { type: "text", text: "Her." });
  t = moveTurn(t, novo.key, mette.key, "t1", moved(mette.key, true));
  // Kilden: stub med notits, uden svar; den forrige tur er urørt, og aktuelle tur er den forrige.
  const stub = t[novo.key]!.turns[1]!;
  assert.equal(stub.question, "Vis alt om Mette");
  assert.equal(stub.notice?.kind, "moved");
  assert.deepEqual(stub.answer.parts, []);
  assert.equal(currentTurn(t, novo.key)!.id, "t0");
  // Målet: turen med svaret, uden notits; hændelser går nu dertil, og målfanen fik en tom historik.
  assert.equal(t[mette.key]!.turns[0]!.notice, undefined);
  assert.deepEqual(t[mette.key]!.turns[0]!.answer.parts, [{ kind: "text", text: "Her." }]);
  t = applyTurnEvent(t, mette.key, "t1", { type: "text", text: " Mere." });
  assert.equal((t[mette.key]!.turns[0]!.answer.parts[0] as { text: string }).text, "Her. Mere.");
  t = finishTurn(t, mette.key, done([{ role: "user", content: "fresh" }], { fresh: true }));
  assert.deepEqual(t[mette.key]!.chat.history, [{ role: "user", content: "fresh" }]);
  assert.deepEqual(t[novo.key]!.chat.history, [{ role: "user", content: "q" }], "kildens samtale er uændret");
  // Ukendt tur eller samme fane: intet.
  assert.equal(moveTurn(t, novo.key, mette.key, "findes-ikke", moved(mette.key, false)), t);
  assert.equal(moveTurn(t, novo.key, novo.key, "t1", moved(novo.key, false)), t);
});

test("undoMove: turen fjernes fra begge faner; en fane åbnet til turen lukkes (closeKey), en eksisterende bliver", () => {
  let t = startTurn({}, novo.key, "Vis alt om Mette", 2, "t1");
  t = moveTurn(t, novo.key, mette.key, "t1", moved(mette.key, true));
  const created = undoMove(t, novo.key, "t1");
  assert.equal(created.closeKey, mette.key);
  assert.equal(created.threads[mette.key], undefined);
  assert.deepEqual(created.threads[novo.key]!.turns, []);

  // Målfanen fandtes og havde en tur i forvejen: kun denne tur forsvinder.
  let u = startTurn({}, mette.key, "Før", 1, "t0");
  u = finishTurn(u, mette.key, done());
  u = startTurn(u, novo.key, "Vis alt om Mette", 2, "t1");
  u = moveTurn(u, novo.key, mette.key, "t1", moved(mette.key, false));
  const kept = undoMove(u, novo.key, "t1");
  assert.equal(kept.closeKey, undefined);
  assert.deepEqual(kept.threads[mette.key]!.turns.map((x) => x.id), ["t0"]);
  assert.deepEqual(kept.threads[novo.key]!.turns, []);
  // En tur uden flytnings-notits kan ikke fortrydes.
  assert.equal(undoMove(kept.threads, mette.key, "t0").threads, kept.threads);
});

test("undoMove efter done: en eksisterende målfane får sin samtale fra før tilbage; en oprettet lukkes", () => {
  // Eksisterende fane med egen samtale.
  let u = startTurn({}, mette.key, "Før", 1, "t0");
  u = finishTurn(u, mette.key, done([{ role: "user", content: "mettes" }], { sent: "fp-mette" }));
  u = startTurn(u, novo.key, "Vis alt om Mette", 2, "t1");
  u = moveTurn(u, novo.key, mette.key, "t1", moved(mette.key, false));
  u = finishTurn(u, mette.key, done([{ role: "user", content: "fresh" }], { fresh: true, sent: null }));
  assert.deepEqual(u[mette.key]!.chat.history, [{ role: "user", content: "fresh" }], "flytningen nulstiller målfanens hukommelse");
  const back = undoMove(u, novo.key, "t1");
  assert.equal(back.closeKey, undefined);
  assert.deepEqual(back.threads[mette.key]!.chat.history, [{ role: "user", content: "mettes" }]);
  assert.equal(back.threads[mette.key]!.sent, "fp-mette");
  assert.deepEqual(back.threads[mette.key]!.turns.map((x) => x.id), ["t0"]);
  // Samtalen fra før gemmes ikke (Fortryd virker ikke efter en genindlæsning).
  const saved = serializeCache("u", { open: [{ key: novo.key, kind: "company", name: "N", tab: "lasso" }], active: novo.key, threads: u }, 10);
  const n = saved.tabs[novo.key]!.turns[0]!.notice;
  assert.equal(n?.kind === "moved" && "prev" in n, false);

  // Oprettet fane: færdig, så Fortryd: fanen lukkes, og dens tråd er væk.
  let t = startTurn({}, novo.key, "Vis alt om Mette", 2, "t1");
  t = moveTurn(t, novo.key, mette.key, "t1", moved(mette.key, true));
  t = finishTurn(t, mette.key, done([{ role: "user", content: "fresh" }], { fresh: true }));
  const created = undoMove(t, novo.key, "t1");
  assert.equal(created.closeKey, mette.key);
  assert.equal(created.threads[mette.key], undefined);
  assert.deepEqual(created.threads[novo.key]!.turns, []);
});

test("replaceLastView: visningen i fanens aktuelle tur erstattes, ikke en flyttet turs stub", () => {
  let t = startTurn({}, novo.key, "q", 1, "t1");
  t = applyTurnEvent(t, novo.key, "t1", { type: "view", id: "v", name: "show_company", tool: "show_company", form: "page", spec, dataset: ds });
  const spec2 = { ...spec, title: "Y" } as ViewSpec;
  assert.equal(currentTurn(replaceLastView(t, novo.key, { spec: spec2, dataset: ds }), novo.key)!.answer.parts.length, 1);
  assert.equal(lastView(currentTurn(replaceLastView(t, novo.key, { spec: spec2, dataset: ds }), novo.key)!.answer)!.spec.title, "Y");
  assert.equal(replaceLastView(t, "ukendt", { spec: spec2, dataset: ds }), t);
});

/* ---------- cache ---------- */

const history = [{ role: "user", content: "Spørgsmål 1" }, { role: "assistant", content: [{ type: "text", text: "Svar 1" }] }];

function sample(): { threads: Threads; open: OpenItem[] } {
  let t = startTurn({}, novo.key, "q", 1000, "t1");
  t = applyTurnEvent(t, novo.key, "t1", { type: "text", text: "a" });
  t = applyTurnEvent(t, novo.key, "t1", { type: "tool", id: "x", name: "y", title: "Henter" });
  t = finishTurn(t, novo.key, { ...done(history), sent: "fp", at: 1500 });
  t = startTurn(t, mette.key, "afbrudt", 1600, "t2");
  t = startTurn(t, "result:9", "lukket fane", 1700, "t3");
  return { threads: t, open: [novo, mette] };
}

test("cache v2: gemmes og læses for samme bruger inden udløb; ventende ture og lukkede faner udelades; Fortryd udløber", () => {
  const { threads, open } = sample();
  const withNotice = moveTurn(startTurn(threads, novo.key, "Vis alt om Mette", 1800, "t5"), novo.key, mette.key, "t5", moved(mette.key, false));
  const c = serializeCache("pia", { open, active: mette.key, threads: withNotice }, 1000);
  assert.equal(c.v, 2);
  assert.deepEqual(Object.keys(c.tabs).sort(), [mette.key, novo.key].sort());
  assert.equal(c.tabs[mette.key]!.turns.length, 0, "ventende ture (afbrudt, flyttet og ikke færdig) gemmes ikke");
  assert.equal(c.tabs[novo.key]!.turns[0]!.answer.status, undefined);
  const back = restoreCache(JSON.stringify(c), "pia", 1000 + CHAT_CACHE_TTL_MS - 1)!;
  assert.deepEqual(back.open, open);
  assert.equal(back.active, mette.key);
  assert.deepEqual(back.threads[novo.key]!.chat, { history, sig: "sig" });
  assert.equal(back.threads[novo.key]!.sent, "fp");
  const stub = back.threads[novo.key]!.turns.find((x) => x.id === "t5")!;
  assert.equal(stub.notice?.kind === "moved" && stub.notice.undoUntil, 0, "undoUntil gendannes ikke");
  assert.ok(back.threads[novo.key]!.turns.every((x) => !x.answer.pending));
  // Udløbet, anden bruger, ødelagt eller ukendt version: intet.
  const raw = JSON.stringify(c);
  assert.equal(restoreCache(raw, "pia", 1000 + CHAT_CACHE_TTL_MS + 1), null);
  assert.equal(restoreCache(raw, "bo", 2000), null);
  assert.equal(restoreCache("{ikke json", "pia", 2000), null);
  assert.equal(restoreCache(JSON.stringify({ ...c, v: 3 }), "pia", 2000), null);
  assert.equal(restoreCache(null, "pia", 2000), null);
  assert.equal(restoreCache(raw, "pia", 500), null, "gemt i fremtiden");
  assert.equal(restoreCache(JSON.stringify({ ...c, active: "væk" }), "pia", 2000)!.active, mette.key, "den sidste, når den aktive ikke findes");
  // Ødelagte faner springes over.
  const broken = { ...c, tabs: { ...c.tabs, [lasso.key]: { chat: "nej" }, [mette.key]: { chat: { history: [] }, turns: [{ id: 1 }], sent: null } } };
  const r = restoreCache(JSON.stringify(broken), "pia", 2000)!;
  assert.equal(r.threads[lasso.key], undefined);
  assert.deepEqual(r.threads[mette.key]!.turns, []);
});

test("cache: v1 migreres (svar pr. fane bliver en tur, samtalen følger den aktive fane)", () => {
  const v1 = {
    v: 1,
    user: "pia",
    savedAt: 1000,
    chat: { history, sig: "gammel" },
    open: [novo, mette],
    active: mette.key,
    answers: {
      [novo.key]: { question: "Hvem ejer den?", parts: [{ kind: "text", text: "Holm." }], pending: false, choice: { id: "c", question: "?", options: [], allowFreeText: true } },
      [mette.key]: { question: "Hvad laver hun?", parts: [{ kind: "text", text: "Direktør." }], pending: true },
      "result:9": { question: "lukket", parts: [], pending: false },
    },
  };
  const r = restoreCache(JSON.stringify(v1), "pia", 2000)!;
  assert.deepEqual(r.open, [novo, mette]);
  assert.equal(r.active, mette.key);
  assert.equal(r.threads["result:9"], undefined, "lukkede faner migreres ikke");
  const n = r.threads[novo.key]!;
  assert.equal(n.turns.length, 1);
  assert.equal(n.turns[0]!.question, "Hvem ejer den?");
  assert.deepEqual(n.turns[0]!.answer.parts, [{ kind: "text", text: "Holm." }]);
  assert.equal(n.turns[0]!.askedAt, 1000);
  assert.equal(pendingChoice(r.threads, novo.key)?.id, "c", "en åben menu bevares");
  assert.deepEqual(n.chat, { history: [] }, "samtalen ligger på den aktive fane");
  assert.equal(r.threads[mette.key]!.turns[0]!.answer.pending, false);
  assert.deepEqual(r.threads[mette.key]!.chat, { history, sig: "gammel" });
  // Udløbet og forkert bruger gælder også v1; en v1 uden samtale er ødelagt.
  assert.equal(restoreCache(JSON.stringify(v1), "pia", 1000 + CHAT_CACHE_TTL_MS + 1), null);
  assert.equal(restoreCache(JSON.stringify(v1), "bo", 2000), null);
  assert.equal(restoreCache(JSON.stringify({ ...v1, chat: undefined }), "pia", 2000), null);
  // Migreret og gemt igen er det en gyldig v2.
  const again = serializeCache("pia", { open: r.open, active: r.active, threads: r.threads }, 3000);
  assert.deepEqual(restoreCache(JSON.stringify(again), "pia", 3500)!.threads[mette.key]!.chat, { history, sig: "gammel" });
});

test("cache: fuldt lager afkorter aldrig historikken (signaturen) og springer ellers over; rydning fejler aldrig", () => {
  const writes: string[] = [];
  const full = (limit: number): Pick<Storage, "setItem"> => ({
    setItem: (_k, v) => {
      if (v.length > limit) throw new DOMException("fuld", "QuotaExceededError");
      writes.push(v);
    },
  });
  let t = startTurn({}, novo.key, "q", 1, "t1");
  t = applyTurnEvent(t, novo.key, "t1", { type: "choice", id: "toolu_1", question: "Hvad?", options: [], allowFreeText: true });
  t = finishTurn(t, novo.key, { ...done(history), sent: "fp" });
  const cache = serializeCache("pia", { open: [novo], active: novo.key, threads: t }, 1);
  assert.equal(saveCache(full(1_000_000), cache), "saved");
  const resetSize = JSON.stringify(resetConversation(cache)).length;
  assert.equal(saveCache(full(resetSize), cache), "reset");
  const saved = JSON.parse(writes.at(-1)!) as { tabs: Record<string, { chat: { history: unknown[]; sig?: string }; sent: unknown; turns: { answer: { choice?: unknown } }[] }>; open: unknown[] };
  assert.deepEqual(saved.tabs[novo.key]!.chat, { history: [] });
  assert.equal(saved.tabs[novo.key]!.sent, null);
  assert.equal(saved.tabs[novo.key]!.turns[0]!.answer.choice, undefined);
  assert.equal(saved.open.length, 1);
  for (const w of writes) {
    const c = JSON.parse(w) as { tabs: Record<string, { chat: { history: unknown[]; sig?: string } }> };
    for (const tab of Object.values(c.tabs)) assert.ok(tab.chat.history.length === 0 ? tab.chat.sig === undefined : tab.chat.history.length === history.length && tab.chat.sig === "sig");
  }
  assert.equal(saveCache(full(10), cache), "skipped");
  assert.equal(saveCache(undefined, cache), "skipped");
  clearCache({ removeItem: () => { throw new Error("nej"); } });
  clearCache(undefined);
});

test("quota: datasæt fra de mindst nyligt aktive faner droppes ét ad gangen, så glemmes samtalen, så springes der over", () => {
  const a: OpenItem = { ...novo, tab: "lasso" };
  const b: OpenItem = { ...lasso, tab: "lasso" };
  const r: OpenItem = { key: "result:1", kind: "result", name: "Søgning", tab: "lasso" };
  const big = "x".repeat(2000);
  let t: Threads = {};
  for (const o of [a, b, r]) {
    t = startTurn(t, o.key, o.name, 1, `t-${o.key}`);
    t = applyTurnEvent(t, o.key, `t-${o.key}`, { type: "text", text: "t" });
    t = applyTurnEvent(t, o.key, `t-${o.key}`, { type: "view", id: "v", name: "show_company", tool: "show_company", form: "page", spec, dataset: { ...ds, pad: big } as unknown as Dataset });
    t = finishTurn(t, o.key, done([{ role: "user", content: "Q" }]));
  }
  const cache = serializeCache("pia", { open: [a, b, r], active: r.key, threads: t }, 1);
  const size = (c: unknown) => JSON.stringify(c).length;
  assert.deepEqual(recencyOrder([a, b, r], [b.key, a.key], r.key), [b.key, a.key, r.key]);

  const dropped = dropTabDatasets(cache, a.key);
  assert.deepEqual(dropped.tabs[a.key]!.turns[0]!.answer.parts, [{ kind: "text", text: "t" }]);
  assert.equal(dropped.open.find((o) => o.key === a.key)!.tab, "overblik");
  assert.equal(dropped.open.find((o) => o.key === r.key)!.tab, "lasso", "en resultatfane bliver stående");
  assert.equal(dropTabDatasets(dropped, a.key), dropped, "intet at droppe");

  const writes: string[] = [];
  const limited = (limit: number): Pick<Storage, "setItem"> => ({ setItem: (_k, v) => { if (v.length > limit) throw new DOMException("fuld", "QuotaExceededError"); writes.push(v); } });
  const order = [a.key, b.key, r.key];
  const parts = (key: string) => (JSON.parse(writes.at(-1)!) as { tabs: Record<string, { turns: { answer: { parts: unknown[] } }[] }> }).tabs[key]!.turns[0]!.answer.parts.length;
  assert.equal(saveCache(limited(size(dropTabDatasets(cache, a.key)) + 10), cache, order), "dropped");
  assert.equal(parts(a.key), 1);
  assert.equal(parts(b.key), 2);
  assert.equal(parts(r.key), 2);
  assert.equal(saveCache(limited(size(dropTabDatasets(dropTabDatasets(cache, a.key), b.key)) + 10), cache, order), "dropped");
  assert.equal(parts(r.key), 2);
  assert.equal(saveCache(limited(10), cache, order), "skipped");
  const noConversation = size(resetConversation(order.reduce((c, k) => dropTabDatasets(c, k), cache))) + 10;
  assert.equal(saveCache(limited(noConversation), cache, order), "reset");
});

test("recencyOrder: mindst nyligt aktive først, den aktive sidst, aldrig besøgte forrest", () => {
  assert.deepEqual(recencyOrder([novo, lasso, mette], [lasso.key, novo.key], mette.key), [lasso.key, novo.key, mette.key]);
  assert.deepEqual(recencyOrder([novo, lasso, mette], [novo.key], lasso.key), [mette.key, novo.key, lasso.key]);
});
