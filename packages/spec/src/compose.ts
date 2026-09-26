import type { Dataset, FinancialYear } from "./models.js";
import { METRIC_FIELD, viewSpecSchema, type Metric, type ViewComponent, type ViewSpec } from "./spec.js";

/**
 * Komponisten: skærmbilledet bygges EFTER data er hentet, ud fra datas faktiske form.
 * Modellen angiver kun hensigten (focus); formen vælges her, så samme spørgsmål giver
 * forskellige skærmbilleder for forskellige virksomheder (mange ejere -> tabel, få år ->
 * nøgle-værdi, ingen nyheder -> ingen nyhedssektion).
 *
 * Layoutet følger portalen (guide 23): hoved, risiko og nøgletal i fuld bredde øverst,
 * derunder 2-3 kolonner, der hver stabler deres sektioner uden huller.
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
}

/**
 * De komponenter, der skal hentes data til, før komponisten kan vælge form.
 * Specen bruges kun til at hente data (resolveSpec) og vises ikke.
 */
export function composeProbe(lassoId: string, focus: Focus = "overblik"): ViewSpec {
  const c = lassoId;
  const components: ViewComponent[] = [
    { type: "LassoCompanyHead", company: c },
    { type: "LassoKeyFigureCards", company: c },
    { type: "LassoPersonList", company: c, show: "all" },
    { type: "LassoOwnerList", company: c },
    { type: "LassoRiskObservations", company: c },
  ];
  if (focus === "overblik" || focus === "historik" || focus === "ledelse") components.push({ type: "LassoTimeline", company: c });
  if (focus === "overblik" || focus === "historik") components.push({ type: "LassoNews", company: c, limit: 5 });
  if (focus === "overblik") components.push({ type: "LassoTextSections", company: c });
  if (focus === "overblik" || focus === "kontakt") components.push({ type: "LassoContact", company: c });
  if (focus === "kontakt") components.push({ type: "LassoContactPersons", company: c });
  if (focus === "regnskab") components.push({ type: "LassoIncomeStatement", company: c });
  if (focus === "risiko") components.push({ type: "LassoAuditorIndependence", company: c });
  if (focus === "ejerskab") {
    components.push({ type: "LassoBeneficialOwners", company: c });
    components.push({ type: "LassoOwnershipDiagram", company: c, ingoingDepth: 3, outgoingDepth: 2 });
  }
  return viewSpecSchema.parse({ kind: "company", title: lassoId, layout: "stack", components });
}

interface FollowUpRule {
  label: string;
  prompt: string;
  needs?: (d: { fin: number; owners: number; people: number; statements: boolean }) => boolean;
}

/** Næste naturlige spørgsmål pr. focus: peger videre til de andre fokusvisninger. */
const FOLLOW_UPS: Record<Focus, FollowUpRule[]> = {
  overblik: [
    { label: "Økonomien", prompt: "Hvordan går det økonomisk for {navn}?", needs: (d) => d.fin > 0 },
    { label: "Ejere", prompt: "Hvem ejer {navn}?", needs: (d) => d.owners > 0 },
    { label: "Risiko", prompt: "Er der røde flag ved {navn}?" },
  ],
  oekonomi: [
    { label: "Fuldt regnskab", prompt: "Vis resultatopgørelse og balance for {navn}." },
    { label: "Risiko", prompt: "Er der røde flag ved {navn}?" },
    { label: "Ejere", prompt: "Hvem ejer {navn}?", needs: (d) => d.owners > 0 },
  ],
  regnskab: [
    { label: "Udvikling over år", prompt: "Hvordan har økonomien i {navn} udviklet sig over årene?" },
    { label: "Risiko", prompt: "Er der røde flag ved {navn}?" },
  ],
  ejerskab: [
    { label: "Ledelse", prompt: "Hvem sidder i ledelsen af {navn}?", needs: (d) => d.people > 0 },
    { label: "Økonomien", prompt: "Hvordan går det økonomisk for {navn}?", needs: (d) => d.fin > 0 },
  ],
  ledelse: [
    { label: "Ejere", prompt: "Hvem ejer {navn}?", needs: (d) => d.owners > 0 },
    { label: "Historik", prompt: "Hvad er der sket i {navn} for nylig?" },
  ],
  risiko: [
    { label: "Økonomien", prompt: "Hvordan går det økonomisk for {navn}?", needs: (d) => d.fin > 0 },
    { label: "Ejere", prompt: "Hvem ejer {navn}?", needs: (d) => d.owners > 0 },
  ],
  historik: [
    { label: "Overblik", prompt: "Giv mig et overblik over {navn}." },
    { label: "Ledelse", prompt: "Hvem sidder i ledelsen af {navn}?", needs: (d) => d.people > 0 },
  ],
  kontakt: [
    { label: "Overblik", prompt: "Giv mig et overblik over {navn}." },
    { label: "Ledelse", prompt: "Hvem sidder i ledelsen af {navn}?", needs: (d) => d.people > 0 },
  ],
};

/** År med et tal for nøgletallet, ældste først. */
function yearsWith(years: readonly FinancialYear[], m: Metric): FinancialYear[] {
  return years.filter((y) => typeof y[METRIC_FIELD[m]] === "number");
}

/** Det nøgletal, grafen skal vise: omsætning hvis den er oplyst, ellers bruttofortjeneste. */
function mainMetric(years: readonly FinancialYear[], wanted?: Metric): Metric {
  if (wanted) return wanted;
  return yearsWith(years, "omsaetning").length >= 2 ? "omsaetning" : "bruttofortjeneste";
}

export function composeCompany(lassoId: string, ds: Dataset, options: ComposeOptions = {}): ViewSpec {
  const focus = options.focus ?? "overblik";
  const years = options.years ?? (focus === "oekonomi" ? 10 : 5);
  const id = lassoId;
  const fin = ds.financials[id]?.years ?? [];
  const people = ds.people[id] ?? [];
  const owners = ds.ownership[id]?.owners ?? [];
  const obs = ds.observations[id]?.observations ?? [];
  const events = ds.timeline[id]?.events ?? [];
  const news = ds.news[id]?.items ?? [];
  const texts = ds.textSections[id]?.sections ?? [];
  const beneficial = ds.beneficialOwnership[id]?.owners ?? [];
  const contact = ds.contact[id];
  const hasContact = !!(contact && (contact.phone || contact.email || contact.website));
  const contactPeople = ds.contactPersons[id]?.people ?? [];
  const statements = ds.financialStatements[id];
  const auditor = ds.auditorIndependence?.[id];

  const metric = mainMetric(fin, options.chartMetric);
  const nYears = yearsWith(fin, metric).length;
  const hasProfit = yearsWith(fin, "resultat").length >= 3;
  const seriousRisk = obs.some((o) => o.severity >= 50);

  const top: ViewComponent[] = [{ type: "LassoCompanyHead", company: id }];
  const cols: ViewComponent[][] = [[], [], []];
  const bottom: ViewComponent[] = [];
  const put = (col: 1 | 2 | 3, c: ViewComponent) => cols[col - 1]!.push({ ...c, column: col } as ViewComponent);

  // Risiko står øverst, men kun når den er alvorlig, eller når brugeren spørger til risiko (guide 23).
  if (seriousRisk || focus === "risiko") top.push({ type: "LassoRiskObservations", company: id });
  if (fin.length > 0) {
    const metrics: Metric[] =
      focus === "oekonomi"
        ? [metric, "bruttofortjeneste", "resultat", "egenkapital", "ansatte"].filter((m, i, a) => a.indexOf(m) === i).slice(0, 5) as Metric[]
        : [metric, "resultat", "egenkapital", "ansatte"].filter((m, i, a) => a.indexOf(m) === i) as Metric[];
    top.push({ type: "LassoKeyFigureCards", company: id, metrics });
  }

  // Regnskabet får den form, antallet af år tillader: graf ved 3+ år, ellers alle tal for året.
  const finance = (): ViewComponent | null => {
    if (nYears >= 3 && hasProfit && focus === "oekonomi") return { type: "LassoGroupedBarChart", company: id, metrics: [metric, "resultat"], years };
    if (nYears >= 3) return { type: "LassoBarChart", company: id, metric, years };
    if (fin.length > 0) return { type: "LassoKeyValueList", company: id, variant: "financials", title: "Regnskab" };
    return null;
  };

  // Ejere: få ejere som liste, en koncern med selskaber som ejere også som diagram.
  const ownershipBlock = (col: 1 | 2 | 3) => {
    if (owners.length > 0 || ds.ownership[id]?.auditor) put(col, { type: "LassoOwnerList", company: id });
  };

  let columns: 2 | 3 = 3;
  switch (focus) {
    case "oekonomi": {
      columns = 2;
      const f = finance();
      if (f) put(1, f);
      // Vandfaldet viser vejen fra top til bund for seneste år; andelsbjælkerne balancens sammensætning.
      if (fin.length > 0) put(1, { type: "LassoWaterfallChart", company: id });
      if (fin.length > 0) put(2, { type: "LassoKeyValueList", company: id, variant: "financials", title: "Regnskab" });
      if (typeof fin.at(-1)?.equity === "number") put(2, { type: "LassoShareBars", company: id });
      if (nYears >= 4) bottom.push({ type: "LassoMultiYearTable", company: id, years: Math.min(years, 10) });
      break;
    }
    case "regnskab": {
      // Fuldt regnskab: resultatopgørelse og balance side om side, pengestrøm under, når den findes.
      columns = 2;
      put(1, { type: "LassoIncomeStatement", company: id, years: 3 });
      put(2, { type: "LassoBalanceSheet", company: id, years: 3 });
      if (statements?.cashFlow?.length) bottom.push({ type: "LassoCashFlow", company: id, years: 3 });
      break;
    }
    case "kontakt": {
      columns = 2;
      put(1, { type: "LassoContact", company: id });
      if (contactPeople.length > 0) put(1, { type: "LassoContactPersons", company: id });
      put(2, { type: "LassoKeyValueList", company: id, variant: "company", title: "Virksomhedsoplysninger" });
      break;
    }
    case "ejerskab": {
      columns = 2;
      ownershipBlock(1);
      if (beneficial.length > 0 || ds.beneficialOwnership[id]?.gaps?.length) put(2, { type: "LassoBeneficialOwners", company: id });
      else if (people.length > 0) put(2, { type: "LassoRelations", company: id });
      if (owners.some((o) => o.kind === "company")) bottom.push({ type: "LassoOwnershipDiagram", company: id, ingoingDepth: 3, outgoingDepth: 2 });
      break;
    }
    case "ledelse": {
      columns = 2;
      if (people.length > 0) put(1, { type: "LassoPersonList", company: id, show: "all" });
      if (events.length >= 3) put(2, { type: "LassoTimeline", company: id });
      ownershipBlock(2);
      break;
    }
    case "risiko": {
      columns = 2;
      put(1, { type: "LassoKeyValueList", company: id, variant: "company", title: "Virksomhedsoplysninger" });
      if (people.length > 0) put(1, { type: "LassoPersonList", company: id, show: "all" });
      if (events.length >= 3) put(2, { type: "LassoTimeline", company: id });
      else if (people.length || owners.length) put(2, { type: "LassoRelations", company: id });
      if (auditor) bottom.push({ type: "LassoAuditorIndependence", company: id });
      break;
    }
    case "historik": {
      columns = 2;
      if (events.length > 0) put(1, { type: "LassoTimeline", company: id });
      if (news.length > 0) put(2, { type: "LassoNews", company: id, limit: 5 });
      else if (fin.length > 0) {
        const f = finance();
        if (f) put(2, f);
      }
      break;
    }
    default: {
      // Overblik, som portalens virksomhedsside: relationer | profil | oplysninger og regnskab.
      if (people.length > 0 || owners.length > 0) put(1, { type: "LassoRelations", company: id });
      if (news.length > 0) put(1, { type: "LassoNews", company: id, limit: 3 });
      if (texts.length > 0) put(2, { type: "LassoTextSections", company: id, title: "Virksomhedsprofil" });
      if (events.length >= 3) put(2, { type: "LassoTimeline", company: id });
      if (hasContact) put(3, { type: "LassoContact", company: id });
      put(3, { type: "LassoKeyValueList", company: id, variant: "company", title: "Virksomhedsoplysninger" });
      const f = finance();
      if (f) put(3, f);
      // En tom kolonne må ikke efterlade et hul: gå ned på 2 kolonner.
      if (cols.filter((c) => c.length > 0).length < 3) columns = 2;
    }
  }

  const followUps = FOLLOW_UPS[focus]
    .filter((f) => f.needs === undefined || f.needs({ fin: fin.length, owners: owners.length, people: people.length, statements: !!statements }))
    .slice(0, 3)
    .map((f) => ({ label: f.label, prompt: f.prompt.replace("{navn}", options.name ?? lassoId) }));
  if (followUps.length > 0) bottom.push({ type: "LassoFollowUps", prompts: followUps });

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
