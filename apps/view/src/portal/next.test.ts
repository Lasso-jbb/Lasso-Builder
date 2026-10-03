import assert from "node:assert/strict";
import { test } from "node:test";
import { nextAfterLogin } from "./next.js";

test("nextAfterLogin: det ønskede portal-link kommer igen efter login (query bevares)", () => {
  const want = "/portal?aabn=CVR-1-99000001&fokus=risiko&fastgoer=1";
  assert.equal(nextAfterLogin(`?next=${encodeURIComponent(want)}`), want);
});

test("nextAfterLogin: uden next, eller med usikkert next, bliver brugeren på siden", () => {
  assert.equal(nextAfterLogin(""), undefined);
  assert.equal(nextAfterLogin("?x=1"), undefined);
  for (const bad of ["https://evil.example/", "//evil.example/portal", "javascript:alert(1)", "/\\evil.example"]) {
    assert.equal(nextAfterLogin(`?next=${encodeURIComponent(bad)}`), undefined, bad);
  }
});
