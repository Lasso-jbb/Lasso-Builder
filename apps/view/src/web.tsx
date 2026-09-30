import { useEffect, useState } from "react";
import { LassoView, ToastProvider, Toasts, useToast, type ActionResult, type ViewAction } from "@lasso/ui";
import type { WebBoot as Boot } from "./boot.js";
import { hasLinks, openFocusFromLinks, openFromLinks } from "./sharedLinks.js";

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Følger værtens tema: data-theme på <html>, når en indlejrende side sætter det, ellers systemets indstilling. */
export function usePrefersDark(): boolean {
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

  const spec = boot.spec;
  if (!spec) {
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

  // Beskeder (07), fx når et navn ikke kan åbnes; LassoView bruger samme provider til sine egne.
  // Stakken tegnes i laget med sidens tema, så dens anker står i en lasso-root (uden egen boks).
  return (
    <ToastProvider container={false}>
      <SharedView boot={{ ...boot, spec }} dark={dark} />
      <div className="lasso-root" data-theme={dark ? "dark" : "light"} style={{ display: "contents" }}>
        <Toasts />
      </div>
    </ToastProvider>
  );
}

function SharedView({ boot, dark }: { boot: Boot & { spec: NonNullable<Boot["spec"]> }; dark: boolean }) {
  const toast = useToast();
  const onAction = async (a: ViewAction): Promise<ActionResult | void> => {
    switch (a.kind) {
      case "open-company":
      case "open-person": {
        // Navne på siden åbner deres egen side via det signerede link, serveren har lagt i boot'en.
        const res = openFromLinks(boot.links, a, (url) => {
          location.href = url;
        });
        if (!res.ok) toast.show({ text: res.error, tone: "error" });
        return res;
      }
      case "open-focus": {
        // Overblikkets "Se alle … i Historik": samme side med fanen, via serverens signerede link.
        const res = openFocusFromLinks(boot.focusLinks, a, (url) => {
          location.href = url;
        });
        if (!res.ok) toast.show({ text: res.error, tone: "error" });
        return res;
      }
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
      case "pdf":
        // "Gem som PDF": serverens .pdf-link til netop denne side; browseren gemmer filen (attachment).
        if (!boot.pdfUrl) return { ok: false, error: "Siden kan ikke gemmes som PDF." };
        location.href = boot.pdfUrl;
        return { ok: true };
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
        host={{ refresh: true, export: true, pdf: boot.pdf !== false && Boolean(boot.pdfUrl), drillDown: hasLinks(boot.links), openFocus: hasLinks(boot.focusLinks) }}
        onAction={onAction}
      />
    </div>
  );
}
