import { amountScale, formatPercent, formatScaled, type FinancialsVM } from "@lasso/spec";
import { DataState, Section, stateForError } from "../primitives.js";

/**
 * Fordeling: egenkapital og gæld som andele af balancen for seneste regnskabsår
 * (katalog 13, række 3, "Fordeling"). Andelsbjælker i stedet for donut: enklere
 * i ren SVG-fri markup og samme information (maks få segmenter, farve + tal).
 */
export function ShareBars({ financials, error }: { financials?: FinancialsVM; error?: string }) {
  const title = "Fordeling af balancen";
  if (!financials) {
    return (
      <Section title={title} span="half" className="lasso-sharebars">
        {error ? <DataState state={stateForError(error) === "noaccess" ? "empty" : "error"} reason={error} /> : <DataState state="loading" lines={3} height={140} />}
      </Section>
    );
  }
  // Gæld afledes af balancesum − egenkapital, når den ikke er oplyst direkte (klasse B).
  const debt = (y: FinancialsVM["years"][number]) =>
    typeof y.liabilities === "number" ? y.liabilities : typeof y.assetsTotal === "number" && typeof y.equity === "number" ? y.assetsTotal - y.equity : null;
  const yr = [...financials.years].reverse().find((y) => typeof y.equity === "number" && debt(y) !== null);
  if (!yr) {
    const hasEquity = financials.years.some((y) => typeof y.equity === "number");
    return (
      <Section title={title} span="half" className="lasso-sharebars">
        <DataState
          state="empty"
          reason={hasEquity ? "Regnskaberne oplyser egenkapital, men hverken gæld eller balancesum, så fordelingen kan ikke beregnes." : "Virksomheden har ikke oplyst egenkapital i sine regnskaber."}
          height={140}
        />
      </Section>
    );
  }
  const equity = yr.equity as number;
  const liabilities = debt(yr) as number;
  const total = equity + liabilities;
  if (total <= 0) {
    return (
      <Section title={title} span="half" className="lasso-sharebars">
        <DataState state="empty" reason="Balancen for seneste regnskabsår summer ikke til et positivt beløb." height={140} />
      </Section>
    );
  }
  const scale = amountScale([equity, liabilities]);
  const rows = [
    { key: "equity", label: "Egenkapital", value: equity, cls: "lasso-chart__swatch--s1" },
    { key: "liabilities", label: "Gæld", value: liabilities, cls: "lasso-chart__swatch--s2" },
  ];

  return (
    <Section title={title} subtitle={`${yr.year}, i alt ${formatScaled(total, scale)} ${scale.label}`} span="half" className="lasso-sharebars">
      <ul className="lasso-sharebar-list">
        {rows.map((r) => {
          const pct = (r.value / total) * 100;
          return (
            <li className="lasso-sharebar" key={r.key}>
              <span className={`lasso-chart__swatch ${r.cls}`} aria-hidden="true" />
              <span className="lasso-sharebar__label">{r.label}</span>
              <span className="lasso-sharebar__track">
                <span className={`lasso-sharebar__fill ${r.cls === "lasso-chart__swatch--s1" ? "lasso-sharebar__fill--s1" : "lasso-sharebar__fill--s2"}`} style={{ width: `${pct}%` }} />
              </span>
              <span className="lasso-sharebar__value">{formatScaled(r.value, scale)}</span>
              <span className="lasso-sharebar__pct">{formatPercent(pct, false)}</span>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
