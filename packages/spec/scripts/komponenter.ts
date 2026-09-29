// Skriver docs/komponenter.md fra komponentregisteret (plan A9). Kør: npm run docs:komponenter -w @lasso/spec
import { mkdirSync, writeFileSync } from "node:fs";
import { komponenterMarkdown } from "../src/registerDoc.js";

const target = new URL("../../../docs/komponenter.md", import.meta.url);
mkdirSync(new URL("./", target), { recursive: true });
writeFileSync(target, komponenterMarkdown());
console.log(`skrev ${target.pathname}`);
