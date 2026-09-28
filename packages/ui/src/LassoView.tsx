import { useEffect, useState } from "react";
import {
  changeFeedKey,
  companyFactOptions,
  emptyDataset,
  entityRefOf,
  FOCUS_LABELS,
  isPersonId,
  PERSON_FOCUS_LABELS,
  personFactOptions,
  riskTimeline,
  sameAddress,
  savedPagesKey,
  searchKey,
  personSearchKey,
  widthOf,
  type Dataset,
  type Focus,
  type PersonFocus,
  type ViewComponent,
  type ViewSpec,
  type Width,
  ownershipGraphKey,
} from "@lasso/spec";
import { FollowUps } from "./components/FollowUps.js";
import { LassoMark } from "./LassoMark.js";
import { CompanyHead } from "./components/CompanyHead.js";
import { CompanyTable } from "./components/CompanyTable.js";
import { CompareTable } from "./components/CompareTable.js";
import { PersonTable } from "./components/PersonTable.js";
import { ProductionUnits } from "./components/ProductionUnits.js";
import { Properties } from "./components/Properties.js";
import { Livestock } from "./components/Livestock.js";
import { FilterPanel } from "./components/FilterPanel.js";
import { BarChart } from "./components/BarChart.js";
import { GroupedBarChart } from "./components/GroupedBarChart.js";
import { StackedBarChart } from "./components/StackedBarChart.js";
import { LineChart } from "./components/LineChart.js";
import { WaterfallChart } from "./components/WaterfallChart.js";
import { ShareBars } from "./components/ShareBars.js";
import { Ranking } from "./components/Ranking.js";
import { KeyFigureCards } from "./components/KeyFigureCards.js";
import { KeyValueList } from "./components/KeyValueList.js";
import { LassoContact } from "./components/LassoContact.js";
import { LassoContactPersons } from "./components/LassoContactPersons.js";
import { MultiYearTable } from "./components/MultiYearTable.js";
import { LassoIncomeStatement } from "./components/IncomeStatement.js";
import { LassoBalanceSheet } from "./components/BalanceSheet.js";
import { LassoCashFlow } from "./components/CashFlow.js";
import { OwnerList } from "./components/OwnerList.js";
import { OwnershipDiagram } from "./components/OwnershipDiagram.js";
import { PersonList } from "./components/PersonList.js";
import { ScoreGauge } from "./components/ScoreGauge.js";
import { LassoRelations } from "./components/LassoRelations.js";
import { LassoBeneficialOwners } from "./components/LassoBeneficialOwners.js";
import { LassoTextSections } from "./components/LassoTextSections.js";
import { LassoSummary } from "./components/LassoSummary.js";
import { LassoTimeline } from "./components/LassoTimeline.js";
import { LassoNews } from "./components/LassoNews.js";
import { PersonHead } from "./components/PersonHead.js";
import { PersonRoles } from "./components/PersonRoles.js";
import { PersonNetwork } from "./components/PersonNetwork.js";
import { PersonRisk } from "./components/PersonRisk.js";
import { PersonFacts } from "./components/PersonFacts.js";
import { CreditRating } from "./components/CreditRating.js";
import { AuditorIndependence } from "./components/AuditorIndependence.js";
import { ChangeFeed } from "./components/ChangeFeed.js";
import { SavedPages } from "./components/SavedPages.js";
import { ShellIcon } from "./components/ShellIcons.js";
import { ReportA4 } from "./components/ReportA4.js";
import { specToCsv } from "./csv.js";
import { Badge, Skeleton } from "./primitives.js";
import { SaveDialog } from "./SaveDialog.js";
import { ToastProvider, Toasts, useHasToastProvider, useToast, type ToastOptions } from "./components/Toast.js";
import type { ActionResult, LassoViewProps, ViewAction } from "./types.js";

function formatStamp(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `Data hentet ${d.toLocaleDateString("da-DK", { day: "numeric", month: "short", year: "numeric" })} kl. ${d.toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" })}`;
}

function renderComponent(c: ViewComponent, ds: Dataset | null, props: LassoViewProps, act: (a: ViewAction) => void, key: number) {
  const empty: Dataset = ds ?? emptyDataset("live");
  const err = (k: string) => empty.errors[k];
  switch (c.type) {
    case "LassoCompanyHead":
      return <CompanyHead key={key} company={empty.companies[c.company]} error={err(`company:${c.company}`)} />;
    case "LassoKeyFigureCards":
      return <KeyFigureCards key={key} financials={empty.financials[c.company]} metrics={c.metrics} error={err(`financials:${c.company}`)} />;
    case "LassoBarChart":
      return <BarChart key={key} financials={empty.financials[c.company]} metric={c.metric} years={c.years} error={err(`financials:${c.company}`)} />;
    case "LassoGroupedBarChart":
      return <GroupedBarChart key={key} financials={empty.financials[c.company]} metrics={c.metrics} years={c.years} error={err(`financials:${c.company}`)} />;
    case "LassoStackedBarChart":
      return <StackedBarChart key={key} financials={empty.financials[c.company]} years={c.years} error={err(`financials:${c.company}`)} />;
    case "LassoLineChart":
      return (
        <LineChart
          key={key}
          financials={empty.financials[c.company]}
          metric={c.metric}
          years={c.years}
          error={err(`financials:${c.company}`)}
          benchmarkFinancials={c.benchmark ? empty.financials[c.benchmark] : undefined}
          benchmarkName={c.benchmark ? empty.companies[c.benchmark]?.name : undefined}
          benchmarkError={c.benchmark ? err(`financials:${c.benchmark}`) : undefined}
        />
      );
    case "LassoWaterfallChart":
      return <WaterfallChart key={key} financials={empty.financials[c.company]} error={err(`financials:${c.company}`)} />;
    case "LassoShareBars":
      return <ShareBars key={key} financials={empty.financials[c.company]} error={err(`financials:${c.company}`)} />;
    case "LassoRanking":
      return (
        <Ranking
          key={key}
          rows={c.companies.map((id) => ({ lassoId: id, company: empty.companies[id], financials: empty.financials[id], error: err(`financials:${id}`) }))}
          metric={c.metric}
          title={c.title}
        />
      );
    case "LassoPersonList":
      return <PersonList key={key} people={empty.people[c.company]} show={c.show} title={c.title} error={err(`people:${c.company}`)} onOpen={props.host.drillDown ? act : undefined} />;
    case "LassoOwnerList":
      return <OwnerList key={key} ownership={empty.ownership[c.company]} error={err(`ownership:${c.company}`)} onOpen={props.host.drillDown ? act : undefined} />;
    case "LassoOwnershipDiagram": {
      const k = ownershipGraphKey(c);
      return <OwnershipDiagram key={key} graph={empty.ownershipGraphs?.[k]} error={err(`graph:${k}`)} title={c.title} onAction={act} canDrillDown={Boolean(props.host.drillDown)} canPrompt={Boolean(props.host.prompt)} canFullscreen={Boolean(props.host.fullscreen)} />;
    }
    case "LassoCompanyTable": {
      const k = searchKey(c.search);
      return (
        <CompanyTable
          key={key}
          result={empty.searches[k]}
          columns={c.columns}
          title={c.title}
          error={err(`search:${k}`)}
          onAction={act}
          canDrillDown={Boolean(props.host.drillDown)}
          criteria={c.search.criteria}
          onApplyCriteria={props.host.refine ? (criteria) => act({ kind: "set-criteria", criteria }) : undefined}
          canExport={Boolean(props.host.export)}
          canPrompt={Boolean(props.host.prompt)}
          canSavePage={Boolean(props.host.savePage)}
          onRetry={props.host.refresh ? () => act({ kind: "refresh" }) : undefined}
        />
      );
    }
    case "LassoPersonTable": {
      const k = personSearchKey(c);
      return (
        <PersonTable
          key={key}
          result={empty.personSearches?.[k]}
          title={c.title}
          error={err(`personSearch:${k}`)}
          onAction={act}
          canDrillDown={Boolean(props.host.drillDown)}
          onRetry={props.host.refresh ? () => act({ kind: "refresh" }) : undefined}
        />
      );
    }
    case "LassoCompareTable":
      return <CompareTable key={key} companies={c.companies} metrics={c.metrics} title={c.title} dataset={empty} onAction={act} canDrillDown={Boolean(props.host.drillDown)} canAdd={Boolean(props.host.prompt)} />;
    case "LassoKeyValueList": {
      // Det, hovedet, kontaktblokken og ejerlisten viser på samme side, gentages ikke (companyFacts).
      const page = companyFactOptions(props.spec.components, c.company);
      return (
        <KeyValueList
          key={key}
          company={empty.companies[c.company]}
          ownership={empty.ownership[c.company]}
          financials={empty.financials[c.company]}
          variant={c.variant}
          title={c.title}
          error={c.variant === "financials" ? err(`financials:${c.company}`) : err(`company:${c.company}`)}
          hideContact={page.hideContact}
          hideIdentity={page.hideIdentity}
          hideAuditor={page.hideAuditor}
          exclude={c.exclude}
          onOpen={props.host.drillDown ? act : undefined}
        />
      );
    }
    case "LassoContact": {
      // Adressen står i hovedet; kontaktblokken viser den kun, når den er en anden (fx fra hjemmesiden).
      const contact = empty.contact[c.company];
      const headOnPage = props.spec.components.some((x) => x.type === "LassoCompanyHead" && x.company === c.company);
      const omitAddress = headOnPage && sameAddress(contact?.address, empty.companies[c.company]?.address);
      return <LassoContact key={key} contact={contact} title={c.title} error={err(`contact:${c.company}`)} omitAddress={omitAddress} />;
    }
    case "LassoContactPersons":
      return <LassoContactPersons key={key} data={empty.contactPersons[c.company]} title={c.title} error={err(`contactPersons:${c.company}`)} />;
    case "LassoMultiYearTable":
      return <MultiYearTable key={key} financials={empty.financials[c.company]} metrics={c.metrics} years={c.years} title={c.title} error={err(`financials:${c.company}`)} />;
    case "LassoIncomeStatement":
      return <LassoIncomeStatement key={key} statements={empty.financialStatements[c.company]} company={empty.companies[c.company]} years={c.years} title={c.title} error={err(`financialStatements:${c.company}`)} />;
    case "LassoBalanceSheet":
      return <LassoBalanceSheet key={key} statements={empty.financialStatements[c.company]} company={empty.companies[c.company]} years={c.years} title={c.title} error={err(`financialStatements:${c.company}`)} />;
    case "LassoCashFlow":
      return <LassoCashFlow key={key} statements={empty.financialStatements[c.company]} years={c.years} title={c.title} error={err(`financialStatements:${c.company}`)} />;
    case "LassoScoreGauge":
      return <ScoreGauge key={key} score={empty.scores[c.company]} title={c.title} error={err(`score:${c.company}`)} />;
    case "LassoRiskObservations":
      // Fjernet fra visningerne 27.09.2026; ældre gemte visninger med komponenten viser den ikke.
      return null;
    case "LassoCreditRating":
      return <CreditRating key={key} rating={empty.creditRatings?.[c.company]} title={c.title} error={err(`creditRating:${c.company}`)} onAction={act} />;
    case "LassoAuditorIndependence":
      return <AuditorIndependence key={key} data={empty.auditorIndependence[c.company]} error={err(`auditorIndependence:${c.company}`)} title={c.title} onAction={act} canExport={Boolean(props.host.export)} />;
    case "LassoProductionUnits":
      return <ProductionUnits key={key} units={empty.productionUnits[c.company]} error={err(`productionUnits:${c.company}`)} />;
    case "LassoProperties":
      return <Properties key={key} properties={empty.properties[c.company]} title={c.title} error={err(`properties:${c.company}`)} />;
    case "LassoLivestock":
      return <Livestock key={key} livestock={empty.livestock[c.company]} error={err(`livestock:${c.company}`)} />;
    case "LassoFollowUps":
      return <FollowUps key={key} prompts={c.prompts} onAction={act} enabled={Boolean(props.host.prompt)} />;
    case "LassoRelations":
      return (
        <LassoRelations
          key={key}
          people={empty.people[c.company]}
          ownership={empty.ownership[c.company]}
          title={c.title}
          peopleError={err(`people:${c.company}`)}
          ownershipError={err(`ownership:${c.company}`)}
          onOpen={props.host.drillDown ? act : undefined}
        />
      );
    case "LassoBeneficialOwners":
      return (
        <LassoBeneficialOwners
          key={key}
          ownership={empty.beneficialOwnership[c.company]}
          error={err(`beneficialOwnership:${c.company}`)}
          onOpen={props.host.drillDown ? act : undefined}
        />
      );
    case "LassoTextSections":
      return <LassoTextSections key={key} sections={empty.textSections[c.company]} title={c.title} variant={c.variant} error={err(`textSections:${c.company}`)} onOpen={props.host.drillDown ? act : undefined} />;
    case "LassoSummary":
      return <LassoSummary key={key} text={c.text} title={c.title} source={c.source} updated={c.updated} />;
    case "LassoTimeline": {
      // Virksomhed eller person (katalog 16: personens historik med selskabsnavne, der kan åbnes).
      // filter 'risiko' (personens fokus risiko): kun forløbet i selskaberne med konkurs/tvangsopløsning.
      const k = entityRefOf(c);
      const all = empty.timeline[k];
      const person = c.person ? empty.persons[c.person] : undefined;
      const risk = c.filter === "risiko" && Boolean(c.person);
      return (
        <LassoTimeline
          key={key}
          timeline={risk && all ? (person ? riskTimeline(all, person) : undefined) : all}
          title={c.title}
          limit={c.limit}
          error={err(`timeline:${k}`) ?? (risk && c.person ? err(`person:${c.person}`) : undefined)}
          onOpen={props.host.drillDown ? act : undefined}
          emptyReason={
            risk ? "Ingen registrerede rolleskift i selskaberne med konkurs eller tvangsopløsning." : c.person ? "Der er ingen registrerede rolleskift for personen i CVR." : undefined
          }
        />
      );
    }
    case "LassoNews": {
      // Virksomhed eller person: sidens egen entitet står i fed i nyhederne og linker ikke til sig selv.
      const k = entityRefOf(c);
      const mention = c.person ? empty.persons[c.person]?.name : empty.companies[k]?.name;
      return (
        <LassoNews
          key={key}
          news={empty.news[k]}
          limit={c.limit}
          companyName={mention}
          companyId={k}
          error={err(`news:${k}`)}
          onOpen={props.host.drillDown ? act : undefined}
          emptyReason={c.person ? "Ingen nyheder om personen." : undefined}
        />
      );
    }
    case "LassoPersonHead":
      return <PersonHead key={key} person={empty.persons[c.person]} error={err(`person:${c.person}`)} />;
    case "LassoPersonRoles":
      return (
        <PersonRoles
          key={key}
          person={empty.persons[c.person]}
          title={c.title}
          show={c.show}
          limit={c.limit}
          except={c.except}
          error={err(`person:${c.person}`)}
          onOpen={props.host.drillDown ? act : undefined}
        />
      );
    case "LassoPersonNetwork":
      return <PersonNetwork key={key} network={empty.personNetworks[c.person]} title={c.title} limit={c.limit} error={err(`personNetwork:${c.person}`)} onOpen={props.host.drillDown ? act : undefined} />;
    case "LassoPersonRisk":
      return <PersonRisk key={key} person={empty.persons[c.person]} title={c.title} error={err(`person:${c.person}`)} onOpen={props.host.drillDown ? act : undefined} />;
    case "LassoPersonFacts":
      // Det, personhovedet på samme side viser (antal roller, ejerskaber, første registrering), gentages ikke.
      return <PersonFacts key={key} person={empty.persons[c.person]} title={c.title} hideCounts={personFactOptions(props.spec.components, c.person).hideCounts} error={err(`person:${c.person}`)} />;
    case "LassoChangeFeed": {
      const k = changeFeedKey(c);
      return <ChangeFeed key={key} feed={empty.changeFeeds[k]} title={c.title} types={c.types} error={err(`changeFeed:${k}`)} onOpen={props.host.drillDown ? act : undefined} />;
    }
    case "LassoSavedPages": {
      // Gem-laget (docs/gem-lag.md). onAction direkte (ikke act), så et mislykket "Fjern" kan rulles tilbage.
      const k = savedPagesKey(c);
      return (
        <SavedPages
          key={key}
          list={empty.savedPages?.[k]}
          title={c.title}
          error={err(`savedPages:${k}`)}
          onAction={props.onAction}
          canDrillDown={Boolean(props.host.drillDown)}
          canRemove={Boolean(props.host.savePage)}
        />
      );
    }
  }
}

/**
 * Rækkefølge, når kolonnerne stables på mobil (review P2-3): tal og graf før oplysninger,
 * relationer, historik og nyheder, i stedet for kolonne 1 (lange navnelister) først.
 */
const MOBILE_ORDER: Partial<Record<ViewComponent["type"], number>> = {
  LassoSavedPages: 5,
  LassoCreditRating: 8,
  LassoBarChart: 10,
  LassoGroupedBarChart: 10,
  LassoLineChart: 10,
  LassoWaterfallChart: 12,
  LassoContact: 15,
  LassoContactPersons: 16,
  LassoKeyValueList: 20,
  LassoShareBars: 22,
  LassoTextSections: 25,
  LassoPersonList: 30,
  LassoOwnerList: 31,
  LassoRelations: 32,
  LassoBeneficialOwners: 33,
  LassoPersonFacts: 32,
  LassoPersonNetwork: 34,
  LassoPersonRisk: 35,
  LassoTimeline: 40,
  LassoNews: 50,
};
function mobileOrder(c: ViewComponent): number {
  return MOBILE_ORDER[c.type] ?? 30;
}

export type Indexed = { c: ViewComponent; i: number };
export type Band = { kind: "full"; item: Indexed } | { kind: "columns"; columns: Indexed[][] };

/**
 * Layout 'columns' (portalens virksomhedsside): komponenter uden kolonne står i fuld bredde;
 * sammenhængende komponenter med kolonne samles i ét bånd, hvor hver kolonne stabler sine
 * sektioner. Så efterlader en kort sektion aldrig et hul ved siden af en lang. Et lavere
 * kolonnenummer end forrige komponents starter et nyt bånd (personsiden: roller | stamoplysninger,
 * derunder netværk | risiko); komponisterne lægger ellers kolonnerne i stigende orden.
 */
export function columnBands(components: readonly ViewComponent[]): Band[] {
  const bands: Band[] = [];
  let lastCol = 0;
  components.forEach((c, i) => {
    const col = c.column;
    if (!col) {
      bands.push({ kind: "full", item: { c, i } });
      lastCol = 0;
      return;
    }
    let band = bands.at(-1);
    if (!band || band.kind !== "columns" || col < lastCol) {
      band = { kind: "columns", columns: [] };
      bands.push(band);
    }
    lastCol = col;
    while (band.columns.length < col) band.columns.push([]);
    band.columns[col - 1]!.push({ c, i });
  });
  return bands;
}

const WIDTH_FR: Record<Width, number> = { quarter: 1, half: 2, "three-quarters": 3, full: 4 };

/**
 * Kolonnernes forhold i et bånd ud fra bredden på første sektion i hver kolonne (fx ¾ + ¼ giver
 * 3fr 1fr). Mangler en bredde, eller er alle ens, deles båndet ligeligt som hidtil (undefined).
 */
export function bandTemplate(columns: readonly Indexed[][]): string | undefined {
  const widths = columns.map((col) => col[0]?.c.width);
  if (widths.length < 2 || widths.some((w) => !w) || widths.every((w) => w === widths[0])) return undefined;
  return widths.map((w) => `minmax(0, ${WIDTH_FR[w!]}fr)`).join(" ");
}

type SaveTarget = Extract<ViewAction, { kind: "save-page" }>;

/**
 * Gem-laget: den virksomhed eller person, en entitetsside handler om. Første komponent med
 * `company` (virksomhedsside) eller `person` (personside); navnet fra datasættet, ellers titlen.
 * focus sendes kun, når undertitlen er præcis et fokusnavn fra komponisten (composeCompany
 * sætter subtitle = FOCUS_LABELS[focus]); ellers udelades den.
 */
export function saveTarget(spec: ViewSpec, ds: Dataset | null): SaveTarget | null {
  if (spec.kind === "company") {
    const id = spec.components.map((c) => ("company" in c && typeof c.company === "string" ? c.company : undefined)).find(Boolean);
    if (!id) return null;
    const focus = (Object.entries(FOCUS_LABELS) as [Focus, string][]).find(([f, label]) => f !== "overblik" && label === spec.subtitle)?.[0];
    return { kind: "save-page", lassoId: id, pageKind: "company", name: ds?.companies[id]?.name ?? spec.title, ...(focus ? { focus } : {}) };
  }
  if (spec.kind === "person") {
    const id = spec.components.map((c) => ("person" in c && typeof c.person === "string" ? c.person : undefined)).find(Boolean);
    if (!isPersonId(id)) return null;
    // composePerson sætter subtitle = PERSON_FOCUS_LABELS[focus] uden for overblik.
    const focus = (Object.entries(PERSON_FOCUS_LABELS) as [PersonFocus, string][]).find(([f, label]) => f !== "overblik" && label === spec.subtitle)?.[0];
    return { kind: "save-page", lassoId: id, pageKind: "person", name: ds?.persons[id]?.name ?? spec.title, ...(focus ? { focus } : {}) };
  }
  return null;
}

/**
 * Gem/Gemt øverst til højre i hovedet (katalog 01, regel 21): lille ikonknap med bogmærke og ord.
 * Gemt = fyldt ikon og "Gemt" (aria-pressed), aldrig farvet fyld (regel 15). Klik skifter straks
 * (optimistisk) og rulles tilbage, hvis værten svarer med en fejl. Tilstanden følger datasættets
 * savedIds, når værten opdaterer det.
 */
function SavePageButton({
  target,
  saved: fromData,
  onAction,
  notify,
}: {
  target: SaveTarget;
  saved: boolean;
  onAction: LassoViewProps["onAction"];
  notify: (o: ToastOptions) => void;
}) {
  const [saved, setSaved] = useState(fromData);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!busy) setSaved(fromData);
    // Kun når værtens tilstand skifter; mens et klik venter på svar, bestemmer klikket.
  }, [fromData]);

  const run = async (want: boolean) => {
    setSaved(want);
    setBusy(true);
    let res: ActionResult | void;
    try {
      res = await onAction(want ? target : { kind: "remove-saved-page", lassoId: target.lassoId });
    } catch (e) {
      res = { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
    setBusy(false);
    if (res && !res.ok) {
      setSaved(!want);
      notify({ text: res.error, tone: "error", action: { label: "Prøv igen", onClick: () => void run(want) } });
      return;
    }
    notify({ text: want ? (res?.message ?? "Gemt på din liste") : "Fjernet fra din liste", tone: "ok" });
  };

  return (
    <button
      type="button"
      className="lasso-iconbtn lasso-frame__save"
      aria-pressed={saved}
      aria-busy={busy || undefined}
      title={saved ? "Fjern fra din liste" : "Gem på din liste"}
      onClick={() => {
        if (!busy) void run(!saved);
      }}
    >
      <ShellIcon name="bookmark" size={16} filled={saved} />
      <span>{saved ? "Gemt" : "Gem"}</span>
    </button>
  );
}

/**
 * Den faste ramme om alle visninger: header (logo, navn, datatidspunkt) ->
 * kriterie-chips -> indhold -> handlingsbjælke. Ens uanset indhold.
 */
export function LassoView(props: LassoViewProps) {
  // Beskeder (07) kræver en ToastProvider; står der ingen over visningen, pakker den sig selv ind.
  const provided = useHasToastProvider();
  if (provided) return <LassoViewInner {...props} />;
  return (
    <ToastProvider container={false}>
      <LassoViewInner {...props} ownToasts />
    </ToastProvider>
  );
}

function LassoViewInner(props: LassoViewProps & { ownToasts?: boolean }) {
  const { spec, dataset, host, onAction, url, theme, loading, savePrefix } = props;
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [savedUrl, setSavedUrl] = useState<string | undefined>(url);
  // "Gemt"-boksen vises kun lige efter en gemning i denne visning (ikke på en allerede delt side).
  const [justSaved, setJustSaved] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const act = (a: ViewAction) => void onAction(a);

  const unsupported = Object.values(dataset?.searches ?? {}).flatMap((s) => s.unsupportedCriteria ?? []);
  const csv = dataset ? specToCsv(spec, dataset) : null;
  const shareUrl = savedUrl ?? url;

  // Katalog 27: "Eksportér PDF" på en virksomhedsside viser A4-rapporten i en overlay med "Print" og "Luk".
  const [reportOpen, setReportOpen] = useState(false);
  const reportCompany = spec.kind === "company" ? spec.components.map((c) => ("company" in c && typeof c.company === "string" ? c.company : undefined)).find(Boolean) : undefined;
  const canReport = Boolean(host.export && dataset && reportCompany && dataset.companies[reportCompany]);

  // Beskeder nederst i midten (07). Uden provider: tekst i handlingsbjælken.
  const notify = (o: ToastOptions) => {
    if (toast.show(o) === null) {
      setNotice(o.text);
      setTimeout(() => setNotice(null), 2500);
    }
  };
  const copy = async (link: string) => {
    const res = await onAction({ kind: "copy-link", url: link });
    notify(res && !res.ok ? { text: res.error, tone: "error", action: { label: "Prøv igen", onClick: () => void copy(link) } } : { text: "Link kopieret", tone: "ok" });
  };

  // Gem-laget: Gem/Gemt i hovedet på virksomheds- og personsider, når værten kender brugeren.
  const target = host.savePage ? saveTarget(spec, dataset) : null;

  return (
    <div className="lasso-root" data-theme={theme ?? "light"}>
      <div className="lasso-frame">
        <header className="lasso-frame__header">
          {host.back ? (
            <button className="lasso-btn lasso-btn--ghost lasso-frame__back" onClick={() => act({ kind: "back" })} aria-label="Tilbage">
              ←
            </button>
          ) : (
            <LassoMark className="lasso-logo" />
          )}
          <div className="lasso-frame__titles">
            {spec.kind === "company" || spec.kind === "person" ? (
              <div className="lasso-frame__eyebrow">{spec.kind === "person" ? "Personprofil" : "Virksomhedsprofil"}</div>
            ) : (
              <h1 className="lasso-frame__title">{spec.title}</h1>
            )}
            <div className="lasso-frame__meta">
              {spec.subtitle ? <span>{spec.subtitle}</span> : null}
              <span>{loading ? "Henter data…" : formatStamp(dataset?.generatedAt)}</span>
              {dataset?.source === "demo" ? <Badge tone="demo">Demodata</Badge> : null}
            </div>
          </div>
          {target && dataset ? (
            <SavePageButton key={target.lassoId} target={target} saved={Boolean(dataset.savedIds?.includes(target.lassoId))} onAction={onAction} notify={notify} />
          ) : null}
        </header>

        {spec.criteria.length > 0 || (host.refine && spec.kind === "list") ? (
          // 26c.8: med en virksomhedstabel står filtrene i tabellens værktøjslinje og bundark på mobil.
          <div className={spec.components.some((c) => c.type === "LassoCompanyTable") ? "lasso-frame__filters lasso-frame__filters--table" : "lasso-frame__filters"}>
            <FilterPanel criteria={spec.criteria} editable={Boolean(host.refine)} onApply={(criteria) => act({ kind: "set-criteria", criteria })} />
          </div>
        ) : null}
        {unsupported.length > 0 ? <div className="lasso-notice">Kunne ikke anvendes endnu: {unsupported.join(", ")}</div> : null}

        {loading && !dataset ? (
          <Skeleton lines={4} height={240} />
        ) : (
          <main className={`lasso-content lasso-content--grid-4 lasso-content--${spec.layout}`}>
            {spec.layout === "columns"
              ? columnBands(spec.components).map((band, b) =>
                  band.kind === "full" ? (
                    <div key={`b${b}`} className="lasso-cell lasso-cell--full">
                      {renderComponent(band.item.c, dataset, props, act, band.item.i)}
                    </div>
                  ) : (
                    <div
                      key={`b${b}`}
                      className={`lasso-cell lasso-cell--full lasso-columns lasso-columns--${spec.columns ?? 3}${bandTemplate(band.columns) ? " lasso-columns--ratio" : ""}`}
                      style={bandTemplate(band.columns) ? { ["--lasso-columns-template" as string]: bandTemplate(band.columns) } : undefined}
                    >
                      {band.columns.map((col, k) => (
                        <div key={k} className="lasso-column">
                          {col.map(({ c, i }) => (
                            <div key={i} className="lasso-column__item" style={{ ["--lasso-mobile-order" as string]: mobileOrder(c) }}>
                              {renderComponent(c, dataset, props, act, i)}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  ),
                )
              : spec.components.map((c, i) => (
                  <div key={i} className={`lasso-cell lasso-cell--${widthOf(c, spec.layout)}`}>
                    {renderComponent(c, dataset, props, act, i)}
                  </div>
                ))}
          </main>
        )}

        {saving ? (
          <SaveDialog
            defaultName={spec.title}
            prefix={savePrefix ?? "…/v/"}
            onAction={onAction}
            onClose={(r) => {
              setSaving(false);
              if (r?.url) {
                setSavedUrl(r.url);
                setJustSaved(true);
              }
            }}
          />
        ) : null}
        {shareUrl && justSaved && !saving ? (
          <div className="lasso-saved" role="status">
            <span className="lasso-saved__check" aria-hidden="true">✓</span>
            <span>Visningen er gemt</span> <code>{shareUrl}</code>
            <button className="lasso-btn" onClick={() => void copy(shareUrl)}>Kopiér link</button>
            <button className="lasso-btn" onClick={() => act({ kind: "open-link", url: shareUrl })}>Vis i Lasso</button>
          </div>
        ) : null}

        <footer className="lasso-actionbar">
          {host.fullscreen ? (
            <button className="lasso-btn lasso-btn--ghost" onClick={() => act({ kind: "fullscreen" })} aria-label="Fuld skærm">
              ⤢<span className="lasso-btn__label--optional"> Fuld skærm</span>
            </button>
          ) : null}
          {host.refresh ? (
            <button className="lasso-btn lasso-btn--ghost" onClick={() => act({ kind: "refresh" })}>
              Opdatér
            </button>
          ) : null}
          <span className="lasso-actionbar__spacer" />
          {notice ? <span className="lasso-small lasso-muted" role="status">{notice}</span> : null}
          {host.export && csv ? (
            <button className="lasso-btn" onClick={() => act({ kind: "export", filename: `${spec.title.replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase()}.csv`, csv })}>
              Eksportér<span className="lasso-btn__label--optional"> CSV</span>
            </button>
          ) : null}
          {canReport ? (
            <button className="lasso-btn" onClick={() => setReportOpen(true)}>
              Eksportér<span className="lasso-btn__label--optional"> PDF</span>
            </button>
          ) : null}
          {shareUrl ? (
            <button className="lasso-btn" onClick={() => void copy(shareUrl)}>
              Del link
            </button>
          ) : null}
          {/* Én primær knap pr. område, yderst til højre (katalog 01). "Gem visning" = delbart link (save_view);
              Gem/Gemt i hovedet er gem-lagets personlige liste (save_page), så ordene holdes adskilt. */}
          {host.save ? (
            <button className="lasso-btn lasso-btn--primary" onClick={() => setSaving(true)} disabled={saving}>
              {shareUrl ? "Gem visning igen" : "Gem visning"}
            </button>
          ) : null}
        </footer>

        {props.ownToasts ? <Toasts /> : null}

        {reportOpen && dataset && reportCompany ? (
          <div className="lasso-a4-overlay" role="dialog" aria-label="Virksomhedsrapport">
            <div className="lasso-a4-toolbar">
              <span className="lasso-a4-toolbar__title">Virksomhedsrapport, {dataset.companies[reportCompany]?.name}</span>
              <button className="lasso-btn lasso-btn--primary" onClick={() => window.print()}>
                Print
              </button>
              <button className="lasso-btn" onClick={() => setReportOpen(false)}>
                Luk
              </button>
            </div>
            <ReportA4 company={reportCompany} dataset={dataset} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
