import assert from "node:assert/strict";
import { test } from "node:test";
import { parseBlocks, parseInline } from "./markdown.js";
import { splitSse, streamChat, type ChatEvent } from "./stream.js";

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
