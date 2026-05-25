# mineradov1

Minerador Dropi PRO × EcomHub com dashboard web, filtros de mineração e assistente de catálogo.

## Requisitos

- Node.js 18+
- Python 3.10+

## Configuração

1. Copia o template de ambiente e preenche a tua chave OpenAI:

```bash
cp web/env.example.template web/.env.example
# ou: cp web/env.example.template web/.env
```

2. Instala dependências:

```bash
cd web && npm install
```

## Comandos

Na raiz do projeto:

```bash
npm run dev      # dashboard + API do assistente
python3 miner.py # atualizar dados minerados
```

## Estrutura

- `miner.py` — cruza catálogos Dropi e EcomHub
- `web/` — dashboard React (Vite) + servidor do chat
- `web/public/data/` — JSON servido ao frontend
- `web/server/prompts/productMining.txt` — instruções do **ProductMiningAgent** (tendência, score, riscos)
- `web/server/agents/ProductMiningAgent.mjs` — carrega o prompt de mineração
- `web/server/services/` — Google Trends (CLI), scoring, research
- `web/server/adapters/externalDataAdapters.mjs` — mocks TikTok / Meta / Amazon / AliExpress / Shopee (substituir por APIs reais)
- `services/google_trends_cli.py` + `services/requirements-mining.txt` — pytrends (opcional)
- `web/src/types/productResearch.ts` — tipos TypeScript partilhados

### ProductMiningAgent (chat + API)

No **chat** do dashboard, o modelo passa a ter ferramentas extra:

- `pesquisar_tendencia_google` — Google Trends (Python + pytrends; ver comandos abaixo)
- `analisar_potencial_produto` — score 0–100, riscos, preço sugerido, recomendação TESTAR/ESCALAR/EVITAR
- `comparar_potencial_produtos` — até 4 produtos

Endpoint JSON (sem LLM): `POST /api/product-mining/analyze` com body `{ "fonte": "dropipro", "id": "123", "geo": "PT" }`.

**Vercel:** o bundle inclui `services/**`; se `python3` + pytrends não estiverem disponíveis no runtime, o serviço devolve tendência degradada e o score indica `trendDataAvailable: false`. Para tendências reais em produção, usa máquina com Python (VPS, Cloud Run, etc.) ou cache pré-calculado.

**Instalação local (Trends):** no mesmo ambiente onde corres o Node:

```bash
cd "/Users/lucasgalhardo/Documents/DANIEL MAIA/api-produtos"
python3 -m pip install -r services/requirements-mining.txt
```

Se aparecer `command not found: pip`, **não uses `pip` sozinho** — usa sempre `python3 -m pip` (como acima).

Se der erro de **permissão** em `~/Library/Python`, usa um **venv** na raiz do repo:

```bash
cd "/Users/lucasgalhardo/Documents/DANIEL MAIA/api-produtos"
python3 -m venv .venv-mining
source .venv-mining/bin/activate
python3 -m pip install -r services/requirements-mining.txt
```

Antes de `npm run dev`, ativa o mesmo venv **ou** define no `web/.env`:

`PYTHON_BIN=/caminho/completo/api-produtos/.venv-mining/bin/python3`

(O servidor usa esse binário para `services/google_trends_cli.py`.)

## Segurança

Ficheiros `.env`, `.env.example` e variantes **não** são versionados. Nunca commits chaves de API.
