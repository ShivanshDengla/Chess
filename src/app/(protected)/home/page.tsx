'use client';

import { Page } from '@/components/PageLayout';
import { ChessPuzzle } from '@/components/ChessPuzzle';
import { useState, useEffect } from 'react';

export default function Home() {
  const [backgroundFlash, setBackgroundFlash] = useState('');

  const handleMoveResult = (result: 'correct' | 'incorrect') => {
    if (result === 'correct') {
      setBackgroundFlash('bg-green-500/20');
    } else {
      setBackgroundFlash('bg-red-500/20');
    }
  };

  useEffect(() => {
    if (backgroundFlash) {
      const timer = setTimeout(() => {
        setBackgroundFlash('');
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [backgroundFlash]);

  return (
    <Page.Main
      className={`flex flex-col items-center justify-center gap-4 mb-16 transition-colors duration-300 ${backgroundFlash}`}
    >
      <ChessPuzzle onMoveResult={handleMoveResult} />
    </Page.Main>
  );
}
