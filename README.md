# QR Code Generator

Real-time QR code generator with custom module/eye shapes, gradients, and logo overlay. Built with TanStack Start + React 19 + Tailwind v4.

## Local development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

This runs `vite build` (which produces `dist/client/` and `dist/server/`) and then a small `scripts/prerender.mjs` that calls the SSR worker once for `/` and writes the rendered HTML to `dist/client/index.html`. The result is a fully static `dist/client/` directory ready to deploy to any static host.

The app is fully client-side (QR generation runs in the browser), so the static client output contains everything users need at runtime.

---

## Connecting to GitHub

1. In Lovable, open **Connectors** in the sidebar → **GitHub** → **Connect project**.
2. Authorize the Lovable GitHub App and pick the account/org.
3. Click **Create Repository** in Lovable. Code is pushed and stays in two-way sync — edits made in Lovable push to GitHub automatically, and pushes/PRs merged on GitHub sync back into Lovable.

## Deploying to Vercel

The repo includes a `vercel.json` that tells Vercel exactly what to do.

### Steps
1. Go to https://vercel.com/new and import your GitHub repo.
2. Vercel reads `vercel.json` automatically. The detected settings will be:
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist/client`
   - **Install Command**: `npm install`
   - **Framework Preset**: Other (overridden by `vercel.json` — do not change)
3. Click **Deploy**. First deploy takes ~1–2 minutes.

### Why these settings
- `dist/client` is the static output the prerender step produces.
- The SPA rewrite (`/(.*) → /index.html`) lets deep links and page refreshes work — every unmatched URL serves the SPA shell, and the client-side router takes it from there.

### Environment variables
This project currently has none. If you add any later, set them in **Vercel → Project → Settings → Environment Variables**. Vite exposes only variables prefixed with `VITE_` to the client.

### Custom domain
**Vercel → Project → Settings → Domains** → add your domain and follow the DNS instructions Vercel gives you.

### Notes
- `wrangler.jsonc` stays in the repo for optional Cloudflare Workers deployment — Vercel ignores it.
- The Lovable preview keeps working unchanged; the prerender step only runs on production builds.
