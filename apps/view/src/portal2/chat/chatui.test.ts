import assert from "node:assert/strict";
import { test } from "node:test";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Testene kører fra apps/view, hvis tsconfig ikke omfatter packages/ui: tsx oversætter dér JSX klassisk (React.createElement).
(globalThis as { React?: typeof React }).React = React;
import { parseBlocks, parseInline } from "../../chat/markdown.js";
import { ChoicePanel } from "../ChoicePanel.js";
import { AskField, RemoveTemplateDialog, TemplatePin } from "../parts.js";
import { EmptyState, emptyPills } from "./EmptyState.js";
import * as fx from "./fixtures.js";
import { AssistantMessage, NoticeRow } from "./Message.js";
import { Thread } from "./Thread.js";
import { anchorScrollTop, canAddAsTab, hhmm, moduleIcon, moreBelow, singleEntity, templateTitle } from "./util.js";

const html = (el: ReturnType<typeof createElement>) => renderToStaticMarkup(el);

test("markdown: lasso:-links bliver modul-links, ugyldige mål almindelig tekst, et afsnit af links en linkrække", () => {
  assert.deepEqual(parseInline("Se [Risiko](lasso:modul/risiko)."), [
    { kind: "text", text: "Se " },
    { kind: "module", text: "Risiko", target: { kind: "modul", focus: "risiko" } },
    { kind: "text", text: "." },
  ]);
  assert.deepEqual(parseInline("[Novo](lasso:firma/CVR-1-24256790)")[0], { kind: "module", text: "Novo", target: { kind: "firma", id: "CVR-1-24256790" } });
  assert.deepEqual(parseInline("[Jakob](lasso:person/CVR-3-4000000001)")[0], { kind: "module", text: "Jakob", target: { kind: "person", id: "CVR-3-4000000001" } });
  // Ukendt fokus og forkert id-form: teksten står, linket forsvinder.
  assert.ok(parseInline("[Kreditorer](lasso:modul/kreditorer) og [X](lasso:firma/123)").every((p) => p.kind === "text"));
  const blocks = parseBlocks("Tekst først.\n\n[Risiko](lasso:modul/risiko) [Ejerskab](lasso:modul/ejerskab)");
  assert.equal(blocks[0]!.kind, "p");
  assert.equal(blocks[1]!.kind, "links");
  assert.equal(blocks[1]!.kind === "links" && blocks[1].items.length, 2);
  // Almindelige links og fed virker som før.
  assert.deepEqual(parseInline("**fed** [a](https://x.dk)"), [
    { kind: "bold", text: "fed" },
    { kind: "text", text: " " },
    { kind: "link", text: "a", href: "https://x.dk" },
  ]);
});

test("util: hhmm, modul-ikoner og sidens ene entitet", () => {
  assert.equal(hhmm(new Date(2026, 0, 1, 9, 41).getTime()), "09:41");
  assert.equal(moduleIcon({ kind: "modul", focus: "risiko" }), "flag");
  assert.equal(moduleIcon({ kind: "modul", focus: "netvaerk" }), "network");
  assert.equal(moduleIcon({ kind: "firma", id: "CVR-1-1" }), "build");
  assert.deepEqual(singleEntity(fx.SPEC_KYC), { kind: "company", id: fx.FIXTURE_COMPANY });
  assert.equal(singleEntity(fx.SPEC_WINDOWS), null);
});

test("Tråden: role=log, skærmlæsertekster, boble og svar; ingen midterprik nogen steder (D2)", () => {
  const out = html(createElement(Thread, { turns: fx.ANATOMY }));
  assert.match(out, /role="log"/);
  assert.match(out, /aria-live="polite"/);
  assert.match(out, /class="chat-sr">Du: </);
  assert.match(out, /class="chat-sr">Lasso: </);
  assert.match(out, /chat-bubble/);
  assert.match(out, /<span>Lasso<\/span> <span>09:41<\/span>/);
  // Punkterne som rækker med prik, modul-links som række nederst.
  assert.equal((out.match(/class="chat-brow"/g) ?? []).length, 3);
  assert.equal((out.match(/class="chat-link"/g) ?? []).length, 2);
  // Kopiér kun under rene tekstsvar: de to første svar, ikke det med modul-links.
  assert.equal((out.match(/aria-label="Kopiér svaret"/g) ?? []).length, 2);
  for (const turns of Object.values(fx.SCENES)) assert.doesNotMatch(html(createElement(Thread, { turns, now: fx.FIXTURE_AT })), /·/);
});

test("Meddelelsesrækken: her, ny fane med Fortryd i 10 sekunder, derefter uden link", () => {
  // Jakob 03.10: ingen "Svarer her"-række; situation 1 (bliv i fanen) har ingen meddelelsesrække.
  const stay = html(createElement(Thread, { turns: fx.STAY, now: fx.FIXTURE_AT }));
  assert.doesNotMatch(stay, /chat-notice|Svarer her/);
  assert.match(stay, /Ud over LASSO X A\/S/);
  const notice = fx.NEW_TAB_BEFORE[1]!.notice!;
  const live = html(createElement(NoticeRow, { notice, now: fx.FIXTURE_AT, onUndo: () => undefined }));
  assert.match(live, /Åbner Jakob Bech Benediktson i en ny fane\./);
  assert.match(live, />Fortryd</);
  const after = html(createElement(NoticeRow, { notice, now: fx.FIXTURE_AT + 11_000, onUndo: () => undefined }));
  assert.doesNotMatch(after, /Fortryd/);
  // Den flyttede tur har intet svar i den gamle samtale.
  assert.doesNotMatch(html(createElement(Thread, { turns: fx.NEW_TAB_BEFORE.slice(1), now: fx.FIXTURE_AT })), /chat-msg--ai/);
});

test("Svar: tænker (kun prikker), længere opgave med skelet og uden Stop, fejl med Prøv igen, modul-link til en anden fane med note", () => {
  const thinking = html(createElement(AssistantMessage, { answer: fx.THINKING[0]!.answer }));
  // Jakob 03.10: kun de tre prikker; "Lasso tænker" kun for skærmlæsere.
  assert.match(thinking, /role="status"[^>]*><span class="chat-dots"[^]*<span class="chat-sr">Lasso tænker<\/span>/);
  assert.doesNotMatch(thinking, /Tænker…/);
  const long = html(createElement(AssistantMessage, { answer: fx.LONG_TASK[0]!.answer }));
  assert.match(long, /Læser regnskab 2024 og ejerregistret…/);
  assert.doesNotMatch(long, />Stop</);
  assert.match(long, /chat-card--sk/);
  // C2: fejlen fra en ugyldig historik har "Prøv igen" (spørger igen i en ny samtale).
  const invalid = html(createElement(AssistantMessage, { answer: { parts: [], pending: false, error: "Samtalen kunne ikke fortsættes. Prøv igen." }, onRetry: () => undefined }));
  assert.match(invalid, /Samtalen kunne ikke fortsættes/);
  assert.match(invalid, />Prøv igen<\/button>/);
  const err = html(createElement(AssistantMessage, { answer: fx.ERROR[1]!.answer, onRetry: () => undefined, currentId: fx.FIXTURE_COMPANY }));
  assert.match(err, /Jeg kunne ikke hente tallene for Novo Nordisk A\/S lige nu\. <button[^>]*class="chat-tlink"[^>]*>Prøv igen</);
  assert.match(err, /Åbner Novo Nordisk A\/S i ny fane/);
});

test("Kort: element med Hent som PDF og fuld skærm; side med Tilføj som fane (modul-link-pillen; mobil neutral ikonknap)", () => {
  const props = { onDownload: () => undefined, onFullscreen: () => undefined, onAddTab: () => undefined };
  const el = html(createElement(AssistantMessage, { answer: fx.FORM_ELEMENT[0]!.answer, cardProps: () => props }));
  assert.match(el, /aria-label="Hent som PDF"/);
  assert.match(el, /aria-label="Vis i fuld skærm"/);
  assert.doesNotMatch(el, /Tilføj som fane/);
  assert.match(el, /Jakob Bech Benediktson, 4 selskaber/);
  const page = html(createElement(AssistantMessage, { answer: fx.FORM_PAGE[0]!.answer, cardProps: () => props }));
  // Jakob 03.10: som modul-linket ("Risiko"), ikke den fyldte primære knap.
  assert.match(page, /<button type="button" class="chat-link chat-card__add"><svg[^>]*>.*?<\/svg>Tilføj som fane<\/button>/);
  assert.doesNotMatch(page, /lasso-btn--primary|lasso-iconbtn--primary/);
  const mobile = html(createElement(AssistantMessage, { answer: fx.FORM_PAGE[0]!.answer, mobile: true, cardProps: () => props }));
  assert.match(mobile, /class="lasso-iconbtn[^"]*chat-card__addm" aria-label="Tilføj som fane"/);
  assert.doesNotMatch(mobile, /primary/);
  assert.doesNotMatch(mobile, /Hent som PDF/);
});

test("Tilføj som fane: hvert sidekort om fanens egen entitet; aldrig et enkelt element, en anden entitet eller en global fane", () => {
  const page = fx.FORM_PAGE[0]!.answer.parts[1] as Extract<(typeof fx.FORM_PAGE)[0]["answer"]["parts"][number], { kind: "view" }>;
  const tab = { kind: "company" as const, key: fx.FIXTURE_COMPANY };
  assert.equal(canAddAsTab({ ...page, tool: "render_view" }, tab), true);
  // Alle sidekort om fanens entitet (regel 5): også show_company/show_person og ældre svar uden tool.
  assert.equal(canAddAsTab({ ...page, tool: "show_company" }, tab), true);
  assert.equal(canAddAsTab({ ...page, tool: undefined }, tab), true);
  assert.equal(canAddAsTab({ ...page, tool: "show_company" }, { kind: "person", key: fx.FIXTURE_COMPANY }), false);
  assert.equal(canAddAsTab({ ...page, tool: "render_view" }, { kind: "company", key: "CVR-1-1" }), false);
  assert.equal(canAddAsTab({ ...page, tool: "render_view", form: "module" }, tab), false);
  assert.equal(canAddAsTab({ ...page, tool: "render_view" }, { kind: "result", key: "result:1" }), false);
});

test("Forankring: brugerens spørgsmål øverst med 16 px luft, aldrig ud over bunden eller under 0", () => {
  // Spørgsmålet står 900 px nede i et rulleområde, der starter 150 px fra toppen; der er langt indhold under.
  assert.equal(anchorScrollTop({ anchorTop: 1050, viewTop: 150, scrollTop: 0, scrollHeight: 4000, clientHeight: 700 }), 884);
  // Allerede rullet 300: samme mål.
  assert.equal(anchorScrollTop({ anchorTop: 750, viewTop: 150, scrollTop: 300, scrollHeight: 4000, clientHeight: 700 }), 884);
  // Kort svar: bunden er grænsen (spørgsmålet kan ikke komme helt op).
  assert.equal(anchorScrollTop({ anchorTop: 1050, viewTop: 150, scrollTop: 0, scrollHeight: 1200, clientHeight: 700 }), 500);
  // Kort samtale: 0.
  assert.equal(anchorScrollTop({ anchorTop: 160, viewTop: 150, scrollTop: 0, scrollHeight: 600, clientHeight: 700 }), 0);
  assert.equal(moreBelow({ scrollTop: 884, scrollHeight: 4000, clientHeight: 700 }), true);
  assert.equal(moreBelow({ scrollTop: 3300, scrollHeight: 4000, clientHeight: 700 }), false);
});

test("Skabelonens navn: en show_company-side (titel = navnet) hedder modulet; ellers sidens titel", () => {
  assert.equal(templateTitle({ title: "FÆRCH OG DØTRE ApS", subtitle: "Ejere" }, "FÆRCH OG DØTRE ApS"), "Ejere");
  assert.equal(templateTitle({ title: "Eksempel Byg A/S ", subtitle: "Ejerskab" }, "eksempel byg a/s"), "Ejerskab");
  assert.equal(templateTitle({ title: "KYC-overblik", subtitle: "Ejere og risiko" }, "Eksempel Byg A/S"), "KYC-overblik");
  assert.equal(templateTitle({ title: "Eksempel Byg A/S" }, "Eksempel Byg A/S"), "Eksempel Byg A/S");
});

test("Links i teksten: tekstens farve og kun understregning (chat-ilink), pillerne uændrede", () => {
  const out = html(createElement(AssistantMessage, { answer: { parts: [{ kind: "text", text: "Du kan tjekke [Anne](lasso:person/CVR-3-4000000001).\n\n[Risiko](lasso:modul/risiko)" }], pending: false, at: fx.FIXTURE_AT } }));
  assert.match(out, /<button type="button" class="chat-ilink">Anne<\/button>/);
  assert.doesNotMatch(out, /class="chat-tlink">Anne/);
  assert.match(out, /class="chat-link"/);
});

test("Tom tilstand: titel med fanens navn, hjælpelinje og fire piller pr. fanetype", () => {
  assert.deepEqual(emptyPills("company", fx.EMPTY.suggestions), [...fx.EMPTY.suggestions, "Lav et fuldt KYC-overblik"]);
  assert.equal(emptyPills("person", ["a", "b", "c"])[3], "Vis netværket");
  assert.equal(emptyPills("global", ["a", "b", "c"])[3], "Sammenlign de største");
  const out = html(createElement(EmptyState, fx.EMPTY));
  assert.match(out, /Spørg Lasso om LASSO X A\/S/);
  assert.equal((out.match(/class="chat-spill"/g) ?? []).length, 4);
});

test("Afklaringen: radiogruppe uden talmærker, (Anbefalet), Andet med eget svar, Spring over og Vælg", () => {
  const out = html(createElement(ChoicePanel, { choice: fx.CHOICE, disabled: false, onSend: () => undefined, onSkip: () => undefined }));
  assert.match(out, /role="radiogroup"/);
  assert.equal((out.match(/role="radio"/g) ?? []).length, 3);
  assert.match(out, /aria-checked="true"[^>]*>.*Jakob Bech Benediktson<span class="chat-crow__rec"> \(Anbefalet\)/);
  assert.match(out, /placeholder="Skriv dit eget svar her"/);
  assert.match(out, />Spring over</);
  assert.match(out, />Vælg</);
  assert.doesNotMatch(out, />\s*1\.|<ol/);
  assert.match(html(createElement(ChoicePanel, { choice: fx.CHOICE, disabled: false, variant: "sheet", onSend: () => undefined, onSkip: () => undefined })), /chat-choice--sheet/);
});

test("Spørgefeltet: altid enter-ikonet; slået fra, mens Lasso svarer", () => {
  const busy = html(createElement(AskField, { value: "x", placeholder: "Spørg Lasso", pending: true }));
  assert.match(busy, /<input[^>]*disabled/);
  assert.match(busy, /aria-label="Send" disabled/);
  assert.doesNotMatch(busy, /Stop/);
});

test("Sideskabelon: rød nål med navnet på handlingen, og bekræftelsen 'Fjern modulet?'", () => {
  assert.match(html(createElement(TemplatePin, { kind: "company", title: "KYC-overblik" })), /class="ibtn on tplpin" aria-label="KYC-overblik er tilføjet på alle virksomheder\. Fjern modulet"/);
  assert.equal(fx.TEMPLATE_CONFIRM.confirmOpen, true);
  assert.equal(typeof RemoveTemplateDialog, "function");
});
