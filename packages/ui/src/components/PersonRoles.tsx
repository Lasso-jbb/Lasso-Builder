import { useState } from "react";
import { personCompanies, personRoleRows, type PersonCompanyVM, type PersonRoleRowVM, type PersonRoleVM, type PersonRolesShow, type PersonVM } from "@lasso/spec";
import type { MoreInTab, ViewAction } from "../types.js";
import { DataState, Section, SourceLine, stateForError } from "../primitives.js";

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

/** Højst to bånd pr. række: ledelse øverst, ejerskab nederst (eller en ledelsesrolle mere). */
function bands(c: PersonCompanyVM): PersonRoleVM[] {
  const mgmt = c.roles.filter((r) => r.kind !== "owner");
  const owner = c.roles.filter((r) => r.kind === "owner");
  return [mgmt[0], owner[0] ?? mgmt[1]].filter((r): r is PersonRoleVM => Boolean(r));
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
      <button type="button" className="lasso-link lasso-personroles__company" onClick={() => onOpen({ kind: "open-company", lassoId: c.companyId!, name: c.companyName })}>
        {c.companyName}
      </button>
    );
  }
  return <span className="lasso-personroles__company">{c.companyName}</span>;
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
}: {
  person: PersonVM;
  show: Exclude<PersonRolesShow, "all">;
  limit: number;
  except?: "risiko";
  heading: string;
  onOpen?: (a: ViewAction) => void;
  moreIn?: MoreInTab;
}) {
  const [expanded, setExpanded] = useState(false);
  const rows = personRoleRows(person, show, { except });
  if (rows.length === 0) {
    return (
      <Section title={heading}>
        <DataState state="empty" reason={except === "risiko" && show === "ended" ? "Personen har ingen andre ophørte roller i CVR." : LIST_EMPTY[show]} />
      </Section>
    );
  }
  const visible = expanded ? rows : rows.slice(0, limit);
  // Som smagsprøve peger knappen på fanen Roller, der viser alle personens selskaber (også de
  // ophørte ved siden af de aktive), så den står, når fanen har flere, end listen viser her.
  const total = moreIn ? personCompanies(person).length : 0;
  return (
    <Section title={heading} className="lasso-personrolelist">
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
          </li>
        ))}
      </ul>
      {moreIn ? (
        total > visible.length ? <MoreInButton count={total} moreIn={moreIn} /> : null
      ) : rows.length > limit ? (
        <button type="button" className="lasso-link lasso-more" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
          {expanded ? "Vis færre" : `Se alle ${rows.length} selskaber`}
        </button>
      ) : null}
      <SourceLine source="CVR via Lasso" updated={person.updated} />
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
  person,
  title,
  show = "all",
  limit,
  except,
  error,
  onOpen,
  moreIn,
}: {
  person?: PersonVM;
  title?: string;
  show?: PersonRolesShow;
  limit?: number;
  except?: "risiko";
  error?: string;
  onOpen?: (a: ViewAction) => void;
  /** Smagsprøve på overblikket: "Se alle N selskaber i Roller" åbner fanen i stedet for at folde ud. */
  moreIn?: MoreInTab;
}) {
  const heading = title ?? (show === "all" ? "Roller over tid" : LIST_TITLE[show]);
  const [expanded, setExpanded] = useState(false);
  if (!person) {
    return (
      <Section title={heading}>
        {error ? <DataState state={stateForError(error) === "noaccess" ? "empty" : "error"} reason={error} /> : <DataState state="loading" lines={4} height={260} />}
      </Section>
    );
  }
  if (show !== "all") return <PersonRoleList person={person} show={show} limit={limit ?? LIST_COLLAPSED} except={except} heading={heading} onOpen={onOpen} moreIn={moreIn} />;
  const collapsed = limit ?? COLLAPSED;
  const companies = personCompanies(person);
  if (companies.length === 0) {
    return (
      <Section title={heading}>
        <DataState state="empty" reason="Personen har ingen registrerede roller i selskaber i CVR." />
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

  const kinds = new Set<string>(person.roles.map((r) => (r.kind === "owner" ? "owner" : r.kind === "board" ? "board" : r.kind === "direction" ? "direction" : "other")));
  const legend: [string, string][] = [
    ["direction", "Direktion"],
    ["board", "Bestyrelse"],
    ["owner", "Ejer"],
    ["other", "Anden rolle"],
  ];
  const hasEnded = person.roles.some((r) => !r.active);
  const visible = expanded ? companies : companies.slice(0, collapsed);

  const legendNode = (
    <div className="lasso-personroles__legend" aria-hidden="true">
      {legend
        .filter(([k]) => kinds.has(k))
        .map(([k, label]) => (
          <span key={k} className="lasso-personroles__key">
            <span className={`lasso-personroles__swatch lasso-personroles__swatch--${k}`} />
            {label}
          </span>
        ))}
      {hasEnded ? (
        <span className="lasso-personroles__key">
          <span className="lasso-personroles__swatch lasso-personroles__swatch--ended" />
          Fratrådt
        </span>
      ) : null}
    </div>
  );

  return (
    <Section title={heading} action={legendNode} className="lasso-personroles">
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
          return (
            <li key={c.key} className={`lasso-personroles__row ${c.active ? "" : "is-ended"}`}>
              <div className="lasso-personroles__label">
                <CompanyName c={c} onOpen={onOpen} />
                <div className="lasso-personroles__sub">{subline(c)}</div>
              </div>
              <div className="lasso-personroles__track">
                {bands(c).map((r, i) => {
                  const left = pos(r.from, start);
                  const right = pos(r.to, now);
                  const width = Math.max(0.8, right - left);
                  const anchorRight = left > 55;
                  return (
                    <div key={i} className="lasso-personroles__lane" title={bandLabel(r)}>
                      <span
                        className="lasso-personroles__bandlabel"
                        style={anchorRight ? { right: `${Math.max(0, 100 - right)}%`, textAlign: "right" } : { left: `${left}%` }}
                      >
                        {bandLabel(r)}
                      </span>
                      <span
                        className={`lasso-personroles__band lasso-personroles__band--${r.active ? r.kind : "ended"}`}
                        style={{ left: `${left}%`, width: `${width}%` }}
                      />
                    </div>
                  );
                })}
                {ended ? (
                  <span
                    className="lasso-personroles__marker"
                    style={{ left: `calc(${pos(c.companyEnded, now)}% - 1px)` }}
                    title={`${c.companyStatus ?? "Ophørt"}${c.companyEnded ? ` ${year(c.companyEnded)}` : ""}`}
                  />
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      {companies.length > collapsed ? (
        moreIn ? (
          <MoreInButton count={companies.length} moreIn={moreIn} />
        ) : (
          <button type="button" className="lasso-link lasso-more" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
            {expanded ? "Vis færre" : `Se alle ${companies.length} selskaber`}
          </button>
        )
      ) : null}
      <SourceLine source="CVR via Lasso" updated={person.updated} />
    </Section>
  );
}

/** "Se alle N selskaber i Roller": åbner fanen, der viser alle personens selskaber (smagsprøve). */
function MoreInButton({ count, moreIn }: { count: number; moreIn: MoreInTab }) {
  return (
    <button type="button" className="lasso-link lasso-more" onClick={moreIn.open}>
      {`Se alle ${count} selskaber i ${moreIn.tab}`}
    </button>
  );
}
