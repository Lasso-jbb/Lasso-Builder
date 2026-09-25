import {
  amountScale,
  formatAmount,
  formatCriterion,
  formatDate,
  formatNumber,
  formatScaled,
  METRIC_FIELD,
  METRIC_LABELS,
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
        // Stamoplysninger, så modellen kan svare på dem (og værter uden grafik kan vise dem).
        const a = co.address;
        const facts = [
          co.form && `form ${co.form}`,
          (a?.street || a?.zip) && `adresse ${[a?.street, [a?.zip, a?.city].filter(Boolean).join(" ")].filter(Boolean).join(", ")}`,
          a?.municipality && `kommune ${a.municipality}`,
          a?.region && `region ${a.region}`,
          co.industryText && `branche ${co.industryText}${co.industryCode ? ` (${co.industryCode})` : ""}`,
          co.founded && `stiftet ${formatDate(co.founded)}`,
          co.employees != null && `${formatNumber(co.employees)} ansatte i CVR`,
          co.phone && `tlf. ${co.phone}`,
          co.email && `e-mail ${co.email}`,
          co.website && `web ${co.website}`,
        ].filter(Boolean);
        if (facts.length) lines.push(`Stamoplysninger: ${facts.join("; ")}.`);
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
      if (f && c.type === "LassoFinancialChart") {
        // Hele rækken, så modellen kan kommentere udviklingen (og værter uden grafik kan vise den).
        const series = (m: typeof c.metric) =>
          f.years.slice(-c.years).flatMap((y) => {
            const v = y[METRIC_FIELD[m]];
            return typeof v === "number" ? [{ year: y.year, value: v }] : [];
          });
        let metric = c.metric;
        let points = series(metric);
        if (points.length === 0 && metric === "omsaetning") points = series((metric = "bruttofortjeneste"));
        if (points.length) {
          const scale = metric === "ansatte" ? null : amountScale(points.map((p) => p.value));
          const unit = scale ? ` (${scale.label})` : "";
          lines.push(
            `${METRIC_LABELS[metric]} ${points[0]!.year}–${points.at(-1)!.year}${unit}: ${points.map((p) => `${p.year} ${scale ? formatScaled(p.value, scale) : formatNumber(p.value)}`).join(", ")}.`,
          );
        }
      }
    }
    if (c.type === "LassoPeopleList") {
      const people = ds.people[c.company] ?? [];
      const current = people.filter((p) => !p.to).slice(0, 6);
      if (current.length) lines.push(`Ledelse: ${current.map((p) => `${p.name} (${p.role})`).join(", ")}.`);
    }
    if (c.type === "LassoOwnership") {
      const o = ds.ownership[c.company];
      if (o?.owners.length) lines.push(`Ejere: ${o.owners.slice(0, 4).map((x) => `${x.name}${x.share ? ` ${x.share}` : ""}${x.votes ? ` (stemmer ${x.votes})` : ""}`).join(", ")}.`);
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
