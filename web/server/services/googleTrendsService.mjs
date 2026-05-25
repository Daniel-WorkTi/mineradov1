import { spawn } from "child_process";
import { existsSync } from "fs";
import { getGoogleTrendsCliPath } from "./googleTrendsPaths.mjs";

const DEFAULT_TIMEFRAME = "today 3-m";

/**
 * Chama o CLI Python (pytrends). Se falhar, devolve payload degradado (sem quebrar o agent).
 * @param {{ keyword: string; geo?: string; timeframe?: string; compare?: string }} opts
 * @returns {Promise<Record<string, unknown>>}
 */
export async function fetchGoogleTrendsNormalized(opts) {
  const keyword = String(opts.keyword || "").trim();
  const geo = String(opts.geo ?? "PT").trim();
  const timeframe = String(opts.timeframe ?? DEFAULT_TIMEFRAME).trim();
  const compare = opts.compare ? String(opts.compare).trim() : "";

  if (!keyword) {
    return {
      ok: false,
      source: "googleTrendsService",
      error: "empty_keyword",
      keyword: "",
      geo,
      timeframe,
    };
  }

  const script = getGoogleTrendsCliPath();
  if (!existsSync(script)) {
    return {
      ok: false,
      source: "googleTrendsService",
      error: "cli_missing",
      keyword,
      geo,
      timeframe,
      hint: "Ficheiro services/google_trends_cli.py não encontrado.",
    };
  }

  const args = [
    script,
    "--keyword",
    keyword,
    "--geo",
    geo,
    "--timeframe",
    timeframe,
  ];
  if (compare) args.push("--compare", compare);

  const raw = await runPython(args);
  if (!raw) {
    return {
      ok: false,
      source: "googleTrendsService",
      error: "python_failed",
      keyword,
      geo,
      timeframe,
      hint: "Confirma Python 3 e: pip install -r services/requirements-mining.txt",
    };
  }

  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null
      ? parsed
      : { ok: false, error: "invalid_json", raw: raw.slice(0, 200) };
  } catch {
    return {
      ok: false,
      source: "googleTrendsService",
      error: "json_parse",
      raw: raw.slice(0, 400),
    };
  }
}

function pythonExecutable() {
  return (process.env.PYTHON_BIN || process.env.PYTHON || "python3").trim() || "python3";
}

function runPython(args) {
  return new Promise((resolve) => {
    const py = spawn(pythonExecutable(), args, {
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 45_000,
    });
    let out = "";
    let err = "";
    py.stdout?.on("data", (c) => {
      out += c.toString();
    });
    py.stderr?.on("data", (c) => {
      err += c.toString();
    });
    py.on("close", (code) => {
      if (code !== 0 && !out.trim()) {
        resolve("");
        return;
      }
      resolve(out.trim());
    });
    py.on("error", () => resolve(""));
  });
}
