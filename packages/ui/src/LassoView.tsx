import { useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from "react";
import {
  activityHeatmapKey,
  businessResume,
  type TextSectionsVM,
  changeFeedKey,
  companyFactOptions,
  emptyDataset,
  entityRefOf,
  FOCUS_LABELS,
  isPersonId,
  PERSON_FOCUS_LABELS,
  personFactOptions,
  riskTimeline,
  savedPagesKey,
  searchKey,
  timelineKindsText,
  timelineOfKinds,
  personSearchKey,
  widthOf,
  ruleBoundComponents,
  WIDTH_COLUMNS,
  gridHeight,
  measuredHeight,
  packBands,
  reflowBands,
  widthOfColumns,
  contentMinWidthFn,
  type FlowBand,
  type MinWidthFn,
  originOf,
  type Dataset,
  type Focus,
  type PersonFocus,
  type ViewComponent,
  type ViewSpec,
  type Width,
  type ComponentGroup,
  COMPONENT_CATALOG,
  ownershipGraphKey,
  DEFAULT_SHORTCUT_TOOLS,
} from "@lasso/spec";
import type { HeadActionsProps } from "./components/HeadActions.js";
import type { MenuItem } from "./components/Menu.js";
import { Shortcuts, SHORTCUT_LABELS } from "./components/Shortcuts.js";
import { Tabs } from "./components/Tabs.js";
import { FollowUps } from "./components/FollowUps.js";
import { LassoWordmark } from "./LassoMark.js";
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
import { FinancialStatements } from "./components/FinancialStatements.js";
import { Announcements, Mergers, Publications } from "./components/CompanyEvents.js";
import { CompanyHistory, RelationsTable } from "./components/CompanyHistory.js";
import { Registration } from "./components/Registration.js";
import { OwnerList } from "./components/OwnerList.js";
import { OwnershipDiagram } from "./components/OwnershipDiagram.js";
import { PersonList } from "./components/PersonList.js";
import { ScoreGauge } from "./components/ScoreGauge.js";
import { KeyFigureGauge } from "./components/KeyFigureGauge.js";
import { Heatmap } from "./components/Heatmap.js";
import { CompanyMap } from "./components/CompanyMap.js";
import { LassoRelations } from "./components/LassoRelations.js";
import { LassoBeneficialOwners } from "./components/LassoBeneficialOwners.js";
import { ANALYSIS_DISCLAIMER, LassoTextSections } from "./components/LassoTextSections.js";
import { LassoSummary } from "./components/LassoSummary.js";
import { LassoTimeline } from "./components/LassoTimeline.js";
import { LassoNews } from "./components/LassoNews.js";
import { PersonHead } from "./components/PersonHead.js";
import { PersonRoles } from "./components/PersonRoles.js";
import { PersonNetwork } from "./components/PersonNetwork.js";
import { PersonRisk } from "./components/PersonRisk.js";
import { PersonFacts } from "./components/PersonFacts.js";
import { PersonStats } from "./components/PersonStats.js";
import { CreditRating } from "./components/CreditRating.js";
import { RiskObservations } from "./components/RiskObservations.js";
import { ChangeFeed } from "./components/ChangeFeed.js";
import { SavedPages } from "./components/SavedPages.js";
import { ShellIcon } from "./components/ShellIcons.js";
import { Icon } from "./components/Icon.js";
import { AnalysisReportA4, PersonReportA4, ReportA4 } from "./components/ReportA4.js";
import { personRolesCsv, specToCsv } from "./csv.js";
import { PdfButton } from "./PdfButton.js";
import { PrintCover, PrintMode } from "./print.js";
import { Badge, Skeleton, stateForError } from "./primitives.js";
import { Accordion, CardGrid } from "./components/Layout.js";
import { ModuleToolbar } from "./components/ModuleToolbar.js";
import { SaveDialog } from "./SaveDialog.js";
import { ToastProvider, Toasts, useHasToastProvider, useToast, type ToastOptions } from "./components/Toast.js";
import type { ActionResult, LassoViewProps, MoreInTab, ViewAction } from "./types.js";

/**
 * Smagsprøvens "Se alle … i <fane>" (specens `more`): åbner fanen via værten (open-focus), når den
 * kan skifte fane. Ellers (eller med 'expand') undefined, og "Se alle" folder ud på stedet.
 */
export function moreInTab(more: string | undefined, spec: ViewSpec, host: LassoViewProps["host"], act: (a: ViewAction) => void): MoreInTab | undefined {
  if (!more || more === "expand" || !host.openFocus) return undefined;
  const tab = spec.kind === "person" ? PERSON_FOCUS_LABELS[more as PersonFocus] : FOCUS_LABELS[more as Focus];
  return tab ? { tab, open: () => act({ kind: "open-focus", focus: more }) } : undefined;
}

/** Det, rammen giver elementerne: kopiering med besked og hovedets handlinger (08.1, 16.1). */
export interface FrameTools {
  copy: (text: string, what: "phone" | "email") => void;
  /** Gem/Gemt for sidens virksomhed/person (gem-laget), når værten kan gemme sider. */
  save?: { id: string; saved: boolean; busy: boolean; toggle: () => void };
  /** Overvåg/Overvåger for sidens virksomhed/person, når værten kan overvåge. */
  monitor?: { id: string; monitoring: boolean; busy: boolean; toggle: () => void };
  exportItems: MenuItem[];
  more: MenuItem[];
  /** 15.1 "Gem som liste": åbner gem-dialogen, når værten kan gemme visninger. */
  saveList?: () => void;
  /** 19.3 "Hent som PDF": åbner regnskabsanalysen som A4 (19.6) i rapportoverlayet, når værten kan eksportere. */
  analysisPdf?: (company: string) => void;
  /** MCP-rammen: "Vis i fuld skærm" midt i sidens hoved (skjult i fuld skærm). */
  fullscreenTop?: ReactNode;
  /** MCP-rammen: "Gem som PDF" helt til højre i sidens hoved. */
  pdfButton?: ReactNode;
}

/** Hvad rapportoverlayet viser (27): standard virksomhedsrapport, regnskabsanalysen (19.6) eller personrapporten (27.4). */
type ReportRequest = { kind: "company" } | { kind: "analysis"; company: string } | { kind: "person"; person: string };

function reportTitle(r: ReportRequest): string {
  return r.kind === "analysis" ? "Regnskabsanalyse" : r.kind === "person" ? "Personrapport" : "Virksomhedsrapport";
}

/**
 * En sektion på siden ("Se risiko", "Se historik", en genvej): open-section, når værten kan skifte
 * sektion (portalen), ellers en besked til modellen (MCP), ellers ingenting (linket skjules).
 */
function sectionAction(
  props: LassoViewProps,
  act: (a: ViewAction) => void,
  o: { lassoId: string; pageKind: "company" | "person"; section: string; name: string; label: string },
): (() => void) | undefined {
  if (props.host.openSection) return () => act({ kind: "open-section", lassoId: o.lassoId, pageKind: o.pageKind, section: o.section, name: o.name });
  if (props.host.prompt) return () => act({ kind: "prompt", prompt: `Vis ${o.label.toLowerCase()} for ${o.name}` });
  return undefined;
}

/** 08.7 (Paper L8F-0): genvejene Tvillinger og Nyheder i "Se alle"-panelets første kolonne, kun når værten kan åbne dem (G1). */
function contactPanelShortcuts(props: LassoViewProps, act: (a: ViewAction) => void, lassoId: string, name: string) {
  return (
    [
      { id: "tvillinger", label: "Tvillinger", icon: "users" as const },
      { id: "nyheder", label: "Nyheder", icon: "news" as const },
    ] as const
  ).flatMap((t) => {
    const run = sectionAction(props, act, { lassoId, pageKind: "company", section: t.id, name, label: t.label });
    return run ? [{ id: t.id, label: t.label, icon: t.icon, onSelect: run }] : [];
  });
}

/** 09.2/09.5: "Se alle" (hele regnskabet) som link med ikon under regnskabslisten, når værten kan åbne det. */
/** Portalens "Erhvervsresume" (TextSections variant "resume"): én tekst ud fra stamdata, historik, ledelse og regnskab. */
function resumeSections(company: string, ds: Dataset): TextSectionsVM | undefined {
  const co = ds.companies[company];
  if (!co) return undefined;
  const names = ds.companyHistories?.[company]?.fields.find((f) => f.key === "navn")?.entries ?? [];
  const firstName = names.length > 1 ? [...names].sort((a, b) => (a.from ?? "").localeCompare(b.from ?? ""))[0]?.value : undefined;
  const ceo = (ds.people[company] ?? []).find((p) => !p.to && /adm|direkt/i.test(p.role))?.name;
  const last = ds.financials[company]?.years.at(-1);
  const body = businessResume({
    name: co.name,
    founded: co.founded,
    city: co.address?.city,
    industryText: co.industryText,
    purpose: co.purpose,
    employees: co.employees,
    firstName,
    ceo,
    lastYear: last ? { year: last.year, grossProfit: last.grossProfit, revenue: last.revenue, profit: last.profit } : undefined,
  });
  return { lassoId: company, sections: body ? [{ heading: "", body }] : [] };
}

function statementsLink(company: string, ds: Dataset, props: LassoViewProps, act: (a: ViewAction) => void) {
  if (props.spec.components.some((x) => x.type === "LassoIncomeStatement")) return undefined;
  const run = sectionAction(props, act, { lassoId: company, pageKind: "company", section: "regnskab", name: ds.companies[company]?.name ?? company, label: "Regnskab" });
  // 09.5 (Jakob 29.09): linket hedder "Se alle".
  return run ? [{ label: "Se alle", icon: "document" as const, onClick: run }] : undefined;
}

/** Hovedets handlinger for én entitet: Gem og Overvåg kun for sidens egen virksomhed/person. */
function headActionsFor(id: string, name: string, frame: FrameTools): HeadActionsProps {
  return {
    monitor: frame.monitor?.id === id ? { monitoring: frame.monitor.monitoring, busy: frame.monitor.busy, onClick: frame.monitor.toggle } : undefined,
    save: frame.save?.id === id ? { saved: frame.save.saved, busy: frame.save.busy, onClick: frame.save.toggle } : undefined,
    exportItems: frame.exportItems,
    more: frame.more,
    context: { title: name },
    end:
      frame.fullscreenTop || frame.pdfButton ? (
        <>
          {frame.fullscreenTop}
          {frame.pdfButton}
        </>
      ) : undefined,
  };
}

/** Sektionsfaner (08.2) under hovedet, når værten giver dem (headTabs). */
function headTabsOf(props: LassoViewProps) {
  const t = props.headTabs;
  if (!t) return undefined;
  return <Tabs level={1} items={t.items} value={t.value} onChange={t.onChange} ariaLabel={t.ariaLabel ?? "Sektioner"} maxVisible={t.maxVisible} moreLabel={t.moreLabel} className="lasso-headtabs" />;
}

function CompanyHeadBridge({ c, ds, props, act, frame }: { c: Extract<ViewComponent, { type: "LassoCompanyHead" }>; ds: Dataset; props: LassoViewProps; act: (a: ViewAction) => void; frame: FrameTools }) {
  const company = ds.companies[c.company];
  const name = company?.name ?? c.company;
  const variant = c.variant ?? "full";
  const full = variant === "full";
  return (
    <CompanyHead
      company={company}
      error={ds.errors[`company:${c.company}`]}
      variant={variant}
      actions={full ? headActionsFor(c.company, name, frame) : frame.monitor?.id === c.company ? { monitor: { monitoring: frame.monitor.monitoring, busy: frame.monitor.busy, onClick: frame.monitor.toggle } } : undefined}
      risk={ds.observations[c.company]}
      onSeeRisk={sectionAction(props, act, { lassoId: c.company, pageKind: "company", section: "risiko", name, label: "Risiko" })}
      onHistory={sectionAction(props, act, { lassoId: c.company, pageKind: "company", section: "historik", name, label: "Historik" })}
      below={full ? headTabsOf(props) : undefined}
    />
  );
}

function PersonHeadBridge({ c, ds, props, act, frame }: { c: Extract<ViewComponent, { type: "LassoPersonHead" }>; ds: Dataset; props: LassoViewProps; act: (a: ViewAction) => void; frame: FrameTools }) {
  const person = ds.persons[c.person];
  const name = person?.name ?? c.person;
  const variant = c.variant ?? "full";
  const full = variant === "full";
  return (
    <PersonHead
      person={person}
      error={ds.errors[`person:${c.person}`]}
      variant={variant}
      actions={
        full
          ? { ...headActionsFor(c.person, name, frame), network: sectionAction(props, act, { lassoId: c.person, pageKind: "person", section: "netvaerk", name, label: "Netværk" }) }
          : frame.monitor?.id === c.person
            ? { monitor: { monitoring: frame.monitor.monitoring, busy: frame.monitor.busy, onClick: frame.monitor.toggle } }
            : undefined
      }
      onSeeRisk={sectionAction(props, act, { lassoId: c.person, pageKind: "person", section: "risiko", name, label: "Risiko" })}
      riskLine={Boolean(props.page)}
      below={full ? headTabsOf(props) : undefined}
    />
  );
}

function renderComponent(c: ViewComponent, ds: Dataset | null, props: LassoViewProps, act: (a: ViewAction) => void, key: number, frame: FrameTools) {
  const empty: Dataset = ds ?? emptyDataset("live");
  const err = (k: string) => empty.errors[k];
  const moreIn = (more: string | undefined) => moreInTab(more, props.spec, props.host, act);
  switch (c.type) {
    case "LassoCompanyHead":
      return <CompanyHeadBridge key={key} c={c} ds={empty} props={props} act={act} frame={frame} />;
    case "LassoKeyFigureCards":
      return <KeyFigureCards key={key} financials={empty.financials[c.company]} metrics={c.metrics} plain={c.variant === "plain" || Boolean(props.page)} employeesNow={empty.companies[c.company]?.employees} error={err(`financials:${c.company}`)} />;
    case "LassoBarChart":
      return <BarChart key={key} financials={empty.financials[c.company]} metric={c.metric} years={c.years} error={err(`financials:${c.company}`)} />;
    case "LassoGroupedBarChart":
      return <GroupedBarChart key={key} financials={empty.financials[c.company]} metrics={c.metrics} years={c.years} error={err(`financials:${c.company}`)} />;
    case "LassoStackedBarChart":
      return <StackedBarChart key={key} financials={empty.financials[c.company]} statements={empty.financialStatements[c.company]} years={c.years} error={err(`financials:${c.company}`)} />;
    case "LassoLineChart":
      return (
        <LineChart
          key={key}
          financials={empty.financials[c.company]}
          metric={c.metric}
          years={c.years}
          error={err(`financials:${c.company}`)}
          benchmarkFinancials={c.benchmark && !c.industry ? empty.financials[c.benchmark] : undefined}
          companyName={empty.companies[c.company]?.name}
          benchmarkName={c.benchmark ? empty.companies[c.benchmark]?.name : undefined}
          benchmarkError={c.benchmark && !c.industry ? err(`financials:${c.benchmark}`) : undefined}
          industry={c.industry ? empty.industryBenchmarks?.[c.company] : undefined}
          industryError={c.industry ? err(`industryBenchmark:${c.company}`) : undefined}
        />
      );
    case "LassoWaterfallChart":
      return <WaterfallChart key={key} financials={empty.financials[c.company]} statements={empty.financialStatements[c.company]} error={err(`financials:${c.company}`)} />;
    case "LassoShareBars":
      return c.variant === "ejerkreds" ? (
        <ShareBars key={key} variant="ejerkreds" ownership={empty.ownership[c.company]} error={err(`ownership:${c.company}`)} />
      ) : (
        <ShareBars key={key} financials={empty.financials[c.company]} error={err(`financials:${c.company}`)} />
      );
    case "LassoKeyFigureGauge":
      return (
        <KeyFigureGauge
          key={key}
          financials={empty.financials[c.company]}
          industry={empty.industryBenchmarks?.[c.company]}
          metrics={c.metrics}
          title={c.title}
          error={err(`financials:${c.company}`)}
          industryError={err(`industryBenchmark:${c.company}`)}
        />
      );
    case "LassoHeatmap": {
      const k = activityHeatmapKey(c);
      return <Heatmap key={key} heatmap={empty.activityHeatmaps?.[k]} title={c.title} error={err(`activityHeatmap:${k}`)} />;
    }
    case "LassoMap":
      return <CompanyMap key={key} map={empty.maps?.[c.company]} title={c.title} error={err(`mapPoints:${c.company}`)} onAction={props.host.drillDown ? act : undefined} />;
    case "LassoRanking":
      return (
        <Ranking
          key={key}
          rows={c.companies.map((id) => ({ lassoId: id, company: empty.companies[id], financials: empty.financials[id], error: err(`financials:${id}`) }))}
          metric={c.metric}
          order={c.order}
          top={c.top}
          title={c.title}
        />
      );
    case "LassoPersonList":
      return <PersonList key={key} people={empty.people[c.company]} show={c.show} roles={c.roles} title={c.title} error={err(`people:${c.company}`)} onOpen={props.host.drillDown ? act : undefined} />;
    case "LassoOwnerList":
      return <OwnerList key={key} ownership={empty.ownership[c.company]} error={err(`ownership:${c.company}`)} onOpen={props.host.drillDown ? act : undefined} />;
    case "LassoOwnershipDiagram": {
      const k = ownershipGraphKey(c);
      return <OwnershipDiagram key={key} graph={empty.ownershipGraphs?.[k]} error={err(`graph:${k}`)} title={c.title} onAction={act} canDrillDown={Boolean(props.host.drillDown)} canPrompt={Boolean(props.host.prompt)} canFullscreen={Boolean(props.host.fullscreen)} demo={empty.source === "demo"} />;
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
          initialSort={c.search.sort}
          onSaveList={frame.saveList}
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
      return (
        <CompareTable
          key={key}
          companies={c.companies}
          metrics={c.metrics}
          title={c.title}
          dataset={empty}
          onAction={act}
          canDrillDown={Boolean(props.host.drillDown)}
          canAdd={Boolean(props.host.prompt)}
        />
      );
    case "LassoKeyValueList": {
      // Det, hovedet, kontaktblokken og ejerlisten viser på samme side, gentages ikke (companyFacts).
      const page = companyFactOptions(props.spec.components, c.company);
      return (
        <KeyValueList
          key={key}
          company={empty.companies[c.company]}
          ownership={empty.ownership[c.company]}
          financials={empty.financials[c.company]}
          valuation={empty.valuations?.[c.company]}
          variant={c.variant}
          title={c.title}
          error={c.variant === "financials" ? err(`financials:${c.company}`) : err(`company:${c.company}`)}
          hideContact={page.hideContact}
          hideIdentity={page.hideIdentity}
          hideAuditor={page.hideAuditor}
          exclude={c.exclude}
          only={c.only}
          year={c.year}
          rows={c.rows}
          onOpen={props.host.drillDown ? act : undefined}
          links={c.variant === "financials" && !c.maxRows && c.view !== "short" ? statementsLink(c.company, empty, props, act) : undefined}
          years={c.years}
          maxRows={c.maxRows}
          view={c.view}
          look={c.look}
          contact={empty.contact[c.company]}
          fields={c.fields}
          statements={empty.financialStatements[c.company]}
          onLink={(url) => act({ kind: "open-link", url })}
          onPdf={c.variant === "financials" && !c.fields?.includes("pdf") && empty.financialStatements[c.company]?.pdfUrl ? () => act({ kind: "open-link", url: empty.financialStatements[c.company]!.pdfUrl! }) : undefined}
        />
      );
    }
    case "LassoContact": {
      // G9 (Jakob 29.09): hovedet viser kun navnet, så kontaktblokken viser altid adressen.
      const contact = empty.contact[c.company];
      const omitAddress = false;
      return (
        <LassoContact
          key={key}
          contact={contact}
          title={c.title}
          error={err(`contact:${c.company}`)}
          omitAddress={omitAddress}
          onCopy={frame.copy}
          onOpenLink={(url) => act({ kind: "open-link", url })}
          onVerify={props.host.verifyContact ? () => props.onAction({ kind: "verify-contact", lassoId: c.company }) : undefined}
        />
      );
    }
    case "LassoContactPersons":
      return (
        <LassoContactPersons
          key={key}
          data={empty.contactPersons[c.company]}
          title={c.title}
          error={err(`contactPersons:${c.company}`)}
          companyName={empty.companies[c.company]?.name}
          company={empty.companies[c.company]}
          contact={empty.contact[c.company]}
          shortcuts={contactPanelShortcuts(props, act, c.company, empty.companies[c.company]?.name ?? c.company)}
          onLiveDetails={sectionAction(props, act, { lassoId: c.company, pageKind: "company", section: "kontakt", name: empty.companies[c.company]?.name ?? c.company, label: "Kontakt" })}
          onCopy={frame.copy}
          onOpenLink={(url) => act({ kind: "open-link", url })}
        />
      );
    case "LassoShortcuts": {
      const name = empty.companies[c.company]?.name ?? c.company;
      // Modul 5 (Jakob 01.10): kun de moduler, brugeren har adgang til (host.modules), når værten kender dem.
      const access = props.host.modules;
      const items = (c.tools ?? DEFAULT_SHORTCUT_TOOLS).filter((tool) => !access || access.includes(tool)).flatMap((tool) => {
        const meta = SHORTCUT_LABELS[tool];
        const run = sectionAction(props, act, { lassoId: c.company, pageKind: "company", section: tool, name, label: meta.label });
        return run ? [{ id: tool, label: meta.label, icon: meta.icon, onSelect: run }] : [];
      });
      return <Shortcuts key={key} items={items} title={c.title} />;
    }
    case "LassoMultiYearTable":
      return <MultiYearTable key={key} financials={empty.financials[c.company]} metrics={c.metrics} years={c.years} title={c.title} variant={c.variant} error={err(`financials:${c.company}`)} />;
    case "LassoIncomeStatement":
      return <LassoIncomeStatement key={key} statements={empty.financialStatements[c.company]} company={empty.companies[c.company]} years={c.years} title={c.title} error={err(`financialStatements:${c.company}`)} />;
    case "LassoBalanceSheet":
      return <LassoBalanceSheet key={key} statements={empty.financialStatements[c.company]} company={empty.companies[c.company]} years={c.years} title={c.title} error={err(`financialStatements:${c.company}`)} />;
    case "LassoCashFlow":
      return <LassoCashFlow key={key} statements={empty.financialStatements[c.company]} years={c.years} title={c.title} error={err(`financialStatements:${c.company}`)} />;
    case "LassoMergers":
      return <Mergers key={key} events={empty.companyEvents?.[c.company]} company={empty.companies[c.company]} title={c.title} error={err(`companyEvents:${c.company}`)} demo={empty.source === "demo"} onOpen={props.host.drillDown ? act : undefined} />;
    case "LassoRegistration":
      return (
        <Registration
          key={key}
          company={empty.companies[c.company]}
          ownership={empty.ownership[c.company]}
          financials={empty.financials[c.company]}
          texts={empty.textSections[c.company]}
          variant={c.variant}
          title={c.title}
          error={err(`company:${c.company}`)}
        />
      );
    case "LassoRelationsTable":
      return <RelationsTable key={key} history={empty.companyHistories?.[c.company]} beneficial={empty.beneficialOwnership[c.company]} show={c.show} groups={c.groups} title={c.title} error={err(`companyHistory:${c.company}`)} onOpen={props.host.drillDown ? act : undefined} />;
    case "LassoCompanyHistory":
      return <CompanyHistory key={key} history={empty.companyHistories?.[c.company]} fields={c.fields} limit={c.limit} title={c.title} error={err(`companyHistory:${c.company}`)} />;
    case "LassoAnnouncements":
      return <Announcements key={key} events={empty.companyEvents?.[c.company]} company={empty.companies[c.company]} demo={empty.source === "demo"} title={c.title} error={err(`companyEvents:${c.company}`)} onLink={(url) => act({ kind: "open-link", url })} />;
    case "LassoPublications":
      return <Publications key={key} events={empty.companyEvents?.[c.company]} title={c.title} limit={c.limit} error={err(`companyEvents:${c.company}`)} onLink={(url) => act({ kind: "open-link", url })} />;
    case "LassoFinancialStatements":
      return <FinancialStatements key={key} statements={empty.financialStatements[c.company]} company={empty.companies[c.company]} statement={c.statement} years={c.years} year={c.year} title={c.title} error={err(`financialStatements:${c.company}`)} onAction={act} canPrint={Boolean(props.host.pdf)} />;
    case "LassoScoreGauge":
      return (
        <ScoreGauge
          key={key}
          score={empty.scores[c.company]}
          title={c.title}
          detail={c.detail}
          error={err(`score:${c.company}`)}
          onFetch={props.host.refresh ? () => act({ kind: "refresh" }) : undefined}
          // 18.1: "Se observationer" åbner risikosektionen, når værten kan (G1: ellers intet link).
          onObservations={sectionAction(props, act, { lassoId: c.company, pageKind: "company", section: "risiko", name: empty.companies[c.company]?.name ?? c.company, label: "Risikoobservationer" })}
        />
      );
    case "LassoRiskObservations":
      // Katalog 17.2: komponeres ikke automatisk (observationskaldet tager 10–14 s), men vises, når en spec beder om den.
      return <RiskObservations key={key} data={empty.observations[c.company]} error={err(`observations:${c.company}`)} title={c.title} compact={c.compact} demo={empty.source === "demo"} onAction={act} />;
    case "LassoCreditRating":
      return <CreditRating key={key} rating={empty.creditRatings?.[c.company]} title={c.title} error={err(`creditRating:${c.company}`)} onAction={act} />;
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
          // 11.1: låst række, når reelle ejere kræver adgang; tællerrække, når produktionsenhederne er hentet.
          beneficialLocked={Boolean(err(`beneficialOwnership:${c.company}`)) && stateForError(err(`beneficialOwnership:${c.company}`)) === "noaccess"}
          onBeneficialInfo={props.host.prompt ? () => act({ kind: "prompt", prompt: "Hvad kræver det at se reelle ejere i Lasso?" }) : undefined}
          productionUnits={empty.productionUnits[c.company] ? (empty.productionUnits[c.company]!.total ?? empty.productionUnits[c.company]!.units.length) : undefined}
          onProductionUnits={props.host.prompt ? () => act({ kind: "prompt", prompt: `Vis produktionsenhederne for ${empty.companies[c.company]?.name ?? c.company}` }) : undefined}
          units={empty.productionUnits[c.company]?.units}
        />
      );
    case "LassoBeneficialOwners":
      return (
        <LassoBeneficialOwners
          key={key}
          ownership={empty.beneficialOwnership[c.company]}
          error={err(`beneficialOwnership:${c.company}`)}
          onOpen={props.host.drillDown ? act : undefined}
          onDiagram={
            props.spec.components.some((x) => x.type === "LassoOwnershipDiagram")
              ? undefined
              : sectionAction(props, act, { lassoId: c.company, pageKind: "company", section: "ejerskab", name: empty.companies[c.company]?.name ?? c.company, label: "Ejerdiagram" })
          }
        />
      );
    case "LassoTextSections":
      return (
        <LassoTextSections
          key={key}
          sections={c.variant === "resume" ? resumeSections(c.company, empty) : empty.textSections[c.company]}
          title={c.title}
          variant={c.variant}
          folded={c.folded}
          limit={c.limit}
          error={err(`textSections:${c.company}`)}
          onOpen={props.host.drillDown ? act : undefined}
          // 19.3: "Hent som PDF" (19.6) kun, når værten kan eksportere (G1).
          onPdf={frame.analysisPdf ? () => frame.analysisPdf!(c.company) : undefined}
        />
      );
    case "LassoSummary": {
      // Lassos erhvervsresumé (resume = Lasso-ID, Jakob 02.10) eller modellens egen tekst.
      if (c.resume) {
        const r = empty.resumes?.[c.resume];
        if (!r) return err(`resume:${c.resume}`) ? null : <LassoSummary key={key} text="" title={c.title ?? "Erhvervsresumé"} loading />;
        if (r.state !== "ok" || !r.content) return null;
        return <LassoSummary key={key} text={r.content} title={c.title ?? "Erhvervsresumé"} onOpen={props.host.drillDown ? act : undefined} />;
      }
      return c.text ? <LassoSummary key={key} text={c.text} title={c.title} source={c.source} updated={c.updated} onOpen={props.host.drillDown ? act : undefined} /> : null;
    }
    case "LassoTimeline": {
      // Virksomhed eller person (katalog 16: personens historik med selskabsnavne, der kan åbnes).
      // filter 'risiko' (personens fokus risiko): kun forløbet i selskaberne med konkurs/tvangsopløsning.
      // kinds (virksomhed): kun ledelses-, regnskabs-, status- … begivenheder, med titel og tom tilstand derefter.
      const k = entityRefOf(c);
      const all = empty.timeline[k];
      const person = c.person ? empty.persons[c.person] : undefined;
      const risk = c.filter === "risiko" && Boolean(c.person);
      const kinds = c.kinds?.length && !c.person ? timelineKindsText(c.kinds) : undefined;
      return (
        <LassoTimeline
          key={key}
          timeline={risk && all ? (person ? riskTimeline(all, person) : undefined) : all && kinds ? timelineOfKinds(all, c.kinds) : all}
          title={c.title ?? kinds?.title}
          limit={c.limit}
          moreIn={moreIn(c.more)}
          filterColumn={c.filterColumn}
          onLink={(url) => act({ kind: "open-link", url })}
          error={err(`timeline:${k}`) ?? (risk && c.person ? err(`person:${c.person}`) : undefined)}
          onOpen={props.host.drillDown ? act : undefined}
          emptyReason={
            risk
              ? "Ingen registrerede rolleskift i selskaberne med konkurs eller tvangsopløsning."
              : c.person
                ? "Der er ingen registrerede rolleskift for personen i CVR."
                : kinds?.empty
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
          moreIn={moreIn(c.more)}
          layout={c.layout}
          companyName={mention}
          companyId={k}
          error={err(`news:${k}`)}
          onOpen={props.host.drillDown ? act : undefined}
          onLink={(url) => act({ kind: "open-link", url })}
          onUpgrade={props.host.prompt ? () => act({ kind: "prompt", prompt: "Hvilke Lasso-pakker giver adgang til alle nyheder om virksomheden?" }) : undefined}
          emptyReason={c.person ? "Ingen nyheder om personen." : undefined}
        />
      );
    }
    case "LassoPersonHead":
      return <PersonHeadBridge key={key} c={c} ds={empty} props={props} act={act} frame={frame} />;
    case "LassoPersonRoles":
      return (
        <PersonRoles
          key={key}
          person={empty.persons[c.person]}
          title={c.title}
          show={c.show}
          limit={c.limit}
          moreIn={moreIn(c.more)}
          except={c.except}
          role={c.role}
          error={err(`person:${c.person}`)}
          onOpen={props.host.drillDown ? act : undefined}
        />
      );
    case "LassoPersonNetwork":
      return (
        <PersonNetwork
          key={key}
          network={empty.personNetworks[c.person]}
          title={c.title}
          limit={c.limit}
          moreIn={moreIn(c.more)}
          error={err(`personNetwork:${c.person}`)}
          onOpen={props.host.drillDown ? act : undefined}
          onGraph={sectionAction(props, act, { lassoId: c.person, pageKind: "person", section: "netvaerk", name: empty.persons[c.person]?.name ?? c.person, label: "Netværk" })}
        />
      );
    case "LassoPersonRisk":
      return (
        <PersonRisk
          key={key}
          person={empty.persons[c.person]}
          title={c.title}
          error={err(`person:${c.person}`)}
          onOpen={props.host.drillDown ? act : undefined}
          onUpgrade={props.host.prompt ? () => act({ kind: "prompt", prompt: "Hvilke Lasso-pakker giver adgang til tjek mod sanktionslister?" }) : undefined}
          lines={Boolean(props.page)}
        />
      );
    case "LassoPersonStats":
      return <PersonStats key={key} person={empty.persons[c.person]} network={empty.personNetworks[c.person]} error={err(`person:${c.person}`)} networkError={err(`personNetwork:${c.person}`)} />;
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
  LassoShortcuts: 17,
  LassoKeyValueList: 20,
  LassoShareBars: 22,
  LassoKeyFigureGauge: 11,
  LassoMap: 36,
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

/** En række i visningen: én komponent eller en gruppe (mønster 8/9) af sammenhængende komponenter. */
export type Run = { kind: "one"; item: Indexed } | { kind: "group"; group: ComponentGroup; items: Indexed[] };

/**
 * Mønster 8 (kortgitter) og 9 (harmonika), Paper 30: sammenhængende komponenter med samme
 * group.id samles i én række. Gruppens overskrift er første medlems group.title. En gruppe med
 * kun ét medlem tegnes som en almindelig komponent (en harmonika med én række giver ingen mening).
 */
export function groupRuns(items: readonly Indexed[]): Run[] {
  const runs: Run[] = [];
  for (const it of items) {
    const g = it.c.group;
    const last = runs.at(-1);
    if (g && last?.kind === "group" && last.group.id === g.id) {
      last.items.push(it);
      if (!last.group.title && g.title) last.group = { ...last.group, title: g.title };
    } else if (g) {
      runs.push({ kind: "group", group: g, items: [it] });
    } else {
      runs.push({ kind: "one", item: it });
    }
  }
  return runs.map((r) => (r.kind === "group" && r.items.length === 1 ? { kind: "one", item: r.items[0]! } : r));
}

/** Rækkenavn i harmonikaen: komponentens egen title, ellers et brugervendt navn for typen. */
const ITEM_LABELS: Partial<Record<ViewComponent["type"], string>> = {
  LassoKeyFigureCards: "Nøgletal",
  LassoBarChart: "Udvikling",
  LassoGroupedBarChart: "Udvikling",
  LassoLineChart: "Udvikling",
  LassoIncomeStatement: "Resultatopgørelse",
  LassoBalanceSheet: "Balance",
  LassoCashFlow: "Pengestrøm",
  LassoMultiYearTable: "Flerårsoversigt",
  LassoPersonList: "Ledelse",
  LassoOwnerList: "Ejere",
  LassoOwnershipDiagram: "Ejerdiagram",
  LassoBeneficialOwners: "Reelle ejere",
  LassoTimeline: "Historik",
  LassoNews: "Nyheder",
  LassoCreditRating: "Kreditvurdering",
  LassoScoreGauge: "Score",
  LassoProductionUnits: "Produktionsenheder",
  LassoProperties: "Ejendomme",
  LassoLivestock: "Husdyr",
  LassoContact: "Kontakt",
  LassoContactPersons: "Kontaktpersoner",
  LassoSummary: "Analyse",
  LassoRelations: "Relationer",
  LassoRegistration: "Regnskabsoplysninger",
};
export function groupItemLabel(c: ViewComponent): string {
  if ("title" in c && typeof c.title === "string" && c.title) return c.title;
  if (c.type === "LassoKeyValueList") return c.variant === "financials" ? "Nøgletal" : "Virksomhedsoplysninger";
  if (c.type === "LassoTextSections") return c.variant === "analyse" ? "Regnskabsanalyse" : "Profil";
  return ITEM_LABELS[c.type] ?? COMPONENT_CATALOG.find((e) => e.type === c.type)?.title ?? c.type;
}

function renderGroup(group: ComponentGroup, items: readonly Indexed[], ds: Dataset | null, props: LassoViewProps, act: (a: ViewAction) => void, frame: FrameTools) {
  const body =
    group.pattern === "cards" ? (
      <CardGrid>
        {items.map(({ c, i }) => (
          <div key={i} className="lasso-cardgrid__item">
            {renderComponent(c, ds, props, act, i, frame)}
          </div>
        ))}
      </CardGrid>
    ) : (
      <Accordion
        defaultOpen={[`${group.id}-${items[0]!.i}`]}
        items={items.map(({ c, i }) => ({ id: `${group.id}-${i}`, title: groupItemLabel(c), children: renderComponent(c, ds, props, act, i, frame) }))}
      />
    );
  return (
    <section className={`lasso-section lasso-group lasso-group--${group.pattern}`} data-group={group.id}>
      {group.title ? (
        <div className="lasso-section__head">
          <div className="lasso-section__titles">
            <h3 className="lasso-section__title">{group.title}</h3>
          </div>
        </div>
      ) : null}
      {group.toolbar ? (
        // 30.11: modulværktøjslinjen under modulets overskrift; handlingerne er opfølgende spørgsmål.
        <ModuleToolbar
          className="lasso-toolbar--module"
          primary={group.toolbar.primary ? { label: group.toolbar.primary.label, onClick: () => act({ kind: "prompt", prompt: group.toolbar!.primary!.prompt }) } : undefined}
          secondary={(group.toolbar.actions ?? []).map((a) => ({ label: a.label, onClick: () => act({ kind: "prompt", prompt: a.prompt }) }))}
        />
      ) : null}
      {body}
    </section>
  );
}

/** Gruppens bredde: første medlems width, hvis den er sat; ellers fuld (kortgitter og harmonika fylder rækken). */
function groupWidth(items: readonly Indexed[], layout: ViewSpec["layout"]): Width {
  if (layout === "stack") return "full";
  return items[0]!.c.width ?? "full";
}

/** Layout 'columns': sammenhængende fuldbredde-komponenter med samme group samles i ét bånd. */
export type ColumnsBand = Band | { kind: "group"; group: ComponentGroup; items: Indexed[] };
export function mergeFullGroups(bands: readonly Band[]): ColumnsBand[] {
  const out: ColumnsBand[] = [];
  let pending: Indexed[] = [];
  const flush = () => {
    for (const r of groupRuns(pending)) out.push(r.kind === "one" ? { kind: "full", item: r.item } : { kind: "group", group: r.group, items: r.items });
    pending = [];
  };
  for (const b of bands) {
    if (b.kind === "full") pending.push(b.item);
    else {
      flush();
      out.push(b);
    }
  }
  flush();
  return out;
}

/**
 * Kolonnernes forhold i et bånd ud fra bredden på første sektion i hver kolonne, i 12-kolonne-
 * gitterets enheder (fx ¾ + ¼ giver 9fr 3fr). Mangler en bredde, deles båndet ligeligt som hidtil
 * (undefined); det gør det også, når alle bredder er ens og ikke udgør et helt bånd (gamle visninger).
 */
export function bandTemplate(columns: readonly Indexed[][]): string | undefined {
  const widths = columns.map((col) => col[0]?.c.width);
  if (widths.length < 2 || widths.some((w) => !w)) return undefined;
  if (!gridBandColumns(columns) && widths.every((w) => w === widths[0])) return undefined;
  return widths.map((w) => `minmax(0, ${WIDTH_COLUMNS[w!]}fr)`).join(" ");
}

/** Stakkenes kolonner (3, 4, 6, 8, 9), når båndet er et helt bånd i gridmodellen (summen er 12), ellers undefined. */
export function gridBandColumns(columns: readonly Indexed[][]): number[] | undefined {
  const widths = columns.map((col) => col[0]?.c.width);
  if (widths.length < 2 || widths.some((w) => !w)) return undefined;
  const cols = widths.map((w) => WIDTH_COLUMNS[w!]);
  return cols.reduce((a, b) => a + b, 0) === 12 ? cols : undefined;
}

/** Stakkens plads på tablet: første i en række (ingen venstrelinje), sidst i en række, og om den står i en ny række. */
function bandStackClass(spans: readonly number[], k: number): string {
  let used = 0;
  let row = 0;
  let start = false;
  for (let i = 0; i <= k; i++) {
    if (used + spans[i]! > 12) {
      used = 0;
      row++;
    }
    start = used === 0;
    used += spans[i]!;
  }
  const end = used === 12 || k === spans.length - 1;
  // Jakob 01.10: en stak, der på tablet står alene i fuld bredde, lægger sine elementer ved siden af hinanden.
  const full = spans[k] === 12 && spans.length > 1;
  return ["lasso-stack", start ? "lasso-stack--start-t" : "", end ? "lasso-stack--end-t" : "", row > 0 ? "lasso-stack--wrap-t" : "", full ? "lasso-stack--full-t" : ""].filter(Boolean).join(" ");
}

/**
 * Foldningen af et bånd på tablet (midten ≤ 960, skærm < 1200), gridmodel 4.5: ⅔+⅓ og ¾+¼ bliver
 * fuld + fuld, ½+½ holder, ⅓+⅓+⅓ bliver ½+½+fuld, og bånd med ¼ og ½ bliver halve, hvor en stak
 * alene i sidste række står i fuld bredde. Returnerer stakkenes spænd i 12 kolonner.
 */
export function tabletSpans(cols: readonly number[]): number[] {
  if (cols.some((c) => c > 6)) return cols.map(() => 12);
  const spans = cols.map(() => 6);
  if (spans.length % 2 === 1) spans[spans.length - 1] = 12;
  return spans;
}

/** Vandret afstand mellem stakke (px, --lasso-space-5), som reflowBands regner bredderne med. */
const FLOW_GAP = 24;

/** reflowBands for tegnede elementer (komponent + indeks); prioritet = komponentens priority, ellers rækkefølgen. */
function reflowFlow(bands: FlowBand<Indexed>[], content: number, h: (c: ViewComponent, w: Width) => number, min?: MinWidthFn): FlowBand<Indexed>[] {
  return reflowBands(bands, content, h, { component: (it) => it.c, item: (c, o) => ({ c, i: o.i }), priority: (it) => it.c.priority ?? 100 + it.i, gap: FLOW_GAP, ...(min ? { min } : {}) });
}

/**
 * Layout 'columns' i den målte bredde: hvert kolonnebånd bliver til ét eller flere bånd (reflowBands). En
 * kolonne uden width deler båndet ligeligt. Fuldbånd og grupper står som før.
 */
export type FlowColumnsBand = Exclude<ColumnsBand, { kind: "columns" }> | { kind: "flow"; stacks: FlowBand<Indexed> };
export function flowColumnBands(bands: readonly ColumnsBand[], content: number, ds: Dataset | null, all: readonly ViewComponent[]): FlowColumnsBand[] {
  const h = (c: ViewComponent, width: Width) => {
    if (!ds) return measuredHeight(c, width);
    try {
      return gridHeight(c, width, ds, all);
    } catch {
      return measuredHeight(c, width);
    }
  };
  const min = ds ? contentMinWidthFn(ds) : undefined;
  return bands.flatMap((b): FlowColumnsBand[] => {
    if (b.kind !== "columns") return [b];
    const n = b.columns.length;
    const stacks: FlowBand<Indexed> = b.columns.map((col) => ({ width: col[0]?.c.width ?? widthOfColumns(12 / n), items: col }));
    return reflowFlow([stacks], content, h, min).map((st) => ({ kind: "flow", stacks: st }));
  });
}

/** Midtens indre bredde (px), målt før der tegnes og igen, når den ændrer sig; afrundet til 4 px, så små ændringer ikke pakker om. */
function useContentWidth(): [(el: HTMLElement | null) => void, number | null] {
  const [el, setEl] = useState<HTMLElement | null>(null);
  const [width, setWidth] = useState<number | null>(null);
  useLayoutEffect(() => {
    if (!el || typeof ResizeObserver === "undefined") return;
    const read = () => {
      const cs = getComputedStyle(el);
      const w = Math.round((el.clientWidth - parseFloat(cs.paddingLeft || "0") - parseFloat(cs.paddingRight || "0")) / 4) * 4;
      if (w > 0) setWidth((prev) => (prev === w ? prev : w));
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return [setEl, width];
}

/** Lodret afstand mellem elementer i en stak i layout 'dashboard' (px, --lasso-space-10). */
const DASHBOARD_GAP = 40;

/**
 * Layout 'dashboard' i gridmodellen (23.1): sammenhængende komponenter pakkes i bånd og stakke
 * (packBands) i stedet for at stå hver i sin celle, så en kort komponent aldrig efterlader et hul
 * ved siden af en lang. En eksplicit width låser bredden (render_view); uden width vælger pakningen
 * inden for elementets min/max. Grupper (mønster 8/9) står i eget fuldbånd som hidtil.
 */
export type DashboardBand =
  | { kind: "run"; run: Run }
  | { kind: "band"; stacks: { width: Width; items: Indexed[] }[]; flow?: boolean };
/**
 * Med `content` (midtens målte bredde i px) lægges båndene om til den bredde (reflowBands i grid.ts): et bånd,
 * hvis stakke stadig kan bære deres elementer, står; ellers brydes det efter elementernes mindste lovlige bredde
 * og prioritet. Uden `content` (før midten er målt) bruges referencegitteret og CSS'ens foldning.
 */
export function dashboardBands(components: readonly ViewComponent[], ds: Dataset | null, content?: number | null): DashboardBand[] {
  const out: DashboardBand[] = [];
  let pending: Indexed[] = [];
  const flush = () => {
    if (pending.length === 0) return;
    const index = new Map<ViewComponent, number>();
    const items = pending.map(({ c, i }) => {
      // 30.9 og 30.11: tidslinjen med filterkolonne og nyhedernes kortgitter står i fuld bredde (widthOf).
      const w = widthOf(c, "dashboard");
      const x = !c.width && w === "full" && (c.type === "LassoTimeline" || c.type === "LassoNews") ? ({ ...c, width: "full" } as ViewComponent) : c;
      index.set(x, i);
      return x;
    });
    const h = (c: ViewComponent, width: Width) => {
      if (!ds) return measuredHeight(c, width);
      try {
        return gridHeight(c, width, ds, items);
      } catch {
        return measuredHeight(c, width);
      }
    };
    // Ø13/B8: mindstebredden efter indholdet (lange navne, rækker pr. post, tidsakse), når data findes.
    const minWidth = ds ? contentMinWidthFn(ds) : undefined;
    let bands: FlowBand<Indexed>[] = packBands(items, h, { gap: DASHBOARD_GAP, minWidth }).map((b) =>
      b.stacks.map((st) => ({ width: st.width, items: st.items.map((c) => ({ c: { ...c, width: st.width } as ViewComponent, i: index.get(originOf(c))! })) })),
    );
    if (content) bands = reflowFlow(bands, content, h, minWidth);
    for (const b of bands) {
      if (b.length === 1 && b[0]!.items.length === 1) {
        out.push({ kind: "run", run: { kind: "one", item: b[0]!.items[0]! } });
      } else {
        out.push({ kind: "band", flow: Boolean(content), stacks: b.map((st) => ({ width: st.width, items: st.items.map(({ c, i }) => ({ c: { ...c, width: st.width } as ViewComponent, i })) })) });
      }
    }
    pending = [];
  };
  for (const run of groupRuns(components.map((c, i) => ({ c, i })))) {
    if (run.kind === "one") pending.push(run.item);
    else {
      flush();
      out.push({ kind: "run", run });
    }
  }
  flush();
  return out;
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
function useSaveToggle(target: SaveTarget | null, fromData: boolean, onAction: LassoViewProps["onAction"], notify: (o: ToastOptions) => void) {
  const [saved, setSaved] = useState(fromData);
  const [busy, setBusy] = useState(false);
  const id = target?.lassoId;
  useEffect(() => {
    if (!busy) setSaved(fromData);
    // Kun når værtens tilstand (eller siden) skifter; mens et klik venter på svar, bestemmer klikket.
  }, [fromData, id]);

  const run = async (want: boolean) => {
    if (!target) return;
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
  return {
    saved,
    busy,
    toggle: () => {
      if (!busy) void run(!saved);
    },
  };
}

/**
 * Overvåg/Overvåger (katalog 08.1): første klik starter overvågningen (optimistisk, rulles tilbage ved
 * fejl); når siden overvåges, åbner klik indstillingerne hos værten og slår aldrig fra.
 */
function useMonitorToggle(target: SaveTarget | null, fromData: boolean, onAction: LassoViewProps["onAction"], notify: (o: ToastOptions) => void) {
  const [on, setOn] = useState(fromData);
  const [busy, setBusy] = useState(false);
  const id = target?.lassoId;
  useEffect(() => {
    if (!busy) setOn(fromData);
  }, [fromData, id]);
  const run = async () => {
    if (!target) return;
    const was = on;
    if (!was) setOn(true);
    setBusy(true);
    let res: ActionResult | void;
    try {
      res = await onAction({ kind: "monitor", lassoId: target.lassoId, pageKind: target.pageKind, name: target.name, monitoring: was });
    } catch (e) {
      res = { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
    setBusy(false);
    if (res && !res.ok) {
      if (!was) setOn(false);
      notify({ text: res.error, tone: "error", action: { label: "Prøv igen", onClick: () => void run() } });
      return;
    }
    if (!was) notify({ text: res?.message ?? `Overvåger ${target.name}`, tone: "ok" });
  };
  return {
    monitoring: on,
    busy,
    toggle: () => {
      if (!busy) void run();
    },
  };
}

/**
 * Gem/Gemt i rammens header, når siden ikke har et fuldt hoved (katalog 01, regel 21): lille ikonknap
 * med bogmærke og ord. Står hovedet på siden, flytter Gem ind i hovedets ikonknapper (08.1).
 */
function SavePageButton({ save }: { save: { saved: boolean; busy: boolean; toggle: () => void } }) {
  return (
    <button type="button" className="lasso-iconbtn lasso-frame__save" aria-pressed={save.saved} aria-busy={save.busy || undefined} title={save.saved ? "Fjern fra din liste" : "Gem på din liste"} onClick={save.toggle}>
      <ShellIcon name="bookmark" size={16} filled={save.saved} />
      <span>{save.saved ? "Gemt" : "Gem"}</span>
    </button>
  );
}

/** Står sidens virksomhed/person som fuldt hoved (variant 'full') på siden? Så hører Gem, Overvåg og eksport til hovedet. */
export function hasFullHead(spec: ViewSpec, lassoId: string | undefined): boolean {
  if (!lassoId) return false;
  return spec.components.some(
    (x) => ((x.type === "LassoCompanyHead" && x.company === lassoId) || (x.type === "LassoPersonHead" && x.person === lassoId)) && (x.variant ?? "full") === "full",
  );
}

/**
 * Den faste ramme om alle visninger: header (logo, navn, datatidspunkt) ->
 * kriterie-chips -> indhold -> handlingsbjælke. Ens uanset indhold.
 */
export function LassoView(props: LassoViewProps) {
  // Beskeder (07) kræver en ToastProvider; står der ingen over visningen, pakker den sig selv ind.
  const provided = useHasToastProvider();
  const view = provided ? (
    <LassoViewInner {...props} />
  ) : (
    <ToastProvider container={false}>
      <LassoViewInner {...props} ownToasts />
    </ToastProvider>
  );
  // Print-tilstand (PDF): komponenterne folder ud og viser faner som overskrifter (print.tsx).
  return props.print ? <PrintMode value>{view}</PrintMode> : view;
}

function LassoViewInner(props: LassoViewProps & { ownToasts?: boolean }) {
  const { spec, dataset, host, onAction, url, theme, loading, savePrefix, frameless: framelessProp = false } = props;
  // `embedded` er et ældre navn for det samme (portalens ramme har selv header og handlinger).
  const frameless = framelessProp || Boolean(props.embedded);
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
  // Print-tilstand (serverens PDF): ingen knapper eller handlingsbjælke; komponenterne folder ud (print.tsx).
  const print = Boolean(props.print);

  // Katalog 27: "Eksportér PDF" på en virksomhedsside viser A4-rapporten i en overlay med "Print" og "Luk".
  // 19.6/27.4: samme overlay viser også regnskabsanalysen ("Hent som PDF") og personrapporten.
  const [report, setReport] = useState<ReportRequest | null>(null);
  const setReportOpen = (open: boolean) => setReport(open ? { kind: "company" } : null);
  // Bredderne holdes inden for gitterreglen (GRID_RULES max), også når specen selv angiver dem (grid.ts ruleBoundComponents).
  const laidOut = ruleBoundComponents(spec.layout, spec.components);
  // Den responsive model (grid.ts reflowBands): båndene lægges om efter midtens målte bredde.
  const [contentRef, contentWidth] = useContentWidth();
  const flowDashboard = useMemo(() => (spec.layout === "dashboard" ? dashboardBands(laidOut, dataset ?? null, contentWidth) : []), [spec, dataset, contentWidth]);
  const flowColumns = useMemo(
    () => (spec.layout === "columns" && contentWidth ? flowColumnBands(mergeFullGroups(columnBands(laidOut)), contentWidth, dataset ?? null, laidOut) : null),
    [spec, dataset, contentWidth],
  );
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
  const entity = saveTarget(spec, dataset);
  const target = host.savePage && !print ? entity : null;
  // "Gem som PDF" øverst ved Gem/Gemt på alle sider, når værten kan hente PDF'en (host.pdf).
  const pdf = Boolean(host.pdf) && !print;
  const monitorTarget = host.monitor ? entity : null;
  const save = useSaveToggle(target, Boolean(target && dataset?.savedIds?.includes(target.lassoId)), onAction, notify);
  const monitor = useMonitorToggle(monitorTarget, Boolean(monitorTarget && dataset?.monitoredIds?.includes(monitorTarget.lassoId)), onAction, notify);
  // Katalog 08.1: står sidens hoved på siden, flytter Gem, Eksportér og "…" ind i hovedet.
  // Uden entitetens data (henter/fejl) tegner hovedet et skelet; så står Gem i rammens header som før.
  const entityLoaded = Boolean(entity && (entity.pageKind === "company" ? dataset?.companies[entity.lassoId] : dataset?.persons[entity.lassoId]));
  // Print (PDF): hovedet står uden handlingsknapper (Gem, Eksportér, Overvåg, "…").
  const headActions = entityLoaded && hasFullHead(spec, entity?.lassoId) && !print;
  // MCP-rammen (Jakob 30.09): navnet øverst, "Vis i fuld skærm" i midten med farve (væk i fuld skærm), "Gem som PDF" til højre.
  const canFullscreen = Boolean(host.fullscreen) && !host.fullscreenActive && !print;
  const fullscreenTop = canFullscreen ? (
    // Jakob 01.10: samme ikonknap som Overvåg, Gem og PDF ved siden af (ikke en farvet knap midt i hovedet).
    <button type="button" className="lasso-iconbtn lasso-fsbtn" aria-label="Vis i fuld skærm" title="Vis i fuld skærm" onClick={() => act({ kind: "fullscreen" })}>
      <ShellIcon name="expand" size={16} />
    </button>
  ) : null;
  const pdfButton = pdf ? <PdfButton onAction={onAction} notify={notify} /> : null;
  const csvName = `${spec.title.replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase()}.csv`;
  const frame: FrameTools = {
    copy: (text, what) => {
      void Promise.resolve(onAction({ kind: "copy-link", url: text })).then((res) =>
        notify(res && !res.ok ? { text: res.error, tone: "error" } : { text: what === "phone" ? "Telefonnummer kopieret" : "E-mail kopieret", tone: "ok" }),
      );
    },
    // MCP-rammen (Jakob 30.09): ingen Gem- og Eksportér-ikoner i hovedet; kun "Vis i fuld skærm" og "Gem som PDF".
    save: headActions && !host.minimalHead && target && dataset ? { id: target.lassoId, ...save } : undefined,
    monitor: headActions && monitorTarget && dataset ? { id: monitorTarget.lassoId, ...monitor } : undefined,
    exportItems: headActions && !host.minimalHead
      ? [
          ...(canReport ? [{ id: "pdf", label: "Virksomhedsrapport (PDF)", icon: <ShellIcon name="document" size={16} />, onSelect: () => setReportOpen(true) }] : []),
          // 27.4: standard personrapport (A4) på personsiden.
          ...(host.export && entity?.pageKind === "person" && dataset?.persons[entity.lassoId]
            ? [{ id: "person-pdf", label: "Personrapport (PDF)", icon: <ShellIcon name="document" size={16} />, onSelect: () => setReport({ kind: "person", person: entity.lassoId }) }]
            : []),
          ...(host.export && csv ? [{ id: "csv", label: "Tal som CSV", icon: <ShellIcon name="download" size={16} />, onSelect: () => act({ kind: "export", filename: csvName, csv }) }] : []),
          // 16.1: personhovedet har også Eksportér (rollerne som CSV).
          ...(host.export && entity?.pageKind === "person" && dataset?.persons[entity.lassoId]
            ? [{ id: "roles-csv", label: "Roller som CSV", icon: <ShellIcon name="download" size={16} />, onSelect: () => act({ kind: "export", filename: csvName.replace(/\.csv$/, "-roller.csv"), csv: personRolesCsv(dataset.persons[entity.lassoId]!) }) }]
            : []),
        ]
      : [],
    saveList: host.save ? () => setSaving(true) : undefined,
    analysisPdf: host.export && dataset ? (company) => setReport({ kind: "analysis", company }) : undefined,
    more: headActions
      ? [
          ...(shareUrl ? [{ id: "link", label: "Kopiér link", icon: <ShellIcon name="copy" size={16} />, onSelect: () => void copy(shareUrl) }] : []),
          // G5 (Jakob 29.09): intet "Opdatér"; data kommer i realtid. Fuld skærm er en knap i hovedet og i bunden.
        ]
      : [],
    // Kun i rammen (MCP); uden ramme (portal, delte sider) har værten sin egen PDF-knap.
    fullscreenTop: headActions && !frameless ? fullscreenTop : undefined,
    pdfButton: headActions && !frameless ? pdfButton : undefined,
  };

  return (
    <div className={print ? "lasso-root lasso-root--print" : "lasso-root"} data-theme={print ? "light" : (theme ?? "light")}>
      <div className={`lasso-frame ${frameless ? "lasso-frame--bare" : ""}${frameless && props.sectionCards ? " lasso-frame--cards" : ""}`}>
        {frameless || print || headActions ? null : (
        // Rammens hoved (MCP): kun navnet øverst; ingen logo, intet område og intet datastempel (Jakob 30.09).
        <header className={`lasso-frame__header lasso-frame__header--bar${fullscreenTop ? " lasso-frame__header--center" : ""}`}>
          {host.back && !print ? (
            <button className="lasso-btn lasso-btn--ghost lasso-frame__back" onClick={() => act({ kind: "back" })} aria-label="Tilbage">
              ←
            </button>
          ) : null}
          <div className="lasso-frame__titles">
            <h1 className="lasso-frame__title">
              {spec.title}
              {dataset?.source === "demo" ? <Badge tone="demo">Demodata</Badge> : null}
            </h1>
            {spec.subtitle && spec.kind !== "company" && spec.kind !== "person" ? <div className="lasso-frame__meta">{spec.subtitle}</div> : null}
          </div>
          {fullscreenTop ? <div className="lasso-frame__center">{fullscreenTop}</div> : null}
          {pdfButton || (target && dataset && !host.minimalHead) ? (
            <div className="lasso-frame__actions">
              {target && dataset && !host.minimalHead ? <SavePageButton save={save} /> : null}
              {pdfButton}
            </div>
          ) : null}
        </header>
        )}

        {spec.criteria.length > 0 || (host.refine && spec.kind === "list" && !print) ? (
          // 26c.8: med en virksomhedstabel står filtrene i tabellens værktøjslinje og bundark på mobil.
          <div className={spec.components.some((c) => c.type === "LassoCompanyTable") ? "lasso-frame__filters lasso-frame__filters--table" : "lasso-frame__filters"}>
            <FilterPanel criteria={spec.criteria} editable={Boolean(host.refine) && !print} onApply={(criteria) => act({ kind: "set-criteria", criteria })} />
          </div>
        ) : null}
        {unsupported.length > 0 ? <div className="lasso-notice">Kunne ikke anvendes endnu: {unsupported.join(", ")}</div> : null}

        {/* Jakob 01.10: forside med logo, navnelogo og området, man printer. */}
        {print && dataset ? <PrintCover title={spec.title} area={spec.subtitle ?? (spec.kind === "company" || spec.kind === "person" ? "Overblik" : undefined)} generatedAt={dataset.generatedAt} /> : null}
        {loading && !dataset ? (
          <Skeleton lines={4} height={240} />
        ) : (
          <main ref={contentRef} className={`lasso-content lasso-content--grid-4 lasso-content--${spec.layout}`}>
            {spec.layout === "page"
              ? // Lasso-siden (docs/design/README.md, "Lasso-side"): kolonnerne 2:3:4, fuld bredde uden column.
                mergeFullGroups(columnBands(spec.components)).map((band, b) =>
                  band.kind === "group" ? (
                    <div key={`b${b}`} className="lasso-lpage__full">
                      {renderGroup(band.group, band.items, dataset, props, act, frame)}
                    </div>
                  ) : band.kind === "full" ? (
                    <div key={`b${b}`} className="lasso-lpage__full">
                      {renderComponent(band.item.c, dataset, props, act, band.item.i, frame)}
                    </div>
                  ) : (
                    <div key={`b${b}`} className={`lasso-lpage lasso-lpage--${Math.min(band.columns.length, 3)}`}>
                      {band.columns.map((col, k) => (
                        <div key={k} className="lasso-lpage__col">
                          {groupRuns(col).map((run) => (
                            <div key={run.kind === "one" ? run.item.i : run.items[0]!.i} className="lasso-lpage__item">
                              {run.kind === "one" ? renderComponent(run.item.c, dataset, props, act, run.item.i, frame) : renderGroup(run.group, run.items, dataset, props, act, frame)}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  ),
                )
              : spec.layout === "columns" && flowColumns
              ? flowColumns.map((band, b) =>
                  band.kind === "group" ? (
                    <div key={`b${b}`} className="lasso-cell lasso-cell--full">
                      {renderGroup(band.group, band.items, dataset, props, act, frame)}
                    </div>
                  ) : band.kind === "full" ? (
                    <div key={`b${b}`} className="lasso-cell lasso-cell--full">
                      {renderComponent(band.item.c, dataset, props, act, band.item.i, frame)}
                    </div>
                  ) : (
                    // Et bånd i den målte bredde (reflowBands): stakkene i deres forhold; et brudt bånd er flere rækker.
                    <div
                      key={`b${b}`}
                      className="lasso-cell lasso-cell--full lasso-columns lasso-columns--ratio lasso-columns--flow"
                      style={{ ["--lasso-columns-template" as string]: band.stacks.map((st) => `minmax(0, ${WIDTH_COLUMNS[st.width]}fr)`).join(" ") }}
                    >
                      {band.stacks.map((st, k) => (
                        <div key={k} className="lasso-column">
                          {groupRuns(st.items).map((run) =>
                            run.kind === "one" ? (
                              <div key={run.item.i} className="lasso-column__item">
                                {renderComponent(run.item.c, dataset, props, act, run.item.i, frame)}
                              </div>
                            ) : (
                              <div key={run.items[0]!.i} className="lasso-column__item">
                                {renderGroup(run.group, run.items, dataset, props, act, frame)}
                              </div>
                            ),
                          )}
                        </div>
                      ))}
                    </div>
                  ),
                )
              : spec.layout === "columns"
              ? mergeFullGroups(columnBands(laidOut)).map((band, b) =>
                  band.kind === "group" ? (
                    <div key={`b${b}`} className="lasso-cell lasso-cell--full">
                      {renderGroup(band.group, band.items, dataset, props, act, frame)}
                    </div>
                  ) : band.kind === "full" ? (
                    <div key={`b${b}`} className="lasso-cell lasso-cell--full">
                      {renderComponent(band.item.c, dataset, props, act, band.item.i, frame)}
                    </div>
                  ) : (
                    <div
                      key={`b${b}`}
                      className={`lasso-cell lasso-cell--full lasso-columns lasso-columns--${spec.columns ?? 3}${bandTemplate(band.columns) ? " lasso-columns--ratio" : ""}${gridBandColumns(band.columns) ? " lasso-band" : ""}`}
                      style={bandTemplate(band.columns) ? { ["--lasso-columns-template" as string]: bandTemplate(band.columns) } : undefined}
                    >
                      {band.columns.map((col, k) => (
                        <div key={k} className={`lasso-column${gridBandColumns(band.columns) ? ` ${bandStackClass(tabletSpans(gridBandColumns(band.columns)!), k)}` : ""}`} style={gridBandColumns(band.columns) ? { ["--lasso-span-t" as string]: tabletSpans(gridBandColumns(band.columns)!)[k] } : undefined}>
                          {groupRuns(col).map((run) =>
                            run.kind === "one" ? (
                              <div key={run.item.i} className="lasso-column__item" style={{ ["--lasso-mobile-order" as string]: mobileOrder(run.item.c) }}>
                                {renderComponent(run.item.c, dataset, props, act, run.item.i, frame)}
                              </div>
                            ) : (
                              <div key={run.items[0]!.i} className="lasso-column__item" style={{ ["--lasso-mobile-order" as string]: mobileOrder(run.items[0]!.c) }}>
                                {renderGroup(run.group, run.items, dataset, props, act, frame)}
                              </div>
                            ),
                          )}
                        </div>
                      ))}
                    </div>
                  ),
                )
              : spec.layout === "dashboard"
                ? flowDashboard.map((b) => {
                    if (b.kind === "run") {
                      const run = b.run;
                      // Et element alene i sit bånd står i fuld bredde (23.1 4d: aldrig en ½ alene, ingen huller).
                      return run.kind === "one" ? (
                        <div key={run.item.i} className="lasso-cell lasso-cell--full">
                          {renderComponent(run.item.c, dataset, props, act, run.item.i, frame)}
                        </div>
                      ) : (
                        <div key={run.items[0]!.i} className={`lasso-cell lasso-cell--${groupWidth(run.items, spec.layout)}`}>
                          {renderGroup(run.group, run.items, dataset, props, act, frame)}
                        </div>
                      );
                    }
                    // Et bånd i gridmodellen: stakkene strækkes til båndets højde (ingen huller); tablet folder efter tabletSpans.
                    const cols = b.stacks.map((st) => WIDTH_COLUMNS[st.width]);
                    const spans = tabletSpans(cols);
                    return (
                      <div key={`d${b.stacks[0]!.items[0]!.i}`} className={`lasso-cell lasso-cell--full lasso-dband${b.flow ? " lasso-dband--flow" : ""}`} style={{ ["--lasso-dband-template" as string]: cols.map((n) => `minmax(0, ${n}fr)`).join(" ") }}>
                        {b.stacks.map((st, k) => (
                          <div key={k} className={`lasso-dstack lasso-dstack--${st.width}`} style={{ ["--lasso-span-t" as string]: spans[k] }}>
                            {st.items.map(({ c, i }) => (
                              <div key={i} className="lasso-dstack__item">
                                {renderComponent(c, dataset, props, act, i, frame)}
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    );
                  })
                : groupRuns(laidOut.map((c, i) => ({ c, i }))).map((run) =>
                    run.kind === "one" ? (
                      <div key={run.item.i} className={`lasso-cell lasso-cell--${widthOf(run.item.c, spec.layout)}`}>
                        {renderComponent(run.item.c, dataset, props, act, run.item.i, frame)}
                      </div>
                    ) : (
                      <div key={run.items[0]!.i} className={`lasso-cell lasso-cell--${groupWidth(run.items, spec.layout)}`}>
                        {renderGroup(run.group, run.items, dataset, props, act, frame)}
                      </div>
                    ),
                  )}
          </main>
        )}
        {spec.answer && (spec.answer.next || spec.answer.logo) ? (
          // 30.1–30.3: svarets bundlinje, dæmpet navnelogo til venstre og ét koral link videre til højre.
          // G3 (Jakob 29.09): kildeteksten (answer.source) vises ikke længere.
          <footer className="lasso-answerfoot">
            <span className="lasso-answerfoot__source">
              {spec.answer.logo ? <LassoWordmark className="lasso-answerfoot__mark" /> : null}
            </span>
            {spec.answer.next ? (
              <button type="button" className="lasso-answerfoot__next" onClick={() => act({ kind: "prompt", prompt: spec.answer!.next!.prompt })}>
                {spec.answer.next.label}
              </button>
            ) : null}
          </footer>
        ) : null}

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

        {print ? null : frameless ? (
          notice ? <div className="lasso-small lasso-muted" role="status">{notice}</div> : null
        ) : (
        <footer className="lasso-actionbar">
          <span className="lasso-actionbar__spacer" />
          {notice ? <span className="lasso-small lasso-muted" role="status">{notice}</span> : null}
          {host.export && csv && !headActions ? (
            <button className="lasso-btn" onClick={() => act({ kind: "export", filename: csvName, csv })}>
              Eksportér<span className="lasso-btn__label--optional"> CSV</span>
            </button>
          ) : null}
          {canReport && !headActions ? (
            <button className="lasso-btn" onClick={() => setReportOpen(true)}>
              Eksportér<span className="lasso-btn__label--optional"> PDF</span>
            </button>
          ) : null}
          {shareUrl && !headActions ? (
            <button className="lasso-btn" onClick={() => void copy(shareUrl)}>
              Del link
            </button>
          ) : null}
          {/* Jakob 30.09: "Fuld skærm" helt til højre i bunden (væk, når visningen står i fuld skærm). */}
          {canFullscreen ? (
            <button type="button" className="lasso-btn lasso-actionbar__fullscreen" onClick={() => act({ kind: "fullscreen" })}>
              <ShellIcon name="expand" size={15} />
              Fuld skærm
            </button>
          ) : null}
          {/* G5 (Jakob 29.09): ingen "Gem visning" på visningen; et element kan ikke gemmes, og data kommer i
              realtid. Gem hører kun til sidens hoved (gem-laget, save_page). Delbart link laves af save_view. */}
        </footer>
        )}

        {props.ownToasts && !print ? <Toasts /> : null}

        {report && dataset && (report.kind !== "company" || reportCompany) ? (
          <div className="lasso-a4-overlay" role="dialog" aria-label={reportTitle(report)}>
            <div className="lasso-a4-toolbar">
              <span className="lasso-a4-toolbar__title">
                {reportTitle(report)}, {report.kind === "person" ? dataset.persons[report.person]?.name : (dataset.companies[report.kind === "analysis" ? report.company : reportCompany!]?.name ?? spec.title)}
              </span>
              <button className="lasso-btn lasso-btn--primary" onClick={() => window.print()}>
                Print
              </button>
              {/* G8: luk er altid et ×-ikon med aria-label "Luk". */}
              <button type="button" className="lasso-iconbtn lasso-iconbtn--sq lasso-iconbtn--38" onClick={() => setReport(null)} aria-label="Luk" title="Luk">
                <Icon name="close" size={18} />
              </button>
            </div>
            {report.kind === "analysis" ? (
              <AnalysisReportA4 company={report.company} dataset={dataset} disclaimer={ANALYSIS_DISCLAIMER} name={spec.title} />
            ) : report.kind === "person" ? (
              <PersonReportA4 person={report.person} dataset={dataset} />
            ) : (
              <ReportA4 company={reportCompany!} dataset={dataset} />
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
