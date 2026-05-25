import {
  CATALOG_TOOLS,
  collectProductsFromToolResult,
  executeCatalogTool,
} from "./catalog-tools.mjs";
import {
  MINING_TOOLS,
  collectMiningProducts,
  executeMiningTool,
  MINING_TOOL_NAMES,
} from "./mining-tools.mjs";

export { MINING_TOOL_NAMES };

export const ALL_CHAT_TOOLS = [...CATALOG_TOOLS, ...MINING_TOOLS];

/**
 * @param {string} name
 * @param {Record<string, unknown>} args
 * @param {object} catalog
 */
export async function executeChatTool(name, args, catalog) {
  if (MINING_TOOL_NAMES.has(name)) {
    return executeMiningTool(name, args, catalog);
  }
  return executeCatalogTool(name, args, catalog);
}

/**
 * @param {string} name
 * @param {Record<string, unknown>} result
 * @param {object} catalog
 */
export function collectAllToolProducts(name, result, catalog) {
  const a = collectProductsFromToolResult(name, result, catalog);
  const b = collectMiningProducts(name, result, catalog);
  return [...a, ...b];
}
