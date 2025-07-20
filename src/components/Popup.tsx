'use client';

import { useEffect } from 'react';

interface PopupProps {
  message: string;
  onClose: () => void;
  isError?: boolean;
}

export function Popup({ message, onClose, isError = false }: PopupProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 3000); // Auto close after 3 seconds

    return () => clearTimeout(timer);
  }, [onClose]);

  if (!message) return null;

  return (
    <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50">
      <div
        className={`px-6 py-3 rounded-full text-white font-bold ${
          isError ? 'bg-red-500' : 'bg-green-500'
        }`}
      >
        {message}
      </div>
    </div>
  );
}
