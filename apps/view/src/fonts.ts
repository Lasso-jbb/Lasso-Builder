// Poppins indlejres i HTML-filen (kun latin, woff2, 400/500/600), så skriften
// virker i sandboxede MCP-værter uden adgang til eksterne fonte.
import w400 from "@fontsource/poppins/files/poppins-latin-400-normal.woff2?inline";
import w500 from "@fontsource/poppins/files/poppins-latin-500-normal.woff2?inline";
import w600 from "@fontsource/poppins/files/poppins-latin-600-normal.woff2?inline";

export function loadFonts(): void {
  if (typeof FontFace === "undefined" || !document.fonts) return;
  for (const [weight, src] of [["400", w400], ["500", w500], ["600", w600]] as const) {
    const face = new FontFace("Poppins", `url(${src}) format("woff2")`, { weight, style: "normal", display: "swap" });
    document.fonts.add(face);
    face.load().catch(() => {});
  }
}
