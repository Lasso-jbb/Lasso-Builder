import { useMemo, useState } from "react";
import {
  currencyUnit,
  DEFAULT_TABLE_COLUMNS,
  formatAmount,
  formatNumber,
  formatPercent,
  percentChange,
  TABLE_COLUMN_LABELS,
  TABLE_COLUMNS,
  type CompanyRowVM,
  type Criterion,
  type SearchResultVM,
  type TableColumn,
} from "@lasso/spec";
import type { ViewAction } from "../types.js";
import { Section, Sparkline, stateForError, statusTone } from "../primitives.js";
import { rowsToCsv } from "../csv.js";
import { CriteriaChips, FilterSheet } from "./FilterSheet.js";
import { Menu } from "./Menu.js";
import { BulkBar, CheckMark, Checkbox, ColumnsIcon, DownloadIcon, FilterButton, Pagination, TableSearch, TableStateRows, TableToolbar, slugFile, type BulkAction, type TableState } from "./TableKit.js";

const NUMERIC: ReadonlySet<TableColumn> = new Set(["ansatte", "omsaetning", "bruttofortjeneste", "resultat", "udvikling", "score"]);
const SORTABLE: ReadonlySet<TableColumn> = new Set(["navn", "by", "region", "branche", "ansatte", "omsaetning", "bruttofortjeneste", "resultat", "score"]);
/** Rækker pr. side (15.1). */
export const PAGE_SIZE = 25;
const MAX_COLUMNS = 8;

function sortValue(r: CompanyRowVM, c: TableColumn): string | number | null | undefined {
  switch (c) {
    case "navn":
      return r.name;
    case "by":
      return r.city;
    case "region":
      return r.region;
    case "branche":
      return r.industryText;
    case "ansatte":
      return r.employees;
    case "omsaetning":
      return r.revenue;
    case "bruttofortjeneste":
      return r.grossProfit;
    case "resultat":
      return r.profit;
    case "score":
      return r.score;
    default:
      return undefined;
  }
}

export function cellText(r: CompanyRowVM, c: TableColumn): string {
  switch (c) {
    case "navn":
      return r.name;
    case "cvr":
      return r.cvr ?? "";
    case "by":
      return r.city ?? "";
    case "region":
      return r.region ?? "";
    case "branche":
      return r.industryText ?? "";
    case "status":
      return r.status ?? "";
    case "ansatte":
      return formatNumber(r.employees);
    case "omsaetning":
      return formatAmount(r.revenue, currencyUnit(r.currency));
    case "bruttofortjeneste":
      return formatAmount(r.grossProfit, currencyUnit(r.currency));
    case "resultat":
      return formatAmount(r.profit, currencyUnit(r.currency));
    case "udvikling":
      return "";
    case "score":
      return typeof r.score === "number" ? formatNumber(r.score) : "";
  }
}


/** De tre nøgletal på mobilkortet (26c): tabellens tal-kolonner i rækkefølge, fyldt op med standard. */
export function cardFigures(cols: readonly TableColumn[]): TableColumn[] {
  const numeric = cols.filter((c) => NUMERIC.has(c) && c !== "udvikling" && c !== "score");
  const fill: TableColumn[] = ["bruttofortjeneste", "resultat", "ansatte", "omsaetning"];
  const out = [...numeric];
  for (const f of fill) if (out.length < 3 && !out.includes(f)) out.push(f);
  return out.slice(0, 3);
}

const SHORT_LABEL: Partial<Record<TableColumn, string>> = { bruttofortjeneste: "Bruttofortj.", omsaetning: "Omsætning" };

function matches(r: CompanyRowVM, q: string): boolean {
  const hay = `${r.name} ${r.cvr ?? ""} ${r.city ?? ""} ${r.industryText ?? ""}`.toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => hay.includes(w));
}

export interface CompanyTableProps {
  result?: SearchResultVM;
  columns?: readonly TableColumn[];
  title?: string;
  error?: string;
  onAction: (a: ViewAction) => void;
  canDrillDown: boolean;
  /** Søgningens kriterier: tælles i "Filtre (n)" og vises som fjernbare chips på mobil. */
  criteria?: readonly Criterion[];
  /** Værten kan rette kriterierne (host.refine): "Filtre" åbner filterarket, chips kan fjernes. */
  onApplyCriteria?: (c: Criterion[]) => void;
  /** Værten kan hente filer (host.export): "Eksportér" og massehandlingen af samme navn. */
  canExport?: boolean;
  /** Værten kan stille spørgsmål (host.prompt): massehandlingen "Sammenlign" (2–6 markeret). */
  canPrompt?: boolean;
  /** Værten kan gemme sider (host.savePage): massehandlingen "Gem". */
  canSavePage?: boolean;
  /** Fejl: "Prøv igen" (host.refresh). */
  onRetry?: () => void;
  pageSize?: number;
}

/**
 * Virksomhedstabel (katalog 15.1, 15.2; mobil 26c). Værktøjslinje med søgning, filtre,
 * kolonnevalg og eksport; sorterbart hoved med pil ved aktiv kolonne; afkrydsning, der
 * skifter værktøjslinjen ud med handlingsbjælken; rækker på 52 px; paginering nederst.
 * Tom, henter og fejl står altid inde i tabelrammen under hovedet. Under 560 px bliver
 * tabellen en kortliste med filtrene i et bundark.
 */
export function CompanyTable({
  result,
  columns,
  title,
  error,
  onAction,
  canDrillDown,
  criteria = [],
  onApplyCriteria,
  canExport = false,
  canPrompt = false,
  canSavePage = false,
  onRetry,
  pageSize = PAGE_SIZE,
}: CompanyTableProps) {
  const initialCols = columns?.length ? columns : DEFAULT_TABLE_COLUMNS;
  const [cols, setCols] = useState<readonly TableColumn[]>(initialCols);
  const [sort, setSort] = useState<{ col: TableColumn; dir: 1 | -1 } | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [allSelected, setAllSelected] = useState(false);
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const [filtersOpen, setFiltersOpen] = useState(false);

  const rows = useMemo(() => {
    if (!result) return [];
    const base = result.rows.filter((r) => !hidden.has(r.lassoId) && (!query.trim() || matches(r, query)));
    if (!sort) return base;
    return [...base].sort((a, b) => {
      const va = sortValue(a, sort.col);
      const vb = sortValue(b, sort.col);
      if (va === vb) return 0;
      if (va === null || va === undefined) return 1;
      if (vb === null || vb === undefined) return -1;
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * sort.dir;
      return String(va).localeCompare(String(vb), "da") * sort.dir;
    });
  }, [result, sort, query, hidden]);

  const narrowed = Boolean(query.trim()) || hidden.size > 0;
  const total = result ? (narrowed ? rows.length : Math.max(result.total ?? rows.length, rows.length)) : 0;
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, pages);
  const pageRows = rows.slice((current - 1) * pageSize, current * pageSize);
  const selectable = true;
  const selectedRows = allSelected ? rows : rows.filter((r) => selected.has(r.lassoId));
  const selCount = allSelected ? total : selectedRows.length;

  const clearSelection = () => {
    setSelected(new Set());
    setAllSelected(false);
  };
  const toggleRow = (id: string, on: boolean) => {
    const next = new Set(allSelected ? rows.map((r) => r.lassoId) : selected);
    if (on) next.add(id);
    else next.delete(id);
    setAllSelected(false);
    setSelected(next);
  };
  const pageAllOn = pageRows.length > 0 && pageRows.every((r) => allSelected || selected.has(r.lassoId));
  const pageSomeOn = pageRows.some((r) => allSelected || selected.has(r.lassoId));
  const togglePage = (on: boolean) => {
    const next = new Set(allSelected ? rows.map((r) => r.lassoId) : selected);
    for (const r of pageRows) {
      if (on) next.add(r.lassoId);
      else next.delete(r.lassoId);
    }
    setAllSelected(false);
    setSelected(next);
  };

  const toggleSort = (col: TableColumn) =>
    setSort((s) => (s?.col === col ? (s.dir === -1 ? { col, dir: 1 } : null) : { col, dir: NUMERIC.has(col) ? -1 : 1 }));
  const toggleCol = (c: TableColumn) =>
    setCols((cs) => (cs.includes(c) ? cs.filter((x) => x !== c) : cs.length >= MAX_COLUMNS ? cs : TABLE_COLUMNS.filter((x) => x === c || cs.includes(x))));
  const exportRows = (list: readonly CompanyRowVM[]) =>
    onAction({ kind: "export", filename: slugFile(title ?? "virksomheder", "csv"), csv: rowsToCsv(list, cols) });

  const showCvrUnderName = !cols.includes("cvr");
  // 15.1: uden statuskolonne står en status, der ikke er "Aktiv", som ren tekst i navnets anden linje.
  const statusUnderName = !cols.includes("status");
  const colSpan = cols.length + (selectable ? 1 : 0);

  const bulkActions: BulkAction[] = [];
  if (canPrompt) {
    const ok = !allSelected && selCount >= 2 && selCount <= 6;
    bulkActions.push({
      id: "compare",
      label: "Sammenlign",
      disabled: !ok,
      reason: "Markér 2–6 virksomheder for at sammenligne",
      onSelect: () => onAction({ kind: "prompt", prompt: `Sammenlign ${selectedRows.map((r) => `${r.name} (${r.lassoId})`).join(", ")} på nøgletal.` }),
    });
  }
  if (canSavePage) {
    bulkActions.push({
      id: "save",
      label: "Gem",
      disabled: selCount > 50,
      reason: "Højst 50 ad gangen",
      onSelect: () => selectedRows.slice(0, 50).forEach((r) => onAction({ kind: "save-page", lassoId: r.lassoId, pageKind: "company", name: r.name })),
    });
  }
  if (canExport) bulkActions.push({ id: "export", label: "Eksportér", onSelect: () => exportRows(selectedRows) });
  bulkActions.push({
    id: "remove",
    label: "Fjern fra visningen",
    destructive: true,
    onSelect: () => {
      setHidden(new Set([...hidden, ...selectedRows.map((r) => r.lassoId)]));
      clearSelection();
    },
  });

  const state: TableState | null = !result
    ? error
      ? stateForError(error) === "noaccess"
        ? { kind: "empty", reason: error }
        : { kind: "error", reason: error, onRetry }
      : { kind: "loading", rows: 5 }
    : result.rows.length === 0
      ? {
          kind: "empty",
          reason: "Ingen virksomheder matcher kriterierne. Prøv at fjerne et kriterium eller søge bredere.",
          action:
            onApplyCriteria && criteria.length ? (
              <button type="button" className="lasso-btn" onClick={() => onApplyCriteria([])}>
                Ryd filtre
              </button>
            ) : undefined,
        }
      : rows.length === 0
        ? {
            kind: "empty",
            reason: query.trim() ? `Ingen rækker matcher "${query.trim()}".` : "Alle rækker er fjernet fra visningen.",
            action: (
              <button
                type="button"
                className="lasso-btn"
                onClick={() => {
                  setQuery("");
                  setHidden(new Set());
                }}
              >
                Vis alle igen
              </button>
            ),
          }
        : null;

  const toolbar =
    selCount > 0 ? (
      <BulkBar count={selCount} total={total} allSelected={allSelected} onSelectAll={() => setAllSelected(true)} actions={bulkActions} onClear={clearSelection} />
    ) : (
      <TableToolbar
        left={
          <>
            <TableSearch
              value={query}
              placeholder="Søg i resultatet"
              onChange={(v) => {
                setQuery(v);
                setPage(1);
              }}
            />
            {onApplyCriteria ? <FilterButton count={criteria.length} onClick={() => setFiltersOpen(true)} /> : null}
          </>
        }
        right={
          <>
            <Menu
              trigger={
                <>
                  <ColumnsIcon />
                  <span className="lasso-tbtn__label">Kolonner</span>
                </>
              }
              triggerClassName="lasso-btn lasso-tbtn lasso-tbtn--optional"
              triggerLabel="Vælg kolonner"
              align="end"
              label="Kolonner"
              context={{ title: "Kolonner", subtitle: `Højst ${MAX_COLUMNS}` }}
              items={TABLE_COLUMNS.filter((c) => c !== "navn").map((c) => ({
                id: c,
                label: TABLE_COLUMN_LABELS[c],
                icon: cols.includes(c) ? <CheckMark /> : <span />,
                disabled: !cols.includes(c) && cols.length >= MAX_COLUMNS,
                onSelect: () => toggleCol(c),
              }))}
            />
            {canExport ? (
              <button type="button" className="lasso-btn lasso-tbtn lasso-ctable__export" onClick={() => exportRows(rows)} disabled={!result || rows.length === 0}>
                <DownloadIcon />
                <span className="lasso-tbtn__label">Eksportér</span>
              </button>
            ) : null}
          </>
        }
      />
    );

  const countText = result ? `${formatNumber(total)} virksomhed${total === 1 ? "" : "er"}` : undefined;

  return (
    <Section title={title} action={countText ? <span className="lasso-ctable__count">{countText}</span> : undefined} span="full" className="lasso-ctable">
      <div className="lasso-table-frame lasso-ctable__frame">
        {toolbar}
        {criteria.length ? <CriteriaChips className="lasso-ctable__chips" criteria={criteria} onApply={onApplyCriteria} /> : null}
        <div className="lasso-table-wrap">
          <table className={`lasso-table lasso-ctable__table ${cols.length >= 7 ? "lasso-ctable__table--dense" : ""}`}>
            <thead>
              <tr>
                {selectable ? (
                  <th scope="col" className="lasso-cell--check">
                    <Checkbox checked={pageAllOn} indeterminate={!pageAllOn && pageSomeOn} onChange={togglePage} label="Markér alle på siden" />
                  </th>
                ) : null}
                {cols.map((c) => (
                  <th key={c} data-col={c} className={[NUMERIC.has(c) ? "lasso-num" : "", sort?.col === c ? "is-sorted" : ""].join(" ").trim() || undefined} scope="col" aria-sort={sort?.col === c ? (sort.dir === 1 ? "ascending" : "descending") : undefined}>
                    {SORTABLE.has(c) ? (
                      <button type="button" onClick={() => toggleSort(c)}>
                        {c === "navn" ? "Virksomhed" : TABLE_COLUMN_LABELS[c]}
                        {sort?.col === c ? <span aria-hidden="true">{sort.dir === 1 ? "↑" : "↓"}</span> : null}
                      </button>
                    ) : (
                      TABLE_COLUMN_LABELS[c]
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {state ? (
                <TableStateRows state={state} colSpan={colSpan} />
              ) : (
                pageRows.map((r) => {
                  const on = allSelected || selected.has(r.lassoId);
                  return (
                    <tr
                      key={r.lassoId}
                      className={[r.statusKind === "inactive" ? "is-ended" : "", on ? "is-selected" : ""].join(" ").trim() || undefined}
                      data-clickable={canDrillDown}
                      onClick={canDrillDown ? () => onAction({ kind: "open-company", lassoId: r.lassoId, name: r.name }) : undefined}
                    >
                      {selectable ? (
                        <td className="lasso-cell--check" onClick={(e) => e.stopPropagation()}>
                          <Checkbox checked={on} onChange={(v) => toggleRow(r.lassoId, v)} label={`Markér ${r.name}`} />
                        </td>
                      ) : null}
                      {cols.map((c) => (
                        <td
                          key={c}
                          data-col={c}
                          data-label={TABLE_COLUMN_LABELS[c]}
                          className={[NUMERIC.has(c) ? "lasso-num" : "", sort?.col === c ? "is-sorted" : "", c === "navn" ? "lasso-cell--name" : "", c === "udvikling" ? "lasso-cell--trend" : "", c === "branche" ? "lasso-cell--wrap" : "", c === "by" ? "lasso-cell--nowrap" : ""].join(" ").trim() || undefined}
                        >
                          {c === "navn" ? (
                            <>
                              <span className="lasso-table__name">{r.name}</span>
                              {(showCvrUnderName && r.cvr) || (statusUnderName && r.status && r.statusKind && r.statusKind !== "active") || r.city ? (
                                <span className="lasso-table__sub">
                                  {showCvrUnderName && r.cvr ? <span>CVR {r.cvr}</span> : null}
                                  {/* 26f.2: byen står under navnet (med by-kolonne kun på tablet, hvor kolonnen skjules). */}
                                  {r.city ? <span className={cols.includes("by") ? "lasso-ctable__subcity" : undefined}>{showCvrUnderName && r.cvr ? ", " : ""}{r.city}</span> : null}
                                  {statusUnderName && r.status && r.statusKind && r.statusKind !== "active" ? (
                                    <>
                                      {showCvrUnderName && r.cvr ? ", " : ""}
                                      <span className={`lasso-status lasso-status--${statusTone(r.status, r.statusKind)}`}>{r.status}</span>
                                    </>
                                  ) : null}
                                </span>
                              ) : null}
                            </>
                          ) : c === "status" ? (
                            r.status ? <span className={`lasso-status lasso-status--${statusTone(r.status!, r.statusKind ?? "active")}`}>{r.status}</span> : <span className="lasso-notreported">Ikke oplyst</span>
                          ) : c === "udvikling" ? (
                            (r.trend?.length ?? 0) >= 2 ? <Trend values={r.trend!} /> : <span className="lasso-notreported">—</span>
                          ) : NUMERIC.has(c) && sortValue(r, c) == null ? (
                            <span className="lasso-notreported">Ikke oplyst</span>
                          ) : NUMERIC.has(c) && (sortValue(r, c) as number) < 0 ? (
                            <span className="lasso-down">{cellText(r, c)}</span>
                          ) : (
                            cellText(r, c) || <span className="lasso-notreported">—</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {/* Mobil (26c): kortliste. Navn + status, CVR og by, tynd linje, tre nøgletal og score. */}
        {state ? null : (
          <ul className="lasso-ccards" aria-label={title ?? "Virksomheder"}>
            {pageRows.map((r) => (
              <CompanyCard
                key={r.lassoId}
                r={r}
                figures={cardFigures(cols)}
                selected={allSelected || selected.has(r.lassoId)}
                onSelect={(v) => toggleRow(r.lassoId, v)}
                onOpen={canDrillDown ? () => onAction({ kind: "open-company", lassoId: r.lassoId, name: r.name }) : undefined}
              />
            ))}
          </ul>
        )}
        {result && !state ? <Pagination page={current} pageSize={pageSize} count={rows.length} total={total} onPage={setPage} /> : null}
      </div>
      {onApplyCriteria ? <FilterSheet open={filtersOpen} criteria={criteria} onApply={onApplyCriteria} onClose={() => setFiltersOpen(false)} /> : null}
    </Section>
  );
}

function figureValue(r: CompanyRowVM, c: TableColumn) {
  const v = sortValue(r, c);
  if (v == null) return <span className="lasso-notreported">—</span>;
  if (c === "ansatte") return formatNumber(v as number);
  return <span className={typeof v === "number" && v < 0 ? "lasso-down" : undefined}>{formatAmount(v as number, currencyUnit(r.currency))}</span>;
}

function CompanyCard({ r, figures, selected, onSelect, onOpen }: { r: CompanyRowVM; figures: readonly TableColumn[]; selected: boolean; onSelect: (on: boolean) => void; onOpen?: () => void }) {
  return (
    <li className={`lasso-ccard ${selected ? "is-selected" : ""} ${r.statusKind === "inactive" ? "is-ended" : ""}`} data-clickable={Boolean(onOpen)} onClick={onOpen}>
      <div className="lasso-ccard__top">
        <span className="lasso-ccard__check" onClick={(e) => e.stopPropagation()}>
          <Checkbox checked={selected} onChange={onSelect} label={`Markér ${r.name}`} />
        </span>
        <div className="lasso-ccard__id">
          <span className="lasso-ccard__name">{r.name}</span>
          <span className="lasso-ccard__sub">{[r.cvr ? `CVR ${r.cvr}` : null, r.city].filter(Boolean).join(", ") || "Ikke oplyst"}</span>
        </div>
        {r.status ? <span className={`lasso-status lasso-status--${statusTone(r.status!, r.statusKind ?? "active")} lasso-ccard__status`}>{r.status}</span> : null}
      </div>
      <dl className="lasso-ccard__figs">
        {figures.map((c) => (
          <div key={c}>
            <dt>{SHORT_LABEL[c] ?? TABLE_COLUMN_LABELS[c]}</dt>
            <dd>{figureValue(r, c)}</dd>
          </div>
        ))}
        <div>
          <dt>Score</dt>
          <dd>{typeof r.score === "number" ? formatNumber(r.score) : <span className="lasso-notreported">—</span>}</dd>
        </div>
      </dl>
    </li>
  );
}

/** Udvikling i tabeller: sparkline i koral + procent (grøn/rød), katalog 15. */
function Trend({ values }: { values: readonly number[] }) {
  const pct = percentChange([values.at(-2), values.at(-1)]);
  return (
    <span className="lasso-trend">
      <Sparkline values={values} tone="accent" bare />
      <span className={`lasso-trend__pct ${pct !== null && pct < 0 ? "lasso-down" : "lasso-up"}`}>{formatPercent(pct)}</span>
    </span>
  );
}
