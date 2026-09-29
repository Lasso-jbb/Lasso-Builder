import { useEffect, useState, type ReactNode } from "react";
import { formatDate, formatPhone, type ContactVM } from "@lasso/spec";
import { DataState, Section, SourceLine, stateForError } from "../primitives.js";
import { Icon } from "./Icon.js";

/** Omridsikoner fra ikonsættet (01): kun form, ingen farve. */
const PinIcon = () => <Icon name="pin" size={16} className="lasso-contact__icon" />;
const PhoneIcon = () => <Icon name="phone" size={16} className="lasso-contact__icon" />;
const MailIcon = () => <Icon name="mail" size={16} className="lasso-contact__icon" />;
const GlobeIcon = () => <Icon name="globe" size={16} className="lasso-contact__icon" />;

const prettyPhone = (v: string): string => formatPhone(v) ?? v;

/** "https://example.dk/" -> "example.dk" til visning; klikket bruger den fulde adresse. */
function prettyUrl(v: string): string {
  try {
    return new URL(v).hostname.replace(/^www\./, "");
  } catch {
    return v.replace(/^https?:\/\//, "").replace(/\/$/, "");
  }
}

/**
 * Live-nummer (katalog 08, mobil 26h.7): nummeret i et felt med "Verificeret DATO, live-opslag"
 * (flueben + ord i grøn), kopiér-knap og ring-knap på 40 px. Ring er primær (koral), kopiér
 * er en omridsknap; begge med skærmlæsertekst.
 */
export function LiveNumber({ number, verifiedAt, callable = true }: { number: string; verifiedAt?: string; callable?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    try {
      void navigator.clipboard?.writeText(number.replace(/\s+/g, "")).then(() => setCopied(true));
    } catch {
      /* Udklipsholderen er ikke tilgængelig (fx i en sandkasse); nummeret kan stadig markeres. */
    }
  };
  return (
    <div className="lasso-livenum">
      <div className="lasso-livenum__main">
        <span className="lasso-livenum__number">{prettyPhone(number)}</span>
        <span className="lasso-livenum__verified">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
            <path d="M8 12.5l2.7 2.7L16 9.8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {`Verificeret ${verifiedAt ? formatDate(verifiedAt) : "nu"}, live-opslag`}
        </span>
      </div>
      <button type="button" className="lasso-livenum__btn" onClick={copy} aria-label={copied ? "Nummer kopieret" : "Kopiér nummer"} title={copied ? "Kopieret" : "Kopiér nummer"}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="8" y="8" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.7" />
          <path d="M5 15V6a1 1 0 011-1h9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      </button>
      {callable ? (
        <a className="lasso-livenum__btn lasso-livenum__btn--call" href={`tel:${number.replace(/\s+/g, "")}`} aria-label="Ring op" title="Ring op">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M5 4.5h3.2l1.4 4-2 1.6a11.5 11.5 0 006.3 6.3l1.6-2 4 1.4V19a1.5 1.5 0 01-1.6 1.5A15.5 15.5 0 013.5 6.1 1.5 1.5 0 015 4.5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          </svg>
        </a>
      ) : null}
    </div>
  );
}

/** Kun cifrene, så "86 12 34 56" og "+45 86123456" er samme nummer. */
function digits(v: string): string {
  const d = v.replace(/\D/g, "");
  return d.length === 10 && d.startsWith("45") ? d.slice(2) : d;
}

/** Live-nummerets fire tilstande (katalog 08.5). "Tjekker" vises aldrig over 10 sek. */
export type LiveState = { kind: "now" } | { kind: "checking" } | { kind: "expired"; date?: string } | { kind: "stale"; days: number };

/** Tid i ms, hvor en verifikation stadig tæller som "nu" (kilden svarede inden for 60 sek.). */
const NOW_WINDOW = 60_000;
/** Længste "Tjekker …", før blokken falder tilbage til det, den vidste i forvejen. */
export const VERIFY_TIMEOUT = 10_000;

/**
 * Tilstanden for et verificeret nummer: udgået (gennemstreget, dato), "Verificeret nu" (tidspunkt
 * inden for 60 sek.), ellers "Verificeret for N dage siden" i muted. Kun datoen (ÅÅÅÅ-MM-DD) giver
 * aldrig "nu", fordi den ikke siger, at kilden lige har svaret.
 */
export function liveState(verifiedAt: string | undefined, expired: string | undefined, now: number): LiveState | null {
  if (expired) return { kind: "expired", date: expired };
  if (!verifiedAt) return null;
  const t = new Date(verifiedAt).getTime();
  if (Number.isNaN(t)) return null;
  if (verifiedAt.includes("T") && Math.abs(now - t) <= NOW_WINDOW) return { kind: "now" };
  return { kind: "stale", days: Math.max(0, Math.floor((now - t) / 86_400_000)) };
}

function LiveMark({ state }: { state: LiveState }) {
  if (state.kind === "now") {
    return (
      <span className="lasso-live lasso-live--now">
        <Icon name="check" size={13} />
        Verificeret nu
      </span>
    );
  }
  if (state.kind === "checking") {
    return (
      <span className="lasso-live lasso-live--checking" role="status">
        <span className="lasso-live__spinner" aria-hidden="true" />
        Tjekker …
      </span>
    );
  }
  if (state.kind === "expired") return <span className="lasso-live lasso-live--expired">Udgået{state.date ? `, ${formatDate(state.date)}` : ""}</span>;
  const when = state.days === 0 ? "i dag" : state.days === 1 ? "for 1 dag siden" : `for ${state.days} dage siden`;
  return <span className="lasso-live lasso-live--stale">Verificeret {when}</span>;
}

/** Én række: ikon, værdi (klikbar) og til højre enten live-tilstanden eller en handling (Kort, Ring, Kopiér). */
function Row({ icon, href, children, aside, struck = false, onLink, accent = false }: { icon: ReactNode; href?: string; children: ReactNode; aside?: ReactNode; struck?: boolean; onLink?: (url: string) => void; accent?: boolean }) {
  const cls = `lasso-contact__value${struck ? " lasso-contact__value--struck" : ""}${accent ? " lasso-contact__value--accent" : ""}`;
  return (
    <div className="lasso-contact__row">
      {icon}
      {href && !struck ? (
        onLink && /^https?:/.test(href) ? (
          <button type="button" className={`${cls} lasso-contact__value--link lasso-contact__value--button`} onClick={() => onLink(href)}>
            {children}
          </button>
        ) : (
          <a className={`${cls} lasso-contact__value--link`} href={href}>
            {children}
          </a>
        )
      ) : (
        <span className={cls}>{children}</span>
      )}
      {aside ? <span className="lasso-contact__aside">{aside}</span> : null}
    </div>
  );
}

function ActionLink({ label, href, onClick }: { label: string; href?: string; onClick?: () => void }) {
  if (onClick) {
    return (
      <button type="button" className="lasso-contact__action" onClick={onClick}>
        {label}
      </button>
    );
  }
  return (
    <a className="lasso-contact__action" href={href} target={href?.startsWith("http") ? "_blank" : undefined} rel="noreferrer">
      {label}
    </a>
  );
}

export interface LassoContactProps {
  contact?: ContactVM;
  title?: string;
  error?: string;
  /** Adressen står allerede i hovedet på samme side (samme vej og postnummer). */
  omitAddress?: boolean;
  /** "Kopiér" ved e-mailen (værten kopierer og viser en besked). Uden: intet Kopiér-link. */
  onCopy?: (text: string, what: "phone" | "email") => void;
  /** Åbn et eksternt link (kort, hjemmeside) via værten. Uden: almindeligt link. */
  onOpenLink?: (url: string) => void;
  /**
   * Katalog 08.5: verificér numre og e-mail i realtid, mens blokken er åben. Værten henter og
   * opdaterer datasættet (verifiedAt); blokken viser "Tjekker …" i højst 10 sek. imens.
   */
  onVerify?: () => Promise<unknown> | void;
  /** Tidspunktet "nu" i ms (tests og statisk forhåndsvisning). */
  now?: number;
  /**
   * 08.3: flere telefonnumre end det første foldes bag "Se N telefonnumre" (regel 9). false viser alle
   * numre enkeltvis med deres live-tilstand (08.5).
   */
  foldExtra?: boolean;
}

/**
 * Kontaktblok (katalog 08, node 9SX-0): ikon + værdi, klikbar (tel:/mailto:/https), ingen
 * skillelinjer mellem rækkerne, kun luft. Adresse (ikke klikbar), telefon, e-mail, web, i den
 * rækkefølge, med handlingen til højre: Kort, Ring, Kopiér (24.9). Tom tilstand, når intet er oplyst.
 * Står hovedet med samme adresse på siden, udelades adressen (`omitAddress`).
 *
 * Live-nummer (08.5, kræver egen tilføjelse, udelades stille uden adgang): verificerede numre står
 * efter de almindelige rækker med en af fire tilstande til højre: "Verificeret nu" (grøn, kun mens
 * kilden svarede inden for 60 sek.), "Tjekker …" (spinner, højst 10 sek.), "Udgået, dato" (gul,
 * værdien gennemstreget men beholdt) og "Verificeret for N dage siden" (muted). Nummeret vises
 * altid; verifikationen er et tillæg, aldrig en forudsætning. Robinsonliste-linje i muted og én
 * kildelinje for begge kilder (regel 8).
 */
export function LassoContact({ contact, title, error, omitAddress = false, onCopy, onOpenLink, onVerify, now, foldExtra = true }: LassoContactProps) {
  const heading = title ?? "Kontakt";
  const [checking, setChecking] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const lassoId = contact?.lassoId;
  useEffect(() => {
    if (!onVerify || !lassoId) return;
    let done = false;
    setChecking(true);
    const timer = setTimeout(() => {
      if (!done) setChecking(false);
    }, VERIFY_TIMEOUT);
    Promise.resolve(onVerify())
      .catch(() => undefined)
      .finally(() => {
        done = true;
        clearTimeout(timer);
        setChecking(false);
      });
    return () => {
      done = true;
      clearTimeout(timer);
    };
    // Én verifikation pr. virksomhed, mens blokken er åben.
  }, [lassoId]);

  if (!contact) {
    return (
      <Section title={heading} span="half">
        {error ? <DataState state={stateForError(error) === "noaccess" ? "empty" : "error"} reason={error} /> : <DataState state="loading" lines={4} height={154} />}
      </Section>
    );
  }

  const at = now ?? Date.now();
  const a = omitAddress ? undefined : contact.address;
  const addressLine1 = a?.street;
  const addressLine2 = [a?.zip, a?.city].filter(Boolean).join(" ") || undefined;
  const hasAddress = Boolean(addressLine1 || addressLine2);
  const hasVerified = Boolean(contact.verifiedNumbers?.length);
  // Er CVR-nummeret også verificeret, står det én gang med verificeringen, ikke to gange.
  const phoneMatch = contact.phone ? contact.verifiedNumbers?.find((n) => digits(n.phoneNumber) === digits(contact.phone!)) : undefined;
  const otherVerified = (contact.verifiedNumbers ?? []).filter((n) => !contact.phone || digits(n.phoneNumber) !== digits(contact.phone));
  const hasAny = hasAddress || contact.phone || contact.email || contact.website || hasVerified;

  if (!hasAny) {
    return (
      <Section title={heading} span="half">
        <DataState state="empty" reason={omitAddress ? "Der er ikke oplyst telefon, e-mail eller hjemmeside for virksomheden." : "Der er ikke oplyst kontaktoplysninger for virksomheden."} />
      </Section>
    );
  }
  const stateOf = (n?: { expired?: string }): LiveState | null => (checking ? { kind: "checking" } : n ? liveState(contact.verifiedAt, n.expired, at) : null);
  const mapUrl = hasAddress ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([addressLine1, addressLine2].filter(Boolean).join(", "))}` : undefined;
  // Regel 8: én kildelinje pr. sektion, også når live number har leveret numre.
  const sources = [contact.source, hasVerified ? "Lasso live number" : undefined].filter((x): x is string => Boolean(x));
  const sameDate = !hasVerified || !contact.source || !contact.updated || !contact.verifiedAt || contact.updated === contact.verifiedAt.slice(0, 10);
  const phoneState = stateOf(phoneMatch);
  // 08.3: ét nummer ad gangen; resten (også udgåede) bag "Se N telefonnumre" i muted til højre.
  const folded = foldExtra && !showAll && otherVerified.length > 0;
  const extraLabel = `Se ${otherVerified.length} ${otherVerified.length === 1 ? "telefonnummer" : "telefonnumre"}`;
  const tel = contact.phone ? `tel:${contact.phone.replace(/\s+/g, "")}` : undefined;
  // Handlingerne (Kort, Ring, Kopiér) står kun på mobil (26a.6); desktop viser værdierne alene (08.3).
  const act = (node: ReactNode) => <span className="lasso-contact__act">{node}</span>;
  const more = (label: string, onClick: () => void) => (
    <button type="button" className="lasso-contact__more" onClick={onClick}>
      {label}
    </button>
  );

  return (
    <Section title={title} span="half" className="lasso-contact-section">
      {title ? null : <div className="lasso-contact__overline">Kontakt</div>}
      <div className="lasso-contact">
        {hasAddress ? (
          <Row icon={<PinIcon />} aside={mapUrl ? act(<ActionLink label="Kort" href={mapUrl} onClick={onOpenLink ? () => onOpenLink(mapUrl) : undefined} />) : undefined}>
            <span className="lasso-contact__value--multiline">
              {addressLine1 ? <span>{addressLine1}</span> : null}
              {addressLine2 ? <span>{addressLine2}</span> : null}
            </span>
          </Row>
        ) : null}
        {contact.phone ? (
          <Row
            icon={<PhoneIcon />}
            href={tel}
            struck={phoneState?.kind === "expired"}
            aside={
              <>
                {folded ? more(extraLabel, () => setShowAll(true)) : phoneState ? <LiveMark state={phoneState} /> : null}
                {phoneState?.kind === "expired" ? null : act(
                  <a className="lasso-contact__call" href={tel} aria-label="Ring" title="Ring">
                    <Icon name="phone" size={16} />
                  </a>,
                )}
              </>
            }
          >
            {prettyPhone(contact.phone)}
          </Row>
        ) : null}
        {contact.email ? (
          <Row
            icon={<MailIcon />}
            href={`mailto:${contact.email}`}
            aside={checking ? <LiveMark state={{ kind: "checking" }} /> : onCopy ? act(<ActionLink label="Kopiér" onClick={() => onCopy(contact.email!, "email")} />) : undefined}
          >
            {contact.email}
          </Row>
        ) : null}
        {contact.website ? (
          <Row icon={<GlobeIcon />} href={contact.website} onLink={onOpenLink} accent>
            {prettyUrl(contact.website)}
          </Row>
        ) : null}
        {(folded ? [] : otherVerified).map((n, i) => {
          const st = stateOf(n);
          const callable = n.callable && st?.kind !== "expired";
          return (
            <Row key={`verified-${i}`} icon={<PhoneIcon />} href={callable ? `tel:${n.phoneNumber.replace(/\s+/g, "")}` : undefined} struck={st?.kind === "expired"} aside={st ? <LiveMark state={st} /> : undefined}>
              {prettyPhone(n.phoneNumber)}
            </Row>
          );
        })}
      </div>
      {contact.isRobinson ? (
        <p className="lasso-small lasso-muted">Tilmeldt Robinsonlisten, må ikke kontaktes med markedsføring</p>
      ) : null}
      {sources.length === 0 || foldExtra ? null : sameDate ? (
        <SourceLine source={sources.join(" og ")} updated={contact.updated ?? contact.verifiedAt} />
      ) : (
        <p className="lasso-source">
          Kilde: {contact.source}
          {contact.updated ? `, opdateret ${formatDate(contact.updated)}` : ""}; Lasso live number, opdateret {formatDate(contact.verifiedAt)}
        </p>
      )}
    </Section>
  );
}
