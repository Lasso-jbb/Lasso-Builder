import { useEffect, useState } from "react";
import { LassoView, type ActionResult, type ViewAction } from "@lasso/ui";
import type { Dataset, ViewSpec } from "@lasso/spec";

export interface Boot {
  mode: "web";
  spec?: ViewSpec;
  dataset?: Dataset;
  url?: string;
  name?: string | null;
  error?: string;
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Følger værtens tema: data-theme på <html>, når en indlejrende side sætter det, ellers systemets indstilling. */
function usePrefersDark(): boolean {
  const read = () => {
    const forced = document.documentElement.getAttribute("data-theme");
    if (forced === "dark" || forced === "light") return forced === "dark";
    return Boolean(window.matchMedia?.("(prefers-color-scheme: dark)").matches);
  };
  const [dark, setDark] = useState(read);
  useEffect(() => {
    const update = () => setDark(read());
    const q = window.matchMedia?.("(prefers-color-scheme: dark)");
    q?.addEventListener("change", update);
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => {
      q?.removeEventListener("change", update);
      observer.disconnect();
    };
  }, []);
  return dark;
}

/** Delt side: specen er gemt, data er hentet friskt af serveren ved sidevisning. */
export function WebView({ boot }: { boot: Boot }) {
  const dark = usePrefersDark();
  useEffect(() => {
    document.body.style.background = dark ? "#141619" : "#ffffff";
  }, [dark]);

  if (!boot.spec) {
    return (
      <div className="lasso-root" data-theme={dark ? "dark" : "light"} style={{ minHeight: "100vh" }}>
        <div className="lasso-frame">
          <div className="lasso-state lasso-state--error">
            <div className="lasso-state__title">Visningen kunne ikke vises</div>
            <div className="lasso-small">{boot.error ?? "Ukendt fejl"}</div>
          </div>
        </div>
      </div>
    );
  }

  const onAction = async (a: ViewAction): Promise<ActionResult | void> => {
    switch (a.kind) {
      case "refresh":
        location.reload();
        return;
      case "copy-link":
        try {
          await navigator.clipboard.writeText(a.url);
          return { ok: true };
        } catch {
          return { ok: false, error: "Kunne ikke kopiere. Kopiér adressen fra browseren." };
        }
      case "open-link":
        location.href = a.url;
        return;
      case "export":
        downloadCsv(a.filename, a.csv);
        return;
      default:
        return;
    }
  };

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", minHeight: "100vh" }}>
      <LassoView
        spec={boot.spec}
        dataset={boot.dataset ?? null}
        url={boot.url}
        theme={dark ? "dark" : "light"}
        host={{ refresh: true, export: true }}
        onAction={onAction}
      />
    </div>
  );
}
