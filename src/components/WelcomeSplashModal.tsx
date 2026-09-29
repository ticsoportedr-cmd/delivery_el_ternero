import React from 'react';
import {
  UtensilsCrossed,
  MapPin,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  Flame,
  Clock
} from 'lucide-react';

interface WelcomeSplashModalProps {
  isOpen: boolean;
  onEnter: () => void;
  onEnterSalon?: () => void;
  onEnterAdmin?: () => void;
  onTrackOrder?: () => void;
  onClose?: () => void;
  restauranteNombre?: string;
  logoUrl?: string;
}

export const WelcomeSplashModal: React.FC<WelcomeSplashModalProps> = ({
  isOpen,
  onEnter,
  onEnterSalon,
  onEnterAdmin,
  onTrackOrder,
  onClose: _onClose,
  restauranteNombre = 'EL TERNERO',
  logoUrl,
}) => {
  if (!isOpen) return null;

  const currentDisplayLogo =
    logoUrl ||
    (typeof window !== 'undefined' ? localStorage.getItem('el_ternero_custom_logo') : null) ||
    '/el_ternero_logo.svg';

  return (
    <div
      id="welcome-splash-modal-overlay"
      className="fixed inset-0 z-[99999] bg-black/95 backdrop-blur-xl flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-300"
    >
      {/* Background ambient luxury gradient */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden flex items-center justify-center">
        <div className="w-[320px] sm:w-[500px] h-[320px] sm:h-[500px] rounded-full bg-emerald-600/10 blur-3xl" />
        <div className="w-[200px] sm:w-[350px] h-[200px] sm:h-[350px] rounded-full bg-emerald-500/15 blur-2xl -mt-20" />
      </div>

      {/* Main Responsive Welcome Card */}
      <div
        id="welcome-splash-card"
        className="relative w-full max-w-md bg-gradient-to-b from-zinc-950 via-zinc-900 to-black border border-emerald-500/30 rounded-3xl p-6 sm:p-8 shadow-[0_0_50px_rgba(4,120,87,0.25)] text-center space-y-4 my-auto overflow-hidden animate-in zoom-in-95 duration-300"
      >
        {/* Top Decorative Border */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-700 via-emerald-400 to-emerald-700" />

        {/* Brand Tag Header */}
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-[11px] sm:text-xs font-black tracking-widest uppercase shadow-inner">
          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          <span>Sabor Que Nace Del Campo</span>
        </div>

        {/* Exact Uploaded Logo (Identical display as uploaded) */}
        <div className="relative mx-auto flex flex-col items-center justify-center my-1">
          <div className="relative w-28 h-28 sm:w-36 sm:h-36 rounded-full bg-black flex items-center justify-center shadow-[0_0_30px_rgba(0,0,0,0.85)] border border-emerald-500/40 overflow-hidden ring-1 ring-zinc-800">
            <img
              src={currentDisplayLogo}
              alt={restauranteNombre}
              className="w-full h-full object-contain"
            />
          </div>
        </div>

        {/* Welcome Typography */}
        <div className="space-y-1.5 pt-1">
          <div className="flex flex-col items-center justify-center font-serif leading-none drop-shadow-md">
            <span className="text-2xl sm:text-3xl font-black text-white tracking-widest uppercase">
              BIENVENIDO
            </span>
            <span className="text-xs sm:text-sm font-bold text-white tracking-widest py-1 uppercase">
              A
            </span>
            <span className="text-2xl sm:text-3xl font-black text-emerald-400 tracking-wider uppercase">
              {restauranteNombre}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-zinc-300 font-medium leading-relaxed max-w-xs mx-auto pt-1">
            Disfruta de nuestros productos con la más alta calidad y delivery express directo a tu puerta.
          </p>
        </div>

        {/* Features / Mobile Highlights */}
        <div className="grid grid-cols-2 gap-2.5 py-2 text-left bg-zinc-950/90 rounded-2xl p-3 border border-zinc-800/80">
          <div className="flex flex-col items-center text-center p-2 rounded-xl bg-zinc-900/60 border border-zinc-800">
            <Flame className="w-5 h-5 text-emerald-400 mb-1" />
            <span className="text-xs sm:text-sm font-bold text-zinc-200 leading-tight">Productos</span>
            <span className="text-[10px] text-emerald-400 font-semibold">100% Calidad</span>
          </div>

          <div className="flex flex-col items-center text-center p-2 rounded-xl bg-zinc-900/60 border border-zinc-800">
            <Clock className="w-5 h-5 text-emerald-400 mb-1" />
            <span className="text-xs sm:text-sm font-bold text-zinc-200 leading-tight">Envío Express</span>
            <span className="text-[10px] text-zinc-400 font-medium">Directo a Ti</span>
          </div>
        </div>

        {/* Call to Actions */}
        <div className="space-y-2.5 pt-1">
          <button
            type="button"
            id="welcome-enter-menu-btn"
            onClick={onEnter}
            className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-emerald-600 hover:from-emerald-500 hover:to-emerald-500 text-black font-black text-sm sm:text-base tracking-wide uppercase shadow-[0_4px_20px_rgba(16,185,129,0.4)] hover:shadow-[0_6px_25px_rgba(16,185,129,0.6)] flex items-center justify-center gap-2.5 transition-all duration-200 transform active:scale-[0.98] cursor-pointer"
          >
            <UtensilsCrossed className="w-5 h-5 text-black" />
            <span>Ingresar al Menú / Hacer Pedido</span>
            <ChevronRight className="w-5 h-5 text-black" />
          </button>

          {onEnterSalon && (
            <button
              type="button"
              id="welcome-enter-salon-btn"
              onClick={onEnterSalon}
              className="w-full py-3 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 text-emerald-400 border-2 border-emerald-500/50 hover:border-emerald-400 font-extrabold text-xs sm:text-sm tracking-wide uppercase flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
            >
              <span>👥 Ver Salón & 15 Mesas (Cuadros)</span>
            </button>
          )}

          <div className="flex items-center gap-2 pt-0.5">
            {onTrackOrder && (
              <button
                type="button"
                id="welcome-track-order-btn"
                onClick={onTrackOrder}
                className="flex-1 py-2 px-3 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700/80 font-bold text-[11px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                <span>Rastrear Pedido</span>
              </button>
            )}

            {onEnterAdmin && (
              <button
                type="button"
                id="welcome-admin-btn"
                onClick={onEnterAdmin}
                className="flex-1 py-2 px-3 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700/80 font-bold text-[11px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>📊 Administrador</span>
              </button>
            )}
          </div>
        </div>

        {/* Bottom Trust Badge */}
        <div className="pt-2 flex items-center justify-center gap-1.5 text-[10px] sm:text-[11px] text-zinc-500 font-medium">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>Atención al Cliente y Delivery Oficial • Limpio, Paraguay</span>
        </div>
      </div>
    </div>
  );
};
