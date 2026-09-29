import React, { useState, useEffect } from 'react';
import { MapPin, Navigation, ShieldCheck, AlertTriangle, RefreshCw, Check, Lock, ChevronRight } from 'lucide-react';

interface GpsPermissionModalProps {
  onPermissionGranted?: (lat: number, lon: number) => void;
  isOpenForce?: boolean;
}

export const GpsPermissionModal: React.FC<GpsPermissionModalProps> = ({
  onPermissionGranted,
  isOpenForce = false,
}) => {
  const [permissionState, setPermissionState] = useState<'prompt' | 'granted' | 'denied' | 'checking'>('checking');
  const [isRequesting, setIsRequesting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [userCoords, setUserCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [showManualModal, setShowManualModal] = useState<boolean>(false);

  const [hasRequestedGps, setHasRequestedGps] = useState<boolean>(() => {
    try {
      return localStorage.getItem('el_ternero_gps_requested') === 'true';
    } catch {
      return false;
    }
  });

  // Check initial permission status on mount
  useEffect(() => {
    checkPermissionStatus();
  }, []);

  const markGpsAsRequested = () => {
    try {
      localStorage.setItem('el_ternero_gps_requested', 'true');
    } catch (e) {
      console.error('Error saving GPS flag:', e);
    }
    setHasRequestedGps(true);
  };

  const checkPermissionStatus = async () => {
    setErrorMessage('');
    if (!navigator.geolocation) {
      setPermissionState('denied');
      setErrorMessage('Este navegador o dispositivo no soporta geolocalización por GPS.');
      return;
    }

    try {
      if (navigator.permissions && navigator.permissions.query) {
        const result = await navigator.permissions.query({ name: 'geolocation' });
        setPermissionState(result.state as 'prompt' | 'granted' | 'denied');

        result.onchange = () => {
          setPermissionState(result.state as 'prompt' | 'granted' | 'denied');
          if (result.state === 'granted') {
            requestGpsLocation();
          }
        };

        if (result.state === 'granted') {
          requestGpsLocation();
        }
      } else {
        // Fallback: check by trying getCurrentPosition with short timeout
        setPermissionState('prompt');
      }
    } catch {
      setPermissionState('prompt');
    }
  };

  const requestGpsLocation = () => {
    if (!navigator.geolocation) {
      setPermissionState('denied');
      setErrorMessage('Tu navegador no cuenta con soporte para GPS.');
      return;
    }

    setIsRequesting(true);
    setErrorMessage('');

    const tryPosition = (highAccuracy: boolean) => {
      markGpsAsRequested();
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserCoords({ lat: latitude, lon: longitude });
          setPermissionState('granted');
          setIsRequesting(false);
          if (onPermissionGranted) {
            onPermissionGranted(latitude, longitude);
          }
        },
        (error) => {
          if (highAccuracy) {
            // Retry with standard accuracy
            tryPosition(false);
          } else {
            setIsRequesting(false);
            setPermissionState('denied');
            if (error.code === error.PERMISSION_DENIED) {
              setErrorMessage('Permiso de GPS bloqueado o denegado en el navegador.');
            } else if (error.code === error.POSITION_UNAVAILABLE) {
              setErrorMessage('Señal GPS no disponible en este momento. Verifica que tu GPS esté encendido.');
            } else if (error.code === error.TIMEOUT) {
              setErrorMessage('Tiempo de espera agotado al conectar con el GPS.');
            } else {
              setErrorMessage('Ocurrió un error al intentar acceder a la ubicación GPS.');
            }
          }
        },
        { enableHighAccuracy: highAccuracy, timeout: 10000, maximumAge: 10000 }
      );
    };

    tryPosition(true);
  };

  // If permission is already granted or user already dismissed/requested it, don't show the modal overlay
  if ((permissionState === 'granted' || hasRequestedGps) && !isOpenForce && !showManualModal) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[3000] bg-slate-950/90 backdrop-blur-lg flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
      <div className="bg-slate-900 border-2 border-emerald-500/50 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl relative space-y-6 my-auto animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header Badge */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-full text-xs font-extrabold text-emerald-400 uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4" />
            <span>Requisito Obligatorio</span>
          </div>
          <span className="text-[10px] font-mono text-slate-400">EL TERNERO GPS System</span>
        </div>

        {/* Hero Icon */}
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="relative">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-emerald-500 to-emerald-400 p-0.5 shadow-xl shadow-emerald-500/20 flex items-center justify-center">
              <div className="w-full h-full bg-slate-950 rounded-[22px] flex items-center justify-center">
                <Navigation className="w-10 h-10 text-emerald-400 animate-pulse" />
              </div>
            </div>
            <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-slate-950 p-1.5 rounded-full ring-4 ring-slate-900">
              <MapPin className="w-4 h-4" />
            </div>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-slate-100 tracking-tight">
            Acceso a Ubicación GPS Requerido
          </h2>
          
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-sm">
            Para ofrecerte el cálculo exacto del costo de delivery, fijar la dirección de entrega en el mapa y hacer el rastreo en vivo de tu pedido, <strong className="text-emerald-400">EL TERNERO requiere permiso de ubicación GPS</strong>.
          </p>
        </div>

        {/* Feature Benefits List */}
        <div className="bg-slate-950/80 rounded-2xl p-4 border border-slate-800 space-y-2.5 text-xs text-slate-300">
          <div className="flex items-start gap-2.5">
            <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5 font-bold text-[10px]">✓</div>
            <span><strong>Cálculo Automático de Delivery:</strong> Medición precisa en kilómetros desde nuestro local.</span>
          </div>
          <div className="flex items-start gap-2.5">
            <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5 font-bold text-[10px]">✓</div>
            <span><strong>Seguimiento GPS en Tiempo Real:</strong> Mira a tu repartidor desplazarse en vivo hasta tu puerta.</span>
          </div>
          <div className="flex items-start gap-2.5">
            <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5 font-bold text-[10px]">✓</div>
            <span><strong>Privacidad Garantizada:</strong> Tu ubicación solo se usa para la logística de tu pedido activo.</span>
          </div>
        </div>

        {/* Error / Denied Instructions standard panel */}
        {permissionState === 'denied' && (
          <div className="bg-rose-950/40 border border-rose-500/50 rounded-2xl p-4 text-xs text-rose-200 space-y-2.5">
            <div className="flex items-center gap-2 text-rose-400 font-extrabold text-xs uppercase tracking-wider">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Permiso de GPS No Concedido</span>
            </div>
            <p className="text-[11px] text-rose-300/90 leading-relaxed">
              {errorMessage || 'El navegador ha bloqueado el acceso a la ubicación. Para continuar:'}
            </p>
            <div className="bg-slate-950/90 p-3 rounded-xl border border-rose-500/30 text-[11px] text-slate-300 space-y-1.5 font-sans">
              <div className="font-bold text-emerald-400 flex items-center gap-1">
                <Lock className="w-3.5 h-3.5" /> Pasos para activar en tu navegador:
              </div>
              <ol className="list-decimal list-inside space-y-1 text-slate-300 pl-1">
                <li>Toca el icono de <strong>sitio o candado 🔒</strong> en la barra de direcciones de arriba.</li>
                <li>Selecciona <strong>"Permisos"</strong> o <strong>"Configuración del sitio"</strong>.</li>
                <li>Cambia <strong>"Ubicación"</strong> a <strong className="text-emerald-400">"Permitir"</strong>.</li>
                <li>Toca el botón <strong>"Reintentar Permiso GPS"</strong> abajo.</li>
              </ol>
            </div>
          </div>
        )}

        {/* Active Success Coordinates Badge */}
        {permissionState === 'granted' && userCoords && (
          <div className="bg-emerald-950/50 border border-emerald-500/50 rounded-2xl p-3.5 text-center text-xs text-emerald-300 flex items-center justify-center gap-2">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-extrabold font-mono">
              GPS Activo: {userCoords.lat.toFixed(5)}, {userCoords.lon.toFixed(5)}
            </span>
          </div>
        )}

        {/* Main CTA Action Button */}
        <div className="space-y-3 pt-2">
          <button
            type="button"
            onClick={requestGpsLocation}
            disabled={isRequesting}
            className="w-full py-4 px-6 bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 text-slate-950 disabled:text-slate-500 font-black text-sm sm:text-base rounded-2xl shadow-xl shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all duration-200 flex items-center justify-center gap-2.5 active:scale-95 touch-manipulation uppercase tracking-wider cursor-pointer"
          >
            {isRequesting ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin text-slate-950" />
                <span>Solicitando Señal GPS...</span>
              </>
            ) : permissionState === 'denied' ? (
              <>
                <RefreshCw className="w-5 h-5" />
                <span>Reintentar Permiso de GPS</span>
              </>
            ) : (
              <>
                <Navigation className="w-5 h-5 fill-current" />
                <span>Dar Permiso de Ubicación GPS</span>
                <ChevronRight className="w-5 h-5" />
              </>
            )}
          </button>

          {/* Secondary fallback button */}
          <button
            type="button"
            onClick={() => {
              markGpsAsRequested();
              setPermissionState('granted');
            }}
            className="w-full py-2.5 text-xs text-slate-400 hover:text-slate-200 font-semibold underline underline-offset-4 transition-colors"
          >
            Continuar explorando el menú (fijaré mi ubicación manualmente)
          </button>
        </div>

      </div>
    </div>
  );
};
