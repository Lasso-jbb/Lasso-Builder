import { useEffect } from "react";
import { LassoView, PAGE_MARGIN_MM, pageScale, pageTemplates, ReportA4 } from "@lasso/ui";
import type { ViewSpec } from "@lasso/spec";
import type { PrintBoot } from "./boot.js";
import { fontFaceCss } from "./fonts.js";

/** Sidehoved, sidefod og skalering til side-PDF'en; serverens Chromium læser dem før page.pdf(). */
export interface PrintTemplates {
  headerTemplate: string;
  footerTemplate: string;
  scale: number;
}

declare global {
  interface Window {
    __LASSO_PRINT__?: PrintTemplates;
  }
}

/** Virksomheden, rapporten handler om: første `company` i specen. */
export function reportCompany(spec: ViewSpec): string | undefined {
  return spec.components.map((c) => ("company" in c && typeof c.company === "string" ? c.company : undefined)).find(Boolean);
}

/** Sidehoved og sidefod med sidens navn, datastempel og kilder (print.tsx i @lasso/ui). */
export function printTemplatesFor(boot: PrintBoot): PrintTemplates {
  return { ...pageTemplates({ title: boot.name, generatedAt: boot.generatedAt, fontFaces: fontFaceCss() }), scale: pageScale() };
}

/**
 * Siger til serverens Chromium, at siden er tegnet: efter første tegning og to billeder mere, så
 * graferne har målt deres bredde (useWidth) og tegnet om, før PDF'en laves.
 */
export function markReady(doc: Document = document, raf: (cb: () => void) => unknown = (cb) => requestAnimationFrame(cb)): void {
  raf(() =>
    raf(() => {
      doc.documentElement.dataset.lassoReady = "1";
    }),
  );
}

/**
 * Print-siden (/print/:token), som kun serverens Chromium åbner: virksomhedsrapporten (ReportA4,
 * katalog 27, @page uden margen, ét ark pr. side) eller selve visningen i print-tilstand (@page med
 * 14 mm margen, sidehoved og sidefod i margenen).
 */
export function PrintView({ boot }: { boot: PrintBoot }) {
  const company = boot.kind === "report" ? reportCompany(boot.spec) : undefined;
  const report = Boolean(company && boot.dataset.companies[company]);

  useEffect(() => {
    document.documentElement.style.colorScheme = "light";
    document.body.style.background = "#ffffff";
    if (!report) window.__LASSO_PRINT__ = printTemplatesFor(boot);
    markReady();
  }, []);

  if (report && company) {
    return (
      <>
        <style>{"@page { size: A4; margin: 0; }"}</style>
        <div className="lasso-root" data-theme="light">
          <ReportA4 company={company} dataset={boot.dataset} generatedAt={boot.generatedAt} />
        </div>
      </>
    );
  }
  return (
    <>
      <style>{`@page { size: A4; margin: ${PAGE_MARGIN_MM}mm; }`}</style>
      <LassoView print spec={boot.spec} dataset={boot.dataset} host={{}} onAction={() => undefined} theme="light" />
    </>
  );
}
