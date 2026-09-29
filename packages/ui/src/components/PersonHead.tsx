import type { ReactNode } from "react";
import { personCounts, personRisk, type HeadVariant, type PersonVM } from "@lasso/spec";
import { DataState, stateForError } from "../primitives.js";
import { HeadActions, hasHeadActions, type HeadActionsProps } from "./HeadActions.js";
import { HeadRiskLine, personRiskSummary } from "./HeadRisk.js";

/** Antal observationer til linket i navnelinjen (16.1): stråmand, PEP-match og sager, personen var med i. */
export function personObservationCount(person: PersonVM): number {
  const risk = personRisk(person);
  const involved = [...risk.bankruptcies, ...risk.dissolutions].filter((c) => c.involved).length;
  return (person.strawman?.level === "possible" ? 1 : 0) + (person.pep?.match ? 1 : 0) + involved;
}

/** Tællerlinjen på mobil (26d.1): "3 aktive roller, 2 tidligere, 1 konkurs i netværk". */
export function personCountsLine(person: PersonVM): string {
  const n = personCounts(person);
  const bankrupt = personRisk(person).bankruptcies.length;
  return [
    plural(n.activeRoles, "aktiv rolle", "aktive roller"),
    n.endedRoles ? `${n.endedRoles} tidligere` : null,
    bankrupt ? `${plural(bankrupt, "konkurs", "konkurser")} i netværk` : null,
  ]
    .filter(Boolean)
    .join(", ");
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Faktalinjen (16.1): by, roller og selskaber, ejerskaber, ophørte roller, konkurser, første registrering. */
export function personFactsLine(person: PersonVM, variant: HeadVariant = "full"): string[] {
  const n = personCounts(person);
  const risk = personRisk(person);
  const owns = new Set(person.roles.filter((r) => r.active && r.kind === "owner").map((r) => r.companyId ?? r.companyName)).size;
  const roles = n.activeRoles ? `${plural(n.activeRoles, "aktiv rolle", "aktive roller")} i ${plural(n.activeCompanies, "selskab", "selskaber")}` : "ingen aktive roller";
  if (variant !== "full") return [person.city ?? null, roles].filter((f): f is string => Boolean(f));
  return [
    person.birthYear ? `Født ${person.birthYear}` : null,
    person.city ?? null,
    roles,
    owns ? `ejer af ${owns}` : null,
    n.endedRoles ? `${plural(n.endedRoles, "ophørt rolle", "ophørte roller")}` : null,
    risk.bankruptcies.length ? `${plural(risk.bankruptcies.length, "konkurs", "konkurser")} blandt selskaberne` : null,
    n.firstYear ? `første registrering ${n.firstYear}` : null,
  ].filter((f): f is string => Boolean(f));
}

export interface PersonHeadProps {
  person?: PersonVM;
  error?: string;
  variant?: HeadVariant;
  /** Ikonknapperne øverst til højre (Overvåg, Gem, Eksportér, Flere), som i 08.1. */
  actions?: HeadActionsProps;
  /** Klik på "Se risiko" i observationslinjen. */
  onSeeRisk?: () => void;
  below?: ReactNode;
  /** 25.3: observationerne som linje med ikon og "Se risiko" under faktalinjen (personsiden) i stedet for "N observationer"-linket. */
  riskLine?: boolean;
}

/**
 * Personhoved (katalog 16.1). Samme komponent som virksomhedshovedet (08): navn 28/600, ordet
 * "Person" som ren tekst lige efter navnet (i stedet for status), en faktalinje, der tæller roller og
 * selskaber adskilt med komma, og handlinger som 32 px ikonknapper øverst til højre. Observationer
 * opsummeres som én rolig linje med "Se risiko" (udfoldes i risikoblokken). Ingen initial-cirkel,
 * aldrig CPR eller fuld privatadresse; kun by.
 */
export function PersonHead({ person, error, variant = "full", actions, onSeeRisk, below, riskLine = false }: PersonHeadProps) {
  if (!person) {
    const height = variant === "line" ? 40 : variant === "compact" ? 56 : 92;
    if (!error) return <div className="lasso-span-full"><DataState state="loading" lines={variant === "full" ? 2 : 1} height={height} /></div>;
    return (
      <div className="lasso-span-full">
        <DataState state={stateForError(error) === "noaccess" ? "empty" : "error"} reason={error} />
      </div>
    );
  }
  const facts = personFactsLine(person, variant);

  if (variant === "line") {
    return (
      <header className="lasso-headline lasso-span-full">
        <h2 className="lasso-headline__name">{person.name}</h2>
        <span className="lasso-personhead__kind">Person</span>
        <span className="lasso-headline__facts">{facts.join(", ")}</span>
      </header>
    );
  }
  if (variant === "compact") {
    const compactActs: HeadActionsProps | undefined = actions ? { monitor: actions.monitor, context: actions.context } : undefined;
    return (
      <header className="lasso-headcompact lasso-span-full">
        <div className="lasso-headcompact__main">
          <div className="lasso-headcompact__title">
            <h2 className="lasso-headcompact__name">{person.name}</h2>
            <span className="lasso-headcompact__status">Person</span>
          </div>
          <p className="lasso-headcompact__facts">{facts.join(", ")}</p>
        </div>
        {hasHeadActions(compactActs) ? <HeadActions {...compactActs!} /> : null}
      </header>
    );
  }

  const summary = personRiskSummary(person);
  const obs = summary ? Math.max(1, personObservationCount(person)) : 0;
  const obsText = `${obs} observation${obs === 1 ? "" : "er"}`;
  const showActions = hasHeadActions(actions);
  return (
    <header className={`lasso-personhead lasso-company lasso-span-full${showActions ? " lasso-company--actions" : ""}`}>
      <div className="lasso-company__title">
        <h2 className="lasso-company__name">{person.name}</h2>
        <span className="lasso-personhead__kind">Person</span>
        {obs && !riskLine ? (
          onSeeRisk ? (
            <button type="button" className="lasso-link lasso-personhead__obs" onClick={onSeeRisk} title={summary!.text}>
              {obsText}
            </button>
          ) : (
            <span className="lasso-personhead__obs" title={summary!.text}>
              {obsText}
            </span>
          )
        ) : null}
      </div>
      {/* 26d.1 mobil: "Person, f. 1978" under navnet og tællerlinjen i stedet for faktalinjen. */}
      <p className="lasso-personhead__mobsub">{["Person", person.birthYear ? `f. ${person.birthYear}` : null].filter(Boolean).join(", ")}</p>
      {showActions ? <HeadActions {...actions!} className="lasso-company__actions" /> : null}
      <p className="lasso-company__facts lasso-personhead__facts">{facts.join(", ")}</p>
      <p className="lasso-personhead__counts">{personCountsLine(person)}</p>
      {/* 25.3: på den sammensatte personside står observationerne som linje under faktalinjen (som 24.4). */}
      {riskLine && summary ? <HeadRiskLine summary={summary} onSee={onSeeRisk} /> : null}
      {below}
    </header>
  );
}
