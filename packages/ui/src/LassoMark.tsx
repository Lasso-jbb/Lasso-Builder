/**
 * Lassos master-ikon (designkatalog 01B, node IFL-0). Præcis vektor fra Paper,
 * viewBox 117×97 — samme form for alt fra favicon til skinne, aldrig et eget
 * mobil- eller kompaktikon. Ink-farvet på hvid, uden flise, kasse eller cirkel
 * bagved (fundament, regel 20).
 */
export function LassoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 117 97" className={className} fill="currentColor" role="img" aria-label="Lasso">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M0 18.2V63.2L1.3 64.3L2.8 64.8H14L15.3 64.2L16.3 62.5V61.3L16.7 60.7V19L17 17.8L18 16.8L19.3 16H95.5L96.2 16.3H97.5L99.2 17.3L99.8 18.3V62.7L99.7 63.2L98.8 64L97 65H18.8L18.3 65.2L17.5 65.8L16.8 67.2V77.5L16.2 79.5L15 80.7L13.8 81.2H2.3L0 82.7V95.7L1.2 96L1.5 96.8H15.3L15.5 96.2L16.3 95.5V94.3L16.7 93.7V83.3L18.7 81.2H19.2L97 81L98.3 80.5L99.3 79.5L99.7 78.8V68L100 66.8L102.2 64.8H114.2L115.3 64.2L116 62.8L116.8 62.2V61.8L116.5 61.7V19.5L115.8 18L114.5 16.5H113.3L112.7 16.2H102.2L100.5 15.2L100 14.5L99.7 12.8V2.3L98.5 0.8L97.7 0.7L97.2 0H18.7L18.3 0.7L16.8 2.2V12.5L16.5 13.2V14.3L16 15L14.5 16.2H3.2L1.3 16.8Z"
      />
    </svg>
  );
}
