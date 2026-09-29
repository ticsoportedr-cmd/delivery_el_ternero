import React, { useState, useEffect } from 'react';
import { Pedido, Repartidor, Producto, GPSUpdate, RestauranteConfig, CierreDeCaja, CierreDetallePedido, Cliente } from '../types';
import { InteractiveMap } from './InteractiveMap';
import { WaiterView } from './WaiterView';
import logoImg from '../assets/images/el_ternero_logo.svg';
import { Socket } from 'socket.io-client';
import { showNativeNotification, requestNotificationPermission } from '../utils/serviceWorker';
import {
  Plus,
  Sparkles,
  RefreshCw,
  ShoppingBag,
  User,
  UserX,
  UserCheck,
  Users,
  Utensils,
  LayoutGrid,
  ShieldAlert,
  MapPin,
  Radio,
  CheckCircle2,
  AlertCircle,
  Search,
  Package,
  Image,
  Trash2,
  Coins,
  Banknote,
  Layers,
  Upload,
  UploadCloud,
  RotateCcw,
  Check,
  Bike,
  Edit,
  Phone,
  Mail,
  Lock,
  Unlock,
  ShieldCheck,
  Key,
  LogOut,
  X,
  Compass,
  Navigation,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Printer,
  Download,
  Calendar,
  TrendingUp,
  Archive,
  Clock,
  Receipt,
  ChevronRight,
  Bell,
  Send,
  Save,
  Landmark,
  CreditCard,
  Eye,
  ZoomIn,
  Locate,
} from 'lucide-react';

interface AdminDashboardProps {
  pedidos: Pedido[];
  repartidores: Repartidor[];
  productos?: Producto[];
  socket: Socket | null;
  lastGpsUpdate?: GPSUpdate | null;
  restauranteConfig?: RestauranteConfig;
  onRefreshData?: () => void;
  onLogout?: () => void;
  onUpdateLogo?: (newLogo: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  pedidos,
  repartidores,
  productos = [],
  socket,
  lastGpsUpdate,
  restauranteConfig,
  onRefreshData,
  onLogout,
  onUpdateLogo,
}) => {
  const currentLogo = restauranteConfig?.logoUrl || logoImg;
  const isCustomLogo = Boolean(restauranteConfig?.logoUrl && restauranteConfig.logoUrl !== logoImg && restauranteConfig.logoUrl !== '/el_ternero_logo.svg');
  const adminLogoFileRef = React.useRef<HTMLInputElement>(null);
  const [logoSaveSuccess, setLogoSaveSuccess] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'envios' | 'mesas_salon' | 'mapa_vivo' | 'productos' | 'repartidores' | 'portadas_categorias' | 'ubicacion_local' | 'cierre_caja' | 'clientes' | 'notificaciones'>('envios');
  const [showModalPedido, setShowModalPedido] = useState<boolean>(false);
  const [loadingAi, setLoadingAi] = useState<boolean>(false);
  const [filterText, setFilterText] = useState<string>('');
  const [filterProductText, setFilterProductText] = useState<string>('');
  const [filterDriverText, setFilterDriverText] = useState<string>('');
  const [deletingDriverId, setDeletingDriverId] = useState<string | null>(null);

  // Transfer Receipt Verification Modal State
  const [verifyingPedido, setVerifyingPedido] = useState<Pedido | null>(null);
  const [comprobanteReviewedCheck, setComprobanteReviewedCheck] = useState<boolean>(false);
  const [isZoomingReceipt, setIsZoomingReceipt] = useState<boolean>(false);

  // Clientes State
  const [clientesList, setClientesList] = useState<Cliente[]>([]);
  const [clientSearchText, setClientSearchText] = useState<string>('');
  const [clientStatusFilter, setClientStatusFilter] = useState<'todos' | 'en_linea' | 'activos' | 'bloqueados'>('todos');

  // Notification Templates & Broadcast Promo State
  const [notifTemplates, setNotifTemplates] = useState<{
    recibido: { title: string; body: string };
    aceptado: { title: string; body: string };
    preparando: { title: string; body: string };
    en_camino: { title: string; body: string };
    entregado: { title: string; body: string };
    rechazado: { title: string; body: string };
  }>({
    recibido: { title: '🛵 Nuevo Pedido Recibido', body: '¡El pedido #{id} por ₲{total} fue registrado en EL TERNERO!' },
    aceptado: { title: '✅ Pedido Aceptado', body: '¡Tu pedido #{id} fue confirmado y aceptado por EL TERNERO!' },
    preparando: { title: '👨‍🍳 Pedido en Preparación', body: '¡Tu pedido #{id} se está preparando en la cocina de EL TERNERO!' },
    en_camino: { title: '🛵 Pedido en Camino', body: '¡El repartidor {repartidor} va en camino a tu dirección con tu pedido #{id}!' },
    entregado: { title: '🎉 Pedido Entregado', body: '¡Tu pedido #{id} fue entregado con éxito! Que lo disfrutes. ¡Gracias por elegir EL TERNERO!' },
    rechazado: { title: '⚠️ Pedido Cancelado', body: 'El pedido #{id} ha sido cancelado o rechazado por el local.' },
  });

  const [savingTemplates, setSavingTemplates] = useState<boolean>(false);
  const [templateSuccessMsg, setTemplateSuccessMsg] = useState<string>('');

  // Promo Broadcast State
  const [promoTitle, setPromoTitle] = useState<string>('🔥 COMBO DEL DÍA - EL TERNERO');
  const [promoBody, setPromoBody] = useState<string>('¡Aprovecha hoy esta súper promoción con envío veloz! Haz tu pedido directamente desde esta notificación y agrega adicionales si deseas.');
  const [promoImgUrl, setPromoImgUrl] = useState<string>('');
  const [selectedPromoProductId, setSelectedPromoProductId] = useState<string>('');
  const [sendingPromo, setSendingPromo] = useState<boolean>(false);
  const [promoSuccessMsg, setPromoSuccessMsg] = useState<string>('');

  const fetchNotificationTemplates = async () => {
    try {
      const res = await fetch('/api/notification-templates');
      if (res.ok) {
        const data = await res.json();
        if (data && Object.keys(data).length > 0) {
          setNotifTemplates(data);
        }
      }
    } catch {
      // Usar valores por defecto
    }
  };

  useEffect(() => {
    fetchNotificationTemplates();
  }, []);

  const handleSaveNotificationTemplates = async () => {
    setSavingTemplates(true);
    setTemplateSuccessMsg('');
    try {
      const res = await fetch('/api/notification-templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notifTemplates),
      });
      if (res.ok) {
        setTemplateSuccessMsg('¡Plantillas de notificación de barra de celular guardadas con éxito!');
        setTimeout(() => setTemplateSuccessMsg(''), 4000);
      }
    } catch {
      alert('Error al guardar plantillas de notificaciones');
    } finally {
      setSavingTemplates(false);
    }
  };

  const handleSendBroadcastPromo = async () => {
    if (!promoTitle.trim() || !promoBody.trim()) {
      alert('Por favor escribe el título y el mensaje de la promoción');
      return;
    }
    setSendingPromo(true);
    setPromoSuccessMsg('');
    try {
      const res = await fetch('/api/notifications/broadcast-promo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: promoTitle,
          body: promoBody,
          imageUrl: promoImgUrl,
          productoId: selectedPromoProductId || null,
        }),
      });
      if (res.ok) {
        setPromoSuccessMsg('🚀 ¡Promoción transmitida con éxito a los celulares y app de todos los clientes!');
        setTimeout(() => setPromoSuccessMsg(''), 6000);
      }
    } catch {
      alert('Error al emitir la promoción de combos');
    } finally {
      setSendingPromo(false);
    }
  };

  const fetchClientes = async () => {
    try {
      const res = await fetch('/api/clientes');
      if (res.ok) {
        const data = await res.json();
        setClientesList(data);
      }
    } catch {
      // Manejado en tiempo real vía Socket.io
    }
  };

  useEffect(() => {
    fetchClientes();
    if (activeTab === 'clientes') {
      const interval = setInterval(() => {
        fetchClientes();
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  useEffect(() => {
    if (!socket) return;
    const handleClientesActualizados = (lista: Cliente[]) => {
      if (Array.isArray(lista)) setClientesList(lista);
    };
    const handleEstadoInicial = (data: any) => {
      if (data && Array.isArray(data.clientes)) {
        setClientesList(data.clientes);
      }
    };

    socket.on('clientes_actualizados', handleClientesActualizados);
    socket.on('estado_inicial', handleEstadoInicial);

    return () => {
      socket.off('clientes_actualizados', handleClientesActualizados);
      socket.off('estado_inicial', handleEstadoInicial);
    };
  }, [socket]);

  // Modal State for Block / Unblock / Delete Client
  const [clientActionModal, setClientActionModal] = useState<{
    type: 'bloquear' | 'desbloquear' | 'eliminar';
    cliente: Cliente;
  } | null>(null);
  const [clientMotivoInput, setClientMotivoInput] = useState<string>('Incumplimiento de políticas / Mal comportamiento');
  const [isClientActionLoading, setIsClientActionLoading] = useState<boolean>(false);

  const handleConfirmClientAction = async () => {
    if (!clientActionModal) return;

    const { type, cliente } = clientActionModal;
    setIsClientActionLoading(true);

    try {
      if (type === 'bloquear' || type === 'desbloquear') {
        const isBlocking = type === 'bloquear';
        const res = await fetch(`/api/clientes/${encodeURIComponent(cliente.id)}/bloquear`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bloqueado: isBlocking,
            motivoBloqueo: isBlocking ? (clientMotivoInput.trim() || 'Cuenta bloqueada por la administración') : '',
          }),
        });

        if (res.ok) {
          fetchClientes();
          setClientActionModal(null);
        } else {
          const errData = await res.json().catch(() => ({}));
          alert(`Error: ${errData.error || 'No se pudo actualizar el estado del cliente'}`);
        }
      } else if (type === 'eliminar') {
        const res = await fetch(`/api/clientes/${encodeURIComponent(cliente.id)}`, {
          method: 'DELETE',
        });

        if (res.ok) {
          fetchClientes();
          setClientActionModal(null);
        } else {
          const errData = await res.json().catch(() => ({}));
          alert(`Error: ${errData.error || 'No se pudo eliminar al cliente'}`);
        }
      }
    } catch (err) {
      console.error('Error procesando acción de cliente:', err);
      alert('Error de conexión con el servidor.');
    } finally {
      setIsClientActionLoading(false);
    }
  };

  // Cierre de Caja & Reportes State
  const [cierresDeCaja, setCierresDeCaja] = useState<CierreDeCaja[]>([]);
  const [montoInicialInput, setMontoInicialInput] = useState<number>(200000);
  const [observacionesCierreInput, setObservacionesCierreInput] = useState<string>('');
  const [cierreSuccessMsg, setCierreSuccessMsg] = useState<string>('');
  const [isClosingCaja, setIsClosingCaja] = useState<boolean>(false);
  const [monthFilter, setMonthFilter] = useState<string>('todos');
  const [cierreSearchText, setCierreSearchText] = useState<string>('');
  const [selectedCierreForDetail, setSelectedCierreForDetail] = useState<CierreDeCaja | null>(null);
  const [showPrintReportModal, setShowPrintReportModal] = useState<boolean>(false);
  const [showMonthlyReportModal, setShowMonthlyReportModal] = useState<boolean>(false);
  const [cierreToDelete, setCierreToDelete] = useState<CierreDeCaja | null>(null);

  const fetchCierres = async () => {
    try {
      const res = await fetch('/api/cierres');
      if (res.ok) {
        const ct = res.headers.get('content-type');
        if (ct && ct.includes('application/json')) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setCierresDeCaja(data);
          }
        }
      }
    } catch (err) {
      console.warn('Error cargando cierres de caja:', err);
    }
  };

  useEffect(() => {
    fetchCierres();
  }, []);

  useEffect(() => {
    if (!socket) return;
    const handleCierreRealizado = (nuevoCierre: CierreDeCaja) => {
      if (nuevoCierre && nuevoCierre.id) {
        setCierresDeCaja((prev) => [nuevoCierre, ...prev.filter((c) => c.id !== nuevoCierre.id)]);
      }
    };
    const handleCierresActualizados = (lista: CierreDeCaja[]) => {
      if (Array.isArray(lista)) setCierresDeCaja(lista);
    };

    socket.on('cierre_realizado', handleCierreRealizado);
    socket.on('cierres_actualizados', handleCierresActualizados);

    return () => {
      socket.off('cierre_realizado', handleCierreRealizado);
      socket.off('cierres_actualizados', handleCierresActualizados);
    };
  }, [socket]);

  const handleRealizarCierre = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsClosingCaja(true);
    setCierreSuccessMsg('');

    try {
      const res = await fetch('/api/cierres', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          montoInicial: Number(montoInicialInput) || 0,
          observaciones: observacionesCierreInput,
          usuarioCierre: 'Administrador',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setCierreSuccessMsg('¡Cierre de caja registrado exitosamente en el historial!');
        setObservacionesCierreInput('');
        fetchCierres();
        if (onRefreshData) onRefreshData();
        setTimeout(() => setCierreSuccessMsg(''), 5000);
      }
    } catch (err) {
      console.error('Error al realizar cierre de caja:', err);
    } finally {
      setIsClosingCaja(false);
    }
  };

  const handleEliminarCierre = async (cierreId: string) => {
    try {
      const res = await fetch(`/api/cierres/${cierreId}`, { method: 'DELETE' });
      if (res.ok) {
        setCierresDeCaja((prev) => prev.filter((c) => c.id !== cierreId));
      }
    } catch (err) {
      console.error('Error eliminando cierre:', err);
    }
  };

  const exportCierreToCSV = (cierre: CierreDeCaja) => {
    let csvContent = '\uFEFF';
    csvContent += `REPORTE DE CIERRE DE CAJA - ${cierre.id}\n`;
    csvContent += `Establecimiento,"${(restauranteConfig?.nombre || 'EL TERNERO').replace(/"/g, '""')}"\n`;
    csvContent += `Fecha Cierre,${new Date(cierre.fechaCierre).toLocaleString('es-PY')}\n`;
    csvContent += `Usuario Cierre,${cierre.usuarioCierre}\n`;
    csvContent += `Monto Inicial (Gs.),${cierre.montoInicial}\n`;
    csvContent += `Total Ventas (Gs.),${cierre.totalVentas}\n`;
    csvContent += `Total en Caja (Gs.),${cierre.montoInicial + cierre.totalVentas}\n`;
    csvContent += `Cantidad Pedidos,${cierre.cantidadPedidos}\n`;
    csvContent += `Observaciones,"${(cierre.observaciones || '').replace(/"/g, '""')}"\n\n`;

    csvContent += `ID Pedido,Fecha y Hora,Cliente,Repartidor,Productos,Monto Total (Gs.)\n`;

    (cierre.pedidos || []).forEach((p) => {
      const itemsStr = `"${(p.items || []).join(' + ').replace(/"/g, '""')}"`;
      csvContent += `"${p.id}","${new Date(p.fecha).toLocaleString('es-PY')}","${p.cliente.replace(/"/g, '""')}","${p.repartidorNombre.replace(/"/g, '""')}",${itemsStr},${p.total}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Cierre_Caja_${cierre.id}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportMonthlyReportToCSV = (mes: string) => {
    const cierresFiltrados = mes === 'todos'
      ? cierresDeCaja
      : cierresDeCaja.filter((c) => c.fechaCierre.startsWith(mes));

    let csvContent = '\uFEFF';
    csvContent += `REPORTE MENSUAL DE CIERRES Y VENTAS - MES: ${mes === 'todos' ? 'TODOS LOS MESES' : mes}\n`;
    csvContent += `Establecimiento,"${(restauranteConfig?.nombre || 'EL TERNERO').replace(/"/g, '""')}"\n`;
    csvContent += `Fecha Generación,${new Date().toLocaleString('es-PY')}\n`;
    csvContent += `Total Cierres Registrados,${cierresFiltrados.length}\n`;

    const totalVendidoMes = cierresFiltrados.reduce((acc, c) => acc + c.totalVentas, 0);
    const totalPedidosMes = cierresFiltrados.reduce((acc, c) => acc + c.cantidadPedidos, 0);

    csvContent += `Total Monto Vendido (Gs.),${totalVendidoMes}\n`;
    csvContent += `Total Pedidos Entregados,${totalPedidosMes}\n\n`;

    csvContent += `ID Cierre,Fecha Cierre,ID Pedido,Fecha Pedido,Cliente,Repartidor,Productos,Monto Pedido (Gs.)\n`;

    cierresFiltrados.forEach((c) => {
      (c.pedidos || []).forEach((p) => {
        const itemsStr = `"${(p.items || []).join(' + ').replace(/"/g, '""')}"`;
        csvContent += `"${c.id}","${new Date(c.fechaCierre).toLocaleString('es-PY')}","${p.id}","${new Date(p.fecha).toLocaleString('es-PY')}","${p.cliente.replace(/"/g, '""')}","${p.repartidorNombre.replace(/"/g, '""')}",${itemsStr},${p.total}\n`;
      });
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Reporte_Mensual_Ventas_${mes}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Store Location Configuration State
  const [nombreRestauranteInput, setNombreRestauranteInput] = useState<string>(
    restauranteConfig?.nombre || 'EL TERNERO'
  );
  const [direccionRestauranteInput, setDireccionRestauranteInput] = useState<string>(
    restauranteConfig?.direccion || 'RGG9+R7H, Gral. Elizardo Aquino, Limpio 110816, Paraguay'
  );
  const [latitudRestauranteInput, setLatitudRestauranteInput] = useState<number>(
    restauranteConfig?.latitud ?? -25.1747
  );
  const [longitudRestauranteInput, setLongitudRestauranteInput] = useState<number>(
    restauranteConfig?.longitud ?? -57.48334
  );
  const [telefonoRestauranteInput, setTelefonoRestauranteInput] = useState<string>(
    restauranteConfig?.telefono || '+595 981 100200'
  );
  const [saveLocationSuccessMsg, setSaveLocationSuccessMsg] = useState<string>('');
  const [isSavingLocation, setIsSavingLocation] = useState<boolean>(false);

  // Store Location Lock & Confirmation State
  const [isLocationLocked, setIsLocationLocked] = useState<boolean>(true);
  const [isLogoLocked, setIsLogoLocked] = useState<boolean>(true);
  const [showConfirmLocationModal, setShowConfirmLocationModal] = useState<boolean>(false);
  const [pendingCoords, setPendingCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [isDetectingGps, setIsDetectingGps] = useState<boolean>(false);
  const [gpsErrorMsg, setGpsErrorMsg] = useState<string>('');

  const handleDetectCurrentGps = () => {
    if (!navigator.geolocation) {
      setGpsErrorMsg('La geolocalización no está disponible en este navegador.');
      return;
    }
    setIsDetectingGps(true);
    setGpsErrorMsg('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = parseFloat(pos.coords.latitude.toFixed(6));
        const lon = parseFloat(pos.coords.longitude.toFixed(6));
        setLatitudRestauranteInput(lat);
        setLongitudRestauranteInput(lon);
        setIsDetectingGps(false);
      },
      (err) => {
        console.warn('Error obteniendo GPS:', err);
        setGpsErrorMsg('No se pudo acceder al GPS actual. Puedes mover el pin en el mapa o ingresar las coordenadas.');
        setIsDetectingGps(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleCancelAndLock = () => {
    if (restauranteConfig) {
      setNombreRestauranteInput(restauranteConfig.nombre);
      setDireccionRestauranteInput(restauranteConfig.direccion);
      setLatitudRestauranteInput(restauranteConfig.latitud);
      setLongitudRestauranteInput(restauranteConfig.longitud);
      if (restauranteConfig.telefono) setTelefonoRestauranteInput(restauranteConfig.telefono);
    }
    setIsLocationLocked(true);
    setGpsErrorMsg('');
  };

  const handleResetToDefaultLimpio = () => {
    setNombreRestauranteInput('EL TERNERO');
    setDireccionRestauranteInput('RGG9+R7H, Gral. Elizardo Aquino, Limpio 110816, Paraguay');
    setLatitudRestauranteInput(-25.1747);
    setLongitudRestauranteInput(-57.48334);
    setTelefonoRestauranteInput('+595 981 100200');
  };

  const handleLocationChangeRequest = (lat: number, lon: number) => {
    const cleanLat = parseFloat(lat.toFixed(6));
    const cleanLon = parseFloat(lon.toFixed(6));
    setPendingCoords({ lat: cleanLat, lon: cleanLon });
    setShowConfirmLocationModal(true);
  };

  const handleConfirmNewLocation = () => {
    if (pendingCoords) {
      setLatitudRestauranteInput(pendingCoords.lat);
      setLongitudRestauranteInput(pendingCoords.lon);
      handleSaveRestauranteConfig(undefined, pendingCoords.lat, pendingCoords.lon);
      setIsLocationLocked(true);
    }
    setShowConfirmLocationModal(false);
    setPendingCoords(null);
  };

  React.useEffect(() => {
    if (restauranteConfig) {
      setNombreRestauranteInput(restauranteConfig.nombre);
      setDireccionRestauranteInput(restauranteConfig.direccion);
      setLatitudRestauranteInput(restauranteConfig.latitud);
      setLongitudRestauranteInput(restauranteConfig.longitud);
      if (restauranteConfig.telefono) setTelefonoRestauranteInput(restauranteConfig.telefono);
    }
  }, [restauranteConfig]);

  const handleSaveRestauranteConfig = async (e?: React.FormEvent, customLat?: number, customLon?: number) => {
    if (e) e.preventDefault();
    setIsSavingLocation(true);
    setSaveLocationSuccessMsg('');

    const targetLat = customLat !== undefined ? customLat : Number(latitudRestauranteInput);
    const targetLon = customLon !== undefined ? customLon : Number(longitudRestauranteInput);

    const payload = {
      nombre: nombreRestauranteInput,
      direccion: direccionRestauranteInput,
      latitud: targetLat,
      longitud: targetLon,
      telefono: telefonoRestauranteInput,
    };

    try {
      const res = await fetch('/api/restaurante', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        if (socket) {
          socket.emit('actualizar_config_restaurante', payload);
        }
        setSaveLocationSuccessMsg(`¡Ubicación y dirección del local guardadas y bloqueadas con éxito!`);
        setIsLocationLocked(true);
        if (onRefreshData) onRefreshData();
        setTimeout(() => setSaveLocationSuccessMsg(''), 5000);
      }
    } catch (err) {
      console.error('Error al guardar ubicación del local:', err);
    } finally {
      setIsSavingLocation(false);
    }
  };

  // Category Cover Photos State & Enabled/Disabled Status (Portadas y Estado por Categoría)
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
  const [catPortadaSuccessMsg, setCatPortadaSuccessMsg] = useState<string>('');

  React.useEffect(() => {
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

  React.useEffect(() => {
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

  const handleToggleCategoryEstado = async (catId: string, nuevaActiva: boolean) => {
    try {
      const res = await fetch(`/api/categorias/estado/${encodeURIComponent(catId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activa: nuevaActiva }),
      });
      if (res.ok) {
        setCategoryEstadoMap((prev) => ({ ...prev, [catId]: nuevaActiva }));
        setCatPortadaSuccessMsg(
          `La categoría "${catId}" ahora está ${
            nuevaActiva ? 'HABILITADA (Visible en la app)' : 'DESHABILITADA (Oculta en la app)'
          }.`
        );
        setTimeout(() => setCatPortadaSuccessMsg(''), 3500);
      }
    } catch (err) {
      console.error('Error al cambiar estado de categoría:', err);
    }
  };

  const handleSaveCategoryPortada = async (catId: string, fotoUrl: string) => {
    if (!fotoUrl) return;
    try {
      const res = await fetch(`/api/categorias/portadas/${encodeURIComponent(catId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fotoUrl }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.categoriasPortadas) {
          setCategoryPortadasMap(data.categoriasPortadas);
        } else {
          setCategoryPortadasMap((prev) => ({ ...prev, [catId]: fotoUrl }));
        }
        setCatPortadaSuccessMsg(`¡Foto de portada guardada exitosamente para "${catId}"!`);
        setTimeout(() => setCatPortadaSuccessMsg(''), 3500);
      }
    } catch (err) {
      console.error('Error al guardar foto de portada de categoría:', err);
    }
  };

  // Modal State for Creating a New Category
  const [showCreateCategoryModal, setShowCreateCategoryModal] = useState<boolean>(false);
  const [newCatName, setNewCatName] = useState<string>('');
  const [newCatFotoUrl, setNewCatFotoUrl] = useState<string>('');
  const [isCustomCategoryMode, setIsCustomCategoryMode] = useState<boolean>(false);

  // Category Editing & Deleting State
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editingCatNameInput, setEditingCatNameInput] = useState<string>('');
  const [isRenamingCategory, setIsRenamingCategory] = useState<boolean>(false);

  const [deletingCatId, setDeletingCatId] = useState<string | null>(null);
  const [isDeletingCategory, setIsDeletingCategory] = useState<boolean>(false);

  const handleRenameCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCatId || !editingCatNameInput.trim()) return;

    setIsRenamingCategory(true);
    try {
      const res = await fetch(`/api/categorias/renombrar/${encodeURIComponent(editingCatId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nuevoNombre: editingCatNameInput.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.categoriasPortadas) setCategoryPortadasMap(data.categoriasPortadas);
        if (data.categoriasEstado) setCategoryEstadoMap(data.categoriasEstado);
        setCatPortadaSuccessMsg(`¡Categoría "${editingCatId}" renombrada a "${editingCatNameInput.trim()}"!`);
        setEditingCatId(null);
        setEditingCatNameInput('');
        if (onRefreshData) onRefreshData();
        setTimeout(() => setCatPortadaSuccessMsg(''), 4000);
      }
    } catch (err) {
      console.error('Error al renombrar categoría:', err);
    } finally {
      setIsRenamingCategory(false);
    }
  };

  const handleDeleteCategorySubmit = async () => {
    if (!deletingCatId) return;

    setIsDeletingCategory(true);
    try {
      const res = await fetch(`/api/categorias/${encodeURIComponent(deletingCatId)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        const data = await res.json();
        if (data.categoriasPortadas) setCategoryPortadasMap(data.categoriasPortadas);
        if (data.categoriasEstado) setCategoryEstadoMap(data.categoriasEstado);
        setCatPortadaSuccessMsg(`¡Categoría "${deletingCatId}" eliminada correctamente! Sus productos pasaron a "General".`);
        setDeletingCatId(null);
        if (onRefreshData) onRefreshData();
        setTimeout(() => setCatPortadaSuccessMsg(''), 4000);
      }
    } catch (err) {
      console.error('Error al eliminar categoría:', err);
    } finally {
      setIsDeletingCategory(false);
    }
  };

  const defaultCategoryList = [
    { id: 'Hamburguesas', label: 'Hamburguesas' },
    { id: 'Pizzas', label: 'Pizzas Artesanales' },
    { id: 'Lomipizzas', label: 'Lomipizzas Rellenas' },
    { id: 'Papas Fritas', label: 'Papas & Entradas' },
    { id: 'Acompañamientos', label: 'Acompañamientos' },
    { id: 'Bebidas', label: 'Bebidas Recientes' },
    { id: 'Postres', label: 'Postres Especiales' },
  ];

  const allCategoryIds = Array.from(
    new Set([
      ...Object.keys(categoryPortadasMap),
      ...Object.keys(categoryEstadoMap),
      ...productos.map((p) => p.categoria).filter(Boolean) as string[],
    ])
  );

  const allCategoriesList = allCategoryIds.map((id) => {
    const match = defaultCategoryList.find((c) => c.id === id);
    return { id, label: match ? match.label : id };
  });

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    try {
      const res = await fetch('/api/categorias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: newCatName.trim(),
          fotoUrl: newCatFotoUrl.trim(),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.categoriasPortadas) setCategoryPortadasMap(data.categoriasPortadas);
        if (data.categoriasEstado) setCategoryEstadoMap(data.categoriasEstado);
        setCatPortadaSuccessMsg(`¡Categoría "${newCatName.trim()}" creada y activada correctamente!`);
        setShowCreateCategoryModal(false);
        setNewCatName('');
        setNewCatFotoUrl('');
        setTimeout(() => setCatPortadaSuccessMsg(''), 4000);
      }
    } catch (err) {
      console.error('Error creando categoría:', err);
    }
  };

  const handleDeleteCategoryPortada = async (catId: string) => {
    try {
      const res = await fetch(`/api/categorias/portadas/${encodeURIComponent(catId)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setCategoryPortadasMap((prev) => ({ ...prev, [catId]: '' }));
        setCatPortadaSuccessMsg(`Portada de la categoría "${catId}" quitada.`);
        setTimeout(() => setCatPortadaSuccessMsg(''), 3000);
      }
    } catch (err) {
      console.error('Error al quitar foto de portada:', err);
    }
  };

  // Product Form State (Nombre, Cantidad, Monto, Foto)
  const [newProduct, setNewProduct] = useState({
    nombre: '',
    cantidad: 10,
    monto: 25000,
    fotoUrl: '',
    categoria: 'General',
    descripcion: '',
  });

  const [previewImage, setPreviewImage] = useState<string>('');
  const [uploadSuccess, setUploadSuccess] = useState<boolean>(false);

  // Food Presets for Cover Photo
  const FOOD_COVER_PRESETS = [
    { label: 'Burger Clásica', url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&auto=format&fit=crop&q=80' },
    { label: 'Cheeseburger Doble', url: 'https://images.unsplash.com/photo-1572802419224-296b0aeee0d9?w=600&auto=format&fit=crop&q=80' },
    { label: 'Burger BBQ Onion', url: 'https://images.unsplash.com/photo-1594212699903-ec8a3eca50f6?w=600&auto=format&fit=crop&q=80' },
    { label: 'Burger Americana', url: 'https://images.unsplash.com/photo-1553979459-d2229ba7433b?w=600&auto=format&fit=crop&q=80' },
    { label: 'Pizza Pepperoni', url: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&auto=format&fit=crop&q=80' },
    { label: 'Lomipizza Rellena', url: 'https://images.unsplash.com/photo-1628840042765-356cda07504e?w=600&auto=format&fit=crop&q=80' },
    { label: 'Papas Cheddar Bacon', url: 'https://images.unsplash.com/photo-1585109649139-366815a0d713?w=600&auto=format&fit=crop&q=80' },
    { label: 'Papas Crujientes', url: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=600&auto=format&fit=crop&q=80' },
    { label: 'Aros de Cebolla', url: 'https://images.unsplash.com/photo-1639024471283-03518883512d?w=600&auto=format&fit=crop&q=80' },
    { label: 'Bebida Fría', url: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=600&auto=format&fit=crop&q=80' },
    { label: 'Postre Helado', url: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=600&auto=format&fit=crop&q=80' },
  ];

  // Dedicated Cover Photo Upload Modal State
  const [photoModalProduct, setPhotoModalProduct] = useState<Producto | null>(null);
  const [photoModalPreview, setPhotoModalPreview] = useState<string>('');
  const [photoModalSuccessMsg, setPhotoModalSuccessMsg] = useState<string>('');

  const handleOpenCoverPhotoModal = (prod: Producto) => {
    setPhotoModalProduct(prod);
    setPhotoModalPreview(prod.fotoUrl || '');
    setPhotoModalSuccessMsg('');
  };

  const handlePhotoModalFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setPhotoModalPreview(result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveCoverPhoto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!photoModalProduct || !photoModalPreview) return;

    try {
      const res = await fetch(`/api/productos/${photoModalProduct.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...photoModalProduct,
          fotoUrl: photoModalPreview,
        }),
      });

      if (res.ok) {
        setPhotoModalSuccessMsg('¡Foto de portada actualizada exitosamente!');
        setTimeout(() => {
          setPhotoModalProduct(null);
          setPhotoModalSuccessMsg('');
        }, 800);
        if (onRefreshData) onRefreshData();
      }
    } catch (err) {
      console.error('Error al actualizar foto de portada:', err);
    }
  };

  // Product Edit Modal State
  const [editingProduct, setEditingProduct] = useState<Producto | null>(null);
  const [editProdImagePreview, setEditProdImagePreview] = useState<string>('');
  const [editProdSuccessMsg, setEditProdSuccessMsg] = useState<string>('');

  const handleOpenEditProduct = (prod: Producto) => {
    setEditingProduct({ ...prod });
    setEditProdImagePreview(prod.fotoUrl || '');
    setEditProdSuccessMsg('');
  };

  const handleEditProductFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && editingProduct) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setEditProdImagePreview(result);
        setEditingProduct((prev) => (prev ? { ...prev, fotoUrl: result } : null));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveEditProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct || !editingProduct.nombre.trim()) return;

    try {
      const res = await fetch(`/api/productos/${editingProduct.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editingProduct,
          fotoUrl: editProdImagePreview || editingProduct.fotoUrl,
        }),
      });

      if (res.ok) {
        setEditProdSuccessMsg('¡Producto actualizado con éxito!');
        setTimeout(() => {
          setEditingProduct(null);
          setEditProdSuccessMsg('');
        }, 800);
        if (onRefreshData) onRefreshData();
      }
    } catch (err) {
      console.error('Error al editar producto:', err);
    }
  };

  // Driver CRUD State (Registrar, Editar, Eliminar Repartidor, Estadísticas)
  const [editingDriverId, setEditingDriverId] = useState<string | null>(null);
  const [selectedDriverForStats, setSelectedDriverForStats] = useState<Repartidor | null>(null);
  const [driverStatsFilter, setDriverStatsFilter] = useState<'todos' | 'turno' | 'historico'>('todos');
  const [driverStatsSearch, setDriverStatsSearch] = useState<string>('');
  const [driverForm, setDriverForm] = useState({
    nombre: '',
    vehiculo: 'moto' as 'moto' | 'bicicleta' | 'auto',
    telefono: '',
    chapa: '',
    usuario: '',
    password: '',
    disponible: true,
  });
  const [driverSuccessMsg, setDriverSuccessMsg] = useState<string>('');

  // Helper para obtener todos los pedidos entregados por un repartidor
  const getDriverDeliveredOrders = (rep: Repartidor) => {
    const repNameLower = rep.nombre.trim().toLowerCase();

    // Pedidos en el turno actual (activos)
    const turnOrders = pedidos
      .filter(
        (p) =>
          p.estado === 'entregado' &&
          (p.repartidorId === rep.id || (p.repartidorNombre && p.repartidorNombre.trim().toLowerCase() === repNameLower))
      )
      .map((p) => ({
        id: p.id,
        cliente: p.cliente,
        telefono: p.telefono,
        direccion: p.direccion,
        total: p.total || 0,
        fecha: p.fecha || '',
        origen: 'Turno Actual',
        esTurno: true,
        items: p.items || [],
      }));

    // Pedidos en cierres de caja anteriores
    const historicOrders: Array<{
      id: string;
      cliente: string;
      telefono: string;
      direccion: string;
      total: number;
      fecha: string;
      origen: string;
      esTurno: false;
      items?: string[];
    }> = [];

    cierresDeCaja.forEach((c) => {
      (c.pedidos || []).forEach((p) => {
        if (
          p.estado === 'entregado' &&
          (p.repartidorId === rep.id || (p.repartidorNombre && p.repartidorNombre.trim().toLowerCase() === repNameLower))
        ) {
          historicOrders.push({
            id: p.id,
            cliente: p.cliente,
            telefono: p.telefono,
            direccion: p.direccion,
            total: p.total || 0,
            fecha: p.fecha || c.fechaCierre,
            origen: `Cierre: ${new Date(c.fechaCierre).toLocaleDateString('es-PY')}`,
            esTurno: false,
            items: p.items || [],
          });
        }
      });
    });

    const allOrders = [...turnOrders, ...historicOrders];
    const totalMontoTurno = turnOrders.reduce((acc, o) => acc + o.total, 0);
    const totalMontoHistorico = historicOrders.reduce((acc, o) => acc + o.total, 0);
    const totalMontoGeneral = totalMontoTurno + totalMontoHistorico;

    return {
      turnOrders,
      historicOrders,
      allOrders,
      totalCount: allOrders.length,
      totalMontoTurno,
      totalMontoHistorico,
      totalMontoGeneral,
    };
  };

  const handleOpenCreateDriver = () => {
    setEditingDriverId(null);
    setDriverForm({
      nombre: '',
      vehiculo: 'moto',
      telefono: '+595 981 ',
      chapa: '',
      usuario: '',
      password: '',
      disponible: true,
    });
    setDriverSuccessMsg('');
  };

  const handleOpenEditDriver = (r: Repartidor) => {
    setEditingDriverId(r.id);
    setDriverForm({
      nombre: r.nombre || '',
      vehiculo: r.vehiculo || 'moto',
      telefono: r.telefono || '',
      chapa: r.chapa || '',
      usuario: r.usuario || '',
      password: r.password || '',
      disponible: r.disponible !== false,
    });
    setDriverSuccessMsg('');
  };

  const handleSaveDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!driverForm.nombre.trim() || !driverForm.usuario.trim() || !driverForm.password.trim()) {
      alert('Debes ingresar Nombre, Usuario y Contraseña.');
      return;
    }

    try {
      if (editingDriverId) {
        // Actualizar repartidor
        const res = await fetch(`/api/repartidores/${editingDriverId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(driverForm),
        });
        if (res.ok) {
          setDriverSuccessMsg(`Repartidor "${driverForm.nombre}" actualizado correctamente.`);
          if (onRefreshData) onRefreshData();
          setEditingDriverId(null);
        }
      } else {
        // Registrar nuevo repartidor
        const res = await fetch('/api/repartidores', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(driverForm),
        });
        if (res.ok) {
          setDriverSuccessMsg(`Nuevo repartidor "${driverForm.nombre}" registrado exitosamente.`);
          if (onRefreshData) onRefreshData();
          handleOpenCreateDriver();
        }
      }
    } catch (err) {
      console.error('Error al guardar repartidor:', err);
    }
  };

  const handleDeleteDriver = async (driverId: string, nombre: string) => {
    try {
      const res = await fetch(`/api/repartidores/${driverId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setDriverSuccessMsg(`Repartidor "${nombre}" eliminado correctamente.`);
        setTimeout(() => setDriverSuccessMsg(''), 3500);
        if (onRefreshData) onRefreshData();
      } else {
        // Fallback using socket if REST API returns non-200
        if (socket) {
          socket.emit('eliminar_repartidor', driverId);
          setDriverSuccessMsg(`Repartidor "${nombre}" eliminado correctamente.`);
          setTimeout(() => setDriverSuccessMsg(''), 3500);
          if (onRefreshData) onRefreshData();
        } else {
          console.error('No se pudo eliminar el repartidor en la API');
        }
      }
    } catch (err) {
      console.error('Error eliminando repartidor:', err);
      if (socket) {
        socket.emit('eliminar_repartidor', driverId);
        setDriverSuccessMsg(`Repartidor "${nombre}" eliminado correctamente.`);
        setTimeout(() => setDriverSuccessMsg(''), 3500);
        if (onRefreshData) onRefreshData();
      }
    } finally {
      setDeletingDriverId(null);
    }
  };

  // State for editing order details by Admin
  const [editingDetailId, setEditingDetailId] = useState<string | null>(null);
  const [editingDetailText, setEditingDetailText] = useState<string>('');

  // Form state for creating new order
  const [newOrder, setNewOrder] = useState({
    cliente: '',
    telefono: '',
    direccion: '',
    restauranteNombre: 'EL TERNERO',
    notaCliente: '',
    instruccionOptimizada: '',
    repartidorId: repartidores[0]?.id || 'REP-123',
    itemsStr: '1x Combo Especial, 1x Bebida 500ml',
    total: 55000,
  });

  const handleStartEditDetail = (pedido: Pedido) => {
    setEditingDetailId(pedido.id);
    setEditingDetailText(pedido.detallesPedido || pedido.instruccionOptimizada || pedido.notaCliente || '');
  };

  const handleSaveDetail = (pedidoId: string) => {
    if (socket) {
      socket.emit('actualizar_pedido_admin', {
        pedidoId,
        detallesPedido: editingDetailText,
      });
    }
    fetch(`/api/pedidos/${pedidoId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ detallesPedido: editingDetailText }),
    }).then(() => {
      if (onRefreshData) onRefreshData();
    });
    setEditingDetailId(null);
  };

  const handleAceptarPedidoAdmin = (pedidoId: string, markComprobanteReviewed: boolean = false) => {
    const updateBody: Partial<Pedido> = { estado: 'aceptado' };
    if (markComprobanteReviewed) {
      updateBody.comprobanteRevisado = true;
    }

    if (socket) {
      socket.emit('actualizar_pedido_admin', {
        pedidoId,
        estado: 'aceptado',
        ...(markComprobanteReviewed ? { comprobanteRevisado: true } : {}),
      });
    }
    fetch(`/api/pedidos/${pedidoId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateBody),
    }).then(() => {
      if (onRefreshData) onRefreshData();
    });
    setVerifyingPedido(null);
  };

  const handleVerificarYRevisarComprobante = (pedido: Pedido) => {
    setVerifyingPedido(pedido);
    setComprobanteReviewedCheck(Boolean(pedido.comprobanteRevisado));
  };

  const handleAceptarPedidoClick = (pedido: Pedido) => {
    if (pedido.metodoPago === 'transferencia') {
      // Abre modal para que el administrador verifique el comprobante antes de aceptar
      setVerifyingPedido(pedido);
      setComprobanteReviewedCheck(Boolean(pedido.comprobanteRevisado));
      return;
    }
    handleAceptarPedidoAdmin(pedido.id);
  };

  const handleRechazarPedidoAdmin = (pedidoId: string) => {
    if (socket) {
      socket.emit('actualizar_pedido_admin', {
        pedidoId,
        estado: 'rechazado',
      });
    }
    fetch(`/api/pedidos/${pedidoId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: 'rechazado' }),
    }).then(() => {
      if (onRefreshData) onRefreshData();
    });

    // Preguntar si también desea eliminar el pedido rechazado
    setTimeout(() => {
      if (window.confirm('El pedido ha sido marcado como RECHAZADO. ¿Deseas ELIMINARLO permanentemente del sistema también?')) {
        handleEliminarPedidoAdmin(pedidoId, false);
      }
    }, 200);
  };

  const handleEliminarPedidoAdmin = (pedidoId: string, askConfirm: boolean = true) => {
    if (askConfirm && !window.confirm('¿Estás seguro de que deseas eliminar este pedido permanentemente?')) {
      return;
    }
    if (socket) {
      socket.emit('eliminar_pedido', pedidoId);
    }
    fetch(`/api/pedidos/${pedidoId}`, {
      method: 'DELETE',
    }).then(() => {
      if (onRefreshData) onRefreshData();
    });
  };

  const handleAssignRepartidor = (pedidoId: string, repartidorId: string) => {
    const selectedRep = repartidores.find((r) => r.id === repartidorId);
    if (socket) {
      socket.emit('actualizar_pedido_admin', {
        pedidoId,
        repartidorId,
        repartidorNombre: selectedRep?.nombre || 'Repartidor',
      });
    }
    fetch(`/api/pedidos/${pedidoId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        repartidorId,
        repartidorNombre: selectedRep?.nombre || 'Repartidor',
      }),
    }).then(() => {
      if (onRefreshData) onRefreshData();
    });
  };

  // Handle local image file upload (file reader to base64 data URL)
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setPreviewImage(result);
        setNewProduct((prev) => ({ ...prev, fotoUrl: result }));
      };
      reader.readAsDataURL(file);
    }
  };

  // Submit product creation to API
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProduct.nombre.trim()) return;

    try {
      const res = await fetch('/api/productos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newProduct,
          fotoUrl: previewImage || newProduct.fotoUrl || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&auto=format&fit=crop&q=80",
        }),
      });

      if (res.ok) {
        setUploadSuccess(true);
        setTimeout(() => setUploadSuccess(false), 3000);

        setNewProduct({
          nombre: '',
          cantidad: 10,
          monto: 25000,
          fotoUrl: '',
          categoria: 'General',
          descripcion: '',
        });
        setPreviewImage('');
        if (onRefreshData) onRefreshData();
      }
    } catch (err) {
      console.error('Error al guardar producto:', err);
    }
  };

  // Delete product
  const handleDeleteProduct = async (prodId: string) => {
    try {
      const res = await fetch(`/api/productos/${prodId}`, {
        method: 'DELETE',
      });
      if (res.ok && onRefreshData) {
        onRefreshData();
      }
    } catch (err) {
      console.error('Error eliminando producto:', err);
    }
  };

  // Call Gemini AI Endpoint to summarize customer note
  const handleOptimizarConIA = async () => {
    if (!newOrder.notaCliente.trim()) return;

    setLoadingAi(true);
    try {
      const res = await fetch('/api/ia/resumir-instrucciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notaCliente: newOrder.notaCliente }),
      });
      const data = await res.json();
      if (data.instruccionOptimizada) {
        setNewOrder((prev) => ({
          ...prev,
          instruccionOptimizada: data.instruccionOptimizada,
        }));
      }
    } catch (err) {
      console.error('Error opt con IA:', err);
    } finally {
      setLoadingAi(false);
    }
  };

  // Submit new order to backend API
  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();

    const selectedRep = repartidores.find((r) => r.id === newOrder.repartidorId);

    const payload = {
      cliente: newOrder.cliente || 'Cliente Anónimo',
      telefono: newOrder.telefono || '+595 991 000000',
      direccion: newOrder.direccion || 'Av. España 1000',
      latitudCliente: -25.2900 + (Math.random() - 0.5) * 0.02,
      longitudCliente: -57.6200 + (Math.random() - 0.5) * 0.02,
      restauranteNombre: newOrder.restauranteNombre,
      latitudRestaurante: -25.1747,
      longitudRestaurante: -57.48334,
      repartidorId: newOrder.repartidorId,
      repartidorNombre: selectedRep?.nombre || 'Juan Pérez',
      notaCliente: newOrder.notaCliente,
      instruccionOptimizada: newOrder.instruccionOptimizada || newOrder.notaCliente,
      items: newOrder.itemsStr.split(',').map((s) => s.trim()),
      total: Number(newOrder.total) || 50000,
    };

    try {
      const res = await fetch('/api/pedidos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setShowModalPedido(false);
        setNewOrder({
          cliente: '',
          telefono: '',
          direccion: '',
          restauranteNombre: 'Burger Grill Express',
          notaCliente: '',
          instruccionOptimizada: '',
          repartidorId: repartidores[0]?.id || 'REP-123',
          itemsStr: '1x Combo Especial, 1x Bebida 500ml',
          total: 55000,
        });
        if (onRefreshData) onRefreshData();
      }
    } catch (err) {
      console.error('Error creando pedido:', err);
    }
  };

  // Change state of existing order
  const handleCambiarEstado = (pedidoId: string, nuevoEstado: Pedido['estado']) => {
    if (socket) {
      socket.emit('cambiar_estado_pedido', { pedidoId, estado: nuevoEstado });
    }
  };

  const filteredPedidos = pedidos.filter(
    (p) =>
      p.id.toLowerCase().includes(filterText.toLowerCase()) ||
      p.cliente.toLowerCase().includes(filterText.toLowerCase()) ||
      p.repartidorNombre.toLowerCase().includes(filterText.toLowerCase())
  );

  const filteredProductos = productos.filter(
    (p) =>
      p.nombre.toLowerCase().includes(filterProductText.toLowerCase()) ||
      (p.categoria && p.categoria.toLowerCase().includes(filterProductText.toLowerCase()))
  );

  const totalSalesToday = pedidos
    .filter((p) => p.estado !== 'rechazado')
    .reduce((acc, p) => acc + p.total, 0);

  const activeOrdersCount = pedidos.filter(
    (p) => p.estado === 'recibido' || p.estado === 'preparando' || p.estado === 'en_camino'
  ).length;

  const activeDriversCount = repartidores.filter((r) => r.activo).length;

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <img
              src={currentLogo}
              alt="EL TERNERO Logo"
              className="w-14 h-14 rounded-full object-contain bg-black border-2 border-emerald-500 shadow-xl shadow-emerald-500/20 ring-1 ring-slate-800 shrink-0"
            />
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-black text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  PANEL EJECUTIVO ADMINISTRADOR
                </span>
                <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[11px] font-mono px-2 py-0.5 rounded-md font-semibold">
                  EL TERNERO WEB
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-100 flex items-center gap-3">
                <span>
                  {activeTab === 'envios'
                    ? 'Recepción y Despacho de Pedidos'
                    : activeTab === 'mesas_salon'
                    ? 'Salón y Gestión de 15 Mesas (Cuadros)'
                    : activeTab === 'mapa_vivo'
                    ? 'Mapa Vivo de Repartidores y Flota GPS'
                    : activeTab === 'productos'
                    ? 'Carga y Catálogo de Productos'
                    : activeTab === 'repartidores'
                    ? 'Gestión de Repartidores (Registro y Flota)'
                    : activeTab === 'portadas_categorias'
                    ? 'Creación y Gestión de Categorías del Menú'
                    : activeTab === 'cierre_caja'
                    ? 'Cierre de Caja y Reportes Financieros'
                    : activeTab === 'clientes'
                    ? 'Directorio de Clientes Registrados'
                    : activeTab === 'notificaciones'
                    ? 'Centro de Notificaciones Push & Promos'
                    : 'Ubicación del Local & Punto GPS'}
                </span>
                {onLogout && (
                  <button
                    onClick={onLogout}
                    className="text-xs font-bold text-slate-400 hover:text-rose-400 border border-slate-700 bg-slate-950/80 hover:bg-slate-950 px-3 py-1.5 rounded-xl transition-all inline-flex items-center gap-1.5 shadow-sm"
                    title="Cerrar Sesión Administrador"
                  >
                    <LogOut className="w-4 h-4 text-rose-400" />
                    <span>Salir</span>
                  </button>
                )}
              </h2>
            </div>
          </div>

          {/* Quick Action Button */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowModalPedido(true)}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold px-4 py-2.5 rounded-xl text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-emerald-500/25 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Crear Pedido Manual</span>
            </button>
          </div>
        </div>

        {/* Executive Quick Stats Metrics Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
          <div className="bg-slate-950/70 border border-slate-800/90 rounded-xl p-3.5 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-400 block uppercase">Ventas Registradas</span>
              <span className="text-base sm:text-lg font-mono font-black text-emerald-400">Gs. {totalSalesToday.toLocaleString()}</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <Receipt className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-slate-950/70 border border-slate-800/90 rounded-xl p-3.5 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-400 block uppercase">Pedidos En Curso</span>
              <span className="text-base sm:text-lg font-mono font-black text-slate-100">{activeOrdersCount} <span className="text-xs font-normal text-slate-400">/ {pedidos.length} tot.</span></span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <ShoppingBag className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-slate-950/70 border border-slate-800/90 rounded-xl p-3.5 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-400 block uppercase">Repartidores Activos</span>
              <span className="text-base sm:text-lg font-mono font-black text-slate-100">{activeDriversCount} <span className="text-xs font-normal text-slate-400">/ {repartidores.length}</span></span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <Bike className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-slate-950/70 border border-slate-800/90 rounded-xl p-3.5 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-400 block uppercase">Base de Clientes</span>
              <span className="text-base sm:text-lg font-mono font-black text-slate-100">{clientesList.length}</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <Users className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Organized Desktop Navigation Ribbon */}
        <div className="bg-slate-950/90 p-2 rounded-xl border border-slate-800/90">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setActiveTab('envios')}
              className={`px-3.5 py-2 rounded-lg text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'envios'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20 ring-1 ring-emerald-400'
                  : 'text-slate-300 hover:text-white hover:bg-slate-900'
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Recepción y Envíos</span>
              {activeOrdersCount > 0 && (
                <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono ${
                  activeTab === 'envios' ? 'bg-slate-950 text-emerald-400 font-black' : 'bg-emerald-500 text-slate-950 font-black'
                }`}>
                  {activeOrdersCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('mesas_salon')}
              className={`px-3.5 py-2 rounded-lg text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'mesas_salon'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20 ring-1 ring-emerald-400'
                  : 'text-slate-300 hover:text-white hover:bg-slate-900'
              }`}
            >
              <LayoutGrid className="w-4 h-4 text-emerald-400" />
              <span>Salón (15 Mesas)</span>
            </button>

            <button
              onClick={() => setActiveTab('mapa_vivo')}
              className={`px-3.5 py-2 rounded-lg text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'mapa_vivo'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20 ring-1 ring-emerald-400'
                  : 'text-slate-300 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Radio className="w-4 h-4 text-emerald-400" />
              <span>Mapa Vivo GPS</span>
            </button>

            <div className="h-5 w-[1px] bg-slate-800 mx-1 hidden sm:block" />

            <button
              onClick={() => setActiveTab('productos')}
              className={`px-3.5 py-2 rounded-lg text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'productos'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20 ring-1 ring-emerald-400'
                  : 'text-slate-300 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Package className="w-4 h-4" />
              <span>Catálogo Productos ({productos.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('portadas_categorias')}
              className={`px-3.5 py-2 rounded-lg text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'portadas_categorias'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20 ring-1 ring-emerald-400'
                  : 'text-slate-300 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Image className="w-4 h-4 text-emerald-400" />
              <span>Categorías</span>
            </button>

            <div className="h-5 w-[1px] bg-slate-800 mx-1 hidden sm:block" />

            <button
              onClick={() => setActiveTab('repartidores')}
              className={`px-3.5 py-2 rounded-lg text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'repartidores'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20 ring-1 ring-emerald-400'
                  : 'text-slate-300 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Bike className="w-4 h-4" />
              <span>Repartidores ({repartidores.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('clientes')}
              className={`px-3.5 py-2 rounded-lg text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'clientes'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20 ring-1 ring-emerald-400'
                  : 'text-slate-300 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Clientes ({clientesList.length})</span>
            </button>

            <div className="h-5 w-[1px] bg-slate-800 mx-1 hidden sm:block" />

            <button
              onClick={() => setActiveTab('cierre_caja')}
              className={`px-3.5 py-2 rounded-lg text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'cierre_caja'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20 ring-1 ring-emerald-400'
                  : 'text-slate-300 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Coins className="w-4 h-4 text-emerald-400" />
              <span>Cierre de Caja</span>
            </button>

            <button
              onClick={() => setActiveTab('ubicacion_local')}
              className={`px-3.5 py-2 rounded-lg text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'ubicacion_local'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20 ring-1 ring-emerald-400'
                  : 'text-slate-300 hover:text-white hover:bg-slate-900'
              }`}
            >
              <MapPin className="w-4 h-4 text-emerald-400" />
              <span>Ubicación Local</span>
            </button>

            <button
              onClick={() => setActiveTab('notificaciones')}
              className={`px-3.5 py-2 rounded-lg text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'notificaciones'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20 ring-1 ring-emerald-400'
                  : 'text-slate-300 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Bell className="w-4 h-4 text-emerald-400" />
              <span>Notificaciones & Promos</span>
            </button>
          </div>
        </div>
      </div>

      {/* TAB 1: RECEPCIÓN Y GESTIÓN RÁPIDA DE ENVIOS (Sin mapa pesado para no obstaculizar la recepción) */}
      {activeTab === 'envios' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-emerald-400" />
              Recepción y Despacho de Pedidos en Tiempo Real
            </h3>

              <div className="flex items-center gap-3">
                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Buscar cliente o ID..."
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-xl pl-9 pr-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <button
                  onClick={() => setShowModalPedido(true)}
                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  Crear Pedido
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-800/80 text-slate-400 uppercase font-mono text-[11px] border-b border-slate-700">
                  <tr>
                    <th className="py-3 px-4">ID Pedido</th>
                    <th className="py-3 px-4">Cliente / Dirección</th>
                    <th className="py-3 px-4">Repartidor Asignado</th>
                    <th className="py-3 px-4 min-w-[150px]">Método / Pago</th>
                    <th className="py-3 px-4 min-w-[240px]">Detalles del Pedido (Admin)</th>
                    <th className="py-3 px-4">Estado</th>
                    <th className="py-3 px-4 text-center">Decisión Admin</th>
                    <th className="py-3 px-4 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredPedidos.map((pedido) => {
                    const isEditingThisDetail = editingDetailId === pedido.id;

                    return (
                      <tr key={pedido.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-emerald-400">
                          {pedido.id}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-200">{pedido.cliente}</div>
                          <div className="text-[11px] text-slate-400">{pedido.direccion}</div>
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5">📞 {pedido.telefono}</div>
                        </td>

                        {/* Repartidor Asignado */}
                        <td className="py-3 px-4">
                          <select
                            value={pedido.repartidorId}
                            onChange={(e) => handleAssignRepartidor(pedido.id, e.target.value)}
                            className="bg-slate-800 border border-slate-700 text-slate-200 text-[11px] rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          >
                            {repartidores.map((r) => (
                              <option key={r.id} value={r.id}>
                                🚴 {r.nombre} ({r.vehiculo})
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* MÉTODO DE PAGO Y COMPROBANTE DE TRANSFERENCIA */}
                        <td className="py-3 px-4">
                          <div className="space-y-1.5">
                            <div>
                              {pedido.metodoPago === 'transferencia' ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                                  <Landmark className="w-3 h-3 text-indigo-400" />
                                  Transferencia
                                </span>
                              ) : pedido.metodoPago === 'gpay' ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/40">
                                  <CreditCard className="w-3 h-3 text-sky-400" />
                                  Google Pay
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                  <Banknote className="w-3 h-3 text-emerald-400" />
                                  Efectivo
                                </span>
                              )}
                            </div>

                            {pedido.metodoPago === 'efectivo' && pedido.montoPagaCon && (
                              <div className="text-[10px] font-mono text-slate-400 bg-slate-950 px-2 py-1 rounded-md border border-slate-800">
                                <span>Paga con: </span>
                                <span className="text-slate-200 font-bold">Gs. {pedido.montoPagaCon.toLocaleString()}</span>
                                {pedido.montoPagaCon > pedido.total && (
                                  <div className="text-emerald-400 font-semibold">
                                    Vuelto: Gs. {(pedido.montoPagaCon - pedido.total).toLocaleString()}
                                  </div>
                                )}
                              </div>
                            )}

                            {pedido.metodoPago === 'transferencia' && (
                              <div className="space-y-1">
                                {pedido.comprobanteUrl ? (
                                  <button
                                    type="button"
                                    onClick={() => handleVerificarYRevisarComprobante(pedido)}
                                    className="w-full text-[10px] font-bold px-2 py-1 rounded-lg bg-indigo-950/90 hover:bg-indigo-900 border border-indigo-500/50 text-indigo-200 flex items-center justify-between gap-1 transition-all cursor-pointer shadow-sm"
                                  >
                                    <span className="flex items-center gap-1">
                                      <Eye className="w-3 h-3 text-indigo-400" />
                                      Comprobante
                                    </span>
                                    {pedido.comprobanteRevisado ? (
                                      <span className="text-[9px] bg-emerald-500/30 text-emerald-300 px-1 rounded font-mono">
                                        ✓ Revisado
                                      </span>
                                    ) : (
                                      <span className="text-[9px] bg-amber-500/30 text-amber-300 px-1 rounded font-mono animate-pulse">
                                        ⚠️ Revisar
                                      </span>
                                    )}
                                  </button>
                                ) : (
                                  <span className="text-[10px] text-slate-500 italic block">Sin foto adjunta</span>
                                )}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* DETALLES DEL PEDIDO (ESCRITO POR ADMINISTRADOR) */}
                        <td className="py-3 px-4 min-w-[240px]">
                          {isEditingThisDetail ? (
                            <div className="space-y-2 bg-slate-950 p-2.5 rounded-xl border border-emerald-500/50 shadow-lg">
                              <label className="text-[10px] font-bold uppercase text-emerald-400 block">
                                Escribir Detalle del Pedido:
                              </label>
                              <textarea
                                value={editingDetailText}
                                onChange={(e) => setEditingDetailText(e.target.value)}
                                rows={3}
                                placeholder="Escribe aquí los detalles del pedido para el cliente y repartidor..."
                                className="w-full bg-slate-900 border border-slate-700 text-slate-100 rounded-lg p-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 font-sans"
                              />
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleSaveDetail(pedido.id)}
                                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-3 py-1 rounded-lg text-[11px] flex items-center gap-1 shadow-md"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  Guardar Detalle
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingDetailId(null)}
                                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium px-2.5 py-1 rounded-lg text-[11px]"
                                >
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="bg-slate-950/70 border border-slate-800 p-2.5 rounded-xl space-y-1.5">
                              <p className="text-xs text-slate-200 font-medium leading-relaxed">
                                "{pedido.detallesPedido || pedido.instruccionOptimizada || pedido.notaCliente || 'Sin detalles adicionales.'}"
                              </p>
                              <button
                                type="button"
                                onClick={() => handleStartEditDetail(pedido)}
                                className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 bg-slate-900 px-2 py-0.5 rounded border border-slate-800 transition-colors"
                              >
                                ✏️ Escribir / Editar Detalle del Pedido
                              </button>
                            </div>
                          )}
                        </td>

                        {/* Estado actual */}
                        <td className="py-3 px-4">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase inline-block ${
                              pedido.estado === 'entregado'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : pedido.estado === 'en_camino'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : pedido.estado === 'aceptado' || pedido.estado === 'preparando'
                                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                : pedido.estado === 'rechazado'
                                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                : 'bg-slate-700/40 text-slate-300 border border-slate-600'
                            }`}
                          >
                            {pedido.estado === 'recibido' ? 'Pendiente' : pedido.estado}
                          </span>
                        </td>

                        {/* DECISIÓN ADMINISTRADOR: ACEPTAR O RECHAZAR */}
                        <td className="py-3 px-4 text-center">
                          <div className="flex flex-col items-center gap-1.5">
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleAceptarPedidoClick(pedido)}
                                title={pedido.metodoPago === 'transferencia' ? 'Verificar comprobante y aceptar pedido' : 'Aceptar pedido del cliente'}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold flex items-center gap-1 transition-all ${
                                  pedido.estado === 'aceptado' || pedido.estado === 'preparando' || pedido.estado === 'en_camino' || pedido.estado === 'entregado'
                                    ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20 ring-1 ring-emerald-400'
                                    : 'bg-emerald-950/80 hover:bg-emerald-600 hover:text-slate-950 text-emerald-400 border border-emerald-500/50'
                                }`}
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Aceptar
                              </button>

                              <button
                                type="button"
                                onClick={() => handleRechazarPedidoAdmin(pedido.id)}
                                title="Rechazar pedido del cliente (permite eliminar también)"
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold flex items-center gap-1 transition-all ${
                                  pedido.estado === 'rechazado'
                                    ? 'bg-rose-600 text-slate-100 shadow-md shadow-rose-600/30 ring-1 ring-rose-400'
                                    : 'bg-rose-950/80 hover:bg-rose-600 hover:text-slate-100 text-rose-400 border border-rose-500/50'
                                }`}
                              >
                                <AlertCircle className="w-3.5 h-3.5" />
                                Rechazar
                              </button>

                              <button
                                type="button"
                                onClick={() => handleEliminarPedidoAdmin(pedido.id)}
                                title="Eliminar este pedido permanentemente"
                                className="px-2.5 py-1 rounded-lg text-[10px] font-extrabold flex items-center gap-1 transition-all bg-red-950/90 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/50 shadow-sm"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Eliminar
                              </button>
                            </div>

                            {pedido.estado === 'rechazado' && (
                              <button
                                type="button"
                                onClick={() => handleEliminarPedidoAdmin(pedido.id, false)}
                                className="w-full text-[10px] font-bold text-rose-300 bg-rose-950/90 hover:bg-rose-600 hover:text-white px-2 py-1 rounded-lg border border-rose-500/40 flex items-center justify-center gap-1 animate-pulse"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Eliminar Pedido Rechazado</span>
                              </button>
                            )}

                            <select
                              value={pedido.estado}
                              onChange={(e) =>
                                handleCambiarEstado(pedido.id, e.target.value as Pedido['estado'])
                              }
                              className="bg-slate-800 border border-slate-700 text-slate-300 text-[10px] rounded px-1.5 py-0.5 focus:outline-none"
                            >
                              <option value="recibido">Pendiente (Recibido)</option>
                              <option value="aceptado">Aceptado</option>
                              <option value="preparando">Preparando</option>
                              <option value="en_camino">En Camino</option>
                              <option value="entregado">Entregado</option>
                              <option value="rechazado">Rechazado</option>
                            </select>
                          </div>
                        </td>

                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-200">
                          Gs. {pedido.total.toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

      {/* TAB: SALÓN Y GESTIÓN DE 15 MESAS EN CUADROS */}
      {activeTab === 'mesas_salon' && (
        <div className="space-y-4">
          <WaiterView
            socket={socket}
            productos={productos}
            logoUrl={currentLogo}
            restauranteConfig={restauranteConfig}
            onRefreshData={onRefreshData}
          />
        </div>
      )}

      {/* TAB INDEPENDIENTE: MAPA EN VIVO DE REPARTIDORES (SEPARADO PARA NO OBSTACULIZAR RECEPCION DE PEDIDOS) */}
      {activeTab === 'mapa_vivo' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-300 flex-wrap gap-2">
            <span className="font-semibold text-emerald-400 flex items-center gap-1.5 text-sm">
              <Radio className="w-5 h-5 text-emerald-400 animate-pulse" />
              Mapa Vivo de Flota en Tiempo Real (Repartidores, Tiempos ETA y Clientes)
            </span>
            <span className="text-slate-400 font-mono bg-slate-950 px-3 py-1 rounded-lg border border-slate-800">
              {repartidores.length} Repartidores Monitoreados • GPS Activo
            </span>
          </div>
          <InteractiveMap
            isAdmin={true}
            pedidos={pedidos}
            repartidores={repartidores}
            logoUrl={currentLogo}
            mapHeightClassName="h-[620px] sm:h-[750px] lg:h-[82vh]"
            customStorePin={{
              lat: restauranteConfig?.latitud ?? -25.1747,
              lon: restauranteConfig?.longitud ?? -57.48334,
              nombre: restauranteConfig?.nombre || 'EL TERNERO',
            }}
          />
        </div>
      )}

      {/* TAB 2: CARGA Y GESTIÓN DE PRODUCTOS (SOLICITADO POR EL USUARIO) */}
      {activeTab === 'productos' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Form Column: Add Product */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 flex-wrap gap-2">
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <Package className="w-5 h-5 text-emerald-400" />
                  Cargar Nuevo Producto
                </h3>
                <button
                  type="button"
                  onClick={() => setShowCreateCategoryModal(true)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-slate-950 font-bold border border-emerald-500/40 text-[11px] transition-all flex items-center gap-1 shrink-0 shadow-md"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Crear Nueva Categoría</span>
                </button>
              </div>

              {uploadSuccess && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-3 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  ¡Producto guardado exitosamente en el catálogo!
                </div>
              )}

              <form onSubmit={handleCreateProduct} className="space-y-4 text-xs">
                {/* Nombre del Producto */}
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Nombre del Producto:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Hamburguesa Doble con Queso Cheddar"
                    value={newProduct.nombre}
                    onChange={(e) => setNewProduct({ ...newProduct, nombre: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* Cantidad y Monto */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      Cantidad / Stock:
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      placeholder="Ej. 20"
                      value={newProduct.cantidad}
                      onChange={(e) => setNewProduct({ ...newProduct, cantidad: Number(e.target.value) })}
                      className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-xl px-3.5 py-2.5 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      Monto / Precio (Gs.):
                    </label>
                    <input
                      type="number"
                      required
                      step="500"
                      placeholder="Ej. 35000"
                      value={newProduct.monto}
                      onChange={(e) => setNewProduct({ ...newProduct, monto: Number(e.target.value) })}
                      className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-xl px-3.5 py-2.5 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                {/* Categoría */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-300 font-semibold">Categoría:</label>
                    <button
                      type="button"
                      onClick={() => setIsCustomCategoryMode(!isCustomCategoryMode)}
                      className="text-[11px] text-emerald-400 hover:underline font-bold flex items-center gap-1"
                    >
                      {isCustomCategoryMode ? '← Seleccionar de la lista' : '➕ Crear Nueva Categoría'}
                    </button>
                  </div>
                  {isCustomCategoryMode ? (
                    <input
                      type="text"
                      required
                      placeholder="Escribe el nombre de la nueva categoría (ej. Combos, Entradas)..."
                      value={newProduct.categoria}
                      onChange={(e) => setNewProduct({ ...newProduct, categoria: e.target.value })}
                      className="w-full bg-slate-800 border border-emerald-500/50 text-slate-100 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  ) : (
                    <select
                      value={newProduct.categoria}
                      onChange={(e) => {
                        if (e.target.value === '__NEW__') {
                          setIsCustomCategoryMode(true);
                          setNewProduct({ ...newProduct, categoria: '' });
                        } else {
                          setNewProduct({ ...newProduct, categoria: e.target.value });
                        }
                      }}
                      className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                    >
                      {allCategoryIds.map((catId) => (
                        <option key={catId} value={catId}>
                          {catId}
                        </option>
                      ))}
                      <option value="General">General</option>
                      <option value="__NEW__">➕ Escribir Nueva Categoría...</option>
                    </select>
                  )}
                </div>

                {/* Foto Input Option 1: Direct File Upload */}
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Foto del Producto (Subir archivo o pegar enlace URL):
                  </label>
                  <div className="space-y-3">
                    {/* File Upload Box */}
                    <div className="relative border-2 border-dashed border-slate-700 hover:border-emerald-500/50 bg-slate-800/50 rounded-xl p-4 text-center cursor-pointer transition-colors">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageFileChange}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <Upload className="w-6 h-6 text-emerald-400 mx-auto mb-1" />
                      <p className="text-xs text-slate-300 font-semibold">
                        Haz clic o arrastra una imagen aquí
                      </p>
                      <p className="text-[10px] text-slate-500">JPG, PNG o WEBP (Base64 automático)</p>
                    </div>

                    {/* URL Link Input Option */}
                    <div className="flex items-center gap-2">
                      <Image className="w-4 h-4 text-slate-500 shrink-0" />
                      <input
                        type="url"
                        placeholder="O pega un enlace de imagen HTTPS..."
                        value={newProduct.fotoUrl}
                        onChange={(e) => {
                          setNewProduct({ ...newProduct, fotoUrl: e.target.value });
                          setPreviewImage(e.target.value);
                        }}
                        className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                      />
                    </div>

                    {/* Quick Food Presets Grid */}
                    <div className="space-y-1 pt-1">
                      <span className="text-[10px] text-slate-400 font-semibold block">
                        O selecciona una foto de portada sugerida:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {FOOD_COVER_PRESETS.map((p, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              setNewProduct({ ...newProduct, fotoUrl: p.url });
                              setPreviewImage(p.url);
                            }}
                            className="text-[10px] bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 hover:border-emerald-500/50 px-2 py-0.5 rounded-lg transition-all"
                          >
                            📷 {p.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Photo Preview Box */}
                {(previewImage || newProduct.fotoUrl) && (
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center gap-3">
                    <img
                      src={previewImage || newProduct.fotoUrl}
                      alt="Vista previa"
                      className="w-16 h-16 object-cover rounded-lg border border-slate-700"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&auto=format&fit=crop&q=80';
                      }}
                    />
                    <div>
                      <span className="text-[11px] font-bold text-emerald-400 block">
                        ✓ Foto Seleccionada
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Se incluirá en el catálogo para envíos
                      </span>
                    </div>
                  </div>
                )}

                {/* Descripcion */}
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Descripción / Detalles:
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Descripción opcional del producto..."
                    value={newProduct.descripcion}
                    onChange={(e) => setNewProduct({ ...newProduct, descripcion: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3 rounded-xl shadow-lg shadow-emerald-500/20 text-xs flex items-center justify-center gap-2 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Guardar Producto en Catálogo
                </button>
              </form>
            </div>
          </div>

          {/* Catalog Column: List Products */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
                    <Package className="w-4 h-4 text-emerald-400" />
                    Catálogo de Productos ({productos.length})
                  </h3>
                  <p className="text-xs text-slate-400">
                    Productos cargados disponibles para armar pedidos de delivery
                  </p>
                </div>

                <div className="relative w-full sm:w-56">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Filtrar productos..."
                    value={filterProductText}
                    onChange={(e) => setFilterProductText(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-xl pl-9 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Product Cards Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 pt-2">
                {filteredProductos.map((prod) => (
                  <div
                    key={prod.id}
                    className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden flex flex-col justify-between hover:border-emerald-500/50 transition-all shadow-sm group relative"
                  >
                    {/* Top Image Banner */}
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

                      {/* Category Badge */}
                      <span className="absolute top-2 left-2 text-[9px] font-mono font-bold text-slate-200 bg-slate-950/80 backdrop-blur-md px-2 py-0.5 rounded-full border border-slate-700 uppercase">
                        {prod.categoria || 'General'}
                      </span>

                      {/* Action buttons on top right */}
                      <div className="absolute top-2 right-2 flex items-center gap-1 bg-slate-950/85 backdrop-blur-md px-1.5 py-0.5 rounded-lg border border-slate-800">
                        <button
                          onClick={() => handleOpenCoverPhotoModal(prod)}
                          className="text-slate-300 hover:text-emerald-400 p-0.5 hover:bg-slate-800 rounded transition-colors flex items-center gap-0.5 text-[9px] font-bold"
                          title="Cargar / Cambiar Foto de Portada"
                        >
                          <Upload className="w-3 h-3 text-emerald-400" />
                          <span>Foto</span>
                        </button>
                        <span className="text-slate-700 text-[10px]">|</span>
                        <button
                          onClick={() => handleOpenEditProduct(prod)}
                          className="text-slate-300 hover:text-indigo-400 p-0.5 hover:bg-slate-800 rounded transition-colors flex items-center gap-0.5 text-[9px] font-bold"
                          title="Editar producto"
                        >
                          <Edit className="w-3 h-3 text-indigo-400" />
                          <span>Edit</span>
                        </button>
                        <span className="text-slate-700 text-[10px]">|</span>
                        <button
                          onClick={() => handleDeleteProduct(prod.id)}
                          className="text-slate-300 hover:text-rose-400 p-0.5 hover:bg-slate-800 rounded transition-colors flex items-center gap-0.5 text-[9px] font-bold"
                          title="Eliminar producto"
                        >
                          <Trash2 className="w-3 h-3 text-rose-400" />
                        </button>
                      </div>

                      {/* Price on bottom left of image */}
                      <div className="absolute bottom-2 left-2 bg-emerald-500 text-slate-950 font-mono font-extrabold text-[11px] px-2 py-0.5 rounded-full shadow-md shadow-emerald-500/30">
                        Gs. {prod.monto.toLocaleString()}
                      </div>

                      {/* Stock on bottom right */}
                      <div className="absolute bottom-2 right-2 text-[9px] font-mono font-bold text-slate-200 bg-slate-900/90 backdrop-blur-md px-1.5 py-0.5 rounded-full border border-slate-700">
                        {prod.cantidad} u.
                      </div>
                    </div>

                    {/* Card Content */}
                    <div className="p-3 flex-1 flex flex-col justify-between space-y-2">
                      <div>
                        <h4 className="text-xs font-bold text-slate-100 line-clamp-1">
                          {prod.nombre}
                        </h4>
                        <p className="text-[11px] text-slate-400 line-clamp-1 italic mt-0.5">
                          {prod.descripcion || 'Sin descripción'}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setNewOrder((prev) => ({
                            ...prev,
                            itemsStr: `${prev.itemsStr ? prev.itemsStr + ', ' : ''}1x ${prod.nombre}`,
                            total: prev.total + prod.monto,
                          }));
                          setShowModalPedido(true);
                        }}
                        className="w-full py-1.5 bg-slate-800 hover:bg-indigo-600/30 text-indigo-300 hover:text-indigo-200 font-bold text-[11px] rounded-xl border border-slate-700/80 hover:border-indigo-500/50 transition-all flex items-center justify-center gap-1"
                      >
                        <Plus className="w-3 h-3 text-indigo-400" />
                        <span>+ Pedido</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PARA EDITAR PRODUCTO */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative space-y-4 my-8 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
                <Edit className="w-4 h-4 text-emerald-400" />
                Editar Producto ({editingProduct.id})
              </h3>
              <button
                onClick={() => setEditingProduct(null)}
                className="text-slate-400 hover:text-slate-100 p-1 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editProdSuccessMsg && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs p-3 rounded-xl flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{editProdSuccessMsg}</span>
              </div>
            )}

            <form onSubmit={handleSaveEditProduct} className="space-y-4 text-xs">
              {/* Nombre */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Nombre del Producto:</label>
                <input
                  type="text"
                  required
                  value={editingProduct.nombre}
                  onChange={(e) => setEditingProduct({ ...editingProduct, nombre: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Monto & Cantidad */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Precio (Gs.):</label>
                  <input
                    type="number"
                    required
                    min={0}
                    step={500}
                    value={editingProduct.monto}
                    onChange={(e) => setEditingProduct({ ...editingProduct, monto: Number(e.target.value) })}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Stock disponible:</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={editingProduct.cantidad}
                    onChange={(e) => setEditingProduct({ ...editingProduct, cantidad: Number(e.target.value) })}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                </div>
              </div>

              {/* Categoria */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Categoría:</label>
                <select
                  value={editingProduct.categoria || 'General'}
                  onChange={(e) => setEditingProduct({ ...editingProduct, categoria: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                >
                  {allCategoryIds.map((catId) => (
                    <option key={catId} value={catId}>
                      {catId}
                    </option>
                  ))}
                  <option value="General">General</option>
                </select>
              </div>

              {/* Foto Upload or URL */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Foto del Producto:</label>
                <div className="space-y-3">
                  <div className="relative border-2 border-dashed border-slate-700 hover:border-emerald-500/50 bg-slate-800/50 rounded-xl p-3 text-center cursor-pointer transition-colors">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleEditProductFileChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <Upload className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
                    <p className="text-xs text-slate-300 font-semibold">
                      Haz clic o arrastra para reemplazar la foto
                    </p>
                    <p className="text-[10px] text-slate-500">JPG, PNG o WEBP</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Image className="w-4 h-4 text-slate-500 shrink-0" />
                    <input
                      type="url"
                      placeholder="O pega un enlace HTTPS..."
                      value={editingProduct.fotoUrl}
                      onChange={(e) => {
                        setEditingProduct({ ...editingProduct, fotoUrl: e.target.value });
                        setEditProdImagePreview(e.target.value);
                      }}
                      className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                    />
                  </div>
                  <div className="space-y-1 pt-1">
                    <span className="text-[10px] text-slate-400 font-semibold block">
                      O selecciona una foto de portada sugerida:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {FOOD_COVER_PRESETS.map((p, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setEditingProduct({ ...editingProduct, fotoUrl: p.url });
                            setEditProdImagePreview(p.url);
                          }}
                          className="text-[10px] bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 hover:border-emerald-500/50 px-2 py-0.5 rounded-lg transition-all"
                        >
                          📷 {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Preview image */}
              {(editProdImagePreview || editingProduct.fotoUrl) && (
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex items-center gap-3">
                  <img
                    src={editProdImagePreview || editingProduct.fotoUrl}
                    alt="Vista previa"
                    className="w-14 h-14 object-cover rounded-lg border border-slate-700 bg-slate-900"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&auto=format&fit=crop&q=80';
                    }}
                  />
                  <div>
                    <span className="text-[11px] font-bold text-emerald-400 block">
                      ✓ Foto Seleccionada
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Se actualizará en el catálogo global
                    </span>
                  </div>
                </div>
              )}

              {/* Descripcion */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Descripción / Detalles:</label>
                <textarea
                  rows={2}
                  value={editingProduct.descripcion || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, descripcion: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EXCLUSIVO PARA CARGAR FOTO DE PORTADA DEL PRODUCTO */}
      {photoModalProduct && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative space-y-4 my-8 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
                <Upload className="w-4 h-4 text-emerald-400" />
                Cargar Foto de Portada ({photoModalProduct.nombre})
              </h3>
              <button
                onClick={() => setPhotoModalProduct(null)}
                className="text-slate-400 hover:text-slate-100 p-1 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {photoModalSuccessMsg && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs p-3 rounded-xl flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{photoModalSuccessMsg}</span>
              </div>
            )}

            <form onSubmit={handleSaveCoverPhoto} className="space-y-4 text-xs">
              {/* Product Info Summary */}
              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-200 text-xs">{photoModalProduct.nombre}</h4>
                  <span className="text-[10px] text-emerald-400 font-mono">
                    Gs. {photoModalProduct.monto.toLocaleString()} • {photoModalProduct.categoria}
                  </span>
                </div>
                <span className="text-[10px] font-bold bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full border border-slate-700">
                  ID: {photoModalProduct.id}
                </span>
              </div>

              {/* Upload Dropzone */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Subir Foto desde tu Equipo:
                </label>
                <div className="relative border-2 border-dashed border-emerald-500/40 hover:border-emerald-400 bg-slate-800/40 rounded-xl p-5 text-center cursor-pointer transition-all group">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoModalFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <Upload className="w-8 h-8 text-emerald-400 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                  <p className="text-xs text-slate-200 font-bold">
                    Haz clic aquí o arrastra tu archivo de imagen
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Soporta JPG, PNG, WEBP o GIF (Procesamiento directo instantáneo)
                  </p>
                </div>
              </div>

              {/* URL Direct Link Option */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  O ingresar enlace Web (URL de la Foto):
                </label>
                <div className="flex items-center gap-2">
                  <Image className="w-4 h-4 text-slate-500 shrink-0" />
                  <input
                    type="url"
                    placeholder="https://ejemplo.com/mi-foto-de-portada.jpg"
                    value={photoModalPreview}
                    onChange={(e) => setPhotoModalPreview(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                </div>
              </div>

              {/* Quick Presets Grid */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[10px] text-slate-400 font-semibold block">
                  O selecciona una imagen de muestra para portada:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {FOOD_COVER_PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setPhotoModalPreview(preset.url)}
                      className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-emerald-300 border border-slate-700 hover:border-emerald-500/50 p-1.5 rounded-xl transition-all flex items-center gap-2 text-left"
                    >
                      <img
                        src={preset.url}
                        alt={preset.label}
                        className="w-7 h-7 object-cover rounded-lg shrink-0 border border-slate-600"
                      />
                      <span className="truncate font-semibold">{preset.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Vista previa de la portada actual */}
              {photoModalPreview && (
                <div className="space-y-1 pt-1">
                  <span className="text-[10px] font-bold text-slate-300 block">
                    Vista Previa de la Foto de Portada:
                  </span>
                  <div className="relative h-36 w-full rounded-xl overflow-hidden border-2 border-emerald-500/60 bg-slate-950 shadow-lg">
                    <img
                      src={photoModalPreview}
                      alt="Vista previa portada"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&auto=format&fit=crop&q=80';
                      }}
                    />
                    <div className="absolute top-2 left-2 bg-slate-950/80 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] font-mono font-bold text-emerald-400 border border-emerald-500/40">
                      ✓ Listo para Guardar
                    </div>
                  </div>
                </div>
              )}

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setPhotoModalProduct(null)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!photoModalPreview}
                  className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl text-xs shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  Guardar Foto de Portada
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TAB 3: GESTIÓN DE REPARTIDORES (REGISTRAR, EDITAR, ELIMINAR) */}
      {activeTab === 'repartidores' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Form Column: Registrar / Editar Repartidor */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
                  <Bike className="w-4 h-4 text-emerald-400" />
                  {editingDriverId ? 'Editar Repartidor' : 'Registrar Nuevo Repartidor'}
                </h3>
                {editingDriverId && (
                  <button
                    onClick={handleOpenCreateDriver}
                    className="text-[11px] font-bold text-slate-400 hover:text-slate-200 bg-slate-800 px-2.5 py-1 rounded-lg"
                  >
                    + Nuevo Registro
                  </button>
                )}
              </div>

              {driverSuccessMsg && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-3 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  {driverSuccessMsg}
                </div>
              )}

              <form onSubmit={handleSaveDriver} className="space-y-4 text-xs">
                {/* Nombre y Apellido */}
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Nombre y Apellido del Repartidor: *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Juan Pérez"
                    value={driverForm.nombre}
                    onChange={(e) => setDriverForm({ ...driverForm, nombre: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* Número Telefónico y Chapa */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      Número Telefónico: *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. +595 981 123456"
                      value={driverForm.telefono}
                      onChange={(e) => setDriverForm({ ...driverForm, telefono: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-xl px-3.5 py-2.5 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      Número de Chapa: *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. 123 ABC Py"
                      value={driverForm.chapa}
                      onChange={(e) => setDriverForm({ ...driverForm, chapa: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-xl px-3.5 py-2.5 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                {/* Tipo de Vehículo */}
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Tipo de Vehículo:
                  </label>
                  <select
                    value={driverForm.vehiculo}
                    onChange={(e) =>
                      setDriverForm({
                        ...driverForm,
                        vehiculo: e.target.value as 'moto' | 'bicicleta' | 'auto',
                      })
                    }
                    className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="moto">🏍️ Moto</option>
                    <option value="bicicleta">🚲 Bicicleta</option>
                    <option value="auto">🚗 Auto / Camioneta</option>
                  </select>
                </div>

                {/* Credenciales de Acceso */}
                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-3">
                  <div className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-emerald-400" />
                    Credenciales de Inicio de Sesión
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 mb-1">Usuario: *</label>
                      <input
                        type="text"
                        required
                        placeholder="Ej. juan"
                        value={driverForm.usuario}
                        onChange={(e) => setDriverForm({ ...driverForm, usuario: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-3 py-1.5 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1">Contraseña: *</label>
                      <input
                        type="text"
                        required
                        placeholder="Ej. juan123"
                        value={driverForm.password}
                        onChange={(e) => setDriverForm({ ...driverForm, password: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-3 py-1.5 font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Disponibilidad */}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="disponibleCheck"
                    checked={driverForm.disponible}
                    onChange={(e) => setDriverForm({ ...driverForm, disponible: e.target.checked })}
                    className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                  />
                  <label htmlFor="disponibleCheck" className="text-slate-300 font-medium cursor-pointer">
                    Habilitado / Disponible para entregas
                  </label>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="submit"
                    className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3 rounded-xl shadow-lg shadow-emerald-500/20 text-xs flex items-center justify-center gap-2 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    {editingDriverId ? 'Guardar Cambios del Repartidor' : 'Registrar Nuevo Repartidor'}
                  </button>
                  {editingDriverId && (
                    <button
                      type="button"
                      onClick={handleOpenCreateDriver}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold px-4 py-3 rounded-xl text-xs"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>

          {/* List Column: Lista de Repartidores Registrados */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
                    <User className="w-4 h-4 text-emerald-400" />
                    Lista de Repartidores ({repartidores.length})
                  </h3>
                  <p className="text-xs text-slate-400">
                    Repartidores registrados para el sistema de despacho y seguimiento GPS
                  </p>
                </div>

                <div className="relative w-full sm:w-56">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Buscar repartidor..."
                    value={filterDriverText}
                    onChange={(e) => setFilterDriverText(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-xl pl-9 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Repartidores Cards Grid */}
              <div className="space-y-3 pt-2">
                {repartidores
                  .filter(
                    (r) =>
                      r.nombre.toLowerCase().includes(filterDriverText.toLowerCase()) ||
                      (r.telefono && r.telefono.includes(filterDriverText)) ||
                      (r.chapa && r.chapa.toLowerCase().includes(filterDriverText.toLowerCase())) ||
                      (r.usuario && r.usuario.toLowerCase().includes(filterDriverText.toLowerCase()))
                  )
                  .map((rep) => {
                    const driverStats = getDriverDeliveredOrders(rep);

                    return (
                      <div
                        key={rep.id}
                        className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:border-emerald-500/40 transition-all"
                      >
                        <div className="flex items-start gap-3.5 min-w-0">
                          <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-700 text-emerald-400 flex items-center justify-center font-bold shrink-0 shadow-inner">
                            <Bike className="w-6 h-6" />
                          </div>

                          <div className="space-y-1.5 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-sm font-bold text-slate-100">{rep.nombre}</h4>
                              <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
                                ID: {rep.id}
                              </span>
                              <span
                                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                                  rep.disponible !== false
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                    : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                }`}
                              >
                                {rep.disponible !== false ? 'Disponible' : 'Ocupado / Inactivo'}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300">
                              <span className="flex items-center gap-1 font-mono">
                                📞 {rep.telefono || 'Sin teléfono'}
                              </span>
                              <span className="flex items-center gap-1 font-mono text-emerald-400 font-semibold bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-500/20">
                                Chapa: {rep.chapa || '123 ABC Py'}
                              </span>
                              <span className="capitalize text-slate-400 font-medium">
                                Vehículo: {rep.vehiculo}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                              <span>User: <strong className="text-emerald-300">{rep.usuario || 'N/A'}</strong></span>
                              <span>•</span>
                              <span>Pass: <strong className="text-slate-200">{rep.password || 'N/A'}</strong></span>
                            </div>

                            {/* Badge de Resumen de Pedidos Entregados */}
                            <div className="pt-1 flex flex-wrap items-center gap-2">
                              <span className="inline-flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-xl text-xs font-bold">
                                <Package className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                <span>Entregas: <strong>{driverStats.totalCount} pedidos</strong> ({driverStats.turnOrders.length} turno actual • {driverStats.historicOrders.length} cierres)</span>
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Action buttons: VER ENTREGAS, EDITAR, ELIMINAR */}
                        <div className="flex items-center gap-2 flex-wrap shrink-0 self-end lg:self-center">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedDriverForStats(rep);
                              setDriverStatsFilter('todos');
                              setDriverStatsSearch('');
                            }}
                            className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 border border-emerald-400 px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all shadow-md shadow-emerald-600/20 active:scale-95"
                            title="Ver detalle de pedidos entregados por este repartidor"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>Ver Entregas ({driverStats.totalCount})</span>
                          </button>

                          <button
                            onClick={() => handleOpenEditDriver(rep)}
                            className="bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors"
                            title="Editar datos del repartidor"
                          >
                            <Edit className="w-3.5 h-3.5 text-emerald-400" />
                            Editar
                          </button>
                          {deletingDriverId === rep.id ? (
                            <div className="flex items-center gap-1.5 animate-in fade-in">
                              <button
                                type="button"
                                onClick={() => handleDeleteDriver(rep.id, rep.nombre)}
                                className="bg-rose-600 hover:bg-rose-500 text-white font-extrabold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 shadow-lg shadow-rose-600/30 transition-all border border-rose-400"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                ¡Confirmar!
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeletingDriverId(null)}
                                className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-2.5 py-1.5 rounded-xl text-xs border border-slate-700 transition-colors"
                              >
                                Cancelar
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setDeletingDriverId(rep.id)}
                              className="bg-slate-900 hover:bg-rose-950 text-rose-400 hover:text-rose-200 border border-rose-500/30 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors"
                              title="Eliminar repartidor"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Eliminar
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: GESTIÓN DE PORTADAS EXCLUSIVAS POR CATEGORÍA DEL MENÚ */}
      {activeTab === 'portadas_categorias' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Header Banner */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-mono font-bold uppercase tracking-wider">
                  Módulo de Categorías & Portadas
                </span>
              </div>
              <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <Image className="w-5 h-5 text-emerald-400" />
                Carga, Creación y Configuración de Categorías del Menú
              </h3>
              <p className="text-xs text-slate-400 max-w-2xl">
                Crea nuevas categorías de productos, personaliza la foto de portada de cada una y habilita o deshabilita su visibilidad en el menú del cliente en tiempo real.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowCreateCategoryModal(true)}
              className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all shrink-0 uppercase tracking-wider"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Crear Nueva Categoría</span>
            </button>
          </div>

          {catPortadaSuccessMsg && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-3 rounded-2xl text-xs font-bold flex items-center gap-2 shadow-lg animate-in fade-in">
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
              <span>{catPortadaSuccessMsg}</span>
            </div>
          )}

          {/* Grid of Categories */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {allCategoriesList.map((cat) => {
              const currentPortada = categoryPortadasMap[cat.id] || '';
              const prodsCount = productos.filter((p) => p.categoria === cat.id).length;

              return (
                <div
                  key={cat.id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col justify-between shadow-xl transition-all duration-200 hover:border-slate-700"
                >
                  {/* Category Card Header */}
                  <div className="p-4 bg-slate-950/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h4 className="font-extrabold text-sm text-slate-100 flex items-center gap-2">
                        <span>{cat.label}</span>
                      </h4>
                      <span className="text-[10px] text-slate-400 font-mono">
                        ID Categoría: <strong className="text-slate-300">{cat.id}</strong> ({prodsCount} prods)
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Edit Name Button */}
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCatId(cat.id);
                          setEditingCatNameInput(cat.label);
                        }}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 hover:border-emerald-500/50 transition-all cursor-pointer"
                        title="Editar Nombre de Categoría"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete Category Button */}
                      <button
                        type="button"
                        onClick={() => setDeletingCatId(cat.id)}
                        className="p-1.5 rounded-lg bg-rose-950/50 hover:bg-rose-900 text-rose-400 border border-rose-500/30 hover:border-rose-500 transition-all cursor-pointer"
                        title="Eliminar Categoría"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      {/* Enable / Disable Category Toggle */}
                      <button
                        type="button"
                        onClick={() => handleToggleCategoryEstado(cat.id, categoryEstadoMap[cat.id] === false)}
                        className={`px-2 py-1 rounded-xl text-[11px] font-bold border transition-all flex items-center gap-1.5 shadow shrink-0 ${
                          categoryEstadoMap[cat.id] !== false
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/40 hover:bg-rose-500/20'
                        }`}
                        title={categoryEstadoMap[cat.id] !== false ? "Deshabilitar esta categoría para clientes" : "Habilitar esta categoría para clientes"}
                      >
                        <span className={`w-2 h-2 rounded-full ${categoryEstadoMap[cat.id] !== false ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
                        <span>{categoryEstadoMap[cat.id] !== false ? 'Habilitada' : 'Deshabilitada'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Body: Preview Box & Controls */}
                  <div className="p-4 space-y-4 text-xs">
                    {/* Visual Cover Preview */}
                    <div className="relative h-40 w-full bg-slate-950 rounded-xl overflow-hidden border border-slate-800 group shadow-inner">
                      {currentPortada ? (
                        <>
                          <img
                            src={currentPortada}
                            alt={cat.label}
                            className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${
                              categoryEstadoMap[cat.id] === false ? 'grayscale opacity-40' : ''
                            }`}
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&auto=format&fit=crop&q=80';
                            }}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-80" />
                          <div className="absolute top-2.5 left-2.5 flex items-center gap-2">
                            <span className="bg-emerald-500/90 backdrop-blur-md text-slate-950 px-2.5 py-0.5 rounded-full font-bold text-[10px] uppercase tracking-wider shadow">
                              Portada Activa
                            </span>
                            {categoryEstadoMap[cat.id] === false && (
                              <span className="bg-rose-600 backdrop-blur-md text-white px-2.5 py-0.5 rounded-full font-extrabold text-[10px] uppercase tracking-wider shadow">
                                Oculta en la App
                              </span>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center p-4 text-center text-slate-500 space-y-1">
                          <Image className="w-8 h-8 text-slate-600 mb-1" />
                          <p className="font-bold text-slate-400 text-xs">Sin Foto de Portada</p>
                          {categoryEstadoMap[cat.id] === false && (
                            <span className="bg-rose-600/90 text-white px-2 py-0.5 rounded-full font-bold text-[9px] uppercase">
                              Categoría Deshabilitada
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* File Upload Dropzone / Button */}
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-bold text-slate-300">
                        1. Cargar Foto desde tu Equipo:
                      </label>
                      <div className="relative border border-dashed border-emerald-500/40 hover:border-emerald-400 bg-slate-950/50 rounded-xl p-3 text-center cursor-pointer transition-all group">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                handleSaveCategoryPortada(cat.id, reader.result as string);
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        />
                        <div className="flex items-center justify-center gap-2 text-emerald-400 font-bold text-[11px]">
                          <Upload className="w-4 h-4 group-hover:scale-110 transition-transform" />
                          <span>Seleccionar Imagen local...</span>
                        </div>
                      </div>
                    </div>

                    {/* URL Input Form */}
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-bold text-slate-300">
                        2. O ingresar enlace URL de foto Web:
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="url"
                          placeholder="https://ejemplo.com/portada.jpg"
                          value={currentPortada}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCategoryPortadasMap((prev) => ({ ...prev, [cat.id]: val }));
                          }}
                          className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    </div>

                    {/* Preset Photos Selection */}
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-400 font-semibold block">
                        Fotos de muestra recomendadas:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {FOOD_COVER_PRESETS.slice(0, 5).map((preset, pIdx) => (
                          <button
                            key={pIdx}
                            type="button"
                            onClick={() => handleSaveCategoryPortada(cat.id, preset.url)}
                            className="text-[9px] bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 hover:border-emerald-500/50 px-2 py-0.5 rounded-lg transition-all"
                          >
                            📷 {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Card Actions Footer */}
                  <div className="p-3 bg-slate-950/80 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCatId(cat.id);
                          setEditingCatNameInput(cat.label);
                        }}
                        className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-1.5 rounded-xl transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        Renombrar
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeletingCatId(cat.id)}
                        className="text-[11px] font-bold text-rose-400 hover:text-rose-300 bg-rose-950/50 hover:bg-rose-900/60 border border-rose-500/30 px-2.5 py-1.5 rounded-xl transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Eliminar
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSaveCategoryPortada(cat.id, currentPortada)}
                      className="text-xs font-bold text-slate-950 bg-emerald-500 hover:bg-emerald-400 px-3.5 py-1.5 rounded-xl shadow-md shadow-emerald-500/20 transition-all flex items-center gap-1.5 ml-auto cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Guardar Portada
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 5: CONFIGURACIÓN DE UBICACIÓN DEL LOCAL (MODO SEGURO CON BLOQUEO / DESBLOQUEO) */}
      {activeTab === 'ubicacion_local' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Header Action & Security Status Banner */}
          <div
            className={`p-4 sm:p-5 rounded-2xl border text-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl transition-all ${
              isLocationLocked
                ? 'bg-slate-900 border-emerald-500/40'
                : 'bg-gradient-to-r from-amber-950/40 via-slate-900 to-amber-950/30 border-amber-500/60 ring-1 ring-amber-500/30'
            }`}
          >
            <div className="flex items-center gap-3.5">
              <div
                className={`w-12 h-12 rounded-2xl border flex items-center justify-center font-black shrink-0 shadow-md ${
                  isLocationLocked
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                    : 'bg-amber-500/20 border-amber-500/50 text-amber-400 animate-pulse'
                }`}
              >
                {isLocationLocked ? <Lock className="w-6 h-6" /> : <Unlock className="w-6 h-6" />}
              </div>
              <div>
                <h4 className="font-extrabold text-sm sm:text-base flex items-center gap-2 text-slate-100">
                  <span>
                    {isLocationLocked
                      ? '🔒 Ubicación del Local Protegida (Modo Seguro)'
                      : '🔓 Modo Edición Habilitado: Cambio de Local Activo'}
                  </span>
                  <span
                    className={`text-[10px] border px-2 py-0.5 rounded-full font-mono uppercase font-bold ${
                      isLocationLocked
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    }`}
                  >
                    {nombreRestauranteInput || 'EL TERNERO'}
                  </span>
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  {isLocationLocked ? (
                    <>
                      Dirección fija configurada en{' '}
                      <strong className="text-slate-200">{direccionRestauranteInput}</strong>{' '}
                      <span className="font-mono text-emerald-400">
                        ({latitudRestauranteInput.toFixed(5)}, {longitudRestauranteInput.toFixed(5)})
                      </span>
                      . Los cambios accidentales están bloqueados.
                    </>
                  ) : (
                    <>
                      Puedes modificar el nombre, la dirección exacta, el teléfono y las coordenadas GPS. Al
                      terminar, haz clic en <strong>Guardar Cambios y Bloquear</strong> para proteger la nueva
                      ubicación.
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
              {isLocationLocked ? (
                <>
                  <button
                    type="button"
                    onClick={() => setIsLocationLocked(false)}
                    className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-all shadow-lg shadow-amber-500/20 flex items-center gap-2 cursor-pointer active:scale-95"
                  >
                    <Unlock className="w-4 h-4" />
                    <span>Habilitar Cambio de Dirección</span>
                  </button>

                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${latitudRestauranteInput},${longitudRestauranteInput}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 font-bold text-xs transition-all shadow-md flex items-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Ver en Maps</span>
                  </a>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => handleSaveRestauranteConfig()}
                    disabled={isSavingLocation}
                    className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    <span>{isSavingLocation ? 'Guardando...' : 'Guardar y Bloquear'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCancelAndLock}
                    className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 font-bold text-xs transition-all shadow-md flex items-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Cancelar</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Success Feedback Notification */}
          {saveLocationSuccessMsg && (
            <div className="p-4 rounded-2xl bg-emerald-950/60 border border-emerald-500/50 text-emerald-300 text-xs font-semibold flex items-center gap-2.5 shadow-lg animate-in fade-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>{saveLocationSuccessMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Form and Store Configuration Column */}
            <div className="lg:col-span-5 space-y-5">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                    <Compass className="w-4 h-4 text-emerald-400" />
                    <span>Datos del Establecimiento</span>
                  </h4>
                  <div className="flex items-center gap-1.5">
                    {isLocationLocked ? (
                      <span className="text-[10px] bg-slate-800 text-slate-400 border border-slate-700 px-2 py-0.5 rounded-md font-mono flex items-center gap-1">
                        <Lock className="w-3 h-3 text-emerald-400" /> Bloqueado
                      </span>
                    ) : (
                      <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-md font-mono font-bold flex items-center gap-1">
                        <Unlock className="w-3 h-3 text-amber-400" /> Editable
                      </span>
                    )}
                  </div>
                </div>

                {isLocationLocked ? (
                  /* READ-ONLY LOCKED VIEW */
                  <div className="space-y-3.5 text-xs">
                    <div>
                      <span className="block text-slate-400 font-semibold mb-1">Nombre del Local:</span>
                      <div className="bg-slate-950 border border-slate-800 text-emerald-400 font-extrabold text-sm rounded-xl px-3.5 py-2.5 flex items-center gap-2">
                        <ShoppingBag className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>{nombreRestauranteInput}</span>
                      </div>
                    </div>

                    <div>
                      <span className="block text-slate-400 font-semibold mb-1">Dirección del Local:</span>
                      <div className="bg-slate-950 border border-slate-800 text-slate-200 font-medium rounded-xl px-3.5 py-2.5 flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>{direccionRestauranteInput}</span>
                      </div>
                    </div>

                    <div>
                      <span className="block text-slate-400 font-semibold mb-1">Teléfono Principal:</span>
                      <div className="bg-slate-950 border border-slate-800 text-slate-200 font-medium rounded-xl px-3.5 py-2.5 flex items-center gap-2 font-mono">
                        <Phone className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>{telefonoRestauranteInput}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-1 font-mono">
                      <div>
                        <span className="block text-slate-400 font-semibold mb-1">Latitud GPS:</span>
                        <div className="bg-slate-950 border border-slate-800 text-emerald-400 font-bold rounded-xl px-3 py-2 text-xs">
                          {latitudRestauranteInput.toFixed(6)}
                        </div>
                      </div>
                      <div>
                        <span className="block text-slate-400 font-semibold mb-1">Longitud GPS:</span>
                        <div className="bg-slate-950 border border-slate-800 text-emerald-400 font-bold rounded-xl px-3 py-2 text-xs">
                          {longitudRestauranteInput.toFixed(6)}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsLocationLocked(false)}
                      className="w-full py-2.5 px-4 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
                    >
                      <Unlock className="w-4 h-4 text-amber-400" />
                      <span>Desbloquear para Modificar Dirección</span>
                    </button>
                  </div>
                ) : (
                  /* EDITABLE UNLOCKED FORM */
                  <form onSubmit={(e) => handleSaveRestauranteConfig(e)} className="space-y-3.5 text-xs">
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">
                        Nombre del Establecimiento / Sucursal:
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={nombreRestauranteInput}
                          onChange={(e) => setNombreRestauranteInput(e.target.value)}
                          required
                          className="w-full bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-slate-100 text-xs font-bold outline-none pl-9 transition-colors"
                          placeholder="Ej: EL TERNERO (Limpio)"
                        />
                        <ShoppingBag className="w-4 h-4 text-amber-400 absolute left-3 top-3" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">
                        Dirección Completa del Local:
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={direccionRestauranteInput}
                          onChange={(e) => setDireccionRestauranteInput(e.target.value)}
                          required
                          className="w-full bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-slate-100 text-xs outline-none pl-9 transition-colors"
                          placeholder="Ej: RGG9+R7H, Gral. Elizardo Aquino, Limpio 110816, Paraguay"
                        />
                        <MapPin className="w-4 h-4 text-amber-400 absolute left-3 top-3" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">
                        Teléfono de Contacto:
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={telefonoRestauranteInput}
                          onChange={(e) => setTelefonoRestauranteInput(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-slate-100 text-xs font-mono outline-none pl-9 transition-colors"
                          placeholder="Ej: +595 981 100200"
                        />
                        <Phone className="w-4 h-4 text-amber-400 absolute left-3 top-3" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-1 font-mono">
                      <div>
                        <label className="block text-slate-300 font-semibold mb-1">Latitud GPS:</label>
                        <input
                          type="number"
                          step="0.000001"
                          value={latitudRestauranteInput}
                          onChange={(e) => setLatitudRestauranteInput(parseFloat(e.target.value) || 0)}
                          required
                          className="w-full bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-xl px-3 py-2 text-slate-100 text-xs outline-none font-bold text-amber-400"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-300 font-semibold mb-1">Longitud GPS:</label>
                        <input
                          type="number"
                          step="0.000001"
                          value={longitudRestauranteInput}
                          onChange={(e) => setLongitudRestauranteInput(parseFloat(e.target.value) || 0)}
                          required
                          className="w-full bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-xl px-3 py-2 text-slate-100 text-xs outline-none font-bold text-amber-400"
                        />
                      </div>
                    </div>

                    {/* Quick GPS Tools */}
                    <div className="pt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleDetectCurrentGps}
                        disabled={isDetectingGps}
                        className="flex-1 min-w-[140px] px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <Locate className={`w-3.5 h-3.5 text-emerald-400 ${isDetectingGps ? 'animate-spin' : ''}`} />
                        <span>{isDetectingGps ? 'Detectando GPS...' : 'Usar mi GPS Actual'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleResetToDefaultLimpio}
                        className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 font-medium text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        title="Restablecer a la ubicación predeterminada de Limpio"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Reset Limpio</span>
                      </button>
                    </div>

                    {gpsErrorMsg && (
                      <p className="text-[11px] text-amber-400 bg-amber-950/50 p-2.5 rounded-xl border border-amber-500/40">
                        {gpsErrorMsg}
                      </p>
                    )}

                    <div className="pt-2 space-y-2">
                      <button
                        type="submit"
                        disabled={isSavingLocation}
                        className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20 cursor-pointer disabled:opacity-50 active:scale-95"
                      >
                        <Save className="w-4 h-4" />
                        <span>{isSavingLocation ? 'Guardando Cambios...' : 'Guardar y Bloquear Ubicación'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleCancelAndLock}
                        className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-slate-700"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        <span>Cancelar y Bloquear sin Guardar</span>
                      </button>
                    </div>
                  </form>
                )}

                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-300 flex items-center gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    El cálculo automático de distancia de entregas funciona en tiempo real desde este punto central.
                  </span>
                </div>
              </div>

              {/* BRAND LOGO MANAGEMENT CARD (CON BLOQUEO Y HABILITACIÓN DE SEGURIDAD) */}
              <div
                className={`bg-slate-900 border rounded-2xl p-5 shadow-xl space-y-4 transition-all ${
                  isLogoLocked
                    ? 'border-slate-800'
                    : 'border-amber-500/60 ring-1 ring-amber-500/30'
                }`}
              >
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    <span>Logotipo Oficial de EL TERNERO</span>
                  </h4>
                  <div className="flex items-center gap-2">
                    {isCustomLogo && (
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold uppercase">
                        Personalizado
                      </span>
                    )}
                    {isLogoLocked ? (
                      <span className="text-[10px] bg-slate-800 text-slate-400 border border-slate-700 px-2 py-0.5 rounded-md font-mono flex items-center gap-1">
                        <Lock className="w-3 h-3 text-emerald-400" /> Bloqueado
                      </span>
                    ) : (
                      <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-md font-mono font-bold flex items-center gap-1">
                        <Unlock className="w-3 h-3 text-amber-400" /> Editable
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed">
                  {isLogoLocked ? (
                    <>
                      El logotipo vectorizado original de <strong>EL TERNERO</strong> está activo y protegido contra
                      modificaciones accidentales. Para cargar una nueva imagen, haz clic en{' '}
                      <strong>Habilitar Cambio de Logotipo</strong>.
                    </>
                  ) : (
                    <>
                      <strong>Modo edición habilitado:</strong> Puedes cargar un archivo de logotipo original (PNG
                      transparente, SVG, JPG o WebP) o restablecer al vector original. Al completar, el logotipo se
                      bloqueará y sincronizará de inmediato.
                    </>
                  )}
                </p>

                <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-black flex items-center justify-center border-2 border-emerald-500/40 shadow-xl overflow-hidden shrink-0">
                    <img
                      src={currentLogo}
                      alt="Logo Activo EL TERNERO"
                      className="w-full h-full object-contain"
                    />
                  </div>

                  <div className="flex-1 space-y-2.5 w-full text-center sm:text-left">
                    <input
                      ref={adminLogoFileRef}
                      type="file"
                      accept="image/png, image/jpeg, image/svg+xml, image/webp"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file && onUpdateLogo) {
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            const dataUrl = ev.target?.result as string;
                            if (dataUrl) {
                              onUpdateLogo(dataUrl);
                              setLogoSaveSuccess(true);
                              setIsLogoLocked(true);
                              setTimeout(() => setLogoSaveSuccess(false), 4000);
                            }
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="hidden"
                    />

                    {isLogoLocked ? (
                      <div>
                        <button
                          type="button"
                          onClick={() => setIsLogoLocked(false)}
                          className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-md active:scale-95"
                        >
                          <Unlock className="w-4 h-4" />
                          <span>Habilitar Cambio de Logotipo</span>
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                          <button
                            type="button"
                            onClick={() => adminLogoFileRef.current?.click()}
                            className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-2 transition-colors cursor-pointer shadow-md"
                          >
                            <UploadCloud className="w-4 h-4" />
                            <span>Subir Archivo de Logo (PNG/SVG)</span>
                          </button>

                          {isCustomLogo && (
                            <button
                              type="button"
                              onClick={() => {
                                if (onUpdateLogo) {
                                  onUpdateLogo('');
                                  setLogoSaveSuccess(true);
                                  setIsLogoLocked(true);
                                  setTimeout(() => setLogoSaveSuccess(false), 4000);
                                }
                              }}
                              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-700"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Restablecer Vector Predeterminado</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => setIsLogoLocked(true)}
                            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-700"
                          >
                            <Lock className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Bloquear Logotipo</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {logoSaveSuccess && (
                      <p className="text-xs text-emerald-400 font-semibold flex items-center gap-1.5 justify-center sm:justify-start animate-in fade-in">
                        <Check className="w-4 h-4" />
                        <span>¡Logotipo actualizado, bloqueado y sincronizado en todo el sistema!</span>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Interactive Map & Real-time Calculations Column */}
            <div className="lg:col-span-7 space-y-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        isLocationLocked ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400 animate-ping'
                      }`}
                    />
                    <span className="font-bold text-slate-200">
                      {isLocationLocked
                        ? 'Mapa del Local (Punto Central Fijo)'
                        : 'Mapa del Local (Haz clic o arrastra el marcador para reubicar)'}
                    </span>
                  </div>
                  <span className="text-slate-400 font-mono text-[11px] bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                    {latitudRestauranteInput.toFixed(5)}, {longitudRestauranteInput.toFixed(5)}
                  </span>
                </div>

                {/* Interactive Map Component with Pin and Click Support when unlocked */}
                <InteractiveMap
                  isAdmin={true}
                  pedidos={pedidos}
                  repartidores={repartidores}
                  logoUrl={currentLogo}
                  customStorePin={{
                    lat: latitudRestauranteInput,
                    lon: longitudRestauranteInput,
                    nombre: nombreRestauranteInput,
                    direccion: direccionRestauranteInput,
                  }}
                  onMapClickCoordinates={
                    !isLocationLocked
                      ? (lat, lon) => {
                          setLatitudRestauranteInput(parseFloat(lat.toFixed(6)));
                          setLongitudRestauranteInput(parseFloat(lon.toFixed(6)));
                        }
                      : undefined
                  }
                  customBannerText={
                    !isLocationLocked
                      ? '📍 MODO EDICIÓN: HAZ CLIC EN EL MAPA O ARRASTRA EL PIN PARA DEFINIR LA UBICACIÓN'
                      : `📍 UBICACIÓN DEL LOCAL: ${nombreRestauranteInput}`
                  }
                />
              </div>

              {/* Real-time Distance Calculations Summary */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl text-xs space-y-3">
                <h5 className="font-bold text-slate-200 flex items-center gap-2">
                  <Navigation className="w-4 h-4 text-emerald-400" />
                  Cálculo de Distancias en Tiempo Real a Clientes
                </h5>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {pedidos.map((ped) => {
                    const lat1 = latitudRestauranteInput;
                    const lon1 = longitudRestauranteInput;
                    const lat2 = ped.latitudCliente;
                    const lon2 = ped.longitudCliente;

                    const R = 6371;
                    const dLat = ((lat2 - lat1) * Math.PI) / 180;
                    const dLon = ((lon2 - lon1) * Math.PI) / 180;
                    const a =
                      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                      Math.cos((lat1 * Math.PI) / 180) *
                        Math.cos((lat2 * Math.PI) / 180) *
                        Math.sin(dLon / 2) *
                        Math.sin(dLon / 2);
                    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                    const distKm = parseFloat((R * c).toFixed(2));
                    const estMin = Math.max(2, Math.round(distKm * 4 + 3));

                    return (
                      <div
                        key={ped.id}
                        className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between gap-2"
                      >
                        <div>
                          <div className="font-bold text-slate-200">{ped.cliente}</div>
                          <div className="text-[11px] text-slate-400">{ped.direccion}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-mono font-bold text-emerald-400">{distKm} km</div>
                          <div className="text-[10px] text-slate-500">~{estMin} mins</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB: CIERRE DE CAJA Y REPORTES */}
      {activeTab === 'cierre_caja' && (
        <div className="space-y-6">
          {/* Action Success Alert */}
          {cierreSuccessMsg && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 p-4 rounded-2xl flex items-center justify-between gap-3 animate-fade-in shadow-lg">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <span className="text-xs font-bold">{cierreSuccessMsg}</span>
              </div>
              <button onClick={() => setCierreSuccessMsg('')} className="text-emerald-400 hover:text-emerald-200">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Top Summary Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl flex items-center justify-between">
              <div>
                <span className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">
                  Ventas sin Cerrar (Sesión Actual)
                </span>
                <span className="text-2xl font-black text-emerald-400 font-mono">
                  Gs. {pedidos.filter((p) => p.estado === 'entregado').reduce((acc, p) => acc + (p.total || 0), 0).toLocaleString('es-PY')}
                </span>
                <span className="text-[11px] text-slate-500 block mt-1">
                  {pedidos.filter((p) => p.estado === 'entregado').length} pedidos entregados
                </span>
              </div>
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                <Coins className="w-6 h-6 text-emerald-400" />
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl flex items-center justify-between">
              <div>
                <span className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">
                  Total Histórico de Cierres
                </span>
                <span className="text-2xl font-black text-white font-mono">
                  {cierresDeCaja.length} Cierres
                </span>
                <span className="text-[11px] text-slate-500 block mt-1">
                  Registrados en sistema
                </span>
              </div>
              <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
                <Archive className="w-6 h-6 text-indigo-400" />
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl flex items-center justify-between">
              <div>
                <span className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">
                  Total Acumulado en Cierres
                </span>
                <span className="text-2xl font-black text-emerald-300 font-mono">
                  Gs. {cierresDeCaja.reduce((acc, c) => acc + c.totalVentas, 0).toLocaleString('es-PY')}
                </span>
                <span className="text-[11px] text-slate-500 block mt-1">
                  Suma total de cierres guardados
                </span>
              </div>
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                <TrendingUp className="w-6 h-6 text-emerald-400" />
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl flex items-center justify-between">
              <div>
                <span className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">
                  Exportar Reporte Mensual
                </span>
                <button
                  onClick={() => setShowMonthlyReportModal(true)}
                  className="mt-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs px-3.5 py-2 rounded-xl shadow-md transition-all flex items-center gap-1.5"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Reportes & PDF</span>
                </button>
              </div>
              <div className="p-3 bg-sky-500/10 border border-sky-500/20 rounded-xl">
                <Printer className="w-6 h-6 text-sky-400" />
              </div>
            </div>
          </div>

          {/* Form to Create Cierre de Caja */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-base font-extrabold text-slate-100 flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-emerald-400" />
                  Realizar Cierre de Caja del Turno / Día
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Archiva y consolida automáticamente todos los pedidos entregados hasta el momento.
                </p>
              </div>
              <span className="text-xs font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-xl">
                Fecha Actual: {new Date().toLocaleDateString('es-PY')}
              </span>
            </div>

            <form onSubmit={handleRealizarCierre} className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Monto Inicial en Caja (Gs.):
                </label>
                <input
                  type="number"
                  step="5000"
                  required
                  value={montoInicialInput}
                  onChange={(e) => setMontoInicialInput(Number(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-700 text-emerald-400 font-mono font-bold text-sm rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Efectivo base asignado para vuelto / cambio.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Observaciones / Notas del Cierre:
                </label>
                <input
                  type="text"
                  placeholder="Ej. Cierre de turno tarde. Todo en orden."
                  value={observacionesCierreInput}
                  onChange={(e) => setObservacionesCierreInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Notas sobre novedades o responsable del turno.
                </span>
              </div>

              <div className="flex flex-col justify-end">
                <button
                  type="submit"
                  disabled={isClosingCaja}
                  className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider px-4 py-3 rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isClosingCaja ? 'Procesando...' : '🔐 Confirmar Cierre de Caja'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Registro Histórico por Fechas (Table & Filters) */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h3 className="text-base font-extrabold text-slate-100 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-emerald-400" />
                Histórico de Cierres de Caja Registrados por Fecha
              </h3>

              <div className="flex flex-wrap items-center gap-3">
                {/* Search */}
                <div className="relative w-full sm:w-48">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="text"
                    placeholder="Buscar Cierre ID..."
                    value={cierreSearchText}
                    onChange={(e) => setCierreSearchText(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-xl pl-9 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* Filter by Month */}
                <select
                  value={monthFilter}
                  onChange={(e) => setMonthFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-2 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="todos">📅 Todos los Meses</option>
                  <option value="2026-07">Julio 2026</option>
                  <option value="2026-06">Junio 2026</option>
                  <option value="2026-05">Mayo 2026</option>
                  <option value="2026-04">Abril 2026</option>
                </select>

                <button
                  onClick={() => exportMonthlyReportToCSV(monthFilter)}
                  className="bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 font-bold text-xs px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5"
                  title="Exportar archivo Excel CSV para el mes seleccionado"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                  <span>Exportar Excel (.csv)</span>
                </button>
              </div>
            </div>

            {/* List Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase font-mono text-[11px] border-b border-slate-800">
                  <tr>
                    <th className="p-3.5">ID Cierre</th>
                    <th className="p-3.5">Fecha & Hora</th>
                    <th className="p-3.5">Cant. Pedidos</th>
                    <th className="p-3.5">Monto Inicial</th>
                    <th className="p-3.5">Total Ventas</th>
                    <th className="p-3.5">Total en Caja</th>
                    <th className="p-3.5">Usuario</th>
                    <th className="p-3.5 text-right">Acciones Reportes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-slate-900/50">
                  {cierresDeCaja
                    .filter((c) => {
                      if (monthFilter !== 'todos' && !c.fechaCierre.startsWith(monthFilter)) return false;
                      if (cierreSearchText.trim()) {
                        const q = cierreSearchText.toLowerCase();
                        return c.id.toLowerCase().includes(q) || (c.observaciones && c.observaciones.toLowerCase().includes(q));
                      }
                      return true;
                    })
                    .map((cierre) => {
                      const totalCaja = cierre.montoInicial + cierre.totalVentas;
                      return (
                        <tr key={cierre.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="p-3.5 font-mono font-bold text-emerald-400">{cierre.id}</td>
                          <td className="p-3.5 font-mono text-slate-300">
                            {new Date(cierre.fechaCierre).toLocaleString('es-PY')}
                          </td>
                          <td className="p-3.5 font-bold text-slate-200">
                            <span className="bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700">
                              {cierre.cantidadPedidos} pedidos
                            </span>
                          </td>
                          <td className="p-3.5 font-mono text-slate-400">
                            Gs. {cierre.montoInicial.toLocaleString('es-PY')}
                          </td>
                          <td className="p-3.5 font-mono font-bold text-emerald-400">
                            Gs. {cierre.totalVentas.toLocaleString('es-PY')}
                          </td>
                          <td className="p-3.5 font-mono font-black text-emerald-300">
                            Gs. {totalCaja.toLocaleString('es-PY')}
                          </td>
                          <td className="p-3.5 text-slate-400">{cierre.usuarioCierre}</td>
                          <td className="p-3.5 text-right space-x-2">
                            <button
                              onClick={() => {
                                setSelectedCierreForDetail(cierre);
                                setShowPrintReportModal(true);
                              }}
                              className="bg-slate-800 hover:bg-slate-700 text-sky-400 border border-sky-500/30 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all inline-flex items-center gap-1"
                              title="Ver Detalle / Imprimir PDF"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>Ver / PDF</span>
                            </button>
                            <button
                              onClick={() => exportCierreToCSV(cierre)}
                              className="bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-400 border border-emerald-500/30 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all inline-flex items-center gap-1"
                              title="Descargar Excel (.csv)"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>Excel</span>
                            </button>
                            <button
                              onClick={() => setCierreToDelete(cierre)}
                              className="bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 border border-rose-500/30 p-1.5 rounded-lg text-[11px] transition-all inline-flex items-center hover:scale-105"
                              title="Eliminar Registro de Cierre"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  {cierresDeCaja.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-500 font-medium">
                        No hay cierres de caja registrados aún. Realiza el primer cierre de caja arriba.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB: GESTIÓN DE CLIENTES Y Bajas / Bloqueos */}
      {activeTab === 'clientes' && (
        <div className="space-y-6">
          {/* Header Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
            <div className="bg-slate-900 border border-slate-800 p-4.5 rounded-2xl shadow-xl flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[11px] text-slate-400 uppercase font-bold tracking-wider block">
                  Total Clientes
                </span>
                <span className="text-xl font-extrabold text-slate-100 font-mono">
                  {clientesList.length}
                </span>
              </div>
            </div>

            {/* NEON ONLINE CARD */}
            <div className="bg-slate-900 border border-emerald-500/50 p-4.5 rounded-2xl shadow-[0_0_20px_rgba(16,185,129,0.15)] flex items-center gap-3.5 relative overflow-hidden">
              <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 shadow-[0_0_12px_rgba(16,185,129,0.4)]">
                <span className="relative flex h-3.5 w-3.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-80"></span>
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-400 shadow-[0_0_8px_#34d399]"></span>
                </span>
              </div>
              <div>
                <span className="text-[11px] text-emerald-400 uppercase font-black tracking-wider block drop-shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse">
                  En Línea
                </span>
                <span className="text-2xl font-black text-emerald-300 font-mono drop-shadow-[0_0_10px_rgba(16,185,129,0.8)]">
                  {clientesList.filter((c) => c.online).length}
                </span>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4.5 rounded-2xl shadow-xl flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                <UserCheck className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[11px] text-slate-400 uppercase font-bold tracking-wider block">
                  Clientes Activos
                </span>
                <span className="text-xl font-extrabold text-emerald-400 font-mono">
                  {clientesList.filter((c) => !c.bloqueado).length}
                </span>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4.5 rounded-2xl shadow-xl flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
                <UserX className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[11px] text-slate-400 uppercase font-bold tracking-wider block">
                  Dados de Baja
                </span>
                <span className="text-xl font-extrabold text-rose-400 font-mono">
                  {clientesList.filter((c) => c.bloqueado).length}
                </span>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4.5 rounded-2xl shadow-xl flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                <ShoppingBag className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[11px] text-slate-400 uppercase font-bold tracking-wider block">
                  Pedidos
                </span>
                <span className="text-xl font-extrabold text-emerald-300 font-mono">
                  {pedidos.filter((p) => p.clienteEmail || p.clienteCedula).length}
                </span>
              </div>
            </div>
          </div>

          {/* Clientes Table & Filter Panel */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-extrabold text-slate-100 flex items-center gap-2">
                  <Users className="w-5 h-5 text-emerald-400" />
                  <span>Directorio de Clientes Registrados</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Consulta todos los datos personales de los clientes, monitorea su estado de sesión en tiempo real, edita su acceso o dalos de baja si no cumplen con las políticas.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3">
                <button
                  onClick={fetchClientes}
                  className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-800 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 shrink-0"
                  title="Actualizar directorio de clientes"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Actualizar Lista</span>
                </button>

                {/* Status Filter Buttons */}
                <div className="bg-slate-950 p-1 rounded-xl border border-slate-800 flex flex-wrap items-center gap-1 w-full sm:w-auto">
                  <button
                    onClick={() => setClientStatusFilter('todos')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      clientStatusFilter === 'todos'
                        ? 'bg-slate-800 text-slate-100 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Todos ({clientesList.length})
                  </button>
                  <button
                    onClick={() => setClientStatusFilter('en_linea')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${
                      clientStatusFilter === 'en_linea'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/60 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                        : 'text-emerald-400 hover:text-emerald-300'
                    }`}
                  >
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-80"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
                    </span>
                    <span>En Línea ({clientesList.filter((c) => c.online).length})</span>
                  </button>
                  <button
                    onClick={() => setClientStatusFilter('activos')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      clientStatusFilter === 'activos'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Activos ({clientesList.filter((c) => !c.bloqueado).length})
                  </button>
                  <button
                    onClick={() => setClientStatusFilter('bloqueados')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      clientStatusFilter === 'bloqueados'
                        ? 'bg-rose-950 text-rose-300 border border-rose-500/30'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Dados de Baja ({clientesList.filter((c) => c.bloqueado).length})
                  </button>
                </div>

                {/* Search Input */}
                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Buscar cliente, CI, correo..."
                    value={clientSearchText}
                    onChange={(e) => setClientSearchText(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl pl-9 pr-3 py-2 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20"
                  />
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/80 text-slate-400 uppercase font-mono text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="p-3.5">Cliente</th>
                    <th className="p-3.5">Cédula / RUC</th>
                    <th className="p-3.5">Contacto (Correo / Celular)</th>
                    <th className="p-3.5">Fecha Registro</th>
                    <th className="p-3.5">Historial Pedidos</th>
                    <th className="p-3.5">Estado / Acceso</th>
                    <th className="p-3.5 text-right">Acciones de Gestión</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {clientesList
                    .filter((c) => {
                      if (!c) return false;
                      if (clientStatusFilter === 'en_linea' && !c.online) return false;
                      if (clientStatusFilter === 'activos' && c.bloqueado) return false;
                      if (clientStatusFilter === 'bloqueados' && !c.bloqueado) return false;
                      if (!clientSearchText.trim()) return true;
                      const q = clientSearchText.toLowerCase().trim();
                      const fullNombre = `${c.nombres || ''} ${c.apellidos || ''}`.toLowerCase();
                      return (
                        fullNombre.includes(q) ||
                        (c.cedula || '').toLowerCase().includes(q) ||
                        (c.email || '').toLowerCase().includes(q) ||
                        (c.celular || '').toLowerCase().includes(q) ||
                        (c.id || '').toLowerCase().includes(q)
                      );
                    })
                    .map((cliente) => {
                      const clientOrders = pedidos.filter((p) => {
                        const em = Boolean(p.clienteEmail && cliente.email && p.clienteEmail.toLowerCase() === cliente.email.toLowerCase());
                        const cd = Boolean(p.clienteCedula && cliente.cedula && p.clienteCedula === cliente.cedula);
                        const ph = Boolean(p.telefono && cliente.celular && p.telefono.replace(/\D/g, '') === cliente.celular.replace(/\D/g, ''));
                        return em || cd || ph;
                      });

                      return (
                        <tr key={cliente.id} className={`transition-colors ${cliente.online ? 'bg-emerald-950/20 hover:bg-emerald-950/30' : 'hover:bg-slate-800/40'}`}>
                          <td className="p-3.5 font-medium">
                            <div className="flex items-center gap-3">
                              <div className="relative">
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black shrink-0 ${
                                  cliente.bloqueado
                                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                    : cliente.online
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/60 shadow-[0_0_12px_rgba(16,185,129,0.4)]'
                                    : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                }`}>
                                  {cliente.nombres.charAt(0)}
                                </div>
                                {cliente.online && (
                                  <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-80"></span>
                                    <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-400 border-2 border-slate-900 shadow-[0_0_10px_#34d399]"></span>
                                  </span>
                                )}
                              </div>
                              <div>
                                <div className="font-bold text-slate-100 text-sm flex items-center gap-2 flex-wrap">
                                  <span>{cliente.nombres} {cliente.apellidos}</span>
                                  {cliente.online && (
                                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-950 border border-emerald-500/80 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.5)] animate-pulse">
                                      <span className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400 shadow-[0_0_6px_#34d399]"></span>
                                      </span>
                                      <span>EN LÍNEA</span>
                                    </span>
                                  )}
                                  {cliente.bloqueado && (
                                    <span className="text-[10px] bg-rose-950/80 text-rose-400 border border-rose-800/60 font-mono px-2 py-0.5 rounded-md font-bold">
                                      DADO DE BAJA
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] font-mono text-slate-400">
                                  ID: {cliente.id}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="p-3.5">
                            <span className="font-mono text-xs font-bold text-slate-200 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 inline-block">
                              CI / RUC: {cliente.cedula}
                            </span>
                          </td>

                          <td className="p-3.5">
                            <div className="space-y-1 font-mono text-xs">
                              <div className="flex items-center gap-1.5 text-slate-200">
                                <Mail className="w-3.5 h-3.5 text-slate-400" />
                                <span>{cliente.email}</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-slate-400">
                                <Phone className="w-3.5 h-3.5 text-slate-500" />
                                <span>{cliente.celular}</span>
                              </div>
                            </div>
                          </td>

                          <td className="p-3.5 text-slate-400 font-mono text-[11px]">
                            {cliente.fechaRegistro ? new Date(cliente.fechaRegistro).toLocaleDateString('es-PY') : 'No registrado'}
                          </td>

                          <td className="p-3.5 font-mono">
                            <span className="bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 text-emerald-300 font-extrabold text-xs">
                              {clientOrders.length} pedido{clientOrders.length === 1 ? '' : 's'}
                            </span>
                          </td>

                          <td className="p-3.5">
                            {cliente.online ? (
                              <div className="space-y-1">
                                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950 border-2 border-emerald-500/80 shadow-[0_0_18px_rgba(16,185,129,0.5)] transition-all">
                                  <span className="relative flex h-2.5 w-2.5 shrink-0">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-90"></span>
                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400 shadow-[0_0_10px_#34d399]"></span>
                                  </span>
                                  <span className="text-xs font-black uppercase tracking-wider text-emerald-300 drop-shadow-[0_0_10px_rgba(52,211,153,0.9)] animate-pulse">
                                    EN LÍNEA
                                  </span>
                                </div>
                                <p className="text-[10px] text-emerald-400/90 font-mono font-semibold">
                                  ● Sesión iniciada y activa
                                </p>
                              </div>
                            ) : cliente.bloqueado ? (
                              <div className="space-y-1">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                                  <Lock className="w-3.5 h-3.5" />
                                  <span>Bloqueado / Dado de Baja</span>
                                </span>
                                {cliente.motivoBloqueo && (
                                  <p className="text-[10px] text-rose-300/80 italic max-w-xs">
                                    Motivo: {cliente.motivoBloqueo}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <div className="space-y-0.5">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Activo (Sin sesión viva)</span>
                                </span>
                                {cliente.ultimaConexion && (
                                  <p className="text-[10px] text-slate-500 font-mono block">
                                    Última sesión: {new Date(cliente.ultimaConexion).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })}
                                  </p>
                                )}
                              </div>
                            )}
                          </td>

                          <td className="p-3.5 text-right space-x-2">
                            {cliente.bloqueado ? (
                              <button
                                onClick={() => setClientActionModal({ type: 'desbloquear', cliente })}
                                className="bg-emerald-950/80 hover:bg-emerald-900/90 text-emerald-300 border border-emerald-700/60 px-3 py-1.5 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-1.5 shadow-sm active:scale-95"
                                title="Reactivar e Iniciar Sesión"
                              >
                                <Unlock className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Reactivar Cliente</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  setClientMotivoInput('Incumplimiento de políticas / Mal comportamiento');
                                  setClientActionModal({ type: 'bloquear', cliente });
                                }}
                                className="bg-rose-950/80 hover:bg-rose-900/90 text-rose-300 border border-rose-800/60 px-3 py-1.5 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-1.5 shadow-sm active:scale-95"
                                title="Dar de baja y bloquear inicio de sesión"
                              >
                                <Lock className="w-3.5 h-3.5 text-rose-400" />
                                <span>Dar de Baja / Bloquear</span>
                              </button>
                            )}

                            <button
                              onClick={() => setClientActionModal({ type: 'eliminar', cliente })}
                              className="bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-300 border border-slate-700 hover:border-rose-800 p-1.5 rounded-xl transition-all inline-flex items-center active:scale-95"
                              title="Eliminar cliente del sistema"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}

                  {clientesList.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-500 font-medium">
                        No hay clientes registrados en el sistema aún.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB: PLANTILLAS DE NOTIFICACIONES Y COMBOS DEL DÍA */}
      {activeTab === 'notificaciones' && (
        <div className="space-y-8 animate-in fade-in duration-200">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-emerald-950/80 via-slate-900 to-slate-900 border border-emerald-500/40 p-6 rounded-2xl shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 text-2xl shadow-inner shrink-0">
                🔔
              </div>
              <div>
                <h2 className="text-lg font-extrabold text-slate-100 flex items-center gap-2">
                  <span>Gestión de Notificaciones y Promociones</span>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full font-mono uppercase font-bold">
                    Barra Móvil & PWA
                  </span>
                </h2>
                <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                  Personaliza los mensajes automáticos enviados a la barra de notificación del dispositivo móvil del cliente cuando cambia el estado del pedido, y emite alertas en vivo de Combos o Promociones del Día.
                </p>
              </div>
            </div>

            <button
              onClick={async () => {
                const perm = await requestNotificationPermission();
                if (perm !== 'granted') {
                  alert('⚠️ Notificaciones desactivadas en tu navegador/celular.\n\nPara probar la notificación:\n1. Toca el candado o icono de opciones en la barra del navegador.\n2. Selecciona "Permisos" o "Notificaciones".\n3. Cambia el permiso a "Permitir" y vuelve a presionar el botón.');
                  return;
                }
                const sent = await showNativeNotification('🔔 Prueba EL TERNERO', {
                  body: '¡Excelente! Las notificaciones en la barra del celular están funcionando correctamente.',
                  icon: currentLogo,
                });
                if (sent) {
                  setPromoSuccessMsg('🔔 ¡Notificación de prueba emitida a la barra de tu celular!');
                  setTimeout(() => setPromoSuccessMsg(''), 5000);
                } else {
                  alert('Se intentó enviar la notificación. Si no la ves en la barra superior de tu celular, verifica que tu teléfono no esté en modo "No molestar" o con notificaciones de navegador bloqueadas.');
                }
              }}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center gap-2 transition-all shrink-0 active:scale-95 shadow-md cursor-pointer"
            >
              <Bell className="w-4 h-4 text-emerald-400" />
              <span>Probar en mi Celular</span>
            </button>
          </div>

          {/* SECTION 1: BROADCAST COMBOS Y PROMOCIONES DEL DÍA */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-xl shrink-0">
                📣
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-100 flex items-center gap-2">
                  <span>Transmitir Notificación de Combos y Promociones del Día</span>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full uppercase font-bold font-mono">
                    En Vivo
                  </span>
                </h3>
                <p className="text-xs text-slate-400">
                  Escribe un anuncio publicitario o combo especial. Les llegará a todos los clientes como notificación en la barra de su celular y como banner en la app.
                </p>
              </div>
            </div>

            {promoSuccessMsg && (
              <div className="p-4 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 text-xs font-bold flex items-center gap-3 animate-in fade-in shadow-lg">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <span>{promoSuccessMsg}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-extrabold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <ShoppingBag className="w-4 h-4 text-emerald-400" />
                  <span>Producto / Combo Promocionado para Pedido Directo (Opcional):</span>
                </label>
                <select
                  value={selectedPromoProductId}
                  onChange={(e) => {
                    const prodId = e.target.value;
                    setSelectedPromoProductId(prodId);
                    if (prodId) {
                      const prod = productos.find((p) => p.id === prodId);
                      if (prod) {
                        setPromoTitle(`🔥 PROMO: ${prod.nombre}`);
                        if (prod.imagen) setPromoImgUrl(prod.imagen);
                        setPromoBody(`¡Pedí ahora tu ${prod.nombre} por solo Gs. ${prod.monto.toLocaleString()}! Toca esta notificación para agregarlo directo al carrito y sumar bebidas u otros productos.`);
                      }
                    }
                  }}
                  className="w-full bg-slate-950 border border-emerald-500/40 rounded-xl px-4 py-3 text-slate-100 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">-- Ningún Producto Específico (Promoción General) --</option>
                  {productos.map((prod) => (
                    <option key={prod.id} value={prod.id}>
                      🍔 {prod.nombre} — Gs. {prod.monto.toLocaleString()} ({prod.categoria})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400">
                  Al vincular un producto, el cliente podrá presionar la notificación en su celular y se agregará automáticamente al carrito para que pueda agregar bebidas u otros ítems antes de pedir.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-slate-300 uppercase tracking-wider block">
                  Título de la Promoción / Combo:
                </label>
                <input
                  type="text"
                  value={promoTitle}
                  onChange={(e) => setPromoTitle(e.target.value)}
                  placeholder="Ej: 🔥 COMBO DEL DÍA - EL TERNERO"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-slate-300 uppercase tracking-wider block">
                  URL Foto / Banner (Opcional):
                </label>
                <input
                  type="text"
                  value={promoImgUrl}
                  onChange={(e) => setPromoImgUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/... o dejar en blanco"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-extrabold text-slate-300 uppercase tracking-wider block">
                  Mensaje Detallado de la Promoción:
                </label>
                <textarea
                  rows={3}
                  value={promoBody}
                  onChange={(e) => setPromoBody(e.target.value)}
                  placeholder="Ej: ¡Hoy 2x1 en Pizzas Familiares + 1L de Gaseosa Gratis solo por hoy! Haz tu pedido ya..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-slate-100 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handleSendBroadcastPromo}
                disabled={sendingPromo}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-2.5 shadow-lg shadow-emerald-500/20 transition-all active:scale-95 disabled:opacity-50"
              >
                <Send className="w-4 h-4 text-slate-950" />
                <span>{sendingPromo ? 'Enviando Promoción...' : '🚀 Transmitir Promoción a Celulares'}</span>
              </button>
            </div>
          </div>

          {/* SECTION 2: EDITAR PLANTILLAS DE NOTIFICACIÓN DE ESTADOS */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-xl shrink-0">
                  ⚙️
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-100">
                    Plantillas de Notificaciones por Estado de Pedido
                  </h3>
                  <p className="text-xs text-slate-400">
                    Variables permitidas: <code className="bg-slate-950 px-1.5 py-0.5 rounded text-emerald-400 font-mono text-[11px]">{'{id}'}</code>, <code className="bg-slate-950 px-1.5 py-0.5 rounded text-emerald-400 font-mono text-[11px]">{'{total}'}</code>, <code className="bg-slate-950 px-1.5 py-0.5 rounded text-emerald-400 font-mono text-[11px]">{'{repartidor}'}</code>.
                  </p>
                </div>
              </div>

              <button
                onClick={handleSaveNotificationTemplates}
                disabled={savingTemplates}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all active:scale-95 disabled:opacity-50 shrink-0"
              >
                <Save className="w-4 h-4" />
                <span>{savingTemplates ? 'Guardando...' : '💾 Guardar Plantillas'}</span>
              </button>
            </div>

            {templateSuccessMsg && (
              <div className="p-4 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 text-xs font-bold flex items-center gap-3 animate-in fade-in shadow-lg">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <span>{templateSuccessMsg}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 1. RECIBIDO */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4.5 space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-800/80 pb-2.5">
                  <span className="w-3 h-3 rounded-full bg-blue-500 shrink-0" />
                  <span className="font-extrabold text-xs text-blue-400 uppercase tracking-wider">
                    1. Pedido Recibido / Registrado
                  </span>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Título:</label>
                  <input
                    type="text"
                    value={notifTemplates.recibido?.title || ''}
                    onChange={(e) =>
                      setNotifTemplates((prev) => ({
                        ...prev,
                        recibido: { ...prev.recibido, title: e.target.value },
                      }))
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-slate-100 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Mensaje (Cuerpo):</label>
                  <textarea
                    rows={2}
                    value={notifTemplates.recibido?.body || ''}
                    onChange={(e) =>
                      setNotifTemplates((prev) => ({
                        ...prev,
                        recibido: { ...prev.recibido, body: e.target.value },
                      }))
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-slate-100 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* 2. ACEPTADO */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4.5 space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-800/80 pb-2.5">
                  <span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" />
                  <span className="font-extrabold text-xs text-emerald-400 uppercase tracking-wider">
                    2. Pedido Aceptado / Confirmado
                  </span>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Título:</label>
                  <input
                    type="text"
                    value={notifTemplates.aceptado?.title || ''}
                    onChange={(e) =>
                      setNotifTemplates((prev) => ({
                        ...prev,
                        aceptado: { ...prev.aceptado, title: e.target.value },
                      }))
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-slate-100 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Mensaje (Cuerpo):</label>
                  <textarea
                    rows={2}
                    value={notifTemplates.aceptado?.body || ''}
                    onChange={(e) =>
                      setNotifTemplates((prev) => ({
                        ...prev,
                        aceptado: { ...prev.aceptado, body: e.target.value },
                      }))
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-slate-100 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* 3. PREPARANDO */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4.5 space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-800/80 pb-2.5">
                  <span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" />
                  <span className="font-extrabold text-xs text-emerald-400 uppercase tracking-wider">
                    3. Pedido en Preparación (Cocina)
                  </span>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Título:</label>
                  <input
                    type="text"
                    value={notifTemplates.preparando?.title || ''}
                    onChange={(e) =>
                      setNotifTemplates((prev) => ({
                        ...prev,
                        preparando: { ...prev.preparando, title: e.target.value },
                      }))
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-slate-100 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Mensaje (Cuerpo):</label>
                  <textarea
                    rows={2}
                    value={notifTemplates.preparando?.body || ''}
                    onChange={(e) =>
                      setNotifTemplates((prev) => ({
                        ...prev,
                        preparando: { ...prev.preparando, body: e.target.value },
                      }))
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-slate-100 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* 4. EN CAMINO */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4.5 space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-800/80 pb-2.5">
                  <span className="w-3 h-3 rounded-full bg-purple-500 shrink-0" />
                  <span className="font-extrabold text-xs text-purple-400 uppercase tracking-wider">
                    4. Pedido en Camino (Repartidor)
                  </span>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Título:</label>
                  <input
                    type="text"
                    value={notifTemplates.en_camino?.title || ''}
                    onChange={(e) =>
                      setNotifTemplates((prev) => ({
                        ...prev,
                        en_camino: { ...prev.en_camino, title: e.target.value },
                      }))
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-slate-100 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Mensaje (Cuerpo):</label>
                  <textarea
                    rows={2}
                    value={notifTemplates.en_camino?.body || ''}
                    onChange={(e) =>
                      setNotifTemplates((prev) => ({
                        ...prev,
                        en_camino: { ...prev.en_camino, body: e.target.value },
                      }))
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-slate-100 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* 5. ENTREGADO */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4.5 space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-800/80 pb-2.5">
                  <span className="w-3 h-3 rounded-full bg-teal-500 shrink-0" />
                  <span className="font-extrabold text-xs text-teal-400 uppercase tracking-wider">
                    5. Pedido Entregado
                  </span>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Título:</label>
                  <input
                    type="text"
                    value={notifTemplates.entregado?.title || ''}
                    onChange={(e) =>
                      setNotifTemplates((prev) => ({
                        ...prev,
                        entregado: { ...prev.entregado, title: e.target.value },
                      }))
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-slate-100 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Mensaje (Cuerpo):</label>
                  <textarea
                    rows={2}
                    value={notifTemplates.entregado?.body || ''}
                    onChange={(e) =>
                      setNotifTemplates((prev) => ({
                        ...prev,
                        entregado: { ...prev.entregado, body: e.target.value },
                      }))
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-slate-100 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* 6. CANCELADO / RECHAZADO */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4.5 space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-800/80 pb-2.5">
                  <span className="w-3 h-3 rounded-full bg-rose-500 shrink-0" />
                  <span className="font-extrabold text-xs text-rose-400 uppercase tracking-wider">
                    6. Pedido Cancelado / Rechazado
                  </span>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Título:</label>
                  <input
                    type="text"
                    value={notifTemplates.rechazado?.title || ''}
                    onChange={(e) =>
                      setNotifTemplates((prev) => ({
                        ...prev,
                        rechazado: { ...prev.rechazado, title: e.target.value },
                      }))
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-slate-100 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Mensaje (Cuerpo):</label>
                  <textarea
                    rows={2}
                    value={notifTemplates.rechazado?.body || ''}
                    onChange={(e) =>
                      setNotifTemplates((prev) => ({
                        ...prev,
                        rechazado: { ...prev.rechazado, body: e.target.value },
                      }))
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-slate-100 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-800">
              <button
                onClick={handleSaveNotificationTemplates}
                disabled={savingTemplates}
                className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all active:scale-95 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{savingTemplates ? 'Guardando Plantillas...' : '💾 Guardar Todas las Plantillas'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmación para Eliminar Cierre / Reporte */}
      {cierreToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-10 h-10 rounded-full bg-rose-500/20 border border-rose-500/30 flex items-center justify-center shrink-0 font-bold">
                <Trash2 className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-100">
                  ¿Eliminar Cierre de Caja?
                </h3>
                <p className="text-xs text-slate-400">
                  Cierre ID: <span className="font-mono text-emerald-400 font-bold">{cierreToDelete.id}</span>
                </p>
              </div>
            </div>

            <div className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80 space-y-1.5">
              <p>
                ¿Estás seguro de que deseas eliminar este reporte del{' '}
                <strong className="text-slate-100 font-mono">
                  {new Date(cierreToDelete.fechaCierre).toLocaleString('es-PY')}
                </strong>?
              </p>
              <div className="flex justify-between items-center text-[11px] pt-1 text-slate-400 border-t border-slate-800 font-mono">
                <span>Ventas Totales:</span>
                <span className="text-emerald-400 font-bold">Gs. {cierreToDelete.totalVentas.toLocaleString('es-PY')}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setCierreToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  handleEliminarCierre(cierreToDelete.id);
                  setCierreToDelete(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30 transition-all flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Confirmar Eliminación</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal for Creating New Order with AI Instruction Generator */}
      {showModalPedido && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-400" />
                Crear Pedido con Asistente IA
              </h3>
              <button
                onClick={() => setShowModalPedido(false)}
                className="text-slate-400 hover:text-slate-200 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateOrder} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Cliente:</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Carmen Benítez"
                    value={newOrder.cliente}
                    onChange={(e) => setNewOrder({ ...newOrder, cliente: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Teléfono:</label>
                  <input
                    type="text"
                    required
                    placeholder="+595 981 000000"
                    value={newOrder.telefono}
                    onChange={(e) => setNewOrder({ ...newOrder, telefono: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Dirección de Entrega:</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Av. Mariscal López 2200"
                  value={newOrder.direccion}
                  onChange={(e) => setNewOrder({ ...newOrder, direccion: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">
                  Items del Pedido (Separados por coma):
                </label>
                <input
                  type="text"
                  required
                  value={newOrder.itemsStr}
                  onChange={(e) => setNewOrder({ ...newOrder, itemsStr: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-xl px-3 py-2 font-mono"
                />
              </div>

              {/* Customer Note with Gemini AI Generator */}
              <div className="space-y-2 bg-slate-950/60 p-3.5 rounded-xl border border-indigo-900/40">
                <div className="flex items-center justify-between">
                  <label className="text-slate-300 font-semibold flex items-center gap-1.5">
                    Nota Original del Cliente:
                  </label>
                  <button
                    type="button"
                    onClick={handleOptimizarConIA}
                    disabled={loadingAi || !newOrder.notaCliente.trim()}
                    className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-slate-100 font-bold px-3 py-1 rounded-lg text-[11px] flex items-center gap-1 transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-indigo-200" />
                    {loadingAi ? 'Resumiendo...' : 'Resumir con IA'}
                  </button>
                </div>
                <textarea
                  rows={2}
                  placeholder="Ej. Favor tocar el timbre negro de la entrada lateral y no llamar al perro porque se asusta. Dejar paquete con la Sra. Rosa..."
                  value={newOrder.notaCliente}
                  onChange={(e) => setNewOrder({ ...newOrder, notaCliente: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-xl p-2.5 focus:ring-2 focus:ring-indigo-500"
                />

                {newOrder.instruccionOptimizada && (
                  <div className="bg-indigo-950/80 border border-indigo-500/40 p-2.5 rounded-xl text-indigo-200 font-medium text-xs">
                    <span className="font-bold text-indigo-400 block mb-0.5">
                      Instrucción Optimizada (Gemini AI):
                    </span>
                    "{newOrder.instruccionOptimizada}"
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Repartidor:</label>
                  <select
                    value={newOrder.repartidorId}
                    onChange={(e) => setNewOrder({ ...newOrder, repartidorId: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-xl px-3 py-2"
                  >
                    {repartidores.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.nombre} ({r.vehiculo.toUpperCase()})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Total (Gs.):</label>
                  <input
                    type="number"
                    value={newOrder.total}
                    onChange={(e) => setNewOrder({ ...newOrder, total: Number(e.target.value) })}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-xl px-3 py-2 font-mono"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModalPedido(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-slate-200 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-5 py-2 rounded-xl shadow-lg shadow-emerald-500/20"
                >
                  Guardar y Emitir Pedido
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 1: REPORTE DE CIERRE INDIVIDUAL (IMPRESION PDF & DETALLE) */}
      {showPrintReportModal && selectedCierreForDetail && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-6 my-8 print:bg-white print:text-black print:border-none print:shadow-none print:m-0 print:w-full">
            {/* Header / Brand */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800 print:border-black">
              <div className="flex items-center gap-3">
                <img src={currentLogo} alt="El Ternero" className="w-12 h-12 rounded-full object-contain bg-black border border-slate-700" />
                <div>
                  <h2 className="text-lg font-black text-white print:text-black">
                    {restauranteConfig?.nombre || 'EL TERNERO'}
                  </h2>
                  <p className="text-xs text-slate-400 print:text-gray-600">
                    {restauranteConfig?.direccion || 'Av. España y Perú, Asunción'} • Tel: {restauranteConfig?.telefono || '+595 981 100200'}
                  </p>
                </div>
              </div>

              <div className="text-left sm:text-right print:text-right">
                <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-xl font-mono text-xs font-bold inline-block print:border-gray-400 print:text-black">
                  {selectedCierreForDetail.id}
                </span>
                <p className="text-[11px] text-slate-400 mt-1 print:text-gray-600">
                  Fecha: {new Date(selectedCierreForDetail.fechaCierre).toLocaleString('es-PY')}
                </p>
              </div>
            </div>

            {/* Metrics Breakdown Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-950 print:bg-gray-100 p-3 rounded-xl border border-slate-800 print:border-gray-300">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 print:text-gray-600 font-bold block">
                  Monto Inicial
                </span>
                <span className="text-sm font-black text-slate-200 print:text-black font-mono">
                  Gs. {selectedCierreForDetail.montoInicial.toLocaleString('es-PY')}
                </span>
              </div>
              <div className="bg-slate-950 print:bg-gray-100 p-3 rounded-xl border border-slate-800 print:border-gray-300">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 print:text-gray-600 font-bold block">
                  Total Ventas
                </span>
                <span className="text-sm font-black text-emerald-400 print:text-black font-mono">
                  Gs. {selectedCierreForDetail.totalVentas.toLocaleString('es-PY')}
                </span>
              </div>
              <div className="bg-slate-950 print:bg-gray-100 p-3 rounded-xl border border-slate-800 print:border-gray-300">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 print:text-gray-600 font-bold block">
                  Total en Caja
                </span>
                <span className="text-sm font-black text-emerald-300 print:text-black font-mono">
                  Gs. {(selectedCierreForDetail.montoInicial + selectedCierreForDetail.totalVentas).toLocaleString('es-PY')}
                </span>
              </div>
              <div className="bg-slate-950 print:bg-gray-100 p-3 rounded-xl border border-slate-800 print:border-gray-300">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 print:text-gray-600 font-bold block">
                  Pedidos
                </span>
                <span className="text-sm font-black text-sky-400 print:text-black font-mono">
                  {selectedCierreForDetail.cantidadPedidos} Entregados
                </span>
              </div>
            </div>

            {/* Observaciones */}
            {selectedCierreForDetail.observaciones && (
              <div className="bg-slate-950/60 print:bg-gray-50 p-3 rounded-xl border border-slate-800 print:border-gray-300 text-xs">
                <span className="font-bold text-slate-300 print:text-gray-700 block mb-0.5">Observaciones:</span>
                <p className="text-slate-400 print:text-gray-600 italic">{selectedCierreForDetail.observaciones}</p>
              </div>
            )}

            {/* Breakdown by Driver (Ventas por Repartidor) */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-200 print:text-black uppercase tracking-wider flex items-center gap-1.5">
                <Bike className="w-4 h-4 text-emerald-400 print:text-black" />
                Resumen de Entregas y Montos por Repartidor:
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {Array.from(
                  (selectedCierreForDetail.pedidos || []).reduce((acc, p) => {
                    const key = p.repartidorNombre || 'Sin Asignar';
                    if (!acc.has(key)) acc.set(key, { cant: 0, total: 0 });
                    const curr = acc.get(key)!;
                    curr.cant += 1;
                    curr.total += p.total;
                    return acc;
                  }, new Map<string, { cant: number; total: number }>())
                ).map(([repNombre, data]) => (
                  <div key={repNombre} className="bg-slate-950 print:bg-gray-100 p-3 rounded-xl border border-slate-800 print:border-gray-300 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-slate-100 print:text-black block">{repNombre}</span>
                      <span className="text-[11px] text-slate-400 print:text-gray-600">{data.cant} envíos</span>
                    </div>
                    <span className="font-mono font-bold text-emerald-400 print:text-black">
                      Gs. {data.total.toLocaleString('es-PY')}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Itemized Orders Table */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-200 print:text-black uppercase tracking-wider flex items-center gap-1.5">
                <ShoppingBag className="w-4 h-4 text-emerald-400 print:text-black" />
                Detalle Desglosado de Pedidos Incluidos:
              </h4>

              <div className="overflow-x-auto rounded-xl border border-slate-800 print:border-gray-300">
                <table className="w-full text-left text-xs text-slate-300 print:text-black">
                  <thead className="bg-slate-950 print:bg-gray-200 text-slate-400 print:text-gray-700 font-mono text-[10px] uppercase">
                    <tr>
                      <th className="p-2.5">ID Pedido</th>
                      <th className="p-2.5">Cliente</th>
                      <th className="p-2.5">Repartidor</th>
                      <th className="p-2.5">Productos</th>
                      <th className="p-2.5 text-right">Monto (Gs.)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 print:divide-gray-300">
                    {(selectedCierreForDetail.pedidos || []).map((p) => (
                      <tr key={p.id} className="hover:bg-slate-950/40">
                        <td className="p-2.5 font-mono font-bold text-emerald-400 print:text-black">{p.id}</td>
                        <td className="p-2.5 font-bold text-slate-200 print:text-black">{p.cliente}</td>
                        <td className="p-2.5 text-slate-400 print:text-gray-700">{p.repartidorNombre}</td>
                        <td className="p-2.5 text-slate-300 print:text-black font-medium">
                          {(p.items || []).join(', ')}
                        </td>
                        <td className="p-2.5 text-right font-mono font-bold text-emerald-400 print:text-black">
                          Gs. {p.total.toLocaleString('es-PY')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer Buttons (Hidden during printing) */}
            <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 print:hidden">
              <button
                type="button"
                onClick={() => {
                  setShowPrintReportModal(false);
                  setSelectedCierreForDetail(null);
                }}
                className="px-4 py-2 rounded-xl text-slate-400 hover:text-slate-200 font-semibold text-xs"
              >
                ✕ Cerrar Ventana
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => exportCierreToCSV(selectedCierreForDetail)}
                  className="bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 font-bold text-xs px-4 py-2 rounded-xl transition-all flex items-center gap-1.5"
                >
                  <Download className="w-4 h-4" />
                  <span>Descargar Excel (.csv)</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs px-4 py-2 rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-1.5"
                >
                  <Printer className="w-4 h-4" />
                  <span>🖨️ Imprimir / Guardar en PDF</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: REPORTE MENSUAL ACUMULADO (EXCEL & PDF) */}
      {showMonthlyReportModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full p-6 shadow-2xl space-y-6 my-8 print:bg-white print:text-black print:border-none print:shadow-none print:m-0 print:w-full">
            {/* Header / Brand */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800 print:border-black">
              <div className="flex items-center gap-3">
                <img src={currentLogo} alt="El Ternero" className="w-12 h-12 rounded-full object-contain bg-black border border-slate-700" />
                <div>
                  <h2 className="text-lg font-black text-white print:text-black">
                    REPORTE MENSUAL DE CIERRES Y VENTAS
                  </h2>
                  <p className="text-xs text-slate-400 print:text-gray-600">
                    {restauranteConfig?.nombre || 'EL TERNERO'} • {restauranteConfig?.direccion || 'Asunción, Paraguay'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 print:hidden">
                <label className="text-xs font-bold text-slate-300">Seleccionar Mes:</label>
                <select
                  value={monthFilter}
                  onChange={(e) => setMonthFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-700 text-emerald-400 font-bold text-xs rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="todos">📅 Todos los Meses</option>
                  <option value="2026-07">Julio 2026</option>
                  <option value="2026-06">Junio 2026</option>
                  <option value="2026-05">Mayo 2026</option>
                  <option value="2026-04">Abril 2026</option>
                </select>
              </div>
            </div>

            {/* Monthly Summary Statistics */}
            {(() => {
              const cierresDelMes = monthFilter === 'todos'
                ? cierresDeCaja
                : cierresDeCaja.filter((c) => c.fechaCierre.startsWith(monthFilter));

              const totalVentasMes = cierresDelMes.reduce((acc, c) => acc + c.totalVentas, 0);
              const totalPedidosMes = cierresDelMes.reduce((acc, c) => acc + c.cantidadPedidos, 0);
              const ticketPromedio = totalPedidosMes > 0 ? Math.round(totalVentasMes / totalPedidosMes) : 0;

              return (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-slate-950 print:bg-gray-100 p-3.5 rounded-xl border border-slate-800 print:border-gray-300">
                      <span className="text-[10px] uppercase tracking-wider text-slate-400 print:text-gray-600 font-bold block">
                        Cierres Registrados
                      </span>
                      <span className="text-lg font-black text-white print:text-black font-mono">
                        {cierresDelMes.length} cierres
                      </span>
                    </div>

                    <div className="bg-slate-950 print:bg-gray-100 p-3.5 rounded-xl border border-slate-800 print:border-gray-300">
                      <span className="text-[10px] uppercase tracking-wider text-slate-400 print:text-gray-600 font-bold block">
                        Total Pedidos Entregados
                      </span>
                      <span className="text-lg font-black text-sky-400 print:text-black font-mono">
                        {totalPedidosMes} pedidos
                      </span>
                    </div>

                    <div className="bg-slate-950 print:bg-gray-100 p-3.5 rounded-xl border border-slate-800 print:border-gray-300">
                      <span className="text-[10px] uppercase tracking-wider text-slate-400 print:text-gray-600 font-bold block">
                        Monto Total Vendido
                      </span>
                      <span className="text-lg font-black text-emerald-400 print:text-black font-mono">
                        Gs. {totalVentasMes.toLocaleString('es-PY')}
                      </span>
                    </div>

                    <div className="bg-slate-950 print:bg-gray-100 p-3.5 rounded-xl border border-slate-800 print:border-gray-300">
                      <span className="text-[10px] uppercase tracking-wider text-slate-400 print:text-gray-600 font-bold block">
                        Ticket Promedio
                      </span>
                      <span className="text-lg font-black text-emerald-300 print:text-black font-mono">
                        Gs. {ticketPromedio.toLocaleString('es-PY')}
                      </span>
                    </div>
                  </div>

                  {/* Consolidated Table */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-200 print:text-black uppercase tracking-wider">
                      Resumen de Cierres del Periodo ({monthFilter}):
                    </h4>

                    <div className="overflow-x-auto rounded-xl border border-slate-800 print:border-gray-300">
                      <table className="w-full text-left text-xs text-slate-300 print:text-black">
                        <thead className="bg-slate-950 print:bg-gray-200 text-slate-400 print:text-gray-700 font-mono text-[10px] uppercase">
                          <tr>
                            <th className="p-2.5">Cierre ID</th>
                            <th className="p-2.5">Fecha</th>
                            <th className="p-2.5">Cant. Pedidos</th>
                            <th className="p-2.5">Monto Inicial</th>
                            <th className="p-2.5 text-right">Monto Ventas (Gs.)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 print:divide-gray-300">
                          {cierresDelMes.map((c) => (
                            <tr key={c.id}>
                              <td className="p-2.5 font-mono font-bold text-emerald-400 print:text-black">{c.id}</td>
                              <td className="p-2.5 font-mono text-slate-300 print:text-black">
                                {new Date(c.fechaCierre).toLocaleString('es-PY')}
                              </td>
                              <td className="p-2.5 text-slate-200 print:text-black">{c.cantidadPedidos} pedidos</td>
                              <td className="p-2.5 font-mono text-slate-400 print:text-gray-700">
                                Gs. {c.montoInicial.toLocaleString('es-PY')}
                              </td>
                              <td className="p-2.5 text-right font-mono font-bold text-emerald-400 print:text-black">
                                Gs. {c.totalVentas.toLocaleString('es-PY')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              );
            })()}

            {/* Footer Buttons (Hidden during printing) */}
            <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-3 print:hidden">
              <button
                type="button"
                onClick={() => setShowMonthlyReportModal(false)}
                className="px-4 py-2 rounded-xl text-slate-400 hover:text-slate-200 font-semibold text-xs"
              >
                ✕ Cerrar Ventana
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => exportMonthlyReportToCSV(monthFilter)}
                  className="bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 font-bold text-xs px-4 py-2 rounded-xl transition-all flex items-center gap-1.5"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                  <span>Exportar Excel (.csv)</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs px-4 py-2 rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-1.5"
                >
                  <Printer className="w-4 h-4" />
                  <span>🖨️ Imprimir Reporte PDF</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Modal para Dar de Baja / Bloquear / Reactivar / Eliminar Cliente */}
      {clientActionModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                  clientActionModal.type === 'bloquear'
                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    : clientActionModal.type === 'desbloquear'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                }`}>
                  {clientActionModal.type === 'bloquear' && <Lock className="w-5 h-5" />}
                  {clientActionModal.type === 'desbloquear' && <Unlock className="w-5 h-5" />}
                  {clientActionModal.type === 'eliminar' && <Trash2 className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-100">
                    {clientActionModal.type === 'bloquear' && 'Dar de Baja / Bloquear Cliente'}
                    {clientActionModal.type === 'desbloquear' && 'Reactivar Acceso de Cliente'}
                    {clientActionModal.type === 'eliminar' && 'Eliminar Registro de Cliente'}
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">
                    {clientActionModal.cliente.nombres} {clientActionModal.cliente.apellidos} (CI: {clientActionModal.cliente.cedula})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setClientActionModal(null)}
                className="text-slate-500 hover:text-slate-300 p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-500">Correo:</span>
                  <span className="font-mono text-slate-200">{clientActionModal.cliente.email}</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-500">Teléfono:</span>
                  <span className="font-mono text-slate-200">{clientActionModal.cliente.celular}</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-500">Estado Actual:</span>
                  <span className={`font-bold ${clientActionModal.cliente.bloqueado ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {clientActionModal.cliente.bloqueado ? 'BLOQUEADO / DADO DE BAJA' : 'ACTIVO'}
                  </span>
                </div>
              </div>

              {clientActionModal.type === 'bloquear' && (
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-300">
                    Motivo para dar de baja / bloquear el inicio de sesión:
                  </label>
                  <textarea
                    rows={3}
                    value={clientMotivoInput}
                    onChange={(e) => setClientMotivoInput(e.target.value)}
                    placeholder="Escribe el motivo del bloqueo..."
                    className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl p-3 focus:outline-none focus:border-rose-500"
                  />
                  <p className="text-[11px] text-rose-400/90 italic">
                    ⚠️ Al bloquear a este cliente, se le denegará inmediatamente el inicio de sesión y no podrá enviar nuevos pedidos.
                  </p>
                </div>
              )}

              {clientActionModal.type === 'desbloquear' && (
                <p className="text-xs text-slate-300 leading-relaxed">
                  ¿Confirmas que deseas reestablecer el acceso y reactivar la cuenta de <strong className="text-emerald-400">{clientActionModal.cliente.nombres} {clientActionModal.cliente.apellidos}</strong>? El cliente podrá volver a iniciar sesión y realizar pedidos normalmente.
                </p>
              )}

              {clientActionModal.type === 'eliminar' && (
                <div className="bg-rose-950/40 border border-rose-800/60 p-3.5 rounded-xl text-xs text-rose-300 leading-relaxed space-y-1">
                  <p className="font-bold flex items-center gap-1.5 text-rose-400">
                    <ShieldAlert className="w-4 h-4" />
                    <span>⚠️ Acción Irreversible</span>
                  </p>
                  <p>
                    Se eliminarán definitivamente los datos de este cliente del sistema. Se recomienda dar de baja si solo deseas impedir su acceso sin borrar su ficha.
                  </p>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setClientActionModal(null)}
                disabled={isClientActionLoading}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleConfirmClientAction}
                disabled={isClientActionLoading}
                className={`px-5 py-2.5 rounded-xl text-xs font-extrabold shadow-lg transition-all flex items-center gap-2 ${
                  clientActionModal.type === 'bloquear'
                    ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/20'
                    : clientActionModal.type === 'desbloquear'
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20'
                    : 'bg-rose-800 hover:bg-rose-700 text-white shadow-rose-900/40'
                }`}
              >
                {isClientActionLoading ? (
                  <span>Procesando...</span>
                ) : (
                  <>
                    {clientActionModal.type === 'bloquear' && (
                      <>
                        <Lock className="w-4 h-4" />
                        <span>Confirmar Bloqueo y Baja</span>
                      </>
                    )}
                    {clientActionModal.type === 'desbloquear' && (
                      <>
                        <Unlock className="w-4 h-4" />
                        <span>Confirmar Reactivación</span>
                      </>
                    )}
                    {clientActionModal.type === 'eliminar' && (
                      <>
                        <Trash2 className="w-4 h-4" />
                        <span>Eliminar Definitivamente</span>
                      </>
                    )}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: VER ENTREGAS REALIZADAS POR EL REPARTIDOR (SOLO ADMINISTRATIVO) */}
      {selectedDriverForStats && (() => {
        const stats = getDriverDeliveredOrders(selectedDriverForStats);

        let filteredOrders = stats.allOrders;
        if (driverStatsFilter === 'turno') {
          filteredOrders = stats.turnOrders;
        } else if (driverStatsFilter === 'historico') {
          filteredOrders = stats.historicOrders;
        }

        if (driverStatsSearch.trim()) {
          const q = driverStatsSearch.toLowerCase().trim();
          filteredOrders = filteredOrders.filter(
            (o) =>
              o.id.toLowerCase().includes(q) ||
              o.cliente.toLowerCase().includes(q) ||
              (o.telefono && o.telefono.includes(q)) ||
              (o.direccion && o.direccion.toLowerCase().includes(q))
          );
        }

        return (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-3xl w-full p-6 shadow-2xl space-y-5 my-8 text-slate-100">
              {/* Header Modal */}
              <div className="flex items-start justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 shadow-inner">
                    <Bike className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-mono font-bold uppercase tracking-wider">
                        Módulo Administrativo
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2 mt-0.5">
                      Verificación de Pedidos Entregados
                    </h3>
                    <p className="text-xs text-slate-400">
                      Repartidor: <strong className="text-emerald-400 font-bold">{selectedDriverForStats.nombre}</strong> (ID: {selectedDriverForStats.id}) • Chapa: <span className="font-mono text-emerald-300">{selectedDriverForStats.chapa || 'N/A'}</span>
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedDriverForStats(null)}
                  className="p-2 text-slate-400 hover:text-slate-100 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
                  title="Cerrar ventana"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Tarjetas KPI de Estadísticas */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-slate-950/80 border border-emerald-500/30 p-4 rounded-2xl space-y-1 shadow-lg">
                  <span className="text-[11px] text-emerald-400 uppercase font-bold flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-emerald-400" />
                    Total General de Entregas
                  </span>
                  <p className="text-2xl font-extrabold text-slate-100">{stats.totalCount} <span className="text-xs font-normal text-slate-400">pedidos</span></p>
                  <p className="text-xs font-mono text-emerald-400 font-bold">Gs. {stats.totalMontoGeneral.toLocaleString('es-PY')}</p>
                </div>

                <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-2xl space-y-1">
                  <span className="text-[11px] text-slate-400 uppercase font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    Turno Actual (Activo)
                  </span>
                  <p className="text-xl font-extrabold text-slate-100">{stats.turnOrders.length} <span className="text-xs font-normal text-slate-400">pedidos</span></p>
                  <p className="text-xs font-mono text-emerald-400 font-bold">Gs. {stats.totalMontoTurno.toLocaleString('es-PY')}</p>
                </div>

                <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-2xl space-y-1">
                  <span className="text-[11px] text-slate-400 uppercase font-bold flex items-center gap-1.5">
                    <Archive className="w-4 h-4 text-emerald-400" />
                    Cierres de Caja Anteriores
                  </span>
                  <p className="text-xl font-extrabold text-slate-100">{stats.historicOrders.length} <span className="text-xs font-normal text-slate-400">pedidos</span></p>
                  <p className="text-xs font-mono text-emerald-300 font-bold">Gs. {stats.totalMontoHistorico.toLocaleString('es-PY')}</p>
                </div>
              </div>

              {/* Filtros de Pestaña y Buscador */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                  <button
                    onClick={() => setDriverStatsFilter('todos')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                      driverStatsFilter === 'todos'
                        ? 'bg-emerald-500 text-slate-950 shadow-md'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Todos ({stats.totalCount})
                  </button>
                  <button
                    onClick={() => setDriverStatsFilter('turno')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                      driverStatsFilter === 'turno'
                        ? 'bg-emerald-500 text-slate-950 shadow-md'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Turno Actual ({stats.turnOrders.length})
                  </button>
                  <button
                    onClick={() => setDriverStatsFilter('historico')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                      driverStatsFilter === 'historico'
                        ? 'bg-emerald-500 text-slate-950 shadow-md'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Cierres Anteriores ({stats.historicOrders.length})
                  </button>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Buscar por ID, cliente, dirección..."
                    value={driverStatsSearch}
                    onChange={(e) => setDriverStatsSearch(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-xl pl-9 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Tabla de Pedidos Entregados */}
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {filteredOrders.length === 0 ? (
                  <div className="text-center py-10 text-slate-500 bg-slate-950/50 rounded-2xl border border-slate-800 space-y-2">
                    <Package className="w-8 h-8 text-slate-600 mx-auto" />
                    <p className="text-xs font-semibold">No se registraron pedidos entregados para este filtro.</p>
                  </div>
                ) : (
                  filteredOrders.map((ord) => (
                    <div
                      key={ord.id}
                      className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-700 transition-colors text-xs"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                            {ord.id}
                          </span>
                          <span className="font-bold text-slate-100">{ord.cliente}</span>
                          <span className="text-[10px] font-mono text-slate-400">📞 {ord.telefono}</span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              ord.esTurno
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'bg-slate-800 text-slate-400 border border-slate-700'
                            }`}
                          >
                            {ord.origen}
                          </span>
                        </div>
                        <p className="text-slate-400 truncate text-[11px] flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-rose-400 shrink-0" />
                          <span>{ord.direccion}</span>
                        </p>
                      </div>

                      <div className="text-right shrink-0 sm:self-center">
                        <p className="font-mono font-extrabold text-emerald-400 text-sm">
                          Gs. {ord.total.toLocaleString('es-PY')}
                        </p>
                        {ord.fecha && (
                          <p className="text-[10px] text-slate-500 font-mono">
                            {new Date(ord.fecha).toLocaleString('es-PY')}
                          </p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Footer Modal */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-400 font-mono">
                  Total desplegado: <strong>{filteredOrders.length}</strong> de {stats.totalCount} entregas
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedDriverForStats(null)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-4 py-2 rounded-xl text-xs transition-colors"
                >
                  Cerrar Ventana
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL CREAR NUEVA CATEGORÍA */}
      {showCreateCategoryModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-6 space-y-5 relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-400 stroke-[3]" />
                Crear Nueva Categoría de Producto
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateCategoryModal(false)}
                className="text-slate-400 hover:text-slate-100 p-1 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCategory} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Nombre de la Categoría:
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Pizzas Dulces, Combos, Empanadas..."
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  URL o Enlace de la Foto de Portada (Opcional):
                </label>
                <input
                  type="url"
                  placeholder="https://images.unsplash.com/..."
                  value={newCatFotoUrl}
                  onChange={(e) => setNewCatFotoUrl(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Si la dejas en blanco, se asignará una portada genérica por defecto. Podrás cambiarla en cualquier momento.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateCategoryModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold shadow-lg shadow-emerald-500/20 transition-all uppercase tracking-wider"
                >
                  Guardar Categoría
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CONFIRMAR MODIFICACIÓN DE UBICACIÓN EN MAPA */}
      {showConfirmLocationModal && pendingCoords && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-emerald-500/80 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-scale-up">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold text-2xl shrink-0">
                📍
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-100">
                  Confirmar Cambio de Ubicación del Local
                </h3>
                <p className="text-xs text-slate-400">
                  Esta ubicación se fijará como el punto central de tu restaurante en el mapa.
                </p>
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl text-xs space-y-2.5 font-mono">
              <div className="flex justify-between items-center text-slate-400">
                <span>Coordenadas Actuales:</span>
                <span className="text-slate-200 font-bold bg-slate-900 px-2.5 py-1 rounded border border-slate-800">
                  {latitudRestauranteInput.toFixed(4)}, {longitudRestauranteInput.toFixed(4)}
                </span>
              </div>
              <div className="flex justify-between items-center text-emerald-400 pt-2 border-t border-slate-800 font-bold">
                <span>Nueva Posición a Confirmar:</span>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-1 rounded">
                  {pendingCoords.lat.toFixed(4)}, {pendingCoords.lon.toFixed(4)}
                </span>
              </div>
            </div>

            <p className="text-xs text-emerald-200/90 font-medium bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl">
              ⚠️ La ubicación se encuentra sin modificar. ¿Confirmas expresamente que deseas guardar y fijar esta nueva posición para el restaurante?
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowConfirmLocationModal(false);
                  setPendingCoords(null);
                }}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmNewLocation}
                className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <Check className="w-4 h-4" />
                <span>Sí, Confirmar y Guardar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDITAR / RENOMBRAR CATEGORÍA */}
      {editingCatId && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-6 space-y-5 relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
                <Edit className="w-4 h-4 text-emerald-400" />
                Editar Nombre de Categoría
              </h3>
              <button
                type="button"
                onClick={() => {
                  setEditingCatId(null);
                  setEditingCatNameInput('');
                }}
                className="text-slate-400 hover:text-slate-100 p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRenameCategorySubmit} className="space-y-4 text-xs">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
                <span className="text-slate-400 text-[11px] block">Nombre actual:</span>
                <strong className="text-slate-200 text-sm">{editingCatId}</strong>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Nuevo Nombre para la Categoría:
                </label>
                <input
                  type="text"
                  required
                  placeholder="Escribe el nuevo nombre..."
                  value={editingCatNameInput}
                  onChange={(e) => setEditingCatNameInput(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  💡 Los productos asociados a esta categoría se actualizarán automáticamente con el nuevo nombre.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingCatId(null);
                    setEditingCatNameInput('');
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isRenamingCategory || !editingCatNameInput.trim()}
                  className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold shadow-lg shadow-emerald-500/20 transition-all uppercase tracking-wider flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {isRenamingCategory ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>{isRenamingCategory ? 'Guardando...' : 'Guardar Nuevo Nombre'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL VERIFICACIÓN DE COMPROBANTE DE TRANSFERENCIA ANTES DE ACEPTAR PEDIDO */}
      {verifyingPedido && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl space-y-4 p-5 sm:p-6 relative my-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold shrink-0">
                  <Landmark className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-100 flex items-center gap-2">
                    <span>Revisión de Comprobante de Transferencia</span>
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">
                    Pedido <span className="text-emerald-400 font-bold">{verifyingPedido.id}</span> • Total a Verificar: <span className="text-emerald-300 font-bold font-mono">Gs. {verifyingPedido.total.toLocaleString()}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setVerifyingPedido(null);
                  setIsZoomingReceipt(false);
                }}
                className="text-slate-400 hover:text-slate-100 p-1.5 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Datos del Cliente y Pedido */}
            <div className="grid grid-cols-2 gap-2 text-xs bg-slate-950 p-3 rounded-2xl border border-slate-800">
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Cliente:</span>
                <span className="text-slate-200 font-bold">{verifyingPedido.cliente}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Teléfono:</span>
                <span className="text-slate-200 font-mono">📞 {verifyingPedido.telefono}</span>
              </div>
              <div className="col-span-2 pt-1 border-t border-slate-900 flex items-center justify-between">
                <span className="text-slate-400">Items: {verifyingPedido.items?.join(', ') || '1x Pedido'}</span>
                <span className="text-emerald-400 font-bold font-mono text-sm">
                  Gs. {verifyingPedido.total.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Visualizador del Comprobante Adjunto */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Image className="w-4 h-4 text-indigo-400" />
                  <span>Comprobante Adjuntado por el Cliente:</span>
                </label>
                {verifyingPedido.comprobanteUrl && (
                  <button
                    type="button"
                    onClick={() => setIsZoomingReceipt(!isZoomingReceipt)}
                    className="text-[11px] text-indigo-300 hover:text-indigo-200 flex items-center gap-1 font-semibold"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                    <span>{isZoomingReceipt ? 'Reducir' : 'Ampliar Imagen'}</span>
                  </button>
                )}
              </div>

              {verifyingPedido.comprobanteUrl ? (
                <div
                  className={`bg-slate-950 rounded-2xl overflow-hidden border border-indigo-500/30 flex items-center justify-center p-2 transition-all ${
                    isZoomingReceipt ? 'max-h-[70vh]' : 'max-h-[260px]'
                  }`}
                >
                  <img
                    src={verifyingPedido.comprobanteUrl}
                    alt="Comprobante de Transferencia"
                    className="max-h-full w-auto object-contain rounded-xl shadow-lg cursor-zoom-in"
                    onClick={() => setIsZoomingReceipt(!isZoomingReceipt)}
                  />
                </div>
              ) : (
                <div className="bg-amber-950/30 border border-amber-500/40 text-amber-300 p-4 rounded-2xl text-xs space-y-1 text-center">
                  <AlertCircle className="w-6 h-6 text-amber-400 mx-auto" />
                  <p className="font-bold">El cliente no adjuntó imagen del comprobante.</p>
                  <p className="text-[11px] text-amber-400/80">
                    Revisa directamente en tu aplicación bancaria si ingresó la transferencia por Gs. {verifyingPedido.total.toLocaleString()} antes de aceptar.
                  </p>
                </div>
              )}
            </div>

            {/* Checkbox de Confirmación Obligatorio para Aceptar */}
            <div
              onClick={() => setComprobanteReviewedCheck(!comprobanteReviewedCheck)}
              className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer select-none flex items-start gap-3 ${
                comprobanteReviewedCheck
                  ? 'bg-emerald-950/60 border-emerald-500/80 text-emerald-200 shadow-md shadow-emerald-950'
                  : 'bg-slate-950 border-amber-500/50 text-slate-300 hover:border-amber-400'
              }`}
            >
              <input
                type="checkbox"
                checked={comprobanteReviewedCheck}
                onChange={(e) => setComprobanteReviewedCheck(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-slate-700 text-emerald-500 focus:ring-emerald-500 cursor-pointer"
              />
              <div className="text-xs">
                <p className="font-bold text-slate-100">
                  {comprobanteReviewedCheck ? '✓ Comprobante Verificado' : 'Confirmar Verificación Bancaria:'}
                </p>
                <p className={`text-[11px] mt-0.5 ${comprobanteReviewedCheck ? 'text-emerald-300 font-semibold' : 'text-amber-300/90'}`}>
                  Confirmo que revisé la cuenta bancaria / comprobante y que el monto de{' '}
                  <strong className="text-white">Gs. {verifyingPedido.total.toLocaleString()}</strong> fue recibido correctamente.
                </p>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-800 gap-2">
              <button
                type="button"
                onClick={() => {
                  handleRechazarPedidoAdmin(verifyingPedido.id);
                  setVerifyingPedido(null);
                }}
                className="px-3.5 py-2.5 bg-rose-950/80 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/40 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <AlertCircle className="w-4 h-4" />
                <span>Rechazar</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setVerifyingPedido(null);
                    setIsZoomingReceipt(false);
                  }}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  disabled={!comprobanteReviewedCheck}
                  onClick={() => handleAceptarPedidoAdmin(verifyingPedido.id, true)}
                  className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-slate-950 font-black rounded-xl text-xs shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2 uppercase tracking-wider cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Aceptar Pedido Verificado</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

