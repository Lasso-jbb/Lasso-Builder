/**
 * Konverterer det simple HTML, Lassos regnskabsanalyse (`POST /modules/reportanalysis/{lassoId}`)
 * leverer, til ren tekst med afsnit og linjeskift, så `LassoTextSections` kan vise den uden at
 * gengive HTML (docs.lassox.com nævner `<br/>` og `<ul>`/`<li>` som eksempler).
 *
 * - `<br>`, `</p>` og `</li>` bliver til linjeskift; `<li>` får et foranstillet "• ".
 * - Alle andre tags (`<p>`, `<ul>`, `<b>` osv.) fjernes uden at røre teksten mellem dem.
 * - `<script>`/`<style>`-blokke fjernes med deres indhold (aldrig kørt eller vist).
 * - Standardentiteterne `&amp; &lt; &gt; &quot; &#39; &nbsp;` afkodes.
 */
export function htmlToText(html: string | undefined | null): string {
  if (!html) return "";
  let s = html;

  // Scripts/styles fjernes helt (indhold og alt), før noget andet sker.
  s = s.replace(/<script[\s\S]*?<\/script>/gi, "");
  s = s.replace(/<style[\s\S]*?<\/style>/gi, "");

  // Blokelementer bliver til linjeskift, før de selv fjernes som tags.
  s = s.replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(/<\/p\s*>/gi, "\n\n");
  s = s.replace(/<li[^>]*>/gi, "• ");
  s = s.replace(/<\/li\s*>/gi, "\n");

  // Resten af tags fjernes; kun den indesluttede tekst beholdes.
  s = s.replace(/<[^>]+>/g, "");

  s = decodeHtmlEntities(s);

  // Normaliser linjeskift: whitespace før et linjeskift væk, højst én tom linje i træk.
  return s
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Afkoder kun de entiteter, Lassos regnskabsanalyse er dokumenteret til at kunne indeholde. */
function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&");
}
