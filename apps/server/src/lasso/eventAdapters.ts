import type { AnnouncementVM, CompanyEventsVM, FinancialYear, MergerEventVM, MergerPartyVM, PublicationVM } from "@lasso/spec";
import { dateStr, items, pick, str, type Json } from "./adapters.js";

/**
 * Katalog 28.2/28.6/28.8 fra virksomhedens fulde svar (companies/company-full, company-details).
 * ALLE feltnavne er UBEKRÆFTEDE (docs/lasso-endpoints.md, "Ubekræftet: fusioner, Statstidende og
 * publicering"). Adapteren læser defensivt og udelader det, den ikke kan tolke, så en ukendt form
 * giver tomme lister (elementerne udelades eller viser tom tilstand), aldrig opdigtede hændelser.
 */

function party(raw: Json, ceased?: boolean): MergerPartyVM | null {
  if (typeof raw === "string") return raw.trim() ? { name: raw.trim(), ...(ceased ? { ceased } : {}) } : null;
  const name = str(raw, "name", "companyName", "navn");
  if (!name) return null;
  const lassoId = str(raw, "lassoId", "id");
  const gone = ceased ?? (pick(raw, "ceased", "ceasing", "isCeasing") === true ? true : undefined);
  return { name, ...(lassoId ? { lassoId } : {}), ...(gone ? { ceased: true } : {}) };
}

function parties(raw: Json, paths: string[], ceased?: boolean): MergerPartyVM[] {
  for (const p of paths) {
    const v = pick(raw, p);
    if (Array.isArray(v)) return v.map((x) => party(x as Json, ceased)).filter((x): x is MergerPartyVM => Boolean(x));
    if (v && (typeof v === "string" || typeof v === "object")) {
      const one = party(v as Json, ceased);
      if (one) return [one];
    }
  }
  return [];
}

export function adaptMergers(raw: Json): MergerEventVM[] {
  const out: MergerEventVM[] = [];
  for (const [path, type] of [["mergers", "Fusion"], ["demergers", "Spaltning"]] as const) {
    for (const m of items(pick(raw, path) ?? [])) {
      const from = parties(m, ["ceasingCompanies", "from", "mergedCompanies", "ceasing"], true);
      const to = parties(m, ["continuingCompanies", "to", "receivingCompanies", "continuing"]);
      if (!from.length && !to.length) continue;
      out.push({ type, date: dateStr(m, "date", "effectiveDate", "mergerDate", "registrationDate"), from, to });
    }
  }
  return out.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
}

/** Konkurs mørk rød, rekonstruktion/likvidation warning, øvrige tekstfarve (28.8). */
export function announcementSeverity(type: string): AnnouncementVM["severity"] {
  if (/konkurs|bankrupt/i.test(type)) return "bankrupt";
  if (/rekonstruktion|likvidation|tvangsopl|reconstruction|liquidation/i.test(type)) return "warning";
  return "neutral";
}

export function adaptAnnouncements(raw: Json): AnnouncementVM[] {
  const list = items(pick(raw, "statstidende.announcements", "statstidende", "announcements") ?? []);
  return list
    .map((a): AnnouncementVM | null => {
      const type = str(a, "type", "announcementType", "title", "category");
      if (!type) return null;
      const url = str(a, "url", "link");
      return {
        type,
        severity: announcementSeverity(type),
        date: dateStr(a, "date", "publicationDate", "published"),
        text: str(a, "text", "body", "content", "description"),
        ...(url && /^https?:\/\//i.test(url) ? { url } : {}),
      };
    })
    .filter((a): a is AnnouncementVM => Boolean(a))
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
}

/** 28.2: offentliggjorte årsrapporter fra regnskabsårene (samme kilde som nøgletallene), nyeste først. */
export function publicationsFromYears(years: readonly FinancialYear[]): PublicationVM[] {
  return [...years]
    .filter((y) => y.published || y.publicationTime || y.periodEnd)
    .map((y): PublicationVM => {
      const revenue = y.revenue != null;
      return {
        published: (y.published ?? y.publicationTime)?.slice(0, 10),
        periodEnd: y.periodEnd,
        year: y.year,
        kind: "Årsrapport",
        figure: { label: revenue ? "Omsætning" : "Bruttofortjeneste", value: (revenue ? y.revenue : y.grossProfit) ?? null },
      };
    })
    .sort((a, b) => (b.published ?? b.periodEnd ?? "").localeCompare(a.published ?? a.periodEnd ?? ""));
}

export function adaptCompanyEvents(lassoId: string, raw: Json, years: readonly FinancialYear[]): CompanyEventsVM {
  return { lassoId, mergers: adaptMergers(raw), announcements: adaptAnnouncements(raw), publications: publicationsFromYears(years) };
}
