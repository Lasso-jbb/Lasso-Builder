import { companyFollowUps } from "./followUps.js";
import { changeFeedKey, entityRefOf, ownershipGraphKey } from "./models.js";
import { changePercent, formatDate, formatNumber, formatPercent, percentChange } from "./format.js";
import { askFocus, askLabel, askPlan, SUMMARY_PENDING_TEXT, withRelated, type Ask, type AskItem } from "./ask.js";
import { companyFactOptions, companyFacts, sameAddress } from "./companyFacts.js";
import type { Dataset, FinancialYear } from "./models.js";
import { hasNoStatements } from "./statements.js";
import { effectiveMetric, mainMetric } from "./series.js";
import { bandsToComponents, elementMinWidth, leadFirst, measuredHeight, packBandsPaired, packWithinBudget, PAGE_HEIGHT_BUDGET, type MinWidthFn, type PackedBand } from "./grid.js";
import { personCompanies } from "./person.js";
import type { ContentWidthDrivers } from "./register.js";
import {
  componentSchema,
  formatMetricValue,
  METRIC_FIELD,
  METRIC_LABELS,
  peopleWithRole,
  timelineOfKinds,
  viewSpecSchema,
  type ComponentType,
  type Metric,
  type ViewComponent,
  type ViewSpec,
  type Width,
  WIDTH_COLUMNS,
} from "./spec.js";
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

/** Virksomhedens egne ændringer på fokus historik (LassoChangeFeed med company): de seneste 30 dage. */
export const COMPANY_FEED_DAYS = 30;

/** viewSpecSchema tillader højst 12 komponenter på en side. */
const MAX_PAGE_COMPONENTS = 12;

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
        // B4: kortet (hovedadressen, når der er koordinater) og registreringen, når budgettet giver plads.
        { type: "LassoMap", company: c },
        { type: "LassoRegistration", company: c, variant: "full" },
      );
      break;
    case "oekonomi":
      // Kort, grafer, regnskabsliste og flerårstabel bygger på regnskabstallene; hele regnskabsanalysen;
      // branchetallene til nøgletalsmåleren (B4, kun når branchen har tal).
      add({ type: "LassoKeyFigureCards", company: c }, { type: "LassoTextSections", company: c, variant: "analyse" }, { type: "LassoKeyFigureGauge", company: c });
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
      // Observationerne (B4) tager 10–14 s i live; de hentes parallelt med Creditsafe, så siden venter ikke længere.
      add(
        { type: "LassoCreditRating", company: c },
        { type: "LassoRiskObservations", company: c },
        { type: "LassoScoreGauge", company: c },
      );
      break;
    case "historik":
      // B4: Statstidende, fusioner og regnskabspublicering (ét opslag) og virksomhedens egne ændringer de seneste 30 dage.
      add(
        { type: "LassoTimeline", company: c },
        { type: "LassoNews", company: c, limit: 5 },
        { type: "LassoAnnouncements", company: c },
        { type: "LassoChangeFeed", company: c, days: COMPANY_FEED_DAYS },
      );
      break;
    case "kontakt":
      add({ type: "LassoContact", company: c }, { type: "LassoContactPersons", company: c }, { type: "LassoMap", company: c }, { type: "LassoProductionUnits", company: c });
      break;
  }
  return viewSpecSchema.parse({ kind: "company", title: lassoId, layout: "stack", components });
}

/**
 * Hvad komponisten ved om virksomheden til opfølgningerne. `undefined` = ikke hentet på dette fokus
 * (composeProbe henter kun det, fokus viser); så vises opfølgningen, og fanen, den peger på, svarer selv.
 */
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
      // view 'short' (Jakob 01.10): 8 rækker fremme, resten foldes ud på stedet.
      const max = c.maxRows ?? (c.view === "short" ? 8 : undefined);
      const shown = (n: number) => (max && max < n ? 1.6 * max + 1.5 : 1.6 * n);
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
    case "LassoScoreGauge":
      return 12;
    case "LassoChangeFeed": {
      // Filterlinje (2), en overskrift pr. dag (1,6) og ca. 2,6 pr. ændring; over 10 foldes efter 8 (ChangeFeed).
      const entries = (ds.changeFeeds[changeFeedKey(c)]?.entries ?? []).filter((e) => e.type !== "kredit");
      const shown = entries.length > 10 ? entries.slice(0, 8) : entries;
      const days = new Set(shown.map((e) => e.at.slice(0, 10))).size;
      return TITLE + 2 + 1.6 * days + 2.6 * shown.length + (shown.length < entries.length ? 1.5 : 0);
    }
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
  // Målesættets feed er listen "Kunder" de seneste 7 dage: 8 ændringer (uden kredit) på 3 dage.
  LassoChangeFeed: 30.6,
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
  // Statstidende er målt uden bekendtgørelser (demovirksomheden er aktiv); skøn: ca. 90 px pr. bekendtgørelse
  // (type, dato og tekst foldet), højst 3 + "Se alle", og en fjerdedel højere uden fuld bredde.
  if (c.type === "LassoAnnouncements") {
    const n = ds.companyEvents[c.company]?.announcements.length ?? 0;
    const px = TITLE_PX + 90 * Math.min(n, 3) + (n > 3 ? 36 : 0);
    return Math.round(width === "full" ? px : px * 1.25);
  }
  // Resumeet er ikke målt (grid.ts låner tekstsektionernes højde); skøn ud fra teksten: ca. 24 px pr. linje,
  // ca. 11 tegn pr. kolonne i gitteret, plus titel og kildelinje.
  if (c.type === "LassoSummary") {
    const perLine = 11 * WIDTH_COLUMNS[width];
    return TITLE_PX + 24 * Math.ceil(c.text.length / perLine) + 30;
  }
  const base = measuredHeight(c, width);
  const key = c.type === "LassoKeyValueList" && c.variant === "financials" ? "LassoKeyValueList (financials)" : c.type;
  const std = MEASURED_WEIGHT[key];
  if (!std) return base;
  const w = componentWeight(c, ds, page);
  const perUnit = (base - TITLE_PX) / (std - TITLE_WEIGHT);
  return Math.max(TITLE_PX, Math.round(base + (w - std) * perUnit));
}

/* ---------- Ø13: indholdsstyret mindstebredde (B8) ---------- */

const yearOf = (d?: string): number | undefined => {
  const y = d ? Number(d.slice(0, 4)) : NaN;
  return Number.isFinite(y) ? y : undefined;
};
/** Årsspænd fra første til sidste år (til: i dag, når en periode er åben). */
function yearSpan(periods: readonly { from?: string; to?: string }[]): number {
  const now = new Date().getFullYear();
  const froms = periods.map((p) => yearOf(p.from)).filter((y): y is number => y !== undefined);
  if (froms.length === 0) return 0;
  const tos = periods.map((p) => yearOf(p.to) ?? now);
  return Math.max(...tos) - Math.min(...froms);
}
const longest = (names: readonly (string | undefined)[]): number | undefined => {
  const n = Math.max(0, ...names.map((x) => x?.length ?? 0));
  return n > 0 ? n : undefined;
};
/** Tidsakse = mere end 5 år på aksen (A13: grafer viser højst 5 år; tidsbånd fra år til år). */
const TIME_AXIS_YEARS = 5;

/**
 * Indholdsdriverne (register.ContentWidthDrivers) for et konkret element ud fra det, det faktisk viser i
 * Dataset: rækker pr. post, længste navn, tidsakse (år > 5) og serier/kolonner side om side. Kun de
 * drivere, der følger af data; typer uden data-afhængig bredde giver {} (typens min og profil gælder).
 * Bruges af pakkeren (packPage) gennem contentMinWidth.
 */
export function driversOf(c: ViewComponent, ds: Dataset): ContentWidthDrivers {
  switch (c.type) {
    case "LassoPersonNetwork": {
      // "Sidder sammen med": op til 3 selskaber (rækker) pr. person, selskab og rolle på linjen, tidsakse fra første til seneste år.
      const people = (ds.personNetworks[c.person]?.people ?? []).slice(0, c.limit ?? 3);
      const companies = people.flatMap((p) => p.companies.slice(0, 3));
      return {
        rowsPerItem: Math.max(0, ...people.map((p) => Math.min(3, p.companies.length))) || undefined,
        longestLabel: longest([...people.map((p) => p.name), ...companies.map((x) => `${x.companyName}${x.role ? `, ${x.role}` : ""}`)]),
        timeAxis: yearSpan(companies) > TIME_AXIS_YEARS || undefined,
      };
    }
    case "LassoPersonRoles": {
      const p = ds.persons[c.person];
      if (!p) return {};
      const companies = personCompanies(p);
      return {
        rowsPerItem: Math.max(0, ...companies.map((x) => x.roles.length)) || undefined,
        longestLabel: longest(companies.map((x) => x.companyName)),
        // Tidsbåndet (show 'all') har en tidsakse; listerne har ingen.
        timeAxis: ((c.show ?? "all") === "all" && yearSpan(p.roles) > TIME_AXIS_YEARS) || undefined,
      };
    }
    case "LassoOwnershipDiagram": {
      const g = ds.ownershipGraphs[ownershipGraphKey(c)];
      return { longestLabel: longest(g?.nodes.map((n) => n.name) ?? []) };
    }
    case "LassoBarChart":
    case "LassoGroupedBarChart":
    case "LassoLineChart":
    case "LassoStackedBarChart":
    case "LassoMultiYearTable": {
      const company = "company" in c && typeof c.company === "string" ? c.company : undefined;
      const years = company ? (ds.financials[company]?.years.length ?? 0) : 0;
      const shown = Math.min(years, "years" in c && typeof c.years === "number" ? c.years : 5);
      const series = c.type === "LassoGroupedBarChart" ? c.metrics?.length : c.type === "LassoMultiYearTable" ? shown : undefined;
      return { timeAxis: shown > TIME_AXIS_YEARS || undefined, series: series || undefined };
    }
    case "LassoCompareTable":
      return { series: c.companies.length, longestLabel: longest(c.companies.map((id) => ds.companies[id]?.name)) };
    case "LassoRanking":
      return { series: c.companies.length, longestLabel: longest(c.companies.map((id) => ds.companies[id]?.name)) };
    case "LassoNews": {
      // Overskrift, uddrag og kilde/tid: tre rækker pr. artikel, når der er uddrag.
      const items = ds.news[entityRefOf(c) ?? ""]?.items ?? [];
      return { rowsPerItem: items.length ? (items.some((i) => i.excerpt) ? 3 : 2) : undefined };
    }
    case "LassoProductionUnits":
      return { longestLabel: longest((ds.productionUnits[c.company]?.units ?? []).map((u) => u.name)) };
    default:
      return {};
  }
}

/** Mindstebredden for et element på siden (Ø13): typens min hævet efter profil og indhold (driversOf), inden for typens max. */
export function contentWidthOf(c: ViewComponent, ds: Dataset): Width {
  let drivers: ContentWidthDrivers = {};
  try {
    drivers = driversOf(c, ds);
  } catch {
    // Ufuldstændige data (fx en visning uden hentede data): typens min og profil gælder.
  }
  return elementMinWidth(c, drivers);
}
/** contentWidthOf som pakkerens minWidth (PackOptions). */
export function contentMinWidthFn(ds: Dataset): MinWidthFn {
  return (c) => contentWidthOf(c, ds);
}

/**
 * I layout 'columns' har hvert element 24 px luft over og under (.lasso-column__item) i stedet for et
 * gap på 24 mellem kort; en stak med n elementer er derfor Σh + 48·n høj. Pakningen regner med gap 0
 * og 48 px pr. element, så afvigelsen regnes på det, der faktisk tegnes.
 */
export const ITEM_PADDING = 48;

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
  // Mindstebredden efter indholdet (Ø13): et bredt element med lange navne, mange rækker eller tidsakse
  // lægges aldrig smallere; hellere eget bånd eller udeladt af højdebudgettet.
  const r = packWithinBudget(items, (c, width) => gridHeight(c, width, ds, items) + ITEM_PADDING, { gap: 0, budget: options.budget, keep: options.keep, minWidth: contentMinWidthFn(ds) });
  return { ...r, components: bandsToComponents(r.bands) };
}

/**
 * B4: pakker siden med de valgfrie elementer (`extras`, fx kort, registrering, Statstidende) inden for
 * højdebudgettet. Hvert ekstra element prøves i prioriteret rækkefølge og kommer kun med, hvis siden
 * stadig højst har 12 komponenter, og hverken fokusets egne elementer eller et allerede optaget ekstra
 * element dermed udelades eller vises kompakt. Papers side for fokus står altså som før; de nye elementer
 * fylder kun den plads, budgettet har tilbage (showAll: alle, så længe der er under 12).
 */
export function packWithExtras(
  top: readonly ViewComponent[],
  items: readonly ViewComponent[],
  bottom: readonly ViewComponent[],
  extras: ReadonlySet<ViewComponent>,
  ds: Dataset,
  options: PackPageOptions = {},
): ReturnType<typeof packPage> {
  const run = (accepted: ReadonlySet<ViewComponent>) => packPage([...top, ...items.filter((c) => !extras.has(c) || accepted.has(c)), ...bottom], ds, options);
  let accepted = new Set<ViewComponent>();
  let best = run(accepted);
  if (extras.size === 0) return best;
  const dropped = new Set(best.dropped);
  const compacted = new Set(best.compacted);
  for (const x of items) {
    if (!extras.has(x)) continue;
    const trial = new Set([...accepted, x]);
    const r = run(trial);
    const fits = r.components.length <= MAX_PAGE_COMPONENTS && r.dropped.every((c) => dropped.has(c)) && r.compacted.every((c) => compacted.has(c) || extras.has(c));
    if (!fits) continue;
    accepted = trial;
    best = r;
  }
  return best;
}

/**
 * B4: et kort resume ud fra regnskabstallene (LassoSummary på fokus oekonomi og som svar på "giv mig en
 * opsummering", hvor planens pladsholder SUMMARY_PENDING_TEXT erstattes): hovednøgletallet med ændring,
 * resultatet, egenkapital og soliditetsgrad, udviklingen over årene og antal ansatte. Med `facts` først en
 * sætning om branche, by, stiftelse og (afvigende) status. Kun det, data viser; null, når der intet er.
 */
export function companySummaryText(lassoId: string, ds: Dataset, name?: string, opts: { facts?: boolean } = {}): string | null {
  const fin = ds.financials[lassoId];
  const years = fin?.years ?? [];
  const last = years.at(-1);
  const co = ds.companies[lassoId];
  const who = shortCompanyName(name ?? co?.name ?? "Virksomheden");
  const out: string[] = [];
  if (opts.facts && co) {
    const industry = co.industryText ? ` inden for ${co.industryText.charAt(0).toLowerCase()}${co.industryText.slice(1)}` : "";
    const city = co.address?.city ? ` i ${co.address.city}` : "";
    const founded = co.founded ? `${industry || city ? " og" : ""} blev stiftet ${formatDate(co.founded)}` : "";
    if (industry || city) out.push(`${who} driver virksomhed${industry}${city}${founded}.`);
    else if (founded) out.push(`${who}${founded}.`);
    if (co.status && co.statusKind && co.statusKind !== "active") out.push(`Status i CVR: ${co.status}.`);
  }
  if (!last) return out.length > 0 ? out.join(" ") : null;
  const cur = fin?.currency;
  const main = mainMetric(years);
  const value = (y: FinancialYear | undefined, m: Metric): number | null => {
    const v = y?.[METRIC_FIELD[m]];
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  };
  const lower = (m: Metric) => METRIC_LABELS[m].charAt(0).toLowerCase() + METRIC_LABELS[m].slice(1);
  const v = value(last, main);
  if (v !== null) {
    const prev = years.at(-2);
    const change = changePercent(value(prev, main), v);
    out.push(`${who} havde i ${last.year} en ${lower(main)} på ${formatMetricValue(main, v, cur)}${change !== null && prev ? ` (${formatPercent(change)} i forhold til ${prev.year})` : ""}.`);
  }
  const profit = value(last, "resultat");
  if (profit !== null) out.push(profit < 0 ? `Årets resultat var et underskud på ${formatMetricValue("resultat", -profit, cur)}.` : `Årets resultat blev ${formatMetricValue("resultat", profit, cur)}.`);
  const equity = value(last, "egenkapital");
  const solidity = value(last, "soliditetsgrad");
  if (equity !== null) out.push(`Egenkapitalen var ${formatMetricValue("egenkapital", equity, cur)}${solidity !== null ? `, og soliditetsgraden var ${formatMetricValue("soliditetsgrad", solidity)}` : ""}.`);
  const series = yearsWith(years, main);
  if (series.length >= 4) {
    const pc = percentChange(series.map((y) => value(y, main)));
    if (pc !== null) out.push(`Fra ${series[0]!.year} til ${series.at(-1)!.year} er ${lower(main)} ${pc >= 0 ? "steget" : "faldet"} ${formatPercent(Math.abs(pc), false)}.`);
  }
  const employees = value(last, "ansatte");
  if (employees !== null) out.push(`Virksomheden havde ${formatNumber(employees)} ansatte.`);
  return out.length > 0 ? out.join(" ") : null;
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
    // Jakob 01.10: på siderne står oplysningerne i kort visning (8 rækker + "Vis alle N"); hele listen står i fuld visning.
    return rows.filter((r) => r.value).length >= 2 ? { type: "LassoKeyValueList", company: id, variant: "company", title: "Virksomhedsoplysninger", view: "short" } : null;
  };
  const push = (c: ViewComponent | null | undefined | false) => {
    if (c) items.push(c);
  };
  // B4: elementer, der kun kommer med, når budgettet (og 12-grænsen) giver plads, uden at et af fokusets
  // egne elementer (Paper-siden) udelades eller vises kompakt af den grund (packWithExtras).
  const extras = new Set<ViewComponent>();
  const extra = (c: ViewComponent | null | undefined | false) => {
    if (!c) return;
    items.push(c);
    extras.add(c);
  };
  const mapPoints = ds.maps[id]?.points.length ?? 0;
  const mapItem = (): ViewComponent | null => (mapPoints > 0 ? { type: "LassoMap", company: id } : null);
  const companyEvents = ds.companyEvents[id];
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
      // B4: nøgletalsmåleren mod branchens median, kun når branchen har tal (ellers intet element, ingen tom tilstand).
      const bench = ds.industryBenchmarks[id];
      if (fin.length > 0 && bench?.state === "ok" && bench.years.length > 0) extra({ type: "LassoKeyFigureGauge", company: id });
      if (nYears >= 4) push({ type: "LassoMultiYearTable", company: id, years: Math.min(years, 10) });
      // Hele regnskabsanalysen i fuld bredde under graferne; overblikket viser kun dens korte afsnit.
      // Den pakkes efter graferne og listerne: alene i fuld bredde, eller ved siden af et element, der ellers ville stå alene.
      if (textSectionsFor(texts, "analyse").length > 0) push({ type: "LassoTextSections", company: id, variant: "analyse", title: "Regnskabsanalyse" });
      // B4: et kort resume af tallene (skrevet her ud fra regnskabet), når der er plads.
      const summary = companySummaryText(id, ds, options.name);
      if (summary) extra({ type: "LassoSummary", title: "Opsummering", text: summary, source: "Lasso" });
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
      // Jakob 01.10: hele regnskabet i den detaljerede visning med værktøjslinje (talformat, "Vis alt", print og
      // PDF): resultatopgørelse, balance, pengestrøm og nøgletal, struktureret som et regnskab.
      bottom.push({ type: "LassoFinancialStatements", company: id, years: 3, width: "full" });
      break;
    }
    case "kontakt": {
      // Oplysningerne (uden kontaktfelter og identitet) som anker, kontakt og personer stablet ved siden af.
      push(companyList({ contact: true, owners: false }));
      push({ type: "LassoContact", company: id });
      if (contactPeople.length > 0) push({ type: "LassoContactPersons", company: id });
      // Uden kontaktpersoner fra hjemmesiden er direktion og bestyrelse fra CVR de bedste indgange.
      else if (people.some((p) => !p.to)) push({ type: "LassoPersonList", company: id, show: "current", title: "Ledelse (CVR)" });
      // B4: adresserne på kort med P-enhederne som liste, kun når kortet har punkter (enhederne fra 2, ellers gentager de adressen).
      extra(mapItem());
      if (mapPoints > 0 && (ds.productionUnits[id]?.units.length ?? 0) >= 2) extra({ type: "LassoProductionUnits", company: id });
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
      // B4: Lassos observationer lige efter kreditvurderingen (tom liste = "intet at bemærke, tjekket DATO"), når
      // budgettet giver plads. Ikke som svar nr. 1 og ikke altid med: på en fuld side (fx Eksempel Byg) ville
      // de fortrænge kreditvurderingen, og eval-sættet forventer kreditvurderingen som svar på fokus risiko.
      if (ds.observations[id]) extra({ type: "LassoRiskObservations", company: id });
      // Lassos 0–100-score og dens historik kun med indhold (ingen tom tilstand på fokus-siden).
      if (typeof ds.scores[id]?.score === "number") extra({ type: "LassoScoreGauge", company: id });
      // Jakob 01.10: scorehistorikken (Creditsafe) og revisoruafhængigheden er slettet; historikken kan ikke ses.
      if (people.length > 0) push({ type: "LassoPersonList", company: id, show: "all" });
      if (events.length >= 3) push({ type: "LassoTimeline", company: id });
      else if (ownerFallback) push(ownerList());
      break;
    }
    case "historik": {
      if (events.length > 0) push({ type: "LassoTimeline", company: id });
      if (news.length > 0) push({ type: "LassoNews", company: id, limit: 5 });
      else if (fin.length > 0) push(finance());
      // B4, når der er data og plads: Statstidende (alvorligst først), virksomhedens egne ændringer de seneste
      // 30 dage, fusioner/spaltninger og regnskabspublicering.
      if (companyEvents?.announcements.length) extra({ type: "LassoAnnouncements", company: id });
      const feed = ds.changeFeeds[changeFeedKey({ company: id, days: COMPANY_FEED_DAYS })];
      if (feed?.entries.some((e) => e.type !== "kredit")) extra({ type: "LassoChangeFeed", company: id, days: COMPANY_FEED_DAYS, title: `Ændringer de seneste ${COMPANY_FEED_DAYS} dage` });
      if (companyEvents?.mergers.length) extra({ type: "LassoMergers", company: id });
      if (companyEvents?.publications.length) extra({ type: "LassoPublications", company: id });
      break;
    }
    default: {
      // 23.3 default-siden (overblik, ingen kontekst): hvad laver de (profil), stamdata og revisor
      // (oplysninger), hvem står bag (relationer), udviklingen (graf), hvordan kontakter jeg dem
      // (kontakt), hvad er der sket (historik, nyheder), og hvor kommer jeg videre (genveje).
      // Nyheder og historik er smagsprøver på fanen Historik: "Se alle … i Historik" åbner den (more).
      if (textSectionsFor(texts, "profil").length > 0) push({ type: "LassoTextSections", company: id, variant: "profil", title: "Virksomhedsprofil" });
      push(companyList({ contact: hasContact, owners: false }));
      // B4: registreringen (regnskabsoplysninger, kapital og vedtægter) efter oplysningerne, når der er plads.
      if (ds.companies[id]) extra({ type: "LassoRegistration", company: id, variant: "full" });
      if (people.length > 0 || owners.length > 0) push({ type: "LassoRelations", company: id });
      push(finance());
      if (hasContact) push({ type: "LassoContact", company: id });
      extra(mapItem());
      // Historikken viser 3 begivenheder + "Se alle N" (regel 9); hele forløbet står på historik.
      if (events.length >= 3) push({ type: "LassoTimeline", company: id, limit: 3, more: "historik" });
      if (news.length > 0) push({ type: "LassoNews", company: id, limit: 3, more: "historik" });
      push(shortcuts);
    }
  }
  if (focus === "ejerskab") push(shortcuts);

  // Jakob 30.09: op til seks forskellige spørgsmål ud fra fokus og sidens data (followUps.ts).
  const followUps = companyFollowUps(ds, id, focus, shortCompanyName(options.name ?? ds.companies[id]?.name ?? lassoId), shortCompanyName, {
    hasStatements: statements ? !hasNoStatements(statements) : undefined,
  });
  if (options.followUps !== false && followUps.length > 0) bottom.push({ type: "LassoFollowUps", prompts: followUps });

  // Højdebudget (23.3): hoved, nøgletalskort, opfølgning og regnskabstabellerne (fokus regnskab) er
  // altid med; på et fokus er det første element svaret og altid med. Uden spørgsmål (overblik) er
  // intet element svaret, så profilen kan også stå kompakt. "Vis alt" (showAll) slår budgettet fra.
  // Svaret er fokusets første egne element (et B4-element er aldrig svaret, medmindre fokuset intet andet har).
  const answer = items.find((c) => !extras.has(c)) ?? items[0];
  const keep = new Set<ViewComponent>([
    ...top,
    ...bottom,
    ...(focus !== "overblik" && answer ? [answer] : []),
  ]);
  const budget = options.showAll ? Number.POSITIVE_INFINITY : (options.heightBudget ?? PAGE_HEIGHT_BUDGET);
  const { bands, components } = packWithExtras(top, items, bottom, extras, ds, { budget, keep });

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
  // B4: samme sæt som TYPE_WIDTH_FULL i ask.ts.
  "LassoFinancialStatements",
  "LassoRegistration",
  "LassoAnnouncements",
  "LassoSummary",
  "LassoChangeFeed",
  "LassoPersonStats",
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
 * elementerne først (i kolonnerne i nævnt rækkefølge, eller i fuld bredde over kolonnerne), og
 * kontekstmodulerne i rangorden, til hver kolonne er fuld (kolonnerne vejes som hidtil for at vælge,
 * hvor meget kontekst der er plads til). Selve kolonnelayoutet pakkes med gridmodellen (packBands) og
 * den indholdsstyrede mindstebredde (Ø13/B10): et bredt svar står aldrig under sin mindstebredde (hellere
 * eget bånd), en smal liste højst i ½ ved siden af andre, og svar-elementet står først (leadFirst).
 * Tomme kontekstmoduler udelades (svar-elementet står også tomt), intet står 1:1 to gange, højst én graf.
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
  // Svar i fuld bredde, der er nævnt efter et svar i kolonnerne: under kolonnerne, så rækkefølgen holder.
  const belowLeads: ViewComponent[] = [];
  const cols: ViewComponent[][] = [[], [], []];
  const bottom: ViewComponent[] = [];
  const page = () => [...top, ...above, ...cols.flat(), ...belowLeads, ...bottom];

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
      case "LassoProductionUnits":
        return lead || (ds.productionUnits[id]?.units.length ?? 0) >= 2 ? c : null;
      case "LassoProperties":
        return lead || (ds.properties[id]?.properties.length ?? 0) > 0 ? c : null;
      case "LassoLivestock":
        return lead || Boolean(ds.livestock[id]?.chrNumber) ? c : null;
      case "LassoAnnouncements":
        // Statstidende udelades helt uden bekendtgørelser (katalog 28.8); som svar står den (og siger det selv).
        return lead || (ds.companyEvents[id]?.announcements.length ?? 0) > 0 ? c : null;
      case "LassoSummary": {
        // B4: planens resume er en pladsholder (SUMMARY_PENDING_TEXT, ask.ts); komponisten skriver det ud fra
        // stamdata og regnskabstal. En tekst, modellen selv har skrevet, står urørt.
        if (c.text !== SUMMARY_PENDING_TEXT) return c;
        const text = companySummaryText(id, ds, options.name, { facts: true });
        return text ? { ...c, text } : lead ? c : null;
      }
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
  // Kolonne-elementerne i prioriteret rækkefølge (svarene i nævnt rækkefølge, så konteksten i rangorden) til pakningen.
  const columnItems: ViewComponent[] = [];
  for (const i of leads) {
    const c = adapt(i, true);
    if (!c || blocked(c)) continue;
    if (FULL_WIDTH_TYPES.has(c.type)) (halves > 0 ? belowLeads : above).push(c);
    else {
      // Svarene øverst i hver sin kolonne i nævnt rækkefølge (første i kolonne 1).
      const k = halves < 3 ? halves : lightest();
      cols[k]!.push({ ...c, column: k + 1 } as ViewComponent);
      columnItems.push(c);
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
      columnItems.push(c);
    }
  }

  // Kolonnerne pakkes i bånd (gridmodellen, Ø13): bredderne følger reglerne og indholdet; et element, der
  // står alene i et bånd, får fuld bredde (en halv står aldrig alene). Svar-elementet står først.
  const all = page();
  const bands = packBandsPaired(columnItems, (c, width) => gridHeight(c, width, ds, all) + ITEM_PADDING, { gap: 0, minWidth: contentMinWidthFn(ds) });
  if (columnItems[0]) leadFirst(bands, columnItems[0]);
  const colComponents = bandsToComponents(bands);

  const focus = askFocus(ask) ?? "overblik";
  const name = shortCompanyName(options.name ?? co?.name ?? lassoId);
  // Altid en vej til hele siden (niveau C) først, dernæst op til fem forskellige spørgsmål (followUps.ts).
  const prompts = companyFollowUps(ds, id, focus, name, shortCompanyName, { whole: true, hasStatements: statements ? !hasNoStatements(statements) : undefined });
  const tail: ViewComponent[] = options.followUps !== false && prompts.length ? [{ type: "LassoFollowUps", prompts }] : [];

  return viewSpecSchema.parse({
    kind: "company",
    title: options.name ?? lassoId,
    subtitle: askLabel(ask, "company"),
    layout: "columns",
    columns: columnsOf(bands),
    components: [...top, ...above, ...colComponents, ...belowLeads, ...bottom, ...tail],
  });
}
