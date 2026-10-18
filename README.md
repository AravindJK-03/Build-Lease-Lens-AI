# Lease Lens AI

Lease Lens AI combines a React/Vite frontend with an Express API for reviewing rental agreements. The local API supports Ollama; production deployments should use an externally hosted provider such as Anthropic. Local Ollama running on a developer machine is not reachable from Vercel.

## Local development

Requirements: Node.js 22 and npm.

Create `server/.env` from `server/.env.example` for local configuration, then run the backend and frontend in separate terminals:

```powershell
cd server
npm.cmd run dev
```

```powershell
cd client
npm.cmd run dev
```

The backend listens on port `4000`; Vite listens on port `5180` and proxies `/api` to the backend. Do not commit `.env` files.

## Checks

From the repository root:

```powershell
npm.cmd install
npm.cmd run build
npm.cmd test
```

## Deploy to Vercel

Import the repository as a single Vercel project and leave **Root Directory** at the repository root (`.`). The root npm workspaces install both app packages. [vercel.json](./vercel.json) builds the Vite app to `client/dist` and configures the catch-all API function for up to 300 seconds. `/api/review` and `/api/health` use the existing Express app through a Vercel Node.js Function. The Vite development proxy is local-only; the frontend continues to use same-origin relative `/api` URLs in production.

Set the Vercel **Framework Preset** to **Other** if it is not detected automatically. Use these settings:

- **Install Command:** `npm install`
- **Build Command:** `npm run build`
- **Output Directory:** `client/dist`
- **Development Command:** leave unset
- **Node.js Version:** 22.x

Set the following in Vercel Project Settings → Environment Variables for Production (and Preview only if desired):

- `AI_PROVIDER` = `anthropic`
- `AI_MODEL` = a Claude model currently available to the Anthropic account
- `ANTHROPIC_API_KEY` = configured privately in Vercel; never use a `VITE_` prefix
- `AI_TIMEOUT_MS` = `270000` (270 seconds, below the 300-second function limit)

Do not configure `AI_BASE_URL` for Claude. Avoid setting `AI_TIMEOUT_MS` above the function maximum. On Vercel Hobby, functions can run for up to 300 seconds; higher plans may allow more, but this project deliberately caps the function at 300 seconds for portability.

The upload limit is 4 MiB plus multipart overhead, below Vercel Functions' 4.5 MB request-body limit. PDF parsing uses the Node-compatible `pdf-parse` package and requires Node 22 or later. The function holds uploaded PDF data in memory and sends extracted text to the configured AI provider. See Vercel's [Express](https://vercel.com/docs/frameworks/backend/express), [Vite](https://vercel.com/docs/frameworks/frontend/vite), [function duration](https://vercel.com/docs/functions/configuring-functions/duration), and [function limits](https://vercel.com/docs/functions/limitations) documentation for platform details. Vercel runtime build and live AI behavior must still be confirmed with a deployment; no deployment or Claude API request has been performed as part of this preparation.
