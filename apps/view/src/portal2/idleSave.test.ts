import assert from "node:assert/strict";
import { test } from "node:test";
import { createIdleSave, type IdleScheduler } from "./idleSave.js";

/** En planlægger, testen selv kører: run() udfører det, der venter. */
function fakeScheduler() {
  const queue = new Map<number, () => void>();
  let next = 1;
  const s: IdleScheduler & { run: () => void; size: () => number } = {
    schedule: (fn) => {
      queue.set(next, fn);
      return next++;
    },
    cancel: (h) => void queue.delete(h as number),
    run: () => {
      const fns = [...queue.values()];
      queue.clear();
      fns.forEach((f) => f());
    },
    size: () => queue.size,
  };
  return s;
}

test("C4 idleSave: mange ændringer giver én gemning i et stille øjeblik", () => {
  const s = fakeScheduler();
  let saves = 0;
  const saver = createIdleSave(() => saves++, s);
  saver.request();
  saver.request();
  saver.request();
  assert.equal(saves, 0, "intet gemmes med det samme");
  assert.equal(s.size(), 1, "én gemning i kø");
  s.run();
  assert.equal(saves, 1);
  s.run();
  assert.equal(saves, 1, "intet tilbage");
});

test("C4 idleSave: kun den aktive fane planlægger ingen gemning, men flush (pagehide) tager den med", () => {
  const s = fakeScheduler();
  let saves = 0;
  const saver = createIdleSave(() => saves++, s);
  saver.markDirty();
  assert.equal(s.size(), 0);
  saver.flush();
  assert.equal(saves, 1);
  saver.flush();
  assert.equal(saves, 1, "intet at gemme igen");
});

test("C4 idleSave: flush gemmer det, der venter, med det samme og annullerer den planlagte", () => {
  const s = fakeScheduler();
  let saves = 0;
  const saver = createIdleSave(() => saves++, s);
  saver.request();
  saver.flush();
  assert.equal(saves, 1);
  assert.equal(s.size(), 0);
  s.run();
  assert.equal(saves, 1, "ingen dobbelt gemning");
  saver.request();
  saver.cancel();
  saver.flush();
  assert.equal(saves, 1, "cancel glemmer det, der ventede");
});
