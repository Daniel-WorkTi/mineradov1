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
- `scripts/prepare-dashboard-data.py` — prepara dados para o dashboard

## Segurança

Ficheiros `.env`, `.env.example` e variantes **não** são versionados. Nunca commits chaves de API.
