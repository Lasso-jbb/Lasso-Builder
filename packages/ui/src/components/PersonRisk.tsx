import { formatDate, personCompanies, personRisk, type PersonRiskCaseVM, type PersonVM } from "@lasso/spec";
import type { ViewAction } from "../types.js";
import { DataState, Section, SeverityIcon, SourceLine, stateForError } from "../primitives.js";
import { Icon } from "./Icon.js";

import { ShellIcon } from "./ShellIcons.js";

const year = (d?: string) => (d ? d.slice(0, 4) : "");

/** Ingen sager: flueben + "Ingen"; kun sager, personen havde forladt: Info; ellers Mulig vigtig. */
function level(cases: PersonRiskCaseVM[]): { word: string; tone: "none" | "25" | "50" } {
  if (cases.length === 0) return { word: "Ingen", tone: "none" };
  return cases.some((c) => c.involved) ? { word: "Mulig vigtig", tone: "50" } : { word: "Info", tone: "25" };
}

function CheckIcon() {
  return <Icon name="check" size={14} className="lasso-personrisk__check" />;
}

function caseText(c: PersonRiskCaseVM): string {
  const what = `${c.status.toLowerCase()}${c.date ? ` ${year(c.date)}` : ""}`;
  if (!c.personLeft) return `${what}. Personen har stadig en rolle.`;
  const before = c.yearsBefore !== undefined && c.yearsBefore > 0 ? `, ${c.yearsBefore} år før` : "";
  return `${what}. Personen fratrådte ${year(c.personLeft)}${before}.`;
}

function Item({ label, noun, cases, companies, onOpen }: { label: string; noun: string; cases: PersonRiskCaseVM[]; companies: number; onOpen?: (a: ViewAction) => void }) {
  const { word, tone } = level(cases);
  const desc = cases.length
    ? `${cases.length} af personens ${companies} ${companies === 1 ? "selskab" : "selskaber"} er ${noun}.`
    : companies === 1
      ? `Personens selskab er ikke ${noun}.`
      : `Ingen af personens ${companies} selskaber er ${noun}.`;
  return (
    <li className="lasso-personrisk__item">
      <span className="lasso-personrisk__icon">{tone === "none" ? <CheckIcon /> : <SeverityIcon severity={tone === "50" ? 50 : 25} />}</span>
      <div className="lasso-personrisk__main">
        <div className="lasso-personrisk__title">{label}</div>
        <div className="lasso-personrisk__desc">{desc}</div>
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
      </div>
      <span className={`lasso-personrisk__word lasso-personrisk__word--${tone}`}>{word}</span>
    </li>
  );
}

type SignalTone = "none" | "25" | "50" | "100" | "unknown" | "locked";

/** Én række uden sager: PEP, stråmandsindikator, sanktionslister (16.4). Ikon + ord (regel 7). */
function Signal({ label, desc, word, tone }: { label: string; desc: string; word?: string; tone: SignalTone }) {
  const icon =
    tone === "none" ? (
      <CheckIcon />
    ) : tone === "locked" ? (
      <ShellIcon name="lock" size={15} className="lasso-personrisk__lock" />
    ) : tone === "unknown" ? (
      <SeverityIcon severity={0} />
    ) : (
      <SeverityIcon severity={tone === "100" ? 100 : tone === "50" ? 50 : 25} />
    );
  return (
    <li className={`lasso-personrisk__item${tone === "locked" ? " lasso-personrisk__item--locked" : ""}`}>
      <span className="lasso-personrisk__icon">{icon}</span>
      <div className="lasso-personrisk__main">
        <div className="lasso-personrisk__title">{label}</div>
        <div className="lasso-personrisk__desc">{desc}</div>
      </div>
      {word ? <span className={`lasso-personrisk__word lasso-personrisk__word--${tone}`}>{word}</span> : null}
    </li>
  );
}

function PepRow({ person }: { person: PersonVM }) {
  const pep = person.pep;
  if (!pep) return <Signal label="PEP, politisk eksponeret" desc="PEP-opslaget er ikke foretaget for personen." word="Ikke tjekket" tone="unknown" />;
  if (pep.match) return <Signal label="PEP, politisk eksponeret" desc={pep.detail ?? `Match i Finanstilsynets PEP-liste${pep.checkedAt ? `, tjekket ${formatDate(pep.checkedAt)}` : ""}.`} word="Ja" tone="50" />;
  return <Signal label="PEP, politisk eksponeret" desc={`Ingen match i Finanstilsynets PEP-liste${pep.checkedAt ? `, tjekket ${formatDate(pep.checkedAt)}` : ""}.`} word="Nej" tone="none" />;
}

function StrawmanRow({ person }: { person: PersonVM }) {
  const s = person.strawman;
  if (!s) return <Signal label="Stråmandsindikator" desc="Indikatoren er ikke beregnet for personen." word="Ikke beregnet" tone="unknown" />;
  if (s.level === "possible") return <Signal label="Stråmandsindikator" desc={s.detail ?? "Rollerne ligner et mønster, der ses ved stråmænd."} word="Mulig" tone="50" />;
  return <Signal label="Stråmandsindikator" desc={s.detail ?? "Rollerne viser ikke mønstre, der ses ved stråmænd."} word="Nej" tone="none" />;
}

function SanctionsRow({ person }: { person: PersonVM }) {
  const s = person.sanctions;
  if (!s || !s.available) return <Signal label="Sanktionslister" desc={s ? "Ikke tilgængelig i din pakke." : "Ikke tilgængelig endnu."} tone="locked" />;
  if (s.match) return <Signal label="Sanktionslister" desc={`Match på en sanktionsliste${s.checkedAt ? `, tjekket ${formatDate(s.checkedAt)}` : ""}.`} word="Match" tone="100" />;
  return <Signal label="Sanktionslister" desc={`Ingen match${s.checkedAt ? `, tjekket ${formatDate(s.checkedAt)}` : ""}.`} word="Nej" tone="none" />;
}

/**
 * Personrisiko (katalog 16.4): fem rækker, PEP, stråmandsindikator, konkurser og tvangsopløsninger
 * blandt de selskaber, personen har eller har haft en rolle i, og sanktionslister (låst uden adgang).
 * Mangler et opslag, står rækken som "Ikke tjekket"/"Ikke beregnet", aldrig som "Nej". Rækker adskilt med linjer, ikke tonede fliser; alvoren står som
 * ord i vægt 500 med ikon (regel 1 og 7), skalaen følger 17. Kun ud fra selskabernes CVR-status.
 */
export function PersonRisk({ person, title, error, onOpen }: { person?: PersonVM; title?: string; error?: string; onOpen?: (a: ViewAction) => void }) {
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
  const checked = person.pep?.checkedAt ?? person.sanctions?.checkedAt;
  const sources = ["Selskabernes status i CVR via Lasso", person.pep ? "Finanstilsynets PEP-liste" : undefined].filter(Boolean).join(" og ");
  return (
    <Section title={heading} span="half" className="lasso-personrisk" action={checked ? <span className="lasso-personrisk__checked">Tjekket {formatDate(checked)}</span> : undefined}>
      <ul className="lasso-personrisk__items">
        <PepRow person={person} />
        <StrawmanRow person={person} />
        <Item label="Konkurser" noun="gået konkurs" cases={risk.bankruptcies} companies={companies} onOpen={onOpen} />
        <Item label="Tvangsopløsninger" noun="tvangsopløst" cases={risk.dissolutions} companies={companies} onOpen={onOpen} />
        <SanctionsRow person={person} />
      </ul>
      <SourceLine source={sources} updated={person.updated} />
    </Section>
  );
}
