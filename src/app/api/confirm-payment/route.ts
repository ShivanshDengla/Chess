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

  console.log('--- Payment Confirmation ---');
  console.log('Transaction from Worldcoin API:', transaction);
  console.log('Data from Mini App:', { to, payload });
  console.log('--- Comparison Details ---');
  console.log(`transaction.reference: ${transaction.reference}`);
  console.log(`payload.reference:     ${payload.reference}`);
  console.log(`Reference match? ${transaction.reference == payload.reference}`);
  console.log(`transaction.to: ${transaction.to}`);
  console.log(`"to" from request: ${to}`);
  console.log(`Addresses match? (case-sensitive): ${transaction.to == to}`);
  console.log(
    `Addresses match? (case-insensitive): ${
      transaction.to.toLowerCase() == to.toLowerCase()
    }`
  );
  console.log(`transaction.status: ${transaction.status}`);
  console.log(`Status !='failed'? ${transaction.status != 'failed'}`);
  console.log('--------------------------');

  // Here we optimistically confirm the transaction.
  // We also check that the transaction details match the payload from the mini app
  if (
    transaction.reference == payload.reference &&
    transaction.to.toLowerCase() == to.toLowerCase() &&
    transaction.status != 'failed'
  ) {
    return NextResponse.json({ success: true });
  } else {
    return NextResponse.json({ success: false });
  }
} 