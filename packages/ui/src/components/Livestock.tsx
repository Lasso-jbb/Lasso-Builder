import { formatDate, formatNumber, type LivestockVM } from "@lasso/spec";
import { DataState, Section, stateForError } from "../primitives.js";

function HerdIcon({ species }: { species?: string }) {
  if (species && /kvæg/i.test(species)) {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" className="lasso-livestock__icon">
        <path d="M5 14a7 5 0 0014 0V9H5z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M8 9V6M16 9V6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" className="lasso-livestock__icon">
      <ellipse cx="12" cy="13" rx="7" ry="5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="9" cy="12" r="1" fill="currentColor" />
      <circle cx="15" cy="12" r="1" fill="currentColor" />
      <path d="M6 8l-2-3M18 8l2-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/**
 * CHR (katalog 20): besætninger pr. dyretype + veterinære hændelser.
 * Vises kun for landbrug med et CHR-nummer; modellen/værten inkluderer kun
 * komponenten, når det er tilfældet, og det tomme udfald her er reelt
 * "ingen data", ikke en fejl (`LiveProvider` har intet bekræftet CHR-endpoint,
 * se docs/lasso-endpoints.md).
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
  if (!livestock.chrNumber || livestock.herds.length === 0) {
    return (
      <Section title={title} span="full">
        <DataState state="empty" reason="Virksomheden har intet CHR-nummer, eller der er ingen registrerede besætninger." />
      </Section>
    );
  }
  const speciesCount = new Set(livestock.herds.map((h) => h.species).filter(Boolean)).size;

  return (
    <Section title={title} subtitle="Husdyr pr. type og veterinære hændelser — kun for landbrug" span="full">
      <div className="lasso-livestock">
        <div className="lasso-livestock__herds">
          <div className="lasso-livestock__head">
            <span className="lasso-livestock__title">Besætninger, CHR {livestock.chrNumber}</span>
            <span className="lasso-small lasso-muted">
              {[livestock.ownerName, livestock.updated ? `opdateret ${formatDate(livestock.updated)}` : undefined].filter(Boolean).join(", ")}
            </span>
          </div>
          <div className="lasso-table-frame">
            <table className="lasso-table lasso-table--herds">
              <tbody>
                {livestock.herds.map((h, i) => (
                  <tr key={i}>
                    <td className="lasso-livestock__icon-cell">
                      <HerdIcon species={h.species} />
                    </td>
                    <td className="lasso-cell--name">{[h.species, h.category].filter(Boolean).join(", ")}</td>
                    <td className="lasso-num lasso-property__strong">{h.count != null ? formatNumber(h.count) : "—"}</td>
                    <td className="lasso-num lasso-muted">{h.unit}</td>
                  </tr>
                ))}
                <tr className="lasso-table__total">
                  <td />
                  <td className="lasso-property__strong">
                    {livestock.herds.length} besætning{livestock.herds.length === 1 ? "" : "er"}, {speciesCount} dyreart{speciesCount === 1 ? "" : "er"}
                  </td>
                  <td className="lasso-num lasso-muted" colSpan={2}>
                    Sundhedsstatus {livestock.healthStatus ? <span className="lasso-livestock__health">{livestock.healthStatus}</span> : "—"}
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
