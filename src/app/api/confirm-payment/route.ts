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

  // Defensive check for a valid transaction object
  if (!transaction || typeof transaction.status === 'undefined') {
    console.error('Invalid transaction response from Worldcoin API:', transaction);
    return NextResponse.json({ success: false });
  }

  const isToAddressMatch =
    transaction.to && to && transaction.to.toLowerCase() === to.toLowerCase();

  console.log('--- Payment Confirmation ---');
  console.log(`Received Transaction ID: ${payload.transaction_id}`);
  console.log(`Transaction Status from API: ${transaction.status}`);
  console.log(`Reference Match: ${transaction.reference === payload.reference}`);
  console.log(`Recipient Match (case-insensitive): ${isToAddressMatch}`);
  console.log('--------------------------');

  if (
    transaction.reference === payload.reference &&
    isToAddressMatch &&
    transaction.status !== 'failed'
  ) {
    return NextResponse.json({ success: true });
  } else {
    return NextResponse.json({ success: false });
  }
} 