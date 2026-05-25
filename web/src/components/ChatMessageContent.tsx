import type { ReactNode } from "react";

/** Remove / simplifica blocos LaTeX que o modelo às vezes envia (o chat não tem MathJax). */
function normalizeAssistantLatex(text: string): string {
  let out = text.replace(/\\\[[\s\S]*?\\\]/g, (block) => {
    const inner = block.slice(2, -2);
    const approx = inner.match(/\\approx\s*([\d.,]+)/);
    if (approx) {
      return `\n\n**Resultado (aprox.):** ${approx[1].replace(",", ".")} € — confirma com os teus custos reais.\n\n`;
    }
    const flat = inner
      .replace(/\\text\{([^}]*)\}/g, "$1")
      .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "($1) / ($2)")
      .replace(/\\approx/g, "≈")
      .replace(/\\times/g, "×")
      .replace(/\\\\/g, "")
      .replace(/\s+/g, " ")
      .trim();
    return flat
      ? `\n\n*Cálculo (texto plano):* ${flat.slice(0, 500)}${flat.length > 500 ? "…" : ""}\n\n`
      : "\n\n";
  });
  out = out.replace(/\\\([\s\S]*?\\\)/g, (m) =>
    m
      .slice(2, -2)
      .replace(/\\text\{([^}]*)\}/g, "$1")
      .replace(/\\approx/g, "≈")
      .replace(/\\times/g, "×")
      .trim()
  );
  return out;
}

/** Formatação simples das respostas do assistente (sem dependências extra). */

function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function isBullet(line: string) {
  return /^[-*•]\s+/.test(line.trim());
}

function isNumbered(line: string) {
  return /^\d+[.)]\s+/.test(line.trim());
}

export function ChatMessageContent({ content }: { content: string }) {
  const lines = normalizeAssistantLatex(content).split("\n");
  const blocks: ReactNode[] = [];
  let listItems: string[] = [];
  let listType: "ul" | "ol" | null = null;

  const flushList = () => {
    if (!listItems.length || !listType) return;
    const Tag = listType === "ol" ? "ol" : "ul";
    blocks.push(
      <Tag
        key={`list-${blocks.length}`}
          className={
          listType === "ol"
            ? "my-2 list-decimal space-y-1.5 pl-5 text-sm text-zinc-400"
            : "my-2 list-disc space-y-1.5 pl-5 text-sm text-zinc-400"
        }
      >
        {listItems.map((item, i) => (
          <li key={i} className="leading-relaxed">
            {renderInline(item.replace(/^[-*•]\s+/, "").replace(/^\d+[.)]\s+/, ""))}
          </li>
        ))}
      </Tag>
    );
    listItems = [];
    listType = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      flushList();
      continue;
    }

    if (isBullet(trimmed)) {
      if (listType && listType !== "ul") flushList();
      listType = "ul";
      listItems.push(trimmed);
      continue;
    }

    if (isNumbered(trimmed)) {
      if (listType && listType !== "ol") flushList();
      listType = "ol";
      listItems.push(trimmed);
      continue;
    }

    flushList();

    if (trimmed.startsWith("### ")) {
      blocks.push(
        <h4
          key={`h-${i}`}
          className="mb-1 mt-3 text-sm font-semibold text-warning"
        >
          {trimmed.slice(4)}
        </h4>
      );
    } else if (trimmed.startsWith("## ")) {
      blocks.push(
        <h3
          key={`h-${i}`}
          className="mb-1 mt-3 text-base font-semibold text-foreground"
        >
          {trimmed.slice(3)}
        </h3>
      );
    } else {
      blocks.push(
        <p key={`p-${i}`} className="my-1.5 text-sm leading-relaxed text-default-700">
          {renderInline(trimmed)}
        </p>
      );
    }
  }

  flushList();

  return <div className="chat-message">{blocks}</div>;
}
