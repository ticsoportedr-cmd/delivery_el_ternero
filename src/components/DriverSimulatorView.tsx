import React, { useState, useEffect, useRef } from 'react';
import { Pedido, Repartidor, GPSUpdate, Producto } from '../types';
import { InteractiveMap } from './InteractiveMap';
import logoImg from '../assets/images/el_ternero_logo.svg';
import { Socket } from 'socket.io-client';
import {
  Navigation,
  Play,
  Pause,
  MapPin,
  Sparkles,
  Phone,
  Radio,
  CheckCircle2,
  Bike,
  Send,
  Zap,
  Activity,
  Maximize2,
  Lock,
  User,
  Key,
  LogOut,
  PackageCheck,
  ShoppingBag,
  ShieldCheck,
  Clock,
  Check,
  AlertCircle
} from 'lucide-react';

interface DriverSimulatorViewProps {
  pedidos: Pedido[];
  repartidores: Repartidor[];
  socket: Socket | null;
  lastGpsUpdate?: GPSUpdate | null;
  logoUrl?: string;
  restauranteConfig?: { nombre?: string; logoUrl?: string };
}

export const DriverSimulatorView: React.FC<DriverSimulatorViewProps> = ({
  pedidos,
  repartidores,
  socket,
  lastGpsUpdate,
  logoUrl,
  restauranteConfig,
}) => {
  const activeLogo = logoUrl || (restauranteConfig?.logoUrl && restauranteConfig.logoUrl !== '/el_ternero_logo.svg' && restauranteConfig.logoUrl.trim() !== '' ? restauranteConfig.logoUrl : logoImg);
  // Authentication State for Delivery Driver (Auto-select first driver if available)
  const [loggedInDriver, setLoggedInDriver] = useState<Repartidor | null>(() => {
    return (repartidores && repartidores.length > 0) ? repartidores[0] : null;
  });

  // Keep active driver updated if repartidores list updates or auto-assign first driver
  useEffect(() => {
    if (!loggedInDriver && repartidores && repartidores.length > 0) {
      setLoggedInDriver(repartidores[0]);
    } else if (loggedInDriver && repartidores && repartidores.length > 0) {
      const updated = repartidores.find((r) => r.id === loggedInDriver.id);
      if (updated) setLoggedInDriver(updated);
    }
  }, [repartidores, loggedInDriver]);

  // Persist current active driver identity for role-based Push Notifications
  useEffect(() => {
    if (loggedInDriver) {
      localStorage.setItem('el_ternero_active_driver_id', loggedInDriver.id);
      localStorage.setItem('el_ternero_active_driver_name', loggedInDriver.nombre);
    } else {
      localStorage.removeItem('el_ternero_active_driver_id');
      localStorage.removeItem('el_ternero_active_driver_name');
    }
  }, [loggedInDriver]);

  // Login Form fields
  const [username, setUsername] = useState<string>('juan');
  const [password, setPassword] = useState<string>('juan123');
  const [authError, setAuthError] = useState<string>('');
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);

  // Delivery simulation states
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [isRealGpsActive, setIsRealGpsActive] = useState<boolean>(false);
  const [gpsWatchId, setGpsWatchId] = useState<number | null>(null);
  const [realGpsMsg, setRealGpsMsg] = useState<string>('');
  const [packetCount, setPacketCount] = useState<number>(0);
  const [progressRatio, setProgressRatio] = useState<number>(0.2); // 0 = Restaurant, 1 = Client

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Real Device GPS Tracking Handler
  const toggleRealDeviceGps = () => {
    if (isRealGpsActive) {
      if (gpsWatchId !== null) {
        navigator.geolocation.clearWatch(gpsWatchId);
        setGpsWatchId(null);
      }
      setIsRealGpsActive(false);
      setRealGpsMsg('GPS en vivo desactivado');
      setTimeout(() => setRealGpsMsg(''), 3000);
      return;
    }

    if (!navigator.geolocation) {
      setRealGpsMsg('El navegador no soporta geolocalización por GPS.');
      return;
    }

    setRealGpsMsg('Iniciando GPS real del dispositivo...');

    const startWatch = (highAccuracy: boolean) => {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          transmitGPS(latitude, longitude);
          setRealGpsMsg(`📍 Transmitiendo GPS Real: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
        },
        (err) => {
          console.warn('Error GPS real:', err);
          if (highAccuracy) {
            // Fallback to standard accuracy
            if (gpsWatchId !== null) {
              navigator.geolocation.clearWatch(gpsWatchId);
            }
            startWatch(false);
          } else {
            let detail = 'Verifica los permisos de ubicación en el navegador.';
            if (err.code === 1) detail = 'Permiso de ubicación denegado.';
            else if (err.code === 3) detail = 'Tiempo de espera de señal GPS agotado.';
            setRealGpsMsg(`⚠️ Error GPS: ${detail}`);
            setIsRealGpsActive(false);
          }
        },
        {
          enableHighAccuracy: highAccuracy,
          maximumAge: 5000,
          timeout: 10000,
        }
      );

      setGpsWatchId(watchId);
      setIsRealGpsActive(true);
    };

    startWatch(true);
  };

  // Handle Driver Authentication
  const handleDriverLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsLoggingIn(true);

    try {
      const res = await fetch('/api/repartidores/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario: username, password }),
      });

      if (res.ok) {
        const data = await res.json();
        setLoggedInDriver(data.repartidor);
        setAuthError('');
      } else {
        // Local fallback check if API route fails
        const matched = repartidores.find(
          (r) =>
            r.usuario?.toLowerCase() === username.trim().toLowerCase() &&
            r.password === password
        );
        if (matched) {
          setLoggedInDriver(matched);
        } else {
          setAuthError('Usuario o contraseña de repartidor incorrectos.');
        }
      }
    } catch (err) {
      // Local check fallback
      const matched = repartidores.find(
        (r) =>
          r.usuario?.toLowerCase() === username.trim().toLowerCase() &&
          r.password === password
      );
      if (matched) {
        setLoggedInDriver(matched);
      } else {
        setAuthError('Error al iniciar sesión de repartidor.');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleQuickLoginSelect = (driverUser: string, driverPass: string) => {
    setUsername(driverUser);
    setPassword(driverPass);
  };

  const handleLogout = () => {
    setLoggedInDriver(null);
    setIsSimulating(false);
  };

  // Filter ONLY orders assigned to the logged-in driver by the Admin
  const assignedPedidos = loggedInDriver
    ? pedidos.filter((p) => p.repartidorId === loggedInDriver.id)
    : [];
  
  const [selectedPedidoId, setSelectedPedidoId] = useState<string>('');
  
  useEffect(() => {
    if (assignedPedidos.length > 0 && !assignedPedidos.some(p => p.id === selectedPedidoId)) {
      setSelectedPedidoId(assignedPedidos[0].id);
    }
  }, [assignedPedidos]);

  const currentPedido = assignedPedidos.find(p => p.id === selectedPedidoId) || assignedPedidos[0];

  // Interpolate GPS coordinates based on progressRatio (0 to 1)
  const getInterpolatedCoords = (ratio: number) => {
    if (!currentPedido) {
      return {
        lat: loggedInDriver?.latitud || -25.2867,
        lon: loggedInDriver?.longitud || -57.6333,
      };
    }
    const startLat = currentPedido.latitudRestaurante;
    const startLon = currentPedido.longitudRestaurante;
    const endLat = currentPedido.latitudCliente;
    const endLon = currentPedido.longitudCliente;

    // Add slight zigzag to simulate realistic road turns
    const jitterLat = Math.sin(ratio * Math.PI * 4) * 0.0012;
    const jitterLon = Math.cos(ratio * Math.PI * 3) * 0.0015;

    return {
      lat: startLat + (endLat - startLat) * ratio + jitterLat,
      lon: startLon + (endLon - startLon) * ratio + jitterLon,
    };
  };

  // Function to emit single GPS update over Socket.io
  const transmitGPS = (lat: number, lon: number) => {
    if (!socket || !currentPedido || !loggedInDriver) return;

    const payload = {
      repartidorId: loggedInDriver.id,
      pedidoId: currentPedido.id,
      latitud: parseFloat(lat.toFixed(6)),
      longitud: parseFloat(lon.toFixed(6)),
    };

    socket.emit('actualizar_ubicacion', payload);
    setPacketCount((prev) => prev + 1);
  };

  // Handle Automatic Driving Loop
  useEffect(() => {
    if (isSimulating && currentPedido && loggedInDriver) {
      timerRef.current = setInterval(() => {
        setProgressRatio((prev) => {
          const next = prev + 0.03;
          if (next >= 1.0) {
            setIsSimulating(false);
            const finalCoords = getInterpolatedCoords(1.0);
            transmitGPS(finalCoords.lat, finalCoords.lon);
            return 1.0;
          }
          const coords = getInterpolatedCoords(next);
          transmitGPS(coords.lat, coords.lon);
          return next;
        });
      }, 1500);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isSimulating, currentPedido, loggedInDriver, socket]);

  // Click on map to set driver coordinates manually
  const handleMapClick = (lat: number, lon: number) => {
    transmitGPS(lat, lon);
  };

  // Handle Status change (e.g. "Entregado")
  const handleEstadoChange = (nuevoEstado: Pedido['estado']) => {
    if (!socket || !currentPedido) return;
    socket.emit('cambiar_estado_pedido', {
      pedidoId: currentPedido.id,
      estado: nuevoEstado,
    });
  };

  const currentCoords = getInterpolatedCoords(progressRatio);

  // VIEW 1: DRIVER NOT LOGGED IN -> SHOW AUTH LOGIN FORM
  if (!loggedInDriver) {
    return (
      <div className="max-w-md mx-auto my-6 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-emerald-400" />

        {/* Header */}
        <div className="text-center space-y-2">
          <img
            src={activeLogo}
            alt="EL TERNERO Logo"
            className="w-16 h-16 rounded-full object-contain bg-black border-2 border-emerald-500/80 shadow-lg shadow-emerald-500/20 ring-2 ring-slate-800 mx-auto"
          />
          <h2 className="text-xl font-extrabold text-slate-100">
            EL TERNERO • Acceso Repartidor
          </h2>
          <p className="text-xs text-slate-400 max-w-xs mx-auto">
            Ingresa tu usuario y contraseña de repartidor para ver únicamente los envíos y productos asignados.
          </p>
        </div>



        {authError && (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-2 font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{authError}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleDriverLogin} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              Usuario de Repartidor:
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ej. juan"
                className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-xl pl-9 pr-3.5 py-2.5 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              Contraseña:
            </label>
            <div className="relative">
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-xl pl-9 pr-3.5 py-2.5 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoggingIn}
            className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold py-3 rounded-xl shadow-lg shadow-emerald-500/20 text-xs flex items-center justify-center gap-2 transition-all"
          >
            <Bike className="w-4 h-4" />
            <span>{isLoggingIn ? 'Autenticando...' : 'Iniciar Sesión en Panel Delivery'}</span>
          </button>
        </form>
      </div>
    );
  }

  // VIEW 2: LOGGED IN DRIVER DASHBOARD
  return (
    <div className="space-y-6">
      {/* Top Driver Header & Profile Info */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold shadow-lg shadow-emerald-500/10">
              <Bike className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Repartidor Autenticado
                </span>
                <span className="text-[11px] bg-slate-800 text-slate-300 font-mono px-2 py-0.5 rounded border border-slate-700">
                  GPS Paquetes: {packetCount}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                  <span>{loggedInDriver.nombre}</span>
                  <span className="text-xs font-mono text-slate-400 font-normal">
                    (ID: {loggedInDriver.id})
                  </span>
                </h2>
                {repartidores && repartidores.length > 1 && (
                  <select
                    value={loggedInDriver.id}
                    onChange={(e) => {
                      const sel = repartidores.find((r) => r.id === e.target.value);
                      if (sel) setLoggedInDriver(sel);
                    }}
                    className="bg-slate-950 border border-slate-700 text-emerald-400 text-xs rounded-xl px-2.5 py-1 font-bold cursor-pointer focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    title="Cambiar a otro repartidor de la lista"
                  >
                    {repartidores.map((r) => (
                      <option key={r.id} value={r.id}>
                        🏍️ {r.nombre} ({r.vehiculo || 'Moto'})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </div>

          {/* Assigned Orders Selector & Actions */}
          <div className="flex flex-wrap items-center gap-3">
            {assignedPedidos.length > 0 && (
              <select
                value={selectedPedidoId}
                onChange={(e) => {
                  setSelectedPedidoId(e.target.value);
                  setProgressRatio(0.2);
                }}
                className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {assignedPedidos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.id} - {p.cliente} ({p.estado})
                  </option>
                ))}
              </select>
            )}

            {currentPedido && (
              <>
                <button
                  onClick={toggleRealDeviceGps}
                  className={`px-3.5 py-2 rounded-xl font-extrabold text-xs flex items-center gap-2 shadow-lg transition-all ${
                    isRealGpsActive
                      ? 'bg-rose-500 text-white hover:bg-rose-400 shadow-rose-500/30 border border-rose-300 animate-pulse'
                      : 'bg-sky-500 text-slate-950 hover:bg-sky-400 shadow-sky-500/20'
                  }`}
                  title="Transmitir ubicación GPS hardware real de tu teléfono o computadora"
                >
                  <Radio className="w-4 h-4" />
                  <span>{isRealGpsActive ? '🔴 GPS Real en Vivo Activo' : '📡 Activar mi GPS Real del Dispositivo'}</span>
                </button>

                <button
                  onClick={() => setIsSimulating(!isSimulating)}
                  className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 shadow-lg transition-all ${
                    isSimulating
                      ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-emerald-500/20'
                      : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-emerald-500/20'
                  }`}
                >
                  {isSimulating ? (
                    <>
                      <Pause className="w-4 h-4" />
                      Pausar Simulación
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      Simular Ruta
                    </>
                  )}
                </button>
              </>
            )}

            <button
              onClick={handleLogout}
              className="bg-slate-800 hover:bg-rose-500/20 hover:text-rose-400 border border-slate-700 text-slate-300 font-semibold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-colors"
              title="Cerrar sesión de repartidor"
            >
              <LogOut className="w-4 h-4" />
              <span>Salir</span>
            </button>
          </div>
        </div>

        {realGpsMsg && (
          <div className="bg-sky-950 border border-sky-500/40 text-sky-200 text-xs px-4 py-2.5 rounded-xl flex items-center justify-between font-mono animate-fade-in shadow-lg">
            <span className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-ping" />
              {realGpsMsg}
            </span>
            <button onClick={() => setRealGpsMsg('')} className="text-sky-400 hover:text-white font-bold ml-3">
              ✕
            </button>
          </div>
        )}

        {/* DRIVER PROFILE DETAILS CARD */}
        <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800/80 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <User className="w-4 h-4 text-emerald-400 shrink-0" />
            <div>
              <span className="text-[10px] uppercase font-semibold text-slate-400 block">Nombre y Apellido</span>
              <span className="font-bold text-slate-100">{loggedInDriver.nombre}</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Phone className="w-4 h-4 text-emerald-400 shrink-0" />
            <div>
              <span className="text-[10px] uppercase font-semibold text-slate-400 block">Número Telefónico</span>
              <a href={`tel:${loggedInDriver.telefono}`} className="font-mono font-bold text-emerald-400 hover:underline">
                {loggedInDriver.telefono}
              </a>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <div>
              <span className="text-[10px] uppercase font-semibold text-slate-400 block">Número de Chapa</span>
              <span className="font-mono font-bold text-emerald-300 bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-500/30">
                {loggedInDriver.chapa || '123 ABC Py'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Bike className="w-4 h-4 text-indigo-400 shrink-0" />
            <div>
              <span className="text-[10px] uppercase font-semibold text-slate-400 block">Vehículo Registrado</span>
              <span className="font-semibold text-slate-200 capitalize">
                {loggedInDriver.vehiculo}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION: PRODUCTOS Y ENVÍOS SELECCIONADOS POR EL ADMINISTRADOR */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <PackageCheck className="w-5 h-5 text-emerald-400" />
              Productos y Envíos Asignados por el Administrador
            </h3>
            <p className="text-xs text-slate-400">
              Solo visualizas los productos seleccionados expresamente para tu entrega (<strong className="text-emerald-400">{loggedInDriver.nombre}</strong>).
            </p>
          </div>
          <span className="text-xs font-mono font-bold bg-slate-800 text-emerald-400 px-3 py-1 rounded-xl border border-slate-700">
            {assignedPedidos.length} Envíos Asignados
          </span>
        </div>

        {assignedPedidos.length === 0 ? (
          <div className="text-center py-8 text-slate-400 space-y-2">
            <ShoppingBag className="w-10 h-10 text-slate-600 mx-auto" />
            <p className="text-sm font-medium text-slate-200">No tienes envíos ni productos asignados actualmente.</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              El administrador te asignará los nuevos pedidos recibidos. Cuando te asigne un paquete, aparecerá aquí con los productos seleccionados.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {assignedPedidos.map((ped, index) => {
              const isSelected = ped.id === currentPedido?.id;
              return (
                <div
                  key={ped.id}
                  onClick={() => setSelectedPedidoId(ped.id)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                    isSelected
                      ? 'bg-slate-800/90 border-emerald-500 shadow-md ring-2 ring-emerald-500/40'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-black text-slate-950 bg-emerald-400 px-2 py-0.5 rounded-full uppercase">
                          {index === 0 ? '1º A Entregar' : `${index + 1}º Siguiente`}
                        </span>
                        <span className="text-xs font-mono font-bold text-emerald-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                          {ped.id}
                        </span>
                      </div>
                      <span className="text-[11px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                        {ped.estado}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-slate-100">{ped.cliente}</h4>
                    <p className="text-xs text-slate-400 truncate">{ped.direccion}</p>

                    <div className="mt-3 pt-2 border-t border-slate-800/80 space-y-1">
                      <span className="text-[11px] font-semibold text-slate-300 block">
                        Productos a entregar:
                      </span>
                      <ul className="space-y-1">
                        {ped.items.map((item, idx) => (
                          <li key={idx} className="text-xs text-emerald-300/90 flex items-center gap-1.5 font-sans">
                            <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="mt-4 pt-2 border-t border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs font-mono font-bold">
                      <span className="text-slate-400">Total a Cobrar:</span>
                      <span className="text-emerald-400">Gs. {ped.total.toLocaleString()}</span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPedidoId(ped.id);
                      }}
                      className={`w-full py-1.5 rounded-lg text-xs font-bold transition-all ${
                        isSelected
                          ? 'bg-emerald-500 text-slate-950 font-black'
                          : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700'
                      }`}
                    >
                      {isSelected ? '🎯 Seleccionado para Entrega' : '👉 Seleccionar este Cliente'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Main Grid: Interactive Map & Delivery Actions */}
      {currentPedido && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Interactive GPS Map */}
          <div className="lg:col-span-8 space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
              <div className="flex items-center justify-between mb-3 text-xs text-slate-300">
                <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                  <Navigation className="w-4 h-4 text-emerald-400" />
                  Ruta Personalizada (Haz clic en el mapa para transmitir tu posición GPS)
                </span>
                <span className="font-mono text-slate-400">
                  Lat: {currentCoords.lat.toFixed(4)}, Lon: {currentCoords.lon.toFixed(4)}
                </span>
              </div>

              <InteractiveMap
                pedidos={assignedPedidos}
                repartidores={repartidores}
                selectedPedidoId={currentPedido.id}
                onMapClickCoordinates={handleMapClick}
                interactiveDriverId={loggedInDriver.id}
                assignedDriverIdOnly={loggedInDriver.id}
                logoUrl={activeLogo}
                customStorePin={{
                  lat: currentPedido?.latitudRestaurante || -25.1747,
                  lon: currentPedido?.longitudRestaurante || -57.48334,
                  nombre: currentPedido?.restauranteNombre || 'EL TERNERO',
                }}
              />
            </div>

            {/* Range Slider Control */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                <span className="flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  Desplazar Repartidor en Ruta
                </span>
                <span className="font-mono text-emerald-400">{Math.round(progressRatio * 100)}% Avanzado</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={progressRatio}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setProgressRatio(val);
                  const coords = getInterpolatedCoords(val);
                  transmitGPS(coords.lat, coords.lon);
                }}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
              <div className="flex justify-between text-[11px] text-slate-500 font-mono">
                <span>Restaurante ({currentPedido.restauranteNombre})</span>
                <span>En Trayecto GPS</span>
                <span>Cliente ({currentPedido.cliente})</span>
              </div>
            </div>
          </div>

          {/* Right Panel: AI Instruction & Order Controls */}
          <div className="lg:col-span-4 space-y-6">
            {/* Detalles del Pedido (Escrito por Administrador) */}
            <div className="bg-gradient-to-br from-indigo-950/60 via-slate-900 to-slate-900 border-2 border-indigo-500/50 rounded-2xl p-5 shadow-2xl space-y-3 relative">
              <div className="flex items-center gap-2 text-indigo-300 font-extrabold text-xs tracking-wider uppercase">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                DETALLES DEL PEDIDO
              </div>

              <div className="bg-indigo-950/90 border border-indigo-400/40 rounded-xl p-4 shadow-inner">
                <p className="text-base font-bold text-indigo-100 leading-snug font-sans">
                  "{currentPedido.detallesPedido || currentPedido.instruccionOptimizada || currentPedido.notaCliente}"
                </p>
              </div>

              <p className="text-[11px] text-indigo-300/80 bg-indigo-900/30 p-2 rounded-lg border border-indigo-500/20">
                💡 <span className="font-semibold">Resumen del Administrador:</span> Instrucciones y especificaciones cargadas por el Administrador.
              </p>
            </div>

            {/* Delivery Details Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <span className="text-xs text-slate-400 font-mono">Pedido ID</span>
                  <h4 className="text-lg font-bold text-slate-100">{currentPedido.id}</h4>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  {currentPedido.estado}
                </span>
              </div>

              <div className="space-y-2 text-xs text-slate-300">
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-slate-400 block font-semibold">Cliente:</span>
                    <span className="font-bold text-slate-200">{currentPedido.cliente}</span>
                    <p className="text-slate-400">{currentPedido.direccion}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <Phone className="w-4 h-4 text-emerald-400 shrink-0" />
                  <a href={`tel:${currentPedido.telefono}`} className="font-mono text-emerald-400 hover:underline">
                    {currentPedido.telefono}
                  </a>
                </div>
              </div>

              {/* State Transition Action Buttons */}
              <div className="pt-3 border-t border-slate-800 space-y-3">
                <span className="text-xs text-slate-300 font-bold block">Acción de Repartidor sobre este Cliente:</span>

                {currentPedido.estado !== 'en_camino' && currentPedido.estado !== 'entregado' && (
                  <button
                    type="button"
                    onClick={() => handleEstadoChange('en_camino')}
                    className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-3 px-3 rounded-xl text-xs shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider"
                  >
                    <Send className="w-4 h-4 fill-slate-950" />
                    <span>🚀 Iniciar Entrega y Notificar "En Camino" a {currentPedido.cliente.split(' ')[0]}</span>
                  </button>
                )}

                {currentPedido.estado === 'en_camino' && (
                  <div className="bg-emerald-950/80 border border-emerald-500/40 p-2.5 rounded-xl text-center text-xs text-emerald-300 font-bold flex items-center justify-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                    <span>Notificación Enviada: En camino a {currentPedido.cliente}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 pt-1">
                  {currentPedido.estado !== 'en_camino' && (
                    <button
                      type="button"
                      onClick={() => handleEstadoChange('en_camino')}
                      className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold py-2 px-3 rounded-xl text-xs transition-colors"
                    >
                      🛵 En Camino
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleEstadoChange('entregado')}
                    className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-2 px-3 rounded-xl text-xs transition-colors col-span-2 sm:col-span-1"
                  >
                    ✅ Marcar Entregado
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
