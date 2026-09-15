/* 文字組みメモ：一度開いたら、電波がなくても開けるようにする */
const CACHE = 'mojimemo-app-v1';
const FONT_CACHE = 'mojimemo-fonts-v1';
const APP_FILES = ['./', './index.html', './manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png', './icon-512-maskable.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => Promise.all(APP_FILES.map((url) => cache.add(url).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key.startsWith('mojimemo-') && key !== CACHE && key !== FONT_CACHE)
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    // アプリ本体：つながるときは最新を取りに行き、つながらないときは保存しておいたものを使う
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          const hit = await caches.match(request, { ignoreSearch: true });
          if (hit) return hit;
          if (request.mode === 'navigate') {
            const shell = (await caches.match('./index.html')) || (await caches.match('./'));
            if (shell) return shell;
          }
          return Response.error();
        })
    );
    return;
  }

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    // 書体：一度読み込んだものは保存しておき、次からはそれを使う
    event.respondWith(
      caches.open(FONT_CACHE).then((cache) =>
        cache.match(request).then((hit) => hit || fetch(request).then((response) => {
          if (response.ok) cache.put(request, response.clone());
          return response;
        }))
      )
    );
  }
});
