import { useEffect, useState, type ReactNode } from "react";
import { formatDate, formatPhone, type ContactVM, type VerifiedPhoneNumberVM } from "@lasso/spec";
import { DataState, Section, stateForError } from "../primitives.js";
import { Icon } from "./Icon.js";
import { ShellIcon } from "./ShellIcons.js";
import { SidePanel, SidePanelList } from "./SidePanel.js";

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
          {/* 26h.7: "Verificeret nu" samme dag som opslaget, ellers datoen. */}
          {`Verificeret ${verifiedAt && verifiedAt.slice(0, 10) !== new Date().toISOString().slice(0, 10) ? formatDate(verifiedAt) : "nu"}, live-opslag`}
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

/* ---------- "Se flere": telefonnumre og e-mailadresser i panelet (08.3/08.7, Jakob 01.10) ---------- */

type ChannelSource = "cvr" | "hjemmeside" | "verificeret";
interface ChannelItem {
  id: string;
  kind: "phone" | "email";
  value: string;
  source: ChannelSource;
  url?: string;
  verified?: VerifiedPhoneNumberVM;
}

const GROUP_LABEL: Record<ChannelSource, string> = { cvr: "Fra CVR", hjemmeside: "Fra hjemmeside", verificeret: "Verificeret af Lasso" };
const GROUP_ORDER: ChannelSource[] = ["cvr", "hjemmeside", "verificeret"];
const norm = (kind: "phone" | "email", v: string) => (kind === "phone" ? digits(v) : v.trim().toLowerCase());

/** Alle telefonnumre eller e-mails med kilde: `channels`, ellers bygget af phone/email/emails og de verificerede numre. */
export function contactChannelItems(contact: ContactVM, kind: "phone" | "email"): ChannelItem[] {
  const out: ChannelItem[] = [];
  const seen = new Set<string>();
  const add = (x: Omit<ChannelItem, "id">) => {
    const key = `${x.source}|${norm(kind, x.value)}`;
    if (!x.value || seen.has(key)) return;
    seen.add(key);
    out.push({ ...x, id: `${x.source}-${out.length}` });
  };
  const base: ChannelSource = contact.source && contact.source !== "CVR" ? "hjemmeside" : "cvr";
  const channels = (contact.channels ?? []).filter((c) => c.kind === kind);
  if (channels.length) for (const c of channels) add({ kind, value: c.value, source: c.source, ...(c.url ? { url: c.url } : {}) });
  else if (kind === "phone" && contact.phone) add({ kind, value: contact.phone, source: base });
  else if (kind === "email") {
    if (contact.email) add({ kind, value: contact.email, source: base });
    for (const e of contact.emails ?? []) add({ kind, value: e, source: "hjemmeside", ...(contact.website ? { url: contact.website } : {}) });
  }
  if (kind === "phone") for (const n of contact.verifiedNumbers ?? []) add({ kind, value: n.phoneNumber, source: "verificeret", verified: n });
  return out.sort((a, b) => GROUP_ORDER.indexOf(a.source) - GROUP_ORDER.indexOf(b.source));
}

/** Antal forskellige værdier (samme nummer fra CVR og hjemmesiden tæller én gang). */
const distinct = (items: readonly ChannelItem[]) => new Set(items.map((i) => norm(i.kind, i.value))).size;

const cvrNumber = (lassoId: string) => /^CVR-1-(\d+)$/.exec(lassoId)?.[1];

/** Panelets detalje: værdien, live-tilstanden for verificerede numre, kopiér og kilderne. */
function ChannelDetail({ item, contact, now, onCopy, onOpenLink }: { item: ChannelItem; contact: ContactVM; now: number; onCopy?: LassoContactProps["onCopy"]; onOpenLink?: (url: string) => void }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => setCopied(false), [item.id]);
  const shown = item.kind === "phone" ? prettyPhone(item.value) : item.value;
  const canClipboard = typeof navigator !== "undefined" && Boolean(navigator.clipboard);
  const copy = onCopy
    ? () => onCopy(item.value, item.kind)
    : canClipboard
      ? () => void navigator.clipboard.writeText(item.value).then(() => setCopied(true))
      : undefined;
  const verifiedState = item.verified ? liveState(contact.verifiedAt, item.verified.expired, now) : null;
  const state = verifiedState?.kind === "expired" ? verifiedState : null;
  const cvr = cvrNumber(contact.lassoId);
  const link = (url: string, label: string) =>
    onOpenLink ? (
      <button type="button" className="lasso-chdetail__link" onClick={() => onOpenLink(url)}>
        {label}
      </button>
    ) : (
      <a className="lasso-chdetail__link" href={url} target="_blank" rel="noreferrer">
        {label}
      </a>
    );
  const what = item.kind === "phone" ? "telefonnummer" : "emailadresse";
  const page = item.url ?? contact.website;
  return (
    <div className="lasso-chdetail">
      <div className="lasso-chdetail__head">
        <h3 className={`lasso-chdetail__value${state?.kind === "expired" ? " lasso-contact__value--struck" : ""}`}>{shown}</h3>
        {state ? <LiveMark state={state} /> : null}
      </div>
      {copy ? (
        <button type="button" className="lasso-cpdetail__copy" onClick={copy}>
          <ShellIcon name="copy" size={16} className="lasso-cpdetail__copyicon" />
          <span className="lasso-cpdetail__copytext">
            <span className="lasso-cpdetail__copylabel">{copied ? "Kopieret" : `Kopiér ${what}`}</span>
          </span>
        </button>
      ) : null}
      <div className="lasso-chdetail__sources">
        <div className="lasso-chdetail__overline">Kilder</div>
        {item.source === "cvr" ? (
          <p>
            {item.kind === "phone" ? "Dette telefonnummer" : "Denne emailadresse"} er registreret i CVR-registret.{" "}
            {cvr ? link(`https://datacvr.virk.dk/enhed/virksomhed/${cvr}`, "Gå til virksomheden på virk.dk") : null}
          </p>
        ) : item.source === "hjemmeside" ? (
          <p>
            Fundet på virksomhedens hjemmeside.{" "}
            {page ? link(page, page.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")) : null}
          </p>
        ) : (
          <p>
            Verificeret af Lasso{contact.verifiedAt ? ` ${formatDate(contact.verifiedAt.slice(0, 10))}` : ""}
            {item.verified?.sources.length ? `, fundet i ${item.verified.sources.map((x) => (x === "Website" ? "hjemmesiden" : x)).join(" og ")}` : ""}.
            {item.verified?.explanation ? ` ${item.verified.explanation}` : ""}
          </p>
        )}
      </div>
    </div>
  );
}

/** "Se flere"-panelet for telefonnumre eller e-mailadresser: grupperet liste i midten, detalje til højre. */
function ChannelPanel({ kind, contact, open, onClose, now, onCopy, onOpenLink }: { kind: "phone" | "email"; contact: ContactVM; open: boolean; onClose: () => void; now: number; onCopy?: LassoContactProps["onCopy"]; onOpenLink?: (url: string) => void }) {
  const items = contactChannelItems(contact, kind);
  const [selected, setSelected] = useState(items[0]?.id ?? "");
  const [view, setView] = useState<"list" | "detail">("detail");
  const current = items.find((i) => i.id === selected) ?? items[0];
  if (!current) return null;
  const title = kind === "phone" ? "Telefonnumre" : "Emailadresser";
  return (
    <SidePanel
      open={open}
      variant="flere"
      title={title}
      onClose={onClose}
      view={view}
      onBack={() => setView("list")}
      detailTitle={title}
      list={
        <SidePanelList
          ariaLabel={title}
          limit={Infinity}
          selected={current.id}
          onSelect={(id) => {
            setSelected(id);
            setView("detail");
          }}
          groups={GROUP_ORDER.map((src) => ({ label: GROUP_LABEL[src], items: items.filter((i) => i.source === src).map((i) => ({ id: i.id, title: kind === "phone" ? prettyPhone(i.value) : i.value })) })).filter((g) => g.items.length)}
        />
      }
      detail={<ChannelDetail item={current} contact={contact} now={now} onCopy={onCopy} onOpenLink={onOpenLink} />}
    />
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
 * efter de almindelige rækker; kun "Udgået, dato" (gul, værdien gennemstreget men beholdt) markeres,
 * ingen verificeringsnoter (Jakob 01.10, 08.5). Nummeret vises
 * altid; verifikationen er et tillæg, aldrig en forudsætning. Robinsonliste-linje i muted og én
 * kildevisning for begge kilder (regel 8).
 */
export function LassoContact({ contact, title, error, omitAddress = false, onCopy, onOpenLink, onVerify, now, foldExtra = true }: LassoContactProps) {
  const heading = title ?? "Kontakt";
  const [panel, setPanel] = useState<"phone" | "email" | null>(null);
  const lassoId = contact?.lassoId;
  useEffect(() => {
    if (!onVerify || !lassoId) return;
    // Verifikationen kører stille i baggrunden (Jakob 01.10, 08.5); kun et udgået nummer markeres.
    Promise.resolve(onVerify()).catch(() => undefined);
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
  // Jakob 01.10 (08.5): ingen verificeringsnoter ("Verificeret nu", "for N dage siden", "Tjekker …");
  // kun et udgået nummer markeres (gennemstreget med "Udgået, dato").
  const stateOf = (n?: { expired?: string }): LiveState | null => {
    const st = n ? liveState(contact.verifiedAt, n.expired, at) : null;
    return st?.kind === "expired" ? st : null;
  };
  const mapUrl = hasAddress ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([addressLine1, addressLine2].filter(Boolean).join(", "))}` : undefined;
  const phoneState = stateOf(phoneMatch);
  // 08.3: ét nummer og én e-mail ad gangen; har virksomheden flere (CVR, hjemmesiden, verificerede), åbner
  // "Se N telefonnumre"/"Se N emailadresser" panelet fra højre med alle, grupperet efter kilde (Jakob 01.10).
  const phoneItems = contactChannelItems(contact, "phone");
  const emailItems = contactChannelItems(contact, "email");
  const phoneCount = distinct(phoneItems);
  const emailCount = distinct(emailItems);
  const folded = foldExtra && (otherVerified.length > 0 || phoneCount > 1);
  // Jakob 01.10: "Se alle N" (alle numre, ikke kun de ekstra).
  const extraLabel = `Se alle ${phoneCount}`;
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
                {folded && phoneCount > 1 ? more(extraLabel, () => setPanel("phone")) : phoneState ? <LiveMark state={phoneState} /> : null}
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
            aside={
              (foldExtra && emailCount > 1) || onCopy ? (
                <>
                  {foldExtra && emailCount > 1 ? more(`Se alle ${emailCount}`, () => setPanel("email")) : null}
                  {onCopy ? act(<ActionLink label="Kopiér" onClick={() => onCopy(contact.email!, "email")} />) : null}
                </>
              ) : undefined
            }
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
      {/* 08.3 (Jakob 29.09): ingen Robinson-linje og ingen kildevisning (G3) under kontaktrækkerne. */}
      {phoneCount > 1 ? <ChannelPanel kind="phone" contact={contact} open={panel === "phone"} onClose={() => setPanel(null)} now={at} onCopy={onCopy} onOpenLink={onOpenLink} /> : null}
      {emailCount > 1 ? <ChannelPanel kind="email" contact={contact} open={panel === "email"} onClose={() => setPanel(null)} now={at} onCopy={onCopy} onOpenLink={onOpenLink} /> : null}
    </Section>
  );
}
