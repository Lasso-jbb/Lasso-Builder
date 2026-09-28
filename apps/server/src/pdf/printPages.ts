import { randomBytes } from "node:crypto";
import type { Request, Response } from "express";
import type { Dataset, ViewSpec } from "@lasso/spec";
import { injectBoot } from "../web/page.js";

/**
 * "Gem som PDF": det, Chromium skal tegne. `report` = virksomhedsrapporten (ReportA4, katalog 27),
 * `page` = selve visningen i print-tilstand (person, lister, render_view, gemte visninger).
 */
export interface PrintJob {
  kind: "report" | "page";
  spec: ViewSpec;
  dataset: Dataset;
  /** Sidens navn: virksomheden, personen eller visningens titel (sidehoved og filnavn). */
  name: string;
  /** ISO-tidsstempel for data (rapportens og sidehovedets datastempel). */
  generatedAt: string;
}

interface Entry {
  job: PrintJob;
  expires: number;
  /** Slettes ved første læsning (print-siden); ellers gyldig til udløb (MCP-appens /x/-links). */
  once: boolean;
}

export interface PrintJobStoreOptions {
  ttlMs: number;
  /** true: et token kan kun læses én gang. */
  once: boolean;
  /** Højst så mange jobs ad gangen; de ældste ryger først. */
  max?: number;
  now?: () => number;
}

/**
 * Et kortlivet lager af print-jobs i hukommelsen, nøglet med et tilfældigt token (32 bytes,
 * base64url). Intet skrives til disk, og intet overlever en genstart. Én proces: kører serveren
 * i flere instanser, skal PDF'en laves i den instans, der oprettede jobbet (det gør makePdf altid,
 * fordi den åbner print-siden på loopback).
 */
export class PrintJobStore {
  private readonly entries = new Map<string, Entry>();
  private readonly ttlMs: number;
  private readonly once: boolean;
  private readonly max: number;
  private readonly now: () => number;

  constructor({ ttlMs, once, max = 200, now = Date.now }: PrintJobStoreOptions) {
    this.ttlMs = ttlMs;
    this.once = once;
    this.max = max;
    this.now = now;
  }

  create(job: PrintJob): string {
    this.sweep();
    while (this.entries.size >= this.max) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
    const token = randomBytes(32).toString("base64url");
    this.entries.set(token, { job, expires: this.now() + this.ttlMs, once: this.once });
    return token;
  }

  /** Jobbet bag tokenet, eller null når det ikke findes, er udløbet eller allerede er læst (once). */
  take(token: string): PrintJob | null {
    const entry = this.entries.get(token);
    if (!entry) return null;
    if (entry.expires <= this.now()) {
      this.entries.delete(token);
      return null;
    }
    if (entry.once) this.entries.delete(token);
    return entry.job;
  }

  get size(): number {
    this.sweep();
    return this.entries.size;
  }

  private sweep(): void {
    const now = this.now();
    for (const [token, entry] of this.entries) if (entry.expires <= now) this.entries.delete(token);
  }
}

/** Print-siden for Chromium: 60 sekunder og kun én læsning. */
export const PRINT_JOB_TTL_MS = 60_000;
/** MCP-appens "Gem som PDF" for render_view og search_companies (/x/<token>.pdf): 10 minutter. */
export const PDF_SNAPSHOT_TTL_MS = 10 * 60_000;

export const printJobs = new PrintJobStore({ ttlMs: PRINT_JOB_TTL_MS, once: true });
export const pdfSnapshots = new PrintJobStore({ ttlMs: PDF_SNAPSHOT_TTL_MS, once: false });

export function createPrintJob(job: PrintJob): string {
  return printJobs.create(job);
}

/** 127.0.0.1, ::1 og IPv4 på en IPv6-socket (::ffff:127.0.0.1). */
export function isLoopback(address: string | undefined): boolean {
  return address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1";
}

/**
 * GET /print/:token: kun for serverens egen Chromium på loopback. Alle andre (også bag en proxy,
 * der sender fra en anden adresse) får 404, som om ruten ikke fandtes. Tokenet slettes ved første
 * læsning, så siden kan ikke hentes igen.
 */
export function printPageHandler(loadHtml: () => Promise<string>, store: PrintJobStore = printJobs) {
  return async (req: Request, res: Response) => {
    if (!isLoopback(req.socket.remoteAddress)) return void res.status(404).json({ error: "Not found" });
    const job = store.take(String(req.params.token ?? ""));
    if (!job) return void res.status(404).json({ error: "Not found" });
    const html = await loadHtml();
    res
      .type("html")
      .set("Cache-Control", "no-store")
      .set("X-Robots-Tag", "noindex")
      .send(injectBoot(html, { mode: "print", ...job }, job.name));
  };
}
