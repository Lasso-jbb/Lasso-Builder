import type { ResumeVM, ValuationVM } from "@lasso/spec";
import { at, dateStr, num, str, type Json } from "./adapters.js";

/**
 * GET /modules/valuations/{lassoId} (og POST /modules/valuations med en liste af ID'er), Jakob 02.10.
 * Svarformen er ikke set endnu (opstartsproben logger den); adapteren læser defensivt: et objekt, en liste
 * (første element for ID'et) eller { valuations | items | data: [...] }. Uden en værdi er tilstanden "unavailable".
 */
export function adaptValuation(raw: Json, lassoId: string): ValuationVM {
  // Bekræftet 02.10 (LASSO X A/S): en liste af kapitalhændelser (kapitalforhøjelser/investeringer) med
  // { share, cvr, date, decisionDate, price, amount, investmentAmount, paymentType, valuation, startingCapital }.
  // Værdiansættelsen er den seneste hændelses `valuation` (selskabets værdi ved den pris).
  const events = capitalEvents(raw);
  if (events) {
    const latest = events
      .map((e) => ({ e, value: num(e, "valuation"), date: dateStr(e, "decisionDate", "date") }))
      .filter((x): x is { e: Json; value: number; date: string | undefined } => typeof x.value === "number" && x.value > 0)
      .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))[0];
    if (!latest) return { lassoId, state: "unavailable", reason: `Ingen værdiansættelse i kapitalhændelserne (${shapeOf(raw)}).` };
    return {
      lassoId,
      state: "ok",
      value: latest.value,
      currency: str(latest.e, "currency") ?? "DKK",
      ...(latest.date ? { date: latest.date } : {}),
      method: "kapitalforhøjelse",
      events: events.length,
    };
  }
  const item = pickItem(raw, lassoId);
  if (!item) return { lassoId, state: "unavailable", reason: `Lasso har ingen værdiansættelse af virksomheden (${shapeOf(raw)}).` };
  const value = num(item, "value", "valuation", "estimatedValue", "estimate", "amount", "equityValue", "enterpriseValue", "valuation.value", "result.value", "mid", "median");
  const low = num(item, "low", "min", "lower", "lowerBound", "range.from", "range.low", "interval.from", "valueLow", "valuation.low");
  const high = num(item, "high", "max", "upper", "upperBound", "range.to", "range.high", "interval.to", "valueHigh", "valuation.high");
  if (value === undefined && (low === undefined || high === undefined)) {
    return { lassoId, state: "unavailable", reason: `Ingen værdi i svaret (${shapeOf(item)}).` };
  }
  return {
    lassoId,
    state: "ok",
    ...(value !== undefined ? { value } : {}),
    ...(low !== undefined ? { low } : {}),
    ...(high !== undefined ? { high } : {}),
    currency: str(item, "currency", "unit", "valuation.currency") ?? "DKK",
    ...(dateOf(item) ? { date: dateOf(item) } : {}),
    ...(str(item, "method", "model", "type") ? { method: str(item, "method", "model", "type") } : {}),
  };
}

/** Listen af kapitalhændelser, når svaret har den form (elementer med `valuation` og `date`/`decisionDate`). */
function capitalEvents(raw: Json): Json[] | undefined {
  const list = Array.isArray(raw) ? raw : (["items", "data", "valuations"].map((k) => at(raw, k)).find(Array.isArray) as Json[] | undefined);
  if (!list?.length) return undefined;
  return list.some((e) => at(e, "valuation") !== undefined && (at(e, "date") !== undefined || at(e, "decisionDate") !== undefined)) ? list : undefined;
}

function dateOf(item: Json): string | undefined {
  return dateStr(item, "date", "valuationDate", "calculated", "calculatedAt", "created", "updated", "reportDate", "period.to");
}

function pickItem(raw: Json, lassoId: string): Json | undefined {
  if (raw === null || raw === undefined || raw === "") return undefined;
  const list = Array.isArray(raw) ? raw : (["valuations", "items", "data", "results"].map((k) => at(raw, k)).find(Array.isArray) as Json[] | undefined);
  if (list) {
    const same = list.find((x) => str(x, "lassoId", "id")?.toUpperCase() === lassoId.toUpperCase());
    return same ?? (list.length === 1 ? list[0] : undefined);
  }
  return typeof raw === "object" ? raw : undefined;
}

/** GET /modules/resume/{lassoId}: { content, lassoId, firstName?, lastName? }. Tom tekst = intet resumé. */
export function adaptResume(raw: Json, lassoId: string): ResumeVM {
  const content = str(raw, "content", "text", "resume")?.trim();
  if (!content) return { lassoId, state: "unavailable", reason: `Lasso har intet erhvervsresumé endnu (${shapeOf(raw)}).` };
  const firstName = str(raw, "firstName");
  const lastName = str(raw, "lastName");
  return { lassoId, state: "ok", content, ...(firstName ? { firstName } : {}), ...(lastName ? { lastName } : {}) };
}

/** Svarets form uden værdier, til fejlsøgning: "tomt svar", "liste med 2" eller "felter: a, b, c". */
export function shapeOf(raw: Json): string {
  if (raw === null || raw === undefined || raw === "") return "tomt svar";
  if (Array.isArray(raw)) return `liste med ${raw.length}${raw[0] && typeof raw[0] === "object" ? `, felter: ${Object.keys(raw[0] as object).slice(0, 12).join(", ")}` : ""}`;
  if (typeof raw === "object") return `felter: ${Object.keys(raw as object).slice(0, 12).join(", ") || "ingen"}`;
  return typeof raw;
}
