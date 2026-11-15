const CACHE = "niya-glass-v4";
const FILES = [
  "./",
  "./index.html",
  "./css/style.css",
  "./js/main.js",
  "./js/config.js",
  "./js/canvas.js",
  "./js/tools.js",
  "./js/fill.js",
  "./js/glass.js",
  "./js/templates.js",
  "./js/storage.js",
  "./js/export.js",
  "./js/audio.js",
  "./js/ui.js",
  "./manifest.webmanifest",
  "./assets/fonts/Vazirmatn-Regular.woff2",
  "./assets/fonts/Vazirmatn-Bold.woff2",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const response = await fetch(event.request);
      if (response && response.ok) cache.put(event.request, response.clone());
      return response;
    } catch (error) {
      return (await cache.match(event.request)) || cache.match("./index.html");
    }
  })());
});
