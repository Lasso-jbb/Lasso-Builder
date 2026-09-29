import { useRef } from "react";
import { formatDate, type AuditorIndependenceVM, type AuditorRelationVM, type RelationAssessment } from "@lasso/spec";
import type { ViewAction } from "../types.js";
import { DataState, Section, SourceLine, severityWord, stateForError } from "../primitives.js";
import { tableToCsv } from "../csv.js";
import { printElement } from "../print.js";
import { DownloadIcon, TableToolbar, slugFile } from "./TableKit.js";

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
              {label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Revisoruafhængighed (katalog 22): sammenfatning, derefter en relationstabel mellem
 * revisionshuset, kunden og personer. Vurderingskolonnen bruger alvorsskalaen fra 17
 * (Neutral / Vurdér = mulig vigtig / Konflikt = vigtig) og er sorteringsnøglen.
 * Afsluttede relationer dæmpes, men vises altid (de slettes aldrig).
 */
export function AuditorIndependence({ data, error, title, onAction, canExport = false }: { data?: AuditorIndependenceVM; error?: string; title?: string; onAction?: (a: ViewAction) => void; canExport?: boolean }) {
  const frame = useRef<HTMLDivElement>(null);
  const heading = title ?? "Revisoruafhængighed";
  const subtitle = data?.auditorName ? `Revisor: ${data.auditorName}` : undefined;

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

  // Eksport er obligatorisk her (22.2): tjekket skal kunne dokumenteres i revisors arbejdspapirer.
  const toolbar = (
    <TableToolbar
      left={
        <span className="lasso-audit__meta">
          {rows.length} relation{rows.length === 1 ? "" : "er"}
          {data.checkedAt ? `, tjekket ${formatDate(data.checkedAt)}` : ""}
        </span>
      }
      right={
        <>
          <button type="button" className="lasso-btn lasso-tbtn" onClick={() => printElement(frame.current)}>
            <DownloadIcon />
            PDF
          </button>
          {canExport && onAction ? (
            <button type="button" className="lasso-btn lasso-tbtn" onClick={() => onAction({ kind: "export", filename: file, csv: auditorCsv(data) })}>
              <DownloadIcon />
              Excel
            </button>
          ) : null}
        </>
      }
    />
  );

  return (
    <Section title={heading} subtitle={subtitle} span="full" className="lasso-audit">
      <div ref={frame}>
      <p className="lasso-printonly lasso-audit__printhead">
        Revisoruafhængighed{data.auditorName ? `, ${data.auditorName}` : ""}
        {data.checkedAt ? `, tjekket ${formatDate(data.checkedAt)}` : ""}
      </p>
      <p className="lasso-observations__summary">{summarize(rows)}</p>
      <div className="lasso-table-frame">
        <div className="lasso-noprint">{toolbar}</div>
        <div className="lasso-table-wrap">
          <table className="lasso-table lasso-table--fold lasso-audit__table">
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
      {data.history?.length ? <AuditorHistory history={data.history} /> : null}
      {data.checkedAt ? <SourceLine source="CVR-roller og ejerskab" updated={data.checkedAt} /> : null}
      </div>
    </Section>
  );
}
