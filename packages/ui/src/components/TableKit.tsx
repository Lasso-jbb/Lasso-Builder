import { useEffect, useRef, type ReactNode } from "react";
import { formatNumber } from "@lasso/spec";
import { CloseIcon } from "./Layer.js";

/**
 * Fælles dele til tabellerne i katalog 15 (virksomhedstabel 15.1, massehandlinger 15.2,
 * persontabel 15.3): værktøjslinje, afkrydsning, handlingsbjælke, paginering og tilstande
 * inde i tabelrammen. Rene UI-dele; tabellerne ejer data og markering.
 */

/* ---------- Afkrydsning ---------- */

export function Checkbox({ checked, indeterminate = false, onChange, label }: { checked: boolean; indeterminate?: boolean; onChange: (on: boolean) => void; label: string }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      className="lasso-check"
      checked={checked}
      aria-label={label}
      aria-checked={indeterminate ? "mixed" : checked}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => onChange(e.target.checked)}
    />
  );
}

/* ---------- Værktøjslinje (15.1): søg, filtre, kolonner, eksport. 56 px, knapper ombrydes aldrig ---------- */

export function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M16 16l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function FilterIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function ColumnsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9.5 4.5v15M14.5 4.5v15" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 4v11M7 10.5l5 5 5-5M5 20h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CheckMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function TableSearch({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="lasso-tsearch">
      <SearchIcon />
      <input className="lasso-tsearch__input" type="search" value={value} placeholder={placeholder} aria-label={placeholder} onChange={(e) => onChange(e.target.value)} />
      {value ? (
        <button type="button" className="lasso-tsearch__clear" aria-label="Ryd søgning" onClick={() => onChange("")}>
          <CloseIcon size={14} />
        </button>
      ) : null}
    </label>
  );
}

/** "Filtre (2)": antallet af aktive filtre som tekst i knappen (aldrig et badge). */
export function FilterButton({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <button type="button" className="lasso-btn lasso-tbtn" onClick={onClick} aria-haspopup="dialog">
      <FilterIcon />
      <span>Filtre{count > 0 ? ` (${count})` : ""}</span>
    </button>
  );
}

export function TableToolbar({ left, right }: { left: ReactNode; right?: ReactNode }) {
  return (
    <div className="lasso-ttoolbar" role="toolbar" aria-label="Tabelværktøjer">
      <div className="lasso-ttoolbar__left">{left}</div>
      {right ? <div className="lasso-ttoolbar__right">{right}</div> : null}
    </div>
  );
}

/* ---------- Massehandlinger (15.2): erstatter værktøjslinjen, 56 px, 1 px ink-kant ---------- */

export interface BulkAction {
  id: string;
  label: string;
  onSelect: () => void;
  destructive?: boolean;
  disabled?: boolean;
  /** Forklaring ved deaktiveret handling (title). */
  reason?: string;
}

export function BulkBar({
  count,
  total,
  allSelected,
  onSelectAll,
  actions,
  onClear,
  noun = "virksomheder",
}: {
  count: number;
  total: number;
  allSelected: boolean;
  onSelectAll: () => void;
  actions: readonly BulkAction[];
  onClear: () => void;
  noun?: string;
}) {
  return (
    <div className="lasso-bulkbar" role="toolbar" aria-label="Handlinger for markerede rækker">
      <div className="lasso-bulkbar__count" aria-live="polite">
        <span className="lasso-bulkbar__n">{formatNumber(count)} markeret</span>
        {!allSelected && total > count ? (
          <>
            ,{" "}
            <button type="button" className="lasso-bulkbar__all" onClick={onSelectAll}>
              vælg alle {formatNumber(total)}
            </button>
          </>
        ) : allSelected && total > 1 ? (
          <span className="lasso-bulkbar__note">, alle {noun} i resultatet</span>
        ) : null}
      </div>
      <div className="lasso-bulkbar__actions">
        {actions.map((a) => (
          <button
            key={a.id}
            type="button"
            className={`lasso-btn lasso-tbtn ${a.destructive ? "lasso-bulkbar__danger" : ""}`}
            onClick={a.onSelect}
            disabled={a.disabled}
            title={a.disabled ? a.reason : undefined}
          >
            {a.label}
          </button>
        ))}
      </div>
      <button type="button" className="lasso-bulkbar__close" aria-label="Ryd markering" onClick={onClear}>
        <CloseIcon />
      </button>
    </div>
  );
}

/* ---------- Paginering: aktiv side = ink 600 + 2 px understregning, aldrig fyld ---------- */

/** Sidetal med "…": første, sidste og siderne omkring den aktive (1 2 3 … 50). */
export function pageItems(page: number, pages: number): (number | "…")[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const keep = new Set([1, pages, page - 1, page, page + 1]);
  if (page <= 3) [2, 3, 4].forEach((p) => keep.add(p));
  if (page >= pages - 2) [pages - 1, pages - 2, pages - 3].forEach((p) => keep.add(p));
  const list = [...keep].filter((p) => p >= 1 && p <= pages).sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  list.forEach((p, i) => {
    if (i > 0 && p - list[i - 1]! > 1) out.push("…");
    out.push(p);
  });
  return out;
}

export function Pagination({ page, pageSize, count, total, onPage, noun = "virksomheder" }: { page: number; pageSize: number; count: number; total: number; onPage: (p: number) => void; noun?: string }) {
  const pages = Math.max(1, Math.ceil(count / pageSize));
  const from = count === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(count, page * pageSize);
  return (
    <nav className="lasso-pager" aria-label="Sider">
      <span className="lasso-pager__range">
        Viser {formatNumber(from)}–{formatNumber(to)} af {formatNumber(total)} {noun}
      </span>
      {pages > 1 ? (
        <div className="lasso-pager__pages">
          <button type="button" className="lasso-pager__step" onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Forrige side">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {pageItems(page, pages).map((p, i) =>
            p === "…" ? (
              <span key={`gap${i}`} className="lasso-pager__gap" aria-hidden="true">
                …
              </span>
            ) : (
              <button key={p} type="button" className={`lasso-pager__page ${p === page ? "is-on" : ""}`} aria-current={p === page ? "page" : undefined} onClick={() => onPage(p)}>
                {p}
              </button>
            ),
          )}
          <button type="button" className="lasso-pager__step" onClick={() => onPage(page + 1)} disabled={page >= pages} aria-label="Næste side">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      ) : null}
    </nav>
  );
}

/* ---------- Tilstande inde i tabelrammen: hovedet bliver stående ---------- */

export type TableState = { kind: "loading"; rows?: number } | { kind: "empty"; reason: string; action?: ReactNode } | { kind: "error"; reason?: string; onRetry?: () => void };

/** Rækker til <tbody>, når tabellen ikke har data: skelet i rækkehøjde, tom med årsag, fejl med "Prøv igen". */
export function TableStateRows({ state, colSpan }: { state: TableState; colSpan: number }) {
  if (state.kind === "loading") {
    return (
      <>
        {Array.from({ length: state.rows ?? 5 }, (_, i) => (
          <tr key={i} className="lasso-tstate__skel" aria-hidden={i > 0 ? "true" : undefined}>
            <td colSpan={colSpan}>
              <div className="lasso-tstate__skelrow" aria-busy={i === 0 ? "true" : undefined} aria-label={i === 0 ? "Henter data" : undefined}>
                <span className="lasso-skeleton" style={{ width: `${38 - (i % 3) * 6}%` }} />
                <span className="lasso-skeleton" style={{ width: "14%" }} />
                <span className="lasso-skeleton" style={{ width: "10%" }} />
              </div>
            </td>
          </tr>
        ))}
      </>
    );
  }
  return (
    <tr className="lasso-tstate">
      <td colSpan={colSpan}>
        {state.kind === "empty" ? (
          <div className="lasso-tstate__box">
            <div className="lasso-tstate__text">{state.reason}</div>
            {state.action ? <div className="lasso-tstate__action">{state.action}</div> : null}
          </div>
        ) : (
          <div className="lasso-tstate__box" role="alert">
            <div className="lasso-tstate__title">Data kunne ikke hentes</div>
            {state.reason ? <div className="lasso-tstate__text">{state.reason}</div> : null}
            {state.onRetry ? (
              <button type="button" className="lasso-btn lasso-tstate__retry" onClick={state.onRetry}>
                Prøv igen
              </button>
            ) : null}
          </div>
        )}
      </td>
    </tr>
  );
}

/** Tekst til browserens download (portal/delt side); værter med egen download får CSV via ViewAction. */
export function slugFile(title: string, ext: string): string {
  const base = title.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "").toLowerCase() || "lasso";
  return `${base}.${ext}`;
}
