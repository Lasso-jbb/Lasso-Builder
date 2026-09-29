import { useState } from "react";
import { amountScale, formatDate, formatScaled, type CompanyEventsVM, type CompanyVM, type MergerPartyVM } from "@lasso/spec";
import { DataState, Section, SourceLine, stateForError } from "../primitives.js";
import type { ViewAction } from "../types.js";

function Loading({ title, error, lines = 3 }: { title: string; error?: string; lines?: number }) {
  return (
    <Section title={title} span="full">
      {error ? <DataState state={stateForError(error) === "noaccess" ? "empty" : "error"} reason={error} /> : <DataState state="loading" lines={lines} height={lines * 40} />}
    </Section>
  );
}

function PartyCard({ p, focusId, onOpen }: { p: MergerPartyVM; focusId?: string; onOpen?: (a: ViewAction) => void }) {
  const focus = Boolean(focusId && p.lassoId === focusId);
  const open = onOpen && p.lassoId && !focus ? () => onOpen({ kind: "open-company", lassoId: p.lassoId!, name: p.name }) : undefined;
  return (
    <span className={`lasso-merger__party${focus ? " is-focus" : ""}${p.ceased ? " is-ceased" : ""}`}>
      {open ? (
        <button type="button" className="lasso-link lasso-merger__name" onClick={open}>
          {p.name}
        </button>
      ) : (
        <span className="lasso-merger__name">{p.name}</span>
      )}
      <span className="lasso-merger__note">{[p.cvr ? `CVR ${p.cvr}` : null, p.ceased ? "ophørt ved fusionen" : (p.role ?? (focus ? "denne virksomhed" : null))].filter(Boolean).join(", ")}</span>
    </span>
  );
}

/**
 * Fusioner og spaltninger (katalog 28.6, mobil 26h.8). Kort med "N hændelser" under titlen. Desktop:
 * dato og type i venstre kolonne, hændelsen som "fra → til" med selskabskort i 1 px kant (navn + "CVR …,
 * rolle"); fokusvirksomheden får koral kant, ophørte selskaber står i muted med "ophørt ved fusionen".
 * Mobil: mini-tidslinje med koral prik pr. hændelse ("01.07.2022, fusion"), "Se de N ophørte selskaber"
 * ved flere ophørte og "Stiftet" nederst. Ingen hændelser: tom tilstand, der siger hvorfor.
 */
export function Mergers({ events, company, title, error, demo, onOpen }: { events?: CompanyEventsVM; company?: CompanyVM; title?: string; error?: string; demo?: boolean; onOpen?: (a: ViewAction) => void }) {
  const heading = title ?? "Fusioner og spaltninger";
  if (!events) return <Loading title={heading} error={error} />;
  const list = events.mergers;
  if (list.length === 0) {
    return (
      <Section title={heading} span="full">
        <DataState state="empty" reason="Der er ingen registrerede fusioner eller spaltninger for virksomheden i CVR." />
      </Section>
    );
  }
  const focusId = events.lassoId;
  const sentence = (m: (typeof list)[number]) => {
    const ceased = m.from.filter((p) => p.ceased);
    const names = (ps: MergerPartyVM[]) =>
      ceased.length > 1 && ps === m.from ? `${ceased.length} selskaber` : ps.map((p) => (p.lassoId === focusId ? "denne virksomhed" : `${p.name}${p.ceased ? " (ophørende)" : ""}`)).join(", ");
    return m.type === "Fusion" ? `${names(m.from)} fusioneret ind i ${names(m.to)}` : `${names(m.from)} spaltet til ${names(m.to)}`;
  };
  const subtitle = `${list.length} ${list.length === 1 ? "hændelse" : "hændelser"}${demo ? ", alle selskaber er eksempeldata" : ""}`;
  return (
    <Section title={heading} subtitle={<span className="lasso-mergers__sub">{subtitle}</span>} span="full" card className="lasso-mergers" action={demo ? <span className="lasso-mergers__meta">eksempeldata</span> : undefined}>
      <ul className="lasso-mergers__rows">
        {list.map((m, i) => (
          <li key={`${m.date}-${i}`} className="lasso-merger">
            <span className="lasso-merger__when">
              <span className="lasso-merger__date">{m.date ? formatDate(m.date) : "Dato ikke oplyst"}</span>
              <span className="lasso-merger__type">{m.type}</span>
            </span>
            <span className="lasso-merger__flow">
              <span className="lasso-merger__side">
                {m.from.map((p, j) => (
                  <PartyCard key={`f${j}`} p={p} focusId={focusId} onOpen={onOpen} />
                ))}
              </span>
              <span className="lasso-merger__arrow" aria-label="til">
                →
              </span>
              <span className="lasso-merger__side">
                {m.to.map((p, j) => (
                  <PartyCard key={`t${j}`} p={p} focusId={focusId} onOpen={onOpen} />
                ))}
              </span>
            </span>
            <span className="lasso-merger__sentence">{sentence(m)}</span>
            {m.from.filter((p) => p.ceased).length > 1 ? <CeasedToggle parties={m.from.filter((p) => p.ceased)} /> : null}
          </li>
        ))}
        {company?.founded ? (
          <li className="lasso-merger lasso-merger--founded">
            <span className="lasso-merger__when">
              <span className="lasso-merger__date">{formatDate(company.founded)}</span>
            </span>
            <span className="lasso-merger__sentence">Stiftet</span>
          </li>
        ) : null}
      </ul>
      <div className="lasso-mergers__source">
        <SourceLine source="CVR via Lasso" updated={events.updated} />
      </div>
    </Section>
  );
}

/** Mobil (26h.8): "Se de N ophørte selskaber" folder navnene ud under sætningen. */
function CeasedToggle({ parties }: { parties: MergerPartyVM[] }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="lasso-merger__ceased">
      <button type="button" className="lasso-link lasso-merger__ceased-btn" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? "Skjul ophørte selskaber" : `Se de ${parties.length} ophørte selskaber`}
      </button>
      {open ? <span className="lasso-merger__ceased-list">{parties.map((p) => p.name).join(", ")}</span> : null}
    </span>
  );
}

const ANNOUNCEMENTS_SHOWN = 3;

/**
 * Statstidende, seneste bekendtgørelser (katalog 28.8). Typen er en fast tekstkolonne farvet efter
 * alvor som status (konkurs mørk rød, rekonstruktion/likvidation warning, øvrige tekstfarve), altid
 * med ordet. Brødteksten er Statstidendes egen, foldet til to linjer med "Vis". Sektionen udelades
 * helt, når der ingen bekendtgørelser er (ikke tom tilstand).
 */
export function Announcements({ events, title, error }: { events?: CompanyEventsVM; title?: string; error?: string }) {
  const heading = title ?? "Statstidende";
  const [open, setOpen] = useState<Set<number>>(new Set());
  const [all, setAll] = useState(false);
  if (!events) return <Loading title={heading} error={error} />;
  const list = events.announcements;
  if (list.length === 0) return null;
  const shown = all ? list : list.slice(0, ANNOUNCEMENTS_SHOWN);
  return (
    <Section title={heading} subtitle="Seneste bekendtgørelser" span="full" className="lasso-announce">
      <ul className="lasso-announce__rows">
        {shown.map((a, i) => (
          <li key={`${a.date}-${i}`} className="lasso-announce__row">
            <span className="lasso-announce__date">{a.date ? formatDate(a.date) : "—"}</span>
            <span className={`lasso-announce__type lasso-announce__type--${a.severity}`}>{a.type}</span>
            <span className="lasso-announce__body">
              {a.text ? <span className={`lasso-announce__text${open.has(i) ? " is-open" : ""}`}>{a.text}</span> : null}
              {a.text && a.text.length > 120 ? (
                <button
                  type="button"
                  className="lasso-link lasso-announce__more"
                  aria-expanded={open.has(i)}
                  onClick={() => {
                    const next = new Set(open);
                    if (next.has(i)) next.delete(i);
                    else next.add(i);
                    setOpen(next);
                  }}
                >
                  {open.has(i) ? "Skjul" : "Vis"}
                </button>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
      {list.length > ANNOUNCEMENTS_SHOWN ? (
        <button type="button" className="lasso-link lasso-more" aria-expanded={all} onClick={() => setAll(!all)}>
          {all ? "Vis færre" : `Se alle ${list.length} bekendtgørelser`}
        </button>
      ) : null}
      <SourceLine source="Statstidende via Lasso, inkl. kreditoroplysninger" updated={events.updated} />
    </Section>
  );
}

/**
 * Regnskabspublicering (katalog 28.2): tabel (15) sorteret efter offentliggørelsesdato, nyeste
 * først. Type "Årsrapport", "Halvår" eller "Kvartal" plus "ny" eller "korrigeret". Et korrigeret
 * regnskab får udråbstegn-ikonet fra kvalitetsflaget og den tidligere værdi som "før …" i muted
 * under tallet, aldrig gennemstreget. Mobil: rækkerne foldes (fælles `.lasso-table--fold`).
 */
export function Publications({ events, title, error, limit = 5 }: { events?: CompanyEventsVM; title?: string; error?: string; limit?: number }) {
  const heading = title ?? "Regnskabspublicering";
  const [all, setAll] = useState(false);
  if (!events) return <Loading title={heading} error={error} lines={5} />;
  const list = events.publications;
  if (list.length === 0) {
    return (
      <Section title={heading} span="full">
        <DataState state="empty" reason="Virksomheden har ikke offentliggjort regnskaber i Erhvervsstyrelsen." />
      </Section>
    );
  }
  const values = list.flatMap((p) => [p.figure?.value, p.figure?.previous]).filter((v): v is number => typeof v === "number");
  const scale = amountScale(values);
  const shown = all ? list : list.slice(0, limit);
  return (
    <Section title={heading} span="full" className="lasso-publications">
      <div className="lasso-table-frame">
        <div className="lasso-table-wrap">
          <table className="lasso-table lasso-table--fold lasso-publications__table">
            <thead>
              <tr>
                <th>Offentliggjort</th>
                <th>Type</th>
                <th>Periode</th>
                <th className="lasso-num">Hovedtal, {scale.label}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((p, i) => (
                <tr key={`${p.published}-${i}`}>
                  <td data-label="Offentliggjort">{p.published ? formatDate(p.published) : <span className="lasso-notreported">—</span>}</td>
                  <td data-label="Type" className="lasso-cell--name">
                    <span className="lasso-publications__type">
                      {p.corrected ? (
                        <span className="lasso-stmt__flag" title="Korrigeret regnskab" aria-hidden="true">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
                            <path d="M12 7v6M12 16.5v.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
                          </svg>
                        </span>
                      ) : null}
                      {`${p.kind}${p.year ? ` ${p.year}` : ""}, ${p.corrected ? "korrigeret" : "ny"}`}
                    </span>
                  </td>
                  <td data-label="Periode">{p.periodEnd ? `til ${formatDate(p.periodEnd)}` : <span className="lasso-notreported">—</span>}</td>
                  <td data-label={p.figure?.label ?? "Hovedtal"} className="lasso-num">
                    <span className="lasso-publications__figure">
                      <span className={typeof p.figure?.value === "number" && p.figure.value < 0 ? "lasso-down" : undefined}>
                        {typeof p.figure?.value === "number" ? formatScaled(p.figure.value, scale) : <span className="lasso-notreported">—</span>}
                      </span>
                      {p.corrected && typeof p.figure?.previous === "number" ? <span className="lasso-publications__before">før {formatScaled(p.figure.previous, scale)}</span> : null}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {list.length > limit ? (
        <button type="button" className="lasso-link lasso-more" aria-expanded={all} onClick={() => setAll(!all)}>
          {all ? "Vis færre" : `Se alle ${list.length} regnskaber`}
        </button>
      ) : null}
      <SourceLine source="Erhvervsstyrelsen via Lasso" updated={events.updated} />
    </Section>
  );
}
