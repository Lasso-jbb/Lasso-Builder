import type { ActionResult, ViewAction } from "@lasso/ui";

/** Beskeden, når et navn på en delt side ikke har et link (siden gav ikke adgang til det). */
export const NO_LINK = "Ingen adgang til den side";

/** Den delte side kan åbne navne, når serveren har lagt mindst ét link i boot'en. */
export function hasLinks(links: Readonly<Record<string, string>> | undefined): boolean {
  return Boolean(links && Object.keys(links).length);
}

/**
 * Delt side: "open-company"/"open-person" går til det signerede /e/-link, serveren har lagt i
 * boot'en for netop det Lasso-ID (samme fane). Uden link svarer den med en fejl, som værten viser.
 */
export function openFromLinks(
  links: Readonly<Record<string, string>> | undefined,
  a: Extract<ViewAction, { kind: "open-company" | "open-person" }>,
  navigate: (url: string) => void,
): ActionResult {
  const url = links?.[a.lassoId];
  if (!url) return { ok: false, error: NO_LINK };
  navigate(url);
  return { ok: true, url };
}

/**
 * Delt side: "open-focus" (overblikkets "Se alle … i Historik") går til det signerede /e/-link med
 * det fokus, serveren har lagt i boot'en (focusLinks). Signaturen dækker fokus, så siden kan ikke
 * selv skifte f= i adressen; uden link svarer den med en fejl.
 */
export function openFocusFromLinks(
  focusLinks: Readonly<Record<string, string>> | undefined,
  a: Extract<ViewAction, { kind: "open-focus" }>,
  navigate: (url: string) => void,
): ActionResult {
  const url = focusLinks?.[a.focus];
  if (!url) return { ok: false, error: NO_LINK };
  navigate(url);
  return { ok: true, url };
}
