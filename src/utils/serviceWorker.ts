// EL TERNERO - Service Worker & Push Notification Manager Client Utility

export interface NativeNotificationOptions {
  body?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  url?: string;
  pedidoId?: string;
  productoId?: string;
  isPromo?: boolean;
}

let swRegistration: ServiceWorkerRegistration | null = null;

/**
 * Registra el Service Worker de EL TERNERO (/service-worker.js)
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    console.warn('[PWA] Service Worker no es soportado en este navegador');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/service-worker.js', {
      scope: '/',
    });

    swRegistration = registration;
    console.log('[PWA] Service Worker de EL TERNERO registrado con éxito:', registration.scope);

    // Escuchar actualizaciones del Service Worker
    registration.onupdatefound = () => {
      const installingWorker = registration.installing;
      if (installingWorker) {
        installingWorker.onstatechange = () => {
          if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('[PWA] Nueva versión disponible. Actualizando Service Worker...');
            installingWorker.postMessage({ type: 'SKIP_WAITING' });
          }
        };
      }
    };

    return registration;
  } catch (error) {
    console.error('[PWA] Error al registrar el Service Worker:', error);
    return null;
  }
}

/**
 * Solicita permiso para notificaciones nativas fuera del navegador (barra del celular / desktop)
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    console.warn('Este navegador no soporta notificaciones nativas');
    return 'denied';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  try {
    const permission = await Notification.requestPermission();
    console.log('[PWA] Permiso de notificaciones nativas:', permission);
    return permission;
  } catch (err) {
    console.error('Error al solicitar permiso de notificación:', err);
    return 'denied';
  }
}

/**
 * Obtiene el estado actual del permiso de notificaciones
 */
export function getNotificationPermissionState(): NotificationPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }
  return Notification.permission;
}

/**
 * Dispara una notificación nativa fuera del navegador (Barra del celular / Sistema)
 */
export async function showNativeNotification(title: string, options: NativeNotificationOptions = {}): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    console.warn('[PWA] API Notification no soportada en este entorno');
    return false;
  }

  // Si aún no se ha pedido permiso, solicitarlo al momento de disparar
  let currentPermission = Notification.permission;
  if (currentPermission === 'default') {
    currentPermission = await requestNotificationPermission();
  }

  if (currentPermission !== 'granted') {
    console.warn('[PWA] No se pueden mostrar notificaciones: Permiso no otorgado (estado:', currentPermission, ')');
    return false;
  }

  const payload = {
    title: title || 'EL TERNERO Delivery',
    body: options.body || 'Actualización en tiempo real de tu pedido',
    icon: options.icon || '/scooter.svg',
    badge: options.badge || '/scooter.svg',
    tag: options.tag || 'el-ternero-alert',
    url: options.url || (options.productoId ? `/?promoProduct=${options.productoId}` : '/'),
    pedidoId: options.pedidoId || '',
    productoId: options.productoId || '',
    isPromo: options.isPromo || false,
  };

  // Efecto háptico/vibración en celular si está disponible
  if ('vibrate' in navigator) {
    try {
      navigator.vibrate([200, 100, 200]);
    } catch (_) {}
  }

  try {
    // 1. Obtener registro del Service Worker (global o listo en navigator)
    let reg: ServiceWorkerRegistration | null = swRegistration;
    if (!reg && 'serviceWorker' in navigator) {
      try {
        reg = await navigator.serviceWorker.ready;
      } catch (_) {
        const regs = await navigator.serviceWorker.getRegistrations();
        if (regs && regs.length > 0) reg = regs[0];
      }
    }

    // 2. Si tenemos Service Worker con showNotification (Ideal para Android / Celular)
    if (reg && 'showNotification' in reg) {
      await reg.showNotification(payload.title, {
        body: payload.body,
        icon: payload.icon,
        badge: payload.badge,
        tag: payload.tag,
        vibrate: [200, 100, 200, 100, 200],
        renotify: true,
        requireInteraction: true,
        data: { url: payload.url, pedidoId: payload.pedidoId, productoId: payload.productoId, isPromo: payload.isPromo },
      } as NotificationOptions & { vibrate?: number[]; renotify?: boolean; requireInteraction?: boolean });
      console.log('[PWA] Notificación nativa enviada vía Service Worker');
      return true;
    }

    // 3. Probar envío por mensaje al SW activo
    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'SHOW_NATIVE_NOTIFICATION',
        payload,
      });
      console.log('[PWA] Notificación nativa enviada vía SW Controller PostMessage');
      return true;
    }

    // 4. Fallback a API nativa del navegador (Desktop / Navegadores compatibles)
    try {
      const notif = new Notification(payload.title, {
        body: payload.body,
        icon: payload.icon,
        tag: payload.tag,
      });

      notif.onclick = () => {
        window.focus();
        notif.close();
      };
      return true;
    } catch (notifErr) {
      console.warn('[PWA] Fallback new Notification no soportado en este dispositivo (Android exige SW):', notifErr);
    }
  } catch (error) {
    console.error('Error al emitir notificación nativa:', error);
  }

  return false;
}

/**
 * Envía la suscripción al backend para soporte de push remoto
 */
export async function subscribeUserToPush(clienteEmail?: string) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return null;
  }

  try {
    const reg = swRegistration || (await navigator.serviceWorker.ready);
    let sub = await reg.pushManager.getSubscription();

    if (!sub) {
      // Intentar suscripción
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
      }).catch(() => null);
    }

    // Enviar suscripción al backend de EL TERNERO
    if (sub) {
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub, clienteEmail }),
      });
    }

    return sub;
  } catch (err) {
    console.warn('[PWA] No se pudo activar la suscripción Push completa:', err);
    return null;
  }
}
