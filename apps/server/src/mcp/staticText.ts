/**
 * De faste værktøjstekster, som modellen ser i hver samtale (plan A8/Ø8): serverinstruktionerne og
 * alle værktøjsbeskrivelser (inkl. de interpolerede COMPOSITION_RULES, LAYOUT_RULES, katalog og
 * søgefelter). Teksterne hentes fra selve MCP-serveren over en in-memory-forbindelse, så de er
 * præcis dem, der sendes; serveren lytter ikke, og der åbnes hverken port eller database.
 */
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { createMcpServer, type McpContext } from "./server.js";

export interface StaticToolParts {
  instructions: string;
  /** Beskrivelsen pr. værktøj (navn → tekst). */
  tools: Record<string, string>;
}

export async function staticToolParts(): Promise<StaticToolParts> {
  // Handlerne kaldes aldrig; kun tools/list og initialize.
  const server = createMcpServer({} as McpContext);
  const client = new Client({ name: "static-text", version: "1" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), client.connect(b)]);
  try {
    const { tools } = await client.listTools();
    return {
      instructions: client.getInstructions() ?? "",
      tools: Object.fromEntries(tools.map((t) => [t.name, t.description ?? ""])),
    };
  } finally {
    await client.close();
    await server.close();
  }
}

/** Alle faste tekster samlet (instruktioner + alle værktøjsbeskrivelser). */
export async function staticToolText(): Promise<string> {
  const p = await staticToolParts();
  return [p.instructions, ...Object.values(p.tools)].join("\n\n");
}
