import { existsSync } from "node:fs";
import type { Browser, Page } from "playwright-core";
import type { Config } from "../config.js";
import { createPrintJob, type PrintJob } from "./printPages.js";

/**
 * "Gem som PDF" på serveren: én delt Chromium (playwright-core), startet dovent ved første PDF og
 * lukket efter 5 minutters stilhed. Højst 2 sider tegnes ad gangen; resten venter i kø. Hver PDF har
 * PDF_TIMEOUT_MS (25 s). Fejler en PDF, lukkes browseren, og næste kald starter en ny.
 *
 * Chromium åbner print-siden på loopback (/print/<token>, printPages.ts), som tegner visningen med
 * samme render-app som skærmen, og gemmer den som A4. Kun loopback: alle andre adresser afvises, så
 * siden aldrig henter noget udefra (fonte er indlejret i render-appen).
 */

/** Uden Chromium er PDF slået fra: knappen skjules, ruterne svarer 503, /health viser pdf: false. */
export function pdfAvailable(config: Pick<Config, "PDF_CHROMIUM_PATH">): boolean {
  const path = config.PDF_CHROMIUM_PATH.trim();
  return path.length > 0 && existsSync(path);
}

export const PDF_UNAVAILABLE = "PDF er ikke slået til på denne server.";

export class PdfUnavailableError extends Error {
  constructor() {
    super(PDF_UNAVAILABLE);
    this.name = "PdfUnavailableError";
  }
}

/**
 * Chromium i en container uden brugernavnerum kan ikke starte sin egen sandbox; siden, den åbner, er
 * serverens egen print-side på loopback med serverens egne data, og alle andre adresser blokeres.
 * /dev/shm er lille i containere, og der er ingen GPU.
 */
export const CHROMIUM_ARGS = ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"];

/** A4 i CSS-pixels ved 96 dpi. */
export const A4_WIDTH_PX = 794;
export const A4_HEIGHT_PX = 1123;

/** Sidehoved og sidefod til side-PDF'er; print-siden lægger dem på window.__LASSO_PRINT__. */
interface PrintTemplates {
  headerTemplate: string;
  footerTemplate: string;
  /** Så meget skaleres visningen (794 px bred) for at passe inden for margenerne. */
  scale: number;
}

export interface PdfRenderer {
  /** Findes Chromium (PDF_CHROMIUM_PATH)? */
  readonly available: boolean;
  /** Laver PDF'en. label står i loggen, fx "company CVR-1-12345678". */
  render(job: PrintJob, label: string): Promise<Buffer>;
  /** Lukker browseren (nedlukning og tests). */
  close(): Promise<void>;
}

export interface PdfRendererOptions {
  /** Porten, serveren lytter på (config.PORT), læst ved hver PDF, så tests kan sætte den efter listen(). */
  port: () => number;
  executablePath: string;
  timeoutMs: number;
  /** Lukkes efter så lang stilhed. Standard 5 minutter. */
  idleMs?: number;
  /** Højst så mange sider ad gangen. Standard 2. */
  concurrency?: number;
  /** Til tests: en anden måde at starte browseren på. */
  launch?: (executablePath: string) => Promise<Browser>;
  log?: (line: string) => void;
}

async function launchChromium(executablePath: string): Promise<Browser> {
  const { chromium } = await import("playwright-core");
  return chromium.launch({ executablePath, args: CHROMIUM_ARGS });
}

/** "2.3 s" til loggen. */
function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)} s`;
}

export function createPdfRenderer(opts: PdfRendererOptions): PdfRenderer {
  const idleMs = opts.idleMs ?? 5 * 60_000;
  const concurrency = Math.max(1, opts.concurrency ?? 2);
  const launch = opts.launch ?? launchChromium;
  const log = opts.log ?? ((line: string) => console.log(line));
  const available = existsSync(opts.executablePath);

  let browser: Promise<Browser> | null = null;
  let idle: NodeJS.Timeout | null = null;
  let active = 0;
  const waiting: (() => void)[] = [];

  const closeBrowser = async () => {
    const current = browser;
    browser = null;
    if (idle) clearTimeout(idle);
    idle = null;
    if (!current) return;
    try {
      await (await current).close();
    } catch {
      // Browseren er allerede væk (crash eller lukket); næste kald starter en ny.
    }
  };

  const getBrowser = (): Promise<Browser> => {
    if (!browser) {
      const started = launch(opts.executablePath).then((b) => {
        b.on("disconnected", () => {
          if (browser === started) browser = null;
        });
        return b;
      });
      started.catch(() => {
        if (browser === started) browser = null;
      });
      browser = started;
    }
    return browser;
  };

  const acquire = async () => {
    if (idle) {
      clearTimeout(idle);
      idle = null;
    }
    if (active < concurrency) {
      active++;
      return;
    }
    await new Promise<void>((resolve) => waiting.push(resolve));
  };

  const release = () => {
    const next = waiting.shift();
    if (next) return next(); // pladsen går direkte videre; active er uændret
    active--;
    if (active === 0 && browser) {
      idle = setTimeout(() => void closeBrowser(), idleMs);
      idle.unref();
    }
  };

  async function draw(page: Page, job: PrintJob): Promise<Buffer> {
    const port = opts.port();
    const origin = `http://127.0.0.1:${port}`;
    // Print-siden må kun hente fra serveren selv (render-appen er én fil med indlejrede fonte).
    await page.route("**/*", (route) => (route.request().url().startsWith(`${origin}/`) ? route.continue() : route.abort()));
    const token = createPrintJob(job);
    await page.goto(`${origin}/print/${token}`, { waitUntil: "networkidle", timeout: opts.timeoutMs });
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    await page.waitForFunction(() => document.documentElement.dataset.lassoReady === "1", undefined, { timeout: opts.timeoutMs });
    const templates =
      job.kind === "page" ? await page.evaluate(() => (window as unknown as { __LASSO_PRINT__?: PrintTemplates }).__LASSO_PRINT__ ?? null) : null;
    return page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
      ...(templates
        ? { displayHeaderFooter: true, headerTemplate: templates.headerTemplate, footerTemplate: templates.footerTemplate, scale: templates.scale }
        : {}),
    });
  }

  async function render(job: PrintJob, label: string): Promise<Buffer> {
    if (!available) throw new PdfUnavailableError();
    await acquire();
    const started = Date.now();
    let page: Page | null = null;
    let timer: NodeJS.Timeout | undefined;
    try {
      const b = await getBrowser();
      // Dansk tid og sprog, så datastempler og datoer i visningen er de samme som hos brugeren.
      page = await b.newPage({ viewport: { width: A4_WIDTH_PX, height: A4_HEIGHT_PX }, deviceScaleFactor: 1, timezoneId: "Europe/Copenhagen", locale: "da-DK" });
      const work = draw(page, job);
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`PDF'en tog mere end ${seconds(opts.timeoutMs)}.`)), opts.timeoutMs);
      });
      work.catch(() => {}); // en fejl efter timeout skal ikke blive en uhåndteret afvisning
      const pdf = await Promise.race([work, timeout]);
      log(`[pdf] ${label} ${seconds(Date.now() - started)}`);
      return pdf;
    } catch (err) {
      log(`[pdf] ${label} fejlede efter ${seconds(Date.now() - started)}: ${err instanceof Error ? err.message : String(err)}`);
      // Ved fejl lukkes browseren; næste kald starter en ny.
      page = null;
      await closeBrowser();
      throw err;
    } finally {
      if (timer) clearTimeout(timer);
      if (page) await page.close().catch(() => {});
      release();
    }
  }

  return { available, render, close: closeBrowser };
}

/** Rendereren til serveren: Chromium fra PDF_CHROMIUM_PATH, port og timeout fra config. */
export function pdfRendererFor(config: Config): PdfRenderer {
  return createPdfRenderer({ port: () => config.PORT, executablePath: config.PDF_CHROMIUM_PATH.trim(), timeoutMs: config.PDF_TIMEOUT_MS });
}
