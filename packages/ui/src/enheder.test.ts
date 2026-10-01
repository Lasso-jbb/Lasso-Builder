import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PushBanner, pushText } from "./components/PushBanner.js";
import { NotificationPanel } from "./components/NotificationPanel.js";
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

test("20.1/26e.1: produktionsenheder med kontakt pr. P-enhed (kun ved data, G2), antal i hovedet og ingen undertitel", () => {
  const html = renderToStaticMarkup(
    createElement(ProductionUnits, {
      units: {
        lassoId: "x",
        units: [
          { pNumber: "1000000020", name: "Eksempel A/S", isMain: true, employees: 17, address: { street: "Prøvevej 1", zip: "1253", city: "København K" }, statusKind: "active" as const, status: "Aktiv", industryCode: "631000", industryText: "IT-infrastruktur og hosting", created: "2012-05-14", phone: "71 74 78 12", email: "kontakt@lasso.dk" },
          { pNumber: "1000000022", name: "Lager", statusKind: "inactive" as const, status: "Ophørt", endedYear: 2024, employees: null },
        ],
      },
    }),
  );
  assert.match(html, /lasso-units__count">1 aktiv, 1 ophørt</);
  assert.doesNotMatch(html, /lasso-section__subtitle/);
  // Desktop (M1G-0): kolonnerne og kontaktlinjen med ikoner.
  assert.match(html, />Enhed, adresse og kontakt</);
  assert.match(html, />Oprettet og status</);
  assert.match(html, /lasso-units20__name">Eksempel A\/S<span class="lasso-units__main">Hovedenhed<[^]*Prøvevej 1, 1253 København K[^]*71 74 78 12[^]*kontakt@lasso\.dk/);
  // 20.1 (Jakob 01.10): intet P-nummer.
  assert.doesNotMatch(html, /P-nr|1000000020/);
  assert.match(html, /lasso-units20__industry-text">IT-infrastruktur og hosting<\/span><span class="lasso-units20__code">631000</);
  assert.match(html, /14\.05\.2012<\/span><span class="lasso-units20__status[^"]*">Aktiv</);
  assert.match(html, /is-ended[^]*Ophørt 2024/);
  // Kontaktlinjen kun ved data (G2): lagret har hverken telefon eller e-mail.
  assert.equal((html.match(/lasso-units20__contact"/g) ?? []).length, 2, "én i tabellen og én i mobillisten for hovedenheden");
  // Mobil (M3A-0): meta-linjen med branche, ansatte og oprettet (intet P-nr.).
  assert.match(html, /lasso-units20-m__meta">IT-infrastruktur og hosting, 17 ansatte, oprettet 14\.05\.2012</);
});

