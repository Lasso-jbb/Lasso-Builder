import { useState, type ReactNode } from "react";
import { accountingPeriod, formatDate, formatNumber, type CompanyVM, type FinancialsVM, type OwnershipVM, type TextSectionsVM } from "@lasso/spec";
import { DataState, Section, stateForError } from "../primitives.js";
import { FoldText, ValueRow } from "./Values.js";

export type RegistrationVariant = "full" | "profile";

export interface RegistrationProps {
  company?: CompanyVM;
  ownership?: OwnershipVM;
  financials?: FinancialsVM;
  /** Formål og tegningsregel kommer fra CVR-teksterne (LassoTextSections' kilde). */
  texts?: TextSectionsVM;
  variant?: RegistrationVariant;
  title?: string;
  error?: string;
}

function textOf(texts: TextSectionsVM | undefined, heading: RegExp): string | undefined {
  return texts?.sections.find((s) => heading.test(s.heading))?.body;
}

const yesNo = (v: boolean | undefined) => (v === undefined ? undefined : v ? "Ja" : "Nej");

/** "01.01.2025–31.12.2025" fra to ISO-datoer. */
function range(start?: string, end?: string): string | undefined {
  if (!start && !end) return undefined;
  return `${start ? formatDate(start) : "—"}–${end ? formatDate(end) : "—"}`;
}

function Rows({ rows }: { rows: [string, ReactNode | undefined][] }) {
  return (
    <div className="lasso-reg__rows">
      {rows
        .filter(([, v]) => v !== undefined && v !== null && v !== "")
        .map(([label, v]) => (
          <ValueRow key={label} label={label}>
            {v}
          </ValueRow>
        ))}
    </div>
  );
}

/**
 * Regnskabsoplysninger, bibrancher, kapital, tegningsregel og formål (katalog 28.7; mobil 26h.9).
 * "full": to kort side om side. "Regnskabsoplysninger": revision ("Revideret, <revisor>" eller
 * "Fravalgt" i warning-tekst + "siden regnskabsåret …" i muted, den eneste farvede værdi),
 * regnskabsår, nuværende og første regnskabsperiode, regnskabsklasse og bibrancher (kode i muted +
 * navn, én pr. linje, højst tre; "Ingen registreret" uden bibrancher). "Kapital og vedtægter":
 * registreret kapital, kapitalklasser én pr. linje, vedtægter senest ændret, tegningsregel og formål
 * foldet til to linjer ("Vis" / "Vis hele formålet"), reklamebeskyttet og børsnoteret. Mobil: etiket over værdi.
 * "profile" (26h.9): "Bibrancher og formål" med branchechips (hovedbranche først), formålet og
 * "Vis tegningsregel og vedtægter". Felter uden værdi udelades; alle felter ud over CVR-teksterne er
 * ubekræftede i live-data.
 */
export function Registration({ company, ownership, financials, texts, variant = "full", title, error }: RegistrationProps) {
  const [more, setMore] = useState(false);
  const profile = variant === "profile";
  const heading = title ?? (profile ? "Bibrancher og formål" : "Regnskabsoplysninger");
  if (!company) {
    return (
      <Section title={heading} span={profile ? "half" : "full"} card>
        {error ? <DataState state={stateForError(error) === "noaccess" ? "empty" : "error"} reason={error} /> : <DataState state="loading" lines={6} height={280} />}
      </Section>
    );
  }
  const purpose = textOf(texts, /^formål/i);
  const signing = textOf(texts, /^tegningsregl/i);
  const alt = company.altIndustries;

  if (profile) {
    const chips = [
      company.industryText ? { code: company.industryCode, text: company.industryText, main: true } : null,
      ...(alt ?? []).slice(0, 3).map((b) => ({ ...b, main: false })),
    ].filter((c): c is { code?: string; text: string; main: boolean } => Boolean(c));
    return (
      <Section title={heading} span="half" card className="lasso-reg lasso-reg--profile">
        {chips.length ? (
          <ul className="lasso-reg__chips">
            {chips.map((c) => (
              <li key={`${c.code}-${c.text}`} className="lasso-reg__chip">
                {[c.code, c.text].filter(Boolean).join(" ")}
                {c.main ? ", hoved" : ""}
              </li>
            ))}
          </ul>
        ) : null}
        {purpose ? (
          <div className="lasso-reg__purpose">
            <span className="lasso-reg__label">Formål</span>
            <p className="lasso-reg__purpose-text">{purpose}</p>
          </div>
        ) : null}
        {more ? <Rows rows={[["Tegningsregel", signing], ["Vedtægter senest ændret", company.statutesChanged ? formatDate(company.statutesChanged) : undefined]]} /> : null}
        {signing || company.statutesChanged ? (
          <button type="button" className="lasso-link lasso-reg__more" aria-expanded={more} onClick={() => setMore(!more)}>
            {more ? "Skjul tegningsregel og vedtægter" : "Vis tegningsregel og vedtægter"}
          </button>
        ) : null}
      </Section>
    );
  }

  const last = financials?.years.at(-1);
  const auditor = ownership?.auditor?.name;
  const revision = company.auditExempt ? (
    <span>
      <span className="lasso-reg__warn">Fravalgt</span>
      {company.auditExemptSince ? <span className="lasso-reg__muted">{`, siden regnskabsåret ${company.auditExemptSince}`}</span> : null}
    </span>
  ) : auditor ? (
    `Revideret, ${auditor}`
  ) : undefined;
  const industries = alt ? (
    alt.length ? (
      <span className="lasso-reg__lines">
        {alt.slice(0, 3).map((b) => (
          <span key={`${b.code}-${b.text}`}>
            {b.code ? <span className="lasso-reg__code">{b.code}</span> : null}
            {b.text}
          </span>
        ))}
      </span>
    ) : (
      <span className="lasso-reg__muted">Ingen registreret</span>
    )
  ) : undefined;
  const cap = company.registeredCapital;
  return (
    <div className="lasso-reg lasso-span-full">
      <Section title={heading} card>
        <Rows
          rows={[
            ["Revision", revision],
            ["Regnskabsår", accountingPeriod(last)],
            ["Nuværende regnskabsperiode", range(last?.periodStart, last?.periodEnd)],
            ["Første regnskabsperiode", range(company.firstPeriod?.start, company.firstPeriod?.end)],
            ["Regnskabsklasse", company.accountingClass],
            ["Bibrancher", industries],
          ]}
        />
      </Section>
      <Section title="Kapital og vedtægter" card>
        <Rows
          rows={[
            ["Registreret kapital", cap ? `${formatNumber(cap.amount)} ${cap.currency ?? "DKK"}` : undefined],
            [
              "Kapitalklasser",
              cap?.classes?.length ? (
                <span className="lasso-reg__lines">
                  {cap.classes.map((c) => (
                    <span key={c}>{c}</span>
                  ))}
                </span>
              ) : undefined,
            ],
            ["Vedtægter senest ændret", company.statutesChanged ? formatDate(company.statutesChanged) : undefined],
            ["Tegningsregel", signing ? <FoldText text={signing} lines={2} moreLabel="Vis" /> : undefined],
            ["Formål", purpose ? <FoldText text={purpose} lines={2} moreLabel="Vis hele formålet" /> : undefined],
            ["Reklamebeskyttet", yesNo(company.advertisingProtected)],
            ["Børsnoteret", yesNo(company.listed)],
          ]}
        />
      </Section>
    </div>
  );
}
