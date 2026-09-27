import assert from "node:assert/strict";
import { test } from "node:test";
import { MemorySavedPageStore, pageKindOf, SavedPageError, validateSavedPage } from "./store.js";

const base = { org: "lasso", userId: "jbb", origin: "manual" as const };

test("pageKindOf skelner virksomheder og personer på Lasso-ID'et", () => {
  assert.equal(pageKindOf("CVR-1-34580820"), "company");
  assert.equal(pageKindOf("CVR-3-4000455341"), "person");
  assert.equal(pageKindOf("CVR-4-123"), "person");
  assert.equal(pageKindOf("CVR-2-1234567890"), null);
  assert.equal(pageKindOf("34580820"), null);
});

test("validateSavedPage afviser forkert slags og tomt navn, og trimmer felter", () => {
  assert.throws(() => validateSavedPage({ ...base, lassoId: "CVR-1-34580820", kind: "person", name: "X" }), SavedPageError);
  assert.throws(() => validateSavedPage({ ...base, lassoId: "CVR-1-34580820", kind: "company", name: "   " }), SavedPageError);
  assert.throws(() => validateSavedPage({ ...base, lassoId: "CVR-1-34580820", kind: "company", name: "X", cvr: "123" }), SavedPageError);
  assert.throws(() => validateSavedPage({ ...base, userId: "jbb;drop", lassoId: "CVR-1-34580820", kind: "company", name: "X" }), SavedPageError);
  const ok = validateSavedPage({ ...base, lassoId: " CVR-1-34580820 ", kind: "company", name: "  LASSO X A/S ", note: "", focus: " oekonomi " });
  assert.equal(ok.lassoId, "CVR-1-34580820");
  assert.equal(ok.name, "LASSO X A/S");
  assert.equal(ok.note, undefined);
  assert.equal(ok.focus, "oekonomi");
});

test("hukommelseslageret: gem, nyeste først, ingen dubletter, fjern, has", async () => {
  const store = new MemorySavedPageStore();
  const a = await store.save({ ...base, lassoId: "CVR-1-34580820", kind: "company", name: "LASSO X A/S", cvr: "34580820" });
  assert.equal(a.created, true);
  await new Promise((r) => setTimeout(r, 2));
  const b = await store.save({ ...base, lassoId: "CVR-3-4000455341", kind: "person", name: "Jakob Bech Benediktson" });
  assert.equal(b.created, true);

  let list = await store.list(base.org, base.userId);
  assert.deepEqual(list.pages.map((p) => p.lassoId), ["CVR-3-4000455341", "CVR-1-34580820"]);
  assert.equal(list.total, 2);

  // Gemmes igen: ingen dublet, siden flyttes øverst, note bevares når den ikke sendes med.
  await new Promise((r) => setTimeout(r, 2));
  const again = await store.save({ ...base, lassoId: "CVR-1-34580820", kind: "company", name: "LASSO X A/S", note: "Kunde", origin: "send" });
  assert.equal(again.created, false);
  await new Promise((r) => setTimeout(r, 2));
  const again2 = await store.save({ ...base, lassoId: "CVR-1-34580820", kind: "company", name: "LASSO X A/S" });
  assert.equal(again2.page.note, "Kunde");
  assert.equal(again2.page.origin, "manual");
  assert.equal(again2.page.cvr, "34580820");
  list = await store.list(base.org, base.userId);
  assert.deepEqual(list.pages.map((p) => p.lassoId), ["CVR-1-34580820", "CVR-3-4000455341"]);
  assert.equal(list.total, 2);

  // Filter på slags og limit; total tæller den valgte slags.
  assert.equal((await store.list(base.org, base.userId, { kind: "person" })).pages.length, 1);
  assert.equal((await store.list(base.org, base.userId, { kind: "company" })).total, 1);
  assert.equal((await store.list(base.org, base.userId, { limit: 1 })).pages.length, 1);
  assert.equal((await store.list(base.org, base.userId, { limit: 1 })).total, 2);

  // Andre brugere ser ikke listen.
  assert.equal((await store.list(base.org, "anna")).total, 0);
  assert.deepEqual([...(await store.has(base.org, base.userId, ["CVR-1-34580820", "CVR-1-99000001"]))], ["CVR-1-34580820"]);

  assert.equal(await store.remove(base.org, base.userId, "CVR-1-34580820"), true);
  assert.equal(await store.remove(base.org, base.userId, "CVR-1-34580820"), false);
  assert.equal((await store.list(base.org, base.userId)).total, 1);
  assert.equal(await store.get(base.org, base.userId, "CVR-3-4000455341").then((p) => p?.name), "Jakob Bech Benediktson");
});
