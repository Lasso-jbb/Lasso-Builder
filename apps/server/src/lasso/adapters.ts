import type {
  BeneficialOwnerGapVM,
  BeneficialOwnershipVM,
  BeneficialOwnerVM,
  BuildingVM,
  BalanceSheetYear,
  CashFlowYear,
  CompanyRowVM,
  CompanyVM,
  ContactPersonVM,
  ContactPersonsVM,
  ContactVM,
  FinancialYear,
  FinancialsVM,
  FinancialStatementsVM,
  IncomeStatementYear,
  NewsVM,
  OwnerVM,
  OwnershipEdgeVM,
  OwnershipGraphVM,
  OwnershipNodeVM,
  OwnershipVM,
  PersonRowVM,
  TextSectionsVM,
  TimelineEventVM,
  TimelineVM,
  ObservationRowVM,
  ObservationsVM,
  Severity,
  LivestockHerdVM,
  LivestockVM,
  ProductionUnitVM,
  ProductionUnitsVM,
  PropertiesVM,
  PropertyVM,
  VetEventVM,
} from "@lasso/spec";
import { currencyUnit } from "@lasso/spec";

/**
 * Oversætter Lassos rå API-svar til vores datamodeller.
 *
 * Søgning, virksomhed og regnskab er bekræftet mod api.lassox.com (24.09.2026);
 * de bekræftede felter står først i hver kandidatliste. De øvrige navne er
 * reserve for varianter, der ikke er set endnu. Formerne kan ses med
 * LOG_LEVEL=debug (opstartsloggen "[lasso-probe]") eller /api/debug/lasso/...
 * Resten af systemet kender kun datamodellerne og behøver ikke ændres.
 */

export type Json = unknown;

export function isObj(v: Json): v is Record<string, Json> {
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

export function pick(obj: Json, ...paths: string[]): Json {
  for (const p of paths) {
    const v = at(obj, p);
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
}

export function str(obj: Json, ...paths: string[]): string | undefined {
  const v = pick(obj, ...paths);
  if (typeof v === "string") return v.trim() || undefined;
  if (typeof v === "number") return String(v);
  if (isObj(v)) {
    const inner = pick(v, "name", "text", "value", "title", "description");
    if (typeof inner === "string") return inner.trim() || undefined;
  }
  return undefined;
}

export function num(obj: Json, ...paths: string[]): number | undefined {
  const v = pick(obj, ...paths);
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : undefined;
  }
  if (isObj(v)) return num(v, "value", "amount", "count", "min");
  return undefined;
}

export function arr(obj: Json, ...paths: string[]): Json[] {
  if (Array.isArray(obj) && paths.length === 0) return obj;
  for (const p of paths) {
    const v = at(obj, p);
    if (Array.isArray(v)) return v;
  }
  return [];
}

/** Finder listen af elementer i et svar, uanset om det er et array eller pakket ind. */
export function items(raw: Json): Json[] {
  if (Array.isArray(raw)) return raw;
  return arr(raw, "results", "items", "hits", "data", "companies", "entities", "records", "reports", "value");
}

export function dateStr(obj: Json, ...paths: string[]): string | undefined {
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

/**
 * CVR-status -> badge. Afsluttede forløb ("Opløst efter konkurs", "Opløst efter frivillig
 * likvidation", "Ophørt", "Slettet") er inaktive og testes FØRST, fordi de også indeholder
 * ord som "konkurs" og "likvidation". Igangværende forløb ("Under konkurs", "Under frivillig
 * likvidation", "Under tvangsopløsning", "Tvangsopløst", "Under reassumering") er advarsler.
 */
export function statusKind(status: string | undefined): CompanyVM["statusKind"] {
  if (!status) return undefined;
  const s = status.toLowerCase().trim();
  if (/^(opløst|ophør|slettet|lukket|ceased|dissolved|inactive|closed)/.test(s)) return "inactive";
  if (/konkurs|likvid|tvangs|rekonstruktion|reassum|bankrupt|liquidat|insolv|under /.test(s)) return "warning";
  if (/opløst|ophør|ceased|dissolved|slettet/.test(s)) return "inactive";
  if (/aktiv|normal|active/.test(s)) return "active";
  return undefined;
}

/** CVR skriver kommuner med versaler: "GLADSAXE" -> "Gladsaxe", "LYNGBY-TAARBÆK" -> "Lyngby-Taarbæk". */
export function titleCase(s: string | undefined): string | undefined {
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

/** Ét element fra en telefon-/e-mail-liste: enten en ren streng eller et objekt med et værdifelt. */
function contactValue(entry: Json, ...paths: string[]): string | undefined {
  if (typeof entry === "string") return entry.trim() || undefined;
  return str(entry, ...paths);
}

/**
 * Fylder `CompanyVM.phone/email/website`, når CVR-svaret (`GET /{lassoId}`) ikke selv har dem,
 * fra de to kontaktendpoints (se docs/lasso-endpoints.md, "Kontaktpersoner" og websites ovenfor):
 * `GET /data/websites/{lassoId}` (bekræftet: `{ cvr, urls: [{ url, verifiedAt }] }`) og
 * `GET /apps/contacts/{lassoId}/data?emails=true&phonenumbers=true&links=true` (UBEKRÆFTET
 * svarform; læst defensivt som en liste af telefonnumre/e-mails, enten rene strenge eller
 * objekter med et værdifelt). Bruges af `LiveProvider.company`, så `LassoCompanyHead` og
 * `LassoKeyValueList` (variant "company") ikke viser "—", når værdien findes ét af stederne.
 */
export function fillContactInfo(co: CompanyVM, websitesRaw: Json | undefined, contactsRaw: Json | undefined): CompanyVM {
  if (co.phone && co.email && co.website) return co;
  const websiteUrls = arr(websitesRaw, "urls");
  const phones = arr(contactsRaw, "phonenumbers", "phoneNumbers", "phones");
  const emails = arr(contactsRaw, "emails");
  return {
    ...co,
    phone: co.phone ?? contactValue(phones[0], "number", "value", "phone", "phoneNumber"),
    email: co.email ?? contactValue(emails[0], "email", "value", "address"),
    website: co.website ?? str(websiteUrls[0], "url") ?? str(websitesRaw, "url"),
  };
}

/**
 * Kontaktblok (katalog 08, "Kontaktblok"): samme kilder som `fillContactInfo`, men altid
 * hentet (uafhængigt af `LassoCompanyHead`/`LassoKeyValueList`) og med en kildelinje, så
 * `LassoContact` kan stå alene. "CVR" når CVR-svaret selv havde telefon eller e-mail,
 * ellers "Virksomhedens hjemmeside" når kontaktendpointet gav noget.
 */
export function adaptContact(lassoId: string, companyRaw: Json, websitesRaw: Json | undefined, contactsRaw: Json | undefined): ContactVM {
  const co = adaptCompany(lassoId, companyRaw);
  const filled = fillContactInfo(co, websitesRaw, contactsRaw);
  const hasAny = Boolean(filled.phone || filled.email || filled.website);
  const source = !hasAny ? undefined : co.phone || co.email ? "CVR" : "Virksomhedens hjemmeside";
  return {
    lassoId,
    phone: filled.phone,
    email: filled.email,
    website: filled.website,
    address: filled.address,
    source,
    updated: hasAny ? new Date().toISOString().slice(0, 10) : undefined,
  };
}

/**
 * Kontaktpersoner (katalog 08). Svarformen for `GET /apps/contacts/{lassoId}/data?contacts=true`
 * er UBEKRÆFTET (se docs/lasso-endpoints.md, "Kontaktpersoner"); antaget som en liste (evt.
 * pakket i `{ contacts | people | persons: [...] }`) af objekter med navn, rolle/titel og
 * valgfri telefon/e-mail. Personer uden navn springes over.
 */
export function adaptContactPersons(lassoId: string, raw: Json): ContactPersonsVM {
  const list = arr(raw, "contacts", "people", "persons").length ? arr(raw, "contacts", "people", "persons") : items(raw);
  const people: ContactPersonVM[] = list
    .map((p): ContactPersonVM | null => {
      const name = str(p, "name", "fullName", "navn");
      if (!name) return null;
      return {
        name,
        role: str(p, "role", "title", "jobTitle", "position", "department", "rolle"),
        phone: str(p, "phone", "phoneNumber", "telephone", "telefon"),
        email: str(p, "email", "emailAddress"),
      };
    })
    .filter((p): p is ContactPersonVM => p !== null);
  return {
    lassoId,
    people,
    source: people.length ? "Virksomhedens hjemmeside" : undefined,
    updated: people.length ? new Date().toISOString().slice(0, 10) : undefined,
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
export function shareText(v: Json): string | undefined {
  if (typeof v === "string") return v.trim() || undefined;
  const lo = typeof v === "number" ? v : isObj(v) ? num(v, "from", "min", "value") : undefined;
  if (lo === undefined) return undefined;
  const hi = isObj(v) ? num(v, "to", "max") : undefined;
  const scale = (hi ?? lo) <= 1 ? 100 : 1;
  const a = percentFormat.format(lo * scale);
  if (hi === undefined || hi === lo) return `${a} %`;
  return `${a}–${percentFormat.format(hi * scale)} %`;
}

/**
 * Juridisk enhed ud fra navnet: selskabsform (A/S, ApS, Inc, Ltd, GmbH …) eller ord som fond,
 * bank, pension, holding, kommune. Bruges, når Lasso ikke oplyser typen, fordi udenlandske
 * selskaber og fonde (fx "BlackRock, Inc") har deltager-ID'er (CVR-3-…) ligesom personer.
 */
export function looksLikeOrganisation(name: string | undefined): boolean {
  if (!name) return false;
  return /(?:^|[\s,.(&])(inc|incorporated|ltd|limited|llc|llp|lp|plc|corp|corporation|company|co|gmbh|ag|se|ab|as|asa|oy|oyj|sa|s\.a|sas|sarl|srl|spa|s\.p\.a|bv|b\.v|nv|n\.v|a\/s|aps|ivs|p\/s|i\/s|k\/s|amba|a\.m\.b\.a|fmba|smba|holding|holdings|group|gruppen|fund|funds|fond|fonden|foundation|stiftung|stichting|trust|bank|banken|pension|pensionskasse|kapital|capital|invest|investment|investments|management|partners|kommune|region|staten|ministeriet|forening|foreningen|selskab|selskabet|universitet|university|institut|institute)(?=$|[\s,.)&])/i.test(name.trim());
}

/**
 * Person eller selskab for en deltager (ejer, graf-node). Oplyser Lasso typen, gælder den: kun
 * "PERSON" (og lignende) er en person, alt andet (Company, fond, udenlandsk enhed) er et selskab.
 * Uden type: CVR-1-… er et dansk selskab; CVR-3-…/CVR-4-… er en deltager, som er en person,
 * medmindre navnet ligner en juridisk enhed (fx "BlackRock, Inc").
 */
export function participantKind(type: string | undefined, id: string | undefined, name: string | undefined): "person" | "company" {
  const t = (type ?? "").trim().toLowerCase();
  if (t) return /person|individual|natural|human/.test(t) ? "person" : "company";
  if (id && /^CVR-1-/i.test(id)) return "company";
  if (name && name !== id && looksLikeOrganisation(name)) return "company";
  if (id && /^CVR-[34]-/i.test(id)) return "person";
  return looksLikeOrganisation(name) ? "company" : "person";
}

/**
 * Navn og type på deltagere (ejere, ledelse, andre deltagere) i et CVR-opslag (GET /{lassoId}),
 * nøglet på Lasso-ID. Bruges til at give navneløse personnoder i ejergrafen et navn.
 */
export function participantNames(raw: Json): Map<string, { name: string; type?: string }> {
  const out = new Map<string, { name: string; type?: string }>();
  const lists = [arr(raw, "ownership.owners", "owners"), arr(raw, "stakeholders"), arr(raw, "otherParticipants"), arr(raw, "management.members"), arr(raw, "board.members"), arr(raw, "board.alternates")];
  for (const p of [pick(raw, "management.ceo"), pick(raw, "board.chairman"), ...lists.flat()]) {
    const id = str(p, "lassoId", "id");
    const name = str(p, "name", "participant.name", "person.name");
    if (!id || !name || out.has(id)) continue;
    out.set(id, { name, type: str(p, "type", "entityType", "kind") });
  }
  return out;
}

/** Giver navneløse noder (navn = ID) i ejergrafen navn og korrekt type ud fra opslag. */
export function applyGraphNames(g: OwnershipGraphVM, names: ReadonlyMap<string, { name: string; type?: string }>): OwnershipGraphVM {
  return {
    ...g,
    nodes: g.nodes.map((n) => {
      const hit = names.get(n.id);
      if (!hit || (n.name !== n.id && !hit.type)) return n;
      const name = n.name === n.id ? hit.name : n.name;
      return { ...n, name, kind: n.root ? n.kind : participantKind(hit.type, n.id, name) };
    }),
  };
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
      const type = str(o, "type", "kind", "entityType");
      const id = str(o, "lassoId", "id", "owner.lassoId");
      const owner: OwnerVM = {
        name,
        lassoId: id,
        share: share ?? votes,
        votes: share && votes && votes !== share ? votes : undefined,
        kind: participantKind(type, id, name),
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
 * XBRL-begreber (små bogstaver, uden præfiks) fælles for `adaptFinancials` og
 * `adaptFinancialStatements`, så nøgletal og regnskabstabel aldrig er uenige.
 * Dækker både den danske taksonomi (ÅRL, fsa:) og IFRS/ESEF (børsnoterede).
 */
export const CONCEPTS = {
  revenue: ["revenue", "revenues", "netsales", "revenuefromcontractswithcustomers", "nettoomsaetning"],
  grossProfit: ["grossprofitloss", "grossprofit", "grossresult"],
  profit: ["profitloss", "profitlossfortheyear", "netincome"],
  equity: ["equity", "totalequity", "equityattributabletoownersofparent"],
  employees: ["averagenumberofemployees", "numberofemployees"],
  /** Resultat af primær drift (EBIT). */
  ebit: ["profitlossfromordinaryoperatingactivities", "profitlossfromoperatingactivities", "operatingprofitloss"],
  /** Ét samlet gældsbegreb (IFRS "Liabilities" indeholder hensatte forpligtelser). */
  liabilitiesTotal: ["liabilities", "liabilitiesandprovisions", "totalliabilities"],
  /** ÅRL: gæld uden hensatte forpligtelser; lægges sammen med `provisions`. */
  liabilitiesOtherThanProvisions: ["liabilitiesotherthanprovisions"],
  provisions: ["provisions", "provisionstotal"],
  shortTermLiabilities: ["currentliabilities", "shorttermliabilitiesotherthanprovisions", "shorttermliabilities", "shorttermliabilitiesother"],
  longTermLiabilities: ["noncurrentliabilities", "longtermliabilitiesotherthanprovisions", "longtermliabilities", "longtermliabilitiesother"],
  currentAssets: ["currentassets"],
  assets: ["assets", "totalassets", "assetstotal"],
  depreciation: [
    "depreciationamortisationexpenseandimpairmentlossesofpropertyplantandequipmentandintangibleassetsrecognisedinprofitorloss",
    "depreciationamortisationandimpairmentlossesofintangibleassetsandtangibleassetsandpropertyplantandequipment",
    "depreciationandamortisationexpense",
    "depreciationamortisationexpense",
    "adjustmentsfordepreciationandamortisationexpense",
    "depreciation",
  ],
} as const;

/** Begreber, der afgør om et scope (selskab/koncern) har et egentligt regnskab. */
const MAIN_CONCEPTS = [...CONCEPTS.revenue, ...CONCEPTS.grossProfit, ...CONCEPTS.profit, ...CONCEPTS.equity, ...CONCEPTS.assets, ...CONCEPTS.liabilitiesTotal];

/** Tallene fra ÉN rapport, fra ét scope (koncern eller selskab), med valuta. */
interface ReportFacts {
  facts: Map<string, number>;
  balances: Map<string, string>;
  scope?: "Koncern" | "Selskab";
  currency?: string;
}

/**
 * Samler tal for regnskabsperioden fra ét scope pr. rapport, så selskabs- og koncerntal
 * aldrig blandes i samme år. Koncernen vælges, når den har et egentligt regnskab (mindst to
 * hovedbegreber), ellers selskabet. Valutaen er den hyppigste ISO 4217-kode i bladenes `unit`.
 */
function reportFacts(r: Json, periodEnd: string | undefined): ReportFacts {
  const read = (path: string): ReportFacts & { main: number } => {
    const facts = new Map<string, number>();
    const balances = new Map<string, string>();
    const units = new Map<string, number>();
    collectFacts(at(r, path), periodEnd, facts, 0, balances, units);
    const currency = [...units.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    return { facts, balances, currency, main: MAIN_CONCEPTS.filter((c) => facts.has(c)).length };
  };
  const group = read("data.group.facts");
  const company = read("data.company.facts");
  const chosen = group.main >= 2 || (group.facts.size > 0 && company.facts.size === 0) ? { ...group, scope: "Koncern" as const } : { ...company, scope: company.facts.size ? ("Selskab" as const) : undefined };
  return { facts: chosen.facts, balances: chosen.balances, scope: chosen.scope, currency: chosen.currency ?? currencyCode(pick(r, "currency", "unit", "data.currency")) };
}

/** Første begreb i listen, der har et tal. */
function firstFact(facts: Map<string, number>, concepts: readonly string[]): number | undefined {
  for (const c of concepts) {
    const v = facts.get(c);
    if (v !== undefined) return v;
  }
  return undefined;
}

/**
 * Samlet gæld: ét samlet begreb, ellers (ÅRL) gæld uden hensatte + hensatte forpligtelser,
 * ellers kort- og langfristet gæld (+ hensatte) lagt sammen. undefined, når intet er oplyst.
 */
function totalLiabilities(facts: Map<string, number>): number | undefined {
  const direct = firstFact(facts, CONCEPTS.liabilitiesTotal);
  if (direct !== undefined) return direct;
  const provisions = firstFact(facts, CONCEPTS.provisions);
  const otherThanProvisions = firstFact(facts, CONCEPTS.liabilitiesOtherThanProvisions);
  if (otherThanProvisions !== undefined) return otherThanProvisions + (provisions ?? 0);
  const shortTerm = firstFact(facts, CONCEPTS.shortTermLiabilities);
  const longTerm = firstFact(facts, CONCEPTS.longTermLiabilities);
  if (shortTerm === undefined && longTerm === undefined) return undefined;
  return (shortTerm ?? 0) + (longTerm ?? 0) + (provisions ?? 0);
}

/**
 * Bekræftet form (GET /{lassoId}/reports/advanced, 24.09.2026):
 * [{ lassoId, period: { from, to }, reportYear, publicationTime,
 *    data: { company?: { reportType, facts: { incomeStatement, statementOfFinancialPosition, … } }, group?: { … } } }]
 * Hver sektion er et XBRL-præsentationstræ: { facts: { [begreb]: node }, xbrlType, abstract, label, section, source },
 * og bladene er { value, unit, balance, … }.
 * Pr. rapport bruges ÉT scope: koncernen, når den har et regnskab, ellers selskabet (se `reportFacts`).
 * Valutaen læses fra bladenes `unit` (fx "iso4217:EUR"); DKK, når den ikke er oplyst.
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
    const { facts, scope, currency } = reportFacts(r, periodEnd);
    const src = pick(r, "figures", "keyFigures", "values", "financials", "incomeStatement") ?? r;
    const f = (concepts: readonly string[], ...keys: string[]) => firstFact(facts, concepts) ?? num(src, ...keys) ?? num(r, ...keys) ?? null;
    const publicationTime = dateStr(r, "publicationTime", "publicationDate", "published");
    const revenue = f(CONCEPTS.revenue, "revenue", "netRevenue", "turnover", "netTurnover", "omsaetning");
    const grossProfit = f(CONCEPTS.grossProfit, "grossProfit", "grossResult", "grossProfitLoss", "bruttofortjeneste");
    const profit = f(CONCEPTS.profit, "profit", "netResult", "profitLoss", "netIncome", "aaretsResultat");
    const equity = f(CONCEPTS.equity, "equity", "totalEquity", "egenkapital");
    const employees = f(CONCEPTS.employees, "employees", "numberOfEmployees", "averageNumberOfEmployees", "antalAnsatte");
    // Samlet gæld: ét begreb, ellers ÅRL (gæld uden hensatte + hensatte), ellers kort + langfristet.
    const liabilities = totalLiabilities(facts) ?? num(src, "liabilities", "totalLiabilities") ?? num(r, "liabilities", "totalLiabilities") ?? null;
    // Balancesum: det direkte begreb, ellers egenkapital + gæld (regnskabsligningen).
    const assetsTotal = f(CONCEPTS.assets, "assets", "totalAssets") ?? (typeof equity === "number" && typeof liabilities === "number" ? equity + liabilities : null);
    // EBITDA: det direkte begreb, ellers driftsresultat (EBIT) lagt til af- og nedskrivninger.
    // Driftsresultatet alene er IKKE EBITDA (det er efter afskrivninger), så uden afskrivninger vises "—".
    const ebit = f(CONCEPTS.ebit, "operatingProfit", "ebit");
    const dep = firstFact(facts, CONCEPTS.depreciation) ?? null;
    const ebitda = f(["ebitda"], "ebitda") ?? (typeof ebit === "number" && typeof dep === "number" ? ebit + Math.abs(dep) : null);
    const currentAssets = f(CONCEPTS.currentAssets, "currentAssets");
    const currentLiabilities = firstFact(facts, CONCEPTS.shortTermLiabilities) ?? null;
    years.push({
      year,
      periodStart,
      periodEnd,
      published,
      ...(publicationTime ? { publicationTime } : {}),
      ...(scope ? { scope } : {}),
      ...(currency ? { currency } : {}),
      revenue,
      grossProfit,
      profit,
      equity,
      employees,
      liabilities,
      assetsTotal,
      ebitda,
      soliditetsgrad: ratio(equity, assetsTotal),
      // Overskudsgrad = resultat af primær drift (EBIT) i procent af nettoomsætningen (ÅRL-nøgletal).
      // Uden omsætning (klasse B) er nøgletallet ikke defineret og vises som "—".
      overskudsgrad: ratio(ebit, revenue),
      likviditetsgrad: ratio(currentAssets, currentLiabilities),
    });
  }
  const byYear = new Map<number, FinancialYear>();
  // Ældre år uden XBRL-data (fx 1995–2013 for Novo Nordisk) har ingen tal og udelades.
  for (const y of years.filter(hasFigures)) {
    const prev = byYear.get(y.year);
    // Samme år kan komme flere gange (fx rettet regnskab); behold udfyldte værdier.
    byYear.set(y.year, prev ? mergeYear(prev, y) : y);
  }
  const sorted = [...byYear.values()].sort((a, b) => a.year - b.year);
  return {
    lassoId,
    currency: [...sorted].reverse().find((y) => y.currency)?.currency ?? currencyCode(pick(raw, "currency", "0.currency")) ?? "DKK",
    years: sorted,
  };
}

/** Nøgletal som "a i procent af b", afrundet til 1 decimal; "—" (null), når et af tallene mangler eller b er 0. */
function ratio(a: number | null | undefined, b: number | null | undefined): number | null {
  if (typeof a !== "number" || typeof b !== "number" || b === 0) return null;
  return Math.round((a / b) * 1000) / 10;
}

function hasFigures(y: FinancialYear): boolean {
  return [y.revenue, y.grossProfit, y.profit, y.equity, y.employees, y.liabilities].some((v) => v !== null && v !== undefined);
}

const MERGE_FIELDS = ["revenue", "grossProfit", "profit", "equity", "employees", "liabilities", "assetsTotal", "ebitda", "soliditetsgrad", "overskudsgrad", "likviditetsgrad"] as const;

function mergeYear(a: FinancialYear, b: FinancialYear): FinancialYear {
  const out: FinancialYear = { ...a };
  for (const k of MERGE_FIELDS) out[k] = a[k] ?? b[k] ?? null;
  return out;
}

let isoCurrencies: Set<string> | undefined;

/**
 * ISO 4217-kode ud fra et XBRL-`unit`: "iso4217:EUR", "ISO4217_USD", "EUR", { measure: "iso4217:EUR" }.
 * undefined for ikke-monetære enheder ("pure", "shares", "xbrli:pure", antal ansatte).
 */
export function currencyCode(unit: Json): string | undefined {
  let s: string | undefined;
  if (typeof unit === "string") s = unit;
  else if (isObj(unit)) s = str(unit, "measure", "measures.0", "code", "id", "name", "unitId", "value");
  if (!s) return undefined;
  const m = /(?:^|[:_\s/-])([A-Za-z]{3})$/.exec(s.trim()) ?? /^([A-Za-z]{3})$/.exec(s.trim());
  if (!m) return undefined;
  const code = m[1]!.toUpperCase();
  if (!isoCurrencies) {
    try {
      isoCurrencies = new Set((Intl as unknown as { supportedValuesOf(k: string): string[] }).supportedValuesOf("currency"));
    } catch {
      isoCurrencies = new Set(["DKK", "EUR", "USD", "SEK", "NOK", "GBP", "CHF", "JPY", "CNY", "ISK", "PLN"]);
    }
  }
  return isoCurrencies.has(code) ? code : undefined;
}

const SECTION_ORDER = ["incomeStatement", "statementOfFinancialPosition", "statementOfComprehensiveIncome", "statementOfChangesInEquity"];

/**
 * Går et XBRL-træ igennem og samler begreb -> tal for regnskabsperioden. Første fund vinder.
 * Tal fra en anden periode (fx sammenligningstal for året før) springes over, så de ikke
 * skygger for årets tal længere nede i træet. `units` tæller valutakoderne i bladene.
 */
function collectFacts(
  root: Json,
  periodEnd: string | undefined,
  out: Map<string, number>,
  depth = 0,
  balances?: Map<string, string>,
  units?: Map<string, number>,
): void {
  if (!isObj(root) || depth > 12) return;
  const entries = Object.entries(root);
  if (depth === 0) entries.sort(([a], [b]) => rank(a) - rank(b));
  for (const [key, node] of entries) {
    if (!isObj(node)) continue;
    const concept = key.replace(/^.*[:_#]/, "").toLowerCase();
    const fact = factValue(node, periodEnd);
    if (fact !== undefined) {
      const code = currencyCode(fact.unit);
      if (code && units) units.set(code, (units.get(code) ?? 0) + 1);
      if (!out.has(concept)) {
        out.set(concept, fact.value);
        const bal = typeof node.balance === "string" ? node.balance : undefined;
        if (bal && balances) balances.set(concept, bal);
      }
    }
    if (isObj(node.facts)) collectFacts(node.facts, periodEnd, out, depth + 1, balances, units);
    else if (Array.isArray(node.children)) for (const c of node.children) collectFacts(c, periodEnd, out, depth + 1, balances, units);
  }
}

function rank(section: string): number {
  const i = SECTION_ORDER.indexOf(section);
  return i === -1 ? SECTION_ORDER.length : i;
}

/** Slutdato (eller instant) for et tal, hvis bladet oplyser sin periode. */
function periodOf(v: Json): string | undefined {
  return dateStr(v, "period.to", "period.instant", "period.end", "period.endDate", "instant", "endDate", "context.period.to", "context.period.instant");
}

/**
 * Tallet for regnskabsperioden i et blad. Et blad kan have ét tal (`value`) eller en liste
 * (`values`/`facts`) med perioder, fx årets tal og sammenligningstal. Kun tal, hvis periode
 * matcher rapportens `period.to`, bruges; har ingen af de daterede tal den rigtige periode,
 * gives undefined frem for et tilfældigt (forrige års) tal.
 */
function factValue(node: Record<string, Json>, periodEnd: string | undefined): { value: number; unit?: Json } | undefined {
  const list = Array.isArray(node.values) ? node.values : Array.isArray(node.facts) ? node.facts : undefined;
  if (list) {
    const plain = list.filter((v) => !isObj(v) || !pick(v, "dimensions", "dimension", "members"));
    const pool = plain.length ? plain : list;
    let hit: Json;
    if (periodEnd) {
      hit = pool.find((v) => periodOf(v) === periodEnd);
      if (hit === undefined) hit = pool.find((v) => periodOf(v) === undefined);
    } else hit = pool[0];
    if (hit === undefined) return undefined;
    const value = typeof hit === "number" ? hit : num(hit, "value", "amount", "numericValue");
    return value === undefined ? undefined : { value, unit: isObj(hit) ? (pick(hit, "unit", "unitRef") ?? pick(node, "unit", "unitRef")) : pick(node, "unit", "unitRef") };
  }
  const own = periodOf(node);
  if (periodEnd && own !== undefined && own !== periodEnd) return undefined;
  const value = num(node, "value", "amount", "numericValue", "currentValue", "current");
  return value === undefined ? undefined : { value, unit: pick(node, "unit", "unitRef") };
}

/**
 * Katalog 19, "Regnskabsdetaljer": fuldt regnskab (resultatopgørelse, balance, pengestrøm)
 * ud fra samme svar som `adaptFinancials` (GET /{lassoId}/reports/advanced, bekræftet
 * endpoint). Hovedtallene (bruttofortjeneste/omsætning, resultat, egenkapital, balancesum)
 * er de samme bekræftede/afledte tal som i `FinancialsVM`; underposterne er UBEKRÆFTEDE
 * XBRL-begreb-gæt (se docs/lasso-endpoints.md) og bliver `null` ("—" i UI'en), når de ikke
 * findes i svaret, i stedet for at fejle. Pengestrøm er kun til stede, når mindst ét af
 * dens begreber er fundet (klasse B skal ikke aflægge den).
 */
export function adaptFinancialStatements(lassoId: string, raw: Json): FinancialStatementsVM {
  const reports = items(raw);
  const incomeStatement: IncomeStatementYear[] = [];
  const balanceSheet: BalanceSheetYear[] = [];
  const cashFlow: CashFlowYear[] = [];
  const currencies: { year: number; currency: string }[] = [];
  for (const r of reports) {
    const periodEnd = dateStr(r, "period.to", "periodEnd", "period.end", "endDate", "end", "reportingPeriod.end", "to");
    const periodStart = dateStr(r, "period.from", "periodStart", "period.start", "startDate", "reportingPeriod.start", "from");
    const year = num(r, "reportYear", "year", "fiscalYear", "financialYear", "aar") ?? (periodEnd ? Number(periodEnd.slice(0, 4)) : undefined);
    if (!year || !Number.isFinite(year)) continue;
    // Samme scope (koncern eller selskab) og valuta som adaptFinancials, så de to aldrig er uenige.
    const { facts, balances, currency } = reportFacts(r, periodEnd);
    if (currency) currencies.push({ year, currency });
    const g = (...concepts: string[]): number | null => firstFact(facts, concepts) ?? null;
    // Resultatopgørelsen i visningen har fortegn: omkostninger negative, indtægter positive.
    // XBRL angiver beløbet positivt og retningen i "balance" (debit = omkostning), så fortegnet
    // sættes derfra. Mangler "balance", antages en omkostningspost at være en omkostning.
    const signed = (expense: boolean, ...concepts: string[]): number | null => {
      const c = concepts.find((x) => facts.has(x));
      if (c === undefined) return null;
      const v = facts.get(c)!;
      const bal = balances.get(c);
      if (bal === "debit") return -v;
      if (bal === "credit") return v;
      return expense ? -Math.abs(v) : v;
    };
    const sum = (...vals: (number | null)[]): number | null => (vals.some((v) => typeof v === "number") ? vals.reduce<number>((a, v) => a + (v ?? 0), 0) : null);

    // Begreberne dækker både den danske taksonomi (ÅRL, fsa:) og IFRS/ESEF (børsnoterede).
    const revenue = g(...CONCEPTS.revenue);
    const grossProfit = g(...CONCEPTS.grossProfit);
    const staffCosts = signed(true, "employeebenefitsexpense", "staffcosts", "wagesandsalaries", "personnelexpenses");
    // Artsopdelt (ÅRL): andre eksterne omkostninger. Funktionsopdelt (IFRS): salg, forskning og administration samlet.
    const otherOperatingCosts =
      signed(true, "otherexternalexpenses", "otheroperatingexpenses") ??
      sum(
        signed(true, "sellingexpenseanddistributioncosts", "salescostanddistributionscosts", "distributioncosts", "sellingexpense"),
        signed(true, "researchanddevelopmentexpense"),
        signed(true, "administrativeexpense", "administrativeexpenses"),
        signed(false, "otheroperatingincomeexpense"),
      );
    const depreciation = signed(true, ...CONCEPTS.depreciation);
    const financialItemsNet =
      g("financialincomeandexpenses", "netfinancials", "financialitemsnet", "financeincomecost") ??
      sum(signed(false, "otherfinanceincome", "financeincome", "financialincome", "otherfinancialincome"), signed(true, "otherfinanceexpenses", "financecosts", "financialexpenses", "otherfinancialexpenses"));
    const profitBeforeTax = signed(false, "profitlossfromordinaryactivitiesbeforetax", "profitlossbeforetax", "profitbeforetax");
    const tax = signed(true, "taxexpenseonordinaryactivities", "taxexpense", "incometaxexpensecontinuingoperations", "incometaxexpense", "tax");
    const profit = signed(false, ...CONCEPTS.profit);
    // EBITDA: det direkte begreb, ellers EBIT + af- og nedskrivninger, ellers bruttofortjeneste − personale − andre driftsomkostninger.
    const ebitda =
      g("ebitda") ??
      (() => {
        const ebit = g(...CONCEPTS.ebit);
        return typeof ebit === "number" && typeof depreciation === "number" ? ebit + Math.abs(depreciation) : null;
      })() ??
      (typeof grossProfit === "number" && typeof staffCosts === "number" && typeof otherOperatingCosts === "number" ? grossProfit + staffCosts + otherOperatingCosts : null);
    incomeStatement.push({ year, periodStart, periodEnd, revenue, grossProfit, staffCosts, otherOperatingCosts, ebitda, depreciation, financialItemsNet, profitBeforeTax, tax, profit });

    const equityTotal = g(...CONCEPTS.equity);
    // IFRS: current/noncurrent liabilities; ÅRL: …OtherThanProvisions (hensatte står for sig).
    const longTermLiabilities = g(...CONCEPTS.longTermLiabilities);
    const shortTermLiabilities = g(...CONCEPTS.shortTermLiabilities);
    const liabilitiesTotal = totalLiabilities(facts) ?? null;
    const assetsTotal = g(...CONCEPTS.assets) ?? (typeof equityTotal === "number" && typeof liabilitiesTotal === "number" ? equityTotal + liabilitiesTotal : null);
    balanceSheet.push({
      year,
      periodEnd,
      intangibleAssets: g("intangibleassets", "intangibleassetsotherthangoodwill", "intangibleassetsandgoodwill"),
      tangibleAssets: g("propertyplantandequipment", "tangibleassets"),
      fixedAssetsTotal: g("fixedassets", "noncurrentassets"),
      tradeReceivables: g("shorttermtradereceivables", "tradereceivables", "tradeandothercurrentreceivables", "currenttradereceivables", "shorttermreceivablesfromsales"),
      otherReceivables: g("othershorttermreceivables", "othercurrentreceivables", "prepayments"),
      cash: g("cashandcashequivalents", "cash"),
      currentAssetsTotal: g(...CONCEPTS.currentAssets),
      assetsTotal,
      shareCapital: g("contributedcapital", "issuedcapital", "sharecapital"),
      retainedEarnings: g("retainedearnings"),
      equityTotal,
      longTermLiabilities,
      shortTermLiabilities,
      liabilitiesTotal,
      liabilitiesAndEquityTotal: g("liabilitiesandequity", "equityandliabilities") ?? assetsTotal,
    });

    const workingCapitalChange = g("increasedecreaseinworkingcapital", "changeinworkingcapital");
    const operatingCashFlow = g("cashflowsfromusedinoperatingactivities");
    const intangible = g("purchaseofintangibleassets", "purchaseofintangibleassetsclassifiedasinvestingactivities");
    // Køb er en udbetaling: altid negativ i visningen, uanset hvordan beløbet er indberettet.
    const intangibleInvestments = typeof intangible === "number" ? -Math.abs(intangible) : null;
    const investingCashFlow = g("cashflowsfromusedininvestingactivities");
    const capitalIncrease = g("proceedsfromissuingshares", "increasedecreaseinsharecapital");
    const loanChange = g("proceedsfromrepaymentsofborrowings");
    const financingCashFlow = g("cashflowsfromusedinfinancingactivities");
    const netCashFlow = g("increasedecreaseincashandcashequivalents", "cashflowfortheyear");
    const cashBeginning = g("cashandcashequivalentsatbeginningofperiod");
    const cashEnding = g("cashandcashequivalentsatendofperiod");
    // Kun med, når mindst ét pengestrøms-specifikt begreb er fundet (klasse B skal ikke aflægge opgørelsen).
    // "profit"/"depreciation" tælles ikke med her, da de altid er udfyldt via fallback fra resultatopgørelsen.
    const hasCashFlowData = [
      workingCapitalChange,
      operatingCashFlow,
      intangibleInvestments,
      investingCashFlow,
      capitalIncrease,
      loanChange,
      financingCashFlow,
      netCashFlow,
      cashBeginning,
      cashEnding,
    ].some((v) => typeof v === "number");
    if (hasCashFlowData) {
      cashFlow.push({
        year,
        periodEnd,
        profit: g("profitloss", "profitlossfortheyear") ?? profit,
        depreciation: g("depreciationamortisationexpense", "depreciation") ?? depreciation,
        workingCapitalChange,
        operatingCashFlow,
        intangibleInvestments,
        investingCashFlow,
        capitalIncrease,
        loanChange,
        financingCashFlow,
        netCashFlow,
        cashBeginning,
        cashEnding,
      });
    }
  }
  const dedupeByYear = <T extends { year: number }>(list: T[]): T[] => {
    const byYear = new Map<number, T>();
    for (const item of list) byYear.set(item.year, item);
    return [...byYear.values()].sort((a, b) => a.year - b.year);
  };
  return {
    lassoId,
    currency: currencies.sort((a, b) => a.year - b.year).at(-1)?.currency ?? currencyCode(pick(raw, "currency", "0.currency")) ?? "DKK",
    incomeStatement: dedupeByYear(incomeStatement),
    balanceSheet: dedupeByYear(balanceSheet),
    cashFlow: dedupeByYear(cashFlow),
  };
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

/**
 * Tekstsektioner fra CVR-stamdata (katalog 12). Branche er bekræftet (samme
 * felter som adaptCompany); formål og tegningsregler er UBEKRÆFTEDE feltnavne
 * (se docs/lasso-endpoints.md under "Ubekræftet") og udelades stille, hvis de
 * ikke findes i svaret.
 */
export function adaptTextSections(lassoId: string, raw: Json): TextSectionsVM {
  const sections: TextSectionsVM["sections"] = [];
  const industryText = str(raw, "industry.text", "industryText", "industry.name", "mainIndustry.text");
  const industryCode = str(raw, "industry.code", "industryCode", "mainIndustry.code");
  if (industryText) sections.push({ heading: "Branche", body: industryText, note: industryCode ? `NACE ${industryCode}` : undefined });
  const purpose = str(raw, "purpose", "purposeText", "companyPurpose", "objectClause", "formaal", "formål");
  if (purpose) sections.push({ heading: "Formål", body: purpose });
  const signing = str(raw, "signingRule", "signingRules", "powerToBind", "bindingRule", "tegningsregel", "tegningsregler");
  if (signing) sections.push({ heading: "Tegningsregler", body: signing });
  return { lassoId, title: "Virksomhedsprofil", sections };
}

/**
 * Historik (katalog 12, "Tidslinje"). Sat sammen af data, vi allerede henter
 * andre steder fra (ingen egen endpoint): stiftelse fra virksomhedsopslaget,
 * ledelsesskift fra stakeholders/board/management, og offentliggjorte
 * regnskaber fra reports/advanced. Andre begivenhedstyper (navneskift,
 * adresseskift, kapitalændring) kræver kilder, vi ikke har bekræftet endnu,
 * og udelades derfor i den rigtige tidslinje (se demo.ts for eksempler).
 */
export function adaptTimeline(lassoId: string, companyRaw: Json, people: readonly PersonRowVM[], years: readonly FinancialYear[]): TimelineVM {
  const events: TimelineEventVM[] = [];
  const founded = dateStr(companyRaw, "lifeTime.from", "creationDate", "founded", "foundedDate");
  const name = str(companyRaw, "name", "companyName", "navn");
  if (founded) events.push({ date: founded, title: "Virksomheden stiftet", detail: name, category: "Stamdata" });
  for (const p of people) {
    if (p.from) events.push({ date: p.from, title: `${p.name} er indtrådt`, detail: p.role, category: "Ledelse" });
    if (p.to) events.push({ date: p.to, title: `${p.name} er fratrådt`, detail: p.role, category: "Ledelse" });
  }
  for (const y of years) {
    const date = y.publicationTime ?? y.periodEnd;
    if (!date) continue;
    const parts = [
      y.grossProfit != null ? `Bruttofortjeneste ${formatAmountShort(y.grossProfit, y.currency)}` : null,
      y.profit != null ? `resultat ${formatAmountShort(y.profit, y.currency)}` : null,
    ].filter((x): x is string => Boolean(x));
    events.push({ date, title: `Årsrapport ${y.year} offentliggjort`, detail: parts.join(", ") || undefined, category: "Regnskab" });
  }
  events.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return { lassoId, events };
}

/** Kort beløbstekst til tidslinjens detaljelinje (samme regler som card.ts), i regnskabets valuta. */
function formatAmountShort(v: number, currency?: string): string {
  const unit = currencyUnit(currency);
  const abs = Math.abs(v);
  if (abs >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1).replace(".", ",")} mia. ${unit}`;
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(".", ",")} mio. ${unit}`;
  if (abs >= 10_000) return `${Math.round(v / 1_000)} t. ${unit}`;
  return `${Math.round(v)} ${unit}`;
}

/**
 * Reelle ejere (katalog 11, "Reelle ejere"). Endpoint og svarform er
 * UBEKRÆFTEDE (se docs/lasso-endpoints.md under "Ubekræftet"). Antagelsen er
 * baseret på Lassos dokumenterede "ultimate owners"-funktion: en liste af
 * ejere med navn, identifikator, en samlet andel som interval
 * (totalOwnerPercentageMin/Max) og en eller flere kæder ("paths") af
 * mellemliggende selskaber. Et "UNKNOWN"-element markerer andel, CVR ikke
 * kan følge til en person.
 */
export function adaptBeneficialOwnership(lassoId: string, raw: Json): BeneficialOwnershipVM {
  const list = items(raw);
  const owners: BeneficialOwnerVM[] = [];
  const gaps: BeneficialOwnerGapVM[] = [];
  for (const entry of list) {
    const type = str(entry, "type", "kind") ?? "";
    const name = str(entry, "name");
    const lo = num(entry, "totalOwnerPercentageMin", "ownerPercentageMin", "share.from", "ownership.from");
    const hi = num(entry, "totalOwnerPercentageMax", "ownerPercentageMax", "share.to", "ownership.to");
    const share = rangeText(lo, hi);
    if (/unknown|ukendt/i.test(type) || !name) {
      if (share) gaps.push({ share, reason: "CVR har ikke registreret en reel ejer for denne andel." });
      continue;
    }
    owners.push({ name, lassoId: str(entry, "identifier", "lassoId", "id"), chain: beneficialChain(entry), share });
  }
  owners.sort((a, b) => shareFloor(b.share) - shareFloor(a.share));
  return { lassoId, owners, gaps: gaps.length ? gaps : undefined };
}

/** "25 til 33.32" (allerede i procent, ikke brøk) -> "25–33,32 %". */
function rangeText(lo: number | undefined, hi: number | undefined): string | undefined {
  if (lo === undefined) return undefined;
  const a = percentFormat.format(lo);
  if (hi === undefined || hi === lo) return `${a} %`;
  return `${a}–${percentFormat.format(hi)} %`;
}

/** Bygger "via X ApS, 100 %" (ét led) eller "via N led, X ApS" (flere led) ud fra første kæde i "paths". */
function beneficialChain(entry: Json): string | undefined {
  const paths = arr(entry, "paths", "chains");
  const path = paths[0];
  if (!path) return undefined;
  const steps = arr(path, "ownership", "companies", "chain", "intermediateCompanies", "steps");
  const first = steps[0];
  const firstName = first ? str(first, "name") : undefined;
  if (!firstName) return undefined;
  const firstShare = first ? rangeText(num(first, "percentageMin", "share.from"), num(first, "percentageMax", "share.to")) ?? str(first, "percentage") : undefined;
  if (steps.length > 1) return `via ${steps.length} led, ${firstName}`;
  return firstShare ? `via ${firstName}, ${firstShare}` : `via ${firstName}`;
}

/**
 * Nyheder (katalog 12, "Nyheder"). Bekræftet mod docs.lassox.com/data-apis/paqle/:
 * { news: [{ headline, content, url, time, provider, providerData: { sourceName, published } }], continuationToken }.
 */
export function adaptNews(lassoId: string, raw: Json, limit: number): NewsVM {
  const list = arr(raw, "news").length ? arr(raw, "news") : items(raw);
  const newsItems = list
    .map((n) => {
      const headline = str(n, "headline", "providerData.headline");
      if (!headline) return null;
      return {
        source: str(n, "providerData.sourceName", "provider", "source") ?? "Ukendt kilde",
        url: str(n, "url", "link"),
        time: dateStr(n, "time", "providerData.published", "publishedAt"),
        headline,
        excerpt: str(n, "content", "excerpt", "providerData.extract"),
        language: str(n, "language", "lang"),
      };
    })
    .filter((n): n is NonNullable<typeof n> => n !== null)
    .slice(0, limit);
  return { lassoId, items: newsItems };
}

/**
 * Svarformen for GET /modules/observations/{lassoId} er UBEKRÆFTET (ingen
 * API-nøgle i denne omgang; se docs/lasso-endpoints.md under "Ubekræftet" for
 * den antagne form). Adapteren er derfor defensiv: den prøver mange
 * feltnavne, accepterer et rent array eller et svar pakket i {observations|items|results:[...]},
 * og falder tilbage til "0 observationer" frem for at kaste, hvis formen ikke matcher.
 */
function normalizeSeverity(v: Json): Severity {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v)) ? Number(v) : undefined;
  if (typeof n === "number" && Number.isFinite(n)) {
    if (n >= 90) return 100;
    if (n >= 40) return 50;
    if (n >= 10) return 25;
    return 0;
  }
  const s = typeof v === "string" ? v.toLowerCase() : "";
  if (/high|vigtig|critical|important|konflikt|alert/.test(s)) return 100;
  if (/medium|mulig|warning|moderat/.test(s)) return 50;
  if (/low|info|minor|notice/.test(s)) return 25;
  return 0;
}

export function adaptObservations(lassoId: string, raw: Json): ObservationsVM {
  // items() kender ikke "observations" som pakke-nøgle, så den prøves først.
  const list = Array.isArray(raw) ? raw : arr(raw, "observations", "results", "items", "hits", "data", "records", "value");
  const observations: ObservationRowVM[] = [];
  let i = 0;
  for (const o of list) {
    const title = str(o, "title", "headline", "summary", "text", "message", "name", "description");
    if (!title) continue;
    const description = str(o, "detail", "description", "explanation", "body", "text");
    observations.push({
      id: str(o, "id", "observationId", "uuid") ?? `${lassoId}-${i++}`,
      severity: normalizeSeverity(pick(o, "severity", "score", "riskScore", "level", "importance", "category")),
      title,
      detail: description && description !== title ? description : undefined,
      source: str(o, "source", "category", "origin", "basedOn", "module"),
      date: dateStr(o, "date", "observedAt", "createdAt", "eventDate", "occurredAt", "reportedAt"),
    });
  }
  return {
    lassoId,
    observations,
    checkedAt: dateStr(raw, "checkedAt", "generatedAt", "lastChecked", "updatedAt", "meta.checkedAt", "meta.generatedAt"),
    sources: undefined,
  };
}

/**
 * Katalog 20, produktionsenheder. UBEKRÆFTET: ingen testvirksomhed med flere
 * P-numre er set endnu, så feltnavnene er et kvalificeret gæt ud fra CVR's
 * almindelige navngivning (`productionUnits`/`produktionsenheder`). Findes
 * feltet ikke i svaret fra GET /{lassoId}, bliver listen tom, og komponenten
 * viser sin tom-tilstand i stedet for at fejle. Se docs/lasso-endpoints.md.
 */
export function adaptProductionUnits(lassoId: string, raw: Json): ProductionUnitsVM {
  const list = arr(raw, "productionUnits", "produktionsenheder", "units", "secondaryUnits", "establishments");
  const main = pick(raw, "mainUnit", "productionUnit", "hovedenhed", "primaryUnit");
  const candidates: Json[] = [...(main !== undefined ? [main] : []), ...list];
  const units: ProductionUnitVM[] = candidates
    .map((u): ProductionUnitVM | null => {
      const pNumber = str(u, "pNumber", "productionUnitNumber", "unitNumber", "pnr", "number");
      if (!pNumber) return null;
      const status = str(u, "status", "unitStatus", "companyStatus", "virksomhedsstatus");
      const endedRaw = dateStr(u, "endDate", "to", "lifeTime.to", "ophoersdato", "validTo");
      return {
        pNumber,
        name: str(u, "name", "unitName", "navn"),
        address: address(u),
        isMain: Boolean(pick(u, "main", "isMain", "hovedenhed")) || u === main,
        industryCode: str(u, "industryCode", "industry.code", "branchekode"),
        industryText: str(u, "industryText", "industry.text", "industry.name", "branchetekst"),
        employees: num(u, "employees.count", "employees", "numberOfEmployees", "antalAnsatte") ?? null,
        status,
        statusKind: statusKind(status),
        endedYear: endedRaw ? Number(endedRaw.slice(0, 4)) : undefined,
        created: dateStr(u, "startDate", "from", "lifeTime.from", "oprettelsesdato", "validFrom"),
      };
    })
    .filter((u): u is ProductionUnitVM => u !== null);
  // Hovedenheden først (katalog 20), derefter i den rækkefølge, Lasso leverer dem.
  const sorted = [...dedupe(units, (u) => u.pNumber ?? "")].sort((a, b) => (b.isMain ? 1 : 0) - (a.isMain ? 1 : 0));
  return { lassoId, units: sorted };
}

/**
 * Katalog 20, ejendomme/BBR. `ejfRaw` er svaret fra ejerfortegnelsen
 * (`/data/ejf/{lassoId}/ownerships/current`); formen er UBEKRÆFTET, så alle
 * felter læses defensivt. `ejfBbrRefs` finder property-/kommunenummeret, som
 * skal slås op mod BBR (`bbrSummary`); `mergeBbr` fylder bygninger og arealer
 * ind, når det svar er hentet. Se docs/lasso-endpoints.md.
 */
export function adaptProperties(lassoId: string, ejfRaw: Json): PropertiesVM {
  const list = items(ejfRaw);
  const properties: PropertyVM[] = list.map((p) => {
    const prop = pick(p, "property", "ejendom", "ejendomme") ?? p;
    const matrikelNr = str(prop, "matrikelNumber", "matrikelnummer", "landRegistryNumber", "matrikel.number");
    const matrikelDistrict = str(prop, "matrikelDistrict", "landRegistryDistrict", "matrikel.district", "ejerlav");
    const matrikel = matrikelNr ? [matrikelNr, matrikelDistrict].filter(Boolean).join(", ") : str(prop, "matrikel", "matrikelText");
    const ownershipFrom = dateStr(p, "acquisition.date", "from", "tinglystDato", "registrationDate", "acquiredDate");
    const ownershipKind = str(p, "ownershipType", "type", "ejerforhold") ?? "Ejer";
    return {
      address: address(prop),
      matrikel,
      bfeNumber: str(prop, "bfeNumber", "bfeNummer", "bfe"),
      propertyType: str(prop, "propertyType", "ejendomstype", "benyttelse", "usageText"),
      ownership: ownershipFrom ? `${ownershipKind}, tinglyst ${ownershipFrom.slice(0, 4)}` : ownershipKind,
      landAreaM2: num(prop, "landArea", "grundareal", "areal.grund") ?? null,
      builtAreaM2: null,
      publicValuation: valuationFrom(prop),
      encumbrances: num(p, "encumbrances", "haeftelser", "encumbranceCount"),
      buildings: [],
      hasGeometry: false,
    } satisfies PropertyVM;
  });
  return { lassoId, properties };
}

function valuationFrom(obj: Json): PropertyVM["publicValuation"] {
  const amount = num(obj, "publicValuation.amount", "offentligVurdering.beloeb", "publicValuation.value", "publicValuation");
  if (amount === undefined) return undefined;
  return { amount, year: num(obj, "publicValuation.year", "offentligVurdering.aar") };
}

/** Property-/kommunenummer til BBR-opslag, i samme rækkefølge som `adaptProperties`. UBEKRÆFTET. */
export interface BbrRef {
  /** BFE-nummer, som BBR-opslaget bruger (data/bbr/property/summary?bfeNumber=…). */
  bfeNumber?: string;
}

export function ejfBbrRefs(ejfRaw: Json): BbrRef[] {
  return items(ejfRaw).map((p) => {
    const prop = pick(p, "property", "ejendom", "ejendomme") ?? p;
    return {
      bfeNumber: str(prop, "bfeNumber", "bfe", "bfeNummer", "BFEnummer", "samletFastEjendom.bfeNumber") ?? str(p, "bfeNumber", "bfe"),
    };
  });
}

/** Fylder bygninger og arealer fra et BBR-svar (`bbrSummary`) ind i en ejendom. UBEKRÆFTET form. */
export function mergeBbr(property: PropertyVM, bbrRaw: Json): PropertyVM {
  const buildingsRaw = arr(bbrRaw, "buildings", "bygninger");
  const buildings: BuildingVM[] = buildingsRaw.map(
    (b): BuildingVM => ({
      number: num(b, "buildingNumber", "bygningsnummer", "number"),
      usage: str(b, "usageText", "anvendelse", "usage", "buildingUse"),
      builtYear: num(b, "builtYear", "opfoerelsesaar", "constructionYear"),
      floors: num(b, "floors", "etager", "numberOfFloors"),
      areaM2: num(b, "totalArea", "samletAreal", "area") ?? null,
      units: num(b, "unitCount", "enheder", "numberOfUnits") ?? null,
    }),
  );
  return {
    ...property,
    hasGeometry: Boolean(pick(bbrRaw, "geometry", "polygon", "matrikelGeometry")),
    landAreaM2: property.landAreaM2 ?? num(bbrRaw, "landArea", "grundareal") ?? null,
    builtAreaM2: num(bbrRaw, "builtUpArea", "bebyggetAreal", "totalBuiltArea") ?? property.builtAreaM2 ?? null,
    publicValuation: property.publicValuation ?? valuationFrom(bbrRaw),
    buildings: buildings.length ? buildings : property.buildings,
  };
}

/**
 * Katalog 20, CHR. Endpointet er UBEKRÆFTET og ikke fundet i docs.lassox.com
 * under dette arbejde; feltnavnene er et gæt ud fra CHR's danske terminologi.
 * `LiveProvider` kalder ikke noget endpoint for dette og returnerer altid en
 * tom liste med en begrundelse, indtil endpointet er bekræftet. Se
 * docs/lasso-endpoints.md.
 */
export function adaptLivestock(lassoId: string, raw: Json): LivestockVM {
  const herdsRaw = arr(raw, "herds", "besaetninger", "stocks", "herd");
  const herds: LivestockHerdVM[] = herdsRaw.map((h): LivestockHerdVM => {
    const count = num(h, "count", "antal", "capacity", "numberOfAnimals");
    return {
      species: str(h, "species", "dyreart", "animalType"),
      category: str(h, "category", "underart", "subType", "type"),
      count: count ?? null,
      unit: str(h, "unit", "enhed") ?? (num(h, "capacity") !== undefined ? "stipladser" : "dyr"),
    };
  });
  const eventsRaw = arr(raw, "events", "haendelser", "veterinaryEvents", "vetEvents");
  const events: VetEventVM[] = eventsRaw.map((e): VetEventVM => {
    const kind = str(e, "severity", "status", "type", "kind") ?? "";
    return {
      title: str(e, "title", "titel", "type"),
      detail: str(e, "detail", "beskrivelse", "species", "dyreart"),
      date: dateStr(e, "date", "dato", "from"),
      dateTo: dateStr(e, "to", "dateTo"),
      severity: /restrik|aktiv|active/i.test(kind) ? "active" : "neutral",
    };
  });
  return {
    lassoId,
    chrNumber: str(raw, "chrNumber", "chrNummer", "chr"),
    ownerName: str(raw, "ownerName", "ejer", "holderName"),
    updated: dateStr(raw, "updatedAt", "opdateret"),
    herds,
    healthStatus: str(raw, "healthStatus", "sundhedsstatus"),
    events,
  };
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

/* ---------- Ejergraf (katalog 14): POST /modules/relations/graph, UBEKRÆFTET form ---------- */

/**
 * Ejerandel som interval i procent: { from: 0.25, to: 0.3332 } -> [25, 33.32]; 0.5 -> [50, 50];
 * "25–33,32 %" -> [25, 33.32]; 100 -> [100, 100]. Brøker (≤ 1) ganges med 100.
 */
export function shareRange(v: Json): [number, number] | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  if (typeof v === "string") {
    const nums = v.match(/\d+(?:[.,]\d+)?/g)?.map((n) => Number(n.replace(",", ".")));
    if (!nums?.length) return undefined;
    const lo = nums[0]!;
    const hi = nums[1] ?? lo;
    const scale = /%/.test(v) || hi > 1 ? 1 : 100;
    return [round2(lo * scale), round2(hi * scale)];
  }
  const lo = typeof v === "number" ? v : isObj(v) ? num(v, "from", "min", "lower", "low", "value", "share") : undefined;
  if (lo === undefined) return undefined;
  const hi = isObj(v) ? (num(v, "to", "max", "upper", "high") ?? lo) : lo;
  const scale = hi <= 1 ? 100 : 1;
  return [round2(lo * scale), round2(hi * scale)];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Endepunkt i en relation: et id eller et indlejret objekt. */
function endpoint(rel: Json, keys: string[]): { id?: string; obj?: Json } {
  for (const k of keys) {
    const v = at(rel, k);
    if (typeof v === "string" && v.trim()) return { id: v.trim() };
    if (typeof v === "number") return { id: String(v) };
    if (isObj(v)) {
      const id = str(v, "lassoId", "id", "entityId", "key");
      if (id) return { id, obj: v };
    }
  }
  return {};
}

function nodeFrom(raw: Json, id: string): OwnershipNodeVM {
  // Berigelsen "companyinfo" kan ligge direkte på noden eller under et felt.
  const info = pick(raw, "companyInfo", "companyinfo", "enrichments.companyinfo", "enrichments.companyInfo", "data", "entity", "properties") ?? raw;
  const get = (...p: string[]) => str(info, ...p) ?? str(raw, ...p);
  const type = (get("type", "entityType", "kind", "nodeType", "entity.type") ?? "").toLowerCase();
  const country = get("country", "countryCode", "address.country", "address.countryCode");
  // Personnoder har navnet under andre nøgler end selskaber (fx fullName/personName/person.name).
  const name = get("name", "companyName", "legalName", "displayName", "fullName", "personName", "person.name", "participant.name", "names.0", "navn");
  const kind = participantKind(type || undefined, id, name);
  const status = get("status", "companyStatus", "lifecycle.status", "state");
  const cc = country && country.length <= 3 && !/^(dk|dnk|danmark|denmark)$/i.test(country) ? country.toUpperCase().slice(0, 2) : undefined;
  return {
    id,
    name: name ?? id,
    kind,
    cvr: get("cvr", "cvrNumber", "vat", "vatNumber") ?? (/^CVR-1-(\d{8})$/i.exec(id)?.[1]),
    form: get("form.shortDescription", "companyForm", "legalForm", "form"),
    status,
    statusKind: statusKind(status),
    country: cc,
    registrationNo: cc ? get("registrationNumber", "foreignId", "orgNumber", "organisationNumber") : undefined,
    equity: num(info, "equity", "financials.equity", "keyFigures.equity") ?? null,
  };
}

/**
 * Normaliserer ejergrafen til noder og kanter. Formen er ikke bekræftet (ingen API-nøgle
 * ved udviklingen); adapteren tåler derfor:
 *  - { nodes|entities|vertices: [...] | { [id]: node }, edges|relations|links|relationships: [...] }
 *  - en liste af relationer med indlejrede ejer/ejet-objekter,
 *  - kanter med { from|source|owner|parent, to|target|owned|child|company } som id eller objekt,
 *  - andele som brøk-interval { from, to }, tal eller tekst ("25–33,32 %"), under ownership|share|…
 * Kanten går altid fra ejer til ejet. Relationer af anden type end ejerskab springes over.
 */
export function adaptOwnershipGraph(
  rootId: string,
  raw: Json,
  opts: { ingoingDepth: number; outgoingDepth: number; onDate?: string },
): OwnershipGraphVM {
  const container = isObj(raw) && isObj(at(raw, "graph")) ? at(raw, "graph") : isObj(raw) && isObj(at(raw, "data")) && !Array.isArray(at(raw, "data")) ? at(raw, "data") : raw;
  const nodes = new Map<string, OwnershipNodeVM>();
  const nodeSource = pick(container, "nodes", "entities", "vertices", "participants", "items");
  const nodeList: [string | undefined, Json][] = Array.isArray(nodeSource)
    ? nodeSource.map((n) => [undefined, n])
    : isObj(nodeSource)
      ? Object.entries(nodeSource)
      : [];
  for (const [key, n] of nodeList) {
    const id = str(n, "lassoId", "id", "entityId", "key") ?? key;
    if (!id) continue;
    nodes.set(id, nodeFrom(n, id));
  }

  const relList = Array.isArray(container) ? container : arr(container, "edges", "relations", "links", "relationships", "ownerships", "results");
  const edges: OwnershipEdgeVM[] = [];
  for (const r of relList) {
    const type = (str(r, "relationType", "type", "kind", "relation") ?? "ownership").toLowerCase();
    if (type && !/owner|ejer|share|legal/.test(type)) continue;
    const from = endpoint(r, ["from", "source", "sourceId", "fromId", "owner", "ownerId", "parent", "parentId", "start"]);
    const to = endpoint(r, ["to", "target", "targetId", "toId", "owned", "ownedId", "company", "companyId", "child", "childId", "end"]);
    if (!from.id || !to.id) continue;
    for (const ep of [from, to]) if (!nodes.has(ep.id!)) nodes.set(ep.id!, nodeFrom(ep.obj ?? {}, ep.id!));
    const props = pick(r, "properties", "attributes", "data") ?? r;
    const share = shareRange(pick(props, "ownership", "share", "ownershipShare", "ownershipPercentage", "capital", "interval", "percentage") ?? pick(r, "ownership", "share"));
    const votes = shareRange(pick(props, "voteRights", "votingRights", "votes", "voting") ?? pick(r, "voteRights", "votingRights"));
    edges.push({
      from: from.id,
      to: to.id,
      share: share ?? votes,
      votes: share && votes && (share[0] !== votes[0] || share[1] !== votes[1]) ? votes : undefined,
      classes: str(props, "shareClasses", "classes", "shareClass"),
      since: dateStr(props, "validFrom", "from.date", "since", "startDate", "period.from", "lifeTime.from") ?? dateStr(r, "validFrom", "startDate"),
      until: dateStr(props, "validTo", "until", "endDate", "period.to", "lifeTime.to") ?? dateStr(r, "validTo", "endDate"),
    });
  }
  // Roden findes altid, også når grafen er tom.
  if (!nodes.has(rootId)) nodes.set(rootId, nodeFrom({}, rootId));
  nodes.get(rootId)!.root = true;
  return {
    rootId,
    nodes: [...nodes.values()],
    edges,
    ingoingDepth: opts.ingoingDepth,
    outgoingDepth: opts.outgoingDepth,
    onDate: opts.onDate,
    fetchedAt: new Date().toISOString(),
  };
}

/** Reserve, når ejergrafen ikke kan hentes: direkte ejere fra virksomhedsopslaget (ét lag op). */
export function graphFromOwnership(rootId: string, rootName: string, o: OwnershipVM, opts: { ingoingDepth: number; outgoingDepth: number; onDate?: string }): OwnershipGraphVM {
  const nodes: OwnershipNodeVM[] = [{ id: rootId, name: rootName, kind: "company", root: true, cvr: /^CVR-1-(\d{8})$/i.exec(rootId)?.[1] }];
  const edges: OwnershipEdgeVM[] = [];
  o.owners.forEach((w, i) => {
    const id = w.lassoId ?? `owner:${i}:${w.name}`;
    if (!nodes.some((n) => n.id === id)) nodes.push({ id, name: w.name, kind: w.kind ?? "person" });
    edges.push({ from: id, to: rootId, share: shareRange(w.share), votes: w.votes ? shareRange(w.votes) : undefined });
  });
  return { rootId, nodes, edges, ingoingDepth: Math.min(1, opts.ingoingDepth), outgoingDepth: 0, onDate: opts.onDate, fetchedAt: new Date().toISOString(), note: "Kun direkte ejere; ejergrafen kunne ikke hentes." };
}
