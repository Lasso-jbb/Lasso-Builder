import type { AuditorIndependenceVM, AuditorRelationVM, RelationAssessment } from "@lasso/spec";
import { DataState, Section, SourceLine, severityWord, stateForError } from "../primitives.js";
import { useWidth } from "../useWidth.js";

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

/** Under denne bredde kan relationstabellens fem kolonner ikke stå uden vandret scroll. */
const TABLE_MIN = 640;

const word = (r: AuditorRelationVM) => severityWord(r.assessment as RelationAssessment, "assessment");

/** Fuld bredde: vurdering, person/selskab, relation, via og periode som tabel (mobil: foldet til kort). */
function RelationTable({ rows }: { rows: readonly AuditorRelationVM[] }) {
  return (
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
                  <span className={`lasso-assessment lasso-assessment--${r.assessment}`}>{word(r)}</span>
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
  );
}

/** Halv kolonne: én række pr. relation (navn, relationen, rolle/via/periode) med vurderingen til højre. */
function RelationList({ rows }: { rows: readonly AuditorRelationVM[] }) {
  return (
    <ul className="lasso-rows">
      {rows.map((r) => {
        const meta = [r.role, r.via ? `via ${r.via}` : null, period(r)].filter(Boolean).join(", ");
        return (
          <li key={r.id} className={`lasso-row${r.to ? " lasso-row--ended" : ""}`}>
            <div className="lasso-row__main">
              <div className="lasso-row__name">{r.name}</div>
              <div className="lasso-row__sub">{r.relation}</div>
              {meta ? <div className="lasso-row__sub">{meta}</div> : null}
            </div>
            <div className="lasso-row__side">
              <span className={`lasso-assessment lasso-assessment--${r.assessment}`}>{word(r)}</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Revisoruafhængighed (katalog 22): sammenfatning, derefter en relationstabel mellem
 * revisionshuset, kunden og personer. Vurderingskolonnen bruger alvorsskalaen fra 17
 * (Neutral / Vurdér = mulig vigtig / Konflikt = vigtig) og er sorteringsnøglen.
 * Afsluttede relationer dæmpes, men vises altid (de slettes aldrig). I en halv kolonne (risiko:
 * ved siden af kreditvurderingen) er relationerne en liste med vurderingen til højre, ikke en
 * tabel, der skal scrolles (tabeller står kun i fuld bredde).
 */
export function AuditorIndependence({ data, error, title }: { data?: AuditorIndependenceVM; error?: string; title?: string }) {
  const heading = title ?? "Revisoruafhængighed";
  const subtitle = data?.auditorName ? `Revisor: ${data.auditorName}` : undefined;
  const [ref, width] = useWidth<HTMLDivElement>(1048);

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
      <div ref={ref}>{width < TABLE_MIN ? <RelationList rows={rows} /> : <RelationTable rows={rows} />}</div>
      {data.unavailableReason ? <p className="lasso-notice">{data.unavailableReason}</p> : null}
      {data.checkedAt ? <SourceLine source="CVR-roller og ejerskab" updated={data.checkedAt} /> : null}
    </Section>
  );
}
