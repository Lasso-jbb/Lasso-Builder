import { useState } from "react";
import { GRID_RULES, type ComponentType } from "@lasso/spec";
import type { Ctx } from "../App.js";
import type { Report } from "../inspect.js";
import { useReports, type ModuleInfo } from "../modules.js";
import { allowedWidths, moduleGroups, slugOf, WIDTH_LABEL } from "../structure.js";
import { Chip, PageHead, Seg } from "../ui.js";

export const LIVE_LABEL: Record<string, string> = { altid: "Altid data", "naar-data": "Når data findes", abonnement: "Kræver abonnement", modul: "Kræver modul", "ikke-endnu": "Ikke live endnu" };
export const PROFILE_LABEL: Record<string, string> = { bred: "Bred", smal: "Smal", fleksibel: "Fleksibel" };
const HEIGHT_LABEL: Record<string, string> = { low: "lav", medium: "mellem", high: "høj", "very-high": "meget høj" };

/** Det værste resultat, modulet har fået i de rammer, der er målt indtil nu. */
export function worstOf(reports: Record<string, Report>, type: string): { report?: Report; count: number; problems: number } {
  const mine = Object.entries(reports).filter(([k]) => k.startsWith(`${type}|`) && k.endsWith("|fyldt"));
  const problems = mine.filter(([, r]) => r.verdict === "problem").length;
  const order = { problem: 2, info: 1, ok: 0 } as const;
  const worst = mine.map(([, r]) => r).sort((a, b) => order[b.verdict] - order[a.verdict])[0];
  return { ...(worst ? { report: worst } : {}), count: mine.length, problems };
}

export function ModuleCard({ m, reports }: { m: ModuleInfo; reports: Record<string, Report> }) {
  const rule = GRID_RULES[m.type];
  const reg = m.catalog.register;
  const widths = allowedWidths(m.type);
  const w = worstOf(reports, m.type);
  return (
    <a className="dg-mcard" href={`#/moduler/${slugOf(m.type)}`}>
      <span className="dg-mcard__top">
        <span className="dg-nr">{m.n}</span>
        {m.catalog.udgaaet ? (
          <Chip tone="muted" title="Udgået: modellen vælger den ikke, og show_company/show_person bruger den ikke længere.">
            Udgået
          </Chip>
        ) : null}
        {w.count ? (
          <Chip tone={w.problems ? "problem" : "ok"} title={`${w.count} rammer målt`}>
            <span aria-hidden="true" className="dg-chip__icon">
              {w.problems ? "!" : "✓"}
            </span>
            {w.problems ? `${w.problems} med overløb` : "Passer"}
          </Chip>
        ) : null}
      </span>
      <span className="dg-mcard__title">{m.title}</span>
      <code className="dg-mcard__type">{m.type}</code>
      <span className="dg-mcard__desc">{reg?.formaal ?? ""}</span>
      <span className="dg-mcard__meta">
        <span className="dg-widths" title="Tilladte bredder (min til maks), standard fremhævet">
          {widths.map((x) => (
            <span key={x} className={x === rule?.std ? "is-std" : ""}>
              {WIDTH_LABEL[x]}
            </span>
          ))}
        </span>
        {reg ? <span>{PROFILE_LABEL[reg.bredde.profil] ?? reg.bredde.profil}</span> : null}
        {rule ? <span>Højde {HEIGHT_LABEL[rule.height]}</span> : null}
        {reg ? <span>{LIVE_LABEL[reg.live] ?? reg.live}</span> : null}
      </span>
    </a>
  );
}

export function ModulesPage({ ctx, group }: { ctx: Ctx; group?: string }) {
  const { reports } = useReports();
  const [q, setQ] = useState("");
  const [profile, setProfile] = useState<"alle" | "bred" | "smal" | "fleksibel">("alle");
  const needle = q.trim().toLowerCase();
  const match = (m: ModuleInfo) =>
    (!needle || `${m.n} ${m.title} ${m.type} ${m.catalog.register?.formaal ?? ""} ${(m.catalog.register?.bedstTil ?? []).join(" ")}`.toLowerCase().includes(needle)) &&
    (profile === "alle" || m.catalog.register?.bredde.profil === profile);
  const groups = moduleGroups().filter((g) => !group || g.id === group);
  const total = groups.reduce((n, g) => n + g.types.filter((t) => ctx.modules.get(t) && match(ctx.modules.get(t)!)).length, 0);
  return (
    <div className="dg-page">
      <PageHead
        eyebrow="Moduler"
        title={group ? (groups[0]?.label ?? "Moduler") : "Alle moduler"}
        lead={group ? groups[0]?.intro : "Hvert modul er en komponent i kataloget. Åbn et modul for at se det i hver bredde, det kan stå i, med rigtige data, i alle tilstande og med alle dets tekster."}
      />
      <div className="dg-toolbar">
        <input className="dg-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrér moduler" aria-label="Filtrér moduler" />
        <Seg
          label="Breddeprofil"
          value={profile}
          onChange={setProfile}
          items={[
            { id: "alle", label: "Alle" },
            { id: "bred", label: "Brede" },
            { id: "smal", label: "Smalle" },
            { id: "fleksibel", label: "Fleksible" },
          ]}
        />
        <span className="dg-meta">{total} moduler</span>
        {group ? <a href="#/moduler">Vis alle grupper</a> : null}
      </div>
      {groups.map((g) => {
        const list = g.types.map((t) => ctx.modules.get(t as ComponentType)).filter((m): m is ModuleInfo => Boolean(m) && match(m!));
        if (!list.length) return null;
        return (
          <section key={g.id} className="dg-section">
            {!group ? (
              <div className="dg-h2row">
                <h2 className="dg-h2">{g.label}</h2>
                <span className="dg-meta">{g.intro}</span>
              </div>
            ) : null}
            <div className="dg-mgrid">
              {list.map((m) => (
                <ModuleCard key={m.type} m={m} reports={reports} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
