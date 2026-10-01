import { foldText, parseAsk, withRelated } from "./ask.js";
import { METRIC_LABELS, viewSpecSchema, type Metric, type ViewSpec, type ViewSpecInput } from "./spec.js";

/**
 * compare_companies (docs/plan-d-vaerktoejer.md, D3): 2–10 navngivne virksomheder som én visning.
 * Komponenterne vælges efter spørgsmål og antal:
 *
 * - 2–3 virksomheder, flere nøgletal (standard): LassoCompareTable (≤ 5 nøgletal) + LassoLineChart for
 *   de to første på det første nøgletal (benchmark) + LassoFollowUps.
 * - `metric` angivet, eller spørgsmål med "hvem er størst/bedst/højest/lavest/flest/mindst":
 *   LassoRanking (alle, første fremhæves) + LassoCompareTable med ≤ 3 nøgletal.
 * - > 3 virksomheder uden `metric`: LassoRanking på omsætning (fallback bruttofortjeneste) +
 *   LassoCompareTable med de 3 største (se `COMPARE_TABLE_NOTE`).
 *
 * Ren funktion: data (navne og seneste tal) kommer ind som `options`, så den kan testes uden server.
 */

/** Højst så mange virksomheder i sammenligningstabellen (Jakob 01.10, 15.1/22.1: man kan højst sammenligne 3). */
export const COMPARE_TABLE_MAX = 3;
/** Højst så mange virksomheder i alt (rankingSchema). */
export const COMPARE_MAX = 10;
/** Standardnøgletal i tabellen (samme som comparisonSchema's standard). */
export const COMPARE_DEFAULT_METRICS: readonly Metric[] = ["omsaetning", "bruttofortjeneste", "resultat", "ansatte"];
/** Noten, når flere end 3 virksomheder sammenlignes. */
export const COMPARE_TABLE_NOTE = `Sammenligningstabellen viser højst ${COMPARE_TABLE_MAX}; de ${COMPARE_TABLE_MAX} største er valgt.`;

/** Rangeringsord fra spørgsmålet (foldet tekst): størst, bedst, højest, lavest, flest, mindst. */
/** Stigende rangering (laveste først): lavest, mindst, færrest, dårligst (foldet tekst). */
const ASC_WORDS = /\b(?:lavest\w*|mindst\w*|faerrest\w*|daarligst\w*)\b/;

const RANKING_WORDS = /\b(?:stoerst\w*|bedst\w*|hoejest\w*|lavest\w*|flest\w*|faerrest\w*|daarligst\w*|mindst\w*)\b/;

export interface CompareOptions {
  /** Nøgletal i tabellen (1–5). */
  metrics?: readonly Metric[];
  /** Ét nøgletal: rangering. */
  metric?: Metric;
  /** År i linjegrafen (2–10, standard 5). */
  years?: number;
  /** Brugerens spørgsmål: vælger rangering vs. tabel og nøgletal (parseAsk). */
  question?: string;
  title?: string;
  /** Virksomhedernes navne (ref → navn) til titel og opfølgninger. */
  names?: Readonly<Record<string, string | undefined>>;
  /** Seneste regnskabsårs nøgletal (ref → nøgletal → værdi): vælger "de største" og omsætning/bruttofortjeneste. */
  values?: Readonly<Record<string, Partial<Record<Metric, number | null | undefined>>>>;
}

/** Spørgsmålet beder om en rangering ("hvem er størst", "hvem har den højeste soliditet"). */
export function isRankingQuestion(question: string | undefined): boolean {
  return Boolean(question && RANKING_WORDS.test(foldText(question)));
}

const value = (o: CompareOptions, ref: string, m: Metric): number | null => {
  const v = o.values?.[ref]?.[m];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
};

/** Omsætning, når mindst lige så mange af virksomhederne har den oplyst som bruttofortjeneste; ellers bruttofortjeneste. */
function sizeMetric(refs: readonly string[], o: CompareOptions): Metric {
  if (!o.values) return "omsaetning";
  const count = (m: Metric) => refs.filter((r) => value(o, r, m) !== null).length;
  return count("omsaetning") >= count("bruttofortjeneste") ? "omsaetning" : "bruttofortjeneste";
}

/** De `n` største på nøgletallet (i den givne rækkefølge ved ens eller manglende tal). */
function largest(refs: readonly string[], metric: Metric, n: number, o: CompareOptions): string[] {
  if (refs.length <= n) return [...refs];
  const chosen = refs
    .map((ref, i) => ({ ref, i, v: value(o, ref, metric) }))
    .sort((a, b) => (b.v ?? Number.NEGATIVE_INFINITY) - (a.v ?? Number.NEGATIVE_INFINITY) || a.i - b.i)
    .slice(0, n);
  // Tabellen beholder brugerens rækkefølge.
  return chosen.sort((a, b) => a.i - b.i).map((x) => x.ref);
}

const clip = (s: string, max: number) => (s.length <= max ? s : `${s.slice(0, max - 1)}…`);

function compareTitle(refs: readonly string[], o: CompareOptions): string {
  if (o.title) return clip(o.title, 120);
  const names = refs.map((r) => o.names?.[r] ?? r);
  const joined = names.join(" vs. ");
  return refs.length <= 3 && joined.length <= 120 ? joined : `Sammenligning af ${refs.length} virksomheder`;
}

export function composeCompare(refs: readonly string[], options: CompareOptions = {}): ViewSpec {
  const all = [...new Set(refs)].slice(0, COMPARE_MAX);
  if (all.length < 2) throw new Error("composeCompare kræver mindst 2 forskellige virksomheder.");
  const names = Object.values(options.names ?? {}).filter((n): n is string => Boolean(n));
  const ask = options.question?.trim() ? parseAsk(options.question, "company", { name: names }) : undefined;
  const asked = ask?.metrics ?? [];
  const years = Math.min(Math.max(Math.trunc(options.years ?? ask?.years ?? 5), 2), 10);
  const ranking = Boolean(options.metric) || isRankingQuestion(ask?.question);
  const order = ASC_WORDS.test(foldText(options.question ?? "")) ? ("asc" as const) : undefined;
  const title = compareTitle(all, options);

  let components: ViewSpecInput["components"];
  if (ranking) {
    const metric = options.metric ?? asked[0] ?? options.metrics?.[0] ?? sizeMetric(all, options);
    const tableMetrics = withRelated([metric, ...(options.metrics ?? []), ...asked], 3);
    components = [
      { type: "LassoRanking", companies: all, metric, ...(order ? { order } : {}), title: clip(`${METRIC_LABELS[metric]}, rangliste`, 80) },
      { type: "LassoCompareTable", companies: largest(all, metric, COMPARE_TABLE_MAX, options), metrics: tableMetrics },
    ];
  } else if (all.length > COMPARE_TABLE_MAX) {
    const metric = sizeMetric(all, options);
    components = [
      { type: "LassoRanking", companies: all, metric, title: clip(`${METRIC_LABELS[metric]}, rangliste`, 80) },
      { type: "LassoCompareTable", companies: largest(all, metric, COMPARE_TABLE_MAX, options), metrics: [...(options.metrics ?? COMPARE_DEFAULT_METRICS)].slice(0, 5) },
    ];
  } else {
    const metrics = options.metrics?.length ? [...options.metrics].slice(0, 5) : asked.length ? withRelated(asked, 5) : [...COMPARE_DEFAULT_METRICS];
    // Linjegrafen: det første nøgletal; standardnøgletallet omsætning falder tilbage til bruttofortjeneste,
    // når en af de to ikke har omsætningen oplyst (som show_company's hovednøgletal).
    const explicit = Boolean(options.metrics?.length || asked.length);
    const chartMetric = !explicit && metrics[0] === "omsaetning" ? sizeMetric(all.slice(0, 2), options) : metrics[0]!;
    const [a, b] = all as [string, string];
    const nameOf = (r: string) => options.names?.[r] ?? r;
    // Med ID'et i parentes rammer show_company den rigtige, også ved et tvetydigt navn.
    const showPrompt = (r: string) => (options.names?.[r] ? `Vis ${nameOf(r)} (${r})` : `Vis ${r}`);
    const alt: Metric = metrics[0] === "soliditetsgrad" ? "overskudsgrad" : "soliditetsgrad";
    const others = clip(all.map(nameOf).join(", "), 400);
    components = [
      { type: "LassoCompareTable", companies: all, metrics },
      { type: "LassoLineChart", company: a, metric: chartMetric, years, benchmark: b },
      {
        type: "LassoFollowUps",
        prompts: [
          { label: clip(`Vis ${nameOf(a)}`, 60), prompt: showPrompt(a) },
          { label: clip(`Vis ${nameOf(b)}`, 60), prompt: showPrompt(b) },
          { label: `Sammenlign på ${METRIC_LABELS[alt].toLowerCase()}`, prompt: `Sammenlign ${others} på ${METRIC_LABELS[alt].toLowerCase()}` },
        ],
      },
    ];
  }
  return viewSpecSchema.parse({ kind: "custom", title, layout: "dashboard", components });
}
