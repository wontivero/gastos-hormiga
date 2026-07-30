const CACHE_NAME = 'gastos-hormiga-v2';
const ASSETS_TO_CACHE = [
    './',
    'index.html',
    'app.js',
    'manifest.json',
    'icon-192.png',
    'icon-512.png',
    'icono.png',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js'
];

// Instalación: Precaching de archivos clave
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Instalando y guardando caché...');
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        }).then(() => self.skipWaiting())
    );
});

// Activación: Limpieza de cachés antiguas
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activado');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log('[Service Worker] Borrando caché antigua:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => self.claim())
    );
});

// Fetch: Estrategia Stale-While-Revalidate para mayor velocidad y soporte offline
self.addEventListener('fetch', (event) => {
    // Ignorar solicitudes que no sean GET (como escrituras a Firebase)
    if (event.request.method !== 'GET') return;

    // No cachear llamadas directas a Firebase RTDB en tiempo real
    if (event.request.url.includes('firebaseio.com') || event.request.url.includes('googleapis.com')) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            const fetchPromise = fetch(event.request).then((networkResponse) => {
                // Si la respuesta es válida, actualizamos la caché
                if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return networkResponse;
            }).catch(() => {
                // En caso de fallo de red, si no hay respuesta en caché, no rompe
            });

            return cachedResponse || fetchPromise;
        })
    );
});