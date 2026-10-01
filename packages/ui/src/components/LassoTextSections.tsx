import { useState } from "react";
import { isAnalysisSection, isPersonId, textSectionsFor, type TextSectionItem, type TextSectionsVariant, type TextSectionsVM, type TextSegment } from "@lasso/spec";
import type { ViewAction } from "../types.js";
import { DataState, Section, stateForError } from "../primitives.js";
import { usePrintMode } from "../print.js";

const TRUNCATE_AT = 220;

/** De første `max` tegn af segmenterne (samme grænse som for ren tekst), sidste stykke uden efterstillet luft. */
function cut(segments: readonly TextSegment[], max: number): TextSegment[] {
  const out: TextSegment[] = [];
  let left = max;
  for (const s of segments) {
    if (left <= 0) break;
    out.push(s.text.length <= left ? s : { ...s, text: s.text.slice(0, left) });
    left -= s.text.length;
  }
  const last = out.at(-1);
  if (last) out[out.length - 1] = { ...last, text: last.text.trimEnd() };
  return out;
}

/** Hvad et navn med Lasso-ID åbner: virksomheden (CVR-1-) eller personen (CVR-3-); ellers intet. */
export function segmentAction(s: TextSegment): ViewAction | null {
  const id = s.lassoId ?? "";
  if (isPersonId(s.lassoId)) return { kind: "open-person", lassoId: id, name: s.text };
  if (/^CVR-1-/.test(id)) return { kind: "open-company", lassoId: id, name: s.text };
  return null;
}

/**
 * Tekstløb: et navn med Lasso-ID bliver et link, når værten kan åbne det (`onOpen`); ellers ren
 * tekst. `highlight` (virksomhedens eget navn) står i fed.
 */
function Runs({ segments, onOpen }: { segments: readonly TextSegment[]; onOpen?: (a: ViewAction) => void }) {
  return (
    <>
      {segments.map((s, i) => {
        const action = onOpen ? segmentAction(s) : null;
        if (onOpen && action) {
          return (
            <button key={i} type="button" className="lasso-link lasso-textsection__entity" onClick={() => onOpen(action)}>
              {s.text}
            </button>
          );
        }
        return s.highlight ? <strong key={i}>{s.text}</strong> : <span key={i}>{s.text}</span>;
      })}
    </>
  );
}

/**
 * Brødteksten (segmenter, når kilden har navne med Lasso-ID), skåret ved `limit` tegn. Med
 * `toggle` får et langt afsnit sin egen "Vis mere"; ellers folder elementet det ud samlet.
 */
function TextBody({ item, limit, toggle, onOpen }: { item: TextSectionItem; limit: number; toggle: boolean; onOpen?: (a: ViewAction) => void }) {
  const [expanded, setExpanded] = useState(usePrintMode());
  const segments: readonly TextSegment[] = item.segments?.length ? item.segments : [{ text: item.body }];
  const long = segments.reduce((n, s) => n + s.text.length, 0) > limit;
  const folded = long && !(toggle && expanded);
  return (
    <>
      <p className="lasso-textsection__body">
        <Runs segments={folded ? cut(segments, limit) : segments} onOpen={onOpen} />
        {folded ? " …" : null}
      </p>
      {long && toggle ? (
        <button type="button" className="lasso-link lasso-more" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
          {expanded ? "Vis mindre" : "Vis mere"}
        </button>
      ) : null}
    </>
  );
}

/** Ét afsnit. Analysens kildenote står én gang for hele elementet (regel 8), ikke under hvert afsnit. */
function Item({
  item,
  heading = item.heading,
  limit = TRUNCATE_AT,
  toggle = true,
  onOpen,
}: {
  item: TextSectionItem;
  heading?: string;
  limit?: number;
  toggle?: boolean;
  onOpen?: (a: ViewAction) => void;
}) {
  return (
    <div className="lasso-textsection">
      {heading ? <div className="lasso-textsection__heading">{heading}</div> : null}
      <TextBody item={item} limit={limit} toggle={toggle} onOpen={onOpen} />
      {item.note && !isAnalysisSection(item) ? <div className="lasso-textsection__note">{item.note}</div> : null}
    </div>
  );
}

/** 12.1 (Jakob 01.10): tegn, profilen viser fra start, før "Vis mere". */
export const PROFILE_START = 440;

const lengthOf = (it: TextSectionItem) => (it.segments?.length ? it.segments.reduce((n, s) => n + s.text.length, 0) : it.body.length);

/**
 * Hvor meget af en tekst på `total` tegn der vises, når der er plads til `budget` (12.1, Jakob 01.10): "Vis mere"
 * findes kun, når der reelt er mindst 50 % mere at vise; ellers står hele teksten. Hvert klik viser 50 % mere.
 */
export function revealOf(total: number, budget: number): number {
  return total - budget >= budget * 0.5 ? budget : total;
}

/** Klip ved et ordskifte (ikke midt i et ord), når det ikke koster mere end 40 tegn. */
function wordCut(segments: readonly TextSegment[], max: number): TextSegment[] {
  const out = cut(segments, max);
  const last = out.at(-1);
  if (!last) return out;
  const space = last.text.lastIndexOf(" ");
  if (space > 0 && last.text.length - space < 40) out[out.length - 1] = { ...last, text: last.text.slice(0, space).replace(/[,;:.\s]+$/, "") };
  return out;
}

/**
 * Variant "profil" og "resume" (12.1, Jakob 01.10): afsnittene læses som én tekst. De første PROFILE_START tegn står
 * fremme; teksten klippes kun ét sted (der hvor den slutter), og "Vis mere" fortsætter derfra med 50 % mere,
 * til alt står. Er der under 50 % tilbage, står hele teksten uden "Vis mere". `limit` (kompakt profil, 23.3)
 * viser højst de første `limit` afsnit fra start.
 */
function Profile({ items, onOpen, limit }: { items: TextSectionItem[]; onOpen?: (a: ViewAction) => void; limit?: number }) {
  const print = usePrintMode();
  const total = items.reduce((n, it) => n + lengthOf(it), 0);
  const firstLimit = limit !== undefined && items.length > limit ? items.slice(0, limit).reduce((n, it) => n + lengthOf(it), 0) : Number.POSITIVE_INFINITY;
  const start = revealOf(total, Math.min(PROFILE_START, firstLimit));
  const [budget, setBudget] = useState(start);
  const shown = print ? total : budget;
  let left = shown;
  const parts: { item: TextSectionItem; segments: TextSegment[]; cut: boolean }[] = [];
  for (const it of items) {
    if (left <= 0) break;
    const segments: readonly TextSegment[] = it.segments?.length ? it.segments : [{ text: it.body }];
    const n = lengthOf(it);
    parts.push(n <= left ? { item: it, segments: [...segments], cut: false } : { item: it, segments: wordCut(segments, left), cut: true });
    left -= n;
  }
  return (
    <>
      {parts.map(({ item, segments, cut: clipped }, i) => (
        <div key={i} className="lasso-textsection">
          {item.heading ? <div className="lasso-textsection__heading">{item.heading}</div> : null}
          <p className="lasso-textsection__body">
            <Runs segments={segments} onOpen={onOpen} />
            {clipped ? " …" : null}
          </p>
          {item.note && !isAnalysisSection(item) && !clipped ? <div className="lasso-textsection__note">{item.note}</div> : null}
        </div>
      ))}
      {shown < total ? (
        <button type="button" className="lasso-link lasso-more" aria-expanded={false} onClick={() => setBudget(revealOf(total, Math.round(budget * 1.5)))}>
          Vis mere
        </button>
      ) : start < total && !print ? (
        <button type="button" className="lasso-link lasso-more" aria-expanded onClick={() => setBudget(start)}>
          Vis mindre
        </button>
      ) : null}
    </>
  );
}

/** 19.3: fast afsluttende linje under regnskabsanalysen. */
export const ANALYSIS_DISCLAIMER = "Forbehold: analysen er skrevet automatisk ud fra de offentliggjorte regnskaber og tallene i tabellerne. Den kan indeholde fejl og er ikke rådgivning.";

/** Under elementets titel "Regnskabsanalyse" er "Regnskabsanalyse: konklusion" bare "Konklusion". */
function analysisHeading(heading: string): string {
  const rest = heading.replace(/^Regnskabsanalyse:?\s*/i, "");
  return rest ? rest.charAt(0).toUpperCase() + rest.slice(1) : "";
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ transform: open ? undefined : "rotate(-90deg)" }}>
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Regnskabsanalysen (variant "analyse", 19.3 / mobil 26h.3). Desktop: overskrift 17/600, konklusionen
 * som brødtekst 15/25, den faste linje "Forbehold: …" og "Var det brugbart? Ja / Nej" (ingen kildevisning,
 * Jakob runde 6). Mobil: kortet kan foldes med chevron, teksten er
 * foldet til 4 linjer, og nederst står "Læs hele analysen" til venstre og genereringslinjen til højre.
 */
function Analysis({ v, items, onOpen, folded = false }: { v: TextSectionsVM; items: TextSectionItem[]; onOpen?: (a: ViewAction) => void; folded?: boolean }) {
  const [open, setOpen] = useState(usePrintMode());
  const [vote, setVote] = useState<"ja" | "nej" | null>(null);
  const [first, ...rest] = items;
  const segments: readonly TextSegment[] = first!.segments?.length ? first!.segments : [{ text: first!.body }];
  return (
    <>
      {v.analysisHeadline ? <p className="lasso-analysis__headline">{v.analysisHeadline}</p> : null}
      <p className={`lasso-analysis__body${open ? " is-open" : ""}`}>
        <Runs segments={segments} onOpen={onOpen} />
      </p>
      {open && rest.length > 0 ? (
        <div className="lasso-textsections__rest">
          {rest.map((s, i) => (
            <Item key={i} item={s} heading={analysisHeading(s.heading)} limit={Number.POSITIVE_INFINITY} toggle={false} onOpen={onOpen} />
          ))}
        </div>
      ) : null}
      <p className="lasso-analysis__disclaimer">{ANALYSIS_DISCLAIMER}</p>
      <div className="lasso-analysis__actions">
        <span className="lasso-analysis__feedback">
          {vote ? (
            "Tak for svaret"
          ) : (
            <>
              Var det brugbart?{" "}
              <button type="button" className="lasso-analysis__vote" onClick={() => setVote("ja")}>
                Ja
              </button>
              {" / "}
              <button type="button" className="lasso-analysis__vote" onClick={() => setVote("nej")}>
                Nej
              </button>
            </>
          )}
        </span>
      </div>
      <div className="lasso-analysis__foot">
        <button type="button" className="lasso-link lasso-analysis__more" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? "Vis mindre" : folded ? "Vis mere" : "Læs hele analysen"}
        </button>
      </div>
    </>
  );
}

/** Analysens sektion: chevron, der folder kortet (mobil). */
function AnalysisSection({ heading, v, items, onOpen, folded = false }: { heading: string; v: TextSectionsVM; items: TextSectionItem[]; onOpen?: (a: ViewAction) => void; folded?: boolean }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <Section
      title={heading}
      span="full"
      className={`lasso-textsections lasso-textsections--analysis${folded ? " lasso-textsections--folded" : ""}${collapsed ? " is-collapsed" : ""}`}
      action={
        <button type="button" className="lasso-iconbtn lasso-analysis__toggle" aria-expanded={!collapsed} aria-label={collapsed ? "Vis analysen" : "Fold analysen sammen"} onClick={() => setCollapsed(!collapsed)}>
          <Chevron open={!collapsed} />
        </button>
      }
    >
      {collapsed ? null : <Analysis v={v} items={items} onOpen={onOpen} folded={folded} />}
    </Section>
  );
}

/** Analysens afsnit som overskrift: første afsnit bærer analysens overskrift (analysisHeadline), når den findes. */
function rowHeading(v: TextSectionsVM, item: TextSectionItem, i: number): string {
  if (i === 0 && v.analysisHeadline) return v.analysisHeadline;
  return analysisHeading(item.heading) || "Konklusion";
}

/** Download-ikonet fra 01.6 (streg 1,8, runde ender), som i Paper LYT-0. */
function DownloadGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 4v11M7 10l5 5 5-5M5 19h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Regnskabsanalysen (katalog 19.3, Paper LYO-0): almindelig sektion på hvid flade med overskriften 18/600 og
 * "Hent som PDF" (sekundær 32 px-knap med download-ikon og ord, LYT-0) i hovedet, når værten kan eksportere
 * (G1). Afsnittene er foldbare rækker (44 px, overskrift 14/600, chevron), første afsnit åbent (brødtekst
 * 14/22); forbeholdet er en fast afsluttende linje, og "Var det brugbart? Ja / Nej" står alene under (ingen
 * kildevisning). Ingen genereringsdato eller kildevisning (G3). "Hent som PDF" laver en A4 af HELE analysen med alle
 * afsnit foldet ud (19.6, AnalysisReportA4) med samme mekanisme som rapporten (27).
 */
function AnalysisRows({ heading, v, items, onOpen, onPdf }: { heading: string; v: TextSectionsVM; items: TextSectionItem[]; onOpen?: (a: ViewAction) => void; onPdf?: () => void }) {
  const [open, setOpen] = useState<ReadonlySet<number>>(() => new Set([0]));
  const [vote, setVote] = useState<"ja" | "nej" | null>(null);
  const toggle = (i: number) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  return (
    <Section
      title={heading}
      span="full"
      className="lasso-textsections lasso-textsections--analysis lasso-analysis19"
      action={
        onPdf ? (
          <button type="button" className="lasso-btn lasso-btn--sm lasso-analysis19__pdf" onClick={onPdf}>
            <DownloadGlyph />
            Hent som PDF
          </button>
        ) : undefined
      }
    >
      <div className="lasso-analysis19__rows">
        {items.map((it, i) => {
          const isOpen = open.has(i);
          const segments: readonly TextSegment[] = it.segments?.length ? it.segments : [{ text: it.body }];
          const id = `lasso-analysis-${i}`;
          return (
            <div key={`${it.heading}-${i}`} className={`lasso-analysis19__row${isOpen ? " is-open" : ""}`}>
              <button type="button" className="lasso-analysis19__head" aria-expanded={isOpen} aria-controls={id} onClick={() => toggle(i)}>
                <span className="lasso-analysis19__title">{rowHeading(v, it, i)}</span>
                <svg className="lasso-analysis19__chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d={isOpen ? "M6 14.5l6-6 6 6" : "M6 9.5l6 6 6-6"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {isOpen ? (
                <p id={id} className="lasso-analysis19__body">
                  <Runs segments={segments} onOpen={onOpen} />
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
      <p className="lasso-analysis19__disclaimer">{ANALYSIS_DISCLAIMER}</p>
      <div className="lasso-analysis19__actions">
        <span className="lasso-analysis19__feedback">
          {vote ? (
            "Tak for svaret"
          ) : (
            <>
              Var det brugbart?{" "}
              <button type="button" className="lasso-analysis__vote" onClick={() => setVote("ja")}>
                Ja
              </button>
              {" / "}
              <button type="button" className="lasso-analysis__vote" onClick={() => setVote("nej")}>
                Nej
              </button>
            </>
          )}
        </span>
      </div>
    </Section>
  );
}

/**
 * Tekstsektioner (katalog 12, "Tekstsektioner"). Variant "profil" (overblik): formål og
 * tegningsregler fra CVR plus regnskabsanalysens konklusion, resultat og likviditet, hvert
 * afsnit foldet med "Vis mere". Branche står i hovedet og gentages ikke. Variant "analyse"
 * (oekonomi): hele regnskabsanalysen, foldet efter konklusionen. Ingen kildevisning (G3). Navne med Lasso-ID kan åbnes, når værten har drill-down (`onOpen`).
 */
export function LassoTextSections({
  sections,
  title,
  variant = "profil",
  error,
  onOpen,
  folded = false,
  limit,
  onPdf,
}: {
  /** Variant "profil": kun de første N afsnit, resten bag "Vis mere" (kompakt profil, 23.3). */
  limit?: number;
  /** 19.3: "Hent som PDF" i analysens hoved (19.6). Uden den vises knappen ikke (G1). */
  onPdf?: () => void;
  sections?: TextSectionsVM;
  title?: string;
  variant?: TextSectionsVariant;
  /** Variant "analyse": foldet til 3 linjer med "Vis mere" på alle bredder (30.13). */
  folded?: boolean;
  error?: string;
  onOpen?: (a: ViewAction) => void;
}) {
  const analysis = variant === "analyse";
  const heading = title ?? (analysis ? "Regnskabsanalyse" : (sections?.title ?? "Virksomhedsprofil"));
  const span = analysis ? "full" : "quarter";
  if (!sections) {
    return (
      <Section title={heading} span={span}>
        {error ? <DataState state={stateForError(error) === "noaccess" ? "empty" : "error"} reason={error} /> : <DataState state="loading" lines={5} height={260} />}
      </Section>
    );
  }
  const shown = textSectionsFor(sections.sections, variant);
  if (shown.length === 0) {
    return (
      <Section title={heading} span={span}>
        <DataState state="empty" reason={analysis ? "Lasso har ingen regnskabsanalyse for virksomheden." : "CVR har ikke oplyst formål eller tegningsregler for virksomheden."} />
      </Section>
    );
  }
  if (analysis) {
    // 30.13 (niveau B): foldet til 3 linjer med "Vis mere"; ellers 19.3 med foldbare afsnit og "Hent som PDF".
    if (folded) return <AnalysisSection heading={heading} v={sections} items={shown} onOpen={onOpen} folded />;
    return <AnalysisRows heading={heading} v={sections} items={shown} onOpen={onOpen} onPdf={onPdf} />;
  }
  return (
    <Section title={heading} span={span} className="lasso-textsections">
      {/* 12.1: ingen kildevisning (G3). */}
      <Profile items={shown} onOpen={onOpen} limit={limit} />
    </Section>
  );
}
