const CACHE_NAME = 'osoznannye-dengi-v11';
const RESET_FLAG = 'sw-reset-done-v11';
const STATIC_ASSETS = [
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,100..900&family=Hanken+Grotesk:wght@400;500;600;700&display=swap'
];

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.has(RESET_FLAG).then(alreadyReset => {
      if (alreadyReset) {
        // Уже сбрасывали — обычная работа: чистим старые кеши
        return caches.keys()
          .then(keys => Promise.all(
            keys.filter(k => k !== CACHE_NAME && k !== RESET_FLAG).map(k => caches.delete(k))
          ))
          .then(() => self.clients.claim());
      }

      // ЯДЕРНЫЙ СБРОС: первая активация новой версии
      return caches.keys()
        .then(keys => Promise.all(keys.map(k => caches.delete(k)))) // сносим все кеши
        .then(() => caches.open(RESET_FLAG))                         // ставим флаг "уже сбросили"
        .then(() => self.clients.claim())
        .then(() => self.clients.matchAll({ includeUncontrolled: true, type: 'window' }))
        .then(clients => {
          // Перезагружаем все открытые вкладки
          clients.forEach(c => c.navigate(c.url).catch(() => {}));
          // Разрегистрируем себя — следующая загрузка пойдёт напрямую с сети
          return self.registration.unregister();
        });
    })
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  // HTML всегда с сети (network-first)
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
    return;
  }

  // Статика — cache-first
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).then(resp => {
      if (resp && resp.status === 200) {
        caches.open(CACHE_NAME).then(c => c.put(e.request, resp.clone()));
      }
      return resp;
    }).catch(() => null))
  );
});
