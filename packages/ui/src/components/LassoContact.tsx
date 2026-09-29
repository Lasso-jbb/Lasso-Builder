import { useState, type ReactNode } from "react";
import { formatDate, type ContactVM } from "@lasso/spec";
import { DataState, Section, SourceLine, stateForError } from "../primitives.js";
import { Icon } from "./Icon.js";

import { mapLink } from "./Values.js";

/** Omridsikoner fra ikonsættet (01): kun form, ingen farve. */
const PinIcon = () => <Icon name="pin" size={16} className="lasso-contact__icon" />;
const PhoneIcon = () => <Icon name="phone" size={16} className="lasso-contact__icon" />;
const MailIcon = () => <Icon name="mail" size={16} className="lasso-contact__icon" />;
const GlobeIcon = () => <Icon name="globe" size={16} className="lasso-contact__icon" />;

/**
 * Handling til højre i rækken (26a, kontakt som 48 px rækker): Kort og Kopiér som koral tekst,
 * Ring som 40 px ikonknap med koral ikon. Vises kun på mobil (< 560 px); på desktop er værdien
 * selv klikbar (tel:/mailto:).
 */
function MapAction({ query }: { query: string }) {
  return (
    <a className="lasso-contact__action" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`} target="_blank" rel="noopener noreferrer">
      Kort
    </a>
  );
}

function CallAction({ phone }: { phone: string }) {
  return (
    <a className="lasso-contact__call" href={`tel:${phone.replace(/\s+/g, "")}`} aria-label={`Ring ${phone}`} title="Ring">
      <Icon name="phone" size={16} />
    </a>
  );
}

function CopyAction({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="lasso-contact__action"
      onClick={() => {
        const clip = typeof navigator !== "undefined" ? navigator.clipboard : undefined;
        clip?.writeText(text).then(
          () => {
            setDone(true);
            setTimeout(() => setDone(false), 2000);
          },
          () => undefined,
        );
      }}
    >
      {done ? "Kopieret" : "Kopiér"}
    </button>
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

function Row({ icon, href, action, children }: { icon: ReactNode; href?: string; action?: ReactNode; children: ReactNode }) {
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
      {action ? <span className="lasso-contact__side">{action}</span> : null}
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
              {/* 02c.11: diskret kortlink under adressen */}
              <a className="lasso-address__map" href={mapLink([addressLine1, addressLine2])} target="_blank" rel="noreferrer">
                Vis på kort
              </a>
            </span>
            <span className="lasso-contact__side">
              <MapAction query={[addressLine1, addressLine2].filter(Boolean).join(", ")} />
            </span>
          </div>
        ) : null}
        {contact.phone ? (
          <Row icon={<PhoneIcon />} href={`tel:${contact.phone.replace(/\s+/g, "")}`} action={<CallAction phone={contact.phone} />}>
            {prettyPhone(contact.phone)}
            {phoneVerified ? <span className="lasso-small lasso-muted"> — Telefon (verificeret {formatDate(contact.verifiedAt)})</span> : null}
          </Row>
        ) : null}
        {contact.email ? (
          <Row icon={<MailIcon />} href={`mailto:${contact.email}`} action={<CopyAction text={contact.email} />}>
            {contact.email}
          </Row>
        ) : null}
        {contact.website ? (
          <Row icon={<GlobeIcon />} href={contact.website}>
            {prettyUrl(contact.website)}
          </Row>
        ) : null}
        {otherVerified.map((n, i) => (
          <Row key={`verified-${i}`} icon={<PhoneIcon />} href={n.callable ? `tel:${n.phoneNumber.replace(/\s+/g, "")}` : undefined} action={n.callable ? <CallAction phone={n.phoneNumber} /> : undefined}>
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
