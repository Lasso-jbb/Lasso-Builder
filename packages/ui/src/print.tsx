import { createContext, useContext, type ReactNode } from "react";
import { LASSO_MARK_PATH, LASSO_WORDMARK_PATH, LassoMark, LassoWordmark } from "./LassoMark.js";

/**
 * Print-tilstand ("Gem som PDF" for alle andre sider end virksomhedsrapporten): serverens Chromium
 * tegner visningen på A4 (794 px bred) uden handlingsbjælke, modulbjælke og knapper. Komponenterne
 * læser tilstanden med usePrintMode(): "Se alle" og "Vis hele" står foldet ud, og faner (Tabs) står
 * som overskrifter. Sidehoved og sidefod gentages på hver side (pageTemplates nedenfor).
 */
const PrintModeContext = createContext(false);

export function PrintMode({ value, children }: { value: boolean; children: ReactNode }) {
  return <PrintModeContext.Provider value={value}>{children}</PrintModeContext.Provider>;
}

/** true, når visningen tegnes til PDF: fold alt ud, og vis ingen knapper. */
export function usePrintMode(): boolean {
  return useContext(PrintModeContext);
}

/** A4 stående ved 96 dpi. */
export const A4_WIDTH_PX = 794;
/** Margen på hver side af arket (@page { margin: 14mm }); sidehoved og sidefod står i margenen. */
export const PAGE_MARGIN_MM = 14;
const MM = 96 / 25.4;

/**
 * Visningen tegnes 794 px bred og skaleres ned, så den passer mellem margenerne (ca. 0,867):
 * samme brudpunkter som på skærmen, og intet klippes i højre side.
 */
export function pageScale(): number {
  return Math.round(((A4_WIDTH_PX - 2 * PAGE_MARGIN_MM * MM) / A4_WIDTH_PX) * 10_000) / 10_000;
}

/** "28.09.2026" og "12.22" i dansk tid. */
export function printStamp(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: iso.slice(0, 10), time: "" };
  const parts = new Intl.DateTimeFormat("da-DK", {
    timeZone: "Europe/Copenhagen",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { date: `${get("day")}.${get("month")}.${get("year")}`, time: `${get("hour")}.${get("minute")}` };
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);

export interface PageTemplateInput {
  /** Sidens navn: personen eller visningens titel. */
  title: string;
  /** Datasættets tidsstempel. */
  generatedAt: string;
  /** @font-face-regler (Poppins indlejret som data-URL), så sidehovedet har samme skrift som siden. */
  fontFaces?: string;
}

/**
 * Sidehoved og sidefod til side-PDF'en (Chromiums headerTemplate/footerTemplate): de står i
 * margenen på hvert ark og kan ikke bruge sidens stylesheet, så alt er inline. Samme opbygning som
 * rapporten (katalog 27): Lasso-mærket, navnet og datastemplet øverst; "Udarbejdet i Lasso"
 * og "side x af n" nederst. pageNumber og totalPages udfyldes af Chromium.
 */
export function pageTemplates({ title, generatedAt, fontFaces = "" }: PageTemplateInput): { headerTemplate: string; footerTemplate: string } {
  const stamp = printStamp(generatedAt);
  // Chromium tegner skabelonerne i margenen (14 mm) i fuld arkbredde med 4 mm luft over sidehovedet og
  // under sidefoden, så linjerne står 3 mm fra indholdet.
  const font = `font-family:Poppins,'Liberation Sans','Noto Sans',Arial,sans-serif;font-size:8.5px;line-height:12px;color:#5b6068;-webkit-print-color-adjust:exact;print-color-adjust:exact;`;
  const row = "display:flex;align-items:center;justify-content:space-between;gap:12px;";
  const style = fontFaces ? `<style>${fontFaces}</style>` : "";
  const mark = (w: number, h: number) =>
    `<svg viewBox="0 0 117 97" width="${w}" height="${h}" style="flex:none;color:#16181d" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" clip-rule="evenodd" d="${LASSO_MARK_PATH}"/></svg>`;
  // Jakob 01.10: logo og navnelogo i alle print.
  const wordmark = (w: number, h: number) =>
    `<svg viewBox="0 0 453 132" width="${w}" height="${h}" style="flex:none;color:#16181d" fill="currentColor" aria-label="Lasso"><path fill-rule="evenodd" clip-rule="evenodd" d="${LASSO_WORDMARK_PATH}"/></svg>`;
  const headerTemplate =
    `${style}<div style="box-sizing:border-box;width:100%;padding:0 ${PAGE_MARGIN_MM}mm;${font}">` +
    `<div style="${row}padding-bottom:2mm;border-bottom:1px solid #e6e7eb;">` +
    `<span style="display:flex;align-items:center;gap:6px;min-width:0;">${mark(14, 12)}${wordmark(38, 11)}<span style="width:1px;height:10px;background:#e6e7eb;margin:0 2px;"></span><span style="font-weight:600;color:#16181d;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(title)}</span></span>` +
    `<span style="white-space:nowrap;">Data hentet ${stamp.date}${stamp.time ? ` kl. ${stamp.time}` : ""}</span>` +
    `</div></div>`;
  const footerTemplate =
    `${style}<div style="box-sizing:border-box;width:100%;padding:0 ${PAGE_MARGIN_MM}mm;${font}">` +
    `<div style="${row}padding-top:2mm;border-top:1px solid #e6e7eb;">` +
    `<span style="min-width:0;">Data pr. ${stamp.date}</span>` +
    `<span style="display:flex;align-items:center;gap:6px;white-space:nowrap;">${mark(12, 10)}<span>Udarbejdet i Lasso, lassox.com, side <span class="pageNumber"></span> af <span class="totalPages"></span></span></span>` +
    `</div></div>`;
  return { headerTemplate, footerTemplate };
}

/**
 * Forsiden på alle side-PDF'er (Jakob 01.10, katalog 27.1): logo og navnelogo, navnet og området, man har
 * printet (fx "Økonomi"), og hvornår data er hentet. Står alene på første ark; siden følger fra ark 2.
 */
export function PrintCover({ title, area, generatedAt }: { title: string; area?: string; generatedAt?: string }) {
  const stamp = generatedAt ? printStamp(generatedAt) : undefined;
  return (
    <section className="lasso-printcover" aria-label="Forside">
      <div className="lasso-printcover__brand">
        <LassoMark className="lasso-printcover__mark" />
        <LassoWordmark className="lasso-printcover__wordmark" />
      </div>
      <div className="lasso-printcover__main">
        <p className="lasso-printcover__over">Udskrift fra Lasso</p>
        <h1 className="lasso-printcover__title">{title}</h1>
        {area ? <p className="lasso-printcover__area">{area}</p> : null}
        {stamp ? <p className="lasso-printcover__stamp">Data hentet {stamp.date}{stamp.time ? ` kl. ${stamp.time}` : ""}</p> : null}
      </div>
      <p className="lasso-printcover__foot">Udarbejdet i Lasso, lassox.com. Alle sektioner er foldet helt ud.</p>
    </section>
  );
}

/**
 * Udskriv (og dermed "Gem som PDF") ét element på siden: resten skjules under udskriften
 * (styles.css, "Udskrift af ét element"). Bruges af revisoruafhængighedens og ejerdiagrammets
 * PDF-eksport. Uden browser (SSR, tests) gør den ingenting og svarer false.
 */
export function printElement(el: HTMLElement | null): boolean {
  if (!el || typeof window === "undefined" || typeof document === "undefined" || typeof window.print !== "function") return false;
  const root = document.documentElement;
  el.classList.add("lasso-print-target");
  root.classList.add("lasso-printing");
  const done = () => {
    el.classList.remove("lasso-print-target");
    root.classList.remove("lasso-printing");
    window.removeEventListener("afterprint", done);
  };
  window.addEventListener("afterprint", done);
  try {
    window.print();
  } finally {
    // Nogle browsere sender aldrig afterprint (fx i en iframe); ryd op efter udskriftsdialogen.
    setTimeout(done, 1000);
  }
  return true;
}
