const PLACEHOLDER_KEY =
  /cole-a-tua|sua-chave|your[-_]?api|placeholder|exemplo|example|changeme|sk-test|sk-fake|xxxxxxxx/i;

const KEY_HELP =
  "Edita web/.env (ou web/.env.example), coloca OPENAI_API_KEY=sk-proj-... com chave real em https://platform.openai.com/api-keys e corre npm run restart.";

/** Lê e valida OPENAI_API_KEY (Vercel ou .env local). */
export function getOpenAIApiKey() {
  const raw = process.env.OPENAI_API_KEY;
  if (!raw) return { key: null, error: "missing", hint: KEY_HELP };

  const key = raw.trim().replace(/^['"]|['"]$/g, "");
  if (!key) return { key: null, error: "missing", hint: KEY_HELP };

  if (PLACEHOLDER_KEY.test(key)) {
    return {
      key: null,
      error: "placeholder",
      hint: "A chave ainda é o texto de exemplo (sk-cole-a-tua-chave…). " + KEY_HELP,
    };
  }

  if (!key.startsWith("sk-")) {
    const hint =
      key.startsWith("k-proj") || key.startsWith("k-")
        ? "A chave parece sem o «s» inicial — deve começar por sk-proj- ou sk-."
        : "A chave deve começar por sk- (ex.: sk-proj-...).";
    return { key: null, error: "invalid_format", hint };
  }

  if (key.length < 24) {
    return { key: null, error: "invalid_format", hint: "Chave demasiado curta. " + KEY_HELP };
  }

  return { key, error: null, hint: null };
}

export function openAIKeyErrorMessage(keyStatus) {
  if (!keyStatus || keyStatus.key) return null;
  if (keyStatus.error === "placeholder") return keyStatus.hint;
  if (keyStatus.error === "missing") return "OPENAI_API_KEY em falta. " + KEY_HELP;
  return keyStatus.hint || "OPENAI_API_KEY inválida. " + KEY_HELP;
}

/** Mensagem amigável para erros da API OpenAI. */
export function formatOpenAIError(err) {
  const msg = err?.message || String(err);
  const status = err?.status ?? err?.response?.status;

  if (
    status === 401 ||
    /incorrect api key|invalid_api_key|authentication/i.test(msg)
  ) {
    return (
      "Chave OpenAI rejeitada (401). Verifica se copiaste a chave completa em web/.env — não uses o texto de exemplo. " +
      KEY_HELP
    );
  }

  return msg;
}
