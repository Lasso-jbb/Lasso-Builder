import { formatDate } from "@lasso/spec";

export interface SnapshotPickerProps {
  /** Elementet, historikken gælder, fx "Ejerdiagram". Titlen bliver "Ejerdiagram, historik". */
  subject: string;
  /** Valgt dato (ÅÅÅÅ-MM-DD); udeladt = i dag (ingen snapshot). */
  date?: string;
  onChange: (date: string | undefined) => void;
  /** Hvad der vises, fx "ejerskab". Bruges i ur-linjen: "Du ser ejerskab pr. 31.12.2023." */
  what?: string;
  /** Tidligste dato, der kan vælges. */
  min?: string;
  /** Til tests: i dag som ÅÅÅÅ-MM-DD. */
  today?: string;
}

/**
 * Historik-/snapshot-skifter (katalog 14 "Pr. dato", mobil 26h.5, node GE5-0): datofelt med
 * kalenderikon, der åbner den native datovælger, og "I dag" til højre. Så længe et snapshot er
 * aktivt, står en rolig tekstlinje med ur-ikon under feltet; aldrig en farvet boks.
 */
export function SnapshotPicker({ subject, date, onChange, what = "data", min, today = new Date().toISOString().slice(0, 10) }: SnapshotPickerProps) {
  const active = Boolean(date && date < today);
  return (
    <section className="lasso-snapshot">
      <div className="lasso-snapshot__head">
        <h3 className="lasso-snapshot__title">{`${subject}, historik`}</h3>
        {active ? <span className="lasso-snapshot__tag">snapshot</span> : null}
      </div>
      <div className="lasso-snapshot__field">
        <svg className="lasso-snapshot__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="4" y="5.5" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.7" />
          <path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
        <input
          type="date"
          className="lasso-snapshot__input"
          aria-label={`${subject} pr. dato`}
          value={date ?? today}
          min={min}
          max={today}
          onChange={(e) => onChange(e.target.value && e.target.value < today ? e.target.value : undefined)}
        />
        <button type="button" className="lasso-link lasso-snapshot__today" onClick={() => onChange(undefined)} disabled={!active}>
          I dag
        </button>
      </div>
      {active ? (
        <p className="lasso-snapshot__note" role="status">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.8" />
            <path d="M12 7.5V12l3 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          {`Du ser ${what} pr. ${formatDate(date)}. Ændringer efter denne dato vises ikke.`}
        </p>
      ) : null}
    </section>
  );
}
