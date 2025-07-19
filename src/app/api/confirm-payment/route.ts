import { NextRequest, NextResponse } from 'next/server';
import { MiniAppPaymentSuccessPayload } from '@worldcoin/minikit-js';

interface IRequestPayload {
  to: string;
  payload: MiniAppPaymentSuccessPayload;
}

export async function POST(req: NextRequest) {
  const { to, payload } = (await req.json()) as IRequestPayload;

  // IMPORTANT: Here we should fetch the reference you created in /initiate-payment to ensure the transaction we are verifying is the same one we initiated
  // In a real app, you would look up the reference from your database
  // const reference = getReferenceFromDB(payload.reference)

  const response = await fetch(
    `https://developer.worldcoin.org/api/v2/minikit/transaction/${payload.transaction_id}?app_id=${process.env.NEXT_PUBLIC_APP_ID}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${process.env.DEV_PORTAL_API_KEY}`,
      },
    }
  );

  const transaction = await response.json();

  // Here we optimistically confirm the transaction.
  // We also check that the transaction details match the payload from the mini app
  if (
    transaction.reference == payload.reference &&
    transaction.to == to &&
    transaction.status != 'failed'
  ) {
    return NextResponse.json({ success: true });
  } else {
    return NextResponse.json({ success: false });
  }
} 