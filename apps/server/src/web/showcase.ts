/**
 * /komponenter: alle Lassos komponenter i brug på LASSO X A/S og Jakob Bech Benediktson med
 * live-data, to faner og katalognummeret over hver komponent (packages/spec/src/showcase.ts).
 * Siden tager ingen parametre (kun de to faste entiteter), så den kan ikke bruges til vilkårlige
 * opslag. Data caches i 10 minutter; ?frisk=1 henter igen.
 */
import type { Request, Response } from "express";
import { alternativeComponents, portalPages, showcaseAlternatives, showcaseTabs, type PortalPage, type Dataset, type ShowcaseAlternatives, type ShowcaseTab, type ViewSpec } from "@lasso/spec";
import type { Config } from "../config.js";
import type { DataProvider } from "../data/index.js";
import { resolveSpec } from "../data/resolve.js";
import { portalPageSpec } from "../data/portalPage.js";
import { injectBoot, loadViewHtml } from "./page.js";

export const SHOWCASE = {
  company: "CVR-1-34580820", // LASSO X A/S
  person: "CVR-3-4000455341", // Jakob Bech Benediktson
  peers: ["CVR-1-32828353", "CVR-1-31479282"] as [string, string], // Lix Studios ApS, BENEDIKTSON HOLDING ApS
  /** Store virksomheder med mange data: fanen "Ikke i brug" viser tomme komponenter med den første, der har data. */
  alternatives: ["CVR-1-24256790", "CVR-1-61056416", "CVR-1-22756214"], // Novo Nordisk, Carlsberg, A.P. Møller - Mærsk
  /** Sammenligning: to store og LASSO X (Mærsk har ingen bruttofortjeneste/omsætning i Lasso). */
  compare: ["CVR-1-24256790", "CVR-1-61056416", "CVR-1-34580820"],
};

/** Den udrullede commit (Railway sætter RAILWAY_GIT_COMMIT_SHA), så man kan se, om siden kører den nyeste kode. */
export const DEPLOYED_VERSION = (process.env.RAILWAY_GIT_COMMIT_SHA ?? process.env.GIT_COMMIT_SHA ?? "").slice(0, 7) || "lokal";

export interface ShowcaseBoot {
  mode: "showcase";
  generatedAt: string;
  /** Kort commit-hash for den udrullede kode. */
  version?: string;
  tabs: (ShowcaseTab & { dataset: Dataset })[];
  alt: ShowcaseAlternatives & { dataset: Dataset };
  /** Fanen "Lasso-side": portalens Overblik og Stamoplysninger for virksomheden, bygget af komponenterne. */
  portal: { company: string; name: string; pages: (PortalPage & { dataset: Dataset })[] };
}

/**
 * Uden Lasso-nøgler (demodata) kendes de rigtige virksomheder ikke; designguiden bruger så demovirksomhederne,
 * så den også kan bruges lokalt og i test. Samme roller: hovedvirksomhed, person, to til sammenligning,
 * tre alternativer og tre til sammenligningstabellen.
 */
export const SHOWCASE_DEMO: typeof SHOWCASE = {
  company: "CVR-1-99000001", // Eksempel Byg A/S
  person: "CVR-3-4000000001", // første demoperson (demoPersonIds)
  peers: ["CVR-1-99000004", "CVR-1-99000005"],
  alternatives: ["CVR-1-99000002", "CVR-1-99000006", "CVR-1-99000010"],
  compare: ["CVR-1-99000001", "CVR-1-99000004", "CVR-1-99000005"],
};

const TTL_MS = 10 * 60 * 1000;
const caches = new Map<string, { at: number; boot: ShowcaseBoot }>();

/** Alle komponenter på én fane i én spec, så data hentes samlet (højdebudget og 12-grænsen gælder ikke her). */
const specOf = (t: ShowcaseTab): ViewSpec => ({ version: 2, kind: "custom", title: t.label, layout: "stack", criteria: [], components: t.items.map((x) => x.component) }) as ViewSpec;

export async function buildShowcase(provider: DataProvider, ids: typeof SHOWCASE = SHOWCASE): Promise<ShowcaseBoot> {
  const [companyName, personName] = await Promise.all([
    provider.company(ids.company).then((c) => c.name).catch(() => "LASSO X A/S"),
    provider.person(ids.person).then((p) => p.name).catch(() => "Jakob Bech Benediktson"),
  ]);
  const tabs = showcaseTabs({ ...ids, companyName, personName });
  const altCompanies = await Promise.all(ids.alternatives.map(async (id) => ({ id, name: await provider.company(id).then((c) => c.name).catch(() => id) })));
  const alt = showcaseAlternatives(tabs[0]!, altCompanies, ids.compare);
  const altSpec = { version: 2, kind: "custom", title: "Alternativer", layout: "stack", criteria: [], components: alternativeComponents(alt) } as unknown as ViewSpec;
  const pages = portalPages(ids.company);
  // Samme spec som portalens Overblik (data/portalPage.ts).
  const pageSpec = (pg: PortalPage) => portalPageSpec(pg, companyName);
  const [datasets, altDataset, pageData] = await Promise.all([
    Promise.all(tabs.map((t) => resolveSpec(specOf(t), provider))),
    resolveSpec(altSpec, provider),
    Promise.all(pages.map((pg) => resolveSpec(pageSpec(pg), provider))),
  ]);
  return {
    mode: "showcase",
    generatedAt: new Date().toISOString(),
    version: DEPLOYED_VERSION,
    tabs: tabs.map((t, i) => ({ ...t, dataset: datasets[i]! })),
    alt: { ...alt, dataset: altDataset },
    portal: { company: ids.company, name: companyName, pages: pages.map((pg, i) => ({ ...pg, dataset: pageData[i]! })) },
  };
}

/** Udstillingens data fra cachen (10 min), delt med designguiden (web/designguide.ts); `fresh` henter igen. */
export async function getShowcase(provider: DataProvider, fresh = false, ids: typeof SHOWCASE = SHOWCASE): Promise<ShowcaseBoot> {
  const hit = caches.get(ids.company);
  if (!fresh && hit && Date.now() - hit.at < TTL_MS) return hit.boot;
  const boot = await buildShowcase(provider, ids);
  caches.set(ids.company, { at: Date.now(), boot });
  return boot;
}

export function showcaseHandler(_config: Config, provider: DataProvider) {
  return async (req: Request, res: Response) => {
    const boot = await getShowcase(provider, req.query.frisk === "1");
    const html = await loadViewHtml();
    res.type("html").set("Cache-Control", "no-store").set("X-Robots-Tag", "noindex").send(injectBoot(html, boot, "Komponenter"));
  };
}
