import { cvrFromLassoId, FOCUSES, type Focus, type SavedPageKind, type SavedPageVM } from "@lasso/spec";
import type { CurrentUser } from "../auth/user.js";
import type { Config } from "../config.js";
import { NotFoundError, type DataProvider } from "../data/provider.js";
import type { ResolveExtras } from "../data/resolve.js";
import { entityLink } from "../web/links.js";
import { pageKindOf, SavedPageError, type SavedPageRecord, type SavedPageStore } from "./store.js";

/**
 * Gem-laget (docs/gem-lag.md) set fra visningerne: brugerens gemte sider som SavedPagesVM med
 * friske, signerede links, og hvilke af en visnings ID'er der er gemt. Kun MCP-tools med en
 * bruger sender disse extras til resolveSpec; offentlige sider (/k/, /p/, /e/, /v/) gør ikke.
 */

/** Gemt focus som Focus, hvis det er et kendt; ellers ingen (så linket altid kan verificeres). */
export function savedFocus(focus: string | undefined): Focus | undefined {
  return focus && (FOCUSES as readonly string[]).includes(focus) ? (focus as Focus) : undefined;
}

/** Lagerets post som visningsmodel, med signeret link til /e/<lassoId> (samme focus, som den blev gemt med). */
export function savedPageVM(config: Config, p: SavedPageRecord): SavedPageVM {
  return {
    lassoId: p.lassoId,
    kind: p.kind,
    name: p.name,
    ...(p.cvr ? { cvr: p.cvr } : {}),
    ...(p.focus ? { focus: p.focus } : {}),
    ...(p.note ? { note: p.note } : {}),
    origin: p.origin,
    savedAt: p.savedAt,
    url: entityLink(config, p.lassoId, { focus: savedFocus(p.focus) }),
  };
}

export function pagesExtras(pages: SavedPageStore, user: CurrentUser, config: Config): ResolveExtras {
  return {
    savedPages: async ({ kind, limit }) => {
      const { pages: list, total } = await pages.list(user.org, user.id, { kind, limit });
      return { pages: list.map((p) => savedPageVM(config, p)), total, kind, limit };
    },
    savedIds: async (lassoIds) => {
      const ids = lassoIds.filter((id) => pageKindOf(id));
      return ids.length ? [...(await pages.has(user.org, user.id, ids))] : [];
    },
  };
}

/**
 * Navnesnapshot til en gemt side: virksomhedens navn (og CVR) eller personens navn, hentet
 * friskt fra datalaget. Kaster SavedPageError for et ID, der hverken er virksomhed eller person,
 * og datalagets fejl (fx NotFoundError), hvis entiteten ikke kan hentes.
 */
export async function entitySnapshot(provider: DataProvider, lassoId: string): Promise<{ kind: SavedPageKind; name: string; cvr?: string }> {
  const kind = pageKindOf(lassoId);
  if (!kind) throw new SavedPageError(`"${lassoId}" er ikke et Lasso-ID for en virksomhed (CVR-1-…) eller person (CVR-3-…).`);
  const name = kind === "company" ? (await provider.company(lassoId)).name : (await provider.person(lassoId)).name;
  if (!name?.trim()) throw new NotFoundError(kind === "company" ? `Virksomheden ${lassoId}` : `Personen ${lassoId}`);
  const cvr = kind === "company" ? (cvrFromLassoId(lassoId) ?? undefined) : undefined;
  return { kind, name, ...(cvr ? { cvr } : {}) };
}
