import dotenv from "dotenv";
import { existsSync } from "fs";
import { join } from "path";

/**
 * Local: lê web/.env.example (como pediste).
 * Se existir web/.env, sobrescreve (prioridade ao .env).
 */
export function loadWebEnv(rootDir) {
  const examplePath = join(rootDir, ".env.example");
  const envPath = join(rootDir, ".env");

  if (existsSync(examplePath)) {
    dotenv.config({ path: examplePath });
  }
  if (existsSync(envPath)) {
    dotenv.config({ path: envPath, override: true });
  }

  return {
    fromExample: existsSync(examplePath),
    fromEnv: existsSync(envPath),
  };
}
