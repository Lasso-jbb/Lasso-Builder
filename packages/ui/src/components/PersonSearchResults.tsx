import { Section } from "../primitives.js";
import { ShellIcon } from "./ShellIcons.js";
import { Tabs } from "./Tabs.js";

export interface PersonSearchResultVM {
  lassoId: string;
  name: string;
  /** "person" (standard) eller "company" (binavnematch, 28.5: bygningsikon foran navnet). */
  kind?: "person" | "company";
  /** Kun by, aldrig fuld privatadresse i lister. */
  city?: string;
  /** Anden linje under navnet i stedet for "Person, by", fx "CVR 34580820, Aarhus N". */
  sub?: string;
  /** De første selskaber (vises højst to). */
  companies: string[];
  totalCompanyCount?: number;
  /** Fx "3 selskaber, 5 roller" under selskaberne. */
  rolesText?: string;
  /** Hvad der matchede: "navn", "binavn 'Lasso'", "e-mail", "telefon" eller det fundne navn. */
  foundVia?: string;
}

export interface PersonSearchResultsProps {
  rows: readonly PersonSearchResultVM[];
  onOpen?: (row: PersonSearchResultVM) => void;
  /** Søgefeltet over resultaterne (28.5), fx "jakob bech company:lasso". Uden: kun listen. */
  query?: string;
  onQuery?: (q: string) => void;
  /** Segmentet "Virksomheder | Personer". */
  searchKind?: "companies" | "persons";
  onSearchKind?: (k: "companies" | "persons") => void;
  /** Resultattælleren, fx "2 personer fundet, filtreret på selskab 'lasso'". */
  summary?: string;
}

/**
 * Personsøgning og søgeresultat med "fundet via" (katalog 28.5, node HAL-0). Kort med søgefelt,
 * segment "Virksomheder | Personer" og resultattæller; rækker med navn 15 + "Person, by" i muted,
 * de to første selskaber og antal selskaber/roller i midten og "Fundet via …" i muted til højre. En
 * virksomhed fundet via binavn står med bygningsikon. Ingen relevansscore vises; den styrer kun
 * rækkefølgen. Mobil: 64 px rækker med chevron og "Fundet via …" under navnet.
 */
export function PersonSearchResults({ rows, onOpen, query, onQuery, searchKind = "persons", onSearchKind, summary }: PersonSearchResultsProps) {
  const head =
    query !== undefined ? (
      <div className="lasso-psearch__bar">
        <label className="lasso-psearch__field">
          <ShellIcon name="search" size={16} />
          <span className="lasso-sr">Søg</span>
          <input className="lasso-psearch__input" value={query} onChange={(e) => onQuery?.(e.target.value)} readOnly={!onQuery} />
        </label>
        <Tabs
          level={3}
          compact
          ariaLabel="Søg efter"
          items={[
            { id: "companies", label: "Virksomheder" },
            { id: "persons", label: "Personer" },
          ]}
          value={searchKind}
          onChange={(v) => onSearchKind?.(v as "companies" | "persons")}
        />
        {summary ? <span className="lasso-psearch__summary">{summary}</span> : null}
      </div>
    ) : null;
  const list =
    rows.length === 0 ? (
      <div className="lasso-state">
        <div className="lasso-small">Ingen personer matcher søgningen. Prøv med færre ord eller en anden stavemåde.</div>
      </div>
    ) : (
      <ul className="lasso-psearch">
        {rows.map((r) => {
          const total = r.totalCompanyCount ?? r.companies.length;
          const companies = r.companies.slice(0, 2).join(", ") + (total > 2 ? ` og ${total - 2} flere` : "");
          const company = r.kind === "company";
          const sub = r.sub ?? [company ? null : "Person", r.city].filter(Boolean).join(", ");
          return (
            <li key={r.lassoId} className={`lasso-psearch__row${onOpen ? " is-link" : ""}`} onClick={onOpen ? () => onOpen(r) : undefined}>
              <span className="lasso-psearch__main">
                <span className="lasso-psearch__name">
                  {company ? <ShellIcon name="company" size={16} /> : null}
                  {onOpen ? (
                    <button type="button" className="lasso-link" onClick={(e) => (e.stopPropagation(), onOpen(r))}>
                      {r.name}
                    </button>
                  ) : (
                    r.name
                  )}
                </span>
                {sub ? <span className="lasso-psearch__meta">{sub}</span> : null}
                {r.foundVia ? <span className="lasso-psearch__via lasso-psearch__via--m">{`Fundet via ${r.foundVia}`}</span> : null}
              </span>
              <span className="lasso-psearch__companies">
                {companies ? <span className="lasso-psearch__co">{companies}</span> : null}
                {r.rolesText ? <span className="lasso-psearch__meta">{r.rolesText}</span> : null}
              </span>
              {r.foundVia ? <span className="lasso-psearch__via">{`Fundet via ${r.foundVia}`}</span> : <span />}
            </li>
          );
        })}
      </ul>
    );
  if (!head) return list;
  return (
    <Section card className="lasso-psearch-card">
      {head}
      {list}
    </Section>
  );
}
