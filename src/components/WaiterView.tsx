import React, { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { Mesa, Producto, ItemComandaMesa, MetodoPago, RestauranteConfig } from '../types';
import logoImg from '../assets/images/el_ternero_logo.svg';
import {
  Utensils,
  Users,
  Clock,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  Search,
  RefreshCw,
  Printer,
  DollarSign,
  ArrowLeftRight,
  X,
  Sparkles,
  ChefHat,
  Receipt,
  Flame,
  User,
  Coffee,
  Check,
  Percent,
  Layers,
  Pizza,
  HelpCircle,
  FileText,
  LayoutGrid,
  Square,
  Maximize2
} from 'lucide-react';

interface WaiterViewProps {
  socket: Socket | null;
  productos: Producto[];
  logoUrl?: string;
  restauranteConfig?: RestauranteConfig;
  onRefreshData?: () => void;
}

export const WaiterView: React.FC<WaiterViewProps> = ({
  socket,
  productos,
  logoUrl,
  restauranteConfig,
  onRefreshData,
}) => {
  // 15 Mesas state
  const [mesas, setMesas] = useState<Mesa[]>(() =>
    Array.from({ length: 15 }, (_, i) => ({
      numero: i + 1,
      nombre: `Mesa ${i + 1}`,
      estado: 'libre',
      capacidad: i < 4 ? 2 : i < 11 ? 4 : 6,
      items: [],
      total: 0,
    }))
  );

  const [activeMozo, setActiveMozo] = useState<string>('Mozo Salón');
  const [selectedFilter, setSelectedFilter] = useState<'todas' | 'ocupadas' | 'libres' | 'cuenta'>('todas');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [tableLayoutMode, setTableLayoutMode] = useState<'cuadros' | 'cuadros_tactiles'>('cuadros');

  // Modals state
  const [selectedMesa, setSelectedMesa] = useState<Mesa | null>(null);
  const [showComandaModal, setShowComandaModal] = useState<boolean>(false);
  const [showPreCuentaModal, setShowPreCuentaModal] = useState<boolean>(false);
  const [showCobroModal, setShowCobroModal] = useState<boolean>(false);
  const [showTransferModal, setShowTransferModal] = useState<boolean>(false);
  const [showOpenMesaModal, setShowOpenMesaModal] = useState<boolean>(false);

  // New comanda items buffer
  const [currentOrderItems, setCurrentOrderItems] = useState<ItemComandaMesa[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [productSearch, setProductSearch] = useState<string>('');
  const [itemObservacion, setItemObservacion] = useState<string>('');
  const [productForObs, setProductForObs] = useState<Producto | null>(null);

  // Open mesa form state
  const [openClienteNombre, setOpenClienteNombre] = useState<string>('');
  const [openMozoNombre, setOpenMozoNombre] = useState<string>('');
  const [openNota, setOpenNota] = useState<string>('');
  const [openCapacidad, setOpenCapacidad] = useState<number>(4);

  // Cobro state
  const [metodoCobro, setMetodoCobro] = useState<MetodoPago>('efectivo');
  const [montoPagaCon, setMontoPagaCon] = useState<string>('');
  const [cobroExitoso, setCobroExitoso] = useState<boolean>(false);

  // Transfer state
  const [destinoTransfer, setDestinoTransfer] = useState<number>(1);

  // Pizza half & half builder state
  const [isHalfPizzaModalOpen, setIsHalfPizzaModalOpen] = useState(false);
  const [half1, setHalf1] = useState<Producto | null>(null);
  const [half2, setHalf2] = useState<Producto | null>(null);

  const activeLogo = logoUrl || restauranteConfig?.logoUrl || logoImg;

  // Cargar mesas vía API y Socket
  const fetchMesas = async () => {
    try {
      const res = await fetch('/api/mesas');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setMesas(data);
        }
      }
    } catch (e) {
      console.error('Error fetching mesas:', e);
    }
  };

  useEffect(() => {
    fetchMesas();

    if (!socket) return;

    const handleMesasUpdated = (data: Mesa[]) => {
      if (Array.isArray(data)) {
        setMesas(data);
        // Si hay una mesa abierta en modal, sincronizarla
        setSelectedMesa((prev) => (prev ? data.find((m) => m.numero === prev.numero) || null : null));
      }
    };

    const handleEstadoInicial = (data: any) => {
      if (data && Array.isArray(data.mesas)) {
        setMesas(data.mesas);
      }
    };

    socket.on('mesas_actualizadas', handleMesasUpdated);
    socket.on('estado_inicial', handleEstadoInicial);

    return () => {
      socket.off('mesas_actualizadas', handleMesasUpdated);
      socket.off('estado_inicial', handleEstadoInicial);
    };
  }, [socket]);

  // Cálculos de métricas
  const totalMesas = mesas.length;
  const ocupadasCount = mesas.filter((m) => m.estado === 'ocupada').length;
  const cuentasCount = mesas.filter((m) => m.estado === 'cuenta_pedida').length;
  const ocupadasTotal = ocupadasCount + cuentasCount;
  const libresCount = mesas.filter((m) => m.estado === 'libre').length;
  const porcentajeOcupacion = Math.round((ocupadasTotal / (totalMesas || 1)) * 100);
  const totalVentasSaloneEnCurso = mesas.reduce((sum, m) => sum + (m.total || 0), 0);

  // Filtrado de mesas
  const filteredMesas = mesas.filter((mesa) => {
    if (selectedFilter === 'ocupadas' && mesa.estado !== 'ocupada') return false;
    if (selectedFilter === 'cuenta' && mesa.estado !== 'cuenta_pedida') return false;
    if (selectedFilter === 'libres' && mesa.estado !== 'libre') return false;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const matchNum = String(mesa.numero).includes(term);
      const matchName = mesa.nombre.toLowerCase().includes(term);
      const matchClient = (mesa.clienteNombre || '').toLowerCase().includes(term);
      const matchMozo = (mesa.mozoAsignado || '').toLowerCase().includes(term);
      if (!matchNum && !matchName && !matchClient && !matchMozo) return false;
    }
    return true;
  });

  // Categorías de productos
  const categories = ['Todos', ...Array.from(new Set(productos.map((p) => p.categoria || 'General')))];

  const filteredProducts = productos.filter((p) => {
    if (selectedCategory !== 'Todos' && (p.categoria || 'General') !== selectedCategory) return false;
    if (productSearch.trim()) {
      const term = productSearch.toLowerCase();
      return p.nombre.toLowerCase().includes(term) || (p.descripcion || '').toLowerCase().includes(term);
    }
    return true;
  });

  // Acciones de mesas
  const handleOpenMesaModal = (mesa: Mesa) => {
    setSelectedMesa(mesa);
    setOpenClienteNombre(mesa.clienteNombre || '');
    setOpenMozoNombre(mesa.mozoAsignado || activeMozo);
    setOpenNota(mesa.nota || '');
    setOpenCapacidad(mesa.capacidad || 4);
    setShowOpenMesaModal(true);
  };

  const handleConfirmOpenMesa = async () => {
    if (!selectedMesa) return;
    try {
      const res = await fetch(`/api/mesas/${selectedMesa.numero}/abrir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mozoAsignado: openMozoNombre || activeMozo,
          clienteNombre: openClienteNombre,
          nota: openNota,
          capacidad: openCapacidad,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedMesa(data.mesa);
        setShowOpenMesaModal(false);
        // Abrir inmediatamente modal de comanda para tomar pedido
        setCurrentOrderItems([]);
        setShowComandaModal(true);
      }
    } catch (e) {
      console.error('Error abriendo mesa:', e);
    }
  };

  const handleOpenComanda = (mesa: Mesa) => {
    setSelectedMesa(mesa);
    setCurrentOrderItems([]);
    setShowComandaModal(true);
  };

  const handleAddItemToComanda = (prod: Producto, obs: string = '') => {
    setCurrentOrderItems((prev) => {
      const existingIndex = prev.findIndex(
        (it) => it.productoId === prod.id && (it.observacion || '') === obs.trim()
      );
      if (existingIndex !== -1) {
        const updated = [...prev];
        updated[existingIndex].cantidad += 1;
        updated[existingIndex].subtotal = updated[existingIndex].cantidad * updated[existingIndex].precioUnitario;
        return updated;
      } else {
        return [
          ...prev,
          {
            id: `MITEM-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            productoId: prod.id,
            nombre: prod.nombre,
            cantidad: 1,
            precioUnitario: prod.monto,
            subtotal: prod.monto,
            observacion: obs.trim(),
            agregadoEn: new Date().toISOString(),
          },
        ];
      }
    });
    setProductForObs(null);
    setItemObservacion('');
  };

  const handleUpdateItemQuantity = (index: number, delta: number) => {
    setCurrentOrderItems((prev) => {
      const updated = [...prev];
      const newQty = updated[index].cantidad + delta;
      if (newQty <= 0) {
        updated.splice(index, 1);
      } else {
        updated[index].cantidad = newQty;
        updated[index].subtotal = newQty * updated[index].precioUnitario;
      }
      return updated;
    });
  };

  const handleSendComandaToCocina = async () => {
    if (!selectedMesa || currentOrderItems.length === 0) return;
    try {
      const res = await fetch(`/api/mesas/${selectedMesa.numero}/comanda`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: currentOrderItems,
          mozoAsignado: selectedMesa.mozoAsignado || activeMozo,
          clienteNombre: selectedMesa.clienteNombre,
          nota: selectedMesa.nota,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedMesa(data.mesa);
        setShowComandaModal(false);
        setCurrentOrderItems([]);
        if (onRefreshData) onRefreshData();
      }
    } catch (e) {
      console.error('Error enviando comanda:', e);
    }
  };

  const handleRequestPreCuenta = async (mesa: Mesa) => {
    try {
      const res = await fetch(`/api/mesas/${mesa.numero}/cuenta`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setSelectedMesa(data.mesa);
        setShowPreCuentaModal(true);
      }
    } catch (e) {
      console.error('Error solicitando cuenta:', e);
    }
  };

  const handleOpenCobroModal = (mesa: Mesa) => {
    setSelectedMesa(mesa);
    setMetodoCobro('efectivo');
    setMontoPagaCon(String(mesa.total || ''));
    setCobroExitoso(false);
    setShowCobroModal(true);
  };

  const handleConfirmCobro = async () => {
    if (!selectedMesa) return;
    try {
      const res = await fetch(`/api/mesas/${selectedMesa.numero}/cobrar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metodoPago: metodoCobro,
          montoPagaCon: montoPagaCon ? Number(montoPagaCon) : selectedMesa.total,
        }),
      });
      if (res.ok) {
        setCobroExitoso(true);
        setTimeout(() => {
          setShowCobroModal(false);
          setShowPreCuentaModal(false);
          setSelectedMesa(null);
          setCobroExitoso(false);
          if (onRefreshData) onRefreshData();
        }, 1200);
      }
    } catch (e) {
      console.error('Error cobrando mesa:', e);
    }
  };

  const handleLiberarMesa = async (mesa: Mesa) => {
    if (confirm(`¿Estás seguro de liberar y desocupar la Mesa #${mesa.numero}?`)) {
      try {
        await fetch(`/api/mesas/${mesa.numero}/liberar`, { method: 'POST' });
        if (onRefreshData) onRefreshData();
      } catch (e) {
        console.error('Error liberando mesa:', e);
      }
    }
  };

  const handleOpenTransferModal = (mesa: Mesa) => {
    setSelectedMesa(mesa);
    // Buscar primera mesa libre
    const firstFree = mesas.find((m) => m.estado === 'libre' && m.numero !== mesa.numero);
    if (firstFree) {
      setDestinoTransfer(firstFree.numero);
    }
    setShowTransferModal(true);
  };

  const handleConfirmTransfer = async () => {
    if (!selectedMesa) return;
    try {
      const res = await fetch(`/api/mesas/${selectedMesa.numero}/transferir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destinoNumero: destinoTransfer }),
      });
      if (res.ok) {
        setShowTransferModal(false);
        setSelectedMesa(null);
        if (onRefreshData) onRefreshData();
      }
    } catch (e) {
      console.error('Error transfiriendo mesa:', e);
    }
  };

  // Agregar pizza mitad y mitad
  const handleAddHalfAndHalfPizza = () => {
    if (!half1 || !half2) return;
    const precio = Math.max(half1.monto, half2.monto);
    const nombre = `Pizza Mitad ${half1.nombre} / Mitad ${half2.nombre}`;

    const customItem: ItemComandaMesa = {
      id: `HALF-${Date.now()}`,
      productoId: `half_${half1.id}_${half2.id}`,
      nombre,
      cantidad: 1,
      precioUnitario: precio,
      subtotal: precio,
      observacion: '🍕 Comanda Mitad/Mitad',
      agregadoEn: new Date().toISOString(),
    };

    setCurrentOrderItems((prev) => [...prev, customItem]);
    setIsHalfPizzaModalOpen(false);
    setHalf1(null);
    setHalf2(null);
  };

  const formatGs = (amount: number) => `Gs. ${(amount || 0).toLocaleString('es-PY')}`;

  const calculateVuelto = () => {
    const pagaCon = Number(montoPagaCon) || 0;
    const total = selectedMesa?.total || 0;
    if (pagaCon >= total) {
      return pagaCon - total;
    }
    return 0;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-16">
      {/* Top Header & Salón Overview Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-500" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          {/* Brand & Mozo Profile Info */}
          <div className="flex items-center gap-4">
            <img
              src={activeLogo}
              alt="EL TERNERO"
              className="w-14 h-14 rounded-2xl object-contain bg-black border-2 border-emerald-500/80 shadow-lg shadow-emerald-500/20 p-1 shrink-0"
            />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-slate-100 uppercase tracking-tight">
                  MÓDULO DE MOZOS • SALÓN (15 MESAS)
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse">
                  EN VIVO
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                Gestión de comandas, mesas en salón y sincronización instantánea con Cocina (KDS)
              </p>
            </div>
          </div>

          {/* Active Mozo Selector & Quick Actions */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 bg-slate-950 px-3.5 py-2 rounded-2xl border border-slate-800">
              <User className="w-4 h-4 text-emerald-400 shrink-0" />
              <div className="text-left">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Mozo en Turno:</p>
                <select
                  value={activeMozo}
                  onChange={(e) => setActiveMozo(e.target.value)}
                  className="bg-transparent text-xs font-black text-emerald-400 cursor-pointer focus:outline-none border-none p-0"
                >
                  <option value="Mozo Salón" className="bg-slate-900 text-slate-200">Mozo de Salón (General)</option>
                  <option value="Mozo Juan" className="bg-slate-900 text-slate-200">Mozo Juan</option>
                  <option value="Mozo Lucas" className="bg-slate-900 text-slate-200">Mozo Lucas</option>
                  <option value="Mozo Andrea" className="bg-slate-900 text-slate-200">Moza Andrea</option>
                  <option value="Mozo Carlos" className="bg-slate-900 text-slate-200">Mozo Carlos</option>
                  <option value="Mozo María" className="bg-slate-900 text-slate-200">Moza María</option>
                </select>
              </div>
            </div>

            <button
              onClick={fetchMesas}
              className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-2xl border border-slate-700 transition-all cursor-pointer"
              title="Refrescar estado de mesas"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Real-time Status Metric Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mt-6 pt-5 border-t border-slate-800/80">
          <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-3.5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300 font-black text-base shrink-0">
              15
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Mesas</p>
              <p className="text-sm font-black text-slate-200">15 Mesas Salón</p>
            </div>
          </div>

          <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-2xl p-3.5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-black text-base shrink-0 animate-pulse">
              {ocupadasTotal}
            </div>
            <div>
              <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">Ocupadas ({porcentajeOcupacion}%)</p>
              <p className="text-sm font-black text-emerald-300">{ocupadasTotal} Mesas con Comanda</p>
            </div>
          </div>

          <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-3.5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-400 font-black text-base shrink-0">
              {libresCount}
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Mesas Libres</p>
              <p className="text-sm font-black text-slate-300">{libresCount} Disponibles</p>
            </div>
          </div>

          <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-3.5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-black shrink-0">
              ₲
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Consumo en Vivo</p>
              <p className="text-sm font-black text-emerald-400 truncate">{formatGs(totalVentasSaloneEnCurso)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs, Layout Toggle & Search Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-slate-900 p-3.5 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setSelectedFilter('todas')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              selectedFilter === 'todas'
                ? 'bg-emerald-500 text-slate-950 font-extrabold shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            Todas (15)
          </button>

          <button
            onClick={() => setSelectedFilter('ocupadas')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
              selectedFilter === 'ocupadas'
                ? 'bg-emerald-500 text-slate-950 font-extrabold shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Ocupadas ({ocupadasCount})</span>
          </button>

          <button
            onClick={() => setSelectedFilter('cuenta')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
              selectedFilter === 'cuenta'
                ? 'bg-amber-500 text-slate-950 font-extrabold shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>Pre-Cuenta ({cuentasCount})</span>
          </button>

          <button
            onClick={() => setSelectedFilter('libres')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              selectedFilter === 'libres'
                ? 'bg-slate-700 text-slate-100 font-extrabold shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            Libres ({libresCount})
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* Mode Switcher: Cuadros POS vs Cuadros Táctiles 1:1 */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 shrink-0">
            <button
              onClick={() => setTableLayoutMode('cuadros')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                tableLayoutMode === 'cuadros'
                  ? 'bg-emerald-500 text-slate-950 font-black shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Vista de cuadros con botones y detalles"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Cuadros POS</span>
            </button>
            <button
              onClick={() => setTableLayoutMode('cuadros_tactiles')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                tableLayoutMode === 'cuadros_tactiles'
                  ? 'bg-emerald-500 text-slate-950 font-black shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Vista de cuadros cuadrados táctiles 1:1"
            >
              <Square className="w-3.5 h-3.5" />
              <span>Cuadros 1:1</span>
            </button>
          </div>

          <div className="relative w-full sm:w-56">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar mesa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-xl pl-9 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* Grid of 15 Tables as SQUARE BOXES (Cuadros de Mesas 1 a 15) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5 sm:gap-4.5">
        {filteredMesas.map((mesa) => {
          const isOcupada = mesa.estado === 'ocupada';
          const isCuenta = mesa.estado === 'cuenta_pedida';
          const isLibre = mesa.estado === 'libre';

          // --- VISTA 1: CUADROS TÁCTILES 1:1 (Aspect Square Tiles) ---
          if (tableLayoutMode === 'cuadros_tactiles') {
            return (
              <div
                key={mesa.numero}
                onClick={() => {
                  if (isLibre) {
                    handleOpenMesaModal(mesa);
                  } else {
                    handleOpenComanda(mesa);
                  }
                }}
                className={`aspect-square rounded-3xl p-3.5 sm:p-4 flex flex-col justify-between transition-all duration-300 relative overflow-hidden group cursor-pointer active:scale-95 select-none ${
                  isOcupada
                    ? 'border-2 animate-mesa-ocupada shadow-xl ring-2 ring-emerald-400/40 text-emerald-200'
                    : isCuenta
                    ? 'bg-amber-950/80 border-2 border-amber-500 shadow-xl ring-2 ring-amber-400/30 text-amber-200'
                    : 'bg-slate-900 border-2 border-dashed border-slate-800 hover:border-emerald-500/50 hover:bg-slate-800/80 text-slate-300'
                }`}
              >
                {/* Cuadro Header */}
                <div className="flex items-center justify-between">
                  <span
                    className={`text-sm sm:text-base font-mono font-black px-2.5 py-1 rounded-xl border ${
                      isOcupada
                        ? 'bg-emerald-950 border-emerald-400 text-emerald-300 shadow-[0_0_8px_rgba(34,197,94,0.6)]'
                        : isCuenta
                        ? 'bg-amber-950 border-amber-400 text-amber-300'
                        : 'bg-slate-950 border-slate-800 text-slate-300'
                    }`}
                  >
                    M#{mesa.numero}
                  </span>

                  <span
                    className={`text-[9px] sm:text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                      isOcupada
                        ? 'bg-emerald-500 text-slate-950 border-emerald-300 font-extrabold shadow-[0_0_8px_rgba(34,197,94,0.8)]'
                        : isCuenta
                        ? 'bg-amber-500 text-slate-950 border-amber-300 font-extrabold'
                        : 'bg-slate-950 text-slate-400 border-slate-800'
                    }`}
                  >
                    {isOcupada ? 'OCUPADA' : isCuenta ? 'CUENTA' : 'LIBRE'}
                  </span>
                </div>

                {/* Cuadro Center: Visual Table Graphic & Info */}
                <div className="text-center my-auto space-y-1">
                  <div className="flex items-center justify-center">
                    <div
                      className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex flex-col items-center justify-center border transition-transform group-hover:scale-105 ${
                        isOcupada
                          ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                          : isCuenta
                          ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                          : 'bg-slate-950 border-slate-800 text-slate-500 group-hover:text-emerald-400 group-hover:border-emerald-500/40'
                      }`}
                    >
                      <Utensils className="w-5 h-5 sm:w-6 sm:h-6" />
                      <span className="text-[9px] font-bold mt-0.5">{mesa.capacidad}p</span>
                    </div>
                  </div>

                  {isOcupada || isCuenta ? (
                    <div className="min-w-0">
                      <p className="text-xs font-black text-slate-100 truncate">
                        {mesa.clienteNombre || 'Comensales'}
                      </p>
                      <p className="text-[10px] text-emerald-400 font-mono font-bold">
                        {mesa.items.length} ítems • {formatGs(mesa.total)}
                      </p>
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-500 font-medium">
                      Tocar para abrir
                    </p>
                  )}
                </div>

                {/* Cuadro Footer Action Cue */}
                <div className="pt-2 border-t border-slate-800/80 text-center">
                  <span
                    className={`text-[10px] font-black uppercase tracking-wider block truncate ${
                      isOcupada
                        ? 'text-emerald-300'
                        : isCuenta
                        ? 'text-amber-300'
                        : 'text-emerald-400 group-hover:underline'
                    }`}
                  >
                    {isOcupada ? '👉 Ver Comanda' : isCuenta ? '💳 Cobrar' : '+ Abrir Mesa'}
                  </span>
                </div>
              </div>
            );
          }

          // --- VISTA 2: CUADROS POS (Square Cards with complete actions) ---
          return (
            <div
              key={mesa.numero}
              className={`rounded-3xl p-4 sm:p-4.5 flex flex-col justify-between transition-all duration-300 relative overflow-hidden group shadow-lg min-h-[290px] ${
                isOcupada
                  ? 'border-2 animate-mesa-ocupada shadow-xl ring-2 ring-emerald-400/40 text-emerald-200'
                  : isCuenta
                  ? 'bg-amber-950/80 border-2 border-amber-500 shadow-xl ring-2 ring-amber-400/30 text-amber-200'
                  : 'bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300'
              }`}
            >
              {/* Cuadro Top: Square Table Number Block & Status */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-10 h-10 rounded-xl border flex items-center justify-center font-mono font-black text-base shrink-0 ${
                        isOcupada
                          ? 'bg-emerald-950 border-emerald-400 text-emerald-300 shadow-[0_0_10px_rgba(34,197,94,0.6)]'
                          : isCuenta
                          ? 'bg-amber-950 border-amber-400 text-amber-300'
                          : 'bg-slate-950 border-slate-800 text-slate-300'
                      }`}
                    >
                      #{mesa.numero}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-black uppercase text-slate-200 truncate">
                        {mesa.nombre}
                      </h4>
                      <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                        <Users className="w-2.5 h-2.5 text-emerald-400" />
                        {mesa.capacidad} personas
                      </span>
                    </div>
                  </div>

                  {/* Estado Badge with neon pulse for occupied */}
                  <span
                    className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border flex items-center gap-1 shrink-0 ${
                      isOcupada
                        ? 'bg-emerald-500 text-slate-950 border-emerald-300 font-extrabold shadow-[0_0_12px_rgba(34,197,94,0.8)] animate-pulse'
                        : isCuenta
                        ? 'bg-amber-500 text-slate-950 border-amber-300 font-extrabold animate-pulse'
                        : 'bg-slate-950 text-slate-400 border-slate-800'
                    }`}
                  >
                    {isOcupada && <span className="w-1.5 h-1.5 rounded-full bg-slate-950 animate-ping shrink-0" />}
                    {isCuenta && <Receipt className="w-2.5 h-2.5" />}
                    <span>{isOcupada ? 'OCUPADA' : isCuenta ? 'CUENTA' : 'LIBRE'}</span>
                  </span>
                </div>

                {/* Cuadro Body: Table details (Client, Waiter, Time, Total) */}
                <div className="bg-slate-950/80 p-2.5 rounded-2xl border border-slate-800/90 space-y-1 text-xs">
                  {mesa.aperturaHora && (
                    <div className="flex items-center justify-between text-[10px] text-slate-400 border-b border-slate-800/80 pb-1">
                      <span className="font-medium">Hora inicio:</span>
                      <span className="flex items-center gap-1 font-mono text-emerald-400 font-bold">
                        <Clock className="w-2.5 h-2.5" />
                        {new Date(mesa.aperturaHora).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  )}

                  {(isOcupada || isCuenta) ? (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between font-bold text-slate-200 text-xs">
                        <span className="truncate">👤 {mesa.clienteNombre || 'Comensales'}</span>
                        <span className="text-[10px] text-emerald-400 font-mono font-normal">
                          {mesa.items.length} ítems
                        </span>
                      </div>
                      <p className="text-[10px] text-emerald-400 font-medium truncate">
                        💁 {mesa.mozoAsignado || 'Mozo Salón'}
                      </p>
                      {mesa.nota && (
                        <p className="text-[9px] text-slate-400 italic truncate">
                          💬 "{mesa.nota}"
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="py-2 text-center">
                      <p className="text-[11px] text-slate-500 font-medium">
                        Mesa libre lista para comensales
                      </p>
                    </div>
                  )}
                </div>

                {/* Consumo Actual Total */}
                {(isOcupada || isCuenta) && (
                  <div className="bg-slate-950 p-2 rounded-xl border border-emerald-500/30 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Total:</span>
                    <span className="text-xs font-black text-emerald-400 font-mono">
                      {formatGs(mesa.total)}
                    </span>
                  </div>
                )}
              </div>

              {/* Action Buttons for Mesa Cuadro */}
              <div className="pt-2.5 mt-2 border-t border-slate-800/80 space-y-1.5">
                {isLibre ? (
                  <button
                    onClick={() => handleOpenMesaModal(mesa)}
                    className="w-full py-2.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-md hover:shadow-emerald-500/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <Plus className="w-4 h-4 text-slate-950" />
                    <span>Abrir Mesa</span>
                  </button>
                ) : (
                  <div className="space-y-1.5">
                    {/* Primary Button: Agregar / Ver Comanda */}
                    <button
                      onClick={() => handleOpenComanda(mesa)}
                      className="w-full py-2 px-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-[11px] uppercase tracking-wider shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                    >
                      <Utensils className="w-3.5 h-3.5 text-slate-950" />
                      <span>Comanda (+Platos)</span>
                    </button>

                    {/* Secondary Actions Row */}
                    <div className="grid grid-cols-3 gap-1">
                      <button
                        onClick={() => handleRequestPreCuenta(mesa)}
                        className="py-1 px-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-[9px] font-bold transition-all flex items-center justify-center gap-0.5 cursor-pointer"
                        title="Ver / Imprimir Pre-Cuenta"
                      >
                        <Receipt className="w-2.5 h-2.5" />
                        <span>Cuenta</span>
                      </button>

                      <button
                        onClick={() => handleOpenCobroModal(mesa)}
                        className="py-1 px-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-lg text-[9px] font-bold transition-all flex items-center justify-center gap-0.5 cursor-pointer"
                        title="Cobrar y Cerrar Mesa"
                      >
                        <DollarSign className="w-2.5 h-2.5" />
                        <span>Cobrar</span>
                      </button>

                      <button
                        onClick={() => handleOpenTransferModal(mesa)}
                        className="py-1 px-1 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-[9px] font-bold transition-all flex items-center justify-center gap-0.5 cursor-pointer"
                        title="Mover o transferir a otra mesa"
                      >
                        <ArrowLeftRight className="w-2.5 h-2.5" />
                        <span>Mover</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* --- MODAL 1: ABRIR MESA --- */}
      {showOpenMesaModal && selectedMesa && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500" />

            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-mono font-black">
                  #{selectedMesa.numero}
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-100">Abrir Mesa #{selectedMesa.numero}</h3>
                  <p className="text-[11px] text-emerald-400 font-semibold">Salón EL TERNERO</p>
                </div>
              </div>
              <button
                onClick={() => setShowOpenMesaModal(false)}
                className="text-slate-400 hover:text-slate-100 p-1.5 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Nombre del Cliente / Referencia (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ej: Familia Gómez, Carlos B., Cumpleaños..."
                  value={openClienteNombre}
                  onChange={(e) => setOpenClienteNombre(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                    Mozo Asignado
                  </label>
                  <input
                    type="text"
                    value={openMozoNombre}
                    onChange={(e) => setOpenMozoNombre(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                    Comensales (Personas)
                  </label>
                  <select
                    value={openCapacidad}
                    onChange={(e) => setOpenCapacidad(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 font-bold cursor-pointer"
                  >
                    <option value={2}>2 Personas</option>
                    <option value={4}>4 Personas</option>
                    <option value={6}>6 Personas</option>
                    <option value={8}>8 Personas</option>
                    <option value={10}>10+ Personas</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Nota / Ubicación Salón (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ej: Terraza, Cerca de la barra, Sin sal en papas..."
                  value={openNota}
                  onChange={(e) => setOpenNota(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowOpenMesaModal(false)}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmOpenMesa}
                className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
              >
                Abrir & Tomar Pedido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 2: TOMAR COMANDA / AGREGAR PLATOS A MESA --- */}
      {showComandaModal && selectedMesa && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-5xl w-full h-[92vh] max-h-[850px] shadow-2xl flex flex-col overflow-hidden relative">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-500" />

            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-slate-950/60 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-slate-950 flex items-center justify-center font-mono font-black text-lg shadow-md">
                  #{selectedMesa.numero}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base sm:text-lg font-black text-slate-100 uppercase">
                      Comanda • Mesa #{selectedMesa.numero}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      {selectedMesa.mozoAsignado || activeMozo}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-medium">
                    {selectedMesa.clienteNombre ? `Cliente: ${selectedMesa.clienteNombre}` : 'Comensales en Salón'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowComandaModal(false)}
                className="text-slate-400 hover:text-slate-100 p-2 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: Two columns layout (Catalog & Active Comanda Cart) */}
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
              {/* Left Column: Product Catalog */}
              <div className="flex-1 flex flex-col border-r border-slate-800 p-3 sm:p-5 overflow-hidden">
                {/* Search & Mitad/Mitad Pizza Quick Action */}
                <div className="flex items-center gap-2 mb-3">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Buscar producto..."
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl pl-9 pr-3 py-2 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsHalfPizzaModalOpen(true)}
                    className="py-2 px-3 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    <Pizza className="w-3.5 h-3.5 text-amber-400" />
                    <span className="hidden sm:inline">Mitad / Mitad</span>
                    <span className="sm:hidden">1/2 Pizza</span>
                  </button>
                </div>

                {/* Category Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-2.5 mb-2 shrink-0">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                        selectedCategory === cat
                          ? 'bg-emerald-500 text-slate-950 font-extrabold shadow'
                          : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {/* Product Grid */}
                <div className="flex-1 overflow-y-auto pr-1 space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
                    {filteredProducts.map((prod) => (
                      <div
                        key={prod.id}
                        className="bg-slate-950 border border-slate-800/90 hover:border-emerald-500/60 rounded-2xl p-3 flex flex-col justify-between gap-2 transition-all hover:bg-slate-900 group"
                      >
                        <div className="flex items-start gap-2.5">
                          <img
                            src={prod.imagen || prod.fotoUrl}
                            alt={prod.nombre}
                            className="w-12 h-12 rounded-xl object-cover bg-slate-800 shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <h4 className="text-xs font-black text-slate-100 line-clamp-1 group-hover:text-emerald-400 transition-colors">
                              {prod.nombre}
                            </h4>
                            <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">{prod.categoria}</p>
                            <p className="text-xs font-black text-emerald-400 font-mono mt-1">
                              {formatGs(prod.monto)}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 pt-1.5 border-t border-slate-800/60">
                          <button
                            type="button"
                            onClick={() => handleAddItemToComanda(prod)}
                            className="flex-1 py-1.5 px-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-[11px] rounded-lg shadow-sm transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-95"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Agregar</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setProductForObs(prod);
                              setItemObservacion('');
                            }}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                            title="Agregar con nota / instrucción"
                          >
                            📝
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column: Active Comanda & Previous Items */}
              <div className="w-full lg:w-96 bg-slate-950 flex flex-col p-4 sm:p-5 overflow-hidden shrink-0 border-t lg:border-t-0">
                {/* Comanda Items List */}
                <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800 shrink-0">
                    <span className="text-xs font-black uppercase text-emerald-400 flex items-center gap-1.5">
                      <ChefHat className="w-4 h-4" />
                      <span>Nuevos Platos a Enviar: ({currentOrderItems.reduce((acc, it) => acc + it.cantidad, 0)})</span>
                    </span>
                    {currentOrderItems.length > 0 && (
                      <button
                        onClick={() => setCurrentOrderItems([])}
                        className="text-[10px] text-rose-400 hover:underline cursor-pointer"
                      >
                        Limpiar
                      </button>
                    )}
                  </div>

                  {/* New Items to Add */}
                  <div className="flex-1 overflow-y-auto py-2 space-y-2 pr-1">
                    {currentOrderItems.length === 0 ? (
                      <div className="text-center py-8 text-slate-500 space-y-2">
                        <Utensils className="w-8 h-8 mx-auto text-slate-600" />
                        <p className="text-xs">Selecciona productos del menú a la izquierda para agregarlos a la comanda.</p>
                      </div>
                    ) : (
                      currentOrderItems.map((item, idx) => (
                        <div
                          key={`${item.productoId}-${idx}`}
                          className="bg-slate-900 border border-emerald-500/40 rounded-xl p-2.5 flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-slate-100 truncate">{item.nombre}</p>
                            {item.observacion && (
                              <p className="text-[10px] text-amber-300 italic truncate">
                                💬 "{item.observacion}"
                              </p>
                            )}
                            <p className="text-[11px] text-emerald-400 font-mono font-bold mt-0.5">
                              {formatGs(item.subtotal)}
                            </p>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800">
                            <button
                              onClick={() => handleUpdateItemQuantity(idx, -1)}
                              className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center font-bold text-xs"
                            >
                              -
                            </button>
                            <span className="font-mono font-bold text-xs px-1 text-slate-100">{item.cantidad}</span>
                            <button
                              onClick={() => handleUpdateItemQuantity(idx, 1)}
                              className="w-5 h-5 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center justify-center font-bold text-xs"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      ))
                    )}

                    {/* Already Ordered items on this table */}
                    {selectedMesa.items && selectedMesa.items.length > 0 && (
                      <div className="pt-3 mt-3 border-t border-slate-800/80 space-y-1.5">
                        <p className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">
                          Platos previamente enviados a Cocina ({selectedMesa.items.length}):
                        </p>
                        {selectedMesa.items.map((it) => (
                          <div
                            key={it.id}
                            className="bg-slate-900/60 border border-slate-800 rounded-lg px-2.5 py-1.5 flex items-center justify-between text-[11px] text-slate-300"
                          >
                            <span className="truncate">
                              {it.cantidad}x {it.nombre}
                              {it.observacion && <span className="text-[10px] text-amber-400/80 ml-1">[{it.observacion}]</span>}
                            </span>
                            <span className="font-mono text-emerald-400/90 font-bold shrink-0">
                              {formatGs(it.subtotal)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Footer: Total and Send Action */}
                <div className="pt-3 border-t border-slate-800 space-y-2.5 shrink-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Total Acumulado Mesa</p>
                      <p className="text-base font-black text-emerald-400 font-mono">
                        {formatGs(
                          (selectedMesa.total || 0) +
                            currentOrderItems.reduce((acc, it) => acc + it.subtotal, 0)
                        )}
                      </p>
                    </div>

                    <span className="text-[11px] text-slate-400">
                      Mesa #{selectedMesa.numero}
                    </span>
                  </div>

                  <button
                    onClick={handleSendComandaToCocina}
                    disabled={currentOrderItems.length === 0}
                    className="w-full py-3.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                  >
                    <ChefHat className="w-4 h-4 text-slate-950" />
                    <span>🔔 Enviar Comanda a Cocina (KDS)</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 3: NOTA / OBSERVACIÓN PARA UN PRODUCTO --- */}
      {productForObs && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-5 shadow-2xl space-y-4">
            <h4 className="text-sm font-black text-slate-100">
              Observación para: <span className="text-emerald-400">{productForObs.nombre}</span>
            </h4>
            <input
              type="text"
              placeholder="Ej: Sin cebolla, Salsa aparte, Término medio..."
              value={itemObservacion}
              onChange={(e) => setItemObservacion(e.target.value)}
              autoFocus
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setProductForObs(null)}
                className="flex-1 py-2 bg-slate-800 text-slate-300 font-bold text-xs rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleAddItemToComanda(productForObs, itemObservacion)}
                className="flex-1 py-2 bg-emerald-500 text-slate-950 font-black text-xs rounded-xl"
              >
                Agregar con Nota
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 4: PIZZA MITAD Y MITAD --- */}
      {isHalfPizzaModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Pizza className="w-6 h-6 text-amber-400" />
                <h3 className="text-base font-black text-slate-100">Comanda • Pizza Mitad / Mitad</h3>
              </div>
              <button onClick={() => setIsHalfPizzaModalOpen(false)} className="text-slate-400 hover:text-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300">1ra Mitad:</label>
                <select
                  value={half1?.id || ''}
                  onChange={(e) => {
                    const found = productos.find((p) => p.id === e.target.value);
                    setHalf1(found || null);
                  }}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl p-2.5 text-xs font-bold focus:border-emerald-500 focus:outline-none"
                >
                  <option value="">Seleccionar sabor...</option>
                  {productos
                    .filter((p) => (p.categoria || '').toLowerCase().includes('pizza'))
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre} ({formatGs(p.monto)})
                      </option>
                    ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300">2da Mitad:</label>
                <select
                  value={half2?.id || ''}
                  onChange={(e) => {
                    const found = productos.find((p) => p.id === e.target.value);
                    setHalf2(found || null);
                  }}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl p-2.5 text-xs font-bold focus:border-emerald-500 focus:outline-none"
                >
                  <option value="">Seleccionar sabor...</option>
                  {productos
                    .filter((p) => (p.categoria || '').toLowerCase().includes('pizza'))
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre} ({formatGs(p.monto)})
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {half1 && half2 && (
              <div className="bg-slate-950 p-3.5 rounded-2xl border border-emerald-500/40 flex items-center justify-between">
                <div>
                  <p className="text-xs font-black text-slate-100">
                    Mitad {half1.nombre} + Mitad {half2.nombre}
                  </p>
                  <p className="text-[11px] text-slate-400">Precio según mitad mayor</p>
                </div>
                <p className="text-sm font-black text-emerald-400 font-mono">
                  {formatGs(Math.max(half1.monto, half2.monto))}
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setIsHalfPizzaModalOpen(false)}
                className="flex-1 py-2.5 bg-slate-800 text-slate-300 font-bold text-xs rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddHalfAndHalfPizza}
                disabled={!half1 || !half2}
                className="flex-1 py-2.5 bg-emerald-500 disabled:opacity-40 text-slate-950 font-black text-xs uppercase rounded-xl shadow"
              >
                Agregar Pizza a Comanda
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 5: PRE-CUENTA / TICKET DE LA MESA --- */}
      {showPreCuentaModal && selectedMesa && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-black text-slate-100">Pre-Cuenta • Mesa #{selectedMesa.numero}</h3>
              </div>
              <button onClick={() => setShowPreCuentaModal(false)} className="text-slate-400 hover:text-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Printable Ticket Area */}
            <div
              id="ticket-mesa-print"
              className="bg-white text-slate-900 p-5 rounded-2xl font-mono text-xs space-y-3 shadow-inner"
            >
              <div className="text-center border-b border-dashed border-slate-400 pb-3 space-y-1">
                <p className="font-black text-sm uppercase">EL TERNERO</p>
                <p className="text-[10px] text-slate-600">Sabor que nace del campo</p>
                <p className="text-[10px] text-slate-700 font-bold">PRE-CUENTA DE SALÓN • MESA #{selectedMesa.numero}</p>
                <p className="text-[9px] text-slate-500">
                  Fecha: {new Date().toLocaleDateString('es-PY')} • {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
                <p className="text-[9px] text-slate-500">
                  Mozo: {selectedMesa.mozoAsignado || 'Salón'} • Cliente: {selectedMesa.clienteNombre || 'Comensales'}
                </p>
              </div>

              <div className="space-y-1.5 py-1">
                {selectedMesa.items.map((it, idx) => (
                  <div key={idx} className="flex justify-between items-start text-[11px]">
                    <div className="flex-1 pr-2">
                      <span>{it.cantidad}x {it.nombre}</span>
                      {it.observacion && <p className="text-[9px] text-slate-500 italic">[{it.observacion}]</p>}
                    </div>
                    <span className="font-bold shrink-0">{formatGs(it.subtotal)}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-dashed border-slate-400 pt-2 space-y-1 text-right">
                <div className="flex justify-between font-black text-sm text-slate-950">
                  <span>TOTAL A PAGAR:</span>
                  <span>{formatGs(selectedMesa.total)}</span>
                </div>
                <p className="text-[9px] text-center text-slate-500 pt-2">
                  * Este documento es un comprobante de consumo para salón *
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4 text-emerald-400" />
                <span>Imprimir Ticket</span>
              </button>

              <button
                onClick={() => {
                  setShowPreCuentaModal(false);
                  handleOpenCobroModal(selectedMesa);
                }}
                className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow"
              >
                <DollarSign className="w-4 h-4 text-slate-950" />
                <span>Proceder al Cobro</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 6: COBRO Y CIERRE DE MESA --- */}
      {showCobroModal && selectedMesa && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500" />

            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-100">Cobrar Mesa #{selectedMesa.numero}</h3>
                <p className="text-xs text-emerald-400 font-bold">{selectedMesa.clienteNombre || 'Comensales de Salón'}</p>
              </div>
              <button onClick={() => setShowCobroModal(false)} className="text-slate-400 hover:text-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            {cobroExitoso ? (
              <div className="text-center py-8 space-y-3">
                <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto animate-bounce">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h4 className="text-lg font-black text-slate-100">¡Cobro Registrado con Éxito!</h4>
                <p className="text-xs text-emerald-400 font-bold">Mesa #{selectedMesa.numero} ha sido liberada.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Total amount banner */}
                <div className="bg-slate-950 p-4 rounded-2xl border border-emerald-500/40 text-center">
                  <p className="text-xs font-bold text-slate-400 uppercase">Monto Total a Cobrar</p>
                  <p className="text-2xl font-black text-emerald-400 font-mono mt-0.5">
                    {formatGs(selectedMesa.total)}
                  </p>
                </div>

                {/* Payment Method Selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">Método de Pago:</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setMetodoCobro('efectivo')}
                      className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all ${
                        metodoCobro === 'efectivo'
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-extrabold shadow'
                          : 'bg-slate-950 text-slate-400 border-slate-800'
                      }`}
                    >
                      💵 Efectivo
                    </button>
                    <button
                      type="button"
                      onClick={() => setMetodoCobro('transferencia')}
                      className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all ${
                        metodoCobro === 'transferencia'
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-extrabold shadow'
                          : 'bg-slate-950 text-slate-400 border-slate-800'
                      }`}
                    >
                      🏦 Transfer.
                    </button>
                    <button
                      type="button"
                      onClick={() => setMetodoCobro('gpay')}
                      className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all ${
                        metodoCobro === 'gpay'
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-extrabold shadow'
                          : 'bg-slate-950 text-slate-400 border-slate-800'
                      }`}
                    >
                      💳 Tarjeta / POS
                    </button>
                  </div>
                </div>

                {/* Cash Change (Vuelto) Calculator */}
                {metodoCobro === 'efectivo' && (
                  <div className="space-y-2 bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
                    <label className="text-[11px] font-bold text-slate-300 uppercase">Paga Con (Gs.):</label>
                    <input
                      type="number"
                      value={montoPagaCon}
                      onChange={(e) => setMontoPagaCon(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono text-emerald-400 font-bold focus:outline-none focus:border-emerald-500"
                    />

                    {/* Quick money buttons */}
                    <div className="flex gap-1.5 flex-wrap pt-1">
                      {[50000, 100000, 150000, 200000].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setMontoPagaCon(String(val))}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 text-[10px] font-mono text-slate-300 hover:bg-slate-700"
                        >
                          {val.toLocaleString()}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setMontoPagaCon(String(selectedMesa.total))}
                        className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 text-[10px] font-bold"
                      >
                        Exacto
                      </button>
                    </div>

                    {Number(montoPagaCon) > selectedMesa.total && (
                      <div className="flex justify-between items-center pt-2 text-xs font-bold text-emerald-400">
                        <span>Vuelto / Cambio:</span>
                        <span className="font-mono text-sm">{formatGs(calculateVuelto())}</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => handleLiberarMesa(selectedMesa)}
                    className="py-3 px-3 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-xl text-xs font-bold transition-all cursor-pointer"
                    title="Desocupar mesa sin cobrar"
                  >
                    Desocupar
                  </button>

                  <button
                    onClick={handleConfirmCobro}
                    className="flex-1 py-3 px-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4 text-slate-950" />
                    <span>Confirmar Cobro y Liberar</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- MODAL 7: TRANSFERIR / MOVER MESA --- */}
      {showTransferModal && selectedMesa && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ArrowLeftRight className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-black text-slate-100">Transferir Mesa #{selectedMesa.numero}</h3>
              </div>
              <button onClick={() => setShowTransferModal(false)} className="text-slate-400 hover:text-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-slate-300">
                Mover comensales y comanda activa de <strong className="text-emerald-400">Mesa #{selectedMesa.numero}</strong> hacia:
              </p>

              <select
                value={destinoTransfer}
                onChange={(e) => setDestinoTransfer(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl p-3 text-xs font-bold focus:border-emerald-500 focus:outline-none"
              >
                {mesas
                  .filter((m) => m.estado === 'libre')
                  .map((m) => (
                    <option key={m.numero} value={m.numero}>
                      Mesa #{m.numero} (Capacidad: {m.capacidad} pers. - Libre)
                    </option>
                  ))}
              </select>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowTransferModal(false)}
                className="flex-1 py-2.5 bg-slate-800 text-slate-300 font-bold text-xs rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmTransfer}
                className="flex-1 py-2.5 bg-emerald-500 text-slate-950 font-black text-xs uppercase rounded-xl shadow"
              >
                Mover a Mesa #{destinoTransfer}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
