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