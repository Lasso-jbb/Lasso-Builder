import { safeNext } from "@lasso/spec";

/**
 * Hvor portalen sender brugeren hen efter login: `next` i adresselinjen (sat af serverens omdirigering fra /portal?aabn=…),
 * kun hvis det er en sikker sti på samme oprindelse. Ellers undefined, og brugeren bliver på siden.
 */
export function nextAfterLogin(search: string): string | undefined {
  return safeNext(new URLSearchParams(search).get("next"));
}
