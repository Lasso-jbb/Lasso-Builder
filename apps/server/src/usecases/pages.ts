import { isPersonId, toLassoId, viewSpecSchema, type Dataset, type Focus, type SavedPageKind, type ViewSpec } from "@lasso/spec";
import { findCompany, isCompanyRef, normalizeCompanyName } from "../data/lookup.js";
import { findPerson } from "../data/personLookup.js";
import { errorMessage, resolveSpec } from "../data/resolve.js";
import { entitySnapshot, savedFocus } from "../pages/resolveExtras.js";
import { pageKindOf, SavedPageError, type SavedPageRecord, type SavedPageStore } from "../pages/store.js";
import { entityLink } from "../web/links.js";
import { extrasOf, fail, type UseCaseCtx, type UseCaseError } from "./context.js";

/*
 * Gem-laget (docs/gem-lag.md): brugerens personlige liste af gemte virksomheder og personer.
 * Delt af save_page/list_saved_pages/remove_saved_page og /api/portal/pages.
 */

/** "1 gemt side" / "3 gemte sider". */
const savedCount = (n: number) => (n === 1 ? "1 gemt side" : `${n} gemte sider`);

/** "LASSO X A/S (CVR 34580820)" eller "Bo Eksempel (CVR-3-4000000001)". */
const pageLabel = (p: Pick<SavedPageRecord, "name" | "cvr" | "lassoId">) => `${p.name} (${p.cvr ? `CVR ${p.cvr}` : p.lassoId})`;

const totalSaved = async (ctx: UseCaseCtx) => (await ctx.pages.list(ctx.user.org, ctx.user.id, { limit: 1 })).total;

/**
 * Et Lasso-ID eller CVR-nummer som entitets-ID (CVR-1-… virksomhed, CVR-3-/CVR-4-… person).
 * null = referencen er et navn; { error } = den ligner et ID, men er ikke en virksomhed eller person.
 */
function entityRef(ref: string, prefix: string): { lassoId: string; kind: SavedPageKind } | { error: string } | null {
  if (isPersonId(ref)) {
    const lassoId = ref.toUpperCase();
    const kind = pageKindOf(lassoId);
    return kind ? { lassoId, kind } : { error: `"${ref}" er ikke et gyldigt person-ID (CVR-3-…).` };
  }
  if (!isCompanyRef(ref)) return null;
  const lassoId = toLassoId(ref, prefix).toUpperCase();
  const kind = pageKindOf(lassoId);
  return kind ? { lassoId, kind } : { error: `"${ref}" er ikke et CVR-nummer eller Lasso-ID for en virksomhed (CVR-1-…) eller person (CVR-3-…).` };
}

/** Gemte sider, hvis navn matcher: præcist (uden forskel på store/små bogstaver), ellers uden selskabsform, ellers som del af navnet. */
function matchSavedByName(pages: readonly SavedPageRecord[], name: string): SavedPageRecord[] {
  const lower = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  const wanted = lower(name);
  const exact = pages.filter((p) => lower(p.name) === wanted);
  if (exact.length) return exact;
  const bare = normalizeCompanyName(name);
  const withoutForm = bare ? pages.filter((p) => normalizeCompanyName(p.name) === bare) : [];
  if (withoutForm.length) return withoutForm;
  return wanted ? pages.filter((p) => lower(p.name).includes(wanted)) : [];
}

/* --- save_page / POST /api/portal/pages --------------------------------------------------- */

export interface SavePageInput {
  /** Lasso-ID (CVR-1-… / CVR-3-…), CVR-nummer eller navn. */
  page: string;
  /** Kun ved navn: "person" slår en person op. Standard: virksomhed. */
  kind?: SavedPageKind;
  focus?: Focus;
  /** Brugerens egen note til siden. */
  note?: string;
}

export interface SavedPageResult {
  lassoId: string;
  kind: SavedPageKind;
  name: string;
  cvr?: string;
  savedAt: string;
  /** true = ny på listen; false = var der i forvejen og er flyttet øverst. */
  created: boolean;
  total: number;
  /** Signeret link til /e/<lassoId> med den gemte focus. */
  url: string;
}

export interface SavePageOutcome extends SavedPageResult {
  /** "Gemt: … Du har nu …" (MCP-toolets tekst). */
  message: string;
  /** Hvilket navn der blev valgt ved navneopslag, og evt. andre match. */
  lookupNote?: string;
}

export async function savePage(ctx: UseCaseCtx, input: SavePageInput): Promise<SavePageOutcome | UseCaseError> {
  const { config, provider, pages, user } = ctx;
  const { kind, focus, note } = input;
  const ref = input.page.trim();
  let target = entityRef(ref, config.LASSO_COMPANY_ID_PREFIX);
  let found: string | undefined;
  if (target && "error" in target) return fail(400, target.error);
  if (!target) {
    // Et navn: person, hvis kind siger det; ellers virksomhed (som show_person/show_company).
    try {
      if (kind === "person") {
        const hit = await findPerson(provider, ref);
        if (!hit) return fail(404, `Fandt ingen person, der hedder "${ref}". Prøv med fulde navn eller person-ID'et (CVR-3-…).`);
        target = { lassoId: hit.pick.lassoId, kind: "person" };
        const alt = hit.alternatives.map((r) => `${r.name}${r.city ? `, ${r.city}` : ""} (${r.lassoId})`).join("; ");
        found = `Fundet ud fra navnet "${ref}": ${hit.pick.name} (${hit.pick.lassoId}).${alt ? ` Andre match: ${alt}.` : ""}`;
      } else {
        const hit = await findCompany(provider, ref);
        if (!hit) return fail(404, `Fandt ingen virksomhed, der hedder "${ref}". Prøv et andet navn eller CVR-nummeret, eller angiv kind 'person' for en person.`);
        target = { lassoId: hit.pick.lassoId, kind: "company" };
        const alt = hit.alternatives.map((r) => `${r.name} (${r.cvr ?? r.lassoId})`).join("; ");
        found = `Fundet ud fra navnet "${ref}": ${hit.pick.name} (${hit.pick.cvr ?? hit.pick.lassoId}).${alt ? ` Andre match: ${alt}.` : ""}`;
      }
    } catch (err) {
      return fail(404, `Kunne ikke slå "${ref}" op: ${errorMessage(err)}.`);
    }
    if (found?.includes("Andre match")) found += " Mente brugeren en anden, så fjern den med remove_saved_page og gem den rigtige med ID'et.";
  }
  const { lassoId } = target;
  let snapshot: Awaited<ReturnType<typeof entitySnapshot>>;
  try {
    snapshot = await entitySnapshot(provider, lassoId);
  } catch (err) {
    if (err instanceof SavedPageError) return fail(400, err.message);
    return fail(404, `Kunne ikke hente ${ref}: ${errorMessage(err)}. Tjek CVR-nummeret, ID'et eller navnet.`);
  }
  let saved: Awaited<ReturnType<SavedPageStore["save"]>>;
  try {
    saved = await pages.save({ org: user.org, userId: user.id, lassoId, kind: snapshot.kind, name: snapshot.name, cvr: snapshot.cvr, focus, note, origin: "manual" });
  } catch (err) {
    if (err instanceof SavedPageError) return fail(400, err.message);
    throw err;
  }
  const { page: rec, created } = saved;
  const total = await totalSaved(ctx);
  const url = entityLink(config, rec.lassoId, { focus: savedFocus(rec.focus) });
  return {
    lassoId: rec.lassoId,
    kind: rec.kind,
    name: rec.name,
    ...(rec.cvr ? { cvr: rec.cvr } : {}),
    savedAt: rec.savedAt,
    created,
    total,
    url,
    message: `${created ? "Gemt" : "Allerede gemt, flyttet øverst"}: ${pageLabel(rec)}. Du har nu ${savedCount(total)}.`,
    ...(found ? { lookupNote: found } : {}),
  };
}

/* --- list_saved_pages / GET /api/portal/pages --------------------------------------------- */

export interface ListSavedPagesInput {
  /** Standard: all. */
  kind?: SavedPageKind | "all";
  /** 1–100, nyeste først. Standard: 20. */
  limit?: number;
}

/** Brugerens gemte sider som en LassoSavedPages-visning med friske, signerede links. */
export async function listSavedPages(ctx: UseCaseCtx, input: ListSavedPagesInput = {}): Promise<{ spec: ViewSpec; dataset: Dataset }> {
  const { kind = "all", limit = 20 } = input;
  const spec = viewSpecSchema.parse({
    version: 2,
    kind: "custom",
    title: kind === "company" ? "Mine gemte virksomheder" : kind === "person" ? "Mine gemte personer" : "Mine gemte sider",
    layout: "stack",
    criteria: [],
    components: [{ type: "LassoSavedPages", kind, limit }],
  });
  const dataset = await resolveSpec(spec, ctx.provider, extrasOf(ctx));
  return { spec, dataset };
}

/* --- remove_saved_page / DELETE /api/portal/pages/:lassoId -------------------------------- */

export interface RemovedPageResult {
  lassoId: string;
  /** false = siden var ikke på listen (ingen fejl). */
  removed: boolean;
  total: number;
}

/**
 * Fjerner én side fra brugerens liste. Tager Lasso-ID, CVR-nummer eller navn; et navn matches kun
 * mod brugerens egne gemte sider (ingen opslag hos Lasso).
 */
export async function removeSavedPage(ctx: UseCaseCtx, input: { page: string }): Promise<(RemovedPageResult & { message: string }) | UseCaseError> {
  const { config, pages, user } = ctx;
  const ref = input.page.trim();
  const target = entityRef(ref, config.LASSO_COMPANY_ID_PREFIX);
  if (target && "error" in target) return fail(400, target.error);
  let lassoId: string;
  let label: string;
  if (target) {
    lassoId = target.lassoId;
    const existing = await pages.get(user.org, user.id, lassoId);
    label = existing?.name ?? lassoId;
  } else {
    const { pages: mine } = await pages.list(user.org, user.id, { limit: 100 });
    const hits = matchSavedByName(mine, ref);
    if (hits.length === 0) return fail(404, `Der er ingen gemt side, der hedder "${ref}". Brug list_saved_pages for at se listen, eller angiv CVR-nummeret eller ID'et.`);
    if (hits.length > 1) {
      const listed = `${hits.slice(0, 10).map(pageLabel).join("; ")}${hits.length > 10 ? ` og ${hits.length - 10} flere` : ""}`;
      return fail(400, `Flere gemte sider passer på "${ref}": ${listed}. Angiv CVR-nummeret eller ID'et på den, der skal fjernes.`);
    }
    lassoId = hits[0]!.lassoId;
    label = hits[0]!.name;
  }
  const removed = await pages.remove(user.org, user.id, lassoId);
  const total = await totalSaved(ctx);
  return { lassoId, removed, total, message: removed ? `Fjernet: ${label}. Du har nu ${savedCount(total)}.` : `${label} var ikke på listen.` };
}
