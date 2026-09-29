import { entityRefOf } from "./models.js";
import { askFocus, askLabel, askPlan, withRelated, type Ask, type AskItem } from "./ask.js";
import { companyFactOptions, companyFacts, sameAddress } from "./companyFacts.js";
import type { Dataset, FinancialYear } from "./models.js";
import { hasNoStatements } from "./statements.js";
import { effectiveMetric, mainMetric } from "./series.js";
import { bandsToComponents, measuredHeight, packWithinBudget, PAGE_HEIGHT_BUDGET, type PackedBand } from "./grid.js";
import { componentSchema, METRIC_FIELD, peopleWithRole, timelineOfKinds, viewSpecSchema, type ComponentType, type Metric, type ViewComponent, type ViewSpec, type Width } from "./spec.js";
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
  /**
   * Spørgsmålsprofilen (parseAsk). Ikke generisk: en hel side i spørgsmålets kontekst (askPlan), hvor
   * svar-elementet står først; generisk: fokus-siden (focus, ellers askFocus, ellers overblik).
   */
  ask?: Ask;
  /**
   * "Vis alt om X": alle elementer i fuld form, også når siden bliver længere end højdebudgettet
   * (23.3). Standard: siden holdes inden for PAGE_HEIGHT_BUDGET, og de mindst relevante elementer
   * udelades eller vises kompakt.
   */
  showAll?: boolean;
  /** Højdebudget i px ved 1200 (standard PAGE_HEIGHT_BUDGET = 1300, ca. 1½ skærm). Ignoreres med showAll. */
  heightBudget?: number;
}

/**
 * De komponenter, der skal hentes data til, før komponisten kan vælge form.
 * Specen bruges kun til at hente data (resolveSpec) og vises ikke. Med et (ikke-generisk) spørgsmål
 * hentes alt i planen for spørgsmålet; ellers det, fokus viser.
 */
export function composeProbe(lassoId: string, focus?: Focus, ask?: Ask): ViewSpec {
  const plan = ask && !ask.generic ? askPlan(ask, "company") : undefined;
  if (plan?.lead.length) return askProbe(lassoId, "company", [...plan.top, ...plan.lead, ...plan.context]);
  focus = focus ?? (ask ? askFocus(ask) : undefined) ?? "overblik";
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
      const t = ds.timeline[entityRefOf(c)];
      const n = t ? timelineOfKinds(t, c.kinds).events.length : 0;
      const limit = c.limit ?? 5;
      return TITLE + 4.5 * Math.min(n, limit) + (n > limit ? 1.5 : 0);
    }
    case "LassoTextSections": {
      const all = textSectionsFor(ds.textSections[c.company]?.sections ?? [], c.variant);
      // Profilen viser alle sine afsnit (hvert foldet ved 220 tegn, ca. 6 linjer); analysen kun konklusionen, til den foldes ud.
      const shown = c.variant === "analyse" ? all.slice(0, 1) : c.limit ? all.slice(0, c.limit) : all;
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
      // Regnskabslisten har 12 rækker (periode, udgivet, omsætning/bruttofortjeneste og 9 nøgletal);
      // only viser kun de valgte; maxRows viser kun de første N rækker og "Se N oplysninger" under (flex rækker, 23.1).
      const shown = (n: number) => (c.maxRows && c.maxRows < n ? 1.6 * c.maxRows + 1.5 : 1.6 * n);
      if (c.variant === "financials") {
        const base = c.only ? 2 + c.only.filter((m) => !c.exclude?.includes(m)).length : 12 - (c.exclude?.length ?? 0);
        return TITLE + shown(base);
      }
      const co = ds.companies[c.company];
      const rows = co ? companyFacts(co, ds.ownership[c.company], ds.financials[c.company]?.years.at(-1), { ...companyFactOptions(page, c.company), rows: c.rows }).length : 6;
      return TITLE + shown(rows);
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
      const people = peopleWithRole(ds.people[c.company] ?? [], c.roles);
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
    case "LassoAuditorIndependence": {
      const n = ds.auditorIndependence?.[c.company]?.relations.length ?? 0;
      return TITLE + 2 + 2.5 * Math.min(n, 5) + 1.2;
    }
    case "LassoScoreGauge":
      return 12;
    default:
      return 10;
  }
}

/**
 * componentWeight for målesættets komponenter med demodata (tools/gallery/measure/entries.ts), så en
 * målt højde kan rettes efter komponentens egne data. Mangler typen her, bruges den målte højde.
 */
const MEASURED_WEIGHT: Partial<Record<string, number>> = {
  LassoKeyValueList: 27,
  "LassoKeyValueList (financials)": 22.2,
  LassoContact: 18.7,
  LassoContactPersons: 13.2,
  LassoTextSections: 39.3,
  LassoTimeline: 27,
  LassoNews: 15.9,
  LassoPersonList: 10.5,
  LassoOwnerList: 9.5,
  LassoBeneficialOwners: 8,
  LassoRelations: 11.9,
};
/** Titel og luft i componentWeight (3 linjer) svarer til ca. 60 px, som ikke skaleres med data. */
const TITLE_WEIGHT = 3;
const TITLE_PX = 60;

/**
 * h(type, bredde, rækker) i gridmodellen (23.1): den målte højde i bredden, rettet efter datas omfang.
 * Rettelsen er lineær i componentWeight ud over titlen, så fx en tidslinje med 3 begivenheder er ca.
 * 176 px lavere end målingen med 5. Højden er et skøn til pakningen; siden tegnes altid uden huller,
 * fordi den korteste stak strækkes.
 */
export function gridHeight(c: ViewComponent, width: Width, ds: Dataset, page: readonly ViewComponent[] = []): number {
  const base = measuredHeight(c, width);
  const key = c.type === "LassoKeyValueList" && c.variant === "financials" ? "LassoKeyValueList (financials)" : c.type;
  const std = MEASURED_WEIGHT[key];
  if (!std) return base;
  const w = componentWeight(c, ds, page);
  const perUnit = (base - TITLE_PX) / (std - TITLE_WEIGHT);
  return Math.max(TITLE_PX, Math.round(base + (w - std) * perUnit));
}

/**
 * I layout 'columns' har hvert element 24 px luft over og under (.lasso-column__item) i stedet for et
 * gap på 24 mellem kort; en stak med n elementer er derfor Σh + 48·n høj. Pakningen regner med gap 0
 * og 48 px pr. element, så afvigelsen regnes på det, der faktisk tegnes.
 */
const ITEM_PADDING = 48;

/**
 * Pakker sidens komponenter i bånd (gridmodellen) og returnerer dem i layout 'columns'-form.
 * `page` er alle sidens komponenter, så højderne tager hensyn til, hvad andre elementer allerede viser.
 */
export interface PackPageOptions {
  /** Højdebudget i px (standard: intet budget). Se packWithinBudget. */
  budget?: number;
  /** Elementer, der altid er med i fuld form (hoved, nøgletalskort, svar-elementet, opfølgning). */
  keep?: ReadonlySet<ViewComponent>;
}

export function packPage(
  items: readonly ViewComponent[],
  ds: Dataset,
  options: PackPageOptions = {},
): { bands: PackedBand[]; components: ViewComponent[]; height: number; dropped: ViewComponent[]; compacted: ViewComponent[] } {
  // Højderne regnes med hele sidens elementer (page), så de tager hensyn til, hvad andre elementer viser.
  const r = packWithinBudget(items, (c, width) => gridHeight(c, width, ds, items) + ITEM_PADDING, { gap: 0, budget: options.budget, keep: options.keep });
  return { ...r, components: bandsToComponents(r.bands) };
}

/** Største antal stakke i et bånd, som spec.columns (2–3; bånd med bredder tegnes efter bredderne). */
function columnsOf(bands: readonly PackedBand[]): number {
  return Math.max(2, Math.min(3, Math.max(0, ...bands.map((b) => b.stacks.length))));
}

export function composeCompany(lassoId: string, ds: Dataset, options: ComposeOptions = {}): ViewSpec {
  // Et spørgsmål med et emne: en hel side i spørgsmålets kontekst; ellers fokus-siden som hidtil.
  if (options.ask && !options.ask.generic && askPlan(options.ask, "company").lead.length) return composeAskCompany(lassoId, ds, options.ask, options);
  const focus = options.focus ?? (options.ask ? askFocus(options.ask) : undefined) ?? "overblik";
  const years = options.years ?? (focus === "oekonomi" ? 10 : 5);
  const id = lassoId;
  const fin = ds.financials[id]?.years ?? [];
  const people = ds.people[id] ?? [];
  const owners = ds.ownership[id]?.owners ?? [];
  const hasOwnerBlock = owners.length > 0 || Boolean(ds.ownership[id]?.auditor);
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
  // Sidens elementer i prioriteret rækkefølge (gridmodellen 23.3: det vigtigste først); packPage
  // lægger dem i bånd og stakke uden huller. Hoved og nøgletalskort står altid i egne fuldbånd øverst.
  const items: ViewComponent[] = [];
  const bottom: ViewComponent[] = [];

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
  const companyList = (page: { contact: boolean; owners: boolean }): ViewComponent | null => {
    const co = ds.companies[id];
    if (!co) return null;
    const rows = companyFacts(co, ds.ownership[id], fin.at(-1), { hideIdentity: true, hideContact: page.contact, hideAuditor: page.owners });
    return rows.filter((r) => r.value).length >= 2 ? { type: "LassoKeyValueList", company: id, variant: "company", title: "Virksomhedsoplysninger" } : null;
  };
  const push = (c: ViewComponent | null | undefined | false) => {
    if (c) items.push(c);
  };
  const ownerList = (): ViewComponent | null => (hasOwnerBlock ? { type: "LassoOwnerList", company: id } : null);
  const shortcuts: ViewComponent = { type: "LassoShortcuts", company: id };

  switch (focus) {
    case "oekonomi": {
      // 23.1 Økonomi: graf | vandfald, regnskabsliste | andelsbjælker + flerårstabel, analysen i fuld bredde.
      const f = finance();
      push(f);
      // Vandfaldet viser vejen fra top til bund for seneste år; andelsbjælkerne balancens sammensætning.
      // Kun med omsætning i seneste regnskab: ellers er der kun "bruttofortjeneste -> øvrige poster ->
      // resultat", som hverken passer til titlen "Fra omsætning til resultat" eller siger noget nyt.
      if (typeof fin.at(-1)?.revenue === "number" && typeof fin.at(-1)?.grossProfit === "number") push({ type: "LassoWaterfallChart", company: id });
      // Under 3 år er regnskabslisten allerede "grafen"; den står ikke to gange.
      if (fin.length > 0 && f?.type !== "LassoKeyValueList") push(financialsList());
      // Fordelingen kræver egenkapital og enten gæld eller balancesum (gæld = balancesum − egenkapital).
      const lastYear = fin.at(-1);
      if (typeof lastYear?.equity === "number" && (typeof lastYear.liabilities === "number" || typeof lastYear.assetsTotal === "number")) push({ type: "LassoShareBars", company: id });
      if (nYears >= 4) push({ type: "LassoMultiYearTable", company: id, years: Math.min(years, 10) });
      // Hele regnskabsanalysen i fuld bredde under graferne; overblikket viser kun dens korte afsnit.
      // Den pakkes efter graferne og listerne: alene i fuld bredde, eller ved siden af et element, der ellers ville stå alene.
      if (textSectionsFor(texts, "analyse").length > 0) push({ type: "LassoTextSections", company: id, variant: "analyse", title: "Regnskabsanalyse" });
      break;
    }
    case "regnskab": {
      if (hasNoStatements(statements)) {
        // Intet offentliggjort regnskab (fx en enkeltmandsvirksomhed uden regnskabspligt): én tom
        // tilstand, der siger hvorfor, på nøgletallenes plads, ikke to tomme tabeller med samme tekst.
        top.push({ type: "LassoIncomeStatement", company: id, years: 3, title: "Regnskab", width: "full" });
        // Oplysninger, ledelse og ejere, højst to af dem, så siden stadig er en side.
        const lead = people.some((p) => !p.to);
        const blocks = [companyList({ contact: false, owners: !lead && hasOwnerBlock }), lead ? ({ type: "LassoPersonList", company: id, show: "current", title: "Ledelse" } as ViewComponent) : null, ownerList()];
        for (const b of blocks.filter(Boolean).slice(0, 2)) push(b);
        break;
      }
      // Fuldt regnskab: tabellerne står i fuld bredde (19.2), stablet i regnskabets rækkefølge.
      bottom.push({ type: "LassoIncomeStatement", company: id, years: 3, width: "full" });
      bottom.push({ type: "LassoBalanceSheet", company: id, years: 3, width: "full" });
      if (statements?.cashFlow?.length) bottom.push({ type: "LassoCashFlow", company: id, years: 3, width: "full" });
      break;
    }
    case "kontakt": {
      // Oplysningerne (uden kontaktfelter og identitet) som anker, kontakt og personer stablet ved siden af.
      push(companyList({ contact: true, owners: false }));
      push({ type: "LassoContact", company: id });
      if (contactPeople.length > 0) push({ type: "LassoContactPersons", company: id });
      // Uden kontaktpersoner fra hjemmesiden er direktion og bestyrelse fra CVR de bedste indgange.
      else if (people.some((p) => !p.to)) push({ type: "LassoPersonList", company: id, show: "current", title: "Ledelse (CVR)" });
      break;
    }
    case "ejerskab": {
      // 23.1 Ejerskab: ejerdiagram ⅔ | ejerliste + reelle ejere + ledelse ⅓, derunder genveje.
      if (owners.some((o) => o.kind === "company")) push({ type: "LassoOwnershipDiagram", company: id, ingoingDepth: 3, outgoingDepth: 2 });
      push(ownerList());
      if (beneficial.length > 0 || ds.beneficialOwnership[id]?.gaps?.length) push({ type: "LassoBeneficialOwners", company: id });
      // Ikke LassoRelations her: den gentager de legale ejere fra ejerlisten ved siden af.
      if (people.some((p) => !p.to)) push({ type: "LassoPersonList", company: id, show: "current", title: "Ledelse" });
      break;
    }
    case "ledelse": {
      if (people.length > 0) push({ type: "LassoPersonList", company: id, show: "all" });
      if (events.length >= 3) push({ type: "LassoTimeline", company: id });
      push(ownerList());
      break;
    }
    case "risiko": {
      // Kreditvurderingen (½) øverst ved siden af oplysningerne.
      // Uden historik står ejerne (med revisor) på siden, ikke relationerne, som gentager ledelsen fra listen.
      const ownerFallback = events.length < 3 && hasOwnerBlock;
      push(companyList({ contact: false, owners: ownerFallback }));
      if (hasCredit) push({ type: "LassoCreditRating", company: id });
      if (people.length > 0) push({ type: "LassoPersonList", company: id, show: "all" });
      if (events.length >= 3) push({ type: "LassoTimeline", company: id });
      else if (ownerFallback) push(ownerList());
      if (auditor) bottom.push({ type: "LassoAuditorIndependence", company: id, width: "full" });
      break;
    }
    case "historik": {
      if (events.length > 0) push({ type: "LassoTimeline", company: id });
      if (news.length > 0) push({ type: "LassoNews", company: id, limit: 5 });
      else if (fin.length > 0) push(finance());
      break;
    }
    default: {
      // 23.3 default-siden (overblik, ingen kontekst): hvad laver de (profil), stamdata og revisor
      // (oplysninger), hvem står bag (relationer), udviklingen (graf), hvordan kontakter jeg dem
      // (kontakt), hvad er der sket (historik, nyheder), og hvor kommer jeg videre (genveje).
      // Nyheder og historik er smagsprøver på fanen Historik: "Se alle … i Historik" åbner den (more).
      if (textSectionsFor(texts, "profil").length > 0) push({ type: "LassoTextSections", company: id, variant: "profil", title: "Virksomhedsprofil" });
      push(companyList({ contact: hasContact, owners: false }));
      if (people.length > 0 || owners.length > 0) push({ type: "LassoRelations", company: id });
      push(finance());
      if (hasContact) push({ type: "LassoContact", company: id });
      // Historikken viser 3 begivenheder + "Se alle N" (regel 9); hele forløbet står på historik.
      if (events.length >= 3) push({ type: "LassoTimeline", company: id, limit: 3, more: "historik" });
      if (news.length > 0) push({ type: "LassoNews", company: id, limit: 3, more: "historik" });
      push(shortcuts);
    }
  }
  if (focus === "ejerskab") push(shortcuts);

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

  // Højdebudget (23.3): hoved, nøgletalskort, opfølgning og regnskabstabellerne (fokus regnskab) er
  // altid med; på et fokus er det første element svaret og altid med. Uden spørgsmål (overblik) er
  // intet element svaret, så profilen kan også stå kompakt. "Vis alt" (showAll) slår budgettet fra.
  const keep = new Set<ViewComponent>([...top, ...bottom.filter((c) => c.type !== "LassoAuditorIndependence"), ...(focus !== "overblik" && items[0] ? [items[0]] : [])]);
  const budget = options.showAll ? Number.POSITIVE_INFINITY : (options.heightBudget ?? PAGE_HEIGHT_BUDGET);
  const { bands, components } = packPage([...top, ...items, ...bottom], ds, { budget, keep });

  return viewSpecSchema.parse({
    kind: "company",
    title: options.name ?? lassoId,
    subtitle: focus === "overblik" ? undefined : FOCUS_LABELS[focus],
    layout: "columns",
    columns: columnsOf(bands),
    components,
  });
}

/* ---------- Spørgsmålet styrer formen (ask.ts, docs/portal.md) ---------- */

/** Elementer, der deler datakilde, hentes én gang (grafer, kort og lister: regnskabstallene). */
const FINANCIAL_TYPES: ReadonlySet<ComponentType> = new Set([
  "LassoKeyFigureCards",
  "LassoBarChart",
  "LassoGroupedBarChart",
  "LassoStackedBarChart",
  "LassoLineChart",
  "LassoWaterfallChart",
  "LassoShareBars",
  "LassoMultiYearTable",
]);
const STATEMENT_TYPES: ReadonlySet<ComponentType> = new Set(["LassoIncomeStatement", "LassoBalanceSheet", "LassoCashFlow"]);

/** Et element i planen som komponent for en virksomhed eller person (standardværdier udfyldt). */
export function askComponent(i: Pick<AskItem, "type" | "props">, kind: "company" | "person", id: string): ViewComponent {
  return componentSchema.parse({ type: i.type, [kind]: id, ...(i.props ?? {}) }) as ViewComponent;
}

/**
 * Proben for et spørgsmål: hovedet og alt i planen, men hver datakilde kun én gang (højst 12
 * komponenter; nyhederne med det største antal). `fix` retter en komponent før hentning (personens
 * ejerdiagram får personsidens dybde).
 */
export function askProbe(lassoId: string, kind: "company" | "person", items: readonly AskItem[], fix: (c: ViewComponent) => ViewComponent = (c) => c): ViewSpec {
  const head: ViewComponent = kind === "company" ? { type: "LassoCompanyHead", company: lassoId } : { type: "LassoPersonHead", person: lassoId };
  const components: ViewComponent[] = [head];
  const keys = new Map<string, number>();
  const keyOf = (c: ViewComponent) =>
    FINANCIAL_TYPES.has(c.type) || (c.type === "LassoKeyValueList" && c.variant === "financials")
      ? "financials"
      : STATEMENT_TYPES.has(c.type)
        ? "statements"
        : c.type === "LassoPersonHead" || c.type === "LassoPersonRoles" || c.type === "LassoPersonRisk" || c.type === "LassoPersonFacts"
          ? "person"
          : pageKey(c);
  keys.set(keyOf(head), 0);
  for (const i of items) {
    const c = fix(askComponent(i, kind, lassoId));
    const k = keyOf(c);
    const at = keys.get(k);
    if (at !== undefined) {
      const prev = components[at]!;
      if (prev.type === "LassoNews" && c.type === "LassoNews" && c.limit > prev.limit) components[at] = c;
      continue;
    }
    if (components.length >= 12) break;
    keys.set(k, components.length);
    components.push(c);
  }
  return viewSpecSchema.parse({ kind, title: lassoId, layout: "stack", components });
}

/** Sidens mål: hver kolonne mindst ca. 25 "linjer" (componentWeight), eller puljen er brugt op. */
export const ASK_COLUMN_TARGET = 25;
/** viewSpecSchema tillader højst 12 komponenter; én plads er til opfølgningen. */
const ASK_MAX_COMPONENTS = 11;

/** Grafer i reglen "højst én graf i kolonnerne"; vandfald og andelsbjælker tæller ikke med. */
const GRAPH_TYPES: ReadonlySet<ComponentType> = new Set(["LassoBarChart", "LassoGroupedBarChart", "LassoLineChart", "LassoStackedBarChart"]);
/** Står i fuld bredde (over kolonnerne som svar, under dem som kontekst): kort, tabeller, regnskaber, diagram, enheder. */
const FULL_WIDTH_TYPES: ReadonlySet<ComponentType> = new Set([
  "LassoKeyFigureCards",
  "LassoMultiYearTable",
  "LassoIncomeStatement",
  "LassoBalanceSheet",
  "LassoCashFlow",
  "LassoOwnershipDiagram",
  "LassoProductionUnits",
  "LassoProperties",
  "LassoLivestock",
]);

/** Dubletnøglen på siden: typen (nøgle-værdi-listen pr. variant); ét tekstelement pr. side. */
function pageKey(c: ViewComponent): string {
  return c.type === "LassoKeyValueList" ? `${c.type}:${c.variant}` : c.type;
}

/**
 * Kortenes nøgletal: de spurgte og beslægtede (oplyst i seneste regnskab, højst 5), fyldt op til 4
 * med standardtallene; uden kandidater standardkortene (hovednøgletal, resultat, egenkapital, ansatte).
 */
export function askCardMetrics(years: readonly FinancialYear[], candidates: readonly Metric[] | undefined): Metric[] {
  const last = years.at(-1);
  if (!last) return [];
  const main = mainMetric(years);
  const present = (m: Metric) => typeof last[METRIC_FIELD[m]] === "number";
  const eff = (ms: readonly Metric[]) => ms.map((m) => effectiveMetric(years, m)).filter((m, i, a) => a.indexOf(m) === i);
  const standard: Metric[] = [main, "resultat", "egenkapital", "ansatte"];
  if (!candidates?.length) return presentNow(years, standard).slice(0, 5);
  const chosen = eff(candidates).filter(present).slice(0, 5);
  for (const m of eff([...standard, "soliditetsgrad", "bruttofortjeneste", "balancesum", "gaeld"])) {
    if (chosen.length >= 4) break;
    if (!chosen.includes(m) && present(m)) chosen.push(m);
  }
  return chosen;
}

/**
 * Virksomhedssiden for et spørgsmål (askPlan): hovedet og evt. kortene i fuld bredde øverst, svar-
 * elementerne først (i kolonne 1, 2, 3 i nævnt rækkefølge, eller i fuld bredde over kolonnerne), og
 * kontekstmodulerne i rangorden i den kolonne, der vejer mindst, til hver kolonne er fuld. Tomme
 * kontekstmoduler udelades (svar-elementet står også tomt), intet står 1:1 to gange, højst én graf.
 */
function composeAskCompany(lassoId: string, ds: Dataset, ask: Ask, options: ComposeOptions): ViewSpec {
  const id = lassoId;
  const plan = askPlan(ask, "company");
  const fin = ds.financials[id]?.years ?? [];
  const last = fin.at(-1);
  const main = mainMetric(fin);
  const co = ds.companies[id];
  const people = ds.people[id];
  const owners = ds.ownership[id]?.owners;
  const statements = ds.financialStatements[id];
  const eff = (ms: readonly Metric[]) => ms.map((m) => effectiveMetric(fin, m)).filter((m, i, a) => a.indexOf(m) === i);
  const withData = (m: Metric) => fin.filter((y) => typeof y[METRIC_FIELD[m]] === "number").length;

  const top: ViewComponent[] = [{ type: "LassoCompanyHead", company: id }];
  const above: ViewComponent[] = [];
  const cols: ViewComponent[][] = [[], [], []];
  const bottom: ViewComponent[] = [];
  const page = () => [...top, ...above, ...cols.flat(), ...bottom];

  // Kortrækken: 4–5 nøgletal, spurgte først (ingen kort ved et regnskabsår eller uden regnskab).
  const cardsItem = plan.top.find((i) => i.type === "LassoKeyFigureCards");
  const cards = cardsItem && fin.length > 0 ? askCardMetrics(fin, cardsItem.props?.metrics as Metric[] | undefined) : [];
  if (cards.length) top.push({ type: "LassoKeyFigureCards", company: id, metrics: cards });

  // Regnskabslisten deler ikke nøgletal med kortene: `only` uden kortenes, ellers `exclude`.
  type KeyValueList = Extract<ViewComponent, { type: "LassoKeyValueList" }>;
  const financialsList = (c: KeyValueList, lead: boolean): ViewComponent | null => {
    if (!lead && fin.length === 0) return null;
    const only = c.only ? eff(c.only).filter((m) => !cards.includes(m)) : undefined;
    const exclude = cards.length ? { exclude: cards } : {};
    if (only && only.length === 0) {
      if (!lead) return null;
      const { only: _all, ...rest } = c;
      return { ...rest, ...exclude };
    }
    return only ? { ...c, only } : { ...c, ...exclude };
  };
  // Grafen kræver 3 år med tal; ellers står regnskabslisten med de spurgte tal som svar.
  const fallbackList = (): ViewComponent | null =>
    financialsList(
      {
        type: "LassoKeyValueList",
        company: id,
        variant: "financials",
        title: "Regnskab",
        ...(ask.metrics.length ? { only: withRelated(ask.metrics.slice(0, 3), 5) } : {}),
        ...(ask.year !== undefined ? { year: ask.year } : {}),
      },
      true,
    );

  const adapt = (i: AskItem, lead: boolean): ViewComponent | null => {
    let props: Record<string, unknown> = { ...(i.props ?? {}) };
    if (i.type === "LassoBarChart" || i.type === "LassoLineChart") props = { ...props, metric: effectiveMetric(fin, (props.metric as Metric | undefined) ?? main) };
    if (i.type === "LassoMultiYearTable" && Array.isArray(props.metrics)) props = { ...props, metrics: eff(props.metrics as Metric[]).slice(0, 6) };
    if (i.type === "LassoGroupedBarChart") {
      const ms = eff((props.metrics as Metric[] | undefined) ?? [main, "resultat"]).slice(0, 3);
      if (ms.length < 2) return adapt({ type: "LassoBarChart", props: { metric: ms[0] ?? main, years: props.years } }, lead);
      props = { ...props, metrics: ms };
    }
    const c = askComponent({ type: i.type, props }, "company", id);
    switch (c.type) {
      case "LassoBarChart":
      case "LassoLineChart":
      case "LassoGroupedBarChart":
      case "LassoStackedBarChart": {
        const years =
          c.type === "LassoStackedBarChart"
            ? fin.filter((y) => typeof y.equity === "number" && typeof y.liabilities === "number").length
            : withData(c.type === "LassoGroupedBarChart" ? c.metrics[0]! : c.metric);
        if (years < 3) return lead ? fallbackList() : null;
        return c;
      }
      case "LassoKeyValueList": {
        if (c.variant === "financials") return financialsList(c, lead);
        if (!co) return lead ? c : null;
        if (lead) return c;
        // Kontekstlisten udelades under 2 rækker med værdi (det, siden ellers viser, gentages ikke).
        const rows = companyFacts(co, ds.ownership[id], last, { ...companyFactOptions([...page(), c], id), rows: c.rows }).filter((r) => r.value);
        return rows.length >= 2 ? c : null;
      }
      case "LassoWaterfallChart":
        return typeof last?.revenue === "number" && typeof last.grossProfit === "number" ? c : null;
      case "LassoShareBars":
        return typeof last?.equity === "number" && (typeof last.liabilities === "number" || typeof last.assetsTotal === "number") ? c : null;
      case "LassoMultiYearTable":
        return lead || fin.length >= 3 ? c : null;
      case "LassoIncomeStatement":
      case "LassoBalanceSheet":
      case "LassoCashFlow": {
        if (hasNoStatements(statements)) {
          // Intet offentliggjort regnskab: én tom tilstand, der siger hvorfor (som fokus regnskab).
          if (!lead || page().some((x) => STATEMENT_TYPES.has(x.type))) return null;
          return { type: "LassoIncomeStatement", company: id, years: 3, title: "Regnskab" };
        }
        if (lead) return c;
        if (!statements) return null;
        return c.type === "LassoCashFlow" ? (statements.cashFlow.length ? c : null) : c;
      }
      case "LassoPersonList": {
        const shown = peopleWithRole(people ?? [], c.roles).filter((p) => c.show === "all" || !p.to);
        return lead || shown.length > 0 ? c : null;
      }
      case "LassoOwnerList":
        return lead || (owners?.length ?? 0) > 0 ? c : null;
      case "LassoRelations":
        return (people?.length ?? 0) + (owners?.length ?? 0) > 0 ? c : null;
      case "LassoBeneficialOwners": {
        const b = ds.beneficialOwnership[id];
        return lead || (b?.owners.length ?? 0) + (b?.gaps?.length ?? 0) > 0 ? c : null;
      }
      case "LassoOwnershipDiagram":
        return lead || Boolean(owners?.some((o) => o.kind === "company")) ? c : null;
      case "LassoTextSections":
        return lead || textSectionsFor(ds.textSections[id]?.sections ?? [], c.variant).length > 0 ? c : null;
      case "LassoTimeline": {
        const t = ds.timeline[id];
        if (!t) return lead ? c : null;
        if (timelineOfKinds(t, c.kinds).events.length > 0) return c;
        // Ingen begivenheder af de ønskede slags: hele historikken, når elementet må falde tilbage.
        if (i.allKindsFallback && t.events.length > 0) {
          const { kinds: _any, ...rest } = c;
          return rest as ViewComponent;
        }
        return lead ? c : null;
      }
      case "LassoNews":
        return lead || (ds.news[id]?.items.length ?? 0) > 0 ? c : null;
      case "LassoContact": {
        const k = ds.contact[id];
        return lead || Boolean(k && (k.phone || k.email || k.website)) ? c : null;
      }
      case "LassoContactPersons":
        return lead || (ds.contactPersons[id]?.people.length ?? 0) > 0 ? c : null;
      case "LassoAuditorIndependence":
        return lead || (ds.auditorIndependence?.[id]?.relations.length ?? 0) > 0 ? c : null;
      case "LassoProductionUnits":
        return lead || (ds.productionUnits[id]?.units.length ?? 0) >= 2 ? c : null;
      case "LassoProperties":
        return lead || (ds.properties[id]?.properties.length ?? 0) > 0 ? c : null;
      case "LassoLivestock":
        return lead || Boolean(ds.livestock[id]?.chrNumber) ? c : null;
      default:
        return lead ? c : null;
    }
  };

  // Ingen 1:1-gentagelser: relationerne gentager ledelse og ejere; ejerlisten viser revisoren.
  const auditorRows = (x: ViewComponent) => x.type === "LassoKeyValueList" && x.variant === "company" && Boolean(x.rows?.includes("revisor"));
  const blocked = (c: ViewComponent): boolean => {
    const on = page();
    const has = (t: ComponentType) => on.some((x) => x.type === t);
    if (on.some((x) => pageKey(x) === pageKey(c))) return true;
    if (c.type === "LassoRelations" && (has("LassoPersonList") || has("LassoOwnerList"))) return true;
    if ((c.type === "LassoPersonList" || c.type === "LassoOwnerList") && has("LassoRelations")) return true;
    if (c.type === "LassoOwnerList" && on.some(auditorRows)) return true;
    if (GRAPH_TYPES.has(c.type) && on.some((x) => GRAPH_TYPES.has(x.type))) return true;
    return false;
  };

  // Spørges der både om ejere og revisor, svarer ejerlisten (med revisor og skiftedato) på begge.
  const asksRevisor = (i: AskItem) => i.type === "LassoKeyValueList" && Array.isArray(i.props?.rows) && (i.props.rows as string[]).includes("revisor");
  const leads = plan.lead.some((i) => i.type === "LassoOwnerList") ? plan.lead.filter((i) => !asksRevisor(i)) : plan.lead;
  const weigh = (c: ViewComponent) => componentWeight(c, ds, page());
  const sums = () => cols.map((col) => col.reduce((sum, c) => sum + weigh(c), 0));
  const lightest = () => {
    const s = sums();
    return s.indexOf(Math.min(...s));
  };
  let halves = 0;
  for (const i of leads) {
    const c = adapt(i, true);
    if (!c || blocked(c)) continue;
    if (FULL_WIDTH_TYPES.has(c.type)) above.push(c);
    else {
      // Svarene øverst i hver sin kolonne i nævnt rækkefølge (første i kolonne 1).
      const k = halves < 3 ? halves : lightest();
      cols[k]!.push({ ...c, column: k + 1 } as ViewComponent);
      halves++;
    }
  }
  for (const i of plan.context) {
    if (Math.min(...sums()) >= ASK_COLUMN_TARGET || page().length >= ASK_MAX_COMPONENTS) break;
    const c = adapt(i, false);
    if (!c || blocked(c)) continue;
    if (FULL_WIDTH_TYPES.has(c.type)) bottom.push(c);
    else {
      const k = lightest();
      cols[k]!.push({ ...c, column: k + 1 } as ViewComponent);
    }
  }

  // Tomme kolonner rykkes sammen; står kun én kolonne, får dens elementer fuld bredde (en halv står aldrig alene).
  const filled = cols.filter((c) => c.length > 0);
  const colComponents =
    filled.length === 1
      ? filled[0]!.map((x) => {
          const { column: _one, ...rest } = x;
          return rest as ViewComponent;
        })
      : filled.flatMap((c, i) => c.map((x) => ({ ...x, column: i + 1 }) as ViewComponent));

  const focus = askFocus(ask) ?? "overblik";
  const name = shortCompanyName(options.name ?? co?.name ?? lassoId);
  const known: FollowUpData = {
    fin: ds.financials[id] ? fin.length : undefined,
    owners: ds.ownership[id] ? (owners?.length ?? 0) : undefined,
    people: people ? people.length : undefined,
    statements: statements ? !hasNoStatements(statements) : undefined,
  };
  // Altid en vej til hele siden (niveau C), dernæst fokusets naturlige næste spørgsmål.
  const whole: FollowUpRule =
    focus === "oekonomi" ? { label: "Hele økonomien", prompt: "Hvordan går det økonomisk for {navn}?" } : { label: "Hele overblikket", prompt: "Giv mig et overblik over {navn}." };
  const prompts = [whole, ...FOLLOW_UPS[focus]]
    .filter((f, i, all) => all.findIndex((x) => x.prompt === f.prompt) === i)
    .filter((f) => f.needs === undefined || f.needs(known))
    .slice(0, 3)
    .map((f) => ({ label: f.label, prompt: f.prompt.replace("{navn}", name) }));
  const tail: ViewComponent[] = options.followUps !== false && prompts.length ? [{ type: "LassoFollowUps", prompts }] : [];

  return viewSpecSchema.parse({
    kind: "company",
    title: options.name ?? lassoId,
    subtitle: askLabel(ask, "company"),
    layout: "columns",
    columns: Math.max(2, Math.min(3, filled.length)),
    components: [...top, ...above, ...colComponents, ...bottom, ...tail],
  });
}
