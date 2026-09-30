import { useState } from "react";
import { isPersonId, statusGroup, statusLabel, type PersonNetworkCompanyVM, type PersonNetworkRowVM, type PersonNetworkVM } from "@lasso/spec";
import type { MoreInTab, ViewAction } from "../types.js";
import { DataState, Section, stateForError } from "../primitives.js";
import { usePrintMode } from "../print.js";
import { Icon } from "./Icon.js";

const COLLAPSED = 3;
/** Højst tre bånd (fælles selskaber) pr. person; resten står i undertitlen som antal. */
const MAX_BANDS = 3;
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

/** Etiketten over båndet: "Selskab, rolle, periode" (Paper LUE-0). */
function bandLabel(c: PersonNetworkCompanyVM): string {
  return [c.companyName, c.role, period(c)].filter(Boolean).join(", ");
}

/** Statusnavnet til etiketten: ", under konkurs" (små bogstaver, sidst i etiketten; Fable runde 6). */
function problemText(c: PersonNetworkCompanyVM): string {
  return (statusLabel(c.status) ?? "Under konkurs").toLowerCase();
}

function overlapText(p: PersonNetworkRowVM): string {
  return p.overlapYears < 1 ? "<1 år" : `${p.overlapYears} år`;
}

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

/**
 * Ét tidsbånd med etiket over (Paper LUE-0): aktivt = chart-2, afsluttet = stiplet omrids på
 * surface-muted. Er det fælles selskab i problemgruppen (05.7), tegnes båndet i bankrupt-tonen (fyldt,
 * når rollerne stadig løber; stiplet med danger-soft flade, når de er afsluttet), og statusnavnet står
 * sidst i etiketten (", under konkurs") i samme røde (Fable runde 6; ingen lodret markør). Etiketten
 * findes i to længder: "Selskab, rolle, periode" og den korte "Selskab, rolle", som bruges, når
 * elementet er smallere end ⅔ (½-bredden og mobil).
 */
function Band({ c, pos, start, now, top }: { c: PersonNetworkCompanyVM; pos: (d: string | undefined, f: number) => number; start: number; now: number; top: number }) {
  const left = pos(c.from, start);
  // Afsluttet uden kendt slutdato: et kort stiplet bånd fra startåret, aldrig til i dag.
  const right = !c.to && c.ended ? left + 2 : pos(c.to, now);
  const width = Math.max(1, right - left);
  // Etiketter nær højre kant højrestilles, så de ikke løber ud af banen.
  const anchorRight = left > 55;
  const bankrupt = isBankrupt(c);
  const status = bankrupt ? <span className="lasso-personnet__bandstatus">{`, ${problemText(c)}`}</span> : null;
  const long = bandLabel(c);
  const short = [c.companyName, c.role].filter(Boolean).join(", ");
  return (
    <div className="lasso-personnet__lane" style={{ top }} title={bankrupt ? `${long}, ${problemText(c)}` : long}>
      <span className="lasso-personnet__bandlabel" style={anchorRight ? { right: `${Math.max(0, 100 - right)}%`, textAlign: "right", maxWidth: `${Math.max(40, right)}%` } : { left: `${left}%`, maxWidth: `${100 - left}%` }}>
        <span className="lasso-personnet__label--long">{long}</span>
        <span className="lasso-personnet__label--short">{short}</span>
        {status}
      </span>
      <span className={`lasso-personnet__band${c.to || c.ended ? " lasso-personnet__band--ended" : ""}${bankrupt ? " lasso-personnet__band--problem" : ""}`} style={{ left: `${left}%`, width: `${width}%` }} />
    </div>
  );
}

/** Banerne for én person: 30 px pr. fælles selskab. Ingen konkursmarkør (runde 6: statussen bæres af båndet). */
function Track({ p, pos, start, now }: { p: PersonNetworkRowVM; pos: (d: string | undefined, f: number) => number; start: number; now: number }) {
  const list = p.companies.slice(0, MAX_BANDS);
  return (
    <div className="lasso-personnet__track" style={{ height: list.length * 30 }}>
      {list.map((c, j) => (
        <Band key={j} c={c} pos={pos} start={start} now={now} top={j * 30 + 4} />
      ))}
    </div>
  );
}

/**
 * Netværk (katalog 16.3, runde 5, Paper LTP-0 / mobil LVN-0): "Sidder sammen med" som tidsbånd i
 * 16.2's sprog. Pr. person ét bånd pr. fælles selskab for perioden, de sad sammen, med etiketten
 * "Selskab, rolle, periode" over båndet; sidder sammen nu = chart-2, afsluttet = stiplet omrids og
 * dæmpet; fælles selskab med problemstatus = båndet i rødt (fyldt/stiplet) og ", under konkurs" sidst i
 * etiketten (runde 6, ingen markør). Standardbredde ⅔; ½ kun med etiketten "Selskab, rolle". Samme akse og 240 px navnekolonne
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
  moreIn,
}: {
  network?: PersonNetworkVM;
  title?: string;
  /** Personer før "Vis alle N" (regel 9): 3 på overblikket, flere på fanen Netværk. */
  limit?: number;
  error?: string;
  onOpen?: (a: ViewAction) => void;
  /** Smagsprøve på overblikket: "Se alle N personer i Netværk" åbner fanen i stedet for at folde ud. */
  moreIn?: MoreInTab;
  /** Udgået (runde 5): 16.3 har ikke længere "Vis som graf". Bevaret, så eksisterende kald kompilerer. */
  onGraph?: () => void;
}) {
  const heading = title ?? "Sidder sammen med";
  const [expanded, setExpanded] = useState(usePrintMode());
  if (!network) {
    return (
      <Section title={heading} span="half">
        {error ? <DataState state={stateForError(error) === "noaccess" ? "empty" : "error"} reason={error} /> : <DataState state="loading" lines={4} height={240} />}
      </Section>
    );
  }
  if (network.people.length === 0) {
    return (
      <Section title={heading} span="half">
        <DataState state="empty" reason="Personen sidder ikke sammen med andre i registrerede selskaber." />
      </Section>
    );
  }
  const rows = expanded ? network.people : network.people.slice(0, limit);
  const now = Date.now();
  const { thisYear, startYear, start, pos } = axis(network.people, now);
  const step = Math.max(1, Math.ceil((thisYear - startYear) / 6));
  const ticks: number[] = [];
  for (let y = startYear; y <= thisYear - step / 2; y += step) ticks.push(y);
  // Mobil: fire årstal (første, to imellem og i dag).
  const mticks = [startYear, Math.round(startYear + (thisYear - startYear) / 3), Math.round(startYear + ((thisYear - startYear) * 2) / 3)];
  const hasEnded = network.people.some((p) => p.companies.some((c) => c.to || c.ended));
  const problems = network.people.flatMap((p) => p.companies.slice(0, MAX_BANDS).filter(isBankrupt));
  const problemNames = [...new Set(problems.map((c) => statusLabel(c.status) ?? "Under konkurs"))];
  // Legenden navngiver statussen (fx "Under konkurs"); flere forskellige problemstatusser står samlet.
  const problemLegend = problemNames.length === 1 ? problemNames[0]! : "Konkurs o.l.";
  const legend = (
    <div className="lasso-personroles__legend" aria-hidden="true">
      <span className="lasso-personroles__key">
        <span className="lasso-personnet__swatch" />
        Sidder sammen nu
      </span>
      {hasEnded ? (
        <span className="lasso-personroles__key">
          <span className="lasso-personnet__swatch lasso-personnet__swatch--ended" />
          Afsluttet
        </span>
      ) : null}
      {problems.length ? (
        <span className="lasso-personroles__key">
          <span className="lasso-personnet__swatch lasso-personnet__swatch--bankrupt" />
          {problemLegend}
        </span>
      ) : null}
    </div>
  );
  const sub = (p: PersonNetworkRowVM) => {
    const n = p.companies.length;
    return `${n} ${n === 1 ? "fælles selskab" : "fælles selskaber"}${p.active ? "" : ", afsluttet"}`;
  };
  const more =
    network.people.length > limit ? (
      moreIn ? (
        <button type="button" className="lasso-link lasso-personnet__more" onClick={moreIn.open}>
          {`Se alle ${network.people.length} personer i ${moreIn.tab}`}
        </button>
      ) : (
        <button type="button" className="lasso-link lasso-personnet__more" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
          {expanded ? "Vis færre" : `Vis alle ${network.people.length}`}
          <Icon name={expanded ? "chevron-up" : "chevron-right"} size={14} />
        </button>
      )
    ) : null;
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
              <div className="lasso-personnet__who">
                <div className="lasso-personroles__label">
                  <PersonName p={p} onOpen={onOpen} className="lasso-personnet__bname" />
                  <div className="lasso-personroles__sub">{sub(p)}</div>
                </div>
                <div className="lasso-personnet__ov">
                  <span className="lasso-personnet__ovn">{overlapText(p)}</span>
                  <span className="lasso-personnet__ovu">{p.active ? "overlap" : "tidligere"}</span>
                </div>
              </div>
              <Track p={p} pos={pos} start={start} now={now} />
            </li>
          ))}
        </ul>
        {more}
      </div>
      <div className="lasso-personnet__mob">
        <div className="lasso-personnet__maxis" aria-hidden="true">
          {[...mticks, thisYear].map((y, i) => (
            <span key={`${y}-${i}`} className={i === 3 ? "is-now" : undefined}>
              {y}
            </span>
          ))}
        </div>
        <ul className="lasso-personnet__mrows">
          {rows.map((p, i) => (
            <li key={`${p.name}-${i}`} className={`lasso-personnet__mrow ${p.active ? "" : "is-ended"}`}>
              <div className="lasso-personnet__mhead">
                <PersonName p={p} onOpen={onOpen} className="lasso-personnet__bname" />
                <span className="lasso-personnet__mov">{p.active ? `${overlapText(p)} overlap` : `${overlapText(p)}, tidligere`}</span>
              </div>
              <Track p={p} pos={pos} start={start} now={now} />
            </li>
          ))}
        </ul>
        {more}
      </div>
    </Section>
  );
}
