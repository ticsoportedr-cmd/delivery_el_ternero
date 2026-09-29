// EL TERNERO - Service Worker para Notificaciones Push Nativas y Soporte Offline
const CACHE_NAME = 'el-ternero-v2';
const API_CACHE_NAME = 'el-ternero-api-v2';

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/scooter.svg',
  '/el_ternero_logo.svg',
  '/src/assets/images/el_ternero_logo.svg',
  '/src/assets/images/el_ternero_logo_1785432949861.jpg',
  '/src/assets/images/burger_gourmet_bbq_1785520157604.jpg',
  '/src/assets/images/papas_cheddar_bacon_1785519190278.jpg',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
];

// Instalación: Pre-caché de recursos esenciales
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Instalando Service Worker de EL TERNERO...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pre-cacheando recursos del app shell...');
      return cache.addAll(PRECACHE_URLS).catch((err) => {
        console.warn('[Service Worker] Algunos recursos no se pudieron precachear:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activación: Limpieza de cachés antiguas y tomar control de clientes
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activando Service Worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== API_CACHE_NAME) {
            console.log('[Service Worker] Borrando caché obsoleta:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Intercepción de peticiones (Modo Offline)
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Solo manejar solicitudes GET
  if (request.method !== 'GET') return;

  // Ignorar WebSocket / socket.io / Chrome extensions
  if (url.protocol === 'ws:' || url.protocol === 'wss:' || url.pathname.includes('socket.io')) {
    return;
  }

  // Estrategia para API REST
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(API_CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          console.log('[Service Worker] Servidor no disponible. Sirviendo API desde caché offline:', request.url);
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            return new Response(
              JSON.stringify({ offline: true, message: 'Modo offline activo en EL TERNERO' }),
              { headers: { 'Content-Type': 'application/json' } }
            );
          });
        })
    );
    return;
  }

  // Estrategia para recursos estáticos, páginas e imágenes (Cache First con Fallback a Red y actualización en segundo plano)
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      // Si el recurso ya está en caché, entregarlo de inmediato para carga instantánea
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      if (cachedResponse) {
        // Ejecutar actualización en segundo plano (Stale-While-Revalidate)
        event.waitUntil(fetchPromise);
        return cachedResponse;
      }

      // Si no está en caché, ir a la red
      return fetchPromise.then((netRes) => {
        if (netRes) return netRes;
        if (request.mode === 'navigate') {
          return caches.match('/index.html') || caches.match('/');
        }
        return new Response('Recurso no disponible offline', { status: 503 });
      });
    })
  );
});

// Evento Push: Notificaciones Push Nativas en Barra del Celular / Sistema Operativo
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Evento Push recibido:', event);

  let data = {
    title: 'EL TERNERO Delivery',
    body: '¡Tienes un nuevo aviso de tu pedido en EL TERNERO!',
    icon: '/scooter.svg',
    badge: '/scooter.svg',
    tag: 'el-ternero-notif',
    url: '/',
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      data = { ...data, ...payload };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/el_ternero_logo.svg',
    badge: data.badge || '/scooter.svg',
    vibrate: [200, 100, 200, 100, 200],
    tag: data.tag || 'el-ternero-delivery',
    renotify: true,
    requireInteraction: true,
    data: {
      url: data.url || '/',
      timestamp: Date.now(),
      pedidoId: data.pedidoId
    },
    actions: [
      { action: 'open', title: '🛵 Ver Estado de Pedido' },
      { action: 'close', title: 'Cerrar' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Listener para clics en la notificación de la barra del celular
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Clic en notificación:', event.notification);
  event.notification.close();

  if (event.action === 'close') return;

  const data = event.notification.data || {};
  const targetUrl = data.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.postMessage({ type: 'NOTIFICATION_CLICKED', data });
          client.focus();
          if (targetUrl && targetUrl !== '/') {
            client.navigate(targetUrl);
          }
          return;
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// Listener para mensajes directos de la aplicación (Web Window -> Service Worker)
self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'SHOW_NATIVE_NOTIFICATION') {
    const { title, body, icon, tag, url, pedidoId, productoId, isPromo } = event.data.payload || {};
    self.registration.showNotification(title || 'EL TERNERO Delivery', {
      body: body || 'Actualización de pedido en vivo',
      icon: icon || '/el_ternero_logo.svg',
      badge: '/scooter.svg',
      vibrate: [200, 100, 200],
      tag: tag || 'el-ternero-alert',
      renotify: true,
      requireInteraction: true,
      data: { url: url || '/', pedidoId, productoId, isPromo, title, body, icon },
      actions: [
        { action: 'open', title: isPromo ? '🔥 Pedir Promo' : '🛵 Ver Pedido' },
        { action: 'close', title: 'Entendido' }
      ]
    });
  }

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
