import { amountScale, currencyUnit, formatNumber, formatPercent, formatScaled, shareText, type FinancialsVM, type OwnershipVM } from "@lasso/spec";
import { DataState, Section, stateForError } from "../primitives.js";

/** Én andel i fordelingen. `lo`/`hi` er procent (0–100); et CVR-interval har lo < hi, et præcist tal lo = hi. */
export interface ShareItem {
  key: string;
  label: string;
  lo: number;
  hi: number;
  /** Teksten ved siden af bjælken, fx "18,8 mio. kr." eller "50–66,66 %". */
  valueText: string;
}

/** "50–66,66 %" -> [50, 66.66]; "100 %" -> [100, 100]. Ukendt form -> null. */
export function parseShareRange(share: string | undefined): [number, number] | null {
  if (!share) return null;
  const nums = [...share.matchAll(/\d+(?:[.,]\d+)?/g)].map((m) => Number(m[0].replace(",", ".")));
  if (nums.length === 0 || nums.some((n) => !Number.isFinite(n))) return null;
  const lo = nums[0]!;
  const hi = nums[1] ?? lo;
  return [Math.min(lo, hi), Math.max(lo, hi)];
}

const TONES = ["s1", "s2", "s3", "s4"] as const;

/**
 * Donut med total i midten (13.8): ring 16 px (mobil 96 px i alt), maks 4 farvede segmenter + "øvrige"
 * i grå (chart-6). Aldrig lagkage. Donutten er kun oversigt; andelsbjælkerne er aflæsningen.
 */
function Donut({ items, center, sub, size }: { items: readonly { tone: string; share: number }[]; center: string; sub: string; size: number }) {
  const ring = 16;
  const r = (size - ring) / 2;
  const c = 2 * Math.PI * r;
  const total = items.reduce((s, x) => s + x.share, 0) || 1;
  let acc = 0;
  const gap = items.length > 1 ? 2 : 0;
  return (
    <div className="lasso-donut" style={{ ["--lasso-donut-base" as string]: `${size}px` }}>
      <svg width="100%" height="100%" viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle className="lasso-donut__track" cx={size / 2} cy={size / 2} r={r} strokeWidth={ring} />
        {items.map((it, i) => {
          const len = (it.share / total) * c;
          const dash = Math.max(0, len - gap);
          const el = (
            <circle
              key={i}
              className={`lasso-donut__seg lasso-chart-stroke--${it.tone}`}
              cx={size / 2}
              cy={size / 2}
              r={r}
              strokeWidth={ring}
              strokeDasharray={`${dash} ${c - dash}`}
              strokeDashoffset={-acc}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          );
          acc += len;
          return el;
        })}
      </svg>
      <div className="lasso-donut__center">
        <span className="lasso-donut__value">{center}</span>
        <span className="lasso-donut__sub">{sub}</span>
      </div>
    </div>
  );
}

/** Donut + andelsbjælker. Bjælken tegner maks (hi); intervallet står som tekst. */
function Distribution({ items, center, sub, note }: { items: readonly ShareItem[]; center: string; sub: string; note?: string }) {
  const colored = items.slice(0, 4);
  const rest = items.slice(4);
  const mid = (it: ShareItem) => (it.lo + it.hi) / 2;
  const coloredSum = colored.reduce((s, it) => s + mid(it), 0);
  const restShare = rest.reduce((s, it) => s + mid(it), 0) + Math.max(0, 100 - coloredSum - rest.reduce((s, it) => s + mid(it), 0));
  const donutItems = [...colored.map((it, i) => ({ tone: TONES[i]!, share: mid(it) })), ...(restShare > 0.05 ? [{ tone: "s6", share: restShare }] : [])];
  const restRow: ShareItem | null =
    rest.length > 0 ? { key: "rest", label: `Øvrige (${formatNumber(rest.length)})`, lo: rest.reduce((s, it) => s + it.lo, 0), hi: Math.min(100, rest.reduce((s, it) => s + it.hi, 0)), valueText: "" } : null;
  const rows = [...colored.map((it, i) => ({ it, tone: TONES[i]! as string })), ...(restRow ? [{ it: restRow, tone: "s6" }] : [])];
  return (
    <div className="lasso-dist">
      <Donut items={donutItems} center={center} sub={sub} size={140} />
      <ul className="lasso-sharebar-list">
        {rows.map(({ it, tone }) => {
          const interval = it.hi - it.lo > 0.005;
          // CVR-intervaller står som CVR skriver dem ("50–66,66 %"); præcise andele med én decimal.
          const pctText = interval ? (it.valueText.includes("%") ? it.valueText : `${formatNumber(Math.round(it.lo))}–${formatPercent(it.hi, false)}`) : formatPercent(it.hi, false);
          return (
            <li className="lasso-sharebar" key={it.key}>
              <span className={`lasso-chart__swatch lasso-chart__swatch--${tone}`} aria-hidden="true" />
              <span className="lasso-sharebar__label">{it.label}</span>
              <span className="lasso-sharebar__track">
                <span className={`lasso-sharebar__fill lasso-chart-fill--${tone}`} style={{ width: `${Math.min(100, it.hi)}%` }} />
              </span>
              <span className="lasso-sharebar__value">{it.valueText && !it.valueText.includes("%") ? it.valueText : ""}</span>
              <span className="lasso-sharebar__pct">{pctText}</span>
            </li>
          );
        })}
      </ul>
      {note ? <p className="lasso-sharebar__note">{note}</p> : null}
    </div>
  );
}

/**
 * Fordeling, donut med tal i midten + andelsbjælker (katalog 13.8, node AHT-0).
 * - variant "balance": egenkapital og gæld som andele af balancen for seneste regnskabsår.
 * - variant "ejerkreds": de legale ejere med CVR's ejerandelsintervaller som tekst; bjælken tegner maks.
 * Mobil (26b.6): donut 96 px med legenden ved siden af, intervaller som tekst.
 */
export function ShareBars({ financials, ownership, variant = "balance", error }: { financials?: FinancialsVM; ownership?: OwnershipVM; variant?: "balance" | "ejerkreds"; error?: string }) {
  if (variant === "ejerkreds") {
    const title = "Ejerkreds";
    if (!ownership) {
      return (
        <Section title={title} span="half" className="lasso-sharebars">
          {error ? <DataState state={stateForError(error) === "noaccess" ? "empty" : "error"} reason={error} /> : <DataState state="loading" lines={3} height={140} />}
        </Section>
      );
    }
    const items: ShareItem[] = ownership.owners
      .map((o, i) => {
        const r = parseShareRange(o.share);
        return r ? { key: `${i}`, label: o.name, lo: r[0], hi: r[1], valueText: shareText(o.share) ?? "" } : null;
      })
      .filter((x): x is ShareItem => x !== null)
      .sort((a, b) => b.hi - a.hi);
    if (items.length === 0) {
      return (
        <Section title={title} span="half" className="lasso-sharebars">
          <DataState state="empty" reason="CVR oplyser ingen ejerandele for virksomhedens ejere." height={140} />
        </Section>
      );
    }
    const note = ownership.hasOwnersUnderFivePercent ? "Der er desuden ejere under 5 %, som CVR ikke registrerer enkeltvis." : "Ejerandele fra CVR er intervaller; bjælken viser intervallets maks.";
    return (
      <Section title={title} subtitle={`${formatNumber(items.length)} ${items.length === 1 ? "ejer" : "ejere"} med registreret andel`} span="half" className="lasso-sharebars">
        <Distribution items={items} center={formatNumber(items.length)} sub={items.length === 1 ? "ejer" : "ejere"} note={note} />
      </Section>
    );
  }

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
  if (total <= 0 || equity < 0) {
    return (
      <Section title={title} span="half" className="lasso-sharebars">
        <DataState state="empty" reason={equity < 0 ? "Egenkapitalen er negativ, så balancen kan ikke vises som andele." : "Balancen for seneste regnskabsår summer ikke til et positivt beløb."} height={140} />
      </Section>
    );
  }
  const scale = amountScale([equity, liabilities, total], currencyUnit(financials.currency));
  const pct = (v: number) => (v / total) * 100;
  const items: ShareItem[] = [
    { key: "equity", label: "Egenkapital", lo: pct(equity), hi: pct(equity), valueText: `${formatScaled(equity, scale)} ${scale.label}` },
    { key: "liabilities", label: "Gæld", lo: pct(liabilities), hi: pct(liabilities), valueText: `${formatScaled(liabilities, scale)} ${scale.label}` },
  ];
  return (
    <Section title={title} subtitle={`${yr.year}, i alt ${formatScaled(total, scale)} ${scale.label}`} span="half" className="lasso-sharebars">
      <Distribution items={items} center={formatScaled(total, scale)} sub={scale.label} />
    </Section>
  );
}
