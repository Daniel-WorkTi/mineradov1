import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Caminho absoluto para `services/google_trends_cli.py` na raiz do repositório. */
export function getGoogleTrendsCliPath() {
  return join(__dirname, "..", "..", "..", "services", "google_trends_cli.py");
}
