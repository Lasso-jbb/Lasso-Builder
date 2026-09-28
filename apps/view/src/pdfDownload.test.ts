import assert from "node:assert/strict";
import { test } from "node:test";
import { blobToBase64, downloadPdfInHost, filenameFromDisposition, PDF_OPENED, PDF_SAVED, pdfErrorText, type PdfHost } from "./pdfDownload.js";

const PDF_BYTES = new TextEncoder().encode("%PDF-1.4 test");
const DISPOSITION = "attachment; filename=\"Virksomhedsrapport Moeller A-S 2026-09-28.pdf\"; filename*=UTF-8''Virksomhedsrapport%20M%C3%B8ller%20A-S%202026-09-28.pdf";

function pdfFetch(status = 200, body: BodyInit | null = PDF_BYTES, headers: Record<string, string> = { "content-type": "application/pdf", "content-disposition": DISPOSITION }) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetcher = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return new Response(body, { status, headers });
  }) as unknown as typeof fetch;
  return { calls, fetcher };
}

function host(opts: { downloadError?: boolean; downloadThrows?: boolean; openError?: boolean } = {}) {
  const downloads: Parameters<PdfHost["downloadFile"]>[0][] = [];
  const opened: string[] = [];
  const h: PdfHost = {
    async downloadFile(params) {
      if (opts.downloadThrows) throw new Error("Method not found");
      downloads.push(params);
      return { isError: Boolean(opts.downloadError) };
    },
    async openLink({ url }) {
      opened.push(url);
      return { isError: Boolean(opts.openError) };
    },
  };
  return { h, downloads, opened };
}

const LINK = "https://lasso.example/k/99000001.pdf?m=omsaetning&y=5&e=abc&s=sig";

test("filnavn fra Content-Disposition: filename* (UTF-8) før filename", () => {
  assert.equal(filenameFromDisposition(DISPOSITION), "Virksomhedsrapport Møller A-S 2026-09-28.pdf");
  assert.equal(filenameFromDisposition('attachment; filename="Bo Eksempel 2026-09-28.pdf"'), "Bo Eksempel 2026-09-28.pdf");
  assert.equal(filenameFromDisposition(null), undefined);
});

test("MCP-appen: PDF'en hentes og gemmes gennem værten som application/pdf-blob", async () => {
  const { calls, fetcher } = pdfFetch();
  const { h, downloads, opened } = host();
  const res = await downloadPdfInHost(h, LINK, { fetcher });
  assert.deepEqual(res, { ok: true, message: PDF_SAVED });
  assert.equal(calls[0]!.url, LINK);
  assert.equal(downloads.length, 1);
  const resource = downloads[0]!.contents[0]!.resource;
  assert.equal(resource.mimeType, "application/pdf");
  assert.equal(resource.uri, `file:///${encodeURIComponent("Virksomhedsrapport Møller A-S 2026-09-28.pdf")}`);
  assert.equal(Buffer.from(resource.blob, "base64").toString("latin1"), "%PDF-1.4 test");
  assert.deepEqual(opened, []);
});

test("MCP-appen: kan linket ikke hentes, eller afviser værten download, åbnes linket i stedet", async () => {
  const blocked = (async () => {
    throw new TypeError("Failed to fetch");
  }) as unknown as typeof fetch;
  const a = host();
  assert.deepEqual(await downloadPdfInHost(a.h, LINK, { fetcher: blocked }), { ok: true, message: PDF_OPENED });
  assert.deepEqual(a.opened, [LINK]);
  assert.equal(a.downloads.length, 0);

  const b = host({ downloadError: true });
  assert.deepEqual(await downloadPdfInHost(b.h, LINK, { fetcher: pdfFetch().fetcher }), { ok: true, message: PDF_OPENED });
  assert.deepEqual(b.opened, [LINK]);

  const c = host({ downloadThrows: true });
  await downloadPdfInHost(c.h, LINK, { fetcher: pdfFetch().fetcher });
  assert.deepEqual(c.opened, [LINK]);

  // Kan værten heller ikke åbne links, prøves browserens eget vindue.
  const d = host({ downloadError: true, openError: true });
  const windows: string[] = [];
  assert.deepEqual(await downloadPdfInHost(d.h, LINK, { fetcher: pdfFetch().fetcher, openWindow: (u) => (windows.push(u), true) }), { ok: true, message: PDF_OPENED });
  assert.deepEqual(windows, [LINK]);
  const e = host({ downloadError: true, openError: true });
  const failed = await downloadPdfInHost(e.h, LINK, { fetcher: pdfFetch().fetcher, openWindow: () => false });
  assert.equal(failed.ok, false);
});

test("MCP-appen: serverens fejl (udløbet link, ingen Chromium) vises; linket åbnes ikke", async () => {
  const expired = host();
  const res = await downloadPdfInHost(expired.h, LINK, { fetcher: pdfFetch(410, "<html></html>", { "content-type": "text/html" }).fetcher });
  assert.deepEqual(res, { ok: false, error: "Linket til PDF'en er udløbet. Vis siden igen for at få et nyt." });
  assert.deepEqual(expired.opened, []);
  const off = host();
  const res503 = await downloadPdfInHost(off.h, LINK, { fetcher: pdfFetch(503, JSON.stringify({ error: "PDF er ikke slået til på denne server." }), { "content-type": "application/json" }).fetcher });
  assert.deepEqual(res503, { ok: false, error: "PDF er ikke slået til på denne server." });
  assert.equal(pdfErrorText(500, null), "PDF'en kunne ikke laves (fejl 500). Prøv igen om lidt.");
});

test("base64 af større filer (i bidder)", async () => {
  const bytes = new Uint8Array(100_000).map((_, i) => i % 256);
  const b64 = await blobToBase64(new Blob([bytes]));
  assert.deepEqual(new Uint8Array(Buffer.from(b64, "base64")), bytes);
});
