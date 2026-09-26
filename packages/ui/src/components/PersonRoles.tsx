import { useState } from "react";
import { personCompanies, type PersonCompanyVM, type PersonRoleVM, type PersonVM } from "@lasso/spec";
import type { ViewAction } from "../types.js";
import { DataState, Section, SourceLine, stateForError } from "../primitives.js";

/** Regel 9: tre selskaber, resten under "Se alle N". */
const COLLAPSED = 3;
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

/**
 * Roller over tid (katalog 16). Én række pr. selskab med højst to tidsbånd (ledelse øverst,
 * ejerskab nederst). Båndet er 6 px, og rolle og startdato står som 11 px tekst OVER båndet.
 * Fratrådte roller er stiplede omrids; konkurs eller ophør er en smal rød markør på tidspunktet.
 * Aksen ender altid i dag. Aktive selskaber først, tre rækker + "Se alle N".
 */
export function PersonRoles({ person, title, error, onOpen }: { person?: PersonVM; title?: string; error?: string; onOpen?: (a: ViewAction) => void }) {
  const heading = title ?? "Roller over tid";
  const [expanded, setExpanded] = useState(false);
  if (!person) {
    return (
      <Section title={heading}>
        {error ? <DataState state={stateForError(error) === "noaccess" ? "empty" : "error"} reason={error} /> : <DataState state="loading" lines={4} height={260} />}
      </Section>
    );
  }
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
  const visible = expanded ? companies : companies.slice(0, COLLAPSED);

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
      {companies.length > COLLAPSED ? (
        <button type="button" className="lasso-link lasso-more" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
          {expanded ? "Vis færre" : `Se alle ${companies.length} selskaber`}
        </button>
      ) : null}
      <SourceLine source="CVR via Lasso" updated={person.updated} />
    </Section>
  );
}
