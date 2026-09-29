import assert from "node:assert/strict";
import { test } from "node:test";
import { DemoProvider } from "../data/demo.js";
import { companyReportJob, contentDisposition, isoDate, pdfFilename, personPageJob, reportSpec, safeFilePart } from "./jobs.js";

test("filnavn: 'Virksomhedsrapport <navn> <ÅÅÅÅ-MM-DD>.pdf' og '<sidens titel> <ÅÅÅÅ-MM-DD>.pdf'", () => {
  assert.equal(pdfFilename({ kind: "report", name: "Eksempel Byg A/S", generatedAt: "2026-09-28T10:00:00Z" }), "Virksomhedsrapport Eksempel Byg A-S 2026-09-28.pdf");
  assert.equal(pdfFilename({ kind: "page", name: "Søgning: revisorer i Århus", generatedAt: "2026-09-28T10:00:00Z" }), "Søgning- revisorer i Århus 2026-09-28.pdf");
  // Dansk dato: 23.30 UTC den 30. er allerede den 1. i København.
  assert.equal(isoDate("2026-09-30T22:30:00Z"), "2026-10-01");
  assert.equal(safeFilePart('A/S "Lasso" <test>, 1.0 - ok'), "A-S -Lasso- -test-- 1.0 - ok");
});

test("Content-Disposition: attachment med ASCII-navn og UTF-8-navnet i filename*", () => {
  const cd = contentDisposition("Virksomhedsrapport Møller & Søn 2026-09-28.pdf".replace("&", "-"));
  assert.match(cd, /^attachment; /);
  assert.match(cd, /filename="Virksomhedsrapport Moeller - Soen 2026-09-28\.pdf"/);
  assert.match(cd, /filename\*=UTF-8''Virksomhedsrapport%20M%C3%B8ller%20-%20S%C3%B8n%202026-09-28\.pdf$/);
});

test("rapportens data: alt til de fire sider; Creditsafe kun med credit (fokus risiko)", () => {
  const types = (credit: boolean) => reportSpec("CVR-1-99000001", { credit }).components.map((c) => c.type);
  assert.deepEqual(types(false), [
    "LassoCompanyHead",
    "LassoMultiYearTable",
    "LassoIncomeStatement",
    "LassoPersonList",
    "LassoOwnerList",
    "LassoBeneficialOwners",
    "LassoScoreGauge",
    "LassoAuditorIndependence",
  ]);
  assert.ok(types(true).includes("LassoCreditRating"));
  assert.equal(reportSpec("CVR-1-99000001").kind, "company");
});

test("jobs med demodata: rapport for en virksomhed, siden for en person, 404 når de ikke findes", async () => {
  const provider = new DemoProvider();
  const company = await companyReportJob(provider, "CVR-1-99000001");
  assert.ok(company.ok);
  assert.equal(company.job.kind, "report");
  assert.equal(company.job.name, "Eksempel Byg A/S");
  assert.ok(company.job.dataset.financialStatements["CVR-1-99000001"], "rapporten har det fulde regnskab");
  assert.equal(company.job.generatedAt, company.job.dataset.generatedAt);

  const person = await personPageJob(provider, "CVR-3-4000000002", "netvaerk");
  assert.ok(person.ok);
  assert.equal(person.job.kind, "page");
  assert.equal(person.job.name, "Bo Eksempel");
  assert.equal(person.job.spec.kind, "person");
  assert.ok(!person.job.spec.components.some((c) => c.type === "LassoFollowUps"), "ingen opfølgninger i PDF'en");

  const missing = await companyReportJob(provider, "CVR-1-12345678");
  assert.equal(missing.ok, false);
  assert.equal(!missing.ok && missing.status, 404);
});
