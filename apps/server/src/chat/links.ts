/**
 * Links i modellens tekst (docs/chat.md, "Modullinks"): `[Tekst](lasso:modul/<fokus>)`, `[Navn](lasso:firma/<id>)` og
 * `[Navn](lasso:person/<id>)`. Et firma- eller personlink, hvis id ikke har stået i turens værktøjssvar eller konteksten,
 * er opfundet og bliver til almindelig tekst; to ens links i samme tur bliver til ét. Samme regler gælder det, der
 * streames til browseren, og det, der gemmes i historikken (modellen ser så, hvad brugeren så).
 */

const LINK = /\[([^\]\n]*)\]\((lasso:(?:modul|firma|person)\/[^)\s]*)\)/g;
const ID = /CVR-[134]-\d+/gi;

/** Lasso-ID'erne i en tekst (store bogstaver), til mængden af tilladte id'er. */
export function idsIn(text: string): string[] {
  return [...text.matchAll(ID)].map((m) => m[0].toUpperCase());
}

/** Teksten med opfundne firma-/personlinks gjort til almindelig tekst og gentagne links fjernet (seen er turens mængde af viste links). */
export function sanitizeLinks(text: string, allowed: ReadonlySet<string>, seen: Set<string>): string {
  let removed = false;
  const out = text.replace(LINK, (whole, label: string, href: string) => {
    const [, kind, id = ""] = /^lasso:(modul|firma|person)\/(.*)$/.exec(href) ?? [];
    if (kind !== "modul" && !allowed.has(id.toUpperCase())) return label;
    if (seen.has(whole)) {
      removed = true;
      return "";
    }
    seen.add(whole);
    return whole;
  });
  return removed ? out.replace(/[ \t]{2,}/g, " ").replace(/[ \t]+\n/g, "\n") : out;
}

/**
 * Om begyndelsen af en tekst (der starter med "[") stadig kan blive til et lasso:-link: så venter filteret på mere.
 * Falsk, så snart det er klart, at det ikke er et (en ikke-lasso-parentes, et linjeskift, for langt).
 */
function couldBeLink(s: string): boolean {
  if (s.includes("\n") || s.length > 300) return false;
  const close = s.indexOf("]");
  if (close < 0) return true;
  const rest = s.slice(close + 1);
  if (!rest) return true;
  if (rest[0] !== "(") return false;
  const body = rest.slice(1);
  if (body.length < "lasso:".length) return "lasso:".startsWith(body);
  return body.startsWith("lasso:") && !/[\s]/.test(body.split(")")[0]!);
}

/**
 * Et filter til det streamede (deltaer kan dele et link): al tekst sendes straks, undtagen et muligt lasso:-link, som
 * holdes tilbage, til det er helt (så valideres det) eller viser sig ikke at være et. flush() giver resten ved svarets slutning.
 */
export function createLinkFilter(allowed: () => ReadonlySet<string>, seen: Set<string>) {
  let buf = "";
  const drain = (final: boolean): string => {
    let out = "";
    for (;;) {
      const at = buf.indexOf("[");
      if (at < 0) {
        out += buf;
        buf = "";
        return out;
      }
      out += buf.slice(0, at);
      buf = buf.slice(at);
      const m = /^\[[^\]\n]*\]\(lasso:[^)\s]*\)/.exec(buf);
      if (m) {
        out += sanitizeLinks(m[0], allowed(), seen);
        buf = buf.slice(m[0].length);
        continue;
      }
      if (!final && couldBeLink(buf)) return out;
      // Ikke et link: tegnet står, som det er, og resten undersøges videre.
      out += buf[0];
      buf = buf.slice(1);
    }
  };
  return {
    push: (delta: string): string => {
      buf += delta;
      return drain(false);
    },
    flush: (): string => drain(true),
  };
}
