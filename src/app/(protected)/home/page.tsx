'use client';

import { Page } from '@/components/PageLayout';
import { ChessPuzzle } from '@/components/ChessPuzzle';

export default function Home() {
  return (
    <Page.Main className="flex flex-col items-center gap-4 mb-16">
      <ChessPuzzle />
    </Page.Main>
  );
}
