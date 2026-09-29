import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ChangeFeedVM } from "@lasso/spec";
import { ChangeFeed, clockText, dayHeading } from "./components/ChangeFeed.js";
import { MonitorBell, MonitorSettings } from "./components/MonitorSettings.js";
import { NotificationPanel, relativeTime, type NotificationVM } from "./components/NotificationPanel.js";

// Fast "nu", så dagsoverskrifter og relativ tid er deterministiske: fredag 25.09.2026 kl. 12.00 lokal tid.
const NOW = new Date(2026, 8, 25, 12, 0, 0);
const at = (daysAgo: number, h: number, m: number) => new Date(2026, 8, 25 - daysAgo, h, m, 0).toISOString();

function feed(): ChangeFeedVM {
  return {
    listName: "Kunder",
    days: 7,
    total: 9,
    source: "Eksempeldata",
    updated: "2026-09-25",
    entries: [
      { lassoId: "CVR-1-1", companyName: "Cloud Eksempel A/S", type: "status", text: "Status ændret", from: "Aktiv", to: "Under konkurs", at: at(0, 9, 14), source: "CVR", read: false },
      { lassoId: "CVR-1-2", companyName: "Nordisk Prøve A/S", type: "regnskab", text: "Årsrapport 2025 offentliggjort, bruttofortjeneste 96,4 mio. kr. (+12,1 %)", at: at(0, 7, 2), source: "CVR", read: false },
      { lassoId: "CVR-1-3", companyName: "Prøve X A/S", type: "ledelse", text: "Nyt bestyrelsesmedlem: Anne Eksempel indtrådt", at: at(1, 14, 40), source: "CVR", read: true },
      { companyName: "Eksempel Byg A/S", type: "stamdata", text: "Antal ansatte opdateret for 3. kvartal", at: at(1, 6, 0), source: "CVR", read: true, count: 5, companies: ["a", "b", "c", "d", "e"] },
      { lassoId: "CVR-1-4", companyName: "Prøve Y ApS", type: "kredit", text: "Kreditscore ændret fra 47 til 52", at: at(2, 8, 0), source: "Kredit", read: true },
    ],
  };
}

test("dagsoverskrift og klokkeslæt (21)", () => {
  assert.equal(dayHeading(at(0, 9, 14), NOW), "I dag, fredag 25.09.2026");
  assert.equal(dayHeading(at(1, 6, 0), NOW), "I går, 24.09.2026");
  assert.equal(dayHeading(at(2, 8, 0), NOW), "onsdag 23.09.2026");
  assert.equal(clockText(at(0, 9, 14)), "kl. 09.14");
});

test("Ændringsfeed (21): overskrift med antal, chips med antal, dagsgrupper, ulæst-markering og status som fra -> til", () => {
  const html = renderToStaticMarkup(createElement(ChangeFeed, { feed: feed(), now: NOW }));
  assert.match(html, /Ændringer i &quot;Kunder&quot; \(9\)/);
  // Filter-chips (ikke faner): Alle + de seks typer med antal i parentes
  assert.match(html, /aria-pressed="true"[^>]*>Alle \(9\)/);
  assert.match(html, /Regnskab \(1\)/);
  assert.match(html, /Status \(1\)/);
  assert.match(html, /Stamdata \(5\)/);
  assert.doesNotMatch(html, /role="tab"/);
  // Dagsoverskrifter som overline
  assert.match(html, /class="lasso-feed__day">I dag, fredag 25\.09\.2026</);
  assert.match(html, /class="lasso-feed__day">I går, 24\.09\.2026</);
  assert.match(html, /class="lasso-feed__day">onsdag 23\.09\.2026</);
  // Ulæst: koral prik + venstrekant; første ulæste får soft-flade
  assert.equal((html.match(/lasso-feed__row--unread/g) ?? []).length, 2);
  assert.equal((html.match(/lasso-feed__row--first/g) ?? []).length, 1);
  assert.equal((html.match(/aria-label="Ulæst"/g) ?? []).length, 2);
  // Status som fra -> til, typen som ren tekst i mørk rød
  assert.match(html, /lasso-feed__type lasso-feed__type--status">Status</);
  assert.match(html, /lasso-feed__from">Aktiv<\/span><span aria-hidden="true">→<\/span><span class="lasso-feed__to">Under konkurs</);
  // Foldet række
  assert.match(html, /5 virksomheder/);
  assert.match(html, /Vis alle/);
  // Kilde + klokkeslæt i small muted, med komma (ingen midterprik)
  assert.match(html, /lasso-feed__meta">CVR, kl\. 09\.14</);
  assert.doesNotMatch(html, /·/);
  assert.match(html, /Kilde: Eksempeldata, opdateret 25\.09\.2026/);
  // Periodevælger
  assert.match(html, /aria-label="Vælg periode"/);
  assert.match(html, /<option value="7"[^>]*>Seneste 7 dage/);
  assert.match(html, /<option value="30" disabled=""/);
});

test("Ændringsfeed: henter, tom og fejl", () => {
  const loading = renderToStaticMarkup(createElement(ChangeFeed, {}));
  assert.match(loading, /aria-busy="true"/);
  const empty = renderToStaticMarkup(createElement(ChangeFeed, { feed: { listName: "Kunder", days: 7, total: 0, entries: [], emptyReason: "Ingen ændringer i \"Kunder\" de seneste 7 dage." } }));
  assert.match(empty, /Ingen ændringer i &quot;Kunder&quot; de seneste 7 dage\./);
  assert.doesNotMatch(empty, />0</);
  const error = renderToStaticMarkup(createElement(ChangeFeed, { error: "Lasso API-fejl (500)" }));
  assert.match(error, /role="alert"/);
  assert.match(error, /Data kunne ikke hentes/);
});

test("Notifikationspanel (21): overskrift, faner niveau 2, ulæst-prik, kilde + tid i anden linje, handling og Se alle", () => {
  const items: NotificationVM[] = [
    { id: "1", kind: "overvaagning", text: "Cloud Eksempel A/S er gået under konkurs", source: 'Overvågning "Kunder"', at: at(0, 10, 0), read: false },
    { id: "2", kind: "kredit", text: "Kreditvurdering for Prøve X A/S er klar, 52 (+5)", at: at(0, 8, 0), read: false },
    { id: "3", kind: "eksport", text: 'Eksport "Store IT-selskaber" er klar til download', at: at(1, 16, 20), read: false, action: { label: "Hent", href: "https://example.invalid/x.csv" } },
    { id: "4", kind: "overvaagning", text: '6 ændringer i "Kunder" i går', at: at(1, 6, 0), read: true },
    { id: "5", kind: "konto", text: "Din Lasso Risiko-prøveperiode udløber om 5 dage", at: at(3, 9, 0), read: true },
  ];
  const html = renderToStaticMarkup(createElement(NotificationPanel, { items, now: NOW, onMarkAllRead: () => {}, onSeeAll: () => {} }));
  assert.match(html, /Notifikationer \(3\)/);
  assert.match(html, /Markér alle som læst/);
  assert.match(html, /class="lasso-tabs lasso-tabs--l2"/);
  assert.match(html, /aria-selected="true"[^>]*>Ulæste</);
  assert.match(html, />Alle<\/button>/);
  assert.match(html, />Overvågning<\/button>/);
  // Fanen "Ulæste" er valgt: tre ulæste rækker med prik, læste vises ikke
  assert.equal((html.match(/lasso-notif__row--unread/g) ?? []).length, 3);
  assert.doesNotMatch(html, /6 ændringer i/);
  assert.match(html, /Overvågning &quot;Kunder&quot;, for 2 timer siden/);
  assert.match(html, /Kredit, for 4 timer siden/);
  assert.match(html, /Eksport, i går kl\. 16\.20/);
  assert.match(html, /class="lasso-notif__action" href="https:\/\/example\.invalid\/x\.csv">Hent</);
  assert.match(html, /Se alle notifikationer/);
  assert.doesNotMatch(html, /·/);
  assert.equal(relativeTime(at(3, 9, 0), NOW), "22.09.2026");
  // Alt læst: ingen "Markér alle"-knap og tom tilstand siger hvorfor
  const done = renderToStaticMarkup(createElement(NotificationPanel, { items: items.map((n) => ({ ...n, read: true })), now: NOW, onMarkAllRead: () => {} }));
  assert.doesNotMatch(done, /Markér alle som læst/);
  assert.match(done, /Alt er læst\./);
});

test("Klokke (21): ingen badge, koral badge med antal, rød badge ved vigtig ændring", () => {
  const none = renderToStaticMarkup(createElement(MonitorBell, { unread: 0 }));
  assert.match(none, /aria-label="Notifikationer, ingen ulæste"/);
  assert.doesNotMatch(none, /lasso-bell__badge/);
  const three = renderToStaticMarkup(createElement(MonitorBell, { unread: 3 }));
  assert.match(three, /aria-label="Notifikationer, 3 ulæste"/);
  assert.match(three, /class="lasso-bell__badge" aria-hidden="true">3</);
  const important = renderToStaticMarkup(createElement(MonitorBell, { unread: 3, important: true }));
  assert.match(important, /lasso-bell__badge lasso-bell__badge--important"[^>]*>!</);
  assert.match(important, /vigtig ændring, 3 ulæste/);
});

test("Overvåger-indstillinger (21): knap i koral-soft, fakta, Stop overvågning som tekstknap, toggles pr. type", () => {
  const html = renderToStaticMarkup(
    createElement(MonitorSettings, {
      companyName: "LASSO X A/S",
      monitoring: true,
      listName: "Kunder",
      since: "2025-03-03",
      frequency: "dagligt",
      settings: { status: true, regnskab: true, ledelse: true, stamdata: false, kredit: false },
      onToggle: () => {},
      onStop: () => {},
    }),
  );
  assert.match(html, /lasso-monitor__btn is-on"[^>]*aria-pressed="true"/);
  assert.match(html, />Overvåger<\/button>/);
  assert.match(html, /LASSO X A\/S overvåges</);
  assert.match(html, /I listen &quot;Kunder&quot;, siden 03\.03\.2025, besked pr\. e-mail dagligt/);
  assert.match(html, /class="lasso-link lasso-monitor__stop"[^>]*>Stop overvågning</);
  // 5 typekontakter + mobilens statuskontakt (26e.4, skjult på desktop).
  assert.equal((html.match(/role="switch"/g) ?? []).length, 6);
  assert.equal((html.match(/aria-checked="true"/g) ?? []).length, 4);
  assert.match(html, /lasso-monitor__mstatus/);
  assert.match(html, /Status og konkurs/);
  assert.match(html, /Kreditscore ændrer sig ≥ 5 point/);
  assert.doesNotMatch(html, /·/);
  // Ikke overvåget: kun "Overvåg"-knappen, ingen toggles
  const off = renderToStaticMarkup(createElement(MonitorSettings, { companyName: "Prøve ApS", monitoring: false, settings: {}, onStart: () => {} }));
  assert.match(off, />Overvåg<\/button>/);
  assert.doesNotMatch(off, /role="switch"/);
  assert.doesNotMatch(off, /Stop overvågning/);
});

test("21.3/21.4: kontakterne står i samme rækkefølge som feedets typefilter", async () => {
  const { MONITOR_TYPES } = await import("./components/MonitorSettings.js");
  const { CHANGE_TYPES } = await import("@lasso/spec");
  const pos = MONITOR_TYPES.map((t) => (CHANGE_TYPES as readonly string[]).indexOf(t));
  assert.ok(pos.every((p) => p >= 0));
  assert.deepEqual([...pos].sort((a, b) => a - b), pos);
});
