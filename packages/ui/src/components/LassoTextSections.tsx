import { useState } from "react";
import { analysisSource, formatDate, isAnalysisSection, isPersonId, textSectionsFor, type TextSectionItem, type TextSectionsVariant, type TextSectionsVM, type TextSegment } from "@lasso/spec";
import type { ViewAction } from "../types.js";
import { DataState, Section, SourceLine, stateForError } from "../primitives.js";

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
 * `toggle` får et langt afsnit sin egen "Vis hele"; ellers folder elementet det ud samlet.
 */
function TextBody({ item, limit, toggle, onOpen }: { item: TextSectionItem; limit: number; toggle: boolean; onOpen?: (a: ViewAction) => void }) {
  const [expanded, setExpanded] = useState(false);
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
          {expanded ? "Vis mindre" : "Vis hele"}
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

/** 19.3: fast afsluttende linje under regnskabsanalysen. */
export const ANALYSIS_DISCLAIMER = "Forbehold: analysen er skrevet automatisk ud fra de offentliggjorte regnskaber og tallene i tabellerne. Den kan indeholde fejl og er ikke rådgivning.";

/** Under elementets titel "Regnskabsanalyse" er "Regnskabsanalyse: konklusion" bare "Konklusion". */
function analysisHeading(heading: string): string {
  const rest = heading.replace(/^Regnskabsanalyse:?\s*/i, "");
  return rest ? rest.charAt(0).toUpperCase() + rest.slice(1) : "";
}

/** "Genereret af Lasso ud fra regnskab 2021–2025, 12.09.2026" (19.3). */
function generatedLine(v: TextSectionsVM, short = false): string {
  return `Genereret af Lasso${v.analysisBasis && !short ? ` ud fra regnskab ${v.analysisBasis}` : ""}${v.analysisGenerated ? `, ${formatDate(v.analysisGenerated)}` : ""}`;
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
 * som brødtekst 15/25, den faste linje "Forbehold: …" og handlingslinjen "Vis kilder (N)" + "Var det
 * brugbart? Ja / Nej". Kildelinjen står under titlen. Mobil: kortet kan foldes med chevron, teksten er
 * foldet til 4 linjer, og nederst står "Læs hele analysen" til venstre og genereringslinjen til højre.
 */
function Analysis({ v, items, onOpen }: { v: TextSectionsVM; items: TextSectionItem[]; onOpen?: (a: ViewAction) => void }) {
  const [open, setOpen] = useState(false);
  const [sources, setSources] = useState(false);
  const [vote, setVote] = useState<"ja" | "nej" | null>(null);
  const [first, ...rest] = items;
  const segments: readonly TextSegment[] = first!.segments?.length ? first!.segments : [{ text: first!.body }];
  const list = v.analysisSources ?? [];
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
        {list.length ? (
          <button type="button" className="lasso-link lasso-analysis__sources-btn" aria-expanded={sources} onClick={() => setSources(!sources)}>
            {sources ? "Skjul kilder" : `Vis kilder (${list.length})`}
          </button>
        ) : null}
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
      {sources && list.length ? (
        <ul className="lasso-analysis__sources">
          {list.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      ) : null}
      <div className="lasso-analysis__foot">
        <button type="button" className="lasso-link lasso-analysis__more" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? "Vis mindre" : "Læs hele analysen"}
        </button>
        <span className="lasso-analysis__gen">{generatedLine(v, true)}</span>
      </div>
    </>
  );
}

/** Analysens sektion: kildelinjen under titlen (desktop) og chevron, der folder kortet (mobil). */
function AnalysisSection({ heading, v, items, onOpen }: { heading: string; v: TextSectionsVM; items: TextSectionItem[]; onOpen?: (a: ViewAction) => void }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <Section
      title={heading}
      subtitle={<span className="lasso-analysis__sub">{generatedLine(v)}</span>}
      span="full"
      className={`lasso-textsections lasso-textsections--analysis${collapsed ? " is-collapsed" : ""}`}
      action={
        <button type="button" className="lasso-iconbtn lasso-analysis__toggle" aria-expanded={!collapsed} aria-label={collapsed ? "Vis analysen" : "Fold analysen sammen"} onClick={() => setCollapsed(!collapsed)}>
          <Chevron open={!collapsed} />
        </button>
      }
    >
      {collapsed ? null : <Analysis v={v} items={items} onOpen={onOpen} />}
    </Section>
  );
}

/**
 * Tekstsektioner (katalog 12, "Tekstsektioner"). Variant "profil" (overblik): formål og
 * tegningsregler fra CVR plus regnskabsanalysens konklusion, resultat og likviditet, hvert
 * afsnit foldet med "Vis hele". Branche står i hovedet og gentages ikke. Variant "analyse"
 * (oekonomi): hele regnskabsanalysen, foldet efter konklusionen. Analysens kildelinje står én
 * gang pr. element. Navne med Lasso-ID kan åbnes, når værten har drill-down (`onOpen`).
 */
export function LassoTextSections({
  sections,
  title,
  variant = "profil",
  error,
  onOpen,
}: {
  sections?: TextSectionsVM;
  title?: string;
  variant?: TextSectionsVariant;
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
  const hasAnalysis = shown.some(isAnalysisSection);
  if (analysis) {
    return (
      <AnalysisSection heading={heading} v={sections} items={shown} onOpen={onOpen} />
    );
  }
  return (
    <Section title={heading} span={span} className="lasso-textsections">
      {shown.map((s, i) => <Item key={i} item={s} onOpen={onOpen} />)}
      {hasAnalysis ? <SourceLine source={analysisSource(shown)} updated={sections.analysisGenerated} verb="genereret" /> : null}
    </Section>
  );
}
