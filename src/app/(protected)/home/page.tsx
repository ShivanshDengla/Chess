'use client';

import { Page } from '@/components/PageLayout';
import { ChessPuzzle } from '@/components/ChessPuzzle';
import { useState, useEffect } from 'react';

export default function Home() {
  const [backgroundFlash, setBackgroundFlash] = useState('');

  const handleMoveResult = (result: 'correct' | 'incorrect') => {
    if (result === 'correct') {
      setBackgroundFlash('rgba(0, 255, 0, 0.125)');
    } else {
      setBackgroundFlash('rgba(255, 0, 0, 0.125)');
    }
  };

  useEffect(() => {
    if (backgroundFlash) {
      document.body.style.transition = 'background-color 0.3s ease';
      document.body.style.backgroundColor = backgroundFlash;
      const timer = setTimeout(() => {
        document.body.style.backgroundColor = '';
        setBackgroundFlash('');
      }, 300);
      return () => {
        clearTimeout(timer);
        document.body.style.backgroundColor = '';
      };
    }
  }, [backgroundFlash]);

  return (
    <Page.Main
      className={`flex flex-col items-center justify-center gap-4 mb-16`}
    >
      <ChessPuzzle onMoveResult={handleMoveResult} />
    </Page.Main>
  );
}
