import { useState, type ReactNode } from "react";
import { ExpandLink } from "./ExpandLink.js";
import {
  companyFacts,
  currencyUnit,
  formatAmount,
  formatDate,
  formatMetricValue,
  isPersonId,
  METRIC_FIELD,
  METRIC_LABELS,
  formatEmail,
  formatNumber,
  formatPhone,
  formatWeb,
  type CompanyFactKey,
  type CompanyVM,
  type ContactVM,
  type FinancialFieldKey,
  type FinancialStatementsVM,
  type FinancialsVM,
  type Metric,
  type OwnershipVM,
} from "@lasso/spec";
import type { ViewAction } from "../types.js";
import { DataState, Section, stateForError } from "../primitives.js";
import { FoldText, IndustryValue, NotReported } from "./Values.js";
import { Tabs } from "./Tabs.js";
import { InfoHint, QualityFlag } from "./QualityFlag.js";
import { ShellIcon, type ShellIconName } from "./ShellIcons.js";

/**
 * Katalog 09.2: info-ikon ved nøglen forklarer begrebet. Kun begreber, der kræver forklaring;
 * almindelige felter (adresse, telefon) får intet ikon.
 */
export const KV_CONCEPTS: Record<string, string> = {
  Regnskabsperiode: "Det tidsrum, regnskabet dækker. Oftest kalenderåret, men selskabet kan vælge et andet regnskabsår.",
  Regnskabsklasse: "Årsregnskabslovens klasser A–D afgør, hvor meget regnskabet skal indeholde. Klasse B skal ikke oplyse omsætning.",
  Branchekode: "Danmarks Statistiks branchekode (DB07), som virksomheden selv har valgt i CVR.",
  Bruttofortjeneste: "Omsætning minus vareforbrug og andre eksterne omkostninger.",
  EBITDA: "Resultat før renter, skat, af- og nedskrivninger.",
  Soliditetsgrad: "Egenkapitalen i procent af balancesummen. Viser, hvor stor en del af aktiverne der er finansieret af ejerne.",
  Overskudsgrad: "Resultat af primær drift i procent af omsætningen (eller bruttofortjenesten).",
  Likviditetsgrad: "Omsætningsaktiver i procent af den kortfristede gæld. Over 100 % kan de kortfristede forpligtelser dækkes.",
  Balancesum: "Summen af aktiverne, som er lig summen af egenkapital og gæld.",
  "Gæld i alt": "Kortfristet og langfristet gæld. Beregnes som balancesum minus egenkapital, når den ikke er oplyst.",
  Reklamebeskyttet: "Virksomheden har frabedt sig henvendelser med reklame, jf. CVR-loven.",
  "Seneste revisorskift": "Dato for seneste skift af revisor i CVR. Hyppige skift kan være et opmærksomhedspunkt.",
};

/** Katalog 09.2: handlinger under listen som link med ikon, fx "Se alle". */
export interface KeyValueLink {
  label: string;
  icon?: ShellIconName;
  onClick: () => void;
}

function Label({ text, info }: { text: string; info: boolean }) {
  const concept = info ? KV_CONCEPTS[text] : undefined;
  return (
    <div className="lasso-kv-row__label">
      <span className="lasso-kv-row__labeltext">{text}</span>
      {concept ? <InfoHint text={concept} label={text} /> : null}
    </div>
  );
}

function Links({ links }: { links?: readonly KeyValueLink[] }) {
  if (!links?.length) return null;
  return (
    <div className="lasso-kv-links">
      {links.map((l) => (
        <button key={l.label} type="button" className="lasso-kv-link" onClick={l.onClick}>
          {l.icon ? <ShellIcon name={l.icon} size={15} /> : null}
          <span>{l.label}</span>
        </button>
      ))}
    </div>
  );
}

/** "2025-01-01" -> "01.01" (dag.måned, uden år, katalog 09: "01.01 – 31.12"). */
function dayMonth(value: string | undefined): string | undefined {
  const m = value ? /^\d{4}-(\d{2})-(\d{2})/.exec(value) : null;
  return m ? `${m[2]}.${m[1]}` : undefined;
}

/** Kort visning (09.2/09.5): så mange rækker står fremme, resten bag "Se alle N oplysninger". */
const SHORT_ROWS = 8;

interface Row {
  key?: string;
  label: string;
  value?: string;
  danger?: boolean;
  /** Kvalitetsflag (09.1/09.2): forklaring i tooltip ved det gule udråbstegn. */
  flag?: string;
  /** Entitetens Lasso-ID (revisoren), så navnet kan åbnes i værter med drill-down. */
  lassoId?: string;
  /** 02c.10: branchekoden, vist i muted før teksten. */
  code?: string;
  /** Katalog 28.7: warning-tekst (kun "Fravalgt" revision). */
  tone?: "warning";
}

/**
 * Rækkerne for variant "company" kommer fra companyFacts (@lasso/spec), så komponisten tæller
 * det samme, når den udelader en liste under 2 rækker. Står hovedet, kontaktblokken eller
 * ejerlisten på siden, gentages deres oplysninger ikke her.
 */
function companyRows(
  company: CompanyVM,
  ownership: OwnershipVM | undefined,
  lastYear: FinancialsVM["years"][number] | undefined,
  hide: { identity: boolean; contact: boolean; auditor: boolean },
  rows?: readonly CompanyFactKey[],
): Row[] {
  return companyFacts(company, ownership, lastYear, { hideIdentity: hide.identity, hideContact: hide.contact, hideAuditor: hide.auditor, rows });
}

const FINANCIALS_ROW_METRICS: Metric[] = ["resultat", "egenkapital", "ansatte", "ebitda", "soliditetsgrad", "overskudsgrad", "likviditetsgrad", "balancesum", "gaeld"];

function metricRow(year: FinancialsVM["years"][number], m: Metric, cur: string | undefined, quality?: FinancialsVM["quality"]): Row {
  let v = year[METRIC_FIELD[m]] as number | null | undefined;
  // Gæld i alt = balancesum − egenkapital, når den ikke er oplyst direkte.
  if (m === "gaeld" && v == null && typeof year.assetsTotal === "number" && typeof year.equity === "number") v = year.assetsTotal - year.equity;
  if (m === "omsaetning" || m === "bruttofortjeneste") return { label: METRIC_LABELS[m], value: v != null ? formatAmount(v, currencyUnit(cur)) : undefined, flag: quality?.[m] };
  return { label: METRIC_LABELS[m], value: v != null ? formatMetricValue(m, v, cur) : undefined, danger: typeof v === "number" && v < 0, flag: quality?.[m] };
}

function financialsRows(year: FinancialsVM["years"][number], currency?: string, exclude: readonly Metric[] = [], only?: readonly Metric[], quality?: FinancialsVM["quality"]): Row[] {
  const cur = year.currency ?? currency;
  const period = dayMonth(year.periodStart) && dayMonth(year.periodEnd) ? `${dayMonth(year.periodStart)} – ${dayMonth(year.periodEnd)}` : undefined;
  const rows: Row[] = [
    { label: "Regnskabsperiode", value: period },
    { label: "Regnskab udgivet", value: year.published ? formatDate(year.published) : undefined },
  ];
  // Kun de nøgletal, spørgsmålet gælder, i den rækkefølge de er bedt om.
  if (only) return [...rows, ...only.filter((m) => !exclude.includes(m)).map((m) => metricRow(year, m, cur, quality))];
  // Omsætning, ellers bruttofortjeneste; udeladt, når nøgletalskortene på siden allerede viser den.
  const main: Metric = year.revenue != null ? "omsaetning" : "bruttofortjeneste";
  if (!exclude.includes(main)) {
    const v = year.revenue != null ? year.revenue : year.grossProfit;
    rows.push({ label: METRIC_LABELS[main], value: v != null ? formatAmount(v, currencyUnit(cur)) : undefined, flag: quality?.[main] });
  }
  for (const m of FINANCIALS_ROW_METRICS) {
    if (exclude.includes(m)) continue;
    rows.push(metricRow(year, m, cur, quality));
  }
  return rows;
}

const yesNo = (v: boolean | undefined) => (v === undefined ? undefined : v ? "Ja" : "Nej");

/**
 * Regnskabsoplysninger med valgte felter (`fields`, portalens liste, Jakob 30.09). Resultat før skat og
 * afkastningsgrad kommer fra det fulde regnskab; erklæring, fremhævelser, going concern og PDF fra
 * revisionsoplysningerne for året.
 */
function fieldRows(year: FinancialsVM["years"][number], currency: string | undefined, fields: readonly FinancialFieldKey[], statements?: FinancialStatementsVM, quality?: FinancialsVM["quality"]): (Row & { pdf?: string })[] {
  const cur = year.currency ?? currency;
  const inc = statements?.incomeStatement.find((y) => y.year === year.year);
  const bal = statements?.balanceSheet.find((y) => y.year === year.year);
  const audit = statements?.audits?.find((a) => a.year === year.year);
  const period = dayMonth(year.periodStart) && dayMonth(year.periodEnd) ? `${dayMonth(year.periodStart)} – ${dayMonth(year.periodEnd)}` : undefined;
  const roa = typeof inc?.ebit === "number" && typeof bal?.assetsTotal === "number" && bal.assetsTotal !== 0 ? (inc.ebit / bal.assetsTotal) * 100 : undefined;
  return fields.map((f): Row & { pdf?: string } => {
    switch (f) {
      case "udgivet":
        return { label: "Regnskab udgivet", value: year.published ? formatDate(year.published) : undefined };
      case "periode":
        return { label: "Regnskabsperiode", value: period };
      case "erklaering":
        return { label: "Erklæring fra revisor", value: audit?.type };
      case "fremhaevelser":
        return { label: "Fremhævelser", value: yesNo(audit?.emphasis) };
      case "goingconcern":
        return { label: "Usikkerhed om going concern", value: yesNo(audit?.goingConcern), danger: audit?.goingConcern === true };
      case "resultatfoerskat":
        return { label: "Resultat før skat", value: typeof inc?.profitBeforeTax === "number" ? formatAmount(inc.profitBeforeTax, currencyUnit(cur)) : undefined, danger: typeof inc?.profitBeforeTax === "number" && inc.profitBeforeTax < 0 };
      case "afkastningsgrad":
        return { label: "Afkastningsgrad", value: roa !== undefined ? `${roa.toLocaleString("da-DK", { maximumFractionDigits: 2 })} %` : undefined, danger: roa !== undefined && roa < 0 };
      case "pdf":
        // Ingen række: URL'en bliver til "Hent regnskabet ÅÅÅÅ" øverst i elementet (09.5).
        return { label: "PDF", pdf: audit?.pdfUrl ?? statements?.pdfUrl };
      case "resultat":
        return { ...metricRow(year, f, cur, quality), label: "Resultat efter skat" };
      default:
        return metricRow(year, f, cur, quality);
    }
  });
}

/** Værdien som link (lasso-link), når den har et Lasso-ID og værten kan åbne det; ellers ren tekst. */
function Value({ value, lassoId, onOpen }: { value: string; lassoId?: string; onOpen?: (a: ViewAction) => void }) {
  if (onOpen && lassoId?.startsWith("CVR-1-")) {
    return (
      <button type="button" className="lasso-link" onClick={(e) => { e.stopPropagation(); onOpen({ kind: "open-company", lassoId, name: value }); }}>
        {value}
      </button>
    );
  }
  if (onOpen && isPersonId(lassoId)) {
    return (
      <button type="button" className="lasso-link" onClick={(e) => { e.stopPropagation(); onOpen({ kind: "open-person", lassoId, name: value }); }}>
        {value}
      </button>
    );
  }
  return <>{value}</>;
}

/** Handling for en klikbar række (02c.13): åbner virksomheden eller personen, når værten kan. */
function rowOpener(r: Row, onOpen?: (a: ViewAction) => void): (() => void) | undefined {
  if (!onOpen || !r.value || !r.lassoId) return undefined;
  if (r.lassoId.startsWith("CVR-1-")) return () => onOpen({ kind: "open-company", lassoId: r.lassoId!, name: r.value });
  if (isPersonId(r.lassoId)) return () => onOpen({ kind: "open-person", lassoId: r.lassoId!, name: r.value });
  return undefined;
}

/** Standardlinjerne i virksomhedskortet (portalens venstre kolonne). */
const CARD_ROWS: readonly CompanyFactKey[] = ["adresse", "cvr", "stiftet", "ansatte", "web", "telefon", "email"];

/**
 * Virksomhedskortet (look "card", Lassos portal): navnet som overskrift, adresse, CVR og stiftet,
 * ansatte og web som linjer uden nøgle; telefon og e-mail med overskrift, én pr. linje. Rækkerne
 * vælges og ordnes med `rows` som i listen.
 */
/**
 * Virksomhedskortet (look 'card'): samme opbygning og typografi som virksomhedskortet i "Se alle"-panelet
 * (08.7, `lasso-cpcompany`): adresse, CVR og stiftet, ansatte i tekst-2, web som koralt link, telefonnumre
 * (verificerede med skjold) og e-mailadresser under et gruppenavn i 600.
 */
function CompanyCard({ company, contact, rows = CARD_ROWS, title, onLink }: { company: CompanyVM; contact?: ContactVM; rows?: readonly CompanyFactKey[]; title?: string; onLink?: (url: string) => void }) {
  const a = company.address;
  const digits = (v: string) => v.replace(/\D/g, "").replace(/^45(?=\d{8}$)/, "");
  const verified = new Set((contact?.verifiedNumbers ?? []).filter((n) => !n.expired).map((n) => digits(n.phoneNumber)));
  const rawPhones = [company.phone, contact?.phone, ...(contact?.verifiedNumbers ?? []).map((n) => n.phoneNumber)].filter((x): x is string => Boolean(x));
  const phones = [...new Map(rawPhones.map((x) => [digits(x), formatPhone(x) ?? x])).entries()];
  const emails = [...new Set([company.email, contact?.email, ...(contact?.emails ?? [])].filter((x): x is string => Boolean(x)).map((x) => formatEmail(x) ?? x))];
  const site = company.website ?? contact?.website;
  const web = formatWeb(site);
  const href = site ? (/^https?:\/\//i.test(site) ? site : `https://${site}`) : undefined;
  const blocks: ReactNode[] = [];
  const lines = (k: string, ...xs: (string | undefined)[]) => {
    const v = xs.filter(Boolean);
    if (v.length) blocks.push(<div key={k} className="lasso-cpcompany__lines">{v.map((x, i) => <span key={i}>{x}</span>)}</div>);
  };
  // CVR og stiftet står i samme afsnit (08.7).
  const idLines: (string | undefined)[] = [];
  const flushId = () => {
    if (idLines.length) lines(`id${blocks.length}`, ...idLines.splice(0));
  };
  for (const k of rows) {
    if (k === "cvr") idLines.push(company.cvr ? `CVR ${company.cvr}` : undefined);
    else if (k === "stiftet") idLines.push(company.founded ? `Stiftet ${company.founded.slice(0, 4)}` : undefined);
    else {
      flushId();
      if (k === "adresse") lines(k, a?.street, [a?.zip, a?.city].filter(Boolean).join(" ") || undefined);
      else if (k === "ansatte") lines(k, company.employees != null ? `${formatNumber(company.employees)} ansatte` : undefined);
      else if (k === "web" && web && href)
        blocks.push(
          onLink ? (
            <button key={k} type="button" className="lasso-cpcompany__web" onClick={() => onLink(href)}>
              {web}
            </button>
          ) : (
            <a key={k} className="lasso-cpcompany__web" href={href} target="_blank" rel="noreferrer">
              {web}
            </a>
          ),
        );
      else if (k === "telefon" && phones.length)
        blocks.push(
          <div key={k} className="lasso-cpcompany__group">
            <div className="lasso-cpcompany__label">Telefonnumre</div>
            {phones.map(([d, p]) => (
              <div key={d} className="lasso-cpcompany__value">
                <span>{p}</span>
                {verified.has(d) ? <ShellIcon name="shield-check" size={14} className="lasso-cpcompany__shield" /> : null}
              </div>
            ))}
          </div>,
        );
      else if (k === "email" && emails.length)
        blocks.push(
          <div key={k} className="lasso-cpcompany__group">
            <div className="lasso-cpcompany__label">Emailadresser</div>
            {emails.map((e) => (
              <div key={e} className="lasso-cpcompany__value">
                {e}
              </div>
            ))}
          </div>,
        );
      else if (k === "firmanavn") lines(k, company.name);
      else if (k === "kommune") lines(k, a?.municipality);
      else if (k === "form") lines(k, company.form);
      else if (k === "branche" || k === "brancher") lines(k, company.industryText);
    }
  }
  flushId();
  return (
    <Section title={title ?? company.name} span="half">
      <div className="lasso-cpcompany__facts">{blocks}</div>
    </Section>
  );
}

/**
 * Nøgle-værdi-liste (katalog 09). To varianter: "company" (stamdata, venstrestillet
 * værdi) og "financials" (regnskabstal med årsvælger, seneste regnskab valgt som
 * standard). Nøgle 13/400 grå i fast kolonne, værdi 14/400 (14/500 i financials-varianten), tal
 * venstrestillet i nøgle-værdi (02c.2). Manglende værdi: "Ikke oplyst"/"Ikke registreret" (02c.17).
 * Lange tekster foldes efter 3 linjer med "Vis mere" (02c.1).
 */
export function KeyValueList({
  company,
  ownership,
  financials,
  variant,
  title,
  error,
  hideContact = false,
  onOpen,
  hideIdentity = false,
  hideAuditor = false,
  exclude,
  only,
  year: startYear,
  rows: rowKeys,
  info = true,
  links,
  onPdf,
  years: yearCount = 5,
  maxRows: maxRowsProp,
  view = "full",
  look = "list",
  contact,
  fields,
  statements,
  onLink,
}: {
  company?: CompanyVM;
  ownership?: OwnershipVM;
  financials?: FinancialsVM;
  variant: "company" | "financials";
  title?: string;
  error?: string;
  /** Skjul adresse/telefon/e-mail/web, når LassoContact står på samme side. */
  hideContact?: boolean;
  /** Værten kan åbne virksomheder og personer (drill-down): revisoren bliver et link. */
  onOpen?: (a: ViewAction) => void;
  /** Skjul stiftet, form, branche, ansatte og adresse, når LassoCompanyHead står på samme side. */
  hideIdentity?: boolean;
  /** Skjul revisor og revisorskift, når LassoOwnerList (med revisor) står på samme side. */
  hideAuditor?: boolean;
  /** Variant "financials": nøgletal, der allerede står på siden (nøgletalskortene). */
  exclude?: readonly Metric[];
  /** Variant "financials": kun disse nøgletal (plus periode og udgivet). */
  only?: readonly Metric[];
  /** Variant "financials": regnskabsåret, årsvælgeren starter på; findes det ikke, seneste år med en note. */
  year?: number;
  /** Variant "company": kun disse rækker. */
  rows?: readonly CompanyFactKey[];
  /** Info-ikon med begrebsforklaring ved nøglen (KV_CONCEPTS). Standard til. */
  info?: boolean;
  /** Handlinger under listen som link med ikon (09.2), fx "Se alle". */
  links?: readonly KeyValueLink[];
  /** Variant "financials" (09.5): "⤓ Hent regnskabet ÅÅÅÅ" som link øverst i elementet (Jakob 29.09). */
  onPdf?: (year: number) => void;
  /** Variant "financials": antal år i årsvælgeren (30.13: 2 → "2025 | 2024"). */
  years?: number;
  /** Kun de første N rækker; resten bag "Se N oplysninger" (30.13). */
  maxRows?: number;
  /** Jakob 01.10 (09.2/09.5): 'short' = de første 8 rækker (eller maxRows), resten foldes ud på stedet; 'full' = alle. */
  view?: "short" | "full";
  /** Variant "company": 'card' = portalens virksomhedskort (CompanyCard). */
  look?: "list" | "card";
  /** Kontaktdata (flere telefonnumre og e-mails) til virksomhedskortet. */
  contact?: ContactVM;
  /** Variant "financials": rækkerne i denne rækkefølge (fieldRows). */
  fields?: readonly FinancialFieldKey[];
  /** Det fulde regnskab (resultat før skat, afkastningsgrad, revisionsoplysninger), når `fields` beder om dem. */
  statements?: FinancialStatementsVM;
  /** Åbner et link (regnskabets PDF, når `fields` beder om "pdf"). */
  onLink?: (url: string) => void;
}) {
  const heading = title ?? (variant === "financials" ? "Regnskab" : "Virksomhedsoplysninger");
  const maxRows = maxRowsProp ?? (view === "short" ? SHORT_ROWS : undefined);
  const ready = variant === "financials" ? Boolean(financials) : Boolean(company);
  const [year, setYear] = useState<number | null>(null);
  const [allRows, setAllRows] = useState(false);
  /** 30.13: de første maxRows rækker og "Se N oplysninger" under listen. */
  const cut = <T,>(rows: readonly T[]): readonly T[] => (maxRows && !allRows ? rows.slice(0, maxRows) : rows);
  const moreRows = (n: number) =>
    maxRows && n > maxRows ? (
      <ExpandLink expanded={allRows} total={n} onToggle={() => setAllRows(!allRows)} />
    ) : null;

  if (!ready) {
    return (
      <Section title={heading} span="half">
        {error ? <DataState state={stateForError(error) === "noaccess" ? "empty" : "error"} reason={error} /> : <DataState state="loading" lines={6} height={320} />}
      </Section>
    );
  }

  if (variant === "financials") {
    const years = financials!.years;
    const last = years.at(-1);
    if (!last) {
      return (
        <Section title={heading} span="half">
          <DataState state="empty" reason="Virksomheden har ikke offentliggjort et regnskab endnu." />
        </Section>
      );
    }
    // Det bedte år står i årsvælgeren, også når det er ældre end de seneste år.
    const asked = startYear !== undefined ? years.find((y) => y.year === startYear) : undefined;
    const recent = years.slice(-yearCount);
    const options = (asked && !recent.includes(asked) ? [asked, ...recent] : recent).reverse();
    const selected = years.find((y) => y.year === year) ?? asked ?? last;
    // Kvalitetsflaggene gælder seneste regnskab.
    const all: (Row & { pdf?: string })[] = fields
      ? fieldRows(selected, financials!.currency, fields, statements, selected === last ? financials!.quality : undefined)
      : financialsRows(selected, financials!.currency, exclude, only, selected === last ? financials!.quality : undefined);
    // 09.5: regnskabets PDF er handlingen "Hent regnskabet ÅÅÅÅ" øverst i elementet, aldrig en række i listen.
    const pdfUrl = all.find((r) => r.pdf)?.pdf;
    const rows = all.filter((r) => !("pdf" in r));
    const pdf = onPdf ? () => onPdf(selected.year) : pdfUrl && onLink ? () => onLink(pdfUrl) : undefined;
    const missingYear = startYear !== undefined && !asked;
    return (
      <Section
        title={heading}
        action={
          options.length > 1 ? (
            // Årsvælger = niveau 3-faner (29). Over 3 år på mobil bliver den en dropdown (29, mobil).
            <div className="lasso-kv-years">
              <Tabs level={3} className="lasso-seg-accent" ariaLabel="Vælg regnskabsår" items={options.map((y) => ({ id: String(y.year), label: String(y.year) }))} value={String(selected.year)} onChange={(id) => setYear(Number(id))} />
            </div>
          ) : undefined
        }
        span="half"
      >
        {/* 09.5 (Jakob 29.09): handlingen "Hent regnskabet" står øverst i elementet, ikke som række nederst. */}
        {pdf ? (
          <div className="lasso-kv-top">
            <button type="button" className="lasso-kv-link" onClick={pdf}>
              <ShellIcon name="download" size={15} />
              <span>Hent regnskabet {selected.year}</span>
            </button>
          </div>
        ) : null}
        <div className="lasso-kv-list lasso-kv-list--financials">
          {cut(rows).map((r) => (
            <div className="lasso-kv-row" key={r.label}>
              <Label text={r.label} info={info} />
              <div className={`lasso-kv-row__value ${r.danger ? "lasso-down" : ""}`}>
                {/* 19.1 (Jakob): kvalitetsflaget står FORAN tallet */}
                {r.flag && r.value ? <QualityFlag text={r.flag} /> : null}
                {r.value ?? <NotReported />}
              </div>
            </div>
          ))}
        </div>
        {missingYear ? <div className="lasso-kv-note lasso-small lasso-muted">Kilde: regnskabet for {last.year}; der er intet offentliggjort regnskab for {startYear}</div> : null}
        {moreRows(rows.length)}
        <Links links={links} />
      </Section>
    );
  }

  if (look === "card") return <CompanyCard company={company!} contact={contact} rows={rowKeys} title={title} onLink={onLink} />;
  const ansatteFlag = financials?.quality?.ansatte;
  const rows = companyRows(company!, ownership, financials?.years.at(-1), { identity: hideIdentity, contact: hideContact, auditor: hideAuditor }, rowKeys).map((r): Row =>
    r.label === "Ansatte" && ansatteFlag ? { ...r, flag: ansatteFlag } : r,
  );
  if (rows.length === 0) {
    return (
      <Section title={heading} span="half">
        <DataState
          state="empty"
          reason={rowKeys?.includes("revisor") && !hideAuditor ? "Der er ikke registreret en revisor for virksomheden i CVR." : "CVR har ikke oplyst flere oplysninger om virksomheden end dem øverst på siden."}
        />
      </Section>
    );
  }
  return (
    <Section title={heading} span="half">
      <div className="lasso-kv-list">
        {cut(rows).map((r) => {
          const open = rowOpener(r, onOpen);
          return (
            // 02c.13: har værdien et Lasso-ID, er hele rækken klikbar (navnet er stadig knappen for tastatur).
            <div className={`lasso-kv-row ${open ? "lasso-kv-row--link" : ""}`} key={r.key ?? r.label} onClick={open}>
              <Label text={r.label} info={info} />
              <div className={`lasso-kv-row__value lasso-kv-row__value--wrap${r.tone === "warning" ? " lasso-kv-row__value--warning" : ""}`}>
                {r.code ? (
                  <IndustryValue code={r.code} text={r.value} />
                ) : r.value ? (
                  <>
                  {r.flag ? <QualityFlag text={r.flag} /> : null}
                  {r.lassoId && onOpen ? <Value value={r.value} lassoId={r.lassoId} onOpen={onOpen} /> : <FoldText text={r.value} />}
                  </>
                ) : (
                  // 02c.17: felter siger "Ikke registreret", når kilden er tom; tabeller beholder "-".
                  <NotReported kind="registered" />
                )}
              </div>
            </div>
          );
        })}
      </div>
      {moreRows(rows.length)}
      <Links links={links} />
    </Section>
  );
}
