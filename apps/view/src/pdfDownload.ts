import type { ActionResult } from "@lasso/ui";

/**
 * "Gem som PDF" i værterne: PDF'en laves på serveren (apps/server/src/pdf/) og hentes her som fil.
 * MCP-appen gemmer den gennem værten (app.downloadFile); portalen gemmer den med <a download>.
 */

export const PDF_SAVED = "PDF'en er hentet";
export const PDF_OPENED = "PDF'en åbnes i din browser";

/** Filnavnet fra Content-Disposition: filename* (UTF-8) før filename. */
export function filenameFromDisposition(header: string | null | undefined): string | undefined {
  if (!header) return undefined;
  const star = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(header);
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1].trim());
    } catch {
      // Ugyldig kodning: prøv det almindelige filnavn.
    }
  }
  const plain = /filename\s*=\s*"([^"]*)"/i.exec(header) ?? /filename\s*=\s*([^;]+)/i.exec(header);
  return plain?.[1]?.trim() || undefined;
}

/** Serverens fejl som tekst til brugeren: { error } fra JSON, ellers en tekst ud fra status. */
export function pdfErrorText(status: number, body: unknown): string {
  const error = body && typeof body === "object" ? (body as { error?: unknown }).error : undefined;
  if (typeof error === "string" && error) return error;
  if (status === 403) return "Linket til PDF'en er ugyldigt.";
  if (status === 410) return "Linket til PDF'en er udløbet. Vis siden igen for at få et nyt.";
  if (status === 404) return "PDF'en kunne ikke findes. Vis siden igen, og prøv på ny.";
  return `PDF'en kunne ikke laves (fejl ${status}). Prøv igen om lidt.`;
}

/** Serveren svarede, men ikke med en PDF (fejlen er sagt til brugeren; linket åbnes ikke). */
export class PdfHttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "PdfHttpError";
    this.status = status;
  }
}

export interface FetchedPdf {
  blob: Blob;
  filename: string;
}

/** Henter PDF'en. Kaster PdfHttpError ved et fejlsvar og TypeError, når serveren ikke kan nås. */
export async function fetchPdf(url: string, init: RequestInit = {}, fetcher: typeof fetch = (...a) => fetch(...a)): Promise<FetchedPdf> {
  const res = await fetcher(url, { ...init, headers: { accept: "application/pdf", ...(init.headers ?? {}) } });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new PdfHttpError(res.status, pdfErrorText(res.status, body));
  }
  const blob = await res.blob();
  return { blob, filename: filenameFromDisposition(res.headers.get("content-disposition")) ?? "Lasso.pdf" };
}

/** base64 uden "data:…;base64,"-præfiks (MCP's EmbeddedResource.blob). */
export async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return btoa(binary);
}

/** Det, MCP-appen skal bruge fra værten (App fra @modelcontextprotocol/ext-apps). */
export interface PdfHost {
  downloadFile(params: {
    contents: { type: "resource"; resource: { uri: string; mimeType: string; blob: string } }[];
  }): Promise<{ isError?: boolean }>;
  openLink(params: { url: string }): Promise<{ isError?: boolean }>;
}

/**
 * MCP-appen: hent pdfLink (fetch, blob) og gem filen gennem værten (app.downloadFile). Kan appen
 * ikke hente linket (fx værtens sandkasse), eller afviser værten download, åbnes linket i stedet
 * (app.openLink, ellers window.open); serveren sender PDF'en som vedhæftet fil, så brugeren stadig
 * får den. Et fejlsvar fra serveren (udløbet link, ingen Chromium) vises som fejl.
 */
export async function downloadPdfInHost(
  host: PdfHost,
  url: string,
  opts: { fetcher?: typeof fetch; openWindow?: (url: string) => boolean } = {},
): Promise<ActionResult> {
  try {
    const { blob, filename } = await fetchPdf(url, { mode: "cors", credentials: "omit" }, opts.fetcher);
    const r = await host.downloadFile({
      contents: [{ type: "resource", resource: { uri: `file:///${encodeURIComponent(filename)}`, mimeType: "application/pdf", blob: await blobToBase64(blob) } }],
    });
    if (!r.isError) return { ok: true, message: PDF_SAVED };
  } catch (e) {
    if (e instanceof PdfHttpError) return { ok: false, error: e.message };
    // Hentning eller download-API'et fejlede: åbn linket nedenfor.
  }
  try {
    const r = await host.openLink({ url });
    if (!r.isError) return { ok: true, message: PDF_OPENED };
  } catch {
    // Værten kan ikke åbne links: prøv browserens eget vindue.
  }
  const open =
    opts.openWindow ??
    ((u: string) => {
      // Uden "noopener" i kaldet (så returnerer window.open altid null); forbindelsen klippes bagefter.
      const w = window.open(u, "_blank");
      if (w) w.opener = null;
      return Boolean(w);
    });
  return open(url) ? { ok: true, message: PDF_OPENED } : { ok: false, error: "PDF'en kunne ikke hentes her. Åbn siden i Lasso, og gem den derfra." };
}

/** Portalen og andre browsersider: gem en hentet fil med <a download>. */
export function saveBlob(blob: Blob, filename: string, doc: Document = document): void {
  const a = doc.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  doc.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}
