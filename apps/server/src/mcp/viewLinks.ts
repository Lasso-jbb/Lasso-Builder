import { isPersonId, toLassoId, type ViewSpec } from "@lasso/spec";
import { isCompanyRef } from "../data/lookup.js";
import type { McpContext } from "./server.js";

/**
 * Linkene i hvert visningssvar (structuredContent.links): share = et link til netop denne visning, open = portalens side for den ene
 * virksomhed eller person, visningen handler om (kun da). Klienterne bygger knapperne ud fra præcis disse felter.
 */
export interface ViewLinks {
  /** Portalen på den ene virksomhed eller person med visningen tilføjet som modul: /portal?aabn=<lassoId>&visning=<kort id>. */
  open?: string;
  /** Det enkleste link, der kun viser visningen i en browser: ${publicBaseUrl}/d/<kort id> (8–10 tegn, udløber efter LINK_TTL_DAYS). */
  share: string;
}

/** Det ene Lasso-ID, visningen handler om (company/person i komponenterne, alle ens), ellers undefined (flere, ingen eller et navn, der ikke er slået op). */
export function singleEntity(spec: ViewSpec, prefix: string): string | undefined {
  const ids = new Set<string>();
  for (const c of spec.components as { company?: unknown; person?: unknown; companies?: unknown; benchmark?: unknown }[]) {
    for (const raw of [c.company, c.person, c.benchmark, ...(Array.isArray(c.companies) ? c.companies : [])]) {
      if (typeof raw !== "string" || !raw) continue;
      const id = isPersonId(raw) ? raw.toUpperCase() : isCompanyRef(raw) ? toLassoId(raw, prefix) : `?${raw}`;
      ids.add(id);
    }
  }
  const [only] = ids.size === 1 ? [...ids] : [];
  return only && !only.startsWith("?") ? only : undefined;
}

export function portalOpenLink(publicBaseUrl: string, lassoId: string, shortId: string): string {
  return `${publicBaseUrl}/portal?aabn=${encodeURIComponent(lassoId)}&visning=${encodeURIComponent(shortId)}`;
}

/** Visningen uden opfølgningsknapper (websiden har ingen chat): det, der gemmes under det korte id. */
export function sharedSpec(spec: ViewSpec): ViewSpec {
  return { ...spec, components: spec.components.filter((c) => c.type !== "LassoFollowUps") };
}

/**
 * Linkene til et visningssvar. Visningen gemmes under et kort tilfældigt id (views/store.ts, saveShort; samme visning fra samme bruger
 * giver samme id): share er /d/<id>, og open (kun for én virksomhed/person) peger portalen på entiteten med visningen som ekstra modul
 * (visning=<id>). Kan visningen ikke gemmes, falder share tilbage til forsiden og open udelades, i stedet for at vælte svaret.
 */
export async function viewLinks(ctx: McpContext, spec: ViewSpec): Promise<ViewLinks> {
  const base = ctx.config.publicBaseUrl;
  const id = singleEntity(spec, ctx.config.LASSO_COMPANY_ID_PREFIX);
  const entity = id ? { kind: isPersonId(id) ? ("person" as const) : ("company" as const), id } : undefined;
  try {
    const saved = await ctx.store.saveShort({ org: ctx.user.org, owner: ctx.user.id, spec: sharedSpec(spec), entity, title: spec.title, subtitle: spec.subtitle }, ctx.config.LINK_TTL_DAYS);
    return { ...(entity ? { open: portalOpenLink(base, entity.id, saved.id) } : {}), share: `${base}/d/${saved.id}` };
  } catch {
    return { share: base };
  }
}
