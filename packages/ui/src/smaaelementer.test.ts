import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { companyFacts } from "@lasso/spec";
import { SourceList } from "./components/SourceList.js";
import { SnapshotPicker } from "./components/SnapshotPicker.js";
import { LiveNumber } from "./components/LassoContact.js";

test("26h.4: kildeliste med tidsstempel pr. kilde og PDF som række med hent-ikon", () => {
  const html = renderToStaticMarkup(
    createElement(SourceList, { sources: [{ name: "CVR, Erhvervsstyrelsen", updated: "i dag 06:10" }, { name: "Regnskaber, XBRL", updated: "2026-06-02" }], pdf: { label: "Hent årsrapport 2025 (PDF)", url: "https://example.com/a.pdf" } }),
  );
  assert.match(html, /Kilder og opdatering/);
  assert.match(html, /CVR, Erhvervsstyrelsen<\/span><span class="lasso-sourcelist__time">i dag 06:10/);
  assert.match(html, /Regnskaber, XBRL<\/span><span class="lasso-sourcelist__time">02\.06\.2026/);
  assert.match(html, /href="https:\/\/example\.com\/a\.pdf"[^>]*><span>Hent årsrapport 2025 \(PDF\)<\/span><svg/);
});

test("26h.5: snapshot-skifter med native datovælger, I dag og ur-linje kun ved aktivt snapshot", () => {
  const on = renderToStaticMarkup(createElement(SnapshotPicker, { subject: "Ejerdiagram", what: "ejerskab", date: "2023-12-31", today: "2026-09-29", onChange: () => {} }));
  assert.match(on, /Ejerdiagram, historik/);
  assert.match(on, /type="date"[^>]*value="2023-12-31"/);
  assert.match(on, />I dag</);
  assert.match(on, /Du ser ejerskab pr\. 31\.12\.2023\. Ændringer efter denne dato vises ikke\./);
  const off = renderToStaticMarkup(createElement(SnapshotPicker, { subject: "Ejerdiagram", today: "2026-09-29", onChange: () => {} }));
  assert.doesNotMatch(off, /Du ser/);
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
