import { NextResponse } from 'next/server';

function generateRandomString(length: number): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

export function GET() {
  try {
    const id = crypto.randomUUID();
    return NextResponse.json({ id });
  } catch {
    console.warn(
      'crypto.randomUUID() is not available. Using a fallback. (This is expected in non-secure contexts)'
    );
    const id = generateRandomString(36);
    return NextResponse.json({ id });
  }
}
