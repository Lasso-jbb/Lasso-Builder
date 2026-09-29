import type { GalleryEntry } from "../types.js";
import { Button } from "@lasso/ui";

export const entries: GalleryEntry[] = [
  { nr: "08.1", title: "Virksomhedshoved", node: "I4C-0", spec: { kind: "company", title: "Eksempel Byg A/S", components: [{ type: "LassoCompanyHead", company: "CVR-1-99000001" }] } },
  { nr: "05.1", title: "Knapper", render: () => <Button variant="primary">Gem</Button> },
];
