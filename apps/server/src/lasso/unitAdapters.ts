import type { Address, ContactVM, LivestockHerdVM, LivestockVM, ProductionUnitVM, ProductionUnitsVM, TextSectionItem, VerifiedPhoneNumberVM, VetEventVM } from "@lasso/spec";
import { mapLimit } from "../data/provider.js";
import { adaptCompany, arr, at, dateStr, isObj, num, pick, statusKind, str, address, type Json } from "./adapters.js";
import { htmlToText } from "./htmlText.js";

/**
 * Adaptere for de fire nye datakilder (katalog 20 + 08 + 12/19): produktionsenheder med
 * detaljer, CHR, live number og regnskabsanalyse. Kilde: Lassos officielle dokumentation
 * (docs.lassox.com, indsamlet 27.09.2026), se docs/endpoints-enheder-kontakt-analyse.md.
 * Adskilt fra adapters.ts, som andre agenter samtidig ændrer i.
 */

/* ---------- Produktionsenheder (katalog 20) ---------- */

/** Én reference fra company-fulds bekræftede `productionUnits: [{ lassoId, pNumber }]`. */
export interface ProductionUnitRef {
  lassoId: string;
  pNumber: string;
}

/** Højst så mange enheder der hentes detaljer for (parallelt, mapLimit 5). Resten tælles kun med i `total`. */
export const PRODUCTION_UNIT_DETAIL_LIMIT = 25;

/**
 * Læser referencerne fra company-fulds bekræftede felt (docs: "productionUnits | object[] |
 * {lassoId, pNumber}[]"). Mangler feltet, eller kan et element ikke tolkes, springes det over.
 */
export function productionUnitRefs(companyRaw: Json): ProductionUnitRef[] {
  const list = arr(companyRaw, "productionUnits");
  const refs: ProductionUnitRef[] = [];
  const seen = new Set<string>();
  for (const u of list) {
    const lassoId = str(u, "lassoId");
    const pNumber = str(u, "pNumber") ?? (lassoId ? /(\d+)$/.exec(lassoId)?.[1] : undefined);
    if (!lassoId || !pNumber || seen.has(lassoId)) continue;
    seen.add(lassoId);
    refs.push({ lassoId, pNumber });
  }
  return refs;
}

/**
 * Én produktionsenheds detaljer fra `GET /{CVR-2-…}` (bekræftet form, docs.lassox.com):
 * lassoId, pNumber, name, cvr, status, lifeTime{from,to}, address, industry, employees{count,
 * fullTimeEquivalentCount, …}, creationDate. `isMain` sættes ikke her, men af `mergeProductionUnits`.
 */
export function adaptProductionUnitDetail(ref: ProductionUnitRef, raw: Json): ProductionUnitVM {
  const status = str(raw, "status");
  const endedRaw = dateStr(raw, "lifeTime.to");
  const employees = num(raw, "employees.count", "employees.fullTimeEquivalentCount", "employees.interval.from");
  return {
    pNumber: str(raw, "pNumber") ?? ref.pNumber,
    name: str(raw, "name"),
    address: address(raw),
    industryCode: str(raw, "industry.code"),
    industryText: str(raw, "industry.text", "industry.name"),
    employees: employees ?? null,
    status,
    statusKind: statusKind(status),
    endedYear: endedRaw ? Number(endedRaw.slice(0, 4)) : undefined,
    created: dateStr(raw, "creationDate", "lifeTime.from"),
  };
}

function normAddrPart(s: string | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

/** Samme adresse som virksomheden (gade + postnummer), case-insensitivt. */
function sameAddress(a: Address | undefined, b: Address | undefined): boolean {
  if (!a?.street || !b?.street) return false;
  return normAddrPart(a.street) === normAddrPart(b.street) && normAddrPart(a.zip) === normAddrPart(b.zip);
}

/** Hovedenheden: samme adresse som virksomheden, ellers den ældste (laveste `created`). */
function markMainUnit(units: ProductionUnitVM[], companyAddress: Address | undefined): ProductionUnitVM[] {
  if (units.length === 0) return units;
  let mainIndex = units.findIndex((u) => sameAddress(u.address, companyAddress));
  if (mainIndex === -1) {
    let oldest: string | undefined;
    units.forEach((u, i) => {
      if (u.created && (!oldest || u.created < oldest)) {
        oldest = u.created;
        mainIndex = i;
      }
    });
  }
  if (mainIndex === -1) return units;
  return units.map((u, i) => ({ ...u, isMain: i === mainIndex }));
}

/**
 * Samler de hentede detaljer, en evt. hovedenhedsmarkering og de gamle feltnavne-gæt
 * (`adaptProductionUnits` i adapters.ts, som stadig forsøges bagefter for enheder, detaljekaldet
 * ikke fandt). `total` sættes kun, når virksomheden har flere enheder end der hentes detaljer for.
 */
export function mergeProductionUnits(
  lassoId: string,
  details: ProductionUnitVM[],
  companyAddress: Address | undefined,
  legacyUnits: readonly ProductionUnitVM[],
  total: number,
): ProductionUnitsVM {
  const marked = markMainUnit(details, companyAddress);
  const byPNumber = new Map<string, ProductionUnitVM>();
  for (const u of marked) if (u.pNumber) byPNumber.set(u.pNumber, u);
  for (const u of legacyUnits) if (u.pNumber && !byPNumber.has(u.pNumber)) byPNumber.set(u.pNumber, u);
  const units = [...byPNumber.values()].sort((a, b) => (b.isMain ? 1 : 0) - (a.isMain ? 1 : 0));
  return { lassoId, units, ...(total > PRODUCTION_UNIT_DETAIL_LIMIT ? { total } : {}) };
}

/**
 * Henter og samler produktionsenhederne for én virksomhed: referencerne fra company-full, højst
 * `PRODUCTION_UNIT_DETAIL_LIMIT` detaljeopslag parallelt (mapLimit 5, via `fetchDetail`), og de
 * gamle feltnavne-gæt som reserve. Fejler ét enhedsopslag, vises enheden med kun P-nummer
 * ("Ikke oplyst" for resten i UI'en) i stedet for at kaste.
 */
export async function buildProductionUnits(
  lassoId: string,
  companyRaw: Json,
  legacyUnits: readonly ProductionUnitVM[],
  fetchDetail: (unitLassoId: string) => Promise<Json>,
): Promise<ProductionUnitsVM> {
  const refs = productionUnitRefs(companyRaw);
  if (refs.length === 0) return { lassoId, units: [...legacyUnits] };
  const wanted = refs.slice(0, PRODUCTION_UNIT_DETAIL_LIMIT);
  const details = await mapLimit(wanted, 5, async (ref): Promise<ProductionUnitVM> => {
    try {
      return adaptProductionUnitDetail(ref, await fetchDetail(ref.lassoId));
    } catch {
      return { pNumber: ref.pNumber };
    }
  });
  const companyAddress = adaptCompany(lassoId, companyRaw).address;
  return mergeProductionUnits(lassoId, details, companyAddress, legacyUnits, refs.length);
}

/* ---------- CHR (katalog 20) ---------- */

/**
 * Nøgler, som en liste af besætninger/ejendomme kan ligge under. Docs.lassox.com angav ingen
 * eksempel-response for `GET /data/CHR/livestock/{cvr}`; det er derfor uverificerede gæt.
 */
const CHR_LIST_KEYS = ["herds", "livestock", "besaetninger", "properties", "results"] as const;

export const CHR_UNVERIFIED_REASON = "CHR-svarets struktur er ikke verificeret endnu";

/**
 * CHR-husdyrdata (katalog 20). UBEKRÆFTET svarform (se docs/endpoints-enheder-kontakt-analyse.md):
 * leder efter en liste under `herds|livestock|besaetninger|properties|results` (eller et rent
 * array), og i hvert element efter dyreart, antal, CHR-nummer og hændelser. Genkendes ingen af
 * disse nøgler, gives en tom VM med `unavailableReason` i stedet for et (muligvis forkert) gæt.
 */
export function adaptChrLivestock(lassoId: string, raw: Json): LivestockVM {
  const known = Array.isArray(raw) || (isObj(raw) && CHR_LIST_KEYS.some((k) => Array.isArray(at(raw, k))));
  if (!known) {
    return { lassoId, herds: [], events: [], unavailableReason: CHR_UNVERIFIED_REASON };
  }
  const list = Array.isArray(raw) ? raw : arr(raw, ...CHR_LIST_KEYS);
  const herds: LivestockHerdVM[] = [];
  const events: VetEventVM[] = [];
  let chrNumber = str(raw, "chrNumber", "chrId", "chr");
  for (const item of list) {
    const species = str(item, "species", "animalType", "dyreart", "type");
    const count = num(item, "count", "number", "antal", "animals");
    if (species || count !== undefined) herds.push({ species, count: count ?? null, unit: "dyr" });
    chrNumber = chrNumber ?? str(item, "chrNumber", "chrId", "chr");
    for (const e of arr(item, "events", "veterinaryEvents", "haendelser")) {
      events.push({
        title: str(e, "type", "name"),
        detail: str(e, "description"),
        date: dateStr(e, "date", "time"),
      });
    }
  }
  return { lassoId, chrNumber, herds, events };
}

/* ---------- Live number (katalog 08) ---------- */

/**
 * Live number (bekræftet form, docs.lassox.com): `{ lassoId, updated, isRobinson,
 * isCommerciallyProtected, numbers: [{ phoneNumber, sources, score, explanation, callable,
 * obfuscated }] }`. Obfuskerede numre udelades; resten sorteres efter score og beskæres til 3.
 * undefined, når svaret intet brugbart indeholder (ingen numre og ikke Robinson).
 */
export function adaptLiveNumber(raw: Json): Pick<ContactVM, "verifiedNumbers" | "isRobinson" | "verifiedAt"> | undefined {
  if (!isObj(raw)) return undefined;
  const verifiedNumbers: VerifiedPhoneNumberVM[] = arr(raw, "numbers")
    .filter((n) => pick(n, "obfuscated") !== true)
    .map((n): VerifiedPhoneNumberVM | null => {
      const phoneNumber = str(n, "phoneNumber", "number");
      if (!phoneNumber) return null;
      const sources = arr(n, "sources")
        .map((s) => str(s, "type"))
        .filter((s): s is string => Boolean(s));
      return {
        phoneNumber,
        score: num(n, "score"),
        explanation: str(n, "explanation"),
        callable: pick(n, "callable") === true,
        sources,
      };
    })
    .filter((n): n is VerifiedPhoneNumberVM => n !== null)
    .sort((a, b) => (b.score ?? -Infinity) - (a.score ?? -Infinity))
    .slice(0, 3);
  const isRobinson = pick(raw, "isRobinson") === true;
  if (verifiedNumbers.length === 0 && !isRobinson) return undefined;
  return {
    verifiedNumbers: verifiedNumbers.length ? verifiedNumbers : undefined,
    isRobinson: isRobinson ? true : undefined,
    verifiedAt: dateStr(raw, "updated"),
  };
}

/* ---------- Regnskabsanalyse (katalog 12/19) ---------- */

/**
 * Bygger tekstsektionen "Regnskabsanalyse" ud fra svaret fra `POST /modules/reportanalysis/{lassoId}`.
 * Docs beskriver et rent HTML-svar; hvis Lasso i stedet pakker det i JSON, forsøges almindelige
 * feltnavne. undefined ved tomt/ukendt svar (sektionen udelades da helt, katalogregel 4/5: ingen
 * AI-mærke, ingen bannerboks — dette er en almindelig tekstsektion med kildelinje).
 */
export function adaptReportAnalysisSection(raw: Json): TextSectionItem | undefined {
  const html = typeof raw === "string" ? raw : str(raw, "text", "analysis", "html", "content", "result", "summary");
  if (!html) return undefined;
  const body = htmlToText(html);
  if (!body) return undefined;
  return { heading: "Regnskabsanalyse", body, note: "Kilde: Lasso regnskabsanalyse" };
}
