/**
 * Udskriv (og dermed "Gem som PDF") ét element på siden: resten skjules under udskriften
 * (styles.css, "Udskrift af ét element"). Bruges af revisoruafhængighedens og ejerdiagrammets
 * PDF-eksport. Uden browser (SSR, tests) gør den ingenting og svarer false.
 */
export function printElement(el: HTMLElement | null): boolean {
  if (!el || typeof window === "undefined" || typeof document === "undefined" || typeof window.print !== "function") return false;
  const root = document.documentElement;
  el.classList.add("lasso-print-target");
  root.classList.add("lasso-printing");
  const done = () => {
    el.classList.remove("lasso-print-target");
    root.classList.remove("lasso-printing");
    window.removeEventListener("afterprint", done);
  };
  window.addEventListener("afterprint", done);
  try {
    window.print();
  } finally {
    // Nogle browsere sender aldrig afterprint (fx i en iframe); ryd op efter udskriftsdialogen.
    setTimeout(done, 1000);
  }
  return true;
}
