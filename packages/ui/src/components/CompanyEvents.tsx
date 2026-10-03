import { useState } from "react";
import { usePrintMode } from "../print.js";
import { ExpandLink, foldedCount } from "./ExpandLink.js";
import { formatAmount, formatDate, type AnnouncementVM, type CompanyEventsVM, type CompanyVM, type MergerPartyVM, type PublicationVM } from "@lasso/spec";
import { Icon } from "./Icon.js";
import { DataState, Section, stateForError } from "../primitives.js";
import type { ViewAction } from "../types.js";

function Loading({ title, error, lines = 3 }: { title: string; error?: string; lines?: number }) {
  return (
    <Section title={title} span="full" card>
      {error ? <DataState state={stateForError(error) === "noaccess" ? "empty" : "error"} reason={error} /> : <DataState state="loading" lines={lines} height={lines * 40} />}
    </Section>
  );
}

/** Et selskab i en fusion/spaltning: navnet (link, når det kan åbnes) og CVR + "denne virksomhed"/"nystiftet" i muted. */
function Party({ p, focusId, onOpen }: { p: MergerPartyVM; focusId?: string; onOpen?: (a: ViewAction) => void }) {
  const focus = Boolean(focusId && p.lassoId === focusId);
  const open = onOpen && p.lassoId && !focus ? () => onOpen({ kind: "open-company", lassoId: p.lassoId!, name: p.name }) : undefined;
  const note = [p.cvr ? `CVR ${p.cvr}` : null, focus ? "denne virksomhed" : null, p.role && /nystift/i.test(p.role) ? "nystiftet" : null].filter(Boolean).join(", ");
  return (
    <li className={`lasso-merger__party${focus ? " is-focus" : ""}${p.ceased ? " is-ceased" : ""}`}>
      {open ? (
        <button type="button" className="lasso-link lasso-merger__name" onClick={open}>
          {p.name}
        </button>
      ) : (
        <span className="lasso-merger__name">{p.name}</span>
      )}
      {note ? <span className="lasso-merger__note">{note}</span> : null}
    </li>
  );
}

/** Gruppernes navne efter hændelsens type, så det er tydeligt, hvem der ophørte, og hvem der fortsatte. */
function groupLabels(type: string, from: readonly MergerPartyVM[]): [string, string] {
  if (/spalt/i.test(type)) return [from.length > 1 ? "Afgivende selskaber" : "Afgivende selskab", "Modtagende selskab"];
  const ceased = from.every((p) => p.ceased);
  return [ceased ? (from.length > 1 ? "Ophørte ved fusionen" : "Ophørte ved fusionen") : "Indfusionerede selskaber", "Fortsættende selskab"];
}

/**
 * Fusioner og spaltninger (katalog 28.6, Jakob 01.10: tydeligere): hver hændelse har typen og datoen som
 * overskrift og to navngivne grupper, så man kan se, hvem der ophørte, og hvem der fortsatte: ved en fusion
 * "Ophørte ved fusionen" og "Fortsættende selskab", ved en spaltning "Afgivende selskab" og "Modtagende selskab".
 * Fokusvirksomheden står med "denne virksomhed" og koral markering. Samme form på alle bredder; "Stiftet"
 * nederst. Ingen hændelser: tom tilstand, der siger hvorfor.
 */
export function Mergers({ events, company, title, error, demo, onOpen }: { events?: CompanyEventsVM; company?: CompanyVM; title?: string; error?: string; demo?: boolean; onOpen?: (a: ViewAction) => void }) {
  const heading = title ?? "Fusioner og spaltninger";
  if (!events) return <Loading title={heading} error={error} />;
  const list = events.mergers;
  if (list.length === 0) {
    return (
      <Section title={heading} span="full" card>
        <DataState state="empty" reason="Der er ingen registrerede fusioner eller spaltninger for virksomheden i CVR." />
      </Section>
    );
  }
  const focusId = events.lassoId;
  const subtitle = `${list.length} ${list.length === 1 ? "hændelse" : "hændelser"}${demo ? ", eksempeldata" : ""}`;
  return (
    <Section title={heading} subtitle={subtitle} span="full" card className="lasso-mergers">
      <ol className="lasso-mergers__rows">
        {list.map((m, i) => {
          const [fromLabel, toLabel] = groupLabels(m.type, m.from);
          return (
            <li key={`${m.date}-${i}`} className="lasso-merger">
              <div className="lasso-merger__head">
                <span className="lasso-merger__type">{m.type}</span>
                <span className="lasso-merger__date">{m.date ? formatDate(m.date) : "Dato ikke oplyst"}</span>
              </div>
              <div className="lasso-merger__groups">
                <div className="lasso-merger__group">
                  <div className="lasso-merger__label">{fromLabel}</div>
                  <ul className="lasso-merger__parties">
                    {m.from.map((p, j) => (
                      <Party key={`f${j}`} p={p} focusId={focusId} onOpen={onOpen} />
                    ))}
                  </ul>
                </div>
                <span className="lasso-merger__arrow" aria-hidden="true">
                  →
                </span>
                <div className="lasso-merger__group">
                  <div className="lasso-merger__label">{toLabel}</div>
                  <ul className="lasso-merger__parties">
                    {m.to.map((p, j) => (
                      <Party key={`t${j}`} p={p} focusId={focusId} onOpen={onOpen} />
                    ))}
                  </ul>
                </div>
              </div>
            </li>
          );
        })}
        {company?.founded ? (
          <li className="lasso-merger lasso-merger--founded">
            <div className="lasso-merger__head">
              <span className="lasso-merger__type">Stiftet</span>
              <span className="lasso-merger__date">{formatDate(company.founded)}</span>
            </div>
          </li>
        ) : null}
      </ol>
    </Section>
  );
}

const ANNOUNCEMENTS_SHOWN = 3;

/** Statstidendes tekst foldet til tre linjer; "Vis mere" kun, når der er mere at vise. */
function AnnouncementText({ text }: { text: string }) {
  const print = usePrintMode();
  const [open, setOpen] = useState(print);
  const long = text.length > 260 && !print;
  return (
    <>
      <p className={`lasso-announce__excerpt${long && !open ? " is-folded" : ""}`}>{text}</p>
      {long ? (
        <button type="button" className="lasso-link lasso-more" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? "Vis mindre" : "Vis mere"}
        </button>
      ) : null}
    </>
  );
}

function Announcement({ a, onLink }: { a: AnnouncementVM; onLink?: (url: string) => void }) {
  const meta = ["Statstidende", a.date ? formatDate(a.date) : null].filter(Boolean).join(", ");
  return (
    <article className="lasso-announce__item">
      <div className="lasso-announce__head">
        <span className={`lasso-announce__badge lasso-announce__badge--${a.severity}`}>{a.type}</span>
        <span className="lasso-announce__meta">{meta}</span>
      </div>
      {a.text ? <AnnouncementText text={a.text} /> : null}
      {a.source || a.url ? (
        <div className="lasso-announce__foot">
          <span className="lasso-announce__source">{a.source ?? ""}</span>
          {a.url ? (
            onLink ? (
              <button type="button" className="lasso-link lasso-announce__open" onClick={() => onLink(a.url!)}>
                Åbn i Statstidende
              </button>
            ) : (
              <a className="lasso-announce__open" href={a.url} target="_blank" rel="noopener noreferrer">
                Åbn i Statstidende
              </a>
            )
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

/**
 * Statstidende (katalog 28.8, Jakob 01.10): designet som en nyhed, fordi der næsten altid kun er én
 * bekendtgørelse. Typen står som et farvet mærke efter alvor (problem mørk rød, midlertidig warning, øvrige
 * neutral), så "Statstidende, dato", teksten foldet til tre linjer og "Åbn i Statstidende". Er der flere,
 * står de under hinanden (3 + "Vis alle N"). Sektionen udelades, når der ingen bekendtgørelser er.
 */
export function Announcements({ events, company, demo, title, error, onLink }: { events?: CompanyEventsVM; company?: CompanyVM; demo?: boolean; title?: string; error?: string; onLink?: (url: string) => void }) {
  const heading = title ?? "Statstidende";
  const [all, setAll] = useState(usePrintMode());
  if (!events) return <Loading title={heading} error={error} />;
  const list = events.announcements;
  if (list.length === 0) return null;
  const shown = all ? list : list.slice(0, foldedCount(list.length, ANNOUNCEMENTS_SHOWN));
  const subtitle = [company?.name, demo ? "eksempeldata" : null].filter(Boolean).join(", ") || undefined;
  return (
    <Section title={heading} subtitle={subtitle} span="full" className="lasso-announce">
      <div className="lasso-announce__list">
        {shown.map((a, i) => (
          <Announcement key={`${a.date}-${i}`} a={a} onLink={onLink} />
        ))}
      </div>
      {foldedCount(list.length, ANNOUNCEMENTS_SHOWN) < list.length ? <ExpandLink expanded={all} total={list.length} onToggle={() => setAll(!all)} /> : null}
    </Section>
  );
}

/** "01.01–31.12.2025" (28.2); uden start kun slutdatoen. */
function periodRange(start?: string, end?: string): string | undefined {
  if (!end) return undefined;
  const e = formatDate(end);
  return start ? `${formatDate(start).slice(0, 5)}–${e}` : e;
}

function FlagIcon() {
  return (
    <span className="lasso-stmt__flag" title="Korrigeret regnskab" aria-hidden="true">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
        <path d="M12 7v6M12 16.5v.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    </span>
  );
}

/** Beløb med enhed ("18,8 mio. kr.", "−201 t. kr."), negativt i rødt, og "før …" i muted ved korrektion. */
function Money({ value, previous, corrected }: { value?: number | null; previous?: number | null; corrected?: boolean }) {
  return (
    <span className="lasso-publications__figure">
      <span className={typeof value === "number" && value < 0 ? "lasso-down" : undefined}>{typeof value === "number" ? formatAmount(value) : <span className="lasso-notreported">-</span>}</span>
      {corrected && typeof previous === "number" ? <span className="lasso-publications__before">før {formatAmount(previous)}</span> : null}
    </span>
  );
}

/** "Årsrapport 2025" (og "Korrigeret"): et download-link til PDF'en, når den findes (Jakob 01.10). */
function ReportName({ p, onLink, label }: { p: PublicationVM; onLink?: (url: string) => void; label?: string }) {
  const year = p.year ?? (p.periodEnd ? Number(p.periodEnd.slice(0, 4)) : undefined);
  const text = label ?? `${p.kind === "Årsrapport" ? "Årsrapport" : p.kind}${year ? ` ${year}` : ""}${p.corrected ? ", korrigeret" : ""}`;
  if (!p.url) return <>{text}</>;
  const icon = <Icon name="download" size={14} />;
  return onLink ? (
    <button type="button" className="lasso-link lasso-publications__dl" onClick={() => onLink(p.url!)}>
      {icon}
      {text}
    </button>
  ) : (
    <a className="lasso-link lasso-publications__dl" href={p.url} target="_blank" rel="noopener noreferrer">
      {icon}
      {text}
    </a>
  );
}

/**
 * Regnskabspublicering (katalog 28.2): kort med tabel (15) sorteret efter offentliggørelsesdato,
 * nyeste først: Offentliggjort | Periode ("01.01–31.12.2025") | Type ("Årsrapport, ny", "Korrigeret"
 * med udråbstegn efter ordet, "Halvår") | Bruttofortjeneste (eller omsætning) | Resultat (negativt i
 * rødt). Et korrigeret regnskab får den tidligere værdi som "før …" i muted under tallet, aldrig
 * gennemstreget. Mobil: rækkerne foldes til etiket og værdi (fælles `.lasso-table--fold`).
 */
export function Publications({ events, title, error, limit = 5, onLink }: { events?: CompanyEventsVM; title?: string; error?: string; limit?: number; /** Åbner årsrapportens PDF (Jakob 01.10: "Årsrapport ÅÅÅÅ" er et download-link). */ onLink?: (url: string) => void }) {
  const heading = title ?? "Regnskabspublicering";
  const [all, setAll] = useState(usePrintMode());
  if (!events) return <Loading title={heading} error={error} lines={5} />;
  const list = events.publications;
  if (list.length === 0) {
    return (
      <Section title={heading} span="full" card>
        <DataState state="empty" reason="Virksomheden har ikke offentliggjort regnskaber i Erhvervsstyrelsen." />
      </Section>
    );
  }
  const figureLabel = list.find((p) => p.figure)?.figure?.label ?? "Hovedtal";
  const shown = all ? list : list.slice(0, foldedCount(list.length, limit));
  return (
    <Section title={heading} span="full" card className="lasso-publications">
      <div className="lasso-table-wrap">
        <table className="lasso-table lasso-table--fold lasso-publications__table">
          <thead>
            <tr>
              <th>Regnskab</th>
              <th>Offentliggjort</th>
              <th className="lasso-num">{figureLabel}</th>
              <th className="lasso-num">Resultat</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((p, i) => (
              <tr key={`${p.published}-${i}`}>
                <td data-label="Regnskab" className="lasso-cell--name">
                  <span className="lasso-publications__type">
                    <ReportName p={p} onLink={onLink} />
                    {p.corrected ? <FlagIcon /> : null}
                  </span>
                  <span className="lasso-publications__period">{periodRange(p.periodStart, p.periodEnd) ?? ""}</span>
                </td>
                <td data-label="Offentliggjort">{p.published ? formatDate(p.published) : <span className="lasso-notreported">-</span>}</td>
                <td data-label={p.figure?.label ?? "Hovedtal"} className="lasso-num">
                  <Money value={p.figure?.value} previous={p.figure?.previous} corrected={p.corrected} />
                </td>
                <td data-label="Resultat" className="lasso-num">
                  <Money value={p.profit?.value} previous={p.profit?.previous} corrected={p.corrected} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* 28.2 mobil: én række pr. regnskab som i ændringsfeedet: "Regnskab", titel (evt. "Korrigeret" + flag),
          hovedtallet som før → efter og kilde + dato. */}
      <ul className="lasso-publications__feed">
        {shown.map((p, i) => {
          const year = p.periodEnd?.slice(0, 4);
          const kind = p.kind === "Årsrapport" || !p.kind ? "årsrapport" : p.kind.toLowerCase();
          const name = `${p.corrected ? "Korrigeret " : ""}${p.corrected ? kind : kind.charAt(0).toUpperCase() + kind.slice(1)}${year ? ` ${year}` : ""}`;
          const fig = p.figure;
          return (
            <li key={`${p.published}-${i}`} className="lasso-publications__item">
              <span className="lasso-publications__kicker">Regnskab</span>
              <span className="lasso-publications__name">
                {p.url ? <ReportName p={p} onLink={onLink} label={name} /> : name}
                {p.corrected ? <FlagIcon /> : null}
              </span>
              {fig && typeof fig.value === "number" ? (
                <span className="lasso-publications__change">
                  {`${fig.label} `}
                  {typeof fig.previous === "number" && fig.previous !== fig.value ? `${formatAmount(fig.previous)} → ` : ""}
                  <span className={fig.value < 0 ? "lasso-down" : undefined}>{formatAmount(fig.value)}</span>
                </span>
              ) : null}
              <span className="lasso-publications__meta">{["Erhvervsstyrelsen", p.published ? formatDate(p.published) : undefined].filter(Boolean).join(", ")}</span>
            </li>
          );
        })}
      </ul>
      {foldedCount(list.length, limit) < list.length ? (
        <ExpandLink expanded={all} total={list.length} onToggle={() => setAll(!all)} />
      ) : null}
    </Section>
  );
}
