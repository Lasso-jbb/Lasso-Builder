import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { companyFacts } from "@lasso/spec";
import { SnapshotPicker } from "./components/SnapshotPicker.js";
import { LiveNumber } from "./components/LassoContact.js";

test("26h.5: snapshot-skifter med native datovælger, I dag og ur-linje kun ved aktivt snapshot", () => {
  const on = renderToStaticMarkup(createElement(SnapshotPicker, { subject: "Ejerdiagram", what: "ejerskab", date: "2023-12-31", today: "2026-09-29", onChange: () => {} }));
  assert.match(on, /Ejerdiagram, historik/);
  assert.match(on, /type="date"[^>]*value="2023-12-31"/);
  assert.match(on, />I dag</);
  // Dansk datoformat uanset browserens sprog (det native felt er usynligt ovenpå).
  assert.match(on, /lasso-snapshot__value[^>]*>31\.12\.2023</);
  assert.match(on, /Du ser ejerskab pr\. 31\.12\.2023\. Ændringer efter denne dato vises ikke\./);
  const off = renderToStaticMarkup(createElement(SnapshotPicker, { subject: "Ejerdiagram", today: "2026-09-29", onChange: () => {} }));
  assert.doesNotMatch(off, /Du ser/);
  assert.match(off, /lasso-snapshot__value[^>]*>29\.09\.2026</);
});

test("26h.7: live-nummer med verificeret-linje, kopiér- og ring-knap", () => {
  const html = renderToStaticMarkup(createElement(LiveNumber, { number: "71747812", verifiedAt: "2026-09-25" }));
  assert.match(html, /71 74 78 12/);
  assert.match(html, /Verificeret 25\.09\.2026, live-opslag/);
  assert.match(html, /aria-label="Kopiér nummer"/);
  assert.match(html, /href="tel:71747812"[^>]*aria-label="Ring op"/);
});

test("28.7/26h.9: bibrancher med kode først, fravalgt revision som warning og kapital med valutakode", () => {
  const rows = companyFacts(
    { lassoId: "x", name: "Eksempel A/S", altIndustries: [{ code: "620200", text: "It-rådgivning" }], auditExempt: true, registeredCapital: { amount: 400000, currency: "DKK" } },
    undefined,
    undefined,
  );
  assert.deepEqual(rows.find((r) => r.label === "Bibrancher"), { label: "Bibrancher", value: "620200 It-rådgivning" });
  assert.deepEqual(rows.find((r) => r.label === "Revision"), { label: "Revision", value: "Fravalgt", tone: "warning" });
  assert.equal(rows.find((r) => r.label === "Kapital")?.value, "400.000 DKK");
  const none = companyFacts({ lassoId: "x", name: "E", altIndustries: [] }, undefined, undefined);
  assert.equal(none.find((r) => r.label === "Bibrancher")?.value, "Ingen registreret");
  assert.equal(companyFacts({ lassoId: "x", name: "E" }, undefined, undefined).find((r) => r.label === "Bibrancher"), undefined);
});
