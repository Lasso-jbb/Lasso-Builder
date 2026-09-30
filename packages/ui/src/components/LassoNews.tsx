import { useState, type ReactNode } from "react";
import { formatDate, isPersonId, type NewsItemVM, type NewsVM, type TextSegment } from "@lasso/spec";
import type { MoreInTab, ViewAction } from "../types.js";
import { DataState, Section, stateForError } from "../primitives.js";
import { usePrintMode } from "../print.js";
import { Icon } from "./Icon.js";
import { LassoMark } from "../LassoMark.js";

/** "2026-04-15" -> "for 3 dage siden" under 7 dage gammel, ellers "15.04.2026". */
function relativeOrDate(iso: string | undefined): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return formatDate(iso);
  const ms = Math.max(0, Date.now() - then);
  const days = Math.floor(ms / 86_400_000);
  if (days >= 7) return formatDate(iso);
  // 26h.6: under et døgn i timer ("for 2 timer siden"); under en time "for lidt siden".
  if (days === 0) {
    const hours = Math.floor(ms / 3_600_000);
    return hours === 0 ? "for lidt siden" : hours === 1 ? "for 1 time siden" : `for ${hours} timer siden`;
  }
  if (days === 1) return "i går";
  return `for ${days} dage siden`;
}

function favicon(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return `https://www.google.com/s2/favicons?sz=32&domain=${new URL(url).hostname}`;
  } catch {
    return null;
  }
}

/** Fed skrift om virksomhedens navn i uddraget (regel: aldrig koral eller farvet baggrund). */
function Excerpt({ text, mention }: { text: string; mention?: string }) {
  if (!mention) return <>{text}</>;
  const i = text.toLowerCase().indexOf(mention.toLowerCase());
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <strong>{text.slice(i, i + mention.length)}</strong>
      {text.slice(i + mention.length)}
    </>
  );
}

/** Hvad et segment kan åbne: virksomhed (CVR-1-…) eller person (CVR-3-…); ellers intet. */
function openAction(s: TextSegment): ViewAction | null {
  if (!s.lassoId) return null;
  if (s.lassoId.startsWith("CVR-1-")) return { kind: "open-company", lassoId: s.lassoId, name: s.text };
  if (isPersonId(s.lassoId)) return { kind: "open-person", lassoId: s.lassoId, name: s.text };
  return null;
}

interface SegmentOpts {
  /** Siden, nyheden står på: dens eget navn står i fed i stedet for som link til sig selv (regel 17). */
  selfId?: string;
  onOpen?: (a: ViewAction) => void;
}

/** Et segment, der kan åbnes her: har et Lasso-ID, er ikke siden selv, og værten har drill-down. */
function linkOf(s: TextSegment, { selfId, onOpen }: SegmentOpts): ViewAction | null {
  if (!onOpen || (selfId && s.lassoId === selfId)) return null;
  return openAction(s);
}

/** Et segment som ren tekst: fed, når det er virksomhedens eget navn (Paqles highlight eller siden selv). */
function plainSegment(s: TextSegment, key: number, selfId?: string): ReactNode {
  return s.highlight || (selfId && s.lassoId === selfId) ? <strong key={key}>{s.text}</strong> : <span key={key}>{s.text}</span>;
}

/** Et navn med Lasso-ID som lasso-link, der åbner virksomheden eller personen i værten. */
function EntityLink({ segment, action, onOpen }: { segment: TextSegment; action: ViewAction; onOpen: (a: ViewAction) => void }) {
  return (
    <button type="button" className="lasso-link lasso-news__entity" onClick={() => onOpen(action)}>
      {segment.text}
    </button>
  );
}

/**
 * Tekstsegmenter (`headlineSegments`/`extractSegments`): Paqle udpeger firmanavnet (`highlight`),
 * og Lasso News' "{Navn|LassoId}"-markup giver navne med Lasso-ID, som bliver links, når værten kan
 * åbne dem (regel 17: navn i fed, aldrig koral eller farvet baggrund).
 */
function Segments({ segments, ...opts }: { segments: TextSegment[] } & SegmentOpts) {
  return (
    <>
      {segments.map((s, i) => {
        const action = linkOf(s, opts);
        return action ? <EntityLink key={i} segment={s} action={action} onOpen={opts.onOpen!} /> : plainSegment(s, i, opts.selfId);
      })}
    </>
  );
}

/**
 * Overskriften som link til artiklen. Et <a> må ikke indeholde knapper, så navne, der kan åbnes,
 * bryder linket: tekststykkerne før og efter er hver sit <a> til artiklen, navnet er en knap.
 */
function Headline({ item, ...opts }: { item: NewsItemVM } & SegmentOpts) {
  const segments: TextSegment[] = item.headlineSegments ?? [{ text: item.headline }];
  if (!item.url) return <Segments segments={segments} {...opts} />;
  const parts: ReactNode[] = [];
  let run: ReactNode[] = [];
  const flush = () => {
    if (!run.length) return;
    parts.push(
      <a key={`a${parts.length}`} href={item.url} target="_blank" rel="noreferrer">
        {run}
      </a>,
    );
    run = [];
  };
  segments.forEach((s, i) => {
    const action = linkOf(s, opts);
    if (!action) {
      run.push(plainSegment(s, i, opts.selfId));
      return;
    }
    flush();
    parts.push(<EntityLink key={i} segment={s} action={action} onOpen={opts.onOpen!} />);
  });
  flush();
  return <>{parts}</>;
}

/** Lassos egen nyhedskilde ("Lasso News", "Lasso"). */
export function isLassoSource(source: string | undefined): boolean {
  return /^lasso(\s+news)?$/i.test((source ?? "").trim());
}

function SourceMark({ source, url }: { source: string; url?: string }) {
  const [broken, setBroken] = useState(false);
  // 12.4: Lasso News bruger Lasso-ikonet fra 01b (ink, ingen flise), aldrig et hentet favicon eller globussen.
  const lasso = isLassoSource(source);
  // Print (PDF): kun det neutrale ikon, så serverens Chromium aldrig henter noget udefra.
  const print = usePrintMode();
  const src = broken || lasso || print ? null : favicon(url);
  return (
    <span className="lasso-news__mark" aria-hidden="true">
      {lasso ? (
        <LassoMark className="lasso-news__lasso" />
      ) : src ? (
        <img src={src} alt="" width={16} height={16} onError={() => setBroken(true)} />
      ) : (
        <Icon name="globe" size={16} />
      )}
      <span className="lasso-news__source">{source},</span>
    </span>
  );
}

/** "Eksempeldata, kilde Paqle" (26h.6). Uden provider: Lasso News for Lassos egne, ellers Paqle. */
function footText(item: NewsItemVM): string {
  const provider = item.provider ?? (isLassoSource(item.source) ? "Lasso News" : "Paqle");
  const text = [item.note, `kilde ${provider}`].filter(Boolean).join(", ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function NewsRow({ item, mention, ...opts }: { item: NewsItemVM; mention?: string } & SegmentOpts) {
  // 12.4: kildevisningn er "Kilde, for 3 dage siden" / "Kilde, dd.mm.åååå, engelsk", komma-adskilt
  // (regel 6), uden nyhedstypen.
  const meta = [relativeOrDate(item.time), item.language].filter(Boolean).join(", ");
  // Rækken er ikke selv et link (links og knapper må ikke ligge i hinanden): overskriften linker til
  // artiklen, og navne med Lasso-ID i overskrift og uddrag åbner virksomheden eller personen.
  return (
    // 26h.6: en artikel med Paqle-fremhævning (firmanavnet udpeget i uddraget) står som kort på mobil;
    // almindelige nyheder står som kompakt liste (26c.9).
    <article className={`lasso-news__row${item.extractSegments?.some((x) => x.highlight) ? " lasso-news__row--featured" : ""}`}>
      <div className="lasso-news__head">
        <SourceMark source={item.source} url={item.url} />
        <span className="lasso-news__time">{meta}</span>
      </div>
      <div className="lasso-news__headline">
        <Headline item={item} {...opts} />
      </div>
      {item.excerpt ? (
        // Lasso News' content kan have linjeskift fra en HTML-liste (<li>); white-space: pre-line
        // viser dem, uden at gå via en stylesheet-ændring (uddraget er ellers almindelig løbetekst).
        <div className={`lasso-row__sub lasso-news__excerpt${isLassoSource(item.source) ? "" : " lasso-news__snippet"}`} style={{ whiteSpace: "pre-line" }}>
          {item.extractSegments ? <Segments segments={item.extractSegments} {...opts} /> : <Excerpt text={item.excerpt} mention={mention} />}
        </div>
      ) : null}
      {/* 26h.6 mobil: bundlinje med note og nyhedstjeneste til venstre og "Åbn artikel" til højre. */}
      <div className="lasso-news__foot">
        <span className="lasso-news__provider">{footText(item)}</span>
        {item.url ? (
          <a className="lasso-news__open" href={item.url} target="_blank" rel="noreferrer">
            Åbn artikel
          </a>
        ) : null}
      </div>
    </article>
  );
}

/**
 * Nyheder (katalog 12, "Nyheder"). To kilder, Lasso News og Paqle, flettet og sorteret efter tid
 * (apps/server/src/data/live.ts). Kildemærke = kildens eget favicon (fallback: neutralt
 * globus-ikon, aldrig et bogstav). Relativ tid under 7 dage, ellers dato. Virksomheden
 * fremhæves i overskrift og uddrag med fed skrift, aldrig koral (regel 17). Overskriften linker til
 * artiklen; andre virksomheder og personer i teksten åbnes i værten, når den har drill-down.
 */
export function LassoNews({
  news,
  companyName,
  companyId,
  limit,
  error,
  onOpen,
  emptyReason,
  moreIn,
  layout,
}: {
  news?: NewsVM;
  /** "grid" (mønster 8, 30.11): artiklerne som kortgitter i to kolonner i fuld bredde. */
  layout?: "grid";
  companyName?: string;
  /** Virksomheden, siden handler om: dens navn i nyhederne står i fed og linker ikke til sig selv. */
  companyId?: string;
  limit?: number;
  error?: string;
  /** Værten kan åbne virksomheder og personer (drill-down): navne med Lasso-ID bliver links. */
  onOpen?: (a: ViewAction) => void;
  /** Tom tilstand for andre entiteter end virksomheder, fx "Ingen nyheder om personen." */
  emptyReason?: string;
  /** Smagsprøve på overblikket: "Se alle N nyheder i Historik" åbner fanen i stedet for at folde ud. */
  moreIn?: MoreInTab;
}) {
  const title = "Nyheder";
  const [expanded, setExpanded] = useState(usePrintMode());
  if (!news) {
    return (
      <Section title={title} span="half">
        {error ? <DataState state={stateForError(error) === "noaccess" ? "empty" : "error"} reason={error} /> : <DataState state="loading" lines={6} height={320} />}
      </Section>
    );
  }
  if (news.items.length === 0) {
    return (
      <Section title={title} span="half">
        <DataState state="empty" reason={emptyReason ?? "Der er ikke fundet nyheder om virksomheden."} />
      </Section>
    );
  }
  // Specens limit gælder (overblik: 3); resten bag "Se alle N" (regel 9).
  const max = limit ?? 5;
  const items = expanded ? news.items : news.items.slice(0, max);
  return (
    <Section title={title} span={layout === "grid" ? "full" : "half"}>
      <div className={`lasso-news${layout === "grid" ? " lasso-news--grid" : ""}`}>
        {items.map((n, i) => (
          <NewsRow key={i} item={n} mention={companyName} selfId={companyId} onOpen={onOpen} />
        ))}
      </div>
      {news.items.length > max ? (
        moreIn ? (
          <button type="button" className="lasso-link lasso-more" onClick={moreIn.open}>
            {`Se alle ${news.items.length} nyheder i ${moreIn.tab}`}
          </button>
        ) : (
          // 12.4 (runde 5, Paper LNE-0): "Vis flere" som tekstknap med chevron under en tynd linje.
          <button type="button" className="lasso-link lasso-news__more" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
            {expanded ? "Vis færre" : "Vis flere"}
            <Icon name={expanded ? "chevron-up" : "chevron-down"} size={14} />
          </button>
        )
      ) : null}
    </Section>
  );
}
