import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Pedido, Repartidor, Producto, GPSUpdate, RestauranteConfig, Cliente, MetodoPago } from '../types';
import { InteractiveMap } from './InteractiveMap';
import logoImg from '../assets/images/el_ternero_logo.svg';
import { Socket } from 'socket.io-client';
import { fetchStreetRoute, calculateRoadDistanceSync } from '../utils/routing';
import { GooglePayButtonWrapper } from './GooglePayButtonWrapper';

// Google Pay está SIMULADO (no cobra). Queda oculto hasta integrar una pasarela real (p. ej. Bancard).
const PAGO_GPAY_HABILITADO = false;
import {
  Sparkles,
  Navigation,
  Phone,
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
  ShoppingBag,
  ShieldCheck,
  Zap,
  Radio,
  User,
  Bike,
  Package,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Check,
  ArrowRight,
  Info,
  LogIn,
  LogOut,
  Mail,
  Eye,
  X,
  ArrowLeft,
  Compass,
  ExternalLink,
  FileText,
  Edit3,
  MessageSquare,
  Lock,
  Bell,
  Search,
  CreditCard,
  Landmark,
  Banknote,
  Upload,
  Image as ImageIcon,
  Copy,
  AlertCircle,
  CheckCircle,
  QrCode,
  Receipt
} from 'lucide-react';

interface CustomerTrackingViewProps {
  pedidos: Pedido[];
  repartidores: Repartidor[];
  productos?: Producto[];
  socket?: Socket | null;
  lastGpsUpdate?: GPSUpdate | null;
  isConnected: boolean;
  restauranteConfig?: RestauranteConfig;
  onRefreshData?: () => void;
  initialPromoProduct?: Producto | null;
  onClearPromoProduct?: () => void;
}

interface CartItemState {
  producto: Producto;
  cantidad: number;
  observacion?: string;
}

export const CustomerTrackingView: React.FC<CustomerTrackingViewProps> = ({
  pedidos,
  repartidores,
  productos = [],
  socket,
  lastGpsUpdate,
  isConnected,
  restauranteConfig,
  onRefreshData,
  initialPromoProduct,
  onClearPromoProduct,
}) => {
  const activeLogo = restauranteConfig?.logoUrl || logoImg;

  // Sub-tab: 'catalogo' or 'rastreo'
  const [subTab, setSubTab] = useState<'catalogo' | 'rastreo'>('catalogo');

  // Selected Category filter (null means viewing categories screen only)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Selected quantity mapping per product (default to 1)
  const [selectedQuantities, setSelectedQuantities] = useState<Record<string, number>>({});

  // Customer Cart state
  const [cart, setCart] = useState<CartItemState[]>([]);

  // Banner informativo cuando el cliente entra desde una notificación de promoción
  const [promoBannerMsg, setPromoBannerMsg] = useState<string | null>(null);

  useEffect(() => {
    if (initialPromoProduct) {
      setSubTab('catalogo');
      setSelectedCategory('Todas');
      // Auto-agregar el producto promocionado al carrito
      setCart((prevCart) => {
        const existingIdx = prevCart.findIndex((item) => String(item.producto.id) === String(initialPromoProduct.id));
        if (existingIdx !== -1) {
          const updated = [...prevCart];
          updated[existingIdx] = {
            ...updated[existingIdx],
            cantidad: updated[existingIdx].cantidad + 1,
          };
          return updated;
        } else {
          return [...prevCart, { producto: initialPromoProduct, cantidad: 1, observacion: '' }];
        }
      });

      setPromoBannerMsg(
        `🔥 ¡Promoción "${initialPromoProduct.nombre}" agregada a tu carrito de compras! Puedes explorar el menú abajo para agregar bebidas u otros productos antes de pedir.`
      );

      if (onClearPromoProduct) {
        onClearPromoProduct();
      }

      setTimeout(() => {
        const cartEl = document.getElementById('cart-sidebar-section');
        if (cartEl) {
          cartEl.scrollIntoView({ behavior: 'smooth' });
        }
      }, 300);
    }
  }, [initialPromoProduct]);

  // Category Cover Photos & Enabled/Disabled state loaded from server
  const [categoryPortadasMap, setCategoryPortadasMap] = useState<Record<string, string>>({
    Hamburguesas: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&auto=format&fit=crop&q=80',
    Pizzas: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&auto=format&fit=crop&q=80',
    Lomipizzas: 'https://images.unsplash.com/photo-1628840042765-356cda07504e?w=600&auto=format&fit=crop&q=80',
    'Papas Fritas': 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=600&auto=format&fit=crop&q=80',
    Acompañamientos: 'https://images.unsplash.com/photo-1639024471283-03518883512d?w=600&auto=format&fit=crop&q=80',
    Bebidas: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=600&auto=format&fit=crop&q=80',
    Postres: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=600&auto=format&fit=crop&q=80',
  });
  const [categoryEstadoMap, setCategoryEstadoMap] = useState<Record<string, boolean>>({
    Hamburguesas: true,
    Pizzas: true,
    Lomipizzas: true,
    'Papas Fritas': true,
    Acompañamientos: true,
    Bebidas: true,
    Postres: true,
  });

  useEffect(() => {
    fetch('/api/categorias/portadas')
      .then((res) => {
        if (!res.ok) return null;
        const ct = res.headers.get('content-type');
        if (ct && ct.includes('application/json')) {
          return res.json();
        }
        return null;
      })
      .then((data) => {
        if (data && typeof data === 'object') {
          setCategoryPortadasMap(data);
        }
      })
      .catch((err) => console.warn('Error cargando portadas de categorías:', err));

    fetch('/api/categorias/estado')
      .then((res) => {
        if (!res.ok) return null;
        const ct = res.headers.get('content-type');
        if (ct && ct.includes('application/json')) {
          return res.json();
        }
        return null;
      })
      .then((data) => {
        if (data && typeof data === 'object') {
          setCategoryEstadoMap(data);
        }
      })
      .catch((err) => console.warn('Error cargando estado de categorías:', err));
  }, []);

  useEffect(() => {
    if (!socket) return;
    const handlePortadasUpdated = (data: Record<string, string>) => {
      if (data && typeof data === 'object') {
        setCategoryPortadasMap(data);
      }
    };
    const handleEstadoUpdated = (data: Record<string, boolean>) => {
      if (data && typeof data === 'object') {
        setCategoryEstadoMap(data);
      }
    };
    socket.on('categorias_portadas_actualizadas', handlePortadasUpdated);
    socket.on('categorias_estado_actualizadas', handleEstadoUpdated);
    return () => {
      socket.off('categorias_portadas_actualizadas', handlePortadasUpdated);
      socket.off('categorias_estado_actualizadas', handleEstadoUpdated);
    };
  }, [socket]);

  useEffect(() => {
    if (selectedCategory && categoryEstadoMap[selectedCategory] === false) {
      setSelectedCategory(null);
    }
  }, [categoryEstadoMap, selectedCategory]);

  // Modal for product details ("Ingresar al producto")
  const [productForModal, setProductForModal] = useState<Producto | null>(null);
  const [modalQty, setModalQty] = useState<number>(1);

  // Checkout Form & Payment Methods
  const [checkout, setCheckout] = useState({
    cliente: '',
    telefono: '',
    direccion: '',
    notaCliente: '',
  });

  const [metodoPago, setMetodoPago] = useState<MetodoPago>('efectivo');
  const [montoPagaCon, setMontoPagaCon] = useState<string>('');
  const [comprobanteUrl, setComprobanteUrl] = useState<string>('');
  const [comprobanteNombre, setComprobanteNombre] = useState<string>('');
  const [comprobanteError, setComprobanteError] = useState<string>('');
  const [copiedBankInfo, setCopiedBankInfo] = useState<boolean>(false);
  const [previewComprobanteModal, setPreviewComprobanteModal] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Customer Delivery Pin GPS Coordinates
  const [customerLat, setCustomerLat] = useState<number>(-25.1780);
  const [customerLon, setCustomerLon] = useState<number>(-57.4850);
  const [showMapPickerModal, setShowMapPickerModal] = useState<boolean>(false);
  const [isGeocoding, setIsGeocoding] = useState<boolean>(false);

  const updateLocationAndAddress = async (lat: number, lon: number, zoneName?: string) => {
    const roundedLat = parseFloat(lat.toFixed(6));
    const roundedLon = parseFloat(lon.toFixed(6));
    setCustomerLat(roundedLat);
    setCustomerLon(roundedLon);
    setIsGeocoding(true);

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${roundedLat}&lon=${roundedLon}&accept-language=es`
      );
      if (response.ok) {
        const data = await response.json();
        if (data && data.address) {
          const addr = data.address;
          const road = addr.road || addr.pedestrian || addr.footway || addr.path || addr.suburb || addr.neighbourhood || addr.city_district || '';
          const houseNumber = addr.house_number ? ` ${addr.house_number}` : '';
          const neighbourhood = addr.neighbourhood || addr.suburb || addr.quarter || addr.city_district || '';
          const city = addr.city || addr.town || addr.village || addr.county || 'Asunción';

          const parts = [
            road ? `${road}${houseNumber}` : '',
            neighbourhood && neighbourhood !== road ? neighbourhood : zoneName || '',
            city
          ].filter(Boolean);

          const formattedAddr = parts.length > 0 ? parts.join(', ') : (data.display_name?.split(',').slice(0, 3).join(',') || '');

          if (formattedAddr) {
            setCheckout((prev) => ({ ...prev, direccion: formattedAddr }));
            setIsGeocoding(false);
            return;
          }
        }
      }
    } catch (err) {
      console.error('Error reverse geocoding:', err);
    } finally {
      setIsGeocoding(false);
    }

    const fallbackAddress = zoneName 
      ? `${zoneName}, Paraguay` 
      : `Pin GPS (${roundedLat.toFixed(4)}, ${roundedLon.toFixed(4)})`;
    setCheckout((prev) => ({ ...prev, direccion: fallbackAddress }));
  };

  // Observation Modal state for per-product or general notes ("Ventana emergente")
  const [showObservationModal, setShowObservationModal] = useState<boolean>(false);
  const [tempObservation, setTempObservation] = useState<string>('');
  const [activeObservationTarget, setActiveObservationTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // State for "Pizza Mitad y Mitad" (Half & Half pizza modal)
  const [showHalfPizzaModal, setShowHalfPizzaModal] = useState<boolean>(false);
  const [halfFlavor1, setHalfFlavor1] = useState<Producto | null>(null);
  const [halfFlavor2, setHalfFlavor2] = useState<Producto | null>(null);
  const [halfQty, setHalfQty] = useState<number>(1);
  const [halfObservation, setHalfObservation] = useState<string>('');
  const [activeEditingHalf, setActiveEditingHalf] = useState<1 | 2>(1);
  const [flavorSearchQuery, setFlavorSearchQuery] = useState<string>('');

  // Dynamic category list derivation
  const defaultCustomerCategories = [
    { id: 'Hamburguesas', label: 'Hamburguesas' },
    { id: 'Pizzas', label: 'Pizzas Artesanales' },
    { id: 'Lomipizzas', label: 'Lomipizzas Rellenas' },
    { id: 'Papas Fritas', label: 'Papas & Entradas' },
    { id: 'Acompañamientos', label: 'Acompañamientos' },
    { id: 'Bebidas', label: 'Bebidas Recientes' },
    { id: 'Postres', label: 'Postres Especiales' },
  ];

  const availableCategoryIds = useMemo(
    () =>
      Array.from(
        new Set([
          ...Object.keys(categoryPortadasMap),
          ...Object.keys(categoryEstadoMap),
          ...productos.map((p) => p.categoria).filter(Boolean) as string[],
        ])
      ),
    [categoryPortadasMap, categoryEstadoMap, productos]
  );

  const customerCategoryList = useMemo(
    () =>
      availableCategoryIds
        .filter((catId) => categoryEstadoMap[catId] !== false)
        .map((catId) => {
          const match = defaultCustomerCategories.find((c) => c.id === catId);
          return { id: catId, label: match ? match.label : catId };
        }),
    [availableCategoryIds, categoryEstadoMap]
  );

  // Pizza products for Half & Half modal
  const pizzaProducts = useMemo(
    () => productos.filter((p) => (p.categoria || '').toLowerCase().includes('pizza')),
    [productos]
  );
  const availablePizzaOptions = useMemo(
    () => (pizzaProducts.length > 0 ? pizzaProducts : productos),
    [pizzaProducts, productos]
  );

  const handleAddHalfPizzaToCart = () => {
    if (!halfFlavor1 || !halfFlavor2) {
      alert('Por favor selecciona ambos sabores para tu Pizza.');
      return;
    }

    if (!activeClient) {
      setAuthError('');
      setAuthMessage('Para realizar tu pedido de Armar Pizza, debes iniciar sesión con tu correo electrónico.');
      setAuthMode('login');
      setShowAuthModal(true);
      return;
    }

    const maxPrice = Math.max(halfFlavor1.monto, halfFlavor2.monto);
    const halfPizzaProduct: Producto = {
      id: `PIZZA-HALF-${Date.now()}`,
      nombre: `Pizza 2 Sabores: ${halfFlavor1.nombre} / ${halfFlavor2.nombre}`,
      monto: maxPrice,
      cantidad: 99,
      categoria: 'Pizzas',
      descripcion: `1/2 ${halfFlavor1.nombre} (Gs. ${halfFlavor1.monto.toLocaleString()}) + 1/2 ${halfFlavor2.nombre} (Gs. ${halfFlavor2.monto.toLocaleString()}). Cobrado al valor más alto (Gs. ${maxPrice.toLocaleString()}).`,
      fotoUrl: halfFlavor1.fotoUrl || 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=500&auto=format&fit=crop&q=80',
    };

    const obsText = halfObservation.trim()
      ? `Observaciones: ${halfObservation.trim()}`
      : 'Pizza 2 Sabores';

    setCart((prev) => [
      ...prev,
      {
        producto: halfPizzaProduct,
        cantidad: halfQty,
        observacion: obsText,
      },
    ]);

    setShowHalfPizzaModal(false);
    setHalfFlavor1(null);
    setHalfFlavor2(null);
    setHalfQty(1);
    setHalfObservation('');
  };

  const openObservationModalForProduct = (producto: Producto, currentObs?: string) => {
    if (!activeClient) {
      setAuthError('');
      setAuthMessage('Para poder agregar observaciones y realizar tu pedido, debes iniciar sesión con tu correo electrónico.');
      setAuthMode('login');
      setShowAuthModal(true);
      return;
    }
    const inCart = cart.find((i) => i.producto.id === producto.id);
    if (!inCart) {
      setCart((prev) => [...prev, { producto, cantidad: 1, observacion: '' }]);
      setSelectedQuantities((prev) => ({ ...prev, [producto.id]: 1 }));
    }
    setActiveObservationTarget({ id: producto.id, name: producto.nombre });
    setTempObservation(currentObs !== undefined ? currentObs : (inCart?.observacion || ''));
    setShowObservationModal(true);
  };

  const openObservationModalForGeneral = () => {
    setActiveObservationTarget({ id: 'GENERAL', name: 'Lugar donde se hará la entrega' });
    setTempObservation(checkout.notaCliente || '');
    setShowObservationModal(true);
  };

  const handleSaveObservationFromModal = () => {
    if (activeObservationTarget) {
      if (activeObservationTarget.id === 'GENERAL') {
        setCheckout((prev) => ({ ...prev, notaCliente: tempObservation }));
      } else {
        setCart((prevCart) =>
          prevCart.map((item) =>
            item.producto.id === activeObservationTarget.id
              ? { ...item, observacion: tempObservation }
              : item
          )
        );
      }
    }
    setShowObservationModal(false);
    setActiveObservationTarget(null);
  };

  // Active Logged-in Customer Session
  const [activeClient, setActiveClient] = useState<Cliente | null>(() => {
    try {
      const saved = localStorage.getItem('el_ternero_active_client');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  // Auth Modal State
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'profile'>('login');
  const [authForm, setAuthForm] = useState({
    email: '',
    password: '',
    nombres: '',
    apellidos: '',
    cedula: '',
    celular: '',
  });
  const [showPasswordInput, setShowPasswordInput] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string>('');
  const [authMessage, setAuthMessage] = useState<string>('');
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(false);

  const isGenericCedula = (ced?: string) => {
    if (!ced) return true;
    const c = ced.trim().toLowerCase();
    return c === '' || c === 's/c' || c === 's/n' || c === '0' || c === 'sin cedula' || c === 'sin cédula' || c === 'ninguno';
  };

  // Sync activeClient with checkout form & check real-time block status
  useEffect(() => {
    if (activeClient) {
      if (activeClient.bloqueado) {
        handleLogoutClient();
        setAuthError(`Tu cuenta ha sido dada de baja por la administración. ${activeClient.motivoBloqueo ? `Motivo: ${activeClient.motivoBloqueo}` : ''}`);
        setAuthMessage('');
        setAuthMode('login');
        setShowAuthModal(true);
        return;
      }

      setCheckout((prev) => ({
        ...prev,
        cliente: `${activeClient.nombres} ${activeClient.apellidos}`.trim(),
        telefono: activeClient.celular,
      }));
    }
  }, [activeClient]);

  useEffect(() => {
    if (!socket || !activeClient) return;

    socket.emit('cliente_online', { clienteId: activeClient.id, email: activeClient.email });

    const heartbeat = setInterval(() => {
      socket.emit('cliente_online', { clienteId: activeClient.id, email: activeClient.email });
    }, 20000);

    const handleClientesActualizados = (lista: Cliente[]) => {
      if (Array.isArray(lista)) {
        const myRecord = lista.find(
          (c) =>
            (activeClient.id && c.id === activeClient.id) ||
            (activeClient.email && c.email.trim().toLowerCase() === activeClient.email.trim().toLowerCase()) ||
            (!isGenericCedula(activeClient.cedula) && !isGenericCedula(c.cedula) && c.cedula.trim().toLowerCase() === activeClient.cedula.trim().toLowerCase())
        );
        if (myRecord && myRecord.bloqueado) {
          handleLogoutClient();
          setAuthError(`Tu cuenta ha sido dada de baja / bloqueada por la administración. ${myRecord.motivoBloqueo ? `Motivo: ${myRecord.motivoBloqueo}` : ''}`);
          setAuthMessage('');
          setAuthMode('login');
          setShowAuthModal(true);
        } else if (myRecord) {
          if (
            myRecord.nombres !== activeClient.nombres ||
            myRecord.apellidos !== activeClient.apellidos ||
            myRecord.celular !== activeClient.celular ||
            myRecord.email !== activeClient.email ||
            myRecord.bloqueado !== activeClient.bloqueado ||
            myRecord.motivoBloqueo !== activeClient.motivoBloqueo
          ) {
            setActiveClient(myRecord);
            localStorage.setItem('el_ternero_active_client', JSON.stringify(myRecord));
          }
        }
      }
    };

    socket.on('clientes_actualizados', handleClientesActualizados);
    return () => {
      clearInterval(heartbeat);
      socket.off('clientes_actualizados', handleClientesActualizados);
    };
  }, [socket, activeClient]);

  // Handle Client Logout
  const handleLogoutClient = () => {
    if (socket && activeClient) {
      socket.emit('cliente_offline', { clienteId: activeClient.id });
    }
    setActiveClient(null);
    try {
      localStorage.removeItem('el_ternero_active_client');
    } catch (e) {
      console.error('Error al remover sesión:', e);
    }
    setCheckout({ cliente: '', telefono: '', direccion: '', notaCliente: '' });
  };

  // Handle Client Login with Email and Password
  const handleClientLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authForm.email.trim() || !authForm.password.trim()) {
      setAuthError('Por favor ingresa tu correo electrónico y tu contraseña.');
      return;
    }

    setIsAuthLoading(true);
    setAuthError('');
    setAuthMessage('');

    try {
      const res = await fetch('/api/clientes/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: authForm.email.trim(),
          password: authForm.password.trim(),
        }),
      });

      const data = await res.json();
      if (data.success && data.cliente) {
        setActiveClient(data.cliente);
        localStorage.setItem('el_ternero_active_client', JSON.stringify(data.cliente));
        setShowAuthModal(false);
        setAuthForm({ email: '', password: '', nombres: '', apellidos: '', cedula: '', celular: '' });
      } else if (data.notFound) {
        setAuthMode('register');
        setAuthMessage(data.message || 'Correo no encontrado. Por favor completa tus datos para registrarte.');
      } else {
        setAuthError(data.error || 'No se pudo iniciar sesión. Verifica tu contraseña.');
      }
    } catch (err) {
      setAuthError('Error conectando con el servidor.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  // Handle Client Register
  const handleClientRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authForm.nombres.trim() || (!authForm.celular.trim() && !authForm.email.trim())) {
      setAuthError('Por favor ingresa al menos Tu Nombre y Celular o Correo para registrarte.');
      return;
    }

    setIsAuthLoading(true);
    setAuthError('');
    setAuthMessage('');

    const payload = {
      nombres: authForm.nombres.trim(),
      apellidos: authForm.apellidos.trim(),
      cedula: authForm.cedula.trim(),
      celular: authForm.celular.trim(),
      email: authForm.email.trim(),
      password: authForm.password.trim() || '123456',
    };

    try {
      const res = await fetch('/api/clientes/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success && data.cliente) {
        setActiveClient(data.cliente);
        localStorage.setItem('el_ternero_active_client', JSON.stringify(data.cliente));
        setShowAuthModal(false);
        setAuthForm({ email: '', password: '', nombres: '', apellidos: '', cedula: '', celular: '' });
        if (onRefreshData) onRefreshData();
      } else {
        setAuthError(data.error || 'No se pudo completar el registro.');
      }
    } catch (err) {
      setAuthError('Error conectando con el servidor.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  // Customer's own order IDs stored locally in browser session
  const [myOrderIds, setMyOrderIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('el_ternero_customer_orders');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const saveMyOrderId = (orderId: string) => {
    setMyOrderIds((prev) => {
      if (prev.includes(orderId)) return prev;
      const next = [orderId, ...prev];
      try {
        localStorage.setItem('el_ternero_customer_orders', JSON.stringify(next));
      } catch (e) {
        console.error('Error guardando ID de pedido:', e);
      }
      return next;
    });
  };

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [selectedPedidoId, setSelectedPedidoIdState] = useState<string>(() => {
    try {
      return localStorage.getItem('el_ternero_selected_pedido_id') || '';
    } catch {
      return '';
    }
  });

  const setSelectedPedidoId = (id: string) => {
    setSelectedPedidoIdState(id);
    try {
      if (id) {
        localStorage.setItem('el_ternero_selected_pedido_id', id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const [searchCodeInput, setSearchCodeInput] = useState<string>('');
  const [searchError, setSearchError] = useState<string>('');

  // Filter ONLY customer's own orders corresponding to their account/session
  const myPedidos = useMemo(() => {
    return pedidos.filter((p) => {
      if (activeClient) {
        const emailMatch = Boolean(
          p.clienteEmail &&
          activeClient.email &&
          p.clienteEmail.trim().toLowerCase() === activeClient.email.trim().toLowerCase()
        );
        const cedulaMatch = Boolean(
          p.clienteCedula &&
          activeClient.cedula &&
          !isGenericCedula(p.clienteCedula) &&
          !isGenericCedula(activeClient.cedula) &&
          p.clienteCedula.trim().toLowerCase() === activeClient.cedula.trim().toLowerCase()
        );
        const cleanPPhone = (p.telefono || '').replace(/\D/g, '');
        const cleanCPhone = (activeClient.celular || '').replace(/\D/g, '');
        const phoneMatch = Boolean(
          cleanPPhone &&
          cleanCPhone &&
          cleanPPhone.length >= 6 &&
          cleanPPhone === cleanCPhone
        );
        const clientName = `${activeClient.nombres || ''} ${activeClient.apellidos || ''}`.trim().toLowerCase();
        const nameMatch = Boolean(
          p.cliente &&
          clientName &&
          p.cliente.trim().toLowerCase() === clientName
        );
        const localIdMatch = myOrderIds.includes(p.id);
        return emailMatch || cedulaMatch || phoneMatch || nameMatch || localIdMatch;
      } else {
        return myOrderIds.includes(p.id);
      }
    });
  }, [pedidos, activeClient, myOrderIds]);

  // Automatically remember & sync order IDs into localStorage when loaded
  useEffect(() => {
    if (myPedidos && myPedidos.length > 0) {
      myPedidos.forEach((p) => {
        saveMyOrderId(p.id);
      });
    }
  }, [myPedidos]);

  // SEPARATE ACTIVE ORDERS IN PROGRESS VS COMPLETED / DELIVERED ORDER HISTORY
  const activePedidos = useMemo(
    () => myPedidos.filter((p) => p.estado !== 'entregado' && p.estado !== 'rechazado'),
    [myPedidos]
  );
  const historialPedidos = useMemo(
    () => myPedidos.filter((p) => p.estado === 'entregado' || p.estado === 'rechazado'),
    [myPedidos]
  );

  const [trackingViewMode, setTrackingViewMode] = useState<'activos' | 'historial'>('activos');

  const currentPedidoList = trackingViewMode === 'activos' ? activePedidos : historialPedidos;

  const currentPedido =
    currentPedidoList.find((p) => p.id === selectedPedidoId) ||
    currentPedidoList[0] ||
    (trackingViewMode === 'activos' ? activePedidos[0] : historialPedidos[0]) ||
    myPedidos[0] ||
    null;

  const currentRepartidor = repartidores.find((r) => r.id === currentPedido?.repartidorId);

  // System & Mobile Phone Notification Permission & Handlers
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'default';
  });

  // Register Service Worker for Mobile Notification Bar support
  const swRegRef = useRef<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          swRegRef.current = reg;
        })
        .catch((err) => console.log('SW registration error:', err));
    }
  }, []);

  const sendMobileSystemNotification = (title: string, options: NotificationOptions = {}) => {
    if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') return;

    const notifOptions: any = {
      icon: activeLogo,
      badge: '/scooter.svg',
      vibrate: [200, 100, 200, 100, 200],
      renotify: true,
      requireInteraction: true,
      ...options,
    };

    if (swRegRef.current) {
      swRegRef.current.showNotification(title, notifOptions).catch(() => {
        try {
          new Notification(title, notifOptions);
        } catch (e) {
          console.log('Notification error:', e);
        }
      });
    } else if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready
        .then((reg) => {
          swRegRef.current = reg;
          reg.showNotification(title, notifOptions);
        })
        .catch(() => {
          try {
            new Notification(title, notifOptions);
          } catch (e) {
            console.log('Notification error:', e);
          }
        });
    } else {
      try {
        new Notification(title, notifOptions);
      } catch (e) {
        console.log('Standard notification error:', e);
      }
    }
  };

  const requestNotificationPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const perm = await Notification.requestPermission();
        setNotifPermission(perm);
        if (perm === 'granted') {
          sendMobileSystemNotification('🔔 Notificaciones de Barra Celular Activadas', {
            body: 'Avisos en tiempo real sobre la ruta del moto-repartidor y tiempo estimado (ETA) directo en la barra del celular.',
            tag: 'el-ternero-system-status',
          });
        }
      } catch (e) {
        console.error('Error al solicitar notificaciones:', e);
      }
    }
  };

  // Auto-request notification permission by default on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
        .then((perm) => {
          setNotifPermission(perm);
          if (perm === 'granted') {
            sendMobileSystemNotification('🔔 Alerta de Delivery EL TERNERO Activada por Defecto', {
              body: 'Avisos automáticos sobre la ruta del repartidor en moto y tiempo estimado (ETA) activos en la barra de notificaciones.',
              tag: 'el-ternero-system-status-default',
            });
          }
        })
        .catch((err) => console.log('Notification permission request:', err));
    }
  }, []);

  // Trigger push alert to mobile notification bar whenever order state changes
  const lastNotifiedStateRef = useRef<string>('');
  useEffect(() => {
    if (!currentPedido || notifPermission !== 'granted') return;

    const effectiveEstado = currentPedido.estado === 'comanda_lista' ? 'preparando' : currentPedido.estado;

    const notifKey = `${currentPedido.id}-${effectiveEstado}-${currentPedido.latitudActual || ''}`;
    if (lastNotifiedStateRef.current === notifKey) return;
    lastNotifiedStateRef.current = notifKey;

    let title = `🔔 EL TERNERO: Pedido #${currentPedido.id}`;
    let body = `Estado actual del pedido: ${effectiveEstado.toUpperCase()}.`;

    if (effectiveEstado === 'en_camino') {
      title = `🛵 EL TERNERO: ¡Repartidor en Ruta!`;
      body = `El moto-repartidor ${currentRepartidor?.nombre || currentPedido.repartidorNombre || 'asignado'} va camino a tu ubicación. Abre la app para ver el GPS en vivo.`;
    } else if (effectiveEstado === 'entregado') {
      title = `🎉 EL TERNERO: ¡Pedido Entregado!`;
      body = `¡Gracias por tu compra! Tu pedido #${currentPedido.id} fue entregado con éxito.`;
    } else if (effectiveEstado === 'aceptado' || effectiveEstado === 'preparando') {
      title = `👨‍🍳 EL TERNERO: Pedido En Preparación`;
      body = `Tu pedido está en cocina. El repartidor se asignará para la ruta en breve.`;
    }

    sendMobileSystemNotification(title, {
      body,
      tag: `order-status-${currentPedido.id}`,
    });
  }, [currentPedido?.id, currentPedido?.estado, currentPedido?.latitudActual, notifPermission, currentRepartidor]);

  // Re-order past delivered items into cart
  const handleRepeatOrder = (pedidoToRepeat: Pedido) => {
    if (!pedidoToRepeat.items || pedidoToRepeat.items.length === 0 || !productos) return;

    pedidoToRepeat.items.forEach((itemStr) => {
      const match = itemStr.match(/^(\d+)x\s*(.*?)(?:\[Obs:\s*(.*?)\])?$/i);
      let qty = 1;
      let name = itemStr;
      let obs = '';
      if (match) {
        qty = parseInt(match[1], 10) || 1;
        name = match[2].trim();
        obs = match[3]?.trim() || '';
      }

      const matchedProd = productos.find(
        (pr) => pr.nombre.trim().toLowerCase() === name.trim().toLowerCase()
      );

      if (matchedProd) {
        setCart((prevCart) => {
          const existingIdx = prevCart.findIndex((i) => i.producto.id === matchedProd.id);
          if (existingIdx !== -1) {
            const updated = [...prevCart];
            updated[existingIdx] = {
              ...updated[existingIdx],
              cantidad: Math.min(5, updated[existingIdx].cantidad + qty),
              observacion: obs || updated[existingIdx].observacion,
            };
            return updated;
          } else {
            return [...prevCart, { producto: matchedProd, cantidad: qty, observacion: obs }];
          }
        });
      }
    });

    setSubTab('catalogo');
    setAuthMessage('¡Los productos de tu pedido anterior fueron agregados al carrito de compras!');
  };

  // Handle clicking on 1-5 quantity buttons below each product
  const handleSelectQuantityBtn = (producto: Producto, qty: number) => {
    if (!activeClient) {
      setAuthError('');
      setAuthMessage('Para poder seleccionar productos y realizar tu pedido, debes iniciar sesión con tu correo electrónico.');
      setAuthMode('login');
      setShowAuthModal(true);
      return;
    }

    const validQty = Math.min(5, Math.max(1, qty));
    setSelectedQuantities((prev) => ({ ...prev, [producto.id]: validQty }));

    // Auto update or add to cart
    setCart((prevCart) => {
      const existingIdx = prevCart.findIndex((item) => item.producto.id === producto.id);
      if (existingIdx !== -1) {
        const updated = [...prevCart];
        updated[existingIdx] = { ...prevCart[existingIdx], producto, cantidad: validQty };
        return updated;
      } else {
        return [...prevCart, { producto, cantidad: validQty, observacion: '' }];
      }
    });
  };

  // Handle incrementing or decrementing product directly from product card stepper
  const handleIncrementProd = (producto: Producto, delta: number) => {
    if (!activeClient) {
      setAuthError('');
      setAuthMessage('Para poder seleccionar productos y realizar tu pedido, debes iniciar sesión con tu correo electrónico.');
      setAuthMode('login');
      setShowAuthModal(true);
      return;
    }

    setCart((prevCart) => {
      const existingIdx = prevCart.findIndex((i) => i.producto.id === producto.id);
      if (existingIdx !== -1) {
        const currentQty = prevCart[existingIdx].cantidad;
        const newQty = currentQty + delta;
        if (newQty <= 0) {
          setSelectedQuantities((prev) => {
            const copy = { ...prev };
            delete copy[producto.id];
            return copy;
          });
          return prevCart.filter((i) => i.producto.id !== producto.id);
        } else {
          const validQty = Math.min(5, newQty);
          setSelectedQuantities((prev) => ({ ...prev, [producto.id]: validQty }));
          const updated = [...prevCart];
          updated[existingIdx] = { ...updated[existingIdx], cantidad: validQty };
          return updated;
        }
      } else if (delta > 0) {
        setSelectedQuantities((prev) => ({ ...prev, [producto.id]: 1 }));
        return [...prevCart, { producto, cantidad: 1, observacion: '' }];
      }
      return prevCart;
    });
  };

  const handleUpdateCartItemQty = (prodId: string, delta: number) => {
    setCart((prevCart) =>
      prevCart.map((item) => {
        if (item.producto.id === prodId) {
          const newQty = Math.min(5, Math.max(1, item.cantidad + delta));
          return { ...item, cantidad: newQty };
        }
        return item;
      })
    );
  };

  const handleRemoveCartItem = (prodId: string) => {
    setCart((prev) => prev.filter((item) => item.producto.id !== prodId));
  };

  const cartTotal = cart.reduce((acc, item) => acc + item.producto.monto * item.cantidad, 0);

  const handleComprobanteFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      setComprobanteError('El archivo es muy pesado. El tamaño máximo permitido es 8MB.');
      return;
    }

    setComprobanteError('');
    setComprobanteNombre(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setComprobanteUrl(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleCopyBankData = () => {
    const bankDetails = `*DATOS PARA TRANSFERENCIA - EL TERNERO*\n• Banco: Banco Continental / Itaú\n• Titular: EL TERNERO S.R.L.\n• RUC: 80012345-6\n• N° de Cuenta: 720198421\n• Alias SIPAP: elternero.py\n• Importe a Transferir: Gs. ${cartTotal.toLocaleString()}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(bankDetails);
    }
    setCopiedBankInfo(true);
    setTimeout(() => setCopiedBankInfo(false), 3000);
  };

  const handleRemoveComprobante = () => {
    setComprobanteUrl('');
    setComprobanteNombre('');
    setComprobanteError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Submit Customer Order to Backend (supports Cash, Transfer & Google Pay)
  const processOrderCreation = async (overrideMetodo?: MetodoPago, gpayAuthInfo?: unknown) => {
    if (cart.length === 0) return;

    if (!activeClient) {
      setAuthMessage('Inicia sesión o regístrate para confirmar tu pedido con tu correo.');
      setAuthMode('login');
      setShowAuthModal(true);
      return;
    }

    const currentMetodo = overrideMetodo || metodoPago;

    if (currentMetodo === 'transferencia' && !comprobanteUrl) {
      setComprobanteError('Por favor adjunta la foto o captura del comprobante de transferencia antes de confirmar.');
      return;
    }

    setComprobanteError('');
    setIsSubmitting(true);

    const itemsStrList = cart.map((item) => {
      const obsStr = item.observacion?.trim() ? ` [Obs: ${item.observacion.trim()}]` : '';
      return `${item.cantidad}x ${item.producto.nombre}${obsStr}`;
    });

    const itemObsList = cart
      .filter((item) => item.observacion?.trim())
      .map((item) => `• ${item.cantidad}x ${item.producto.nombre}: "${item.observacion?.trim()}"`);

    let combinedNota = checkout.notaCliente?.trim() || '';
    if (itemObsList.length > 0) {
      const obsBlock = `OBSERVACIONES POR PRODUCTO:\n${itemObsList.join('\n')}`;
      combinedNota = combinedNota ? `${obsBlock}\n\nNOTA DE ENTREGA: ${combinedNota}` : obsBlock;
    }

    if (currentMetodo === 'gpay') {
      const authTag = gpayAuthInfo ? 'AUTORIZADO DIGITALMENTE' : 'CONFIRMADO';
      const gpayNote = `\n[PAGO GPAY: ${authTag} - Tarjeta procesada vía Google Pay]`;
      combinedNota += gpayNote;
    }

    const selectedRep = repartidores[0];

    const parsedMontoPagaCon = montoPagaCon ? parseInt(montoPagaCon.replace(/\D/g, ''), 10) : undefined;

    const payload = {
      cliente: `${activeClient.nombres} ${activeClient.apellidos}`.trim(),
      clienteEmail: activeClient.email,
      clienteCedula: activeClient.cedula,
      telefono: activeClient.celular,
      direccion: checkout.direccion || 'Av. Mariscal López y Perú',
      latitudCliente: customerLat,
      longitudCliente: customerLon,
      restauranteNombre: restauranteConfig?.nombre || 'EL TERNERO - Pizzería & Lomitería',
      latitudRestaurante: restauranteConfig?.latitud ?? -25.1747,
      longitudRestaurante: restauranteConfig?.longitud ?? -57.48334,
      repartidorId: selectedRep?.id || 'REP-123',
      repartidorNombre: selectedRep?.nombre || 'Juan Pérez',
      notaCliente: combinedNota || 'Por favor entregar en la dirección especificada.',
      detallesPedido: combinedNota || 'Por favor entregar en la dirección especificada.',
      instruccionOptimizada: checkout.notaCliente || 'Tocar timbre y entregar en recepción.',
      items: itemsStrList,
      total: cartTotal,
      metodoPago: currentMetodo,
      montoPagaCon: currentMetodo === 'efectivo' ? parsedMontoPagaCon : undefined,
      comprobanteUrl: currentMetodo === 'transferencia' ? comprobanteUrl : '',
      comprobanteNombre: currentMetodo === 'transferencia' ? comprobanteNombre : '',
      comprobanteRevisado: currentMetodo === 'gpay', // GPay digital payment is already approved
    };

    try {
      const res = await fetch('/api/pedidos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const newPed = await res.json();
        saveMyOrderId(newPed.id);
        setSelectedPedidoId(newPed.id);
        setCart([]);
        setComprobanteUrl('');
        setComprobanteNombre('');
        setMontoPagaCon('');
        setSubTab('rastreo');
        if (onRefreshData) onRefreshData();
      } else {
        const errorData = await res.json().catch(() => ({}));
        const msg = errorData.error || 'No se pudo procesar el pedido.';
        if (res.status === 403 || msg.includes('bloqueada') || msg.includes('baja')) {
          handleLogoutClient();
          setAuthError(msg);
          setAuthMessage('');
          setAuthMode('login');
          setShowAuthModal(true);
        } else {
          setAuthError(msg);
          setShowAuthModal(true);
        }
      }
    } catch (err) {
      console.error(err);
      setAuthError('Error de conexión al procesar el pedido.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    await processOrderCreation();
  };

  const handleSearchOrderCode = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = searchCodeInput.trim().toUpperCase();
    if (!cleanCode) return;

    const found = pedidos.find(
      (p) =>
        p.id.toUpperCase() === cleanCode ||
        p.id.toUpperCase() === `PED-${cleanCode}` ||
        p.id.toUpperCase().endsWith(cleanCode)
    );

    if (found) {
      saveMyOrderId(found.id);
      setSelectedPedidoId(found.id);
      setSearchCodeInput('');
      setSearchError('');
      setSubTab('rastreo');
    } else {
      setSearchError(`No se encontró ningún pedido con el código "${cleanCode}". Verifica el número.`);
    }
  };

  // Distance calculation using real road/street routes
  const [osrmRouteStats, setOsrmRouteStats] = useState<{ distanceKm: number; durationMin: number } | null>(null);

  useEffect(() => {
    if (!currentPedido) {
      setOsrmRouteStats(null);
      return;
    }
    const lat1 = currentPedido.latitudActual ?? currentPedido.latitudRestaurante;
    const lon1 = currentPedido.longitudActual ?? currentPedido.longitudRestaurante;
    const lat2 = currentPedido.latitudCliente;
    const lon2 = currentPedido.longitudCliente;

    // Instant sync calculation
    const syncRes = calculateRoadDistanceSync(lat1, lon1, lat2, lon2);
    setOsrmRouteStats(syncRes);

    // Fetch real OSRM street route
    fetchStreetRoute(lat1, lon1, lat2, lon2).then((res) => {
      setOsrmRouteStats((prev) => {
        if (prev && prev.distanceKm === res.distanceKm && prev.durationMin === res.durationMin) {
          return prev;
        }
        return { distanceKm: res.distanceKm, durationMin: res.durationMin };
      });
    });
  }, [
    currentPedido?.id,
    currentPedido?.latitudActual,
    currentPedido?.longitudActual,
    currentPedido?.latitudCliente,
    currentPedido?.longitudCliente,
  ]);

  // SYSTEM & MOBILE NOTIFICATION EFFECT FOR ETA AND DRIVER ROUTE
  useEffect(() => {
    if (!currentPedido) return;
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    const id = currentPedido.id;
    const estado = currentPedido.estado === 'comanda_lista' ? 'preparando' : currentPedido.estado;
    const etaMin = osrmRouteStats ? Math.round(osrmRouteStats.durationMin) : null;
    const distKm = osrmRouteStats ? osrmRouteStats.distanceKm.toFixed(1) : null;

    if (estado === 'en_camino') {
      const driverName = currentRepartidor?.nombre || 'El repartidor';
      const etaText = etaMin !== null ? `Llegada aprox: ~${etaMin} min (${distKm} km)` : '¡En ruta!';

      document.title = `(🛵 ~${etaMin ?? 5} min) EL TERNERO - Delivery`;

      try {
        new Notification(`🛵 ¡Repartidor en Camino! - EL TERNERO`, {
          body: `Pedido #${id}: ${driverName} en camino a tu dirección. ${etaText}`,
          icon: activeLogo,
          tag: `order-eta-${id}`,
          renotify: true,
          vibrate: [200, 100, 200, 100, 200],
        } as any);
      } catch (e) {
        console.error(e);
      }
    } else if (estado === 'entregado') {
      document.title = `🎉 ¡Pedido Entregado! - EL TERNERO`;
      try {
        new Notification(`🎉 ¡Pedido Entregado! - EL TERNERO`, {
          body: `Tu pedido #${id} fue entregado exitosamente. ¡Gracias por tu compra!`,
          icon: activeLogo,
          tag: `order-status-${id}`,
        } as any);
      } catch (e) {
        console.error(e);
      }
    } else if (estado === 'preparando') {
      document.title = `👨‍🍳 En Preparación - EL TERNERO`;
      try {
        new Notification(`👨‍🍳 Pedido en Preparación - EL TERNERO`, {
          body: `Tu comanda #${id} ya se está preparando en la cocina.`,
          icon: activeLogo,
          tag: `order-status-${id}`,
        } as any);
      } catch (e) {
        console.error(e);
      }
    } else if (estado === 'aceptado') {
      document.title = `✅ Pedido Confirmado - EL TERNERO`;
      try {
        new Notification(`✅ Pedido Confirmado - EL TERNERO`, {
          body: `Tu pedido #${id} fue aceptado y confirmado.`,
          icon: activeLogo,
          tag: `order-status-${id}`,
        } as any);
      } catch (e) {
        console.error(e);
      }
    }
  }, [
    currentPedido?.id,
    currentPedido?.estado,
    osrmRouteStats?.durationMin,
    currentRepartidor?.nombre,
  ]);

  const distanceKm = osrmRouteStats ? osrmRouteStats.distanceKm : 0;
  const estimatedMin = osrmRouteStats ? osrmRouteStats.durationMin : 5;

  const steps = [
    { id: 'recibido', label: 'Pendiente de Aceptación', icon: Clock },
    { id: 'aceptado', label: 'Pedido Confirmado', icon: CheckCircle2 },
    { id: 'preparando', label: 'En Preparación', icon: Clock },
    { id: 'en_camino', label: 'En Camino (GPS Vivo)', icon: Navigation },
    { id: 'entregado', label: 'Entregado', icon: ShieldCheck },
  ];

  const getStepStatus = (stepId: string) => {
    const activeEstado = currentPedido?.estado === 'comanda_lista' ? 'preparando' : currentPedido?.estado;
    const orderIndex = steps.findIndex((s) => s.id === activeEstado);
    const stepIndex = steps.findIndex((s) => s.id === stepId);

    if (currentPedido?.estado === 'entregado') return 'completed';
    if (orderIndex !== -1 && stepIndex < orderIndex) return 'completed';
    if (orderIndex !== -1 && stepIndex === orderIndex) return 'current';
    return 'upcoming';
  };

  return (
    <div className="space-y-3 sm:space-y-5 pb-20">
      {/* SUB-TAB 1: PRODUCT CATALOG & CUSTOMER ORDER FORM WITH 1-8 QUANTITY BUTTONS */}
      {subTab === 'catalogo' && (
        <div className="space-y-3 sm:space-y-5">
          {promoBannerMsg && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/20 via-emerald-500/10 to-slate-900 border-2 border-emerald-500 text-slate-100 flex items-center justify-between gap-4 shadow-xl animate-bounce-short">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500 text-slate-950 font-black flex items-center justify-center text-xl shrink-0 shadow-lg shadow-emerald-500/30">
                  🔥
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-black text-emerald-300">¡Promoción Agregada al Carrito!</p>
                  <p className="text-xs text-slate-200 mt-0.5 font-medium leading-relaxed">{promoBannerMsg}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPromoBannerMsg(null)}
                className="px-3 py-1.5 rounded-xl bg-emerald-500 text-slate-950 font-extrabold text-xs hover:bg-emerald-400 shrink-0 cursor-pointer shadow-md"
              >
                Entendido
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
          {/* Products Grid Column (8 cols) */}
          <div className="lg:col-span-8 space-y-4 sm:space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 sm:p-5 shadow-xl space-y-3 sm:space-y-5">
              {/* IF NO CATEGORY IS SELECTED -> SHOW ONLY CATEGORIES GRID */}
              {selectedCategory === null ? (
                <div className="space-y-3 sm:space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-800">
                    <div className="flex items-center gap-3">
                      <img
                        src={activeLogo}
                        alt="EL TERNERO"
                        className="w-10 h-10 rounded-full object-contain bg-black border border-emerald-500 shadow-md shadow-emerald-500/20 ring-1 ring-slate-950 shrink-0"
                      />
                      <div>
                        <h3 className="text-sm sm:text-base font-black text-slate-100 flex items-center gap-2">
                          MENÚ EL TERNERO
                        </h3>
                        <p className="text-[11px] text-emerald-400 font-semibold tracking-wide">
                          SABOR QUE NACE DEL CAMPO
                        </p>
                      </div>
                    </div>
                    <span className="text-[11px] sm:text-xs text-slate-400 font-mono bg-slate-800 px-2.5 py-0.5 sm:py-1 rounded-xl border border-slate-700 shrink-0 self-start sm:self-auto font-bold">
                      {productos.length} Productos Disponibles
                    </span>
                  </div>

                  {/* CATEGORY GRID CARDS CLEAN & STYLIZED */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3.5">
                    {customerCategoryList.map((cat) => {
                      const count = productos.filter((p) => p.categoria === cat.id).length;
                      const fotoPortada = categoryPortadasMap[cat.id];

                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setSelectedCategory(cat.id)}
                          className="relative h-28 sm:h-36 rounded-2xl border border-slate-800 text-left flex flex-col justify-end p-2.5 sm:p-3.5 transition-all duration-300 hover:border-emerald-500/80 hover:scale-[1.02] hover:shadow-xl hover:shadow-emerald-500/10 group bg-slate-900/90 backdrop-blur-sm shadow-md overflow-hidden"
                        >
                          {/* Category Cover Photo Background */}
                          {fotoPortada && (
                            <>
                              <img
                                src={fotoPortada}
                                alt={cat.label}
                                className="absolute inset-0 w-full h-full object-cover opacity-75 group-hover:opacity-90 transition-all group-hover:scale-105 duration-500"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-slate-950/20" />
                            </>
                          )}

                          {/* Bottom Label & Category Name */}
                          <div className="relative z-10">
                            <h4 className="text-xs sm:text-sm font-extrabold text-slate-100 leading-snug group-hover:text-emerald-300 transition-colors line-clamp-1 drop-shadow-md">
                              {cat.label}
                            </h4>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* WHEN A CATEGORY IS SELECTED -> SHOW PRODUCTS GRID WITH REGRESAR A CATEGORIAS BUTTON */
                <div className="space-y-5 animate-in fade-in duration-200">
                  {/* TOP NAVIGATION BAR WITH PROMINENT BACK BUTTON */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-950/80 rounded-2xl border border-slate-800">
                    <button
                      type="button"
                      onClick={() => setSelectedCategory(null)}
                      className="px-4 py-2 rounded-xl text-xs font-extrabold bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center justify-center gap-2 shadow-md shadow-emerald-500/20 transition-all uppercase tracking-wider shrink-0"
                    >
                      <ArrowLeft className="w-4 h-4 shrink-0" />
                      <span>Volver a Categorías</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 font-medium">Viendo:</span>
                      <span className="text-xs font-extrabold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-500/30 font-mono">
                        {selectedCategory === 'Todas' ? 'Ver Todo el Menú' : selectedCategory}
                      </span>
                      <span className="text-xs text-slate-500 font-mono">
                        (
                        {(selectedCategory === 'Todas'
                          ? productos
                          : productos.filter((p) => p.categoria === selectedCategory)
                        ).length}{' '}
                        platos)
                      </span>
                    </div>
                  </div>

                  {/* SPECIAL BANNER FOR PIZZA MITAD Y MITAD (ONLY SHOWN WHEN INSIDE PIZZA CATEGORY OR ALL) */}
                  {selectedCategory && (selectedCategory.toLowerCase().includes('pizza') || selectedCategory === 'Pizzas' || selectedCategory === 'Todas') && (
                    <div className="bg-gradient-to-r from-emerald-950/80 via-slate-900 to-slate-950 border-2 border-emerald-500/50 rounded-2xl p-4 sm:p-5 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="flex items-center gap-3.5 text-left">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-slate-950 flex items-center justify-center font-black text-2xl shadow-lg shadow-emerald-500/30 shrink-0">
                          🍕
                        </div>
                        <div className="space-y-1">
                          <span className="text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full uppercase tracking-wider">
                            Especialidad de la casa
                          </span>
                          <h3 className="text-sm sm:text-base font-extrabold text-slate-100">
                            Pizza 2 Sabores
                          </h3>
                          <p className="text-xs text-slate-300">
                            Combina 2 variedades distintas en una sola pizza a tu elección.
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowHalfPizzaModal(true)}
                        className="w-full sm:w-auto px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all shrink-0 active:scale-95"
                      >
                        <span>🍕 Armar Pizza</span>
                      </button>
                    </div>
                  )}

                  {/* PRODUCTS GRID */}
                  {productos.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 space-y-2">
                      <Package className="w-10 h-10 text-slate-600 mx-auto" />
                      <p className="text-sm font-medium">No hay productos cargados todavía.</p>
                      <p className="text-xs text-slate-500">
                        El administrador puede cargar productos desde el Panel Administrador.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                      {/* CARD ESPECIAL PIZZA MITAD Y MITAD (2 SABORES) */}
                      {selectedCategory && (selectedCategory.toLowerCase().includes('pizza') || selectedCategory === 'Pizzas' || selectedCategory === 'Todas') && (
                        <div
                          onClick={() => setShowHalfPizzaModal(true)}
                          className="bg-gradient-to-b from-emerald-950/80 via-slate-900 to-slate-900 border-2 border-emerald-500/70 rounded-2xl overflow-hidden flex flex-col justify-between transition-all duration-300 hover:border-emerald-400 hover:scale-[1.02] shadow-xl cursor-pointer group relative"
                        >
                          <div className="relative h-28 sm:h-32 w-full bg-slate-950 overflow-hidden flex items-center justify-center">
                            <img
                              src="https://images.unsplash.com/photo-1513104890138-7c749659a591?w=500&auto=format&fit=crop&q=80"
                              alt="Armar Pizza"
                              className="w-full h-full object-cover opacity-75 group-hover:scale-105 transition-transform duration-500"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent opacity-90" />
                            
                            <div className="absolute top-2 left-2 bg-emerald-500 text-slate-950 font-black text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider shadow-md">
                              2 Sabores
                            </div>

                            <div className="absolute bottom-2 inset-x-2 text-center">
                              <span className="text-xl sm:text-2xl drop-shadow">🍕 1/2 + 1/2 🍕</span>
                            </div>
                          </div>

                          <div className="p-3 space-y-1.5 text-left flex-1 flex flex-col justify-between">
                            <div>
                              <h4 className="font-extrabold text-xs sm:text-sm text-emerald-300 group-hover:text-emerald-200 transition-colors">
                                Armar Pizza
                              </h4>
                              <p className="text-[10px] text-slate-300 leading-snug line-clamp-2 mt-0.5">
                                Combina 2 sabores a tu elección en una sola pizza.
                              </p>
                            </div>
                            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                              <span className="text-[10px] font-extrabold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/30">
                                2 Sabores
                              </span>
                              <span className="text-[10px] font-black text-emerald-300 uppercase tracking-wider group-hover:translate-x-0.5 transition-transform">
                                Armar →
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {(selectedCategory === 'Todas'
                        ? productos
                        : productos.filter((p) => p.categoria === selectedCategory)
                      ).map((prod) => {
                    const currentQtySelected = selectedQuantities[prod.id] || 0;
                    const inCartItem = cart.find((item) => item.producto.id === prod.id);

                      return (
                        <div
                          key={prod.id}
                          onClick={() => {
                            if (!activeClient) {
                              setAuthError('');
                              setAuthMessage('Para poder ingresar al producto y realizar tu pedido, debes iniciar sesión con tu correo electrónico.');
                              setAuthMode('login');
                              setShowAuthModal(true);
                              return;
                            }
                            setProductForModal(prod);
                            setModalQty(inCartItem ? inCartItem.cantidad : 1);
                          }}
                          className={`bg-slate-900/90 border rounded-2xl overflow-hidden flex flex-col justify-between transition-all duration-200 hover:border-emerald-500/50 shadow-md cursor-pointer group ${
                            inCartItem
                              ? 'border-emerald-500/70 ring-1 ring-emerald-500/40 bg-slate-900'
                              : 'border-slate-800'
                          }`}
                        >
                          {/* Top Banner Image Grid Tile */}
                          <div className="relative h-28 sm:h-32 w-full bg-slate-950 overflow-hidden">
                            <img
                              src={prod.fotoUrl}
                              alt={prod.nombre}
                              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src =
                                  'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&auto=format&fit=crop&q=80';
                              }}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent opacity-80" />
                            
                            {/* Price Tag & Neon Disponible Badge */}
                            <div className="absolute top-2 right-2 bg-emerald-500 text-slate-950 font-mono font-extrabold text-[11px] px-2 py-0.5 rounded-full shadow-md shadow-emerald-500/30">
                              Gs. {prod.monto.toLocaleString()}
                            </div>

                            {/* Bottom Overlay Info (Indicador en carrito y Etiqueta DISPONIBLE con Neón) */}
                            <div className="absolute bottom-1.5 left-2 right-2 flex items-center justify-between pointer-events-none">
                              {inCartItem ? (
                                <span className="text-[9px] font-mono font-bold text-emerald-300 bg-emerald-950/90 backdrop-blur-md px-2 py-0.5 rounded-full border border-emerald-500/40 flex items-center gap-1 shadow-lg">
                                  <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400 shrink-0" /> {inCartItem.cantidad} en carrito
                                </span>
                              ) : (
                                <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border border-emerald-400 text-emerald-300 bg-slate-950/80 backdrop-blur-md animate-neon-flash inline-flex items-center gap-1 shadow-[0_0_12px_rgba(251,191,36,0.6)]">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
                                  DISPONIBLE
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Card Body */}
                          <div className="p-3 flex-1 flex flex-col justify-between">
                            <div className="space-y-1">
                              <h4 className="text-xs sm:text-sm font-bold text-slate-100 leading-snug line-clamp-1 group-hover:text-emerald-300 transition-colors">
                                {prod.nombre}
                              </h4>
                              {prod.descripcion && (
                                <p className="text-[11px] text-slate-400 line-clamp-1 italic">
                                  {prod.descripcion}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                  })}
                </div>
              )}
                </div>
              )}
            </div>
          </div>

          {/* Cart & Checkout Sidebar Column (4 cols) */}
          <div className="lg:col-span-4 space-y-6" id="cart-sidebar-section">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2 uppercase tracking-wider">
                  <ShoppingCart className="w-4 h-4 text-emerald-400" />
                  Crear Pedido
                </h3>
                {cart.length > 0 && (
                  <button
                    onClick={() => setCart([])}
                    className="text-[11px] text-rose-400 hover:text-rose-300 font-semibold"
                  >
                    Vaciar
                  </button>
                )}
              </div>

              {cart.length === 0 ? (
                <div className="text-center py-8 text-slate-400 space-y-2">
                  <ShoppingCart className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="text-xs font-medium">El carrito está vacío.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Cart Items List */}
                  <div className="divide-y divide-slate-800 max-h-60 overflow-y-auto pr-1">
                    {cart.map((item) => (
                      <div key={item.producto.id} className="py-3 border-b border-slate-800/80 space-y-2 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-slate-200 truncate">{item.producto.nombre}</p>
                            <p className="text-[11px] text-slate-400 font-mono">
                              Gs. {item.producto.monto.toLocaleString()} c/u
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleUpdateCartItemQty(item.producto.id, -1)}
                              className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 font-extrabold flex items-center justify-center border-2 border-slate-700 active:bg-emerald-500 active:text-slate-950 transition-all touch-manipulation active:scale-95 shrink-0"
                              title="Restar unidad"
                            >
                              <Minus className="w-4 h-4 stroke-[3]" />
                            </button>
                            <span className="w-6 text-center font-mono font-black text-slate-100 text-sm sm:text-base">
                              {item.cantidad}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUpdateCartItemQty(item.producto.id, 1)}
                              disabled={item.cantidad >= 5}
                              className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-emerald-400 font-extrabold flex items-center justify-center border-2 border-slate-700 active:bg-emerald-500 active:text-slate-950 transition-all touch-manipulation active:scale-95 shrink-0"
                              title="Sumar unidad (Máx 5)"
                            >
                              <Plus className="w-4 h-4 stroke-[3]" />
                            </button>
                            <span className="font-mono font-bold text-emerald-400 ml-1 min-w-[65px] text-right">
                              Gs. {(item.cantidad * item.producto.monto).toLocaleString()}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveCartItem(item.producto.id)}
                              className="text-slate-500 hover:text-rose-400 transition-colors p-1"
                              title="Eliminar producto"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Botón Ventana Emergente de Observaciones para este producto en el Carrito */}
                        <div>
                          {item.observacion ? (
                            <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-xl p-2 text-[11px] text-emerald-200 flex items-center justify-between gap-2 shadow-inner">
                              <span className="truncate font-sans font-medium text-emerald-200">
                                📌 Obs: "{item.observacion}"
                              </span>
                              <button
                                type="button"
                                onClick={() => openObservationModalForProduct(item.producto, item.observacion)}
                                className="text-emerald-400 hover:text-slate-950 bg-emerald-500/20 hover:bg-emerald-400 font-extrabold px-2 py-0.5 rounded-lg border border-emerald-500/40 shrink-0 text-[10px] transition-all active:scale-95 shadow-sm"
                              >
                                Editar 📝
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openObservationModalForProduct(item.producto, item.observacion)}
                              className="w-full text-[11px] font-extrabold text-emerald-300 hover:text-slate-950 bg-emerald-500/10 hover:bg-emerald-500 border border-emerald-500/40 py-1.5 px-3 rounded-xl transition-all flex items-center justify-between gap-1 shadow-sm active:scale-95 touch-manipulation"
                            >
                              <span className="flex items-center gap-1.5 truncate">
                                <MessageSquare className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                <span>+ Observación (sin lechuga, cebolla, doble carne...)</span>
                              </span>
                              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-extrabold px-1.5 py-0.5 rounded border border-emerald-500/30 shrink-0">
                                Ventana ↗
                              </span>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Total */}
                  <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between font-mono">
                    <span className="text-xs font-semibold text-slate-300">Total Pedido:</span>
                    <span className="text-lg font-extrabold text-emerald-400">
                      Gs. {cartTotal.toLocaleString()}
                    </span>
                  </div>

                  {/* Customer Checkout Details Form */}
                  <form onSubmit={handleConfirmOrder} className="space-y-3 pt-2 text-xs border-t border-slate-800">
                    <h4 className="font-bold text-slate-200 text-xs">Datos para el Envío:</h4>

                    <div>
                      <label className="block text-slate-400 mb-1">Tu Nombre:</label>
                      <input
                        type="text"
                        required
                        placeholder="Ej. María Giménez"
                        value={checkout.cliente}
                        onChange={(e) => setCheckout({ ...checkout, cliente: e.target.value })}
                        className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1">Teléfono Móvil:</label>
                      <input
                        type="text"
                        required
                        placeholder="Ej. +595 981 123456"
                        value={checkout.telefono}
                        onChange={(e) => setCheckout({ ...checkout, telefono: e.target.value })}
                        className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1">Dirección Exacta de Entrega:</label>
                      <input
                        type="text"
                        required
                        placeholder="Ej. Av. España y Brasil 1450"
                        value={checkout.direccion}
                        onChange={(e) => setCheckout({ ...checkout, direccion: e.target.value })}
                        className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    {/* Google Maps Pin Selection Box */}
                    <div className="bg-slate-950 p-3.5 rounded-xl border border-rose-500/30 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-rose-400" />
                          <span className="font-bold text-slate-100 text-xs">Ubicación GPS en Mapa</span>
                        </div>
                        <span className="text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded">
                          📍 Pin de Entrega
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-400">
                        Fija en el mapa el punto exacto donde el repartidor debe entregar tu pedido.
                      </div>

                      {/* Distance calculation */}
                      {(() => {
                        const rLat = restauranteConfig?.latitud ?? -25.1747;
                        const rLon = restauranteConfig?.longitud ?? -57.48334;
                        const R = 6371;
                        const dLat = ((customerLat - rLat) * Math.PI) / 180;
                        const dLon = ((customerLon - rLon) * Math.PI) / 180;
                        const a =
                          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                          Math.cos((rLat * Math.PI) / 180) *
                            Math.cos((customerLat * Math.PI) / 180) *
                            Math.sin(dLon / 2) *
                            Math.sin(dLon / 2);
                        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                        const distKm = parseFloat((R * c).toFixed(2));
                        const estMin = Math.max(3, Math.round(distKm * 4 + 3));

                        return (
                          <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between text-[11px]">
                            <div>
                              <span className="text-slate-400">Distancia al Local: </span>
                              <span className="font-mono font-bold text-emerald-400">{distKm} km</span>
                            </div>
                            <div>
                              <span className="text-slate-400">Tiempo: </span>
                              <span className="font-mono font-bold text-emerald-300">~{estMin} mins</span>
                            </div>
                          </div>
                        );
                      })()}

                      <div className="flex flex-col gap-2">
                        <button
                          type="button"
                          onClick={() => setShowMapPickerModal(true)}
                          className="w-full bg-rose-500/10 hover:bg-rose-500 text-rose-300 hover:text-slate-950 font-bold py-2.5 px-3 rounded-xl border border-rose-500/40 hover:border-rose-400 transition-all flex items-center justify-center gap-2 text-xs shadow-md active:scale-98 cursor-pointer"
                        >
                          <Compass className="w-4 h-4 text-rose-400" />
                          <span>Fijar / Cambiar Pin en Google Maps</span>
                        </button>
                      </div>
                    </div>

                    {/* Observación General del Pedido (Ventana Emergente Modal) */}
                    <div className="bg-slate-950 p-3.5 rounded-xl border border-emerald-500/40 space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span className="font-extrabold text-slate-100 text-xs uppercase tracking-wider truncate">
                            Observación del Lugar donde se hará la Entrega
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={openObservationModalForGeneral}
                          className="text-xs font-bold bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-slate-950 border border-emerald-500/40 px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 shadow-md shrink-0 active:scale-95 touch-manipulation"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>{checkout.notaCliente ? 'Editar' : '+ Agregar'}</span>
                        </button>
                      </div>

                      {checkout.notaCliente ? (
                        <div className="bg-slate-900/90 p-3 rounded-xl border border-emerald-500/30 text-emerald-100 text-xs leading-relaxed space-y-1">
                          <div className="flex items-center justify-between text-[10px] text-emerald-400 font-bold uppercase tracking-wider border-b border-emerald-500/20 pb-1">
                            <span>📌 Nota Adjuntada al Ticket:</span>
                            <span className="text-emerald-400 font-mono">✓ Guardado</span>
                          </div>
                          <p className="italic pt-0.5">"{checkout.notaCliente}"</p>
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-400 bg-slate-900/50 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between">
                          <span className="italic truncate">Ej. Portón blanco, timbre roto, llamar al llegar...</span>
                          <button
                            type="button"
                            onClick={openObservationModalForGeneral}
                            className="text-emerald-400 hover:underline font-bold text-[11px] ml-2 shrink-0"
                          >
                            Toca para escribir
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Selección de Método de Pago */}
                    <div className="bg-slate-950 p-3.5 rounded-xl border border-emerald-500/30 space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
                          <CreditCard className="w-4 h-4 text-emerald-400" />
                          <span>Método de Pago:</span>
                        </label>
                        <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                          {metodoPago === 'efectivo' ? '💵 Contra Entrega' : metodoPago === 'transferencia' ? '🏦 Transferencia Bancaria' : '💳 Pago GPay'}
                        </span>
                      </div>

                      {/* 3 Payment Options Buttons */}
                      <div className={`grid ${PAGO_GPAY_HABILITADO ? 'grid-cols-3' : 'grid-cols-2'} gap-2`}>
                        <button
                          type="button"
                          onClick={() => {
                            setMetodoPago('efectivo');
                            setComprobanteError('');
                          }}
                          className={`p-2.5 rounded-xl border text-center transition-all flex flex-col items-center gap-1.5 cursor-pointer ${
                            metodoPago === 'efectivo'
                              ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 ring-2 ring-emerald-500/30 shadow-md shadow-emerald-500/10'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                          }`}
                        >
                          <Banknote className="w-5 h-5 text-emerald-400" />
                          <span className="text-[11px] font-bold leading-tight">Efectivo</span>
                          <span className="text-[9px] text-slate-400">Contra entrega</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setMetodoPago('transferencia');
                            setComprobanteError('');
                          }}
                          className={`p-2.5 rounded-xl border text-center transition-all flex flex-col items-center gap-1.5 cursor-pointer ${
                            metodoPago === 'transferencia'
                              ? 'bg-indigo-500/20 border-indigo-400 text-indigo-300 ring-2 ring-indigo-500/30 shadow-md shadow-indigo-500/10'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                          }`}
                        >
                          <Landmark className="w-5 h-5 text-indigo-400" />
                          <span className="text-[11px] font-bold leading-tight">Transferencia</span>
                          <span className="text-[9px] text-slate-400">SIPAP / QR</span>
                        </button>

                        {PAGO_GPAY_HABILITADO && (
                        <button
                          type="button"
                          onClick={() => {
                            setMetodoPago('gpay');
                            setComprobanteError('');
                          }}
                          className={`p-2.5 rounded-xl border text-center transition-all flex flex-col items-center gap-1.5 cursor-pointer ${
                            metodoPago === 'gpay'
                              ? 'bg-sky-500/20 border-sky-400 text-sky-300 ring-2 ring-sky-500/30 shadow-md shadow-sky-500/10'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                          }`}
                        >
                          <div className="flex items-center justify-center font-bold text-sm tracking-tight text-white">
                            <span className="text-blue-400">G</span>
                            <span className="text-red-400">P</span>
                            <span className="text-yellow-400">a</span>
                            <span className="text-green-400">y</span>
                          </div>
                          <span className="text-[11px] font-bold leading-tight">Google Pay</span>
                          <span className="text-[9px] text-slate-400">Digital</span>
                        </button>
                        )}
                      </div>

                      {/* DETALLE OPCIÓN 1: EFECTIVO */}
                      {metodoPago === 'efectivo' && (
                        <div className="bg-slate-900/90 p-3 rounded-xl border border-emerald-500/20 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <label className="text-[11px] font-bold text-slate-200">
                              ¿Con cuánto abonas? (Para llevar tu vuelto):
                            </label>
                            {montoPagaCon && parseInt(montoPagaCon.replace(/\D/g, ''), 10) > cartTotal && (
                              <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-500/30">
                                Vuelto: Gs. {(parseInt(montoPagaCon.replace(/\D/g, ''), 10) - cartTotal).toLocaleString()}
                              </span>
                            )}
                          </div>

                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">Gs.</span>
                            <input
                              type="text"
                              placeholder={`Monto exacto (Gs. ${cartTotal.toLocaleString()}) o escribe cuánto entregas`}
                              value={montoPagaCon}
                              onChange={(e) => setMontoPagaCon(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-700 text-slate-100 rounded-xl pl-10 pr-3 py-2 text-xs font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                            />
                          </div>

                          {/* Quick Chips for change */}
                          <div className="flex flex-wrap items-center gap-1.5 pt-1">
                            <button
                              type="button"
                              onClick={() => setMontoPagaCon(cartTotal.toLocaleString())}
                              className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded-lg border border-slate-700 font-mono transition-colors"
                            >
                              Monto Exacto (Gs. {cartTotal.toLocaleString()})
                            </button>
                            {cartTotal <= 50000 && (
                              <button
                                type="button"
                                onClick={() => setMontoPagaCon('50.000')}
                                className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded-lg border border-slate-700 font-mono transition-colors"
                              >
                                Gs. 50.000
                              </button>
                            )}
                            {cartTotal <= 100000 && (
                              <button
                                type="button"
                                onClick={() => setMontoPagaCon('100.000')}
                                className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded-lg border border-slate-700 font-mono transition-colors"
                              >
                                Gs. 100.000
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setMontoPagaCon('200.000')}
                              className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded-lg border border-slate-700 font-mono transition-colors"
                            >
                              Gs. 200.000
                            </button>
                          </div>
                        </div>
                      )}

                      {/* DETALLE OPCIÓN 2: TRANSFERENCIA BANCARIA */}
                      {metodoPago === 'transferencia' && (
                        <div className="bg-indigo-950/40 p-3 rounded-xl border border-indigo-500/40 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-indigo-200 flex items-center gap-1.5">
                              <Landmark className="w-3.5 h-3.5 text-indigo-400" />
                              Datos Bancarios Oficiales:
                            </span>
                            <button
                              type="button"
                              onClick={handleCopyBankData}
                              className="text-[10px] bg-indigo-500/20 hover:bg-indigo-500 text-indigo-300 hover:text-slate-950 font-bold px-2 py-1 rounded-lg border border-indigo-500/40 flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              {copiedBankInfo ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                              <span>{copiedBankInfo ? '¡Copiado!' : 'Copiar Datos'}</span>
                            </button>
                          </div>

                          <div className="bg-slate-950/80 p-2.5 rounded-lg border border-indigo-900/50 text-[11px] font-mono space-y-1 text-slate-300">
                            <div><span className="text-slate-400">Banco:</span> <strong className="text-slate-100">Banco Continental / Itaú</strong></div>
                            <div><span className="text-slate-400">Titular:</span> <strong className="text-slate-100">EL TERNERO S.R.L.</strong></div>
                            <div><span className="text-slate-400">RUC:</span> <strong className="text-slate-100">80012345-6</strong></div>
                            <div><span className="text-slate-400">N° Cuenta:</span> <strong className="text-indigo-400 font-bold">720198421</strong></div>
                            <div><span className="text-slate-400">Alias SIPAP:</span> <strong className="text-emerald-400 font-bold">elternero.py</strong></div>
                            <div className="pt-1 border-t border-slate-800 flex justify-between">
                              <span className="text-slate-400">Total a Transferir:</span>
                              <strong className="text-emerald-400 font-bold">Gs. {cartTotal.toLocaleString()}</strong>
                            </div>
                          </div>

                          {/* ADJUNTAR COMPROBANTE DE TRANSFERENCIA */}
                          <div className="space-y-2 pt-1 border-t border-indigo-500/20">
                            <div className="flex items-center justify-between">
                              <label className="text-[11px] font-bold text-slate-100 flex items-center gap-1.5">
                                <Upload className="w-3.5 h-3.5 text-indigo-400" />
                                <span>Adjuntar Comprobante de Transferencia:</span>
                              </label>
                              {comprobanteUrl && (
                                <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                                  <CheckCircle className="w-3 h-3" />
                                  Adjuntado
                                </span>
                              )}
                            </div>

                            <input
                              type="file"
                              ref={fileInputRef}
                              accept="image/*,application/pdf"
                              onChange={handleComprobanteFileChange}
                              className="hidden"
                            />

                            {comprobanteUrl ? (
                              <div className="bg-slate-900 p-2.5 rounded-xl border border-emerald-500/50 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <img
                                    src={comprobanteUrl}
                                    alt="Comprobante"
                                    onClick={() => setPreviewComprobanteModal(comprobanteUrl)}
                                    className="w-12 h-12 object-cover rounded-lg border border-emerald-500/40 cursor-pointer hover:opacity-80 transition-opacity shrink-0"
                                  />
                                  <div className="min-w-0">
                                    <p className="text-xs font-bold text-slate-100 truncate">{comprobanteNombre || 'Comprobante_Transferencia.jpg'}</p>
                                    <p className="text-[10px] text-emerald-400 font-medium">✓ Listo para verificación de admin</p>
                                    <button
                                      type="button"
                                      onClick={() => setPreviewComprobanteModal(comprobanteUrl)}
                                      className="text-[10px] text-indigo-400 hover:underline font-bold mt-0.5 inline-block"
                                    >
                                      👁️ Toca para ver comprobante
                                    </button>
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={handleRemoveComprobante}
                                  className="text-rose-400 hover:text-rose-300 p-1.5 rounded-lg hover:bg-rose-950/50 transition-colors shrink-0"
                                  title="Quitar comprobante"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full bg-slate-900/90 hover:bg-slate-900 border-2 border-dashed border-indigo-500/50 hover:border-indigo-400 text-indigo-300 hover:text-indigo-200 rounded-xl p-3.5 text-center transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer active:scale-98"
                              >
                                <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                                  <Upload className="w-4 h-4" />
                                </div>
                                <span className="text-xs font-bold">Subir foto o captura del comprobante</span>
                                <span className="text-[10px] text-slate-400">Formatos permitidos: JPG, PNG, PDF (Máx. 8MB)</span>
                              </button>
                            )}

                            {comprobanteError && (
                              <p className="text-[11px] text-rose-400 font-medium flex items-center gap-1 bg-rose-950/40 p-2 rounded-lg border border-rose-500/30">
                                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                <span>{comprobanteError}</span>
                              </p>
                            )}

                            <p className="text-[10px] text-slate-400 italic">
                              🛡️ El administrador revisará tu comprobante antes de aceptar tu pedido.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* DETALLE OPCIÓN 3: GOOGLE PAY */}
                      {metodoPago === 'gpay' && (
                        <div className="bg-gradient-to-b from-sky-950/40 to-slate-950 p-3.5 rounded-2xl border border-sky-500/40 space-y-3 shadow-lg">
                          <div className="flex items-center gap-2.5">
                            <div className="w-10 h-10 rounded-xl bg-slate-900 border border-sky-500/40 flex items-center justify-center font-bold text-xs shrink-0 shadow-inner">
                              <CreditCard className="w-5 h-5 text-sky-400" />
                            </div>
                            <div>
                              <h5 className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                                <span>Pago Digital con Google Pay</span>
                                <span className="text-[9px] bg-sky-500/20 text-sky-300 px-1.5 py-0.5 rounded font-mono font-bold">Oficial</span>
                              </h5>
                              <p className="text-[10px] text-slate-400">
                                Paga con las tarjetas asociadas a tu cuenta de Google de manera segura y sin contacto.
                              </p>
                            </div>
                          </div>

                          <div className="bg-slate-950/90 p-3 rounded-xl border border-slate-800 space-y-1.5">
                            <div className="flex items-center justify-between text-xs font-mono">
                              <span className="text-slate-400">Total a Pagar:</span>
                              <span className="font-bold text-emerald-400 text-sm">Gs. {cartTotal.toLocaleString()}</span>
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono pt-1 border-t border-slate-900">
                              <span>Equivalente Aprox.:</span>
                              <span>USD ${(cartTotal / 7500).toFixed(2)}</span>
                            </div>
                          </div>

                          {/* BOTÓN OFICIAL DE GOOGLE PAY */}
                          <div className="pt-1 flex flex-col items-center justify-center space-y-2">
                            <div className="w-full flex justify-center min-h-[48px] rounded-xl overflow-hidden shadow-md">
                              <GooglePayButtonWrapper
                                cartTotal={cartTotal}
                                restaurantName={restauranteConfig?.nombre || 'EL TERNERO'}
                                onPaymentSuccess={(authInfo) => {
                                  processOrderCreation('gpay', authInfo);
                                }}
                              />
                            </div>

                            <p className="text-[10px] text-slate-400 text-center flex items-center justify-center gap-1">
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Transacción cifrada y protegida por Google Security</span>
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className={`w-full font-bold py-3 rounded-xl shadow-lg flex items-center justify-center gap-2 text-xs transition-all cursor-pointer ${
                        metodoPago === 'gpay'
                          ? 'bg-sky-500 hover:bg-sky-400 text-slate-950 shadow-sky-500/20'
                          : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20'
                      }`}
                    >
                      {isSubmitting ? (
                        'Procesando Pedido...'
                      ) : (
                        <>
                          <span>
                            {metodoPago === 'gpay' ? 'Confirmar Pedido con Google Pay' : 'Confirmar y Rastrear Delivery'}
                          </span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
        </div>
      )}

      {/* SUB-TAB 2: REAL-TIME GPS TRACKING & ORDER HISTORY DASHBOARD */}
      {subTab === 'rastreo' && (
        <div className="space-y-6">
          {/* Inner Navigation Switch: Active Orders vs Order History */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setTrackingViewMode('activos')}
                className={`px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer active:scale-95 ${
                  trackingViewMode === 'activos'
                    ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                    : 'text-slate-300 hover:text-slate-100 hover:bg-slate-800'
                }`}
              >
                <Radio className={`w-4 h-4 ${activePedidos.length > 0 ? 'animate-pulse text-slate-950' : ''}`} />
                <span>Pedidos en Curso</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-black border ${
                  trackingViewMode === 'activos'
                    ? 'bg-slate-950 text-emerald-400 border-emerald-400/40'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}>
                  {activePedidos.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setTrackingViewMode('historial')}
                className={`px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer active:scale-95 ${
                  trackingViewMode === 'historial'
                    ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                    : 'text-slate-300 hover:text-slate-100 hover:bg-slate-800'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Historial de Pedidos</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-black border ${
                  trackingViewMode === 'historial'
                    ? 'bg-slate-950 text-emerald-400 border-emerald-400/40'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}>
                  {historialPedidos.length}
                </span>
              </button>
            </div>

            {/* Select Order Dropdown if multiple in current view */}
            {currentPedidoList.length > 1 && (
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[11px] font-bold text-slate-400 hidden sm:inline">Seleccionar:</span>
                <select
                  value={selectedPedidoId}
                  onChange={(e) => setSelectedPedidoId(e.target.value)}
                  className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {currentPedidoList.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.id} - Gs. {p.total?.toLocaleString('es-PY') || '0'} ({p.estado})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* VIEW MODE 1: ACTIVE ORDERS IN PROGRESS */}
          {trackingViewMode === 'activos' && (
            <div className="space-y-6">
              {!currentPedido || currentPedido.estado === 'entregado' ? (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 sm:p-12 text-center text-slate-400 space-y-4 shadow-xl">
                  <div className="w-16 h-16 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto text-slate-500">
                    <Package className="w-8 h-8" />
                  </div>
                  <div>
                    <p className="text-base font-bold text-slate-200">No tienes pedidos en curso en este momento.</p>
                    <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                      Cuando realices una compra desde el <strong>Catálogo</strong>, tu pedido aparecerá aquí en tiempo real con seguimiento GPS en vivo.
                    </p>
                  </div>

                  {/* Order code search bar */}
                  <div className="max-w-md mx-auto pt-2">
                    <form onSubmit={handleSearchOrderCode} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="¿Tienes un código de pedido? Ej. PED-1234"
                        value={searchCodeInput}
                        onChange={(e) => setSearchCodeInput(e.target.value)}
                        className="flex-1 bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-xl px-3.5 py-2.5 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                      <button
                        type="submit"
                        className="bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold px-4 py-2.5 rounded-xl text-xs border border-slate-700 transition-colors cursor-pointer"
                      >
                        Buscar
                      </button>
                    </form>
                    {searchError && (
                      <p className="text-[11px] text-rose-400 mt-2 font-semibold">{searchError}</p>
                    )}
                  </div>

                  <div className="pt-3 flex flex-col sm:flex-row items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => setSubTab('catalogo')}
                      className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold px-5 py-2.5 rounded-xl text-xs inline-flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
                    >
                      <Package className="w-4 h-4" />
                      Ir al Catálogo de Productos
                    </button>

                    {historialPedidos.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setTrackingViewMode('historial')}
                        className="w-full sm:w-auto bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold px-5 py-2.5 rounded-xl text-xs inline-flex items-center justify-center gap-2 border border-slate-700 transition-all cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Ver Historial de Pedidos Entregados ({historialPedidos.length})
                      </button>
                    )}
                  </div>
                </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Live Map & Status Bar */}
              <div className="lg:col-span-8 space-y-6">
                {/* Map */}
                <InteractiveMap
                  pedidos={[currentPedido]}
                  repartidores={repartidores}
                  selectedPedidoId={currentPedido.id}
                  assignedDriverIdOnly={currentPedido.repartidorId}
                  isAdmin={false}
                  logoUrl={activeLogo}
                  customBannerText="🏠 TOCA EL MAPA O 'MI GPS REAL' PARA FIJAR TU PIN"
                  customClientPin={{
                    lat: currentPedido.latitudCliente,
                    lon: currentPedido.longitudCliente,
                    nombre: 'MI UBICACIÓN DE ENTREGA',
                  }}
                  customStorePin={{
                    lat: currentPedido.latitudRestaurante || -25.1747,
                    lon: currentPedido.longitudRestaurante || -57.48334,
                    nombre: currentPedido.restauranteNombre || 'EL TERNERO',
                  }}
                  onMapClickCoordinates={(lat, lon) => {
                    updateLocationAndAddress(lat, lon);
                  }}
                />

                {/* Status Tracker Bar */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                  {currentPedido.estado === 'rechazado' ? (
                    <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 p-4 rounded-xl flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0 font-bold">
                        ✕
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-rose-200">Pedido Rechazado por la Administración</h4>
                        <p className="text-xs text-rose-300/80">
                          Lo sentimos, tu pedido no ha podido ser procesado en este momento. Si tienes dudas, comunícate con soporte.
                        </p>
                      </div>
                    </div>
                  ) : currentPedido.estado === 'recibido' ? (
                    <div className="bg-emerald-500/10 border border-emerald-500/40 text-emerald-300 p-4 rounded-xl mb-4 flex items-center gap-3 shadow-lg shadow-emerald-500/5">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 font-bold">
                        <Loader2 className="w-5 h-5 text-emerald-400 animate-spin" />
                      </div>
                      <div>
                        <h4 className="font-extrabold text-sm text-emerald-200 flex items-center gap-2">
                          <span>⏳ Pedido Pendiente de Aceptación</span>
                        </h4>
                        <p className="text-xs text-emerald-300/90 leading-relaxed mt-0.5">
                          Tu pedido está siendo revisado.
                        </p>
                      </div>
                    </div>
                  ) : currentPedido.estado === 'aceptado' ? (
                    <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 p-4 rounded-xl mb-4 flex items-center gap-3 shadow-lg shadow-emerald-500/5">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 font-bold">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      </div>
                      <div>
                        <h4 className="font-extrabold text-sm text-emerald-200">
                          ¡Pedido Confirmado por la Administración!
                        </h4>
                        <p className="text-xs text-emerald-300/90 leading-relaxed mt-0.5">
                          ¡Excelente! Tu pedido ha sido <strong>ACEPTADO Y CONFIRMADO</strong> por el administrador.
                        </p>
                      </div>
                    </div>
                  ) : null}

                  <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-6 flex items-center gap-2">
                    <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
                    Estado del Envío en Tiempo Real
                  </h3>

                  <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    {steps.map((step) => {
                      const status = getStepStatus(step.id);
                      const StepIcon = step.icon;

                      return (
                        <div key={step.id} className="flex-1 flex md:flex-col items-center gap-3 w-full">
                          <div
                            className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all ${
                              status === 'completed'
                                ? 'bg-emerald-500 text-slate-950 font-bold shadow-lg shadow-emerald-500/20'
                                : status === 'current'
                                ? 'bg-emerald-500 text-slate-950 font-bold animate-bounce shadow-lg shadow-emerald-500/30 ring-4 ring-emerald-500/20'
                                : 'bg-slate-800 text-slate-500 border border-slate-700'
                            }`}
                          >
                            <StepIcon className="w-5 h-5" />
                          </div>
                          <div className="md:text-center">
                            <p
                              className={`text-xs font-semibold ${
                                status === 'current'
                                  ? 'text-emerald-400 font-bold'
                                  : status === 'completed'
                                  ? 'text-emerald-400'
                                  : 'text-slate-500'
                              }`}
                            >
                              {step.label}
                            </p>
                            {status === 'current' && (
                              <p className="text-[11px] text-emerald-300/80 mt-0.5 animate-pulse">
                                En progreso...
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Right Column: AI Instruction & Delivery Card */}
              <div className="lg:col-span-4 space-y-6">
                {/* Live ETA Card */}
                <div className="bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-800/40 rounded-2xl p-5 shadow-xl">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Zap className="w-4 h-4 text-emerald-400" />
                      Estimación de Llegada
                    </span>
                    <span className="text-xs font-mono text-slate-400">Distancia: {distanceKm} km</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-extrabold text-slate-100 font-mono">
                      {(currentPedido.estado as string) === 'entregado' ? '0' : estimatedMin}
                    </span>
                    <span className="text-lg font-medium text-emerald-400">
                      {(currentPedido.estado as string) === 'entregado' ? '¡Entregado!' : 'minutos'}
                    </span>
                  </div>
                  {lastGpsUpdate && lastGpsUpdate.pedidoId === currentPedido.id && (
                    <p className="text-[11px] text-emerald-300/80 font-mono mt-2 bg-emerald-900/30 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                      GPS actualizado {new Date(lastGpsUpdate.timestamp).toLocaleTimeString()}
                    </p>
                  )}
                </div>

                {/* Detalles del Pedido escrito por el Administrador */}
                <div className="bg-gradient-to-br from-indigo-950/50 via-slate-900 to-slate-900 border border-indigo-800/50 rounded-2xl p-5 shadow-xl relative overflow-hidden">
                  <div className="absolute -top-10 -right-10 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
                  <div className="flex items-center gap-2 text-indigo-300 font-semibold text-xs tracking-wider uppercase mb-3">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    DETALLES DEL PEDIDO
                  </div>

                  <div className="bg-slate-950/80 border border-indigo-500/30 rounded-xl p-3.5 space-y-2">
                    <p className="text-sm font-medium text-indigo-100 leading-relaxed font-sans">
                      "{currentPedido.detallesPedido || currentPedido.instruccionOptimizada || currentPedido.notaCliente}"
                    </p>
                    <div className="flex items-center justify-between text-[11px] text-indigo-300/70 pt-2 border-t border-indigo-900/40">
                      <span>Confirmado por Administrador</span>
                      <span className="font-mono text-emerald-400 font-bold">✓ Verificado</span>
                    </div>
                  </div>

                  <div className="mt-3 text-xs text-slate-400 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                    <span className="font-semibold text-slate-300">Nota original del cliente:</span>
                    <p className="text-slate-400 italic text-[12px] mt-0.5">{currentPedido.notaCliente}</p>
                  </div>
                </div>

                {/* Driver Info Card */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <User className="w-4 h-4 text-slate-400" />
                    Repartidor Asignado
                  </h4>

                  {currentRepartidor ? (
                    <div className="flex items-center justify-between bg-slate-800/50 p-3.5 rounded-xl border border-slate-700/60">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-full bg-emerald-500/10 border border-emerald-500/40 flex items-center justify-center p-1.5 shrink-0 shadow-md shadow-emerald-500/10">
                          <img src="/scooter.svg" className="w-8 h-8 object-contain" alt="Repartidor" />
                        </div>
                        <div>
                          <h5 className="text-sm font-bold text-slate-100">{currentRepartidor.nombre}</h5>
                          <p className="text-xs text-slate-400 capitalize">
                            {currentRepartidor.vehiculo} • ID: {currentRepartidor.id}
                          </p>
                        </div>
                      </div>

                      <a
                        href={`tel:${currentRepartidor.telefono}`}
                        className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold p-2.5 rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-lg shadow-emerald-600/20"
                      >
                        <Phone className="w-4 h-4" />
                        <span className="hidden sm:inline">Llamar</span>
                      </a>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">Asignando repartidor...</p>
                  )}
                </div>

                {/* Order Detail Items */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4 text-slate-400" />
                    Resumen del Pedido
                  </h4>

                  <ul className="divide-y divide-slate-800 text-xs text-slate-300">
                    {currentPedido.items.map((item, index) => (
                      <li key={index} className="py-2 flex items-center justify-between">
                        <span>{item}</span>
                        <span className="text-emerald-400 font-mono">Incluido</span>
                      </li>
                    ))}
                  </ul>

                  {/* Información del Pago */}
                  <div className="pt-2 border-t border-slate-800 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 flex items-center gap-1">
                        <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
                        Método de Pago:
                      </span>
                      <span className="font-bold text-slate-200 uppercase tracking-wider">
                        {currentPedido.metodoPago === 'transferencia'
                          ? '🏦 Transferencia Bancaria'
                          : currentPedido.metodoPago === 'gpay'
                          ? '💳 Google Pay (Digital)'
                          : '💵 Efectivo (Contra Entrega)'}
                      </span>
                    </div>

                    {currentPedido.metodoPago === 'efectivo' && currentPedido.montoPagaCon && (
                      <div className="bg-slate-950 p-2 rounded-xl border border-slate-800 flex items-center justify-between text-[11px] font-mono">
                        <span className="text-slate-400">Pagas con: Gs. {currentPedido.montoPagaCon.toLocaleString()}</span>
                        {currentPedido.montoPagaCon > currentPedido.total && (
                          <span className="text-emerald-400 font-bold">
                            Vuelto: Gs. {(currentPedido.montoPagaCon - currentPedido.total).toLocaleString()}
                          </span>
                        )}
                      </div>
                    )}

                    {currentPedido.metodoPago === 'transferencia' && (
                      <div className="bg-indigo-950/40 p-2.5 rounded-xl border border-indigo-500/30 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-indigo-300 font-medium">Estado Comprobante:</span>
                          {currentPedido.comprobanteRevisado ? (
                            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" />
                              Verificado por Admin
                            </span>
                          ) : (
                            <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full font-bold flex items-center gap-1 animate-pulse">
                              <Clock className="w-3 h-3" />
                              En Revisión por Admin
                            </span>
                          )}
                        </div>

                        {currentPedido.comprobanteUrl && (
                          <button
                            type="button"
                            onClick={() => setPreviewComprobanteModal(currentPedido.comprobanteUrl || '')}
                            className="w-full bg-slate-900 hover:bg-slate-800 border border-indigo-500/40 text-indigo-300 hover:text-indigo-200 text-[11px] font-bold py-1.5 px-3 rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer"
                          >
                            <ImageIcon className="w-3.5 h-3.5" />
                            <span>Ver Comprobante Adjuntado</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-sm font-bold text-slate-100 font-mono">
                    <span>Total A Cobrar:</span>
                    <span className="text-emerald-400 text-base">Gs. {currentPedido.total.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
            </div>
          )}

          {/* VIEW MODE 2: HISTORIAL DE PEDIDOS ENTREGADOS Y COMPLETADOS */}
          {trackingViewMode === 'historial' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  Historial de Pedidos Entregados ({historialPedidos.length})
                </h3>
              </div>

              {historialPedidos.length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-3 shadow-xl">
                  <div className="w-14 h-14 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto text-slate-500">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-200">Aún no tienes pedidos completados en tu historial.</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Una vez que recibas un pedido entregado, quedará registrado aquí con el detalle de tus compras y la opción de volver a pedir con un clic.
                    </p>
                  </div>
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setSubTab('catalogo')}
                      className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold px-4 py-2 rounded-xl text-xs inline-flex items-center gap-2 shadow-md cursor-pointer"
                    >
                      <Package className="w-4 h-4" />
                      Ir al Catálogo de Productos
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {historialPedidos.map((p) => {
                    const isDelivered = p.estado === 'entregado';
                    return (
                      <div
                        key={p.id}
                        className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 shadow-xl space-y-4 transition-all"
                      >
                        <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3">
                          <div>
                            <span className="text-[10px] font-mono text-slate-400 font-bold block">
                              CÓDIGO: #{p.id}
                            </span>
                            <h4 className="text-sm font-black text-slate-100 mt-0.5">
                              {p.cliente}
                            </h4>
                            <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                              <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                              <span className="truncate">{p.direccionCliente || 'Sin dirección'}</span>
                            </p>
                          </div>
                          <span
                            className={`px-3 py-1 rounded-full text-[10px] font-mono font-black border uppercase tracking-wider shrink-0 ${
                              isDelivered
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                            }`}
                          >
                            {isDelivered ? '🎉 Entregado' : '✕ Cancelado'}
                          </span>
                        </div>

                        {/* Items summary */}
                        <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800/80 space-y-1.5 text-xs">
                          <span className="text-[10px] uppercase font-extrabold text-slate-400 block mb-1">
                            Detalle de productos:
                          </span>
                          {p.items && p.items.length > 0 ? (
                            p.items.map((item, i) => (
                              <p key={i} className="text-slate-200 font-medium truncate">
                                • {item}
                              </p>
                            ))
                          ) : (
                            <p className="text-slate-400 italic">Detalle de productos no disponible</p>
                          )}
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <div>
                            <span className="text-[10px] text-slate-400 uppercase font-bold block">Total Pagado:</span>
                            <span className="text-base font-extrabold text-emerald-400 font-mono">
                              Gs. {p.total?.toLocaleString('es-PY') || '0'}
                            </span>
                          </div>

                          {/* Re-order / Repeat order button */}
                          <button
                            type="button"
                            onClick={() => handleRepeatOrder(p)}
                            className="px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-300 hover:text-slate-950 border border-emerald-500/40 hover:border-emerald-400 rounded-xl text-xs font-black transition-all active:scale-95 flex items-center gap-2 cursor-pointer shadow-sm"
                          >
                            <ShoppingBag className="w-3.5 h-3.5" />
                            <span>Volver a Pedir</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* MODAL INGRESAR AL PRODUCTO */}
      {productForModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl relative space-y-0 my-8">
            {/* Header Image */}
            <div className="relative h-64 w-full bg-slate-950">
              <img
                src={productForModal.fotoUrl}
                alt={productForModal.nombre}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&auto=format&fit=crop&q=80';
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent" />
              
              <button
                onClick={() => setProductForModal(null)}
                className="absolute top-4 right-4 bg-slate-950/80 hover:bg-slate-800 text-slate-200 p-2 rounded-full backdrop-blur-md border border-slate-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="absolute bottom-4 left-5 right-5 space-y-1">
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  {productForModal.categoria || 'General'}
                </span>
                <h3 className="text-xl font-extrabold text-slate-100">
                  {productForModal.nombre}
                </h3>
                <p className="text-base font-mono font-extrabold text-emerald-400">
                  Gs. {productForModal.monto.toLocaleString()}
                </p>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {productForModal.descripcion && (
                <div className="space-y-1">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Descripción / Detalles:
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                    {productForModal.descripcion}
                  </p>
                </div>
              )}

              {/* Quantity Selection */}
              <div className="space-y-4 bg-slate-950/80 p-4 sm:p-5 rounded-2xl border border-slate-800 shadow-inner">
                <div className="flex items-center justify-between">
                  <span className="text-xs sm:text-sm font-extrabold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                    <Package className="w-4 h-4 text-emerald-400" />
                    <span>Cantidad a pedir:</span>
                  </span>
                  <span className="text-sm sm:text-base font-mono font-black text-emerald-400 bg-emerald-950/60 px-3 py-1 rounded-xl border border-emerald-500/30">
                    Gs. {(productForModal.monto * modalQty).toLocaleString()}
                  </span>
                </div>

                {/* Large Centered Touch Stepper */}
                <div className="flex items-center justify-center gap-4 py-2">
                  <button
                    type="button"
                    onClick={() => setModalQty((q) => Math.max(1, q - 1))}
                    disabled={modalQty <= 1}
                    className="h-14 w-14 rounded-2xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-emerald-400 disabled:text-slate-600 font-black text-2xl flex items-center justify-center border-2 border-slate-700 active:scale-95 transition-all touch-manipulation shadow-lg shrink-0"
                    title="Restar 1 unidad"
                  >
                    <Minus className="w-6 h-6 stroke-[3]" />
                  </button>

                  <div className="flex flex-col items-center justify-center px-6 py-2 bg-slate-900 border-2 border-emerald-500/50 rounded-2xl shadow-xl min-w-[100px]">
                    <span className="text-3xl font-black font-mono text-emerald-400">{modalQty}</span>
                    <span className="text-[10px] uppercase tracking-widest font-extrabold text-slate-400">Unidades</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setModalQty((q) => Math.min(5, q + 1))}
                    disabled={modalQty >= 5}
                    className="h-14 w-14 rounded-2xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-emerald-400 disabled:text-slate-600 font-black text-2xl flex items-center justify-center border-2 border-slate-700 active:scale-95 transition-all touch-manipulation shadow-lg shrink-0"
                    title="Sumar 1 unidad (Máx 5)"
                  >
                    <Plus className="w-6 h-6 stroke-[3]" />
                  </button>
                </div>

                {/* Quick Preset Buttons 1 to 5 */}
                <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block text-center">
                    O toca directamente el número de unidades:
                  </span>
                  <div className="grid grid-cols-5 gap-1.5">
                    {[1, 2, 3, 4, 5].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setModalQty(num)}
                        className={`h-11 rounded-xl text-xs sm:text-sm font-mono font-extrabold transition-all duration-150 touch-manipulation active:scale-95 flex items-center justify-center ${
                          modalQty === num
                            ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/40 border-2 border-emerald-300 ring-2 ring-emerald-400 scale-[1.03]'
                            : 'bg-slate-900 text-slate-200 hover:bg-slate-800 border border-slate-700'
                        }`}
                      >
                        {num} u.
                      </button>
                    ))}
                  </div>
                </div>

                {modalQty >= 5 && (
                  <p className="text-[11px] text-emerald-400 font-semibold text-center">
                    ⚠️ Límite máximo de 5 unidades por producto.
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setProductForModal(null)}
                  className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-2xl text-xs transition-colors"
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleSelectQuantityBtn(productForModal, modalQty);
                    setProductForModal(null);
                  }}
                  className="flex-[2] py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold rounded-2xl text-xs shadow-xl shadow-emerald-500/20 transition-all flex items-center justify-center gap-2"
                >
                  <ShoppingCart className="w-4 h-4" />
                  AGREGAR AL CARRITO (Gs. {(productForModal.monto * modalQty).toLocaleString()})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ARMAR PIZZA MITAD Y MITAD (2 SABORES) */}
      {showHalfPizzaModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl relative space-y-0 my-4 sm:my-8">
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-950/90 via-slate-900 to-slate-950 p-4 sm:p-5 border-b border-slate-800 relative">
              <button
                type="button"
                onClick={() => setShowHalfPizzaModal(false)}
                className="absolute top-4 right-4 bg-slate-950/80 hover:bg-slate-800 text-slate-300 p-2 rounded-full backdrop-blur-md border border-slate-700 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-emerald-400 text-slate-950 flex items-center justify-center text-2xl font-black shadow-lg shadow-emerald-500/30 shrink-0">
                  🍕
                </div>
                <div>
                  <span className="text-[10px] font-mono font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                    Combinación de 2 Sabores
                  </span>
                  <h3 className="text-lg sm:text-xl font-black text-slate-100">
                    Armar Pizza Mitad y Mitad
                  </h3>
                  <p className="text-xs text-slate-300">
                    Selecciona de forma interactiva el sabor para cada mitad de tu pizza artesanal.
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 space-y-5 text-xs max-h-[80vh] overflow-y-auto">
              
              {/* LIVE PIZZA SPLIT PREVIEW & ACTIVE HALF SWITCHER TABS */}
              <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 space-y-4">
                <div className="flex items-center justify-between text-slate-300 text-xs font-bold uppercase tracking-wider">
                  <span>Selección Actual de Sabores:</span>
                  <span className="text-[11px] text-emerald-400 font-normal">Toca para cambiar la mitad activa</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* TAB MITAD 1 */}
                  <button
                    type="button"
                    onClick={() => setActiveEditingHalf(1)}
                    className={`p-3.5 rounded-2xl border transition-all text-left flex items-center gap-3 relative cursor-pointer ${
                      activeEditingHalf === 1
                        ? 'bg-emerald-500/15 border-emerald-500 ring-2 ring-emerald-500/40 shadow-lg shadow-emerald-500/10'
                        : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="relative shrink-0">
                      {halfFlavor1 ? (
                        <img
                          src={halfFlavor1.fotoUrl}
                          alt={halfFlavor1.nombre}
                          className="w-12 h-12 rounded-xl object-cover border border-slate-700"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=200&auto=format&fit=crop&q=80';
                          }}
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-xl text-slate-500">
                          🍕
                        </div>
                      )}
                      <span className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-emerald-500 text-slate-950 font-black text-[10px] flex items-center justify-center border-2 border-slate-900">
                        1
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] font-mono uppercase text-emerald-400 font-black block">
                        Primera Mitad (Izquierda)
                      </span>
                      <p className="font-extrabold text-slate-100 text-xs truncate">
                        {halfFlavor1 ? halfFlavor1.nombre : 'Elija un sabor...'}
                      </p>
                      {halfFlavor1 && (
                        <span className="text-[10px] font-mono text-slate-300 font-semibold">
                          Gs. {halfFlavor1.monto.toLocaleString()}
                        </span>
                      )}
                    </div>

                    {activeEditingHalf === 1 && (
                      <span className="absolute top-2 right-2 text-[9px] bg-emerald-500 text-slate-950 font-black px-2 py-0.5 rounded-full uppercase">
                        Editando
                      </span>
                    )}
                  </button>

                  {/* TAB MITAD 2 */}
                  <button
                    type="button"
                    onClick={() => setActiveEditingHalf(2)}
                    className={`p-3.5 rounded-2xl border transition-all text-left flex items-center gap-3 relative cursor-pointer ${
                      activeEditingHalf === 2
                        ? 'bg-emerald-500/15 border-emerald-500 ring-2 ring-emerald-500/40 shadow-lg shadow-emerald-500/10'
                        : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="relative shrink-0">
                      {halfFlavor2 ? (
                        <img
                          src={halfFlavor2.fotoUrl}
                          alt={halfFlavor2.nombre}
                          className="w-12 h-12 rounded-xl object-cover border border-slate-700"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=200&auto=format&fit=crop&q=80';
                          }}
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-xl text-slate-500">
                          🍕
                        </div>
                      )}
                      <span className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-emerald-500 text-slate-950 font-black text-[10px] flex items-center justify-center border-2 border-slate-900">
                        2
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] font-mono uppercase text-emerald-400 font-black block">
                        Segunda Mitad (Derecha)
                      </span>
                      <p className="font-extrabold text-slate-100 text-xs truncate">
                        {halfFlavor2 ? halfFlavor2.nombre : 'Elija un sabor...'}
                      </p>
                      {halfFlavor2 && (
                        <span className="text-[10px] font-mono text-slate-300 font-semibold">
                          Gs. {halfFlavor2.monto.toLocaleString()}
                        </span>
                      )}
                    </div>

                    {activeEditingHalf === 2 && (
                      <span className="absolute top-2 right-2 text-[9px] bg-emerald-500 text-slate-950 font-black px-2 py-0.5 rounded-full uppercase">
                        Editando
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {/* FLAVOR SEARCH BAR & HEAVY VISUAL PICKER HEADER */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="font-extrabold text-slate-200 text-xs flex items-center gap-2 uppercase tracking-wider">
                    <span>Elegir sabor para:</span>
                    <span className="bg-emerald-500 text-slate-950 font-black px-2.5 py-0.5 rounded-lg text-xs">
                      Mitad {activeEditingHalf} ({activeEditingHalf === 1 ? 'Primera' : 'Segunda'})
                    </span>
                  </span>

                  {/* Search input */}
                  <div className="relative min-w-[220px]">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={flavorSearchQuery}
                      onChange={(e) => setFlavorSearchQuery(e.target.value)}
                      placeholder="Buscar sabor o ingrediente..."
                      className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    {flavorSearchQuery && (
                      <button
                        onClick={() => setFlavorSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* VISUAL FLAVORS GRID GALLERY */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[280px] overflow-y-auto pr-1 custom-scrollbar">
                  {availablePizzaOptions
                    .filter((p) => {
                      if (!flavorSearchQuery.trim()) return true;
                      const q = flavorSearchQuery.toLowerCase();
                      return (
                        p.nombre.toLowerCase().includes(q) ||
                        (p.descripcion || '').toLowerCase().includes(q)
                      );
                    })
                    .map((p) => {
                      const isSelectedForHalf1 = halfFlavor1?.id === p.id;
                      const isSelectedForHalf2 = halfFlavor2?.id === p.id;
                      const isCurrentlyActiveHalf =
                        (activeEditingHalf === 1 && isSelectedForHalf1) ||
                        (activeEditingHalf === 2 && isSelectedForHalf2);

                      return (
                        <div
                          key={`pizza-card-${p.id}`}
                          className={`bg-slate-950 border rounded-2xl p-3 flex gap-3 transition-all relative overflow-hidden group ${
                            isCurrentlyActiveHalf
                              ? 'border-emerald-500 ring-2 ring-emerald-500/30 bg-slate-900/90 shadow-lg'
                              : isSelectedForHalf1 || isSelectedForHalf2
                              ? 'border-emerald-500/50 bg-slate-900/50'
                              : 'border-slate-800 hover:border-slate-700 bg-slate-950/80 hover:bg-slate-900/60'
                          }`}
                        >
                          <img
                            src={p.fotoUrl}
                            alt={p.nombre}
                            className="w-20 h-20 rounded-xl object-cover shrink-0 border border-slate-800 group-hover:scale-105 transition-transform"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=200&auto=format&fit=crop&q=80';
                            }}
                          />

                          <div className="min-w-0 flex-1 flex flex-col justify-between">
                            <div>
                              <div className="flex items-start justify-between gap-1">
                                <h4 className="font-extrabold text-slate-100 text-xs truncate">
                                  {p.nombre}
                                </h4>
                              </div>
                              <p className="text-[10px] text-slate-400 line-clamp-2 mt-0.5 leading-tight">
                                {p.descripcion || 'Pizza con ingredientes de alta calidad.'}
                              </p>
                            </div>

                            <div className="mt-2 flex items-center justify-between gap-1">
                              <span className="font-mono font-black text-emerald-400 text-xs">
                                Gs. {p.monto.toLocaleString()}
                              </span>

                              {/* Selection Actions */}
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setHalfFlavor1(p);
                                    if (!halfFlavor2) {
                                      setActiveEditingHalf(2);
                                    }
                                  }}
                                  className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                                    isSelectedForHalf1
                                      ? 'bg-emerald-500 text-slate-950 shadow-sm'
                                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                                  }`}
                                  title="Asignar como Mitad 1"
                                >
                                  {isSelectedForHalf1 ? '✓ Mitad 1' : '+ M1'}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setHalfFlavor2(p);
                                    if (!halfFlavor1) {
                                      setActiveEditingHalf(1);
                                    }
                                  }}
                                  className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                                    isSelectedForHalf2
                                      ? 'bg-emerald-500 text-slate-950 shadow-sm'
                                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                                  }`}
                                  title="Asignar como Mitad 2"
                                >
                                  {isSelectedForHalf2 ? '✓ Mitad 2' : '+ M2'}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* DYNAMIC PRICE DISPLAY & EXPLANATION BADGE */}
              <div className="bg-gradient-to-r from-emerald-950/60 via-slate-950 to-slate-950 p-4 rounded-2xl border-2 border-emerald-500/40 space-y-1.5 text-center shadow-xl">
                <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 font-extrabold block">
                  Precio Unitario de la Pizza Combinada:
                </span>
                <p className="text-3xl font-black text-emerald-300 font-mono">
                  Gs. {Math.max(halfFlavor1?.monto || 0, halfFlavor2?.monto || 0).toLocaleString()}
                </p>
                
                {halfFlavor1 && halfFlavor2 ? (
                  <p className="text-[11px] font-semibold text-slate-200 bg-slate-900/90 p-2 rounded-xl border border-slate-800">
                    {halfFlavor1.monto === halfFlavor2.monto ? (
                      <span>Ambos sabores seleccionados tienen el mismo precio (Gs. {halfFlavor1.monto.toLocaleString()})</span>
                    ) : (
                      <span>
                        Se aplica la regla de cobrar la variedad de mayor valor:{' '}
                        <strong className="text-emerald-400">
                          {halfFlavor1.monto > halfFlavor2.monto ? halfFlavor1.nombre : halfFlavor2.nombre} (Gs. {Math.max(halfFlavor1.monto, halfFlavor2.monto).toLocaleString()})
                        </strong>
                      </span>
                    )}
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-400">
                    Selecciona ambos sabores para calcular el precio final de tu pizza.
                  </p>
                )}
              </div>

              {/* QUANTITY STEPPER */}
              <div className="space-y-3 bg-slate-950/80 p-4 rounded-2xl border border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-slate-200 uppercase tracking-wider">
                    Cantidad de pizzas:
                  </span>
                  <span className="font-mono font-black text-emerald-400 text-sm">
                    Total: Gs. {(Math.max(halfFlavor1?.monto || 0, halfFlavor2?.monto || 0) * halfQty).toLocaleString()}
                  </span>
                </div>

                <div className="flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setHalfQty((q) => Math.max(1, q - 1))}
                    disabled={halfQty <= 1}
                    className="h-10 w-10 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-emerald-400 font-black text-xl flex items-center justify-center border border-slate-700 active:scale-95 transition-all shrink-0 cursor-pointer"
                  >
                    -
                  </button>
                  <span className="text-xl font-black font-mono text-emerald-300 px-5 py-1 bg-slate-900 border border-slate-700 rounded-xl min-w-[55px] text-center">
                    {halfQty}
                  </span>
                  <button
                    type="button"
                    onClick={() => setHalfQty((q) => Math.min(8, q + 1))}
                    disabled={halfQty >= 8}
                    className="h-10 w-10 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-emerald-400 font-black text-xl flex items-center justify-center border border-slate-700 active:scale-95 transition-all shrink-0 cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* OBSERVATIONS */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-300 text-xs">
                  Observaciones / Instrucciones especiales (Opcional):
                </label>
                <input
                  type="text"
                  placeholder="Ej. Sin aceitunas en la primera mitad, borde de catupiry..."
                  value={halfObservation}
                  onChange={(e) => setHalfObservation(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-100 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs"
                />
              </div>

              {/* ADD TO CART BUTTON */}
              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowHalfPizzaModal(false)}
                  className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-colors shrink-0 text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleAddHalfPizzaToCart}
                  disabled={!halfFlavor1 || !halfFlavor2}
                  className="flex-1 py-3.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-black rounded-xl text-xs sm:text-sm shadow-xl shadow-emerald-500/25 transition-all uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ShoppingCart className="w-4 h-4" />
                  <span>
                    Agregar al Carrito (Gs. {(Math.max(halfFlavor1?.monto || 0, halfFlavor2?.monto || 0) * halfQty).toLocaleString()})
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL FOR PINNING CUSTOMER LOCATION ON GOOGLE MAPS */}
      {showMapPickerModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100">Fijar tu Pin de Entrega en Google Maps</h3>
                  <p className="text-[11px] text-slate-400">Haz clic sobre el mapa para marcar exactamente tu casa o departamento</p>
                </div>
              </div>

              <button
                onClick={() => setShowMapPickerModal(false)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Interactive Pin Map */}
            <InteractiveMap
              isAdmin={false}
              pedidos={[]}
              repartidores={[]}
              logoUrl={activeLogo}
              customStorePin={{
                lat: restauranteConfig?.latitud ?? -25.1747,
                lon: restauranteConfig?.longitud ?? -57.48334,
                nombre: restauranteConfig?.nombre || 'Restaurante Central',
              }}
              customClientPin={{
                lat: customerLat,
                lon: customerLon,
                nombre: 'MI UBICACIÓN DE ENTREGA',
              }}
              customBannerText="🏠 HAZ CLIC O ARRASTRA EL PIN EN EL MAPA PARA FIJAR TU ENTREGA"
              onMapClickCoordinates={(lat, lon) => {
                updateLocationAndAddress(lat, lon);
              }}
            />

            {/* Bottom Bar with Address & Confirmation Button */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-slate-800">
              <div className="text-xs text-slate-300 min-w-0 flex-1">
                {isGeocoding && (
                  <span className="text-emerald-400 animate-pulse text-xs font-semibold block">
                    ⏳ Buscando dirección...
                  </span>
                )}
                {checkout.direccion && !isGeocoding && (
                  <div className="text-slate-200 text-xs font-medium truncate bg-slate-950/60 px-3 py-2 rounded-xl border border-slate-800/80">
                    📍 Dirección seleccionada: <span className="font-bold text-emerald-400">{checkout.direccion}</span>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setShowMapPickerModal(false)}
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold px-6 py-3 rounded-xl text-xs sm:text-sm shadow-xl shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Confirmar Esta Ubicación</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VENTANA EMERGENTE (MODAL) PARA INGRESAR OBSERVACIONES DEL PEDIDO O PRODUCTO */}
      {showObservationModal && (
        <div className="fixed inset-0 z-[2000] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="bg-slate-900 border border-emerald-500/50 rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl relative space-y-5 my-8 animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-extrabold text-slate-100 uppercase tracking-wider truncate">
                    {activeObservationTarget?.id === 'GENERAL'
                      ? 'Observación del Lugar de Entrega'
                      : `Observación: ${activeObservationTarget?.name || 'Producto'}`}
                  </h3>
                  <p className="text-[11px] text-slate-400 truncate">
                    {activeObservationTarget?.id === 'GENERAL'
                      ? 'Instrucciones y referencias para el repartidor al llegar'
                      : 'Escribe libremente o selecciona preferencias de preparación'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowObservationModal(false);
                  setActiveObservationTarget(null);
                }}
                className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition-colors shrink-0"
                title="Cerrar sin guardar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Presets Grid */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                Selección Rápida (Toca para agregar):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {(activeObservationTarget?.id === 'GENERAL'
                  ? [
                      '🚪 Portón blanco',
                      '🔔 Timbre roto (Llamar al cel)',
                      '🏡 Casa de 2 pisos',
                      '🏢 Edificio / Dejar en portería',
                      '📞 Llamar 5 min antes',
                      '🐕 Cuidado con el perro',
                      '📍 Frente a la plaza / taller',
                      '🧱 Muralla o fachada roja',
                      '💼 Entregar en caja / recepción',
                      '🔑 Dejar con el guardia',
                    ]
                  : [
                      '🥬 Sin lechuga',
                      '🧅 Sin cebolla',
                      '🍅 Sin tomate',
                      '🥩 Doble carne',
                      '🧀 Doble queso',
                      '🌶️ Sin picante',
                      '🥤 Salsa aparte',
                      '🍟 Sin sal',
                      '🍳 Huevo bien cocido',
                      '🥓 Extra tocino',
                    ]
                ).map((tag, idx) => {
                  const tagClean = tag.replace(/^[^\s]+\s*/, '');
                  const isIncluded = tempObservation.includes(tag) || tempObservation.includes(tagClean);

                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        if (isIncluded) {
                          let next = tempObservation
                            .replace(tag, '')
                            .replace(tagClean, '')
                            .replace(/,\s*,/g, ',')
                            .replace(/,\s*$/g, '')
                            .replace(/^\s*,/g, '')
                            .trim();
                          setTempObservation(next);
                        } else {
                          const prefix = tempObservation.trim() ? `${tempObservation.trim()}, ` : '';
                          setTempObservation(`${prefix}${tag}`);
                        }
                      }}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-xl transition-all duration-150 flex items-center gap-1 touch-manipulation active:scale-95 ${
                        isIncluded
                          ? 'bg-emerald-500 text-slate-950 font-extrabold shadow-md border border-emerald-300 ring-2 ring-emerald-400/50 scale-[1.03]'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-emerald-500/50'
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Free Textarea */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-200">
                  Escribe libremente tus detalles:
                </label>
                {tempObservation && (
                  <button
                    type="button"
                    onClick={() => setTempObservation('')}
                    className="text-[11px] text-rose-400 hover:underline font-semibold"
                  >
                    Borrar texto
                  </button>
                )}
              </div>
              <textarea
                rows={4}
                placeholder={
                  activeObservationTarget?.id === 'GENERAL'
                    ? 'Ejemplo: Portón blanco de dos hojas, timbre no funciona, llamar al celular al llegar a la puerta...'
                    : 'Ejemplo: Sin lechuga, doble carne, salsa de ajo en bolsa aparte, por favor...'
                }
                value={tempObservation}
                onChange={(e) => setTempObservation(e.target.value)}
                className="w-full bg-slate-950 border-2 border-slate-700 focus:border-emerald-500 text-slate-100 rounded-2xl p-3.5 text-xs font-sans focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-all leading-relaxed"
              />
              <p className="text-[10px] text-slate-400">
                * Esta información se imprimirá en tu ticket para el repartidor y la logística de entrega.
              </p>
            </div>

            {/* Action Footer Buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setShowObservationModal(false);
                  setActiveObservationTarget(null);
                }}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveObservationFromModal}
                className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold rounded-xl text-xs shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-1.5 active:scale-95 touch-manipulation"
              >
                <Check className="w-4 h-4" />
                Aceptar y Guardar Observación
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Inicio de Sesión / Registro de Cliente */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold shrink-0">
                <User className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-extrabold text-slate-100">
                  {authMode === 'login'
                    ? 'Iniciar Sesión'
                    : authMode === 'register'
                    ? 'Registrar Cuenta de Cliente'
                    : 'Mis Datos Personales'}
                </h3>
                <p className="text-xs text-slate-400">
                  {authMode === 'login'
                    ? 'Ingresa tu correo y contraseña para acceder a tus pedidos.'
                    : authMode === 'register'
                    ? 'Completa tus datos y crea tu contraseña para el registro.'
                    : 'Consulta y actualiza la información de tu perfil de cliente.'}
                </p>
              </div>
            </div>

            {authMessage && (
              <div className="bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 p-3 rounded-2xl text-xs flex items-center gap-2">
                <Info className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{authMessage}</span>
              </div>
            )}

            {authError && (
              <div className="bg-rose-950/40 border border-rose-500/40 text-rose-300 p-3 rounded-2xl text-xs flex items-center gap-2">
                <Info className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            {authMode === 'profile' ? (
              <form onSubmit={handleClientRegister} className="space-y-3">
                <div className="bg-emerald-500/10 border border-emerald-500/30 p-2.5 rounded-xl text-emerald-300 text-[11px] font-medium">
                  ✏️ Puedes modificar cualquiera de tus datos personales y hacer clic en <strong>Guardar Cambios</strong>.
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-200 mb-1">
                      Nombres:
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: Juan Carlos"
                      value={authForm.nombres}
                      onChange={(e) => setAuthForm({ ...authForm, nombres: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 text-slate-100 rounded-xl p-2.5 text-xs font-sans focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-200 mb-1">
                      Apellidos:
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: Gómez"
                      value={authForm.apellidos}
                      onChange={(e) => setAuthForm({ ...authForm, apellidos: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 text-slate-100 rounded-xl p-2.5 text-xs font-sans focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-200 mb-1">
                      Cédula / RUC:
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: 4567890"
                      value={authForm.cedula}
                      onChange={(e) => setAuthForm({ ...authForm, cedula: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 text-slate-100 rounded-xl p-2.5 text-xs font-sans focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-200 mb-1">
                      Celular / WhatsApp:
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: 0981123456"
                      value={authForm.celular}
                      onChange={(e) => setAuthForm({ ...authForm, celular: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 text-slate-100 rounded-xl p-2.5 text-xs font-sans focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-200 mb-1 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Correo Electrónico:</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="ejemplo@gmail.com"
                    value={authForm.email}
                    onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 text-slate-100 rounded-xl p-2.5 text-xs font-sans focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-200 mb-1 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Contraseña:</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswordInput ? "text" : "password"}
                      placeholder="Nueva contraseña o la actual"
                      value={authForm.password}
                      onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 text-slate-100 rounded-xl pl-3 pr-10 py-2.5 text-xs font-sans focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswordInput(!showPasswordInput)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 text-xs"
                      title={showPasswordInput ? "Ocultar" : "Mostrar"}
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="pt-2 flex flex-col gap-2">
                  <button
                    type="submit"
                    disabled={isAuthLoading}
                    className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-3 px-4 rounded-xl text-xs shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 uppercase tracking-wider"
                  >
                    {isAuthLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Guardar Cambios de Mis Datos</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowAuthModal(false);
                      handleLogoutClient();
                    }}
                    className="w-full text-center text-xs text-rose-400 hover:text-rose-300 py-1.5 font-bold hover:underline flex items-center justify-center gap-1"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Cerrar Sesión</span>
                  </button>
                </div>
              </form>
            ) : authMode === 'login' ? (
              <form onSubmit={handleClientLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-200 mb-1.5 flex items-center gap-1.5">
                    <Mail className="w-4 h-4 text-emerald-400" />
                    <span>Correo Electrónico:</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="ejemplo@gmail.com"
                    value={authForm.email}
                    onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                    className="w-full bg-slate-950 border-2 border-slate-700 focus:border-emerald-500 text-slate-100 rounded-xl px-3.5 py-2.5 text-xs font-sans focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-all"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      <Lock className="w-4 h-4 text-emerald-400" />
                      <span>Contraseña:</span>
                    </label>
                  </div>
                  <div className="relative">
                    <input
                      type={showPasswordInput ? "text" : "password"}
                      required
                      placeholder="Ingresa tu contraseña"
                      value={authForm.password}
                      onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                      className="w-full bg-slate-950 border-2 border-slate-700 focus:border-emerald-500 text-slate-100 rounded-xl pl-3.5 pr-10 py-2.5 text-xs font-sans focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswordInput(!showPasswordInput)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 text-xs"
                      title={showPasswordInput ? "Ocultar" : "Mostrar"}
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="pt-2 flex flex-col gap-2">
                  <button
                    type="submit"
                    disabled={isAuthLoading}
                    className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-3 px-4 rounded-xl text-xs shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 uppercase tracking-wider"
                  >
                    {isAuthLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <LogIn className="w-4 h-4" />
                        <span>Ingresar</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('register');
                      setAuthError('');
                      setAuthMessage('');
                    }}
                    className="w-full text-center text-xs text-emerald-300 hover:text-emerald-200 py-1.5 font-bold hover:underline"
                  >
                    ¿No tienes cuenta? Regístrate aquí con tus datos
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleClientRegister} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-200 mb-1">
                      Nombres:
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: Juan Carlos"
                      value={authForm.nombres}
                      onChange={(e) => setAuthForm({ ...authForm, nombres: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 text-slate-100 rounded-xl p-2.5 text-xs font-sans focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-200 mb-1">
                      Apellidos: <span className="text-[10px] font-normal text-slate-400">(Opcional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: Gómez"
                      value={authForm.apellidos}
                      onChange={(e) => setAuthForm({ ...authForm, apellidos: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 text-slate-100 rounded-xl p-2.5 text-xs font-sans focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-200 mb-1">
                      Cédula / RUC: <span className="text-[10px] font-normal text-slate-400">(Opcional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: 4567890"
                      value={authForm.cedula}
                      onChange={(e) => setAuthForm({ ...authForm, cedula: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 text-slate-100 rounded-xl p-2.5 text-xs font-sans focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-200 mb-1">
                      Celular / WhatsApp:
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: 0981123456"
                      value={authForm.celular}
                      onChange={(e) => setAuthForm({ ...authForm, celular: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 text-slate-100 rounded-xl p-2.5 text-xs font-sans focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-200 mb-1 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Correo Electrónico:</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="ejemplo@gmail.com"
                    value={authForm.email}
                    onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 text-slate-100 rounded-xl p-2.5 text-xs font-sans focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-200 mb-1 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Crear Contraseña:</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswordInput ? "text" : "password"}
                      required
                      placeholder="Crea tu contraseña secreta"
                      value={authForm.password}
                      onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 text-slate-100 rounded-xl pl-3 pr-10 py-2.5 text-xs font-sans focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswordInput(!showPasswordInput)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 text-xs"
                      title={showPasswordInput ? "Ocultar" : "Mostrar"}
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="pt-2 flex flex-col gap-2">
                  <button
                    type="submit"
                    disabled={isAuthLoading}
                    className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-3 px-4 rounded-xl text-xs shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 uppercase tracking-wider"
                  >
                    {isAuthLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Completar Registro e Iniciar Sesión</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('login');
                      setAuthError('');
                      setAuthMessage('');
                    }}
                    className="w-full text-center text-xs text-slate-400 hover:text-slate-200 py-1.5 hover:underline font-medium"
                  >
                    ¿Ya tienes cuenta? Iniciar Sesión
                  </button>
                </div>
              </form>
            )}

            {/* Botón inferior para cerrar modal */}
            <div className="pt-2 border-t border-slate-800 text-center">
              <button
                type="button"
                onClick={() => {
                  setShowAuthModal(false);
                  setAuthError('');
                  setAuthMessage('');
                }}
                className="text-xs font-semibold text-slate-400 hover:text-slate-200 hover:underline cursor-pointer"
              >
                ← Volver y continuar navegando
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PREVISUALIZAR COMPROBANTE DE TRANSFERENCIA */}
      {previewComprobanteModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl space-y-4 p-5 relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Landmark className="w-5 h-5 text-indigo-400" />
                <h4 className="text-sm font-extrabold text-slate-100">Comprobante de Transferencia</h4>
              </div>
              <button
                type="button"
                onClick={() => setPreviewComprobanteModal(null)}
                className="text-slate-400 hover:text-slate-100 p-1.5 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center max-h-[65vh] p-2">
              <img
                src={previewComprobanteModal}
                alt="Comprobante Adjunto"
                className="w-full h-auto max-h-[60vh] object-contain rounded-xl shadow"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-slate-400">Comprobante enviado al restaurante</span>
              <button
                type="button"
                onClick={() => setPreviewComprobanteModal(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Bottom Action Dock Bar (Ultra-responsive for both mobile & desktop navigation) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-lg border-t border-slate-800/90 px-3 py-2 flex items-center justify-around shadow-2xl pb-safe">
        <button
          type="button"
          onClick={() => {
            setSubTab('catalogo');
            setSelectedCategory(null);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`flex flex-col items-center gap-1 text-[11px] font-extrabold transition-all cursor-pointer ${
            subTab === 'catalogo' ? 'text-emerald-400 scale-105' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Package className="w-5 h-5" />
          <span>Catálogo</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setSubTab('catalogo');
            setTimeout(() => {
              document.getElementById('cart-sidebar-section')?.scrollIntoView({ behavior: 'smooth' });
            }, 50);
          }}
          className="relative flex flex-col items-center gap-1 text-[11px] font-extrabold text-emerald-400 hover:text-emerald-300 transition-all cursor-pointer bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-xl shadow-lg"
        >
          <div className="flex items-center gap-1.5">
            <ShoppingCart className="w-4 h-4" />
            <span>Pedir</span>
            {cart.length > 0 && (
              <span className="bg-emerald-500 text-slate-950 font-mono font-black text-[9px] px-1.5 py-0.5 rounded-full shadow">
                {cart.length}
              </span>
            )}
          </div>
          {cartTotal > 0 && (
            <span className="text-[9px] font-mono font-bold text-emerald-300">
              Gs. {cartTotal.toLocaleString()}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            setSubTab('rastreo');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`relative flex flex-col items-center gap-1 text-[11px] font-extrabold transition-all cursor-pointer ${
            subTab === 'rastreo' ? 'text-emerald-400 scale-105' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="relative flex items-center gap-1">
            <Radio className="w-5 h-5 text-emerald-400 animate-pulse" />
            {activePedidos.length > 0 && (
              <span className="bg-emerald-500 text-slate-950 text-[9px] font-mono font-black px-1.5 py-0.5 rounded-full">
                {activePedidos.length}
              </span>
            )}
          </div>
          <span>Rastrear Pedido</span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (activeClient) {
              setAuthForm({
                email: activeClient.email || '',
                password: activeClient.password || '',
                nombres: activeClient.nombres || '',
                apellidos: activeClient.apellidos || '',
                cedula: activeClient.cedula || '',
                celular: activeClient.celular || '',
              });
              setAuthMode('profile');
            } else {
              setAuthMode('login');
            }
            setAuthError('');
            setAuthMessage('');
            setShowAuthModal(true);
          }}
          className="flex flex-col items-center gap-1 text-[11px] font-extrabold text-slate-300 hover:text-emerald-300 transition-all cursor-pointer"
        >
          <User className="w-5 h-5 text-emerald-400" />
          <span>{activeClient ? 'Mis Datos' : 'Ingresar'}</span>
        </button>
      </nav>
    </div>
  );
};
