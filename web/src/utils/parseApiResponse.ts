/** Lê resposta da API mesmo quando a Vercel devolve texto/HTML em vez de JSON. */
export async function parseApiResponse<T extends { error?: string }>(
  res: Response
): Promise<T> {
  const text = await res.text();
  if (!text.trim()) {
    throw new Error(
      res.ok
        ? "Resposta vazia do servidor."
        : `Erro ${res.status} — servidor sem detalhe (timeout ou crash na Vercel).`
    );
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    const snippet = text.slice(0, 200).replace(/\s+/g, " ");
    if (/an error occurred|FUNCTION_INVOCATION|MIDDLEWARE_INVOCATION/i.test(text)) {
      throw new Error(
        `Servidor Vercel falhou (${res.status}). Pode ser timeout ou imagem demasiado grande. Tenta outra vez ou foto mais pequena. Detalhe: ${snippet}`
      );
    }
    if (res.status === 413 || /too large|payload/i.test(text)) {
      throw new Error(
        "Imagem ou pedido demasiado grande para a Vercel. Usa uma foto mais pequena."
      );
    }
    throw new Error(
      res.ok
        ? `Resposta inválida do servidor: ${snippet}`
        : `Erro ${res.status}: ${snippet}`
    );
  }
}
