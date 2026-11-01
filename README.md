# Envio Full · Serena

Preparação de envios para o Full do Mercado Livre: importação das etiquetas (ZPL) e pré-vendas (PDF), vínculos anúncio × produto, separação pelo celular via QR, etiquetagem de unidades e kits, fechamento.

## Estrutura

- `src/` — código da aplicação (partes JS + CSS)
- `build.py` — junta `src/` em `public/index.html` (`python3 build.py`)
- `public/` — o que a Vercel publica (HTML, logos, ícone, som)
- `supabase/functions/full-api/` — Edge Function da API (projeto Supabase do Picking, tabelas `full_*`)

## Publicação

Cada push no `main` publica automaticamente na Vercel (projeto `envio-full-serena`). Rode `python3 build.py` antes do commit sempre que mexer em `src/`.

A Edge Function é publicada separadamente no Supabase (`full-api`, sem verificação de JWT; a autenticação é feita por usuário + PIN e por token de QR).
