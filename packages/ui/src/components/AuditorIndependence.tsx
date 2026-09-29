import { useRef } from "react";
import { formatDate, type AuditorIndependenceVM, type AuditorRelationVM, type RelationAssessment } from "@lasso/spec";
import type { ViewAction } from "../types.js";
import { DataState, Section, severityWord, stateForError } from "../primitives.js";
import { tableToCsv } from "../csv.js";
import { printElement } from "../print.js";
import { DownloadIcon, slugFile } from "./TableKit.js";

/** Relationerne som CSV til Excel (semikolon, dansk), til revisors arbejdspapirer. */
export function auditorCsv(data: AuditorIndependenceVM): string {
  const rows = [...data.relations].sort((a, b) => b.assessment - a.assessment);
  return tableToCsv(
    ["Vurdering", "Person/selskab", "Rolle", "Relation", "Via", "Fra", "Til", "Revisor", "Tjekket"],
    rows.map((r) => [severityWord(r.assessment as RelationAssessment, "assessment"), r.name, r.role, r.relation, r.via, r.from ? formatDate(r.from) : "", r.to ? formatDate(r.to) : "", data.auditorName, data.checkedAt ? formatDate(data.checkedAt) : ""]),
  );
}

function summarize(relations: readonly AuditorRelationVM[]): string {
  const conflict = relations.filter((r) => r.assessment === 100).length;
  const review = relations.filter((r) => r.assessment === 50).length;
  const neutral = relations.length - conflict - review;
  return [
    `${review} relation${review === 1 ? "" : "er"} kræver vurdering`,
    `${neutral} relation${neutral === 1 ? "" : "er"} er uden betydning`,
    `${conflict} direkte interessekonflikt${conflict === 1 ? "" : "er"} fundet`,
  ].join(", ");
}

function period(r: AuditorRelationVM): string | null {
  if (r.to) return `${r.from ? r.from.slice(0, 4) : ""}–${r.to.slice(0, 4)}`;
  if (r.from) return `${r.from.slice(0, 4)} →`;
  return null;
}

/**
 * Revisorhistorik (26e.8): én proportional bjælke med en del pr. revisor, længde efter år.
 * Nuværende revisor i koral-soft med koral kant, tidligere i grå; navn og periode står i delen
 * og som tekst til skærmlæsere.
 */
export function AuditorHistory({ history, now = new Date() }: { history: NonNullable<AuditorIndependenceVM["history"]>; now?: Date }) {
  const yearOf = (d?: string) => (d ? Number(d.slice(0, 4)) : undefined);
  const nowYear = now.getFullYear();
  const parts = history
    .map((h) => ({ ...h, a: yearOf(h.from), b: h.to ? yearOf(h.to) : undefined }))
    .filter((h): h is typeof h & { a: number } => typeof h.a === "number");
  if (parts.length === 0) return null;
  const span = (p: (typeof parts)[number]) => Math.max(1, (p.b ?? nowYear) - p.a + 1);
  return (
    <div className="lasso-audhist">
      <p className="lasso-audhist__title">Revisorhistorik</p>
      <div className="lasso-audhist__bar">
        {parts.map((p, i) => {
          const label = `${p.name} ${p.a}–${p.b ? String(p.b).slice(2) : ""}`;
          return (
            <span key={`${p.name}-${i}`} className={`lasso-audhist__seg${p.b ? "" : " is-current"}`} style={{ flexGrow: span(p) }} title={label}>
              <span className="lasso-audhist__label">{p.b ? `${p.a}–${String(p.b).slice(2)}` : `${p.a}–`}</span>
            </span>
          );
        })}
      </div>
      {/* 26e.8: navnene står under bjælken, så de aldrig klippes i en kort del. */}
      <ul className="lasso-audhist__legend">
        {parts.map((p, i) => (
          <li key={`${p.name}-${i}`} className={p.b ? undefined : "is-current"}>
            <span className="lasso-audhist__name">{p.name}</span>, {p.a}–{p.b ?? "i dag"}
          </li>
        ))}
      </ul>
    </div>
  );
}

function WarnIcon() {
  return (
    <svg className="lasso-audit__warn" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 8v5M12 16.5v.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M10.3 3.9L2.6 17.5A2 2 0 004.3 20.5h15.4a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

function CheckMark({ ok }: { ok: boolean }) {
  return (
    <span className={`lasso-audit__check lasso-audit__check--${ok ? "ok" : "warn"}`} role="img" aria-label={ok ? "I orden" : "Kræver opmærksomhed"}>
      {ok ? (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M6 12.5l4 4 8-8.5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 6v8M12 18v.5" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
        </svg>
      )}
    </span>
  );
}

/**
 * Revisoruafhængighed (katalog 22.2): "Uafhængighedstjek, <virksomhed>" med "Revisor: …, tjekket …"
 * under titlen og "Eksportér PDF" + "Excel" øverst til højre (eksport er obligatorisk, så tjekket kan
 * dokumenteres i revisors arbejdspapirer). Sammenfatningen er én 15 px linje med advarselsikon foran
 * og grundlaget i muted til højre. Relationstabellen har hoved på panel-flade; vurderingen står som
 * ord i farve (Vurdér i warning, Neutral i secondary, Konflikt i danger) og er sorteringsnøglen.
 * Afsluttede relationer dæmpes, men vises altid.
 * Mobil (26e.8): "Revisor" + regnskabet; revisor som række (navn 600, påtegning muted, chevron),
 * "Uafhængighed" som 44 px tjeklinjer (grønt flueben / gult "!") og revisorhistorikken som bjælke.
 */
export function AuditorIndependence({
  data,
  error,
  title,
  companyName,
  onAction,
  canExport = false,
}: {
  data?: AuditorIndependenceVM;
  error?: string;
  title?: string;
  companyName?: string;
  onAction?: (a: ViewAction) => void;
  canExport?: boolean;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const heading = title ?? `Uafhængighedstjek${companyName ? `, ${companyName}` : ""}`;
  const subtitle = [data?.auditorName ? `Revisor: ${data.auditorName}` : null, data?.checkedAt ? `tjekket ${formatDate(data.checkedAt)}` : null].filter(Boolean).join(", ") || undefined;

  if (!data) {
    return (
      <Section title={heading} span="full">
        {error ? <DataState state={stateForError(error) === "noaccess" ? "empty" : "error"} reason={error} /> : <DataState state="loading" lines={6} height={320} />}
      </Section>
    );
  }

  if (data.relations.length === 0) {
    return (
      <Section title={heading} subtitle={subtitle} span="full">
        <DataState state="empty" reason={data.unavailableReason ?? "Der er ikke fundet relationer mellem revisor, kunden og personer."} />
      </Section>
    );
  }

  const rows = [...data.relations].sort((a, b) => b.assessment - a.assessment);
  const file = slugFile(`revisoruafhaengighed ${data.auditorName ?? ""} ${data.checkedAt?.slice(0, 10) ?? ""}`, "csv");
  const review = rows.some((r) => r.assessment >= 50);
  const checks = data.checks ?? rows.map((r) => ({ label: r.relation, sub: r.name, ok: r.assessment < 50 }));

  // Eksport er obligatorisk her (22.2): tjekket skal kunne dokumenteres i revisors arbejdspapirer.
  const exportButtons = (
    <span className="lasso-audit__export">
      <button type="button" className="lasso-btn lasso-btn--sm" onClick={() => printElement(frame.current)}>
        <DownloadIcon />
        Eksportér PDF
      </button>
      {canExport && onAction ? (
        <button type="button" className="lasso-btn lasso-btn--sm" onClick={() => onAction({ kind: "export", filename: file, csv: auditorCsv(data) })}>
          Excel
        </button>
      ) : null}
    </span>
  );

  return (
    <Section
      title={heading}
      subtitle={
        <>
          <span className="lasso-audit__d">{subtitle}</span>
          <span className="lasso-audit__m">{data.report}</span>
        </>
      }
      span="full"
      className="lasso-audit"
      action={exportButtons}
    >
      <p className="lasso-audit__mtitle" aria-hidden="true">
        <span>Revisor</span>
        {data.report ? <span className="lasso-audit__mreport">{data.report}</span> : null}
      </p>
      <div ref={frame} className="lasso-audit__d-block">
        <p className="lasso-printonly lasso-audit__printhead">
          Revisoruafhængighed{data.auditorName ? `, ${data.auditorName}` : ""}
          {data.checkedAt ? `, tjekket ${formatDate(data.checkedAt)}` : ""}
        </p>
        <div className="lasso-audit__summary">
          <p className="lasso-audit__summary-text">
            {review ? <WarnIcon /> : null}
            {summarize(rows)}
          </p>
          <span className="lasso-audit__basis">{data.basis ?? "Baseret på CVR-roller og ejerskab"}</span>
        </div>
        <div className="lasso-table-frame">
          <div className="lasso-table-wrap">
            <table className="lasso-table lasso-audit__table">
              <thead>
                <tr>
                  <th scope="col">Vurdering</th>
                  <th scope="col">Person / selskab</th>
                  <th scope="col">Relation</th>
                  <th scope="col">Via</th>
                  <th scope="col" className="lasso-num">Periode</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className={r.to ? "is-ended" : undefined}>
                    <td data-label="Vurdering">
                      {/* 22.2: vurderingsordet alene i farve (alvorsskalaen fra 17). */}
                      <span className={`lasso-assessment lasso-assessment--${r.assessment}`}>{severityWord(r.assessment as RelationAssessment, "assessment")}</span>
                    </td>
                    <td data-label="Person/selskab" className="lasso-cell--name">
                      <span className="lasso-table__name">{r.name}</span>
                      {r.role ? <span className="lasso-table__sub">{r.role}</span> : null}
                    </td>
                    <td data-label="Relation" className="lasso-cell--wrap">{r.relation}</td>
                    <td data-label="Via">{r.via ?? <span className="lasso-notreported">Ikke oplyst</span>}</td>
                    <td data-label="Periode" className="lasso-num">
                      {period(r) ?? <span className="lasso-notreported">Ikke oplyst</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        {data.unavailableReason ? <p className="lasso-notice">{data.unavailableReason}</p> : null}
      </div>

      {/* Mobil (26e.8): revisor som række, uafhængighed som tjeklinjer, historik som bjælke. */}
      <div className="lasso-audit__m-block">
        {data.auditorName ? (
          <div className="lasso-audit__auditor">
            <span className="lasso-audit__auditor-main">
              <span className="lasso-audit__auditor-name">{data.auditorName}</span>
              {data.opinion ? <span className="lasso-audit__auditor-sub">{data.opinion}</span> : null}
            </span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        ) : null}
        <p className="lasso-audit__checks-title">Uafhængighed</p>
        <ul className="lasso-audit__checks">
          {checks.map((c, i) => (
            <li key={i} className="lasso-audit__checkrow">
              <CheckMark ok={c.ok} />
              <span className="lasso-audit__checktext">
                {c.label}
                {c.sub ? <span className="lasso-audit__checksub">{c.sub}</span> : null}
              </span>
            </li>
          ))}
        </ul>
        {data.history?.length ? <AuditorHistory history={data.history} /> : null}
      </div>
    </Section>
  );
}
