import { useState } from "react";
import { formatDate, type NewsItemVM, type NewsVM } from "@lasso/spec";
import { DataState, Section, SourceLine, stateForError } from "../primitives.js";

/** "2026-04-15" -> "for 3 dage siden" under 7 dage gammel, ellers "15.04.2026". */
function relativeOrDate(iso: string | undefined): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return formatDate(iso);
  const days = Math.max(0, Math.floor((Date.now() - then) / 86_400_000));
  if (days >= 7) return formatDate(iso);
  if (days === 0) return "i dag";
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

/**
 * Paqles egne tekstsegmenter (`headlineSegments`/`extractSegments`): firmanavnet er allerede
 * udpeget af Lasso (`highlight:true`), så det bruges i stedet for et gæt på tekstsøgning
 * (regel 17: navn i fed, aldrig koral eller farvet baggrund).
 */
function Segments({ segments }: { segments: { text: string; highlight?: boolean }[] }) {
  return (
    <>
      {segments.map((s, i) => (s.highlight ? <strong key={i}>{s.text}</strong> : <span key={i}>{s.text}</span>))}
    </>
  );
}

function SourceMark({ source, url }: { source: string; url?: string }) {
  const [broken, setBroken] = useState(false);
  const src = broken ? null : favicon(url);
  return (
    <span className="lasso-news__mark" aria-hidden="true">
      {src ? (
        <img src={src} alt="" width={16} height={16} onError={() => setBroken(true)} />
      ) : (
        <svg viewBox="0 0 24 24" width={16} height={16}>
          <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <path d="M3 12h18M12 3c2.5 2.6 4 6 4 9s-1.5 6.4-4 9c-2.5-2.6-4-6-4-9s1.5-6.4 4-9z" fill="none" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      )}
      <span className="lasso-news__source">{source},</span>
    </span>
  );
}

function NewsRow({ item, mention }: { item: NewsItemVM; mention?: string }) {
  // Typeetiket og tidspunkt er ren tekst, komma-adskilt (regel 6: ingen midterprikker).
  const meta = [item.typeLabel, relativeOrDate(item.time), item.language].filter(Boolean).join(", ");
  const body = (
    <>
      <div className="lasso-news__head">
        <SourceMark source={item.source} url={item.url} />
        <span className="lasso-news__time">{meta}</span>
      </div>
      <div className="lasso-news__headline">{item.headlineSegments ? <Segments segments={item.headlineSegments} /> : item.headline}</div>
      {item.excerpt ? (
        // Lasso News' content kan have linjeskift fra en HTML-liste (<li>); white-space: pre-line
        // viser dem, uden at gå via en stylesheet-ændring (uddraget er ellers almindelig løbetekst).
        <div className="lasso-row__sub" style={{ whiteSpace: "pre-line" }}>
          {item.extractSegments ? <Segments segments={item.extractSegments} /> : <Excerpt text={item.excerpt} mention={mention} />}
        </div>
      ) : null}
    </>
  );
  if (item.url) {
    return (
      <a className="lasso-news__row" href={item.url} target="_blank" rel="noreferrer">
        {body}
      </a>
    );
  }
  return <div className="lasso-news__row">{body}</div>;
}

/**
 * Nyheder (katalog 12, "Nyheder"). To kilder, Lasso News og Paqle, flettet og sorteret efter tid
 * (apps/server/src/data/live.ts). Kildemærke = kildens eget favicon (fallback: neutralt
 * globus-ikon, aldrig et bogstav). Relativ tid under 7 dage, ellers dato. Virksomheden
 * fremhæves i overskrift og uddrag med fed skrift, aldrig koral (regel 17).
 */
export function LassoNews({ news, companyName, limit, error }: { news?: NewsVM; companyName?: string; limit?: number; error?: string }) {
  const title = "Nyheder";
  const [expanded, setExpanded] = useState(false);
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
        <DataState state="empty" reason="Der er ikke fundet nyheder om virksomheden." />
      </Section>
    );
  }
  // Specens limit gælder (overblik: 3); resten bag "Se alle N" (regel 9).
  const max = limit ?? 5;
  const items = expanded ? news.items : news.items.slice(0, max);
  return (
    <Section title={title} span="half">
      <div className="lasso-news">
        {items.map((n, i) => (
          <NewsRow key={i} item={n} mention={companyName} />
        ))}
      </div>
      {news.items.length > max ? (
        <button type="button" className="lasso-link lasso-more" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
          {expanded ? "Vis færre" : `Se alle ${news.items.length} nyheder`}
        </button>
      ) : null}
      {news.sources?.length ? <SourceLine source={news.sources.join(" og ")} updated={news.updatedAt} /> : null}
    </Section>
  );
}
