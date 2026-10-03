import { statusLabel } from "@lasso/spec";
import type { Address, ContactVM, LivestockHerdVM, LivestockVM, ProductionUnitVM, ProductionUnitsVM, TextSectionItem, VerifiedPhoneNumberVM, VetEventVM } from "@lasso/spec";
import { mapLimit } from "../data/provider.js";
import { adaptCompany, arr, at, dateStr, isObj, num, pick, statusKind, str, address, type Json } from "./adapters.js";
import { htmlToText } from "./htmlText.js";
import { textWithEntities } from "./newsMarkup.js";

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
  const status = statusLabel(str(raw, "status"));
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
    ...contactOf(raw),
  };
}

/**
 * Katalog 20.1: P-enhedens telefon og e-mail. Nuværende form (GET /{CVR-2-…}): `phone`/`email` som tekst;
 * historikformen (/history): lister af { value, current }. Læses defensivt; tomme felter udelades (G2).
 */
export function contactOf(raw: Json): { phone?: string; email?: string } {
  const current = (key: string): string | undefined => {
    const direct = str(raw, key);
    if (direct) return direct;
    const list = arr(raw, key);
    const hit = list.find((x) => isObj(x) && pick(x, "current") === true) ?? list.find((x) => isObj(x) && !pick(x, "to"));
    return hit ? str(hit, "value") : undefined;
  };
  const phone = current("phone");
  const email = current("email");
  return { ...(phone ? { phone } : {}), ...(email ? { email } : {}) };
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
 * Nøgler, som en liste af besætninger/ejendomme kan ligge under i de tidligere, uverificerede
 * gæt. Beholdt som reserve, hvis svaret en dag ikke længere matcher den bekræftede form nedenfor.
 */
const CHR_LIST_KEYS = ["herds", "livestock", "besaetninger", "properties", "results"] as const;

export const CHR_UNVERIFIED_REASON = "CHR-svarets struktur er ikke verificeret endnu";

/** Genkender den bekræftede form: et array af ejendomme, hvor mindst ét element har `property` eller `livestockList.livestock`. */
function isConfirmedChrShape(raw: Json): raw is Json[] {
  return Array.isArray(raw) && raw.some((el) => isObj(el) && (Array.isArray(at(el, "livestockList.livestock")) || isObj(at(el, "property"))));
}

/** "Orevej 5, 3660 Stenløse (Egedal)" ud fra ét ejendomsobjekt (`property`). */
function propertyAddressText(property: Json): string | undefined {
  const street = str(property, "address");
  const zip = str(property, "postalCode");
  const city = str(property, "postalDistrict");
  const municipality = str(property, "municipality");
  const line = [street, [zip, city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  if (!line) return undefined;
  return municipality ? `${line} (${municipality})` : line;
}

/**
 * Antal dyr for én besætningsrække: værdien af det `livestockSize`-element, hvis tekst ender på
 * "i alt" (fx "Svin i alt"), ellers summen af alle elementernes værdier.
 */
function livestockCount(sizeList: Json[]): number | undefined {
  if (sizeList.length === 0) return undefined;
  const totalEntry = sizeList.find((s) => (str(s, "text") ?? "").trim().toLowerCase().endsWith("i alt"));
  if (totalEntry) return num(totalEntry, "value");
  return sizeList.reduce<number>((sum, s) => sum + (num(s, "value") ?? 0), 0);
}

/**
 * Ejer/brugers navn, KUN når det er en virksomhed (`cvrNumber` sat). Privatpersoners navn og
 * adresse (ingen CVR-nummer) må aldrig ende i `LivestockVM` og læses derfor slet ikke herfra.
 */
function companyOwnerName(owner: Json): string | undefined {
  if (!isObj(owner)) return undefined;
  const cvr = pick(owner, "cvrNumber");
  if (cvr === undefined || cvr === null || cvr === "") return undefined;
  return str(owner, "name");
}

/**
 * CHR-husdyrdata (katalog 20), BEKRÆFTET MOD API 27.09.2026: `GET /data/CHR/livestock/{cvr}
 * ?onlyCurrent=true` svarer med et rent array af ejendomme. Hver ejendom har sit eget
 * `chrNumber`, en `property` (adresse/kommune) og `livestockList.livestock[]` - én række pr.
 * dyretype/anvendelse. Flere ejendomme (flere array-elementer) flades ud til én liste af rækker;
 * hver række får sit eget `chrNumber`/`propertyAddress`, så de kan skelnes i UI'en. Persondata:
 * ejer/bruger vises kun, når det er en virksomhed (se `companyOwnerName`) - privatpersoners navn
 * og adresse fra `owner`/`user` læses ikke.
 */
function adaptChrLivestockConfirmed(lassoId: string, properties: Json[]): LivestockVM {
  const herds: LivestockHerdVM[] = [];
  const events: VetEventVM[] = [];
  let chrNumber: string | undefined;
  let ownerName: string | undefined;
  let updated: string | undefined;
  const bumpUpdated = (d: string | undefined) => {
    if (d && (!updated || d > updated)) updated = d;
  };

  for (const property of properties) {
    const propertyChr = str(property, "chrNumber");
    chrNumber = chrNumber ?? propertyChr;
    const propertyAddress = propertyAddressText(pick(property, "property") ?? {});
    bumpUpdated(dateStr(property, "property.lastUpdated"));

    for (const item of arr(property, "livestockList.livestock")) {
      bumpUpdated(dateStr(item, "livestockSizeLastUpdated"));
      if (!ownerName) ownerName = companyOwnerName(pick(item, "owner")) ?? companyOwnerName(pick(item, "user"));
      herds.push({
        species: str(item, "animalType"),
        category: str(item, "usageType", "tradeType"),
        count: livestockCount(arr(item, "livestockSize")) ?? null,
        unit: "dyr",
        chrNumber: str(item, "chrNumber") ?? propertyChr,
        propertyAddress,
      });
    }

    const problems = str(property, "veterinaryEventList.problems");
    if (problems) events.push({ title: "Bemærkning", detail: problems });
    for (const e of arr(property, "veterinaryEventList.events")) {
      events.push({ title: str(e, "type", "name"), detail: str(e, "description"), date: dateStr(e, "date", "time") });
    }
  }
  return { lassoId, chrNumber, ownerName, updated, herds, events };
}

/**
 * CHR-husdyrdata (katalog 20): den bekræftede form (`adaptChrLivestockConfirmed`) forsøges
 * FØRST. Matcher svaret den ikke, forsøges de tidligere, uverificerede gæt (pakket liste under
 * `herds|livestock|besaetninger|properties|results`, eller et rent array med andre feltnavne),
 * som reserve. Genkendes intet af det, gives en tom VM med `unavailableReason` i stedet for et
 * (muligvis forkert) gæt.
 */
export function adaptChrLivestock(lassoId: string, raw: Json): LivestockVM {
  if (isConfirmedChrShape(raw)) return adaptChrLivestockConfirmed(lassoId, raw);

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
 * Rækkefølge og danske overskrifter for `sections`-feltets nøgler, BEKRÆFTET MOD API 27.09.2026
 * (`POST /modules/reportanalysis/{lassoId}`). "likviditet" (en uformateret tabel) og "sprgsml" (spørgsmål til
 * overvejelse) bruges ikke (Jakob 03.10): de står ikke i listen og kommer derfor aldrig med.
 * `latestReport`/`previousReport` (standardnøgletal med `possibleError`-flag) bruges ikke endnu,
 * se docs/endpoints-enheder-kontakt-analyse.md.
 */
const REPORT_ANALYSIS_SECTIONS: readonly [key: string, title: string][] = [
  ["konklusion", "Regnskabsanalyse: konklusion"],
  ["resultat", "Resultat"],
  ["balanceogkapitalforhold", "Balance og kapitalforhold"],
  ["branchestatistik", "Branchestatistik"],
  ["revisoroplysninger", "Revisoroplysninger"],
];

const REPORT_ANALYSIS_SOURCE = "Kilde: Lasso regnskabsanalyse";

/**
 * Bygger tekstsektionerne fra svaret fra `POST /modules/reportanalysis/{lassoId}`, BEKRÆFTET MOD
 * API 27.09.2026: `{ lassoId, sections: { konklusion, resultat, likviditet,
 * balanceogkapitalforhold, branchestatistik, revisoroplysninger, sprgsml }, text, latestReport,
 * previousReport }`. Findes `sections` med mindst ét ikke-tomt felt, giver hver én
 * `TextSectionItem` i den bekræftede rækkefølge (tomme felter udelades); ellers falder den
 * tilbage til `text` som én samlet sektion. HTML'et konverteres til ren tekst med `htmlToText`.
 * Tomt/ukendt svar giver en tom liste (sektionerne udelades da helt - katalogregel 4/5: ingen
 * AI-mærke, ingen bannerboks, blot almindelige sektioner med kildevisning).
 *
 * Hver sektion starter i kilden med sin egen overskrift ("<b>Revisoroplysninger</b><br>…"), som
 * fjernes, så brødteksten starter med den første sætning (overskriften står allerede over den).
 * Teksten kan indeholde Lassos "{Navn|LassoId}"-markup (fx revisoren): `body` er ren tekst med
 * navnene, og `segments` bærer navnenes Lasso-ID'er, så de kan vises som links.
 */
export function adaptReportAnalysisSections(raw: Json): TextSectionItem[] {
  const sectionsRaw = pick(raw, "sections");
  if (isObj(sectionsRaw)) {
    const items: TextSectionItem[] = [];
    for (const [key, title] of REPORT_ANALYSIS_SECTIONS) {
      const html = str(sectionsRaw, key);
      if (!html) continue;
      const item = analysisItem(title, stripSectionTitle(html, key, title));
      if (item) items.push(item);
    }
    if (items.length) return items;
  }
  const html = typeof raw === "string" ? raw : str(raw, "text", "analysis", "html", "content", "result", "summary");
  if (!html) return [];
  const item = analysisItem("Regnskabsanalyse", html);
  return item ? [item] : [];
}

/** HTML -> ren tekst uden markup (+ segmenter med Lasso-ID'er, når teksten har navne med ID). */
function analysisItem(heading: string, html: string): TextSectionItem | null {
  const { text, segments } = textWithEntities(htmlToText(html));
  if (!text) return null;
  return { heading, body: text, ...(segments ? { segments } : {}), note: REPORT_ANALYSIS_SOURCE };
}

/** Bogstaver og cifre i små bogstaver: "Balance og kapitalforhold:" -> "balanceogkapitalforhold". */
function titleKey(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

/**
 * Er teksten sektionens egen overskrift? Lassos titel ("Konklusion", "Revisoroplysninger"), feltets
 * nøgle ("balanceogkapitalforhold") eller vores danske overskrift, helt eller som dens start/slutning
 * ("Regnskabsanalyse: konklusion" slutter med "konklusion").
 */
function isSectionTitle(text: string, key: string, title: string): boolean {
  const t = titleKey(text);
  const ours = titleKey(title);
  if (!t) return false;
  return t === key || t === ours || (t.length >= 5 && (ours.startsWith(t) || ours.endsWith(t)));
}

/**
 * Fjerner sektionens overskrift fra starten af HTML'et, også når den står flere gange: et
 * indledende "<b>Titel</b>" (evt. med kolon og linjeskift efter), eller titlen som ren tekst på sin
 * egen linje eller efterfulgt af kolon. En fed indledning, der ikke er sektionens titel (fx et emne
 * under "Spørgsmål til overvejelse"), beholdes, og det samme gør en sætning, der blot starter med
 * samme ord som titlen ("Resultatet er steget …").
 */
function stripSectionTitle(html: string, key: string, title: string): string {
  let rest = html;
  for (let i = 0; i < 3; i++) {
    const bold = /^\s*(?:<p[^>]*>\s*)?<(b|strong|h\d)[^>]*>([\s\S]*?)<\/\1\s*>\s*:?\s*(?:<br\s*\/?>\s*)*/i.exec(rest);
    if (bold && isSectionTitle(htmlToText(bold[2]), key, title)) {
      rest = rest.slice(bold[0].length);
      continue;
    }
    const plain = /^\s*([^<\n:]{1,80}?)\s*(?::\s*|(?:<br\s*\/?>|\n)\s*)+/i.exec(rest);
    if (plain && isSectionTitle(plain[1]!, key, title)) {
      rest = rest.slice(plain[0].length);
      continue;
    }
    break;
  }
  return rest;
}
