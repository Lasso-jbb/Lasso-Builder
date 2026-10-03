/**
 * Et sikkert "next"-mål efter login: kun en sti på samme oprindelse (starter med én "/", ikke "//" eller "/\"), uden tegn, en browser kan
 * tolke som anden vært eller script, og af rimelig længde. Alt andet giver undefined, så login falder tilbage til standardsiden.
 * Bruges af serveren (omdirigering til login) og af portalen (efter login), så begge siger det samme.
 */
export function safeNext(raw: unknown): string | undefined {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 2000) return undefined;
  if (!raw.startsWith("/") || raw.startsWith("//")) return undefined;
  // Styretegn og backslash i stien er aldrig noget, vi selv har lavet.
  if (/[\u0000-\u001f\u007f\\]/.test(raw)) return undefined;
  try {
    const u = new URL(raw, "https://same-origin.invalid");
    if (u.origin !== "https://same-origin.invalid") return undefined;
    return `${u.pathname}${u.search}${u.hash}`;
  } catch {
    return undefined;
  }
}
