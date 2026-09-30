import { useEffect } from "react";
import type { Ctx } from "../App.js";
import { entriesOfBoard, GalleryItem } from "../gallery.js";
import { BOARD_TITLES, GALLERY_SECTIONS } from "../structure.js";
import { PageHead } from "../ui.js";

/** Én tavle fra galleriet (fx 05 Knapper og kontroller): alle elementer med katalognummer i desktop og mobil. */
export function BoardPage({ ctx, board, focus }: { ctx: Ctx; board: string; focus?: string }) {
  const items = entriesOfBoard(board);
  const section = GALLERY_SECTIONS.find((s) => s.boards.test(board));
  useEffect(() => {
    if (!focus) return;
    const t = setTimeout(() => document.getElementById(`e-${focus}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 300);
    return () => clearTimeout(t);
  }, [focus]);
  return (
    <div className="dg-page">
      <PageHead
        eyebrow={`${section?.label ?? "Galleri"}, tavle ${board}`}
        title={BOARD_TITLES[board] ?? `Tavle ${board}`}
        lead={`${items.length} ${items.length === 1 ? "element" : "elementer"} tegnet fra koden og mærket med katalognummeret. Hvert element vises i sin gitterbredde på desktop og på mobil 390, hvor det findes.`}
      />
      <nav className="dg-jump" aria-label="Elementer på tavlen">
        {items.map(({ e }) => (
          <a key={e.nr + e.title} href={`#/galleri/${board}?e=${encodeURIComponent(e.nr)}`}>
            {e.nr} {e.title}
          </a>
        ))}
      </nav>
      {items.map(({ e, i }) => (
        <GalleryItem key={i} entry={e} index={i} theme={ctx.theme} />
      ))}
    </div>
  );
}
