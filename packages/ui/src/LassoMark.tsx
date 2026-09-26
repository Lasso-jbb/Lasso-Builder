/**
 * Lassos master-ikon (designkatalog 01B). Bygget af fem afrundede blokke, samme
 * form for alt fra favicon til skinne — aldrig et eget mobil- eller kompaktikon.
 * Ink-farvet på hvid, uden flise, kasse eller cirkel bagved (fundament, regel 20).
 */
export function LassoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 117 97" className={className} fill="currentColor" role="img" aria-label="Lasso">
      <rect width="117" height="17" rx="8" />
      <rect width="17" height="64" rx="8" />
      <rect x="100" width="17" height="64" rx="8" />
      <rect y="47" width="117" height="17" rx="8" />
      <rect y="80" width="17" height="17" rx="4" />
    </svg>
  );
}
