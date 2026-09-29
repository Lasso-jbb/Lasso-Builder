import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PushBanner, pushText } from "./components/PushBanner.js";
import { NotificationPanel } from "./components/NotificationPanel.js";
import { AuditorHistory } from "./components/AuditorIndependence.js";
import { Properties } from "./components/Properties.js";
import { ProductionUnits } from "./components/ProductionUnits.js";

test("26e.6: push-banneret kan læses uden at åbne appen (virksomhed + hændelse + ét tal)", () => {
  assert.equal(pushText({ event: "Nyt regnskab", company: "LASSO X A/S", figure: "bruttofortjeneste +7,5 %" }), "Nyt regnskab: LASSO X A/S, bruttofortjeneste +7,5 %");
  const html = renderToStaticMarkup(createElement(PushBanner, { event: "Nyt regnskab", company: "Eksempel A/S", figure: "resultat −201 t. kr." }));
  assert.match(html, /lasso-push__app">Lasso<[^]*lasso-push__time">nu</);
  assert.match(html, /Nyt regnskab: Eksempel A\/S, resultat −201 t\. kr\./);
});

test("26e.5: notifikationspanelet har filterchips Alle/Ulæste/Vigtige og rød prik for vigtige", () => {
  const items = [
    { id: "1", kind: "overvaagning" as const, text: "Konkursdekret afsagt", at: "2026-09-28T10:00:00", read: false, important: true },
    { id: "2", kind: "overvaagning" as const, text: "Nyt regnskab", at: "2026-09-29T10:00:00", read: false },
  ];
  const html = renderToStaticMarkup(createElement(NotificationPanel, { items, now: new Date("2026-09-29T12:00:00") }));
  assert.match(html, /aria-label="Filtrér notifikationer"[^]*aria-pressed="true"[^>]*>Alle<[^]*>Ulæste<[^]*>Vigtige</, "Alle er valgt fra start på mobil");
  assert.match(html, /lasso-notif__dot lasso-notif__dot--important" role="img" aria-label="Ulæst, vigtig"/);
});

test("26e.8: revisorhistorik som proportional bjælke med nuværende revisor fremhævet", () => {
  const html = renderToStaticMarkup(createElement(AuditorHistory, { history: [{ name: "Eks. Revision", from: "2012-01-01", to: "2016-12-31" }, { name: "AAEN & CO.", from: "2017-01-01" }], now: new Date("2026-09-29") }));
  assert.match(html, /flex-grow:5"[^>]*title="Eks\. Revision 2012–16"[^>]*><span class="lasso-audhist__label">2012–16</);
  assert.match(html, /lasso-audhist__seg is-current" style="flex-grow:10"[^>]*><span class="lasso-audhist__label">2017–</);
  // Navnene står i legenden under bjælken, så de ikke klippes.
  assert.match(html, /lasso-audhist__name">AAEN &amp; CO\.<\/span>, 2017–i dag/);
});

test("20.2: ejendomskortet tegner matrikelpolygon og valgt bygning fra geometri; uden geometri tom tilstand", () => {
  const property = {
    matrikel: "Matr. 123a, Eksempel By",
    buildings: [],
    geometry: { parcel: [[0, 0], [10, 0], [10, 10], [0, 10]] as [number, number][], buildings: [{ number: 1, polygon: [[2, 2], [5, 2], [5, 5], [2, 5]] as [number, number][] }], selected: 1 },
  };
  const html = renderToStaticMarkup(createElement(Properties, { properties: { lassoId: "x", properties: [property] } }));
  assert.match(html, /lasso-property-map__parcel/);
  assert.match(html, /lasso-property-map__plot lasso-property-map__plot--selected/);
  assert.match(html, /aria-label="Matrikelkort, Matr\. 123a, Eksempel By"/);
  const none = renderToStaticMarkup(createElement(Properties, { properties: { lassoId: "x", properties: [{ buildings: [] }] } }));
  assert.match(none, /Intet matrikelkort tilgængeligt/);
});

test("26e.1: produktionsenheder som tre-linjers rækker på mobil med antal aktive i hovedet", () => {
  const html = renderToStaticMarkup(
    createElement(ProductionUnits, {
      units: { lassoId: "x", units: [{ pNumber: "1000000020", name: "Eksempel A/S", isMain: true, employees: 17, address: { street: "Prøvevej 1", zip: "1253", city: "København K" }, statusKind: "active" as const }] },
    }),
  );
  assert.match(html, /lasso-units__count">1 aktive</);
  assert.match(html, /lasso-units-m__name">Eksempel A\/S, hovedenhed<[^]*Prøvevej 1, 1253 København K[^]*P-nr\. 1000000020, 17 ansatte/);
});

