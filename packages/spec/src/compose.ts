import { entityRefOf } from "./models.js";
import { companyFactOptions, companyFacts, sameAddress } from "./companyFacts.js";
import type { Dataset, FinancialYear } from "./models.js";
import { hasNoStatements } from "./statements.js";
import { mainMetric } from "./series.js";
import { METRIC_FIELD, viewSpecSchema, type Metric, type ViewComponent, type ViewSpec } from "./spec.js";
import { isAnalysisSection, textSectionsFor } from "./textSections.js";

/**
 * Komponisten: skærmbilledet bygges EFTER data er hentet, ud fra datas faktiske form.
 * Modellen angiver kun hensigten (focus); formen vælges her, så samme spørgsmål giver
 * forskellige skærmbilleder for forskellige virksomheder (mange ejere -> tabel, få år ->
 * nøgle-værdi, ingen nyheder -> ingen nyhedssektion).
 *
 * Layoutet følger portalen (guide 23): hoved, risiko og nøgletal i fuld bredde øverst,
 * derunder 2-3 kolonner, der hver stabler deres sektioner uden huller.
 *
 * Ingen 1:1-gentagelser på samme side (docs/portal.md, "Fokus og elementer"): hovedet ejer
 * identiteten, nøgletalskortene står kun på overblik og oekonomi, og lister udelader det, et
 * andet element på siden allerede viser. Samme oplysning i en anden sammenhæng (ejere som liste
 * og diagram, et årsresultat i historikken og i tabellerne) er tilladt.
 *
 * Hvert modul ejer sit indhold: en elementtype står på præcis ét fokus. Kun overblikket må vise en
 * kort smagsprøve (Relationer, Nyheder 3, Historik 3) med "Se alle … i <fane>", der åbner fanen.
 * Et fokus låner aldrig et andet fokus' element som fyld; har det kun lidt data, er siden kort,
 * og et element, der står alene, får fuld bredde.
 */
export const FOCUSES = ["overblik", "oekonomi", "regnskab", "ejerskab", "ledelse", "risiko", "historik", "kontakt"] as const;
export type Focus = (typeof FOCUSES)[number];

export const FOCUS_LABELS: Record<Focus, string> = {
  overblik: "Overblik",
  oekonomi: "Økonomi",
  regnskab: "Regnskab",
  ejerskab: "Ejerskab",
  ledelse: "Ledelse",
  risiko: "Risiko",
  historik: "Historik",
  kontakt: "Kontakt",
};

export interface ComposeOptions {
  focus?: Focus;
  /** Antal år i grafer og tabeller. */
  years?: number;
  /** Nøgletal til grafen, hvis brugeren har bedt om et bestemt. */
  chartMetric?: Metric;
  name?: string;
  /** Opfølgningsknapper sender en besked til modellen; slå fra på websiden uden chat. */
  followUps?: boolean;
}

/**
 * De komponenter, der skal hentes data til, før komponisten kan vælge form.
 * Specen bruges kun til at hente data (resolveSpec) og vises ikke.
 */
export function composeProbe(lassoId: string, focus: Focus = "overblik"): ViewSpec {
  const c = lassoId;
  // Hovedet på alle fokus; ellers kun det, fokus selv viser (hvert modul ejer sit indhold).
  const components: ViewComponent[] = [{ type: "LassoCompanyHead", company: c }];
  const add = (...x: ViewComponent[]) => void components.push(...x);
  switch (focus) {
    case "overblik":
      // Kort, relationer (ledelse og ejere), oplysninger (revisoren fra ejerlisten), graf, profil,
      // kontakt og smagsprøverne på nyheder og historik.
      add(
        { type: "LassoKeyFigureCards", company: c },
        { type: "LassoPersonList", company: c, show: "all" },
        { type: "LassoOwnerList", company: c },
        { type: "LassoTimeline", company: c },
        { type: "LassoNews", company: c, limit: 5 },
        { type: "LassoTextSections", company: c, variant: "profil" },
        { type: "LassoContact", company: c },
      );
      break;
    case "oekonomi":
      // Kort, grafer, regnskabsliste og flerårstabel bygger på regnskabstallene; hele regnskabsanalysen.
      add({ type: "LassoKeyFigureCards", company: c }, { type: "LassoTextSections", company: c, variant: "analyse" });
      break;
    case "regnskab":
      add({ type: "LassoIncomeStatement", company: c, years: 3 });
      break;
    case "ejerskab":
      add(
        { type: "LassoOwnerList", company: c },
        { type: "LassoBeneficialOwners", company: c },
        { type: "LassoOwnershipDiagram", company: c, ingoingDepth: 3, outgoingDepth: 2 },
      );
      break;
    case "ledelse":
      add({ type: "LassoPersonList", company: c, show: "all" });
      break;
    case "risiko":
      // Creditsafe kun på risiko: et opslag kan koste en kredit og tage 5–45 s, så overblikket henter det aldrig.
      add({ type: "LassoCreditRating", company: c }, { type: "LassoAuditorIndependence", company: c });
      break;
    case "historik":
      add({ type: "LassoTimeline", company: c }, { type: "LassoNews", company: c, limit: 5 });
      break;
    case "kontakt":
      add({ type: "LassoContact", company: c }, { type: "LassoContactPersons", company: c });
      break;
  }
  return viewSpecSchema.parse({ kind: "company", title: lassoId, layout: "stack", components });
}

/**
 * Hvad komponisten ved om virksomheden til opfølgningerne. `undefined` = ikke hentet på dette fokus
 * (composeProbe henter kun det, fokus viser); så vises opfølgningen, og fanen, den peger på, svarer selv.
 */
interface FollowUpData {
  fin?: number;
  owners?: number;
  people?: number;
  /** Har virksomheden et offentliggjort regnskab (kun kendt på regnskab). */
  statements?: boolean;
}

interface FollowUpRule {
  label: string;
  prompt: string;
  needs?: (d: FollowUpData) => boolean;
}

/** Hentet og tom = nej; ikke hentet = ja (fanen, opfølgningen peger på, viser selv en tom tilstand). */
const some = (n: number | undefined) => n === undefined || n > 0;

/** Næste naturlige spørgsmål pr. focus: peger videre til de andre fokusvisninger. */
const FOLLOW_UPS: Record<Focus, FollowUpRule[]> = {
  overblik: [
    { label: "Økonomien", prompt: "Hvordan går det økonomisk for {navn}?", needs: (d) => some(d.fin) },
    { label: "Ejere", prompt: "Hvem ejer {navn}?", needs: (d) => some(d.owners) },
    { label: "Risiko", prompt: "Er der røde flag ved {navn}?" },
  ],
  oekonomi: [
    { label: "Fuldt regnskab", prompt: "Vis resultatopgørelse og balance for {navn}." },
    { label: "Risiko", prompt: "Er der røde flag ved {navn}?" },
    { label: "Ejere", prompt: "Hvem ejer {navn}?", needs: (d) => some(d.owners) },
  ],
  regnskab: [
    { label: "Udvikling over år", prompt: "Hvordan har økonomien i {navn} udviklet sig over årene?", needs: (d) => d.statements !== false && some(d.fin) },
    { label: "Risiko", prompt: "Er der røde flag ved {navn}?" },
    { label: "Kreditvurdering", prompt: "Hvad er kreditvurderingen for {navn}?" },
    { label: "Ledelse", prompt: "Hvem sidder i ledelsen af {navn}?", needs: (d) => some(d.people) },
  ],
  ejerskab: [
    { label: "Ledelse", prompt: "Hvem sidder i ledelsen af {navn}?", needs: (d) => some(d.people) },
    { label: "Økonomien", prompt: "Hvordan går det økonomisk for {navn}?", needs: (d) => some(d.fin) },
  ],
  ledelse: [
    { label: "Ejere", prompt: "Hvem ejer {navn}?", needs: (d) => some(d.owners) },
    { label: "Historik", prompt: "Hvad er der sket i {navn} for nylig?" },
  ],
  risiko: [
    { label: "Økonomien", prompt: "Hvordan går det økonomisk for {navn}?", needs: (d) => some(d.fin) },
    { label: "Ejere", prompt: "Hvem ejer {navn}?", needs: (d) => some(d.owners) },
  ],
  historik: [
    { label: "Overblik", prompt: "Giv mig et overblik over {navn}." },
    { label: "Ledelse", prompt: "Hvem sidder i ledelsen af {navn}?", needs: (d) => some(d.people) },
  ],
  kontakt: [
    { label: "Overblik", prompt: "Giv mig et overblik over {navn}." },
    { label: "Ledelse", prompt: "Hvem sidder i ledelsen af {navn}?", needs: (d) => some(d.people) },
  ],
};

/** År med et tal for nøgletallet, ældste først. */
function yearsWith(years: readonly FinancialYear[], m: Metric): FinancialYear[] {
  return years.filter((y) => typeof y[METRIC_FIELD[m]] === "number");
}

/** Nøgletal med et tal i seneste regnskab; tomme udelades, så "Ikke oplyst" aldrig står først. */
function presentNow(years: readonly FinancialYear[], metrics: readonly Metric[]): Metric[] {
  const last = years.at(-1);
  const unique = metrics.filter((m, i, a) => a.indexOf(m) === i);
  const present = unique.filter((m) => typeof last?.[METRIC_FIELD[m]] === "number");
  return present.length > 0 ? present : unique;
}

/** Kort virksomhedsnavn til opfølgningsknapper: "NOVO NORDISK A/S" -> "Novo Nordisk". */
export function shortCompanyName(name: string): string {
  const stripped = name.replace(/\s+(A\/S|ApS|I\/S|P\/S|K\/S|IVS|A\.M\.B\.A\.?|AMBA|F\.M\.B\.A\.?|SMBA|Aktieselskab|Anpartsselskab|Komplementaranpartsselskab)\.?$/i, "").trim() || name;
  const letters = stripped.replace(/[^\p{L}]/gu, "");
  const shouting = letters.length > 3 && letters === letters.toUpperCase();
  const pretty = shouting ? stripped.toLowerCase().replace(/(^|[\s\-/&.(])(\p{L})/gu, (_, a: string, b: string) => a + b.toUpperCase()) : stripped;
  return pretty.length > 40 ? `${pretty.slice(0, 38).trim()}…` : pretty;
}

/**
 * Anslået højde af en sektion i "linjer" (ca. 24 px i en ⅓-kolonne ved 1280 px) ud fra datas
 * form: titel og luft (3) plus rækker, afsnit, begivenheder osv. Kalibreret mod skærmbilleder
 * af demodata. Bruges kun til at vælge kolonne, så det er forholdet mellem tallene, der tæller.
 * `page` er sidens komponenter, så en liste tæller de rækker, den faktisk viser (fx uden
 * kontaktfelter, når kontaktblokken står på siden).
 */
export function componentWeight(c: ViewComponent, ds: Dataset, page: readonly ViewComponent[] = []): number {
  const TITLE = 3;
  switch (c.type) {
    case "LassoRelations": {
      const current = (ds.people[c.company] ?? []).filter((p) => !p.to);
      const direction = current.filter((p) => /direkt/i.test(p.role)).length;
      const board = current.filter((p) => /bestyrelse/i.test(p.role) && !/suppleant/i.test(p.role)).length;
      // Uden direktion og bestyrelse viser relationerne de øvrige roller (fx fuldt ansvarlig deltager).
      const others = direction + board === 0 ? current.length : 0;
      const owners = ds.ownership[c.company]?.owners.length ?? 0;
      const groups = [direction, board, others, owners].filter((n) => n > 0).length;
      return TITLE + 1.3 * groups + direction + board + others + Math.min(owners, 3) + (owners > 3 ? 1 : 0);
    }
    case "LassoNews":
      return TITLE + 4.3 * Math.min(ds.news[entityRefOf(c)]?.items.length ?? 0, c.limit);
    case "LassoTimeline": {
      const n = ds.timeline[entityRefOf(c)]?.events.length ?? 0;
      const limit = c.limit ?? 5;
      return TITLE + 4.5 * Math.min(n, limit) + (n > limit ? 1.5 : 0);
    }
    case "LassoTextSections": {
      const all = textSectionsFor(ds.textSections[c.company]?.sections ?? [], c.variant);
      // Profilen viser alle sine afsnit (hvert foldet ved 220 tegn, ca. 6 linjer); analysen kun konklusionen, til den foldes ud.
      const shown = c.variant === "analyse" ? all.slice(0, 1) : all;
      const lines = shown.reduce((sum, s) => sum + 1.5 + Math.ceil(Math.min(s.body.length, 220) / 38) + (s.body.length > 220 ? 1.3 : 0), 0);
      return TITLE + lines + (all.some(isAnalysisSection) ? 1.2 : 0) + (all.length > shown.length ? 1.3 : 0);
    }
    case "LassoContact": {
      const k = ds.contact[c.company];
      if (!k) return TITLE + 4;
      const head = page.some((x) => x.type === "LassoCompanyHead" && x.company === c.company);
      const address = head && sameAddress(k.address, ds.companies[c.company]?.address) ? 0 : (k.address?.street ? 1 : 0) + (k.address?.zip || k.address?.city ? 1 : 0);
      const rows = address + [k.phone, k.email, k.website].filter(Boolean).length;
      return TITLE + 1.4 * rows + 2 * (k.verifiedNumbers?.length ?? 0) + (k.isRobinson ? 1.5 : 0) + 1.2;
    }
    case "LassoKeyValueList": {
      // Regnskabslisten har 12 rækker (periode, udgivet, omsætning/bruttofortjeneste og 9 nøgletal).
      if (c.variant === "financials") return TITLE + 1.6 * (12 - (c.exclude?.length ?? 0));
      const co = ds.companies[c.company];
      const rows = co ? companyFacts(co, ds.ownership[c.company], ds.financials[c.company]?.years.at(-1), companyFactOptions(page, c.company)).length : 6;
      return TITLE + 1.6 * rows;
    }
    case "LassoBarChart":
    case "LassoGroupedBarChart":
    case "LassoLineChart":
    case "LassoStackedBarChart":
    case "LassoWaterfallChart":
      return 14;
    case "LassoShareBars":
      return 6;
    case "LassoPersonList": {
      const people = ds.people[c.company] ?? [];
      const n = (c.show === "all" ? people : people.filter((p) => !p.to)).length;
      // Over 10 personer foldes listen efter 8 (PersonList).
      return TITLE + 2.5 * (n > 10 ? 8 : n) + (n > 10 ? 1.5 : 0);
    }
    case "LassoOwnerList": {
      const o = ds.ownership[c.company];
      return TITLE + 2.5 * (o?.owners.length ?? 0) + (o?.auditor ? 1.5 : 0) + (o?.hasOwnersUnderFivePercent ? 1.5 : 0);
    }
    case "LassoBeneficialOwners": {
      const b = ds.beneficialOwnership[c.company];
      return TITLE + 2.5 * ((b?.owners.length ?? 0) + (b?.gaps?.length ?? 0));
    }
    case "LassoContactPersons": {
      const n = ds.contactPersons[c.company]?.people.length ?? 0;
      return TITLE + 2.5 * Math.min(n, 3) + (n > 3 ? 1.5 : 0) + 1.2;
    }
    case "LassoCreditRating":
      return 17;
    default:
      return 10;
  }
}

/**
 * Lægger de flytbare sektioner én ad gangen i den kolonne, der indtil nu vejer mindst (ved lige
 * vægt den første), så fx en lang profil ikke står over for en halvtom kolonne.
 */
export function placeByWeight(cols: ViewComponent[][], flexible: readonly ViewComponent[], weigh: (c: ViewComponent) => number): void {
  const sums = cols.map((col) => col.reduce((sum, c) => sum + weigh(c), 0));
  for (const c of flexible) {
    const i = sums.indexOf(Math.min(...sums));
    cols[i]!.push({ ...c, column: i + 1 } as ViewComponent);
    sums[i] = sums[i]! + weigh(c);
  }
}

export function composeCompany(lassoId: string, ds: Dataset, options: ComposeOptions = {}): ViewSpec {
  const focus = options.focus ?? "overblik";
  const years = options.years ?? (focus === "oekonomi" ? 10 : 5);
  const id = lassoId;
  const fin = ds.financials[id]?.years ?? [];
  const people = ds.people[id] ?? [];
  const owners = ds.ownership[id]?.owners ?? [];
  const events = ds.timeline[id]?.events ?? [];
  const news = ds.news[id]?.items ?? [];
  const texts = ds.textSections[id]?.sections ?? [];
  const beneficial = ds.beneficialOwnership[id]?.owners ?? [];
  const contact = ds.contact[id];
  const hasContact = !!(contact && (contact.phone || contact.email || contact.website));
  const contactPeople = ds.contactPersons[id]?.people ?? [];
  const statements = ds.financialStatements[id];
  const auditor = ds.auditorIndependence?.[id];
  // Creditsafe (katalog 17) står kun, hvor den er hentet (focus risiko i composeProbe), også låst eller fejlet.
  const hasCredit = Boolean(ds.creditRatings?.[id] || ds.errors?.[`creditRating:${id}`]);

  const metric = mainMetric(fin, options.chartMetric);
  const nYears = yearsWith(fin, metric).length;
  const hasProfit = yearsWith(fin, "resultat").length >= 3;
  const top: ViewComponent[] = [{ type: "LassoCompanyHead", company: id }];
  const cols: ViewComponent[][] = [[], [], []];
  const bottom: ViewComponent[] = [];
  const put = (col: 1 | 2 | 3, c: ViewComponent) => cols[col - 1]!.push({ ...c, column: col } as ViewComponent);
  // Et fokus' egne elementer: to side om side (½ + ½); står et alene, får det fuld bredde, så der
  // aldrig er en tom halvdel ved siden af (og fanen låner ikke et andet fokus' element som fyld).
  const halves = (...items: ViewComponent[]) => {
    if (items.length >= 2) items.forEach((c, i) => put((i + 1) as 1 | 2 | 3, c));
    else bottom.push(...items);
  };

  // Nøgletalskortene kun på overblik og oekonomi. På regnskab står tallene i tabellerne, og på de
  // øvrige fokus er de ikke svaret på spørgsmålet (og gentog sig på hver fane).
  const cardMetrics: Metric[] =
    fin.length > 0 && (focus === "overblik" || focus === "oekonomi")
      ? presentNow(fin, focus === "oekonomi" ? [metric, "bruttofortjeneste", "resultat", "egenkapital", "ansatte"] : [metric, "resultat", "egenkapital", "ansatte"]).slice(0, 5)
      : [];
  if (cardMetrics.length > 0) top.push({ type: "LassoKeyFigureCards", company: id, metrics: cardMetrics });

  // Regnskabslisten (årsvælger); står kortene på siden, udelader den deres nøgletal.
  const financialsList = (): ViewComponent => ({
    type: "LassoKeyValueList",
    company: id,
    variant: "financials",
    title: "Regnskab",
    ...(cardMetrics.length > 0 ? { exclude: cardMetrics } : {}),
  });

  // Regnskabet får den form, antallet af år tillader: graf ved 3+ år, ellers alle tal for året.
  const finance = (): ViewComponent | null => {
    if (nYears >= 3 && hasProfit && focus === "oekonomi") return { type: "LassoGroupedBarChart", company: id, metrics: [metric, "resultat"], years };
    if (nYears >= 3) return { type: "LassoBarChart", company: id, metric, years };
    if (fin.length > 0) return financialsList();
    return null;
  };

  // "Virksomhedsoplysninger" (kun på overblik) viser kun det, hovedet og kontaktblokken ikke viser,
  // og udelades under 2 rækker. Uden stamdata står fejlen allerede i hovedet.
  const companyList = (page: { contact: boolean }): ViewComponent | null => {
    const co = ds.companies[id];
    if (!co) return null;
    const rows = companyFacts(co, ds.ownership[id], fin.at(-1), { hideIdentity: true, hideContact: page.contact, hideAuditor: false });
    return rows.filter((r) => r.value).length >= 2 ? { type: "LassoKeyValueList", company: id, variant: "company", title: "Virksomhedsoplysninger" } : null;
  };

  let columns: 2 | 3 = 3;
  switch (focus) {
    case "oekonomi": {
      columns = 2;
      const f = finance();
      if (f) put(1, f);
      // Vandfaldet viser vejen fra top til bund for seneste år; andelsbjælkerne balancens sammensætning.
      // Kun med omsætning i seneste regnskab: ellers er der kun "bruttofortjeneste -> øvrige poster ->
      // resultat", som hverken passer til titlen "Fra omsætning til resultat" eller siger noget nyt.
      if (typeof fin.at(-1)?.revenue === "number" && typeof fin.at(-1)?.grossProfit === "number") put(1, { type: "LassoWaterfallChart", company: id });
      // Under 3 år er regnskabslisten allerede "grafen" i kolonne 1; den står ikke to gange.
      if (fin.length > 0 && f?.type !== "LassoKeyValueList") put(2, financialsList());
      // Fordelingen kræver egenkapital og enten gæld eller balancesum (gæld = balancesum − egenkapital).
      const lastYear = fin.at(-1);
      if (typeof lastYear?.equity === "number" && (typeof lastYear.liabilities === "number" || typeof lastYear.assetsTotal === "number")) put(2, { type: "LassoShareBars", company: id });
      // Hele regnskabsanalysen i fuld bredde under graferne; overblikket viser kun dens korte afsnit.
      if (textSectionsFor(texts, "analyse").length > 0) bottom.push({ type: "LassoTextSections", company: id, variant: "analyse", title: "Regnskabsanalyse" });
      if (nYears >= 4) bottom.push({ type: "LassoMultiYearTable", company: id, years: Math.min(years, 10) });
      break;
    }
    case "regnskab": {
      if (hasNoStatements(statements)) {
        // Intet offentliggjort regnskab (fx en enkeltmandsvirksomhed uden regnskabspligt): én tom
        // tilstand, der siger hvorfor, på nøgletallenes plads, ikke to tomme tabeller med samme tekst.
        // Intet andet: oplysninger, ledelse og ejere hører til andre faner og står ikke her som fyld.
        columns = 2;
        top.push({ type: "LassoIncomeStatement", company: id, years: 3, title: "Regnskab" });
        break;
      }
      // Fuldt regnskab: tabeller står altid i fuld bredde (guide 23), stablet i regnskabets rækkefølge.
      bottom.push({ type: "LassoIncomeStatement", company: id, years: 3 });
      bottom.push({ type: "LassoBalanceSheet", company: id, years: 3 });
      if (statements?.cashFlow?.length) bottom.push({ type: "LassoCashFlow", company: id, years: 3 });
      break;
    }
    case "kontakt": {
      // Kontaktblokken (også som tom tilstand: det er svaret) og kontaktpersonerne fra hjemmesiden
      // ved siden af; uden kontaktpersoner står kontakten alene i fuld bredde. Ledelsen og
      // oplysningerne hører til ledelse og overblik.
      columns = 2;
      const contactBlock: ViewComponent = { type: "LassoContact", company: id };
      halves(contactBlock, ...(contactPeople.length > 0 ? [{ type: "LassoContactPersons", company: id } as ViewComponent] : []));
      break;
    }
    case "ejerskab": {
      // Ejerlisten (med revisor) står altid, også som tom tilstand: den er svaret på "hvem ejer".
      // Reelle ejere ved siden af, når de er registreret; ellers ejerne alene i fuld bredde.
      // Ikke LassoRelations eller ledelsen her: de hører til overblik og ledelse.
      columns = 2;
      const ownerList: ViewComponent = { type: "LassoOwnerList", company: id };
      const hasBeneficial = beneficial.length > 0 || Boolean(ds.beneficialOwnership[id]?.gaps?.length);
      halves(ownerList, ...(hasBeneficial ? [{ type: "LassoBeneficialOwners", company: id } as ViewComponent] : []));
      if (owners.some((o) => o.kind === "company")) bottom.push({ type: "LassoOwnershipDiagram", company: id, ingoingDepth: 3, outgoingDepth: 2 });
      break;
    }
    case "ledelse": {
      // Hele ledelsen (også de fratrådte) i fuld bredde, også som tom tilstand. Historik og ejere
      // står på deres egne faner.
      columns = 2;
      bottom.push({ type: "LassoPersonList", company: id, show: "all" });
      break;
    }
    case "risiko": {
      // Kreditvurderingen og revisoruafhængigheden side om side; står en alene, fuld bredde. Uden
      // nogen af dem viser kreditvurderingen sin egen tilstand (låst, ikke beregnet, fejl), så siden
      // aldrig er tom. Oplysninger, ledelse, historik og ejere hører til de andre faner.
      columns = 2;
      const credit: ViewComponent = { type: "LassoCreditRating", company: id };
      const independence: ViewComponent = { type: "LassoAuditorIndependence", company: id };
      if (auditor) halves(...(hasCredit ? [credit, independence] : [independence]));
      else halves(credit);
      break;
    }
    case "historik": {
      // Hele historikken (5 + "Se alle", folder ud på stedet) | nyhederne (5); uden nyheder står
      // historikken alene i fuld bredde. Ingen graf eller regnskabsliste som fyld.
      columns = 2;
      const timeline: ViewComponent = { type: "LassoTimeline", company: id };
      const hasNews = news.length > 0 || Boolean(ds.errors[`news:${id}`]);
      halves(timeline, ...(hasNews ? [{ type: "LassoNews", company: id, limit: 5 } as ViewComponent] : []));
      break;
    }
    default: {
      // Overblik, som portalens virksomhedsside: relationer | profil | kontakt, oplysninger og regnskab.
      if (people.length > 0 || owners.length > 0) put(1, { type: "LassoRelations", company: id });
      if (textSectionsFor(texts, "profil").length > 0) put(2, { type: "LassoTextSections", company: id, variant: "profil", title: "Virksomhedsprofil" });
      if (hasContact) put(3, { type: "LassoContact", company: id });
      const list = companyList({ contact: hasContact });
      if (list) put(3, list);
      const f = finance();
      if (f) put(3, f);
      // Nyheder og historik har ingen fast plads: hver lægges i den kolonne, der vejer mindst indtil nu.
      // Begge er smagsprøver på fanen Historik: "Se alle … i Historik" åbner den (more).
      const flexible: ViewComponent[] = [];
      if (news.length > 0) flexible.push({ type: "LassoNews", company: id, limit: 3, more: "historik" });
      // Historikken viser 3 begivenheder + "Se alle N" (regel 9); hele forløbet står på historik.
      if (events.length >= 3) flexible.push({ type: "LassoTimeline", company: id, limit: 3, more: "historik" });
      const page = [...top, ...cols.flat(), ...flexible];
      placeByWeight(cols, flexible, (c) => componentWeight(c, ds, page));
      // En tom kolonne må ikke efterlade et hul: gå ned på 2 kolonner.
      if (cols.filter((c) => c.length > 0).length < 3) columns = 2;
    }
  }

  const known: FollowUpData = {
    fin: ds.financials[id] ? fin.length : undefined,
    owners: ds.ownership[id] ? owners.length : undefined,
    people: ds.people[id] ? people.length : undefined,
    statements: statements ? !hasNoStatements(statements) : undefined,
  };
  const followUps = FOLLOW_UPS[focus]
    .filter((f) => f.needs === undefined || f.needs(known))
    .slice(0, 3)
    .map((f) => ({ label: f.label, prompt: f.prompt.replace("{navn}", shortCompanyName(options.name ?? ds.companies[id]?.name ?? lassoId)) }));
  if (options.followUps !== false && followUps.length > 0) bottom.push({ type: "LassoFollowUps", prompts: followUps });

  // Tomme kolonner rykkes sammen, så kolonne 1..n altid er fyldt.
  const filled = cols.filter((c) => c.length > 0);
  const colComponents = filled.flatMap((c, i) => c.map((x) => ({ ...x, column: i + 1 }) as ViewComponent));
  if (filled.length === 1) columns = 2;

  return viewSpecSchema.parse({
    kind: "company",
    title: options.name ?? lassoId,
    subtitle: focus === "overblik" ? undefined : FOCUS_LABELS[focus],
    layout: "columns",
    columns: Math.max(2, Math.min(columns, Math.max(filled.length, 2))),
    components: [...top, ...colComponents, ...bottom],
  });
}
