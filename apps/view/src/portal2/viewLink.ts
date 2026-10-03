import type { PageTemplate, SaveTemplateBody, StoredView } from "../portal/api.js";
import { templateTab } from "./model.js";

/**
 * "Åben i Lasso" fra MCP-appen med en gemt visning (Jakob 03.10): /portal?aabn=<Lasso-ID>&visning=<kort id>. Portalen
 * åbner entitetens fane, henter visningen (GET /api/portal/visning/<id>) og viser den som et modul: findes der allerede en
 * egen side med den (existingTemplateId), skiftes der dertil; ellers gemmes den som egen side (sideskabelon) og vises.
 * Den røde nål viser, at modulet er tilføjet, til den fjernes. Fanen fastgøres ikke. Ren logik med api'et som parameter,
 * så forløbet kan testes uden React.
 */
export type { StoredView };

export interface ViewLinkApi {
  visning: (id: string) => Promise<StoredView>;
  saveTemplate: (body: SaveTemplateBody) => Promise<PageTemplate>;
}

/** Resultatet: modulet, fanen skal stå på (Overblik ved fejl), evt. den nye egen side og en kort besked ved fejl. */
export interface ViewLinkResult {
  tab: string;
  template?: PageTemplate;
  notice?: string;
}

const statusOf = (e: unknown): number | undefined => (typeof (e as { status?: unknown })?.status === "number" ? (e as { status: number }).status : undefined);

/** Korte danske beskeder; brugeren står så på entitetens Overblik. */
export function viewLinkError(e: unknown): string {
  const status = statusOf(e);
  if (status === 404 || status === 410) return "Visningen findes ikke længere. Bed om et nyt link.";
  // Demobrugeren gemmer egne sider i browseren (localTemplates.ts), så 403 er kun en sjælden afvisning fra serveren.
  if (status === 403) return "Visningen kunne ikke tilføjes som modul.";
  if (status === 401) return "Log ind for at åbne visningen.";
  if (status === 400) return (e as Error).message || "Visningen kunne ikke tilføjes som modul.";
  return "Visningen kunne ikke åbnes. Prøv linket igen.";
}

export async function runViewLink(link: { kind: "company" | "person"; id: string; view: string }, api: ViewLinkApi): Promise<ViewLinkResult> {
  try {
    const v = await api.visning(link.view);
    // Visningen hører til en anden virksomhed eller person end linket: vis den ikke på den forkerte fane.
    if (v.entity.id.toUpperCase() !== link.id.toUpperCase() || v.entity.kind !== link.kind) return { tab: "overblik", notice: "Linket passer ikke til visningen. Bed om et nyt link." };
    if (v.existingTemplateId) return { tab: templateTab(v.existingTemplateId) };
    const tpl = await api.saveTemplate({ kind: v.entity.kind, title: v.title, ...(v.subtitle ? { subtitle: v.subtitle } : {}), spec: v.spec, entity: v.entity });
    return { tab: templateTab(tpl.id), template: tpl };
  } catch (e) {
    return { tab: "overblik", notice: viewLinkError(e) };
  }
}
