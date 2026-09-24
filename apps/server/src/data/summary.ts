import {
  formatAmount,
  formatCriterion,
  formatNumber,
  percentChange,
  searchKey,
  type Dataset,
  type ViewSpec,
} from "@lasso/spec";

/**
 * Kort tekst til modellen. Brugeren ser allerede visningen, så teksten er kun
 * til opfølgende spørgsmål. Hold den kort: rådata i samtalen er det, der kan
 * vælte økonomien.
 */
export function summarizeView(spec: ViewSpec, ds: Dataset): string {
  const lines: string[] = [];
  if (ds.source === "demo") lines.push("OBS: Demodata (opdigtede virksomheder), ikke rigtige Lasso-data.");

  for (const c of spec.components) {
    if (c.type === "LassoCompanyHeader") {
      const co = ds.companies[c.company];
      if (co) {
        const where = [co.address?.city, co.industryText].filter(Boolean).join(", ");
        lines.push(`${co.name} (CVR ${co.cvr ?? "?"}, Lasso-ID ${co.lassoId}): ${co.status ?? "ukendt status"}${where ? `, ${where}` : ""}.`);
      }
    }
    if (c.type === "LassoKeyFigures" || c.type === "LassoFinancialChart") {
      const f = ds.financials[c.company];
      const last = f?.years.at(-1);
      const prev = f?.years.at(-2);
      if (last && c.type === "LassoKeyFigures") {
        const chg = percentChange([prev?.grossProfit, last.grossProfit]);
        lines.push(
          `Regnskab ${last.year}: ${last.revenue !== null && last.revenue !== undefined ? `omsætning ${formatAmount(last.revenue)}, ` : ""}bruttofortjeneste ${formatAmount(last.grossProfit)}${chg !== null ? ` (${chg > 0 ? "+" : ""}${Math.round(chg)} % fra ${prev?.year})` : ""}, resultat ${formatAmount(last.profit)}, egenkapital ${formatAmount(last.equity)}, ${formatNumber(last.employees)} ansatte.`,
        );
      }
    }
    if (c.type === "LassoPeopleList") {
      const people = ds.people[c.company] ?? [];
      const current = people.filter((p) => !p.to).slice(0, 6);
      if (current.length) lines.push(`Ledelse: ${current.map((p) => `${p.name} (${p.role})`).join(", ")}.`);
    }
    if (c.type === "LassoOwnership") {
      const o = ds.ownership[c.company];
      if (o?.owners.length) lines.push(`Ejere: ${o.owners.slice(0, 4).map((x) => `${x.name}${x.share ? ` ${x.share}` : ""}`).join(", ")}.`);
      if (o?.auditor) lines.push(`Revisor: ${o.auditor.name}.`);
    }
    if (c.type === "LassoTable") {
      const r = ds.searches[searchKey(c.search)];
      if (r) {
        const top = r.rows.slice(0, 5).map((x) => `${x.name}${x.city ? ` (${x.city})` : ""} [${x.lassoId}]`);
        lines.push(`Søgning gav ${r.total ?? r.rows.length} virksomheder; viser ${r.rows.length}. Først: ${top.join("; ") || "ingen"}.`);
        if (c.search.criteria.length) lines.push(`Kriterier: ${c.search.criteria.map(formatCriterion).join("; ")}.`);
        if (r.unsupportedCriteria?.length) lines.push(`Kunne ikke anvendes endnu: ${r.unsupportedCriteria.join("; ")}.`);
      }
    }
    if (c.type === "LassoComparison") {
      const names = c.companies.map((id) => ds.companies[id]?.name ?? id);
      lines.push(`Sammenligner: ${names.join(", ")}.`);
    }
  }

  const errors = Object.entries(ds.errors);
  if (errors.length) lines.push(`Fejl: ${errors.slice(0, 3).map(([k, v]) => `${k.split(":")[0]}: ${v}`).join("; ")}.`);
  lines.push("Brugeren ser visningen grafisk. Gentag ikke tallene som tabel; svar kort og henvis til visningen.");
  return lines.join("\n");
}
