import type { ViewSpec } from "@lasso/spec";
import type { PageTemplate, SaveTemplateBody, ViewResult } from "../portal/api.js";
import { textHash } from "./model.js";

/**
 * Egne sider (sideskabeloner) for demobrugeren (Jakob 03.10): serveren gemmer ikke skabeloner for demobrugeren (403), så de
 * ligger i browseren. Serveren forbereder specen (POST /templates/prepare: entiteten fjernet, renset, titel) og tegner den
 * (POST /templates/render med den aktive entitet); listen, dubletter (hash af den forberedte spec) og fjernelse er lokale.
 * En logget ind bruger bruger serverens skabeloner som før (serverTemplates). Rene funktioner, så lageret kan testes i node.
 */

/** Højst så mange lokale egne sider pr. bruger; den ældste falder ud. */
export const LOCAL_TEMPLATES_MAX = 20;
/** Lokale id'er: "local:" + 12 tegn, så modulets nøgle (tpl:<id>) holder sig under serverens 40 tegn i context.tab. */
export const LOCAL_PREFIX = "local:";
export const isLocalTemplateId = (id: string): boolean => id.startsWith(LOCAL_PREFIX);

export const localTemplatesKey = (userId: string): string => `lasso-templates-${userId || "demo"}`;

export interface LocalTemplate extends PageTemplate {
  /** Den forberedte spec (uden entitet), som /templates/render tegner med den aktive entitet. */
  spec: ViewSpec;
  /** Hash af den forberedte spec: samme visning to gange giver samme modul. */
  hash: string;
  createdAt: number;
}

/** Stabil serialisering (sorterede nøgler), så samme spec giver samme hash uanset nøglernes rækkefølge. */
function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (v && typeof v === "object") return `{${Object.keys(v as Record<string, unknown>).sort().map((k) => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`).join(",")}}`;
  return JSON.stringify(v) ?? "null";
}
export const specHash = (spec: ViewSpec): string => textHash(stable(spec));

const isLocal = (x: unknown): x is LocalTemplate => {
  const t = x as LocalTemplate | undefined;
  return Boolean(t && typeof t.id === "string" && isLocalTemplateId(t.id) && (t.kind === "company" || t.kind === "person") && typeof t.title === "string" && t.spec && typeof t.hash === "string");
};

export function readLocalTemplates(storage: Pick<Storage, "getItem"> | undefined, userId: string): LocalTemplate[] {
  try {
    const raw = storage?.getItem(localTemplatesKey(userId));
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? list.filter(isLocal).slice(-LOCAL_TEMPLATES_MAX) : [];
  } catch {
    return [];
  }
}

export function writeLocalTemplates(storage: Pick<Storage, "setItem"> | undefined, userId: string, list: readonly LocalTemplate[]): boolean {
  try {
    storage?.setItem(localTemplatesKey(userId), JSON.stringify(list));
    return Boolean(storage);
  } catch {
    return false;
  }
}

/** Tilføjer en forberedt side; findes samme (kind + hash), gives den eksisterende tilbage. Over max falder den ældste ud. */
export function addLocalTemplate(
  list: readonly LocalTemplate[],
  prepared: { kind: "company" | "person"; title: string; subtitle?: string; spec: ViewSpec },
  id: string,
  now: number,
): { list: LocalTemplate[]; template: LocalTemplate; existed: boolean } {
  const hash = specHash(prepared.spec);
  const found = list.find((t) => t.kind === prepared.kind && t.hash === hash);
  if (found) return { list: [...list], template: found, existed: true };
  const template: LocalTemplate = { id, kind: prepared.kind, title: prepared.title, ...(prepared.subtitle ? { subtitle: prepared.subtitle } : {}), spec: prepared.spec, hash, createdAt: now };
  return { list: [...list, template].slice(-LOCAL_TEMPLATES_MAX), template, existed: false };
}

export const removeLocalTemplate = (list: readonly LocalTemplate[], id: string): LocalTemplate[] => list.filter((t) => t.id !== id);

export function newLocalId(random: () => string = () => Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)): string {
  return `${LOCAL_PREFIX}${random().replace(/[^a-z0-9]/gi, "").slice(0, 12).padEnd(12, "0")}`;
}

/* ---------- de to veje: serveren (logget ind) og browseren (demobrugeren) ---------- */

export interface TemplateBackend {
  list: (kind: "company" | "person") => Promise<PageTemplate[]>;
  save: (body: SaveTemplateBody) => Promise<PageTemplate>;
  remove: (id: string) => Promise<void>;
  render: (id: string, entityId: string) => Promise<ViewResult>;
}

export interface TemplateApi {
  list: (kind: "company" | "person") => Promise<PageTemplate[]>;
  save: (body: SaveTemplateBody) => Promise<PageTemplate>;
  remove: (id: string) => Promise<unknown>;
  render: (id: string, entityId: string) => Promise<ViewResult>;
  prepare: (body: { kind: "company" | "person"; spec: ViewSpec; entity: { kind: "company" | "person"; id: string } }) => Promise<{ title: string; subtitle?: string; spec: ViewSpec }>;
  renderSpec: (body: { kind: "company" | "person"; spec: ViewSpec; entity: { kind: "company" | "person"; id: string } }) => Promise<ViewResult>;
}

export const serverTemplates = (api: TemplateApi): TemplateBackend => ({
  list: api.list,
  save: api.save,
  remove: async (id) => void (await api.remove(id)),
  render: api.render,
});

const kindOfId = (id: string): "company" | "person" => (/^CVR-[34]-/i.test(id) ? "person" : "company");

/** Demobrugerens egne sider i browseren: prepare og render hos serveren, listen i localStorage. */
export function localTemplates(api: TemplateApi, storage: Pick<Storage, "getItem" | "setItem"> | undefined, userId: string, now: () => number = Date.now, makeId: () => string = newLocalId): TemplateBackend {
  return {
    list: async (kind) => readLocalTemplates(storage, userId).filter((t) => t.kind === kind),
    save: async (body) => {
      const prepared = await api.prepare({ kind: body.kind, spec: body.spec, entity: body.entity });
      const title = prepared.title || body.title;
      const subtitle = prepared.subtitle ?? body.subtitle;
      const r = addLocalTemplate(readLocalTemplates(storage, userId), { kind: body.kind, title, ...(subtitle ? { subtitle } : {}), spec: prepared.spec }, makeId(), now());
      if (!r.existed && !writeLocalTemplates(storage, userId, r.list)) throw new Error("Siden kunne ikke gemmes i browseren.");
      const { id, kind, title: t, subtitle: s } = r.template;
      return { id, kind, title: t, ...(s ? { subtitle: s } : {}) };
    },
    remove: async (id) => {
      writeLocalTemplates(storage, userId, removeLocalTemplate(readLocalTemplates(storage, userId), id));
    },
    render: async (id, entityId) => {
      const t = readLocalTemplates(storage, userId).find((x) => x.id === id);
      if (!t) throw Object.assign(new Error("Siden findes ikke."), { status: 404 });
      const r = await api.renderSpec({ kind: t.kind, spec: t.spec, entity: { kind: kindOfId(entityId), id: entityId } });
      return { ...r, spec: { ...r.spec, title: t.title, ...(t.subtitle ? { subtitle: t.subtitle } : {}) } };
    },
  };
}
