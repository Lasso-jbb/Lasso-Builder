/**
 * /designguide: Lassos dynamiske designguide. Siden er sin egen HTML-fil (apps/view/designguide.html),
 * bygget fra koden ved hver udrulning: tokens, tekster, galleri og regler står i filen; de rigtige data
 * kommer herfra. Modulerne bruger komponentudstillingens live-data (samme cache som /komponenter),
 * og hele sider (show_company og show_person for hvert fokus) hentes efter behov fra /designguide/side.json.
 * Siden tager kun faste entiteter (SHOWCASE, eller SHOWCASE_DEMO på demodata), så den kan ikke bruges til
 * vilkårlige opslag.
 */
import type { Request, Response } from "express";
import { composeCompany, composePerson, composePersonProbe, composeProbe, componentSchema, FOCUSES, mainMetric, PERSON_FOCUSES, showcaseTabs, type ComponentType, type Dataset, type Focus, type PersonFocus, type SavedPagesVM, type ViewComponent, type ViewSpec } from "@lasso/spec";
import { DemoProvider } from "../data/demo.js";
import type { DataProvider } from "../data/index.js";
import { errorMessage, resolveSpec } from "../data/resolve.js";
import { cleanCommentInput, cleanCommentPatch, commentsMarkdown, COMMENT_STATUSES, type CommentStatus, type CommentStore } from "../comments/store.js";
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
  /**
   * Fiktive data til alle moduler, så hvert modul kan ses i brug, også når ingen rigtig virksomhed har
   * data til det (fx Statstidende, BBR, CHR, gemte sider). Altid demodata, også når serveren kører live.
   */
  fictive: FictiveData;
  /** Kommentarer: om skrivning kræver en nøgle (DESIGNGUIDE_KEY eller ADMIN_API_KEY). */
  comments: { keyRequired: boolean };
}

export interface FictiveData {
  items: { type: ComponentType; label: string; component: ViewComponent }[];
  dataset: Dataset;
}

export interface DesignguidePage {
  spec: ViewSpec;
  dataset: Dataset;
}

/**
 * Den fiktive virksomhed pr. modul, når Eksempel Byg A/S ikke har data til det: Statstidende kræver en
 * virksomhed under konkurs, BBR en ejendomsvirksomhed og CHR en landbrugsvirksomhed (demo.ts).
 */
const FICTIVE_COMPANY: Partial<Record<ComponentType, string>> = {
  LassoAnnouncements: "CVR-1-99000011", // Eksempel Energi A/S, under konkurs
  LassoProperties: "CVR-1-99000012", // Eksempel Ejendomme ApS
  LassoLivestock: "CVR-1-99000013", // landbrug med CHR-besætninger
};

/** Fiktive gemte sider (kræver ellers en logget ind bruger). */
function fictiveSavedPages(opts: { kind: "company" | "person" | "all"; limit: number }): SavedPagesVM {
  const pages: SavedPagesVM["pages"] = [
    { lassoId: "CVR-1-99000001", kind: "company" as const, name: "Eksempel Byg A/S", cvr: "99000001", focus: "oekonomi", note: "Tilbud sendt i august", origin: "manual" as const, savedAt: "2026-09-28T09:12:00Z" },
    { lassoId: "CVR-1-99000004", kind: "company" as const, name: "Eksempel Transport A/S", cvr: "99000004", origin: "send" as const, savedAt: "2026-09-24T14:40:00Z" },
    { lassoId: "CVR-3-4000000001", kind: "person" as const, name: "Anne Eksempel", origin: "manual" as const, savedAt: "2026-09-21T08:05:00Z" },
    { lassoId: "CVR-1-99000011", kind: "company" as const, name: "Eksempel Energi A/S", cvr: "99000011", focus: "risiko", note: "Følg konkursboet", origin: "link" as const, savedAt: "2026-09-15T11:30:00Z" },
  ].filter((x) => opts.kind === "all" || x.kind === opts.kind);
  return { pages: pages.slice(0, opts.limit), total: pages.length, kind: opts.kind, limit: opts.limit };
}

let fictiveCache: Promise<FictiveData> | undefined;
/** Alle udstillingens moduler på de fiktive virksomheder og personen, løst med demodata. Laves én gang. */
function fictiveData(): Promise<FictiveData> {
  fictiveCache ??= (async () => {
    const demo = new DemoProvider();
    const ids = SHOWCASE_DEMO;
    const [companyName, personName] = await Promise.all([demo.company(ids.company).then((c) => c.name), demo.person(ids.person).then((p) => p.name)]);
    const tabs = showcaseTabs({ ...ids, companyName, personName });
    const items: FictiveData["items"] = [];
    const seen = new Set<string>();
    for (const tab of tabs) {
      for (const it of tab.items) {
        if (seen.has(it.type)) continue;
        seen.add(it.type);
        const c = it.component as ViewComponent & { company?: string };
        const other = FICTIVE_COMPANY[it.type];
        const component = other && typeof c.company === "string" ? componentSchema.parse({ ...c, company: other }) : c;
        items.push({ type: it.type, label: tab.id === "person" ? personName : companyName, component });
      }
    }
    // Personmoduler, udstillingen ikke har med.
    for (const type of ["LassoPersonRisk", "LassoPersonFacts"] as const) if (!seen.has(type)) items.push({ type, label: personName, component: componentSchema.parse({ type, person: ids.person }) });
    const spec = { version: 2, kind: "custom", title: "Fiktive data", layout: "stack", criteria: [], components: items.map((x) => x.component) } as unknown as ViewSpec;
    const dataset = await resolveSpec(spec, demo, { savedPages: async (o) => fictiveSavedPages(o) });
    const names = new Map((await Promise.all(Object.values(FICTIVE_COMPANY).map(async (id) => [id!, await demo.company(id!).then((x) => x.name)] as const))));
    for (const x of items) {
      const other = FICTIVE_COMPANY[x.type];
      if (other) x.label = names.get(other) ?? x.label;
    }
    return { items, dataset };
  })();
  fictiveCache.catch(() => (fictiveCache = undefined));
  return fictiveCache;
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

export function designguideHandlers(provider: DataProvider, comments: CommentStore, opts: { keyRequired: boolean; baseUrl: string }) {
  const page = async (req: Request, res: Response) => {
    const boot: DesignguideBoot = {
      mode: "designguide",
      version: DEPLOYED_VERSION,
      source: provider.kind,
      showcase: await getShowcase(provider, req.query.frisk === "1", idsFor(provider)),
      focuses: { company: FOCUSES, person: PERSON_FOCUSES },
      fictive: await fictiveData(),
      comments: { keyRequired: opts.keyRequired },
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
  const fail = (res: Response, err: unknown, status = 400) => void res.status(status).json({ error: errorMessage(err) });
  const listComments = async (_req: Request, res: Response) => {
    try {
      res.set("Cache-Control", "no-store").json(await comments.list());
    } catch (err) {
      fail(res, err, 500);
    }
  };
  const commentsMd = async (req: Request, res: Response) => {
    const status = String(req.query.status ?? "aaben");
    const pick: CommentStatus | "alle" = status === "alle" ? "alle" : COMMENT_STATUSES.includes(status as CommentStatus) ? (status as CommentStatus) : "aaben";
    try {
      res.type("text/markdown; charset=utf-8").set("Cache-Control", "no-store").send(commentsMarkdown(await comments.list(), opts.baseUrl, pick));
    } catch (err) {
      fail(res, err, 500);
    }
  };
  const addComment = async (req: Request, res: Response) => {
    try {
      res.status(201).json(await comments.add(cleanCommentInput(req.body)));
    } catch (err) {
      fail(res, err);
    }
  };
  const updateComment = async (req: Request, res: Response) => {
    try {
      const c = await comments.update(String(req.params.id), cleanCommentPatch(req.body));
      if (!c) return void res.status(404).json({ error: "Kommentaren findes ikke" });
      res.json(c);
    } catch (err) {
      fail(res, err);
    }
  };
  const removeComment = async (req: Request, res: Response) => {
    try {
      res.status((await comments.remove(String(req.params.id))) ? 204 : 404).end();
    } catch (err) {
      fail(res, err, 500);
    }
  };
  return { page, side, listComments, commentsMarkdown: commentsMd, addComment, updateComment, removeComment };
}
