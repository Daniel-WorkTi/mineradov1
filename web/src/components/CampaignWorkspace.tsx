import { forwardRef, useEffect, useRef, useState } from "react";
import { Button, Input, Spinner, Textarea } from "@heroui/react";
import {
  Check,
  Copy,
  Download,
  ImageIcon,
  LayoutGrid,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { fileToCampaignImageDataUrl } from "../utils/campaignImageUpload";
import {
  fullPromptText,
  type CampaignPromptCard,
} from "../utils/parseCampaignPrompts";
import {
  buildProductImageCards,
  PRODUCT_IMAGE_COUNT,
} from "../utils/productImageSlots";

interface CampaignWorkspaceProps {
  apiOk: boolean | null;
  onSwitchAgent?: (id: "catalog" | "campaign") => void;
}

type ImageGenState = {
  status: "idle" | "loading" | "done" | "error";
  imageDataUrl?: string;
  error?: string;
};

export function CampaignWorkspace({
  apiOk,
  onSwitchAgent,
}: CampaignWorkspaceProps) {
  const [productTitle, setProductTitle] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [extraNote, setExtraNote] = useState("");
  const [productImagePreview, setProductImagePreview] = useState<string | null>(
    null
  );
  const [productImageDataUrl, setProductImageDataUrl] = useState<string | null>(
    null
  );
  const [imageUploading, setImageUploading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [resultCards, setResultCards] = useState<CampaignPromptCard[]>([]);
  const [generatingImages, setGeneratingImages] = useState(false);
  const [imageProgress, setImageProgress] = useState({ done: 0, total: 0 });
  const [imagesById, setImagesById] = useState<Record<string, ImageGenState>>(
    {}
  );
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [apiKeyHint, setApiKeyHint] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const hasResults = resultCards.length > 0;
  const verticals = resultCards.filter((c) => c.format === "vertical");
  const squares = resultCards.filter((c) => c.format === "square");

  const briefReady =
    Boolean(productImageDataUrl) &&
    productTitle.trim().length > 0 &&
    productDescription.trim().length >= 30 &&
    !imageUploading &&
    apiOk !== false;

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((d) => {
        if (!d.openai && d.openai_key_hint) {
          setApiKeyHint(String(d.openai_key_hint));
        } else {
          setApiKeyHint(null);
        }
      })
      .catch(() => setApiKeyHint(null));
  }, [apiOk]);

  function clearBrief() {
    setProductTitle("");
    setProductDescription("");
    setExtraNote("");
    setProductImageDataUrl(null);
    setFormError(null);
    if (productImagePreview) URL.revokeObjectURL(productImagePreview);
    setProductImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleImageFile(file: File | null) {
    if (!file) return;
    setFormError(null);
    setImageUploading(true);
    try {
      const dataUrl = await fileToCampaignImageDataUrl(file);
      if (productImagePreview) URL.revokeObjectURL(productImagePreview);
      setProductImagePreview(URL.createObjectURL(file));
      setProductImageDataUrl(dataUrl);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Erro no upload.");
      setProductImageDataUrl(null);
    } finally {
      setImageUploading(false);
    }
  }

  function validateBrief(): string | null {
    if (!productTitle.trim()) return "Preenche o título do produto.";
    if (productDescription.trim().length < 30) {
      return "Descrição: mínimo 30 caracteres.";
    }
    if (!productImageDataUrl) return "Carrega a foto do produto.";
    if (imageUploading) return "Aguarda o upload.";
    return null;
  }

  async function generateOneImage(card: CampaignPromptCard) {
    const res = await fetch("/api/campaign/generate-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cardId: card.id,
        prompt: fullPromptText(card),
        format: card.format,
        productTitle: productTitle.trim(),
        productDescription: productDescription.trim(),
        productImageDataUrl: productImageDataUrl || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Erro ao gerar imagem");
    return data.imageDataUrl as string;
  }

  async function generateAllImages(cards: CampaignPromptCard[]) {
    if (!cards.length) return;
    setGeneratingImages(true);
    setImageProgress({ done: 0, total: cards.length });
    setImagesById(
      Object.fromEntries(cards.map((c) => [c.id, { status: "idle" as const }]))
    );

    const CONCURRENCY = PRODUCT_IMAGE_COUNT;
    let index = 0;

    async function worker() {
      while (index < cards.length) {
        const i = index++;
        const card = cards[i];
        setImagesById((prev) => ({
          ...prev,
          [card.id]: { status: "loading" },
        }));
        try {
          const imageDataUrl = await generateOneImage(card);
          setImagesById((prev) => ({
            ...prev,
            [card.id]: { status: "done", imageDataUrl },
          }));
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Falha na imagem";
          setImagesById((prev) => ({
            ...prev,
            [card.id]: { status: "error", error: msg },
          }));
        }
        setImageProgress((p) => ({ ...p, done: p.done + 1 }));
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, cards.length) }, () => worker())
    );
    setGeneratingImages(false);
  }

  async function handleGenerateImages() {
    const err = validateBrief();
    if (err) {
      setFormError(err);
      return;
    }
    if (generatingImages) return;
    setFormError(null);

    const cards = buildProductImageCards({
      productTitle: productTitle.trim(),
      productDescription: productDescription.trim(),
      extraNote: extraNote.trim() || undefined,
    });

    setResultCards(cards);
    requestAnimationFrame(() => {
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    await generateAllImages(cards);
  }

  async function copyPrompt(card: CampaignPromptCard) {
    await navigator.clipboard.writeText(fullPromptText(card));
    setCopiedId(card.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function handleReset() {
    clearBrief();
    setResultCards([]);
    setImagesById({});
    setImageProgress({ done: 0, total: 0 });
  }

  function downloadImage(cardId: string, dataUrl: string) {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${productTitle.trim() || "produto"}-${cardId}.png`;
    a.click();
  }

  async function generateOneImageRetry(card: CampaignPromptCard) {
    setImagesById((prev) => ({
      ...prev,
      [card.id]: { status: "loading" },
    }));
    try {
      const imageDataUrl = await generateOneImage(card);
      setImagesById((prev) => ({
        ...prev,
        [card.id]: { status: "done", imageDataUrl },
      }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha na imagem";
      setImagesById((prev) => ({
        ...prev,
        [card.id]: { status: "error", error: msg },
      }));
    }
  }

  return (
    <div className="flex h-[min(900px,calc(100vh-1.5rem))] w-full flex-col overflow-hidden bg-zinc-950 text-zinc-100">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-zinc-800 px-5 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600/20">
            <Sparkles className="h-4 w-4 text-blue-400" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold">
              Imagens do produto
            </h2>
            <p className="truncate text-xs text-zinc-500">
              4 imagens (2 verticais + 2 quadradas) · GPT Image
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {onSwitchAgent && (
            <AgentTabs active="campaign" onSwitch={onSwitchAgent} />
          )}
          <ConnectionBadge apiOk={apiOk} />
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside className="flex w-full shrink-0 flex-col border-b border-zinc-800 bg-zinc-900/30 lg:w-[360px] lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between border-b border-zinc-800/80 px-5 py-3">
            <p className="text-sm font-semibold text-zinc-200">Produto</p>
            <BriefChecklist ready={briefReady} />
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
            {(apiKeyHint || apiOk === false) && (
              <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-200">
                {apiKeyHint ||
                  "OpenAI offline. Coloca OPENAI_API_KEY em web/.env e corre npm run restart."}
              </p>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => void handleImageFile(e.target.files?.[0] ?? null)}
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={imageUploading}
              className="group flex w-full flex-col items-center rounded-2xl border-2 border-dashed border-zinc-700 bg-zinc-900/50 px-4 py-5 transition-colors hover:border-blue-500/50"
            >
              {productImagePreview ? (
                <img
                  src={productImagePreview}
                  alt="Produto"
                  className="mb-3 max-h-40 w-full object-contain"
                />
              ) : (
                <div className="mb-3 flex h-28 w-full items-center justify-center rounded-xl bg-zinc-800/60">
                  <Upload className="h-8 w-8 text-zinc-600 group-hover:text-zinc-400" />
                </div>
              )}
              <span className="text-sm font-medium text-zinc-300">
                {imageUploading
                  ? "A processar…"
                  : productImagePreview
                    ? "Trocar imagem"
                    : "Carregar imagem"}
              </span>
              {productImageDataUrl && !imageUploading && (
                <span className="mt-2 flex items-center gap-1 text-xs text-emerald-400">
                  <Check className="h-3 w-3" /> Pronta
                </span>
              )}
            </button>

            <Input
              label="Título"
              labelPlacement="outside"
              placeholder="Ex.: Orbit X Pro"
              value={productTitle}
              onValueChange={setProductTitle}
              variant="bordered"
              size="sm"
              classNames={{
                label: "text-zinc-400 text-xs font-medium",
                inputWrapper: "border-zinc-700 bg-zinc-900/80",
              }}
            />

            <Textarea
              label="Descrição e specs"
              labelPlacement="outside"
              placeholder="Benefícios, materiais, público…"
              value={productDescription}
              onValueChange={setProductDescription}
              minRows={5}
              variant="bordered"
              classNames={{
                label: "text-zinc-400 text-xs font-medium",
                inputWrapper: "border-zinc-700 bg-zinc-900/80",
              }}
              description={`${productDescription.length} chars · mín. 30`}
            />

            <Textarea
              label="Nota extra (opcional)"
              labelPlacement="outside"
              placeholder="Ex.: fundo branco, tom premium, sem texto grande…"
              value={extraNote}
              onValueChange={setExtraNote}
              minRows={2}
              variant="bordered"
              classNames={{
                label: "text-zinc-400 text-xs font-medium",
                inputWrapper: "border-zinc-700 bg-zinc-900/80",
              }}
            />

            {formError && (
              <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                {formError}
              </p>
            )}
          </div>

          <div className="flex gap-2 border-t border-zinc-800 px-5 py-4">
            <Button
              isIconOnly
              variant="flat"
              className="shrink-0 border border-zinc-700"
              aria-label="Limpar"
              onPress={handleReset}
              isDisabled={generatingImages}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button
              fullWidth
              size="lg"
              className="bg-blue-600 font-semibold text-white"
              endContent={<Sparkles className="h-4 w-4" />}
              isLoading={generatingImages}
              isDisabled={!briefReady || generatingImages}
              onPress={() => void handleGenerateImages()}
            >
              Gerar 4 imagens
            </Button>
          </div>
        </aside>

        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex shrink-0 items-center gap-2 border-b border-zinc-800 px-5 py-2.5">
            <LayoutGrid className="h-4 w-4 text-zinc-500" />
            <p className="text-sm font-semibold text-zinc-300">Resultados</p>
            {hasResults && (
              <span className="text-xs text-zinc-600">
                {imageProgress.done}/{imageProgress.total || PRODUCT_IMAGE_COUNT}
              </span>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
            {generatingImages && (
              <div className="mb-4 rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-3">
                <div className="flex items-center gap-3">
                  <Spinner size="sm" color="primary" />
                  <div>
                    <p className="text-sm font-medium text-blue-200">
                      A gerar imagens {imageProgress.done}/
                      {imageProgress.total}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {PRODUCT_IMAGE_COUNT} em paralelo · GPT Image · foto do produto
                    </p>
                  </div>
                </div>
              </div>
            )}

            {!hasResults && !generatingImages && (
              <EmptyState
                productImagePreview={productImagePreview}
                productTitle={productTitle}
                briefReady={briefReady}
              />
            )}

            {hasResults && (
              <ResultsGrid
                ref={resultsRef}
                verticals={verticals}
                squares={squares}
                copiedId={copiedId}
                imagesById={imagesById}
                onCopy={copyPrompt}
                onRetryImage={generateOneImageRetry}
                onDownload={downloadImage}
              />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function AgentTabs({
  active,
  onSwitch,
}: {
  active: "catalog" | "campaign";
  onSwitch: (id: "catalog" | "campaign") => void;
}) {
  return (
    <div className="flex rounded-lg border border-zinc-700 bg-zinc-900 p-0.5">
      {(
        [
          { id: "catalog" as const, label: "Catálogo" },
          { id: "campaign" as const, label: "Imagens" },
        ] as const
      ).map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onSwitch(t.id)}
          className={`rounded-md px-3 py-1.5 text-xs font-medium ${
            active === t.id
              ? "bg-white text-zinc-950"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function ConnectionBadge({ apiOk }: { apiOk: boolean | null }) {
  if (apiOk === false) {
    return (
      <span className="rounded-full border border-red-500/40 px-2.5 py-1 text-xs text-red-400">
        Sem chave OpenAI
      </span>
    );
  }
  if (apiOk === true) {
    return (
      <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 px-2.5 py-1 text-xs text-emerald-400">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        Online
      </span>
    );
  }
  return null;
}

function BriefChecklist({ ready }: { ready: boolean }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
        ready ? "bg-emerald-500/15 text-emerald-400" : "bg-zinc-800 text-zinc-500"
      }`}
    >
      {ready ? "Pronto" : "Incompleto"}
    </span>
  );
}

function EmptyState({
  productImagePreview,
  productTitle,
  briefReady,
}: {
  productImagePreview: string | null;
  productTitle: string;
  briefReady: boolean;
}) {
  return (
    <div className="flex flex-col items-center py-16 text-center">
      <LayoutGrid className="mb-4 h-14 w-14 text-zinc-700" />
      <h3 className="text-lg font-semibold text-zinc-200">
        {briefReady ? "Clica em Gerar 4 imagens" : "Completa o produto"}
      </h3>
      <p className="mt-2 max-w-sm text-sm text-zinc-500">
        {briefReady
          ? "As imagens aparecem aqui assim que começares a geração."
          : "Foto + título + descrição (mín. 30 caracteres)."}
      </p>
      {productImagePreview && (
        <div className="mt-6 flex items-center gap-3 rounded-xl border border-zinc-800 px-4 py-3">
          <img
            src={productImagePreview}
            alt=""
            className="h-12 w-12 rounded-lg object-cover"
          />
          <span className="text-sm text-zinc-400">{productTitle || "Produto"}</span>
        </div>
      )}
    </div>
  );
}

const ResultsGrid = forwardRef<
  HTMLDivElement,
  {
    verticals: CampaignPromptCard[];
    squares: CampaignPromptCard[];
    copiedId: string | null;
    imagesById: Record<string, ImageGenState>;
    onCopy: (c: CampaignPromptCard) => void;
    onRetryImage: (c: CampaignPromptCard) => void;
    onDownload: (id: string, url: string) => void;
  }
>(function ResultsGrid(
  {
    verticals,
    squares,
    copiedId,
    imagesById,
    onCopy,
    onRetryImage,
    onDownload,
  },
  ref
) {
  return (
    <div ref={ref} className="space-y-8">
      <PromptSection
        title="Verticais · 1080×1920"
        subtitle="Stories · Reels"
        cards={verticals}
        copiedId={copiedId}
        imagesById={imagesById}
        onCopy={onCopy}
        onRetryImage={onRetryImage}
        onDownload={onDownload}
      />
      <PromptSection
        title="Quadrados · 1080×1080"
        subtitle="Feed · Ads"
        cards={squares}
        copiedId={copiedId}
        imagesById={imagesById}
        onCopy={onCopy}
        onRetryImage={onRetryImage}
        onDownload={onDownload}
      />
    </div>
  );
});

function PromptSection({
  title,
  subtitle,
  cards,
  copiedId,
  imagesById,
  onCopy,
  onRetryImage,
  onDownload,
}: {
  title: string;
  subtitle: string;
  cards: CampaignPromptCard[];
  copiedId: string | null;
  imagesById: Record<string, ImageGenState>;
  onCopy: (c: CampaignPromptCard) => void;
  onRetryImage: (c: CampaignPromptCard) => void;
  onDownload: (id: string, url: string) => void;
}) {
  if (!cards.length) return null;
  return (
    <section>
      <h4 className="text-sm font-semibold text-zinc-200">{title}</h4>
      <p className="mb-4 text-xs text-zinc-600">{subtitle}</p>
      <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
        {cards.map((card) => (
          <PromptCard
            key={card.id}
            card={card}
            copied={copiedId === card.id}
            imageState={imagesById[card.id]}
            onCopy={() => void onCopy(card)}
            onRetry={() => onRetryImage(card)}
            onDownload={(url) => onDownload(card.id, url)}
          />
        ))}
      </div>
    </section>
  );
}

function PromptCard({
  card,
  copied,
  imageState,
  onCopy,
  onRetry,
  onDownload,
}: {
  card: CampaignPromptCard;
  copied: boolean;
  imageState?: ImageGenState;
  onCopy: () => void;
  onRetry: () => void;
  onDownload: (url: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const vertical = card.format === "vertical";
  const img = imageState?.status === "done" ? imageState.imageDataUrl : null;

  return (
    <article className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60 hover:border-zinc-600">
      <div
        className={`relative overflow-hidden bg-zinc-900 ${
          vertical ? "aspect-[9/16]" : "aspect-square"
        }`}
      >
        <span
          className={`absolute left-3 top-3 z-10 rounded px-2 py-0.5 text-[10px] font-bold ${
            vertical
              ? "bg-violet-500/80 text-white"
              : "bg-sky-500/80 text-white"
          }`}
        >
          {card.id}
        </span>

        {imageState?.status === "loading" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-zinc-900/90">
            <Spinner size="md" color="primary" />
            <span className="text-xs text-zinc-400">A gerar…</span>
          </div>
        )}

        {imageState?.status === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-zinc-900 p-4 text-center">
            <p className="text-xs text-red-400">{imageState.error}</p>
            <Button size="sm" variant="flat" onPress={onRetry}>
              Tentar de novo
            </Button>
          </div>
        )}

        {img ? (
          <img
            src={img}
            alt={card.title}
            className="h-full w-full object-cover"
          />
        ) : imageState?.status !== "loading" && imageState?.status !== "error" ? (
          <div className="flex h-full min-h-[120px] flex-col items-center justify-center gap-2 text-zinc-600">
            <ImageIcon className="h-8 w-8" />
            <span className="text-xs">Na fila</span>
          </div>
        ) : null}

        {img && (
          <Button
            size="sm"
            isIconOnly
            variant="flat"
            className="absolute bottom-3 right-3 z-10 bg-black/50"
            aria-label="Descarregar"
            onPress={() => onDownload(img)}
          >
            <Download className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <div className="relative p-4">
        <div className="absolute right-3 top-3 flex gap-1">
          <Button size="sm" isIconOnly variant="flat" onPress={onCopy}>
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
        <p className="pr-12 text-sm font-medium text-zinc-200">{card.title}</p>
        <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-zinc-500">
          {expanded
            ? card.body
            : card.body.slice(0, 120) + (card.body.length > 120 ? "…" : "")}
        </p>
        {card.body.length > 120 && (
          <button
            type="button"
            className="mt-2 text-xs text-blue-400 hover:underline"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? "Recolher" : "Ver detalhe"}
          </button>
        )}
      </div>
    </article>
  );
}
