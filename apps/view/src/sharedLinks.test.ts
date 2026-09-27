import assert from "node:assert/strict";
import { test } from "node:test";
import { hasLinks, NO_LINK, openFocusFromLinks, openFromLinks } from "./sharedLinks.js";

const LINKS = {
  "CVR-1-99000010": "http://x/e/CVR-1-99000010?e=abc&s=sig1",
  "CVR-3-4000000001": "http://x/e/CVR-3-4000000001?e=abc&s=sig2",
};

test("hasLinks: drill-down på den delte side kun, når serveren har lagt links i boot'en", () => {
  assert.equal(hasLinks(LINKS), true);
  assert.equal(hasLinks({}), false);
  assert.equal(hasLinks(undefined), false);
});

test("openFromLinks går til det signerede link for virksomheder og personer (samme fane)", () => {
  const visited: string[] = [];
  const go = (url: string) => void visited.push(url);
  assert.deepEqual(openFromLinks(LINKS, { kind: "open-company", lassoId: "CVR-1-99000010", name: "Eksempel Holding ApS" }, go), { ok: true, url: LINKS["CVR-1-99000010"] });
  assert.deepEqual(openFromLinks(LINKS, { kind: "open-person", lassoId: "CVR-3-4000000001" }, go), { ok: true, url: LINKS["CVR-3-4000000001"] });
  assert.deepEqual(visited, [LINKS["CVR-1-99000010"], LINKS["CVR-3-4000000001"]]);
});

test("openFromLinks: et ID uden link giver en fejl og navigerer ikke", () => {
  let navigated = false;
  const res = openFromLinks(LINKS, { kind: "open-person", lassoId: "CVR-3-999" }, () => {
    navigated = true;
  });
  assert.deepEqual(res, { ok: false, error: NO_LINK });
  assert.equal(NO_LINK, "Ingen adgang til den side");
  assert.equal(navigated, false);
  assert.equal(openFromLinks(undefined, { kind: "open-company", lassoId: "CVR-1-99000010" }, () => {}).ok, false);
});

test("openFocusFromLinks: 'Se alle … i Historik' går til serverens signerede link med fokus; uden link en fejl", () => {
  const focusLinks = { historik: "http://x/e/CVR-1-99000001?e=abc&f=historik&s=sig3" };
  const visited: string[] = [];
  assert.deepEqual(openFocusFromLinks(focusLinks, { kind: "open-focus", focus: "historik" }, (url) => void visited.push(url)), { ok: true, url: focusLinks.historik });
  assert.deepEqual(visited, [focusLinks.historik]);
  assert.deepEqual(openFocusFromLinks(focusLinks, { kind: "open-focus", focus: "ledelse" }, (url) => void visited.push(url)), { ok: false, error: NO_LINK });
  assert.deepEqual(openFocusFromLinks(undefined, { kind: "open-focus", focus: "historik" }, (url) => void visited.push(url)), { ok: false, error: NO_LINK });
  assert.equal(visited.length, 1);
  // Den delte side slår kun fanelinket til, når serveren har lagt links i boot'en.
  assert.equal(hasLinks(focusLinks), true);
  assert.equal(hasLinks(undefined), false);
});
