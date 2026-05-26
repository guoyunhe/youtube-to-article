# youtube-to-article

Generate structured articles from YouTube videos with a React frontend and a Cloudflare Workers backend powered by Google AI Studio (Gemini).

## Stack

- **Backend:** Cloudflare Workers + TypeScript
- **Frontend:** React + HeroUI + React Router + i18next (English / 中文)
- **Generation:** Google AI Studio Gemini API
- **Persistence:** IndexedDB for local session history

## Development

```bash
npm install
npm run build
npm run lint
```

To run the static frontend locally:

```bash
npm run dev
```

To run the Worker locally after building the frontend assets:

```bash
npm run build
npm run dev:worker
```

## Environment variables

Set these for the Worker:

- `GEMINI_API_KEY` – Google AI Studio API key
- `AI_MODEL` – optional, defaults to `gemini-2.0-flash`

For local Worker development, create a `.dev.vars` file:

```bash
GEMINI_API_KEY=your_api_key
AI_MODEL=gemini-2.0-flash
```

## Deploy

```bash
npm run deploy
```
