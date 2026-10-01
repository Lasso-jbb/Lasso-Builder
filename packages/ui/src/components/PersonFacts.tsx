import { personFacts, type PersonVM } from "@lasso/spec";
import { DataState, Missing, Section, stateForError } from "../primitives.js";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

interface Row {
  label: string;
  value?: string;
}

/** Bopælen som postnummer og by (og land uden for Danmark); aldrig gade og husnummer. */
function residence(p: PersonVM): string | undefined {
  if (p.addressProtected) return "Adressebeskyttet";
  const place = [p.zip, p.city].filter(Boolean).join(" ");
  return [place, p.country].filter(Boolean).join(", ") || undefined;
}

/**
 * Rækkerne i stamoplysningerne (16.6, Jakob 01.10): kun Bopæl, Kommune og Aktive roller. Ved beskyttet adresse
 * udelades kommunen også ("Adressebeskyttet" siger hvorfor). `hideCounts` er udgået (hovedet viser ikke tal).
 */
export function personFactRows(p: PersonVM, _options: { hideCounts?: boolean } = {}): Row[] {
  const f = personFacts(p);
  const rows: Row[] = [{ label: "Bopæl", value: residence(p) }];
  if (!p.addressProtected) rows.push({ label: "Kommune", value: p.municipality });
  rows.push({ label: "Aktive roller", value: f.activeRoles ? `${f.activeRoles} i ${plural(f.activeCompanies, "selskab", "selskaber")}` : "Ingen" });
  return rows;
}

/**
 * Stamoplysninger (katalog 16, ¼ ved siden af rollerne). Nøgle-værdi som katalog 09: nøgle
 * 13/400 grå, værdi 14/400, manglende værdi "-" i faint, aldrig "0". Bopælen står kun som
 * postnummer og by, som i personhovedet (aldrig fuld privatadresse); en adressebeskyttet person
 * får ordet "Adressebeskyttet". Roller, ejerskaber og datoer er afledt af rollerne i CVR.
 */
export function PersonFacts({ person, title, hideCounts, error }: { person?: PersonVM; title?: string; hideCounts?: boolean; error?: string }) {
  const heading = title ?? "Stamoplysninger";
  if (!person) {
    return (
      <Section title={heading} span="quarter">
        {error ? <DataState state={stateForError(error) === "noaccess" ? "empty" : "error"} reason={error} /> : <DataState state="loading" lines={6} height={280} />}
      </Section>
    );
  }
  const noAddress = !person.addressProtected && !person.zip && !person.city && !person.municipality && !person.country;
  if (noAddress && person.roles.length === 0) {
    return (
      <Section title={heading} span="quarter">
        <DataState state="empty" reason="CVR har hverken en bopæl eller roller i selskaber registreret for personen." />
      </Section>
    );
  }
  return (
    <Section title={heading} span="quarter" className="lasso-personfacts">
      <div className="lasso-kv-list lasso-kv-list--twocol">
        {personFactRows(person, { hideCounts }).map((r) => (
          // Et langt ord (fx "Adressebeskyttet") står under nøglen i en smal kolonne i stedet for at blive delt midt i ordet.
          <div className={`lasso-kv-row${r.value && !/\s/.test(r.value) && r.value.length > 12 ? " lasso-kv-row--long" : ""}`} key={r.label}>
            <div className="lasso-kv-row__label">{r.label}</div>
            <div className="lasso-kv-row__value" title={r.value}>
              {r.value ?? <Missing />}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}
