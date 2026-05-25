import { useEffect, useRef, useState } from "react";
import {
  Button,
  Card,
  CardBody,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Spinner,
  Textarea,
} from "@heroui/react";
import {
  Bot,
  ExternalLink,
  MessageCircle,
  Send,
  Trash2,
  User,
} from "lucide-react";
import { CampaignWorkspace } from "./CampaignWorkspace";
import { ChatMessageContent } from "./ChatMessageContent";
import { ChatProductCards } from "./ChatProductCards";
import type { ChatProductLink } from "../utils/productLinks";

const ECOMHUB_PRO_GPT_URL =
  "https://chatgpt.com/g/g-684c8351d31c8191b5f28cda2646937c-ecomhub-pro";

type Role = "user" | "assistant";
export type ChatAgentId = "catalog" | "campaign";

interface ChatMessage {
  role: Role;
  content: string;
  products?: ChatProductLink[];
}

const CATALOG_AGENT = {
  id: "catalog" as const,
  label: "Catálogo",
  subtitle: "Dropi × EcomHub",
  welcome:
    "Olá! Sou o **Ecomhub PRO**.\n\nTenho acesso ao teu catálogo completo (Dropi + EcomHub). Pergunta o que quiseres — quando sugerir produtos, clica nos cards para ver no catálogo.",
  placeholder: "Pergunta sobre produtos, stock, margem…",
  loadingLabel: "A analisar catálogo…",
  starters: [
    "Quais produtos têm Dropi com stock baixo mas EcomHub com muito stock?",
    "Sugere 5 candidatos para testar campanha com bom stock e preço entre 3€ e 12€",
    "Compara fornecedor Dropi vs EcomHub nos matches que tens",
    "Quais riscos de rutura de stock no Dropi agora?",
  ],
};

function initialCatalogMessages(): ChatMessage[] {
  return [{ role: "assistant", content: CATALOG_AGENT.welcome }];
}

interface ChatAssistantProps {
  onOpenInCatalog?: (fonte: string, id: string) => void;
}

export function ChatAssistant({ onOpenInCatalog }: ChatAssistantProps) {
  const [open, setOpen] = useState(false);
  const [agent, setAgent] = useState<ChatAgentId>("catalog");
  const [catalogMessages, setCatalogMessages] = useState<ChatMessage[]>(
    initialCatalogMessages
  );
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [apiOk, setApiOk] = useState<boolean | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      fetch("/api/health")
        .then((r) => r.json())
        .then((d) => setApiOk(d.ok && d.openai))
        .catch(() => setApiOk(false));
    }
  }, [open]);

  useEffect(() => {
    if (agent === "catalog") {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [catalogMessages, loading, agent]);

  function switchAgent(next: ChatAgentId) {
    if (next === agent || loading) return;
    setAgent(next);
    setInput("");
  }

  async function sendCatalogMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const nextMessages: ChatMessage[] = [
      ...catalogMessages,
      { role: "user", content: trimmed },
    ];
    setCatalogMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent: "catalog",
          messages: nextMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro na API");

      setCatalogMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.reply,
          products: Array.isArray(data.products) ? data.products : [],
        },
      ]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido";
      const isProd = !import.meta.env.DEV;
      const hint401 = /401|Incorrect API key/i.test(msg)
        ? isProd
          ? "\n\n**Produção (Vercel):** confere `OPENAI_API_KEY` e Redeploy."
          : "\n\n**Local:** confere `web/.env` — chave `sk-proj-…`."
        : isProd
          ? "\n\n**Produção:** confere Environment Variables na Vercel."
          : "\n\n**Local:** corre `npm run dev` com `OPENAI_API_KEY`.";
      setCatalogMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Não consegui responder: ${msg}${hint401}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleOpenInCatalog(fonte: string, id: string) {
    onOpenInCatalog?.(fonte, id);
    setOpen(false);
  }

  const latestAssistantIndex = (() => {
    for (let i = catalogMessages.length - 1; i >= 0; i--) {
      if (catalogMessages[i].role === "assistant") return i;
    }
    return -1;
  })();

  function clearCatalogChat() {
    setCatalogMessages([
      {
        role: "assistant",
        content: "Conversa limpa. Em que posso ajudar com o catálogo?",
      },
    ]);
  }

  const showStarters = catalogMessages.length <= 1;

  return (
    <>
      <Button
        isIconOnly
        className="fixed bottom-6 right-6 z-50 h-12 w-12 rounded-full border border-zinc-700 bg-zinc-100 text-zinc-950 shadow-lg shadow-black/40 hover:bg-white"
        onPress={() => setOpen(true)}
        aria-label="Abrir assistente"
      >
        <MessageCircle className="h-5 w-5" strokeWidth={2} />
      </Button>

      <Modal
        isOpen={open}
        onOpenChange={setOpen}
        size={agent === "campaign" ? "full" : "2xl"}
        scrollBehavior="inside"
        classNames={{
          base:
            agent === "campaign"
              ? "m-0 max-h-none h-auto w-full max-w-none rounded-none border-0 bg-transparent shadow-none sm:m-3 sm:max-w-[1400px] sm:rounded-2xl sm:border sm:border-zinc-800 sm:bg-zinc-950 sm:shadow-2xl"
              : "bg-zinc-950 border border-zinc-800",
          body: agent === "campaign" ? "p-0 overflow-hidden" : "bg-zinc-950",
          wrapper: agent === "campaign" ? "items-center justify-center p-0 sm:p-2" : undefined,
        }}
      >
        {agent === "campaign" ? (
          <ModalContent className="overflow-hidden p-0 shadow-none">
            <CampaignWorkspace apiOk={apiOk} onSwitchAgent={switchAgent} />
          </ModalContent>
        ) : (
          <CatalogChatContent
            apiOk={apiOk}
            agent={agent}
            onSwitchAgent={switchAgent}
            messages={catalogMessages}
            showStarters={showStarters}
            loading={loading}
            input={input}
            setInput={setInput}
            latestAssistantIndex={latestAssistantIndex}
            bottomRef={bottomRef}
            onSend={sendCatalogMessage}
            onClear={clearCatalogChat}
            onOpenInCatalog={handleOpenInCatalog}
          />
        )}
      </Modal>
    </>
  );
}

function AgentTabs({
  agent,
  loading,
  onSwitch,
}: {
  agent: ChatAgentId;
  loading: boolean;
  onSwitch: (id: ChatAgentId) => void;
}) {
  const tabs: { id: ChatAgentId; label: string }[] = [
    { id: "catalog", label: "Catálogo" },
    { id: "campaign", label: "Imagens" },
  ];
  return (
    <div
      className="flex rounded-lg border border-zinc-800 bg-zinc-900/80 p-0.5"
      role="tablist"
    >
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={agent === t.id}
          disabled={loading}
          className={`flex-1 rounded-md px-3 py-2 text-xs font-medium transition-colors ${
            agent === t.id
              ? "bg-zinc-100 text-zinc-950"
              : "text-zinc-400 hover:text-zinc-200"
          } ${loading ? "opacity-60 cursor-not-allowed" : ""}`}
          onClick={() => onSwitch(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function CatalogChatContent({
  apiOk,
  agent,
  onSwitchAgent,
  messages,
  showStarters,
  loading,
  input,
  setInput,
  latestAssistantIndex,
  bottomRef,
  onSend,
  onClear,
  onOpenInCatalog,
}: {
  apiOk: boolean | null;
  agent: ChatAgentId;
  onSwitchAgent: (id: ChatAgentId) => void;
  messages: ChatMessage[];
  showStarters: boolean;
  loading: boolean;
  input: string;
  setInput: (v: string) => void;
  latestAssistantIndex: number;
  bottomRef: React.RefObject<HTMLDivElement | null>;
  onSend: (text: string) => void;
  onClear: () => void;
  onOpenInCatalog: (fonte: string, id: string) => void;
}) {
  return (
    <ModalContent>
      <ModalHeader className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-zinc-100">
            <Bot className="h-4 w-4 text-zinc-400" strokeWidth={1.75} />
            Assistente · {CATALOG_AGENT.label}
          </span>
          {apiOk === false && (
            <span className="text-xs text-red-400">API offline</span>
          )}
          {apiOk === true && (
            <span className="text-xs text-zinc-500">Conectado</span>
          )}
        </div>
        <span className="text-xs font-normal text-zinc-500">
          {CATALOG_AGENT.subtitle}
        </span>
        <AgentTabs agent={agent} loading={loading} onSwitch={onSwitchAgent} />
      </ModalHeader>

      <ModalBody className="gap-3 py-4">
        {showStarters && (
          <div className="flex flex-wrap gap-2">
            {CATALOG_AGENT.starters.map((s) => (
              <button
                key={s}
                type="button"
                className="max-w-full rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-left text-xs text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200"
                onClick={() => onSend(s)}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className="space-y-1">
            <div
              className={`flex gap-2 ${m.role === "user" ? "justify-end" : ""}`}
            >
              {m.role === "assistant" && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900">
                  <Bot className="h-4 w-4 text-zinc-400" />
                </div>
              )}
              <Card
                shadow="none"
                className={`max-w-[85%] border ${
                  m.role === "user"
                    ? "border-zinc-600 bg-zinc-100"
                    : "border-zinc-800 bg-zinc-900/80"
                }`}
              >
                <CardBody className="py-2 px-3">
                  {m.role === "assistant" ? (
                    <ChatMessageContent content={m.content} />
                  ) : (
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-950">
                      {m.content}
                    </p>
                  )}
                </CardBody>
              </Card>
              {m.role === "user" && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800">
                  <User className="h-4 w-4 text-zinc-300" />
                </div>
              )}
            </div>
            {m.role === "assistant" &&
              i === latestAssistantIndex &&
              m.products &&
              m.products.length > 0 && (
                <ChatProductCards
                  products={m.products}
                  onOpenInCatalog={onOpenInCatalog}
                />
              )}
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <Spinner size="sm" color="default" />
            {CATALOG_AGENT.loadingLabel}
          </div>
        )}
        <div ref={bottomRef} />
      </ModalBody>

      <ModalFooter className="flex-col gap-2">
        <Textarea
          placeholder={CATALOG_AGENT.placeholder}
          value={input}
          onValueChange={setInput}
          minRows={2}
          maxRows={4}
          variant="bordered"
          classNames={{
            inputWrapper:
              "border-zinc-800 bg-zinc-900/80 group-data-[focus=true]:border-zinc-500",
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend(input);
            }
          }}
        />
        <div className="flex w-full flex-wrap gap-2">
          <Button
            variant="flat"
            size="sm"
            as="a"
            href={ECOMHUB_PRO_GPT_URL}
            target="_blank"
            rel="noreferrer"
            endContent={<ExternalLink className="h-3.5 w-3.5" />}
          >
            GPT oficial (web)
          </Button>
          <Button
            variant="flat"
            startContent={<Trash2 className="h-4 w-4" />}
            onPress={onClear}
          >
            Limpar
          </Button>
          <Button
            className="flex-1 min-w-32 bg-zinc-100 font-medium text-zinc-950 hover:bg-white"
            endContent={<Send className="h-4 w-4" />}
            isLoading={loading}
            onPress={() => onSend(input)}
          >
            Enviar
          </Button>
        </div>
      </ModalFooter>
    </ModalContent>
  );
}
