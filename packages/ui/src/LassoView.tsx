import { useState } from "react";
import { searchKey, type Dataset, type ViewComponent } from "@lasso/spec";
import { Actions } from "./components/Actions.js";
import { CompanyHeader } from "./components/CompanyHeader.js";
import { CompanyTable } from "./components/CompanyTable.js";
import { Comparison } from "./components/Comparison.js";
import { FilterPanel } from "./components/FilterPanel.js";
import { FinancialChart } from "./components/FinancialChart.js";
import { KeyFigures } from "./components/KeyFigures.js";
import { Ownership } from "./components/Ownership.js";
import { PeopleList } from "./components/PeopleList.js";
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
  const empty: Dataset = ds ?? { source: "live", generatedAt: "", companies: {}, financials: {}, people: {}, ownership: {}, searches: {}, errors: {} };
  const err = (k: string) => empty.errors[k];
  switch (c.type) {
    case "LassoCompanyHeader":
      return <CompanyHeader key={key} company={empty.companies[c.company]} error={err(`company:${c.company}`)} />;
    case "LassoKeyFigures":
      return <KeyFigures key={key} financials={empty.financials[c.company]} metrics={c.metrics} error={err(`financials:${c.company}`)} />;
    case "LassoFinancialChart":
      return <FinancialChart key={key} financials={empty.financials[c.company]} metric={c.metric} years={c.years} error={err(`financials:${c.company}`)} />;
    case "LassoPeopleList":
      return <PeopleList key={key} people={empty.people[c.company]} show={c.show} title={c.title} error={err(`people:${c.company}`)} />;
    case "LassoOwnership":
      return <Ownership key={key} ownership={empty.ownership[c.company]} error={err(`ownership:${c.company}`)} onOpen={props.host.drillDown ? act : undefined} />;
    case "LassoTable": {
      const k = searchKey(c.search);
      return <CompanyTable key={key} result={empty.searches[k]} columns={c.columns} title={c.title} error={err(`search:${k}`)} onAction={act} canDrillDown={Boolean(props.host.drillDown)} />;
    }
    case "LassoComparison":
      return <Comparison key={key} companies={c.companies} metrics={c.metrics} title={c.title} dataset={empty} onAction={act} canDrillDown={Boolean(props.host.drillDown)} />;
    case "LassoActions":
      return <Actions key={key} prompts={c.prompts} onAction={act} enabled={Boolean(props.host.prompt)} />;
  }
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
            <div className="lasso-logo" aria-label="Lasso">L</div>
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
            {spec.components.map((c, i) => renderComponent(c, dataset, props, act, i))}
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
