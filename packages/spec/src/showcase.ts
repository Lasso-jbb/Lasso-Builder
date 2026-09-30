/**
 * Komponentudstillingen (/komponenter): alle katalogets komponenter i brug på én virksomhed og én
 * person med live-data, nummereret efter katalogets rækkefølge (1–54). Hver post har komponenten
 * (props), formålet og de datasæt, den kræver (register.kraeverData), så man kan se, hvordan den
 * bruger data. Ren funktion; serveren henter data og view-appen tegner (boot.mode "showcase").
 */
import { COMPONENT_CATALOG } from "./catalog.js";
import type { DatasetKey } from "./register.js";
import { componentSchema, type ComponentType, type ViewComponent } from "./spec.js";

export interface ShowcaseItem {
  /** Katalognummer (1–54), samme nummer på begge faner. */
  n: number;
  type: ComponentType;
  title: string;
  formaal: string;
  kraeverData: DatasetKey[];
  live: string;
  liveNote?: string;
  component: ViewComponent;
}

export interface ShowcaseTab {
  id: "virksomhed" | "person";
  label: string;
  /** Sidens hovedentitet (Lasso-ID), til dataudsnittet. */
  entity: string;
  items: ShowcaseItem[];
}

export interface ShowcaseInput {
  company: string;
  companyName: string;
  person: string;
  personName: string;
  /** 2 andre virksomheder til sammenligning og rangering. */
  peers: [string, string];
}

type C = Record<string, unknown> & { type: ComponentType };

/** Én komponent pr. katalogtype. Personens egne typer og de typer, der også gælder personer, står på personfanen. */
export function showcaseComponents(i: ShowcaseInput): { company: C[]; person: C[] } {
  const co = i.company;
  const p = i.person;
  const all3 = [co, ...i.peers];
  const company: C[] = [
    { type: "LassoCompanyHead", company: co, risk: true },
    { type: "LassoKeyValueList", company: co },
    { type: "LassoContact", company: co },
    { type: "LassoContactPersons", company: co },
    { type: "LassoShortcuts", company: co },
    { type: "LassoTextSections", company: co },
    {
      type: "LassoSummary",
      title: "Opsummering",
      text: `${i.companyName} er vist med alle Lassos komponenter. Opsummeringen skrives af modellen i chatten ud fra tallene på siden; her står en fast eksempeltekst, fordi siden ikke har en model.`,
    },
    { type: "LassoTimeline", company: co, limit: 5 },
    { type: "LassoNews", company: co, limit: 4 },
    { type: "LassoKeyFigureCards", company: co },
    { type: "LassoBarChart", company: co, metric: "bruttofortjeneste", years: 5 },
    { type: "LassoGroupedBarChart", company: co, metrics: ["bruttofortjeneste", "resultat"], years: 5 },
    { type: "LassoLineChart", company: co, metric: "bruttofortjeneste", years: 5, benchmark: i.peers[0] },
    { type: "LassoStackedBarChart", company: co },
    { type: "LassoShareBars", company: co },
    { type: "LassoWaterfallChart", company: co },
    { type: "LassoKeyFigureGauge", company: co },
    { type: "LassoMultiYearTable", company: co, years: 5 },
    { type: "LassoIncomeStatement", company: co },
    { type: "LassoBalanceSheet", company: co },
    { type: "LassoCashFlow", company: co },
    { type: "LassoFinancialStatements", company: co },
    { type: "LassoMergers", company: co },
    { type: "LassoRegistration", company: co },
    { type: "LassoAnnouncements", company: co },
    { type: "LassoPublications", company: co },
    { type: "LassoPersonList", company: co, show: "all" },
    { type: "LassoOwnerList", company: co },
    { type: "LassoBeneficialOwners", company: co },
    { type: "LassoOwnershipDiagram", company: co },
    { type: "LassoRelations", company: co },
    { type: "LassoCompareTable", companies: all3 },
    { type: "LassoRanking", companies: all3, metric: "bruttofortjeneste" },
    { type: "LassoCompanyTable", source: "search", search: { query: i.companyName, limit: 5 } },
    { type: "LassoCreditRating", company: co },
    { type: "LassoRiskObservations", company: co },
    { type: "LassoScoreGauge", company: co, detail: true },
    { type: "LassoAuditorIndependence", company: co },
    { type: "LassoScoreHistory", company: co },
    { type: "LassoProductionUnits", company: co },
    { type: "LassoProperties", company: co },
    { type: "LassoMap", company: co },
    { type: "LassoLivestock", company: co },
    { type: "LassoChangeFeed", company: co, days: 90 },
    { type: "LassoHeatmap" },
    { type: "LassoSavedPages" },
    {
      type: "LassoFollowUps",
      prompts: [
        { label: "Økonomi", prompt: `Hvordan går det med ${i.companyName}?` },
        { label: "Ejere", prompt: `Hvem ejer ${i.companyName}?` },
      ],
    },
  ];
  const person: C[] = [
    { type: "LassoPersonHead", person: p },
    { type: "LassoPersonRoles", person: p, limit: 10 },
    { type: "LassoPersonNetwork", person: p, limit: 10 },
    { type: "LassoPersonRisk", person: p },
    { type: "LassoPersonStats", person: p },
    { type: "LassoPersonFacts", person: p },
    { type: "LassoTimeline", person: p, limit: 5 },
    { type: "LassoNews", person: p, limit: 4 },
    { type: "LassoOwnershipDiagram", person: p, ingoingDepth: 0, outgoingDepth: 2 },
    { type: "LassoPersonTable", query: i.personName, limit: 5 },
  ];
  return { company, person };
}

const NUMBER: ReadonlyMap<ComponentType, number> = new Map(COMPONENT_CATALOG.map((c, idx) => [c.type, idx + 1]));

function toItem(c: ViewComponent): ShowcaseItem {
  const entry = COMPONENT_CATALOG.find((e) => e.type === c.type)!;
  const r = entry.register;
  return {
    n: NUMBER.get(c.type)!,
    type: c.type,
    title: entry.title,
    formaal: r?.formaal ?? "",
    kraeverData: r?.kraeverData ?? [],
    live: r?.live ?? "",
    ...(r?.liveNote ? { liveNote: r.liveNote } : {}),
    component: c,
  };
}

/** Fanerne med validerede komponenter (componentSchema) i nummerorden. */
export function showcaseTabs(i: ShowcaseInput): ShowcaseTab[] {
  const parse = (c: unknown): ViewComponent => componentSchema.parse(c);
  const { company, person } = showcaseComponents(i);
  const items = (cs: C[]) => cs.map((c) => toItem(parse(c))).sort((a, b) => a.n - b.n);
  return [
    { id: "virksomhed", label: i.companyName, entity: i.company, items: items(company) },
    { id: "person", label: i.personName, entity: i.person, items: items(person) },
  ];
}
