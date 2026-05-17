import { dirname, join } from "path";
import { fileURLToPath } from "url";
import app, { CATALOG_DATA_DIR, MODEL, ROOT } from "./app.mjs";
import { loadCatalog } from "./catalog.mjs";
import { loadWebEnv } from "./load-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envSources = loadWebEnv(ROOT);
const PORT = Number(process.env.PORT || 3001);
const PROMPT_FILE =
  process.env.ECOMHUB_PROMPT_FILE ||
  join(__dirname, "prompts/ecomhub-pro.txt");

const server = app.listen(PORT, () => {
  try {
    const catalog = loadCatalog(CATALOG_DATA_DIR);
    console.log(`API chat: http://localhost:${PORT}`);
    console.log(`Produtos carregados: ${catalog.products.length}`);
    console.log(`Dados: ${CATALOG_DATA_DIR}`);
    console.log(`Modelo OpenAI: ${MODEL}`);
    console.log(`Persona: Ecomhub PRO (${PROMPT_FILE})`);
    const envLabel = envSources.fromEnv
      ? ".env"
      : envSources.fromExample
        ? ".env.example"
        : "nenhum";
    console.log(
      process.env.OPENAI_API_KEY
        ? `OpenAI: configurada (${envLabel})`
        : "OpenAI: AVISO — falta OPENAI_API_KEY em web/.env.example ou web/.env"
    );
  } catch (e) {
    console.error("Erro ao carregar catálogo:", e.message);
    console.log("Corre: npm run prepare-data");
  }
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(
      `ERRO: porta ${PORT} já em uso. Corre na raiz: npm run stop && npm run dev`
    );
    process.exit(1);
  }
  throw err;
});
