export type PromptFormat = "vertical" | "square";

export interface CampaignPromptCard {
  id: string;
  format: PromptFormat;
  title: string;
  body: string;
}

const PROMPT_ORDER = [
  "V01",
  "V02",
  "V03",
  "V04",
  "V05",
  "V06",
  "Q01",
  "Q02",
  "Q03",
  "Q04",
  "Q05",
  "Q06",
] as const;

function promptFormat(id: string): PromptFormat {
  return id.startsWith("V") ? "vertical" : "square";
}

function extractTitle(headerLine: string, id: string): string {
  const cleaned = headerLine
    .replace(/^#{1,3}\s*/, "")
    .replace(/\*\*/g, "")
    .replace(new RegExp(`^${id}\\s*`, "i"), "")
    .replace(/^[-–—:]\s*/, "")
    .trim();
  return cleaned || `Criativo ${id}`;
}

/** Separa a resposta da IA em cards V01–Q06 quando possível. */
export function parseCampaignPrompts(content: string): {
  analysis: string;
  cards: CampaignPromptCard[];
  remainder: string;
} {
  const text = content.trim();
  if (!text) return { analysis: "", cards: [], remainder: "" };

  const headerRe =
    /(?:^|\n)(?:#{1,3}\s*|\*\*)?(V0[1-6]|Q0[1-6])(?:\*\*)?(?:\s*[-–—:]\s*([^\n]*))?/gi;

  const hits: { id: string; title: string; index: number; headerEnd: number }[] =
    [];
  let m: RegExpExecArray | null;
  while ((m = headerRe.exec(text)) !== null) {
    const id = m[1].toUpperCase();
    if (hits.some((h) => h.id === id)) continue;
    hits.push({
      id,
      title: extractTitle(m[0], id),
      index: m.index,
      headerEnd: m.index + m[0].length,
    });
  }

  hits.sort((a, b) => a.index - b.index);

  const cards: CampaignPromptCard[] = hits.map((hit, i) => {
    const next = hits[i + 1];
    const body = text.slice(hit.headerEnd, next?.index ?? text.length).trim();
    return {
      id: hit.id,
      format: promptFormat(hit.id),
      title: hit.title,
      body,
    };
  });

  const ordered = PROMPT_ORDER.map((id) => cards.find((c) => c.id === id)).filter(
    (c): c is CampaignPromptCard => Boolean(c)
  );

  const firstIdx = hits[0]?.index ?? text.length;
  const analysis = text.slice(0, firstIdx).trim();

  const lastHit = hits[hits.length - 1];
  let remainder = "";
  if (lastHit && ordered.length < 12) {
    remainder = text.slice(lastHit.headerEnd + (ordered.at(-1)?.body.length ?? 0));
  }

  return { analysis, cards: ordered.length ? ordered : cards, remainder };
}

export function fullPromptText(card: CampaignPromptCard): string {
  return `${card.id} — ${card.title}\n\n${card.body}`.trim();
}
