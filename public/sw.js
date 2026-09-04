/* global self, caches, fetch */

const STATIC_CACHE_PREFIX = "matchuplab-static-";
const LEGACY_STATIC_CACHE_PREFIX = "tennis-organizing-static-";
const STATIC_CACHE_POLICY_VERSION = "v3";
const STATIC_CACHE_NAME = `${STATIC_CACHE_PREFIX}${STATIC_CACHE_POLICY_VERSION}`;

const PRECACHE_URLS = [
  "/",
  "/members",
  "/matchups/doubles",
  "/matchups/singles",
  "/manifest.webmanifest",
  "/icons/icon-192.png?iconv=matchuplab-v1",
  "/icons/icon-512.png?iconv=matchuplab-v1",
  "/fonts/NotoSansJP-VF.ttf?v=20260512",
];
const CACHEABLE_PATH_PREFIXES = ["/_next/static/", "/icons/", "/fonts/"];

function isCacheableStaticRequest(request) {
  if (request.method !== "GET") {
    return false;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return false;
  }

  if (request.headers.has("range")) {
    return false;
  }

  return CACHEABLE_PATH_PREFIXES.some((prefix) =>
    url.pathname.startsWith(prefix),
  );
}

function isCacheableNavigationRequest(request) {
  if (request.method !== "GET" || request.mode !== "navigate") {
    return false;
  }

  const url = new URL(request.url);
  return url.origin === self.location.origin;
}

async function deleteOldStaticCaches() {
  const cacheNames = await caches.keys();
  await Promise.all(
    cacheNames
      .filter(
        (cacheName) =>
          (cacheName.startsWith(STATIC_CACHE_PREFIX) || cacheName.startsWith(LEGACY_STATIC_CACHE_PREFIX)) &&
          cacheName !== STATIC_CACHE_NAME,
      )
      .map((cacheName) => caches.delete(cacheName)),
  );
}

async function addStaticResponseToCache(request, response) {
  if (!response || !response.ok || response.type !== "basic") {
    return;
  }

  try {
    const cache = await caches.open(STATIC_CACHE_NAME);
    await cache.put(request, response.clone());
  } catch {
    // Cache writes must not block the network response.
  }
}

async function staleWhileRevalidate(request, event) {
  const cache = await caches.open(STATIC_CACHE_NAME);
  const cachedResponse = await cache.match(request);
  const networkResponsePromise = fetch(request).then(async (response) => {
    await addStaticResponseToCache(request, response);
    return response;
  });

  if (cachedResponse) {
    event.waitUntil(networkResponsePromise.catch(() => undefined));
    return cachedResponse;
  }

  return networkResponsePromise;
}

async function networkFirstNavigation(request) {
  const cache = await caches.open(STATIC_CACHE_NAME);

  try {
    const response = await fetch(request);
    await addStaticResponseToCache(request, response);
    return response;
  } catch {
    return (
      (await cache.match(request)) ||
      (await cache.match("/")) ||
      new Response("オフラインです。初回オンラインアクセス後に再度お試しください。", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      })
    );
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch(() => undefined),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([deleteOldStaticCaches(), self.clients.claim()]),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (!isCacheableStaticRequest(request)) {
    if (isCacheableNavigationRequest(request)) {
      event.respondWith(networkFirstNavigation(request));
    }
    return;
  }

  event.respondWith(staleWhileRevalidate(request, event));
});
