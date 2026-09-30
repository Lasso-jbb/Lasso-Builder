import { useState } from "react";
import type { Ctx } from "../App.js";
import { CommentItem, IdentityForm, STATUS_LABEL, useComments, type CommentStatus, type GuideComment } from "../comments.js";
import { PageHead, Seg } from "../ui.js";

/**
 * Alle kommentarer i designguiden, grupperet efter det, de handler om. De åbne er arbejdslisten, som
 * Claude henter fra /designguide/kommentarer.md, retter og svarer på (status "Rettet" med svar og commit).
 */
export function CommentsPage({ ctx: _ctx }: { ctx: Ctx }) {
  const { comments, reload, identity, error } = useComments();
  const [status, setStatus] = useState<CommentStatus | "alle">("aaben");
  const [editId, setEditId] = useState(false);
  const list = comments.filter((c) => status === "alle" || c.status === status);
  const groups = new Map<string, GuideComment[]>();
  for (const c of list) groups.set(c.target, [...(groups.get(c.target) ?? []), c]);
  const count = (s: CommentStatus) => comments.filter((c) => c.status === s).length;
  return (
    <div className="dg-page">
      <PageHead
        eyebrow="Indhold og kvalitet"
        title="Kommentarer"
        lead="Slå Kommentér til i topbjælken, og klik på et modul, et element eller en side for at sætte en nål og skrive, hvad der skal rettes. Tokens, tekster og hver side har også en kommentarknap. De åbne kommentarer er arbejdslisten, som Claude retter ud fra og svarer på."
      />
      <div className="dg-toolbar">
        <Seg
          label="Status"
          value={status}
          onChange={setStatus}
          items={[
            { id: "aaben", label: `${STATUS_LABEL.aaben} (${count("aaben")})` },
            { id: "rettet", label: `${STATUS_LABEL.rettet} (${count("rettet")})` },
            { id: "afvist", label: `${STATUS_LABEL.afvist} (${count("afvist")})` },
            { id: "alle", label: `Alle (${comments.length})` },
          ]}
        />
        <button className="dg-btn dg-btn--sm" onClick={() => void reload()}>
          Hent igen
        </button>
        <a className="dg-btn dg-btn--sm" href="/designguide/kommentarer.md" target="_blank" rel="noreferrer">
          Arbejdsliste (markdown)
        </a>
        <span className="dg-meta">
          {identity ? (
            <>
              Du kommenterer som {identity.name}.{" "}
              <button className="dg-linkbtn" onClick={() => setEditId((v) => !v)}>
                Navn og nøgle
              </button>
            </>
          ) : (
            <button className="dg-linkbtn" onClick={() => setEditId(true)}>
              Angiv navn
            </button>
          )}
        </span>
      </div>
      {editId ? <IdentityForm onDone={() => setEditId(false)} /> : null}
      {error ? <p className="dg-note dg-note--warn">{error}</p> : null}
      {!list.length ? <p className="dg-note">{status === "aaben" ? "Ingen åbne kommentarer." : "Ingen kommentarer her."}</p> : null}
      <div className="dg-cgroups">
        {[...groups.entries()].map(([target, cs]) => (
          <section key={target} className="dg-cgroup">
            <header className="dg-cgroup__head">
              <span className="dg-cgroup__label">{cs[0]!.label}</span>
              {cs[0]!.context.hash ? <a href={cs[0]!.context.hash}>Gå til</a> : null}
            </header>
            {cs.map((c) => (
              <CommentItem key={c.id} c={c} compact n={c.pin ? cs.filter((x) => x.pin).indexOf(c) + 1 : undefined} />
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
