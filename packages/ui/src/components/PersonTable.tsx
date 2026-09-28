import { useMemo, useState } from "react";
import { formatNumber, type PersonSearchResultVM, type PersonTableRowVM } from "@lasso/spec";
import type { ViewAction } from "../types.js";
import { Section, stateForError } from "../primitives.js";
import { Pagination, TableSearch, TableStateRows, TableToolbar, type TableState } from "./TableKit.js";

const PAGE_SIZE = 25;
/** Højst to roller står synlige som tekst; resten som "og n flere" (15.3). */
export const VISIBLE_ROLES = 2;

/** "Direktør, Data Eksempel A/S og bestyrelsesmedlem, Nordisk Eksempel ApS og 2 flere". */
export function rolesText(r: Pick<PersonTableRowVM, "roles">): string {
  if (r.roles.length === 0) return "";
  const shown = r.roles.slice(0, VISIBLE_ROLES).map((x) => `${x.role}, ${x.companyName}`);
  const first = shown[0]!.charAt(0).toUpperCase() + shown[0]!.slice(1);
  const rest = r.roles.length - VISIBLE_ROLES;
  return [first, ...shown.slice(1)].join(" og ") + (rest > 0 ? ` og ${rest} flere` : "");
}

/** Fødselsår og by som sekundær linje; aldrig CPR eller fuld adresse. */
export function personSub(r: Pick<PersonTableRowVM, "birthYear" | "city">): string {
  return [r.birthYear ? `f. ${r.birthYear}` : null, r.city].filter(Boolean).join(", ");
}

/**
 * Persontabel (katalog 15.3): samme tabel som virksomhedstabellen med andre kolonner.
 * Navnet står alene (ingen initial-cirkel), fødselsår og by under; højst 2 roller som
 * tekst, resten som "og n flere"; konkurser som tal i rød kun når > 0, ellers "—".
 * Samme værktøjslinje (søgning), paginering og tilstande inde i rammen.
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
  const rows = useMemo(() => {
    const all = result?.rows ?? [];
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return all;
    return all.filter((r) => {
      const hay = `${r.name} ${r.city ?? ""} ${r.roles.map((x) => x.companyName).join(" ")}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }, [result, query]);
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

  const countText = result ? `${formatNumber(total)} person${total === 1 ? "" : "er"}` : undefined;

  return (
    <Section title={title} action={countText ? <span className="lasso-ctable__count">{countText}</span> : undefined} span="full" className="lasso-ctable lasso-ptable">
      <div className="lasso-table-frame lasso-ctable__frame">
        <TableToolbar
          left={
            <TableSearch
              value={query}
              placeholder="Søg i resultatet"
              onChange={(v) => {
                setQuery(v);
                setPage(1);
              }}
            />
          }
        />
        <div className="lasso-table-wrap">
          <table className="lasso-table lasso-ctable__table lasso-ptable__table">
            <thead>
              <tr>
                <th scope="col">Person</th>
                <th scope="col">Aktive roller</th>
                <th scope="col" className="lasso-num">
                  Konkurser
                </th>
              </tr>
            </thead>
            <tbody>
              {state ? (
                <TableStateRows state={state} colSpan={3} />
              ) : (
                pageRows.map((r) => (
                  <tr key={r.lassoId} data-clickable={canDrillDown} onClick={open(r)}>
                    <td className="lasso-cell--name">
                      <span className="lasso-table__name">{r.name}</span>
                      {personSub(r) ? <span className="lasso-table__sub">{personSub(r)}</span> : null}
                    </td>
                    <td className="lasso-cell--wrap lasso-ptable__roles">{rolesText(r) || <span className="lasso-notreported">Ingen aktive roller</span>}</td>
                    <td className="lasso-num">{r.bankruptcies > 0 ? <span className="lasso-ptable__bankrupt">{formatNumber(r.bankruptcies)}</span> : <span className="lasso-notreported">—</span>}</td>
                  </tr>
                ))
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
