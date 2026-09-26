import { personCompanies, personRisk, type PersonRiskCaseVM, type PersonVM } from "@lasso/spec";
import type { ViewAction } from "../types.js";
import { DataState, Section, SeverityIcon, SourceLine, stateForError } from "../primitives.js";

const year = (d?: string) => (d ? d.slice(0, 4) : "");

/** Ingen sager: flueben + "Ingen"; kun sager, personen havde forladt: Info; ellers Mulig vigtig. */
function level(cases: PersonRiskCaseVM[]): { word: string; tone: "none" | "25" | "50" } {
  if (cases.length === 0) return { word: "Ingen", tone: "none" };
  return cases.some((c) => c.involved) ? { word: "Mulig vigtig", tone: "50" } : { word: "Info", tone: "25" };
}

function CheckIcon() {
  return (
    <svg className="lasso-personrisk__check" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
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

/**
 * Personrisiko (katalog 16): konkurser og tvangsopløsninger blandt de selskaber, personen har
 * eller har haft en rolle i. Rækker adskilt med linjer, ikke tonede fliser; alvoren står som
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
  return (
    <Section title={heading} span="half" className="lasso-personrisk">
      <ul className="lasso-personrisk__items">
        <Item label="Konkurser" noun="gået konkurs" cases={risk.bankruptcies} companies={companies} onOpen={onOpen} />
        <Item label="Tvangsopløsninger" noun="tvangsopløst" cases={risk.dissolutions} companies={companies} onOpen={onOpen} />
      </ul>
      <SourceLine source="Selskabernes status i CVR via Lasso" updated={person.updated} />
    </Section>
  );
}
