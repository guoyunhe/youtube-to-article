# youtube-to-article

Generate structured articles from YouTube videos with a React frontend and a Cloudflare Workers backend powered by Google AI Studio (Gemini).

## Stack

- **Backend:** Cloudflare Workers + TypeScript
- **Frontend:** React + Material UI + React Router + i18next (English / 中文)
- **Generation:** Google AI Studio API & Gemini Models
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

## Thinking

### Gemini streaming flow

This project uses a two-layer streaming design:

1. The Worker calls Gemini with `generateContentStream` (Google AI Studio SDK) in `worker/lib/gemini.ts`.
2. The `/api/generateArticle` handler wraps Gemini chunks as NDJSON events and streams them to the browser.
3. The frontend reads the HTTP stream incrementally and updates the article in real time.

Worker stream event format (one JSON object per line):

```json
{"type":"delta","chunk":"..."}
{"type":"done","title":"..."}
{"type":"error","error":"..."}
```

Implementation notes:

- Gemini chunk source: `ai.models.generateContentStream(...)`
- Worker response headers: `content-type: application/x-ndjson; charset=utf-8` and `cache-control: no-store`
- Frontend parser: split by newline, parse each JSON line, append `delta` chunks, finalize on `done`, surface `error` when received

This design keeps first-token latency low and gives users visible progress while the article is being generated.

### How user generation requirements shape the output

The final article is controlled by the generation options collected in the frontend and embedded into the Worker prompt.

Prompt mapping in `worker/lib/gemini.ts`:

- `taskType` influences the article objective (for example, summary vs tutorial).
- `outputStyle` guides tone and writing style (for example, professional vs concise).
- `targetReaders` affects explanation depth and terminology.
- `outputLanguage` enforces output language (`Simplified Chinese` or `English`).
- `customPrompt` appends user-specific constraints and preferences.

In practice, this means two requests with the same transcript can produce clearly different results because the instruction block changes before calling Gemini.

To keep output grounded, the prompt also explicitly requires the model to rely only on transcript content and acknowledge uncertainty instead of inventing details.

### How to fetch and process YouTube video captions?

YouTube website blocks bots and scripts from fetching captions directly. Luckily, YouTube provides a special API for iOS devices that doesn't require authentication. This was learned by digging into code base of yt-dlp, a popular open-source YouTube downloader.

By using this API, I don't need any proxy server or third-party service. And it is totally free to use!

## License

GNU Affero General Public License v3.0 (AGPL-3.0)

## Acknowledgements

- [GitHub Copilot](https://copilot.github.com/) for code suggestions and assistance
- [Google AI Studio](https://ai.google.dev/studio) for the Gemini models and API
- [Cloudflare Workers](https://workers.cloudflare.com/) for the serverless platform
- [Vite](https://vitejs.dev/) for the frontend tooling
- [Material UI](https://mui.com/) for the React component library
- [i18next](https://www.i18next.com/) for internationalization support
- [Vitest](https://vitest.dev/) for unit testing
- [ESLint](https://eslint.org/) for code linting
- [TypeScript](https://www.typescriptlang.org/) for type safety
- [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) for client-side storage
- The open-source community for inspiration and support