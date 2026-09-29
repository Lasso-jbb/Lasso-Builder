export interface PersonSearchResultVM {
  lassoId: string;
  name: string;
  /** Kun by, aldrig fuld privatadresse i lister. */
  city?: string;
  /** De første selskaber (vises højst to). */
  companies: string[];
  totalCompanyCount?: number;
  /** Når matchet ikke er på det viste navn: "binavn", "e-mail", "telefon" eller det fundne navn. */
  foundVia?: string;
}

/**
 * Personsøgning, resultatliste med "fundet via" (katalog 28.5, node HAL-0). Navn, by, de to første
 * selskaber og "og N flere" (totalCompanyCount). "Fundet via …" står i muted til højre, når matchet
 * ikke er på det viste navn. Ingen relevansscore vises; den styrer kun rækkefølgen. Ren UI-komponent;
 * søgefeltet med segment for type og filtre som chips hører til portalens søgning (04).
 */
export function PersonSearchResults({ rows, onOpen }: { rows: readonly PersonSearchResultVM[]; onOpen?: (row: PersonSearchResultVM) => void }) {
  if (rows.length === 0) {
    return (
      <div className="lasso-state">
        <div className="lasso-small">Ingen personer matcher søgningen. Prøv med færre ord eller en anden stavemåde.</div>
      </div>
    );
  }
  return (
    <ul className="lasso-psearch">
      {rows.map((r) => {
        const total = r.totalCompanyCount ?? r.companies.length;
        const companies = r.companies.slice(0, 2).join(", ") + (total > 2 ? ` og ${total - 2} flere` : "");
        return (
          <li key={r.lassoId} className="lasso-psearch__row">
            <span className="lasso-psearch__main">
              {onOpen ? (
                <button type="button" className="lasso-link lasso-psearch__name" onClick={() => onOpen(r)}>
                  {r.name}
                </button>
              ) : (
                <span className="lasso-psearch__name">{r.name}</span>
              )}
              <span className="lasso-psearch__meta">{[r.city, companies].filter(Boolean).join(", ")}</span>
            </span>
            {r.foundVia ? <span className="lasso-psearch__via">{`Fundet via ${r.foundVia}`}</span> : null}
          </li>
        );
      })}
    </ul>
  );
}
