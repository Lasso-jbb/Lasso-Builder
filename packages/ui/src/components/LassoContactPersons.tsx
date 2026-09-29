import { useState } from "react";
import { contactPersonGroup, formatDate, formatPhone, groupContactPersons, type ContactPersonVM, type ContactPersonsVM } from "@lasso/spec";
import { DataState, Section, SourceLine, stateForError } from "../primitives.js";
import { ShellIcon } from "./ShellIcons.js";
import { SidePanel, SidePanelList } from "./SidePanel.js";

/** Regel 9: blokken viser 3 + "Se N kontaktpersoner"; resten står i "Se alle"-panelet (08.7). */
const BLOCK_ROWS = 3;

const prettyPhone = (v: string): string => formatPhone(v) ?? v;

function Channels({ person }: { person: ContactPersonVM }) {
  return (
    <span className="lasso-contactpersons__actions" aria-hidden="true">
      <ShellIcon name="phone" size={15} className={`lasso-contactpersons__icon${person.phone ? "" : " lasso-contactpersons__icon--muted"}`} />
      <ShellIcon name="mail" size={15} className={`lasso-contactpersons__icon${person.email ? "" : " lasso-contactpersons__icon--muted"}`} />
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
  /** Virksomhedens navn til panelets undertitel og detaljens rollelinje. */
  companyName?: string;
  /** "Kopiér telefonnummer"/"Kopiér e-mail" (værten kopierer og viser en besked). Uden: linkene skjules. */
  onCopy?: (text: string, what: "phone" | "email") => void;
  /** Åbn et eksternt link (LinkedIn, kilde). Uden: almindeligt link i nyt vindue. */
  onOpenLink?: (url: string) => void;
  /** Statisk forhåndsvisning og tests: panelet åbent med denne person valgt (indeks i den sorterede liste). */
  defaultOpen?: number;
}

function Detail({ person, companyName, updated, onCopy, onOpenLink }: { person: ContactPersonVM; companyName?: string; updated?: string; onCopy?: LassoContactPersonsProps["onCopy"]; onOpenLink?: (url: string) => void }) {
  const role = [roleLine(person), companyName].filter(Boolean).join(", ");
  const link = (url: string, label: string, cls = "lasso-cpdetail__action") =>
    onOpenLink ? (
      <button type="button" className={cls} onClick={() => onOpenLink(url)}>
        {label}
      </button>
    ) : (
      <a className={cls} href={url} target="_blank" rel="noreferrer">
        {label}
      </a>
    );
  const dates = (person.sources ?? []).map((s) => s.date).filter((d): d is string => Boolean(d)).sort();
  const when = dates.at(-1) ?? updated;
  return (
    <div className="lasso-cpdetail">
      <h3 className="lasso-cpdetail__name">{person.name}</h3>
      {role ? <p className="lasso-cpdetail__role">{role}</p> : null}
      <ul className="lasso-cpdetail__channels">
        {person.phone ? (
          <li className="lasso-cpdetail__channel">
            <ShellIcon name="phone" size={16} className="lasso-cpdetail__icon" />
            <span className="lasso-cpdetail__main">
              <span className="lasso-cpdetail__label">Telefon</span>
              <span className="lasso-cpdetail__value">{prettyPhone(person.phone)}</span>
              {person.phoneNote ? <span className="lasso-cpdetail__note">{person.phoneNote}</span> : null}
            </span>
            <span className="lasso-cpdetail__actions">
              <a className="lasso-cpdetail__action lasso-cpdetail__action--mobile" href={`tel:${person.phone.replace(/\s+/g, "")}`}>
                Ring
              </a>
              {onCopy ? (
                <button type="button" className="lasso-cpdetail__action" onClick={() => onCopy(person.phone!, "phone")}>
                  Kopiér<span className="lasso-cpdetail__long"> telefonnummer</span>
                </button>
              ) : null}
            </span>
          </li>
        ) : null}
        {person.email ? (
          <li className="lasso-cpdetail__channel">
            <ShellIcon name="mail" size={16} className="lasso-cpdetail__icon" />
            <span className="lasso-cpdetail__main">
              <span className="lasso-cpdetail__label">E-mail</span>
              <span className="lasso-cpdetail__value">{person.email}</span>
              {person.emailNote ? <span className="lasso-cpdetail__note">{person.emailNote}</span> : null}
            </span>
            <span className="lasso-cpdetail__actions">
              <a className="lasso-cpdetail__action lasso-cpdetail__action--mobile" href={`mailto:${person.email}`}>
                Skriv
              </a>
              {onCopy ? (
                <button type="button" className="lasso-cpdetail__action" onClick={() => onCopy(person.email!, "email")}>
                  Kopiér<span className="lasso-cpdetail__long"> e-mail</span>
                </button>
              ) : null}
            </span>
          </li>
        ) : null}
        {person.linkedin ? (
          <li className="lasso-cpdetail__channel">
            <ShellIcon name="linkedin" size={16} className="lasso-cpdetail__icon" />
            <span className="lasso-cpdetail__main">
              <span className="lasso-cpdetail__label">LinkedIn</span>
              <span className="lasso-cpdetail__value lasso-cpdetail__value--desktop">LinkedIn-profil</span>
            </span>
            <span className="lasso-cpdetail__actions">{link(person.linkedin, "Åbn")}</span>
          </li>
        ) : null}
        {!person.phone && !person.email && !person.linkedin ? (
          <li className="lasso-cpdetail__channel lasso-cpdetail__channel--none">Der er ikke fundet telefon, e-mail eller LinkedIn for personen.</li>
        ) : null}
      </ul>
      {person.sources?.length ? (
        <div className="lasso-cpdetail__sources">
          <div className="lasso-cpdetail__overline">Kilder</div>
          <ul>
            {person.sources.map((s, i) => (
              <li key={i}>
                {s.url ? link(s.url, s.label, "lasso-cpdetail__source") : <span className="lasso-cpdetail__source lasso-cpdetail__source--plain">{s.label}</span>}
                {s.text || s.date ? <span className="lasso-cpdetail__sourcetext">{[s.text, s.date ? formatDate(s.date) : undefined].filter(Boolean).join(", ")}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {when ? <p className="lasso-cpdetail__updated">Opdateret {formatDate(when)}.</p> : null}
    </div>
  );
}

/**
 * Kontaktpersoner (katalog 08.6, node I6B-0): blok på siden med de første 3 (Direktion først), rækker
 * på 52 px med rolle og afdeling i muted under navnet og telefon-/mailikon til højre (faint, når
 * kanalen mangler). Klik på række, ikon eller "Se N kontaktpersoner" åbner "Se alle"-panelet fra
 * højre (08.7) med personen valgt. Ingen initial-cirkler (regel 5).
 */
export function LassoContactPersons({ data, title, error, companyName, onCopy, onOpenLink, defaultOpen }: LassoContactPersonsProps) {
  const heading = title ?? "Kontaktpersoner";
  const [open, setOpen] = useState(defaultOpen !== undefined);
  const [selected, setSelected] = useState<number>(defaultOpen ?? 0);
  const [view, setView] = useState<"list" | "detail">(defaultOpen !== undefined ? "detail" : "list");

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
              <Channels person={p} />
            </button>
          </li>
        ))}
      </ul>
      {sorted.length > BLOCK_ROWS ? (
        <button type="button" className="lasso-link lasso-more" aria-haspopup="dialog" onClick={() => show(0, false)}>
          Se {sorted.length} kontaktpersoner
        </button>
      ) : null}
      {data.source ? <SourceLine source={data.source} updated={data.updated} /> : null}
      <SidePanel
        open={open}
        title={heading}
        subtitle={[companyName, `${sorted.length} ${sorted.length === 1 ? "person" : "personer"}`].filter(Boolean).join(", ")}
        onClose={() => setOpen(false)}
        view={view}
        onBack={() => setView("list")}
        detailTitle="Kontaktperson"
        list={
          <SidePanelList
            ariaLabel={heading}
            selected={String(sorted.indexOf(current))}
            onSelect={(id) => {
              setSelected(Number(id));
              setView("detail");
            }}
            groups={groups.map((g) => ({
              label: g.group,
              items: g.people.map((p) => ({ id: String(sorted.indexOf(p)), title: p.name, sub: p.role, trailing: <Channels person={p} /> })),
            }))}
          />
        }
        detail={<Detail person={current} companyName={companyName} updated={data.updated} onCopy={onCopy} onOpenLink={onOpenLink} />}
      />
    </Section>
  );
}
