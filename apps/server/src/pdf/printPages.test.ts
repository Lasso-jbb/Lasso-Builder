import assert from "node:assert/strict";
import { test } from "node:test";
import type { Request, Response } from "express";
import { emptyDataset, parseViewSpec } from "@lasso/spec";
import { isLoopback, PDF_SNAPSHOT_TTL_MS, PRINT_JOB_TTL_MS, printPageHandler, PrintJobStore, type PrintJob } from "./printPages.js";

const job = (name = "Eksempel Byg A/S"): PrintJob => ({
  kind: "page",
  spec: parseViewSpec({ title: name, components: [{ type: "LassoCompanyHead", company: "CVR-1-99000001" }] }),
  dataset: emptyDataset("demo"),
  name,
  generatedAt: "2026-09-28T10:00:00.000Z",
});

test("print-jobs: tokenet er 32 tilfældige bytes (base64url) og kan kun læses én gang", () => {
  const store = new PrintJobStore({ ttlMs: PRINT_JOB_TTL_MS, once: true });
  const token = store.create(job());
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(store.create(job()), token);
  assert.equal(store.take(token)?.name, "Eksempel Byg A/S");
  assert.equal(store.take(token), null, "anden læsning giver intet");
  assert.equal(store.take("findes-ikke"), null);
});

test("print-jobs: udløber efter 60 sekunder", () => {
  let now = 1_000_000;
  const store = new PrintJobStore({ ttlMs: PRINT_JOB_TTL_MS, once: true, now: () => now });
  const a = store.create(job("A"));
  const b = store.create(job("B"));
  now += PRINT_JOB_TTL_MS - 1;
  assert.equal(store.take(a)?.name, "A");
  now += 1;
  assert.equal(store.take(b), null, "præcis 60 s efter er jobbet væk");
  assert.equal(store.size, 0);
});

test("PDF-links fra MCP-appen (/x/): kan hentes igen i 10 minutter, og lageret har et loft", () => {
  let now = 0;
  const store = new PrintJobStore({ ttlMs: PDF_SNAPSHOT_TTL_MS, once: false, max: 2, now: () => now });
  const a = store.create(job("A"));
  assert.equal(store.take(a)?.name, "A");
  assert.equal(store.take(a)?.name, "A", "samme link virker igen (fx når værten åbner det i browseren)");
  const b = store.create(job("B"));
  const c = store.create(job("C"));
  assert.equal(store.take(a), null, "det ældste job ryger, når loftet nås");
  assert.equal(store.take(b)?.name, "B");
  now += PDF_SNAPSHOT_TTL_MS;
  assert.equal(store.take(c), null);
});

test("loopback: kun 127.0.0.1, ::1 og ::ffff:127.0.0.1", () => {
  for (const a of ["127.0.0.1", "::1", "::ffff:127.0.0.1"]) assert.equal(isLoopback(a), true, a);
  for (const a of ["10.0.0.5", "::ffff:10.0.0.5", "192.168.1.2", "127.0.0.2", "0.0.0.0", "", undefined]) assert.equal(isLoopback(a), false, String(a));
});

/** En minimal Express-respons, der husker status, headere og body. */
function fakeResponse() {
  const out = { status: 200, type: "", headers: {} as Record<string, string>, body: undefined as unknown };
  const res = {
    status(code: number) {
      out.status = code;
      return res;
    },
    type(t: string) {
      out.type = t;
      return res;
    },
    set(k: string, v: string) {
      out.headers[k] = v;
      return res;
    },
    send(b: unknown) {
      out.body = b;
      return res;
    },
    json(b: unknown) {
      out.body = b;
      return res;
    },
  };
  return { res: res as unknown as Response, out };
}

const request = (token: string, remoteAddress: string) => ({ params: { token }, socket: { remoteAddress } }) as unknown as Request;

test("GET /print/:token: 404 for alle andre end loopback, og tokenet bruges ikke op af et forsøg udefra", async () => {
  const store = new PrintJobStore({ ttlMs: PRINT_JOB_TTL_MS, once: true });
  const handler = printPageHandler(async () => "<html><head><title>Lasso</title></head><body></body></html>", store);
  const token = store.create(job("Bo Eksempel"));

  const outside = fakeResponse();
  await handler(request(token, "10.1.2.3"), outside.res);
  assert.equal(outside.out.status, 404);
  assert.deepEqual(outside.out.body, { error: "Not found" });

  const local = fakeResponse();
  await handler(request(token, "::ffff:127.0.0.1"), local.res);
  assert.equal(local.out.status, 200);
  assert.equal(local.out.type, "html");
  assert.equal(local.out.headers["Cache-Control"], "no-store");
  const html = String(local.out.body);
  assert.match(html, /<title>Bo Eksempel, Lasso<\/title>/);
  const boot = JSON.parse(/window\.__LASSO_BOOT__=(.*?);<\/script>/s.exec(html)![1]!);
  assert.equal(boot.mode, "print");
  assert.equal(boot.kind, "page");
  assert.equal(boot.name, "Bo Eksempel");
  assert.equal(boot.generatedAt, "2026-09-28T10:00:00.000Z");

  const again = fakeResponse();
  await handler(request(token, "127.0.0.1"), again.res);
  assert.equal(again.out.status, 404, "engangstoken");
});
