/**
 * Lassos ikonsæt (katalog 01 Fundament, node 9B9-0). Ét sæt til hele UI'et, intet ikonbibliotek:
 * 24-grid, streg 1,8, runde ender og hjørner, currentColor, så ikonet arver tekstfarven
 * (ink, muted eller koral). Størrelser: 14 px i felter, 16–18 px i knapper og skinne, 20 px i
 * topbjælken. Ikonet står altid alene på hvid flade, aldrig i en grå flise eller cirkel (regel 20).
 * Betydningen bæres altid af et ord ved siden af eller en aria-label (regel 7).
 *
 * De 20 ikoner fra kataloget står først (Søg … Virksomhed); resten er afledte ikoner, som
 * rammen og dataelementerne bruger (kontaktikoner, pile, "hjem" osv.) i samme streg.
 */
export const CATALOG_ICONS = [
  "search",
  "chevron-down",
  "chevron-right",
  "check",
  "close",
  "plus",
  "export",
  "edit",
  "more",
  "info",
  "trash",
  "undo",
  "saved",
  "list",
  "overview",
  "sidepanel",
  "bell",
  "user",
  "ai",
  "company",
] as const;

export type CatalogIconName = (typeof CATALOG_ICONS)[number];

export type IconName =
  | CatalogIconName
  | "chevron-up"
  | "chevron-left"
  | "arrow-right"
  | "download"
  | "bookmark"
  | "home"
  | "target"
  | "rss"
  | "feedback"
  | "menu"
  | "tool"
  | "phone"
  | "mail"
  | "pin"
  | "globe"
  | "copy"
  | "map"
  | "network"
  | "chart"
  | "minus"
  | "alert"
  | "document"
  | "trend"
  | "book"
  | "sparkle"
  | "clock"
  | "linkedin"
  | "lock"
  | "share";

/** Danske navne på katalogets 20 ikoner, i katalogets rækkefølge (til aria-label og oversigter). */
export const ICON_LABELS: Record<CatalogIconName, string> = {
  search: "Søg",
  "chevron-down": "Chevron ned",
  "chevron-right": "Chevron højre",
  check: "Flueben",
  close: "Luk",
  plus: "Plus",
  export: "Eksportér",
  edit: "Redigér",
  more: "Flere",
  info: "Info",
  trash: "Slet",
  undo: "Fortryd",
  saved: "Gemt",
  list: "Liste",
  overview: "Oversigt",
  sidepanel: "Sidepanel",
  bell: "Notifikation",
  user: "Bruger",
  ai: "AI",
  company: "Virksomhed",
};

const PATHS: Record<IconName, string> = {
  search: "M10.5 17a6.5 6.5 0 100-13 6.5 6.5 0 000 13zM20 20l-4.5-4.5",
  "chevron-down": "M6 9.5l6 6 6-6",
  "chevron-right": "M9.5 6l6 6-6 6",
  check: "M5 12.5l4.5 4.5L19 7.5",
  close: "M6 6l12 12M18 6L6 18",
  plus: "M12 5v14M5 12h14",
  export: "M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19h14",
  edit: "M4.5 19.5l1-4L15.8 5.2a2 2 0 012.9 0l.1.1a2 2 0 010 2.9L8.5 18.5l-4 1zM13.5 7.5l3 3",
  more: "M5 12a1 1 0 102 0 1 1 0 10-2 0zM11 12a1 1 0 102 0 1 1 0 10-2 0zM17 12a1 1 0 102 0 1 1 0 10-2 0z",
  info: "M12 11v5M12 8h.01M12 21a9 9 0 100-18 9 9 0 000 18z",
  trash: "M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 12.5h9l1-12.5M10.5 11v5M13.5 11v5",
  undo: "M9 5L4.5 9.5 9 14M4.5 9.5H15a4.5 4.5 0 010 9h-3",
  saved: "M7 4h10v16l-5-3.5L7 20z",
  list: "M5 7h14M5 12h14M5 17h9", /* 01.6/26a.3: tre streger uden prikker */
  overview: "M4.5 4.5h6v6h-6zM13.5 4.5h6v6h-6zM4.5 13.5h6v6h-6zM13.5 13.5h6v6h-6z",
  sidepanel: "M4 5h16v14H4zM15 5v14",
  bell: "M18 8.5a6 6 0 10-12 0c0 6.5-2.5 6.5-2.5 8.5h17c0-2-2.5-2-2.5-8.5M10 20a2 2 0 004 0",
  user: "M12 12a4 4 0 100-8 4 4 0 000 8zM4.5 20a7.5 7.5 0 0115 0",
  ai: "M11 4l1.6 4.4L17 10l-4.4 1.6L11 16l-1.6-4.4L5 10l4.4-1.6zM18 15l.7 1.8 1.8.7-1.8.7L18 20l-.7-1.8-1.8-.7 1.8-.7z",
  company: "M4 20V5h10v15M14 9h6v11M3 20h18M7.5 8.5h3M7.5 12h3M7.5 15.5h3M17 12.5v.01M17 16v.01",
  "chevron-up": "M6 14.5l6-6 6 6",
  "chevron-left": "M14.5 6l-6 6 6 6",
  "arrow-right": "M5 12h14M13 6l6 6-6 6",
  download: "M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19h14",
  bookmark: "M7 4h10v16l-5-3.5L7 20z",
  home: "M4 11l8-7 8 7M6 10v9h12v-9",
  target: "M4 7h16M4 12h10M4 17h6M17 15l2 2 3-3",
  rss: "M5 19h.01M5 12a7 7 0 017 7M5 5a14 14 0 0114 14",
  feedback: "M4 5h16v11H9l-5 4V5zM9 10.5h.01M12 10.5h.01M15 10.5h.01",
  menu: "M4 7h16M4 12h16M4 17h16",
  tool: "M14.5 5.5a4 4 0 00-5 5L4 16v4h4l5.5-5.5a4 4 0 005-5L15.5 12l-3.5-3.5z",
  phone: "M5 4.5h3.2l1.4 4-2 1.6a11.5 11.5 0 006.3 6.3l1.6-2 4 1.4V19a1.5 1.5 0 01-1.6 1.5A15.5 15.5 0 013.5 6.1 1.5 1.5 0 015 4.5z",
  mail: "M3.5 5.5h17v13h-17zM4.5 6.5l7.5 6 7.5-6",
  pin: "M12 21s7-6.1 7-11.5A7 7 0 105 9.5C5 14.9 12 21 12 21zM12 11.9a2.4 2.4 0 100-4.8 2.4 2.4 0 000 4.8z",
  globe: "M12 20.5a8.5 8.5 0 100-17 8.5 8.5 0 000 17zM3.7 12h16.6M12 3.5c2.4 2.5 3.8 5.6 3.8 8.5s-1.4 6-3.8 8.5c-2.4-2.5-3.8-5.6-3.8-8.5S9.6 6 12 3.5z",
  copy: "M9 9h11v11H9zM5 15H4V4h11v1",
  map: "M3.5 6.5l5.5-2 6 2 5.5-2v13l-5.5 2-6-2-5.5 2zM9 4.5v13M15 6.5v13",
  network: "M6 8.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM18 8.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM12 20.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM7.5 8l3.3 7.8M16.5 8l-3.3 7.8M8.5 6h7",
  chart: "M4 20h16M7 16v-5M12 16V6M17 16v-8",
  minus: "M5 12h14",
  alert: "M12 21a9 9 0 100-18 9 9 0 000 18zM12 7.5v5M12 16h.01", /* 02c.16: udråbstegn i cirkel */
  document: "M7 3.5h7l4 4v13H7zM14 3.5v4h4M10 12h5M10 15.5h5",
  trend: "M4 16l5-5 3.5 3.5L20 7M15 7h5v5",
  book: "M5 5.5A2.5 2.5 0 017.5 3H19v15H7.5A2.5 2.5 0 005 20.5zM5 20.5A2.5 2.5 0 007.5 23H19v-5",
  sparkle: "M12 3.5l1.8 5.2 5.2 1.8-5.2 1.8L12 17.5l-1.8-5.2L5 10.5l5.2-1.8zM18.5 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z",
  clock: "M12 21a9 9 0 100-18 9 9 0 000 18zM12 7.5V12l3 2",
  linkedin: "M4.5 4.5h15v15h-15zM8.5 10.5v5M8.5 8v.5M11.5 15.5v-5M11.5 12.5a2 2 0 014 0v3",
  lock: "M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 017 0v3",
  share: "M17.5 8a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM6.5 14.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM17.5 21a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM8.7 10.8l6.6-3.6M8.7 13.2l6.6 3.6", /* 26g.1: del-ikon i tilbage-topbjælken */
};

export interface IconProps {
  name: IconName;
  /** Px. 14 i felter, 16–18 i knapper og skinne, 20 i topbjælken. */
  size?: number;
  /** Fyldt form (fx "Gemt" og aktiv klokke). */
  filled?: boolean;
  className?: string;
  /** Sat = ikonet bærer selv betydningen (role=img); ellers aria-hidden. */
  label?: string;
}

/** Streg 1,8 (katalog 01). Eneste sted stregen står. */
export const ICON_STROKE = 1.8;

export function Icon({ name, size = 16, filled = false, className, label }: IconProps) {
  return (
    <svg
      className={className ? `lasso-icon ${className}` : "lasso-icon"}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={ICON_STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
