import React, { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { Pedido } from '../types';
import logoImg from '../assets/images/el_ternero_logo.svg';
import {
  Utensils,
  Flame,
  CheckCircle2,
  Clock,
  Printer,
  Volume2,
  VolumeX,
  RefreshCw,
  Search,
  X,
  AlertTriangle,
  User,
  Phone,
  MapPin,
  Lock,
  Eye,
  EyeOff,
  ChefHat,
  ArrowLeft,
  Bell
} from 'lucide-react';

interface KitchenViewProps {
  pedidos: Pedido[];
  socket: Socket | null;
  onRefreshData?: () => void;
  logoUrl?: string;
  restauranteConfig?: { nombre?: string; logoUrl?: string };
}

const parseItemObs = (itemStr: string) => {
  if (!itemStr) return { main: '', obs: null };
  const str = itemStr.trim();

  // Pattern 1: [Obs: ...] or [sin lechuga, sin tomate]
  const bracketMatch = str.match(/^(.*?)\s*\[(?:Obs:\s*|Observaci[oó]n:\s*)?(.*?)\]$/i);
  if (bracketMatch && bracketMatch[2]?.trim()) {
    return { main: bracketMatch[1].trim(), obs: bracketMatch[2].trim() };
  }

  // Pattern 2: (Obs: ...) or (sin lechuga, sin tomate)
  const parenMatch = str.match(/^(.*?)\s*\((?:Obs:\s*|Observaci[oó]n:\s*)?(.*?)\)$/i);
  if (parenMatch && parenMatch[2]?.trim()) {
    return { main: parenMatch[1].trim(), obs: parenMatch[2].trim() };
  }

  // Pattern 3: - Obs: ... or - sin lechuga
  const dashMatch = str.match(/^(.*?)\s*[\-\–]\s*(?:Obs:\s*|Observaci[oó]n:\s*)(.*)$/i);
  if (dashMatch && dashMatch[2]?.trim()) {
    return { main: dashMatch[1].trim(), obs: dashMatch[2].trim() };
  }

  return { main: str, obs: null };
};

const parseKitchenNotes = (rawNota?: string) => {
  if (!rawNota || !rawNota.trim()) return { extraProductObs: [], cleanGeneralNote: '' };

  const str = rawNota.trim();
  let cleanGeneralNote = '';
  const extraProductObs: string[] = [];

  if (str.includes('OBSERVACIONES POR PRODUCTO:')) {
    const parts = str.split('NOTA DE ENTREGA:');
    const obsPart = parts[0] || '';
    const notePart = parts[1] || '';

    const lines = obsPart.split('\n');
    lines.forEach((line) => {
      const cleanLine = line.replace('OBSERVACIONES POR PRODUCTO:', '').trim();
      if (cleanLine) {
        extraProductObs.push(cleanLine.replace(/^•\s*/, ''));
      }
    });

    cleanGeneralNote = notePart.trim();
  } else {
    cleanGeneralNote = str;
  }

  return { extraProductObs, cleanGeneralNote };
};

export const KitchenView: React.FC<KitchenViewProps> = ({
  pedidos,
  socket,
  onRefreshData,
  logoUrl,
  restauranteConfig,
}) => {
  const activeLogo = logoUrl || (restauranteConfig?.logoUrl && restauranteConfig.logoUrl !== '/el_ternero_logo.svg' && restauranteConfig.logoUrl.trim() !== '' ? restauranteConfig.logoUrl : logoImg);

  // Authentication State for Kitchen Screen
  const [isKitchenLoggedIn, setIsKitchenLoggedIn] = useState<boolean>(true);
  const [kitchenUser, setKitchenUser] = useState<string>('cocina');
  const [kitchenPass, setKitchenPass] = useState<string>('cocina123');
  const [showPass, setShowPass] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string>('');

  // KDS View Filters
  const [filterTab, setFilterTab] = useState<'pendientes' | 'preparando' | 'listos' | 'todos'>('pendientes');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [isPlayingTestSound, setIsPlayingTestSound] = useState<boolean>(false);

  // Synthesize pleasant kitchen chime sound using Web Audio API
  const playKitchenChimeSound = () => {
    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();

      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const playTone = (freq: number, startTime: number, duration: number, vol = 0.35) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(vol, startTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + duration);
      };

      const now = ctx.currentTime;
      // High-frequency dual ding-dong kitchen bell chime
      playTone(659.25, now, 0.4, 0.4);        // E5
      playTone(880, now + 0.12, 0.4, 0.45);   // A5
      playTone(1046.50, now + 0.28, 0.7, 0.5); // C6
    } catch (err) {
      console.error('Error al reproducir el sonido de cocina:', err);
    }
  };

  const handleTestSound = () => {
    playKitchenChimeSound();
    setIsPlayingTestSound(true);
    setTimeout(() => {
      setIsPlayingTestSound(false);
    }, 1200);
  };

  // Socket listener for new incoming orders in kitchen
  useEffect(() => {
    if (!socket) return;

    const handleNewOrderAlert = () => {
      if (soundEnabled) {
        playKitchenChimeSound();
        setIsPlayingTestSound(true);
        setTimeout(() => setIsPlayingTestSound(false), 1200);
      }
    };

    socket.on('nuevo_pedido', handleNewOrderAlert);
    socket.on('pedido_actualizado', handleNewOrderAlert);

    return () => {
      socket.off('nuevo_pedido', handleNewOrderAlert);
      socket.off('pedido_actualizado', handleNewOrderAlert);
    };
  }, [socket, soundEnabled]);

  // Selected Ticket for Print / Zoom
  const [selectedTicket, setSelectedTicket] = useState<Pedido | null>(null);

  // Live Clock
  const [currentTime, setCurrentTime] = useState<string>(new Date().toLocaleTimeString('es-PY'));

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString('es-PY'));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Handle Login
  const handleKitchenLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      (kitchenUser.trim() === 'cocina' && kitchenPass === 'cocina123') ||
      kitchenPass === '1234'
    ) {
      setIsKitchenLoggedIn(true);
      setAuthError('');
    } else {
      setAuthError('Usuario o contraseña de cocina incorrectos (Demo: cocina / cocina123)');
    }
  };

  // Change Order Status
  const handleUpdateStatus = (pedidoId: string, nuevoEstado: Pedido['estado']) => {
    if (socket) {
      socket.emit('cambiar_estado_pedido', {
        pedidoId,
        estado: nuevoEstado,
      });
    }

    // Fallback REST call
    fetch(`/api/pedidos/${pedidoId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: nuevoEstado }),
    })
      .then(() => {
        if (onRefreshData) onRefreshData();
      })
      .catch((err) => console.error('Error al actualizar estado en cocina:', err));
  };

  // Calculate elapsed time from timestamp or order ID
  const getElapsedTime = (pedido: Pedido) => {
    if (!pedido.ultimaActualizacion) return 'Reciente';
    const updated = new Date(pedido.ultimaActualizacion).getTime();
    if (isNaN(updated)) return 'Reciente';
    const diffMins = Math.floor((Date.now() - updated) / 60000);
    if (diffMins < 1) return 'Hace instantes';
    return `${diffMins} min`;
  };

  // Filter Orders for Kitchen
  // Orders accepted by Admin need kitchen prep ('aceptado' or 'preparando')
  const acceptedOrders = pedidos.filter((p) => p.estado === 'aceptado');
  const preparingOrders = pedidos.filter((p) => p.estado === 'preparando');
  const readyOrders = pedidos.filter((p) => p.estado === 'comanda_lista' || p.estado === 'en_camino' || p.estado === 'entregado');

  let filteredOrders = pedidos;
  if (filterTab === 'pendientes') {
    filteredOrders = acceptedOrders;
  } else if (filterTab === 'preparando') {
    filteredOrders = preparingOrders;
  } else if (filterTab === 'listos') {
    filteredOrders = readyOrders;
  } else {
    filteredOrders = pedidos.filter((p) => p.estado !== 'rechazado');
  }

  if (searchTerm.trim()) {
    const q = searchTerm.toLowerCase().trim();
    filteredOrders = filteredOrders.filter(
      (p) =>
        p.id.toLowerCase().includes(q) ||
        p.cliente.toLowerCase().includes(q) ||
        (p.items && p.items.some((it) => it.toLowerCase().includes(q)))
    );
  }

  // Kitchen Login Screen
  if (!isKitchenLoggedIn) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-8 shadow-2xl space-y-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 via-emerald-500 to-emerald-500" />

          <div className="text-center space-y-2">
            <img
              src={activeLogo}
              alt="EL TERNERO Logo"
              className="w-16 h-16 rounded-full object-contain bg-black border-2 border-emerald-500 shadow-xl shadow-emerald-500/20 ring-2 ring-slate-800 mx-auto"
            />
            <h2 className="text-xl font-black text-slate-100 tracking-tight">EL TERNERO • PANTALLA DE COCINA</h2>
            <p className="text-xs text-slate-400">
              Inicia sesión para gestionar comandas y pedidos aceptados por Administración.
            </p>
          </div>

          <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 text-xs text-slate-400 space-y-1">
            <span className="font-semibold text-emerald-400 flex items-center gap-1">
              🔑 Credenciales de Prueba:
            </span>
            <p className="font-mono text-[11px] text-slate-300">
              Usuario: <strong className="text-emerald-300">cocina</strong> • Contraseña: <strong className="text-emerald-300">cocina123</strong>
            </p>
          </div>

          {authError && (
            <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs p-3 rounded-xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleKitchenLogin} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Usuario de Cocina:
              </label>
              <input
                type="text"
                required
                value={kitchenUser}
                onChange={(e) => setKitchenUser(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-xl px-4 py-3 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="cocina"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Contraseña:
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  required
                  value={kitchenPass}
                  onChange={(e) => setKitchenPass(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-xl pl-4 pr-10 py-3 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-200"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-3.5 rounded-xl text-sm shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            >
              <Utensils className="w-4 h-4" />
              <span>Iniciar Sesión en Cocina</span>
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* Top Banner Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-emerald-500 to-emerald-500" />

        <div className="flex items-center gap-4">
          <img
            src={activeLogo}
            alt="EL TERNERO Logo"
            className="w-14 h-14 rounded-full object-contain bg-black border-2 border-emerald-500 shadow-xl shadow-emerald-500/20 ring-1 ring-slate-800 shrink-0"
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-mono font-bold uppercase tracking-wider">
                Digital KDS • Sistema de Comandas
              </span>
              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-mono font-bold">
                EN VIVO: {currentTime}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-100 mt-1 flex items-center gap-2">
              EL TERNERO • COCINA Y COMANDAS
            </h2>
            <p className="text-xs text-slate-400">
              Los pedidos aceptados por Administración se muestran aquí en tiempo real para iniciar el preparativo.
            </p>
          </div>
        </div>

        {/* Action Controls & Sound Toggle */}
        <div className="flex flex-wrap items-center gap-2.5 self-start md:self-center shrink-0">
          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`px-3 py-2 rounded-xl text-xs font-bold border flex items-center gap-2 transition-all ${
              soundEnabled
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
            title="Activar o desactivar sonido de nueva comanda"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4" />}
            <span className="hidden sm:inline">{soundEnabled ? 'Sonido Activo' : 'Sin Sonido'}</span>
          </button>

          <button
            type="button"
            onClick={handleTestSound}
            className={`px-3 py-2 rounded-xl text-xs font-extrabold border flex items-center gap-2 transition-all active:scale-95 touch-manipulation shadow-md ${
              isPlayingTestSound
                ? 'bg-emerald-400 text-slate-950 border-emerald-300 shadow-emerald-400/30 ring-2 ring-emerald-400/50 scale-105'
                : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30 hover:border-emerald-400'
            }`}
            title="Probar el timbre de la cocina (Sonido de nueva comanda)"
          >
            <Bell className={`w-4 h-4 ${isPlayingTestSound ? 'animate-bounce text-slate-950' : 'text-emerald-400'}`} />
            <span>{isPlayingTestSound ? '🔔 Probando Sonido...' : 'Probar Sonido'}</span>
          </button>

          <button
            type="button"
            onClick={onRefreshData}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 transition-colors"
            title="Actualizar comandas manualmente"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={() => setIsKitchenLoggedIn(false)}
            className="px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </div>

      {/* KPI Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div
          onClick={() => setFilterTab('pendientes')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            filterTab === 'pendientes'
              ? 'bg-emerald-950/40 border-emerald-500 text-emerald-300 shadow-lg shadow-emerald-950/50'
              : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold mb-1">
            <span className="uppercase text-[11px] text-emerald-400 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              Por Preparar (Aceptados)
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          </div>
          <p className="text-3xl font-black text-slate-100">{acceptedOrders.length}</p>
          <p className="text-[11px] text-slate-400">Listos para iniciar cocción</p>
        </div>

        <div
          onClick={() => setFilterTab('preparando')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            filterTab === 'preparando'
              ? 'bg-orange-950/40 border-orange-500 text-orange-300 shadow-lg shadow-orange-950/50'
              : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold mb-1">
            <span className="uppercase text-[11px] text-orange-400 flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 text-orange-400" />
              En Preparación
            </span>
          </div>
          <p className="text-3xl font-black text-slate-100">{preparingOrders.length}</p>
          <p className="text-[11px] text-slate-400">En la parrilla / horno</p>
        </div>

        <div
          onClick={() => setFilterTab('listos')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            filterTab === 'listos'
              ? 'bg-emerald-950/40 border-emerald-500 text-emerald-300 shadow-lg shadow-emerald-950/50'
              : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold mb-1">
            <span className="uppercase text-[11px] text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Comandas Listas / Despachadas
            </span>
          </div>
          <p className="text-3xl font-black text-slate-100">{readyOrders.length}</p>
          <p className="text-[11px] text-slate-400">Entregados al repartidor</p>
        </div>

        <div
          onClick={() => setFilterTab('todos')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            filterTab === 'todos'
              ? 'bg-slate-800 border-slate-600 text-slate-100 shadow-lg'
              : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold mb-1">
            <span className="uppercase text-[11px] text-slate-400 flex items-center gap-1">
              <Utensils className="w-3.5 h-3.5" />
              Total Comandas Activas
            </span>
          </div>
          <p className="text-3xl font-black text-slate-100">{pedidos.filter((p) => p.estado !== 'rechazado').length}</p>
          <p className="text-[11px] text-slate-400">En el turno actual</p>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 p-3 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setFilterTab('pendientes')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
              filterTab === 'pendientes'
                ? 'bg-emerald-500 text-slate-950 font-extrabold shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Por Preparar ({acceptedOrders.length})</span>
          </button>

          <button
            onClick={() => setFilterTab('preparando')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
              filterTab === 'preparando'
                ? 'bg-orange-500 text-slate-950 font-extrabold shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>En Preparación ({preparingOrders.length})</span>
          </button>

          <button
            onClick={() => setFilterTab('listos')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
              filterTab === 'listos'
                ? 'bg-emerald-500 text-slate-950 font-extrabold shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Listos ({readyOrders.length})</span>
          </button>

          <button
            onClick={() => setFilterTab('todos')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
              filterTab === 'todos'
                ? 'bg-slate-700 text-slate-100 font-extrabold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            Todas
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Buscar por ID, cliente o plato..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-xl pl-9 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* Grid of Kitchen Tickets (Comandas) */}
      {filteredOrders.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center space-y-3">
          <ChefHat className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-slate-300">No hay comandas para este filtro</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Cuando el administrador acepte nuevos pedidos desde el panel central, aparecerán aquí automáticamente.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredOrders.map((pedido) => {
            const isAceptado = pedido.estado === 'aceptado';
            const isPreparando = pedido.estado === 'preparando';
            const isListo = pedido.estado === 'comanda_lista' || pedido.estado === 'en_camino' || pedido.estado === 'entregado';

            return (
              <div
                key={pedido.id}
                className={`bg-slate-900 border rounded-3xl p-5 shadow-xl flex flex-col justify-between space-y-4 relative overflow-hidden transition-all hover:border-slate-600 ${
                  isAceptado
                    ? 'border-emerald-500/60 ring-2 ring-emerald-500/20'
                    : isPreparando
                    ? 'border-orange-500/60 ring-2 ring-orange-500/20'
                    : 'border-slate-800 opacity-80'
                }`}
              >
                {/* Header of Ticket */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-base font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-xl">
                        #{pedido.id}
                      </span>
                      <span
                        className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full border ${
                          isAceptado
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse'
                            : isPreparando
                            ? 'bg-orange-500/20 text-orange-300 border-orange-500/40'
                            : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        }`}
                      >
                        {isAceptado
                          ? '🔥 Pendiente Cocción'
                          : isPreparando
                          ? '🍳 En Preparación'
                          : '✅ Comanda Lista'}
                      </span>
                    </div>

                    <span className="text-xs text-slate-400 font-mono flex items-center gap-1 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                      <Clock className="w-3.5 h-3.5 text-emerald-400" />
                      {getElapsedTime(pedido)}
                    </span>
                  </div>

                  {/* Customer Info */}
                  <div className="flex items-center justify-between text-xs text-slate-300 pt-1">
                    <div className="flex items-center gap-1.5 font-bold">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span>{pedido.cliente}</span>
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      {pedido.telefono}
                    </span>
                  </div>

                  {/* Delivery Location / Instructions */}
                  <div className="text-[11px] text-slate-400 flex items-center gap-1 truncate">
                    <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    <span className="truncate">{pedido.direccion}</span>
                  </div>
                </div>

                {/* List of Products (Platos) */}
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2 my-2">
                  <span className="text-[10px] uppercase tracking-wider font-extrabold text-emerald-400 block border-b border-slate-800 pb-1 flex items-center justify-between">
                    <span>📋 Detalle de la Comanda:</span>
                    <span className="text-[9px] text-slate-400 font-normal">Ver ingredientes / obs</span>
                  </span>
                  <ul className="space-y-2.5 text-sm font-semibold text-slate-100">
                    {pedido.items && pedido.items.length > 0 ? (
                      pedido.items.map((item, idx) => {
                        const { main, obs } = parseItemObs(item);
                        return (
                          <li key={idx} className="flex flex-col gap-1.5 bg-slate-900/90 p-3 rounded-2xl border border-slate-800 shadow-sm">
                            <div className="flex items-start gap-2">
                              <span className="text-emerald-400 font-black text-lg leading-none shrink-0">•</span>
                              <span className="leading-snug text-sm font-extrabold text-slate-100">{main}</span>
                            </div>
                            {obs && (
                              <div className="ml-3 bg-emerald-500/20 border-2 border-emerald-400/80 p-2.5 rounded-xl text-emerald-200 text-xs font-bold flex items-start gap-2 shadow-md">
                                <AlertTriangle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                                <div>
                                  <span className="text-emerald-300 font-extrabold uppercase text-[10px] block tracking-wide">⚠️ PREPARACIÓN ESPECIAL:</span>
                                  <span className="text-emerald-100 font-black text-xs leading-tight underline decoration-emerald-400/60 uppercase">"{obs}"</span>
                                </div>
                              </div>
                            )}
                          </li>
                        );
                      })
                    ) : (
                      <li className="text-xs text-slate-500">Sin items listados</li>
                    )}
                  </ul>

                  {/* Customer Observations / Special Notes */}
                  {(() => {
                    const itemObsList = (pedido.items || [])
                      .map(parseItemObs)
                      .filter((p) => p.obs)
                      .map((p) => `${p.main}: "${p.obs}"`);

                    const { extraProductObs, cleanGeneralNote } = parseKitchenNotes(pedido.notaCliente || pedido.detallesPedido);

                    const allProductObs = Array.from(new Set([...itemObsList, ...extraProductObs]));

                    if (allProductObs.length === 0 && !cleanGeneralNote) return null;

                    return (
                      <div className="mt-3 bg-emerald-950/80 border-2 border-emerald-400/90 p-3.5 rounded-2xl text-xs space-y-2.5 shadow-xl">
                        <span className="font-black flex items-center gap-1.5 text-xs uppercase tracking-wider text-emerald-300 border-b border-emerald-500/40 pb-1.5">
                          <AlertTriangle className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span>⚠️ OBS. DE COCINA (LECHUGA, TOMATE, INGREDIENTES):</span>
                        </span>

                        {allProductObs.length > 0 && (
                          <div className="space-y-1.5">
                            <span className="text-[10px] font-extrabold text-emerald-400 uppercase tracking-wide block">
                              🛒 DETALLES POR PLATO:
                            </span>
                            <div className="space-y-1">
                              {allProductObs.map((iobs, iidx) => (
                                <div key={iidx} className="flex items-start gap-1.5 text-xs font-bold text-emerald-100 bg-emerald-950/70 p-2 rounded-xl border border-emerald-500/50 shadow-sm">
                                  <span className="text-emerald-400 shrink-0 font-extrabold">📌</span>
                                  <span className="leading-snug text-emerald-100 uppercase font-black">{iobs}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {cleanGeneralNote && (
                          <div className="space-y-1 pt-1">
                            <span className="text-[10px] font-extrabold text-emerald-400 uppercase tracking-wide block">
                              📝 NOTA GENERAL / INDICACIONES:
                            </span>
                            <p className="font-bold italic leading-relaxed text-emerald-100 bg-slate-950/90 p-2.5 rounded-xl border border-emerald-500/40">
                              "{cleanGeneralNote}"
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Footer Buttons for Kitchen Operations */}
                <div className="space-y-2 pt-1 border-t border-slate-800/80">
                  {isAceptado && (
                    <button
                      type="button"
                      onClick={() => handleUpdateStatus(pedido.id, 'preparando')}
                      className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-3 rounded-2xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
                    >
                      <Flame className="w-4 h-4 fill-slate-950" />
                      <span>INICIAR PREPARACIÓN</span>
                    </button>
                  )}

                  {isPreparando && (
                    <div className="space-y-1.5">
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(pedido.id, 'comanda_lista')}
                        className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-3 rounded-2xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>MARCAR COMO LISTO / DESPACHADO</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(pedido.id, 'aceptado')}
                        className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-1.5 rounded-xl text-[11px] transition-colors"
                      >
                        Volver a Pendiente
                      </button>
                    </div>
                  )}

                  {isListo && (
                    <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold py-2 rounded-xl text-center flex items-center justify-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Comanda Finalizada y Despachada</span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setSelectedTicket(pedido)}
                    className="w-full bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Printer className="w-3.5 h-3.5 text-slate-400" />
                    <span>Ver Ticket / Imprimir Comanda</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: PRINT / TICKET VIEW */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white text-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 font-mono text-xs">
            <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3">
              <div className="text-left">
                <h3 className="text-base font-black uppercase">EL TERNERO</h3>
                <p className="text-[10px] text-slate-600">COMANDA DE COCINA</p>
              </div>
              <button
                onClick={() => setSelectedTicket(null)}
                className="p-1.5 text-slate-500 hover:text-slate-900 bg-slate-100 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-1 py-1 border-b border-dashed border-slate-300 text-[11px]">
              <p><strong>TICKET:</strong> #{selectedTicket.id}</p>
              <p><strong>CLIENTE:</strong> {selectedTicket.cliente}</p>
              <p><strong>TELÉFONO:</strong> {selectedTicket.telefono}</p>
              <p><strong>FECHA:</strong> {selectedTicket.ultimaActualizacion ? new Date(selectedTicket.ultimaActualizacion).toLocaleString('es-PY') : new Date().toLocaleString('es-PY')}</p>
            </div>

            <div className="space-y-2 py-2 border-b-2 border-slate-900">
              <span className="font-extrabold uppercase text-xs block">PRODUCTOS A PREPARAR:</span>
              <ul className="space-y-2 text-sm font-bold">
                {selectedTicket.items && selectedTicket.items.map((it, i) => {
                  const { main, obs } = parseItemObs(it);
                  return (
                    <li key={i} className="border-b border-slate-200 pb-1.5 flex flex-col gap-0.5">
                      <span className="font-black text-slate-900">{main}</span>
                      {obs && (
                        <span className="text-[11px] font-mono text-emerald-950 bg-emerald-100 border border-emerald-400 px-2 py-0.5 rounded font-extrabold">
                          📌 OBS: "{obs}"
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>

            {(() => {
              const itemObsList = (selectedTicket.items || [])
                .map(parseItemObs)
                .filter((p) => p.obs)
                .map((p) => `${p.main}: "${p.obs}"`);

              const { extraProductObs, cleanGeneralNote } = parseKitchenNotes(selectedTicket.notaCliente || selectedTicket.detallesPedido);

              const allProductObs = Array.from(new Set([...itemObsList, ...extraProductObs]));

              if (allProductObs.length === 0 && !cleanGeneralNote) return null;

              return (
                <div className="bg-emerald-50 border-2 border-emerald-500 p-3.5 rounded-2xl text-emerald-950 font-bold space-y-2.5 text-xs shadow-md">
                  <span className="text-xs font-black uppercase flex items-center gap-1.5 text-emerald-950 border-b-2 border-emerald-400 pb-1.5">
                    ⚠️ OBSERVACIONES Y DETALLES DE COCINA:
                  </span>
                  {allProductObs.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-black text-emerald-900 block tracking-wider">
                        🛒 DETALLES POR PRODUCTO (INGREDIENTES):
                      </span>
                      {allProductObs.map((iobs, i) => (
                        <p key={i} className="text-xs font-mono font-black text-emerald-950 bg-emerald-100/80 p-1.5 rounded border border-emerald-400">
                          📌 {iobs}
                        </p>
                      ))}
                    </div>
                  )}
                  {cleanGeneralNote && (
                    <div className="pt-1 border-t border-emerald-300">
                      <span className="text-[10px] uppercase font-black text-emerald-900 block tracking-wider">
                        📝 NOTA GENERAL / INDICACIÓN:
                      </span>
                      <p className="italic font-extrabold text-emerald-950">"{cleanGeneralNote}"</p>
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="pt-2 flex items-center justify-between gap-3">
              <button
                onClick={() => window.print()}
                className="bg-slate-900 text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 shadow"
              >
                <Printer className="w-4 h-4" />
                Imprimir Comanda
              </button>
              <button
                onClick={() => setSelectedTicket(null)}
                className="bg-slate-200 text-slate-800 font-bold px-4 py-2.5 rounded-xl text-xs"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
