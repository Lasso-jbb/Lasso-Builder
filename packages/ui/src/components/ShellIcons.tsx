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
  | "tool"
  /* Katalog 08: genveje, kontakt og "Se alle"-panelet */
  | "network"
  | "document"
  | "trend"
  | "book"
  | "sparkle"
  | "clock"
  | "phone"
  | "mail"
  | "pin"
  | "globe"
  | "linkedin"
  | "copy"
  | "chevron-left"
  | "chevron-right"
  | "alert"
  | "lock"
  | "check";

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
  network: "M12 4.5a2 2 0 100 4 2 2 0 000-4zM5.5 15.5a2 2 0 100 4 2 2 0 000-4zM18.5 15.5a2 2 0 100 4 2 2 0 000-4zM12 8.5v3.5M12 12l-5.5 3.5M12 12l5.5 3.5",
  document: "M7 3.5h7l4 4v13H7zM14 3.5v4h4M10 12h5M10 15.5h5",
  trend: "M4 16l5-5 3.5 3.5L20 7M15 7h5v5",
  book: "M5 5.5A2.5 2.5 0 017.5 3H19v15H7.5A2.5 2.5 0 005 20.5zM5 20.5A2.5 2.5 0 007.5 23H19v-5",
  sparkle: "M12 3.5l1.8 5.2 5.2 1.8-5.2 1.8L12 17.5l-1.8-5.2L5 10.5l5.2-1.8zM18.5 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z",
  clock: "M12 21a9 9 0 100-18 9 9 0 000 18zM12 7.5V12l3 2",
  phone: "M5 4.5h3.2l1.4 4-2 1.6a11.5 11.5 0 006.3 6.3l1.6-2 4 1.4V19a1.5 1.5 0 01-1.6 1.5A15.5 15.5 0 013.5 6.1 1.5 1.5 0 015 4.5z",
  mail: "M4.5 5.5h15a1 1 0 011 1v11a1 1 0 01-1 1h-15a1 1 0 01-1-1v-11a1 1 0 011-1zM4.5 6.5l7.5 6 7.5-6",
  pin: "M12 21s7-6.1 7-11.5A7 7 0 105 9.5C5 14.9 12 21 12 21zM12 12a2.4 2.4 0 100-4.8 2.4 2.4 0 000 4.8z",
  globe: "M12 20.5a8.5 8.5 0 100-17 8.5 8.5 0 000 17zM3.7 12h16.6M12 3.5c2.4 2.5 3.8 5.6 3.8 8.5s-1.4 6-3.8 8.5c-2.4-2.5-3.8-5.6-3.8-8.5S9.6 6 12 3.5z",
  linkedin: "M4.5 4.5h15v15h-15zM8.5 10.5v5M8.5 8v.5M11.5 15.5v-5M11.5 12.5a2 2 0 014 0v3",
  copy: "M8.5 8.5h11v11h-11zM15.5 8.5v-4h-11v11h4",
  "chevron-left": "M14.5 6l-6 6 6 6",
  "chevron-right": "M9.5 6l6 6-6 6",
  alert: "M12 21a9 9 0 100-18 9 9 0 000 18zM12 7.5v5.5M12 16.2v.3",
  lock: "M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 017 0v3",
  check: "M5 12.5l4.5 4.5L19 7.5",
};

export function ShellIcon({ name, size = 15, filled = false, className }: { name: ShellIconName; size?: number; filled?: boolean; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}
