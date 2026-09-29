import { ShellIcon } from "./ShellIcons.js";

export interface SourceListItem {
  /** Kilden, fx "CVR, Erhvervsstyrelsen" eller "Regnskaber, XBRL". */
  name: string;
  /** Tidsstempel som tekst ("i dag 06:10", "for 2 timer siden") eller ISO-dato (vises DD.MM.ÅÅÅÅ). */
  updated?: string;
}

export interface SourceListProps {
  title?: string;
  sources: readonly SourceListItem[];
  /** PDF som 40 px række med hent-ikon, fx { label: "Hent årsrapport 2025 (PDF)", url }. */
  pdf?: { label: string; url: string };
  /** Værten åbner PDF'en (MCP); ellers et almindeligt link. */
  onOpenPdf?: (url: string) => void;
}

const ISO = /^(\d{4})-(\d{2})-(\d{2})/;

/**
 * Kilder og opdatering (katalog 02c, mobil 26h.4, node GDK-0): samlet kildeliste med tidsstempel
 * pr. kilde (44 px rækker, navn til venstre, tid i muted til højre) og årsrapporten som 40 px række
 * med hent-ikon. Til portalens "Om data"-sektion; kildelinjen (SourceLine) står stadig én gang pr.
 * sektion.
 */
export function SourceList({ title = "Kilder og opdatering", sources, pdf, onOpenPdf }: SourceListProps) {
  return (
    <section className="lasso-sourcelist">
      <h3 className="lasso-sourcelist__title">{title}</h3>
      <ul className="lasso-sourcelist__rows">
        {sources.map((s) => {
          const m = s.updated ? ISO.exec(s.updated) : null;
          return (
            <li key={s.name} className="lasso-sourcelist__row">
              <span className="lasso-sourcelist__name">{s.name}</span>
              <span className="lasso-sourcelist__time">{m ? `${m[3]}.${m[2]}.${m[1]}` : (s.updated ?? "-")}</span>
            </li>
          );
        })}
      </ul>
      {pdf ? (
        onOpenPdf ? (
          <button type="button" className="lasso-sourcelist__pdf" onClick={() => onOpenPdf(pdf.url)}>
            <span>{pdf.label}</span>
            <ShellIcon name="download" size={16} />
          </button>
        ) : (
          <a className="lasso-sourcelist__pdf" href={pdf.url} target="_blank" rel="noopener noreferrer">
            <span>{pdf.label}</span>
            <ShellIcon name="download" size={16} />
          </a>
        )
      ) : null}
    </section>
  );
}
