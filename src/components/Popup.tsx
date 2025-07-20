'use client';

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
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-14 w-14 text-green-500"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
        )}
        {status === 'error' && (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="lucide lucide-x-circle h-12 w-12 text-red-500"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="m15 9-6 6" />
            <path d="m9 9 6 6" />
          </svg>
        )}
        <p className="text-center text-lg font-semibold text-black">{message}</p>
      </div>
    </div>
  );
}
