/** Lê e valida OPENAI_API_KEY (Vercel ou .env local). */
export function getOpenAIApiKey() {
  const raw = process.env.OPENAI_API_KEY;
  if (!raw) return { key: null, error: "missing" };

  const key = raw.trim().replace(/^['"]|['"]$/g, "");
  if (!key) return { key: null, error: "missing" };

  if (!key.startsWith("sk-")) {
    const hint =
      key.startsWith("k-proj") || key.startsWith("k-")
        ? "A chave parece sem o «s» inicial — deve começar por sk-proj- ou sk-."
        : "A chave deve começar por sk- (ex.: sk-proj-...).";
    return { key: null, error: "invalid_format", hint };
  }

  return { key, error: null };
}
