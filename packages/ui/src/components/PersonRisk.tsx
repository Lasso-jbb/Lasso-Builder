import { personCompanies, personRisk, type PersonRiskCaseVM, type PersonVM } from "@lasso/spec";
import type { ViewAction } from "../types.js";
import type React from "react";
import { DataState, Section, SeverityIcon, stateForError } from "../primitives.js";
import { Icon } from "./Icon.js";

import { ShellIcon } from "./ShellIcons.js";

const year = (d?: string) => (d ? d.slice(0, 4) : "");

type Tone = "none" | "25" | "50" | "100" | "neutral" | "unknown" | "locked";

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
}: {
  label: string;
  count?: number;
  desc: React.ReactNode;
  word?: string;
  tone: Tone;
  children?: React.ReactNode;
}) {
  return (
    <li className={`lasso-personrisk__item${tone === "locked" ? " lasso-personrisk__item--locked" : ""}`}>
      <span className="lasso-personrisk__icon">
        {/* 16.4: antallet står som rund flade i ikonpladsen foran titlen. */}
        {count ? <span className="lasso-personrisk__count">{count}</span> : <ToneIcon tone={tone} />}
      </span>
      <div className="lasso-personrisk__main">
        <div className="lasso-personrisk__title">{label}</div>
        <div className="lasso-personrisk__desc">{desc}</div>
        {children}
      </div>
      {word ? <span className={`lasso-personrisk__word lasso-personrisk__word--${tone}`}>{word}</span> : null}
    </li>
  );
}

/** Selskaberne i en sag som liste med links (når værten kan åbne dem). */
function CaseList({ cases, onOpen }: { cases: PersonRiskCaseVM[]; onOpen?: (a: ViewAction) => void }) {
  if (!cases.length) return null;
  return (
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
  );
}

/**
 * 16.4 (Jakob 01.10) "Egne konkurser": selskaber, hvor personen havde en rolle, da de gik konkurs eller blev
 * tvangsopløst (eller højst et år før).
 */
function OwnTile({ cases, onOpen }: { cases: PersonRiskCaseVM[]; onOpen?: (a: ViewAction) => void }) {
  const desc = cases.length
    ? `Personen havde en rolle i ${cases.length === 1 ? "selskabet" : `${cases.length} selskaber`}, da ${cases.length === 1 ? "det" : "de"} gik konkurs eller blev tvangsopløst.`
    : "Personen har ikke haft en rolle i et selskab, da det gik konkurs eller blev tvangsopløst.";
  return (
    <Tile label="Egne konkurser" count={cases.length || undefined} desc={desc} word={cases.length ? "Ja" : "Nej"} tone={cases.length ? "50" : "none"}>
      <CaseList cases={cases} onOpen={onOpen} />
    </Tile>
  );
}

/** 16.4 "Konkurser i netværket": selskaber, personen har været i, som gik konkurs efter personen var fratrådt. */
function NetworkTile({ cases, onOpen }: { cases: PersonRiskCaseVM[]; onOpen?: (a: ViewAction) => void }) {
  const desc = cases.length
    ? `${cases.length === 1 ? "Ét selskab" : `${cases.length} selskaber`}, personen har været i, er gået konkurs eller tvangsopløst efter personens fratræden.`
    : "Ingen selskaber, personen har været i, er gået konkurs eller tvangsopløst efter personens fratræden.";
  return (
    <Tile label="Konkurser i netværket" count={cases.length || undefined} desc={desc} word={cases.length ? "Neutral" : "Nej"} tone={cases.length ? "neutral" : "none"}>
      <CaseList cases={cases} onOpen={onOpen} />
    </Tile>
  );
}

/**
 * Personrisiko (katalog 16.4, Jakob 01.10): kun konkurser, i to fliser: "Egne konkurser" (personen havde en
 * rolle, da selskabet gik konkurs eller blev tvangsopløst) og "Konkurser i netværket" (selskaber, personen har
 * været i, efter fratræden). Vurderingen står som ord i farve med ikon.
 */
export function PersonRisk({
  person,
  title,
  error,
  onOpen,
  lines = false,
}: {
  person?: PersonVM;
  /**
   * 25.6 (personsiden): fire tjeklinjer adskilt af 1 px dividere i stedet for fliser med egen ramme,
   * titel 15/500, "Tjekket DATO" til højre i hovedet og "Opgrader" som link ved låste lister.
   */
  lines?: boolean;
  title?: string;
  error?: string;
  onOpen?: (a: ViewAction) => void;
  /** Udgået (sanktionslisterne står ikke længere i elementet, Jakob 01.10). Beholdt for bagudkompatibilitet. */
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
  const cases = [...risk.bankruptcies, ...risk.dissolutions];
  return (
    <Section
      title={heading}
      span="half"
      className={`lasso-personrisk${lines ? " lasso-personrisk--lines" : ""}`}
    >
      <ul className="lasso-personrisk__items">
        {/* 16.4 (Jakob 01.10): kun konkurser, i to kasser; PEP, stråmand og sanktionslister står ikke her. */}
        <OwnTile cases={cases.filter((c) => c.involved)} onOpen={onOpen} />
        <NetworkTile cases={cases.filter((c) => !c.involved)} onOpen={onOpen} />
      </ul>
    </Section>
  );
}
