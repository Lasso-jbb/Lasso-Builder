/**
 * Små inline-ikoner til portalens ramme (katalog 06 og 26a). Ingen ikonbibliotek:
 * 24-grid, stroke 1.75, currentColor, så de arver tekstfarven (ink, muted eller koral).
 * Betydningen bæres altid af et ord ved siden af eller en aria-label (regel 7).
 */
export type ShellIconName =
  | "download"
  | "home"
  | "target"
  | "rss"
  | "info"
  | "plus"
  | "close"
  | "chevron-down"
  | "chevron-up"
  | "feedback"
  | "user"
  | "company"
  | "bookmark"
  | "bell"
  | "menu"
  | "search"
  | "list"
  | "more"
  | "tool";

const PATHS: Record<ShellIconName, string> = {
  download: "M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19h14",
  home: "M4 11l8-7 8 7M6 10v9h12v-9",
  target: "M4 7h16M4 12h10M4 17h6M17 15l2 2 3-3",
  rss: "M5 19a1 1 0 100-.1M5 12a7 7 0 017 7M5 5a14 14 0 0114 14",
  info: "M12 11v5M12 8v.5M12 21a9 9 0 100-18 9 9 0 000 18z",
  plus: "M12 5v14M5 12h14",
  close: "M6 6l12 12M18 6L6 18",
  "chevron-down": "M6 9.5l6 6 6-6",
  "chevron-up": "M6 14.5l6-6 6 6",
  feedback: "M4 5h16v11H9l-5 4V5zM9 10.5h.5M12 10.5h.5M15 10.5h.5",
  user: "M12 12a4 4 0 100-8 4 4 0 000 8zM4.5 20a7.5 7.5 0 0115 0",
  company: "M4 5h16v14H4zM9 5v14",
  bookmark: "M7 4h10v16l-5-3.5L7 20z",
  bell: "M18 8.5a6 6 0 10-12 0c0 6.5-2.5 6.5-2.5 8.5h17c0-2-2.5-2-2.5-8.5M10 20a2 2 0 004 0",
  menu: "M4 7h16M4 12h16M4 17h16",
  search: "M10.5 17a6.5 6.5 0 100-13 6.5 6.5 0 000 13zM20 20l-4.5-4.5",
  list: "M8 7h12M8 12h12M8 17h12M4 7h.5M4 12h.5M4 17h.5",
  more: "M6 12h.5M12 12h.5M18 12h.5",
  tool: "M14.5 5.5a4 4 0 00-5 5L4 16v4h4l5.5-5.5a4 4 0 005-5L15.5 12l-3.5-3.5z",
};

export function ShellIcon({ name, size = 15, filled = false, className }: { name: ShellIconName; size?: number; filled?: boolean; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}
