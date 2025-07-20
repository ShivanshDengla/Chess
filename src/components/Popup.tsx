'use client';

import { Check } from 'lucide-react';
import styles from './ChessLoader.module.css';

interface PopupProps {
  message: string;
  status: 'processing' | 'success' | 'error';
}

export function Popup({ message, status }: PopupProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        className="flex flex-col items-center justify-center gap-4 rounded-2xl p-8 shadow-2xl"
        style={{ backgroundColor: 'white' }}
      >
        {status === 'processing' && <div className={styles.chessIcon} />}
        {status === 'success' && (
          <Check className="h-12 w-12 text-green-500" />
        )}
        {status === 'error' && (
          <div className="text-red-500">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="lucide lucide-x-circle h-12 w-12"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="m15 9-6 6" />
              <path d="m9 9 6 6" />
            </svg>
          </div>
        )}
        <p className="text-center text-lg font-semibold text-black">{message}</p>
      </div>
    </div>
  );
}
