import type {
  CompanyRowVM,
  CompanyVM,
  FinancialYear,
  FinancialsVM,
  OwnerVM,
  OwnershipVM,
  PersonRowVM,
} from "@lasso/spec";

/**
 * Oversætter Lassos rå API-svar til vores datamodeller.
 *
 * Søgning, virksomhed og regnskab er bekræftet mod api.lassox.com (24.09.2026);
 * de bekræftede felter står først i hver kandidatliste. De øvrige navne er
 * reserve for varianter, der ikke er set endnu. Formerne kan ses med
 * LOG_LEVEL=debug (opstartsloggen "[lasso-probe]") eller /api/debug/lasso/...
 * Resten af systemet kender kun datamodellerne og behøver ikke ændres.
 */

type Json = unknown;

function isObj(v: Json): v is Record<string, Json> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Case-insensitivt opslag af en sti som "address.city". */
export function at(obj: Json, path: string): Json {
  let cur: Json = obj;
  for (const part of path.split(".")) {
    if (!isObj(cur)) return undefined;
    if (part in cur) {
      cur = cur[part];
      continue;
    }
    const lower = part.toLowerCase();
    const key = Object.keys(cur).find((k) => k.toLowerCase() === lower);
    cur = key === undefined ? undefined : cur[key];
  }
  return cur;
}

function pick(obj: Json, ...paths: string[]): Json {
  for (const p of paths) {
    const v = at(obj, p);
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
}

function str(obj: Json, ...paths: string[]): string | undefined {
  const v = pick(obj, ...paths);
  if (typeof v === "string") return v.trim() || undefined;
  if (typeof v === "number") return String(v);
  if (isObj(v)) {
    const inner = pick(v, "name", "text", "value", "title", "description");
    if (typeof inner === "string") return inner.trim() || undefined;
  }
  return undefined;
}

function num(obj: Json, ...paths: string[]): number | undefined {
  const v = pick(obj, ...paths);
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : undefined;
  }
  if (isObj(v)) return num(v, "value", "amount", "count", "min");
  return undefined;
}

function arr(obj: Json, ...paths: string[]): Json[] {
  if (Array.isArray(obj) && paths.length === 0) return obj;
  for (const p of paths) {
    const v = at(obj, p);
    if (Array.isArray(v)) return v;
  }
  return [];
}

/** Finder listen af elementer i et svar, uanset om det er et array eller pakket ind. */
function items(raw: Json): Json[] {
  if (Array.isArray(raw)) return raw;
  return arr(raw, "results", "items", "hits", "data", "companies", "entities", "records", "reports", "value");
}

function dateStr(obj: Json, ...paths: string[]): string | undefined {
  const s = str(obj, ...paths);
  if (!s) return undefined;
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  return m ? m[1] : s;
}

/**
 * Region ud fra postnummer. Tilnærmelse (postnumre følger ikke regionsgrænser
 * helt), men søgesvaret har kun postnummer og by. Rettes til kommunekode, når
 * den er tilgængelig.
 */
export function regionFromZip(zip: string | number | undefined): string | undefined {
  const n = typeof zip === "number" ? zip : Number(String(zip ?? "").trim());
  if (!Number.isFinite(n) || n < 1000 || n > 9999) return undefined;
  if (n < 3800) return "Hovedstaden";
  if (n < 5000) return "Sjælland";
  if (n < 6900) return "Syddanmark";
  if (n < 7000) return "Midtjylland";
  if (n < 7330) return "Syddanmark";
  if (n < 7700) return "Midtjylland";
  if (n < 7800) return "Nordjylland";
  if (n < 7900) return "Midtjylland";
  if (n < 8000) return "Nordjylland";
  if (n < 9000) return "Midtjylland";
  return "Nordjylland";
}

export function statusKind(status: string | undefined): CompanyVM["statusKind"] {
  if (!status) return undefined;
  const s = status.toLowerCase();
  if (/konkurs|likvid|tvangs|bankrupt|liquidat|under/.test(s)) return "warning";
  if (/ophør|opløst|ceased|dissolved|inactive|slettet/.test(s)) return "inactive";
  if (/aktiv|normal|active/.test(s)) return "active";
  return undefined;
}

/** CVR skriver kommuner med versaler: "GLADSAXE" -> "Gladsaxe", "LYNGBY-TAARBÆK" -> "Lyngby-Taarbæk". */
function titleCase(s: string | undefined): string | undefined {
  if (!s || s !== s.toUpperCase()) return s;
  return s.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}

function address(raw: Json): CompanyVM["address"] {
  const a = pick(raw, "address", "addresses.0", "location", "beliggenhedsadresse", "mainAddress") ?? raw;
  const street =
    str(a, "street", "streetAddress", "addressLine", "line1", "vejnavn") ??
    ([str(a, "streetName", "roadName"), str(a, "houseNumber", "streetNumber", "number")].filter(Boolean).join(" ") || undefined);
  const zip = str(a, "postalCode", "zipcode", "zipCode", "zip", "postcode", "postnummer");
  return {
    street: str(a, "address1") ?? street,
    zip,
    city: str(a, "postalDistrict", "city", "cityName", "postnummernavn", "by"),
    municipality: titleCase(str(a, "municipality.name", "municipality", "municipalityName", "kommune", "kommunenavn")),
    region: str(a, "region", "regionName") ?? regionFromZip(zip),
  };
}

export function adaptCompany(lassoId: string, raw: Json): CompanyVM {
  const status = str(raw, "status", "companyStatus", "state", "virksomhedsstatus", "lifecycle.status");
  return {
    lassoId: str(raw, "lassoId", "id") ?? lassoId,
    cvr: str(raw, "cvr", "cvrNumber", "vat", "vatNumber", "cvrnummer"),
    name: str(raw, "name", "companyName", "legalName", "navn", "names.0") ?? lassoId,
    status,
    statusKind: statusKind(status),
    form: str(raw, "form.shortDescription", "form.longDescription", "companyForm", "companyType", "legalForm", "form", "virksomhedsform"),
    industryCode: str(raw, "industryCode", "industry.code", "mainIndustry.code", "primaryIndustry.code", "branchekode"),
    industryText: str(raw, "industryText", "industry.text", "industry.name", "industry", "mainIndustry.text", "mainIndustry.name", "primaryIndustry.text", "branchetekst"),
    address: address(raw),
    founded: dateStr(raw, "lifeTime.from", "creationDate", "founded", "foundedDate", "startDate", "established"),
    employees: num(raw, "employees.count", "employees.amount", "employees.employees", "employees.intervalLow", "employees", "numberOfEmployees", "employeeCount"),
    website: str(raw, "website", "homepage", "web", "url"),
    email: str(raw, "email", "emailAddress"),
    phone: str(raw, "phone", "phoneNumber", "telephone", "telefon"),
  };
}

/**
 * Bekræftet form (GET /{lassoId}): stakeholders[] { name, type, lassoId, role: { mainType, type, originalType }, from },
 * management { ceo, members[] }, board { chairman, members[], alternates[] }, founders[].
 * Indholdet af management/board kendes kun som tomme felter endnu; de læses med samme feltnavne som stakeholders.
 */
export function adaptPeople(raw: Json): PersonRowVM[] {
  const sources: [Json[], string][] = [
    [arr(raw, "stakeholders"), "Deltager"],
    [arr(raw, "otherParticipants"), "Deltager"],
    [[pick(raw, "management.ceo")].filter((x) => x !== undefined), "Direktør"],
    [arr(raw, "management.members"), "Direktion"],
    [[pick(raw, "board.chairman")].filter((x) => x !== undefined), "Bestyrelsesformand"],
    [arr(raw, "board.members"), "Bestyrelsesmedlem"],
    [arr(raw, "board.alternates"), "Suppleant"],
    // Fallback til andre navngivninger
    [arr(raw, "participants", "relations", "roles", "persons", "deltagere"), "Deltager"],
  ];
  const rows: PersonRowVM[] = [];
  for (const [list, fallbackRole] of sources) {
    for (const p of list) {
      const name = typeof p === "string" ? p : str(p, "name", "participant.name", "person.name", "navn");
      if (!name) continue;
      const role = str(p, "role.type", "role.originalType", "role.mainType", "role", "title", "function", "rolle") ?? fallbackRole;
      rows.push({
        name,
        lassoId: str(p, "lassoId", "id"),
        role: prettyRole(role),
        from: dateStr(p, "from", "role.from", "start", "startDate", "validFrom"),
        to: dateStr(p, "to", "role.to", "end", "endDate", "validTo"),
      });
    }
  }
  return dedupe(
    rows.filter((r) => !/ejer|owner|revis|auditor|accountant|legal_owner|real_owner/i.test(r.role)),
    (r) => `${r.name}|${r.role}|${r.from ?? ""}`,
  );
}

/** "BOARD_MEMBER" / "direktion" -> "Board member" / "Direktion" */
function prettyRole(role: string): string {
  const t = role.replace(/_/g, " ").trim().toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

const percentFormat = new Intl.NumberFormat("da-DK", { maximumFractionDigits: 2 });

/**
 * Ejerandel som tekst. Lasso giver intervaller som brøker: { from: 0.25, to: 0.3332 } -> "25–33,32 %".
 * Enkeltværdier og procenttal (over 1) håndteres også.
 */
function shareText(v: Json): string | undefined {
  if (typeof v === "string") return v.trim() || undefined;
  const lo = typeof v === "number" ? v : isObj(v) ? num(v, "from", "min", "value") : undefined;
  if (lo === undefined) return undefined;
  const hi = isObj(v) ? num(v, "to", "max") : undefined;
  const scale = (hi ?? lo) <= 1 ? 100 : 1;
  const a = percentFormat.format(lo * scale);
  if (hi === undefined || hi === lo) return `${a} %`;
  return `${a}–${percentFormat.format(hi * scale)} %`;
}

/** Nedre grænse af en ejerandel som tal: "25–33,32 %" -> 25; ukendt -> -1. */
function shareFloor(share: string | undefined): number {
  const m = /(\d+(?:,\d+)?)/.exec(share ?? "");
  return m ? Number(m[1]!.replace(",", ".")) : -1;
}

export function adaptOwnership(lassoId: string, raw: Json): OwnershipVM {
  // Bekræftet: ownership.owners[] { ownership, voteRights, name, type, lassoId, unitNumber }
  const ownersRaw = arr(raw, "ownership.owners", "owners", "legalOwners", "ownerships", "shareholders", "ejere");
  const participants = arr(raw, "participants", "relations", "roles");
  const fromParticipants = participants.filter((p) => /ejer|owner/i.test(JSON.stringify(pick(p, "role", "roles", "type") ?? "")));
  const owners: OwnerVM[] = [...ownersRaw, ...fromParticipants]
    .map((o) => {
      const name = str(o, "name", "owner.name", "participant.name", "navn");
      if (!name) return null;
      const share = shareText(pick(o, "ownership", "share", "ownershipShare", "percentage", "ownershipPercentage", "ejerandel"))
        ?? str(o, "shareText", "ownershipInterval", "interval", "shareInterval");
      const votes = shareText(pick(o, "voteRights", "votingRights", "stemmeandel"));
      const type = str(o, "type", "kind", "entityType") ?? "";
      const owner: OwnerVM = {
        name,
        lassoId: str(o, "lassoId", "id", "owner.lassoId"),
        share: share ?? votes,
        votes: share && votes && votes !== share ? votes : undefined,
        kind: /company|virksomhed|cvr-1/i.test(type + (str(o, "lassoId", "id") ?? "")) ? "company" : "person",
      };
      return owner;
    })
    .filter((o): o is OwnerVM => o !== null);

  const auditorRaw = pick(raw, "accounting.accountant", "auditor", "auditors.0", "revisor", "accountant");
  const auditorName = auditorRaw === undefined ? undefined : typeof auditorRaw === "string" ? auditorRaw : str(auditorRaw, "name", "navn");
  return {
    lassoId,
    // Største ejere først; Lasso leverer dem i vilkårlig rækkefølge.
    owners: dedupe(owners, (o) => `${o.name}|${o.share ?? ""}`).sort((a, b) => shareFloor(b.share) - shareFloor(a.share)),
    auditor: auditorName
      ? { name: auditorName, lassoId: str(auditorRaw, "lassoId", "id"), from: dateStr(auditorRaw, "from", "start", "startDate") }
      : undefined,
  };
}

/**
 * Bekræftet form (GET /{lassoId}/reports/advanced, 24.09.2026):
 * [{ lassoId, period: { from, to }, reportYear, publicationTime,
 *    data: { company?: { reportType, facts: { incomeStatement, statementOfFinancialPosition, … } }, group?: { … } } }]
 * Hver sektion er et XBRL-præsentationstræ: { facts: { [begreb]: node }, xbrlType, abstract, label, section, source }.
 * Selskabets egne tal bruges først; koncerntal kun hvor selskabets mangler.
 */
export function adaptFinancials(lassoId: string, raw: Json): FinancialsVM {
  const reports = items(raw);
  const years: FinancialYear[] = [];
  for (const r of reports) {
    const periodEnd = dateStr(r, "period.to", "periodEnd", "period.end", "endDate", "end", "reportingPeriod.end", "to");
    const periodStart = dateStr(r, "period.from", "periodStart", "period.start", "startDate", "reportingPeriod.start", "from");
    const published = dateStr(r, "publicationTime", "published", "publishedAt", "reportPublished");
    const year = num(r, "reportYear", "year", "fiscalYear", "financialYear", "aar") ?? (periodEnd ? Number(periodEnd.slice(0, 4)) : undefined);
    if (!year || !Number.isFinite(year)) continue;
    const facts = new Map<string, number>();
    for (const scope of ["data.company.facts", "data.group.facts"]) collectFacts(at(r, scope), periodEnd, facts);
    const src = pick(r, "figures", "keyFigures", "values", "financials", "incomeStatement") ?? r;
    const f = (concepts: string[], ...keys: string[]) =>
      concepts.map((c) => facts.get(c)).find((v) => v !== undefined) ?? num(src, ...keys) ?? num(r, ...keys) ?? null;
    years.push({
      year,
      periodStart,
      periodEnd,
      published,
      revenue: f(["revenue", "revenues", "netsales", "revenuefromcontractswithcustomers", "nettoomsaetning"], "revenue", "netRevenue", "turnover", "netTurnover", "omsaetning"),
      grossProfit: f(["grossprofitloss", "grossprofit", "grossresult"], "grossProfit", "grossResult", "grossProfitLoss", "bruttofortjeneste"),
      profit: f(["profitloss", "profitlossfortheyear", "netincome"], "profit", "netResult", "profitLoss", "netIncome", "aaretsResultat"),
      equity: f(["equity", "totalequity", "equityattributabletoownersofparent"], "equity", "totalEquity", "egenkapital"),
      employees: f(["averagenumberofemployees", "numberofemployees"], "employees", "numberOfEmployees", "averageNumberOfEmployees", "antalAnsatte"),
      // Ubekræftet (se docs/lasso-endpoints.md "Ubekræftet"): samlet gæld, forsøgt som
      // ét XBRL-begreb først, ellers kort- og langfristet gæld lagt sammen.
      liabilities: f(["liabilities", "liabilitiesandprovisions", "totalliabilities"], "liabilities", "totalLiabilities") ?? sumLiabilities(facts) ?? null,
    });
  }
  const byYear = new Map<number, FinancialYear>();
  // Ældre år uden XBRL-data (fx 1995–2013 for Novo Nordisk) har ingen tal og udelades.
  for (const y of years.filter(hasFigures)) {
    const prev = byYear.get(y.year);
    // Samme år kan komme flere gange (fx rettet regnskab); behold udfyldte værdier.
    byYear.set(y.year, prev ? mergeYear(prev, y) : y);
  }
  return {
    lassoId,
    currency: str(raw, "currency", "0.currency") ?? "DKK",
    years: [...byYear.values()].sort((a, b) => a.year - b.year),
  };
}

function hasFigures(y: FinancialYear): boolean {
  return [y.revenue, y.grossProfit, y.profit, y.equity, y.employees, y.liabilities].some((v) => v !== null && v !== undefined);
}

function mergeYear(a: FinancialYear, b: FinancialYear): FinancialYear {
  const out: FinancialYear = { ...a };
  for (const k of ["revenue", "grossProfit", "profit", "equity", "employees", "liabilities"] as const) out[k] = a[k] ?? b[k] ?? null;
  return out;
}

/** Kort- og langfristet gæld lagt sammen, når der ikke er ét samlet gældsbegreb (ubekræftet). */
function sumLiabilities(facts: Map<string, number>): number | undefined {
  const shortTerm = facts.get("currentliabilities") ?? facts.get("shorttermliabilities") ?? facts.get("shorttermliabilitiesother");
  const longTerm = facts.get("noncurrentliabilities") ?? facts.get("longtermliabilities") ?? facts.get("longtermliabilitiesother");
  if (shortTerm === undefined && longTerm === undefined) return undefined;
  return (shortTerm ?? 0) + (longTerm ?? 0);
}

const SECTION_ORDER = ["incomeStatement", "statementOfFinancialPosition", "statementOfComprehensiveIncome", "statementOfChangesInEquity"];

/** Går et XBRL-træ igennem og samler begreb -> tal for regnskabsperioden. Første fund vinder. */
function collectFacts(root: Json, periodEnd: string | undefined, out: Map<string, number>, depth = 0): void {
  if (!isObj(root) || depth > 12) return;
  const entries = Object.entries(root);
  if (depth === 0) entries.sort(([a], [b]) => rank(a) - rank(b));
  for (const [key, node] of entries) {
    if (!isObj(node)) continue;
    const concept = key.replace(/^.*[:_#]/, "").toLowerCase();
    const value = factValue(node, periodEnd);
    if (value !== undefined && !out.has(concept)) out.set(concept, value);
    if (isObj(node.facts)) collectFacts(node.facts, periodEnd, out, depth + 1);
    else if (Array.isArray(node.children)) for (const c of node.children) collectFacts(c, periodEnd, out, depth + 1);
  }
}

function rank(section: string): number {
  const i = SECTION_ORDER.indexOf(section);
  return i === -1 ? SECTION_ORDER.length : i;
}

function factValue(node: Record<string, Json>, periodEnd: string | undefined): number | undefined {
  const list = Array.isArray(node.values) ? node.values : Array.isArray(node.facts) ? node.facts : undefined;
  if (list) {
    const plain = list.filter((v) => !isObj(v) || !pick(v, "dimensions", "dimension", "members"));
    const pool = plain.length ? plain : list;
    const match = periodEnd ? pool.find((v) => dateStr(v, "period.to", "period.instant", "instant", "endDate", "to", "period.end") === periodEnd) : undefined;
    const hit = match ?? pool[0];
    return typeof hit === "number" ? hit : num(hit, "value", "amount", "numericValue");
  }
  return num(node, "value", "amount", "numericValue", "currentValue", "current");
}

/**
 * Bekræftet form (api.lassox.com/data/cvr/search, 24.09.2026):
 * { companies: { results: [{ lassoId, name, status, entityType, address1, postalCode, city, country, score, … }],
 *                resultsFound, resultsReturned, page, pageSize, totalPages, hasNextPage, continuationToken, suggestion },
 *   people: { results: [...] , … } }
 */
export function adaptSearch(raw: Json, companyPrefix: string): { total?: number; rows: CompanyRowVM[] } {
  const container = isObj(raw) && isObj(at(raw, "companies")) ? at(raw, "companies") : raw;
  const list = items(container);
  const rows: CompanyRowVM[] = [];
  for (const it of list) {
    const lassoId = str(it, "lassoId", "id", "entityId");
    const name = str(it, "name", "companyName", "title", "navn");
    if (!lassoId || !name) continue;
    // Søgningen returnerer både virksomheder og personer; tabellen viser virksomheder.
    const type = (str(it, "type", "entityType", "kind") ?? "").toLowerCase();
    if (type && /person/.test(type)) continue;
    if (!type && !lassoId.startsWith(companyPrefix) && /^CVR-/i.test(lassoId)) continue;
    const status = str(it, "status", "companyStatus", "state");
    const a = address(it);
    const street = str(it, "address1");
    if (street && a) a.street = street;
    rows.push({
      lassoId,
      cvr: str(it, "cvr", "cvrNumber", "vat"),
      name,
      city: a?.city,
      region: a?.region,
      industryText: str(it, "industryText", "industry.text", "industry.name", "industry", "mainIndustry.text"),
      status,
      statusKind: statusKind(status),
      employees: num(it, "employees", "numberOfEmployees", "employeeCount") ?? null,
      revenue: num(it, "revenue", "netRevenue", "turnover") ?? null,
      grossProfit: num(it, "grossProfit", "grossResult") ?? null,
      profit: num(it, "profit", "netResult", "profitLoss") ?? null,
    });
  }
  return { total: num(container, "resultsFound", "total", "totalCount", "count", "hits.total", "numberOfResults"), rows };
}

function dedupe<T>(list: T[], key: (t: T) => string): T[] {
  const seen = new Set<string>();
  return list.filter((x) => {
    const k = key(x);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
