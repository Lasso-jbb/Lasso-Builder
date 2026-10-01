import { useEffect, useState } from "react";
import { contactPersonGroup, formatDate, formatNumber, formatPhone, groupContactPersons, type CompanyVM, type ContactPersonVM, type ContactPersonsVM, type ContactVM } from "@lasso/spec";
import { DataState, Section, stateForError } from "../primitives.js";
import { ShellIcon } from "./ShellIcons.js";
import { SidePanel, SidePanelList } from "./SidePanel.js";
import type { ShortcutItem } from "./Shortcuts.js";

/** Regel 9: blokken viser 3 + "Se N kontaktpersoner"; resten står i "Se alle"-panelet (08.7). */
const BLOCK_ROWS = 3;

const prettyPhone = (v: string): string => formatPhone(v) ?? v;

/** G2 (Jakob 29.09): telefon-/mailikon kun, når personen har telefon/mail; ingen dæmpede ikoner (blokken 08.6). */
function BlockChannels({ person }: { person: ContactPersonVM }) {
  if (!person.phone && !person.email) return null;
  return (
    <span className="lasso-contactpersons__actions" aria-hidden="true">
      {person.phone ? <ShellIcon name="phone" size={15} className="lasso-contactpersons__icon" /> : null}
      {person.email ? <ShellIcon name="mail" size={15} className="lasso-contactpersons__icon" /> : null}
    </span>
  );
}

/** "CEO, Direktion" under navnet: rolle og afdeling, uden gentagelse når de er ens. */
function roleLine(p: ContactPersonVM): string | undefined {
  const group = contactPersonGroup(p);
  const parts = [p.role, group !== "Øvrige" ? group : undefined].filter((x): x is string => Boolean(x));
  const uniq = parts.filter((x, i) => parts.findIndex((y) => y.toLowerCase() === x.toLowerCase()) === i);
  return uniq.length ? uniq.join(", ") : undefined;
}

export interface LassoContactPersonsProps {
  data?: ContactPersonsVM;
  title?: string;
  error?: string;
  /*
   * company, companyName, contact, shortcuts og onLiveDetails fyldte panelets første kolonne (08.7 "seeall").
   * Panelet dækker nu de højre 2/3 af visningen, så sidens egen første kolonne står synlig (Jakob 01.10);
   * felterne bliver, så eksisterende kald stadig typer, men bruges ikke længere af panelet.
   */
  /** Virksomhedens navn (fallback for panelets første kolonne, når `company` mangler). */
  companyName?: string;
  /** 08.7: virksomheden i panelets første kolonne (navn, adresse, CVR, stiftet, ansatte). */
  company?: CompanyVM;
  /** 08.7: kontaktoplysningerne i første kolonne (web, Live Nummer, telefonnumre, e-mailadresser). */
  contact?: ContactVM;
  /** 08.7: genveje nederst i første kolonne (fx Tvillinger, Nyheder). Kun dem, der har en funktion (G1). */
  shortcuts?: readonly ShortcutItem[];
  /** 08.7: "Se detaljer" under Live Nummer (åbner live-nummeret, 08.5). Uden: linket vises ikke (G1). */
  onLiveDetails?: () => void;
  /** "Kopiér telefonnummer"/"Kopiér e-mailadresse" (værten kopierer og viser en besked). Uden: kun værdien. */
  onCopy?: (text: string, what: "phone" | "email") => void;
  /** Åbn et eksternt link (kilde, web). Uden: almindeligt link i nyt vindue. */
  onOpenLink?: (url: string) => void;
  /** Statisk forhåndsvisning og tests: panelet åbent med denne person valgt (indeks i den sorterede liste). */
  defaultOpen?: number;
  /** Med defaultOpen: hvilken side af mobilarket der vises først (standard "detail"; "list" = 08.10). */
  defaultView?: "list" | "detail";
}

/** Sand på skærme ≥ 1200 px (08.7's brede panel); falsk på serveren og i tablet/mobil. */
function useWide(): boolean {
  const q = "(min-width: 1200px)";
  const [wide, setWide] = useState(() => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(q).matches);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const m = window.matchMedia(q);
    const on = () => setWide(m.matches);
    on();
    m.addEventListener?.("change", on);
    return () => m.removeEventListener?.("change", on);
  }, []);
  return wide;
}

function ExtLink({ url, label, className, onOpenLink }: { url: string; label: string; className: string; onOpenLink?: (url: string) => void }) {
  return onOpenLink ? (
    <button type="button" className={className} onClick={() => onOpenLink(url)}>
      {label}
    </button>
  ) : (
    <a className={className} href={url} target="_blank" rel="noreferrer">
      {label}
    </a>
  );
}

/** "https://www.lassox.com/" -> "lassox.com" til visning. */
function prettyUrl(v: string): string {
  try {
    return new URL(v).hostname.replace(/^www\./, "");
  } catch {
    return v.replace(/^https?:\/\//, "").replace(/\/$/, "");
  }
}
const digits = (v: string): string => {
  const d = v.replace(/\D/g, "");
  return d.length === 10 && d.startsWith("45") ? d.slice(2) : d;
};

/**
 * 08.7, kolonne 2 (Paper L8Z-0): stilling pr. række, telefon-/mailikon kun ved data (G2); den
 * valgte i koral (primary-text/500). Afdelingerne adskilles af overlinje med skillelinje og luft.
 */
function Channels({ person }: { person: ContactPersonVM }) {
  if (!person.phone && !person.email) return null;
  return (
    <span className="lasso-contactpersons__actions" aria-hidden="true">
      {person.phone ? <ShellIcon name="phone" size={14} className="lasso-contactpersons__icon" /> : null}
      {person.email ? <ShellIcon name="mail" size={14} className="lasso-contactpersons__icon" /> : null}
    </span>
  );
}

/**
 * 08.7, detaljen (Paper LCJ-0): navn 20/600, stilling, kopiér-handlinger med værdien og kilderne
 * (Jakob 01.10: "Se flere"-panelet viser, hvor oplysningen kommer fra). Ingen Ring/Skriv/LinkedIn (Paper).
 */
function Detail({ person, onCopy, onOpenLink }: { person: ContactPersonVM; onCopy?: LassoContactPersonsProps["onCopy"]; onOpenLink?: (url: string) => void }) {
  const copy = (value: string, shown: string, what: "phone" | "email", label: string) =>
    onCopy ? (
      <button type="button" className="lasso-cpdetail__copy" onClick={() => onCopy(value, what)}>
        <ShellIcon name="copy" size={16} className="lasso-cpdetail__copyicon" />
        <span className="lasso-cpdetail__copytext">
          <span className="lasso-cpdetail__copylabel">{label}</span>
          <span className="lasso-cpdetail__copyvalue">{shown}</span>
        </span>
      </button>
    ) : (
      <div className="lasso-cpdetail__plain">
        <span className="lasso-cpdetail__copylabel">{what === "phone" ? "Telefon" : "E-mail"}</span>
        <span className="lasso-cpdetail__copyvalue">{shown}</span>
      </div>
    );
  return (
    <div className="lasso-cpdetail">
      <div className="lasso-cpdetail__head">
        <h3 className="lasso-cpdetail__name">{person.name}</h3>
        {person.role ? <p className="lasso-cpdetail__role">{person.role}</p> : null}
      </div>
      {person.phone || person.email ? (
        <div className="lasso-cpdetail__copies">
          {person.phone ? copy(person.phone, prettyPhone(person.phone), "phone", "Kopiér telefonnummer") : null}
          {person.email ? copy(person.email, person.email, "email", "Kopiér e-mailadresse") : null}
        </div>
      ) : (
        <p className="lasso-cpdetail__none">Der er ikke fundet telefon eller e-mail for personen.</p>
      )}
      {person.sources?.length ? (
        <div className="lasso-chdetail__sources">
          <div className="lasso-chdetail__overline">Kilder</div>
          {person.sources.map((src, i) => (
            <p key={i}>
              {src.url ? <ExtLink url={src.url} label={src.url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")} className="lasso-chdetail__link" onOpenLink={onOpenLink} /> : <span>{src.label}</span>}
              {src.text ? `, ${src.text}` : ""}
              {src.date ? ` (${formatDate(src.date)})` : ""}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** 08.7, kolonne 1 (Paper L7H-0): virksomheden, Live Nummer, telefonnumre, e-mailadresser og genveje. */
export function CompanyColumn({ company, contact, name, shortcuts, onLiveDetails, onOpenLink }: { company?: CompanyVM; contact?: ContactVM; name?: string; shortcuts?: readonly ShortcutItem[]; onLiveDetails?: () => void; onOpenLink?: (url: string) => void }) {
  const address = contact?.address ?? company?.address;
  const cityLine = address ? [address.zip, address.city].filter(Boolean).join(" ") : "";
  const live = (contact?.verifiedNumbers ?? []).filter((n) => !n.expired)[0];
  const verified = new Set((contact?.verifiedNumbers ?? []).filter((n) => !n.expired).map((n) => digits(n.phoneNumber)));
  const phones = [contact?.phone].filter((x): x is string => Boolean(x));
  const emails = [contact?.email, ...(contact?.emails ?? [])].filter((x, i, a): x is string => Boolean(x) && a.indexOf(x) === i);
  const shield = <ShellIcon name="shield-check" size={14} className="lasso-cpcompany__shield" />;
  const founded = company?.founded ? company.founded.slice(0, 4) : undefined;
  return (
    <div className="lasso-cpcompany">
      <div className="lasso-cpcompany__facts">
        <div className="lasso-cpcompany__name">{company?.name ?? name}</div>
        {address?.street || cityLine ? (
          <div className="lasso-cpcompany__lines">
            {address?.street ? <span>{address.street}</span> : null}
            {cityLine ? <span>{cityLine}</span> : null}
          </div>
        ) : null}
        {company?.cvr || founded ? (
          <div className="lasso-cpcompany__lines">
            {company?.cvr ? <span>CVR {company.cvr}</span> : null}
            {founded ? <span>Stiftet {founded}</span> : null}
          </div>
        ) : null}
        {typeof company?.employees === "number" && company.employees > 0 ? <div className="lasso-cpcompany__line">{formatNumber(company.employees)} ansatte</div> : null}
        {contact?.website ? <ExtLink url={contact.website} label={prettyUrl(contact.website)} className="lasso-cpcompany__web" onOpenLink={onOpenLink} /> : null}
        {live ? (
          <div className="lasso-cpcompany__group">
            <div className="lasso-cpcompany__label">
              Live Nummer
              <span className="lasso-cpcompany__info" title="Nummeret er verificeret i realtid af Lasso" aria-label="Nummeret er verificeret i realtid af Lasso" role="img">
                <ShellIcon name="info" size={14} />
              </span>
            </div>
            <div className="lasso-cpcompany__value">
              <span>{prettyPhone(live.phoneNumber)}</span>
              {shield}
            </div>
            {onLiveDetails ? (
              <button type="button" className="lasso-cpcompany__more" onClick={onLiveDetails}>
                Se detaljer
              </button>
            ) : null}
          </div>
        ) : null}
        {phones.length ? (
          <div className="lasso-cpcompany__group">
            <div className="lasso-cpcompany__label">Telefonnumre</div>
            {phones.map((p) => (
              <div key={p} className="lasso-cpcompany__value">
                <span>{prettyPhone(p)}</span>
                {verified.has(digits(p)) ? shield : null}
              </div>
            ))}
          </div>
        ) : null}
        {emails.length ? (
          <div className="lasso-cpcompany__group">
            <div className="lasso-cpcompany__label">Emailadresser</div>
            {emails.map((e) => (
              <div key={e} className="lasso-cpcompany__value">
                {e}
              </div>
            ))}
          </div>
        ) : null}
      </div>
      {shortcuts?.length ? (
        <div className="lasso-cpcompany__shortcuts">
          {shortcuts.map((s) => (
            <button key={s.id} type="button" className="lasso-btn lasso-cpcompany__shortcut" onClick={s.onSelect}>
              <ShellIcon name={s.icon} size={16} />
              <span>{s.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Kontaktpersoner (katalog 08.6, node I6B-0): blok på siden med de første 3 (Direktion først), rækker
 * på 52 px med rolle og afdeling i muted under navnet og telefon-/mailikon til højre, kun når
 * kanalen findes (G2). Klik på række, ikon eller "Se N kontaktpersoner" åbner "Se alle"-panelet fra
 * højre (08.7) med personen valgt. Ingen initial-cirkler (regel 5).
 */
export function LassoContactPersons({ data, title, error, onCopy, onOpenLink, defaultOpen, defaultView }: LassoContactPersonsProps) {
  const heading = title ?? "Kontaktpersoner";
  const [open, setOpen] = useState(defaultOpen !== undefined);
  const [selected, setSelected] = useState<number>(defaultOpen ?? 0);
  const [view, setView] = useState<"list" | "detail">(defaultOpen !== undefined ? (defaultView ?? "detail") : "list");
  const wide = useWide();

  if (!data) {
    return (
      <Section title={heading} span="half">
        {error ? <DataState state={stateForError(error) === "noaccess" ? "empty" : "error"} reason={error} /> : <DataState state="loading" lines={4} height={210} />}
      </Section>
    );
  }

  if (data.people.length === 0) {
    return (
      <Section title={heading} span="half">
        <DataState state="empty" reason={data.emptyReason ?? "Der er ikke fundet kontaktpersoner for virksomheden."} />
      </Section>
    );
  }

  // Sorteret som panelet: Direktion først, Øvrige sidst; indekset er rækkens id.
  const groups = groupContactPersons(data.people.map((p, i) => ({ ...p, _i: i })));
  const sorted = groups.flatMap((g) => g.people);
  const visible = sorted.slice(0, BLOCK_ROWS);
  const current = sorted[selected] ?? sorted[0]!;
  const show = (index: number, detail: boolean) => {
    setSelected(index);
    setView(detail ? "detail" : "list");
    setOpen(true);
  };

  return (
    <Section title={heading} span="half">
      <ul className="lasso-rows lasso-contactpersons__rows">
        {visible.map((p, i) => (
          <li key={`${p.name}-${p._i}`} className="lasso-contactpersons__item">
            <button type="button" className="lasso-row lasso-contactpersons__row" onClick={() => show(i, true)} aria-haspopup="dialog">
              <span className="lasso-row__main">
                <span className="lasso-row__name">{p.name}</span>
                {roleLine(p) ? <span className="lasso-row__sub">{roleLine(p)}</span> : null}
              </span>
              <BlockChannels person={p} />
            </button>
          </li>
        ))}
      </ul>
      {sorted.length > BLOCK_ROWS ? (
        <button type="button" className="lasso-link lasso-more" aria-haspopup="dialog" onClick={() => show(0, false)}>
          Se {sorted.length} kontaktpersoner
        </button>
      ) : null}
      {/* 08.6: ingen kildevisning under blokken; kilderne står pr. person i panelet ("KILDER"). */}
      <SidePanel
        open={open}
        variant="flere"
        title={heading}
        subtitle={`${sorted.length} ${sorted.length === 1 ? "person" : "personer"}`}
        onClose={() => setOpen(false)}
        view={view}
        onBack={() => setView("list")}
        detailTitle={heading}
        list={
          <SidePanelList
            ariaLabel={heading}
            // 08.7: på desktop står alle; tablet/mobil (08.9/08.10) viser 6 + "Vis N flere".
            limit={wide ? Infinity : 6}
            selected={String(sorted.indexOf(current))}
            onSelect={(id) => {
              setSelected(Number(id));
              setView("detail");
            }}
            groups={groups.map((g) => ({
              label: g.group,
              // 08.7 (Paper L8Z-0): stillingen står i listen; navnet i detaljen (uden stilling: navnet).
              items: g.people.map((p) => ({ id: String(sorted.indexOf(p)), title: p.role ?? p.name, trailing: <Channels person={p} /> })),
            }))}
          />
        }
        detail={<Detail person={current} onCopy={onCopy} onOpenLink={onOpenLink} />}
      />
    </Section>
  );
}
