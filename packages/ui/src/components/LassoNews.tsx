import { useState } from "react";
import { formatDate, type NewsItemVM, type NewsVM } from "@lasso/spec";
import { DataState, Section, stateForError } from "../primitives.js";

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
  const body = (
    <>
      <div className="lasso-news__head">
        <SourceMark source={item.source} url={item.url} />
        <span className="lasso-news__time">
          {relativeOrDate(item.time)}
          {item.language ? `, ${item.language}` : ""}
        </span>
      </div>
      <div className="lasso-news__headline">{item.headline}</div>
      {item.excerpt ? (
        <div className="lasso-row__sub">
          <Excerpt text={item.excerpt} mention={mention} />
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
 * Nyheder (katalog 12, "Nyheder"). Kildemærke = kildens eget favicon (fallback:
 * neutralt globus-ikon, aldrig et bogstav). Relativ tid under 7 dage, ellers
 * dato. Virksomheden fremhæves i uddraget med fed skrift, aldrig koral.
 */
export function LassoNews({ news, companyName, error }: { news?: NewsVM; companyName?: string; error?: string }) {
  const title = "Nyheder";
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
  return (
    <Section title={title} span="half">
      <div className="lasso-news">
        {news.items.map((n, i) => (
          <NewsRow key={i} item={n} mention={companyName} />
        ))}
      </div>
    </Section>
  );
}
