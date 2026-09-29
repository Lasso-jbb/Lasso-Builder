import { searchKey, TABLE_COLUMN_LABELS, DEFAULT_TABLE_COLUMNS, type CompanyRowVM, type Dataset, type PersonVM, type TableColumn, type ViewSpec } from "@lasso/spec";

function esc(v: string | number | null | undefined): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV (semikolon, dansk Excel) af virksomhedsrækker med de valgte kolonner. Rå tal, ikke formaterede. */
export function rowsToCsv(rows: readonly CompanyRowVM[], columns: readonly TableColumn[]): string {
  const cols = columns.filter((c) => c !== "udvikling");
  const header = ["Lasso-ID", ...cols.map((c) => TABLE_COLUMN_LABELS[c])];
  const lines = rows.map((r) => {
    const val: Record<string, string | number | null | undefined> = {
      navn: r.name,
      cvr: r.cvr,
      by: r.city,
      region: r.region,
      branche: r.industryText,
      status: r.status,
      ansatte: r.employees,
      omsaetning: r.revenue,
      bruttofortjeneste: r.grossProfit,
      resultat: r.profit,
      score: r.score,
    };
    return [r.lassoId, ...cols.map((c) => val[c])].map(esc).join(";");
  });
  return "\uFEFF" + [header.map(esc).join(";"), ...lines].join("\r\n");
}

/** CSV af en vilkårlig tabel (overskrift + rækker), fx revisoruafhængighedens relationer. */
export function tableToCsv(header: readonly string[], rows: readonly (readonly (string | number | null | undefined)[])[]): string {
  return "\uFEFF" + [header.map(esc).join(";"), ...rows.map((r) => r.map(esc).join(";"))].join("\r\n");
}

/** CSV (semikolon, dansk Excel) af den første tabel i visningen. Rå tal, ikke formaterede. */
export function specToCsv(spec: ViewSpec, ds: Dataset): string | null {
  const table = spec.components.find((c) => c.type === "LassoCompanyTable");
  if (!table || table.type !== "LassoCompanyTable") return null;
  const result = ds.searches[searchKey(table.search)];
  if (!result) return null;
  return rowsToCsv(result.rows, table.columns?.length ? table.columns : DEFAULT_TABLE_COLUMNS);
}

/** 16.1: personens roller som CSV (Eksportér i personhovedet). Ingen CPR eller adresse. */
export function personRolesCsv(person: PersonVM): string {
  return tableToCsv(
    ["Selskab", "CVR", "Rolle", "Ejerandel", "Fra", "Til", "Aktiv", "Selskabets status"],
    person.roles.map((r) => [r.companyName, r.cvr, r.role, r.share, r.from, r.to, r.active ? "Ja" : "Nej", r.companyStatus]),
  );
}
