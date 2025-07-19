'use client';

import { Page } from '@/components/PageLayout';
import { ChessPuzzle } from '@/components/ChessPuzzle';
import { Marble, TopBar } from '@worldcoin/mini-apps-ui-kit-react';
import { useSession } from 'next-auth/react';

export default function Home() {
  const { data: session } = useSession();

  return (
    <>
      <Page.Header className="p-0">
        <TopBar
          title="Chess Puzzles"
          endAdornment={
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold capitalize">
                {session?.user.username}
              </p>
              <Marble src={session?.user.profilePictureUrl} className="w-12" />
            </div>
          }
        />
      </Page.Header>
      <Page.Main className="flex flex-col items-center justify-start gap-4 mb-16">
        <ChessPuzzle />
      </Page.Main>
    </>
  );
}
