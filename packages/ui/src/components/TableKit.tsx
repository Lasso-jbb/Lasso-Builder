import { useEffect, useRef, type ReactNode } from "react";
import { formatNumber } from "@lasso/spec";
import { CloseIcon } from "./Layer.js";
import { Menu } from "./Menu.js";
import { Icon } from "./Icon.js";

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
  /** 16 px ikon før ordet (15.2: "+ Føj til liste", klokke ved "Overvåg", ⤓ ved "Eksportér"). */
  icon?: ReactNode;
  /** 15.2 mobil: kort ord under ikonet i bundbjælken, fx "Til liste" for "Føj til liste". */
  short?: string;
  /** 15.2 mobil: ikon i "Flere"-arket for en handling uden ikon i bjælken (fx Sammenlign). */
  sheetIcon?: ReactNode;
}

export function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function BellIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 16.5V11a6 6 0 0112 0v5.5l1.5 1.5h-15z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M10 20.5a2 2 0 004 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/** Koralt "delvist markeret"-ikon yderst til venstre i handlingsbjælken (15.2); fuldt flueben ved "alle valgt". */
function BulkCheckIcon({ all }: { all: boolean }) {
  return (
    <svg className="lasso-bulkbar__check" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <rect x="0.5" y="0.5" width="15" height="15" rx="3.5" fill="currentColor" stroke="currentColor" />
      {all ? <path d="M4 8.3l2.6 2.6L12 5.6" fill="none" stroke="var(--lasso-on-accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /> : <path d="M4.5 8h7" stroke="var(--lasso-on-accent)" strokeWidth="1.8" strokeLinecap="round" />}
    </svg>
  );
}

/**
 * Handlingsbjælken (15.2): erstatter værktøjslinjen, 56 px med 1 px ink-kant. Koralt
 * afkrydsningsikon, "2 markeret" 600 og ", vælg alle 1.243" som link, handlinger med ikoner
 * (en destruktiv som rød tekst i outline-knap) og × til højre. Ombrydes på smalle flader.
 */
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
      <BulkCheckIcon all={allSelected || count >= total} />
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
            {a.icon ?? null}
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

/** Højst to handlinger med ikon og ord i mobilens bundbjælke; resten står i "Flere"-arket. */
const MOBILE_BULK_VISIBLE = 2;

/**
 * Massehandlinger på mobil (15.2, runde 5, Paper LOA-0): fast bundbjælke over bundnavigationen
 * (LPJ-0) med markeringsikon og "2 markeret", to handlinger som ikon + ord, "Flere" og × til højre.
 * "Flere" åbner handlingsarket (26a.10, LT2-0) med antal og navne som kontekst, de øvrige handlinger,
 * "Vælg alle N" og den destruktive handling i rødt nederst; Annuller-kortet tegner arket selv.
 */
export function MobileBulkBar({
  count,
  total,
  allSelected,
  onSelectAll,
  actions,
  onClear,
  names = [],
  noun = "virksomheder",
  defaultMoreOpen,
}: {
  count: number;
  total: number;
  allSelected: boolean;
  onSelectAll: () => void;
  actions: readonly BulkAction[];
  onClear: () => void;
  /** De markerede navne til arkets kontekst (de første tre, "og N flere"). */
  names?: readonly string[];
  noun?: string;
  /** Statisk forhåndsvisning (15.2 skærm B): "Flere"-arket åbent fra start. */
  defaultMoreOpen?: boolean;
}) {
  // Handlinger med ikon (Til liste, Overvåg, Eksportér) står i bjælken; resten i "Flere".
  const plain = [...actions.filter((a) => !a.destructive && a.icon), ...actions.filter((a) => !a.destructive && !a.icon)];
  const shown = plain.slice(0, MOBILE_BULK_VISIBLE);
  const rest = [...plain.slice(MOBILE_BULK_VISIBLE)];
  const danger = actions.filter((a) => a.destructive);
  const canAll = !allSelected && total > count;
  const shownNames = names.slice(0, 3).join(", ");
  const subtitle = names.length > 3 ? `${shownNames} og ${names.length - 3} flere` : shownNames || undefined;
  const moreItems = [
    ...rest.map((a) => ({ id: a.id, label: a.label, icon: a.icon ?? a.sheetIcon, disabled: a.disabled, onSelect: a.onSelect })),
    ...(canAll ? [{ id: "select-all", label: `Vælg alle ${formatNumber(total)} ${noun}`, icon: <Icon name="check" size={16} />, onSelect: onSelectAll }] : []),
    ...danger.map((a) => ({ id: a.id, label: a.label, icon: a.icon ?? <Icon name="trash" size={16} />, destructive: true, disabled: a.disabled, onSelect: a.onSelect })),
  ];
  return (
    <div className="lasso-mbulk" role="toolbar" aria-label="Handlinger for markerede">
      <div className="lasso-mbulk__count" aria-live="polite">
        <BulkCheckIcon all={allSelected || count >= total} />
        <span>{formatNumber(count)} markeret</span>
      </div>
      <div className="lasso-mbulk__actions">
        {shown.map((a) => (
          <button key={a.id} type="button" className="lasso-mbulk__btn" onClick={a.onSelect} disabled={a.disabled} title={a.disabled ? a.reason : undefined}>
            {a.icon ?? null}
            <span>{a.short ?? a.label}</span>
          </button>
        ))}
        {moreItems.length ? (
          <Menu
            trigger={
              <>
                <Icon name="more" size={16} />
                <span>Flere</span>
              </>
            }
            triggerClassName="lasso-mbulk__btn"
            triggerLabel="Flere handlinger"
            label="Flere handlinger"
            align="end"
            context={{ title: `${formatNumber(count)} markeret`, subtitle }}
            items={moreItems}
            defaultOpen={defaultMoreOpen}
          />
        ) : null}
      </div>
      <button type="button" className="lasso-mbulk__close" aria-label="Ryd markering" onClick={onClear}>
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

/** Valg af rækker pr. side (15.1: "25 pr. side ⌄"). */
export const PAGE_SIZES = [10, 25, 50, 100] as const;

export function Pagination({
  page,
  pageSize,
  count,
  total,
  onPage,
  noun = "virksomheder",
  onPageSize,
}: {
  page: number;
  pageSize: number;
  count: number;
  total: number;
  onPage: (p: number) => void;
  noun?: string;
  /** Viser "25 pr. side ⌄" ved siden af intervallet, når den er sat. */
  onPageSize?: (n: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(count / pageSize));
  const from = count === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(count, page * pageSize);
  return (
    <nav className="lasso-pager" aria-label="Sider">
      <span className="lasso-pager__info">
        <span className="lasso-pager__range">
          Viser {formatNumber(from)}–{formatNumber(to)} af {formatNumber(total)} {noun}
        </span>
        {onPageSize ? (
          <label className="lasso-pager__size">
            <select className="lasso-pager__select" value={pageSize} aria-label="Rækker pr. side" onChange={(e) => onPageSize(Number(e.target.value))}>
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>{`${n} pr. side`}</option>
              ))}
            </select>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </label>
        ) : null}
      </span>
      {pages > 1 || onPageSize ? (
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

export type TableState =
  | { kind: "loading"; rows?: number; /** 15.4: linje med ring under skelettet, fx "Henter 1.243 virksomheder …". */ label?: string }
  | { kind: "empty"; reason: string; action?: ReactNode; /** 15.4: titel 16/600 over forklaringen, fx "Ingen virksomheder matcher". */ title?: string }
  | { kind: "error"; reason?: string; onRetry?: () => void; /** 15.4: titel, standard "Data kunne ikke hentes". */ title?: string; /** 15.4: "Fejl-id 4F2A, kopiér". */ errorId?: string };

function SearchMinusIcon() {
  return (
    <svg className="lasso-tstate__icon" width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M16 16l4 4M8.5 11h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function WarnIcon() {
  return (
    <svg className="lasso-tstate__icon lasso-tstate__icon--warn" width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M10.3 3.9L2.6 17.5A2 2 0 004.3 20.5h15.4a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M12 9v4.5M12 16.8v.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/** Tom og fejl som blok (bruges i tabelrammen og i mobilens kortliste). */
export function TableStateBox({ state }: { state: Exclude<TableState, { kind: "loading" }> }) {
  if (state.kind === "empty") {
    return (
      <div className="lasso-tstate__box">
        {state.title ? <SearchMinusIcon /> : null}
        {state.title ? <div className="lasso-tstate__title">{state.title}</div> : null}
        <div className="lasso-tstate__text">{state.reason}</div>
        {state.action ? <div className="lasso-tstate__action">{state.action}</div> : null}
      </div>
    );
  }
  return (
    <div className="lasso-tstate__box" role="alert">
      <WarnIcon />
      <div className="lasso-tstate__title">{state.title ?? "Data kunne ikke hentes"}</div>
      {state.reason ? <div className="lasso-tstate__text">{state.reason}</div> : null}
      {state.onRetry || state.errorId ? (
        <div className="lasso-tstate__actions">
          {state.onRetry ? (
            <button type="button" className="lasso-btn lasso-btn--primary lasso-tstate__retry" onClick={state.onRetry}>
              Prøv igen
            </button>
          ) : null}
          {/* 10b regel 5: fejl-id som tekst ved siden af "Prøv igen" (ingen kopiér-link). */}
          {state.errorId ? <span className="lasso-tstate__errid">{`Fejl-id ${state.errorId}`}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

/** Linjen med ring under skelettet (15.4 hentende). */
export function TableLoadingLine({ label }: { label: string }) {
  return (
    <div className="lasso-tstate__loading" role="status">
      <span className="lasso-ring" aria-hidden="true" />
      {label}
    </div>
  );
}

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
        {state.label ? (
          <tr className="lasso-tstate">
            <td colSpan={colSpan}>
              <TableLoadingLine label={state.label} />
            </td>
          </tr>
        ) : null}
      </>
    );
  }
  return (
    <tr className="lasso-tstate">
      <td colSpan={colSpan}>
        <TableStateBox state={state} />
      </td>
    </tr>
  );
}

/** Tekst til browserens download (portal/delt side); værter med egen download får CSV via ViewAction. */
export function slugFile(title: string, ext: string): string {
  const base = title.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "").toLowerCase() || "lasso";
  return `${base}.${ext}`;
}
