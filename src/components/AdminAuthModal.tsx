import React, { useState } from 'react';
import { Lock, Key, ShieldAlert, X, Eye, EyeOff, Bike, LayoutDashboard, Utensils, Users } from 'lucide-react';
import logoImg from '../assets/images/el_ternero_logo.svg';

interface StaffAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccessAdmin: () => void;
  onSuccessDriver: () => void;
  onSuccessKitchen?: () => void;
  onSuccessWaiter?: () => void;
  initialTarget?: 'admin' | 'repartidor' | 'cocina' | 'mozo' | 'choose';
  logoUrl?: string;
}

export const StaffAuthModal: React.FC<StaffAuthModalProps> = ({
  isOpen,
  onClose,
  onSuccessAdmin,
  onSuccessDriver,
  onSuccessKitchen,
  onSuccessWaiter,
  initialTarget = 'choose',
  logoUrl,
}) => {
  const [activeTab, setActiveTab] = useState<'admin' | 'repartidor' | 'cocina' | 'mozo'>(
    initialTarget === 'repartidor'
      ? 'repartidor'
      : initialTarget === 'cocina'
      ? 'cocina'
      : initialTarget === 'mozo'
      ? 'mozo'
      : 'admin'
  );

  // Admin form
  const [adminUser, setAdminUser] = useState('admin');
  const [adminPass, setAdminPass] = useState('admin123');
  const [showAdminPass, setShowAdminPass] = useState(false);

  // Mozo form
  const [waiterPass, setWaiterPass] = useState('1234');
  const [showWaiterPass, setShowWaiterPass] = useState(false);

  // Driver form
  const [driverPass, setDriverPass] = useState('1234');
  const [showDriverPass, setShowDriverPass] = useState(false);

  // Kitchen form
  const [kitchenUser, setKitchenUser] = useState('cocina');
  const [kitchenPass, setKitchenPass] = useState('cocina123');
  const [showKitchenPass, setShowKitchenPass] = useState(false);

  const [errorMsg, setErrorMsg] = useState('');
  const activeLogo = logoUrl || logoImg;

  if (!isOpen) return null;

  const handleAdminSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminUser.trim() === 'admin' && adminPass === 'admin123') {
      setErrorMsg('');
      onSuccessAdmin();
    } else {
      setErrorMsg('Usuario o contraseña de administrador incorrectos. (Demo: admin / admin123)');
    }
  };

  const handleWaiterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (waiterPass.trim() === '1234' || waiterPass.trim() === 'mozo123') {
      setErrorMsg('');
      if (onSuccessWaiter) {
        onSuccessWaiter();
      } else {
        onSuccessAdmin();
      }
    } else {
      setErrorMsg('Código PIN de mozo incorrecto. (Demo: 1234)');
    }
  };

  const handleDriverSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (driverPass.trim() === '1234' || driverPass.trim() === 'repartidor123') {
      setErrorMsg('');
      onSuccessDriver();
    } else {
      setErrorMsg('Código PIN de repartidor incorrecto. (Demo: 1234)');
    }
  };

  const handleKitchenSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      (kitchenUser.trim() === 'cocina' && kitchenPass === 'cocina123') ||
      kitchenPass === '1234'
    ) {
      setErrorMsg('');
      if (onSuccessKitchen) {
        onSuccessKitchen();
      } else {
        onSuccessAdmin();
      }
    } else {
      setErrorMsg('Usuario o contraseña de cocina incorrectos. (Demo: cocina / cocina123)');
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 relative overflow-hidden">
        {/* Accent top border */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-500" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <img
              src={activeLogo}
              alt="EL TERNERO"
              className="w-9 h-9 rounded-full object-contain bg-black border border-emerald-500/80 shadow-md shadow-emerald-500/20 ring-1 ring-slate-950 shrink-0"
            />
            <div>
              <h3 className="text-sm font-bold text-slate-100">EL TERNERO • Staff</h3>
              <p className="text-[11px] text-emerald-400 font-medium">Acceso Restringido Personal</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1.5 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Role Selector Tabs (4 roles: Admin, Mozo Salón, Cocina KDS, Delivery) */}
        <div className="grid grid-cols-4 gap-1 bg-slate-950 p-1 rounded-2xl border border-slate-800">
          <button
            type="button"
            onClick={() => {
              setActiveTab('admin');
              setErrorMsg('');
            }}
            className={`py-2 px-1 rounded-xl text-[10px] font-bold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
              activeTab === 'admin'
                ? 'bg-emerald-500 text-slate-950 shadow font-extrabold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>Admin</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('mozo');
              setErrorMsg('');
            }}
            className={`py-2 px-1 rounded-xl text-[10px] font-bold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
              activeTab === 'mozo'
                ? 'bg-emerald-500 text-slate-950 shadow font-extrabold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Mozo Salón</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('cocina');
              setErrorMsg('');
            }}
            className={`py-2 px-1 rounded-xl text-[10px] font-bold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
              activeTab === 'cocina'
                ? 'bg-emerald-500 text-slate-950 shadow font-extrabold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Utensils className="w-3.5 h-3.5" />
            <span>Cocina</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('repartidor');
              setErrorMsg('');
            }}
            className={`py-2 px-1 rounded-xl text-[10px] font-bold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
              activeTab === 'repartidor'
                ? 'bg-emerald-500 text-slate-950 shadow font-extrabold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Bike className="w-3.5 h-3.5" />
            <span>Delivery</span>
          </button>
        </div>

        {/* Demo Credentials Info */}
        <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80 text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5 font-medium">
            <Key className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>
              {activeTab === 'admin' ? (
                <>
                  Admin Demo: <strong className="text-slate-200 font-mono">admin</strong> / <strong className="text-slate-200 font-mono">admin123</strong>
                </>
              ) : activeTab === 'mozo' ? (
                <>
                  PIN Mozo (15 Mesas Salón): <strong className="text-slate-200 font-mono">1234</strong>
                </>
              ) : activeTab === 'cocina' ? (
                <>
                  Cocina Demo: <strong className="text-slate-200 font-mono">cocina</strong> / <strong className="text-slate-200 font-mono">cocina123</strong>
                </>
              ) : (
                <>
                  Repartidor Demo PIN: <strong className="text-slate-200 font-mono">1234</strong>
                </>
              )}
            </span>
          </div>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="bg-rose-950/40 border border-rose-500/30 p-2.5 rounded-xl text-rose-300 text-xs flex items-center gap-2 animate-shake">
            <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Form Admin */}
        {activeTab === 'admin' && (
          <form onSubmit={handleAdminSubmit} className="space-y-3.5 text-xs">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Usuario:</label>
              <input
                type="text"
                required
                value={adminUser}
                onChange={(e) => setAdminUser(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="admin"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Contraseña:</label>
              <div className="relative">
                <input
                  type={showAdminPass ? 'text' : 'password'}
                  required
                  value={adminPass}
                  onChange={(e) => setAdminPass(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-xl pl-3.5 pr-10 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowAdminPass(!showAdminPass)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200"
                >
                  {showAdminPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-slate-400 hover:text-slate-200 font-semibold text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-emerald-500/20 text-xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" />
                Ingresar al Panel
              </button>
            </div>
          </form>
        )}

        {/* Form Mozo Salón */}
        {activeTab === 'mozo' && (
          <form onSubmit={handleWaiterSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Código PIN de Mozo / Salón:
              </label>
              <div className="relative">
                <input
                  type={showWaiterPass ? 'text' : 'password'}
                  required
                  value={waiterPass}
                  onChange={(e) => setWaiterPass(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-xl pl-3.5 pr-10 py-2.5 font-mono text-center text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="1234"
                />
                <button
                  type="button"
                  onClick={() => setShowWaiterPass(!showWaiterPass)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-200"
                >
                  {showWaiterPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-slate-400 hover:text-slate-200 font-semibold text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-emerald-500/20 text-xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Users className="w-3.5 h-3.5" />
                Ingresar a Salón (15 Mesas)
              </button>
            </div>
          </form>
        )}

        {/* Form Cocina */}
        {activeTab === 'cocina' && (
          <form onSubmit={handleKitchenSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Usuario Cocina / Comanda:
              </label>
              <input
                type="text"
                required
                value={kitchenUser}
                onChange={(e) => setKitchenUser(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-xl px-3.5 py-2.5 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="cocina"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Contraseña:
              </label>
              <div className="relative">
                <input
                  type={showKitchenPass ? 'text' : 'password'}
                  required
                  value={kitchenPass}
                  onChange={(e) => setKitchenPass(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-xl pl-3.5 pr-10 py-2.5 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowKitchenPass(!showKitchenPass)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-200"
                >
                  {showKitchenPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-slate-400 hover:text-slate-200 font-semibold text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-emerald-500/20 text-xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Utensils className="w-3.5 h-3.5" />
                Ingresar a Cocina
              </button>
            </div>
          </form>
        )}

        {/* Form Driver */}
        {activeTab === 'repartidor' && (
          <form onSubmit={handleDriverSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Código PIN de Repartidor:
              </label>
              <div className="relative">
                <input
                  type={showDriverPass ? 'text' : 'password'}
                  required
                  value={driverPass}
                  onChange={(e) => setDriverPass(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-xl pl-3.5 pr-10 py-2.5 font-mono text-center text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="1234"
                />
                <button
                  type="button"
                  onClick={() => setShowDriverPass(!showDriverPass)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-200"
                >
                  {showDriverPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-slate-400 hover:text-slate-200 font-semibold text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-emerald-500/20 text-xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Bike className="w-3.5 h-3.5" />
                Ingresar como Repartidor
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

// Also export AdminAuthModal as backwards compatibility alias
export const AdminAuthModal = StaffAuthModal;
