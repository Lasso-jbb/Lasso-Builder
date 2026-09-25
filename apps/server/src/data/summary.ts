import {
  amountScale,
  chartSeries,
  formatAmount,
  formatCriterion,
  formatDate,
  formatNumber,
  formatScaled,
  formatShare,
  METRIC_LABELS,
  ownershipGraphKey,
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
    if (c.type === "LassoCompanyHead") {
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
    if (c.type === "LassoKeyFigureCards" || c.type === "LassoBarChart") {
      const f = ds.financials[c.company];
      const last = f?.years.at(-1);
      const prev = f?.years.at(-2);
      if (last && c.type === "LassoKeyFigureCards") {
        const chg = percentChange([prev?.grossProfit, last.grossProfit]);
        lines.push(
          `Regnskab ${last.year}: ${last.revenue !== null && last.revenue !== undefined ? `omsætning ${formatAmount(last.revenue)}, ` : ""}bruttofortjeneste ${formatAmount(last.grossProfit)}${chg !== null ? ` (${chg > 0 ? "+" : ""}${Math.round(chg)} % fra ${prev?.year})` : ""}, resultat ${formatAmount(last.profit)}, egenkapital ${formatAmount(last.equity)}, ${formatNumber(last.employees)} ansatte.`,
        );
      }
      if (f && c.type === "LassoBarChart") {
        // Hele rækken, så modellen kan kommentere udviklingen (og værter uden grafik kan vise den).
        const { metric, points } = chartSeries(f, c.metric, c.years);
        if (points.length) {
          const scale = metric === "ansatte" ? null : amountScale(points.map((p) => p.value));
          const unit = scale ? ` (${scale.label})` : "";
          lines.push(
            `${METRIC_LABELS[metric]} ${points[0]!.year}–${points.at(-1)!.year}${unit}: ${points.map((p) => `${p.year} ${scale ? formatScaled(p.value, scale) : formatNumber(p.value)}`).join(", ")}.`,
          );
        }
      }
    }
    if (c.type === "LassoPersonList") {
      const people = ds.people[c.company] ?? [];
      const current = people.filter((p) => !p.to).slice(0, 6);
      if (current.length) lines.push(`Ledelse: ${current.map((p) => `${p.name} (${p.role})`).join(", ")}.`);
    }
    if (c.type === "LassoOwnerList") {
      const o = ds.ownership[c.company];
      if (o?.owners.length) lines.push(`Ejere: ${o.owners.slice(0, 4).map((x) => `${x.name}${x.share ? ` ${x.share}` : ""}${x.votes ? ` (stemmer ${x.votes})` : ""}`).join(", ")}.`);
      if (o?.auditor) lines.push(`Revisor: ${o.auditor.name}.`);
    }
    if (c.type === "LassoOwnershipDiagram") {
      const g = ds.ownershipGraphs[ownershipGraphKey(c)];
      if (g) {
        const name = (id: string) => g.nodes.find((n) => n.id === id)?.name ?? id;
        const ref = g.onDate ?? new Date().toISOString().slice(0, 10);
        const current = g.edges.filter((e) => !e.until || e.until.slice(0, 10) > ref);
        const owners = current.filter((e) => e.to === g.rootId).map((e) => `${name(e.from)}${e.share ? ` ${formatShare(e.share)}` : ""}`);
        const subs = current.filter((e) => e.from === g.rootId).map((e) => `${name(e.to)}${e.share ? ` ${formatShare(e.share)}` : ""}`);
        lines.push(`Ejerdiagram for ${name(g.rootId)}: ${g.nodes.length} enheder i ${g.ingoingDepth} lag op og ${g.outgoingDepth} ned.${owners.length ? ` Direkte ejere: ${owners.slice(0, 5).join(", ")}.` : " Ingen registrerede ejere."}${subs.length ? ` Direkte datterselskaber: ${subs.length}.` : ""}`);
        if (g.note) lines.push(g.note);
      }
    }
    if (c.type === "LassoCompanyTable") {
      const r = ds.searches[searchKey(c.search)];
      if (r) {
        const top = r.rows.slice(0, 5).map((x) => `${x.name}${x.city ? ` (${x.city})` : ""} [${x.lassoId}]`);
        lines.push(`Søgning gav ${r.total ?? r.rows.length} virksomheder${r.source === "lasso-search" ? " (Lassos søgning i hele CVR)" : ""}; viser ${r.rows.length}. Først: ${top.join("; ") || "ingen"}.`);
        if (r.note) lines.push(r.note);
        if (c.search.criteria.length) lines.push(`Kriterier: ${c.search.criteria.map(formatCriterion).join("; ")}.`);
        if (r.unsupportedCriteria?.length) lines.push(`Kunne ikke anvendes endnu: ${r.unsupportedCriteria.join("; ")}.`);
      }
    }
    if (c.type === "LassoCompareTable") {
      const names = c.companies.map((id) => ds.companies[id]?.name ?? id);
      lines.push(`Sammenligner: ${names.join(", ")}.`);
    }
  }

  const errors = Object.entries(ds.errors);
  if (errors.length) lines.push(`Fejl: ${errors.slice(0, 3).map(([k, v]) => `${k.split(":")[0]}: ${v}`).join("; ")}.`);
  lines.push("Vis tekstkortet uændret i en kodeblok (ved en virksomhed altid, ellers når appen ikke kan vise Lasso-visningen) med linket til den interaktive visning under det, hvis der er et. Svar kort og gentag ikke tallene som tabel.");
  return lines.join("\n");
}
