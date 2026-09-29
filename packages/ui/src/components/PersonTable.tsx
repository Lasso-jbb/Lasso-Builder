import { useMemo, useState } from "react";
import { formatDate, formatNumber, type PersonSearchResultVM, type PersonTableRowVM } from "@lasso/spec";
import type { ViewAction } from "../types.js";
import { Section, stateForError } from "../primitives.js";
import { Menu } from "./Menu.js";
import { BulkBar, Checkbox, Pagination, TableSearch, TableStateRows, TableToolbar, type TableState } from "./TableKit.js";

const PAGE_SIZE = 25;
/** Højst to rolleord står synlige som tekst; resten som "+n" (15.3). */
export const VISIBLE_ROLES = 2;

/** Rolleordet uden ejerandel, fx "ejer 100 %" -> "ejer". */
const roleWord = (role: string) => role.replace(/\s+\d.*$/, "").trim();

/** De synlige rolleord og antallet af resterende roller: { text: "Direktør, bestyrelsesmedlem", more: 2 }. */
export function rolesSummary(r: Pick<PersonTableRowVM, "roles">): { text: string; more: number } {
  const words: string[] = [];
  let used = 0;
  for (const x of r.roles) {
    const w = roleWord(x.role).toLowerCase();
    if (words.length >= VISIBLE_ROLES && !words.includes(w)) break;
    used++;
    if (!words.includes(w)) words.push(w);
  }
  const text = words.join(", ");
  return { text: text.charAt(0).toUpperCase() + text.slice(1), more: r.roles.length - used };
}

/** "Direktør, bestyrelsesmedlem +1" som ren tekst (CSV, skærmlæsere og mobilkortet). */
export function rolesText(r: Pick<PersonTableRowVM, "roles">): string {
  if (r.roles.length === 0) return "";
  const { text, more } = rolesSummary(r);
  return more > 0 ? `${text} +${more}` : text;
}

/** "Født 1978, København" som sekundær linje; aldrig CPR eller fuld adresse. */
export function personSub(r: Pick<PersonTableRowVM, "birthYear" | "city">): string {
  return [r.birthYear ? `Født ${r.birthYear}` : null, r.city].filter(Boolean).join(", ");
}

function DotsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="5.5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="18.5" cy="12" r="1.6" />
    </svg>
  );
}

/**
 * Persontabel (katalog 15.3): samme tabel som virksomhedstabellen med andre kolonner:
 * markering, Person (navn alene, "Født 1978, København" under), "Roller, aktive" (højst to
 * rolleord + "+n"), Selskaber, Konkurser (rødt tal eller "—"), Seneste ændring og "…"-menu.
 * Samme værktøjslinje (søgning), handlingsbjælke, paginering og tilstande inde i rammen.
 */
export function PersonTable({
  result,
  title,
  error,
  onAction,
  canDrillDown,
  onRetry,
  pageSize = PAGE_SIZE,
}: {
  result?: PersonSearchResultVM;
  title?: string;
  error?: string;
  onAction: (a: ViewAction) => void;
  canDrillDown: boolean;
  onRetry?: () => void;
  pageSize?: number;
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const rows = useMemo(() => {
    const all = (result?.rows ?? []).filter((r) => !hidden.has(r.lassoId));
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return all;
    return all.filter((r) => {
      const hay = `${r.name} ${r.city ?? ""} ${r.roles.map((x) => x.companyName).join(" ")}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }, [result, query, hidden]);
  const total = result ? (query.trim() ? rows.length : Math.max(result.total ?? rows.length, rows.length)) : 0;
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, pages);
  const pageRows = rows.slice((current - 1) * pageSize, current * pageSize);
  const open = (r: PersonTableRowVM) => (canDrillDown ? () => onAction({ kind: "open-person", lassoId: r.lassoId, name: r.name }) : undefined);

  const state: TableState | null = !result
    ? error
      ? stateForError(error) === "noaccess"
        ? { kind: "empty", reason: error }
        : { kind: "error", reason: error, onRetry }
      : { kind: "loading", rows: 3 }
    : result.rows.length === 0
      ? { kind: "empty", reason: `Ingen personer matcher "${result.query}". Prøv med færre navne eller en anden stavemåde.` }
      : rows.length === 0
        ? {
            kind: "empty",
            reason: `Ingen rækker matcher "${query.trim()}".`,
            action: (
              <button type="button" className="lasso-btn" onClick={() => setQuery("")}>
                Vis alle igen
              </button>
            ),
          }
        : null;

  const pageAllOn = pageRows.length > 0 && pageRows.every((r) => selected.has(r.lassoId));
  const pageSomeOn = pageRows.some((r) => selected.has(r.lassoId));
  const toggle = (ids: readonly string[], on: boolean) => {
    const next = new Set(selected);
    for (const id of ids) {
      if (on) next.add(id);
      else next.delete(id);
    }
    setSelected(next);
  };
  const hide = (ids: readonly string[]) => {
    setHidden(new Set([...hidden, ...ids]));
    setSelected(new Set());
  };

  const countText = result ? `${formatNumber(total)} person${total === 1 ? "" : "er"}` : undefined;

  return (
    <Section title={title} action={countText ? <span className="lasso-ctable__count">{countText}</span> : undefined} span="full" className="lasso-ctable lasso-ptable">
      <div className="lasso-table-frame lasso-ctable__frame">
        {selected.size > 0 ? (
          <BulkBar
            count={selected.size}
            total={total}
            allSelected={false}
            onSelectAll={() => toggle(rows.map((r) => r.lassoId), true)}
            onClear={() => setSelected(new Set())}
            noun="personer"
            actions={[{ id: "remove", label: "Fjern fra liste", destructive: true, onSelect: () => hide([...selected]) }]}
          />
        ) : (
          <TableToolbar
            left={
              <TableSearch
                value={query}
                placeholder={result && total > 0 ? `Søg i ${formatNumber(total)} personer` : "Søg i listen"}
                onChange={(v) => {
                  setQuery(v);
                  setPage(1);
                }}
              />
            }
          />
        )}
        <div className="lasso-table-wrap">
          <table className="lasso-table lasso-ctable__table lasso-ptable__table">
            <thead>
              <tr>
                <th scope="col" className="lasso-cell--check">
                  <Checkbox checked={pageAllOn} indeterminate={!pageAllOn && pageSomeOn} onChange={(on) => toggle(pageRows.map((r) => r.lassoId), on)} label="Markér alle på siden" />
                </th>
                <th scope="col">Person</th>
                <th scope="col">Roller, aktive</th>
                <th scope="col" className="lasso-num">
                  Selskaber
                </th>
                <th scope="col" className="lasso-num">
                  Konkurser
                </th>
                <th scope="col" className="lasso-num">
                  Seneste ændring
                </th>
                <th scope="col" className="lasso-cell--menu">
                  <span className="lasso-sr">Handlinger</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {state ? (
                <TableStateRows state={state} colSpan={7} />
              ) : (
                pageRows.map((r) => {
                  const on = selected.has(r.lassoId);
                  const roles = rolesSummary(r);
                  return (
                    <tr key={r.lassoId} className={on ? "is-selected" : undefined} data-clickable={canDrillDown} onClick={open(r)}>
                      <td className="lasso-cell--check" onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={on} onChange={(v) => toggle([r.lassoId], v)} label={`Markér ${r.name}`} />
                      </td>
                      <td className="lasso-cell--name">
                        <span className="lasso-table__name">{r.name}</span>
                        {personSub(r) ? <span className="lasso-table__sub">{personSub(r)}</span> : null}
                      </td>
                      <td className="lasso-ptable__roles">
                        {r.roles.length ? (
                          <>
                            {roles.text}
                            {roles.more > 0 ? <span className="lasso-ptable__more">{` +${roles.more}`}</span> : null}
                          </>
                        ) : (
                          <span className="lasso-notreported">Ingen aktive roller</span>
                        )}
                      </td>
                      <td className="lasso-num">{typeof r.companies === "number" ? formatNumber(r.companies) : <span className="lasso-notreported">—</span>}</td>
                      <td className="lasso-num">{r.bankruptcies > 0 ? <span className="lasso-ptable__bankrupt">{formatNumber(r.bankruptcies)}</span> : <span className="lasso-notreported">—</span>}</td>
                      <td className="lasso-num">{r.lastChange ? formatDate(r.lastChange) : <span className="lasso-notreported">—</span>}</td>
                      <td className="lasso-cell--menu" onClick={(e) => e.stopPropagation()}>
                        <Menu
                          trigger={<DotsIcon />}
                          triggerClassName="lasso-iconbtn lasso-rowmenu"
                          triggerLabel={`Handlinger for ${r.name}`}
                          align="end"
                          label={r.name}
                          items={[
                            ...(canDrillDown ? [{ id: "open", label: "Åbn person", onSelect: () => onAction({ kind: "open-person", lassoId: r.lassoId, name: r.name }) }] : []),
                            { id: "remove", label: "Fjern fra liste", destructive: true, onSelect: () => hide([r.lassoId]) },
                          ]}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {state ? null : (
          <ul className="lasso-ccards" aria-label={title ?? "Personer"}>
            {pageRows.map((r) => (
              <li key={r.lassoId} className="lasso-ccard lasso-pcard" data-clickable={canDrillDown} onClick={open(r)}>
                <div className="lasso-ccard__top">
                  <div className="lasso-ccard__id">
                    <span className="lasso-ccard__name">{r.name}</span>
                    {personSub(r) ? <span className="lasso-ccard__sub">{personSub(r)}</span> : null}
                  </div>
                  {r.bankruptcies > 0 ? (
                    <span className="lasso-ccard__status lasso-ptable__bankrupt">
                      {formatNumber(r.bankruptcies)} konkurs{r.bankruptcies === 1 ? "" : "er"}
                    </span>
                  ) : null}
                </div>
                <p className="lasso-pcard__roles">{rolesText(r) || "Ingen aktive roller"}</p>
              </li>
            ))}
          </ul>
        )}
        {result && !state ? <Pagination page={current} pageSize={pageSize} count={rows.length} total={total} onPage={setPage} noun="personer" /> : null}
      </div>
    </Section>
  );
}
