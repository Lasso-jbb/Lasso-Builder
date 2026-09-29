import type { ActionResult } from "@lasso/ui";
import { PDF_SAVED, saveBlob, type FetchedPdf } from "../pdfDownload.js";
import { errorText, type PortalApi, type ViewResult } from "./api.js";
import { entityOf } from "./data.js";
import type { PortalRoute } from "./routes.js";

/**
 * "Gem som PDF" i portalen: virksomhedsfanen giver rapporten, personfanen siden med samme fokus, og
 * søgning og gemte sider den viste spec. Filen hentes med sessionen og gemmes med <a download>.
 */
export async function fetchPortalPdf(api: PortalApi, route: PortalRoute, result: ViewResult): Promise<FetchedPdf> {
  const entity = entityOf(result.spec, result.dataset);
  if (route.kind === "company" && entity?.kind === "company") return api.pdfCompany(entity.id, route.focus);
  if (route.kind === "person" && entity?.kind === "person") return api.pdfPerson(entity.id, route.focus);
  return api.pdfSpec(result.spec);
}

export async function savePortalPdf(
  api: PortalApi,
  route: PortalRoute,
  result: ViewResult | undefined,
  save: (blob: Blob, filename: string) => void = saveBlob,
): Promise<ActionResult> {
  if (!result) return { ok: false, error: "Siden er ikke hentet endnu." };
  try {
    const file = await fetchPortalPdf(api, route, result);
    save(file.blob, file.filename);
    return { ok: true, message: PDF_SAVED };
  } catch (e) {
    return { ok: false, error: errorText(e) };
  }
}
