import type { ReactNode } from "react";
import { formatDate, type ContactVM } from "@lasso/spec";
import { DataState, Section, SourceLine, stateForError } from "../primitives.js";

/** Rene omridsikoner, samme streg som SeverityIcon (primitives.tsx): kun form, ingen farve. */
function PinIcon() {
  return (
    <svg className="lasso-contact__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 21s7-6.1 7-11.5A7 7 0 105 9.5C5 14.9 12 21 12 21z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="12" cy="9.5" r="2.4" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg className="lasso-contact__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 4.5h3.2l1.4 4-2 1.6a11.5 11.5 0 006.3 6.3l1.6-2 4 1.4V19a1.5 1.5 0 01-1.6 1.5A15.5 15.5 0 013.5 6.1 1.5 1.5 0 015 4.5z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg className="lasso-contact__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3.5" y="5.5" width="17" height="13" rx="1.6" stroke="currentColor" strokeWidth="1.6" />
      <path d="M4.5 6.5l7.5 6 7.5-6" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg className="lasso-contact__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3.7 12h16.6M12 3.5c2.4 2.5 3.8 5.6 3.8 8.5s-1.4 6-3.8 8.5c-2.4-2.5-3.8-5.6-3.8-8.5S9.6 6 12 3.5z" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

/** "12345678" -> "12 34 56 78" (samme gruppering som tekstkortet, card.ts). */
function prettyPhone(v: string): string {
  return /^\d{8}$/.test(v) ? v.replace(/^(\d{2})(\d{2})(\d{2})(\d{2})$/, "$1 $2 $3 $4") : v;
}

/** "https://example.dk/" -> "example.dk" til visning; klikket bruger den fulde adresse. */
function prettyUrl(v: string): string {
  try {
    return new URL(v).hostname.replace(/^www\./, "");
  } catch {
    return v.replace(/^https?:\/\//, "").replace(/\/$/, "");
  }
}

function Row({ icon, href, children }: { icon: ReactNode; href?: string; children: ReactNode }) {
  return (
    <div className="lasso-contact__row">
      {icon}
      {href ? (
        <a className="lasso-contact__value lasso-contact__value--link" href={href}>
          {children}
        </a>
      ) : (
        <span className="lasso-contact__value">{children}</span>
      )}
    </div>
  );
}

/** Kun cifrene, så "86 12 34 56" og "+45 86123456" er samme nummer. */
function digits(v: string): string {
  const d = v.replace(/\D/g, "");
  return d.length === 10 && d.startsWith("45") ? d.slice(2) : d;
}

/**
 * Kontaktblok (katalog 08, node 9SX-0): ikon + værdi, klikbar (tel:/mailto:/https), ingen
 * skillelinjer mellem rækkerne, kun luft. Adresse (ikke klikbar), telefon, e-mail, web, i den
 * rækkefølge. Tom tilstand, når intet er oplyst. Står hovedet med samme adresse på siden,
 * udelades adressen (`omitAddress`), så den ikke står to gange.
 *
 * Live number (kræver egen tilføjelse, udelades stille uden adgang): op til 3 verificerede
 * numre efter de almindelige rækker, mærket "Telefon (verificeret DD.MM.ÅÅÅÅ)" i ren tekst;
 * er CVR-nummeret selv verificeret, står mærket på det i stedet for en række mere. En
 * Robinsonliste-linje i muted og én kildelinje for begge kilder (regel 8).
 */

export function LassoContact({
  contact,
  title,
  error,
  omitAddress = false,
}: {
  contact?: ContactVM;
  title?: string;
  error?: string;
  /** Adressen står allerede i hovedet på samme side (samme vej og postnummer). */
  omitAddress?: boolean;
}) {
  const heading = title ?? "Kontakt";
  if (!contact) {
    return (
      <Section title={heading} span="half">
        {error ? <DataState state={stateForError(error) === "noaccess" ? "empty" : "error"} reason={error} /> : <DataState state="loading" lines={4} height={154} />}
      </Section>
    );
  }

  const a = omitAddress ? undefined : contact.address;
  const addressLine1 = a?.street;
  const addressLine2 = [a?.zip, a?.city].filter(Boolean).join(" ") || undefined;
  const hasAddress = Boolean(addressLine1 || addressLine2);
  const hasVerified = Boolean(contact.verifiedNumbers?.length);
  // Er CVR-nummeret også verificeret, står det én gang med verificeringen, ikke to gange.
  const phoneVerified = contact.phone ? contact.verifiedNumbers?.some((n) => digits(n.phoneNumber) === digits(contact.phone!)) : false;
  const otherVerified = (contact.verifiedNumbers ?? []).filter((n) => !contact.phone || digits(n.phoneNumber) !== digits(contact.phone));
  const hasAny = hasAddress || contact.phone || contact.email || contact.website || hasVerified;

  if (!hasAny) {
    return (
      <Section title={heading} span="half">
        <DataState state="empty" reason={omitAddress ? "Der er ikke oplyst telefon, e-mail eller hjemmeside for virksomheden." : "Der er ikke oplyst kontaktoplysninger for virksomheden."} />
      </Section>
    );
  }
  // Regel 8: én kildelinje pr. sektion, også når live number har leveret numre.
  const sources = [contact.source, hasVerified ? "Lasso live number" : undefined].filter((x): x is string => Boolean(x));
  const sameDate = !hasVerified || !contact.source || !contact.updated || !contact.verifiedAt || contact.updated === contact.verifiedAt;

  return (
    <Section title={heading} span="half">
      <div className="lasso-contact">
        {hasAddress ? (
          <div className="lasso-contact__row">
            <PinIcon />
            <span className="lasso-contact__value lasso-contact__value--multiline">
              {addressLine1 ? <span>{addressLine1}</span> : null}
              {addressLine2 ? <span>{addressLine2}</span> : null}
            </span>
          </div>
        ) : null}
        {contact.phone ? (
          <Row icon={<PhoneIcon />} href={`tel:${contact.phone.replace(/\s+/g, "")}`}>
            {prettyPhone(contact.phone)}
            {phoneVerified ? <span className="lasso-small lasso-muted"> — Telefon (verificeret {formatDate(contact.verifiedAt)})</span> : null}
          </Row>
        ) : null}
        {contact.email ? (
          <Row icon={<MailIcon />} href={`mailto:${contact.email}`}>
            {contact.email}
          </Row>
        ) : null}
        {contact.website ? (
          <Row icon={<GlobeIcon />} href={contact.website}>
            {prettyUrl(contact.website)}
          </Row>
        ) : null}
        {otherVerified.map((n, i) => (
          <Row key={`verified-${i}`} icon={<PhoneIcon />} href={n.callable ? `tel:${n.phoneNumber.replace(/\s+/g, "")}` : undefined}>
            {prettyPhone(n.phoneNumber)}
            <span className="lasso-small lasso-muted"> — Telefon (verificeret {formatDate(contact.verifiedAt)})</span>
          </Row>
        ))}
      </div>
      {contact.isRobinson ? (
        <p className="lasso-small lasso-muted">Tilmeldt Robinsonlisten, må ikke kontaktes med markedsføring</p>
      ) : null}
      {sources.length === 0 ? null : sameDate ? (
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
