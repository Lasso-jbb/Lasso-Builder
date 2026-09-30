import type { Dataset } from "./models.js";

/**
 * Opfølgende spørgsmål under en virksomheds- eller personside (LassoFollowUps, Jakob 30.09): op til seks,
 * og hvert åbner noget andet end siden og de øvrige spørgsmål (ét pr. emne). De bygges af sidens fokus og
 * data: først et spørgsmål, der går dybere i det, siden viser, så de konkrete personer og selskaber på
 * siden (direktøren, ejerselskabet, personens største selskab), og til sidst de andre emner.
 * Knapteksten er selve spørgsmålet, kort; prompten er det fulde spørgsmål med navnet.
 */
export interface FollowUp {
  label: string;
  prompt: string;
}

interface Candidate extends FollowUp {
  /** Emnet, spørgsmålet åbner; to spørgsmål med samme emne vises aldrig sammen. */
  topic: string;
}

export const MAX_FOLLOW_UPS = 6;

/** Hentet og tom = nej; ikke hentet = ja (siden, spørgsmålet åbner, viser selv en tom tilstand). */
const some = (n: number | undefined) => n === undefined || n > 0;

function pick(cands: readonly (Candidate | undefined | false)[], skip: readonly string[]): FollowUp[] {
  const seen = new Set(skip);
  const out: FollowUp[] = [];
  for (const c of cands) {
    if (!c || seen.has(c.topic) || c.label.length > 60) continue;
    seen.add(c.topic);
    out.push({ label: c.label, prompt: c.prompt });
    if (out.length === MAX_FOLLOW_UPS) break;
  }
  return out;
}

/** "Anne Marie Eksempel Hansen" -> "Anne Hansen" (knapteksten skal være kort). */
function shortPerson(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length > 2 ? `${parts[0]} ${parts.at(-1)}` : name.trim();
}

export type CompanyFollowUpFocus = "overblik" | "oekonomi" | "regnskab" | "ejerskab" | "ledelse" | "risiko" | "historik" | "kontakt";

/**
 * Virksomhedens opfølgende spørgsmål. `name` er det korte navn (shortCompanyName), `short` forkorter
 * andre selskabers navne på samme måde.
 */
export function companyFollowUps(
  ds: Dataset,
  id: string,
  focus: CompanyFollowUpFocus,
  name: string,
  short: (n: string) => string = (n) => n,
  opts: { hasStatements?: boolean; /** Spørgsmålssider (show_company med question): altid en vej til hele siden først. */ whole?: boolean } = {},
): FollowUp[] {
  const fin = ds.financials[id] ? ds.financials[id]!.years.length : undefined;
  const owners = ds.ownership[id]?.owners;
  const people = ds.people[id];
  const current = (people ?? []).filter((p) => !p.to);
  const director = current.find((p) => /direkt/i.test(p.role));
  const ownerCo = (owners ?? []).find((o) => o.kind === "company");
  const n = (s: string) => s.replace(/\{navn\}/g, name);

  const deeper: Record<CompanyFollowUpFocus, Candidate | undefined> = {
    overblik: undefined,
    oekonomi: { topic: "regnskab", label: "Hvad står der i hele regnskabet?", prompt: n("Vis resultatopgørelse og balance for {navn}.") },
    regnskab: fin !== 0 && opts.hasStatements !== false ? { topic: "udvikling", label: "Hvordan har økonomien udviklet sig over årene?", prompt: n("Hvordan har omsætning, resultat og egenkapital i {navn} udviklet sig de seneste 5 år?") } : undefined,
    ejerskab: { topic: "koncern", label: "Hvordan ser koncernen ud?", prompt: n("Vis ejerstrukturen og koncernen omkring {navn}.") },
    ledelse: { topic: "udskiftning", label: "Hvem er kommet til eller gået af?", prompt: n("Hvilke udskiftninger har der været i direktion og bestyrelse i {navn} de seneste år?") },
    risiko: { topic: "kredit", label: "Hvad er kreditvurderingen?", prompt: n("Hvad er kreditvurderingen af {navn} hos Creditsafe?") },
    historik: { topic: "nyheder", label: "Hvad skriver medierne?", prompt: n("Hvilke nyheder er der om {navn}?") },
    kontakt: { topic: "kontaktpersoner", label: "Hvem kan jeg kontakte?", prompt: n("Hvem er kontaktpersonerne i {navn}, og hvordan fanger jeg dem?") },
  };

  // Sidens konkrete personer og selskaber: det næste naturlige klik er ofte videre til dem.
  const directorQ: Candidate | undefined = director
    ? { topic: "person", label: `Hvad laver ${shortPerson(director.name)} ellers?`, prompt: `Hvilke andre selskaber er ${director.name} involveret i?` }
    : undefined;
  const ownerQ: Candidate | undefined = ownerCo
    ? { topic: "ejerselskab", label: `Hvem står bag ${short(ownerCo.name)}?`, prompt: `Hvem ejer ${ownerCo.name}, og hvad laver selskabet?` }
    : undefined;

  const topics: Record<Exclude<CompanyFollowUpFocus, "regnskab">, Candidate | undefined> = {
    overblik: { topic: "overblik", label: "Giv mig det samlede overblik", prompt: n("Giv mig et overblik over {navn}.") },
    oekonomi: some(fin) ? { topic: "oekonomi", label: "Hvordan går det økonomisk?", prompt: n("Hvordan går det økonomisk for {navn}?") } : undefined,
    ejerskab: some(owners?.length) ? { topic: "ejerskab", label: "Hvem er de reelle ejere?", prompt: n("Hvem ejer {navn}, og hvem er de reelle ejere?") } : undefined,
    risiko: { topic: "risiko", label: "Er der røde flag?", prompt: n("Er der røde flag eller risikosignaler ved {navn}?") },
    ledelse: some(people?.length) ? { topic: "ledelse", label: "Hvem sidder i bestyrelsen?", prompt: n("Hvem sidder i direktionen og bestyrelsen i {navn}?") } : undefined,
    historik: { topic: "historik", label: "Hvad er der sket for nylig?", prompt: n("Hvad er der sket i {navn} det seneste år?") },
    kontakt: { topic: "kontakt", label: "Hvordan kontakter jeg dem?", prompt: n("Hvad er kontaktoplysningerne på {navn}?") },
  };
  // Emnernes rækkefølge pr. fokus: det mest relevante næste emne først.
  const order: Record<CompanyFollowUpFocus, (keyof typeof topics)[]> = {
    overblik: ["oekonomi", "ejerskab", "risiko", "historik", "ledelse", "kontakt"],
    oekonomi: ["risiko", "ejerskab", "ledelse", "historik", "overblik"],
    regnskab: ["oekonomi", "risiko", "ejerskab", "ledelse", "overblik"],
    ejerskab: ["ledelse", "oekonomi", "risiko", "historik", "overblik"],
    ledelse: ["ejerskab", "oekonomi", "historik", "risiko", "overblik"],
    risiko: ["oekonomi", "ejerskab", "ledelse", "historik", "overblik"],
    historik: ["oekonomi", "ledelse", "ejerskab", "risiko", "overblik"],
    kontakt: ["ledelse", "oekonomi", "ejerskab", "risiko", "overblik"],
  };
  const own = focus === "regnskab" ? "oekonomi" : focus;
  if (opts.whole) {
    // Spørgsmålssiden viser kun svaret: først vejen til hele siden (økonomi for økonomispørgsmål, ellers overblikket).
    const whole: Candidate = focus === "oekonomi" ? { topic: "oekonomi", label: "Vis hele økonomien", prompt: n("Hvordan går det økonomisk for {navn}?") } : { ...topics.overblik!, label: "Vis hele overblikket" };
    return pick([whole, deeper[focus], directorQ, ownerQ, ...order[focus].map((t) => topics[t])], focus === "overblik" || focus === "oekonomi" ? [] : [own]);
  }
  return pick([deeper[focus], directorQ, ownerQ, ...order[focus].map((t) => topics[t])], [own]);
}

export type PersonFollowUpFocus = "overblik" | "roller" | "netvaerk" | "ejerskab" | "risiko" | "historik";

/** Personens opfølgende spørgsmål: emnerne på personsiden og de selskaber, personen er aktiv i. */
export function personFollowUps(ds: Dataset, id: string, focus: PersonFollowUpFocus, name: string, short: (n: string) => string = (n) => n, opts: { whole?: boolean; /** Personen har et netværk (hentet og ikke tomt); udeladt = ukendt, altså med. */ network?: boolean } = {}): FollowUp[] {
  const person = ds.persons[id];
  const roles = person?.roles ?? [];
  const active = roles.filter((r) => r.active);
  const n = (s: string) => s.replace(/\{navn\}/g, name);
  const first = name.trim().split(/\s+/)[0] ?? name;
  // Det selskab, personen er mest knyttet til: direktør før bestyrelse før ejer, så det ældste.
  const rank = (r: (typeof roles)[number]) => (/direkt/i.test(r.role) ? 0 : r.kind === "owner" ? 2 : 1);
  const main = [...active].sort((a, b) => rank(a) - rank(b) || (a.from ?? "").localeCompare(b.from ?? ""))[0];
  const other = active.find((r) => r.companyName !== main?.companyName && r.kind !== "owner");
  const hasRoles = roles.length > 0;
  const owns = active.some((r) => r.kind === "owner");

  const deeper: Record<PersonFollowUpFocus, Candidate | undefined> = {
    overblik: undefined,
    roller: hasRoles ? { topic: "ophoerte", label: `Hvilke roller har ${first} haft før?`, prompt: n("Hvilke roller har {navn} haft tidligere, som er ophørt?") } : undefined,
    netvaerk: opts.network !== false ? { topic: "naermeste", label: `Hvem arbejder ${first} mest sammen med?`, prompt: n("Hvem sidder {navn} oftest sammen med i ledelser og bestyrelser?") } : undefined,
    ejerskab: owns ? { topic: "koncern", label: "Hvordan hænger selskaberne sammen?", prompt: n("Vis ejerstrukturen for de selskaber, {navn} ejer.") } : undefined,
    risiko: { topic: "konkurs", label: "Hvilke selskaber er gået konkurs?", prompt: n("Hvilke selskaber, {navn} har været i, er gået konkurs eller tvangsopløst?") },
    historik: { topic: "nyheder", label: `Hvad skriver medierne om ${first}?`, prompt: n("Hvilke nyheder er der om {navn}?") },
  };
  const companyQ: Candidate | undefined = main
    ? { topic: "selskab", label: `Hvordan går det i ${short(main.companyName)}?`, prompt: `Hvordan går det økonomisk for ${main.companyName}?` }
    : undefined;
  const otherQ: Candidate | undefined = other
    ? { topic: "selskab2", label: `Hvem ejer ${short(other.companyName)}?`, prompt: `Hvem ejer ${other.companyName}?` }
    : undefined;
  const topics: Record<PersonFollowUpFocus, Candidate | undefined> = {
    overblik: { topic: "overblik", label: `Hvem er ${first}?`, prompt: n("Hvem er {navn}?") },
    roller: hasRoles ? { topic: "roller", label: `Hvor sidder ${first} i bestyrelser?`, prompt: n("Hvilke roller har {navn} i selskaber?") } : undefined,
    netvaerk: hasRoles && opts.network !== false ? { topic: "netvaerk", label: `Hvem sidder ${first} sammen med?`, prompt: n("Hvem sidder {navn} sammen med i selskaber?") } : undefined,
    ejerskab: owns ? { topic: "ejerskab", label: `Hvilke selskaber ejer ${first}?`, prompt: n("Hvilke selskaber ejer {navn}?") } : undefined,
    // Personens risikosektion udgår (Jakob 30.09): intet spørgsmål peger derhen.
    risiko: undefined,
    historik: { topic: "historik", label: "Hvad er der sket for nylig?", prompt: n("Hvad er der sket med {navn} for nylig, og er der nyheder?") },
  };
  const order: Record<PersonFollowUpFocus, PersonFollowUpFocus[]> = {
    overblik: ["roller", "netvaerk", "ejerskab", "risiko", "historik"],
    roller: ["netvaerk", "ejerskab", "risiko", "historik", "overblik"],
    netvaerk: ["roller", "ejerskab", "risiko", "historik", "overblik"],
    ejerskab: ["roller", "netvaerk", "risiko", "historik", "overblik"],
    risiko: ["roller", "historik", "netvaerk", "ejerskab", "overblik"],
    historik: ["roller", "risiko", "netvaerk", "ejerskab", "overblik"],
  };
  if (opts.whole) return pick([{ ...topics.overblik!, label: "Vis hele personsiden" }, deeper[focus], companyQ, otherQ, ...order[focus].map((t) => topics[t])], []);
  return pick([deeper[focus], companyQ, otherQ, ...order[focus].map((t) => topics[t])], [focus]);
}
