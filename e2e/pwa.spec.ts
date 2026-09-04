import { expect, test } from "@playwright/test";

test("serves a valid web manifest", async ({ request }) => {
  const response = await request.get("/manifest.webmanifest");
  expect(response.ok()).toBeTruthy();

  const manifest = await response.json();
  expect(manifest.name).toBe("MatchupLab");
  expect(manifest.short_name).toBe("MatchupLab");
  expect(manifest.start_url).toBe("/");
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        src: "/icons/icon-192.png?iconv=matchuplab-v1",
        sizes: "192x192",
        type: "image/png",
      }),
      expect.objectContaining({
        src: "/icons/icon-512.png?iconv=matchuplab-v1",
        sizes: "512x512",
        type: "image/png",
      }),
    ]),
  );

  for (const icon of ["/icons/icon-192.png", "/icons/icon-512.png"]) {
    const iconResponse = await request.get(icon);
    expect(iconResponse.ok()).toBe(true);
    expect(iconResponse.headers()["content-type"]).toContain("image/png");
  }
});

test("serves the service worker with update-safe headers", async ({ request }) => {
  const response = await request.get("/sw.js");
  expect(response.ok()).toBeTruthy();
  expect(response.headers()["content-type"]).toContain("application/javascript");
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect(response.headers()["service-worker-allowed"]).toBe("/");

  const serviceWorker = await response.text();
  expect(serviceWorker).toContain("/_next/static/");
  expect(serviceWorker).toContain("/icons/");
  expect(serviceWorker).toContain("/fonts/");
  expect(serviceWorker).not.toContain("/brand/");
  expect(serviceWorker).not.toContain("logo-bamboosato");
  expect(serviceWorker).toContain('STATIC_CACHE_POLICY_VERSION = "v3"');
  expect(serviceWorker).not.toContain("tennis-organizing-static-v1.0.0");
});

test("caches static assets without caching API responses", async ({ page }) => {
  await page.goto("/");

  const result = await page.evaluate(async () => {
    if (!("serviceWorker" in navigator) || !("caches" in window)) {
      return {
        supported: false,
        staticAssetCached: false,
        runtimeResponseCached: false,
        staticCacheName: null,
      };
    }

    const existingRegistration = await navigator.serviceWorker.getRegistration(
      "/",
    );
    await existingRegistration?.unregister();

    const existingCacheNames = await caches.keys();
    await Promise.all(
      existingCacheNames
        .filter((cacheName) => cacheName.startsWith("matchuplab-static-"))
        .map((cacheName) => caches.delete(cacheName)),
    );

    const registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    });

    await new Promise<void>((resolve) => {
      const installingWorker = registration.installing;
      if (!installingWorker || installingWorker.state === "installed") {
        resolve();
        return;
      }

      installingWorker.addEventListener("statechange", () => {
        if (installingWorker.state === "installed") {
          resolve();
        }
      });
    });

    if (registration.waiting && !navigator.serviceWorker.controller) {
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
    }

    await navigator.serviceWorker.ready;

    if (!navigator.serviceWorker.controller) {
      await new Promise<void>((resolve) => {
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          () => resolve(),
          { once: true },
        );
      });
    }

    const staticUrl = `/icons/icon-192.png?sw-test=${Date.now()}`;
    const nonStaticUrl = `/api/local-only-test?sw-test=${Date.now()}`;
    await fetch(staticUrl);
    await fetch(nonStaticUrl).catch(() => undefined);

    const cacheNames = await caches.keys();
    const staticCacheName = cacheNames.find((cacheName) =>
      cacheName.startsWith("matchuplab-static-"),
    );
    const staticCache = staticCacheName
      ? await caches.open(staticCacheName)
      : null;

    const staticAssetCached = Boolean(
      staticCache && (await staticCache.match(staticUrl)),
    );
    const runtimeResponseCached = Boolean(
      staticCache && (await staticCache.match(nonStaticUrl)),
    );

    await registration.unregister();
    await Promise.all(
      cacheNames
        .filter((cacheName) => cacheName.startsWith("matchuplab-static-"))
        .map((cacheName) => caches.delete(cacheName)),
    );

    return {
      supported: true,
      staticAssetCached,
      runtimeResponseCached,
      staticCacheName,
    };
  });

  expect(result.supported).toBe(true);
  expect(result.staticAssetCached).toBe(true);
  expect(result.runtimeResponseCached).toBe(false);
  expect(result.staticCacheName).toContain("matchuplab-static-");
});

test("does not show the removed base-app splash in standalone PWA mode", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: (query: string) => ({
        matches: query === "(display-mode: standalone)",
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      }),
    });
  });

  await page.goto("/");

  await expect(page.getByTestId("pwa-splash-screen")).toHaveCount(0);
  await expect(page.locator('img[src*="/brand/"]')).toHaveCount(0);
});

test("shows the PWA favicon beside the app title", async ({ page }) => {
  for (const viewport of [
    { width: 1280, height: 800 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    for (const path of ["/", "/members", "/matchups/doubles", "/matchups/singles"]) {
      await page.goto(path);

      const brand = page.locator(".app-brand");
      const icon = brand.locator(".app-brand-icon");
      const title = brand.locator(".eyebrow");

      await expect(brand).toContainText("MatchupLab");
      await expect(icon).toBeVisible();
      await expect(icon).toHaveAttribute(
        "src",
        "/matchuplab-icon.png?iconv=matchuplab-v1",
      );
      await expect(icon).toHaveAttribute("alt", "");

      const [iconBox, titleBox] = await Promise.all([icon.boundingBox(), title.boundingBox()]);
      expect(iconBox).not.toBeNull();
      expect(titleBox).not.toBeNull();
      expect(iconBox!.x + iconBox!.width).toBeLessThanOrEqual(titleBox!.x);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
  }
});

test("keeps app icon URLs stable across app updates", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator(".brand-mark-image")).toHaveCount(0);
  const iconHrefs = await page
    .locator('link[rel="icon"], link[rel="apple-touch-icon"]')
    .evaluateAll((elements) =>
      elements.map((element) => (element as HTMLLinkElement).href),
    );

  expect(iconHrefs.length).toBeGreaterThan(0);
  expect(iconHrefs.every((href) => !href.includes("assetv="))).toBe(true);
  expect(iconHrefs.every((href) => href.includes("/matchuplab-icon.png"))).toBe(
    true,
  );
});
