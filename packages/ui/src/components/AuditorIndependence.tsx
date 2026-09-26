import type { AuditorIndependenceVM, AuditorRelationVM, RelationAssessment } from "@lasso/spec";
import { DataState, Section, SourceLine, severityWord, stateForError } from "../primitives.js";

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
 * Revisoruafhængighed (katalog 22): sammenfatning, derefter en relationstabel mellem
 * revisionshuset, kunden og personer. Vurderingskolonnen bruger alvorsskalaen fra 17
 * (Neutral / Vurdér = mulig vigtig / Konflikt = vigtig) og er sorteringsnøglen.
 * Afsluttede relationer dæmpes, men vises altid (de slettes aldrig).
 */
export function AuditorIndependence({ data, error, title }: { data?: AuditorIndependenceVM; error?: string; title?: string }) {
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

  return (
    <Section title={heading} subtitle={subtitle} span="full">
      <p className="lasso-observations__summary">{summarize(rows)}</p>
      <div className="lasso-table-frame">
        <div className="lasso-table-wrap">
          <table className="lasso-table lasso-table--fold lasso-relations">
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
      {data.checkedAt ? <SourceLine source="CVR-roller og ejerskab" updated={data.checkedAt} /> : null}
    </Section>
  );
}
