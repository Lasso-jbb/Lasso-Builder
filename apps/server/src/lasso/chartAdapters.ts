import type { IndustryBenchmarkVM, MapPointVM, MapVM, Metric } from "@lasso/spec";
import { arr, items, num, pick, str, type Json } from "./adapters.js";

/**
 * Defensive adaptere til graferne i katalog 13 uden bekræftet kilde (docs/lasso-endpoints.md,
 * "Ubekræftet: branchetal" og "Ubekræftet: koordinater"). Alle felter er valgfrie; ukendte former
 * giver tom/"unavailable" med årsag, aldrig en fejl.
 */

/** Feltnavne, et branchesvar kan bruge pr. nøgletal (dansk nøgle først, så Lassos engelske/XBRL-lignende). */
const INDUSTRY_FIELDS: Partial<Record<Metric, string[]>> = {
  soliditetsgrad: ["soliditetsgrad", "solvencyRatio", "equityRatio", "solidity"],
  overskudsgrad: ["overskudsgrad", "profitMargin", "operatingMargin", "ebitMargin"],
  likviditetsgrad: ["likviditetsgrad", "liquidityRatio", "currentRatio"],
  bruttofortjeneste: ["bruttofortjeneste", "grossProfit", "grossprofitloss"],
  omsaetning: ["omsaetning", "revenue", "netRevenue"],
  resultat: ["resultat", "profit", "profitLoss", "netIncome"],
  egenkapital: ["egenkapital", "equity"],
  ansatte: ["ansatte", "employees"],
};

/**
 * ANTAGET form (ubekræftet): `{ industryCode, industryText|description, companyCount|peers,
 * years|keyFigures: [{ year, median: { soliditetsgrad, … } | soliditetsgrad, … }] }`. Tal i procent
 * (32,5) eller brøk (0,325) accepteres; brøker under 1,5 for procent-nøgletal ganges med 100.
 */
export function adaptIndustryBenchmark(lassoId: string, raw: Json, fallback: { industryCode?: string; industryText?: string } = {}): IndustryBenchmarkVM {
  const rows = arr(raw, "years", "keyFigures", "statistics", "data").length ? arr(raw, "years", "keyFigures", "statistics", "data") : items(raw);
  const years: IndustryBenchmarkVM["years"] = [];
  for (const r of rows) {
    const year = num(r, "year", "fiscalYear", "period.year");
    if (!year) continue;
    const src = pick(r, "median", "medians", "values") ?? r;
    const median: IndustryBenchmarkVM["years"][number]["median"] = {};
    for (const [m, keys] of Object.entries(INDUSTRY_FIELDS) as [Metric, string[]][]) {
      const v = num(src, ...keys);
      if (typeof v !== "number") continue;
      const pct = m === "soliditetsgrad" || m === "overskudsgrad" || m === "likviditetsgrad";
      median[m] = pct && Math.abs(v) < 1.5 && m !== "likviditetsgrad" ? Math.round(v * 1000) / 10 : v;
    }
    if (Object.keys(median).length) years.push({ year, median });
  }
  years.sort((a, b) => a.year - b.year);
  const industryCode = str(raw, "industryCode", "industry.code", "code") ?? fallback.industryCode;
  const industryText = str(raw, "industryText", "industry.description", "description", "name") ?? fallback.industryText;
  if (years.length === 0) {
    return { lassoId, state: "unavailable", reason: "Lasso har ingen branchetal for virksomhedens branche endnu.", industryCode, industryText, years: [] };
  }
  return {
    lassoId,
    state: "ok",
    industryCode,
    industryText,
    peers: num(raw, "companyCount", "peers", "count", "numberOfCompanies"),
    years,
    source: "Lasso branchestatistik",
    updated: str(raw, "updated", "lastUpdated", "calculatedAt")?.slice(0, 10),
  };
}

/** Koordinater fra et adresseobjekt, uanset om de står som lat/lng, latitude/longitude, wgs84 eller coordinates. */
export function coordinatesOf(address: Json): { lat: number; lon: number } | null {
  const lat = num(address, "latitude", "lat", "wgs84.lat", "wgs84.latitude", "coordinates.lat", "coordinates.latitude", "location.lat", "position.lat");
  const lon = num(address, "longitude", "lon", "lng", "wgs84.lon", "wgs84.lng", "wgs84.longitude", "coordinates.lon", "coordinates.lng", "coordinates.longitude", "location.lon", "location.lng", "position.lng");
  // Kun WGS84 i og omkring Danmark; UTM/ETRS89 (x/y i meter) afvises hellere end at tegnes forkert.
  if (typeof lat !== "number" || typeof lon !== "number" || lat < 53 || lat > 58.5 || lon < 7 || lon > 16) return null;
  return { lat, lon };
}

const addressLine = (a: Json) => {
  const street = str(a, "street", "streetName", "addressLine", "text");
  const no = str(a, "streetNumber", "houseNumber", "number");
  const zip = str(a, "zipCode", "postalCode", "zip");
  const city = str(a, "city", "postalDistrict", "cityName");
  return [[street, no].filter(Boolean).join(" "), [zip, city].filter(Boolean).join(" ")].filter(Boolean).join(", ") || undefined;
};

/**
 * Kortpunkter fra virksomhedens CVR-svar og produktionsenhedernes rå svar. ANTAGET (ubekræftet), at
 * adresseobjekterne kan have WGS84-koordinater; mangler de, tælles adressen i `missing`.
 */
export function adaptMapPoints(lassoId: string, companyRaw: Json, unitsRaw: readonly Json[] = []): MapVM {
  const points: MapPointVM[] = [];
  let missing = 0;
  const name = str(companyRaw, "name", "companyName") ?? lassoId;
  const address = pick(companyRaw, "address", "location");
  const at = coordinatesOf(address);
  if (at) points.push({ id: lassoId, kind: "focus", name, address: addressLine(address), lat: at.lat, lon: at.lon, meta: "Hovedadresse" });
  else missing++;
  unitsRaw.forEach((u, i) => {
    const a = pick(u, "address", "location");
    const c = coordinatesOf(a);
    if (!c) {
      missing++;
      return;
    }
    const p = str(u, "pNumber", "pnumber", "productionUnitNumber");
    points.push({ id: `p-${p ?? i}`, kind: "related", name: str(u, "name") ?? "Produktionsenhed", address: addressLine(a), lat: c.lat, lon: c.lon, meta: p ? `P-nr. ${p}` : undefined });
  });
  if (points.length === 0) {
    return { lassoId, points: [], missing, emptyReason: "Lassos adresser har ingen koordinater for virksomheden endnu, så den kan ikke vises på kort.", source: "CVR via Lasso" };
  }
  return { lassoId, points, ...(missing ? { missing } : {}), source: "CVR via Lasso" };
}
