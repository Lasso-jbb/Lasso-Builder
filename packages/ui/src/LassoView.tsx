import { useState } from "react";
import { emptyDataset, searchKey, widthOf, type Dataset, type ViewComponent, ownershipGraphKey } from "@lasso/spec";
import { FollowUps } from "./components/FollowUps.js";
import { LassoMark } from "./LassoMark.js";
import { CompanyHead } from "./components/CompanyHead.js";
import { CompanyTable } from "./components/CompanyTable.js";
import { CompareTable } from "./components/CompareTable.js";
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
import { RiskObservations } from "./components/RiskObservations.js";
import { AuditorIndependence } from "./components/AuditorIndependence.js";
import { specToCsv } from "./csv.js";
import { Badge, Skeleton } from "./primitives.js";
import { SaveDialog } from "./SaveDialog.js";
import type { LassoViewProps, ViewAction } from "./types.js";

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
      return <PersonList key={key} people={empty.people[c.company]} show={c.show} title={c.title} error={err(`people:${c.company}`)} />;
    case "LassoOwnerList":
      return <OwnerList key={key} ownership={empty.ownership[c.company]} error={err(`ownership:${c.company}`)} onOpen={props.host.drillDown ? act : undefined} />;
    case "LassoOwnershipDiagram": {
      const k = ownershipGraphKey(c);
      return <OwnershipDiagram key={key} graph={empty.ownershipGraphs?.[k]} error={err(`graph:${k}`)} title={c.title} onAction={act} canDrillDown={Boolean(props.host.drillDown)} canPrompt={Boolean(props.host.prompt)} canFullscreen={Boolean(props.host.fullscreen)} />;
    }
    case "LassoCompanyTable": {
      const k = searchKey(c.search);
      return <CompanyTable key={key} result={empty.searches[k]} columns={c.columns} title={c.title} error={err(`search:${k}`)} onAction={act} canDrillDown={Boolean(props.host.drillDown)} />;
    }
    case "LassoCompareTable":
      return <CompareTable key={key} companies={c.companies} metrics={c.metrics} title={c.title} dataset={empty} onAction={act} canDrillDown={Boolean(props.host.drillDown)} />;
    case "LassoKeyValueList":
      return (
        <KeyValueList
          key={key}
          company={empty.companies[c.company]}
          ownership={empty.ownership[c.company]}
          financials={empty.financials[c.company]}
          variant={c.variant}
          title={c.title}
          error={c.variant === "financials" ? err(`financials:${c.company}`) : err(`company:${c.company}`)}
        />
      );
    case "LassoContact":
      return <LassoContact key={key} contact={empty.contact[c.company]} title={c.title} error={err(`contact:${c.company}`)} />;
    case "LassoContactPersons":
      return <LassoContactPersons key={key} data={empty.contactPersons[c.company]} title={c.title} error={err(`contactPersons:${c.company}`)} />;
    case "LassoMultiYearTable":
      return <MultiYearTable key={key} financials={empty.financials[c.company]} metrics={c.metrics} years={c.years} title={c.title} error={err(`financials:${c.company}`)} />;
    case "LassoIncomeStatement":
      return <LassoIncomeStatement key={key} statements={empty.financialStatements[c.company]} years={c.years} title={c.title} error={err(`financialStatements:${c.company}`)} />;
    case "LassoBalanceSheet":
      return <LassoBalanceSheet key={key} statements={empty.financialStatements[c.company]} years={c.years} title={c.title} error={err(`financialStatements:${c.company}`)} />;
    case "LassoCashFlow":
      return <LassoCashFlow key={key} statements={empty.financialStatements[c.company]} years={c.years} title={c.title} error={err(`financialStatements:${c.company}`)} />;
    case "LassoScoreGauge":
      return <ScoreGauge key={key} score={empty.scores[c.company]} title={c.title} error={err(`score:${c.company}`)} />;
    case "LassoRiskObservations":
      return <RiskObservations key={key} data={empty.observations[c.company]} error={err(`observations:${c.company}`)} title={c.title} />;
    case "LassoAuditorIndependence":
      return <AuditorIndependence key={key} data={empty.auditorIndependence[c.company]} error={err(`auditorIndependence:${c.company}`)} title={c.title} />;
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
      return <LassoTextSections key={key} sections={empty.textSections[c.company]} title={c.title} error={err(`textSections:${c.company}`)} />;
    case "LassoSummary":
      return <LassoSummary key={key} text={c.text} title={c.title} source={c.source} updated={c.updated} />;
    case "LassoTimeline":
      return <LassoTimeline key={key} timeline={empty.timeline[c.company]} title={c.title} error={err(`timeline:${c.company}`)} />;
    case "LassoNews":
      return <LassoNews key={key} news={empty.news[c.company]} companyName={empty.companies[c.company]?.name} error={err(`news:${c.company}`)} />;
  }
}

type Indexed = { c: ViewComponent; i: number };
type Band = { kind: "full"; item: Indexed } | { kind: "columns"; columns: Indexed[][] };

/**
 * Layout 'columns' (portalens virksomhedsside): komponenter uden kolonne står i fuld bredde;
 * sammenhængende komponenter med kolonne samles i ét bånd, hvor hver kolonne stabler sine
 * sektioner. Så efterlader en kort sektion aldrig et hul ved siden af en lang.
 */
function columnBands(components: readonly ViewComponent[]): Band[] {
  const bands: Band[] = [];
  components.forEach((c, i) => {
    const col = c.column;
    if (!col) {
      bands.push({ kind: "full", item: { c, i } });
      return;
    }
    let band = bands.at(-1);
    if (!band || band.kind !== "columns") {
      band = { kind: "columns", columns: [] };
      bands.push(band);
    }
    while (band.columns.length < col) band.columns.push([]);
    band.columns[col - 1]!.push({ c, i });
  });
  return bands;
}

/**
 * Den faste ramme om alle visninger: header (logo, navn, datatidspunkt) ->
 * kriterie-chips -> indhold -> handlingsbjælke. Ens uanset indhold.
 */
export function LassoView(props: LassoViewProps) {
  const { spec, dataset, host, onAction, url, theme, loading, savePrefix } = props;
  const [saving, setSaving] = useState(false);
  const [savedUrl, setSavedUrl] = useState<string | undefined>(url);
  // "Gemt"-boksen vises kun lige efter en gemning i denne visning (ikke på en allerede delt side).
  const [justSaved, setJustSaved] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const act = (a: ViewAction) => void onAction(a);

  const unsupported = Object.values(dataset?.searches ?? {}).flatMap((s) => s.unsupportedCriteria ?? []);
  const csv = dataset ? specToCsv(spec, dataset) : null;
  const shareUrl = savedUrl ?? url;

  const copy = async (link: string) => {
    const res = await onAction({ kind: "copy-link", url: link });
    setNotice(res && !res.ok ? res.error : "Link kopieret");
    setTimeout(() => setNotice(null), 2500);
  };

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
            {spec.kind === "company" ? (
              <div className="lasso-frame__eyebrow">Virksomhedsprofil</div>
            ) : (
              <h1 className="lasso-frame__title">{spec.title}</h1>
            )}
            <div className="lasso-frame__meta">
              {spec.subtitle ? <span>{spec.subtitle}</span> : null}
              <span>{loading ? "Henter data…" : formatStamp(dataset?.generatedAt)}</span>
              {dataset?.source === "demo" ? <Badge tone="demo">Demodata</Badge> : null}
            </div>
          </div>
        </header>

        {spec.criteria.length > 0 || (host.refine && spec.kind === "list") ? (
          <FilterPanel criteria={spec.criteria} editable={Boolean(host.refine)} onApply={(criteria) => act({ kind: "set-criteria", criteria })} />
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
                    <div key={`b${b}`} className={`lasso-cell lasso-cell--full lasso-columns lasso-columns--${spec.columns ?? 3}`}>
                      {band.columns.map((col, k) => (
                        <div key={k} className="lasso-column">
                          {col.map(({ c, i }) => (
                            <div key={i} className="lasso-column__item">
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
          {shareUrl ? (
            <button className="lasso-btn" onClick={() => void copy(shareUrl)}>
              Del link
            </button>
          ) : null}
          {/* Én primær knap pr. område, yderst til højre (katalog 01) */}
          {host.save ? (
            <button className="lasso-btn lasso-btn--primary" onClick={() => setSaving(true)} disabled={saving}>
              {shareUrl ? "Gem igen" : "Gem"}
            </button>
          ) : null}
        </footer>
      </div>
    </div>
  );
}
