import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

import {
  MINING_TOOLS,
  executeMiningTool,
  MINING_TOOL_NAMES,
} from "../mining-tools.mjs";

export { MINING_TOOLS, executeMiningTool, MINING_TOOL_NAMES };

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Prompt interno do agente de mineração (contexto + formato de resposta). */
export function loadProductMiningPrompt() {
  const p = join(__dirname, "..", "prompts", "productMining.txt");
  if (!existsSync(p)) return "";
  return readFileSync(p, "utf8").trim();
}
