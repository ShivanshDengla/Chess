import { kv } from '@vercel/kv';

export async function getUserPuzzleIndex(walletAddress: string): Promise<number> {
  const userPuzzleIndex = await kv.get<number>(walletAddress);
  return userPuzzleIndex ?? 0;
}

export async function setUserPuzzleIndex(
  walletAddress: string,
  puzzleIndex: number
): Promise<void> {
  await kv.set(walletAddress, puzzleIndex);
} 