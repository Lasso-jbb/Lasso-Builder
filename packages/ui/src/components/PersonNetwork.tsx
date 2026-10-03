import { useState } from "react";
import { ExpandLink, foldedCount } from "./ExpandLink.js";
import { isPersonId, networkRole, statusGroup, statusLabel, togetherText, totalPeriodMonths, type NetworkRole, type PersonNetworkCompanyVM, type PersonNetworkRowVM, type PersonNetworkVM } from "@lasso/spec";
import type { MoreInTab, ViewAction } from "../types.js";
import { DataState, Section, stateForError } from "../primitives.js";
import { usePrintMode } from "../print.js";
import { BandLanes, LaneToggle, RoleLegend, roleBandClass, type LaneSeg, type RoleTone } from "./BandLanes.js";

const COLLAPSED = 3;
const DAY = 86_400_000;
const year = (d?: string) => (d ? d.slice(0, 4) : "");

/** "2012–2026" for afsluttede, "siden 2016" for aktive (16.2's sprog). */
function period(c: PersonNetworkCompanyVM): string {
  if (!c.to && c.ended) return c.from ? `${year(c.from)}, ophørt` : "ophørt";
  if (!c.to) return c.from ? `siden ${year(c.from)}` : "";
  return [year(c.from), year(c.to)].filter(Boolean).join("–");
}

/** Problemgruppen (05.7): konkurs, tvangsopløsning, rekonstruktion … Båndet bærer statussen (runde 6). */
function isBankrupt(c: PersonNetworkCompanyVM): boolean {
  // 02c.8: kun problem-statusser (konkurs, tvangsopløsning, rekonstruktion …).
  const group = statusGroup(c.status);
  return group ? group === "problem" : c.statusKind === "warning";
}

const TONE: Record<NetworkRole, RoleTone> = { Ejer: "owner", Direktion: "direction", Bestyrelse: "board", Andet: "other" };
/** Rollens tone (Ejer, Direktion, Bestyrelse, Andet); kun relationer, networkRole ikke udelader. */
const toneOf = (c: PersonNetworkCompanyVM): RoleTone => TONE[networkRole(c.role) ?? "Andet"];

/** Etiketten over et selskabs bånd (åbnet række): "Selskab, rolle, periode" (Paper LUE-0); rollen er en af de fire. */
function bandLabel(c: PersonNetworkCompanyVM): string {
  return [c.companyName, networkRole(c.role)?.toLowerCase(), period(c)].filter(Boolean).join(", ");
}

/**
 * Netværkets relationer, som 16.3 viser dem (Jakob 03.10): stifter og revisor udelades helt (networkRole null), og en
 * person uden andre fælles selskaber står ikke på listen.
 */
export function networkPeople(people: readonly PersonNetworkRowVM[]): PersonNetworkRowVM[] {
  return people.map((p) => ({ ...p, companies: p.companies.filter((c) => networkRole(c.role) !== null) })).filter((p) => p.companies.length > 0);
}

/** Underteksten: kun tiden sammen ("12 år sammen", "7 måneder sammen"), fra overlapMonths eller selskabernes perioder. */
export function networkSub(p: PersonNetworkRowVM, today = new Date().toISOString().slice(0, 10)): string {
  const months = p.overlapMonths ?? totalPeriodMonths(p.companies.filter((c) => c.to || !c.ended).map((c) => ({ from: c.from, to: c.to })), today);
  return togetherText(months);
}

/** Statusnavnet til etiketten: ", under konkurs" (små bogstaver, sidst i etiketten; Fable runde 6). */
function problemText(c: PersonNetworkCompanyVM): string {
  return (statusLabel(c.status) ?? "Under konkurs").toLowerCase();
}

const rowKey = (p: PersonNetworkRowVM, i: number) => p.lassoId ?? `${p.name}-${i}`;

/** Tidsaksen (samme som 16.2): fra det første fælles år (mindst 4 år tilbage) til i dag. */
function axis(people: readonly PersonNetworkRowVM[], now: number) {
  const thisYear = new Date(now).getFullYear();
  const froms = people.flatMap((p) => p.companies.map((c) => c.from)).filter((d): d is string => Boolean(d)).map((d) => Number(d.slice(0, 4))).filter(Number.isFinite);
  const startYear = Math.min(thisYear - 4, ...froms);
  const start = Date.UTC(startYear, 0, 1);
  const span = Math.max(DAY, now - start);
  const pos = (d: string | undefined, fallback: number) => {
    const t = d ? Date.parse(d) : fallback;
    return Math.max(0, Math.min(100, (((Number.isFinite(t) ? t : fallback) - start) / span) * 100));
  };
  return { thisYear, startYear, start, pos };
}

function PersonName({ p, onOpen, className }: { p: PersonNetworkRowVM; onOpen?: (a: ViewAction) => void; className: string }) {
  const open = onOpen && isPersonId(p.lassoId) ? () => onOpen({ kind: "open-person", lassoId: p.lassoId!, name: p.name }) : undefined;
  return open ? (
    <button type="button" className={`lasso-link ${className}`} onClick={open}>
      {p.name}
    </button>
  ) : (
    <span className={className}>{p.name}</span>
  );
}

/** Båndet for ét fælles selskab: aktivt = chart-2, afsluttet = stiplet, problemstatus = rødt (05.7). */
function seg(c: PersonNetworkCompanyVM, pos: (d: string | undefined, f: number) => number, start: number, now: number): LaneSeg {
  const left = pos(c.from, start);
  // Afsluttet uden kendt slutdato: et kort stiplet bånd fra startåret, aldrig til i dag.
  const right = !c.to && c.ended ? left + 2 : pos(c.to, now);
  const bankrupt = isBankrupt(c);
  return {
    left,
    width: Math.max(1, right - left),
    // Jakob 02.10/03.10: rollens farve (direktion, bestyrelse, ejer, andet); konkurs står i etiketten.
    cls: `lasso-personnet__band ${roleBandClass(toneOf(c), Boolean(c.to || c.ended))}`,
    label: bandLabel(c),
    tail: bankrupt ? <span className="lasso-personnet__bandstatus">{`, ${problemText(c)}`}</span> : undefined,
  };
}

/** Etiketten på den lukkede linje (Jakob 03.10): selskabets navn ved ét fælles selskab, ellers "N firmaer". */
export function collapsedLabel(list: readonly PersonNetworkCompanyVM[]): string {
  return list.length === 1 ? list[0]!.companyName : `${list.length} firmaer`;
}

/**
 * Den lukkede linje: ÉT samlet bånd fra den første start til den sidste slutning (Jakob 03.10), i farven fra det
 * længste bånd, dæmpet, når alle relationer er afsluttet; et problemselskab står stadig sidst i etiketten.
 */
function mergedSeg(list: readonly PersonNetworkCompanyVM[], segs: readonly LaneSeg[]): LaneSeg {
  const left = Math.min(...segs.map((x) => x.left));
  const right = Math.max(...segs.map((x) => x.left + x.width));
  const longest = list[segs.reduce((best, x, i) => (x.width > segs[best]!.width ? i : best), 0)]!;
  const ended = list.every((c) => c.to || c.ended);
  const problem = list.find(isBankrupt);
  return {
    left,
    width: Math.max(1, right - left),
    cls: `lasso-personnet__band ${roleBandClass(toneOf(longest), ended)}`,
    label: collapsedLabel(list),
    tail: problem && list.length === 1 ? <span className="lasso-personnet__bandstatus">{`, ${problemText(problem)}`}</span> : undefined,
  };
}

/**
 * Netværk (katalog 16.3, runde 5, Paper LTP-0 / mobil LVN-0): "Sidder sammen med" som tidsbånd i
 * 16.2's sprog. Pr. person ét bånd pr. fælles selskab for perioden, de sad sammen, med etiketten
 * "Selskab, rolle, periode" over båndet; båndet har rollens farve (Jakob 02.10: direktion, bestyrelse, ejer;
 * andre roller stiplede), afsluttede dæmpede, og RoleLegend viser de rollefarver, der forekommer; fælles selskab
 * med problemstatus = ", under konkurs" i rødt sidst i etiketten (runde 6, ingen markør). Står altid i fuld
 * bredde (GRID_RULES: kun fuld). Samme akse og 240 px navnekolonne
 * som 16.2; overlappet ("14 år") står under navnet. Sorteret efter overlap; tre + "Vis alle N".
 * Mobil: ét kort pr. person med navn og overlap øverst, båndene under og en akse med fire årstal.
 * Ingen kildevisning (G3) og ingen "Vis som graf".
 */
export function PersonNetwork({
  network,
  title,
  limit = COLLAPSED,
  error,
  onOpen,
}: {
  network?: PersonNetworkVM;
  title?: string;
  /** Personer før "Vis alle N" (regel 9): 3 på overblikket, flere på fanen Netværk. */
  limit?: number;
  error?: string;
  onOpen?: (a: ViewAction) => void;
  /** Udgået (Jakob 03.10): listen folder altid ud på stedet ("Vis alle N personer"). Bevaret, så eksisterende kald kompilerer. */
  moreIn?: MoreInTab;
  /** Udgået (runde 5): 16.3 har ikke længere "Vis som graf". Bevaret, så eksisterende kald kompilerer. */
  onGraph?: () => void;
}) {
  const heading = title ?? "Sidder sammen med";
  const print = usePrintMode();
  const [expanded, setExpanded] = useState(print);
  // Jakob 02.10: én linje pr. person med alle relationer samlet; åbnede personer viser hver relation for sig.
  const [openRows, setOpenRows] = useState<ReadonlySet<string>>(new Set());
  if (!network) {
    return (
      <Section title={heading} span="half">
        {error ? <DataState state={stateForError(error) === "noaccess" ? "empty" : "error"} reason={error} /> : <DataState state="loading" lines={4} height={240} />}
      </Section>
    );
  }
  const people = networkPeople(network.people);
  if (people.length === 0) {
    return (
      <Section title={heading} span="half">
        <DataState state="empty" reason="Personen sidder ikke sammen med andre i registrerede selskaber." />
      </Section>
    );
  }
  const rows = expanded ? people : people.slice(0, foldedCount(people.length, limit));
  const now = Date.now();
  const { thisYear, startYear, start, pos } = axis(people, now);
  const step = Math.max(1, Math.ceil((thisYear - startYear) / 6));
  const ticks: number[] = [];
  for (let y = startYear; y <= thisYear - step / 2; y += step) ticks.push(y);
  const legend = <RoleLegend tones={people.flatMap((p) => p.companies.map(toneOf))} />;
  // Underteksten er kun tiden sammen (Jakob 03.10), så navnet har hele første kolonne.
  const sub = (p: PersonNetworkRowVM) => networkSub(p);
  // Jakob 03.10: altid et link, der folder listen ud på stedet ("Vis alle 27 personer" / "Vis færre"), aldrig en knap til en anden fane.
  const more =
    foldedCount(people.length, limit) < people.length ? <ExpandLink expanded={expanded} total={people.length} noun="personer" onToggle={() => setExpanded(!expanded)} /> : null;
  return (
    <Section title={heading} span="half" className="lasso-personnet lasso-personnet--bands" action={legend}>
      <div className="lasso-personnet__desk">
        <div className="lasso-personroles__axis" aria-hidden="true">
          <div className="lasso-personroles__spacer" />
          <div className="lasso-personroles__ticks">
            {ticks.map((y, i) => (
              <span key={y} className={`lasso-personroles__tick ${i % 2 === 1 ? "is-minor" : ""}`} style={{ left: `${pos(`${y}-01-01`, now)}%` }}>
                {y}
              </span>
            ))}
            <span className="lasso-personroles__tick lasso-personroles__tick--now" style={{ right: 0 }}>
              {thisYear}
            </span>
          </div>
        </div>
        <ul className="lasso-personroles__rows">
          {rows.map((p, i) => (
            <li key={`${p.name}-${i}`} className={`lasso-personroles__row lasso-personnet__brow ${p.active ? "" : "is-ended"}`}>
              <div className="lasso-personroles__label">
                <div className="lasso-lanes__name">
                  {p.companies.length > 1 && !print ? (
                    <LaneToggle
                      open={openRows.has(rowKey(p, i))}
                      count={p.companies.length}
                      what="fælles selskaber"
                      onToggle={() => setOpenRows((prev) => { const n = new Set(prev); const k = rowKey(p, i); if (n.has(k)) n.delete(k); else n.add(k); return n; })}
                    />
                  ) : (
                    <span className="lasso-lanes__spacer" />
                  )}
                  <PersonName p={p} onOpen={onOpen} className="lasso-personnet__bname" />
                </div>
                <div className="lasso-personroles__sub">{sub(p)}</div>
              </div>
              {(() => {
                const open = print || openRows.has(rowKey(p, i));
                const segs = p.companies.map((c) => seg(c, pos, start, now));
                // Lukket: ét samlet bånd med selskabets navn eller "N firmaer"; åbnet: én linje pr. selskab med rolle og periode.
                return <BandLanes open={open} summary={collapsedLabel(p.companies)} segs={open && segs.length > 1 ? segs : [mergedSeg(p.companies, segs)]} />;
              })()}
            </li>
          ))}
        </ul>
        {more}
      </div>
      {/* Mobil (Jakob 01.10): uden grafik; navn og overlap, under det de fælles selskaber som tekst. */}
      <div className="lasso-personnet__mob">
        <ul className="lasso-personnet__mrows">
          {rows.map((p, i) => (
            <li key={`${p.name}-${i}`} className={`lasso-personnet__mrow ${p.active ? "" : "is-ended"}`}>
              <div className="lasso-personnet__mhead">
                <PersonName p={p} onOpen={onOpen} className="lasso-personnet__bname" />
                <span className="lasso-personnet__mov">{networkSub(p)}</span>
              </div>
              <ul className="lasso-personnet__mcos">
                {p.companies.map((c, k) => (
                  <li key={`${c.companyName}-${k}`} className={isBankrupt(c) ? "is-problem" : undefined}>
                    {bandLabel(c)}
                    {isBankrupt(c) ? `, ${problemText(c)}` : ""}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
        {more}
      </div>
    </Section>
  );
}
