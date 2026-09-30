import { formatDate, formatNumber, type LivestockVM } from "@lasso/spec";
import { DataState, Section, stateForError } from "../primitives.js";
import { isModuleReason, LIVESTOCK_MODULE_REASON } from "../unavailableReasons.js";

/**
 * CHR (katalog 20): besætninger pr. dyretype + veterinære hændelser. 20.4 (Jakob): ingen dyreikoner i rækkerne.
 * Vises kun for landbrug med et CHR-nummer; modellen/værten inkluderer kun
 * komponenten, når det er tilfældet. Tom tilstand dækker tre situationer, alle uden
 * fejl: ingen besætninger, intet Ejendomme-modul i abonnementet, eller et CHR-svar
 * i en endnu uverificeret form (`livestock.unavailableReason`, se
 * docs/endpoints-enheder-kontakt-analyse.md).
 */
export function Livestock({ livestock, error }: { livestock?: LivestockVM; error?: string }) {
  const title = "Besætninger, CHR";
  if (!livestock) {
    return (
      <Section title={title} span="full">
        {error ? <DataState state={stateForError(error) === "noaccess" ? "empty" : "error"} reason={error} /> : <DataState state="loading" lines={4} height={228} />}
      </Section>
    );
  }
  if ((!livestock.chrNumber || livestock.herds.length === 0) && isModuleReason(livestock.unavailableReason)) {
    return (
      <Section title={title} span="full">
        <DataState state="locked" reason={LIVESTOCK_MODULE_REASON} lines={3} />
      </Section>
    );
  }
  if (!livestock.chrNumber || livestock.herds.length === 0) {
    return (
      <Section title={title} span="full" action={<span className="lasso-section__meta">Ikke relevant</span>}>
        <DataState
          state="empty"
          inline
          reason={livestock.unavailableReason ?? "Ingen CHR-registreringer. Sektionen skjules i overblikket og vises kun her med tom tilstand, så brugeren ved, at der er søgt."}
        />
      </Section>
    );
  }
  const speciesCount = new Set(livestock.herds.map((h) => h.species).filter(Boolean)).size;

  return (
    <Section title={title} subtitle="Husdyr pr. type og veterinære hændelser - kun for landbrug" span="full">
      <div className="lasso-livestock">
        <div className="lasso-livestock__herds">
          <div className="lasso-livestock__head">
            <span className="lasso-livestock__title">Besætninger, CHR {livestock.chrNumber}</span>
            <span className="lasso-small lasso-muted">
              {/* G3: ingen "opdateret"-kildevisning; kun ejeren */}
              {livestock.ownerName}
            </span>
          </div>
          <div className="lasso-table-frame">
            <table className="lasso-table lasso-table--herds">
              <tbody>
                {livestock.herds.map((h, i) => (
                  <tr key={i}>
                    <td className="lasso-cell--name">{[h.species, h.category].filter(Boolean).join(", ")}</td>
                    {/* 20.4: antal højrestillet med enheden i muted i samme celle. */}
                    <td className="lasso-num">
                      <span className="lasso-property__strong">{h.count != null ? formatNumber(h.count) : "-"}</span>
                      {h.unit ? <span className="lasso-livestock__unit"> {h.unit}</span> : null}
                    </td>
                  </tr>
                ))}
                <tr className="lasso-table__total">
                  <td className="lasso-property__strong">
                    {livestock.herds.length} besætning{livestock.herds.length === 1 ? "" : "er"}, {speciesCount} dyreart{speciesCount === 1 ? "" : "er"}
                  </td>
                  <td className="lasso-num lasso-muted">
                    Sundhedsstatus {livestock.healthStatus ? <span className="lasso-livestock__health">{livestock.healthStatus}</span> : "-"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div className="lasso-livestock__events">
          <div className="lasso-livestock__head">
            <span className="lasso-livestock__title">Veterinære hændelser</span>
            <span className="lasso-small lasso-muted">Seneste 24 mdr.</span>
          </div>
          {livestock.events.length > 0 ? (
            <ul className="lasso-livestock__timeline">
              {livestock.events.map((e, i) => (
                <li key={i} className={`lasso-livestock__event lasso-livestock__event--${e.severity ?? "neutral"}`}>
                  <span className="lasso-livestock__dot" aria-hidden="true" />
                  <div className="lasso-livestock__event-body">
                    <div>{e.title}</div>
                    <div className="lasso-small lasso-muted">
                      {[e.detail, e.date ? (e.dateTo ? `${formatDate(e.date)}–${formatDate(e.dateTo)}` : formatDate(e.date)) : undefined]
                        .filter(Boolean)
                        .join(", ")}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <DataState state="empty" reason="Ingen veterinære hændelser i CHR de seneste 24 måneder." />
          )}
        </div>
      </div>
    </Section>
  );
}
