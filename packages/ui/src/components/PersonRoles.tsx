import { useState, type ReactNode } from "react";
import { ExpandLink, foldedCount, PromptLink } from "./ExpandLink.js";
import {
  PERSON_ROLE_FILTER_EMPTY,
  PERSON_ROLE_FILTER_TITLES,
  personCompanies,
  personRoleRows,
  personWithRole,
  type PersonCompanyVM,
  type PersonRoleFilter,
  type PersonRoleRowVM,
  type PersonRoleVM,
  type PersonRolesShow,
  type PersonVM,
} from "@lasso/spec";
import type { MoreInTab, ViewAction } from "../types.js";
import { DataState, Section, stateForError } from "../primitives.js";
import { usePrintMode } from "../print.js";
import { BandLanes, LaneToggle, RoleLegend, roleBandClass, toneOfKind } from "./BandLanes.js";

/** Regel 9: tre selskaber i tidsbåndene og fem i listerne, resten under "Se alle N" (limit kan ændre det). */
const COLLAPSED = 3;
const LIST_COLLAPSED = 5;

const LIST_TITLE: Record<Exclude<PersonRolesShow, "all">, string> = { current: "Aktive roller", ended: "Ophørte roller", owner: "Ejerskaber" };
const DAY = 86_400_000;

const year = (d?: string) => (d ? d.slice(0, 4) : "");

function bandLabel(r: PersonRoleVM): string {
  const what = `${r.role}${r.share ? ` ${r.share}` : ""}`;
  if (!r.active) return `${what} ${[year(r.from), year(r.to)].filter(Boolean).join("–")}`.trim();
  return r.from ? `${what}, siden ${year(r.from)}` : what;
}

/** Alle roller i selskabet (Jakob 02.10): ledelse først, ejerskab sidst, ældste først inden for hver. */
function bands(c: PersonCompanyVM): PersonRoleVM[] {
  const byFrom = (a: PersonRoleVM, b: PersonRoleVM) => (a.from ?? "").localeCompare(b.from ?? "");
  return [...c.roles.filter((r) => r.kind !== "owner").sort(byFrom), ...c.roles.filter((r) => r.kind === "owner").sort(byFrom)];
}

/** Den samlede etiket på den lukkede linje: "Direktør, siden 2003, ejer 100 %, siden 2008". */
function summaryLabel(list: readonly PersonRoleVM[]): string {
  return list.map((r, i) => (i === 0 ? bandLabel(r) : bandLabel(r).charAt(0).toLowerCase() + bandLabel(r).slice(1))).join(", ");
}

/** Undertekst: alle roller kort, fx "Direktør, ejer 100 %" eller "Under konkurs 2026, fratrådt 2018". */
function subline(c: PersonCompanyVM): string {
  const parts: string[] = [];
  if (c.companyStatusKind === "warning" || c.companyStatusKind === "inactive") {
    parts.push(`${c.companyStatus ?? "Ophørt"}${c.companyEnded ? ` ${year(c.companyEnded)}` : ""}`);
  }
  const seen = new Set<string>();
  for (const r of c.roles) {
    const text = r.active ? `${r.role}${r.share ? ` ${r.share}` : ""}` : c.active ? `tidl. ${r.role.toLowerCase()}` : `fratrådt ${year(r.to)}`.trim();
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    parts.push(parts.length ? text.charAt(0).toLowerCase() + text.slice(1) : text);
  }
  return parts.join(", ");
}

function CompanyName({ c, onOpen }: { c: PersonCompanyVM; onOpen?: (a: ViewAction) => void }) {
  if (onOpen && c.companyId?.startsWith("CVR-1-")) {
    return (
      <button type="button" className="lasso-link lasso-personroles__company" title={c.companyName} onClick={() => onOpen({ kind: "open-company", lassoId: c.companyId!, name: c.companyName })}>
        {c.companyName}
      </button>
    );
  }
  return <span className="lasso-personroles__company" title={c.companyName}>{c.companyName}</span>;
}

function RowCompany({ row, onOpen }: { row: PersonRoleRowVM; onOpen?: (a: ViewAction) => void }) {
  if (onOpen && row.companyId?.startsWith("CVR-1-")) {
    return (
      <button type="button" className="lasso-link lasso-row__open" onClick={() => onOpen({ kind: "open-company", lassoId: row.companyId!, name: row.companyName })}>
        {row.companyName}
      </button>
    );
  }
  return <>{row.companyName}</>;
}

/** "MM.ÅÅÅÅ" fra en ISO-dato. */
const monthYear = (d?: string) => (d && d.length >= 7 ? `${d.slice(5, 7)}.${d.slice(0, 4)}` : year(d));

/** Mobilens undertekst (26d.4): rollerne og "siden 03.2015" (aktive) eller perioden (ophørte). */
function mobileSub(r: PersonRoleRowVM, show: Exclude<PersonRolesShow, "all">): string {
  if (show === "ended") return [r.text, r.period].filter(Boolean).join(", ");
  const first = r.roles.map((x) => x.from).filter((f): f is string => Boolean(f)).sort()[0];
  return first ? `${r.text}, siden ${monthYear(first)}` : r.text;
}

const LIST_EMPTY: Record<Exclude<PersonRolesShow, "all">, string> = {
  current: "Personen har ingen aktive roller i selskaber i CVR.",
  ended: "Personen har ingen ophørte roller i CVR.",
  owner: "Personen ejer ikke selskaber i CVR.",
};

/**
 * Rollerne som kort liste (katalog 11-rækker): én række pr. selskab med navnet (link), rollerne
 * under og perioden i fast kolonne til højre. 'current' = de aktive roller, 'owner' = de selskaber,
 * personen ejer nu (andel og siden-dato), 'ended' = de ophørte, senest ophørte først. Et selskab
 * under konkurs eller ophørt har status med ord i rødt (regel 7). Fem rækker + "Se alle N selskaber".
 */
function PersonRoleList({
  person,
  show,
  limit,
  except,
  heading,
  onOpen,
  moreIn,
  role,
}: {
  person: PersonVM;
  show: Exclude<PersonRolesShow, "all">;
  limit: number;
  except?: "risiko";
  heading: string;
  onOpen?: (a: ViewAction) => void;
  moreIn?: MoreInTab;
  role?: PersonRoleFilter;
}) {
  const [expanded, setExpanded] = useState(usePrintMode());
  const rows = personRoleRows(person, show, { except });
  if (rows.length === 0) {
    return (
      <Section title={heading}>
        <DataState state="empty" reason={role ? PERSON_ROLE_FILTER_EMPTY[role] : except === "risiko" && show === "ended" ? "Personen har ingen andre ophørte roller i CVR." : LIST_EMPTY[show]} />
      </Section>
    );
  }
  const visible = expanded ? rows : rows.slice(0, foldedCount(rows.length, limit));
  // Som smagsprøve peger knappen på fanen Roller, der viser alle personens selskaber.
  const total = moreIn ? personCompanies(person).length : 0;
  return (
    <Section title={heading} className="lasso-personrolelist" action={<span className="lasso-personrolelist__count">{rows.length}</span>}>
      <ul className="lasso-rows">
        {visible.map((r) => (
          <li key={r.key} className="lasso-row">
            <div className="lasso-row__main">
              <div className="lasso-row__name">
                <RowCompany row={r} onOpen={onOpen} />
              </div>
              <div className="lasso-row__sub">
                {r.companyStatus ? (
                  <span className="lasso-status--warning">
                    {r.companyStatus}
                    {r.companyEnded ? ` ${year(r.companyEnded)}` : ""}
                    {", "}
                  </span>
                ) : null}
                {r.companyStatus ? r.text.charAt(0).toLowerCase() + r.text.slice(1) : r.text}
              </div>
            </div>
            {r.period ? <div className="lasso-row__side">{r.period}</div> : null}
            {/* 26d.4 mobil: "Direktør, siden 03.2015" under navnet, status som tekst og chevron til højre. */}
            <div className="lasso-personrolelist__msub">{mobileSub(r, show)}</div>
            <span className={`lasso-personrolelist__mstatus${r.companyStatus ? " is-warning" : ""}`}>{r.companyStatus ?? (show === "ended" ? "Ophørt" : "Aktiv")}</span>
            <svg className="lasso-personrolelist__chev" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </li>
        ))}
      </ul>
      {moreIn ? (
        total > visible.length ? <MoreInButton count={total} moreIn={moreIn} /> : null
      ) : foldedCount(rows.length, limit) < rows.length ? (
        <ExpandLink expanded={expanded} total={rows.length} onToggle={() => setExpanded(!expanded)} />
      ) : null}
    </Section>
  );
}

/**
 * Roller over tid (katalog 16). Én række pr. selskab med højst to tidsbånd (ledelse øverst,
 * ejerskab nederst). Båndet er 6 px, og rolle og startdato står som 11 px tekst OVER båndet.
 * Fratrådte roller er stiplede omrids; konkurs eller ophør er en smal rød markør på tidspunktet.
 * Aksen ender altid i dag. Aktive selskaber først, tre rækker + "Se alle N" (limit ændrer tallet).
 * Med `show` 'current', 'ended' eller 'owner' er rollerne i stedet en kort liste (PersonRoleList).
 */
export function PersonRoles({
  person: whole,
  title,
  show = "all",
  limit,
  except,
  role,
  error,
  onOpen,
  moreIn,
}: {
  person?: PersonVM;
  title?: string;
  show?: PersonRolesShow;
  limit?: number;
  except?: "risiko";
  /** Kun bestyrelsesposter, direktørposter eller ejerskaber (spørgsmålet); titlen følger filteret. */
  role?: PersonRoleFilter;
  error?: string;
  onOpen?: (a: ViewAction) => void;
  /** Smagsprøve på overblikket: "Se alle N selskaber i Roller" åbner fanen i stedet for at folde ud. */
  moreIn?: MoreInTab;
}) {
  const heading = title ?? (role ? PERSON_ROLE_FILTER_TITLES[role] : show === "all" ? "Roller over tid" : LIST_TITLE[show]);
  const print = usePrintMode();
  const [expanded, setExpanded] = useState(print);
  // Jakob 02.10: hver række står på én linje; åbnede rækker viser alle roller hver for sig (print: alle åbne).
  const [openRows, setOpenRows] = useState<ReadonlySet<string>>(new Set());
  const person = whole ? personWithRole(whole, role) : undefined;
  if (!person) {
    return (
      <Section title={heading}>
        {error ? <DataState state={stateForError(error) === "noaccess" ? "empty" : "error"} reason={error} /> : <DataState state="loading" lines={4} height={260} />}
      </Section>
    );
  }
  if (show !== "all") return <PersonRoleList person={person} show={show} limit={limit ?? LIST_COLLAPSED} except={except} heading={heading} onOpen={onOpen} moreIn={moreIn} role={role} />;
  const collapsed = limit ?? COLLAPSED;
  const companies = personCompanies(person);
  if (companies.length === 0) {
    return (
      <Section title={heading}>
        <DataState state="empty" reason={role ? PERSON_ROLE_FILTER_EMPTY[role] : "Personen har ingen registrerede roller i selskaber i CVR."} />
      </Section>
    );
  }

  const now = Date.now();
  const dates = person.roles.flatMap((r) => [r.from, r.companyEnded]).filter((d): d is string => Boolean(d)).map((d) => Date.parse(d)).filter(Number.isFinite);
  const thisYear = new Date(now).getFullYear();
  const startYear = Math.min(thisYear - 3, ...dates.map((d) => new Date(d).getFullYear()));
  const start = Date.UTC(startYear, 0, 1);
  const span = Math.max(DAY, now - start);
  const pos = (d?: string, fallback = now) => {
    const t = d ? Date.parse(d) : fallback;
    return Math.max(0, Math.min(100, ((Number.isFinite(t) ? t : fallback) - start) / span * 100));
  };
  const step = Math.max(1, Math.ceil((thisYear - startYear) / 6));
  const ticks: number[] = [];
  for (let y = startYear; y <= thisYear - step / 2; y += step) ticks.push(y);

  const visible = expanded ? companies : companies.slice(0, foldedCount(companies.length, collapsed));
  const legendNode = <RoleLegend tones={person.roles.map((r) => toneOfKind(r.kind))} />;

  return (
    <Section className="lasso-personroles">
      <div className="lasso-personroles__desk">
      <SectionHead title={heading} action={legendNode} />
      <div className="lasso-personroles__axis" aria-hidden="true">
        <div className="lasso-personroles__spacer" />
        <div className="lasso-personroles__ticks">
          {ticks.map((y, i) => (
            <span key={y} className={`lasso-personroles__tick ${i % 2 === 1 ? "is-minor" : ""}`} style={{ left: `${pos(`${y}-01-01`)}%` }}>
              {y}
            </span>
          ))}
          <span className="lasso-personroles__tick lasso-personroles__tick--now" style={{ right: 0 }}>
            {thisYear}
          </span>
        </div>
      </div>
      <ul className="lasso-personroles__rows">
        {visible.map((c) => {
          const ended = c.companyStatusKind === "warning" || c.companyStatusKind === "inactive";
          const list = bands(c);
          const isOpen = print || openRows.has(c.key);
          return (
            <li key={c.key} className={`lasso-personroles__row ${c.active ? "" : "is-ended"}`}>
              <div className="lasso-personroles__label">
                <div className="lasso-lanes__name">
                  {list.length > 1 && !print ? (
                    <LaneToggle open={isOpen} count={list.length} what="roller" onToggle={() => setOpenRows((prev) => { const n = new Set(prev); if (n.has(c.key)) n.delete(c.key); else n.add(c.key); return n; })} />
                  ) : (
                    <span className="lasso-lanes__spacer" />
                  )}
                  <CompanyName c={c} onOpen={onOpen} />
                </div>
                <div className="lasso-personroles__sub">{subline(c)}</div>
              </div>
              <BandLanes
                open={isOpen}
                summary={summaryLabel(list)}
                segs={list.map((r) => {
                  const left = pos(r.from, start);
                  return { left, width: Math.max(0.8, pos(r.to, now) - left), cls: `lasso-personroles__band ${roleBandClass(toneOfKind(r.kind), !r.active)}`, label: bandLabel(r) };
                })}
              >
                {ended ? (
                  <span
                    className="lasso-personroles__marker"
                    style={{ left: `calc(${pos(c.companyEnded, now)}% - 1px)` }}
                    title={`${c.companyStatus ?? "Ophørt"}${c.companyEnded ? ` ${year(c.companyEnded)}` : ""}`}
                  />
                ) : null}
              </BandLanes>
            </li>
          );
        })}
      </ul>
      {foldedCount(companies.length, collapsed) < companies.length ? (
        moreIn ? (
          <MoreInButton count={companies.length} moreIn={moreIn} />
        ) : (
          <ExpandLink expanded={expanded} total={companies.length} onToggle={() => setExpanded(!expanded)} />
        )
      ) : null}
      </div>
      <MobileBands person={person} title={title} onOpen={onOpen} />
    </Section>
  );
}

function SectionHead({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="lasso-section__head">
      <div className="lasso-section__titles">
        <h3 className="lasso-section__title">{title}</h3>
      </div>
      {action ? <div className="lasso-section__action">{action}</div> : null}
    </div>
  );
}

/** Mobil (26d.3): højst seks rækker før "Vis alle". */
/** 26d.3: korte rolleord i tidsbåndets etiket på mobil, så navnet står helt ("…, bestyrelse"). */
function mobileRole(role: string): string {
  const r = role.toLowerCase();
  if (r === "bestyrelsesmedlem" || r === "bestyrelsesmedlemmer") return "bestyrelse";
  if (r === "bestyrelsesformand") return "formand";
  if (r === "næstformand" || r === "bestyrelsesnæstformand") return "næstformand";
  if (r === "administrerende direktør") return "adm. direktør";
  return r;
}

const MOBILE_ROWS = 5; // global regel (Jakob 01.10): over 6 viser 5 + "Vis alle N"

/**
 * Tidsbånd på mobil (26d.3, container ≤ 560; Jakob 02.10: én række pr. selskab, rollerne under og samlet i én bjælke,
 * pilen folder én bjælke pr. rolle ud). Oprindeligt: én række pr. rolle med etiketten "Selskab, rolle"
 * 14 ink over en 10 px bjælke på en grå bane i fuld bredde og perioden ("2015–") muted til højre.
 * Aksen 2012/2016/…/nu over rækkerne, legenden nederst (Ledelse koral, Ejerskab mørkeblå, Endt i
 * konkurs hul). En rolle i et selskab, der endte i konkurs, er en hul koral-kantet bjælke med muted etiket.
 */
function MobileBands({ person, title, onOpen }: { person: PersonVM; title?: string; onOpen?: (a: ViewAction) => void }) {
  const print = usePrintMode();
  const [all, setAll] = useState(print);
  const [openRows, setOpenRows] = useState<ReadonlySet<string>>(new Set());
  const now = Date.now();
  const thisYear = new Date(now).getFullYear();
  const froms = person.roles.map((r) => r.from).filter((d): d is string => Boolean(d)).map((d) => Number(d.slice(0, 4))).filter(Number.isFinite);
  const startYear = Math.min(thisYear - 4, ...froms);
  const start = Date.UTC(startYear, 0, 1);
  const span = Math.max(DAY, now - start);
  const pos = (d: string | undefined, fallback: number) => {
    const t = d ? Date.parse(d) : fallback;
    return Math.max(0, Math.min(100, (((Number.isFinite(t) ? t : fallback) - start) / span) * 100));
  };
  const ticks: number[] = [];
  for (let y = startYear; y <= thisYear - 3; y += 4) ticks.push(y);
  const bankrupt = (r: PersonRoleVM) => r.companyStatusKind === "warning" || /konkurs/i.test(r.companyStatus ?? "");
  // Jakob 02.10: én række pr. selskab med alle roller samlet (som på desktop); pilen folder rollerne ud.
  const rows = personCompanies(person);
  const shown = all ? rows : rows.slice(0, foldedCount(rows.length, MOBILE_ROWS));
  const roles = rows.flatMap((c) => c.roles);
  const barClass = (r: PersonRoleVM) => `lasso-mbands__bar ${roleBandClass(toneOfKind(r.kind), !r.active)}`;
  /** Bjælken holdes inden for banen: et bånd, der starter i år, flyttes ind, så det ses og ikke løber ud. */
  const bar = (r: PersonRoleVM) => {
    const width = Math.max(1.5, pos(r.to ?? (bankrupt(r) ? r.companyEnded : undefined), now) - pos(r.from, start));
    return { left: Math.min(pos(r.from, start), 100 - width), width };
  };
  const periodOf = (list: readonly PersonRoleVM[]) => {
    const froms = list.map((r) => year(r.from)).filter(Boolean).sort();
    const open = list.some((r) => !r.to);
    const tos = list.map((r) => year(r.to)).filter(Boolean).sort();
    return `${froms[0] ?? ""}–${open ? "" : (tos.at(-1) ?? "")}`;
  };
  const roleText = (r: PersonRoleVM) => `${mobileRole(r.role)}${r.share ? ` ${r.share}` : ""}`;
  return (
    <div className="lasso-personroles__mob">
      <SectionHead title={title ?? "Tidsbånd"} action={<span className="lasso-personroles__range">{`${startYear}–${thisYear}`}</span>} />
      <div className="lasso-mbands__axis" aria-hidden="true">
        {ticks.map((y) => (
          <span key={y} className="lasso-mbands__tick" style={{ left: `${pos(`${y}-01-01`, now)}%` }}>
            {y}
          </span>
        ))}
        <span className="lasso-mbands__tick lasso-mbands__tick--now">nu</span>
      </div>
      <ul className="lasso-mbands__rows">
        {shown.map((c) => {
          const list = bands(c);
          const isOpen = print || openRows.has(c.key);
          const tone = list.every(bankrupt) ? "bankrupt" : "ok";
          const toggle = () => setOpenRows((prev) => { const n = new Set(prev); if (n.has(c.key)) n.delete(c.key); else n.add(c.key); return n; });
          return (
            <li key={c.key} className={`lasso-mbands__row lasso-mbands__row--${tone}`}>
              <span className="lasso-mbands__head">
                <span className="lasso-lanes__name">
                  {list.length > 1 && !print ? <LaneToggle open={isOpen} count={list.length} what="roller" onToggle={toggle} /> : <span className="lasso-lanes__spacer" />}
                  {onOpen && c.companyId?.startsWith("CVR-1-") ? (
                    <button type="button" className="lasso-link lasso-mbands__label" onClick={() => onOpen({ kind: "open-company", lassoId: c.companyId!, name: c.companyName })}>
                      {c.companyName}
                    </button>
                  ) : (
                    <span className="lasso-mbands__label">{c.companyName}</span>
                  )}
                </span>
                <span className="lasso-mbands__period">{periodOf(list)}</span>
              </span>
              {isOpen && list.length > 1 ? (
                list.map((r, i) => (
                  <span key={i} className="lasso-mbands__sub">
                    <span className="lasso-mbands__subhead">
                      <span>{roleText(r)}</span>
                      <span className="lasso-mbands__period">{periodOf([r])}</span>
                    </span>
                    <span className="lasso-mbands__track" aria-hidden="true">
                      <span className={barClass(r)} style={{ left: `${bar(r).left}%`, width: `${bar(r).width}%` }} />
                    </span>
                  </span>
                ))
              ) : (
                <>
                  <span className="lasso-mbands__roles">{list.map(roleText).join(", ")}</span>
                  <span className="lasso-mbands__track" aria-hidden="true">
                    {[...list].sort((x, y) => bar(y).width - bar(x).width).map((r, i) => (
                      <span key={i} className={barClass(r)} style={{ left: `${bar(r).left}%`, width: `${bar(r).width}%` }} />
                    ))}
                  </span>
                </>
              )}
            </li>
          );
        })}
      </ul>
      {foldedCount(rows.length, MOBILE_ROWS) < rows.length ? (
        <ExpandLink expanded={all} total={rows.length} onToggle={() => setAll(!all)} />
      ) : null}
      <div className="lasso-mbands__legend">
        <RoleLegend tones={roles.map((r) => toneOfKind(r.kind))} />
      </div>
    </div>
  );
}

/** "Se alle N selskaber i Roller": åbner fanen, der viser alle personens selskaber (smagsprøve). */
function MoreInButton({ count, moreIn }: { count: number; moreIn: MoreInTab }) {
  return (
    <PromptLink label={`Se alle ${count} selskaber i ${moreIn.tab}`} onClick={moreIn.open} />
  );
}
