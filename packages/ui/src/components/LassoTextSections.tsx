import { useState } from "react";
import { analysisSource, isAnalysisSection, isPersonId, textSectionsFor, type TextSectionItem, type TextSectionsVariant, type TextSectionsVM, type TextSegment } from "@lasso/spec";
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

/** 19.3: fast forbehold under regnskabsanalysen. */
export const ANALYSIS_DISCLAIMER = "Analysen er skrevet automatisk ud fra de offentliggjorte regnskaber og tallene i tabellerne. Den kan indeholde fejl og er ikke rådgivning.";

/** Konklusionen i fuld bredde: ca. 6 linjer, før resten står bag linket. */
const ANALYSIS_LEAD_AT = 600;

/**
 * Under elementets titel "Regnskabsanalyse" er "Regnskabsanalyse: konklusion" bare "Konklusion";
 * hele analysen som ét afsnit ("Regnskabsanalyse") får ingen overskrift ud over titlen.
 */
function analysisHeading(heading: string): string {
  const rest = heading.replace(/^Regnskabsanalyse:?\s*/i, "");
  return rest ? rest.charAt(0).toUpperCase() + rest.slice(1) : "";
}

/**
 * Hele regnskabsanalysen (variant "analyse"): konklusionen først og ét link, der folder resten
 * ud på stedet ("Vis mindre" folder igen). Foldet ud står alle afsnit i fuld længde.
 */
function Analysis({ items, onOpen }: { items: TextSectionItem[]; onOpen?: (a: ViewAction) => void }) {
  const [open, setOpen] = useState(false);
  const [first, ...rest] = items;
  const leadLong = (first!.segments?.length ? first!.segments.reduce((n, s) => n + s.text.length, 0) : first!.body.length) > ANALYSIS_LEAD_AT;
  return (
    <>
      <Item item={first!} heading={analysisHeading(first!.heading)} limit={open ? Number.POSITIVE_INFINITY : ANALYSIS_LEAD_AT} toggle={false} onOpen={onOpen} />
      {open && rest.length > 0 ? (
        <div className="lasso-textsections__rest">
          {rest.map((s, i) => (
            <Item key={i} item={s} heading={analysisHeading(s.heading)} limit={Number.POSITIVE_INFINITY} toggle={false} onOpen={onOpen} />
          ))}
        </div>
      ) : null}
      {rest.length > 0 || leadLong ? (
        <button type="button" className="lasso-link lasso-more" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? "Vis mindre" : rest.length > 0 ? `Se hele regnskabsanalysen (${items.length} afsnit)` : "Vis hele"}
        </button>
      ) : null}
    </>
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
  return (
    <Section title={heading} span={span} className={`lasso-textsections${analysis ? " lasso-textsections--analysis" : ""}`}>
      {analysis ? <Analysis items={shown} onOpen={onOpen} /> : shown.map((s, i) => <Item key={i} item={s} onOpen={onOpen} />)}
      {/* 19.3: forbeholdet er en fast afsluttende linje (også når analysen er foldet), og kildelinjen har genereringsdatoen. */}
      {analysis && hasAnalysis ? <p className="lasso-textsections__disclaimer">{ANALYSIS_DISCLAIMER}</p> : null}
      {hasAnalysis ? <SourceLine source={analysisSource(shown)} updated={sections.analysisGenerated} verb="genereret" /> : null}
    </Section>
  );
}
