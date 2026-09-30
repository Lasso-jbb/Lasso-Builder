/**
 * /designguide: Lassos dynamiske designguide. Siden er sin egen HTML-fil (apps/view/designguide.html),
 * bygget fra koden ved hver udrulning: tokens, tekster, galleri og regler står i filen; de rigtige data
 * kommer herfra. Modulerne bruger komponentudstillingens live-data (samme cache som /komponenter),
 * og hele sider (show_company og show_person for hvert fokus) hentes efter behov fra /designguide/side.json.
 * Siden tager kun faste entiteter (SHOWCASE, eller SHOWCASE_DEMO på demodata), så den kan ikke bruges til
 * vilkårlige opslag.
 */
import type { Request, Response } from "express";
import { composeCompany, composePerson, composePersonProbe, composeProbe, FOCUSES, mainMetric, PERSON_FOCUSES, type Dataset, type Focus, type PersonFocus, type ViewSpec } from "@lasso/spec";
import type { DataProvider } from "../data/index.js";
import { errorMessage, resolveSpec } from "../data/resolve.js";
import { injectBoot, loadDesignguideHtml } from "./page.js";
import { DEPLOYED_VERSION, getShowcase, SHOWCASE, SHOWCASE_DEMO, type ShowcaseBoot } from "./showcase.js";

export interface DesignguideBoot {
  mode: "designguide";
  /** Kort commit-hash for den udrullede kode. */
  version: string;
  /** "live" (Lassos API) eller "demo" (faste demodata, når serveren ikke har Lasso-nøgler). */
  source: string;
  showcase: ShowcaseBoot;
  /** Fokusserne, en hel side kan hentes for (virksomhed og person). */
  focuses: { company: readonly string[]; person: readonly string[] };
}

export interface DesignguidePage {
  spec: ViewSpec;
  dataset: Dataset;
}

const TTL_MS = 10 * 60 * 1000;
const pages = new Map<string, { at: number; page: DesignguidePage }>();

const idsFor = (provider: DataProvider) => (provider.kind === "demo" ? SHOWCASE_DEMO : SHOWCASE);

async function buildPage(provider: DataProvider, kind: "company" | "person", focus: string): Promise<DesignguidePage> {
  const ids = idsFor(provider);
  if (kind === "company") {
    const id = ids.company;
    const f = focus as Focus;
    const dataset = await resolveSpec(composeProbe(id, f), provider);
    const name = dataset.companies[id]?.name;
    const spec = composeCompany(id, dataset, { focus: f, name, chartMetric: mainMetric(dataset.financials[id]?.years ?? []), followUps: false });
    return { spec, dataset };
  }
  const id = ids.person;
  const f = focus as PersonFocus;
  const dataset = await resolveSpec(composePersonProbe(id, f), provider);
  const spec = composePerson(id, dataset, { focus: f, name: dataset.persons[id]?.name, followUps: false });
  return { spec, dataset };
}

export function designguideHandlers(provider: DataProvider) {
  const page = async (req: Request, res: Response) => {
    const boot: DesignguideBoot = {
      mode: "designguide",
      version: DEPLOYED_VERSION,
      source: provider.kind,
      showcase: await getShowcase(provider, req.query.frisk === "1", idsFor(provider)),
      focuses: { company: FOCUSES, person: PERSON_FOCUSES },
    };
    const html = await loadDesignguideHtml();
    res.type("html").set("Cache-Control", "no-store").set("X-Robots-Tag", "noindex").send(injectBoot(html, boot, "Designguide"));
  };
  const side = async (req: Request, res: Response) => {
    const kind = req.query.kind === "person" ? "person" : "company";
    const focus = String(req.query.focus ?? "overblik");
    const allowed: readonly string[] = kind === "company" ? FOCUSES : PERSON_FOCUSES;
    if (!allowed.includes(focus)) return void res.status(400).json({ error: `Ukendt fokus: ${focus}` });
    const key = `${kind}:${focus}`;
    try {
      const hit = pages.get(key);
      if (!hit || Date.now() - hit.at > TTL_MS || req.query.frisk === "1") pages.set(key, { at: Date.now(), page: await buildPage(provider, kind, focus) });
      res.set("Cache-Control", "no-store").set("X-Robots-Tag", "noindex").json(pages.get(key)!.page);
    } catch (err) {
      res.status(502).json({ error: errorMessage(err) });
    }
  };
  return { page, side };
}
