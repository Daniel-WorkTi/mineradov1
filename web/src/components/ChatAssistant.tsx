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
import { Bot, ExternalLink, MessageCircle, Send, Trash2, User } from "lucide-react";
import { ChatMessageContent } from "./ChatMessageContent";
import { ChatProductCards } from "./ChatProductCards";
import type { ChatProductLink } from "../utils/productLinks";

const ECOMHUB_PRO_GPT_URL =
  "https://chatgpt.com/g/g-684c8351d31c8191b5f28cda2646937c-ecomhub-pro";

type Role = "user" | "assistant";

interface ChatMessage {
  role: Role;
  content: string;
  products?: ChatProductLink[];
}

const STARTERS = [
  "Quais produtos têm Dropi com stock baixo mas EcomHub com muito stock?",
  "Sugere 5 candidatos para testar campanha com bom stock e preço entre 3€ e 12€",
  "Compara fornecedor Dropi vs EcomHub nos matches que tens",
  "Quais riscos de rutura de stock no Dropi agora?",
];

interface ChatAssistantProps {
  onOpenInCatalog?: (fonte: string, id: string) => void;
}

export function ChatAssistant({ onOpenInCatalog }: ChatAssistantProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Olá! Sou o Ecomhub PRO.\n\nTenho acesso ao teu catálogo completo (Dropi + EcomHub). Pergunta o que quiseres — quando sugerir produtos, clica nos cards para ver no catálogo do app.",
    },
  ]);
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
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const nextMessages: ChatMessage[] = [
      ...messages,
      { role: "user", content: trimmed },
    ];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro na API");
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.reply,
          products: Array.isArray(data.products) ? data.products : [],
        },
      ]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido";
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Não consegui responder: ${msg}\n\nVerifica se o servidor está a correr (\`npm run dev\`) e se tens \`OPENAI_API_KEY\` em web/.env.example ou web/.env`,
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
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") return i;
    }
    return -1;
  })();

  function clearChat() {
    setMessages([
      {
        role: "assistant",
        content: "Conversa limpa. Em que posso ajudar com o catálogo?",
      },
    ]);
  }

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
        size="2xl"
        scrollBehavior="inside"
        classNames={{
          base: "bg-zinc-950 border border-zinc-800",
          header: "border-b border-zinc-800",
          footer: "border-t border-zinc-800",
          body: "bg-zinc-950",
        }}
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            <span className="flex items-center gap-2 text-zinc-100">
              <Bot className="h-4 w-4 text-zinc-400" strokeWidth={1.75} />
              Assistente · Catálogo
            </span>
            <span className="text-xs font-normal text-zinc-500">
              Consulta o teu export Dropi × EcomHub
            </span>
            {apiOk === false && (
              <span className="text-xs text-red-400">API offline</span>
            )}
            {apiOk === true && (
              <span className="text-xs text-zinc-500">Conectado</span>
            )}
          </ModalHeader>

          <ModalBody className="gap-3 py-4">
            {messages.length <= 1 && (
              <div className="flex flex-wrap gap-2">
                {STARTERS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="max-w-full rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-left text-xs text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200"
                    onClick={() => sendMessage(s)}
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
                    onOpenInCatalog={handleOpenInCatalog}
                  />
                )}
              {m.role === "assistant" &&
                i === latestAssistantIndex &&
                (!m.products || m.products.length === 0) &&
                !loading && (
                  <p className="pl-10 text-xs text-default-400">
                    Pede de novo citando o nome do produto se não aparecerem
                    cards para clicar.
                  </p>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-2 text-sm text-zinc-500">
                <Spinner size="sm" color="default" />
                A analisar catálogo…
              </div>
            )}
            <div ref={bottomRef} />
          </ModalBody>

          <ModalFooter className="flex-col gap-2">
            <Textarea
              placeholder="Pergunta sobre produtos, stock, margem…"
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
                  sendMessage(input);
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
                onPress={clearChat}
              >
                Limpar
              </Button>
              <Button
                className="flex-1 min-w-32 bg-zinc-100 font-medium text-zinc-950 hover:bg-white"
                endContent={<Send className="h-4 w-4" />}
                isLoading={loading}
                onPress={() => sendMessage(input)}
              >
                Enviar
              </Button>
            </div>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
