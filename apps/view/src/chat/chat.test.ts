import assert from "node:assert/strict";
import { test } from "node:test";
import { parseBlocks, parseInline } from "./markdown.js";
import { ChatHttpError, GLOBAL_TITLES, STREAM_BROKEN, splitSse, streamChat, type ChatEvent } from "./stream.js";

test("splitSse: hele blokke ud, en halv blok bliver i bufferen", () => {
  const { events, rest } = splitSse('data: {"type":"text","text":"Hej"}\n\ndata: {"type":"tool","id":"1","name":"show_company","title":"Vis"}\n\ndata: {"type":"te');
  assert.deepEqual(
    events.map((e) => e.type),
    ["text", "tool"],
  );
  assert.equal(rest, 'data: {"type":"te');
  // En ødelagt blok springes over.
  assert.equal(splitSse("data: {ikke json\n\n").events.length, 0);
});

test("streamChat: læser hændelserne, også når en blok er delt over to chunks", async () => {
  const chunks = ['data: {"type":"text","te', 'xt":"Hej"}\n\ndata: {"type":"done","history":[],"sig":"s"}\n\n'];
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      for (const ch of chunks) c.enqueue(new TextEncoder().encode(ch));
      c.close();
    },
  });
  let sent: RequestInit | undefined;
  const fetcher = (async (_url: string, init: RequestInit) => {
    sent = init;
    return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
  }) as unknown as typeof fetch;
  const events: ChatEvent[] = [];
  await streamChat({ message: "Hej", history: [] }, (e) => events.push(e), { fetcher });
  assert.deepEqual(events, [
    { type: "text", text: "Hej" },
    { type: "done", history: [], sig: "s" },
  ]);
  assert.equal((sent!.headers as Record<string, string>)["x-lasso-portal"], "1");
});

test("streamChat: serverens fejltekst kastes med status", async () => {
  const fetcher = (async () => new Response(JSON.stringify({ error: "Ikke logget ind" }), { status: 401 })) as unknown as typeof fetch;
  await assert.rejects(streamChat({ message: "Hej" }, () => {}, { fetcher }), (e: Error & { status?: number }) => e.status === 401 && e.message === "Ikke logget ind");
});

/** Et svar, der sender én tekst og så hænger, til fail kaldes (Stop eller en afbrudt forbindelse). */
function hangingBody(onPull: (fail: (e: unknown) => void) => void) {
  let sent = false;
  return new ReadableStream<Uint8Array>({
    pull(c) {
      if (!sent) {
        sent = true;
        c.enqueue(new TextEncoder().encode('data: {"type":"text","text":"Hej"}\n\n'));
        return;
      }
      return new Promise<void>((_, reject) => onPull(reject));
    },
  });
}

test("C1: Stop midt i svaret: streamChat vender stille tilbage (ingen 'BodyStreamBuffer was aborted')", async () => {
  const ctrl = new AbortController();
  const body = hangingBody((fail) => ctrl.signal.addEventListener("abort", () => fail(new DOMException("BodyStreamBuffer was aborted", "AbortError"))));
  const fetcher = (async () => new Response(body, { status: 200 })) as unknown as typeof fetch;
  const events: ChatEvent[] = [];
  await streamChat(
    { message: "Hej" },
    (e) => {
      events.push(e);
      ctrl.abort();
    },
    { fetcher, signal: ctrl.signal },
  );
  assert.deepEqual(events, [{ type: "text", text: "Hej" }]);
});

test("C1: forbindelsen afbrudt midt i svaret: dansk fejl med status 0, aldrig browserens tekst", async () => {
  const body = hangingBody((fail) => setTimeout(() => fail(new TypeError("network error")), 5));
  const fetcher = (async () => new Response(body, { status: 200 })) as unknown as typeof fetch;
  const events: ChatEvent[] = [];
  await assert.rejects(streamChat({ message: "Hej" }, (e) => events.push(e), { fetcher }), (e: unknown) => e instanceof ChatHttpError && e.status === 0 && e.message === STREAM_BROKEN);
  assert.equal(STREAM_BROKEN, "Forbindelsen blev afbrudt.");
  assert.equal(events.length, 1);
});

test("markdown: fed, links, punktlister; aldrig HTML", () => {
  assert.deepEqual(parseInline("Se **LASSO X** på [Lasso](https://lassox.com) <b>"), [
    { kind: "text", text: "Se " },
    { kind: "bold", text: "LASSO X" },
    { kind: "text", text: " på " },
    { kind: "link", text: "Lasso", href: "https://lassox.com" },
    { kind: "text", text: " <b>" },
  ]);
  const blocks = parseBlocks("Ejere:\n\n- Holm Holding 60 %\n- Søren Berg 40 %");
  assert.equal(blocks[0]!.kind, "p");
  assert.equal(blocks[1]!.kind, "ul");
  // javascript:-links bliver tekst.
  assert.deepEqual(parseInline("[x](javascript:alert(1))"), [{ kind: "text", text: "[x](javascript:alert(1))" }]);
});

test("markdown: lasso:-links bliver modulknapper; ugyldige id'er og fokus bliver tekst; en linjerække bliver et links-afsnit", () => {
  assert.deepEqual(parseInline("Se [Risiko](lasso:modul/risiko), [Novo](lasso:firma/CVR-1-24256790) og [Mette](lasso:person/CVR-3-4000123)."), [
    { kind: "text", text: "Se " },
    { kind: "module", text: "Risiko", target: { kind: "modul", focus: "risiko" } },
    { kind: "text", text: ", " },
    { kind: "module", text: "Novo", target: { kind: "firma", id: "CVR-1-24256790" } },
    { kind: "text", text: " og " },
    { kind: "module", text: "Mette", target: { kind: "person", id: "CVR-3-4000123" } },
    { kind: "text", text: "." },
  ]);
  // Personfokus (netvaerk) er gyldigt; ukendte fokus, forkerte id'er (person-id på firma) og ukendte typer er almindelig tekst.
  assert.equal(parseInline("[Netværk](lasso:modul/netvaerk)")[0]!.kind, "module");
  for (const bad of ["[x](lasso:modul/findes-ikke)", "[x](lasso:firma/CVR-3-4000123)", "[x](lasso:person/CVR-1-24256790)", "[x](lasso:firma/abc)", "[x](lasso:andet/risiko)"]) assert.deepEqual(parseInline(bad), [{ kind: "text", text: bad }], bad);
  const blocks = parseBlocks("Lasso har ikke regnskab for 2025.\n\n[Regnskab](lasso:modul/regnskab) [Risiko](lasso:modul/risiko)");
  assert.equal(blocks[0]!.kind, "p");
  assert.deepEqual(blocks[1], {
    kind: "links",
    items: [
      { kind: "module", text: "Regnskab", target: { kind: "modul", focus: "regnskab" } },
      { kind: "module", text: "Risiko", target: { kind: "modul", focus: "risiko" } },
    ],
  });
  // Blandet med tekst er det et almindeligt afsnit.
  assert.equal(parseBlocks("Se [Risiko](lasso:modul/risiko) nu")[0]!.kind, "p");
});

test("GLOBAL_TITLES er de samme som serverens (chat/context.ts)", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("../../../server/src/chat/context.ts", import.meta.url), "utf8");
  const m = /GLOBAL_TITLES = (\[[^\]]+\])/.exec(src)!;
  assert.deepEqual(GLOBAL_TITLES, JSON.parse(m[1]!));
});

test("done: fresh og placement med decided/here/title kan typesættes og læses", () => {
  const { events } = splitSse('data: {"type":"done","history":[],"sig":"s","fresh":true,"placement":{"placement":"global","title":"Kort","decided":true}}\n\n');
  const done = events[0] as Extract<ChatEvent, { type: "done" }>;
  assert.equal(done.fresh, true);
  assert.deepEqual(done.placement, { placement: "global", title: "Kort", decided: true });
});
