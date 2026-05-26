# youtube-to-article

Generate structured articles from YouTube videos with a React frontend and a Cloudflare Workers backend powered by Google AI Studio (Gemini).

## Stack

- **Backend:** Cloudflare Workers + TypeScript
- **Frontend:** React + HeroUI + React Router + i18next (English / 中文)
- **Generation:** Google AI Studio Gemini API
- **Persistence:** IndexedDB for local session history

## Development

```bash
pnpm install
pnpm run build
pnpm run lint
pnpm test
```

To run the static frontend locally:

```bash
pnpm run dev
```

The Vite dev server proxies `/api/*` requests to `http://127.0.0.1:8787` by default,
so keep the Worker running in another terminal.

To run the Worker locally after building the frontend assets:

```bash
pnpm run build
pnpm run dev:worker
```

If your Worker runs on a different origin, set `WORKER_DEV_ORIGIN` before `pnpm run dev`.

## Environment variables

Set these for the Worker:

- `GEMINI_API_KEY` – Google AI Studio API key
- `AI_MODEL` – optional, defaults to `gemini-2.0-flash`

For local Worker development, create a `.dev.vars` file:

```bash
GEMINI_API_KEY=your_api_key
AI_MODEL=gemini-3.5-flash
```

## Deploy

```bash
pnpm run deploy
```
