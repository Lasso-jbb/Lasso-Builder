import type { ReactNode } from "react";
import { personCounts, personRisk, type HeadVariant, type PersonVM } from "@lasso/spec";
import { DataState, stateForError } from "../primitives.js";
import { HeadActions, hasHeadActions, type HeadActionsProps } from "./HeadActions.js";

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
 * Personhoved (katalog 16.1, 25.3, 26d.1). Samme komponent som virksomhedshovedet (08): kun navnet
 * 28/600 og handlingerne som 32 px ikonknapper øverst til højre (Jakob 29.09, G9). Faktalinjen,
 * ordet "Person" og observationslinjen udgår; risikoen står i risikoblokken. `onSeeRisk` og
 * `riskLine` modtages stadig (bagudkompatibelt), men tegner intet.
 */
export function PersonHead({ person, error, variant = "full", actions, below }: PersonHeadProps) {
  if (!person) {
    const height = variant === "line" ? 40 : variant === "compact" ? 56 : 92;
    if (!error) return <div className="lasso-span-full"><DataState state="loading" lines={variant === "full" ? 2 : 1} height={height} /></div>;
    return (
      <div className="lasso-span-full">
        <DataState state={stateForError(error) === "noaccess" ? "empty" : "error"} reason={error} />
      </div>
    );
  }
  // 16.1 (Jakob 29.09, G9): kun navnet. Intet "Person", ingen faktalinje, tællerlinje eller
  // observationslinje under navnet, og ingen skillestreg under hovedet. Handlinger kun med funktion (G1).
  if (variant === "line") {
    return (
      <header className="lasso-headline lasso-span-full">
        <h2 className="lasso-headline__name">{person.name}</h2>
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
          </div>
        </div>
        {hasHeadActions(compactActs) ? <HeadActions {...compactActs!} /> : null}
      </header>
    );
  }

  const showActions = hasHeadActions(actions);
  return (
    <header className={`lasso-personhead lasso-company lasso-span-full${showActions ? " lasso-company--actions" : ""}${actions?.center ? " lasso-company--center" : ""}`}>
      <div className="lasso-company__title">
        <h2 className="lasso-company__name" title={person.name}>{person.name}</h2>
      </div>
      {actions?.center ? <div className="lasso-company__center">{actions.center}</div> : null}
      {showActions ? <HeadActions {...actions!} className="lasso-company__actions" /> : null}
      {below}
    </header>
  );
}
