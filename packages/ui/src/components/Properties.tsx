import { formatAmount, formatNumber, type BuildingVM, type PropertiesVM, type PropertyVM } from "@lasso/spec";
import { DataState, Missing, Section, stateForError } from "../primitives.js";

const MAX_PROPERTIES = 3;
const pct = new Intl.NumberFormat("da-DK", { maximumFractionDigits: 0 });

function buildingLabel(b: BuildingVM, i: number): string {
  return b.usage ?? `Bygning ${b.number ?? i + 1}`;
}

/**
 * Ejendomskortet (katalog 20.2, samme kortform som 13): baggrund med vejnet, matrikelpolygon i
 * map-fill og koral kant på den valgte bygning; øvrige bygninger hvide med tynd kant. Tegnes i
 * målestok fra `geometry` (lokale meter). Uden geometri vises en tom tilstand i stedet for at
 * opdigte et kort; ældre demodata med kun `hasGeometry` får det skematiske udsnit.
 */
function PropertyMap({ property }: { property: PropertyVM }) {
  const g = property.geometry;
  if (!g && !property.hasGeometry) {
    return (
      <div className="lasso-property-map lasso-property-map--empty">
        <span className="lasso-small lasso-muted">Intet matrikelkort tilgængeligt</span>
      </div>
    );
  }
  const W = 360;
  const H = 140;
  let body;
  if (g && g.parcel.length >= 3) {
    const pts = [...g.parcel, ...(g.buildings ?? []).flatMap((b) => b.polygon)];
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const pad = 24;
    const k = Math.min((W - 2 * pad) / Math.max(1, maxX - minX), (H - 2 * pad) / Math.max(1, maxY - minY));
    const ox = (W - (maxX - minX) * k) / 2;
    const oy = (H - (maxY - minY) * k) / 2;
    const path = (poly: [number, number][]) => poly.map(([x, y], i) => `${i ? "L" : "M"}${(ox + (x - minX) * k).toFixed(1)},${(H - oy - (y - minY) * k).toFixed(1)}`).join(" ") + "Z";
    body = (
      <>
        <path d={path(g.parcel)} className="lasso-property-map__parcel" />
        {(g.buildings ?? []).map((b, i) => (
          <path key={b.number ?? i} d={path(b.polygon)} className={`lasso-property-map__plot ${b.number !== undefined && b.number === g.selected ? "lasso-property-map__plot--selected" : "lasso-property-map__plot--other"}`} />
        ))}
      </>
    );
  } else {
    body = (
      <>
        <rect x="20" y="52" width="80" height="38" className="lasso-property-map__plot lasso-property-map__plot--other" />
        <rect x="140" y="52" width="90" height="38" className="lasso-property-map__plot lasso-property-map__plot--selected" />
        <rect x="262" y="52" width="70" height="38" className="lasso-property-map__plot lasso-property-map__plot--other" />
      </>
    );
  }
  return (
    <div className="lasso-property-map">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" className="lasso-property-map__svg" role="img" aria-label={property.matrikel ? `Matrikelkort, ${property.matrikel}` : "Matrikelkort"}>
        <rect width={W} height={H} className="lasso-property-map__bg" />
        <path d="M0 14H360M0 126H360M8 0V140M352 0V140M180 0V14M180 126V140" className="lasso-property-map__grid" />
        {body}
      </svg>
      {property.matrikel ? <span className="lasso-property-map__label">{property.matrikel}</span> : null}
      <div className="lasso-property-map__m" aria-hidden="true">
        {Array.from({ length: 6 }, (_, i) => (
          <span key={i} />
        ))}
      </div>
    </div>
  );
}

function PropertyBlock({ property }: { property: PropertyVM }) {
  const buildings = property.buildings;
  const totalArea = buildings.reduce((sum, b) => sum + (b.areaM2 ?? 0), 0);
  const totalUnits = buildings.reduce((sum, b) => sum + (b.units ?? 0), 0);
  const segments = buildings.filter((b) => (b.areaM2 ?? 0) > 0);
  const addressLine = property.address
    ? [property.address.street, [property.address.zip, property.address.city].filter(Boolean).join(" ")].filter(Boolean).join(", ")
    : undefined;

  return (
    <div className="lasso-property">
      <div className="lasso-property__card">
        <PropertyMap property={property} />
        {/* 26e.2 mobil: anvendelse, opført, erhvervsareal og ejerforhold i to kolonner. */}
        <dl className="lasso-property__mkv">
          <div>
            <dt>Anvendelse</dt>
            <dd>{buildings[0]?.usage ?? property.propertyType ?? <Missing />}</dd>
          </div>
          <div>
            <dt>Opført</dt>
            <dd>{buildings[0]?.builtYear ?? <Missing />}</dd>
          </div>
          <div>
            <dt>Erhvervsareal</dt>
            <dd>{totalArea > 0 ? `${formatNumber(totalArea)} m²` : <Missing />}</dd>
          </div>
          <div>
            <dt>Ejerforhold</dt>
            <dd>{property.ownership ?? <Missing />}</dd>
          </div>
        </dl>
        <div className="lasso-property__head">
          <div className="lasso-property__address">{addressLine ?? <Missing />}</div>
          <div className="lasso-small lasso-muted">
            {[property.propertyType, property.bfeNumber ? `BFE ${property.bfeNumber}` : undefined].filter(Boolean).join(", ") || "Ikke oplyst"}
          </div>
        </div>
        <div className="lasso-property__kv">
          <div className="lasso-property__row">
            <span>Ejerforhold</span>
            <span>{property.ownership ?? <Missing />}</span>
          </div>
          <div className="lasso-property__row">
            <span>Grundareal</span>
            <span>{property.landAreaM2 != null ? `${formatNumber(property.landAreaM2)} m²` : <Missing />}</span>
          </div>
          <div className="lasso-property__row">
            <span>Bebygget areal</span>
            <span>{property.builtAreaM2 != null ? `${formatNumber(property.builtAreaM2)} m²` : <Missing />}</span>
          </div>
          <div className="lasso-property__row">
            <span>Offentlig vurdering</span>
            <span>
              {property.publicValuation
                ? `${formatAmount(property.publicValuation.amount)}${property.publicValuation.year ? `, ${property.publicValuation.year}` : ""}`
                : <Missing />}
            </span>
          </div>
          <div className="lasso-property__row">
            <span>Hæftelser</span>
            <span className={property.encumbrances ? "lasso-property__link" : undefined}>
              {property.encumbrances == null ? <Missing /> : property.encumbrances > 0 ? `${property.encumbrances}, Se tinglysning` : "Ingen"}
            </span>
          </div>
        </div>
      </div>
      <div className="lasso-property__side">
        {buildings.length > 0 ? (
          <div className="lasso-table-frame">
            <div className="lasso-table-wrap">
              <table className="lasso-table lasso-table--fold lasso-table--buildings">
                <thead>
                  <tr>
                    <th>Bygn.</th>
                    <th>Anvendelse</th>
                    <th className="lasso-num">Opført</th>
                    <th className="lasso-num">Etager</th>
                    <th className="lasso-num">Samlet m²</th>
                    <th className="lasso-num">Enheder</th>
                  </tr>
                </thead>
                <tbody>
                  {buildings.map((b, i) => (
                    <tr key={b.number ?? i}>
                      <td data-label="Bygn.">{b.number ?? i + 1}</td>
                      <td data-label="Anvendelse" className="lasso-cell--name">
                        {buildingLabel(b, i)}
                      </td>
                      <td data-label="Opført" className="lasso-num">
                        {b.builtYear ?? <Missing />}
                      </td>
                      <td data-label="Etager" className="lasso-num">
                        {b.floors ?? <Missing />}
                      </td>
                      <td data-label="Samlet m²" className="lasso-num lasso-property__strong">
                        {b.areaM2 != null ? formatNumber(b.areaM2) : <Missing />}
                      </td>
                      <td data-label="Enheder" className="lasso-num">
                        {b.units != null ? formatNumber(b.units) : <Missing />}
                      </td>
                    </tr>
                  ))}
                  <tr className="lasso-table__total">
                    <td className="lasso-cell--blank" />
                    <td className="lasso-property__strong lasso-cell--total">
                      I alt, {buildings.length} bygning{buildings.length === 1 ? "" : "er"}
                    </td>
                    <td className="lasso-cell--blank" />
                    <td className="lasso-cell--blank" />
                    <td data-label="Samlet m²" className="lasso-num lasso-property__strong">{formatNumber(totalArea)}</td>
                    <td data-label="Enheder" className="lasso-num lasso-property__strong">{totalUnits > 0 ? formatNumber(totalUnits) : <Missing />}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <DataState state="empty" reason="Ingen bygninger fundet i BBR for denne ejendom." />
        )}
        {segments.length > 0 ? (
          <div className="lasso-arealfordeling">
            <div className="lasso-arealfordeling__head">
              <span className="lasso-arealfordeling__title">Arealfordeling</span>
              <span className="lasso-small lasso-muted">{formatNumber(totalArea)} m² samlet bygningsareal</span>
            </div>
            <div className="lasso-arealfordeling__bar" aria-hidden="true">
              {segments.map((b, i) => (
                <span
                  key={b.number ?? i}
                  className={`lasso-arealfordeling__seg lasso-chart-tone-${(i % 5) + 1}`}
                  style={{ width: `${((b.areaM2 ?? 0) / (totalArea || 1)) * 100}%` }}
                />
              ))}
            </div>
            <div className="lasso-arealfordeling__legend">
              {segments.map((b, i) => (
                <span key={b.number ?? i} className="lasso-arealfordeling__item">
                  <span className={`lasso-arealfordeling__dot lasso-chart-tone-${(i % 5) + 1}`} aria-hidden="true" />
                  {buildingLabel(b, i)} {formatNumber(b.areaM2 ?? 0)} m², {pct.format(((b.areaM2 ?? 0) / (totalArea || 1)) * 100)} %
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Ejendomme, BBR (katalog 20): ejendomskort, bygningstabel med "I alt"-række
 * og arealfordeling som stablet bjælke (serie 1–3, aldrig lagkage). Flere end
 * {@link MAX_PROPERTIES} ejendomme: vis de første og "Se N flere" (regel 9).
 */
export function Properties({ properties, title, error }: { properties?: PropertiesVM; title?: string; error?: string }) {
  const heading = title ?? (properties?.properties.length === 1 ? "Ejendom, BBR" : "Ejendomme, BBR");
  if (!properties) {
    return (
      <Section title={heading} span="full">
        {error ? <DataState state={stateForError(error) === "noaccess" ? "empty" : "error"} reason={error} /> : <DataState state="loading" lines={5} height={392} />}
      </Section>
    );
  }
  if (properties.properties.length === 0) {
    return (
      <Section title={heading} span="full">
        <DataState state="empty" reason="Virksomheden ejer eller lejer ingen registrerede ejendomme ifølge ejerfortegnelsen." />
      </Section>
    );
  }
  const shown = properties.properties.slice(0, MAX_PROPERTIES);
  const rest = properties.properties.length - shown.length;
  return (
    <Section title={heading} subtitle="Ejendomskort, bygninger og enheder, arealfordeling" span="full" className="lasso-properties-section">
      <div className="lasso-properties">
        {shown.map((p, i) => (
          <PropertyBlock key={p.bfeNumber ?? i} property={p} />
        ))}
      </div>
      {rest > 0 ? <p className="lasso-more">Se {rest} ejendom{rest === 1 ? "" : "me"} mere</p> : null}
    </Section>
  );
}
