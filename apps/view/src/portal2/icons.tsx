/**
 * Ikonerne fra portal-prototypen (lasso-portal4.html): 24 × 24, streg 1,5, runde ender.
 * Tegnes med currentColor, så knappens farve (grå, sort, koral) styrer dem.
 */
const PATHS = {
  search: (
    <>
      <circle cx="11" cy="11" r="6.75" />
      <path d="M16 16l4 4" />
    </>
  ),
  bell: (
    <>
      <path d="M17.5 9a5.5 5.5 0 10-11 0c0 6-2.5 6.5-2.5 8.25h16C20 15.5 17.5 15 17.5 9" />
      <path d="M13.75 20.25a2 2 0 01-3.5 0" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8.5" r="3.75" />
      <path d="M5 19.75c1.25-3.25 3.9-5.25 7-5.25s5.75 2 7 5.25" />
    </>
  ),
  rss: (
    <>
      <circle cx="6.5" cy="17.5" r="1.75" fill="currentColor" stroke="none" />
      <path d="M5.5 10.5a8 8 0 0 1 8 8" />
      <path d="M5.5 4.5a14 14 0 0 1 14 14" />
    </>
  ),
  book: <path d="M7.25 4.5h9.5a1 1 0 0 1 1 1v14l-5.75-4-5.75 4v-14a1 1 0 0 1 1-1z" />,
  /** Sideskabelonens nål i modulrækken: fyldt rød = modulet er tilføjet på alle firmaer/personer. */
  pin: <path d="M8.5 4h7M9.75 4v4.75L7.25 12.5h9.5l-2.5-3.75V4M12 12.5v7.5" />,
  plus: (
    <>
      <circle cx="12" cy="12" r="8.75" />
      <path d="M12 8.25v7.5M8.25 12h7.5" />
    </>
  ),
  grid: (
    <>
      <rect x="4.5" y="4.5" width="6" height="6" rx="1.2" />
      <rect x="13.5" y="4.5" width="6" height="6" rx="1.2" />
      <rect x="4.5" y="13.5" width="6" height="6" rx="1.2" />
      <rect x="13.5" y="13.5" width="6" height="6" rx="1.2" />
    </>
  ),
  folder: <path d="M3.75 7.25a1.5 1.5 0 0 1 1.5-1.5h4l2 2h7.5a1.5 1.5 0 0 1 1.5 1.5v8.5a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5z" />,
  bolt: <path d="M13 3.75L5.75 13.5h6l-1 6.75 7.5-9.75h-6z" />,
  card: (
    <>
      <rect x="3.75" y="5.75" width="16.5" height="12.5" rx="1.75" />
      <path d="M3.75 10h16.5M7 14.5h3" />
    </>
  ),
  plug: <path d="M9 3.75v4M15 3.75v4M6.75 7.75h10.5v3a5.25 5.25 0 0 1-10.5 0zM12 16v4.25" />,
  build: <path d="M5 20.25V5.25l7-1.5v16.5M12 9.25l7 1.75v9.25M3.5 20.25h17" />,
  layers: <path d="M12 4l8.25 4.25L12 12.5 3.75 8.25zM3.75 12.25L12 16.5l8.25-4.25M3.75 16L12 20.25 20.25 16" />,
  users: (
    <>
      <circle cx="9" cy="8.5" r="3.25" />
      <path d="M3.5 19.25c.9-2.9 3-4.5 5.5-4.5s4.6 1.6 5.5 4.5" />
      <circle cx="16.5" cy="9" r="2.5" />
      <path d="M15.75 14.25c2.1 0 3.9 1.4 4.75 4" />
    </>
  ),
  back: <path d="M14.5 6l-6 6 6 6" />,
  down: <path d="M6 9l6 6 6-6" />,
  enter: <path d="M19 6v6.5a2 2 0 0 1-2 2H6M9.5 11L6 14.5 9.5 18" />,
  stop: <rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor" stroke="none" />,
  x: <path d="M7 7l10 10M17 7L7 17" />,
  add: <path d="M12 5.5v13M5.5 12h13" />,
  check: <path d="M5.5 12.5l4 4 9-9" />,
  chart: <path d="M5 19.5h14M7.5 16v-4M12 16V8M16.5 16v-6" />,
  org: (
    <>
      <rect x="9.5" y="3.75" width="5" height="4.5" rx="1" />
      <rect x="3.75" y="15.75" width="5" height="4.5" rx="1" />
      <rect x="15.25" y="15.75" width="5" height="4.5" rx="1" />
      <path d="M12 8.25v3.5M6.25 15.75v-2a2 2 0 0 1 2-2h7.5a2 2 0 0 1 2 2v2" />
    </>
  ),
  news: (
    <>
      <rect x="4.5" y="4.75" width="15" height="14.5" rx="1.75" />
      <path d="M8 9h8M8 12.5h8M8 16h5" />
    </>
  ),
  loc: (
    <>
      <path d="M12 20.5s6.25-5.6 6.25-10.25a6.25 6.25 0 0 0-12.5 0C5.75 14.9 12 20.5 12 20.5z" />
      <circle cx="12" cy="10.25" r="2.25" />
    </>
  ),
  dots: (
    <>
      <circle cx="6" cy="12" r="1.35" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.35" fill="currentColor" stroke="none" />
      <circle cx="18" cy="12" r="1.35" fill="currentColor" stroke="none" />
    </>
  ),
  /* Chatten (docs/design/CHAT.md, Paper-eksporten chat-designguide.html): kortenes handlinger og modul-links. */
  download: <path d="M12 4v11M7 10l5 5 5-5M4 19h16" />,
  full: <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />,
  copy: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a1 1 0 0 1 1-1h10" />
    </>
  ),
  "bookmark-plus": <path d="M6 4h12v17l-6-4-6 4zM12 8v6M9 11h6" />,
  "arrow-down": <path d="M12 5v14M6 13l6 6 6-6" />,
  "arrow-right": <path d="M5 12h14M13 6l6 6-6 6" />,
  flag: <path d="M5 21V4h12l-2 4 2 4H5" />,
  eye: (
    <>
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
  network: (
    <>
      <circle cx="12" cy="5" r="2.5" />
      <circle cx="5" cy="19" r="2.5" />
      <circle cx="19" cy="19" r="2.5" />
      <path d="M12 7.5v4M12 11.5l-6 5M12 11.5l6 5" />
    </>
  ),
  doc: <path d="M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6" />,
  theme: (
    <>
      <circle cx="12" cy="12" r="8.25" />
      <path d="M12 6.25a5.75 5.75 0 0 1 0 11.5z" fill="currentColor" stroke="none" />
    </>
  ),
} as const;

export type P2IconName = keyof typeof PATHS;

/** Alle ikonerne (designguidens oversigt). */
export const P2_ICON_NAMES = Object.keys(PATHS) as P2IconName[];

export function P2Icon({ name, className = "i" }: { name: P2IconName; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {PATHS[name]}
    </svg>
  );
}
