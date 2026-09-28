import { personCounts, personRisk, type PersonVM } from "@lasso/spec";
import type { ReactNode } from "react";
import { DataState, SourceLine, stateForError } from "../primitives.js";
import { Menu, type MenuItem } from "./Menu.js";
import { ShellIcon } from "./ShellIcons.js";

/** Handling i personhovedet (26d.1): ikonknap 36 px (44 px på mobil) med skærmlæsertekst. */
export interface PersonHeadAction {
  id: string;
  label: string;
  icon: "bell" | "network" | "bookmark" | "download";
  /** Overvågning aktiv: koral kant og ikon, aldrig fyld. */
  accent?: boolean;
  onSelect: () => void;
}

function ActionIcon({ icon }: { icon: PersonHeadAction["icon"] }): ReactNode {
  if (icon === "network") {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="5.5" r="2.5" />
        <circle cx="5.5" cy="18" r="2.5" />
        <circle cx="18.5" cy="18" r="2.5" />
        <path d="M11 7.8L7 15.8M13 7.8l4 8M8 18h8" />
      </svg>
    );
  }
  return <ShellIcon name={icon} size={16} />;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Personhoved (katalog 16). Samme form som virksomhedshovedet (08): navn 28/600, ordet
 * "Person" som ren tekst lige efter navnet (i stedet for status), og en faktalinje, der
 * tæller roller og selskaber adskilt med komma. Ingen initial-cirkel, aldrig CPR eller
 * fuld privatadresse; kun by.
 */
export function PersonHead({ person, error, actions = [], more = [] }: { person?: PersonVM; error?: string; actions?: readonly PersonHeadAction[]; more?: readonly MenuItem[] }) {
  if (!person) {
    if (!error) return <div className="lasso-span-full"><DataState state="loading" lines={2} height={92} /></div>;
    return (
      <div className="lasso-span-full">
        <DataState state={stateForError(error) === "noaccess" ? "empty" : "error"} reason={error} />
      </div>
    );
  }
  const n = personCounts(person);
  const risk = personRisk(person);
  const owns = new Set(person.roles.filter((r) => r.active && r.kind === "owner").map((r) => r.companyId ?? r.companyName)).size;
  const facts = [
    person.city,
    n.activeRoles ? `${plural(n.activeRoles, "aktiv rolle", "aktive roller")} i ${plural(n.activeCompanies, "selskab", "selskaber")}` : "ingen aktive roller",
    owns ? `ejer af ${owns}` : null,
    n.endedRoles ? `${plural(n.endedRoles, "ophørt rolle", "ophørte roller")}` : null,
    risk.bankruptcies.length ? `${plural(risk.bankruptcies.length, "konkurs", "konkurser")} blandt selskaberne` : null,
    n.firstYear ? `første registrering ${n.firstYear}` : null,
  ].filter((f): f is string => Boolean(f));

  return (
    <header className="lasso-personhead lasso-span-full">
      <div className="lasso-personhead__top">
        <div className="lasso-personhead__title">
          <h2 className="lasso-personhead__name">{person.name}</h2>
          <span className="lasso-personhead__kind">Person</span>
        </div>
        {actions.length || more.length ? (
          <div className="lasso-personhead__actions">
            {actions.map((a) => (
              <button key={a.id} type="button" className={`lasso-iconbtn${a.accent ? " lasso-iconbtn--accent" : ""}`} aria-label={a.label} title={a.label} onClick={a.onSelect}>
                <ActionIcon icon={a.icon} />
              </button>
            ))}
            {more.length ? <Menu trigger={<ShellIcon name="more" size={16} />} triggerClassName="lasso-iconbtn" triggerLabel="Flere handlinger" items={more} align="end" context={{ title: person.name, subtitle: "Person" }} /> : null}
          </div>
        ) : null}
      </div>
      <p className="lasso-personhead__facts">{facts.join(", ")}</p>
      <SourceLine source="CVR via Lasso" updated={person.updated} />
    </header>
  );
}
