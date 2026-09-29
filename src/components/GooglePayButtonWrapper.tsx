import React, { useEffect, useRef, useState } from 'react';

interface GooglePayButtonWrapperProps {
  cartTotal: number;
  restaurantName: string;
  onPaymentSuccess: (paymentData: any) => void;
  disabled?: boolean;
}

export const GooglePayButtonWrapper: React.FC<GooglePayButtonWrapperProps> = ({
  cartTotal,
  restaurantName,
  onPaymentSuccess,
  disabled = false,
}) => {
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handlePayClick = () => {
    if (disabled || isProcessing) return;
    setIsProcessing(true);

    // Simulate Google Pay native sheet authorization or integrate with window.google.payments if loaded
    setTimeout(() => {
      setIsProcessing(false);
      onPaymentSuccess({
        status: 'SUCCESS',
        paymentMethodData: {
          type: 'CARD',
          description: 'Google Pay •••• 4242',
          token: 'gpay_token_test_' + Date.now(),
        },
      });
    }, 600);
  };

  return (
    <button
      type="button"
      onClick={handlePayClick}
      disabled={disabled || isProcessing}
      className="w-full min-h-[48px] h-12 bg-black hover:bg-neutral-900 active:scale-[0.99] text-white font-medium rounded-xl flex items-center justify-center gap-2.5 transition-all shadow-md cursor-pointer border border-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed"
      title={`Pagar con Google Pay - ${restaurantName}`}
    >
      {isProcessing ? (
        <div className="flex items-center gap-2 text-sm">
          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          <span>Procesando Google Pay...</span>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-1.5 select-none">
          <span className="text-sm font-semibold tracking-tight text-white/90">Pagar con</span>
          {/* Google Pay Official Logo */}
          <div className="flex items-center gap-1 ml-0.5">
            <svg className="h-5 w-auto" viewBox="0 0 41 17" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M19.5 8.7c0-.6-.1-1.2-.2-1.8H10v3.4h5.4c-.2 1.2-.9 2.2-2 2.9v2.4h3.2c1.9-1.7 3-4.3 3-6.9z"
                fill="#4285F4"
              />
              <path
                d="M10 17c2.7 0 5-1 6.7-2.6l-3.2-2.4c-.9.6-2.1 1-3.5 1-2.7 0-4.9-1.8-5.7-4.2H1V11.3C2.8 14.7 6.1 17 10 17z"
                fill="#34A853"
              />
              <path
                d="M4.3 8.8c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V2.4H1C.4 3.7 0 5.2 0 6.8s.4 3.1 1 4.4l3.3-2.4z"
                fill="#FBBC05"
              />
              <path
                d="M10 3.4c1.5 0 2.8.5 3.8 1.5l2.8-2.8C14.9.8 12.6 0 10 0 6.1 0 2.8 2.3 1 5.7l3.3 2.4C5.1 5.2 7.3 3.4 10 3.4z"
                fill="#EA4335"
              />
              <path
                d="M26.2 4.4h-3.8V16h2.4v-4.4h1.4c2.4 0 4.2-1.7 4.2-3.6s-1.8-3.6-4.2-3.6zm0 4.9h-1.4V6.6h1.4c1.2 0 2 .9 2 1.4s-.8 1.3-2 1.3zM35.6 7.6c-1.6 0-3 1.2-3 2.9s1.3 2.9 3 2.9c.8 0 1.5-.3 2-.9v.7h2.2V7.8h-2.2v.7c-.5-.6-1.2-.9-2-.9zm.3 4.1c-.8 0-1.5-.6-1.5-1.3s.7-1.3 1.5-1.3 1.5.6 1.5 1.3-.7 1.3-1.5 1.3z"
                fill="#FFFFFF"
              />
            </svg>
          </div>
        </div>
      )}
    </button>
  );
};
