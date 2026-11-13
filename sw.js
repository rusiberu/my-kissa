// オフラインでも開けるようにするための仕組み（Service Worker）
const CACHE_NAME = "my-kissa-v2";
const CACHE_FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./recipes.js",
  "./app.js",
  "./manifest.json",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(CACHE_FILES)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("my-kissa-") && key !== CACHE_NAME) /* 同じ住所のほかのアプリのキャッシュは消さない */.map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

// ネット優先: まず最新を取りに行き、失敗した時だけキャッシュ(オフライン用)を使う
self.addEventListener("fetch", (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // 成功した返事（200番台）だけ保存する。404やエラーで正しいキャッシュを上書きしないため
        if (response.ok && event.request.method === "GET") {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
