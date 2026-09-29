/**
 * Eval-løber (plan A4, docs/plan-mcp.md): kører eval-sættet mod demodata og måler træfprocent
 * på to niveauer. Rækkefølgen følger usecases/views.ts: parseAsk → probe → resolveSpec → compose.
 *  - "side": den komponerede side (det brugeren får). Kun tilfælde med dataInDemo=true.
 *  - "plan": askPlan(ask).lead som komponentliste (hensigten). Alle tilfælde.
 */
import { readFileSync } from "node:fs";
import {
  askFocus,
  askPersonFocus,
  askPlan,
  composeCompany,
  composePerson,
  composePersonProbe,
  composeProbe,
  parseAsk,
  shortCompanyName,
} from "@lasso/spec";
import {
  scoreComponents,
  type CaseResult,
  type EvalCase,
  type EvalFile,
} from "../../../../packages/spec/src/eval/schema.js";
import { DemoProvider } from "../data/demo.js";
import { resolveSpec } from "../data/resolve.js";

export type { CaseResult, EvalCase, EvalFile };

export interface GroupStat {
  hits: number;
  total: number;
  pct: number;
}

export interface Miss {
  id: string;
  level: "side" | "plan";
  want: string;
  got?: string;
}

export interface EvalReport {
  date: string;
  target: number;
  cases: number;
  results: CaseResult[];
  side: GroupStat;
  plan: GroupStat;
  /** Plan-niveau delt: tilfælde uden expected.focus (svar-element) og med (fokus). */
  planLead: GroupStat;
  planFocus: GroupStat;
  byGroup: Record<"eksisterende" | "manglende", { side: GroupStat; plan: GroupStat }>;
  misses: Miss[];
}

/** `--no-topic`: kør uden topic-hintet (til før/efter-sammenligning af hintets virkning). */
const NO_TOPIC = process.argv.includes("--no-topic");
const hintTopic = (c: EvalCase): string | undefined => (NO_TOPIC ? undefined : c.hints?.topic);

const QUESTIONS = new URL("../../../../packages/spec/src/eval/questions.json", import.meta.url);

const stat = (results: CaseResult[]): GroupStat => {
  const hits = results.filter((r) => r.hit).length;
  return { hits, total: results.length, pct: results.length ? Math.round((hits / results.length) * 1000) / 10 : 0 };
};

async function sideComponents(c: EvalCase, provider: DemoProvider): Promise<{ type: never }[]> {
  const id = c.entity;
  if (c.kind === "company") {
    const official = await provider.company(id).then((x) => x.name).catch(() => undefined);
    const a = parseAsk(c.question, "company", {
      metrics: c.hints?.metrics,
      topic: hintTopic(c),
      name: official ? [official, shortCompanyName(official)] : undefined,
    });
    const focus = c.hints?.focus ?? (a.generic ? askFocus(a) : undefined);
    const dataset = await resolveSpec(composeProbe(id, focus as never, a), provider);
    const name = dataset.companies[id]?.name;
    const spec = composeCompany(id, dataset, { focus: focus as never, name, ask: a, ...(c.hints?.show_all ? { showAll: true } : {}) });
    return spec.components as never;
  }
  const official = await provider.person(id).then((x) => x.name).catch(() => undefined);
  const a = parseAsk(c.question, "person", { name: official, topic: hintTopic(c) });
  const focus = (c.hints?.focus as never) ?? (a.generic ? askPersonFocus(a) : undefined) ?? "overblik";
  const dataset = await resolveSpec(composePersonProbe(id, focus, a), provider);
  const spec = composePerson(id, dataset, { focus, name: dataset.persons[id]?.name, ask: a, ...(c.hints?.show_all ? { showAll: true } : {}) });
  return spec.components as never;
}

function planResult(c: EvalCase, official: string | undefined): CaseResult {
  const a = parseAsk(c.question, c.kind, {
    ...(c.kind === "company" ? { metrics: c.hints?.metrics } : {}),
    topic: hintTopic(c),
    name: c.kind === "company" ? (official ? [official, shortCompanyName(official)] : undefined) : (official as never),
  });
  if (c.expected.focus) {
    const got = (c.kind === "company" ? askFocus(a) : askPersonFocus(a)) ?? "overblik";
    return { id: c.id, level: "plan", hit: got === c.expected.focus, got: `focus:${got}`, want: `focus:${c.expected.focus}`, alsoMissing: [], absentFound: [] };
  }
  const lead = askPlan(a, c.kind).lead.map((l) => ({ type: l.type, ...(l.props ?? {}) }));
  return scoreComponents(c, "plan", lead as never);
}

export async function runEval(): Promise<EvalReport> {
  const file = JSON.parse(readFileSync(QUESTIONS, "utf8")) as EvalFile;
  const provider = new DemoProvider();
  const results: CaseResult[] = [];
  const byCase = new Map<string, EvalCase>();
  for (const c of file.cases) {
    byCase.set(c.id, c);
    const official = await (c.kind === "company" ? provider.company(c.entity) : provider.person(c.entity)).then((x) => x.name).catch(() => undefined);
    results.push(planResult(c, official));
    if (c.dataInDemo) results.push(scoreComponents(c, "side", await sideComponents(c, provider)));
  }
  const of = (level: "side" | "plan", group?: "eksisterende" | "manglende") =>
    results.filter((r) => r.level === level && (!group || byCase.get(r.id)?.group === group));
  const byGroup = {
    eksisterende: { side: stat(of("side", "eksisterende")), plan: stat(of("plan", "eksisterende")) },
    manglende: { side: stat(of("side", "manglende")), plan: stat(of("plan", "manglende")) },
  };
  return {
    date: new Date().toISOString().slice(0, 10),
    target: file.target,
    cases: file.cases.length,
    results,
    side: stat(of("side")),
    plan: stat(of("plan")),
    planLead: stat(of("plan").filter((r) => !byCase.get(r.id)?.expected.focus)),
    planFocus: stat(of("plan").filter((r) => !!byCase.get(r.id)?.expected.focus)),
    byGroup,
    misses: results.filter((r) => !r.hit).map((r) => ({ id: r.id, level: r.level, want: r.want, got: r.got })),
  };
}

export function formatReport(r: EvalReport): string {
  const row = (label: string, s: GroupStat) => `${label.padEnd(28)} ${String(s.hits).padStart(3)}/${String(s.total).padEnd(3)} ${s.pct.toFixed(1).padStart(6)} %`;
  const lines = [
    `Eval ${r.date}: ${r.cases} tilfælde (mål ${r.target} % på side)`,
    row("side (dataInDemo=true)", r.side),
    row("plan (alle)", r.plan),
    row("plan, svar-element", r.planLead),
    row("plan, fokus", r.planFocus),
    row("side, eksisterende", r.byGroup.eksisterende.side),
    row("side, manglende", r.byGroup.manglende.side),
    row("plan, eksisterende", r.byGroup.eksisterende.plan),
    row("plan, manglende", r.byGroup.manglende.plan),
    "",
    `Misses (${r.misses.length}):`,
    ...r.misses.map((m) => `- ${m.id} [${m.level}] want ${m.want} | got ${(m.got ?? "intet").slice(0, 110)}`),
  ];
  return lines.join("\n");
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const { writeFileSync } = await import("node:fs");
  const report = await runEval();
  console.log(formatReport(report));
  // eval-latest.json er gitignoreret; eval-baseline.json er frosset og skrives kun med --baseline.
  const file = process.argv.includes("--baseline") ? "eval-baseline.json" : "eval-latest.json";
  writeFileSync(new URL(`../../../../docs/${file}`, import.meta.url), JSON.stringify(report, null, 2) + "\n");
  console.log(`\nSkrev docs/${file}`);
}
