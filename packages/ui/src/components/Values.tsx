import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import {
  changeText,
  formatAmount,
  formatBoolean,
  formatFullAmount,
  formatNumber,
  formatPeriod,
  formatRange,
  formatShare,
  listParts,
  NOT_REGISTERED,
  NOT_REPORTED,
  scoreWord,
} from "@lasso/spec";
import { Tooltip } from "./Tooltip.js";

/**
 * Felter med data (katalog 02c, node GKP-0): hvordan én værdi står i en nøgle-værdi-række.
 * Desktop: label til venstre (560 px bred række). Mobil (< 560 px): label over værdien.
 * Rækken er `.lasso-kv-row` (09); komponenterne her tegner kun selve værdien.
 */

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** Én række: label + værdi. Samme markup som nøgle-værdi-listen (09), så rækker kan blandes. */
export function ValueRow({ label, children, onClick }: { label: ReactNode; children: ReactNode; /** 02c.13: hele rækken er klikbar. */ onClick?: () => void }) {
  return (
    <div className={`lasso-kv-row ${onClick ? "lasso-kv-row--link" : ""}`} onClick={onClick}>
      <div className="lasso-kv-row__label">{label}</div>
      <div className="lasso-kv-row__value lasso-kv-row__value--wrap">{children}</div>
    </div>
  );
}

/**
 * 02c.17 Manglende værdi: "Ikke oplyst" når virksomheden ikke skal oplyse det, "Ikke registreret"
 * når feltet er tomt i kilden. I tabelceller bruges `Missing` ("—") i stedet.
 */
export function NotReported({ kind = "reported" }: { kind?: "reported" | "registered" }) {
  return <span className="lasso-notreported">{kind === "registered" ? NOT_REGISTERED : NOT_REPORTED}</span>;
}

/**
 * 02c.1 Fritekst: korte tekster i én linje, lange foldes efter 3 linjer med "Vis mere".
 * Ingen anførselstegn, ingen kursiv. Folden måles i browseren; uden DOM skønnes den på længden.
 */
export function FoldText({ text, lines = 3 }: { text: string; lines?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [overflow, setOverflow] = useState(text.length > 60 * lines);
  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el || open) return;
    setOverflow(el.scrollHeight > el.clientHeight + 1);
  }, [text, open]);
  return (
    <span className="lasso-fold">
      <span ref={ref} className={`lasso-fold__text ${open ? "is-open" : ""}`} style={{ WebkitLineClamp: open ? "unset" : lines }}>
        {text}
      </span>
      {overflow || open ? (
        <button type="button" className="lasso-fold__more" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? "Vis mindre" : "Vis mere"}
        </button>
      ) : null}
    </span>
  );
}

/** 02c.2 Tal: tusindtalspunktum, venstrestillet i nøgle-værdi, aldrig "0" for manglende. */
export function NumberValue({ value, unit }: { value: number | null | undefined; unit?: string }) {
  if (value === null || value === undefined || !Number.isFinite(value)) return <NotReported />;
  return (
    <span className="lasso-num">
      {formatNumber(value)}
      {unit ? ` ${unit}` : ""}
    </span>
  );
}

/** 02c.3 Tal-interval: "10–19", "1.000+", "under 5". */
export function RangeValue({ from, to, unit }: { from?: number | null; to?: number | null; unit?: string }) {
  if ((from === null || from === undefined) && (to === null || to === undefined)) return <NotReported />;
  return <span className="lasso-num">{formatRange(from, to, unit)}</span>;
}

/**
 * 02c.4 Beløb + ændring: mio./t. kr. med én decimal, fuldt tal i tooltip, ægte minus, ændringen som
 * trekant + ord ("▲ 12,4 % stigning"), farve kun sammen med tegn og ord.
 */
export function AmountValue({ value, previous, unit = "kr." }: { value: number | null | undefined; previous?: number | null; unit?: string }) {
  if (value === null || value === undefined || !Number.isFinite(value)) return <NotReported />;
  const change = changeText(previous, value);
  return (
    <span className="lasso-amount">
      <Tooltip text={formatFullAmount(value, unit)}>
        <span className="lasso-amount__value" tabIndex={0}>
          {formatAmount(value, unit)}
        </span>
      </Tooltip>
      {change ? (
        <span className={`lasso-amount__change ${change.tone === "down" ? "lasso-down" : "lasso-up"}`}>
          {change.arrow} {change.text}
        </span>
      ) : null}
    </span>
  );
}

/**
 * 02c.6 Dato og periode: dd.mm.åååå, perioder med tankestreg, åben periode som "siden 2016" eller
 * "2016 →", alder/varighed som muted tillæg.
 */
export function PeriodValue({ from, to, yearOnly, open = "since", extra }: { from?: string | null; to?: string | null; yearOnly?: boolean; open?: "since" | "arrow"; /** Muted tillæg, fx formatAge(stiftet). */ extra?: string }) {
  if (!from && !to) return <NotReported />;
  return (
    <span>
      {formatPeriod(from, to, { yearOnly, open })}
      {extra ? <span className="lasso-muted-extra">, {extra}</span> : null}
    </span>
  );
}

/** 02c.7 Ja/nej: altid ordene Ja/Nej, konsekvensen efter komma, ukendt = "Ikke oplyst". */
export function BooleanValue({ value, consequence }: { value: boolean | null | undefined; consequence?: string }) {
  if (value === null || value === undefined) return <NotReported />;
  return <span>{formatBoolean(value, consequence)}</span>;
}

/**
 * 02c.9 Liste af værdier: komma, "og" før sidste, desktop op til 2 navne, mobil 1. "og N flere" er
 * et link, der åbner "Se alle"-panelet (onShowAll). Tom liste = "Ingen" i muted.
 */
export function ValueList({ values, onShowAll, max = 2, mobileMax = 1 }: { values: readonly string[]; onShowAll?: () => void; max?: number; mobileMax?: number }) {
  const desk = listParts(values, max);
  if (desk.shown.length === 0) return <span className="lasso-muted-extra">Ingen</span>;
  const mob = listParts(values, mobileMax);
  const render = (p: ReturnType<typeof listParts>, cls: string) => (
    <span className={cls}>
      {p.rest > 0 ? (
        <>
          {p.shown.join(", ")} og{" "}
          {onShowAll ? (
            <button type="button" className="lasso-link lasso-link--more" onClick={onShowAll}>
              {p.rest} flere
            </button>
          ) : (
            `${p.rest} flere`
          )}
        </>
      ) : (
        p.text
      )}
    </span>
  );
  return (
    <span className="lasso-vlist">
      {render(desk, "lasso-vlist__desk")}
      {render(mob, "lasso-vlist__mob")}
    </span>
  );
}

/**
 * 02c.10 Branche med kode: koden først i muted, derefter teksten, som må ombrydes til 2 linjer
 * (aldrig "…" i detaljevisning). På mobil står koden under teksten.
 */
export function IndustryValue({ code, text }: { code?: string | null; text?: string | null }) {
  if (!text && !code) return <NotReported />;
  return (
    <span className="lasso-industry">
      {code ? <span className="lasso-industry__code">{code}</span> : null}
      {text ? <span className="lasso-industry__text">{text}</span> : null}
    </span>
  );
}

/**
 * 02c.11 Adresse: vej + nummer på linje 1, postnummer + by på linje 2, diskret kortlink.
 * `inline` giver én linje med komma (tabeller og hoveder).
 */
export function AddressValue({ street, zip, city, mapUrl, inline = false, mapLabel = "Vis på kort" }: { street?: string | null; zip?: string | null; city?: string | null; mapUrl?: string; inline?: boolean; mapLabel?: string }) {
  const line2 = [zip, city].filter(Boolean).join(" ");
  if (!street && !line2) return <NotReported kind="registered" />;
  if (inline) return <span>{[street, line2].filter(Boolean).join(", ")}</span>;
  return (
    <span className="lasso-address">
      {street ? <span className="lasso-address__line">{street}</span> : null}
      {line2 ? <span className="lasso-address__line">{line2}</span> : null}
      {mapUrl ? (
        <a className="lasso-address__map" href={mapUrl} target="_blank" rel="noreferrer">
          {mapLabel}
        </a>
      ) : null}
    </span>
  );
}

/** Kortlink til en adresse (02c.11). */
export function mapLink(parts: readonly (string | null | undefined)[]): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parts.filter(Boolean).join(", "))}`;
}

/**
 * 02c.13 Reference til person eller virksomhed: navnet i tekstfarve 500, koral med understregning
 * ved hover, ingen ikonkasse foran. Sekundær identitet (CVR) i muted efter navnet på desktop.
 */
export function EntityRef({ name, secondary, onOpen }: { name: string; secondary?: string; onOpen?: () => void }) {
  return (
    <span className="lasso-entity">
      {onOpen ? (
        <button type="button" className="lasso-link lasso-entity__name" onClick={(e) => { e.stopPropagation(); onOpen(); }}>
          {name}
        </button>
      ) : (
        <span className="lasso-entity__name">{name}</span>
      )}
      {secondary ? <span className="lasso-entity__sub">{secondary}</span> : null}
    </span>
  );
}

/**
 * 02c.14 Ejerandel-interval: "25–33,32 %" med tankestreg og decimalkomma, valgfri bjælke 200 × 6 px
 * med koral segment fra nedre til øvre grænse. Bjælken udelades på mobil.
 */
export function ShareValue({ range, bar = true }: { range: readonly [number, number] | null | undefined; bar?: boolean }) {
  if (!range) return <NotReported />;
  const lo = Math.max(0, Math.min(100, range[0]));
  const hi = Math.max(lo, Math.min(100, range[1]));
  return (
    <span className="lasso-sharevalue">
      <span className="lasso-num">{formatShare(range)}</span>
      {bar ? (
        <span className="lasso-sharevalue__bar" aria-hidden="true">
          <span className="lasso-sharevalue__seg" style={{ left: `${lo}%`, width: `${Math.max(1, hi - lo)}%` }} />
        </span>
      ) : null}
    </span>
  );
}

/**
 * 02c.15 Score: tallet i vægt 600, skala og tolkning i muted efter komma ("72, af 100, lav risiko").
 * Kun høj risiko farves (danger-tekst). Ingen pille, prik eller måler i lister.
 */
export function ScoreValue({ score, max = 100 }: { score: number | null | undefined; max?: number }) {
  if (score === null || score === undefined || !Number.isFinite(score)) return <NotReported />;
  const word = scoreWord((score / max) * 100);
  const high = word === "høj risiko";
  return (
    <span className={`lasso-score ${high ? "lasso-score--high" : ""}`}>
      <span className="lasso-score__n">{formatNumber(score)}</span>
      <span className="lasso-score__meta">
        , af {formatNumber(max)}, {word}
      </span>
    </span>
  );
}

export { QualityFlag } from "./QualityFlag.js";

/**
 * 02c.18 Låst værdi: feltet beholder plads og label. 14 px låseikon i muted, derefter en sløret
 * pladsholder eller antallet (hvis det må vises), og et kort link i primary-text. Ingen boks,
 * badge eller "Pro"-pille.
 */
export function LockedValue({ count, linkLabel = "Opgradér for at se", onUpgrade, href }: { count?: number; linkLabel?: string; onUpgrade?: () => void; href?: string }) {
  return (
    <span className="lasso-locked">
      <svg className="lasso-locked__icon" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.8" />
        <path d="M8 11V8a4 4 0 018 0v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      {typeof count === "number" ? (
        <span className="lasso-locked__count">{formatNumber(count)}</span>
      ) : (
        <span className="lasso-locked__blur" aria-label="Skjult værdi">
          00.000.000
        </span>
      )}
      {href ? (
        <a className="lasso-locked__link" href={href}>
          {linkLabel}
        </a>
      ) : (
        <button type="button" className="lasso-locked__link" onClick={onUpgrade}>
          {linkLabel}
        </button>
      )}
    </span>
  );
}
