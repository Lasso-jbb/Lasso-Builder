import { formatDate, formatEmail, formatNumber, formatPhone, formatWeb } from "./format.js";
import type { Address, CompanyVM, FinancialYear, OwnershipVM } from "./models.js";
import type { ViewComponent } from "./spec.js";

/**
 * Rækkerne i "Virksomhedsoplysninger" (LassoKeyValueList variant "company"). Ét sted, så
 * komponenten og komponisten (som udelader listen under 2 rækker) altid tæller det samme.
 *
 * Ingen 1:1-gentagelser på samme side: hovedet ejer identiteten (CVR, form, stiftet, adresse,
 * ansatte i CVR, branche), kontaktblokken ejer telefon/e-mail/web, og ejerlisten viser revisor
 * med skiftedato. Står de på siden, viser listen kun det, de ikke viser.
 */
/**
 * Rækkernes nøgler, så et element kan vise netop de rækker, spørgsmålet gælder (LassoKeyValueList
 * variant "company" med `rows`, fx revisor, seneste revisorskift og regnskabsperiode).
 */
export const COMPANY_FACT_KEYS = [
  "revisor",
  "revisorskift",
  "regnskabsperiode",
  "stiftet",
  "form",
  "branche",
  "ansatte",
  "adresse",
  "branchekode",
  "kommune",
  "region",
  "telefon",
  "email",
  "web",
  // Stamoplysninger (portalens liste, Jakob 30.09): kun med når `rows` beder om dem, så brugeren
  // selv kan vælge felter og rækkefølge.
  "firmanavn",
  "cvr",
  "binavne",
  "status",
  "reklamebeskyttet",
  "vedtaegtsaendring",
  "regnskabsaar",
  "senesteregnskab",
  "selskabskapital",
  "boersnoteret",
  "underskriverrevisor",
  "formaal",
  "tegningsregel",
  "brancher",
  // Jakob 01.10: værdiansættelse. Lassos API har ingen kilde endnu (/modules/valuations svarer tomt), så rækken siger "Mangler".
  "valuation",
] as const;
export type CompanyFactKey = (typeof COMPANY_FACT_KEYS)[number];

/** Portalens stamoplysninger i portalens rækkefølge (Lassos fane "Stamoplysninger"). Standard for en fuld stamdataliste. */
export const STAMDATA_ROWS: readonly CompanyFactKey[] = [
  "firmanavn", "adresse", "kommune", "reklamebeskyttet", "telefon", "email", "web", "cvr", "binavne", "status", "stiftet", "form",
  "vedtaegtsaendring", "regnskabsaar", "senesteregnskab", "selskabskapital", "boersnoteret", "revisor", "underskriverrevisor",
  "formaal", "tegningsregel", "ansatte", "brancher",
];

export interface CompanyFact {
  /** Rækkens nøgle, når den svarer til en CompanyFactKey (så `rows` kan vælge den). Nye Paper-rækker (CVR-nummer, bibrancher, revision, kapital) er uden nøgle. */
  key?: CompanyFactKey;
  label: string;
  value?: string;
  /** Revisorens Lasso-ID, så navnet kan åbnes i værter med drill-down. */
  lassoId?: string;
  /** 02c.10 Branche med kode: koden står først i muted, derefter branchetekst (value). */
  code?: string;
  /** Katalog 28.7: "Fravalgt" revision er den eneste værdi, der farves (warning-tekst, med ordet). */
  tone?: "warning";
}

export interface CompanyFactOptions {
  /** LassoCompanyHead står på siden: stiftet, form, branche, ansatte og adresse gentages ikke. */
  hideIdentity?: boolean;
  /** LassoContact står på siden: adresse, telefon, e-mail og web gentages ikke. */
  hideContact?: boolean;
  /** LassoOwnerList står på siden og viser revisor og skiftedato. */
  hideAuditor?: boolean;
  /** Kun disse rækker, i denne rækkefølge (efter reglerne ovenfor: hovedet ejer stadig identiteten). */
  rows?: readonly CompanyFactKey[];
}

/** "2025-01-01" -> "01.01" (dag.måned, uden år, katalog 09: "01.01–31.12"). */
function dayMonth(value: string | undefined): string | undefined {
  const m = value ? /^\d{4}-(\d{2})-(\d{2})/.exec(value) : null;
  return m ? `${m[2]}.${m[1]}` : undefined;
}

/** Regnskabsperioden uden år, "01.01 – 31.12" (09.2: mellemrum om tankestregen), når begge datoer er kendt. */
export function accountingPeriod(year: Pick<FinancialYear, "periodStart" | "periodEnd"> | undefined): string | undefined {
  const from = dayMonth(year?.periodStart);
  const to = dayMonth(year?.periodEnd);
  return from && to ? `${from} – ${to}` : undefined;
}

/**
 * CVR's ansattetal (danske ansatte) og regnskabets (ofte koncernen) kan afvige meget;
 * begge vises med kilde, så forskellen ikke ligner en fejl: "64 (CVR), 62 i regnskab 2024".
 */
function employeesText(company: CompanyVM, lastYear: FinancialYear | undefined): string | undefined {
  const cvr = company.employees != null ? `${formatNumber(company.employees)} (CVR)` : undefined;
  const fromReport = lastYear && typeof lastYear.employees === "number" ? lastYear.employees : null;
  if (fromReport === null || fromReport === company.employees) return cvr;
  const report = `${formatNumber(fromReport)} i regnskab ${lastYear!.year}`;
  return cvr ? `${cvr}, ${report}` : report;
}

/**
 * Standardrækkefølgen i "Virksomhedsoplysninger" (Jakob 01.10, 09.2): Branche, Formål, Kommune,
 * Reklamebeskyttet, Telefon, E-mail, Website, CVR, Binavne, Status, Stiftelsesdato, Virksomhedsform,
 * Seneste vedtægtsændring, Regnskabsår, Seneste regnskab udgivet, Selskabskapital, Børsnoteret,
 * Revisor, Underskrivende revisor, Tegningsregler, Antal ansatte.
 */
export const COMPANY_FACT_ORDER: readonly CompanyFactKey[] = [
  "branche", "formaal", "kommune", "reklamebeskyttet", "telefon", "email", "web", "cvr", "binavne", "status", "stiftet", "form",
  "vedtaegtsaendring", "regnskabsaar", "senesteregnskab", "selskabskapital", "boersnoteret", "revisor", "underskriverrevisor",
  "tegningsregel", "ansatte",
];

const IDENTITY: readonly CompanyFactKey[] = ["cvr", "stiftet", "form", "branche", "adresse", "firmanavn", "status"];
const CONTACT: readonly CompanyFactKey[] = ["adresse", "telefon", "email", "web"];
const AUDITOR: readonly CompanyFactKey[] = ["revisor", "revisorskift", "underskriverrevisor"];

/**
 * Rækkerne med værdi i standardrækkefølgen (COMPANY_FACT_ORDER) eller i den rækkefølge, `rows` beder om.
 * Revisor står også uden navn ("Ikke registreret"), når virksomheden har regnskaber (så mangler den
 * reelt); ellers udelades tomme rækker. Det, der står andetsteds på siden, gentages ikke (options).
 */
export function companyFacts(company: CompanyVM, ownership: OwnershipVM | undefined, lastYear: FinancialYear | undefined, options: CompanyFactOptions = {}): CompanyFact[] {
  const a = company.address;
  const auditor = ownership?.auditor;
  const cap = company.registeredCapital;
  const industries = [company.industryText ? `${company.industryCode ? `${company.industryCode}: ` : ""}${company.industryText}` : undefined, ...(company.altIndustries ?? []).map((b) => [b.code, b.text].filter(Boolean).join(": "))].filter(Boolean);
  const all: Record<CompanyFactKey, CompanyFact> = {
    // 09.2 (Jakob 01.10): branchekoden står i parentes efter branchens navn.
    branche: { key: "branche", label: "Branche", value: company.industryText, code: company.industryText ? company.industryCode : undefined },
    formaal: { key: "formaal", label: "Formål", value: company.purpose },
    kommune: { key: "kommune", label: "Kommune", value: a?.municipality },
    region: { key: "region", label: "Region", value: a?.region },
    reklamebeskyttet: { key: "reklamebeskyttet", label: "Reklamebeskyttet", value: yesNo(company.advertisingProtected) },
    // 02c.12: telefon i grupper af to, e-mail i små bogstaver, web uden https:// og www.
    telefon: { key: "telefon", label: "Telefon", value: formatPhone(company.phone) },
    email: { key: "email", label: "E-mail", value: formatEmail(company.email) },
    web: { key: "web", label: "Website", value: formatWeb(company.website) },
    cvr: { key: "cvr", label: "CVR", value: company.cvr },
    binavne: { key: "binavne", label: "Binavne", value: company.secondaryNames?.length ? company.secondaryNames.join("\n") : undefined },
    status: { key: "status", label: "Status", value: company.status },
    stiftet: { key: "stiftet", label: "Stiftelsesdato", value: company.founded ? formatDate(company.founded) : undefined },
    form: { key: "form", label: "Virksomhedsform", value: company.form },
    vedtaegtsaendring: { key: "vedtaegtsaendring", label: "Seneste vedtægtsændring", value: company.statutesChanged ? formatDate(company.statutesChanged) : undefined },
    regnskabsaar: { key: "regnskabsaar", label: "Regnskabsår", value: accountingPeriod(lastYear) },
    regnskabsperiode: { key: "regnskabsperiode", label: "Regnskabsperiode", value: accountingPeriod(lastYear) },
    senesteregnskab: { key: "senesteregnskab", label: "Seneste regnskab udgivet", value: lastYear?.published ? formatDate(lastYear.published) : undefined },
    selskabskapital: { key: "selskabskapital", label: "Selskabskapital", value: cap ? [`${formatNumber(cap.amount)} ${cap.currency ?? "DKK"}`, ...(cap.classes ?? [])].join(", ") : undefined },
    boersnoteret: { key: "boersnoteret", label: "Børsnoteret", value: yesNo(company.listed) },
    // Katalog 28.7: fravalgt revision er den eneste værdi, der farves (warning-tekst, med ordet).
    revisor: auditor?.name || !company.auditExempt
      ? { key: "revisor", label: "Revisor", value: auditor?.name, lassoId: auditor?.lassoId }
      : { key: "revisor", label: "Revisor", value: "Fravalgt", tone: "warning" },
    revisorskift: { key: "revisorskift", label: "Seneste revisorskift", value: auditor?.from ? formatDate(auditor.from) : undefined },
    underskriverrevisor: { key: "underskriverrevisor", label: "Underskrivende revisor", value: company.signingAuditor },
    tegningsregel: { key: "tegningsregel", label: "Tegningsregler", value: company.signingRule },
    ansatte: { key: "ansatte", label: "Antal ansatte", value: employeesText(company, lastYear) },
    adresse: { key: "adresse", label: "Adresse", value: [a?.street, [a?.zip, a?.city].filter(Boolean).join(" ")].filter(Boolean).join(", ") || undefined },
    branchekode: { key: "branchekode", label: "Branchekode", value: company.industryCode },
    firmanavn: { key: "firmanavn", label: "Firmanavn", value: company.name },
    // Portalens liste (Jakob 30.09): alle brancher, én pr. linje.
    brancher: { key: "brancher", label: "Branche", value: industries.length ? industries.join("\n") : undefined },
    valuation: { key: "valuation", label: "Valuation", value: "Mangler" },
  };
  const hidden = new Set<CompanyFactKey>([...(options.hideIdentity ? IDENTITY : []), ...(options.hideContact ? CONTACT : []), ...(options.hideAuditor ? AUDITOR : [])]);
  let order = [...(options.rows ?? COMPANY_FACT_ORDER)];
  // Hovedet viser branchens tekst; koden er det eneste nye.
  if (options.hideIdentity) order = order.map((k) => (k === "branche" ? "branchekode" : k));
  return order
    .filter((k) => !hidden.has(k))
    .map((k) => all[k])
    .filter((r) => r.value !== undefined || (r.key === "revisor" && Boolean(lastYear)));
}

const yesNo = (v: boolean | undefined) => (v === undefined ? undefined : v ? "Ja" : "Nej");

/** Hvad der ellers står på siden for virksomheden, afledt af specen (samme regel i komponisten og i LassoView). */
export function companyFactOptions(page: readonly ViewComponent[], company: string): CompanyFactOptions {
  const has = (type: ViewComponent["type"]) => page.some((c) => c.type === type && "company" in c && c.company === company);
  // 11.3: ejerlisten viser ikke længere revisoren, så nøgle-værdi-listen beholder den.
  // G9 (Jakob 29.09): hovedet viser kun navnet, så identiteten (CVR, stiftet, form, branche, ansatte)
  // står i nøgle-værdi-listen, også når hovedet er på siden.
  return { hideIdentity: false, hideContact: has("LassoContact"), hideAuditor: false };
}

/** Samme adresse (vej og postnummer, uden forskel på store/små bogstaver og mellemrum). */
export function sameAddress(a: Address | undefined, b: Address | undefined): boolean {
  const norm = (x: Address | undefined) => [x?.street, x?.zip].map((v) => (v ?? "").toLowerCase().replace(/\s+/g, " ").trim()).join("|");
  return Boolean(a?.street || a?.zip) && norm(a) === norm(b);
}
