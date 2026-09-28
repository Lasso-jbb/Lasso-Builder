import {
  companyAskTypes,
  creditRatingText,
  currencyUnit,
  effectiveMetric,
  formatAmount,
  formatDate,
  formatMetricValue,
  formatNumber,
  formatShare,
  hasNoStatements,
  mainMetric,
  METRIC_FIELD,
  METRIC_LABELS,
  ownershipGraphKey,
  PERSON_GRAPH_DEPTH,
  PERSON_LIST_ROLE_TITLES,
  PERSON_ROLE_FILTER_TITLES,
  peopleWithRole,
  personAskTypes,
  personCompanies,
  personRisk,
  personRoleRows,
  personTimeline,
  personWithRole,
  textSectionsFor,
  timelineOfKinds,
  type Ask,
  type Dataset,
  type Metric,
  type ViewComponent,
  type ViewSpec,
} from "@lasso/spec";

/**
 * Svaret på brugerens spørgsmål i én linje, til resuméets "Svar:" og tekstkortets SVAR-sektion:
 * de tal, personer eller oplysninger, spørgsmålet gælder, før resten af siden. Læses af de
 * spørgsmålstyper, spørgsmålet har (ask.ts) og af data, så svaret også står, når et svar-element er
 * tomt ("ingen registreret revisor"). null for et generelt spørgsmål.
 */
export function answerText(spec: ViewSpec, ds: Dataset, ask: Ask | undefined): string | null {
  if (!ask || ask.generic) return null;
  const parts = spec.kind === "person" ? personAnswer(spec, ds, ask) : companyAnswer(spec, ds, ask);
  const text = parts.filter(Boolean).join(" ");
  return text || null;
}

const sentence = (s: string) => (/[.!?]$/.test(s) ? s : `${s}.`);
const list = (items: readonly string[], max: number) => `${items.slice(0, max).join(", ")}${items.length > max ? ` og ${items.length - max} flere` : ""}`;

function first<T extends ViewComponent["type"]>(spec: ViewSpec, type: T): Extract<ViewComponent, { type: T }> | undefined {
  return spec.components.find((c) => c.type === type) as Extract<ViewComponent, { type: T }> | undefined;
}

function companyAnswer(spec: ViewSpec, ds: Dataset, ask: Ask): string[] {
  const id = spec.components.map((c) => ("company" in c && typeof c.company === "string" ? c.company : undefined)).find(Boolean);
  if (!id) return [];
  const co = ds.companies[id];
  const f = ds.financials[id];
  const years = f?.years ?? [];
  const has = (t: Ask["topics"][number]) => ask.topics.includes(t);
  const out: string[] = [];

  const numbers = (metrics: readonly Metric[]) => {
    if (!years.length) return sentence("Intet offentliggjort regnskab");
    const wanted = (metrics.length ? metrics : [mainMetric(years)]).map((m) => effectiveMetric(years, m)).filter((m, i, a) => a.indexOf(m) === i);
    const at = ask.year !== undefined ? years.findIndex((y) => y.year === ask.year) : years.length - 1;
    const i = at >= 0 ? at : years.length - 1;
    const span = ask.years ?? (ask.trend ? 10 : undefined);
    const phrases = wanted.slice(0, 4).map((m) => {
      const value = (k: number) => {
        const y = years[k];
        const v = y?.[METRIC_FIELD[m]] as number | null | undefined;
        return y ? `${formatMetricValue(m, v, y.currency ?? f?.currency)}` : "";
      };
      const y = years[i]!;
      const then: string[] = [];
      if (years[i - 1]) then.push(`${years[i - 1]!.year}: ${value(i - 1)}`);
      // Udviklingen: også det første år i perioden.
      if (span && i - span + 1 < i - 1) {
        const k = Math.max(0, i - span + 1);
        if (k < i - 1) then.push(`${years[k]!.year}: ${value(k)}`);
      }
      return `${METRIC_LABELS[m]} ${y.year}: ${value(i)}${then.length ? ` (${then.join("; ")})` : ""}`;
    });
    const missing = ask.year !== undefined && at < 0 ? ` Der er intet offentliggjort regnskab for ${ask.year}.` : "";
    return `${sentence(phrases.join("; "))}${missing}`;
  };

  for (const type of companyAskTypes(ask)) {
    switch (type) {
      case "noegletal":
      case "tabel":
        out.push(numbers(ask.metrics));
        break;
      case "ledelse": {
        const pl = first(spec, "LassoPersonList");
        const all = ds.people[id] ?? [];
        if (has("historik")) {
          const t = ds.timeline[id];
          const events = t ? timelineOfKinds(t, ["ledelse"]).events : [];
          out.push(sentence(`Ledelsesændringer: ${events.length ? list(events.map((e) => `${formatDate(e.date)} ${e.title}`), 3) : "ingen registreret"}`));
        }
        const roles = pl?.roles;
        const shown = peopleWithRole(all, roles).filter((p) => pl?.show === "all" || !p.to);
        const label = roles ? PERSON_LIST_ROLE_TITLES[roles] : "Ledelse";
        out.push(sentence(`${label}: ${shown.length ? list(shown.map((p) => `${p.name} (${p.role.toLowerCase()}${p.to ? `, fratrådt ${formatDate(p.to)}` : ""})`), 6) : "ingen registreret"}`));
        break;
      }
      case "ejerskab": {
        const o = ds.ownership[id];
        if (has("koncern")) {
          const g = ds.ownershipGraphs[ownershipGraphKey({ company: id, ingoingDepth: 3, outgoingDepth: 2 })];
          if (g) {
            const name = (x: string) => g.nodes.find((n) => n.id === x)?.name ?? x;
            const owners = g.edges.filter((e) => e.to === g.rootId && !e.until).map((e) => `${name(e.from)}${e.share ? ` ${formatShare(e.share)}` : ""}`);
            const subs = g.edges.filter((e) => e.from === g.rootId && !e.until).length;
            out.push(sentence(`Koncern: ${owners.length ? `ejes af ${list(owners, 4)}` : "ingen registrerede ejere"}; ${subs} ${subs === 1 ? "datterselskab" : "datterselskaber"}`));
          }
        }
        if (has("reelle-ejere")) {
          const b = ds.beneficialOwnership[id];
          out.push(sentence(`Reelle ejere: ${b?.owners.length ? list(b.owners.map((x) => `${x.name}${x.share ? ` ${x.share}` : ""}`), 4) : "ingen registreret"}`));
        }
        if (has("ejere") || !(has("koncern") || has("reelle-ejere"))) {
          out.push(sentence(`Ejere: ${o?.owners.length ? list(o.owners.map((x) => `${x.name}${x.share ? ` ${x.share}` : ""}`), 4) : "ingen registreret"}`));
        }
        break;
      }
      case "revisor": {
        const a = ds.ownership[id]?.auditor;
        out.push(sentence(`Revisor: ${a?.name ? `${a.name}${a.from ? `, siden ${formatDate(a.from)}` : ""}` : "ingen registreret revisor"}`));
        if (has("revisorskift")) {
          const ind = ds.auditorIndependence[id];
          if (ind) out.push(sentence(`Revisoruafhængighed: ${ind.relations.length ? `${ind.relations.length} ${ind.relations.length === 1 ? "relation" : "relationer"} at vurdere` : (ind.unavailableReason ?? "ingen kendte relationer").replace(/\.$/, "")}`));
        }
        break;
      }
      case "stamdata":
        for (const t of ask.topics) {
          if (t === "stiftet") out.push(sentence(`Stiftet: ${co?.founded ? formatDate(co.founded) : "ikke oplyst"}`));
          if (t === "status") out.push(sentence(`Status: ${co?.status ?? "ikke oplyst"}`));
          if (t === "branche") out.push(sentence(`Branche: ${co?.industryText ? `${co.industryText}${co.industryCode ? ` (${co.industryCode})` : ""}` : "ikke oplyst"}`));
          if (t === "formaal") {
            const s = textSectionsFor(ds.textSections[id]?.sections ?? [], "profil").find((x) => /formål/i.test(x.heading));
            out.push(sentence(`Formål: ${s ? (s.body.length > 200 ? `${s.body.slice(0, 199)}…` : s.body) : "ikke oplyst"}`));
          }
          if (t === "adresse") {
            const a = co?.address;
            out.push(sentence(`Adresse: ${a ? [a.street, [a.zip, a.city].filter(Boolean).join(" ")].filter(Boolean).join(", ") : "ikke oplyst"}`));
          }
        }
        break;
      case "kontakt": {
        const k = ds.contact[id];
        const phone = k?.phone ?? co?.phone;
        const email = k?.email ?? co?.email;
        const web = k?.website ?? co?.website;
        const bits = [phone && `tlf. ${phone}`, email && `e-mail ${email}`, web && `web ${web}`].filter(Boolean);
        if (ask.topics.some((t) => t === "telefon" || t === "email" || t === "web" || t === "adresse")) out.push(sentence(`Kontakt: ${bits.length ? bits.join(", ") : "ingen kontaktoplysninger"}`));
        if (has("kontaktpersoner")) {
          const cp = ds.contactPersons[id]?.people ?? [];
          out.push(sentence(`Kontaktpersoner: ${cp.length ? list(cp.map((p) => `${p.name}${p.role ? ` (${p.role})` : ""}`), 4) : "ingen fundet"}`));
        }
        break;
      }
      case "nyheder": {
        if (has("historik")) {
          const t = ds.timeline[id];
          const events = t ? timelineOfKinds(t, has("regnskab") ? ["regnskab"] : undefined).events : [];
          out.push(sentence(`Historik: ${events.length ? list(events.map((e) => `${formatDate(e.date)} ${e.title}`), 3) : "ingen registrerede begivenheder"}`));
        }
        if (has("nyheder") || !has("historik")) {
          const n = ds.news[id]?.items ?? [];
          out.push(sentence(`Nyheder: ${n.length ? list(n.map((x) => `${x.headline} (${x.source}${x.time ? `, ${formatDate(x.time)}` : ""})`), 3) : "ingen nyheder"}`));
        }
        break;
      }
      case "konkurs": {
        // Status fra hovedet; "siden" den seneste statusændring, når historikken har en.
        const t = ds.timeline[id];
        const since = t ? timelineOfKinds(t, ["status"]).events[0]?.date : undefined;
        out.push(sentence(`Status: ${co?.status ?? "ikke oplyst"}${co?.status && since ? ` siden ${formatDate(since)}` : ""}`));
        break;
      }
      case "kredit": {
        const r = ds.creditRatings?.[id];
        out.push(sentence(`Kreditvurdering: ${r ? creditRatingText(r) : "ikke hentet"}`));
        break;
      }
      case "score": {
        const s = ds.scores[id];
        out.push(sentence(`Score: ${s?.score != null ? `${Math.round(s.score)} af 100` : "ikke oplyst"}`));
        break;
      }
      case "regnskab": {
        const s = ds.financialStatements[id];
        if (!s || hasNoStatements(s)) {
          out.push(sentence("Regnskab: intet offentliggjort regnskab"));
          break;
        }
        const money = (v: number | null | undefined) => (v == null ? "—" : formatAmount(v, currencyUnit(s.currency)));
        const general = !has("resultatopgoerelse") && !has("balance") && !has("pengestroem");
        const inc = s.incomeStatement.at(-1);
        const bal = s.balanceSheet.at(-1);
        const cash = s.cashFlow.at(-1);
        if ((has("resultatopgoerelse") || general) && inc)
          out.push(sentence(`Resultatopgørelse ${inc.year}: ${inc.revenue != null ? `omsætning ${money(inc.revenue)}, ` : ""}bruttofortjeneste ${money(inc.grossProfit)}, EBITDA ${money(inc.ebitda)}, årets resultat ${money(inc.profit)}`));
        if ((has("balance") || general) && bal) out.push(sentence(`Balance ${bal.year}: aktiver i alt ${money(bal.assetsTotal)}, egenkapital ${money(bal.equityTotal)}, gæld i alt ${money(bal.liabilitiesTotal)}`));
        if (has("pengestroem")) {
          out.push(
            sentence(cash ? `Pengestrøm ${cash.year}: drift ${money(cash.operatingCashFlow)}, investering ${money(cash.investingCashFlow)}, finansiering ${money(cash.financingCashFlow)}` : "Pengestrøm: ikke indberettet"),
          );
        }
        break;
      }
      case "enheder": {
        if (has("enheder")) {
          const u = ds.productionUnits[id]?.units ?? [];
          out.push(sentence(`Produktionsenheder: ${u.length ? `${u.length}, heraf ${u.filter((x) => x.statusKind !== "inactive").length} aktive` : "ingen ud over hovedenheden"}`));
        }
        if (has("ejendomme")) {
          const p = ds.properties[id]?.properties ?? [];
          out.push(sentence(`Ejendomme: ${p.length ? `${p.length}, i alt ${formatNumber(p.reduce((n, x) => n + x.buildings.length, 0))} bygninger` : "ingen registreret"}`));
        }
        if (has("besaetning")) {
          const l = ds.livestock[id];
          out.push(sentence(`Besætning: ${l?.chrNumber ? `CHR ${l.chrNumber}, ${l.herds.length} besætninger` : (l?.unavailableReason ?? "ingen CHR-data").replace(/\.$/, "")}`));
        }
        break;
      }
    }
  }
  return out;
}

function personAnswer(spec: ViewSpec, ds: Dataset, ask: Ask): string[] {
  const id = spec.components.map((c) => ("person" in c && typeof c.person === "string" ? c.person : undefined)).find(Boolean);
  const p = id ? ds.persons[id] : undefined;
  if (!id || !p) return [];
  const has = (t: Ask["topics"][number]) => ask.topics.includes(t);
  const out: string[] = [];
  for (const type of personAskTypes(ask)) {
    switch (type) {
      case "roller": {
        const r = first(spec, "LassoPersonRoles");
        const role = r?.role;
        const who = personWithRole(p, role);
        const show = r?.show ?? "all";
        const label = role ? PERSON_ROLE_FILTER_TITLES[role] : "Roller";
        const rows =
          show === "all"
            ? personCompanies(who).map((c) => `${c.companyName} (${c.roles.map((x) => `${x.role.toLowerCase()}${x.active ? "" : ", ophørt"}`).join(", ")})`)
            : personRoleRows(who, show).map((x) => `${x.companyName} (${x.text.toLowerCase()}${x.period ? `, ${x.period}` : ""})`);
        out.push(sentence(`${label}${show === "ended" ? " (ophørte)" : ""}: ${rows.length ? list(rows, 6) : "ingen i CVR"}`));
        break;
      }
      case "konkurs": {
        const r = personRisk(p);
        const cases = [...r.bankruptcies, ...r.dissolutions].map((x) => `${x.companyName} ${x.status.toLowerCase()}${x.personLeft ? `, fratrådt ${x.personLeft.slice(0, 4)}` : ""}`);
        out.push(sentence(`Konkurser: ${r.bankruptcies.length}, tvangsopløsninger: ${r.dissolutions.length}${cases.length ? ` (${list(cases, 3)})` : ""}`));
        break;
      }
      case "netvaerk": {
        const n = ds.personNetworks[id]?.people ?? [];
        out.push(sentence(`Netværk: ${n.length ? list(n.map((x) => `${x.name} (${x.overlapYears} år)`), 5) : "sidder ikke sammen med andre i registrerede selskaber"}`));
        break;
      }
      case "nyheder": {
        if (has("historik")) {
          const events = (ds.timeline[id] ?? personTimeline(p)).events;
          out.push(sentence(`Historik: ${events.length ? list(events.map((e) => `${formatDate(e.date)} ${e.title}`), 3) : "ingen registrerede rolleskift"}`));
        }
        if (has("nyheder") || !has("historik")) {
          const n = ds.news[id]?.items ?? [];
          out.push(sentence(`Nyheder: ${n.length ? list(n.map((x) => `${x.headline} (${x.source})`), 3) : "ingen nyheder om personen"}`));
        }
        break;
      }
      case "bopael":
        out.push(sentence(`Bopæl: ${p.addressProtected ? "adressebeskyttet" : [[p.zip, p.city].filter(Boolean).join(" "), p.country].filter(Boolean).join(", ") || "ikke oplyst"}`));
        break;
      case "koncern": {
        const g = ds.ownershipGraphs[ownershipGraphKey({ person: id, ...PERSON_GRAPH_DEPTH })];
        if (!g) break;
        const name = (x: string) => g.nodes.find((n) => n.id === x)?.name ?? x;
        const owned = g.edges.filter((e) => e.from === id && !e.until).map((e) => `${name(e.to)}${e.share ? ` ${formatShare(e.share)}` : ""}`);
        const below = g.edges.filter((e) => e.from !== id && !e.until).length;
        out.push(sentence(`Ejerstruktur: ${owned.length ? `ejer ${list(owned, 4)}` : "ejer ingen selskaber i CVR"}${below ? `; de ejede selskaber ejer ${below} ${below === 1 ? "selskab" : "selskaber"}` : ""}`));
        break;
      }
    }
  }
  return out;
}
