import { formatDate, formatNumber, type ProductionUnitVM, type ProductionUnitsVM } from "@lasso/spec";
import { DataState, Missing, Section, stateForError, statusTone } from "../primitives.js";

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
  const active = units.units.filter((u) => u.statusKind !== "inactive" && !u.endedYear).length;
  return (
    <Section title={title} subtitle="P-nr., navn, adresse, branche, ansatte, status — hovedenhed først" span="full" className="lasso-units" action={<span className="lasso-units__count">{`${active} aktive`}</span>}>
      {/* Mobil (26e.1): rækker i tre linjer, navn, adresse og P-nr. med ansatte. Ingen ikonkasse (regel 5). */}
      <ul className="lasso-units-m">
        {units.units.map((u, i) => {
          const address = u.address ? [u.address.street, [u.address.zip, u.address.city].filter(Boolean).join(" ")].filter(Boolean).join(", ") : undefined;
          const status = unitStatusText(u);
          const meta = [u.pNumber ? `P-nr. ${u.pNumber}` : null, u.employees != null ? `${formatNumber(u.employees)} ansatte` : null, u.statusKind === "inactive" ? status : null].filter(Boolean).join(", ");
          return (
            <li key={u.pNumber ?? i} className={`lasso-units-m__row${u.statusKind === "inactive" ? " is-ended" : ""}`}>
              <span className="lasso-units-m__name">{`${u.name ?? "Uden navn"}${u.isMain ? ", hovedenhed" : ""}`}</span>
              {address ? <span className="lasso-units-m__address">{address}</span> : null}
              {meta ? <span className="lasso-units-m__meta">{meta}</span> : null}
            </li>
          );
        })}
      </ul>
      <div className="lasso-table-frame lasso-units__table">
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
                      {status ? <span className={`lasso-status lasso-status--${statusTone(status, u.statusKind ?? "active")}`}>{status}</span> : <Missing />}
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
