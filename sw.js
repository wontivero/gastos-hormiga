// Un Service Worker básico para permitir la instalación de la PWA

self.addEventListener('install', (e) => {
    console.log('[Service Worker] Instalado');
});

self.addEventListener('fetch', (e) => {
    // Deja pasar las peticiones de red normalmente
    // (Aquí más adelante se podría configurar para funcionar sin internet)
    e.respondWith(fetch(e.request));
});