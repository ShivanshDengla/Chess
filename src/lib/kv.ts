import { kv } from '@vercel/kv';

export interface UserState {
  level: number;
  solvedPuzzleIds: number[];
}

export async function getUserState(walletAddress: string): Promise<UserState> {
  const userState = await kv.get<UserState>(walletAddress);
  return (
    userState ?? { level: 1, solvedPuzzleIds: [] }
  );
}

export async function setUserState(
  walletAddress: string,
  state: UserState
): Promise<void> {
  await kv.set(walletAddress, state);
} 