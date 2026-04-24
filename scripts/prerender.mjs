// Post-build prerender step.
// Calls the SSR worker entry with a GET / request and writes the rendered HTML
// to dist/client/index.html so that Vercel (or any static host) can serve the
// app as an SPA. The asset references inside the HTML point to dist/client/assets/*,
// which Vercel serves alongside index.html.
//
// Why this exists: TanStack Start's build emits the client JS/CSS into
// dist/client/ but does not produce a static index.html (because it is designed
// to be served by the SSR worker). For Vercel static hosting we synthesize one
// at build time by invoking the worker entry directly in Node.

import { writeFile, access } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const serverEntryPath = resolve(projectRoot, "dist/server/index.js");
const outputPath = resolve(projectRoot, "dist/client/index.html");

try {
  await access(serverEntryPath);
} catch {
  console.error(
    `[prerender] Server entry not found at ${serverEntryPath}. Did you run "vite build" first?`,
  );
  process.exit(1);
}

const mod = await import(pathToFileURL(serverEntryPath).href);
const handler = mod.default;
if (!handler || typeof handler.fetch !== "function") {
  console.error("[prerender] Worker entry does not expose a fetch() handler.");
  process.exit(1);
}

const request = new Request("http://localhost/", { method: "GET" });
const env = {};
const ctx = { waitUntil() {}, passThroughOnException() {} };

const response = await handler.fetch(request, env, ctx);
if (!response.ok) {
  console.error(`[prerender] SSR returned status ${response.status}`);
  process.exit(1);
}

const html = await response.text();
await writeFile(outputPath, html, "utf8");
console.log(`[prerender] Wrote ${outputPath} (${html.length} bytes)`);
