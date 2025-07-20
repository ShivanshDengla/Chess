'use client';

import { Clock, Check } from 'iconoir-react';

interface PopupProps {
  message: string;
  status: 'processing' | 'success' | 'error';
}

export function Popup({ message, status }: PopupProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="flex flex-col items-center justify-center gap-4 rounded-2xl bg-white p-8 shadow-2xl">
        {status === 'processing' && (
          <div className="animate-spin">
            <Clock className="h-16 w-16 text-gray-500" />
          </div>
        )}
        {status === 'success' && <Check className="h-16 w-16 text-green-500" />}
        {status === 'error' && (
          <div className="h-16 w-16 text-red-500 font-bold text-4xl flex items-center justify-center">
            !
          </div>
        )}
        <p className="text-center text-lg font-semibold">{message}</p>
      </div>
    </div>
  );
}
