import React, { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Pedido, Repartidor, Producto, GPSUpdate, ViewRole, RestauranteConfig } from './types';
import { CustomerTrackingView } from './components/CustomerTrackingView';
import { DriverSimulatorView } from './components/DriverSimulatorView';
import { AdminDashboard } from './components/AdminDashboard';
import { KitchenView } from './components/KitchenView';
import { WaiterView } from './components/WaiterView';
import { StaffAuthModal } from './components/AdminAuthModal';
import { GpsPermissionModal } from './components/GpsPermissionModal';
import { WelcomeSplashModal } from './components/WelcomeSplashModal';
import logoImg from './assets/images/el_ternero_logo.svg';
import {
  registerServiceWorker,
  requestNotificationPermission,
  getNotificationPermissionState,
  showNativeNotification,
  subscribeUserToPush
} from './utils/serviceWorker';
import {
  Navigation,
  Bike,
  LayoutDashboard,
  Lock,
  LogOut,
  UserCheck,
  ChefHat,
  Bell,
  BellRing,
  WifiOff,
  Wifi,
  Smartphone,
  CheckCircle2,
  X,
  ShoppingBag,
  Users
} from 'lucide-react';

export default function App() {
  const [activeRole, setActiveRole] = useState<ViewRole>('cliente');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);

  // Service Worker, PWA & Push Notifications state
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [isOffline, setIsOffline] = useState<boolean>(typeof navigator !== 'undefined' ? !navigator.onLine : false);
  const [showNotifToast, setShowNotifToast] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>('');

  // Active Promo Modal State for direct order from push notifications
  const [activePromoModal, setActivePromoModal] = useState<{
    title: string;
    body: string;
    icon?: string;
    productoId?: string;
  } | null>(null);
  const [promoProductToAdd, setPromoProductToAdd] = useState<Producto | null>(null);

  // Welcome Screen Modal state (Always shows on initial mobile or desktop load)
  const [showWelcomeSplash, setShowWelcomeSplash] = useState<boolean>(true);

  // Staff & Admin authentication state (hides Repartidor / Admin / Cocina / Mozo panels by default)
  const [isStaffAuthenticated, setIsStaffAuthenticated] = useState<boolean>(false);
  const [authenticatedRole, setAuthenticatedRole] = useState<'admin' | 'repartidor' | 'cocina' | 'mozo' | null>(null);
  const [showStaffModal, setShowStaffModal] = useState<boolean>(false);
  const [staffModalTarget, setStaffModalTarget] = useState<'admin' | 'repartidor' | 'cocina' | 'mozo' | 'choose'>('choose');

  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [repartidores, setRepartidores] = useState<Repartidor[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [restauranteConfig, setRestauranteConfig] = useState<RestauranteConfig>(() => {
    const savedCustomLogo = typeof window !== 'undefined' ? localStorage.getItem('el_ternero_custom_logo') : null;
    return {
      nombre: 'EL TERNERO',
      direccion: 'RGG9+R7H, Gral. Elizardo Aquino, Limpio 110816, Paraguay',
      latitud: -25.1747,
      longitud: -57.48334,
      telefono: '+595 981 100200',
      logoUrl: savedCustomLogo || '/el_ternero_logo.svg',
    };
  });

  const activeLogo = (restauranteConfig?.logoUrl && restauranteConfig.logoUrl !== '/el_ternero_logo.svg' && restauranteConfig.logoUrl.trim() !== '')
    ? restauranteConfig.logoUrl
    : (typeof window !== 'undefined' && localStorage.getItem('el_ternero_custom_logo') ? localStorage.getItem('el_ternero_custom_logo')! : logoImg);

  const handleUpdateLogo = async (newLogoUrl: string) => {
    const updatedConfig: RestauranteConfig = {
      ...restauranteConfig,
      logoUrl: newLogoUrl || '/el_ternero_logo.svg'
    };
    setRestauranteConfig(updatedConfig);
    if (newLogoUrl) {
      localStorage.setItem('el_ternero_custom_logo', newLogoUrl);
    } else {
      localStorage.removeItem('el_ternero_custom_logo');
    }

    if (socket) {
      socket.emit('actualizar_config_restaurante', updatedConfig);
    }
    try {
      await fetch('/api/restaurante', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedConfig),
      });
    } catch (err) {
      console.error('Error guardando logo en servidor:', err);
    }
  };

  const [lastGpsUpdate, setLastGpsUpdate] = useState<GPSUpdate | null>(null);

  // Synchronized refs to give real-time handlers fresh access to state
  const activeRoleRef = useRef<ViewRole>(activeRole);
  useEffect(() => {
    activeRoleRef.current = activeRole;
  }, [activeRole]);

  const pedidosRef = useRef<Pedido[]>(pedidos);
  useEffect(() => {
    pedidosRef.current = pedidos;
  }, [pedidos]);

  // Evaluador estricto de notificaciones según el ROL activo y sesión del usuario
  const shouldDeliverNotification = (
    payload: {
      title: string;
      body: string;
      icon?: string;
      tag?: string;
      pedidoId?: string;
      clienteEmail?: string;
      clienteNombre?: string;
      clienteTelefono?: string;
      clienteCedula?: string;
      repartidorId?: string;
      repartidorNombre?: string;
      estado?: string;
    },
    role: ViewRole,
    allPedidos: Pedido[]
  ): boolean => {
    if (!payload) return false;

    // Direct deliver for broadcast promotions or combos to all clients/devices
    if (
      (payload as any).isPromo ||
      payload.tag?.startsWith('promo-') ||
      payload.tag === 'combo-del-dia' ||
      payload.title?.toLowerCase().includes('combo') ||
      payload.title?.toLowerCase().includes('promo')
    ) {
      return true;
    }

    const orderId = payload.pedidoId || '';
    const matchedOrder = allPedidos.find((p) => p.id === orderId);

    // 1. ROL CLIENTE: Solo notificaciones de SUS PROPIOS pedidos
    if (role === 'cliente') {
      let activeClient: any = null;
      try {
        const saved = localStorage.getItem('el_ternero_active_client');
        if (saved) activeClient = JSON.parse(saved);
      } catch (e) {}

      let savedOrders: string[] = [];
      try {
        const saved = localStorage.getItem('el_ternero_customer_orders');
        if (saved) savedOrders = JSON.parse(saved);
      } catch (e) {}

      const selectedOrderId = localStorage.getItem('el_ternero_selected_pedido_id') || '';

      // A) Coincidencia de ID de pedido guardado en el navegador del cliente
      if (orderId && (savedOrders.includes(orderId) || selectedOrderId === orderId)) {
        return true;
      }

      // B) Coincidencia de datos con la cuenta del cliente logueado
      if (activeClient) {
        const emailMatch =
          (payload.clienteEmail && payload.clienteEmail.toLowerCase() === activeClient.email?.toLowerCase()) ||
          (matchedOrder?.clienteEmail && matchedOrder.clienteEmail.toLowerCase() === activeClient.email?.toLowerCase());

        const cedulaMatch =
          (payload.clienteCedula && activeClient.cedula && payload.clienteCedula.trim() === activeClient.cedula.trim()) ||
          (matchedOrder?.clienteCedula && activeClient.cedula && matchedOrder.clienteCedula.trim() === activeClient.cedula.trim());

        const phoneMatch =
          (payload.clienteTelefono && activeClient.celular && payload.clienteTelefono.trim() === activeClient.celular.trim()) ||
          (matchedOrder?.telefono && activeClient.celular && matchedOrder.telefono.trim() === activeClient.celular.trim());

        const nameMatch =
          (payload.clienteNombre && activeClient.nombres && payload.clienteNombre.toLowerCase().includes(activeClient.nombres.toLowerCase())) ||
          (matchedOrder?.cliente && activeClient.nombres && matchedOrder.cliente.toLowerCase().includes(activeClient.nombres.toLowerCase()));

        if (emailMatch || cedulaMatch || phoneMatch || nameMatch) {
          return true;
        }
      }

      // Si no hay coincidencia con el cliente, NO notificar
      return false;
    }

    // 2. ROL ADMINISTRADOR: Recibe notificaciones de TODOS los pedidos
    if (role === 'admin') {
      return true;
    }

    // 3. ROL REPARTIDOR: Solo notificaciones de pedidos ASIGNADOS a este repartidor
    if (role === 'repartidor') {
      const activeDriverId = localStorage.getItem('el_ternero_active_driver_id') || '';
      const activeDriverName = localStorage.getItem('el_ternero_active_driver_name') || '';

      const payloadDriverId = payload.repartidorId || matchedOrder?.repartidorId || '';
      const payloadDriverName = payload.repartidorNombre || matchedOrder?.repartidorNombre || '';

      if (activeDriverId && payloadDriverId && payloadDriverId === activeDriverId) {
        return true;
      }

      if (activeDriverName && payloadDriverName && payloadDriverName.toLowerCase() === activeDriverName.toLowerCase()) {
        return true;
      }

      if (activeDriverName && payload.body && payload.body.toLowerCase().includes(activeDriverName.toLowerCase())) {
        return true;
      }

      return false;
    }

    // 4. ROL COCINA: Solo notificaciones de preparación/cocina
    if (role === 'cocina') {
      const estado = payload.estado || matchedOrder?.estado || '';
      if (['recibido', 'aceptado', 'preparando', 'rechazado'].includes(estado)) {
        return true;
      }
      return false;
    }

    // 5. ROL MOZO: Notificaciones de salón / cocina listas
    if (role === 'mozo') {
      const estado = payload.estado || matchedOrder?.estado || '';
      if (['comanda_lista', 'preparando', 'recibido'].includes(estado)) {
        return true;
      }
      return false;
    }

    return false;
  };

  const handleOpenStaffAuth = (target: 'admin' | 'repartidor' | 'cocina' | 'mozo' | 'choose') => {
    setStaffModalTarget(target);
    setShowStaffModal(true);
  };

  const handleAdminLoginSuccess = () => {
    setIsStaffAuthenticated(true);
    setAuthenticatedRole('admin');
    setShowStaffModal(false);
    setActiveRole('admin');
  };

  const handleWaiterLoginSuccess = () => {
    setIsStaffAuthenticated(true);
    setAuthenticatedRole('mozo');
    setShowStaffModal(false);
    setActiveRole('mozo');
  };

  const handleDriverLoginSuccess = () => {
    setIsStaffAuthenticated(true);
    setAuthenticatedRole('repartidor');
    setShowStaffModal(false);
    setActiveRole('repartidor');
  };

  const handleKitchenLoginSuccess = () => {
    setIsStaffAuthenticated(true);
    setAuthenticatedRole('cocina');
    setShowStaffModal(false);
    setActiveRole('cocina');
  };

  const handleStaffLogout = () => {
    setIsStaffAuthenticated(false);
    setAuthenticatedRole(null);
    setActiveRole('cliente');
  };

  // Initialize Service Worker, Notification permissions & socket listeners
  useEffect(() => {
    registerServiceWorker();
    setNotificationPermission(getNotificationPermissionState());

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleEnableNotifications = async () => {
    const perm = await requestNotificationPermission();
    setNotificationPermission(perm);
    if (perm === 'granted') {
      await subscribeUserToPush();
      showNativeNotification('🔔 Notificaciones Activadas', {
        body: 'Recibirás avisos de tu pedido directamente en la barra de tu celular o escritorio.',
        icon: logoImg,
      });
      setToastMessage('¡Notificaciones activadas con éxito!');
      setShowNotifToast(true);
      setTimeout(() => setShowNotifToast(false), 5000);
    }
  };

  const handleTestPushNotification = async () => {
    if (notificationPermission !== 'granted') {
      await handleEnableNotifications();
    } else {
      let roleDesc = 'Cliente (Solo tus pedidos)';
      if (activeRole === 'admin') roleDesc = 'Administrador (Todos los pedidos)';
      if (activeRole === 'repartidor') roleDesc = 'Repartidor (Tus pedidos asignados)';
      if (activeRole === 'cocina') roleDesc = 'Cocina (Pedidos en preparación)';

      showNativeNotification(`🛵 EL TERNERO (${activeRole.toUpperCase()})`, {
        body: `Filtro de usuario activo: ${roleDesc}. Solo recibirás alertas correspondientes a tu rol.`,
        icon: '/scooter.svg',
      });
      setToastMessage(`Notificación probada para rol '${activeRole.toUpperCase()}': ${roleDesc}`);
      setShowNotifToast(true);
      setTimeout(() => setShowNotifToast(false), 5000);
    }
  };

  // Fetch initial REST data as fallback
  const fetchInitialData = async () => {
    try {
      const safeFetch = async (url: string) => {
        try {
          const res = await fetch(url);
          return res.ok ? await res.json() : null;
        } catch {
          return null;
        }
      };

      const [dataPed, dataRep, dataProd, dataRest] = await Promise.all([
        safeFetch('/api/pedidos'),
        safeFetch('/api/repartidores'),
        safeFetch('/api/productos'),
        safeFetch('/api/restaurante'),
      ]);

      if (dataPed) setPedidos(dataPed);
      if (dataRep) setRepartidores(dataRep);
      if (dataProd) setProductos(dataProd);
      if (dataRest) setRestauranteConfig(dataRest);
    } catch (err) {
      console.warn('Carga REST inicial pospuesta:', err);
    }
  };

  // Initialize Socket.io Connection
  useEffect(() => {
    fetchInitialData();

    // Auto-connect socket on current origin with polling fallback
    const newSocket = io({
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Socket conectado:', newSocket.id);
      setIsConnected(true);
    });

    newSocket.on('connect_error', (err) => {
      console.warn('Socket connect error (reintentando vía polling):', err?.message || err);
    });

    newSocket.on('disconnect', () => {
      console.log('Socket desconectado');
      setIsConnected(false);
    });

    // Initial state payload from socket server
    newSocket.on('estado_inicial', (data: { pedidos: Pedido[]; repartidores: Repartidor[]; productos?: Producto[]; restauranteConfig?: RestauranteConfig }) => {
      if (data.pedidos) setPedidos(data.pedidos);
      if (data.repartidores) setRepartidores(data.repartidores);
      if (data.productos) setProductos(data.productos);
      if (data.restauranteConfig) {
        setRestauranteConfig(data.restauranteConfig);
        if (data.restauranteConfig.logoUrl && data.restauranteConfig.logoUrl !== '/el_ternero_logo.svg') {
          localStorage.setItem('el_ternero_custom_logo', data.restauranteConfig.logoUrl);
        } else {
          localStorage.removeItem('el_ternero_custom_logo');
        }
      }
    });

    newSocket.on('config_restaurante_actualizada', (config: RestauranteConfig) => {
      if (config) {
        setRestauranteConfig(config);
        if (config.logoUrl && config.logoUrl !== '/el_ternero_logo.svg') {
          localStorage.setItem('el_ternero_custom_logo', config.logoUrl);
        } else {
          localStorage.removeItem('el_ternero_custom_logo');
        }
      }
    });

    newSocket.on('logo_actualizado', (data: { logoUrl?: string }) => {
      if (data && data.logoUrl !== undefined) {
        setRestauranteConfig((prev) => ({
          ...prev,
          logoUrl: data.logoUrl || '/el_ternero_logo.svg',
        }));
        if (data.logoUrl && data.logoUrl !== '/el_ternero_logo.svg') {
          localStorage.setItem('el_ternero_custom_logo', data.logoUrl);
        } else {
          localStorage.removeItem('el_ternero_custom_logo');
        }
      }
    });

    newSocket.on('pedidos_actualizados', (pedidosActualizados: Pedido[]) => {
      if (Array.isArray(pedidosActualizados)) setPedidos(pedidosActualizados);
    });

    newSocket.on('repartidores_actualizados', (repartidoresActualizados: Repartidor[]) => {
      if (Array.isArray(repartidoresActualizados)) setRepartidores(repartidoresActualizados);
    });

    newSocket.on('productos_actualizados', (productosActualizados: Producto[]) => {
      if (Array.isArray(productosActualizados)) setProductos(productosActualizados);
    });

    newSocket.on('pedido_eliminado', (deletedId: string) => {
      setPedidos((prev) => prev.filter((p) => p.id !== deletedId));
    });

    newSocket.on('repartidor_eliminado', (deletedId: string) => {
      setRepartidores((prev) => prev.filter((r) => r.id !== deletedId));
    });

    // Listen to global GPS updates transmitted by any delivery driver
    newSocket.on('actualizacion_gps_global', (data: GPSUpdate) => {
      setLastGpsUpdate(data);

      setPedidos((prevPedidos) =>
        prevPedidos.map((p) => {
          if (p.id === data.pedidoId) {
            return {
              ...p,
              latitudActual: data.latitud,
              longitudActual: data.longitud,
              ultimaActualizacion: data.timestamp,
              estado: p.estado === 'preparando' || p.estado === 'recibido' ? 'en_camino' : p.estado,
            };
          }
          return p;
        })
      );

      setRepartidores((prevRep) =>
        prevRep.map((r) => {
          if (r.id === data.repartidorId) {
            return { ...r, latitud: data.latitud, longitud: data.longitud };
          }
          return r;
        })
      );
    });

    newSocket.on('nuevo_pedido', (nuevoPedido: Pedido) => {
      setPedidos((prev) => [nuevoPedido, ...prev]);
    });

    newSocket.on('pedido_actualizado', (pedidoActualizado: Pedido) => {
      setPedidos((prev) =>
        prev.map((p) => (p.id === pedidoActualizado.id ? pedidoActualizado : p))
      );
    });

    newSocket.on('producto_creado', (nuevoProducto: Producto) => {
      setProductos((prev) => [nuevoProducto, ...prev]);
    });

    newSocket.on('producto_actualizado', (productoActualizado: Producto) => {
      setProductos((prev) =>
        prev.map((p) => (p.id === productoActualizado.id ? productoActualizado : p))
      );
    });

    newSocket.on('producto_eliminado', (prodId: string) => {
      setProductos((prev) => prev.filter((p) => p.id !== prodId));
    });

    // Escuchar promociones / combos en tiempo real transmitidos a clientes
    newSocket.on(
      'alerta_promocion_combo',
      (payload: { title: string; body: string; icon?: string; productoId?: string }) => {
        if (activeRoleRef.current === 'cliente') {
          setActivePromoModal({
            title: payload.title || '🔥 Promoción Especial EL TERNERO',
            body: payload.body || '¡Aprovecha hoy esta súper oferta directamente en tu pedido!',
            icon: payload.icon,
            productoId: payload.productoId,
          });
          showNativeNotification(payload.title || '🔥 Promoción Especial', {
            body: payload.body,
            icon: payload.icon || '/scooter.svg',
            productoId: payload.productoId,
            isPromo: true,
          });
        }
      }
    );

    // Escuchar notificaciones push nativas emitidas por el servidor con filtro por rol y sesión
    newSocket.on(
      'notificacion_push_nativa',
      (payload: {
        title: string;
        body: string;
        icon?: string;
        tag?: string;
        pedidoId?: string;
        clienteEmail?: string;
        clienteNombre?: string;
        clienteTelefono?: string;
        clienteCedula?: string;
        repartidorId?: string;
        repartidorNombre?: string;
        estado?: string;
      }) => {
        const currentRole = activeRoleRef.current;
        const currentPedidos = pedidosRef.current;

        if (shouldDeliverNotification(payload, currentRole, currentPedidos)) {
          showNativeNotification(payload.title, {
            body: payload.body,
            icon: payload.icon || '/scooter.svg',
            tag: payload.tag || 'el-ternero-alert',
            pedidoId: payload.pedidoId,
          });
          setToastMessage(`${payload.title}: ${payload.body}`);
          setShowNotifToast(true);
          setTimeout(() => setShowNotifToast(false), 6000);
        } else {
          console.log(`[Push Filter] Notificación descartada para rol '${currentRole}' (no corresponde a su sesión/asignación).`);
        }
      }
    );

    setSocket(newSocket);

    // Active polling interval as safety fallback (only runs when tab is active to save mobile data & battery)
    const pollInterval = setInterval(() => {
      if (typeof document !== 'undefined' && !document.hidden) {
        fetchInitialData();
      }
    }, 45000);

    return () => {
      clearInterval(pollInterval);
      newSocket.disconnect();
    };
  }, []);

  // Scroll to top of page whenever activeRole changes to ensure full visibility of new view
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [activeRole]);

  // Escuchar cuando el usuario hace clic en una notificación nativa enviada por el Service Worker
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      const handleSwMessage = (event: MessageEvent) => {
        if (event.data?.type === 'NOTIFICATION_CLICKED') {
          const data = event.data.data || {};
          if (data.isPromo || data.productoId || data.url?.includes('promoProduct')) {
            setActiveRole('cliente');

            if (data.productoId && productos.length > 0) {
              const prod = productos.find(
                (p) => String(p.id).toLowerCase() === String(data.productoId).toLowerCase()
              );
              if (prod) {
                setPromoProductToAdd(prod);
              }
            } else if (productos.length > 0) {
              const combo = productos.find((p) => p.categoria.toLowerCase().includes('combo')) || productos[0];
              setPromoProductToAdd(combo);
            }

            if (data.title && data.body) {
              setActivePromoModal({
                title: data.title || '🔥 Promoción Exclusiva EL TERNERO',
                body: data.body || '¡Aprovecha esta súper oferta directamente en tu carrito de compras!',
                icon: data.icon,
                productoId: data.productoId,
              });
            }
          }
        }
      };
      navigator.serviceWorker.addEventListener('message', handleSwMessage);
      return () => {
        navigator.serviceWorker.removeEventListener('message', handleSwMessage);
      };
    }
  }, [productos]);

  // Verificar si la app se abrió desde un enlace directo de promoción (e.g. /?promoProduct=123)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const promoProdId = params.get('promoProduct');
      const isPromo = params.get('promo');

      if (promoProdId && productos.length > 0) {
        const prod = productos.find(
          (p) => String(p.id).toLowerCase() === String(promoProdId).toLowerCase()
        );
        if (prod) {
          setPromoProductToAdd(prod);
        } else {
          const fallback = productos.find((p) => p.categoria.toLowerCase().includes('combo')) || productos[0];
          setPromoProductToAdd(fallback);
        }
        setActiveRole('cliente');
        window.history.replaceState({}, '', window.location.pathname);
      } else if (isPromo) {
        setActiveRole('cliente');
        if (productos.length > 0) {
          const fallback = productos.find((p) => p.categoria.toLowerCase().includes('combo')) || productos[0];
          setPromoProductToAdd(fallback);
        }
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, [productos]);

  const handleOrderPromoNow = () => {
    if (!activePromoModal) return;

    setActiveRole('cliente');

    let targetProduct: Producto | undefined;
    if (activePromoModal.productoId) {
      targetProduct = productos.find(
        (p) => String(p.id).toLowerCase() === String(activePromoModal.productoId).toLowerCase()
      );
    }

    if (!targetProduct && productos.length > 0) {
      targetProduct = productos.find((p) => p.categoria.toLowerCase().includes('combo')) || productos[0];
    }

    if (targetProduct) {
      setPromoProductToAdd(targetProduct);
    }

    setActivePromoModal(null);
  };

  // Security Guard: Restrict access to 'admin' panel strictly to authenticated Admin accounts
  useEffect(() => {
    if (activeRole === 'admin' && authenticatedRole !== 'admin') {
      setActiveRole('cliente');
      handleOpenStaffAuth('admin');
    }
  }, [activeRole, authenticatedRole]);

  // Responsive Container Layout Helper (Full Screen for Desktop Admin/Kitchen/Mozo, Mobile Frame for Cliente/Repartidor)
  const isDesktopView = activeRole === 'admin' || activeRole === 'cocina' || activeRole === 'mozo';
  const containerWidthClass = isDesktopView
    ? "w-full max-w-none px-4 sm:px-6 lg:px-8"
    : "max-w-2xl mx-auto px-3 sm:px-4";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500 selection:text-slate-950">
      {/* Navbar Header */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 shadow-xl">
        <div className={`${containerWidthClass} h-16 flex items-center justify-between`}>
          {/* Logo & Title - Clickable for staff access */}
          <div
            className="flex items-center gap-3 cursor-pointer select-none group"
            onClick={() => handleOpenStaffAuth('choose')}
            title="EL TERNERO Delivery"
          >
            <img
              src={activeLogo}
              alt="EL TERNERO Logo"
              className="w-11 h-11 rounded-full object-contain bg-black border border-emerald-500/60 shadow-lg shadow-emerald-500/20 ring-1 ring-slate-800 group-hover:scale-105 transition-transform"
            />
            <div>
              <h1 className="font-extrabold text-base sm:text-lg tracking-tight text-slate-100 flex items-center gap-2">
                EL TERNERO
              </h1>
              <p className="text-[11px] text-emerald-400 font-semibold tracking-wide hidden sm:block">
                Sabor que nace del campo
              </p>
            </div>
          </div>

          {/* Header Action Buttons & Status */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700 text-xs font-mono">
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-orange-400'}`} />
              <span className="text-slate-300 hidden md:inline">
                {isConnected ? <span className="uppercase italic font-extrabold text-emerald-400 tracking-wider">CONECTADO</span> : 'Reconectando...'}
              </span>
            </div>

            {isStaffAuthenticated && (
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1.5 rounded-xl font-mono font-bold shrink-0 shadow-sm">
                <UserCheck className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Modo Personal Activo</span>
                <span className="sm:hidden">Modo Personal</span>
              </div>
            )}

            {/* Quick Access to Salón / Mesas */}
            <button
              type="button"
              onClick={() => {
                setIsStaffAuthenticated(true);
                setAuthenticatedRole('mozo');
                setActiveRole('mozo');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer shadow-sm ${
                activeRole === 'mozo'
                  ? 'bg-emerald-500 text-slate-950 ring-2 ring-emerald-400'
                  : 'bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30'
              }`}
              title="Ver Salón y 15 Mesas en Cuadros"
            >
              <Users className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Salón (15 Mesas)</span>
              <span className="sm:hidden">15 Mesas</span>
            </button>

            {/* Ultra Discrete Staff Secret Lock Button */}
            {!isStaffAuthenticated ? (
              <button
                type="button"
                onClick={() => handleOpenStaffAuth('choose')}
                className="opacity-25 hover:opacity-100 p-2 rounded-lg text-slate-500 hover:text-emerald-400 hover:bg-slate-800/60 transition-all cursor-pointer"
                title="Acceso Personal"
              >
                <Lock className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStaffLogout}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 hover:text-rose-300 text-xs font-bold transition-all shadow-sm"
                title="Salir del modo personal y volver a vista pública"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Cerrar Sesión Staff</span>
              </button>
            )}
          </div>
        </div>

        {/* Banner para Modo Offline PWA */}
        {isOffline && (
          <div className="bg-emerald-500/20 border-t border-b border-emerald-500/40 px-4 py-2 text-center text-xs font-bold text-emerald-300 flex items-center justify-center gap-2 animate-pulse">
            <WifiOff className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>MODO OFFLINE ACTIVO • Navegando en el sistema de EL TERNERO con datos precacheados (PWA / Service Worker)</span>
          </div>
        )}

        {/* Active Role Specific Banner (Shows ONLY when staff is authenticated) */}
        {isStaffAuthenticated && (
          <div className={`${containerWidthClass} border-t border-slate-800/80 bg-slate-900/80 py-2`}>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              {activeRole === 'cocina' && (
                <div className="flex items-center gap-2 text-xs font-black text-emerald-300">
                  <div className="w-6 h-6 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                    <ChefHat className="w-3.5 h-3.5" />
                  </div>
                  <span>PANTALLA COCINA (COMPUTADORA / WEB)</span>
                </div>
              )}

              {activeRole === 'mozo' && (
                <div className="flex items-center gap-2 text-xs font-black text-emerald-300">
                  <div className="w-6 h-6 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                    <Users className="w-3.5 h-3.5" />
                  </div>
                  <span>SISTEMA DE MOZOS Y SALÓN (15 MESAS)</span>
                </div>
              )}

              {activeRole === 'repartidor' && (
                <div className="flex items-center gap-2 text-xs font-black text-emerald-300">
                  <div className="w-6 h-6 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                    <Bike className="w-3.5 h-3.5" />
                  </div>
                  <span>PANEL REPARTIDOR (MÓVIL)</span>
                </div>
              )}

              {activeRole === 'admin' && (
                <div className="flex items-center gap-2 text-xs font-black text-emerald-300">
                  <div className="w-6 h-6 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                    <LayoutDashboard className="w-3.5 h-3.5" />
                  </div>
                  <span>PANEL ADMINISTRADOR (COMPUTADORA / WEB)</span>
                </div>
              )}

              {/* No banner text for cliente role */}

              {/* Role Switcher Option for Staff */}
              <div className="flex items-center gap-2 shrink-0">
                {authenticatedRole === 'admin' && (
                  <select
                    value={activeRole}
                    onChange={(e) => setActiveRole(e.target.value as ViewRole)}
                    className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1 font-bold cursor-pointer focus:border-emerald-500 focus:outline-none"
                    title="Cambiar a otro rol de personal"
                  >
                    <option value="admin">📊 Panel Administrador (Web)</option>
                    <option value="mozo">👥 Sistema Mozos (15 Mesas)</option>
                    <option value="cocina">👨‍🍳 Pantalla Cocina (Web)</option>
                    <option value="repartidor">🛵 Panel Repartidor (Móvil)</option>
                    <option value="cliente">🛒 Vista Cliente (Móvil)</option>
                  </select>
                )}
                <button
                  type="button"
                  onClick={handleStaffLogout}
                  className="px-2.5 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                  title="Cerrar sesión de personal"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Cerrar Sesión</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* GPS Permission Requirement Gate */}
      <GpsPermissionModal />

      {/* Main Content Area */}
      <main className={`${containerWidthClass} py-2 sm:py-6`}>
        {activeRole === 'cliente' && (
          <CustomerTrackingView
            pedidos={pedidos}
            repartidores={repartidores}
            productos={productos}
            socket={socket}
            lastGpsUpdate={lastGpsUpdate}
            isConnected={isConnected}
            restauranteConfig={{ ...restauranteConfig, logoUrl: activeLogo }}
            onRefreshData={fetchInitialData}
            initialPromoProduct={promoProductToAdd}
            onClearPromoProduct={() => setPromoProductToAdd(null)}
          />
        )}

        {activeRole === 'mozo' && (
          <WaiterView
            socket={socket}
            productos={productos}
            logoUrl={activeLogo}
            restauranteConfig={{ ...restauranteConfig, logoUrl: activeLogo }}
            onRefreshData={fetchInitialData}
          />
        )}

        {activeRole === 'repartidor' && (
          <DriverSimulatorView
            pedidos={pedidos}
            repartidores={repartidores}
            socket={socket}
            lastGpsUpdate={lastGpsUpdate}
            logoUrl={activeLogo}
            restauranteConfig={{ ...restauranteConfig, logoUrl: activeLogo }}
          />
        )}

        {activeRole === 'cocina' && (
          <KitchenView
            pedidos={pedidos}
            socket={socket}
            onRefreshData={fetchInitialData}
            logoUrl={activeLogo}
            restauranteConfig={{ ...restauranteConfig, logoUrl: activeLogo }}
          />
        )}

        {activeRole === 'admin' && (
          <AdminDashboard
            pedidos={pedidos}
            repartidores={repartidores}
            productos={productos}
            socket={socket}
            lastGpsUpdate={lastGpsUpdate}
            restauranteConfig={{ ...restauranteConfig, logoUrl: activeLogo }}
            onRefreshData={fetchInitialData}
            onLogout={handleStaffLogout}
            onUpdateLogo={handleUpdateLogo}
          />
        )}
      </main>

      {/* Discrete Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-slate-500 text-xs">
        <div className={`${containerWidthClass} flex flex-col sm:flex-row items-center justify-between gap-3`}>
          <p>© {new Date().getFullYear()} EL TERNERO</p>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-600">Sistema de Delivery & GPS en Vivo</span>
            {!isStaffAuthenticated && (
              <button
                type="button"
                onClick={() => handleOpenStaffAuth('choose')}
                className="opacity-15 hover:opacity-100 p-1 text-slate-600 hover:text-emerald-400 transition-opacity cursor-pointer"
                title="Acceso Staff"
              >
                <Lock className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </footer>

      {/* Welcome Splash Modal (Shows before entering the app) */}
      <WelcomeSplashModal
        isOpen={showWelcomeSplash}
        restauranteNombre={restauranteConfig?.nombre || 'EL TERNERO'}
        logoUrl={activeLogo}
        onEnter={() => {
          setShowWelcomeSplash(false);
          setActiveRole('cliente');
        }}
        onEnterSalon={() => {
          setShowWelcomeSplash(false);
          setIsStaffAuthenticated(true);
          setAuthenticatedRole('mozo');
          setActiveRole('mozo');
        }}
        onEnterAdmin={() => {
          setShowWelcomeSplash(false);
          setIsStaffAuthenticated(true);
          setAuthenticatedRole('admin');
          setActiveRole('admin');
        }}
        onTrackOrder={() => {
          setShowWelcomeSplash(false);
          setActiveRole('cliente');
        }}
        onClose={() => setShowWelcomeSplash(false)}
      />

      {/* Discrete Staff Login Modal */}
      <StaffAuthModal
        isOpen={showStaffModal}
        initialTarget={staffModalTarget}
        logoUrl={activeLogo}
        onClose={() => setShowStaffModal(false)}
        onSuccessAdmin={handleAdminLoginSuccess}
        onSuccessDriver={handleDriverLoginSuccess}
        onSuccessKitchen={handleKitchenLoginSuccess}
        onSuccessWaiter={handleWaiterLoginSuccess}
      />

      {/* Floating Push Notification Toast Alert */}
      {showNotifToast && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm bg-slate-900 border-2 border-emerald-500/80 text-slate-100 p-4 rounded-2xl shadow-2xl flex items-start gap-3 backdrop-blur-md animate-bounce">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
            <BellRing className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-black text-xs text-emerald-400 uppercase tracking-wider">
              EL TERNERO
            </h4>
            <p className="text-xs font-semibold text-slate-200 mt-1 line-clamp-2">
              {toastMessage}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowNotifToast(false)}
            className="text-slate-400 hover:text-slate-100 p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Interactive Active Promo Pop-up Modal */}
      {activePromoModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border-2 border-emerald-500/80 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 text-center relative overflow-hidden">
            <button
              type="button"
              onClick={() => setActivePromoModal(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-100 p-1.5 rounded-full hover:bg-slate-800/80 transition-colors cursor-pointer"
              title="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-3xl shadow-lg shadow-emerald-500/20 animate-bounce">
              🔥
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-black text-emerald-400 leading-tight">
                {activePromoModal.title}
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed font-medium">
                {activePromoModal.body}
              </p>
            </div>

            {activePromoModal.productoId && (() => {
              const p = productos.find(
                (item) => String(item.id).toLowerCase() === String(activePromoModal.productoId).toLowerCase()
              );
              if (!p) return null;
              return (
                <div className="bg-slate-950 border border-emerald-500/40 rounded-2xl p-3 flex items-center gap-3 text-left">
                  <img src={p.imagen} alt={p.nombre} className="w-14 h-14 object-cover rounded-xl shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-extrabold text-slate-100 truncate">{p.nombre}</p>
                    <p className="text-xs font-black text-emerald-400 mt-0.5">Gs. {p.monto.toLocaleString()}</p>
                  </div>
                </div>
              );
            })()}

            <div className="flex flex-col gap-2.5 pt-2">
              <button
                type="button"
                onClick={handleOrderPromoNow}
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-500 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/20 transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
              >
                <ShoppingBag className="w-4 h-4 text-slate-950" />
                <span>🛒 Pedir esta Promo Ahora</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActivePromoModal(null);
                  setActiveRole('cliente');
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-all active:scale-95 cursor-pointer"
              >
                Ver Menú Completo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

