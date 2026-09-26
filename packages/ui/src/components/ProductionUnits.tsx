import { formatDate, formatNumber, type ProductionUnitVM, type ProductionUnitsVM } from "@lasso/spec";
import { DataState, Missing, Section, stateForError } from "../primitives.js";

function unitStatusText(u: ProductionUnitVM): string | undefined {
  if (u.endedYear) return `Ophørt ${u.endedYear}`;
  return u.status;
}

/**
 * Produktionsenheder (katalog 20): P-nr., enhed og adresse, branche, ansatte,
 * status og oprettet. Hovedenheden markeres med en koral overline UNDER
 * P-nummeret (ren tekst, ingen pille) og står altid først (adapters.ts sorterer).
 * Mobil: samme tabel foldes til rækker via den fælles `.lasso-table--fold`-regel
 * (guide 23: "kun brudpunkter, ingen separate mobiludgaver").
 */
export function ProductionUnits({ units, error }: { units?: ProductionUnitsVM; error?: string }) {
  const title = "Produktionsenheder";
  if (!units) {
    return (
      <Section title={title} span="full">
        {error ? <DataState state={stateForError(error) === "noaccess" ? "empty" : "error"} reason={error} /> : <DataState state="loading" lines={4} height={210} />}
      </Section>
    );
  }
  if (units.units.length === 0) {
    return (
      <Section title={title} span="full">
        <DataState state="empty" reason="Virksomheden har ingen registrerede produktionsenheder i CVR." />
      </Section>
    );
  }
  return (
    <Section title={title} subtitle="P-nr., navn, adresse, branche, ansatte, status — hovedenhed først" span="full">
      <div className="lasso-table-frame">
        <div className="lasso-table-wrap">
          <table className="lasso-table lasso-table--fold lasso-table--units">
            <thead>
              <tr>
                <th>P-nr.</th>
                <th>Enhed og adresse</th>
                <th>Branche</th>
                <th className="lasso-num">Ansatte</th>
                <th>Status</th>
                <th className="lasso-num">Oprettet</th>
              </tr>
            </thead>
            <tbody>
              {units.units.map((u, i) => {
                const status = unitStatusText(u);
                return (
                  <tr key={u.pNumber ?? i} className={u.statusKind === "inactive" ? "is-ended" : undefined}>
                    <td data-label="P-nr.">
                      <span className="lasso-units__pnr">{u.pNumber ?? <Missing />}</span>
                      {u.isMain ? <span className="lasso-units__main">Hovedenhed</span> : null}
                    </td>
                    <td data-label="Enhed og adresse" className="lasso-cell--name">
                      <span className="lasso-table__name">{u.name ?? <Missing />}</span>
                      {u.address ? (
                        <span className="lasso-table__sub">
                          {[u.address.street, [u.address.zip, u.address.city].filter(Boolean).join(" ")].filter(Boolean).join(", ")}
                        </span>
                      ) : null}
                    </td>
                    <td data-label="Branche" className="lasso-cell--wrap">
                      {u.industryText ? `${u.industryCode ? `${u.industryCode} ` : ""}${u.industryText}` : <Missing />}
                    </td>
                    <td data-label="Ansatte" className="lasso-num">
                      {u.employees != null ? formatNumber(u.employees) : <Missing />}
                    </td>
                    <td data-label="Status">
                      {status ? <span className={`lasso-status lasso-status--${u.statusKind ?? "active"}`}>{status}</span> : <Missing />}
                    </td>
                    <td data-label="Oprettet" className="lasso-num">
                      {u.created ? formatDate(u.created) : <Missing />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Section>
  );
}
