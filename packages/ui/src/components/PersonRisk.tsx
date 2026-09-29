import { formatDate, personCompanies, personRisk, type PersonRiskCaseVM, type PersonVM } from "@lasso/spec";
import type { ViewAction } from "../types.js";
import type React from "react";
import { DataState, Section, SeverityIcon, stateForError } from "../primitives.js";
import { Icon } from "./Icon.js";

import { ShellIcon } from "./ShellIcons.js";

const year = (d?: string) => (d ? d.slice(0, 4) : "");

type Tone = "none" | "25" | "50" | "100" | "neutral" | "unknown" | "locked";

/** Ingen sager: "Nej"; kun sager, personen havde forladt: "Neutral"; ellers "Mulig". */
function level(cases: PersonRiskCaseVM[]): { word: string; tone: Tone } {
  if (cases.length === 0) return { word: "Nej", tone: "none" };
  return cases.some((c) => c.involved) ? { word: "Mulig", tone: "50" } : { word: "Neutral", tone: "neutral" };
}

function CheckIcon() {
  return <Icon name="check" size={18} className="lasso-personrisk__check" />;
}

function caseText(c: PersonRiskCaseVM): string {
  const what = `${c.status.toLowerCase()}${c.date ? ` ${year(c.date)}` : ""}`;
  if (!c.personLeft) return `${what}. Personen har stadig en rolle.`;
  const before = c.yearsBefore !== undefined && c.yearsBefore > 0 ? `, ${c.yearsBefore} år før` : "";
  return `${what}. Personen fratrådte ${year(c.personLeft)}${before}.`;
}

function ToneIcon({ tone }: { tone: Tone }) {
  if (tone === "none") return <CheckIcon />;
  if (tone === "locked") return <ShellIcon name="lock" size={18} className="lasso-personrisk__lock" />;
  if (tone === "unknown" || tone === "neutral") return <SeverityIcon severity={0} />;
  return <SeverityIcon severity={tone === "100" ? 100 : tone === "50" ? 50 : 25} />;
}

/**
 * Én flise i den lodrette liste (16.4): ikon 20 px til venstre, titel 15/600 (evt. med tal),
 * forklaring under og vurderingsordet i farve yderst til højre (regel 7: ikon + ord).
 */
function Tile({
  label,
  count,
  desc,
  word,
  tone,
  children,
  action,
}: {
  label: string;
  count?: number;
  desc: string;
  word?: string;
  tone: Tone;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <li className={`lasso-personrisk__item${tone === "locked" ? " lasso-personrisk__item--locked" : ""}`}>
      <span className="lasso-personrisk__icon">
        <ToneIcon tone={tone} />
      </span>
      <div className="lasso-personrisk__main">
        <div className="lasso-personrisk__title">
          {label}
          {count ? <span className="lasso-personrisk__count">{count}</span> : null}
        </div>
        <div className="lasso-personrisk__desc">{desc}</div>
        {children}
      </div>
      {word ? <span className={`lasso-personrisk__word lasso-personrisk__word--${tone}`}>{word}</span> : null}
      {action ?? null}
    </li>
  );
}

function PepTile({ person }: { person: PersonVM }) {
  const pep = person.pep;
  const label = "PEP, politisk eksponeret";
  if (!pep) return <Tile label={label} desc="PEP-opslaget er ikke foretaget for personen." word="Ikke tjekket" tone="unknown" />;
  if (pep.match) return <Tile label={label} desc={pep.detail ?? `Match i Finanstilsynets PEP-liste${pep.checkedAt ? `, tjekket ${formatDate(pep.checkedAt)}` : ""}.`} word="Ja" tone="50" />;
  return <Tile label={label} desc={`Ingen match i Finanstilsynets PEP-liste${pep.checkedAt ? `, tjekket ${formatDate(pep.checkedAt)}` : ""}.`} word="Nej" tone="none" />;
}

function StrawmanTile({ person }: { person: PersonVM }) {
  const s = person.strawman;
  if (!s) return <Tile label="Stråmandsindikator" desc="Indikatoren er ikke beregnet for personen." word="Ikke beregnet" tone="unknown" />;
  if (s.level === "possible") return <Tile label="Stråmandsindikator" desc={s.detail ?? "Rollerne ligner et mønster, der ses ved stråmænd."} word="Mulig" tone="50" />;
  return <Tile label="Stråmandsindikator" desc={s.detail ?? "Rollerne viser ikke mønstre, der ses ved stråmænd."} word="Nej" tone="none" />;
}

function NetworkTile({ cases, companies, onOpen }: { cases: PersonRiskCaseVM[]; companies: number; onOpen?: (a: ViewAction) => void }) {
  const { word, tone } = level(cases);
  const desc = cases.length
    ? `${cases.length} af personens ${companies} ${companies === 1 ? "selskab" : "selskaber"} er gået konkurs eller tvangsopløst.`
    : companies === 1
      ? "Personens selskab er hverken gået konkurs eller tvangsopløst."
      : `Ingen af personens ${companies} selskaber er gået konkurs eller tvangsopløst.`;
  return (
    <Tile label="Konkurser i netværket" count={cases.length || undefined} desc={desc} word={word} tone={tone}>
      {cases.length ? (
        <ul className="lasso-personrisk__cases">
          {cases.map((c, i) => (
            <li key={i}>
              {onOpen && c.companyId?.startsWith("CVR-1-") ? (
                <button type="button" className="lasso-link lasso-personrisk__company" onClick={() => onOpen({ kind: "open-company", lassoId: c.companyId!, name: c.companyName })}>
                  {c.companyName}
                </button>
              ) : (
                <span className="lasso-personrisk__company">{c.companyName}</span>
              )}
              , {caseText(c)}
            </li>
          ))}
        </ul>
      ) : null}
    </Tile>
  );
}

function SanctionsTile({ person, onUpgrade }: { person: PersonVM; onUpgrade?: () => void }) {
  const s = person.sanctions;
  if (!s || !s.available) {
    return (
      <Tile
        label="Sanktionslister"
        desc={s ? "Tjek mod EU's og FN's sanktionslister er ikke en del af din pakke." : "Tjek mod sanktionslister er ikke tilgængeligt endnu."}
        tone="locked"
        action={
          onUpgrade ? (
            <button type="button" className="lasso-btn lasso-btn--sm lasso-personrisk__upgrade" onClick={onUpgrade}>
              Opgrader
            </button>
          ) : null
        }
      />
    );
  }
  if (s.match) return <Tile label="Sanktionslister" desc={`Match på en sanktionsliste${s.checkedAt ? `, tjekket ${formatDate(s.checkedAt)}` : ""}.`} word="Match" tone="100" />;
  return <Tile label="Sanktionslister" desc={`Ingen match${s.checkedAt ? `, tjekket ${formatDate(s.checkedAt)}` : ""}.`} word="Nej" tone="none" />;
}

/**
 * Personrisiko (katalog 16.4): fire fliser som lodret liste i fuld bredde: PEP, stråmandsindikator,
 * konkurser i netværket (konkurser og tvangsopløsninger blandt personens selskaber, med tal) og
 * sanktionslister (stiplet ramme og "Opgrader" uden adgang). Mangler et opslag, står flisen som
 * "Ikke tjekket"/"Ikke beregnet", aldrig som "Nej". Vurderingen står som ord i farve med ikon.
 */
export function PersonRisk({
  person,
  title,
  error,
  onOpen,
  onUpgrade,
}: {
  person?: PersonVM;
  title?: string;
  error?: string;
  onOpen?: (a: ViewAction) => void;
  /** "Opgrader" ved låste sanktionslister. */
  onUpgrade?: () => void;
}) {
  const heading = title ?? "Risiko";
  if (!person) {
    return (
      <Section title={heading} span="half">
        {error ? <DataState state={stateForError(error) === "noaccess" ? "empty" : "error"} reason={error} /> : <DataState state="loading" lines={3} height={200} />}
      </Section>
    );
  }
  const companies = personCompanies(person).length;
  if (companies === 0) {
    return (
      <Section title={heading} span="half">
        <DataState state="empty" reason="Personen har ingen registrerede roller i selskaber, så der er intet at vurdere." />
      </Section>
    );
  }
  const risk = personRisk(person);
  return (
    <Section title={heading} span="half" className="lasso-personrisk">
      <ul className="lasso-personrisk__items">
        <PepTile person={person} />
        <StrawmanTile person={person} />
        <NetworkTile cases={[...risk.bankruptcies, ...risk.dissolutions]} companies={companies} onOpen={onOpen} />
        <SanctionsTile person={person} onUpgrade={onUpgrade} />
      </ul>
    </Section>
  );
}
