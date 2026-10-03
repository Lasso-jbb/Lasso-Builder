import { useMemo, useState, type ReactNode } from "react";
import { ExpandLink, foldedCount, PromptLink } from "./ExpandLink.js";
import { formatDate, isPersonId, type TextSegment, type TimelineVM } from "@lasso/spec";
import type { MoreInTab, ViewAction } from "../types.js";
import { DataState, Section, stateForError } from "../primitives.js";
import { usePrintMode } from "../print.js";
import { Icon } from "./Icon.js";

const ALL = "Alle typer";

/** 12.3: regnskabsbegivenheder (kategori "Regnskab") viser indberetningsdatoen i anden linje. */
const isReport = (category: string) => /^regnskab/i.test(category);

/**
 * Titel med entiteter (personens historik): et selskab (CVR-1-) eller en person (CVR-3-/CVR-4-)
 * med Lasso-ID kan åbnes, når værten har drill-down; ellers står navnet som almindelig tekst.
 */
function TitleSegments({
  segments,
  onOpen,
}: {
  segments: readonly TextSegment[];
  onOpen?: (a: ViewAction) => void;
}) {
  return (
    <>
      {segments.map((s, i) => {
        const id = s.lassoId;
        if (onOpen && id && /^CVR-1-/i.test(id)) {
          return (
            <button
              key={i}
              type="button"
              className="lasso-link lasso-timeline__entity"
              onClick={() =>
                onOpen({ kind: "open-company", lassoId: id, name: s.text })
              }
            >
              {s.text}
            </button>
          );
        }
        if (onOpen && isPersonId(id)) {
          return (
            <button
              key={i}
              type="button"
              className="lasso-link lasso-timeline__entity"
              onClick={() =>
                onOpen({ kind: "open-person", lassoId: id, name: s.text })
              }
            >
              {s.text}
            </button>
          );
        }
        return <span key={i}>{s.text}</span>;
      })}
    </>
  );
}

/**
 * Tidslinje (katalog 12, "Tidslinje"). Årsoverskrift som overlinje, nyeste
 * begivenhed har koral prik, ændringer vises som "fra → til", kategori og
 * dato i sidste linje. Bruges også til personens historik (katalog 16), hvor
 * selskabsnavnene i titlerne kan åbnes (`onOpen`).
 */
export function LassoTimeline({
  timeline,
  title,
  error,
  onOpen,
  emptyReason,
  limit = 5,
  moreIn,
  filterColumn = false,
  onLink,
}: {
  timeline?: TimelineVM;
  title?: string;
  error?: string;
  onOpen?: (a: ViewAction) => void;
  /** Tom tilstand; standard er virksomhedens tekst. */
  emptyReason?: string;
  /** Begivenheder før "Se alle N begivenheder" (regel 9); overblikket viser 3. */
  limit?: number;
  /** Smagsprøve på overblikket: "Se alle N begivenheder i Historik" åbner fanen i stedet for at folde ud. */
  moreIn?: MoreInTab;
  /**
   * Mønster 6, Tidslinje (30.9): filtrene i en kolonne ¼ til venstre for strømmen ¾. Under 960 px
   * container (tablet, chat og mobil) bliver kolonnen til chips over strømmen. Standard: typevælger i hovedet.
   */
  filterColumn?: boolean;
  /** Åbner et dokument (årsrapportens PDF, 12.3): titlen på en begivenhed med `url` bliver et link med hent-ikon. */
  onLink?: (url: string) => void;
}) {
  const heading = title ?? "Historik";
  const categories = useMemo(
    () => [...new Set((timeline?.events ?? []).map((e) => e.category))],
    [timeline],
  );
  const [filter, setFilter] = useState(ALL);
  const [expanded, setExpanded] = useState(usePrintMode());
  if (!timeline) {
    return (
      <Section title={heading} span="half">
        {error ? (
          <DataState
            state={stateForError(error) === "noaccess" ? "empty" : "error"}
            reason={error}
          />
        ) : (
          <DataState state="loading" lines={6} height={320} />
        )}
      </Section>
    );
  }
  const matching =
    filter === ALL
      ? timeline.events
      : timeline.events.filter((e) => e.category === filter);
  // Regel 9: de seneste `limit` (5, på overblikket 3); resten bag "Se alle N".
  // Global regel (Jakob 01.10): der foldes kun, når mindst to er skjult.
  const events = expanded ? matching : matching.slice(0, foldedCount(matching.length, limit));
  const filterList =
    filterColumn && categories.length > 1 ? (
      <div
        className="lasso-tl-filters"
        role="group"
        aria-label="Filtrér på type"
      >
        <div className="lasso-tl-filters__label">Type</div>
        <div className="lasso-tl-filters__list">
          {[ALL, ...categories].map((c) => (
            <button
              key={c}
              type="button"
              className={`lasso-feed__chip lasso-tl-filters__item ${filter === c ? "is-on" : ""}`}
              aria-pressed={filter === c}
              onClick={() => setFilter(c)}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
    ) : null;
  const picker =
    !filterColumn && categories.length > 1 ? (
      <select
        className="lasso-select lasso-select--sm lasso-timeline__picker"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        aria-label="Vis type"
      >
        <option value={ALL}>{ALL}</option>
        {categories.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
    ) : null;
  const span = filterColumn ? "full" : "half";
  const withFilters = (stream: ReactNode) =>
    filterList ? (
      <div className="lasso-tl-layout">
        {filterList}
        <div className="lasso-tl-layout__stream">{stream}</div>
      </div>
    ) : (
      stream
    );
  if (matching.length === 0) {
    return (
      <Section title={heading} action={picker} span={span}>
        {withFilters(
          <DataState
            state="empty"
            reason={
              emptyReason ??
              "Der er ingen registrerede begivenheder i CVR endnu."
            }
          />,
        )}
      </Section>
    );
  }
  let lastYear: number | null = null;
  return (
    <Section title={heading} action={picker} span={span}>
      {withFilters(
        <>
          <div className="lasso-timeline">
            {events.map((e, i) => {
              const year = Number(e.date.slice(0, 4));
              const showYear = year !== lastYear;
              lastYear = year;
              return (
                <div key={i}>
                  {showYear ? (
                    <div className="lasso-timeline__year">{year}</div>
                  ) : null}
                  <div className="lasso-timeline__row">
                    <div className="lasso-timeline__rail">
                      <span
                        className={`lasso-timeline__dot ${i === 0 ? "lasso-timeline__dot--latest" : ""}`}
                        aria-hidden="true"
                      />
                      {i < events.length - 1 ? (
                        <span
                          className="lasso-timeline__line"
                          aria-hidden="true"
                        />
                      ) : null}
                    </div>
                    <div className="lasso-timeline__body">
                      <div className="lasso-timeline__title">
                        {e.url && onLink ? (
                          // 12.3 (Jakob 01.10): årsrapporten kan hentes direkte fra tidslinjen.
                          <button type="button" className="lasso-link lasso-timeline__doc" onClick={() => onLink(e.url!)}>
                            <Icon name="download" size={14} />
                            <span>{e.title}</span>
                          </button>
                        ) : e.titleSegments ? (
                          <TitleSegments
                            segments={e.titleSegments}
                            onOpen={onOpen}
                          />
                        ) : (
                          e.title
                        )}
                      </div>
                      {isReport(e.category) ? (
                        // 12.3: regnskab har "Indberettet <dato>" som anden linje (ikke nøgletal); datoen gentages ikke i tredje linje.
                        <div className="lasso-row__sub">Indberettet {formatDate(e.date)}</div>
                      ) : e.from || e.to ? (
                        <div className="lasso-timeline__change">
                          {e.from ? (
                            // 12.3: kun en gammel adresse gennemstreges; fx kapital skrives "1,0 mio. kr. → 1,2 mio. kr.".
                            <span className={`lasso-timeline__from${/adresse/i.test(`${e.category} ${e.title}`) ? " lasso-timeline__from--struck" : ""}`}>
                              {e.from}
                            </span>
                          ) : null}
                          <span aria-hidden="true">→</span>
                          {e.to ? (
                            <span className="lasso-timeline__to">{e.to}</span>
                          ) : null}
                        </div>
                      ) : e.detail ? (
                        <div className="lasso-row__sub">{e.detail}</div>
                      ) : null}
                      {/* 12.3 (Jakob 01.10): typeordet (Regnskab, Ledelse …) vises ikke; kun datoen, og ikke igen for regnskab. */}
                      {isReport(e.category) ? null : <div className="lasso-timeline__meta">{formatDate(e.date)}</div>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {foldedCount(matching.length, limit) < matching.length ? (
            moreIn ? (
              <PromptLink label={`Se alle ${matching.length} begivenheder i ${moreIn.tab}`} onClick={moreIn.open} />
            ) : (
              <ExpandLink expanded={expanded} total={matching.length} onToggle={() => setExpanded(!expanded)} />
            )
          ) : null}
        </>,
      )}
    </Section>
  );
}
