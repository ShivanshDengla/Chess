'use client';

import { Page } from '@/components/PageLayout';
import { ChessPuzzle } from '@/components/ChessPuzzle';
import { useState, useEffect, useRef } from 'react';

export default function Home() {
  const [backgroundFlash, setBackgroundFlash] = useState('');
  const correctSoundRef = useRef<HTMLAudioElement | null>(null);
  const incorrectSoundRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    correctSoundRef.current = new Audio('/ding_effect.mp3');
    incorrectSoundRef.current = new Audio('/buzz_effect.mp3');
  }, []);

  const handleMoveResult = (result: 'correct' | 'incorrect') => {
    if (result === 'correct') {
      setBackgroundFlash('rgba(0, 255, 0, 0.125)');
      correctSoundRef.current?.play();
      if (navigator.vibrate) {
        navigator.vibrate(100);
      }
    } else {
      setBackgroundFlash('rgba(255, 0, 0, 0.125)');
      incorrectSoundRef.current?.play();
      if (navigator.vibrate) {
        navigator.vibrate([200, 50, 200]);
      }
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
