// Analyserer widths-realistic.json (A13) og skriver docs/bredde-maaling.md + forslagene tilbage i JSON'en.
//   npx tsx tools/gallery/measure/report-realistic.ts
// Ændrer hverken GRID_RULES eller registeret; forslagene er kun input til B8.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { COMPONENT_CATALOG, GRID_RULES, GRID_WIDTH_LABEL, contentMinWidth, gridRuleOf, type WidthProfile, type Width } from "@lasso/spec";

const here = dirname(fileURLToPath(import.meta.url));
const jsonPath = join(here, "widths-realistic.json");
const mdPath = join(here, "../../../docs/bredde-maaling.md");
const data = JSON.parse(readFileSync(jsonPath, "utf8")) as { cellWidths: Record<string, number>; generated: string; types: Record<string, TypeRes> };

const W = ["quarter", "third", "half", "two-thirds", "three-quarters", "full"] as const;
type WName = (typeof W)[number];
const idx = (w: string) => W.indexOf(w as WName);
const label = (w: string) => GRID_WIDTH_LABEL[w as Width] ?? w;

interface M {
  h: number;
  w: number;
  truncated: number;
  truncatedSample: string[];
  hscroll: number;
  hscrollNeed: number;
  clipped: number;
  overlaps: number;
  overlapSample: string[];
  emptyPct: number;
  gapPct: number;
  p75EmptyPct: number;
  coverEmptyPct: number;
  rightEmptyPct: number;
  textBoxes: number;
  error?: string;
}
interface TypeRes {
  type: string;
  variant?: string;
  drivers: { rowsPerItem?: number; timeAxis?: boolean; series?: number; longestLabel?: number; bars?: boolean };
  errors: string[];
  widths: Record<string, M>;
  analysis?: unknown;
}

/** Tærsklerne fra opgaven (A13). */
const EMPTY_LIMIT = 40;

const expectedW = Object.fromEntries(W.map((w) => [w, [...Object.values(data.types)].map((t) => t.widths[w]!.w).sort((a, b) => a - b)[Math.floor(Object.keys(data.types).length / 2)]!]));
const honored = (r: TypeRes, w: string) => Math.abs(r.widths[w]!.w - expectedW[w]!) <= 3;
const registerOf = new Map(COMPONENT_CATALOG.map((e) => [e.type as string, e.register]));

/** Et mål er "rent", når det ikke er værre end i fuld bredde (nogle typer afkorter ved design, fx lange etiketter i et fast felt). */
function clean(m: M, base: M): boolean {
  return m.truncated <= base.truncated && m.overlaps <= base.overlaps && m.clipped <= base.clipped && m.hscroll <= base.hscroll ;
}

interface Analysis {
  cur: { std: string; min: string; max: string; profile: string };
  proposed: { std: string; min: string; max: string; profile: string };
  profileVerdict: "bekræftet" | "foreslået ændret";
  contentMin: string;
  reasons: string[];
  flags: { issuesAtMin: boolean; emptyAtMax: number; emptyCoverAtMax: number; issuesInHalf: boolean };
}

function analyse(_name: string, r: TypeRes): Analysis {
  const rule = gridRuleOf(r.variant ? { type: r.type as never, variant: r.variant } : { type: r.type as never });
  const reg = registerOf.get(r.type);
  const profile: WidthProfile = reg?.bredde.profil ?? "fleksibel";
  const wd = r.widths as Record<WName, M>;
  const full = wd.full;
  const okW = (w: WName) => honored(r, w) && clean(wd[w], full);
  const reasons: string[] = [];
  const fixed = rule.min === rule.max;

  // min = smalleste bredde uden afkortning/overlap, hvor alle bredere også er rene (relativt til fuld bredde).
  let newMin: WName = "full";
  for (let i = W.length - 1; i >= 0; i--) {
    if (okW(W[i]!)) newMin = W[i]!;
    else break;
  }
  if (full.truncated > 0 || full.overlaps > 0) reasons.push(`Også i fuld bredde er der ${full.truncated} afkortede felter og ${full.overlaps} overlap (afkortning er en del af designet, fx linje-klip af uddrag); min måles derfor relativt til fuld bredde.`);
  const fullScroll = full.hscroll > 0;
  if (fullScroll) reasons.push(`KRÆVER KOMPONENTÆNDRING: indholdet kræver ${full.hscrollNeed} px og ruller vandret selv i fuld bredde (${full.w} px); bredde alene løser det ikke (færre/smallere kolonner, afkortede kolonnenavne eller færre poster).`);

  // Sænk aldrig min under den nuværende, hvis højden vokser mere end 25 % (min er også sat af højden, se catalog.ts).
  const curMin = rule.min as WName;
  if (idx(newMin) < idx(curMin)) {
    const hMin = wd[curMin].h;
    const okLower = W.filter((w) => idx(w) >= idx(newMin) && idx(w) < idx(curMin) && wd[w].h <= hMin * 1.25);
    const lowered = okLower.length ? okLower[0]! : curMin;
    if (lowered !== newMin) reasons.push(`Ren helt ned til ${label(newMin)}, men højden er da ${wd[newMin].h} px mod ${hMin} px i ${label(curMin)} (${(wd[newMin].h / hMin).toFixed(1)}×); min sænkes kun til ${label(lowered)}.`);
    newMin = lowered;
  }
  const halfDirty = !okW("half") || fullScroll;
  const tailW = ["two-thirds", "three-quarters", "full"] as const;
  const tailWide = Math.max(...tailW.map((w) => wd[w].emptyPct));
  // Forslag om smal på tom-plads-grundlag kræver > 40 % i alle bredder fra ⅔ og ≥ 50 % i fuld bredde; tidsbånd (bjælker, der først starter, hvor perioden begynder) undtaget.
  const tailMin = r.drivers.bars ? 0 : wd.full.emptyPct >= 50 ? Math.min(...tailW.map((w) => wd[w].emptyPct)) : 0;
  const issuesAtMin = !okW(rule.min as WName);

  // profil (afgøres af målingerne, ikke af den nuværende profil)
  let newProfile: WidthProfile = profile;
  if (fullScroll && !fixed) {
    newProfile = "bred";
    newMin = rule.min as WName;
    reasons.push(`Bred: kan ikke gøres ren i nogen bredde; min og max fastholdes indtil komponenten er ændret.`);
  } else if (fixed) {
    reasons.push(`Fast bredde (min = max = ${label(rule.min)}); ingen forslag.`);
  } else if (profile === "smal") {
    if (halfDirty) {
      newProfile = "bred";
      reasons.push(`Smal-profil, men afkortning/overlap i ½ (${wd.half.truncated} afkortet, ${wd.half.overlaps} overlap): kræver mindst ${label(newMin)}; bred.`);
    } else if (tailWide <= EMPTY_LIMIT) {
      newProfile = "fleksibel";
      reasons.push(`Smal-profil, men kun ${tailWide} % tom plads i ⅔+: kan strækkes; fleksibel.`);
    } else reasons.push(`Smal bekræftet: ren i ½; tom plads i ⅔+ er ${tailWide} %.`);
  } else if (profile === "bred") {
    if (idx(newMin) >= idx("two-thirds")) reasons.push(`Bred bekræftet: afkortning/overlap i ½ (${wd.half.truncated} afkortet, ${wd.half.overlaps} overlap${wd.half.hscroll > full.hscroll ? ", vandret rulning" : ""}); ren først fra ${label(newMin)}.`);
    else if (tailMin > EMPTY_LIMIT) {
      newProfile = "smal";
      reasons.push(`Bred-profil, men ren helt ned til ${label(newMin)}, og der er mindst ${tailMin} % tom plads i alle bredder fra ⅔ og op: smal.`);
    } else {
      newProfile = "fleksibel";
      reasons.push(`Bred-profil, men ren helt ned til ${label(newMin)} med ${r.drivers.timeAxis ? "10 år på tidsaksen" : "det realistiske indhold"}: målingen bærer ikke min ≥ ⅔; fleksibel.`);
    }
  } else if (halfDirty && idx(newMin) >= idx("two-thirds")) {
    newProfile = "bred";
    reasons.push(`Fleksibel, men afkortning/overlap i ½ (${wd.half.truncated} afkortet, ${wd.half.overlaps} overlap); ren først fra ${label(newMin)}: bred.`);
  } else if (!halfDirty && tailMin > EMPTY_LIMIT) {
    newProfile = "smal";
    reasons.push(`Fleksibel, men mindst ${tailMin} % tom plads i alle bredder fra ⅔ og op, og ren i ½: smal.`);
  } else reasons.push(`Fleksibel bekræftet: ren fra ${label(newMin)}; tom plads i ⅔+ er ${tailWide} %.`);

  // max og std (efter den foreslåede profil)
  let newMax: string = rule.max;
  let newStd: string = rule.std;
  if (!fixed) {
    if (newProfile === "smal") {
      if (idx(rule.max) > idx("half")) {
        newMax = "half";
        reasons.push(`Smal profil: max ≤ ½ (tom plads ${tailWide} % i ⅔+).`);
      }
    } else if (!fullScroll && wd[rule.max as WName] && wd[rule.max as WName].emptyPct > EMPTY_LIMIT) {
      const better = [...W].filter((w) => idx(w) < idx(rule.max)).reverse().find((w) => wd[w].emptyPct <= EMPTY_LIMIT);
      if (better) {
        newMax = better;
        reasons.push(`${wd[rule.max as WName].emptyPct} % tom plads  i ${label(rule.max)}; max sænkes til ${label(better)} (${wd[better].emptyPct} %).`);
      } else reasons.push(`${wd[rule.max as WName].emptyPct} % tom plads i ${label(rule.max)}, men ingen smallere bredde er under ${EMPTY_LIMIT} %; max beholdes.`);
    }
    if (idx(newMax) < idx(newMin)) newMax = newMin;
    if (idx(newMin) < idx(rule.min) && !issuesAtMin) reasons.push(`Målt ren allerede i ${label(newMin)}; nuværende min (${label(rule.min)}) er strammere end nødvendigt (min ændres kun, hvis B8 vil bruge det).`);
    if (issuesAtMin) reasons.push(`Nuværende min (${label(rule.min)}) har afkortning/overlap/klipning (${wd[rule.min as WName].truncated} afkortet, ${wd[rule.min as WName].overlaps} overlap, ${wd[rule.min as WName].clipped} klippet); ren fra ${label(newMin)}.`);
    if (newProfile === "smal") {
      // std: højst den nuværende std (aldrig bredere), i [min, max], og højst 40 % tom plads.
      const cands = W.filter((w) => idx(w) >= idx(newMin) && idx(w) <= idx(newMax) && idx(w) <= idx(rule.std) && wd[w].emptyPct <= EMPTY_LIMIT);
      newStd = cands.length ? cands[cands.length - 1]! : newMin;
      // aldrig smallere end ⅓, medmindre den nuværende std allerede er smallere (¼ er kun for målere og små nøgleblokke)
      const floor: WName = idx(rule.std) < idx("third") ? (rule.std as WName) : "third";
      if (idx(newStd) < idx(floor) && idx(floor) <= idx(newMax)) newStd = floor;
    } else {
      if (idx(newStd) < idx(newMin)) newStd = newMin;
      if (idx(newStd) > idx(newMax)) newStd = newMax;
    }
  } else newMin = rule.min as WName;
  if (fixed) newMax = rule.max;
  const cMin = contentMinWidth(profile, rule.min, { ...(r.drivers.rowsPerItem ? { rowsPerItem: r.drivers.rowsPerItem } : {}), ...(r.drivers.longestLabel ? { longestLabel: r.drivers.longestLabel } : {}), ...(r.drivers.timeAxis ? { timeAxis: true } : {}), ...(r.drivers.series ? { series: r.drivers.series } : {}) });
  if (idx(cMin) !== idx(newMin) && !fixed) reasons.push(`contentMinWidth (${profile}, nuværende drivere) giver ${label(cMin)}, målingen giver ${label(newMin)}.`);
  return {
    cur: { std: rule.std, min: rule.min, max: rule.max, profile },
    proposed: { std: newStd, min: fixed ? rule.min : newMin, max: newMax, profile: newProfile },
    profileVerdict: newProfile === profile ? "bekræftet" : "foreslået ændret",
    contentMin: cMin,
    reasons,
    flags: { issuesAtMin, emptyAtMax: wd[rule.max as WName]?.emptyPct ?? 0, emptyCoverAtMax: wd[rule.max as WName]?.coverEmptyPct ?? 0, issuesInHalf: halfDirty },
  };
}

const names = Object.keys(data.types);
const A = new Map<string, Analysis>();
for (const n of names) {
  const a = analyse(n, data.types[n]!);
  A.set(n, a);
  data.types[n]!.analysis = a;
}
writeFileSync(jsonPath, JSON.stringify(data, null, 1));

/* ---------- markdown ---------- */
const L = (w: string) => label(w);
const cellTxt = (m: M | undefined, allowed: boolean): string => {
  if (!m || m.error) return "fejl";
  const t = `${m.h} / ${m.truncated} / ${m.overlaps} / ${m.emptyPct}%`;
  return allowed ? t : `*${t}*`;
};
const md: string[] = [];
md.push("# Bredde-måling med realistiske data (A13, Ø13)", "");
md.push(`Målt ${data.generated} med \`tools/gallery/measure/measure-realistic.mjs\` (Playwright, Chromium, 1200-viewport, 12-kolonne-gitter). Data: \`tools/gallery/measure/realistic.ts\`. Rå tal: \`tools/gallery/measure/widths-realistic.json\`. Forslagene ændrer hverken GRID_RULES eller registeret; de er input til B8. Kør igen: 'npx tsx tools/gallery/measure-realistic-build.ts <mappe>', 'node tools/gallery/measure/measure-realistic.mjs <mappe>' (kræver 'PLAYWRIGHT_MODULE', hvis 'playwright' ikke kan importeres), 'npx tsx tools/gallery/measure/report-realistic.ts'.`, "");
md.push("## Sådan er der målt", "");
md.push(
  "- **Realistisk datasæt** (`realistic.ts`): selskabsnavne på 35–45 tegn (fx \"Nordjysk Entreprenør- og Ejendomsselskab ApS\"), personnavne på 25–35 tegn, PersonNetwork med 6 personer à 3 fælles selskaber (3 rækker pr. person) fra 2011 til 2026, 10 år på alle tidsakser og regnskaber, tal i mia./mio. (omsætning ca. 1,5 mia. kr.), 5–12 rækker i lister, 6 virksomheder i CompareTable og Ranking, 10 rækker i tabeller. Demodataens form er genbrugt (DemoProvider + resolveSpec), så komponenterne tager imod det uden ændrede props.",
  "- **Bredder**: elementet står alene i sit bånd sammen med et skjult fyldelement (ellers bliver det fuld bredde, 23.1), i dashboard-layout, så cellen har samme container som på en rigtig side. Cellebredder i px: " +
    Object.entries(data.cellWidths)
      .map(([k, v]) => `${L(k)} = ${v}`)
      .join(", ") +
    ` (målt i båndet: ¼ = ${expectedW.quarter}, ⅓ = ${expectedW.third}, ½ = ${expectedW.half}, ⅔ = ${expectedW["two-thirds"]}, ¾ = ${expectedW["three-quarters"]}, 1/1 = ${expectedW.full}; bånd har 20 px mellemrum, derfor er bredderne lidt over gitterets 24 px-mellemrum).`,
  "- **Højde (px)**: elementets højde i cellen.",
  "- **Afkortninger**: antal elementer med aktiv `text-overflow: ellipsis` (scrollWidth > clientWidth) eller aktiv linje-klipning (line-clamp).",
  "- **Overlap**: antal par af tekstbokse (fra hver tekstnodes linjerektangler) fra forskellige elementer, hvis overlap er over 8 px², fx årstal på en tidsakse.",
  "- **Tom plads (%)**: indholdet (tekstbokse, figurer, fyldte bjælker og tabelceller) grupperes i rækker (10 px-bånd). Tre mål pr. bredde: (a0) **bredeste række** (opgavens definition): 100 % minus samlet indholdsbredde i den mest dækkede række / cellens bredde; (a) **de bredeste rækker**: det samme for 75-percentilen af rækkerne (en enkelt lang kapitaltekst i en nøgle/værdi-liste gør ellers en tom liste \"fuld\"); (b) **typisk række**: medianen over rækkerne af rækkens største sammenhængende tomme stykke (også til højre for det yderste indhold). (a) overvurderer tomhed i jævnt fordelte kort, (b) tæller tid før en tidsakses bjælke som tom; derfor er **tom plads = det mindste af (a) og (b)**, og det er tallet i tabellerne og det, reglerne bruger (smal: max ≤ ½ hvis > 40 % i ⅔+). Alle mål og **til højre** (andel til højre for det yderste indhold) står i de enkelte typers tabeller og i JSON'en.",
  "- **Vandret rulning / klippet**: målt, men står kun i JSON'en og i tekstlinjerne, hvor det forekommer.",
  "",
);
md.push("Tabellernes format pr. bredde er `højde / afkortninger / overlap / tom plads %`. *Kursiv* = bredde uden for typens nuværende min-max (målt for at se, hvad der sker; det inkluderer ét trin under min).", "");

/* ---------- sammenfatning ---------- */
const fixedTypes = (n: string) => A.get(n)!.cur.min === A.get(n)!.cur.max;
const atMin = names
  .filter((n) => !fixedTypes(n))
  .map((n) => {
    const a = A.get(n)!;
    const r = data.types[n]!;
    const m = r.widths[a.cur.min]!;
    const f = r.widths.full!;
    // merforbrug i forhold til fuld bredde: det, der forsvinder ved at gøre elementet bredere
    const ex = { t: Math.max(0, m.truncated - f.truncated), o: Math.max(0, m.overlaps - f.overlaps), c: Math.max(0, m.clipped - f.clipped), h: m.hscroll > f.hscroll ? 1 : 0 };
    return { n, min: a.cur.min, score: ex.t + ex.o + ex.c + ex.h * 5, m, ex };
  })
  .filter((x) => x.score > 0)
  .sort((x, y) => y.score - x.score);
const byDesign = names.filter((n) => !fixedTypes(n) && data.types[n]!.widths.full!.truncated > 0).map((n) => `${n} (${data.types[n]!.widths.full!.truncated})`);
const emptyAtMax = names
  .filter((n) => !fixedTypes(n))
  .map((n) => ({ n, max: A.get(n)!.cur.max, pct: data.types[n]!.widths[A.get(n)!.cur.max]!.emptyPct }))
  .filter((x) => x.pct > EMPTY_LIMIT)
  .sort((x, y) => y.pct - x.pct);
const profileChanges = names.filter((n) => A.get(n)!.profileVerdict !== "bekræftet");
md.push("## Sammenfatning", "");
md.push(`- **Målt**: ${names.length} rækker (${new Set(names.map((n) => data.types[n]!.type)).size} komponenttyper; regnskabslisten og PersonRoles' tre listevarianter har egne rækker), hver i alle seks bredder.`);
md.push(`- **Top 10 med afkortning/overlap/klipning/vandret rulning i deres nuværende min** (rangeret efter merforbrug i forhold til fuld bredde, uden fastbredde-typerne): ` + atMin.slice(0, 10).map((x) => `${x.n} (min ${L(x.min)}: ${x.m.truncated} afkortet, ${x.m.overlaps} overlap${x.m.clipped ? `, ${x.m.clipped} klippet` : ""}${x.m.hscroll ? ", vandret rulning" : ""})`).join("; ") + `. I alt ${atMin.length} typer har mere af det i deres min end i fuld bredde. Afkortning, der også står i fuld bredde (dvs. designet, fx linje-klip af forklaringer og uddrag), findes hos: ${byDesign.join(", ") || "ingen"}.`);
md.push(`- **Over ${EMPTY_LIMIT} % tom plads i deres max**: ` + (emptyAtMax.length ? emptyAtMax.map((x) => `${x.n} (${L(x.max)}: ${x.pct} %)`).join("; ") : "ingen") + ".");
md.push(`- **Profil bekræftet / foreslået ændret**: ${names.length - profileChanges.length} bekræftet, ${profileChanges.length} foreslået ændret: ` + profileChanges.map((n) => `${n} ${A.get(n)!.cur.profile} → ${A.get(n)!.proposed.profile}`).join("; ") + ".");
md.push("");
md.push("### Fund uden for tabellerne", "");
md.push(
  "- **Antal år er uden betydning.** Målt med både 10 og 6 år i flerårstabeller, regnskaber og branchetal (`REAL_YEARS`): højder og afkortning er identiske, fordi grafer viser de seneste 5 år, og regnskabsopgørelserne som standard viser 2 år + ændring. Tidsakserne i graferne får derfor aldrig 10 etiketter; det er PersonNetwork og PersonRoles (tidsbånd fra år til år), der har tidsakse-problemet.",
  "- **Sammenligningstabellen (CompareTable) med 6 virksomheder er ikke ren i nogen bredde.** Med 40–45 tegn lange selskabsnavne bliver hver kolonne 350–390 px, og tabellen kræver 2378 px og ruller vandret selv i fuld bredde (1150 px; navnekolonnen er 194 px, så kun 2 virksomheder passer uden rulning). Bredde alene løser det ikke: kolonnenavnene skal afkortes eller ombrydes, eller antallet af virksomheder begrænses. Min/max er derfor uændret, og typen er markeret \"kræver komponentændring\".",
  "- **PersonRoles har fire udseender med to profiler.** `show: all` er et tidsbånd (bred, rent fra ½), mens `show: current|ended|owner` er en liste (\"Aktive roller\"), der er over 40 % tom fra ⅔ og op. Registeret har én profil pr. type (bred); målingen bakker ejerens iagttagelse op og foreslår, at listevarianterne behandles som smal (max ½), mens tidsbåndet er fleksibelt fra ½. Det kræver, at B8 kan slå profilen op pr. variant (`show`), ligesom regnskabslisten allerede har sin egen række (`gridRuleOf`).",
  "- **Bekræftet fra ejerens eksempler (29.09):** \"Sidder sammen med\" (PersonNetwork) i ½: 8 afkortede selskabsnavne, tre rækker pr. person og overlap på årstallene i ⅓ og ¼; først i fuld bredde er den helt ren (i ¾ er stadig 4 navne afkortet). \"Aktive roller\" (PersonRoles current) er 64 % tom i fuld bredde og 26 % i ½. \"Stamoplysninger\" (PersonFacts) er 76 % tom i fuld bredde (max er ½, 51 %; min ¼ er ren).",
  "- **Pakkeren hæver for smalle bredder.** Announcements bliver fuld bredde, hvis den lægges i ¼ eller ⅓ (min ½), og de to hoveder er altid fuld bredde; disse celler står som \"hævet til 1/1\" i tabellen.",
  "",
);
md.push("### Forbehold ved målingen", "");
md.push(
  "- Afkortning/overlap/klipning/rulning vurderes **relativt til fuld bredde**: nogle typer afkorter selv i fuld bredde (fx linje-klip af uddrag og forklaringer); min er den smalleste bredde, hvor tallene ikke er værre end i fuld bredde, og hvor alle bredere også er rene.",
  "- min sænkes kun under den nuværende, hvis højden i den smallere bredde er højst 25 % højere end ved den nuværende min (min er også sat af højden, se `GridRule`); ellers er den foreslåede min uændret, og årsagen står i typens tekst.",
  "- Tom plads er en tilnærmelse (to mål, se ovenfor); den er brugbar til at finde lister og nøgle/værdi-blokke, der strækkes, men den kan overvurdere tomhed i kortgrid og undervurdere den i tabeller. Brug den som indikation og se billederne (`tools/gallery/shoot.mjs`) før en regel ændres.",
  "- Fyldelementet (skjult `LassoFollowUps`) står ved siden af målelementet i båndet. Uden det lægger pakkeren et element, der står alene i sit bånd, i fuld bredde (23.1). Fyldelementet skjules (højde 0) og påvirker hverken målelementets bredde eller højde; målingen viser bredden, som render_view med eksplicit `width` giver, ikke pakkerens egne valg.",
  "",
);

md.push("## Samlet tabel: type × bredde", "");
md.push(`| Type | std / min / max | profil | ${W.map(L).join(" | ")} |`);
md.push(`|---|---|---|${W.map(() => "---").join("|")}|`);
for (const n of names) {
  const r = data.types[n]!;
  const a = A.get(n)!;
  const rule = a.cur;
  const cells = W.map((w) => {
    const allowed = idx(w) >= idx(rule.min) - 1 && idx(w) <= idx(rule.max);
    const inRule = idx(w) >= idx(rule.min) && idx(w) <= idx(rule.max);
    const t = honored(r, w) ? cellTxt(r.widths[w], inRule) : `(hævet til 1/1 af pakkeren)`;
    return allowed ? t : "·";
  });
  md.push(`| ${n} | ${L(rule.std)} / ${L(rule.min)} / ${L(rule.max)} | ${rule.profile} | ${cells.join(" | ")} |`);
}
md.push("", "`·` = bredden ligger mere end ét trin under min og er ikke vist (målt i JSON'en).", "");

md.push("## Forslag pr. type (samlet)", "");
md.push("| Type | nu std / min / max | forslag std / min / max | profil nu | profil forslag | drivere (aflæst) |");
md.push("|---|---|---|---|---|---|");
const drv = (r: TypeRes) => {
  const d = r.drivers;
  const parts: string[] = [];
  if (d.rowsPerItem) parts.push(`rowsPerItem ${d.rowsPerItem}`);
  if (d.longestLabel) parts.push(`longestLabel ${d.longestLabel}`);
  if (d.timeAxis) parts.push("timeAxis");
  if (d.series) parts.push(`series ${d.series}`);
  return parts.join(", ") || "–";
};
for (const n of names) {
  const a = A.get(n)!;
  const ch = (x: string, y: string) => (x === y ? L(x) : `**${L(y)}**`);
  md.push(`| ${n} | ${L(a.cur.std)} / ${L(a.cur.min)} / ${L(a.cur.max)} | ${ch(a.cur.std, a.proposed.std)} / ${ch(a.cur.min, a.proposed.min)} / ${ch(a.cur.max, a.proposed.max)} | ${a.cur.profile} | ${a.profileVerdict === "bekræftet" ? "bekræftet" : `**${a.proposed.profile}**`} | ${drv(data.types[n]!)} |`);
}
md.push("");
md.push("## Pr. type", "");
for (const n of names) {
  const r = data.types[n]!;
  const a = A.get(n)!;
  md.push(`### ${n}`, "");
  md.push(`- Nuværende: std ${L(a.cur.std)}, min ${L(a.cur.min)}, max ${L(a.cur.max)}; profil **${a.cur.profile}**.`);
  md.push(`- Foreslået: std ${L(a.proposed.std)}, min ${L(a.proposed.min)}, max ${L(a.proposed.max)}; profil **${a.proposed.profile}** (${a.profileVerdict}).`);
  md.push(`- Drivere fra det realistiske datasæt: ${drv(r)}. \`contentMinWidth\` med disse drivere giver ${L(a.contentMin)}.`);
  for (const x of a.reasons) md.push(`- ${x}`);
  if (r.errors?.length) md.push(`- Datafejl ved opløsning: ${r.errors.join("; ")}`);
  md.push("", "| Bredde | px | højde | afkortet | overlap | klippet | v.rulning | tom plads (min af a og b) | (a0) bredeste række | (a) 75-pct. række | (b) typisk hul | til højre for indhold |", "|---|---|---|---|---|---|---|---|---|---|---|---|");
  for (const w of W) {
    const m = r.widths[w];
    if (!m || m.error) {
      md.push(`| ${L(w)} | – | fejl | | | | | | | | | |`);
      continue;
    }
    const inRule = idx(w) >= idx(a.cur.min) && idx(w) <= idx(a.cur.max);
    const tag = inRule ? "" : idx(w) === idx(a.cur.min) - 1 ? " (under min)" : " (uden for regel)";
    md.push(`| ${L(w)}${tag} | ${m.w} | ${m.h} | ${m.truncated} | ${m.overlaps} | ${m.clipped} | ${m.hscroll} | ${m.emptyPct} % | ${m.coverEmptyPct} % | ${m.p75EmptyPct} % | ${m.gapPct} % | ${m.rightEmptyPct} % |`);
  }
  const samples = W.flatMap((w) => [...(r.widths[w]?.truncatedSample ?? []).slice(0, 1).map((s) => `afkortet i ${L(w)}: "${s}"`), ...(r.widths[w]?.overlapSample ?? []).slice(0, 1).map((s) => `overlap i ${L(w)}: ${s}`)]);
  if (samples.length) md.push("", "Eksempler: " + samples.slice(0, 4).join("; ") + ".");
  md.push("");
}
writeFileSync(mdPath, md.join("\n"));
console.log(`skrev ${mdPath} (${names.length} typer)`);
void GRID_RULES;
