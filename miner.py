#!/usr/bin/env python3
"""
Minerador de produtos: cruza catálogo Dropi PRO × EcomHub (Espanha).

Uso:
  python3 miner.py
  python3 miner.py --dropi dropipro-catalogo2.json --ecomhub catalogo-ecomhub-allprodutos-espanha.json
  python3 miner.py --min-score 0.75 --min-stock 50
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import unicodedata
from datetime import datetime, timezone
from dataclasses import asdict, dataclass
from difflib import SequenceMatcher
from pathlib import Path
from typing import Iterable

ROOT = Path(__file__).resolve().parent
OUTPUT = ROOT / "output"

STOPWORDS = {
    "de", "la", "el", "para", "con", "y", "en", "del", "los", "las", "un", "una",
    "the", "and", "for", "with", "por", "sin", "al", "es", "em", "com", "sem", "que",
}


@dataclass
class DropiProduct:
    id: str
    nome: str
    stock: int
    peso_kg: float
    preco_eur: float
    imagem: str
    sku: str


@dataclass
class EcomhubProduct:
    id: str
    nome: str
    sku: str
    stock: int
    preco_eur: float | None
    envio_eur: float | None
    armazem: str
    peso_g: float | None
    imagem: str
    is_bundle: bool


@dataclass
class MatchRow:
    score: float
    dropi_id: str
    dropi_nome: str
    dropi_preco: float
    dropi_stock: int
    ecomhub_id: str
    ecomhub_nome: str
    ecomhub_sku: str
    ecomhub_preco: float | None
    ecomhub_envio: float | None
    ecomhub_stock: int
    custo_ecomhub_total: float | None
    diff_preco: float | None
    mais_barato: str
    margem_pct: float | None
    score_oportunidade: float


def norm(text: str) -> str:
    if not text:
        return ""
    text = unicodedata.normalize("NFKD", text.lower())
    text = "".join(c for c in text if not unicodedata.combining(c))
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def tokens(text: str) -> set[str]:
    return {t for t in norm(text).split() if len(t) >= 3 and t not in STOPWORDS}


def parse_float(value) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(str(value).replace(",", "."))
    except (TypeError, ValueError):
        return None


def similarity(a: str, b: str) -> float:
    na, nb = norm(a), norm(b)
    if not na or not nb:
        return 0.0
    seq = SequenceMatcher(None, na, nb).ratio()
    ta, tb = tokens(a), tokens(b)
    if not ta or not tb:
        token_score = 0.0
    else:
        inter = ta & tb
        union = ta | tb
        token_score = len(inter) / len(union)
        # boost quando palavras-chave importantes coincidem
        if len(inter) >= 2:
            token_score = min(1.0, token_score * 1.15)
    return 0.35 * seq + 0.65 * token_score


def load_dropi(path: Path) -> list[DropiProduct]:
    data = json.loads(path.read_text(encoding="utf-8"))
    out: list[DropiProduct] = []
    for row in data:
        preco = parse_float(row.get("preco_eur"))
        if preco is None:
            continue
        out.append(
            DropiProduct(
                id=str(row.get("id", "")),
                nome=str(row.get("nome", "")),
                stock=int(row.get("stock") or 0),
                peso_kg=parse_float(row.get("peso_kg")) or 0.0,
                preco_eur=preco,
                imagem=str(row.get("imagem", "")),
                sku=str(row.get("sku", "")),
            )
        )
    return out


def pick_ecomhub_image(product: dict, variant: dict | None = None, stock_item: dict | None = None) -> str:
    """Primeira imagem disponível (produto → variante → stockItem)."""
    for src in (
        product.get("featuredImage"),
        (variant or {}).get("featuredImage"),
        (stock_item or {}).get("featuredImage"),
    ):
        if src and str(src).strip():
            return str(src).strip()
    return ""


def flatten_ecomhub(path: Path, country_id: int = 164) -> list[EcomhubProduct]:
    data = json.loads(path.read_text(encoding="utf-8"))
    out: list[EcomhubProduct] = []

    for product in data:
        name = str(product.get("name") or "")
        is_bundle = bool(product.get("isBundle"))
        image = pick_ecomhub_image(product)

        best: EcomhubProduct | None = None

        for variant in product.get("productsVariants") or []:
            if variant.get("isRemoved"):
                continue

            stock_item = variant.get("stockItems") or {}
            if not image:
                image = pick_ecomhub_image(product, variant, stock_item)
            sku = str(stock_item.get("sku") or "")
            price = parse_float(variant.get("price")) or parse_float(product.get("price"))

            stock_es = 0
            warehouse = ""
            shipping = None

            for st in stock_item.get("stock") or []:
                wh = st.get("warehouses") or {}
                zones = wh.get("warehousesZones") or []
                if not any(z.get("country_id") == country_id for z in zones):
                    continue
                stock_es += int(st.get("quantity") or 0)
                warehouse = str(wh.get("namePublic") or warehouse)
                shipping = parse_float(wh.get("cost")) or shipping

            if stock_es <= 0:
                continue

            weight_g = parse_float(stock_item.get("weight"))
            candidate = EcomhubProduct(
                id=str(product.get("id", "")),
                nome=name,
                sku=sku,
                stock=stock_es,
                preco_eur=price,
                envio_eur=shipping,
                armazem=warehouse,
                peso_g=weight_g,
                imagem=str(image),
                is_bundle=is_bundle,
            )

            if best is None:
                best = candidate
            elif price is not None and (best.preco_eur is None or price < best.preco_eur):
                best = candidate
            elif best.preco_eur is None and price is not None:
                best = candidate

        if best:
            out.append(best)

    return out


def index_by_tokens(products: Iterable, name_attr: str) -> dict[str, list]:
    index: dict[str, list] = {}
    for p in products:
        name = getattr(p, name_attr)
        for t in tokens(name):
            index.setdefault(t, []).append(p)
    return index


def find_best_match(
    dropi: DropiProduct,
    ecomhub_list: list[EcomhubProduct],
    ecom_index: dict[str, list[EcomhubProduct]],
    min_score: float,
) -> tuple[EcomhubProduct | None, float]:
    candidates: dict[str, EcomhubProduct] = {}
    for t in tokens(dropi.nome):
        for e in ecom_index.get(t, []):
            candidates[e.id] = e

    if not candidates:
        candidates = {e.id: e for e in ecomhub_list}

    best_e: EcomhubProduct | None = None
    best_score = 0.0

    for e in candidates.values():
        score = similarity(dropi.nome, e.nome)
        if score > best_score:
            best_score = score
            best_e = e

    if best_score < min_score:
        return None, best_score
    return best_e, best_score


def custo_total_ecomhub(e: EcomhubProduct) -> float | None:
    if e.preco_eur is None:
        return None
    return e.preco_eur + (e.envio_eur or 0.0)


def classify_stock_opportunity(m: MatchRow) -> tuple[list[str], str, float]:
    """Etiquetas de mineração com base no cruzamento de stock/preço."""
    tags: list[str] = []
    ds, es = m.dropi_stock, m.ecomhub_stock
    ratio = round(es / max(ds, 1), 2)

    # Dropi a esgotar, EcomHub com reserva → possível demanda + backup de fulfillment
    if ds < 150 and es >= 300 and ratio >= 2:
        tags.append("dropi_baixo_ecom_alto")

    if ds < 50:
        tags.append("dropi_critico")

    if ds < 200 and es >= 500 and ratio >= 5:
        tags.append("demanda_alta")

    if m.mais_barato == "dropi" and (m.margem_pct or 0) >= 8:
        tags.append("margem_dropi")

    if m.mais_barato == "ecomhub" and (m.margem_pct or 0) >= 8:
        tags.append("margem_ecomhub")

    if ds >= 500 and 2 <= m.dropi_preco <= 15:
        tags.append("escalar_dropi")

    if es >= 500 and m.ecomhub_preco and 2 <= (m.ecomhub_preco or 0) <= 15:
        tags.append("escalar_ecomhub")

    insights: list[str] = []
    if "dropi_baixo_ecom_alto" in tags:
        insights.append(
            f"Dropi com pouco stock ({ds}) vs EcomHub ({es}) — possível demanda; considere EcomHub como reserva."
        )
    if "dropi_critico" in tags:
        insights.append(f"Stock Dropi crítico ({ds}) — risco de rutura se escalar campanhas.")
    if "demanda_alta" in tags:
        insights.append(f"Rácio stock EcomHub/Dropi ×{ratio} — forte desequilíbrio a favor do EcomHub.")
    if "margem_dropi" in tags:
        insights.append("Fornecedor mais barato no Dropi neste par.")
    if "margem_ecomhub" in tags:
        insights.append("Fornecedor mais barato no EcomHub neste par.")

    insight = " ".join(insights) if insights else ""
    return tags, insight, ratio


def tag_single_product(fonte: str, stock: int, preco: float, peso: float = 0.0) -> list[str]:
    """Etiquetas para produtos sem par (catálogo único)."""
    tags: list[str] = []
    if fonte == "dropipro":
        if stock < 50:
            tags.append("dropi_critico")
        elif stock < 150:
            tags.append("dropi_stock_baixo")
        if stock >= 500 and 2 <= preco <= 15 and peso <= 1.5:
            tags.append("winner_candidate")
        if stock >= 1000:
            tags.append("alto_stock")
    else:
        if stock >= 500 and preco and 2 <= preco <= 15:
            tags.append("winner_candidate")
        if stock >= 1000:
            tags.append("alto_stock")
    if 2 <= preco <= 12:
        tags.append("preco_ideal_teste")
    return tags


def build_match_row(dropi: DropiProduct, ecom: EcomhubProduct, score: float) -> MatchRow:
    custo_ecom = custo_total_ecomhub(ecom)
    diff = None
    mais_barato = ""
    margem_pct = None

    if custo_ecom is not None:
        diff = round(dropi.preco_eur - custo_ecom, 2)
        if abs(diff) < 0.05:
            mais_barato = "empate"
        elif diff > 0:
            mais_barato = "ecomhub"
        else:
            mais_barato = "dropi"

        base = max(dropi.preco_eur, custo_ecom, 0.01)
        margem_pct = round(abs(diff) / base * 100, 1)

    # score de oportunidade: match forte + stock + diferença de preço
    stock_factor = min(dropi.stock, ecom.stock) / 100.0
    price_factor = abs(diff or 0) * 2
    opp = round(score * 50 + min(stock_factor, 5) * 5 + min(price_factor, 20), 2)

    return MatchRow(
        score=round(score, 3),
        dropi_id=dropi.id,
        dropi_nome=dropi.nome,
        dropi_preco=dropi.preco_eur,
        dropi_stock=dropi.stock,
        ecomhub_id=ecom.id,
        ecomhub_nome=ecom.nome,
        ecomhub_sku=ecom.sku,
        ecomhub_preco=ecom.preco_eur,
        ecomhub_envio=ecom.envio_eur,
        ecomhub_stock=ecom.stock,
        custo_ecomhub_total=custo_ecom,
        diff_preco=diff,
        mais_barato=mais_barato,
        margem_pct=margem_pct,
        score_oportunidade=opp,
    )


def write_csv(path: Path, rows: list[dict], fieldnames: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)


def score_produto(stock: int, preco: float | None, peso: float = 0.0) -> float:
    """Pontuação heurística para priorizar produtos no minerado."""
    if preco is None or preco <= 0:
        preco_score = 0.0
    elif preco < 5:
        preco_score = 8.0
    elif preco < 15:
        preco_score = 6.0
    elif preco < 40:
        preco_score = 4.0
    else:
        preco_score = 2.0

    stock_score = min(stock / 50.0, 12.0)
    peso_penalty = 0.5 if peso and peso > 2 else 0.0
    return round(stock_score + preco_score - peso_penalty, 2)


def to_unified_dropi(d: DropiProduct) -> dict:
    return {
        "fonte": "dropipro",
        "id": d.id,
        "nome": d.nome,
        "sku": d.sku,
        "preco_eur": d.preco_eur,
        "stock": d.stock,
        "peso": d.peso_kg,
        "envio_eur": "",
        "armazem": "Dropi PRO ES",
        "imagem": d.imagem,
        "link": f"https://dropipro.com/app/products/{d.id}",
        "score_minerado": score_produto(d.stock, d.preco_eur, d.peso_kg),
    }


def to_unified_ecom(e: EcomhubProduct) -> dict:
    custo = custo_total_ecomhub(e)
    return {
        "fonte": "ecomhub",
        "id": e.id,
        "nome": e.nome,
        "sku": e.sku,
        "preco_eur": e.preco_eur if e.preco_eur is not None else "",
        "stock": e.stock,
        "peso": (e.peso_g or 0) / 1000.0 if e.peso_g else "",
        "envio_eur": e.envio_eur if e.envio_eur is not None else "",
        "armazem": e.armazem,
        "imagem": e.imagem if e.imagem.startswith("http") else f"https://api.ecomhub.app{e.imagem if e.imagem.startswith('/') else '/' + e.imagem}",
        "link": f"https://app.ecomhub.app/products/{e.id}",
        "score_minerado": score_produto(e.stock, custo or e.preco_eur),
    }


def run(args: argparse.Namespace) -> dict:
    dropi_path = Path(args.dropi)
    ecom_path = Path(args.ecomhub)
    out_dir = Path(args.output)

    dropi_list = load_dropi(dropi_path)
    ecom_list = flatten_ecomhub(ecom_path, country_id=args.country_id)

    ecom_index = index_by_tokens(ecom_list, "nome")

    matches: list[MatchRow] = []
    revisar: list[MatchRow] = []
    matched_dropi_ids: set[str] = set()
    matched_ecom_ids: set[str] = set()

    for d in dropi_list:
        if d.stock < args.min_stock:
            continue
        ecom, score = find_best_match(d, ecom_list, ecom_index, args.review_score)
        if not ecom or ecom.stock < args.min_stock:
            continue

        row = build_match_row(d, ecom, score)
        if score >= args.min_score:
            matches.append(row)
            matched_dropi_ids.add(d.id)
            matched_ecom_ids.add(ecom.id)
        elif score >= args.review_score:
            revisar.append(row)

    matches.sort(key=lambda m: m.score_oportunidade, reverse=True)
    revisar.sort(key=lambda m: m.score, reverse=True)

    oportunidades: list[dict] = []
    seen_pairs: set[tuple[str, str]] = set()
    stock_scan_score = min(args.review_score, 0.55)

    for d in dropi_list:
        ecom, score = find_best_match(d, ecom_list, ecom_index, stock_scan_score)
        if not ecom:
            continue
        key = (d.id, ecom.id)
        if key in seen_pairs:
            continue
        seen_pairs.add(key)
        row = build_match_row(d, ecom, score)
        tags, insight, ratio = classify_stock_opportunity(row)
        if not tags:
            continue
        oportunidades.append(
            {
                **asdict(row),
                "tags": ",".join(tags),
                "insight": insight,
                "stock_ratio": ratio,
            }
        )

    oportunidades.sort(
        key=lambda o: (
            "dropi_baixo_ecom_alto" in o.get("tags", ""),
            o.get("stock_ratio", 0),
        ),
        reverse=True,
    )

    dropi_exclusivos = [d for d in dropi_list if d.id not in matched_dropi_ids]
    ecom_exclusivos = [e for e in ecom_list if e.id not in matched_ecom_ids]

    oportunidades_dropi = [
        asdict(m)
        for m in matches
        if m.mais_barato == "dropi" and (m.margem_pct or 0) >= args.min_margin_pct
    ]
    oportunidades_ecom = [
        asdict(m)
        for m in matches
        if m.mais_barato == "ecomhub" and (m.margem_pct or 0) >= args.min_margin_pct
    ]

    unified = []
    for d in dropi_list:
        row = to_unified_dropi(d)
        row["tags"] = ",".join(tag_single_product("dropipro", d.stock, d.preco_eur, d.peso_kg))
        unified.append(row)
    for e in ecom_list:
        row = to_unified_ecom(e)
        preco = custo_total_ecomhub(e) or e.preco_eur or 0
        peso = (e.peso_g or 0) / 1000.0
        row["tags"] = ",".join(tag_single_product("ecomhub", e.stock, preco, peso))
        unified.append(row)
    unified.sort(key=lambda r: r["score_minerado"], reverse=True)

    ranking_dropi = sorted(
        [to_unified_dropi(d) for d in dropi_exclusivos if d.stock >= args.min_stock],
        key=lambda r: r["score_minerado"],
        reverse=True,
    )
    ranking_ecom = sorted(
        [to_unified_ecom(e) for e in ecom_exclusivos if e.stock >= args.min_stock],
        key=lambda r: r["score_minerado"],
        reverse=True,
    )

    unified_fields = [
        "fonte", "id", "nome", "sku", "preco_eur", "stock", "peso",
        "envio_eur", "armazem", "imagem", "link", "score_minerado", "tags",
    ]
    opp_fields = list(MatchRow.__dataclass_fields__.keys()) + [
        "tags", "insight", "stock_ratio",
    ]
    match_fields = list(MatchRow.__dataclass_fields__.keys())

    write_csv(out_dir / "minerado_unificado.csv", unified, unified_fields)
    write_csv(out_dir / "ranking_dropi_exclusivos.csv", ranking_dropi[:500], unified_fields)
    write_csv(out_dir / "ranking_ecomhub_exclusivos.csv", ranking_ecom[:500], unified_fields)
    write_csv(out_dir / "matches.csv", [asdict(m) for m in matches], match_fields)
    write_csv(out_dir / "matches_revisar.csv", [asdict(m) for m in revisar], match_fields)
    write_csv(out_dir / "oportunidades_estoque.csv", oportunidades, opp_fields)
    (out_dir / "oportunidades_estoque.json").write_text(
        json.dumps(oportunidades, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    write_csv(out_dir / "oportunidades_mais_barato_dropi.csv", oportunidades_dropi, match_fields)
    write_csv(out_dir / "oportunidades_mais_barato_ecomhub.csv", oportunidades_ecom, match_fields)
    write_csv(
        out_dir / "dropi_exclusivos.csv",
        [asdict(d) for d in dropi_exclusivos],
        list(DropiProduct.__dataclass_fields__.keys()),
    )
    write_csv(
        out_dir / "ecomhub_exclusivos.csv",
        [asdict(e) for e in ecom_exclusivos],
        list(EcomhubProduct.__dataclass_fields__.keys()),
    )

    resumo = {
        "dropi_total": len(dropi_list),
        "ecomhub_total": len(ecom_list),
        "minerado_unificado": len(unified),
        "matches_confiaveis": len(matches),
        "matches_revisar": len(revisar),
        "dropi_exclusivos": len(dropi_exclusivos),
        "ecomhub_exclusivos": len(ecom_exclusivos),
        "oportunidades_dropi_mais_barato": len(oportunidades_dropi),
        "oportunidades_ecomhub_mais_barato": len(oportunidades_ecom),
        "oportunidades_estoque": len(oportunidades),
        "dropi_baixo_ecom_alto": sum(
            1 for o in oportunidades if "dropi_baixo_ecom_alto" in o.get("tags", "")
        ),
        "atualizado_em": datetime.now(timezone.utc).isoformat(),
        "min_score": args.min_score,
        "review_score": args.review_score,
        "min_stock": args.min_stock,
        "arquivos": {
            "minerado_unificado": str(out_dir / "minerado_unificado.csv"),
            "ranking_dropi": str(out_dir / "ranking_dropi_exclusivos.csv"),
            "ranking_ecomhub": str(out_dir / "ranking_ecomhub_exclusivos.csv"),
            "matches": str(out_dir / "matches.csv"),
            "matches_revisar": str(out_dir / "matches_revisar.csv"),
            "oportunidades_dropi": str(out_dir / "oportunidades_mais_barato_dropi.csv"),
            "oportunidades_ecomhub": str(out_dir / "oportunidades_mais_barato_ecomhub.csv"),
            "dropi_exclusivos": str(out_dir / "dropi_exclusivos.csv"),
            "ecomhub_exclusivos": str(out_dir / "ecomhub_exclusivos.csv"),
        },
    }

    (out_dir / "resumo.json").write_text(
        json.dumps(resumo, indent=2, ensure_ascii=False), encoding="utf-8"
    )

    return resumo


def main() -> None:
    parser = argparse.ArgumentParser(description="Minerador Dropi PRO × EcomHub")
    parser.add_argument("--dropi", default=str(ROOT / "dropipro-catalogo2.json"))
    parser.add_argument(
        "--ecomhub",
        default=str(ROOT / "catalogo-ecomhub-allprodutos-espanha.json"),
    )
    parser.add_argument("--output", default=str(OUTPUT))
    parser.add_argument("--country-id", type=int, default=164, help="Espanha = 164")
    parser.add_argument("--min-score", type=float, default=0.72, help="Match confiável")
    parser.add_argument("--review-score", type=float, default=0.58, help="Match para revisão manual")
    parser.add_argument("--min-stock", type=int, default=10, help="Stock mínimo nos rankings")
    parser.add_argument("--min-margin-pct", type=float, default=5.0)
    args = parser.parse_args()

    resumo = run(args)

    print("\n=== MINERADOR DE PRODUTOS ===\n")
    print(f"Dropi PRO:        {resumo['dropi_total']} produtos")
    print(f"EcomHub (ES):     {resumo['ecomhub_total']} produtos")
    print(f"Minerado unificado: {resumo['minerado_unificado']} linhas")
    print(f"Matches confiáveis: {resumo['matches_confiaveis']} (score >= {resumo['min_score']})")
    print(f"Matches revisar:    {resumo['matches_revisar']} (score {resumo['review_score']}-{resumo['min_score']})")
    print(f"Só Dropi:           {resumo['dropi_exclusivos']}")
    print(f"Só EcomHub:         {resumo['ecomhub_exclusivos']}")
    print(f"Mais barato Dropi:  {resumo['oportunidades_dropi_mais_barato']}")
    print(f"Mais barato EcomHub: {resumo['oportunidades_ecomhub_mais_barato']}")
    print(f"Oportunidades stock:  {resumo['oportunidades_estoque']}")
    print(f"  └ Dropi baixo/Ecom alto: {resumo['dropi_baixo_ecom_alto']}")
    print(f"\nArquivos em: {Path(args.output).resolve()}\n")


if __name__ == "__main__":
    main()
