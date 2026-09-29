// Poppins indlejres i HTML-filen (kun latin, woff2, 400/500/600 og 700 til rapporten, katalog 27), så skriften
// virker i sandboxede MCP-værter uden adgang til eksterne fonte.
import w400 from "@fontsource/poppins/files/poppins-latin-400-normal.woff2?inline";
import w500 from "@fontsource/poppins/files/poppins-latin-500-normal.woff2?inline";
import w600 from "@fontsource/poppins/files/poppins-latin-600-normal.woff2?inline";
import w700 from "@fontsource/poppins/files/poppins-latin-700-normal.woff2?inline";

const FILES = { "400": w400, "500": w500, "600": w600, "700": w700 } as const;

/**
 * @font-face-regler med de samme indlejrede filer, til PDF'ens sidehoved og sidefod (Chromiums
 * skabeloner kan ikke se sidens egne fonte, men kan læse data-URL'er).
 */
export function fontFaceCss(weights: readonly (keyof typeof FILES)[] = ["400", "600"]): string {
  return weights.map((w) => `@font-face{font-family:"Poppins";font-style:normal;font-weight:${w};src:url(${FILES[w]}) format("woff2")}`).join("");
}

export function loadFonts(): void {
  if (typeof FontFace === "undefined" || !document.fonts) return;
  for (const [weight, src] of [["400", w400], ["500", w500], ["600", w600], ["700", w700]] as const) {
    const face = new FontFace("Poppins", `url(${src}) format("woff2")`, { weight, style: "normal", display: "swap" });
    document.fonts.add(face);
    face.load().catch(() => {});
  }
}
