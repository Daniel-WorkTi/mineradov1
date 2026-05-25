/** Registo de agentes disponíveis no chat. */
export const CHAT_AGENTS = {
  catalog: {
    id: "catalog",
    label: "Catálogo",
    subtitle: "Consulta Dropi × EcomHub",
    persona: "Ecomhub PRO",
    useCatalogTools: true,
    useMiningContext: true,
    maxTokens: 1600,
    temperature: 0.35,
    supportsVision: false,
  },
  campaign: {
    id: "campaign",
    label: "Campanhas",
    subtitle: "Criativos premium · prompts IA",
    persona: "Campaign Studio",
    useCatalogTools: false,
    useMiningContext: false,
    maxTokens: 8192,
    temperature: 0.5,
    supportsVision: true,
  },
};

/** @param {string} [id] */
export function resolveChatAgent(id) {
  return CHAT_AGENTS[id] || CHAT_AGENTS.catalog;
}

export const CHAT_AGENT_LIST = Object.values(CHAT_AGENTS);
