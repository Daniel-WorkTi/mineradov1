#!/usr/bin/env python3
"""Converte CSVs do minerador em JSON para o dashboard React."""

import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output"
PUBLIC = ROOT / "web" / "public" / "data"


def csv_to_json(csv_path: Path) -> list[dict]:
    if not csv_path.exists():
        return []
    with csv_path.open(encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def main() -> None:
    PUBLIC.mkdir(parents=True, exist_ok=True)

    files = {
        "minerado.json": "minerado_unificado.csv",
        "matches.json": "matches.csv",
        "matches_revisar.json": "matches_revisar.csv",
        "ranking_dropi.json": "ranking_dropi_exclusivos.csv",
        "ranking_ecomhub.json": "ranking_ecomhub_exclusivos.csv",
        "oportunidades.json": "oportunidades_estoque.csv",
    }

    for out_name, csv_name in files.items():
        rows = csv_to_json(OUTPUT / csv_name)
        (PUBLIC / out_name).write_text(
            json.dumps(rows, ensure_ascii=False), encoding="utf-8"
        )
        print(f"  {out_name}: {len(rows)} registros")

    resumo_src = OUTPUT / "resumo.json"
    if resumo_src.exists():
        (PUBLIC / "resumo.json").write_text(
            resumo_src.read_text(encoding="utf-8"), encoding="utf-8"
        )

    print(f"\nDados prontos em {PUBLIC}")


if __name__ == "__main__":
    main()
