import { createHash } from "node:crypto";
import { FOCUS_LABELS, PERSON_FOCUS_LABELS, PERSON_FOCUSES, FOCUSES, isPersonId, pageFocus, toLassoId, type Focus, type PersonFocus, type ViewSpec } from "@lasso/spec";
import { isCompanyRef } from "../data/lookup.js";
import { saveView } from "../usecases/views.js";
import type { McpContext } from "./server.js";

/**
 * Linkene i hvert visningssvar (structuredContent.links): share = et link til netop denne visning, open = portalens side for den ene
 * virksomhed eller person, visningen handler om (kun da). Klienterne bygger knapperne ud fra præcis disse felter.
 */
export interface ViewLinks {
  /** Portalen på den ene virksomhed eller person, fokuseret på visningens modul og fastgjort som fane: /portal?aabn=<lassoId>&fokus=<fokus>&fastgoer=1. */
  open?: string;
  /** Delbart link til visningen: den signerede entitetsside (show_company/show_person), ellers en gemt visning (/v/<org>/<adresse>, visibility link). */
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

/** Visningens modul (fokus), når undertitlen er et modulnavn (show_company/show_person med et fokus); ellers overblik. */
function focusOf(spec: ViewSpec, lassoId: string): Focus | PersonFocus {
  if (isPersonId(lassoId)) return PERSON_FOCUSES.find((f) => PERSON_FOCUS_LABELS[f] === spec.subtitle) ?? "overblik";
  const f = FOCUSES.find((x) => FOCUS_LABELS[x] === spec.subtitle);
  return f ? pageFocus(f) : "overblik";
}

export function portalOpenLink(publicBaseUrl: string, lassoId: string, focus: string): string {
  return `${publicBaseUrl}/portal?aabn=${encodeURIComponent(lassoId)}&fokus=${encodeURIComponent(focus)}&fastgoer=1`;
}

/**
 * Linkene til et visningssvar. share er `link` (den signerede entitetsside), når værktøjet har en; ellers gemmes visningen (samme mekanisme
 * som save_view: en adresse ud fra specens indhold, så samme visning giver samme link). Chatten (host chat) gemmer intet: den viser selv visningen.
 */
export async function viewLinks(ctx: McpContext, spec: ViewSpec, link?: string): Promise<ViewLinks> {
  const base = ctx.config.publicBaseUrl;
  const entity = singleEntity(spec, ctx.config.LASSO_COMPANY_ID_PREFIX);
  const open = entity ? portalOpenLink(base, entity, focusOf(spec, entity)) : undefined;
  if (link) return { ...(open ? { open } : {}), share: link };
  if (ctx.host === "chat") return { ...(open ? { open } : {}), share: `${base}/portal` };
  const slug = `v-${createHash("sha1").update(JSON.stringify(spec)).digest("hex").slice(0, 12)}`;
  // Kan visningen ikke gemmes, falder share tilbage til forsiden i stedet for at vælte hele svaret.
  const saved = await saveView(ctx, { spec, slug, name: spec.title, visibility: "link" }).catch(() => ({ error: "gem fejlede" }));
  return { ...(open ? { open } : {}), share: "error" in saved ? base : saved.url };
}
