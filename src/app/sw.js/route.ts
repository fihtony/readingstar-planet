const SERVICE_WORKER_SOURCE = `
const CACHE_NAME = "readingstar-shell-v3";
const STATIC_EXTENSIONS = /\\.(js|css|woff2?|otf|ttf|png|jpg|jpeg|svg|ico|webp)$/;

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const url = new URL(event.request.url);
  const acceptsHtml = event.request.headers.get("accept")?.includes("text/html");

  // Never cache API routes or Next.js internals
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/_next/")) {
    return;
  }

  // Never cache HTML/app-route documents. Stale page shells can mismatch fresh client bundles.
  if (event.request.mode === "navigate" || acceptsHtml) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Cache-first for static assets (fonts, images, etc.)
  if (STATIC_EXTENSIONS.test(url.pathname)) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }
});
`;

export async function GET() {
  return new Response(SERVICE_WORKER_SOURCE, {
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      "cache-control": "no-cache, no-store, must-revalidate",
    },
  });
}