import { randomUUID } from "crypto";

const TTL_MS = 20 * 60 * 1000;
const MAX_ENTRIES = 40;
/** @type {Map<string, { productImageDataUrl: string; productTitle: string; productDescription: string; extraNote?: string; at: number }>} */
const store = new Map();

function prune() {
  const now = Date.now();
  for (const [id, v] of store) {
    if (now - v.at > TTL_MS) store.delete(id);
  }
  while (store.size > MAX_ENTRIES) {
    const first = store.keys().next().value;
    if (first) store.delete(first);
  }
}

export function saveCampaignBrief(data) {
  prune();
  const id = randomUUID();
  store.set(id, {
    productImageDataUrl: data.productImageDataUrl,
    productTitle: data.productTitle || "",
    productDescription: data.productDescription || "",
    extraNote: data.extraNote || "",
    at: Date.now(),
  });
  return id;
}

export function getCampaignBrief(id) {
  if (!id) return null;
  const row = store.get(String(id));
  if (!row || Date.now() - row.at > TTL_MS) {
    store.delete(String(id));
    return null;
  }
  return row;
}
