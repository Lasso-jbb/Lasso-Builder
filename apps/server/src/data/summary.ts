import {
  amountScale,
  currencyUnit,
  isForeignCurrency,
  chartSeries,
  creditRatingText,
  formatAmount,
  formatCriterion,
  formatDate,
  formatNumber,
  formatPercent,
  formatScaled,
  formatShare,
  METRIC_KIND,
  METRIC_LABELS,
  ownershipGraphKey,
  percentChange,
  personCompanies,
  personCounts,
  personFacts,
  personRisk,
  personRoleRows,
  riskTimeline,
  savedPagesKey,
  searchKey,
  type Dataset,
  type ViewSpec,
} from "@lasso/spec";

/**
 * Kort tekst til modellen. Brugeren ser allerede visningen, så teksten er kun
 * til opfølgende spørgsmål. Hold den kort: rådata i samtalen er det, der kan
 * vælte økonomien.
 */
/** Elementer, der viser seneste regnskabsårs nøgletal; det første på siden giver resuméets regnskabslinje. */
const SUMMARY_FIGURES: ReadonlySet<ViewSpec["components"][number]["type"]> = new Set(["LassoKeyFigureCards", "LassoIncomeStatement", "LassoBalanceSheet", "LassoMultiYearTable"]);

export function summarizeView(spec: ViewSpec, ds: Dataset): string {
  const lines: string[] = [];
  if (ds.source === "demo") lines.push("OBS: Demodata (opdigtede virksomheder), ikke rigtige Lasso-data.");
  // Seneste regnskabsår én gang: fra nøgletalskortene, eller fra tabellerne på regnskab, hvor kortene ikke står.
  const figures = spec.components.find((x) => SUMMARY_FIGURES.has(x.type));

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
    if ((c === figures && "company" in c) || c.type === "LassoBarChart") {
      const f = "company" in c && c.company ? ds.financials[c.company] : undefined;
      const last = f?.years.at(-1);
      const prev = f?.years.at(-2);
      if (last && c === figures) {
        // Kun oplyste tal; omsætning 0 er i praksis "ikke oplyst" for små selskaber (review P2-6).
        const chg = percentChange([prev?.grossProfit, last.grossProfit]);
        const cur = last.currency ?? f?.currency;
        const money = (v: number) => formatAmount(v, currencyUnit(cur));
        const note = [last.scope === "Koncern" ? "koncerntal" : null, isForeignCurrency(cur) ? `beløb i ${currencyUnit(cur)}, ikke kroner` : null].filter(Boolean).join("; ");
        const parts = [
          typeof last.revenue === "number" && last.revenue !== 0 && `omsætning ${money(last.revenue)}`,
          typeof last.grossProfit === "number" && `bruttofortjeneste ${money(last.grossProfit)}${chg !== null ? ` (${chg > 0 ? "+" : ""}${Math.round(chg)} % fra ${prev?.year})` : ""}`,
          typeof last.profit === "number" && `resultat ${money(last.profit)}`,
          typeof last.equity === "number" && `egenkapital ${money(last.equity)}`,
          typeof last.soliditetsgrad === "number" && `soliditetsgrad ${formatPercent(last.soliditetsgrad, false)}`,
          typeof last.employees === "number" && `${formatNumber(last.employees)} ansatte i regnskabet`,
        ].filter(Boolean);
        if (parts.length) lines.push(`Regnskab ${last.year}${note ? ` (${note})` : ""}: ${parts.join(", ")}.`);
      }
      if (f && c.type === "LassoBarChart") {
        // Hele rækken, så modellen kan kommentere udviklingen (og værter uden grafik kan vise den).
        const { metric, points } = chartSeries(f, c.metric, c.years);
        if (points.length) {
          const kind = METRIC_KIND[metric];
          const scale = kind === "amount" ? amountScale(points.map((p) => p.value), currencyUnit(f.currency)) : null;
          const unit = scale ? ` (${scale.label})` : "";
          const val = (v: number) => (kind === "percent" ? formatPercent(v, false) : scale ? formatScaled(v, scale) : formatNumber(v));
          lines.push(
            `${METRIC_LABELS[metric]} ${points[0]!.year}–${points.at(-1)!.year}${unit}: ${points.map((p) => `${p.year} ${val(p.value)}`).join(", ")}.`,
          );
        }
      }
    }
    if (c.type === "LassoCreditRating") {
      // Creditsafes skala A–E; nævnes aldrig sammen med Lassos 0–100-score.
      const r = ds.creditRatings?.[c.company];
      if (r) lines.push(`Kreditvurdering (Creditsafe): ${creditRatingText(r)}.`);
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
    if (c.type === "LassoOwnershipDiagram" && c.person) {
      // Katalog 16: personens ejerskaber (personen er roden).
      const g = ds.ownershipGraphs[ownershipGraphKey(c)];
      if (g) {
        const name = (id: string) => g.nodes.find((n) => n.id === id)?.name ?? id;
        const owned = g.edges.filter((e) => e.from === g.rootId && !e.until).map((e) => `${name(e.to)}${e.share ? ` ${formatShare(e.share)}` : ""}`);
        const below = g.edges.filter((e) => e.from !== g.rootId && !e.until).length;
        lines.push(`Ejerskab: ${owned.length ? `ejer direkte ${owned.slice(0, 6).join(", ")}` : "ejer ingen selskaber i CVR"}${below ? `; de ejede selskaber ejer ${below} ${below === 1 ? "selskab" : "selskaber"} mere` : ""}.`);
        if (g.note) lines.push(g.note);
      }
    } else if (c.type === "LassoOwnershipDiagram") {
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
    if (c.type === "LassoPersonHead") {
      const p = ds.persons[c.person];
      if (p) {
        const n = personCounts(p);
        lines.push(`Person: ${p.name} (Lasso-ID ${p.lassoId})${p.city ? `, ${p.city}` : ""}: ${n.activeRoles} aktive roller i ${n.activeCompanies} selskaber, ${n.endedRoles} ophørte${n.firstYear ? `, første registrering ${n.firstYear}` : ""}.`);
      }
    }
    if (c.type === "LassoPersonRoles") {
      const p = ds.persons[c.person];
      const show = c.show ?? "all";
      if (p && show === "all") {
        const list = personCompanies(p).slice(0, 8).map((x) => `${x.companyName} [${x.companyId ?? "?"}]: ${x.roles.map((r) => `${r.role}${r.share ? ` ${r.share}` : ""}${r.active ? "" : " (fratrådt)"}`).join(", ")}`);
        if (list.length) lines.push(`Roller: ${list.join("; ")}.`);
      } else if (p && show !== "all") {
        // Rollelisterne (overblik: aktive; ejerskab: ejede selskaber; risiko: øvrige ophørte).
        const rows = personRoleRows(p, show, { except: c.except });
        const label = c.title ?? { current: "Aktive roller", ended: "Ophørte roller", owner: "Ejerskaber" }[show];
        const list = rows.slice(0, 8).map((r) => `${r.companyName} [${r.companyId ?? "?"}]: ${r.text}${r.period ? `, ${r.period}` : ""}${r.companyStatus ? ` (selskabet ${r.companyStatus.toLowerCase()})` : ""}`);
        lines.push(`${label}: ${list.length ? `${list.join("; ")}${rows.length > 8 ? `; og ${rows.length - 8} flere` : ""}` : show === "owner" ? "ejer ingen selskaber i CVR" : "ingen"}.`);
      }
    }
    if (c.type === "LassoPersonNetwork") {
      const net = ds.personNetworks[c.person];
      // "år sammen" er den længste sammenhængende periode i fælles selskaber, ikke summen.
      const n = Math.max(5, c.limit ?? 0);
      if (net?.people.length) {
        lines.push(
          `Netværk (år sammen = længste sammenhængende periode): ${net.people
            .slice(0, n)
            .map((x) => `${x.name} (${x.overlapYears} år, ${x.companies.length} fælles selskaber${x.active ? "" : ", afsluttet"})`)
            .join(", ")}${net.people.length > n ? `, og ${net.people.length - n} flere` : ""}.`,
        );
      } else if (net) lines.push("Netværk: personen sidder ikke sammen med andre i registrerede selskaber.");
    }
    if (c.type === "LassoPersonFacts") {
      const p = ds.persons[c.person];
      if (p) {
        const f = personFacts(p);
        const home = p.addressProtected ? "adressebeskyttet" : [[p.zip, p.city].filter(Boolean).join(" "), p.municipality && `${p.municipality} Kommune`, p.country].filter(Boolean).join(", ");
        const facts = [
          home && `bopæl ${home}`,
          `ejer ${f.ownedCompanies} ${f.ownedCompanies === 1 ? "selskab" : "selskaber"}`,
          f.firstRegistered && `første registrering ${f.firstRegistered.slice(0, 4)}`,
          f.latestChange && `seneste rolleskift ${formatDate(f.latestChange)}`,
        ].filter(Boolean);
        lines.push(`Stamoplysninger: ${facts.join("; ")}.`);
      }
    }
    if (c.type === "LassoTimeline" && c.person) {
      // Som på siden: de seneste `limit` (overblikket 3, ellers 5); på risiko kun forløbet i konkursselskaberne.
      const all = ds.timeline[c.person];
      const p = ds.persons[c.person];
      const events = (c.filter === "risiko" && all && p ? riskTimeline(all, p) : all)?.events ?? [];
      const n = Math.min(c.limit ?? 5, events.length);
      const label = c.filter === "risiko" ? "Forløb i selskaberne med konkurs eller tvangsopløsning" : "Historik";
      if (events.length) lines.push(`${label} (seneste ${n} af ${events.length}): ${events.slice(0, n).map((e) => `${formatDate(e.date)} ${e.title}`).join("; ")}.`);
    }
    if (c.type === "LassoNews" && c.person) {
      const items = ds.news[c.person]?.items ?? [];
      const n = Math.min(c.limit, items.length);
      if (items.length) lines.push(`Nyheder om personen (seneste ${n}): ${items.slice(0, n).map((x) => `${x.time ? `${formatDate(x.time)} ` : ""}${x.headline} (${x.source})`).join("; ")}.`);
    }
    if (c.type === "LassoPersonRisk") {
      const p = ds.persons[c.person];
      if (p) {
        const r = personRisk(p);
        const cases = [...r.bankruptcies, ...r.dissolutions].map((x) => `${x.companyName} ${x.status.toLowerCase()}${x.personLeft ? `, personen fratrådt ${x.personLeft.slice(0, 4)}` : ", personen har stadig en rolle"}`);
        lines.push(`Risiko: ${r.bankruptcies.length} konkurser og ${r.dissolutions.length} tvangsopløsninger blandt personens selskaber${cases.length ? ` (${cases.join("; ")})` : ""}.`);
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
    if (c.type === "LassoProductionUnits") {
      const pu = ds.productionUnits[c.company];
      if (pu?.units.length) {
        const active = pu.units.filter((u) => u.statusKind !== "inactive").length;
        lines.push(`Produktionsenheder: ${pu.units.length} i alt, ${active} aktive.`);
      }
    }
    if (c.type === "LassoProperties") {
      const pr = ds.properties[c.company];
      if (pr?.properties.length) {
        const buildings = pr.properties.reduce((sum, p) => sum + p.buildings.length, 0);
        lines.push(`Ejendomme: ${pr.properties.length}, i alt ${buildings} bygninger.`);
      }
    }
    if (c.type === "LassoSavedPages") {
      // Gem-laget: brugerens egne gemte sider, så modellen kan svare på "hvad har jeg gemt".
      const list = ds.savedPages[savedPagesKey(c)];
      if (list && list.pages.length === 0) lines.push("Gemte sider: ingen endnu.");
      if (list?.pages.length) {
        const named = list.pages.slice(0, 10).map((p) => {
          const what = p.kind === "company" ? `Virksomhed${p.cvr ? `, CVR ${p.cvr}` : ""}` : `Person, ${p.lassoId}`;
          const note = p.note ? `, note "${p.note.length > 80 ? `${p.note.slice(0, 79)}…` : p.note}"` : "";
          return `${p.name} (${what}, gemt ${formatDate(p.savedAt)}${note})`;
        });
        const rest = list.total - named.length;
        lines.push(`Gemte sider (${list.total} i alt, viser ${list.pages.length}): ${named.join(", ")}${rest > 0 ? ` … og ${rest} til` : ""}.`);
      }
    }
    if (c.type === "LassoLivestock") {
      const lv = ds.livestock[c.company];
      if (lv?.chrNumber) lines.push(`CHR ${lv.chrNumber}: ${lv.herds.length} besætninger${lv.healthStatus ? `, sundhedsstatus ${lv.healthStatus}` : ""}.`);
    }
  }

  const errors = Object.entries(ds.errors);
  if (errors.length) lines.push(`Fejl: ${errors.slice(0, 3).map(([k, v]) => `${k.split(":")[0]}: ${v}`).join("; ")}.`);
  // Hvornår tekstkortet vises, står ét sted: serverinstruktionerne (review P1-6).
  lines.push("Tekstkortet er kun til værter uden Lasso-visning (se instruktionerne). Svar kort og gentag ikke tallene som tabel.");
  return lines.join("\n");
}
