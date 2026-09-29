import { formatDate, formatNumber, type ProductionUnitVM, type ProductionUnitsVM } from "@lasso/spec";
import { DataState, Section, stateForError, statusTone } from "../primitives.js";
import { Icon } from "./Icon.js";

function unitStatusText(u: ProductionUnitVM): string | undefined {
  if (u.endedYear) return `Ophørt ${u.endedYear}`;
  return u.status;
}

function ended(u: ProductionUnitVM): boolean {
  return u.statusKind === "inactive" || Boolean(u.endedYear);
}

function addressText(u: ProductionUnitVM): string | undefined {
  return u.address ? [u.address.street, [u.address.zip, u.address.city].filter(Boolean).join(" ")].filter(Boolean).join(", ") || undefined : undefined;
}

/** Kontaktlinjen: telefon og e-mail med 12 px ikon, kun når data findes (G2). */
function ContactLine({ u }: { u: ProductionUnitVM }) {
  if (!u.phone && !u.email) return null;
  return (
    <span className="lasso-units20__contact">
      {u.phone ? (
        <span className="lasso-units20__contact-item">
          <Icon name="phone" size={12} />
          <span>{u.phone}</span>
        </span>
      ) : null}
      {u.email ? (
        <span className="lasso-units20__contact-item">
          <Icon name="mail" size={12} />
          <span>{u.email}</span>
        </span>
      ) : null}
    </span>
  );
}

/** "2 aktive, 1 ophørt" (26e.1). */
function countText(units: readonly ProductionUnitVM[]): string {
  const off = units.filter(ended).length;
  const on = units.length - off;
  return [`${on} ${on === 1 ? "aktiv" : "aktive"}`, off ? `${off} ophørt` : null].filter(Boolean).join(", ");
}

/**
 * Produktionsenheder (katalog 20.1, Paper M1G-0; mobil 26e.1, M3A-0). Desktop: tabel i kortramme
 * (radius 10) med 40 px hoved på panelflade og rækker på 76 px i fem kolonner: P-NR. (120 px, koral
 * HOVEDENHED-overlinje under nummeret) | ENHED, ADRESSE OG KONTAKT (navn 14, adresse 12 muted, telefon og
 * e-mail 12 med 12 px ikon, kun når data findes, G2) | BRANCHE (220 px: tekst 13, kode 11 muted under) |
 * ANSATTE (90 px, højre, "-" når ikke oplyst) | OPRETTET OG STATUS (150 px, højre: dato over status i
 * statusfarve). Ophørte enheder står dæmpet. Hovedenheden står altid først (adapterne sorterer). Ingen
 * undertitel under overskriften.
 * Mobil (26e.1): rækker med navn (+ HOVEDENHED), adresse, kontaktlinje og "P-nr., branche, ansatte,
 * oprettet" som 11 px; ophørte med status til højre for navnet. Ingen chevron, da rækken ikke åbner noget (G1).
 */
export function ProductionUnits({ units, error }: { units?: ProductionUnitsVM; error?: string }) {
  const title = "Produktionsenheder";
  if (!units) {
    return (
      <Section title={title} span="full">
        {error ? <DataState state={stateForError(error) === "noaccess" ? "empty" : "error"} reason={error} /> : <DataState state="loading" lines={4} height={210} />}
      </Section>
    );
  }
  if (units.units.length === 0) {
    return (
      <Section title={title} span="full">
        <DataState state="empty" reason="Virksomheden har ingen registrerede produktionsenheder i CVR." />
      </Section>
    );
  }
  return (
    <Section title={title} span="full" className="lasso-units lasso-units20" action={<span className="lasso-units__count">{countText(units.units)}</span>}>
      <ul className="lasso-units20-m">
        {units.units.map((u, i) => {
          const off = ended(u);
          const meta = [
            u.pNumber ? `P-nr. ${u.pNumber}` : null,
            u.industryText ?? null,
            u.employees != null ? `${formatNumber(u.employees)} ansatte` : null,
            u.created ? `oprettet ${formatDate(u.created)}` : null,
          ]
            .filter(Boolean)
            .join(", ");
          const address = addressText(u);
          return (
            <li key={u.pNumber ?? i} className={`lasso-units20-m__row${off ? " is-ended" : ""}`}>
              <span className="lasso-units20-m__top">
                <span className="lasso-units20-m__name">{u.name ?? "Uden navn"}</span>
                {u.isMain ? <span className="lasso-units__main lasso-units20-m__main">Hovedenhed</span> : null}
                {off ? <span className="lasso-units20-m__status">{unitStatusText(u)}</span> : null}
              </span>
              {address ? <span className="lasso-units20__address">{address}</span> : null}
              {off ? null : <ContactLine u={u} />}
              {meta ? <span className="lasso-units20-m__meta">{meta}</span> : null}
            </li>
          );
        })}
      </ul>
      <div className="lasso-units20__frame lasso-units__table" role="table" aria-label={title}>
        <div className="lasso-units20__row lasso-units20__row--head" role="row">
          <span className="lasso-units20__pnr" role="columnheader">
            P-nr.
          </span>
          <span className="lasso-units20__unit" role="columnheader">
            Enhed, adresse og kontakt
          </span>
          <span className="lasso-units20__industry" role="columnheader">
            Branche
          </span>
          <span className="lasso-units20__emp" role="columnheader">
            Ansatte
          </span>
          <span className="lasso-units20__state" role="columnheader">
            Oprettet og status
          </span>
        </div>
        {units.units.map((u, i) => {
          const off = ended(u);
          const status = unitStatusText(u);
          const address = addressText(u);
          return (
            <div key={u.pNumber ?? i} className={`lasso-units20__row${off ? " is-ended" : ""}`} role="row">
              <span className="lasso-units20__pnr" role="cell">
                <span className="lasso-units__pnr">{u.pNumber ?? "-"}</span>
                {u.isMain ? <span className="lasso-units__main">Hovedenhed</span> : null}
              </span>
              <span className="lasso-units20__unit" role="cell">
                <span className="lasso-units20__name">{u.name ?? "Ikke oplyst"}</span>
                {address ? <span className="lasso-units20__address">{address}</span> : null}
                <ContactLine u={u} />
              </span>
              <span className="lasso-units20__industry" role="cell">
                {u.industryText ? <span className="lasso-units20__industry-text">{u.industryText}</span> : <span className="lasso-units20__faint">-</span>}
                {u.industryCode ? <span className="lasso-units20__code">{u.industryCode}</span> : null}
              </span>
              <span className={`lasso-units20__emp${u.employees != null ? "" : " lasso-units20__faint"}`} role="cell">
                {u.employees != null ? formatNumber(u.employees) : "-"}
              </span>
              <span className="lasso-units20__state" role="cell">
                <span className="lasso-units20__date">{u.created ? formatDate(u.created) : "-"}</span>
                {status ? <span className={`lasso-units20__status lasso-status--${off ? "inactive" : statusTone(status, u.statusKind ?? "active")}`}>{status}</span> : null}
              </span>
            </div>
          );
        })}
      </div>
    </Section>
  );
}
