import assert from "node:assert/strict";
import { test } from "node:test";
import { adaptCompanyEvents, announcementSeverity } from "./eventAdapters.js";

test("28.6/28.8/28.2: company-full læses defensivt til fusioner, bekendtgørelser og publicering", () => {
  const raw = {
    mergers: [{ date: "2022-07-01", ceasingCompanies: [{ name: "Data Eksempel A/S", lassoId: "CVR-1-2" }], continuingCompanies: [{ name: "Eksempel A/S", lassoId: "CVR-1-1" }] }],
    demergers: [{ effectiveDate: "2020-01-01", from: "Gammel A/S", to: ["Ny A ApS", "Ny B ApS"] }],
    statstidende: { announcements: [{ publicationDate: "2026-08-12", type: "Dekret om konkurs", text: "Konkurs", url: "javascript:alert(1)" }, { title: "Likvidation" }] },
  };
  const ev = adaptCompanyEvents("CVR-1-1", raw, [{ year: 2025, periodEnd: "2025-12-31", published: "2026-04-11T08:00:00Z", grossProfit: 1000 }]);
  assert.equal(ev.mergers.length, 2);
  assert.deepEqual(ev.mergers[0], { type: "Fusion", date: "2022-07-01", from: [{ name: "Data Eksempel A/S", lassoId: "CVR-1-2", ceased: true }], to: [{ name: "Eksempel A/S", lassoId: "CVR-1-1" }] });
  assert.equal(ev.mergers[1]!.type, "Spaltning");
  assert.equal(ev.mergers[1]!.to.length, 2);
  assert.equal(ev.announcements[0]!.severity, "bankrupt");
  assert.equal(ev.announcements[0]!.url, undefined, "kun http/https");
  assert.equal(ev.announcements[1]!.severity, "warning");
  assert.deepEqual(ev.publications[0], { published: "2026-04-11", periodEnd: "2025-12-31", year: 2025, kind: "Årsrapport", figure: { label: "Bruttofortjeneste", value: 1000 } });
  const empty = adaptCompanyEvents("x", { name: "Uden" }, []);
  assert.deepEqual([empty.mergers, empty.announcements, empty.publications], [[], [], []]);
  assert.equal(announcementSeverity("Indkaldelse af kreditorer"), "neutral");
});
