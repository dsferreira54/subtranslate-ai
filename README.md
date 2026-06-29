# SubTranslate AI

LLM-powered web application for translating SRT subtitle files cue-by-cue, with semantic context windows and leakage validation.

## Features

- Upload and validate `.srt` files
- Cue-by-cue translation (never translates the entire file at once)
- Sliding context window (configurable, default 10 cues before/after)
- Prior translations included as context for consistency
- Context leakage validation with automatic retries
- Multiple LLM providers: OpenAI, Anthropic, Gemini, OpenRouter, DeepSeek, custom OpenAI-compatible
- Real-time progress via Server-Sent Events
- Side-by-side preview with per-cue status
- Pause, resume, and cancel during translation
- Download translated SRT and export review report
- Optional glossary and style instructions
- Session cache for duplicate lines
- Estimated token cost tracking
- API keys kept in server memory only (LLM config saved in browser cookies)

## Prerequisites

- Node.js 20+
- npm 10+

## Quick Start

```bash
npm install
npm run dev
```

This starts:
- Backend at http://localhost:3001
- Frontend at http://localhost:5173

Open http://localhost:5173 in your browser.

## Usage

1. Upload a valid `.srt` file
2. Select an LLM provider and enter your API key
3. Choose source/target languages and configure options
4. Click **Translate**
5. Monitor progress and preview translations
6. Download the translated SRT when complete

## Project Structure

```
subtranslate-ai/
├── shared/          # Shared TypeScript types
├── backend/         # Fastify API + translation engine
│   └── src/
│       ├── srtParser.ts
│       ├── llmProviders/
│       ├── translation/
│       └── jobs/
└── frontend/        # React + Vite UI
```

## Supported Providers & Example Models

| Provider | Example Model |
|----------|---------------|
| OpenAI | `gpt-4o-mini` |
| Anthropic | `claude-3-5-haiku-latest` |
| Gemini | `gemini-2.0-flash` |
| OpenRouter | `openai/gpt-4o-mini` |
| DeepSeek | `deepseek-v4-flash` |
| Custom | Any OpenAI-compatible model |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Backend port |
| `HOST` | `0.0.0.0` | Backend host |

No API keys are required in environment variables — users provide them via the UI.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start backend + frontend concurrently |
| `npm run build` | Build all packages |
| `npm test` | Run backend unit tests |

## Security Notes

- API keys are sent once to the backend and stored only in memory for the job duration
- Keys are never included in SSE events or logs (redacted on errors)
- Keys are not persisted server-side by default
- LLM configuration (including API key) is saved in browser cookies on the client

## Production Considerations

The in-memory job store is suitable for local/single-user use. For production:
- Replace in-memory job store with Redis or similar
- Add authentication
- Configure HTTPS and secure CORS origins

## License

MIT
