const CACHE_NAME = 'automatenunsinn-v2';
const ASSETS = [
  '/',
  'index.html',
  'style.css',
  'style.js',
  'favicon.ico',
  'manifest.json',
  // Data
  'bazn.json',
  'teile.tsv'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Use cache.addAll but catch individual failures if any asset is missing
      return Promise.allSettled(
        ASSETS.map(asset => cache.add(asset))
      ).then(results => {
        const failed = results.filter(r => r.status === 'rejected');
        if (failed.length > 0) {
          console.warn('Some assets failed to cache:', failed.map(f => f.reason));
        }
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
