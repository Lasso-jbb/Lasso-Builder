import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanCommentInput, cleanCommentPatch, commentsMarkdown, MemoryCommentStore } from "./store.js";

const input = {
  target: "modul:LassoKeyFigureCards:desktop:third:fyldt",
  label: "Nøgletalskort, desktop ⅓",
  context: { kind: "modul", ref: "LassoKeyFigureCards", viewport: "desktop", vw: 1200, width: "third", hash: "#/moduler/key-figure-cards", evil: "<script>" },
  pin: { x: 120.4, y: 88.6 },
  text: "  Beløbet overlapper enheden  ",
  author: "Jakob",
};

test("kommentar: input renses (trim, kendte felter, nål rundes)", () => {
  const c = cleanCommentInput(input);
  assert.equal(c.text, "Beløbet overlapper enheden");
  assert.deepEqual(c.pin, { x: 120, y: 89 });
  assert.equal((c.context as unknown as Record<string, unknown>).evil, undefined);
  assert.equal(c.context.vw, 1200);
  assert.throws(() => cleanCommentInput({ ...input, text: " " }), /Teksten mangler/);
  assert.throws(() => cleanCommentInput({ ...input, text: "x".repeat(5000) }), /for lang/);
  assert.throws(() => cleanCommentPatch({ status: "slettet" }), /Ukendt status/);
});

test("kommentar: tilføj, ret og markdown-arbejdsliste med kun de åbne", async () => {
  const store = new MemoryCommentStore();
  const a = await store.add(cleanCommentInput(input));
  const b = await store.add(cleanCommentInput({ ...input, text: "Mørk tilstand: flade er hvid" }));
  assert.equal(a.status, "aaben");
  const fixed = await store.update(b.id, cleanCommentPatch({ status: "rettet", reply: "Tilføjet mørk værdi", commit: "abc1234" }));
  assert.equal(fixed?.status, "rettet");
  assert.equal(fixed?.reply, "Tilføjet mørk værdi");
  assert.equal(await store.update("findes-ikke", { status: "rettet" }), null);
  const md = commentsMarkdown(await store.list(), "https://lasso.example");
  assert.match(md, /1 kommentarer/);
  assert.match(md, /## Nøgletalskort, desktop ⅓/);
  assert.match(md, /Reference: LassoKeyFigureCards/);
  assert.match(md, /Åbn: https:\/\/lasso\.example\/designguide#\/moduler\/key-figure-cards/);
  assert.match(md, /Nål: x 120, y 89/);
  assert.doesNotMatch(md, /Mørk tilstand/);
  assert.match(commentsMarkdown(await store.list(), "", "alle"), /Svar: Tilføjet mørk værdi \(abc1234\)/);
  assert.equal(await store.remove(a.id), true);
});
