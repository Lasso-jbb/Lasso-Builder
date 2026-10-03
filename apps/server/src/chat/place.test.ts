import assert from "node:assert/strict";
import { test } from "node:test";
import { loadConfig } from "../config.js";
import { DemoProvider } from "../data/demo.js";
import type { ChatContext, PlaceAnswerInput } from "./context.js";
import { EXPLICIT_OPEN, verifyPlacement, type PlaceCtx, type TurnState } from "./place.js";

const mcp = { provider: new DemoProvider(), config: loadConfig({ LASSO_DATA_SOURCE: "demo" }) } as never;
const gitte = { kind: "person" as const, id: "CVR-3-4000000007", name: "Gitte Prøve" };
const byg = { kind: "company" as const, id: "CVR-1-99000001", name: "Eksempel Byg A/S" };

const home: ChatContext = { active: { kind: "global" }, open: [] };
const onByg: ChatContext = { active: { ...byg, tab: "overblik" }, open: [byg] };
const turn = (extra: Partial<TurnState> = {}): TurnState => ({ placement: { placement: "current" }, placed: false, viewed: false, ...extra });
const ctx = (context: ChatContext, message: string, t = turn()): PlaceCtx => ({ mcp, context, message, turn: t });
const entity = (e: { kind: "person" | "company"; id: string }, query: string, extra: Partial<PlaceAnswerInput> = {}): PlaceAnswerInput => ({ placement: "entity", entity: { ...e, query }, ...extra });
const error = (r: Awaited<ReturnType<typeof verifyPlacement>>): string => ("error" in r ? r.error : "");

test("EXPLICIT_OPEN: kun 'vis/se (mig) alt/det hele' og 'åbn'", () => {
  for (const ok of ["vis alt om Gitte", "Vis mig alt om Gitte", "se det hele om Gitte", "Åbn Gitte Prøve"]) assert.match(ok, EXPLICIT_OPEN, ok);
  for (const no of ["Hvad laver Gitte ellers?", "vis Gitte", "vis kun de største", "se på tallene", "Er alt i orden?"]) assert.doesNotMatch(no, EXPLICIT_OPEN, no);
});

test("current: på en fane er det 'her' (decided, here); på forsiden en resultatfane; på et resultat bliver man", async () => {
  assert.deepEqual(await verifyPlacement({ placement: "current" }, ctx(onByg, "Hvad laver Gitte ellers?")), { placement: { placement: "current", decided: true, here: true } });
  assert.deepEqual(await verifyPlacement({ placement: "current" }, ctx(home, "Hej")), { placement: { placement: "global", decided: true } });
  assert.deepEqual(await verifyPlacement({ placement: "current" }, ctx({ active: { kind: "global", title: "Firmaliste" }, open: [] }, "Hej")), { placement: { placement: "current", decided: true } });
});

test("højst ét place_answer pr. tur, og aldrig efter en visning", async () => {
  assert.match(error(await verifyPlacement({ placement: "current" }, ctx(onByg, "Hej", turn({ placed: true })))), /Højst én fane pr\. spørgsmål/);
  assert.match(error(await verifyPlacement({ placement: "current" }, ctx(onByg, "Hej", turn({ viewed: true })))), /Vælg placeringen, før noget vises/i);
});

test("et valg i menuen er bindende; fritekst er ikke", async () => {
  const picked: ChatContext = { ...home, choice: { id: "toolu_1", index: 0, action: { placement: "current" } } };
  assert.match(error(await verifyPlacement({ placement: "current" }, ctx(picked, "Hej"))), /bindende/);
  const free: ChatContext = { ...home, choice: { id: "toolu_1", free: true } };
  assert.ok("placement" in (await verifyPlacement({ placement: "current" }, ctx(free, "Hej"))));
});

test("entity: kræver en udtrykkelig bøn i beskeden", async () => {
  const r = await verifyPlacement(entity(gitte, "Gitte Prøve"), ctx(onByg, "Hvad laver Gitte Prøve ellers?"));
  assert.match(error(r), /udtrykkeligt/);
  const ok = await verifyPlacement(entity(gitte, "Gitte Prøve", { focus: "ejerskab" }), ctx(onByg, "Vis alt om Gitte Prøve"));
  assert.deepEqual(ok, { placement: { placement: "entity", target: gitte, focus: "ejerskab", decided: true } });
});

test("entity: ikke den aktive fane; en åben fane kræver ingen søgning; et ukendt modul udelades", async () => {
  assert.match(error(await verifyPlacement(entity(byg, "Eksempel Byg"), ctx(onByg, "åbn Eksempel Byg"))), /aktive fane/);
  const withGitte: ChatContext = { active: onByg.active, open: [byg, gitte] };
  // Navnet i query er ligegyldigt, når id'et står i de åbne faner (navnet kommer fra fanen).
  const open = await verifyPlacement(entity(gitte, "noget helt andet", { focus: "findes-ikke" }), ctx(withGitte, "åbn Gitte"));
  assert.deepEqual(open, { placement: { placement: "entity", target: gitte, decided: true } });
});

test("entity: id'et skal være det eneste kandidat for navnet; flere eller et andet id afvises", async () => {
  // Flere personer med efternavnet Prøve.
  assert.match(error(await verifyPlacement(entity(gitte, "Prøve"), ctx(onByg, "vis alt om Prøve"))), /flere; kald ask_choice/);
  // Ét kandidat, men et andet id end det, modellen gav.
  assert.match(error(await verifyPlacement(entity({ kind: "person", id: "CVR-3-4000000099" }, "Gitte Prøve"), ctx(onByg, "vis alt om Gitte Prøve"))), /flere; kald ask_choice/);
  // Intet kandidat.
  assert.match(error(await verifyPlacement(entity(gitte, "Findes Ikke Overhovedet"), ctx(onByg, "åbn Findes Ikke Overhovedet"))), /ingen/);
  // Virksomhed fra forsiden: præcis ét kandidat på CVR-nummeret.
  const company = await verifyPlacement(entity({ kind: "company", id: "CVR-1-99000002" }, "99000002"), ctx(home, "åbn 99000002"));
  assert.deepEqual(company, { placement: { placement: "entity", target: { kind: "company", id: "CVR-1-99000002", name: "Eksempel Revision Midt ApS" }, decided: true } });
});

test("global: kræver title; forsiden og en fane giver global, et resultat med navn bliver", async () => {
  assert.match(error(await verifyPlacement({ placement: "global" }, ctx(home, "Største revisorer"))), /title kræves/);
  assert.deepEqual(await verifyPlacement({ placement: "global", title: "Firmaliste" }, ctx(home, "Største revisorer")), { placement: { placement: "global", title: "Firmaliste", decided: true } });
  assert.deepEqual(await verifyPlacement({ placement: "global", title: "Sammenligning" }, ctx(onByg, "Sammenlign med branchen")), { placement: { placement: "global", title: "Sammenligning", decided: true } });
  assert.deepEqual(await verifyPlacement({ placement: "global", title: "Kort" }, ctx({ active: { kind: "global", title: "Firmaliste" }, open: [] }, "Vis dem på kort")), { placement: { placement: "current", decided: true } });
});
