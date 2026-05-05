// Un Service Worker básico para permitir la instalación de la PWA

self.addEventListener('install', (e) => {
    console.log('[Service Worker] Instalado');
    self.skipWaiting(); // Fuerza a que el nuevo Service Worker tome el control de inmediato
});

self.addEventListener('activate', (e) => {
    console.log('[Service Worker] Activado');
    e.waitUntil(clients.claim()); // Asegura que la página actual use la nueva versión al instante
});

self.addEventListener('fetch', (e) => {
    // Deja pasar las peticiones de red normalmente
    e.respondWith(fetch(e.request));
});